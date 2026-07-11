---
name: console-stream-mcp
description: Live browser runtime visibility (console logs, errors, network requests) for a web app via the console-stream-mcp server. Use when debugging a running web app instead of asking the user to paste console output or network errors.
---

# console-stream-mcp

`console-stream-mcp` is a local MCP server that streams live browser runtime events (console logs, uncaught errors, unhandled promise rejections, fetch/XHR requests) from a web app into the agent's context, via a browser extension or the `console-stream-client` npm package.

## When to use this

Reach for these tools whenever you're debugging a web app that's running locally and connected to console-stream-mcp, instead of asking the user to copy-paste browser console output, error messages, or network traces:

- The user reports a bug, error, or unexpected behavior in a running web app.
- You need to confirm whether a code change actually fixed a runtime error.
- You're investigating a failed network request (status code, payload, timing).
- You want to watch console output live while reproducing a bug.

Do not use it for build-time/compile errors, server-side logs, or static code analysis — those come from the terminal or source, not the browser runtime.

## Available tools

- `get_recent_logs` — recent `console.log`/`console.info` output.
- `get_recent_errors` — recent `console.error`, `window.onerror`, and unhandled rejections, including stack traces.
- `get_network_requests` — recent `fetch`/`XMLHttpRequest` calls with status and timing.
- `get_connected_tabs` — which browser tabs/pages are currently streaming events.
- `watch_console` — subscribe to new events as they happen, for live reproduction.
- `clear_logs` — reset the in-memory event history (e.g. before reproducing a bug, to isolate new output).

## Workflow

1. Check `get_connected_tabs` to confirm a tab is streaming — if none, tell the user to install/enable the extension or call `startConsoleStream()` from `console-stream-client` in their app.
2. Optionally `clear_logs` before asking the user to reproduce the issue, so the next output is isolated.
3. Use `get_recent_errors` / `get_network_requests` / `get_recent_logs` to inspect what happened, or `watch_console` to observe live.
4. Correlate stack traces and failed requests with the source code to identify the root cause.

All data is in-memory and local — nothing leaves the machine.
