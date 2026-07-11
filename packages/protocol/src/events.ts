export interface EventBase {
  id: string;
  seq: number;
  clientId: string;
  timestamp: number;
  url: string;
  metadata?: Record<string, unknown>;
}

export interface ConsoleEvent extends EventBase {
  type: "console.log" | "console.info" | "console.warn" | "console.error";
  message: string;
  args?: unknown[];
}

export interface RuntimeErrorEvent extends EventBase {
  type: "window.onerror";
  message: string;
  stack?: string;
  source?: string;
  lineno?: number;
  colno?: number;
}

export interface UnhandledRejectionEvent extends EventBase {
  type: "unhandledrejection";
  reason: string;
  stack?: string;
}

export interface NetworkEvent extends EventBase {
  type: "network.fetch" | "network.xhr";
  method: string;
  requestUrl: string;
  status?: number;
  durationMs?: number;
  error?: string;
}

export type BrowserEvent = ConsoleEvent | RuntimeErrorEvent | UnhandledRejectionEvent | NetworkEvent;

export type EventType = BrowserEvent["type"];

export interface ClientInfo {
  clientId: string;
  clientType: "extension" | "npm-client";
  pageUrl: string;
  title?: string;
  connectedAt: number;
}
