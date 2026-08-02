import {
  CURSOR_SIZE_PX,
  CURSOR_MOVE_MS,
  CURSOR_MOVE_EASING,
  CURSOR_COLOR,
  CURSOR_GLOW_SIZE_PX,
  CURSOR_GLOW_OPACITY,
  CURSOR_GLOW_GRADIENT,
  CURSOR_ICON_PATHS,
  CURSOR_VIEW_BOX,
  type CursorIconKey,
} from "./data.js";
import type { CursorPoint } from "./types.js";

export interface CursorHandle {
  element: HTMLElement;
  moveTo(point: CursorPoint, icon?: CursorIconKey): void;
  show(): void;
  hide(): void;
}

function translate({ x, y }: CursorPoint): string {
  return `translate(${x - CURSOR_SIZE_PX / 2}px, ${y - CURSOR_SIZE_PX / 2}px)`;
}

export function createCursor(root: ShadowRoot): CursorHandle {
  const element = document.createElement("div");
  Object.assign(element.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: `${CURSOR_SIZE_PX}px`,
    height: `${CURSOR_SIZE_PX}px`,
    zIndex: "2147483647",
    pointerEvents: "none",
    transform: "translate(-9999px, -9999px)",
    opacity: "0",
  } satisfies Partial<CSSStyleDeclaration>);

  const glow = document.createElement("div");
  Object.assign(glow.style, {
    position: "absolute",
    zIndex: "0",
    left: "50%",
    top: "50%",
    width: `${CURSOR_GLOW_SIZE_PX}px`,
    height: `${CURSOR_GLOW_SIZE_PX}px`,
    marginLeft: `${-CURSOR_GLOW_SIZE_PX / 2}px`,
    marginTop: `${-CURSOR_GLOW_SIZE_PX / 2}px`,
    borderRadius: "50%",
    background: CURSOR_GLOW_GRADIENT,
    opacity: `${CURSOR_GLOW_OPACITY}`,
    pointerEvents: "none",
  } satisfies Partial<CSSStyleDeclaration>);

  const svg = document.createElement("div");
  Object.assign(svg.style, {
    position: "absolute",
    zIndex: "1",
    top: "0",
    left: "0",
    width: `${CURSOR_SIZE_PX}px`,
    height: `${CURSOR_SIZE_PX}px`,
  } satisfies Partial<CSSStyleDeclaration>);
  svg.innerHTML = `<svg viewBox="${CURSOR_VIEW_BOX}" width="${CURSOR_SIZE_PX}" height="${CURSOR_SIZE_PX}" style="position:absolute;top:0;left:0;overflow:visible">
    <path d="${CURSOR_ICON_PATHS.click}" fill="${CURSOR_COLOR}"/>
  </svg>`;
  const solidPath = svg.querySelector("path") as SVGPathElement;

  element.append(glow, svg);
  root.appendChild(element);

  let current: CursorPoint | undefined;
  let animation: Animation | undefined;

  return {
    element,
    moveTo(point, icon) {
      if (icon) solidPath.setAttribute("d", CURSOR_ICON_PATHS[icon]);

      const to = translate(point);
      animation?.cancel();

      if (!current) {
        element.style.transform = to;
        current = point;
        return;
      }

      animation = element.animate([{ transform: translate(current) }, { transform: to }], {
        duration: CURSOR_MOVE_MS,
        easing: CURSOR_MOVE_EASING,
        fill: "forwards",
      });
      element.style.transform = to;
      current = point;
    },
    show() {
      element.style.opacity = "1";
    },
    hide() {
      element.style.opacity = "0";
    },
  };
}
