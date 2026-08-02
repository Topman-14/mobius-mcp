import { INTERACTIVE_TAGS, INTERACTIVE_ROLES, ROLE_BY_TAG } from "../data.js";

export function isVisible(el: Element): boolean {
  const withCheckVisibility = el as Element & { checkVisibility?: (options?: object) => boolean };
  if (typeof withCheckVisibility.checkVisibility === "function") {
    return withCheckVisibility.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  }
  const style = getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden";
}

// Direct text nodes only — a container's descendants report their own text separately,
// so this is what makes an element itself "text-bearing" rather than just a wrapper.
export function ownText(el: Element): string {
  let text = "";
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) text += node.textContent ?? "";
  }
  return text.trim();
}

// Pragmatic accessible-name lookup, not the full accname spec: aria-label,
// aria-labelledby, alt (images), an associated <label for>, placeholder, then title.
export function semanticLabel(el: Element): string {
  const ariaLabel = el.getAttribute("aria-label")?.trim();
  if (ariaLabel) return ariaLabel;

  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim())
      .filter(Boolean)
      .join(" ");
    if (text) return text;
  }

  if (el.tagName === "IMG") {
    const alt = el.getAttribute("alt")?.trim();
    if (alt) return alt;
  }

  if ((el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") && el.id) {
    const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    const labelText = label?.textContent?.trim();
    if (labelText) return labelText;
  }

  const placeholder = el.getAttribute("placeholder")?.trim();
  if (placeholder) return placeholder;

  const title = el.getAttribute("title")?.trim();
  if (title) return title;

  return "";
}

export function isInteractive(el: Element): boolean {
  if (INTERACTIVE_TAGS.has(el.tagName)) return true;
  const role = el.getAttribute("role");
  if (role && INTERACTIVE_ROLES.has(role)) return true;
  const tabindex = el.getAttribute("tabindex");
  if (tabindex !== null && tabindex !== "-1") return true;
  return (el as HTMLElement).isContentEditable === true;
}

export function elementRole(el: Element): string {
  const explicit = el.getAttribute("role");
  if (explicit) return explicit;
  if (el.tagName === "INPUT") {
    const type = (el.getAttribute("type") || "text").toLowerCase();
    if (type === "checkbox") return "checkbox";
    if (type === "radio") return "radio";
    if (type === "button" || type === "submit" || type === "reset") return "button";
    return "textbox";
  }
  return ROLE_BY_TAG[el.tagName] ?? el.tagName.toLowerCase();
}
