import { describe, expect, it } from "vitest";
import type { BrowserEvent } from "@mobius-mcp/capture-core";
import { EventStore } from "../../src/services/store.js";

function addConsole(store: EventStore, clientId: string, message: string): BrowserEvent {
  return store.addEvent({ id: "", clientId, type: "console.log", timestamp: Date.now(), message } as unknown as Omit<BrowserEvent, "seq">);
}

function addNavigation(store: EventStore, clientId: string, url: string): BrowserEvent {
  return store.addEvent({ id: "", clientId, type: "navigation", timestamp: Date.now(), url } as unknown as Omit<BrowserEvent, "seq">);
}

describe("EventStore.getSince", () => {
  it("does not rewind the cursor past events a type filter excluded", () => {
    const store = new EventStore();
    addNavigation(store, "tab", "/a");
    addConsole(store, "tab", "noise");
    addConsole(store, "tab", "more noise");

    const first = store.getSince("tab", 0, { types: ["navigation"] });
    expect(first.events).toHaveLength(1);

    addConsole(store, "tab", "even more noise");
    const second = store.getSince("tab", first.cursor, { types: ["navigation"] });
    expect(second.events).toEqual([]);
  });

  it("returns each event exactly once across successive polls", () => {
    const store = new EventStore();
    addConsole(store, "tab", "one");
    addConsole(store, "tab", "two");

    const first = store.getSince("tab", 0);
    expect(first.events.map((e) => (e as { message: string }).message)).toEqual(["one", "two"]);

    addConsole(store, "tab", "three");
    const second = store.getSince("tab", first.cursor);
    expect(second.events.map((e) => (e as { message: string }).message)).toEqual(["three"]);
  });

  it("keeps the caller's cursor when nothing new arrived", () => {
    const store = new EventStore();
    addConsole(store, "tab", "one");
    const first = store.getSince("tab", 0);
    expect(store.getSince("tab", first.cursor).cursor).toBe(first.cursor);
  });

  it("honours limit and reports a cursor covering only what it returned", () => {
    const store = new EventStore();
    addConsole(store, "tab", "one");
    addConsole(store, "tab", "two");
    addConsole(store, "tab", "three");

    const page = store.getSince("tab", 0, { limit: 2 });
    expect(page.events).toHaveLength(2);
    expect(store.getSince("tab", page.cursor).events).toHaveLength(1);
  });

  it("isolates buffers per client", () => {
    const store = new EventStore();
    addConsole(store, "a", "for a");
    addConsole(store, "b", "for b");
    expect(store.getSince("a", 0).events).toHaveLength(1);
    expect(store.getSince("b", 0).events).toHaveLength(1);
  });
});
