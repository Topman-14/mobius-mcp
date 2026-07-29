import type { BodyCapture } from "../types.ts";

const MAX_BODY_CHARS = 20_000;

// Above this, .text() on a response clone buffers far more than the ~20KB we keep —
// skip capture entirely rather than hold megabytes in memory just to truncate them.
const MAX_CAPTURABLE_RESPONSE_BYTES = 2_000_000;

const CAPTURABLE_CONTENT_TYPE_RE = /^(text\/|application\/(json|.*\+json|xml|x-www-form-urlencoded|graphql))/i;

export function isCapturableContentType(mimeType: string | undefined): boolean {
  if (!mimeType) return true;
  // SSE streams never resolve .text() — reading one buffers forever.
  if (/^text\/event-stream/i.test(mimeType)) return false;
  return CAPTURABLE_CONTENT_TYPE_RE.test(mimeType);
}

export function exceedsBodyCaptureLimit(contentLength: string | undefined): boolean {
  const bytes = Number(contentLength);
  return Number.isFinite(bytes) && bytes > MAX_CAPTURABLE_RESPONSE_BYTES;
}

export function capBody(text: string): { body: string; truncated: boolean } {
  if (text.length <= MAX_BODY_CHARS) return { body: text, truncated: false };
  return { body: text.slice(0, MAX_BODY_CHARS), truncated: true };
}

export function captureRequestBodyValue(raw: unknown): BodyCapture {
  if (raw === undefined || raw === null) return {};
  if (typeof raw === "string") return capBody(raw);
  if (raw instanceof URLSearchParams) return capBody(raw.toString());
  if (raw instanceof FormData) return { omittedReason: "FormData bodies aren't captured (may contain files)" };
  if (raw instanceof Blob) return { omittedReason: "Blob/File request bodies aren't captured" };
  if (raw instanceof ArrayBuffer || ArrayBuffer.isView(raw as ArrayBufferView)) return { omittedReason: "binary request body" };
  return { omittedReason: "unsupported request body type" };
}

export async function readBodyText(source: { clone: () => { text: () => Promise<string> } }, contentType: string | undefined): Promise<BodyCapture> {
  if (!isCapturableContentType(contentType)) return { omittedReason: "non-text content-type" };
  try {
    const text = await source.clone().text();
    return capBody(text);
  } catch {
    return { omittedReason: "failed to read body" };
  }
}
