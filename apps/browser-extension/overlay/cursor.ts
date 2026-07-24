import { CURSOR_SIZE_PX, CURSOR_MOVE_MS, CURSOR_COLOR, CURSOR_GLOW_COLOR, CURSOR_SPARKLE_PATH } from "./data.js";
import type { CursorPoint } from "./types.js";

export interface CursorHandle {
  element: HTMLElement;
  moveTo(point: CursorPoint): void;
  show(): void;
  hide(): void;
}

export function createCursor(root: ShadowRoot): CursorHandle {
  const element = document.createElement("div");
  element.innerHTML = `<svg viewBox="0 0 24 24" width="${CURSOR_SIZE_PX}" height="${CURSOR_SIZE_PX}"><path d="${CURSOR_SPARKLE_PATH}" fill="${CURSOR_COLOR}"/></svg>`;
  Object.assign(element.style, {
    position: "fixed",
    top: "0",
    left: "0",
    zIndex: "2147483647",
    pointerEvents: "none",
    transform: "translate(-9999px, -9999px)",
    transition: `transform ${CURSOR_MOVE_MS}ms ease-in-out`,
    filter: `drop-shadow(0 0 4px ${CURSOR_GLOW_COLOR}) drop-shadow(0 0 10px ${CURSOR_GLOW_COLOR})`,
    opacity: "0",
  } satisfies Partial<CSSStyleDeclaration>);
  root.appendChild(element);

  return {
    element,
    moveTo({ x, y }) {
      element.style.transform = `translate(${x - CURSOR_SIZE_PX / 2}px, ${y - CURSOR_SIZE_PX / 2}px)`;
    },
    show() {
      element.style.opacity = "1";
    },
    hide() {
      element.style.opacity = "0";
    },
  };
}
