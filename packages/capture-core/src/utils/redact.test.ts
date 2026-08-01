import { describe, expect, it } from "vitest";
import { DEFAULT_REDACTION } from "../data.ts";
import { redactBodyText, redactHeaderValue, redactText } from "./redact.ts";

describe("redactHeaderValue", () => {
  it("redacts the default sensitive headers case-insensitively", () => {
    expect(redactHeaderValue("Authorization", "Bearer abc", DEFAULT_REDACTION)).toBe("[redacted]");
    expect(redactHeaderValue("COOKIE", "session=1", DEFAULT_REDACTION)).toBe("[redacted]");
  });

  it("leaves unlisted headers alone", () => {
    expect(redactHeaderValue("content-type", "application/json", DEFAULT_REDACTION)).toBe("application/json");
  });

  it("keeps the header present so absence stays detectable", () => {
    expect(redactHeaderValue("authorization", "Bearer abc", DEFAULT_REDACTION)).not.toBe("");
  });
});

describe("redactBodyText", () => {
  it("masks sensitive keys at any depth in a JSON body", () => {
    const body = JSON.stringify({ user: { email: "a@b.com", password: "hunter2" }, items: [{ api_key: "k" }] });
    const result = JSON.parse(redactBodyText(body, "application/json", DEFAULT_REDACTION));

    expect(result.user.password).toBe("[redacted]");
    expect(result.items[0].api_key).toBe("[redacted]");
  });

  it("preserves non-sensitive values", () => {
    const body = JSON.stringify({ id: 7, name: "widget" });
    expect(JSON.parse(redactBodyText(body, "application/json", DEFAULT_REDACTION))).toEqual({ id: 7, name: "widget" });
  });

  it("returns unparseable JSON unchanged rather than dropping the body", () => {
    expect(redactBodyText("{not json", "application/json", DEFAULT_REDACTION)).toBe("{not json");
  });

  it("skips key masking for non-JSON content types", () => {
    const body = "password=hunter2";
    expect(redactBodyText(body, "text/plain", DEFAULT_REDACTION)).toBe(body);
  });
});

describe("redactText", () => {
  it("masks JWTs when enabled", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc123";
    expect(redactText(`token ${jwt}`, DEFAULT_REDACTION)).toContain("[redacted-jwt]");
  });

  it("leaves emails alone under the default options", () => {
    expect(redactText("mail a@b.com", DEFAULT_REDACTION)).toContain("a@b.com");
  });
});
