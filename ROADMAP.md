# Roadmap

mobius-mcp started as a log bridge. The direction is a **browser runtime service**: a server an agent can command, not just read from. Stages A–F built observability; Stage G onward builds driving.

Target user: an agent with no first-party browser agent available — Cursor, Windsurf, Zed, Cline, Codex, OpenCode, or Claude Code without the Claude in Chrome extension — for whom "look at the running app" currently means "ask the human to paste something."

Stage F was the last server-only stage. Everything from Stage H on moves `PROTOCOL_VERSION` (currently 3). Nothing is published yet, so work is tracked as build stages rather than versions.

**npm client: paused.** `mobius-client` works at its current baseline but isn't getting further investment — HMR re-invocation, SSR/RSC boundaries and StrictMode double-invoke make it deeper than the extension warrants today.

## Stage A — per-tab identity, memory bounds, opt-in capture (done)

- Each tab is its own logical client over one shared WebSocket (`hello`/`bye` per tab)
- Per-tab ring buffers with a shared cross-tab `seq`, field truncation, disconnect grace period
- `tabId` on all query tools; auto-resolved when unambiguous, `set_active_tab` for a default, explicit error when ambiguous
- Capture is opt-in per tab: popup toggle, plus optional hostname/port auto-enable rules

## Stage B — command infrastructure (done)

- `kind: "command"`/`"ack"` envelope variants with correlation IDs
- `capabilities` on `hello` so unsupported commands fail clearly instead of hanging
- Job system (`startJob`/`get_job_status`/`get_job_result`/`cancel_job`) — the primitive every async capability builds on
- Non-CDP browser control: `navigate_to`, `list_tabs`, `switch_tab`, `reload_tab`

## Stage C — debug sessions (done)

- `start_debug_session`/`end_debug_session` → one time-ordered timeline instead of hand-correlated snapshots
- Always-on `navigation` event type; `dom.mutation` captured only when a session requests it
- `wait_for_console_error`/`wait_for_navigation`/`wait_for_request` (server-side, event-driven) and `wait_for_element` (in-page polling)

## Stage D — CDP-backed capture, extension-only (done)

- Screenshots: `take_screenshot`, `capture_full_page`, `capture_element`
- DOM/accessibility: `capture_dom`, `capture_accessibility_tree`
- Profiling: `start_cpu_profile`, `start_memory_profile` — job-based, capped at 60s, best-effort past ~25-30s
- `evaluate_js` — fully open, local-first threat model
- `get_response_body` (CDP-only, best-effort) and `export_har`

## Stage E — network request/response detail (done)

- `NetworkEvent` gained `responseHeaders`, `statusText`, `mimeType`, and ~20k-char capped `requestBody`/`responseBody` with `*Truncated`/`*OmittedReason`
- Bodies read from a `.clone()` after the response reaches app code, so capture never adds latency
- Content-type gated and redacted before emit; `redactSensitiveBodyFields` masks password/token/secret/apiKey-shaped keys
- `get_response_body` reframed as the fallback for what capture-core skips, not the primary path
- `redactHeaders`/`redactCookies` collapsed into one `redactedHeaderNames` list; dead `redactLocalStorage` removed

## Stage F — persistence and server cleanup (done)

- `get_request_body` — request-side counterpart to `get_response_body`
- `export_har` exports full bodies, re-fetching truncated/skipped ones over CDP, base64 per HAR 1.2
- Ring buffer mirrored to append-only JSONL per tab, replayed on boot, TTL-reaped — plain files, not an embedded DB
- `MAX_EVENTS_PER_TAB` raised 1000 → 3000 now that history survives restarts
- `apps/mcp-server/src` split into `types.ts`/`data.ts`/`utils/`/`services/`/`transports/`; per-tool boilerplate collapsed into shared helpers

## Decisions taken before Stage G

Source: `AGENT_INTEGRATION_BRIEF.md`, written from an outside session that tried to use this server and couldn't.

- **mobius drives.** The questions it's best at can't be reached without first getting the app into the state where they happen
- **The differentiator is driving and observing over one connection** — an action returns what it caused, no correlation step
- **`dom.mutation` is kept for now** — once actions have an observe window, "did the DOM change" separates a dead click from a slow one. Verdict in Stage K
- **`capture_dom` survives, demoted** — right for raw-markup questions, wrong as the default way to see a page

## Stage G — routing and self-diagnosis (mostly done)

- `instructions` on both hub and follower servers inject routing guidance into the client's system prompt
- `VERSION` resolved from `package.json` as one source of truth
- Disconnection evidence survives registry purge: `everConnected`, `lastClientSeenAt`, `lastDisconnectReason`, bind result, rejected-handshake count
- `mobius_diagnose` — never fails, never needs a tab, returns machine-readable `state` plus ordered remediation and `agentGuidance`
- Tool failures return structured errors naming `mobius_diagnose` instead of a bare string
- `npx mobius-mcp --health` prints the diagnose payload out-of-band, exits 0 iff ready
- `[]` is never ambiguous: read tools inline `captureEnabled: false` and a hint when the category is off

Not done:

- **G8.** Register `skills/` as installable Claude Code skills — they're currently invisible to the sessions they were written for
- **G9.** Prompts and resources (`mobius://status`, `mobius://tabs`) are unused discovery surfaces; prompts are how non-Claude-Code clients would reach the skills
- **G10.** Spike `claude/channel` — undocumented, timebox before building against it

## Stage H — element handles and the page snapshot (done)

- `snapshot_page` → pruned indexed tree of interactive/labelled/text-bearing elements, each with `ref`, role, accessible name, box
- In-page DOM walk (`src/modules/snapshot/walk.ts` via `window.__mobiusSnapshot`), not `Accessibility.getFullAXTree`; accessible name is a pragmatic accname subset
- Scoping params `viewportOnly`/`roles`/`maxElements`, cap `MAX_SNAPSHOT_ELEMENTS` 150, plus `truncated` and `totalQualified` so the loss is visible
- `find({ query })` — natural-language element lookup, lexically scored over name/role/tag, returns ranked refs plus `totalMatched`; the cheap path when you know what you're looking for
- Refs live only for the most recent snapshot; `resolveRef` distinguishes `stale_snapshot` from `not_found`
- `capture_dom`'s description now says when *not* to use it
- `PROTOCOL_VERSION` 1 → 2

Not done:

- Truncation is DOM-order, so a scrolled page can spend the whole budget above the viewport — `find` routes around it, ranking by viewport proximity would fix it properly

## Stage I — input synthesis and instrumented actions

**I1. The actions** — all via CDP `Input.*`, real trusted events, not `element.click()`.

- Done: `click`, `hover`, `type_text` (platform-aware `clear`), `press_key`, `scroll_to`, `scroll_by`, `select_option`, `set_checkbox` (idempotent, reports `changed`)
- Done: hit-testing — every coordinate dispatch reports `hitTest: "ok" | "blocked"` with the blocking element and reason, so a click eaten by an overlay never reports bare success
- Not done: `modifiers` on `click`; double/triple-click untested against real handlers; no `perKey` escape hatch for widgets listening for raw key events
- Deferred to Stage J: `drag`, file upload, viewport resize

**I2. Instrumented actions (done).** Every action takes `observe: { windowMs, types }` and returns what landed in the store during that window, correlated by `seq` range. Reports `notCaptured` when a requested category is disabled so an empty result is never mistaken for "nothing happened."

- Not done: `observe.types` is unvalidated `z.array(z.string())`, so a misspelled type silently returns nothing — should be a `z.enum` or echo `unknownTypes`
- Not done: no metadata-only mode, so a chatty 404 body can swamp an action result

**I3. `run_sequence` (done).** N steps in one round trip, each with its own observe window, stopping at first failure and returning what completed.

- Read tools (`find`, `snapshot_page`, `take_screenshot`) are eligible steps; screenshots return interleaved with the transcript in step order
- Steps can't consume each other's output — address by `selector` rather than `ref` when a step follows a navigation

**I4. `dom.mutation` earns its keep or doesn't.** Raise its signal (`attributeName`, `oldValue`, text preview, burst coalescing), make it the DOM channel of the observe window, and rewrite `skills/mobius-broken-flow` to consume it. Verdict in Stage K.

**I5. Visual action feedback (done).** Page-level UI in `injected.ts`, mounted lazily into a closed shadow root as `window.__mobiusOverlay`.

- Synthetic cursor tweens to the target via the Web Animations API before the CDP input dispatches, so a human sees where mobius is about to act
- Radial-gradient glow sits beneath the icon, which layers above it — the dark cursor stays legible on any background
- Per-action cursor icons (click, hover, type, key, scroll, select, check)
- HUD anchored bottom-left: logo collapsed, wordmark and scrolling action log expanded, with an empty state before the first entry
- Open: whether the HUD survives navigation, and whether it needs its own opt-in separate from capture settings

## Stage I6 — hardening pass (done)

- Stable `clientId` across navigation — re-minting it had orphaned server buffers and broken `wait_for_navigation` for full-page loads
- Unknown `tabId` is an error, not an empty result indistinguishable from "no errors"
- `run_sequence` and `control-request` now run the SDK's Zod parser, so defaults apply off the SDK path
- Application-level `ping` every 20s keeps the MV3 worker alive; the `chrome.alarms` backstop remains for cold starts
- Leader election driven by the follower's own socket closing, with jitter; promotion re-opens persistence
- Cancelled jobs, job eviction, `getSince` cursor rewind, stale `lastDisconnectReason` — small correctness fixes with tests
- `downloads` permission removed, `notifications` moved to `optional_permissions`, `webNavigation` retained deliberately
- `DEFAULT_REDACTION` is now the single source both clients use, and defaults on
- JWT masking anchored on the `eyJ` header prefix — the old pattern matched any three dot-separated runs and was replacing hostnames, property chains and SVG path data with `[redacted-jwt]`
- Body redaction parses before masking, so a mask can't break the JSON it's about to parse
- Tool results are minified — indentation roughly doubled the token cost of every response
- `run_sequence` steps report their payload, not a re-encoded MCP envelope

Deliberately not done, tracked separately:

- **WebSocket authentication.** The hub accepts any local connection and `control-request` dispatches every tool including `evaluate_js`; needs its own design pass that doesn't break zero-config
- **Unforgeable capture.** A page can suppress or fabricate events since capture patches its own realm; the real fix is sourcing console/network from CDP, at the cost of a permanent debugger banner
- **Hub identity.** Nothing reports which process holds the port or what build it runs, and the hub dies with whichever session happened to win the race
- **Handshake rejections are unattributed** — the counter records no version or client type, so `handshake_rejected` can't distinguish a stale extension from any other client

## Stage J — attach anywhere, and the rest of the parity list

- `attach_tab`/`open_tab` — server-initiated enablement gated on existing host permission, so consent stays human but not per tab (`open_tab` should wait for capture to start before returning, rather than making the caller follow up with `enable_capture`)
- `upload_file({ ref | selector, path })` via `DOM.setFileInputFiles` — needs a deliberate look at what an agent may hand the page
- `resize_viewport` via `Emulation.setDeviceMetricsOverride` — responsive checks, and reproducible screenshots across machines
- Recording — job-backed screenshot sequence encoded to GIF; for humans reading the result, not the agent solving the problem
- `take_screenshot` should foreground the tab or say so — it currently hangs to a generic timeout on a backgrounded tab

## Stage K — pruning

- `dom.mutation` verdict (see I4) — kept only if `mobius-broken-flow` and the observe window actually reach for it
- Tool-surface audit — a large tool list is itself a routing cost; anything the skills never call is a merge or delete candidate
- `capture_dom` vs `snapshot_page` vs `capture_accessibility_tree` vs `find` — decide with usage data, not up front

## Beyond this plan

- Framework introspection: React/Redux/Zustand state, storage inspection, source map resolution, Next.js/Vite overlay errors
- Multi-tab debug sessions
- Richer console/error context: source-mapped stack traces, grouping related entries, collapsing repeats with a count
- Richer network context: request initiator, and CORS/mixed-content/blocked failures as a distinct reason instead of `status: undefined`
- Keep the above opt-in — richer payloads mean a bigger privacy footprint and more noise on busy pages
- npm client hardening once unpaused: HMR-safe re-invocation guard, documented SSR usage, StrictMode-safe teardown
- Durable persistence, extension side: back live state with IndexedDB (not `storage.local`, which rewrites the whole value per key per write), batched flushes, `IDBKeyRange` pruning
- Open first: retention window, and whether extension-side persistence is opt-in given captured bodies can contain sensitive data

## Skills (done)

Five skills under `skills/<name>/SKILL.md`, one per use case, also exposed as MCP prompts so any client can reach them. Rewritten once driving shipped: the original six all waited for a human to operate the app, and three of them were symptoms of one triage.

- `mobius-broken-flow` — "X doesn't work": drives to the failure, then separates a handler that never fired, a blocked click, a failed request, a 200 with an error body, a dropped session, and contract drift
- `mobius-walkthrough` — drives key flows and reports what broke, with a screenshot, HAR and console output per step
- `mobius-repro` — turns a confirmed bug into a filable artifact: timeline, screenshots, full-body HAR
- `mobius-perf-stakeout` — separates network-bound, CPU-bound and memory-leak causes of "feels slow"
- `mobius-page-audit` — what a page sends and exposes: third-party payloads, console errors, unreachable controls

Left out on purpose: a "how to connect" skill — each skill starts with `mobius_diagnose` instead.
