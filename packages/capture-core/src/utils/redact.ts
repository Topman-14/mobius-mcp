import type { RedactionOptions } from "../types.ts";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const JWT_RE = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g;
const SENSITIVE_BODY_KEY_RE = /^(password|passwd|pwd|token|access_?token|refresh_?token|secret|api[_-]?key|authorization|auth|ssn|social_security(_number)?|credit_?card(_?number)?|card_?number|cvv|cvc|pin)$/i;

function maskText(value: string, options: RedactionOptions): string {
  let result = value;
  if (options.maskJwts) result = result.replace(JWT_RE, "[redacted-jwt]");
  if (options.maskEmails) result = result.replace(EMAIL_RE, "[redacted-email]");
  return result;
}

export function redactText(value: string, options: RedactionOptions): string {
  return maskText(value, options);
}

export function redactHeaderValue(headerName: string, value: string, options: RedactionOptions): string {
  if (options.redactedHeaderNames.some((name) => name.toLowerCase() === headerName.toLowerCase())) return "[redacted]";
  return maskText(value, options);
}

function maskJsonValue(value: unknown, options: RedactionOptions): unknown {
  if (Array.isArray(value)) return value.map((item) => maskJsonValue(item, options));
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = SENSITIVE_BODY_KEY_RE.test(key) ? "[redacted]" : maskJsonValue(val, options);
    }
    return result;
  }
  if (typeof value === "string") return maskText(value, options);
  return value;
}

export function redactBodyText(value: string, contentType: string | undefined, options: RedactionOptions): string {
  if (!options.redactSensitiveBodyFields || !contentType || !/json/i.test(contentType)) return maskText(value, options);
  try {
    return JSON.stringify(maskJsonValue(JSON.parse(value), options));
  } catch {
    return maskText(value, options);
  }
}
