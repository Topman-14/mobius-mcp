import type { FindMatch, FindResult } from "@mobius-mcp/capture-core";
import { ACCESSIBLE_NAME_MAX_CHARS, FIND_MIN_SCORE, MAX_FIND_RESULTS } from "./data.js";
import { isVisible, ownText, semanticLabel, isInteractive, elementRole } from "./utils/dom.js";
import { parseQuery, scoreCandidate } from "./utils/score.js";
import { allocateSnapshotId, commitSnapshot } from "./registry.js";

function box(el: Element) {
  const rect = el.getBoundingClientRect();
  return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) };
}

export function findElements(query: string, limit = MAX_FIND_RESULTS): FindResult {
  const intent = parseQuery(query);
  const snapshotId = allocateSnapshotId();
  const scored: Array<{ element: Element; score: number; name: string; role: string }> = [];

  const walk = (el: Element) => {
    if (!isVisible(el)) return;
    const label = semanticLabel(el);
    const text = ownText(el);
    const name = (label || text).slice(0, ACCESSIBLE_NAME_MAX_CHARS);
    const interactive = isInteractive(el);

    if (interactive || name.length > 0) {
      const role = elementRole(el);
      const score = scoreCandidate(intent, name, role, interactive);
      if (score >= FIND_MIN_SCORE) scored.push({ element: el, score, name, role });
    }
    for (const child of Array.from(el.children)) walk(child);
  };
  walk(document.body ?? document.documentElement);

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, limit);

  const refs = new Map<string, Element>();
  const matches: FindMatch[] = top.map((candidate, index) => {
    const ref = `ref_${index + 1}@${snapshotId}`;
    refs.set(ref, candidate.element);
    return {
      ref,
      role: candidate.role,
      name: candidate.name,
      tag: candidate.element.tagName.toLowerCase(),
      box: box(candidate.element),
      score: candidate.score,
    };
  });
  commitSnapshot(snapshotId, refs);

  return { snapshotId, query, url: window.location.href, title: document.title, matches, totalMatched: scored.length };
}
