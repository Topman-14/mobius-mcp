# Roadmap

mobius-mcp started as a log bridge. The direction is a **browser runtime service**: a server an agent can command, not just read from — synchronous tools answer questions about existing state, asynchronous ones (backed by a shared job system) initiate work that takes time.

Stages A–F built the observability half of that. Stages G onward build the other half: **driving**. The target user is an agent in an ecosystem with no first-party browser agent — Cursor, Windsurf, Zed, Cline, Codex, OpenCode, or Claude Code on a machine without the Claude in Chrome extension — for whom "look at the running app" currently means "ask the human to paste something."

Stage F was the last stage that could ship server-only. Everything from Stage H on touches `packages/capture-core`'s wire protocol and the extension together, so `PROTOCOL_VERSION` moves with it.

Nothing here is published yet, so none of this is versioned (`v1`/`v2`/...) — it's tracked as build stages instead. Version numbers start once something actually ships.

**npm client status: paused.** `mobius-client` works at its current baseline (console/error/network capture via `startMobiusStream()`), but isn't getting further investment right now — framework/bundler nuances (Vite/webpack HMR re-invoking the patch, Next.js SSR/RSC boundary, React StrictMode double-invoke) make it a deeper problem than the extension warrants prioritizing today. The extension is where new capability work lands; the npm client will catch up once that's mature.

## Stage A — per-tab identity, memory bounds, opt-in capture (done)

- Per-tab identity: one background worker multiplexes many tabs over one WebSocket, but each tab is its own logical client (`hello`/`bye` per tab, not per browser install)
- Per-tab in-memory ring buffers (not one global buffer) with a shared cross-tab `seq` counter, field-length truncation, disconnect grace period before purge
- Tool disambiguation: `tabId` param on all query tools, auto-resolved when only one tab is connected, `set_active_tab` for session-scoped default, explicit error (not silent guessing) when multiple tabs are connected and unspecified
- Extension capture is opt-in per tab: a popup toggle (click the icon) is the single opt-in; an options page lets hostname/port rules auto-enable specific dev servers without a manual click. Nothing is captured by default.

## Stage B — command infrastructure (done)

The browser client becomes a remote-debugging target (Chrome DevTools ⇄ Chrome), not just a one-way log producer.

- Message envelope gains `kind: "command"` / `"ack"` variants with correlation IDs
- `ClientInfo`/`hello` gains `capabilities` (`["cdp"]` for the extension, `[]` for the npm client) — commands a client can't support fail clearly instead of hanging
- Job system (`startJob`/`get_job_status`/`get_job_result`/`cancel_job`) — the shared primitive every async capability after this stage is built on
- Browser-control tools needing no CDP: `navigate_to`, `list_tabs`, `switch_tab`, `reload_tab`

## Stage C — debug sessions (done)

The highest-leverage capability beyond raw ingestion, and cheap once the job system exists — aggregates event streams into one time-ordered timeline instead of forcing the agent to correlate separate snapshots itself.

- `start_debug_session({ tabId, capture: [...] })` / `end_debug_session(sessionId)` → ordered timeline (console, network, navigation, DOM mutations); single-tab sessions only for now
- New always-on `navigation` event type; `dom.mutation` event type, captured only during a session that requests it (mutation observers are noisy/expensive to run always-on)
- `wait_for_*` tools built on the same infrastructure: `wait_for_console_error`, `wait_for_navigation`, `wait_for_request` (server-side, event-driven), `wait_for_element` (in-page polling via a command)

## Stage D — CDP-backed capture (extension-only) (done)

Everything here requires `chrome.debugger` (Chrome DevTools Protocol) — gated by the `capabilities` check from Stage B, unavailable to npm-client-only tabs. Attaching shows Chrome's "being debugged" banner on the tab; the debugger attaches once per tab (not per call) and stays attached while the tab is capture-enabled.

- Screenshots: `take_screenshot`, `capture_full_page`, `capture_element`
- DOM/accessibility: `capture_dom`, `capture_accessibility_tree`
- Performance: `start_cpu_profile`, `start_memory_profile` — job-based, capped at 60s and best-effort beyond ~25-30s since an idle MV3 background service worker can be terminated by Chrome mid-profile
- Runtime evaluation: `evaluate_js` — fully open, no read-only enforcement (local-first threat model: it's the dev's own browser and app)
- Network detail: `get_response_body` (URL-keyed, best-effort — only requests seen via CDP's `Network.responseReceived` while attached), `export_har` (works from stored events for either client; full-body export landed later, see Stage F)

## Stage E — network request/response detail (done)

Closes the biggest network-capture gap: `NetworkEvent` used to carry only method/URL/status/duration and request headers, so an agent chasing a failed API call had to fall back to the CDP-only `get_response_body` (extension-only, and it didn't cover request bodies at all).

- `NetworkEvent` gained `responseHeaders`, `statusText`, `mimeType`, and size-capped (~20,000 chars) `requestBody`/`responseBody` with `*Truncated`/`*OmittedReason` fields — captured in `packages/capture-core` (shared by the extension and the paused npm client) via the existing `fetch`/XHR patches, not CDP, so both clients get it identically
- Response bodies are read from a `.clone()` *after* the response is already returned to the caller's own code, so this never adds latency to the app's own `fetch` calls — the single `network.fetch`/`network.xhr` event for that request is emitted once the body read (or the decision to skip it) resolves, not before
- Content-type gated (text/JSON/XML/form/GraphQL only) and redacted before emit — a new `redactSensitiveBodyFields` privacy toggle masks password/token/secret/apiKey-shaped JSON keys, independent of header redaction
- `export_har` and `get_network_requests`/`get_logs_since` now carry real headers and status text; `get_response_body` is reframed as the CDP fallback for bodies capture-core skipped (binary, oversized, non-text content-type), not the primary path
- Privacy options simplified alongside this: the old `redactHeaders`/`redactCookies` pair (redundant — cookies were always just header names) became one configurable `redactedHeaderNames` list, editable in the options page. The never-implemented `redactLocalStorage` option was removed rather than shipped as dead UI — see "Framework introspection" below for the tracked future work it belonged to.

## Stage F — mcp-server persistence & cleanup (done)

Closes the server half of "durable log persistence" (extension side still open, see "Beyond this plan") and restructures `apps/mcp-server/src` past its flat file-per-concern layout.

- `get_request_body` — the request-side counterpart to `get_response_body`, same CDP fallback semantics (URL-keyed, best-effort, extension-only)
- `export_har` now exports full request/response bodies, not headers-only: bodies already captured inline are used as-is, anything `*Truncated` or skipped (binary, oversized, non-text content-type) is re-fetched over CDP when the tab supports it, with binary bodies coming back base64-encoded in `content.encoding` per the HAR 1.2 spec
- **Crash/restart durability**: `EventStore`'s ring buffer is now mirrored to an append-only JSONL file per tab (`services/persistence.ts`), replayed into memory on boot, and reaped on an interval. Configurable via `CONSOLE_STREAM_PERSISTENCE_TTL_MS` (default 1 hour) and `CONSOLE_STREAM_PERSISTENCE_DIR` (default a temp-dir subfolder) — see `README.md`'s Configuration section. Plain files, not an embedded DB — the capped working set never exceeds a few MB, so SQLite (native-binary install risk, or `node:sqlite`'s Node 22.5 floor) buys nothing here.
- `MAX_EVENTS_PER_TAB` default raised from 1000 to 3000 events/tab now that history survives a restart instead of being purely disposable — same cap governs both the in-memory buffer and the on-disk file
- Structural cleanup: `apps/mcp-server/src` split into `types.ts`/`data.ts` (mirroring `packages/capture-core`'s layout), a `utils/` folder of pure helpers grouped by what they operate on (`events`, `wait-for`, `har`, `tools`, `errors`), a `services/` folder for the stateful singletons `index.ts` instantiates (`store`, `registry`, `commandDispatcher`, `jobs`, `debugSession`, `controlClient`, `persistence`), and a `transports/` folder for the two protocol-facing servers (`wsServer`, `mcpServer`). The repeated per-tool `resolveTabId`/`requireCdp`/try-catch boilerplate in `mcpServer.ts` collapsed into shared helpers (`resolveCdpTab`, `runCommand`) in `utils/tools.ts`.

## Decisions taken before Stage G

Recorded here because the stages below only make sense if these are settled. Source: `AGENT_INTEGRATION_BRIEF.md`, written from an outside session that tried to use this server and couldn't.

**Does mobius drive, or stay pure observability?** It drives. The brief framed this as an open question with a defensible "no" — that "no" is rejected. The reason isn't feature parity for its own sake: it's that the questions mobius is best at ("why did this request fail", "what errored after that click") mostly can't be *reached* without first getting the app into the state where they happen. An observability tool that needs a human to click the button before it can answer anything is a tool the agent routes around. Everything in Stages H–J follows from this.

**What mobius sells that a first-party browser agent doesn't.** Not input synthesis — that's table stakes and we're late to it. It's that mobius drives and observes over *the same connection*, so an action can return what it caused. Clicking and then separately asking "what happened" is two round trips and a correlation problem; `click(ref, { observe: ... })` returning the console errors, requests, navigations and DOM changes inside that action's window is one round trip and no correlation. That, plus the things Stages A–F already built and no browser agent has (rolling history that survives a restart, blocking `wait_for_*`, `export_har` with full bodies, CPU/memory profiles), is the pitch. Stage I is where it lands, and it should be built *as* the differentiator, not bolted on after the actions work.

**Is `dom.mutation` pulling its weight?** Not today — the brief is right that the payload is low-signal and nothing consumes it. But it's kept, because driving changes the calculus: once an action has an observation window, "did anything in the DOM change" is the exact signal that separates a dead click from a slow one. Stage I raises its signal and makes it the default DOM channel of the observe window; Stage K re-decides with evidence. If it still isn't reached for after that, it gets deleted.

**Does `capture_dom` survive?** Yes, demoted. Raw `outerHTML` is occasionally the right answer (diffing markup, checking a server-rendered payload), but it's the wrong default for an agent — Stage H makes `snapshot_page` the thing tool descriptions point at, and rewrites `capture_dom`'s description to say when *not* to use it.

## Stage G — routing and self-diagnosis (mostly done)

Entirely `apps/mcp-server`. No protocol change, no extension change — this stage exists because the capability that already existed was undiscoverable and, when it didn't work, undiagnosable (an outside session with mobius registered globally couldn't use it, couldn't tell the user why, and reported a confidently wrong cause). Shipped in `d9af325`.

Done:

- **`instructions` on `McpServer`** — both the hub and follower servers now inject routing guidance (when mobius is the right tool, the mandatory `mobius_diagnose` preflight, don't silently fall back) into the MCP client's system prompt.
- **`VERSION` from `package.json`** (`data.ts`) — one source of truth, used by both `McpServer` constructors and `HAR_CREATOR_VERSION`, resolved via `createRequire` so it works running from source too.
- **Disconnection evidence retained** (`services/registry.ts`, `transports/wsServer.ts`) — `everConnected`, `lastClientSeenAt`, `lastDisconnectReason`, bind success/failure, and a count of handshakes rejected for protocol mismatch all survive past `ClientRegistry` purge.
- **`mobius_diagnose`** (`services/diagnostics.ts`) — never fails, never needs a tab, returns a machine-readable `state` (`ready` / `no_client_ever_connected` / `client_disconnected` / `handshake_rejected` / `ws_bind_failed` / `no_server_running` / `error`) plus ordered remediation and `agentGuidance` telling the agent to relay and stop rather than retry or fall back.
- **Every tool failure points at it** — `resolveTabId`/`requireCdp` (`utils/tools.ts`) return structured errors naming `mobius_diagnose` instead of a bare string.
- **`npx mobius-mcp --health`** (`index.ts`) — prints the diagnose payload as JSON out-of-band (no MCP session needed), via a WS probe over the existing follower control channel (`services/controlClient.ts`). Exits 0 iff `state === "ready"`.

Not done:

- **G7. Never let `[]` be ambiguous.** `get_capture_settings` exists, but `get_recent_logs`/`get_recent_errors`/`get_network_requests` still return a bare `[]` when the category is off instead of inlining the capture flag — an agent has to know to check separately.
- **G8. Ship `skills/` as installable.** The six skills under `skills/` aren't registered as Claude Code skills (no plugin manifest/marketplace entry), so they're invisible to exactly the sessions they were written for.
- **G9. Prompts and resources.** Server reports `hasPrompts:false, hasResources:false`. Resources (`mobius://status`, `mobius://tabs`) and one prompt per shipped skill are unused discovery surfaces, and prompts are the main way non-Claude-Code clients without skill support could reach the scenario workflows.
- **G10. Spike: `claude/channel`.** Claude Code logs `Channel notifications skipped: server did not declare claude/channel capability` on every connect; undocumented, unclear if worth declaring. Timebox before building against it.

## Stage H — element handles and the page snapshot (done)

The prerequisite for everything in Stage I, and the reason input synthesis can't just be "add some CDP calls." CDP's `Input.dispatchMouseEvent` takes viewport coordinates, so *something* has to turn "the Save button" into an (x, y) — and an agent that can only address elements by CSS selector is guessing at markup it hasn't seen. Previously the only way to see the page was `capture_dom`, a full raw `outerHTML` serialization with nothing in it the agent can act on.

- **`snapshot_page`** → a pruned, indexed tree of the elements that matter (interactive, labelled, or text-bearing), each carrying a snapshot-scoped `ref`, its role, its accessible name, and its box (`packages/capture-core/src/types.ts`: `PageSnapshot`/`SnapshotElement`/`SnapshotBox`).
- **In-page DOM walk, not `Accessibility.getFullAXTree`** — `apps/browser-extension/snapshot/walk.ts`, mounted by `injected.ts` and exposed as `window.__mobiusSnapshot`, called from `background.ts`'s `snapshot_page` case via a single `Runtime.evaluate`. Same in-page-eval mechanism `evaluate_js`/`capture_dom` already use, and the same pattern `overlay/` (Stage I5) established. Accessible-name computation (`snapshot/utils/dom.ts`) is a pragmatic subset of the accname spec — `aria-label` → `aria-labelledby` → `alt` → associated `<label for>` → `placeholder` → `title` → own direct text — not the full algorithm; `capture_accessibility_tree` remains the escape hatch for the real AX tree. Capped at `MAX_SNAPSHOT_ELEMENTS` (500; verified against a live Wikipedia article, which hits the cap).
- **Ref lifetime is explicit and short.** `apps/browser-extension/snapshot/registry.ts` holds only the most recent snapshot's `ref → Element` map; `resolveRef` returns `stale_snapshot` for a ref from a superseded snapshot and `not_found` for a bogus one in the current snapshot. Not called by anything yet — Stage I's action tools are the first intended caller.
- `capture_dom`'s description now says when *not* to use it (raw-markup questions only) and points at `snapshot_page` for "what can I act on here."
- Protocol: `PROTOCOL_VERSION` bumped 1 → 2 (`packages/capture-core/src/data.ts`) — a pre-Stage-H extension build predates the snapshot walker and would reject/mishandle the command, so it's gated the same way a handshake version mismatch already is (`mobius_diagnose`'s `handshake_rejected` state, Stage G).
- **Not done**: `ref | selector` on action tools — no action tools exist yet, that's Stage I.

## Stage I — input synthesis and instrumented actions

The stage the pivot is actually about. Two halves that ship together, because half of it is commodity and the other half is the reason to use this server at all.

**I1. The actions.** All via CDP `Input.*` through the existing `sendCdp` helper — real trusted events, not `element.click()`, which doesn't reproduce what a user does and misses whole classes of handler.

- **Done: `click({ ref | selector, button, clickCount })`, `hover({ ref | selector })`.** `apps/browser-extension/actions/{types,resolve,mount}.ts` resolves the target in-page (ref via `snapshot/registry.ts`, selector via `querySelector`), scrolls it into view, and exposes `window.__mobiusActions.prepareTarget()` — one `Runtime.evaluate` call that resolves coordinates *and* drives the Stage I5 overlay (moves the cursor there, logs the action to the HUD) before `background.ts` waits out the cursor's transition and dispatches the actual `Input.dispatchMouseEvent` sequence. Verified live: resolves a real element, animates the cursor, logs the HUD entry, all without a thrown error.
- Not done: `clickCount`/`button` modifiers beyond the basics are wired but untested against real double/triple-click handlers; no `modifiers` (ctrl/shift/alt) param yet.
- `type_text({ ref | selector, text, clear })` — `Input.insertText` for speed, with a `perKey` escape hatch dispatching real `keydown`/`keyup` for widgets that listen for keys rather than input events
- `press_key({ key, modifiers })`
- `scroll_to({ ref | selector })` / `scroll_by({ dx, dy })`
- `select_option({ ref | selector, value })`, `set_checkbox({ ref | selector, checked })` — form semantics that are fiddly and error-prone to express as raw clicks
- Deferred to Stage J: `drag`, file upload, viewport resize

**I2. Instrumented actions.** Every action tool takes an optional `observe: { windowMs, types }` and returns, alongside the action's own result, the events that landed in the store between the action dispatching and the window closing — correlated by `seq` range, which the store already gives us for free. So `click(ref, { observe: { windowMs: 1500 } })` answers "did that button do anything" in one call: the console errors it threw, the requests it fired and their status, whether it navigated, whether the DOM changed. This is the whole differentiator; it should be in the tool descriptions and in `instructions` as the *default* way to act, with bare actions as the exception.

**I3. `run_sequence([...actions])`.** N actions in one round trip, each with its own optional observe window, stopping at the first failure and returning what completed. On a multi-step flow the latency difference against one-call-per-action is large, and it composes with I2 into "here is the flow, here is everything the app did during it" — which is a debugging transcript, not a click log.

**I4. `dom.mutation` earns its keep or doesn't.** Raise its signal (`attributeName` and `oldValue` for attribute/characterData changes, a short text preview of added nodes, burst coalescing so one React re-render isn't forty events), make it the DOM channel of the observe window, and rewrite `skills/mobius-dead-click` to actually consume it — that skill's entire question is "did the DOM change after the click?" and it currently never references the event type that answers it. That's the proof case. Verdict in Stage K.

**I5. Visual action feedback — cursor overlay and HUD (done, wired to click/hover).** Actions dispatched via CDP would otherwise be invisible to a human watching the tab. Both pieces are page-level UI added to `injected.ts` (MAIN world, alongside the existing capture patches) — no protocol change, since they render locally off the same action calls Stage I dispatches.

- **Synthetic cursor.** A fixed-position overlay shaped like a four-pointed concave kite (sparkle/compass silhouette), solid black with a soft green glow (`drop-shadow`/`box-shadow`). Animates to an action's target coordinates *before* the underlying CDP input event dispatches (`background.ts` waits out `CURSOR_MOVE_MS` between the two), so the human sees where mobius is about to click/hover, not just the aftermath. Ships with one shape; swapping it per action type (pointer for click/hover, a text-caret variant for `type_text`, a directional variant for `scroll_*`) is a likely follow-up once those actions exist — `apps/browser-extension/overlay/data.ts` isolates the shape/color constants precisely so that swap is a data change, not a structural one.
- **HUD panel.** Small, semi-transparent black box anchored bottom-left, mobius logo centered while collapsed. Expands (click/toggle) into a scrolling log of the agent's current actions ("clicking a \"More information...\"", ...) — sized to stay out of the way of page content, not a full overlay.
- `apps/browser-extension/overlay/{types,data,cursor,hud,mount}.ts`, mounted lazily into a closed shadow root on first use, exposed as `window.__mobiusOverlay`. `actions/mount.ts`'s `prepareTarget()` (I1) is the first real caller — every `click`/`hover` moves the cursor and logs to the HUD before the CDP input event dispatches. Verified live in Chrome (mount, resolve, animate, log — no thrown error).
- Open questions: does the HUD survive navigation/reload (likely not — it's page-level state, re-injected like the rest of `injected.ts`), and whether it's on by default whenever an action tool runs or needs its own opt-in separate from passive-capture settings.

## Stage J — attach anywhere, and the rest of the parity list

Stage I makes mobius able to drive. This stage makes driving not annoying.

- **`attach_tab({ tabId })` / `open_tab({ url })`.** The sharpest remaining friction: capture is opt-in per tab via a popup click, which is a reasonable privacy default for passive capture and a genuine obstacle for driving — an agent that can drive but must ask a human to click an icon before every session has not removed the human from the loop. Both tools let the *server* initiate enablement, gated on the origin already holding host permission (granted once by the user, via `<all_urls>` or a rule in the options page) — so consent still comes from the human, just not per tab. `open_tab` additionally auto-enables the tab it creates, which is the clean path for a flow that starts from nothing.
- **`upload_file({ ref | selector, path })`** via CDP `DOM.setFileInputFiles`, which takes host filesystem paths — workable precisely because server and browser are the same machine, which is also why it needs a deliberate look at what an agent should be allowed to hand the page.
- **`resize_viewport({ width, height, deviceScaleFactor })`** via `Emulation.setDeviceMetricsOverride` — responsive-layout checking, and the thing that makes screenshots reproducible across machines.
- **Recording.** A job-backed screenshot sequence over an interval or a `run_sequence`, encoded to GIF. Useful for handing a repro to a human, and the natural output of `skills/mobius-reproduce-bug`. Lower priority than everything above it: it's for humans reading the result, not for the agent solving the problem.

## Stage K — pruning

Deliberately last, and deliberately about deletion. After Stages G–J have been used on real work:

- `dom.mutation` verdict (see I4). Kept only if the dead-click skill and the observe window actually reach for it. Otherwise deleted — it costs a `MutationObserver`, a wire event type, a session-scoped opt-in path, and a row in every capability table.
- Tool-surface audit. Stage I roughly doubles the tool count, and a large tool list is itself a routing cost for the agent — anything the shipped skills never call is a candidate for merging into a neighbour or removing.
- `capture_dom` vs `snapshot_page` vs `capture_accessibility_tree`: three ways to see a page is at least one too many. Decide with usage data rather than up front.

## Beyond this plan

- Framework introspection: React/Redux/Zustand state, storage inspection (cookies/localStorage/IndexedDB), source map resolution, Next.js overlay/Vite HMR errors
- Multi-tab debug sessions
- **Richer event context.** Today's console/error events are captured close to raw — enough to see *what* happened, not always enough to see *why* without a follow-up round trip the agent has to know to make. Network detail is covered by Stage E now; what's left:
  - Console/errors: attach a resolved stack trace (source-mapped where a map is available) instead of just `message`, and group related entries — e.g. a `console.error` immediately followed by an `unhandledrejection` from the same call, or repeated identical logs collapsed with a count instead of N separate feed entries
  - Network: the initiator (which script/line triggered the request) still isn't captured; surface CORS/mixed-content/blocked-request failures as a distinct reason instead of `status: undefined`
  - Keep this opt-in/tunable via capture settings — richer payloads mean more captured data (bigger privacy footprint, same as the durable-persistence question below) and more noise on busy pages, so it shouldn't be forced on by default
- npm client hardening (once unpaused): HMR-safe re-invocation guard, documented SSR/client-only usage, StrictMode-safe teardown
- **Durable log persistence — extension side.** The server half of this shipped in Stage F (JSONL files, TTL-pruned, see above). Still open: the extension's `chrome.storage.session`-backed live state (`apps/browser-extension/src/lib/live-state.ts`) survives service-worker idle-restarts but is wiped on extension reload/disable/browser close, and deliberately clears a tab's feed on `chrome.tabs.onRemoved`.
  - Back it with **IndexedDB**, not `chrome.storage.local` — `storage.local` JSON-serializes the whole value per key per write (O(n) rewrite as an array grows), a poor fit for high-frequency small appends; IndexedDB gives real indexes (`seq` autoincrement PK, index on `clientId`, index on `type`), is async/off-thread, and has a disk-based quota. Keep `chrome.storage.session` as-is for the popup's live counters/feed (small, capped, fast render path) — IndexedDB is the backing store for history/cursor queries, not what re-renders the UI. Batch writes (flush every ~250ms or 50 events per transaction, not one `put()` per event), prune via an `IDBKeyRange` delete on a timestamp index in the same flush cycle. Redaction still happens upstream in `capture-core` before an event leaves the page — the persistence layer doesn't need its own pass.
  - Open questions before implementing: retention window (mirror the server's configurable TTL, or fix one?), and whether persistence is opt-in (captured logs can contain request bodies/headers even with redaction on, so durable-by-default has a bigger privacy footprint than today's wipe-on-restart behavior — the server side defaults *on* with a 1-hour TTL, which may or may not be the right call to mirror here).

## Skills (done)

`skill/SKILL.md` used to be one comprehensive skill covering every tool this server exposes — as the tool surface grew (Stage D's CDP tools, then Stage E's network detail), that meant loading a lot of generic tool-reference instruction regardless of what the agent actually needed for a given session. Split into six scenario-focused skills under `skills/<name>/SKILL.md`, matching the vendored-skill layout already used elsewhere in this repo's dev tooling (see `skills-lock.json`), so each is independently indexable.

The initial split-up sketch here was one skill per tool *category* (network debugging, console debugging, visual debugging, ...) — reworked before building, since that's really just the tool list restated with extra steps. What shipped instead targets specific bug classes that are hard to catch by reading source alone, several of which only became tractable once Stage E added response bodies:

- `mobius-dead-click` — a button/link/form that "does nothing," disambiguated into: handler never fired, ran and failed silently, or hit a silent API failure
- `mobius-silent-api-failure` — an API returning `200 OK` with an error-shaped body (`success: false`, a GraphQL `errors` array) — a blind spot for anything checking status codes alone, only inspectable now that `responseBody` is captured
- `mobius-contract-drift` — a live response whose JSON shape no longer matches the TypeScript type the frontend expects (the classic "backend renamed a field, frontend types didn't follow" bug)
- `mobius-reproduce-bug` — turns a confirmed-but-unsolved repro into a screenshot + timeline + HAR write-up suitable for filing or handoff, asking first whether to save it as a Markdown file (screenshot embedded as a sibling image, not inlined as base64) or just summarize in chat
- `mobius-perf-stakeout` — isolates a vague "feels slow" report into network-bound, CPU-bound, or a memory leak building up over repeated use, using request timing + `start_cpu_profile`/`start_memory_profile` together rather than guessing which one to reach for
- `mobius-session-drift` — a silently dropped auth/session mid-flow, found by diffing `requestHeaders` presence across a request sequence (works even with header values redacted, since only the value is masked, not the key)

Left out on purpose: a dedicated "how to connect" skill. Every skill above states its own tab-connection prerequisite inline instead, since that's a one-line check, not a workflow worth a whole skill.
