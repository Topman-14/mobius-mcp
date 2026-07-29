export type {
  BrowserEvent,
  CaptureSettings,
  CaptureStartOptions,
  CapturedEvent,
  ClientInfo,
  ClientMessage,
  ControlMessage,
  EventType,
  PageSnapshot,
  RedactionOptions,
  ServerMessage,
  SnapshotBox,
  SnapshotElement,
} from "./types.ts";
export { PROTOCOL_VERSION } from "./data.ts";
export {
  isProtocolVersionSupported
} from "./utils/protocol.ts";
export {
  patchConsole,
  patchGlobalErrors,
  patchNetwork,
  patchNavigation,
  patchDomMutations,
  startCapture,
} from "./main.ts";
