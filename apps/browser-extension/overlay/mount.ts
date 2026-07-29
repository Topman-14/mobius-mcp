import { OVERLAY_HOST_ID } from "./data.js";
import { createCursor } from "./cursor.js";
import { createHud } from "./hud.js";
import type { OverlayApi } from "./types.js";

declare global {
  interface Window {
    __mobiusOverlay?: OverlayApi;
  }
}

// Lazy — most page loads never drive, so don't pay for a shadow root and two DOM
// trees on every navigation. First call to any OverlayApi method mounts it.
let api: OverlayApi | undefined;

function mount(): OverlayApi {
  const host = document.createElement("div");
  host.id = OVERLAY_HOST_ID;
  const root = host.attachShadow({ mode: "closed" });
  document.documentElement.appendChild(host);

  const cursor = createCursor(root);
  const hud = createHud(root);

  return {
    moveCursorTo(point) {
      cursor.show();
      cursor.moveTo(point);
    },
    showCursor: cursor.show,
    hideCursor: cursor.hide,
    hudLog: hud.log,
    setHudExpanded: hud.setExpanded,
  };
}

export function getOverlay(): OverlayApi {
  if (!api) api = mount();
  return api;
}

window.__mobiusOverlay = {
  moveCursorTo: (point) => getOverlay().moveCursorTo(point),
  showCursor: () => getOverlay().showCursor(),
  hideCursor: () => getOverlay().hideCursor(),
  hudLog: (message) => getOverlay().hudLog(message),
  setHudExpanded: (expanded) => getOverlay().setHudExpanded(expanded),
};
