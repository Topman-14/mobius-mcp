export interface RedactionOptions {
  redactHeaders: boolean;
  redactCookies: boolean;
  redactLocalStorage: boolean;
  maskEmails: boolean;
  maskJwts: boolean;
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const JWT_RE = /\b[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const SENSITIVE_HEADER_RE = /^(authorization|cookie|set-cookie|x-api-key)$/i;

function maskText(value: string, options: RedactionOptions): string {
  let result = value;
  if (options.maskJwts) result = result.replace(JWT_RE, "[redacted-jwt]");
  if (options.maskEmails) result = result.replace(EMAIL_RE, "[redacted-email]");
  return result;
}

/** Applied to a captured event's already-serialized text fields right before emit — never adds new fields. */
export function redactText(value: string, options: RedactionOptions): string {
  return maskText(value, options);
}

export function redactHeaderValue(headerName: string, value: string, options: RedactionOptions): string {
  if (options.redactHeaders && SENSITIVE_HEADER_RE.test(headerName)) return "[redacted]";
  return maskText(value, options);
}

export function redactCookieString(value: string, options: RedactionOptions): string {
  return options.redactCookies ? "[redacted]" : maskText(value, options);
}
