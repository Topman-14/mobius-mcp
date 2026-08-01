import { resolveRef } from "../snapshot/registry.js";
import type { ActionTarget, HitTest, ResolvedTarget } from "./types.js";

export class ActionTargetError extends Error {}

export function elementFor(target: ActionTarget): Element {
  if (target.ref) {
    const resolution = resolveRef(target.ref);
    if (!resolution.ok) {
      throw new ActionTargetError(
        resolution.reason === "stale_snapshot"
          ? `ref "${target.ref}" is from a superseded snapshot — call snapshot_page again.`
          : `ref "${target.ref}" not found in the current snapshot.`,
      );
    }
    return resolution.element;
  }
  if (target.selector) {
    const element = document.querySelector(target.selector);
    if (!element) throw new ActionTargetError(`No element matching selector "${target.selector}".`);
    return element;
  }
  throw new ActionTargetError("Provide either ref or selector.");
}

function labelFor(element: Element): string {
  const name = element.getAttribute("aria-label")?.trim() || (element as HTMLElement).innerText?.trim().slice(0, 40) || "";
  return `${element.tagName.toLowerCase()}${name ? ` "${name}"` : ""}`;
}

function describe(element: Element): string {
  const id = element.id ? `#${element.id}` : "";
  const cls = typeof element.className === "string" && element.className ? `.${element.className.trim().split(/\s+/).slice(0, 2).join(".")}` : "";
  return `${element.tagName.toLowerCase()}${id}${cls}`;
}

function hitTestAt(element: Element, x: number, y: number): HitTest {
  if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) {
    return { ok: false, blockedBy: describe(element), reason: "offscreen" };
  }
  if (getComputedStyle(element).pointerEvents === "none") {
    return { ok: false, blockedBy: describe(element), reason: "pointer_events" };
  }
  const topmost = document.elementFromPoint(x, y);
  if (!topmost || (topmost !== element && !element.contains(topmost) && !topmost.contains(element))) {
    return { ok: false, blockedBy: topmost ? describe(topmost) : "nothing", reason: "covered" };
  }
  return { ok: true };
}

export function resolveTarget(target: ActionTarget, resolved?: Element): ResolvedTarget {
  const element = resolved ?? elementFor(target);
  element.scrollIntoView({ behavior: "instant" as ScrollBehavior, block: "center", inline: "center" });
  const rect = element.getBoundingClientRect();
  const x = Math.round(rect.x + rect.width / 2);
  const y = Math.round(rect.y + rect.height / 2);
  return { x, y, label: labelFor(element), hitTest: hitTestAt(element, x, y) };
}
