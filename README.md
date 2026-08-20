<div align="center">
  <img src="./apps/browser-extension/public/icons/icon-128.png" alt="mobius-mcp" width="72" height="72" />

  <h1>mobius-mcp</h1>

  <p><strong>An MCP server that lets an AI agent drive Chrome and see the console, network and DOM effects of every action it takes.</strong></p>

  <a href="https://www.npmjs.com/package/mobius-mcp"><img alt="npm version" src="https://img.shields.io/npm/v/mobius-mcp.svg"></a>
  <a href="https://www.npmjs.com/package/mobius-mcp"><img alt="npm downloads" src="https://img.shields.io/npm/dm/mobius-mcp.svg"></a>
  <a href="./LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <a href="https://github.com/Topman-14/mobius-mcp/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Topman-14/mobius-mcp/actions/workflows/ci.yml/badge.svg"></a>
</div>

## Table of contents

- [Introduction](#introduction)
  - [Usecases](#usecases)
- [How it works](#how-it-works)
- [Getting started](#getting-started)
- [Quick guide](#quick-guide)
  - [Enabling capture (extension)](#enabling-capture-extension)
  - [MCP tools](#mcp-tools)
  - [Troubleshooting](#troubleshooting)
  - [Skills](#skills)
  - [Known limitations](#known-limitations)
- [Contributing](#contributing)
  - [Repo layout](#repo-layout)
  - [Install the extension from source](#install-the-extension-from-source)
  - [Configuration](#configuration)
  - [Smoke-test app](#smoke-test-app)
  - [Roadmap](#roadmap)
- [License](#license)

## Introduction

mobius-mcp gives an AI agent a browser it can actually operate and understand. It controls the Chrome browser you're already signed into, while tracking the requests, console errors, navigations, and DOM changes caused by each action.

It works with any MCP client, including Claude Code, Codex CLI, Cursor, Windsurf, Zed, Cline, and Gemini CLI. Everything runs locally, with no cloud services, telemetry, or external APIs.


### Usecases

**Debug a broken flow end to end.** Point the agent at "signup is failing" and it drives to the failure itself, no pasting console output into chat and no describing which buttons to press. It comes back with the request that failed, the response body that explains why, and the console error that followed.

**Catch failures that look like successes.** A `200 OK` carrying `{"success": false}`. A click swallowed by an invisible modal backdrop. An auth header that quietly stops being sent halfway through a flow. Status codes and `element.click()` miss all of these; this is built to surface them.

**Run a QA walkthrough.** Drive your key flows in one `run_sequence` and collect a screenshot, a HAR and the console output per step: a regression sweep before a release, without a test suite to maintain.

**Reproduce and hand off a bug.** Turn a confirmed repro into something filable: an ordered timeline, screenshots, and a HAR with full request and response bodies attached.

**Investigate performance.** Separate "the network is slow" from "the main thread is blocked" from "memory climbs every time I open this panel," using request timing alongside CPU and memory profiles from your own logged-in session rather than a synthetic one.

**Audit what a page sends.** See every third-party request a page makes and what's in the payloads (analytics, pixels, embedded widgets), including whether anything sensitive leaves in a request body.

**Verify a fix.** Re-run the same flow after the change and compare against what happened before.

Because it drives the browser you're already authenticated in, this works on pages behind a login: internal dashboards, admin panels, staging environments, with no credentials handled by the agent and no separate test account.

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

A browser extension captures runtime events (`console.*`, uncaught errors, unhandled rejections, `fetch`/`XHR` calls, and navigation, including SPA route changes via `pushState`/`replaceState`/hash) and streams them over a WebSocket to a local MCP server. The same connection carries commands the other way, which is why an action can report what it caused. The server keeps a rolling history, in-memory and backed by on-disk persistence (see [Configuration](#configuration)), and exposes it as MCP tools.

## Getting started

`mobius-mcp` is published on npm. Contributing to this repo instead? See [Contributing](#contributing).

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

2. **Install the browser extension.** Here's the [store version](https://chromewebstore.google.com/detail/bdhnfoelpknephokgkldjopdggkakdop?utm_source=item-share-cb).

   Once installed, click the toolbar icon and hit "Enable tab" on the tab you want to work with. Capture is opt-in per tab; nothing streams by default (see [Enabling capture](#enabling-capture-extension)). An agent can also open and enable a tab itself via `open_tab`/`enable_capture`, without the click.

3. **Ask your agent to use it.** "With mobius mcp, walk through checkout and tell me where it breaks," "check the browser console for errors," "what is this page sending to third parties."

## Quick guide

### Enabling capture (extension)

Click its toolbar icon and hit "Enable tab" on the tab you want to work with; multiple tabs can be enabled independently. For dev servers you always want captured without clicking every time, add a rule (e.g. `localhost:5173`) on the extension's settings page (click the icon → Options); Matching tabs auto-enable on navigation.

An agent can also start capture itself, without a toolbar click, via `open_tab` (opens a new tab) or `enable_capture`. Consent still comes from the human having installed and granted the extension its permissions.

An enabled tab keeps the same `tabId` across navigation, along with its event history, so a handle an agent obtained before a page load stays valid after it. Use `clear_logs` if you want a clean baseline after navigating.

#### Privacy defaults

Nothing is captured until a tab is enabled, and what is captured is redacted before it ever leaves the browser. Out of the box: `authorization`, `cookie`, `set-cookie`, `proxy-authorization` and `x-api-key` header values are replaced with `[redacted]` (the header name stays visible, so "was this request authenticated?" is still answerable), JSON body keys shaped like secrets (`password`, `token`, `api_key`, `ssn`, card numbers, etc.) are masked at any depth, and JWT-shaped strings are masked wherever they appear. Email masking is available but off by default. All of it is configurable per item on the extension's settings page.

Captured events are also written to disk so history survives an MCP server restart (see `CONSOLE_STREAM_PERSISTENCE_DIR` in [Configuration](#configuration)). Those files hold redacted event data including request and response bodies; the directory is created `0700` and the files `0600`, and everything in it is pruned after `CONSOLE_STREAM_PERSISTENCE_TTL_MS` (1 hour by default).

#### Extension permissions

| Permission | Why |
| --- | --- |
| `scripting` | Inject the capture and driving scripts into an enabled tab |
| `storage` | Settings, auto-enable rules, and per-tab capture state |
| `tabs` | Read tab URLs/titles for `list_tabs`, and open/switch/reload them |
| `webNavigation` | Detect page loads, to re-inject capture and emit navigation events |
| `debugger` | Chrome DevTools Protocol: trusted input events, screenshots, snapshots, profiling, `evaluate_js`. This is why Chrome shows a "being debugged" bar on driven tabs |
| `alarms` | Reconnect backstop. An idle MV3 service worker can be shut down, and an alarm is the only thing that can start it again |
| `<all_urls>` | Capture is opt-in per tab, but the tab could be any origin: a local dev server, a staging deploy, or production |

`notifications` is optional and only requested if you turn on error notifications in settings.

### MCP tools

Start with `mobius_diagnose`. It reports whether mobius is usable right now (connection state, ever-connected history, ordered remediation steps), never fails, and never needs a tab. Call it first in a session and after any connection-related error. See [Troubleshooting](#troubleshooting).

#### Diagnostics and jobs

* `mobius_diagnose`: connection health check and remediation guidance
* `get_job_status`, `get_job_result`, `cancel_job`: manage a long-running job (profiling, recording) started by another tool

#### Tabs and navigation

* `list_tabs`: every open tab, not just enabled ones
* `open_tab`, `enable_capture`: start a capture session without a toolbar click
* `get_connected_tabs`, `set_active_tab`, `get_capture_settings`: which tabs are streaming, which one is active, and which event categories a tab is capturing (so an empty result is distinguishable from "that category is off")
* `navigate_to`, `switch_tab`, `reload_tab`: browser control

#### Finding and driving elements

Requires the extension and CDP. Targets are addressed by a `ref` (from `find`/`snapshot_page`) or a CSS `selector`. Every action here takes `observe: { windowMs, types? }` to report what the app did afterward, and reports `hitTest` so a blocked interaction is never mistaken for a working one.

* `find`: locate elements by natural-language description ("accept cookies button"); returns ranked refs plus `totalMatched`
* `snapshot_page`: pruned, indexed tree of interactive/labelled/text-bearing elements, each with a `ref`, role, accessible name and box; narrow it with `viewportOnly`, `roles` or `maxElements`
* `click`, `hover`, `type_text`, `press_key`, `scroll_to`, `scroll_by`, `select_option`, `set_checkbox`: trusted CDP input events, each moving the on-page cursor overlay with its own icon
* `run_sequence`: many steps against one tab in a single round trip, stopping at the first failure and returning what completed; `find`/`snapshot_page`/`take_screenshot` are eligible steps, with screenshots returned interleaved in step order

#### Reading logs, network and events

* `get_recent_logs`, `get_recent_errors`, `get_logs_since`, `clear_logs`
* `get_network_requests`: request/response headers plus size-capped, redacted bodies for text-like content types (no CDP needed)
* `start_debug_session`, `end_debug_session`: one ordered timeline of console, network, navigation and DOM events instead of correlating snapshots by hand (single-tab, doesn't survive a full-page navigation)
* `wait_for_console_error`, `wait_for_navigation`, `wait_for_request`, `wait_for_element`: block with a timeout instead of polling in a loop
* `export_har`: HAR 1.2 with full request/response bodies; anything missed inline is re-fetched over CDP (binary bodies base64-encoded)
* `get_response_body`, `get_request_body`: CDP fallback for the rare body capture that gets skipped (binary, oversized, non-text)

#### Capturing the page

* `take_screenshot`, `capture_full_page`, `capture_element`
* `capture_dom`, `capture_accessibility_tree`: markup and the full accessibility tree, for markup/ARIA questions rather than finding something to click
* `evaluate_js`: arbitrary JS in the tab, fully open, with no read-only enforcement
* `start_cpu_profile`, `start_memory_profile`: job-based; check progress with `get_job_status`/`get_job_result`/`cancel_job`

CDP-backed tools make Chrome show a persistent "being debugged" banner on the tab once used; the debugger attaches on first use and stays attached rather than attaching per call. This is a Chrome-level indicator the extension cannot suppress. Profile durations are capped at 60s and best-effort beyond roughly 25-30s, since Chrome can terminate an idle MV3 service worker mid-profile.

### Troubleshooting

If an agent reports mobius-mcp isn't working, ask it to call `mobius_diagnose`. It returns a `state` (`ready`, `no_client_ever_connected`, `client_disconnected`, `handshake_rejected`, or `ws_bind_failed`) plus ordered remediation steps, and never fails or requires a connected tab.

To check from outside an MCP session entirely:

```bash
npx mobius-mcp --health
```

This prints the same payload as JSON and exits `0` if `state` is `"ready"`, `1` otherwise. It talks to whichever mobius-mcp process is already bound to the configured port (`CONSOLE_STREAM_PORT`, default `7331`); it doesn't start a new server, so run it while your MCP client is active.

### Skills

mobius-mcp is agent-agnostic: it works with any MCP-speaking client, not just one. `skills/<name>/SKILL.md` holds one workflow per major use case. Every client gets these the portable way, since each skill is also exposed as an MCP prompt of the same name, no plugin system required, and it works with any MCP client that supports prompts.

Claude Code users additionally get a native-feeling shortcut, since this repo doubles as an installable Claude Code plugin (`.claude-plugin/plugin.json`):

```
/plugin marketplace add Topman-14/mobius-mcp
/plugin install mobius-mcp@mobius-mcp
```

| Skill | What it does |
| --- | --- |
| `mobius-broken-flow` | "X doesn't work": drives to the failure itself, then separates a handler that never fired, a click eaten by an overlay, a silent API failure, a dropped session, and a response whose shape no longer matches what the frontend expects |
| `mobius-walkthrough` | Drives your key flows and reports what broke, collecting a screenshot, HAR and console output per step |
| `mobius-repro` | Turns a confirmed bug into a filable artifact: ordered timeline, screenshots, and a HAR with full bodies |
| `mobius-perf-stakeout` | Separates "feels slow" into network-bound, CPU-bound, or a memory leak building over repeated use |
| `mobius-page-audit` | What a page sends and exposes: third-party requests and their payloads, console noise, and controls that can't be reached |

### Known limitations

- **Testing coverage.** It works reliably across the setups it's been developed and dogfooded on, but hasn't yet been exercised across the full range of OSes, Chrome versions, and MCP clients in the wild. Treat it as early-stage software, and report anything unexpected.
- **The published extension lags this repo.** Chrome Web Store review is slow, so the store build is currently well behind; driving in particular isn't in it yet. Build [from source](#install-the-extension-from-source) for the full capability set. `mobius_diagnose` reports a version mismatch as `handshake_rejected`.
- **The local WebSocket is unauthenticated.** Anything that can open a socket to `127.0.0.1:7331` can drive the tools, including `evaluate_js`. In practice that means any other process running as you, and any page loaded over plain `http` (WebSocket connections aren't subject to same-origin policy; only `https` pages are blocked from `ws://` by mixed-content rules). This is the standard localhost-dev-tool trust model, but it's still a boundary worth closing, and doing so is tracked as planned work; see "WebSocket authentication" in [ROADMAP.md](./ROADMAP.md).
- **`evaluate_js` has no sandboxing or read-only mode.** It runs arbitrary JavaScript with the same privileges as the page's own scripts, in the page's own origin, using whatever session is already logged in. Treat a call to it the same way you'd treat pasting code into DevTools' console yourself; it's intentionally this open because it operates on your own browser and app, not a shared or untrusted one.
- **A page can influence what it reports about itself.** Capture works by patching `console.*`/`fetch` inside the page's own JavaScript context, which is what makes it work at all, but a hostile or compromised page can suppress events or emit fabricated ones. Treat captured output from untrusted pages as untrusted data; the server tells agents this explicitly in its MCP instructions. Sourcing capture from CDP instead, at the cost of a permanent debugger banner, is tracked as planned work; see "Unforgeable capture" in [ROADMAP.md](./ROADMAP.md).
- **Actions dispatch even when the target is covered.** Hit-testing reports `hitTest: "blocked"` and names the element that will actually receive the input, but the event is still sent; it reports the problem rather than refusing.
- **Screenshots need the tab in the foreground.** Chrome doesn't service `captureScreenshot` for a background tab, so call `switch_tab` first if the target isn't visible.
- **`snapshot_page` truncates in DOM order.** On a long page that means the element budget can be spent above the current viewport. Use `viewportOnly`, or `find`, which isn't affected.
- **The debugger banner.** Any CDP-backed tool attaches `chrome.debugger`, so Chrome shows its "being debugged" bar on that tab. The debugger detaches after five idle minutes.

## Contributing

Contributions are welcome; please open an issue to discuss significant changes before submitting a PR. Guidelines and PR expectations are in [CONTRIBUTING.md](./CONTRIBUTING.md); local setup instructions are below.

This is an npm workspaces monorepo (`apps/*`, `packages/*`). A single install at the root wires up every package. Running `npm install` inside an individual `apps/`/`packages/` folder is never necessary and will just fight the workspace symlinks in the root `node_modules`.

```bash
git clone https://github.com/Topman-14/mobius-mcp.git
cd mobius-mcp
npm install
npm run build
```

`npm run build` builds every workspace in dependency order (`packages/capture-core` then the apps), since `apps/browser-extension` and `apps/mcp-server` both consume the built `dist/` output of the shared package, not its TypeScript source.

To run the MCP server from source instead of via `npx`:

```bash
npm run start --workspace=apps/mcp-server
```

### Repo layout

| Path | Description |
| --- | --- |
| `apps/mcp-server` | Node.js MCP server; WebSocket hub and MCP tool implementations |
| `apps/browser-extension` | Chromium extension that captures events, drives the page, and renders the cursor/HUD overlay |
| `packages/capture-core` | Versioned event schema/message envelope plus runtime hook patching, shared by the extension and mcp-server (private, bundled) |
| `skills` | Scenario-focused agent skills, one per major use case, see [Skills](#skills) |
| `examples` | Example apps demonstrating integration |

### Install the extension from source

As the store build will always lag behind, this is the recommended path. It takes about a minute and needs Node 18+ and Chrome.

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

Pin the mobius icon to your toolbar and you're done; the extension connects to the MCP server on its own.

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

**To update later:** `git pull && npm run build`, then hit the refresh icon on the extension card at `chrome://extensions`. Reload any tab you had capture enabled on; the in-page scripts are only re-injected on the next load. Restart your MCP client too, so it picks up the rebuilt server.

Remove the Chrome Web Store version first if you have it installed; two copies both trying to hold the WebSocket connection produces confusing symptoms.

#### Watch mode

For active development across the shared packages and the extension, run:

```bash
npm run watch
```

This does a one-time build of `packages/capture-core` (so nothing is resolved against a missing `dist/` on a cold start), then runs three watchers in parallel with labeled output:

* `[packages]`: `tsc -b --watch` for `packages/capture-core`, incrementally rebuilding on save
* `[vite]`: the extension's Vite dev server, which also drives crxjs's automatic extension reload in Chrome for background/popup/options changes
* `[content-scripts]`: an esbuild watcher for `content-script.ts`/`injected.ts`, which are bundled as standalone IIFEs outside Vite's module graph (see the comment in `apps/browser-extension/vite.config.ts`)

Load the extension once via `chrome://extensions` → enable Developer Mode → **Load unpacked** → select `apps/browser-extension/dist`. From then on:

* Edits to `packages/capture-core` propagate through to the extension's bundled output automatically.
* Edits to background/popup/options files trigger Vite/crxjs's automatic reload in Chrome.
* Edits to `content-script.ts`/`injected.ts` rebuild immediately, but since those are injected on demand via `chrome.scripting.executeScript`, the new code takes effect the next time they're injected (reload the target tab, or toggle capture off/on) rather than needing an extension reload.

If you only need the shared package rebuilding (e.g. while working on `apps/mcp-server`) without the extension's Vite/esbuild watchers, run `npm run watch -w packages/capture-core` directly instead.

### Configuration

The server reads these environment variables on startup; set them in the `env` block of your MCP client's server config:

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
| `CONSOLE_STREAM_PORT` | `7331` | WebSocket port the browser extension connects to |
| `CONSOLE_STREAM_MAX_EVENTS_PER_TAB` | `3000` | Event history cap per tab, both in-memory and on disk |
| `CONSOLE_STREAM_PURGE_DELAY_MS` | `300000` (5 min) | Grace period after a tab disconnects before its buffer is purged (survives a quick page refresh) |
| `CONSOLE_STREAM_PERSISTENCE_DIR` | `<os temp dir>/mobius-mcp/events` | Where per-tab event history is persisted to disk, so it survives an MCP server restart |
| `CONSOLE_STREAM_PERSISTENCE_TTL_MS` | `3600000` (1 hour) | How long persisted events are kept before being pruned from disk |

### Smoke-test app

`examples/spa-smoke-test` is a small React + `react-router-dom` SPA built to exercise every capture path at once, rather than hunting for an app that happens to trigger all of them: a range of `console.log`/`info`/`warn`/`error` payload shapes (objects, arrays, circular refs, BigInt, long strings, PII-shaped strings for redaction), multiple ways to trigger uncaught errors and unhandled promise rejections, `fetch`/XHR requests covering 200/404/500/slow/network-failure/POST, route/param/search-param changes, and DOM mutations. It's useful for smoke-testing changes to this repo, or just seeing what mobius-mcp captures before wiring it into an app of your own. It requires a clone (it isn't part of the published npm package).

```bash
cd examples/spa-smoke-test
npm install
npm run dev
```

Open the served URL, enable capture on the tab, click through `/scenarios`, then ask your agent to inspect the results via the [MCP tools](#mcp-tools) above. Try `get_capture_settings` first, to rule out "that category is off" before assuming a missing event is a bug. Scenarios are extensible: see [examples/README.md](./examples/README.md) for the full list and how to add new ones.

### Roadmap

Staged build history and planned future work, including what's left for framework introspection (React/Redux/Zustand state, storage inspection), live in [ROADMAP.md](./ROADMAP.md).

## License

[MIT](./LICENSE)
