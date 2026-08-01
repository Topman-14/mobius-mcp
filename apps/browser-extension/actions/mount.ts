import { elementFor, resolveTarget } from "./resolve.js";
import type { ActionTarget, HitTest } from "./types.js";
import type { CursorIconKey } from "../overlay/data.js";

// Exposed for CDP `Runtime.evaluate` to call (background.ts's action commands — click, hover,
// ...). Resolves the target, moves the cursor overlay there, logs it to the HUD, and hands
// back coordinates for background.ts to dispatch the actual trusted CDP input event at.
declare global {
  interface Window {
    __mobiusActions?: {
      prepareTarget(target: ActionTarget, verb: string, icon?: CursorIconKey): { x: number; y: number; hitTest: HitTest };
      setSelectValue(target: ActionTarget, value: string): { x: number; y: number; hitTest: HitTest };
      isChecked(target: ActionTarget): boolean;
    };
  }
}

window.__mobiusActions = {
  prepareTarget(target, verb, icon) {
    const resolved = resolveTarget(target);
    window.__mobiusOverlay?.moveCursorTo({ x: resolved.x, y: resolved.y }, icon);
    window.__mobiusOverlay?.hudLog(`${verb} ${resolved.label}`);
    return { x: resolved.x, y: resolved.y, hitTest: resolved.hitTest };
  },
  setSelectValue(target, value) {
    const element = elementFor(target) as HTMLSelectElement;
    const resolved = resolveTarget(target, element);
    window.__mobiusOverlay?.moveCursorTo({ x: resolved.x, y: resolved.y }, "select");
    window.__mobiusOverlay?.hudLog(`selecting "${value}" in ${resolved.label}`);
    element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return { x: resolved.x, y: resolved.y, hitTest: resolved.hitTest };
  },
  isChecked(target) {
    return (elementFor(target) as HTMLInputElement).checked;
  },
};
