# Usability audit — mobius-mcp + extension

Run: 2026-08-02, branch `feat/chrome-driver`. Server 1.0.2, protocol 3.
Target: https://deepmind.google/ (a real, heavy marketing site), extension client with CDP.

## Verdict

The core pipeline works, and works well. A three-step `run_sequence` (scroll → type →
click) drove a real newsletter signup end to end, `hitTest: "ok"` on every step, and the
`observe` window caught a genuine silent failure: a `GET /api/newsletter/double-opt-in/`
returning **404** (HTML error page) alongside the successful `POST` to
`services.google.com/fb/submissions/deepmindgoogle/` → `{"result":"accepted"}`. That is
exactly the "silent API failure" scenario the product is for, and it surfaced without being
asked for. A follow-up screenshot confirmed the page reached its success state.

The problems are not in the mechanism. They are in **output economics** (three findings
that waste or exceed the agent's token budget) and **silent data corruption** (F3, the most
serious finding here).

---

## Findings

### F1 — `mobius_diagnose` misdiagnoses "browser never connected" as "extension out of date" *(fixed)*

Sent the first pass of this audit down a completely wrong path: it told me to update the
extension when Chrome simply wasn't running.

The state machine (`services/diagnostics.ts:85-90`) picks `handshake_rejected` on
`rejectedHandshakes > 0 && !everConnected`. Both halves are weaker than they look:

- `everConnected` only flips for **tab** clients (`services/registry.ts:22`, gated on
  `isTabClient`). Two follower processes were connected and healthy the whole time and
  neither counts — `everConnected: false` does not mean "nothing ever connected".
- `rejectedHandshakes` is one process-wide counter incremented by *any* client on *any*
  message (`transports/wsServer.ts:60-63` — the version check runs on every message, not
  just `hello`). A rejection from a follower on a stale build is indistinguishable from a
  stale extension.

**Confirmed by the successful run**: with a tab happily streaming and `state: "ready"`,
`rejectedHandshakes` read **12**. The counter is pure noise and must never be load-bearing.

*Fix applied*: the `handshake_rejected` remediation now leads with "click the mobius-mcp
toolbar icon on the target tab and toggle capture on" and only then offers the version
steps; its `agentGuidance` states that a rejection does not prove a version mismatch, tells
the agent to ask the user to enable a tab, and to re-run `mobius_diagnose` before relaying
version advice. *Still open*: rejections remain unattributed (F2).

### F2 — Handshake rejections are recorded without any identifying detail *(open)*

`Diagnostics.reportHandshakeRejected()` (`services/diagnostics.ts:76`) takes no arguments,
so the offending client's version and type are discarded — which is why F1 could not
distinguish a follower from the extension. `wsServer.ts:60` has `message.version` in hand
(and `message.client.clientType` on a `hello`). Passing them through would let diagnose say
"client sent protocol 2" and drop the hedged "extension **and/or** server" remediation.
It would also let the counter be scoped to extension clients, making it meaningful.

### F3 — The JWT redaction regex corrupts response bodies wholesale *(fixed)*

`packages/capture-core/src/utils/redact.ts:4`:

```js
const JWT_RE = /\b[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
```

This matches *any* three dot-separated alphanumeric runs, and `maskJwts` is **on by
default** (`data.ts:12`). Real damage observed in a single captured response body:

| Actual content | Delivered to the agent |
|---|---|
| `fonts.googleapis.com`, `services.google.com` | `[redacted-jwt]` |
| `document.documentElement.classList` | `[redacted-jwt]` |
| `localStorage.getItem(STORAGE_KEY)` | `[redacted-jwt](STORAGE_KEY)` |
| `http://www.w3.org/2000/svg` | `http://[redacted-jwt]/2000/svg` |
| SVG path data `M16.41 5.41L15 4l-8...` | `[redacted-jwt]` |

Every hostname with 3+ labels, every property chain, every version string, and much path
data is destroyed. This silently corrupts the *primary artifact the product exists to
deliver* — an agent debugging a request sees `[redacted-jwt]` where the real hostname or
API call was, and can easily misdiagnose. It is worse than a missing body, because it looks
like a legitimate secret was found.

A real JWT is base64url with three segments, a `eyJ`-prefixed header, and non-trivial
length. Suggested: require `^eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*$`
shape, or at minimum a length floor per segment plus a `eyJ` header check.

Secondary bug in the same file: `redactBodyText` runs `maskText` **before** `JSON.parse`
(`redact.ts:35-40`), so masking operates on and can break the JSON it is about to parse —
and the failure is swallowed by the bare `catch`, silently degrading to unparsed text.
Mask after parsing, on string values only.

### F4 — `run_sequence` double-wraps and double-encodes every step result *(fixed)*

`mcpServer.ts:610` pushes `stepResult` — already a full MCP envelope
`{content:[{type:"text",text:"<json>"}]}` — into `results`, and then `toolResult()`
stringifies the whole thing again. The agent receives escaped JSON inside JSON inside the
outer envelope:

```
"result": { "content": [ { "type": "text", "text": "{\n  \"clicked\": true,\n ..." } ] }
```

vs. the useful `"result": { "clicked": true, "hitTest": "ok" }`. Roughly 3× the tokens and
markedly harder to read. Unwrap to the parsed payload before pushing.

### F5 — Every tool result is pretty-printed, costing ~2.1× tokens *(fixed)*

`utils/tools.ts:10` — `JSON.stringify(data, null, 2)`. Measured on the `snapshot_page`
payload: **88,357 bytes pretty vs 42,530 minified**. Indentation buys a model nothing and
is applied across the entire tool surface. This compounds F4 and directly causes F6.

### F6 — `snapshot_page` exceeded the tool-result token limit on an ordinary page *(fixed)*

The primary "how do I find something to click" tool **failed outright** on first use and
had to be spilled to a file, forcing me to parse it with a Python script to get any refs at
all. That is a total failure of the tool's stated job.

- 323 elements → 88KB / 4,089 lines, over the limit.
- The pruning rule itself (`snapshot/walk.ts:28`, "interactive, labelled, or text-bearing")
  is sound, and `ownText` correctly counts direct text nodes only. The logic is not at fault.
- `MAX_SNAPSHOT_ELEMENTS = 500` (`snapshot/data.ts`) is miscalibrated: its comment worries
  about "megabytes of tree", but the binding constraint is the token limit, which 323
  elements already blew. The cap is ~2× too high even before F5's 2.1× multiplier.

Suggested: minify (F5), lower the cap to ~150, and add scoping parameters — the tool
currently accepts only `tabId`/`chromeTabId`, so an agent has **no way to ask for less**.
A `viewportOnly` flag, a `roles` filter, or a `maxElements` override would each resolve it.

### F7 — `observe` returns `[]` for a disabled category, indistinguishable from "nothing happened" *(fixed)*

Clicking a carousel control with `observe: { windowMs: 2000, types: ["dom-mutation"] }`
returned `"observed": []`. The tab has `dom: false` in its capture settings, so the request
was unanswerable — but nothing in the response says so. An agent reads `[]` as "the click
did nothing", which is precisely the wrong conclusion for the *dead-click* scenario this
tool is built for.

The server's own MCP instructions warn about this ("Check `get_capture_settings` before
concluding an empty result means nothing happened"), which is an admission that the tool
output is misleading. Worse, those same instructions tell the agent to prefer `observe`
*instead of* a separate follow-up call — so the natural, documented path walks straight
into the trap. `observe` should report which requested `types` are not being captured,
e.g. `"observed": [], "notCaptured": ["dom-mutation"]`.

### F8 — Doc/reality mismatch on `ref` staleness *(fixed)*

`snapshot_page`'s description says refs "go stale the moment the page changes — call this
again after any action". In practice refs from `snap_1` resolved correctly after two
clicks, a scroll, and a typed input, because the registry holds live element handles.
The warning is over-strict: taken literally it mandates a re-snapshot after every action,
which given F6 is exactly the thing an agent cannot afford to do. Worth stating the real
rule (refs die when the element is detached / the page navigates).

### F9 — Full response bodies land in `observe` windows with no way to opt out *(open)*

The 404 in the successful run dumped ~20KB of HTML error page into the click result. The
*status* was the valuable signal; the body was noise. `observe` has no metadata-only mode,
so an action against a page with a chatty 404 can swamp the response.

### F10 — Three server processes; the hub is whichever won the port race *(open)*

Observed: PIDs 5018 (hub, LISTEN on 7331), 5321 and 5822 attached as followers — one per
Claude Code session. The process owning the browser's only WS connection is arbitrary, and
if that session exits the hub dies and takes the extension connection with it. Worth
confirming this is acceptable in practice.

---

## Coverage

Tested: `mobius_diagnose`, `snapshot_page`, `click` (+`observe`), `type_text`, `scroll_to`,
`run_sequence`, `evaluate_js`, `take_screenshot`, `get_capture_settings` (via diagnose).

Not tested: debug sessions, HAR export, CPU/memory profiling, `capture_dom`,
`capture_accessibility_tree`, `wait_for_*`, tab lifecycle (`open_tab`/`switch_tab`),
`get_request_body`/`get_response_body`, job tools.

## Fixes applied

| # | Change |
|---|---|
| F1 | `handshake_rejected` remediation leads with "enable capture on the tab"; guidance no longer asserts a version mismatch |
| F3 | `JWT_RE` anchored on `eyJ` with per-segment length floors; `redactBodyText` now parses before masking and masks string leaves only. Regression tests pin all five observed corruption cases plus a real JWT |
| F4 | `unwrapToolContent` in `utils/tools.ts`; `run_sequence` steps report `{tool, result}` / `{tool, error}` with the payload, not a nested envelope |
| F5 | `toolResult` emits minified JSON |
| F6 | `MAX_SNAPSHOT_ELEMENTS` 500 → 150; `snapshot_page` gains `viewportOnly`, `roles`, `maxElements`, and returns `truncated: true` when the cap is hit |
| F7 | `runCommandWithObserve` reports `notCaptured` + a hint listing capture categories that are off, so an empty `observed` is never mistaken for "nothing happened" |
| F8 | `snapshot_page` description states the real rule: refs survive clicks/scrolling and die on detach or navigation |

Overlay, per direct request: cursor now tweens between positions via the Web Animations API
(the CSS `transition` never fired on the first move, because the element's initial style had
not been resolved when the transform changed — hence the teleporting); the blurred-SVG halo
is replaced by a radial-gradient glow div beneath the icon; the HUD shows a "mobius"
wordmark beside the logo when expanded.

Verification: `npm run build` clean, `tsc --noEmit` clean in both workspaces, 42/42 tests pass.

## Second pass — new findings (2026-08-02, after fixes)

### F11 — A server fix cannot be deployed by restarting your own MCP server *(dev-workflow only)*

**Scoped down after review**: this only bites when developing mobius-mcp itself, where
sessions run different builds of the same server. In normal use every session runs the same
published version, so an "old" hub is functionally identical to a new one and nothing is
wrong. What remains real is the *diagnostic* gap below — nothing identifies which process is
the hub or what build it runs, so the symptom (fixes appearing not to apply) is hard to
attribute. Priority: low, and a dev-ergonomics fix, not a product one.


`/mcp reconnect` spawned a fresh process (PID 22758) carrying the fixes, but it lost the
port race and became a **follower**, forwarding every tool call to the stale hub (PID 5018,
started 10:00, pre-fix build). Verified by the tell: `mobius_diagnose` output was still
pretty-printed after F5 shipped. The hub *does* have promotion logic
(`index.ts:60-73`, `setOnHubLost`), so killing the hub lets a follower take over — but
there is no in-band way to trigger that. This turns F10 from an architectural note into an
operational blocker: a developer working on mobius-mcp itself cannot test a server change
while any older session holds the port. Worth a `restart_hub` control command, or having
the hub compare its build/version against a connecting follower and hand over to a newer one.

### F12 — `take_screenshot` times out opaquely on a backgrounded tab

Hit twice. `Page.captureScreenshot` never returns for a tab that is not foreground, so the
call dies on the generic 10s dispatcher timeout with `Command "take_screenshot" timed out
after 10000ms` — no hint that the tab simply needs focus. `switch_tab` first makes it
work instantly. Either auto-foreground the tab, or detect the condition and return
"tab is not in the foreground — call switch_tab first".

### F13 — `open_tab` returned no `tabId`, forcing a second call

`open_tab` came back with only `{chromeTabId}`, so a follow-up `enable_capture` was needed
to get a usable `tabId`. The description anticipates this ("in case capture didn't start
yet"), but in practice it meant the documented one-call path did not hold on first use.
Worth having `open_tab` wait briefly for capture to start before returning.

### F14 — Snapshot truncation is DOM-order, so it can return entirely offscreen content

With the cap now at 150, a snapshot of a scrolled-down page returned 150 elements whose `y`
values were almost all negative (up to `-4538`) — i.e. the whole budget was spent on markup
above the viewport, and `truncated: true` meant everything actually on screen was dropped.
The cap makes the tool fit, but ordering makes the result low-value on a long page. Either
prefer in-viewport elements when truncating, or have the description steer to `viewportOnly`
as the default first call rather than an optional narrowing.

### F15 — `observe.types` accepts unknown strings and silently returns nothing

`observeSchema` types it as `z.array(z.string())` (`mcpServer.ts:49`) with no validation
against the actual `EventType` union. I passed `"dom-mutation"` — the real type is
`"dom.mutation"` — and got `"observed": []` with no error and, worse, no `notCaptured`
either, because the category filter matched nothing. It reads exactly like "the action had
no effect". This is the same class of bug as F7 and defeats F7's fix whenever the type is
misspelled; I fell for it twice, once in each pass. `types` should be a `z.enum` of the
known event types, or unknown entries should be echoed back as `unknownTypes`.

## Still open

- **F2** — rejections remain unattributed, so `handshake_rejected` is still reachable from a non-extension client.
- **F9** — `observe` still has no metadata-only mode; a chatty 404 body can swamp an action result.
- **F10** — hub/follower port race: the hub is an arbitrary session's process, and it dies with that session.
- **F11** — dev-workflow only (see above); the residue is that nothing reports which process is the hub or its build.
- **F12, F13, F14** — from the second pass, all unfixed.

## Verified live (second pass)

Extension-side fixes confirmed against https://deepmind.google/:

- **F6** — `snapshot_page` returned exactly 150 elements with `truncated: true`, and fit.
- **Cursor animation/visibility** — glow now has a solid core with the icon layered above it
  (`zIndex` 0/1); the dark icon reads against the green backdrop on a dark page, which it did
  not before. `moveCursorTo` positions before showing, so it no longer fades in at the old spot.
- **HUD** — "Mobius" wordmark shows when expanded; empty state ("Waiting for activity —
  clicks, typing and navigation driven by mobius will appear here.") renders before the first
  entry and is replaced on first log.
- **Driving** — `navigate_to` + `wait_for_navigation` + `wait_for_element` sequence passed;
  `hover` reported `hitTest: "ok"`; `click` on an offscreen sticky-nav link correctly reported
  `hitTest: "blocked"`, `reason: "offscreen"`.

Server-side fixes verified after the stale hub was killed and a follower promoted:

- **F5** — `mobius_diagnose` returned minified JSON. This was also the tell that exposed F11.
- **F6 params** — `snapshot_page` with `viewportOnly: true`, `roles: ["button","link","textbox"]`,
  `maxElements: 25` returned 16 elements, all with positive `y`, no `truncated` — ~2KB against
  the 88KB that failed outright in the first pass.
- **F7** — `click` with `observe.types: ["dom.mutation"]` on a tab with `dom: false` returned
  `"notCaptured": ["dom"]` plus the explanatory hint.
- **F4** — `run_sequence` steps came back as `{"tool":"scroll_to","result":{"scrolled":true}}`,
  no nested envelope, no double encoding.
- **F3** — a real 200 HTML body arrived with `fonts.googleapis.com`, `fonts.gstatic.com`,
  `storage.googleapis.com`, `//googleads.g.doubleclick.net`, `window.trustedTypes.createPolicy`,
  `window.localStorage.getItem(STORAGE_KEY)`, `html.classList.remove(...)`,
  `http://www.w3.org/2000/svg` and the `M16.41 5.41L15 4l-8 8...` path data all intact.
  Zero `[redacted-jwt]` occurrences. Every first-pass corruption case is resolved.

Bonus signal: `hitTest` correctly distinguished three different block reasons across this
pass — `ok`, `offscreen`, `pointer_events`, and `covered` (naming `a.card__overlay-link` as
the intercepting element).
