export type {
  BrowserEvent,
  CaptureSettings,
  CaptureStartOptions,
  CapturedEvent,
  ClientInfo,
  ClientMessage,
  CommandMessage,
  ControlMessage,
  EventType,
  PageSnapshot,
  RedactionOptions,
  ServerMessage,
  SnapshotBox,
  SnapshotElement,
} from "./types.ts";
export { DEFAULT_REDACTED_HEADER_NAMES, DEFAULT_REDACTION, PROTOCOL_VERSION } from "./data.ts";
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
