import { buildSnapshot } from "./walk.js";
import { resolveRef } from "./registry.js";

// Exposed for CDP `Runtime.evaluate` to call (background.ts's "snapshot_page" command) — the
// same in-page-eval mechanism `evaluate_js`/`capture_dom` already use.
declare global {
  interface Window {
    __mobiusSnapshot?: {
      capture: typeof buildSnapshot;
      resolveRef: typeof resolveRef;
    };
  }
}

window.__mobiusSnapshot = { capture: buildSnapshot, resolveRef };
