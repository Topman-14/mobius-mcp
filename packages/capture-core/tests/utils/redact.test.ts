import { describe, expect, it } from "vitest";
import { DEFAULT_REDACTION } from "../../src/data.ts";
import { redactBodyText, redactHeaderValue, redactText } from "../../src/utils/redact.ts";

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

  it.each([
    ["hostnames", "https://fonts.googleapis.com/css2?family=Roboto"],
    ["property chains", "document.documentElement.classList.add('dark')"],
    ["namespace URLs", "http://www.w3.org/2000/svg"],
    ["version strings", "vitest 3.2.4 installed"],
    ["SVG path data", "M16.41 5.41L15 4l-8 8 8 8 1.41-1.41L9.83 12"],
  ])("does not mistake %s for a JWT", (_label, text) => {
    expect(redactText(text, DEFAULT_REDACTION)).toBe(text);
  });

  it("still masks a JWT embedded in surrounding text", () => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
    expect(redactText(`Bearer ${jwt} done`, DEFAULT_REDACTION)).toBe("Bearer [redacted-jwt] done");
  });
});

describe("redactBodyText JWT handling", () => {
  it("masks a JWT held under a non-sensitive key", () => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
    const result = JSON.parse(redactBodyText(JSON.stringify({ data: jwt }), "application/json", DEFAULT_REDACTION));

    expect(result.data).toBe("[redacted-jwt]");
  });

  it("leaves hostnames in a JSON body intact", () => {
    const body = JSON.stringify({ src: "https://fonts.googleapis.com/css2" });
    expect(JSON.parse(redactBodyText(body, "application/json", DEFAULT_REDACTION)).src).toBe("https://fonts.googleapis.com/css2");
  });
});
