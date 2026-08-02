<div align="center">
  <img src="./apps/browser-extension/public/icons/icon-128.png" alt="mobius-mcp" width="72" height="72" />

  <h1>mobius-mcp</h1>

  <p><strong>Operate your real browser. See what it actually did.</strong></p>

  <a href="https://www.npmjs.com/package/mobius-mcp"><img alt="npm version" src="https://img.shields.io/npm/v/mobius-mcp.svg"></a>
  <a href="https://www.npmjs.com/package/mobius-mcp"><img alt="npm downloads" src="https://img.shields.io/npm/dm/mobius-mcp.svg"></a>
  <a href="./LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <a href="https://github.com/Topman-14/mobius-mcp/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Topman-14/mobius-mcp/actions/workflows/ci.yml/badge.svg"></a>
</div>

mobius-mcp gives an AI agent a real browser it can operate and account for. It drives the Chrome you're already signed into and **every action returns the requests, console errors, navigations and DOM changes it caused**.

That last part is the difference. Other browser tools act, and then you ask separately what happened and correlate it yourself. 

Works with any MCP client — Claude Code, Codex CLI, Cursor, Windsurf, Zed, Cline, Gemini CLI. Local-first: no cloud services, no telemetry, no external APIs.

## Table of contents

- [What you can do with it](#what-you-can-do-with-it)
- [What makes it different](#what-makes-it-different)
- [How it works](#how-it-works)
- [Repo layout](#repo-layout)
- [Getting started](#getting-started)
  - [Install the extension from source](#install-the-extension-from-source)
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

## What you can do with it

**Debug a broken flow end to end.** Point the agent at "signup is failing" and it drives to the failure itself — no more pasting console output into chat, and no more describing which buttons to press. It comes back with the request that failed, the response body that explains why, and the console error that followed.

**Catch failures that look like successes.** A `200 OK` carrying `{"success": false}`. A click swallowed by an invisible modal backdrop. An auth header that quietly stops being sent halfway through a flow. These are invisible to status codes and to `element.click()`, and they're what this is built to surface.

**Run a QA walkthrough.** Drive your key flows in one `run_sequence` and collect a screenshot, a HAR and the console output per step — a regression sweep before a release, without a test suite to maintain.

**Reproduce and hand off a bug.** Turn a confirmed repro into something filable: an ordered timeline, screenshots, and a HAR with full request/response bodies attached.

**Investigate performance.** Separate "the network is slow" from "the main thread is blocked" from "memory climbs every time I open this panel", using request timing alongside real CPU and memory profiles — against your actual logged-in session, not a synthetic one.

**Audit what a page really sends.** See every third-party request a page makes and what's in the payloads — analytics, pixels, embedded widgets — including whether anything sensitive is leaving in a request body.

**Verify a fix.** Re-run the same flow after the change and compare against what happened before.

Because it drives the browser you're already authenticated in, all of this works on pages behind a login — internal dashboards, admin panels, staging environments — with no credentials handled by the agent and no separate test account.

## What makes it different

- **Actions return their consequences.** Every action tool takes `observe: { windowMs, types? }` and returns what the app did in that window — console, network, navigation, DOM — alongside the action's own result. One round trip, no correlation step.
- **A blocked click says so.** Every coordinate-dispatching action hit-tests first and reports `hitTest: "ok" | "blocked"` with the element that will actually receive the input, and why (`covered`, `pointer_events`, `offscreen`).
- **Find elements in plain language.** `find({ query: "newsletter signup field" })` returns ranked, clickable refs — no CSS selectors, and no paying for a full-page dump to locate one button.
- **Your real browser, your real session.** Not a fresh headless profile. Already logged in, real cookies, real extensions.
- **A human can watch.** Driven tabs show a synthetic cursor that moves to each target before the input fires, plus a HUD logging what the agent is doing — so operating a live account isn't a black box.
- **Trusted input.** CDP `Input.*`, not `element.click()`, which misses whole classes of handlers.
- **The observability half.** HAR export with full bodies, CPU/memory profiles, blocking `wait_for_*` instead of polling, and rolling history that survives a server restart.

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
Claude Code / Codex / Cursor / Gemini CLI
```

A browser client captures runtime events — `console.*`, uncaught errors, unhandled rejections, `fetch`/`XHR` calls, and navigation (including SPA route changes via `pushState`/`replaceState`/hash) — and streams them over a WebSocket to a local MCP server. The same connection carries commands the other way, which is why an action can return what it caused. The server keeps a rolling history (in-memory, backed by on-disk persistence — see [Configuration](#configuration)) and exposes all of it as MCP tools.

## Repo layout

| Path | Description |
| --- | --- |
| `apps/mcp-server` | Node.js MCP server; WebSocket hub + MCP tool implementations |
| `apps/browser-extension` | Chromium extension that captures events, drives the page, and renders the cursor/HUD overlay |
| `apps/npm-client` | `mobius-client` npm package for direct app integration — **development paused**, see [Roadmap](#roadmap) |
| `packages/capture-core` | Versioned event schema/message envelope plus runtime hook patching, shared by the extension, npm client, and mcp-server (private, bundled) |
| `skills` | Scenario-focused agent skills, one per major use case — see [Skills](#skills) |
| `examples` | Example apps demonstrating integration |

## Getting started

`mobius-mcp` is published on npm. (Contributing to this repo instead? See [Contributing](#contributing).)

1. **Register the MCP server with your agent.** For Claude Code:

   ```bash
   claude mcp add mobius-mcp -- npx -y mobius-mcp
   ```

   Or add it directly to your MCP client's config (Claude Code, Codex CLI, Cursor, Gemini CLI, etc. all read a JSON config in this shape):

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

2. **Install the browser extension.** This is currently the only supported way to stream and drive a tab — [see below](#client-capabilities) for why.

   > ⚠️ **The Chrome Web Store build is significantly behind this repo.** Store review takes time, and driving — `find`, `click`, `type_text`, `run_sequence`, the `observe` window, hit-testing and the cursor overlay — landed after the last published release. **If you want the capabilities described in this README, build the extension from this repo** ([steps below](#install-the-extension-from-source)). The [store version](https://chromewebstore.google.com/detail/bdhnfoelpknephokgkldjopdggkakdop?utm_source=item-share-cb) still works for passive capture (console, errors, network, navigation), and `mobius_diagnose` will report `handshake_rejected` if it's too old for the server you're running.

   Once installed, click the toolbar icon and hit "Enable tab" on the tab you want to work with — capture is opt-in per tab, nothing streams by default (see [Enabling capture](#enabling-capture-extension)). An agent can also open and enable a tab itself via `open_tab`/`enable_capture`, without the click.

   > An npm package (`mobius-client`) for direct app integration without the extension exists but **development is paused** — see [Roadmap](#roadmap) for why. It still works at its baseline (console/error/network/navigation capture only, no driving) if the extension truly isn't an option for your setup, but isn't the recommended path right now.

3. **Ask your agent to use it** — "walk through checkout and tell me where it breaks", "check the browser console for errors", "what is this page sending to third parties".

### Install the extension from source

Until the store build catches up, this is the recommended path. It takes about a minute and needs Node 18+ and Chrome.

```bash
git clone https://github.com/Topman-14/mobius-mcp.git
cd mobius-mcp
npm install
npm run build
```

Then load it into Chrome:

1. Go to `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked**
4. Select `apps/browser-extension/dist` inside the cloned repo

Pin the mobius icon to your toolbar and you're done — the extension connects to the MCP server on its own.

**Run the matching server too.** A source-built extension speaks the current protocol, which a published `npx mobius-mcp` may not. Point your MCP client at the local build so both halves match:

```json
{
  "mcpServers": {
    "mobius-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/mobius-mcp/apps/mcp-server/dist/index.js"]
    }
  }
}
```

If they ever drift apart, `mobius_diagnose` reports `handshake_rejected` and tells you which side to update.

**To update later:** `git pull && npm run build`, then hit the refresh icon on the extension card at `chrome://extensions`. Reload any tab you had capture enabled on — the in-page scripts are only re-injected on the next load. Restart your MCP client too, so it picks up the rebuilt server.

Remove the Chrome Web Store version first if you have it installed — two copies both trying to hold the WebSocket connection is the kind of thing that produces confusing symptoms.

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

The extension never captures anything by default. Click its toolbar icon and hit "Enable tab" on the tab you want to work with — that's the one opt-in. Multiple tabs can be enabled independently. For dev servers you always want captured without clicking every time, add a rule (e.g. `localhost:5173`) on the extension's settings page (right-click the icon → Options) — matching tabs auto-enable on navigation.

An agent can also start capture itself, without a toolbar click, via `open_tab` (opens a new tab) or `enable_capture` (an already-open tab's Chrome tab id, from `list_tabs`) — consent still comes from the human having installed and granted the extension its permissions, just not per tab.

An enabled tab keeps the same `tabId` across navigation, along with its event history, so a handle an agent obtained before a page load stays valid after it. Use `clear_logs` if you want a clean baseline after navigating.

### Privacy defaults

Nothing is captured until a tab is enabled, and what is captured is redacted before it ever leaves the browser. Out of the box: `authorization`, `cookie`, `set-cookie`, `proxy-authorization` and `x-api-key` header *values* are replaced with `[redacted]` (the header name stays visible, so "was this request authenticated?" is still answerable), JSON body keys shaped like secrets (`password`, `token`, `api_key`, `ssn`, card numbers, …) are masked at any depth, and JWT-shaped strings are masked anywhere they appear. Email masking is available but off by default. All of it is configurable per-item on the extension's settings page.

Captured events are also written to disk so history survives an MCP server restart (see `CONSOLE_STREAM_PERSISTENCE_DIR` above). Those files hold redacted event data including request/response bodies; the directory is created `0700` and the files `0600`, and everything in it is pruned after `CONSOLE_STREAM_PERSISTENCE_TTL_MS` (1 hour by default).

### Extension permissions

| Permission | Why |
| --- | --- |
| `scripting` | Inject the capture and driving scripts into an enabled tab |
| `storage` | Settings, auto-enable rules, and per-tab capture state |
| `tabs` | Read tab URLs/titles for `list_tabs`, and open/switch/reload them |
| `webNavigation` | Detect real page loads, to re-inject capture and emit navigation events |
| `debugger` | Chrome DevTools Protocol: trusted input events, screenshots, snapshots, profiling, `evaluate_js`. This is why Chrome shows a "being debugged" bar on driven tabs |
| `alarms` | Reconnect backstop — an idle MV3 service worker can be shut down, and an alarm is the only thing that can start it again |
| `<all_urls>` | Capture is opt-in per tab, but the tab could be any origin — a local dev server, a staging deploy, or production |

`notifications` is optional and only requested if you turn on error notifications in settings.

## MCP tools

Start with `mobius_diagnose` — it reports whether mobius is usable right now (connection state, ever-connected history, ordered remediation), never fails, and never needs a tab. Call it first in a session and after any connection-related error. See [Troubleshooting](#troubleshooting).

### Find and drive

Every action below takes `observe: { windowMs, types? }` to return what the app did afterward, and reports `hitTest` so a blocked interaction is never mistaken for a working one. Targets are addressed by a `ref` (from `find`/`snapshot_page`) or a CSS `selector`. All require the extension and CDP.

* `find` — locate elements by natural-language description ("accept cookies button"); returns ranked refs plus `totalMatched`. The cheap path when you know what you're looking for
* `snapshot_page` — pruned, indexed tree of interactive/labelled/text-bearing elements, each with a `ref`, role, accessible name and box. Narrow it with `viewportOnly`, `roles` or `maxElements`. For surveying a page rather than locating one thing
* `click`, `hover`, `type_text`, `press_key`, `scroll_to`, `scroll_by`, `select_option`, `set_checkbox` — real trusted CDP input events, each moving the on-page cursor overlay with its own icon
* `run_sequence` — many steps against one tab in a single round trip, stopping at the first failure and returning what completed. `find`/`snapshot_page`/`take_screenshot` are eligible steps, and screenshots come back interleaved in step order
* `open_tab`, `enable_capture` — start a session without a toolbar click
* `navigate_to`, `switch_tab`, `reload_tab`, `list_tabs`, `set_active_tab` — browser control (extension only; `list_tabs` sees every open tab, not just enabled ones)

### Observe

* `get_recent_logs`, `get_recent_errors`, `get_logs_since`, `clear_logs`
* `get_network_requests` — request/response headers plus size-capped, redacted request/response bodies for text-like content types (no CDP needed)
* `get_capture_settings`, `get_connected_tabs` — which categories a tab is capturing, so an empty result is distinguishable from "that category is off"
* `start_debug_session`, `end_debug_session` — one ordered timeline of console/network/navigation/DOM instead of correlating snapshots by hand (single-tab, doesn't survive a full-page navigation)
* `wait_for_console_error`, `wait_for_navigation`, `wait_for_request`, `wait_for_element` — block with a timeout instead of polling in a loop
* `export_har` — HAR 1.2 with full request/response bodies; anything missed inline is re-fetched over CDP (binary bodies base64-encoded)
* `get_response_body`, `get_request_body` — CDP fallback for the rare body capture skipped (binary, oversized, non-text)

### Inspect

* `take_screenshot`, `capture_full_page`, `capture_element`
* `capture_dom`, `capture_accessibility_tree` — raw markup and the full AX tree; for markup/ARIA questions, not for finding something to click
* `evaluate_js` — arbitrary JS in the tab, fully open (no read-only enforcement)
* `start_cpu_profile`, `start_memory_profile` — job-based, see `get_job_status`/`get_job_result`/`cancel_job`

CDP tools make Chrome show a persistent "being debugged" banner on the tab once used — the debugger attaches on first use and stays attached rather than attaching per call. This is a Chrome-level indicator the extension cannot suppress. Profile durations are capped at 60s and best-effort beyond ~25-30s, since Chrome can terminate an idle MV3 service worker mid-profile.

## Troubleshooting

If an agent reports mobius-mcp isn't working, ask it to call `mobius_diagnose` — it returns a `state` (`ready`, `no_client_ever_connected`, `client_disconnected`, `handshake_rejected`, or `ws_bind_failed`) plus ordered remediation steps, and never fails or requires a connected tab.

To check from outside an MCP session entirely:

```bash
npx mobius-mcp --health
```

Prints the same payload as JSON and exits `0` if `state` is `"ready"`, `1` otherwise. This talks to whichever mobius-mcp process is already bound to the configured port (`CONSOLE_STREAM_PORT`, default `7331`) — it doesn't start a new server, so run it while your MCP client is active.

## Known limitations

- **Testing coverage.** It works reliably across the setups it's been developed and dogfooded on, but hasn't yet been exercised across the full range of OSes, Chrome versions, and MCP clients in the wild — treat it as early-stage software, and please report anything unexpected.
- **The published extension lags this repo.** Chrome Web Store review is slow, so the store build is currently well behind — driving in particular isn't in it yet. Build [from source](#install-the-extension-from-source) for the full capability set. `mobius_diagnose` reports a version mismatch as `handshake_rejected`.
- **The local WebSocket is unauthenticated.** Anything that can open a socket to `127.0.0.1:7331` can drive the tools, including `evaluate_js` — in practice, any other process running as you, and any page loaded over plain `http` (WebSocket connections aren't subject to same-origin policy; only `https` pages are blocked from `ws://` by mixed-content rules). This is the standard localhost-dev-tool trust model, but it's a real boundary, and a dedicated auth design is planned.
- **A page can influence what it reports about itself.** Capture works by patching `console.*`/`fetch` inside the page's own JavaScript realm, which is what makes it work at all — but a hostile or compromised page can suppress events or emit fabricated ones. Treat captured output from untrusted pages as untrusted data; the server tells agents this explicitly in its MCP instructions.
- **Actions dispatch even when the target is covered.** Hit-testing reports `hitTest: "blocked"` and names the element that will actually receive the input, but the event is still sent — it reports the problem rather than refusing.
- **Screenshots need the tab in the foreground.** Chrome doesn't service `captureScreenshot` for a background tab, so call `switch_tab` first if the target isn't visible.
- **`snapshot_page` truncates in DOM order.** On a long page that means the element budget can be spent above the current viewport. Use `viewportOnly`, or `find`, which isn't affected.
- **The debugger banner.** Any CDP-backed tool attaches `chrome.debugger`, so Chrome shows its "being debugged" bar on that tab. The debugger detaches after five idle minutes.

## Client capabilities

Event ingestion is identical across both browser clients — the server can't tell them apart. Command capabilities are not: driving and everything CDP-backed requires the extension. The protocol reports this via a `capabilities` field on connect, so commands a client can't support fail with a clear error instead of hanging.

| Capability | Browser extension | npm client (`mobius-client`, paused) |
| --- | --- | --- |
| Console/error/network/navigation event streaming | ✅ | ✅ |
| `get_recent_logs` / `get_recent_errors` / `get_network_requests` / `get_logs_since` | ✅ | ✅ |
| Multi-tab awareness (`get_connected_tabs`, `set_active_tab`, `get_capture_settings`) | ✅ | ✅ (one entry per app instance) |
| Opt-in capture (popup toggle / settings rules / agent-initiated) | ✅ | n/a — capture starts as soon as `startMobiusStream()` runs |
| Browser control (`navigate_to`, `reload_tab`, `switch_tab`, `open_tab`) | ✅ | ❌ |
| Element lookup (`find`, `snapshot_page`) and input synthesis (`click`, `type_text`, …) | ✅ (requires CDP) | ❌ |
| Instrumented actions (`observe`), hit-testing, `run_sequence` | ✅ (requires CDP) | ❌ |
| Cursor + HUD overlay on driven tabs | ✅ | ❌ |
| Debug sessions (`start_debug_session`/`end_debug_session`) | ✅ | ✅ (no DOM mutations) |
| Screenshots, DOM/accessibility snapshots | ✅ (requires CDP) | ❌ |
| CPU/memory profiling | ✅ (requires CDP) | ❌ |
| `evaluate_js` | ✅ (requires CDP) | ❌ |
| Network request/response headers + bodies | ✅ | ✅ |
| Full-body HAR export, `get_request_body`/`get_response_body` fallback | ✅ (requires CDP for the fallback fetch) | ❌ (inline-captured bodies only) |
| React/Redux/Zustand state, storage inspection | ❌ (planned) | ❌ (planned) |

See [Roadmap](#roadmap) for what "planned" maps to by stage.

## Skills

mobius-mcp is agent-agnostic — it works with any MCP-speaking client, not just one. `skills/<name>/SKILL.md` holds one workflow per major use case. Every client gets these the portable way: **each skill is also exposed as an MCP prompt of the same name** — no plugin system required, works with any MCP client that supports prompts.

Claude Code users additionally get a native-feeling shortcut, since this repo doubles as an installable Claude Code plugin (`.claude-plugin/plugin.json`):

```
/plugin marketplace add Topman-14/mobius-mcp
/plugin install mobius-mcp@mobius-mcp
```

That's a convenience on top, not the primary path — the MCP prompts are what makes the skills available everywhere.

| Skill | What it does |
| --- | --- |
| `mobius-broken-flow` | "X doesn't work" — drives to the failure itself, then separates a handler that never fired, a click eaten by an overlay, a silent API failure, a dropped session, and a response whose shape no longer matches what the frontend expects |
| `mobius-walkthrough` | Drives your key flows and reports what broke, collecting a screenshot, HAR and console output per step — a regression sweep without a test suite |
| `mobius-repro` | Turns a confirmed bug into a filable artifact: ordered timeline, screenshots, and a HAR with full bodies |
| `mobius-perf-stakeout` | Separates "feels slow" into network-bound, CPU-bound, or a memory leak building over repeated use |
| `mobius-page-audit` | What a page sends and exposes — third-party requests and their payloads, console noise, and controls that can't actually be reached |

## Design principles

* Local-first, zero cloud dependencies, zero telemetry
* Framework agnostic
* An action should return what it caused, not just whether it dispatched
* A human should be able to watch an agent drive their browser
* Extension and npm client emit an identical, versioned protocol — the server can't tell them apart

## Roadmap

Staged build history and planned future work — including why the npm client is paused, and what's left for framework introspection (React/Redux/Zustand state, storage inspection) — live in [ROADMAP.md](./ROADMAP.md).

## Smoke-test app

`examples/spa-smoke-test` is a small React + `react-router-dom` SPA built to exercise every capture path at once, rather than hunting for a real app that happens to trigger all of them: a range of `console.log`/`info`/`warn`/`error` payload shapes (objects, arrays, circular refs, BigInt, long strings, PII-shaped strings for redaction), multiple ways to trigger uncaught errors and unhandled promise rejections, `fetch`/XHR requests covering 200/404/500/slow/network-failure/POST, route/param/search-param changes, and DOM mutations. Useful for smoke-testing changes to this repo, or just seeing what mobius-mcp captures before wiring it into a real app. Requires a clone (not part of the published npm package) — see [Contributing](#contributing) below for setup.

```bash
cd examples/spa-smoke-test
npm install
npm run dev
```

Open the served URL, enable capture on the tab, click through `/scenarios`, then ask your agent to inspect the results via the [MCP tools](#mcp-tools) above — try `get_capture_settings` first, to rule out "that category is off" before assuming a missing event is a bug. Scenarios are extensible: see [examples/README.md](./examples/README.md) for the full list and how to add new ones.

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
