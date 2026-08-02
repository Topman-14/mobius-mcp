import { describe, expect, it } from "vitest";
import { parseQuery, scoreCandidate, tokenize } from "./score.ts";

const score = (query: string, name: string, role: string, interactive = true) => scoreCandidate(parseQuery(query), name, role, interactive);

describe("tokenize", () => {
  it("drops stop words and punctuation", () => {
    expect(tokenize("the Sign up for a Newsletter!")).toEqual(["sign", "up", "newsletter"]);
  });
});

describe("scoreCandidate", () => {
  it("ranks an exact accessible-name match above a partial one", () => {
    expect(score("accept cookies", "Accept cookies", "button")).toBeGreaterThan(score("accept cookies", "Accept all cookies and tracking", "button"));
  });

  it("prefers the role the query names", () => {
    expect(score("pricing link", "Pricing", "link")).toBeGreaterThan(score("pricing link", "Pricing", "heading"));
  });

  it("maps field/input/bar vocabulary onto textbox", () => {
    expect(score("search bar", "Search", "textbox")).toBeGreaterThan(score("search bar", "Search", "button"));
    expect(score("email field", "Email address", "textbox")).toBeGreaterThan(score("email field", "Email address", "link"));
  });

  it("scores an unrelated element at or below the cutoff", () => {
    expect(score("checkout button", "Company history", "paragraph", false)).toBeLessThan(1);
  });

  it("still matches when the query omits a role word", () => {
    expect(score("newsletter signup", "Newsletter signup", "textbox")).toBeGreaterThan(1);
  });

  it("does not let a long name outrank a tight one on the same tokens", () => {
    const tight = score("submit", "Submit", "button");
    const verbose = score("submit", "Submit your application to our hiring team today", "button");
    expect(tight).toBeGreaterThan(verbose);
  });
});
