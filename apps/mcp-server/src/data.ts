import * as os from "node:os";
import * as path from "node:path";
import { createRequire } from "node:module";
import type { ClientInfo, EventType } from "@mobius-mcp/capture-core";

export const WS_PORT_DEFAULT = 7331;

// Tags the extension's tab-independent client (background.ts) — must be excluded via
// isTabClient wherever "connected tabs" are enumerated, or it inflates tab counts.
export const BROWSER_CONTROL_CAPABILITY = "browser-control";

export function isTabClient(c: ClientInfo): boolean {
  return !c.capabilities.includes(BROWSER_CONTROL_CAPABILITY);
}

// Literal loopback, not "localhost" — its DNS resolution can non-deterministically return
// 127.0.0.1 or ::1, letting two processes both bind without ever hitting EADDRINUSE.
export const WS_HOST = "127.0.0.1";

// Read from package.json rather than build-time-inlined, so `npm run start` from source is correct too, not just tsup builds.
const { version } = createRequire(import.meta.url)("../package.json") as { version: string };
export const VERSION = version;

// utils/har.ts's HAR 1.2 "creator" field.
export const HAR_CREATOR_NAME = "mobius-mcp";
export const HAR_CREATOR_VERSION = VERSION;

export const CLIENT_PURGE_DELAY_MS = Number(process.env.CONSOLE_STREAM_PURGE_DELAY_MS) || 5 * 60 * 1000;

// Crash/restart durability (see services/persistence.ts) — a temp-dir JSONL file per tab, replayed on boot and reaped on an interval. TTL configurable by whoever launches
export const PERSISTENCE_DIR = process.env.CONSOLE_STREAM_PERSISTENCE_DIR || path.join(os.tmpdir(), "mobius-mcp", "events");
export const PERSISTENCE_TTL_MS = Number(process.env.CONSOLE_STREAM_PERSISTENCE_TTL_MS) || 60 * 60 * 1000;
export const PERSISTENCE_PRUNE_INTERVAL_MS = Math.min(Math.max(PERSISTENCE_TTL_MS / 4, 60_000), 10 * 60_000);
export const MAX_EVENTS_PER_TAB = Number(process.env.CONSOLE_STREAM_MAX_EVENTS_PER_TAB) || 3000;
export const MAX_EVENT_FIELD_LENGTH = 10_000;

export const TRUNCATABLE_EVENT_FIELDS: ReadonlyArray<readonly [field: string, flagField: string]> = [
  ["message", "messageTruncated"],
  ["stack", "stackTruncated"],
  ["reason", "reasonTruncated"],
  ["requestBody", "requestBodyTruncated"],
  ["responseBody", "responseBodyTruncated"],
];

export const DEFAULT_COMMAND_TIMEOUT_MS = 10_000;
export const CONTROL_REQUEST_TIMEOUT_MS = 15_000;

export const CONSOLE_TYPES: EventType[] = ["console.log", "console.info", "console.warn"];
export const ERROR_TYPES: EventType[] = ["console.error", "window.onerror", "unhandledrejection"];
export const NETWORK_TYPES: EventType[] = ["network.fetch", "network.xhr"];
export const NAVIGATION_TYPES: EventType[] = ["navigation"];
export const DOM_TYPES: EventType[] = ["dom.mutation"];

export const EVENT_CATEGORIES: Record<string, EventType[]> = {
  console: [...CONSOLE_TYPES, ...ERROR_TYPES],
  network: NETWORK_TYPES,
  navigation: NAVIGATION_TYPES,
  dom: DOM_TYPES,
};
