import { ConsoleMethod, type ProtocolVersion, type RedactionOptions } from "./types.ts";

// 2: Stage H's snapshot_page command shipped alongside this bump (ROADMAP.md) — a stale
// extension build predates the page-snapshot walker it would need to serve it.
export const PROTOCOL_VERSION: ProtocolVersion = 2;

export const DEFAULT_REDACTION: RedactionOptions = {
  redactedHeaderNames: [],
  maskEmails: false,
  maskJwts: false,
  redactSensitiveBodyFields: false,
};

export const CONSOLE_METHODS = Object.values(ConsoleMethod);
