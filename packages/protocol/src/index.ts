import type { BaseEvent } from "@console-stream-mcp/shared-types";

export const PROTOCOL_VERSION = 1;

export interface ProtocolMessage {
  version: typeof PROTOCOL_VERSION;
  event: BaseEvent;
}
