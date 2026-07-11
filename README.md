# console-stream-mcp

Give AI coding agents (Claude Code, Codex CLI, Gemini CLI, etc.) live access to your web app's runtime — console logs, errors, and network requests — without copy-pasting anything into chat.

Local-first. No cloud services, no telemetry, no external APIs.

## How it works

```
Web App
  │
Extension OR npm package
  │
WebSocket
  │
localhost
  │
console-stream-mcp
  │
MCP
  │
Claude Code / Codex / Gemini CLI
```

A browser client (extension or npm package) captures runtime events — `console.*`, uncaught errors, unhandled rejections, `fetch`/`XHR` calls — and streams them over a WebSocket to a local MCP server. The MCP server keeps a rolling in-memory history and exposes it to AI agents as MCP tools.

## Packages

| Path | Description |
| --- | --- |
| `apps/mcp-server` | Node.js MCP server; WebSocket hub + MCP tool implementations |
| `apps/browser-extension` | Chromium extension that captures and streams browser events |
| `apps/npm-client` | `console-stream-client` npm package for direct app integration |
| `packages/protocol` | Versioned event schema and message envelope (private, bundled into published packages) |
| `packages/capture-core` | Runtime hook patching shared by the extension and npm client (private, bundled) |
| `skill` | Agent skill describing when/how to use the MCP tools to debug a web app |
| `examples` | Example apps demonstrating integration |

## Quick start

```bash
npm install
npm run build

# start the MCP server
npm run start --workspace=apps/mcp-server
```

Then either load the unpacked extension from `apps/browser-extension/dist`, or add the npm client to your app:

```ts
import { startConsoleStream } from "console-stream-client";

startConsoleStream();
```

Point your MCP-compatible agent at the server (see `apps/mcp-server/README.md` for configuration).

### Enabling capture (extension)

The extension never captures anything by default. Click its toolbar icon and hit "Enable capture" on the tab you want to debug — that's the one opt-in. Multiple tabs can be enabled independently. For dev servers you always want captured without clicking every time, add a rule (e.g. `localhost:5173`) on the extension's settings page (right-click the icon → Options) — matching tabs auto-enable on navigation.

## MCP Tools

* `get_recent_logs`
* `get_recent_errors`
* `get_network_requests`
* `get_logs_since`
* `clear_logs`
* `get_connected_tabs`
* `set_active_tab`

## Client capabilities

Event ingestion (console/errors/network) is identical across both browser clients — the server can't tell them apart. Command capabilities are not: many later-stage features require Chrome DevTools Protocol access, which only the extension has. The protocol reports this via a `capabilities` field on connect, so commands a client can't support fail with a clear error instead of hanging.

| Capability | Browser extension | npm client (`console-stream-client`) |
| --- | --- | --- |
| Console/error/network event streaming | ✅ | ✅ |
| `get_recent_logs` / `get_recent_errors` / `get_network_requests` / `get_logs_since` | ✅ | ✅ |
| Multi-tab awareness (`get_connected_tabs`, `set_active_tab`) | ✅ | ✅ (one entry per app instance) |
| Opt-in capture (popup toggle / settings-page rules) | ✅ | n/a — capture starts as soon as `startConsoleStream()` runs |
| Navigation control (`navigate_to`, `reload_tab`, `switch_tab`) | ✅ (planned) | ❌ |
| Debug sessions (`start_debug_session`) | ✅ (planned) | ✅ (planned, event types available to it) |
| Screenshots, DOM/accessibility snapshots | ✅ (planned, requires CDP) | ❌ |
| CPU/memory profiling, Web Vitals | ✅ (planned, requires CDP) | ❌ |
| `evaluate_js`, network response bodies | ✅ (planned, requires CDP) | ❌ |
| React/Redux/Zustand state, storage inspection | ✅ (planned) | ✅ (planned, page-context only — no cross-origin iframes) |

See [ROADMAP.md](./ROADMAP.md) for what "planned" maps to by stage.

## Design principles

* Local-first, zero cloud dependencies, zero telemetry
* Framework agnostic
* Extension and npm client emit an identical, versioned protocol — the server can't tell them apart

See [PROJECT.md](./PROJECT.md) for the full design doc and [ROADMAP.md](./ROADMAP.md) for staged future work.

## Contributing

Contributions are welcome. Please open an issue to discuss significant changes before submitting a PR. See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)
