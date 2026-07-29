import {
  CURSOR_SIZE_PX,
  CURSOR_MOVE_MS,
  CURSOR_COLOR,
  CURSOR_GLOW_COLOR,
  CURSOR_SPARKLE_PATH,
  CURSOR_VIEW_BOX,
} from "./data.js";
import type { CursorPoint } from "./types.js";

export interface CursorHandle {
  element: HTMLElement;
  moveTo(point: CursorPoint): void;
  show(): void;
  hide(): void;
}

export function createCursor(root: ShadowRoot): CursorHandle {
  const element = document.createElement("div");
  // A blurred glow copy sits behind the solid icon rather than relying on `drop-shadow`
  // alone — `drop-shadow` traces the glyph's exact silhouette, which reads as a thin halo
  // for a dense filled shape instead of a soft glow underneath it.
  element.innerHTML = `<svg viewBox="${CURSOR_VIEW_BOX}" width="${CURSOR_SIZE_PX}" height="${CURSOR_SIZE_PX}" style="position:absolute;top:0;left:0;overflow:visible">
    <path d="${CURSOR_SPARKLE_PATH}" fill="${CURSOR_GLOW_COLOR}" style="filter:blur(6px)" opacity="0.85"/>
    <path d="${CURSOR_SPARKLE_PATH}" fill="${CURSOR_COLOR}"/>
  </svg>`;
  Object.assign(element.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: `${CURSOR_SIZE_PX}px`,
    height: `${CURSOR_SIZE_PX}px`,
    zIndex: "2147483647",
    pointerEvents: "none",
    transform: "translate(-9999px, -9999px)",
    transition: `transform ${CURSOR_MOVE_MS}ms ease-in-out`,
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
