import { CURSOR_GLOW_COLOR, HUD_MAX_LOG_ENTRIES, HUD_COLLAPSED_SIZE_PX, HUD_EXPANDED_WIDTH_PX, HUD_EXPANDED_HEIGHT_PX, MOBIUS_LOGO_SVG } from "./data.js";

export interface HudHandle {
  element: HTMLElement;
  log(message: string): void;
  setExpanded(expanded: boolean): void;
}

export function createHud(root: ShadowRoot): HudHandle {
  const container = document.createElement("div");
  Object.assign(container.style, {
    position: "fixed",
    left: "12px",
    bottom: "12px",
    zIndex: "2147483647",
    background: "rgba(10, 10, 10, 0.82)",
    color: "#e6e6e6",
    borderRadius: "10px",
    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.35)",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "12px",
    overflow: "hidden",
    cursor: "pointer",
    transition: "width 160ms ease, height 160ms ease",
    width: `${HUD_COLLAPSED_SIZE_PX}px`,
    height: `${HUD_COLLAPSED_SIZE_PX}px`,
  } satisfies Partial<CSSStyleDeclaration>);

  const badge = document.createElement("div");
  Object.assign(badge.style, {
    width: `${HUD_COLLAPSED_SIZE_PX}px`,
    height: `${HUD_COLLAPSED_SIZE_PX}px`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } satisfies Partial<CSSStyleDeclaration>);
  badge.innerHTML = MOBIUS_LOGO_SVG;

  const log = document.createElement("div");
  Object.assign(log.style, {
    display: "none",
    flexDirection: "column",
    gap: "4px",
    padding: "8px 10px",
    height: `${HUD_EXPANDED_HEIGHT_PX - HUD_COLLAPSED_SIZE_PX}px`,
    overflowY: "auto",
  } satisfies Partial<CSSStyleDeclaration>);

  container.append(badge, log);
  root.appendChild(container);

  let expanded = false;

  function setExpanded(next: boolean) {
    expanded = next;
    container.style.width = expanded ? `${HUD_EXPANDED_WIDTH_PX}px` : `${HUD_COLLAPSED_SIZE_PX}px`;
    container.style.height = expanded ? `${HUD_EXPANDED_HEIGHT_PX}px` : `${HUD_COLLAPSED_SIZE_PX}px`;
    log.style.display = expanded ? "flex" : "none";
  }

  container.addEventListener("click", () => setExpanded(!expanded));

  return {
    element: container,
    log(message: string) {
      const entry = document.createElement("div");
      entry.style.color = CURSOR_GLOW_COLOR;
      entry.textContent = `${new Date().toLocaleTimeString()} — ${message}`;
      log.appendChild(entry);
      while (log.childElementCount > HUD_MAX_LOG_ENTRIES) log.removeChild(log.firstChild as ChildNode);
      log.scrollTop = log.scrollHeight;
    },
    setExpanded,
  };
}
