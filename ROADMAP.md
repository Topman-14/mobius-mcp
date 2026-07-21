# Roadmap

mobius-mcp started as a log bridge. The direction is a **browser runtime service**: a server an agent can command, not just read from — synchronous tools answer questions about existing state, asynchronous ones (backed by a shared job system) initiate work that takes time.

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

Closes half of the "durable log persistence" gap tracked under "Beyond this plan" below (server side only — the extension's own durable store is still open, see below) and restructures `apps/mcp-server/src` now that it had grown past a flat file-per-concern layout.

- `get_request_body` — the request-side counterpart to `get_response_body`, same CDP fallback semantics (URL-keyed, best-effort, extension-only)
- `export_har` now exports full request/response bodies, not headers-only: bodies already captured inline are used as-is, anything `*Truncated` or skipped (binary, oversized, non-text content-type) is re-fetched over CDP when the tab supports it, with binary bodies coming back base64-encoded in `content.encoding` per the HAR 1.2 spec
- **Crash/restart durability**: `EventStore`'s ring buffer is now mirrored to an append-only JSONL file per tab (`services/persistence.ts`), replayed into memory on boot, and reaped on an interval. Configurable via `CONSOLE_STREAM_PERSISTENCE_TTL_MS` (default 1 hour) and `CONSOLE_STREAM_PERSISTENCE_DIR` (default a temp-dir subfolder) — see `README.md`'s Configuration section. Deliberately plain files over an embedded database: the capped working set (event count × field-length cap) never exceeds a few MB, so there's no query-performance case for SQLite, and `better-sqlite3` (native, prebuilt-binary install risk) vs. `node:sqlite` (unsupported before Node 22.5, below this package's `"engines": ">=18"` floor) both cost more than they'd buy here.
- `MAX_EVENTS_PER_TAB` default raised from 1000 to 3000 events/tab now that history survives a restart instead of being purely disposable — same cap governs both the in-memory buffer and the on-disk file
- Structural cleanup: `apps/mcp-server/src` split into `types.ts`/`data.ts` (mirroring `packages/capture-core`'s layout), a `utils/` folder of pure helpers grouped by what they operate on (`events`, `wait-for`, `har`, `tools`, `errors`), a `services/` folder for the stateful singletons `index.ts` instantiates (`store`, `registry`, `commandDispatcher`, `jobs`, `debugSession`, `controlClient`, `persistence`), and a `transports/` folder for the two protocol-facing servers (`wsServer`, `mcpServer`). The repeated per-tool `resolveTabId`/`requireCdp`/try-catch boilerplate in `mcpServer.ts` collapsed into shared helpers (`resolveCdpTab`, `runCommand`) in `utils/tools.ts`.

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
- `mobius-document-reproduced-bug` — turns a confirmed-but-unsolved repro into a screenshot + timeline + HAR write-up suitable for filing or handoff, asking first whether to save it as a Markdown file (screenshot embedded as a sibling image, not inlined as base64) or just summarize in chat
- `mobius-perf-stakeout` — isolates a vague "feels slow" report into network-bound, CPU-bound, or a memory leak building up over repeated use, using request timing + `start_cpu_profile`/`start_memory_profile` together rather than guessing which one to reach for
- `mobius-session-drift` — a silently dropped auth/session mid-flow, found by diffing `requestHeaders` presence across a request sequence (works even with header values redacted, since only the value is masked, not the key)

Left out on purpose: a dedicated "how to connect" skill. Every skill above states its own tab-connection prerequisite inline instead, since that's a one-line check, not a workflow worth a whole skill.
