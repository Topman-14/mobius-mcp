import { ConsoleMethod, type ProtocolVersion, type RedactionOptions } from "./types.ts";

// 3: keepalive ping/pong message kinds, plus clientId now outliving navigation — a stale
// extension build retires its clientId on every page load, orphaning the server's buffer.
export const PROTOCOL_VERSION: ProtocolVersion = 3;

export const DEFAULT_REDACTED_HEADER_NAMES = ["authorization", "cookie", "set-cookie", "proxy-authorization", "x-api-key"];

export const DEFAULT_REDACTION: RedactionOptions = {
  redactedHeaderNames: DEFAULT_REDACTED_HEADER_NAMES,
  maskEmails: false,
  maskJwts: true,
  redactSensitiveBodyFields: true,
};

export const CONSOLE_METHODS = Object.values(ConsoleMethod);
