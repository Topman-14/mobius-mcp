import { resolveRef } from "../snapshot/registry.js";
import type { ActionTarget, ResolvedTarget } from "./types.js";

export class ActionTargetError extends Error {}

function elementFor(target: ActionTarget): Element {
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

export function resolveTarget(target: ActionTarget): ResolvedTarget {
  const element = elementFor(target);
  element.scrollIntoView({ behavior: "instant" as ScrollBehavior, block: "center", inline: "center" });
  const rect = element.getBoundingClientRect();
  return {
    x: Math.round(rect.x + rect.width / 2),
    y: Math.round(rect.y + rect.height / 2),
    label: labelFor(element),
  };
}
