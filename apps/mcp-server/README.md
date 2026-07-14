# mobius-mcp

MCP server that maintains a live, in-memory stream of browser runtime events — console logs, errors, network requests, and navigation — and exposes them to AI coding agents (Claude Code, Codex CLI, Gemini CLI, etc.) as MCP tools.

Local-first: everything runs on `localhost`, no cloud services, no telemetry, no external APIs.

Pair it with one of two browser-side clients:

- **[Mobius browser extension](https://github.com/Topman-14/mobius-mcp/tree/main/apps/browser-extension)** — Chromium extension, adds browser control, screenshots, DOM/accessibility snapshots, CPU/memory profiling, and `evaluate_js` on top of event streaming (via `chrome.debugger`/CDP). Interactive: you can click around and trigger events yourself while the agent inspects them, instead of the agent driving headless automation blind.
- **[`mobius-client`](https://www.npmjs.com/package/mobius-client)** — drop-in npm package for direct app integration, no extension required. Streams console/error/network/navigation events only.

Source: https://github.com/Topman-14/mobius-mcp

## Install

```bash
npm install -g mobius-mcp
```

Or run it directly with `npx` (no install) — see below.

## Usage

Register it with your MCP client. For Claude Code:

```bash
claude mcp add mobius-mcp -- npx -y mobius-mcp
```

Or add it directly to your MCP client's config — Claude Code, Codex CLI, Gemini CLI, Cursor, etc. all read a JSON config in this shape:

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

Then stream your app's runtime into it — either load the [browser extension](https://github.com/Topman-14/mobius-mcp/tree/main/apps/browser-extension) and click "Enable tab" on the page you're debugging, or install the npm client into your app:

```bash
npm install mobius-client
```

```ts
import { startMobiusStream } from "mobius-client";

startMobiusStream();
```

Once a browser tab is connected, ask your agent to check its console, errors, network activity, or DOM — no copy-pasting logs into chat.

## How it works

```
Web App
  │
Extension OR npm client
  │
WebSocket
  │
mobius-mcp (localhost)
  │
MCP (stdio)
  │
Your AI agent
```

The browser client captures `console.*`, uncaught errors, unhandled promise rejections, `fetch`/`XHR` calls, and navigation (including SPA route changes via `pushState`/`replaceState`/hash), and streams them over a WebSocket to this server. The server keeps a rolling in-memory history per tab and exposes it to the connected MCP client as tools.

## MCP tools

**Event queries**
- `get_recent_logs` — recent `console.log`/`info`/`warn`
- `get_recent_errors` — recent `console.error`, `window.onerror`, unhandled rejections
- `get_network_requests` — recent `fetch`/`XHR` requests
- `get_logs_since` — poll for events after a cursor, for streaming/tailing
- `clear_logs` — clear a tab's in-memory history
- `get_capture_settings` — which categories a tab is actively capturing, so an empty result can be told apart from "that category is off"

**Tab management**
- `get_connected_tabs` — tabs currently streaming events
- `set_active_tab` — default tab for calls that omit `tabId`
- `list_tabs` — every open tab, not just capture-enabled ones (extension only)

**Browser control** (extension only)
- `navigate_to`, `switch_tab`, `reload_tab`

**Debug sessions**
- `start_debug_session` / `end_debug_session` — record a time-ordered timeline of console/network/navigation/DOM events for a tab instead of correlating separate snapshots by hand

**Waiting on conditions** (block with timeout instead of polling)
- `wait_for_console_error`, `wait_for_navigation`, `wait_for_request`, `wait_for_element`

**Visual/DOM capture** (extension only, requires `chrome.debugger`/CDP)
- `take_screenshot`, `capture_full_page`, `capture_element`
- `capture_dom`, `capture_accessibility_tree`

**Code execution & network detail** (extension only, requires CDP)
- `evaluate_js` — run arbitrary JavaScript in the tab and get the result; fully open, no read-only enforcement — it's the developer's own browser and app
- `get_response_body` — fetch a captured request's response body
- `export_har` — export captured network requests as a HAR 1.2 file (works from either client, never includes bodies)

**Profiling** (extension only, requires CDP, job-based — see `get_job_status`/`get_job_result`/`cancel_job`)
- `start_cpu_profile`, `start_memory_profile`

CDP-backed tools make Chrome show a persistent "being debugged" banner on the tab once used (a Chrome-level indicator, not something the extension can suppress). Profiling durations are capped at 60s and best-effort beyond ~25-30s, since Chrome can terminate an idle MV3 background worker.

## Client capabilities

| Capability | Browser extension | npm client (`mobius-client`) |
| --- | --- | --- |
| Console/error/network/navigation streaming | ✅ | ✅ |
| Multi-tab awareness | ✅ | ✅ (one entry per app instance) |
| Browser control (navigate/reload/switch) | ✅ | ❌ |
| Debug sessions | ✅ | ✅ (no DOM mutations) |
| Screenshots, DOM/accessibility snapshots | ✅ | ❌ |
| CPU/memory profiling | ✅ | ❌ |
| `evaluate_js`, response bodies | ✅ | ❌ |

## License

[MIT](https://github.com/Topman-14/mobius-mcp/blob/main/LICENSE)
