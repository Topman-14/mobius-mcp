import { resolveTarget } from "./resolve.js";
import type { ActionTarget } from "./types.js";

// Exposed for CDP `Runtime.evaluate` to call (background.ts's action commands — click, hover,
// ...). Resolves the target, moves the cursor overlay there, logs it to the HUD, and hands
// back coordinates for background.ts to dispatch the actual trusted CDP input event at.
declare global {
  interface Window {
    __mobiusActions?: {
      prepareTarget(target: ActionTarget, verb: string): { x: number; y: number };
    };
  }
}

window.__mobiusActions = {
  prepareTarget(target, verb) {
    const resolved = resolveTarget(target);
    window.__mobiusOverlay?.moveCursorTo({ x: resolved.x, y: resolved.y });
    window.__mobiusOverlay?.hudLog(`${verb} ${resolved.label}`);
    return { x: resolved.x, y: resolved.y };
  },
};
