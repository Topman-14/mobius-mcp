export interface ActionTarget {
  ref?: string;
  selector?: string;
}

export interface ResolvedTarget {
  x: number;
  y: number;
  label: string;
  hitTest: HitTest;
}

export type HitTest = { ok: true } | { ok: false; blockedBy: string; reason: "covered" | "pointer_events" | "offscreen" };

export interface PreparedTarget {
  x: number;
  y: number;
  hitTest: HitTest;
}
