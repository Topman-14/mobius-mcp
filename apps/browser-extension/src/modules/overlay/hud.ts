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
    gap: "8px",
    flexShrink: "0",
  } satisfies Partial<CSSStyleDeclaration>);

  const mark = document.createElement("div");
  Object.assign(mark.style, {
    width: `${HUD_COLLAPSED_SIZE_PX}px`,
    height: `${HUD_COLLAPSED_SIZE_PX}px`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: "0",
  } satisfies Partial<CSSStyleDeclaration>);
  mark.innerHTML = MOBIUS_LOGO_SVG;

  const wordmark = document.createElement("span");
  wordmark.textContent = "Mobius";
  Object.assign(wordmark.style, {
    display: "none",
    color: CURSOR_GLOW_COLOR,
    fontSize: "13px",
    fontWeight: "600",
    letterSpacing: "0.04em",
  } satisfies Partial<CSSStyleDeclaration>);

  badge.append(mark, wordmark);

  const log = document.createElement("div");
  Object.assign(log.style, {
    display: "none",
    flexDirection: "column",
    gap: "4px",
    padding: "8px 10px",
    height: `${HUD_EXPANDED_HEIGHT_PX - HUD_COLLAPSED_SIZE_PX}px`,
    overflowY: "auto",
  } satisfies Partial<CSSStyleDeclaration>);

  const empty = document.createElement("div");
  empty.textContent = "Waiting for activity — clicks, typing and navigation driven by mobius will appear here.";
  Object.assign(empty.style, {
    color: "#8a8a8a",
    fontSize: "11px",
    lineHeight: "1.5",
    fontStyle: "italic",
  } satisfies Partial<CSSStyleDeclaration>);
  log.appendChild(empty);

  container.append(badge, log);
  root.appendChild(container);

  let expanded = false;

  function setExpanded(next: boolean) {
    expanded = next;
    container.style.width = expanded ? `${HUD_EXPANDED_WIDTH_PX}px` : `${HUD_COLLAPSED_SIZE_PX}px`;
    container.style.height = expanded ? `${HUD_EXPANDED_HEIGHT_PX}px` : `${HUD_COLLAPSED_SIZE_PX}px`;
    badge.style.width = expanded ? "100%" : `${HUD_COLLAPSED_SIZE_PX}px`;
    badge.style.justifyContent = expanded ? "flex-start" : "center";
    wordmark.style.display = expanded ? "block" : "none";
    log.style.display = expanded ? "flex" : "none";
  }

  container.addEventListener("click", () => setExpanded(!expanded));

  return {
    element: container,
    log(message: string) {
      empty.remove();
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
