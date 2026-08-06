# @mobius-mcp/browser-extension

Chromium extension that lets an AI agent operate your real browser and account for what it did. It captures runtime events (`console.*`, errors, network requests with bodies, SPA navigation, DOM mutations) and streams them to a local `mobius-mcp` server over WebSocket, and — via `chrome.debugger`/CDP — drives the page with trusted input (`click`, `type_text`, element lookup via `find`/`snapshot_page`, `run_sequence`), takes screenshots and DOM/accessibility snapshots, profiles CPU/memory, and runs arbitrary JS. No application changes required.

Driven tabs show a synthetic cursor that moves to each target before input fires, plus a HUD logging what the agent is doing, so operating a live account isn't a black box (`src/modules/overlay/`).

## What you can do with it

**Debug a broken flow end to end.** Point the agent at "signup is failing" and it drives to the failure itself — no more pasting console output into chat, and no more describing which buttons to press. It comes back with the request that failed, the response body that explains why, and the console error that followed.

**Catch failures that look like successes.** A `200 OK` carrying `{"success": false}`. A click swallowed by an invisible modal backdrop. An auth header that quietly stops being sent halfway through a flow. These are invisible to status codes and to `element.click()`, and they're what this is built to surface.

**Run a QA walkthrough.** Drive your key flows in one `run_sequence` and collect a screenshot, a HAR and the console output per step — a regression sweep before a release, without a test suite to maintain.

**Reproduce and hand off a bug.** Turn a confirmed repro into something filable: an ordered timeline, screenshots, and a HAR with full request/response bodies attached.

**Investigate performance.** Separate "the network is slow" from "the main thread is blocked" from "memory climbs every time I open this panel", using request timing alongside real CPU and memory profiles — against your actual logged-in session, not a synthetic one.

**Audit what a page really sends.** See every third-party request a page makes and what's in the payloads — analytics, pixels, embedded widgets — including whether anything sensitive is leaving in a request body.

Because it drives the browser you're already authenticated in, all of this works on pages behind a login — internal dashboards, admin panels, staging environments — with no credentials handled by the agent and no separate test account.

## Load unpacked (dev)

1. `npm run build` in this directory (or from repo root).
2. Visit `chrome://extensions`, enable Developer Mode.
3. "Load unpacked" and select `dist/` in this directory.

Capture is opt-in per tab — click the toolbar icon and hit "Enable tab", or add an auto-enable rule on the options page. See the [root README](../../README.md#enabling-capture-extension) for the full walkthrough, MCP tool list, and privacy defaults.

## Status

Actively developed — see the [root README](../../README.md) and [ROADMAP.md](../../ROADMAP.md) for what's shipped versus planned.
