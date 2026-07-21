# Contributing

Thanks for your interest in improving mobius-mcp.

## Setup

Local setup (clone, install, build, watch mode) lives in [README.md § Contributing](./README.md#contributing) — this file covers guidelines and PR expectations, not the setup steps themselves, so there's one place to keep those current.

This is an npm workspaces monorepo:

* `apps/mcp-server` — the MCP server
* `apps/browser-extension` — Chromium extension client
* `apps/npm-client` — `mobius-client` npm package (development paused — see [ROADMAP.md](./ROADMAP.md))
* `packages/capture-core` — shared event/message schema and runtime hook patching (console, errors, network)

## Guidelines

* Keep the extension and npm client emitting an identical protocol — the server must not be able to distinguish event sources.
* Protocol changes must be additive/versioned; don't break existing consumers.
* No cloud services, telemetry, or external network calls.
* Open an issue before starting significant changes.

## Pull requests

* Keep diffs focused on a single change.
* Add/update tests for behavior changes.
* Run `npm run lint` and `npm run test` before submitting.
