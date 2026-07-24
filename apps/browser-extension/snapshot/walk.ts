import type { PageSnapshot, SnapshotElement } from "@mobius-mcp/capture-core";
import { MAX_SNAPSHOT_ELEMENTS, ACCESSIBLE_NAME_MAX_CHARS } from "./data.js";
import { isVisible, ownText, semanticLabel, isInteractive, elementRole } from "./utils/dom.js";
import { allocateSnapshotId, commitSnapshot } from "./registry.js";

function box(el: Element) {
  const rect = el.getBoundingClientRect();
  return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) };
}

export function buildSnapshot(): PageSnapshot {
  const snapshotId = allocateSnapshotId();
  const refs = new Map<string, Element>();
  let count = 0;

  function walk(el: Element): SnapshotElement[] {
    if (count >= MAX_SNAPSHOT_ELEMENTS || !isVisible(el)) return [];

    const children: SnapshotElement[] = [];
    for (const child of Array.from(el.children)) {
      children.push(...walk(child));
    }

    const label = semanticLabel(el);
    const text = ownText(el);
    // "interactive, labelled, or text-bearing" (ROADMAP.md Stage H) — anything else is a
    // pure layout wrapper and collapses into its qualifying children.
    const qualifies = isInteractive(el) || label.length > 0 || text.length > 0;
    if (!qualifies || count >= MAX_SNAPSHOT_ELEMENTS) return children;

    count += 1;
    const ref = `ref_${count}@${snapshotId}`;
    refs.set(ref, el);

    return [
      {
        ref,
        role: elementRole(el),
        name: (label || text).slice(0, ACCESSIBLE_NAME_MAX_CHARS),
        tag: el.tagName.toLowerCase(),
        box: box(el),
        children: children.length > 0 ? children : undefined,
      },
    ];
  }

  const elements = walk(document.body ?? document.documentElement);
  commitSnapshot(snapshotId, refs);

  return { snapshotId, url: window.location.href, title: document.title, elements };
}
