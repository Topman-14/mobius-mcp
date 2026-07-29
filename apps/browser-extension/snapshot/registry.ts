// Snapshot-scoped ref lifetime (ROADMAP.md Stage H): only the most recent snapshot's refs
// resolve. `resolveRef` isn't called by anything yet — Stage I's action tools (click,
// hover, ...) will be the first callers, once they exist.
export type RefResolution = { ok: true; element: Element } | { ok: false; reason: "stale_snapshot" | "not_found" };

let currentSnapshotId: string | undefined;
let currentRefs = new Map<string, Element>();
let snapshotCounter = 0;

export function allocateSnapshotId(): string {
  snapshotCounter += 1;
  return `snap_${snapshotCounter}`;
}

export function commitSnapshot(snapshotId: string, refs: Map<string, Element>): void {
  currentSnapshotId = snapshotId;
  currentRefs = refs;
}

export function resolveRef(ref: string): RefResolution {
  const snapshotId = ref.slice(ref.indexOf("@") + 1);
  if (snapshotId !== currentSnapshotId) return { ok: false, reason: "stale_snapshot" };
  const element = currentRefs.get(ref);
  return element ? { ok: true, element } : { ok: false, reason: "not_found" };
}
