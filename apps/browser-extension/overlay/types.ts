// Page-injected visual feedback for driving (Stage I5, ROADMAP.md) — a synthetic cursor and a
// HUD log, both rendered inside a shadow root so host-page CSS can't bleed in or be bled onto.

export interface CursorPoint {
  x: number;
  y: number;
}

// Exposed on `window.__mobiusOverlay` for the background script to drive via CDP
// `Runtime.evaluate` once Stage I's action tools dispatch through it — mirrors how
// `evaluate_js`/`capture_dom` already call into the page (background.ts:99).
export interface OverlayApi {
  moveCursorTo(point: CursorPoint): void;
  showCursor(): void;
  hideCursor(): void;
  hudLog(message: string): void;
  setHudExpanded(expanded: boolean): void;
}
