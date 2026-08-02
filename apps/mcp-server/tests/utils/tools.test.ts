import { describe, expect, it } from "vitest";
import type { ClientInfo } from "@mobius-mcp/capture-core";
import { ClientRegistry } from "../../src/services/registry.js";
import type { ToolContent } from "../../src/types.js";
import { resolveTabId } from "../../src/utils/tools.js";

const socket = { readyState: 1 } as never;

function registryWith(...clients: Array<Partial<ClientInfo> & { clientId: string }>): ClientRegistry {
  const registry = new ClientRegistry();
  for (const client of clients) {
    registry.register(
      { clientType: "extension", pageUrl: "http://localhost", capabilities: ["cdp"], connectedAt: Date.now(), ...client } as ClientInfo,
      socket,
    );
  }
  return registry;
}

function errorText(resolution: { error: ToolContent } | { clientId: string }): string {
  if (!("error" in resolution)) throw new Error("expected an error resolution");
  const [block] = resolution.error.content;
  return block.type === "text" ? block.text : "";
}

describe("resolveTabId", () => {
  it("errors on an unknown explicit tabId instead of passing it through", () => {
    const resolution = resolveTabId(registryWith({ clientId: "connected" }), undefined, "ghost");
    expect(errorText(resolution)).toContain("No connected tab with id ghost");
  });

  it("auto-selects when exactly one tab is connected", () => {
    const resolution = resolveTabId(registryWith({ clientId: "only" }), undefined);
    expect(resolution).toEqual({ clientId: "only" });
  });

  it("errors rather than guessing when several tabs are connected", () => {
    const resolution = resolveTabId(registryWith({ clientId: "a" }, { clientId: "b" }), undefined);
    expect(errorText(resolution)).toContain("Multiple tabs connected");
  });

  it("prefers the session's active tab over auto-selection", () => {
    const resolution = resolveTabId(registryWith({ clientId: "a" }, { clientId: "b" }), "b");
    expect(resolution).toEqual({ clientId: "b" });
  });

  it("falls back to chromeTabId when the explicit tabId is stale", () => {
    const registry = registryWith({ clientId: "current", chromeTabId: 42 });
    expect(resolveTabId(registry, undefined, "stale", 42)).toEqual({ clientId: "current" });
  });

  it("ignores the browser-control client when counting connected tabs", () => {
    const registry = registryWith({ clientId: "control", capabilities: ["browser-control"] }, { clientId: "tab" });
    expect(resolveTabId(registry, undefined)).toEqual({ clientId: "tab" });
  });
});
