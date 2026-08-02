---
name: mobius-broken-flow
description: Diagnose a UI interaction or multi-step flow that doesn't work — a button that appears to do nothing, a form that won't submit, a step that silently fails — by driving it and reading what the app actually did. Separates a handler that never fired, a click eaten by an overlay, a request that failed, a 200 carrying an error body, a dropped auth session, and a response whose shape no longer matches the frontend. Use for any "X doesn't work" report with no clear error, via mobius-mcp.
---

# mobius-broken-flow

"It doesn't work" arrives with nothing to grep for — no stack trace, no message, just a control that seems inert or a flow that dies partway. That could be six different bugs, and reading source won't tell you which. Driving it while watching the runtime will, in one pass.

Don't ask the user to click anything. Drive it yourself and let the action report what it caused.

## When to use this

- A button, link, or form that "does nothing," with no console error reported.
- A multi-step flow (signup, checkout, upload) that fails at a step nobody can pin down.
- A feature that used to work and now silently no-ops.
- Before digging through source — confirm what actually happens first.

## Workflow

1. `mobius_diagnose`. If it isn't `ready`, relay the remediation and stop.
2. `clear_logs` — without a clean baseline, "nothing happened" is ambiguous between *truly nothing* and *buried in noise*.
3. `find({ query: "..." })` to locate the control by description ("submit order button"). Check `totalMatched`: exactly one is a confident hit, several means disambiguate by `name`/`role`/`box` before acting. Fall back to `snapshot_page({ viewportOnly: true })` to survey if `find` comes back empty.
4. **Act with an observation window.** `click(ref, { observe: { windowMs: 3000 } })`. For a multi-step flow use `run_sequence`, giving the step you suspect its own `observe`. Address steps by CSS `selector` rather than `ref` if they follow a navigation — refs go stale, selectors resolve at step time.
5. **Read `hitTest` before anything else.** If it's `"blocked"`, that is the bug and the rest of the timeline is a red herring:
   - `covered` — `hitTestBlockedBy` names the element eating the input. A modal backdrop, toast, or spinner left mounted; a full-screen `opacity: 0` layer without `pointer-events: none`. `take_screenshot` or `capture_element` to see it.
   - `pointer_events` — the target has `pointer-events: none`, often paired with a `disabled` state styled to look enabled.
   - `offscreen` — the target's centre is outside the viewport. `scroll_to` first, then retry.
6. **Otherwise diagnose from `observed`:**
   - **Empty** — first confirm it's real: check `notCaptured` in the response. If a category is off, you're blind, not looking at silence. If capture is on and it's genuinely empty, the handler never ran — see "Nothing fired" below.
   - **Console, no network** — client-side logic ran and stopped short. Validation blocked it, an exception was swallowed by an empty `catch`, or state changed and nothing downstream reacted.
   - **Request failed outright** (`error`, or 4xx/5xx) — a real error that never reached the UI. Find the missing `.catch()` or error boundary.
   - **Request returned 200 but nothing changed** — read `responseBody` before touching frontend code. See "Successes that aren't" below.
7. Only now grep source, using what you learned to look for the specific gap.

## Nothing fired

With `hitTest: "ok"` and an empty observe window, the handler genuinely didn't run. Two causes worth checking before assuming a stale selector:

- **Event propagation swallowed it.** A parent's `stopPropagation()`, a capturing-phase listener (`{ capture: true }`), or a `preventDefault()` on a wrapper suppressing form submit or link navigation. There's no live listener listing here, so this is a source grep: look at everything between the element and its intended handler — a wrapping `<Link>`/router component, a "click outside to close" listener, a delegated handler higher up.
- **The element is a decoy.** A styled `<div>` that looks like a button but has no handler, or a label whose `for` points at nothing. `snapshot_page` shows the resolved `role` — a "button" reported as `role: "div"` with no interactivity is the answer.

## Successes that aren't

A `200 OK` is not evidence the operation worked. Check these before concluding the frontend is at fault:

- **An error-shaped body.** `{"success": false}`, `{"error": ...}`, a GraphQL `errors` array, or a `data: null` alongside a message. Anything checking `response.ok` alone is blind to all of it. Read `responseBody` from the observe window directly — it's already there.
- **A dropped session.** Compare `requestHeaders` across the request sequence: if `authorization` or `cookie` is present on early requests and absent later, the session was lost mid-flow and the server is answering as an anonymous user. Header *values* are redacted but the *names* are not, so presence is still answerable. A 401 wrapped in a 200 body is the same bug seen from the other side.
- **Contract drift.** The request succeeded and the response is well-formed, but its shape no longer matches what the frontend expects — a renamed field, a nullable that's now null, an array that became an object. Compare `responseBody` against the TypeScript type or the code reading it; the give-away is UI rendering `undefined`, blank, or a default while the network tab looks perfectly healthy.

## Notes

- Use real actions, not `evaluate_js` with `element.click()` — a synthetic click bypasses the exact overlay/pointer-events problems this skill exists to catch, and misses handlers that require trusted events.
- `observe` is the default way to act here. Reaching for a separate `get_recent_logs` after an action costs a round trip and forces you to correlate by hand.
- For a flow with many steps, `start_debug_session`/`end_debug_session` gives one ordered timeline across all of them — useful when the failing step isn't known yet. Note it doesn't survive a full-page navigation.
- If several causes look plausible, say which evidence would separate them rather than picking the most familiar one.
