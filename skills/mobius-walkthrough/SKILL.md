---
name: mobius-walkthrough
description: Drive a set of key user flows end to end and report what broke, collecting a screenshot, network activity and console output per step. A regression sweep before a release, or a smoke test of a deploy, without a test suite to maintain. Use when asked to check whether an app still works, verify a release, or exercise flows after a change, via mobius-mcp.
---

# mobius-walkthrough

A regression sweep an agent can run against a real, logged-in session — no fixtures, no test account, no selectors written in advance. The output is a per-flow verdict backed by evidence, not a pass/fail count.

This is not a replacement for a test suite. It's what you run when there isn't one, or when the suite passes and users still report breakage.

## When to use this

- "Check that the app still works" before or after a deploy.
- Verifying a change didn't break neighbouring flows.
- Smoke-testing a staging environment that has no automated coverage.
- Re-running a flow after a fix, to compare against how it failed before.

## Workflow

1. `mobius_diagnose`. If it isn't `ready`, relay the remediation and stop.
2. **Agree the flows first.** If the user hasn't named them, propose a short list from the app's structure (routes, nav, README) and confirm before driving — a walkthrough that exercises the wrong things wastes the session. Keep it to the handful that matter.
3. **Decide what's safe to touch.** Ask before anything destructive or outward-facing: submitting real orders, sending messages or invites, deleting records, changing account settings, anything that spends money. On a production or shared environment, prefer read-only paths and stop to check rather than guessing.
4. **For each flow**, drive it as one `run_sequence`:
   - `find` the entry point, then chain the steps. Address by CSS `selector` rather than `ref` for anything after a navigation.
   - Put `observe: { windowMs }` on steps that submit, save, or load data — that's where failures hide.
   - Interleave `take_screenshot` at the points a human would want to see: after landing, after a submit, at the end state.
   - Use `wait_for_navigation` / `wait_for_element` between steps rather than fixed delays.
5. **Read each flow's transcript** for: any `hitTest: "blocked"`, any 4xx/5xx, any 200 with an error-shaped `responseBody`, any console error, and whether the expected end state was actually reached. A flow that "completed" without reaching its end state is a failure, not a pass.
6. `clear_logs` between flows so each one's evidence stands alone.
7. **Report per flow**: worked / broke / couldn't complete, and for anything not working, the specific evidence — the failing request and its body, the blocked click and what blocked it, the console error. Attach the screenshots. Do not report a bare count.

## Notes

- One `run_sequence` per flow, not one for everything. A sequence stops at the first failure, so bundling unrelated flows means one early break hides all the rest.
- Steps can't consume each other's output — you author the list up front. Including `find` in a sequence returns its refs for your *next* call, it doesn't feed later steps in the same one.
- Screenshots need the tab in the foreground; `switch_tab` first if you're driving a background tab.
- `export_har` at the end gives one artifact covering the whole sweep, useful to attach to a release note or hand to someone else.
- If a flow can't be completed because it needs credentials, a payment method, or a real external action, say so and move on — don't improvise around it or enter data on the user's behalf.
- Where a flow breaks and the cause isn't obvious from the transcript, hand off to `mobius-broken-flow` rather than re-deriving its triage here.
