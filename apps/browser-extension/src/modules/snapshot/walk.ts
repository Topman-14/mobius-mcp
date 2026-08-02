import type { PageSnapshot, SnapshotElement, SnapshotOptions } from "@mobius-mcp/capture-core";
import { MAX_SNAPSHOT_ELEMENTS, ACCESSIBLE_NAME_MAX_CHARS } from "./data.js";
import { isVisible, ownText, semanticLabel, isInteractive, elementRole } from "./utils/dom.js";
import { allocateSnapshotId, commitSnapshot } from "./registry.js";

function box(el: Element) {
  const rect = el.getBoundingClientRect();
  return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) };
}

function inViewport(rect: { x: number; y: number; width: number; height: number }): boolean {
  return rect.x + rect.width > 0 && rect.y + rect.height > 0 && rect.x < window.innerWidth && rect.y < window.innerHeight;
}

export function buildSnapshot(options: SnapshotOptions = {}): PageSnapshot {
  const snapshotId = allocateSnapshotId();
  const refs = new Map<string, Element>();
  const limit = options.maxElements ?? MAX_SNAPSHOT_ELEMENTS;
  const roles = options.roles && options.roles.length > 0 ? new Set(options.roles) : undefined;
  let count = 0;
  let totalQualified = 0;

  function walk(el: Element): SnapshotElement[] {
    if (!isVisible(el)) return [];

    const children: SnapshotElement[] = [];
    for (const child of Array.from(el.children)) {
      children.push(...walk(child));
    }

    const label = semanticLabel(el);
    const text = ownText(el);
    const role = elementRole(el);
    const rect = box(el);
    const qualifies =
      (isInteractive(el) || label.length > 0 || text.length > 0) &&
      (!roles || roles.has(role)) &&
      (!options.viewportOnly || inViewport(rect));

    if (!qualifies) return children;
    totalQualified += 1;
    if (count >= limit) return children;

    count += 1;
    const ref = `ref_${count}@${snapshotId}`;
    refs.set(ref, el);

    return [
      {
        ref,
        role,
        name: (label || text).slice(0, ACCESSIBLE_NAME_MAX_CHARS),
        tag: el.tagName.toLowerCase(),
        box: rect,
        children: children.length > 0 ? children : undefined,
      },
    ];
  }

  const elements = walk(document.body ?? document.documentElement);
  commitSnapshot(snapshotId, refs);

  return {
    snapshotId,
    url: window.location.href,
    title: document.title,
    elements,
    truncated: totalQualified > count || undefined,
    totalQualified,
  };
}
