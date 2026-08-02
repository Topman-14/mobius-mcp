---
name: mobius-repro
description: Turn a reproduced bug into a filable artifact — screenshots, an ordered console/network/navigation timeline, and a HAR with full request/response bodies — suitable for a GitHub issue or a handoff. Offers to save it as Markdown with the screenshot embedded. Use once a bug is confirmed but needs escalating, filing, or handing to someone else, via mobius-mcp.
---

# mobius-repro

Not every bug gets fixed on the spot. Sometimes the right outcome is a well-documented issue, not a patch. Collecting a screenshot, the console output and the network detail by hand is exactly the copy-paste tedium this server exists to remove — this turns a live repro directly into something postable.

Drive the repro yourself where you can. A bug report whose steps you executed is one you know actually reproduces.

## When to use this

- A bug is confirmed reproducible but the cause isn't clear, or fixing it is out of scope for this session.
- Handing a bug to someone else, or filing it for later.
- The user asks to "write this up," "document this," or "file an issue" for something just reproduced.

## Workflow

1. `mobius_diagnose`. If it isn't `ready`, relay the remediation and stop.
2. `clear_logs`, then `start_debug_session(capture: ["console", "network", "navigation", "dom"])` — the timeline is what makes the report reproducible by someone else.
3. **Drive the repro** with `run_sequence`, recording the exact steps as you go: they become the numbered repro steps in the write-up. Use `find` to locate controls and `wait_for_*` between steps rather than fixed delays. If a step genuinely can't be automated (a native file dialog, an external auth redirect, a payment step), ask the user to perform just that step and note it as manual in the report.
4. At the moment of failure, `take_screenshot` — or `capture_full_page` if the relevant part is off-screen. Foreground the tab with `switch_tab` first if needed.
5. `end_debug_session` for the ordered timeline.
6. `export_har` for a portable network record. This carries full request/response bodies, re-fetched over CDP where they weren't captured inline, so it stands alone as evidence.
7. **Ask before writing anything to disk.** Confirm whether they want a Markdown file (and where — default to something like `bug-reports/<short-slug>.md` unless they say otherwise) or whether a chat summary is enough. Some sessions just want it read back.
8. If they want a file:
   - Decode the screenshot's `dataBase64` to a real PNG next to the Markdown (`<slug>-screenshot.png`). Pipe the base64 through `base64 -d` rather than pasting a data URI inline — a raw blob bloats the file and most renderers, GitHub included, won't inline it reliably.
   - Reference it normally: `![screenshot](./<slug>-screenshot.png)`.
   - Structure it as: title, environment (tab URL, browser, app version if visible), numbered repro steps someone else can follow, the screenshot, expected vs actual, the trimmed timeline, and the failing request(s) with status, headers and the relevant body fragment.
9. If just a summary is wanted, use the same structure as chat output with the screenshot described rather than embedded.
10. If filing to GitHub is in scope, offer it once the write-up exists — don't create the file *and* open the issue without checking which the user wants.

## What makes the report good

- **Repro steps that actually reproduce.** You drove them; write them as the sequence you ran, not as a paraphrase.
- **Expected vs actual, stated plainly.** A timeline without this makes the reader infer what was supposed to happen.
- **The one request that matters**, with its body — not every request the page made.
- **Evidence for the cause if you have it.** A `hitTest: "blocked"` naming the covering element, or a 200 with an error body, turns "it's broken" into a starting point.

## Notes

- Curate aggressively regardless of format. A dozen chosen lines beat a raw JSON dump — the point is to save the next person a repro, not to prove you captured everything.
- Never silently write files. Asking is this skill's first-run behaviour, not an optional courtesy.
- Redaction happens before capture, so header values and secret-shaped body keys are already masked — but a HAR still contains real URLs, real payloads and real response data. Say so before the user attaches it to a public issue.
- If the cause turns out to be obvious mid-way, stop and say so rather than finishing the paperwork — a fix beats a filed issue.
