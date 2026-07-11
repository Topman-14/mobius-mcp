export type EventType =
  | "console.log"
  | "console.info"
  | "console.warn"
  | "console.error"
  | "window.onerror"
  | "unhandledrejection"
  | "network.fetch"
  | "network.xhr";

export interface BaseEvent {
  type: EventType;
  timestamp: number;
  url: string;
  metadata?: Record<string, unknown>;
}
