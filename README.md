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
| `packages/protocol` | Versioned event/message schema shared by all clients and the server |
| `packages/shared-types` | Shared TypeScript types |
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

## MCP Tools

* `get_recent_logs`
* `get_recent_errors`
* `get_network_requests`
* `clear_logs`
* `get_connected_tabs`
* `watch_console`

## Design principles

* Local-first, zero cloud dependencies, zero telemetry
* Framework agnostic
* Extension and npm client emit an identical, versioned protocol — the server can't tell them apart

See [PROJECT.md](./PROJECT.md) for the full design doc.

## Contributing

Contributions are welcome. Please open an issue to discuss significant changes before submitting a PR. See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)
