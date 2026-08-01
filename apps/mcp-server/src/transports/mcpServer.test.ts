import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { ToolDef } from "../types.js";

function recordTool(defs: Map<string, ToolDef>, name: string, schema: z.ZodRawShape, handler: (args: unknown) => Promise<unknown>): void {
  const validator = z.object(schema);
  defs.set(name, { description: "", schema, parse: (args) => validator.parse(args ?? {}), handler });
}

describe("ToolDef.parse", () => {
  it("applies zod defaults that the SDK would otherwise have applied", () => {
    const defs = new Map<string, ToolDef>();
    recordTool(defs, "click", { button: z.enum(["left", "right"]).default("left"), clickCount: z.number().int().default(1) }, async (a) => a);

    expect(defs.get("click")!.parse({})).toEqual({ button: "left", clickCount: 1 });
  });

  it("applies the nested observe default so windowMs is never undefined", () => {
    const defs = new Map<string, ToolDef>();
    const observeSchema = z.object({ windowMs: z.number().int().positive().max(10_000).default(1500) }).optional();
    recordTool(defs, "click", { observe: observeSchema }, async (a) => a);

    expect(defs.get("click")!.parse({ observe: {} })).toEqual({ observe: { windowMs: 1500 } });
  });

  it("rejects arguments of the wrong type instead of forwarding them", () => {
    const defs = new Map<string, ToolDef>();
    recordTool(defs, "click", { clickCount: z.number().int() }, async (a) => a);

    expect(() => defs.get("click")!.parse({ clickCount: "three" })).toThrow();
  });

  it("tolerates a missing args object", () => {
    const defs = new Map<string, ToolDef>();
    recordTool(defs, "list_tabs", {}, async (a) => a);

    expect(defs.get("list_tabs")!.parse(undefined)).toEqual({});
  });
});
