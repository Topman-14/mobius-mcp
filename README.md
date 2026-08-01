<div align="center">
  <img src="./apps/browser-extension/public/icons/icon-128.png" alt="mobius-mcp" width="72" height="72" />

  <h1>mobius-mcp</h1>

  <a href="https://www.npmjs.com/package/mobius-mcp"><img alt="npm version" src="https://img.shields.io/npm/v/mobius-mcp.svg"></a>
  <a href="https://www.npmjs.com/package/mobius-mcp"><img alt="npm downloads" src="https://img.shields.io/npm/dm/mobius-mcp.svg"></a>
  <a href="./LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <a href="https://github.com/Topman-14/mobius-mcp/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Topman-14/mobius-mcp/actions/workflows/ci.yml/badge.svg"></a>
</div>

Give AI coding agents (Claude Code, Codex CLI, Gemini CLI, etc.) live access to your web app's runtime — and the ability to drive it. Read console logs, errors, network requests, and navigation events, or have the agent open a tab, click/hover an element, and inspect what happened next — all without copy-pasting anything into chat.

Local-first. No cloud services, no telemetry, no external APIs.

## Table of contents

- [Features](#features)
- [How it works](#how-it-works)
- [Repo layout](#repo-layout)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Enabling capture (extension)](#enabling-capture-extension)
- [MCP tools](#mcp-tools)
- [Troubleshooting](#troubleshooting)
- [Known limitations](#known-limitations)
- [Client capabilities](#client-capabilities)
- [Skills](#skills)
- [Design principles](#design-principles)
- [Roadmap](#roadmap)
- [Smoke-test app](#smoke-test-app)
- [Contributing](#contributing)
- [License](#license)

## Features

- Live `console.*`, error, network (`fetch`/XHR), and navigation streaming into MCP tools — ask your agent instead of pasting logs into chat
- Drive the browser, not just observe it: `open_tab`/`enable_capture` to start a session without clicking the toolbar icon, `snapshot_page` for an indexed tree of what's on the page, `click`/`hover` via real trusted CDP input events (with a visible cursor + HUD overlay so a human watching the tab can follow along)
- Multi-tab aware, opt-in capture per tab (nothing streams until you enable it, or an agent enables it via `open_tab`/`enable_capture`)
- `start_debug_session`/`end_debug_session` — one ordered timeline instead of hand-correlating separate snapshots
- `wait_for_*` tools block (with timeout) instead of polling in a loop
- Full [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/) capability set via the browser extension: screenshots, DOM/accessibility snapshots, `evaluate_js`, CPU/memory profiling
- HAR 1.2 export with full request/response bodies — truncated or skipped inline bodies are re-fetched over CDP when the extension is connected
- Recent history survives an MCP server restart (crash-safe temp-file persistence, self-pruning — see [Configuration](#configuration))
- Local-first: everything runs on `localhost`, zero cloud services, zero telemetry

## How it works

```
Web App
  │
Browser extension
  │
WebSocket
  │
localhost
  │
mobius-mcp
  │
MCP
  │
Claude Code / Codex / Gemini CLI
```

A browser client captures runtime events — `console.*`, uncaught errors, unhandled rejections, `fetch`/`XHR` calls, and navigation (including SPA route changes via `pushState`/`replaceState`/hash) — and streams them over a WebSocket to a local MCP server. The MCP server keeps a rolling history (in-memory, backed by on-disk persistence — see [Configuration](#configuration)) and exposes it to AI agents as MCP tools.

## Repo layout

| Path | Description |
| --- | --- |
| `apps/mcp-server` | Node.js MCP server; WebSocket hub + MCP tool implementations |
| `apps/browser-extension` | Chromium extension that captures and streams browser events |
| `apps/npm-client` | `mobius-client` npm package for direct app integration — **development paused**, see [Roadmap](#roadmap) |
| `packages/capture-core` | Versioned event schema/message envelope plus runtime hook patching, shared by the extension, npm client, and mcp-server (private, bundled) |
| `skills` | Six scenario-focused agent skills for specific bug classes (dead clicks, silent 200s, contract drift, perf, session drift, bug documentation) — see [Skills](#skills) |
| `examples` | Example apps demonstrating integration |

## Getting started

`mobius-mcp` is published on npm — no clone required to use it. (Contributing to this repo instead? See [Contributing](#contributing).)

1. **Register the MCP server with your agent.** For Claude Code:

   ```bash
   claude mcp add mobius-mcp -- npx -y mobius-mcp
   ```

   Or add it directly to your MCP client's config (Claude Code, Codex CLI, Gemini CLI, etc. all read a JSON config in this shape):

   ```json
   {
     "mcpServers": {
       "mobius-mcp": {
         "command": "npx",
         "args": ["-y", "mobius-mcp"]
       }
     }
   }
   ```

2. **[Install the browser extension](https://chromewebstore.google.com/detail/bdhnfoelpknephokgkldjopdggkakdop?utm_source=item-share-cb).** This is currently the only supported way to stream a tab's runtime into the server — [see below](#client-capabilities) for why.

   Click the toolbar icon and hit "Enable tab" on the tab you want to debug — capture is opt-in per tab, nothing streams by default (see [Enabling capture](#enabling-capture-extension)). An agent can also open and enable a tab itself via `open_tab`/`enable_capture`, without the click.

   > An npm package (`mobius-client`) for direct app integration without the extension exists but **development is paused** — see [Roadmap](#roadmap) for why. It still works at its baseline (console/error/network/navigation capture only) if the extension truly isn't an option for your setup, but isn't the recommended path right now.

3. **Ask your agent to check the tab's console/errors/network via the MCP tools below** (e.g. "check the browser console for errors").

## Configuration

The server reads these environment variables on startup — set them in the `env` block of your MCP client's server config:

```json
{
  "mcpServers": {
    "mobius-mcp": {
      "command": "npx",
      "args": ["-y", "mobius-mcp"],
      "env": { "CONSOLE_STREAM_PERSISTENCE_TTL_MS": "7200000" }
    }
  }
}
```

| Variable | Default | Description |
| --- | --- | --- |
| `CONSOLE_STREAM_PORT` | `7331` | WebSocket port the browser client connects to |
| `CONSOLE_STREAM_MAX_EVENTS_PER_TAB` | `3000` | Event history cap per tab, both in-memory and on disk |
| `CONSOLE_STREAM_PURGE_DELAY_MS` | `300000` (5 min) | Grace period after a tab disconnects before its buffer is purged (survives a quick page refresh) |
| `CONSOLE_STREAM_PERSISTENCE_DIR` | `<os temp dir>/mobius-mcp/events` | Where per-tab event history is persisted to disk, so it survives an MCP server restart |
| `CONSOLE_STREAM_PERSISTENCE_TTL_MS` | `3600000` (1 hour) | How long persisted events are kept before being pruned from disk |

## Enabling capture (extension)

The extension never captures anything by default. Click its toolbar icon and hit "Enable tab" on the tab you want to debug — that's the one opt-in. Multiple tabs can be enabled independently. For dev servers you always want captured without clicking every time, add a rule (e.g. `localhost:5173`) on the extension's settings page (right-click the icon → Options) — matching tabs auto-enable on navigation.

An agent can also start capture itself, without a toolbar click, via `open_tab` (opens a new tab) or `enable_capture` (an already-open tab's Chrome tab id, from `list_tabs`) — consent still comes from the human having installed and granted the extension its permissions, just not per tab.

An enabled tab keeps the same `tabId` across navigation, along with its event history, so a handle an agent obtained before a page load stays valid after it. Use `clear_logs` if you want a clean baseline after navigating.

### Privacy defaults

Nothing is captured until a tab is enabled, and what is captured is redacted before it ever leaves the browser. Out of the box: `authorization`, `cookie`, `set-cookie`, `proxy-authorization` and `x-api-key` header *values* are replaced with `[redacted]` (the header name stays visible, so "was this request authenticated?" is still answerable), JSON body keys shaped like secrets (`password`, `token`, `api_key`, `ssn`, card numbers, …) are masked at any depth, and JWT-shaped strings are masked anywhere they appear. Email masking is available but off by default. All of it is configurable per-item on the extension's settings page.

Captured events are also written to disk so history survives an MCP server restart (see `CONSOLE_STREAM_PERSISTENCE_DIR` above). Those files hold redacted event data including request/response bodies; the directory is created `0700` and the files `0600`, and everything in it is pruned after `CONSOLE_STREAM_PERSISTENCE_TTL_MS` (1 hour by default).

### Extension permissions

| Permission | Why |
| --- | --- |
| `scripting` | Inject the capture scripts into an enabled tab |
| `storage` | Settings, auto-enable rules, and per-tab capture state |
| `tabs` | Read tab URLs/titles for `list_tabs`, and open/switch/reload them |
| `webNavigation` | Detect real page loads, to re-inject capture and emit navigation events |
| `debugger` | Chrome DevTools Protocol: screenshots, snapshots, profiling, `evaluate_js`, and trusted input events. This is why Chrome shows a "being debugged" bar on driven tabs |
| `alarms` | Reconnect backstop — an idle MV3 service worker can be shut down, and an alarm is the only thing that can start it again |
| `<all_urls>` | Capture is opt-in per tab, but the tab could be any origin — a local dev server, a staging deploy, or production |

`notifications` is optional and only requested if you turn on error notifications in settings.

## MCP tools

* `mobius_diagnose` — check whether mobius-mcp is usable right now: connection state, ever-connected history, and ordered remediation steps. Never fails, never requires a tab. Call this first in a session, and again after any connection-related tool error — see [Troubleshooting](#troubleshooting).
* `get_recent_logs`
* `get_recent_errors`
* `get_network_requests` — includes request/response headers and size-capped, redacted request/response bodies for text-like content-types (both browser clients, no CDP needed)
* `get_logs_since`
* `clear_logs`
* `get_connected_tabs`
* `get_capture_settings` — which event categories (console/errors/network/navigation/dom) a connected tab is actively capturing, so an empty result from another tool can be distinguished from "that category is off"
* `set_active_tab`
* `open_tab` — open a new tab (optionally to a URL), bring it to the foreground, and start streaming it immediately; extension only
* `enable_capture` — start capture on an already-open tab by its Chrome tab id, without a toolbar click; extension only
* `navigate_to`, `switch_tab`, `reload_tab` — browser control (extension only)
* `list_tabs` — every open tab, not just capture-enabled ones (requires an extension connected somewhere)
* `snapshot_page` — a pruned, indexed tree of the elements on a tab that matter for driving it (interactive/labelled/text-bearing), each with a `ref`, role, accessible name, and bounding box; extension only, requires CDP
* `click`, `hover`, `type_text`, `press_key`, `scroll_to`, `scroll_by`, `select_option`, `set_checkbox` — real trusted CDP input events addressed by a `snapshot_page` `ref` or a CSS selector; each moves the on-page cursor overlay with its own icon; all accept `observe: { windowMs, types? }` to return what the app did afterward alongside the action's own result; extension only, requires CDP
* `run_sequence` — run a list of the above (plus `navigate_to`/`wait_for_*`) against one tab in a single round trip, stopping at the first failure
* `get_job_status`, `get_job_result`, `cancel_job` — for longer-running operations (recordings, profiling)
* `start_debug_session`, `end_debug_session` — record a time-ordered timeline of console/network/navigation/DOM events instead of correlating separate snapshots by hand (single-tab, doesn't survive a full-page navigation)
* `wait_for_console_error`, `wait_for_navigation`, `wait_for_request`, `wait_for_element` — block (with timeout) until a condition occurs instead of polling `get_logs_since` in a loop
* `take_screenshot`, `capture_full_page`, `capture_element` — extension only, requires `chrome.debugger` (CDP)
* `capture_dom`, `capture_accessibility_tree` — extension only, requires CDP
* `evaluate_js` — run arbitrary JS in a tab and get the result; extension only, requires CDP, fully open (no read-only enforcement)
* `get_response_body`, `get_request_body` — extension only, requires CDP; fallback for the rare body `get_network_requests` couldn't capture (binary, oversized, non-text content-type)
* `export_har` — HAR 1.2 export with full request/response bodies; a body capture missed inline is re-fetched over CDP when the extension is connected (binary bodies come back base64-encoded)
* `start_cpu_profile`, `start_memory_profile` — extension only, requires CDP, job-based (see `get_job_status`/`get_job_result`)

CDP tools (marked "requires CDP" above) make Chrome show a persistent "being debugged" banner on the tab once used — the debugger attaches on first use and stays attached, it doesn't attach/detach per call. This is a Chrome-level indicator, not something the extension can suppress. `start_cpu_profile`/`start_memory_profile` durations are capped at 60s and best-effort beyond ~25-30s — Chrome can terminate an idle MV3 background service worker, which would cut a long profile short.

## Troubleshooting

If an agent reports mobius-mcp isn't working, ask it to call the `mobius_diagnose` tool — it returns a `state` (`ready`, `no_client_ever_connected`, `client_disconnected`, `handshake_rejected`, or `ws_bind_failed`) plus ordered remediation steps, and never fails or requires a tab to be connected.

To check from outside an MCP session entirely (no agent running, or you want to confirm the server itself is healthy before debugging further):

```bash
npx mobius-mcp --health
```

Prints the same diagnostic payload as JSON and exits `0` if `state` is `"ready"`, `1` otherwise. This talks to whichever mobius-mcp process is already bound to the configured port (`CONSOLE_STREAM_PORT`, default `7331`) — it doesn't start a new server, so run it while your MCP client (and therefore its spawned `mobius-mcp` process) is active.

## Known limitations

- **Testing coverage.** It works reliably across the setups it's been developed and dogfooded on, but hasn't yet been exercised across the full range of OSes, Chrome versions, and MCP clients in the wild — treat it as early-stage software, and please report anything unexpected.
- **Extension/server version skew.** Chrome Web Store review can take some time to approve a new extension release, so an older extension build can still be running against a newer `mobius-mcp` server for a while after a protocol-breaking change ships. `mobius_diagnose`'s `handshake_rejected` state (see [Troubleshooting](#troubleshooting)) is the symptom to watch for — a fix to smooth over this gap is in progress.
- **The local WebSocket is unauthenticated.** Anything that can open a socket to `127.0.0.1:7331` can drive the tools, including `evaluate_js`. In practice that means any other process running as you, and any page loaded over plain `http` (WebSocket connections aren't subject to same-origin policy; only `https` pages are blocked from `ws://` by mixed-content rules). This is the standard localhost-dev-tool trust model, but it is a real boundary worth knowing about — a dedicated auth design is planned.
- **A page can influence what it reports about itself.** Capture works by patching `console.*`/`fetch` inside the page's own JavaScript realm, which is what makes it work at all — but it also means a hostile or compromised page can suppress events, or emit fabricated ones. Treat captured output from untrusted pages as untrusted data. The server tells agents this explicitly in its MCP instructions.
- **Actions dispatch even when the target is covered.** `click`/`hover`/`type_text` hit-test before dispatching and report `hitTest: "blocked"` with the element that will actually receive the input, but they still send it — they report the problem rather than refusing.
- **The debugger banner.** Any CDP-backed tool attaches `chrome.debugger`, so Chrome shows its "being debugged" bar on that tab. The debugger detaches after five idle minutes.

## Client capabilities

Event ingestion (console/errors/network) is identical across both browser clients — the server can't tell them apart. Command capabilities are not: many later-stage features require Chrome DevTools Protocol access, which only the extension has. The protocol reports this via a `capabilities` field on connect, so commands a client can't support fail with a clear error instead of hanging.

| Capability | Browser extension | npm client (`mobius-client`, paused) |
| --- | --- | --- |
| Console/error/network/navigation event streaming | ✅ | ✅ |
| `get_recent_logs` / `get_recent_errors` / `get_network_requests` / `get_logs_since` | ✅ | ✅ |
| Multi-tab awareness (`get_connected_tabs`, `set_active_tab`, `get_capture_settings`) | ✅ | ✅ (one entry per app instance) |
| Opt-in capture (popup toggle / settings-page rules / agent-initiated via `open_tab`, `enable_capture`) | ✅ | n/a — capture starts as soon as `startMobiusStream()` runs |
| Browser control (`navigate_to`, `reload_tab`, `switch_tab`, `open_tab`) | ✅ | ❌ |
| Debug sessions (`start_debug_session`/`end_debug_session`) | ✅ | ✅ (console/network/navigation event types only — no DOM mutations) |
| Page snapshots (`snapshot_page`), input synthesis (`click`, `hover`) | ✅ (requires CDP) | ❌ |
| Screenshots, DOM/accessibility snapshots | ✅ (requires CDP) | ❌ |
| CPU/memory profiling | ✅ (requires CDP) | ❌ |
| `evaluate_js` | ✅ (requires CDP) | ❌ |
| Network request/response headers + bodies (via `get_network_requests`) | ✅ | ✅ |
| Full-body HAR export (`export_har`), `get_request_body`/`get_response_body` fallback | ✅ (requires CDP for the fallback fetch) | ❌ (inline-captured bodies only) |
| React/Redux/Zustand state, storage inspection | ❌ (planned) | ❌ (planned) |

See [Roadmap](#roadmap) for what "planned" maps to by stage.

## Skills

mobius-mcp is agent-agnostic — it works with any MCP-speaking client (Claude Code, Codex, Kimi, etc.), not just one. `skills/<name>/SKILL.md` holds six scenario-focused workflows, each for a bug class that's hard to catch by reading source alone but tractable with live browser data. Every client gets these the portable way: **each skill is also exposed as an MCP prompt of the same name** (`mobius-dead-click`, `mobius-silent-api-failure`, ...) — no plugin system required, works with any MCP client that supports prompts.

Claude Code users additionally get a native-feeling shortcut, since this repo also doubles as an installable Claude Code plugin (`.claude-plugin/plugin.json`):

```
/plugin marketplace add Topman-14/mobius-mcp
/plugin install mobius-mcp@mobius-mcp
```

That's a convenience on top, not the primary path — the MCP prompts are what makes the skills available everywhere.

| Skill | Catches |
| --- | --- |
| `mobius-dead-click` | A button/link/form that "does nothing" — pins down whether the handler never fired, failed silently, or hit a silent API failure |
| `mobius-silent-api-failure` | An API returning `200 OK` with an error-shaped body (`success: false`, a GraphQL `errors` array) — invisible to status-code-only checks |
| `mobius-contract-drift` | A response whose live JSON shape no longer matches the TypeScript type the frontend expects (renamed/missing fields) |
| `mobius-document-reproduced-bug` | Turns a confirmed-but-unsolved repro into a write-up — screenshot, timeline, HAR — offering to save it as a Markdown file with the screenshot embedded |
| `mobius-perf-stakeout` | Isolates "this feels slow" into network-bound, CPU-bound, or a memory leak building up over repeated use |
| `mobius-session-drift` | A silently dropped auth/session mid-flow — the exact request where an auth header stops being sent |

## Design principles

* Local-first, zero cloud dependencies, zero telemetry
* Framework agnostic
* Extension and npm client emit an identical, versioned protocol — the server can't tell them apart

## Roadmap

Staged build history and planned future work — including why the npm client is paused, and what's left for framework introspection (React/Redux/Zustand state, storage inspection) — live in [ROADMAP.md](./ROADMAP.md).

## Smoke-test app

`examples/spa-smoke-test` is a small React + `react-router-dom` SPA built to exercise every capture path at once in one place, rather than hunting for a real app that happens to trigger all of them: a range of `console.log`/`info`/`warn`/`error` payload shapes (objects, arrays, circular refs, BigInt, long strings, PII-shaped strings for redaction), multiple ways to trigger uncaught errors and unhandled promise rejections, `fetch`/XHR requests covering 200/404/500/slow/network-failure/POST, route/param/search-param changes, and DOM mutations. Useful for smoke-testing changes to this repo, or just seeing what mobius-mcp captures before wiring it into a real app. Requires a clone (not part of the published npm package) — see [Contributing](#contributing) below for setup.

```bash
cd examples/spa-smoke-test
npm install
npm run dev
```

Open the served URL, enable capture on the tab via the browser extension, click through `/scenarios`, then ask your agent to inspect the results via the [MCP tools](#mcp-tools) above — try `get_capture_settings` first, to rule out "that category is off" before assuming a missing event is a bug. Scenarios are extensible: see [examples/README.md](./examples/README.md) for the full list and how to add new ones.

## Contributing

Contributions are welcome — please open an issue to discuss significant changes before submitting a PR. Guidelines and PR expectations are in [CONTRIBUTING.md](./CONTRIBUTING.md); local setup instructions are below.

This is an npm workspaces monorepo (`apps/*`, `packages/*`). A single install at the root wires up every package — `npm install` inside an individual `apps/`/`packages/` folder is never necessary and will just fight the workspace symlinks in the root `node_modules`.

```bash
git clone https://github.com/Topman-14/mobius-mcp.git
cd mobius-mcp
npm install
npm run build
```

`npm run build` builds every workspace in dependency order (`packages/capture-core` → the apps), since `apps/browser-extension`, `apps/mcp-server`, and `apps/npm-client` all consume the built `dist/` output of the shared package, not its TypeScript source.

To run the MCP server from source instead of via `npx`:

```bash
npm run start --workspace=apps/mcp-server
```

### Watch mode

For active development across the shared packages and the extension, run:

```bash
npm run watch
```

This does a one-time build of `packages/capture-core` (so nothing is resolved against a missing `dist/` on a cold start), then runs three watchers in parallel with labeled output:

* `[packages]` — `tsc -b --watch` for `packages/capture-core`, incrementally rebuilding on save
* `[vite]` — the extension's Vite dev server, which also drives crxjs's automatic extension reload in Chrome for background/popup/options changes
* `[content-scripts]` — an esbuild watcher for `content-script.ts`/`injected.ts`, which are bundled as standalone IIFEs outside Vite's module graph (see the comment in `apps/browser-extension/vite.config.ts`)

Load the extension once via `chrome://extensions` → enable Developer Mode → **Load unpacked** → select `apps/browser-extension/dist`. From then on:

* Edits to `packages/capture-core` propagate through to the extension's bundled output automatically.
* Edits to background/popup/options files trigger Vite/crxjs's automatic reload in Chrome.
* Edits to `content-script.ts`/`injected.ts` rebuild immediately, but since those are injected on demand via `chrome.scripting.executeScript`, the new code takes effect the next time they're injected (reload the target tab, or toggle capture off/on) rather than needing an extension reload.

If you only need the shared package rebuilding (e.g. while working on `apps/npm-client` or `apps/mcp-server`) without the extension's Vite/esbuild watchers, run `npm run watch -w packages/capture-core` directly instead.

## License

[MIT](./LICENSE)
