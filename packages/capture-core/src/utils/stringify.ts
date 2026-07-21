export function safeStringify(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (value instanceof Error) return value.message;
  if (typeof value !== "object") return String(value);

  const seen = new WeakSet<object>();
  try {
    const json = JSON.stringify(value, (_key, val) => {
      if (typeof val === "bigint") return val.toString();
      if (typeof val === "object" && val !== null) {
        if (seen.has(val)) return "[Circular]";
        seen.add(val);
      }
      return val;
    });
    if (json !== undefined) return json;
  } catch {}

  try {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, val]) => `${key}: ${typeof val === "object" && val !== null ? "[object]" : String(val)}`);
    return `{ ${entries.join(", ")} }`;
  } catch {
    return Object.prototype.toString.call(value);
  }
}
