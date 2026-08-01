import { describe, expect, it } from "vitest";
import type { BrowserEvent } from "@mobius-mcp/capture-core";
import { toHar, type HarBodyFetcher } from "./har.js";

function networkEvent(overrides: Record<string, unknown> = {}): BrowserEvent {
  return {
    id: "1",
    seq: 1,
    clientId: "tab",
    type: "network.fetch",
    timestamp: Date.now(),
    method: "GET",
    requestUrl: "https://api.test/items",
    status: 200,
    statusText: "OK",
    durationMs: 12,
    ...overrides,
  } as unknown as BrowserEvent;
}

const fetcher: HarBodyFetcher = {
  fetchRequestBody: async () => ({ text: "full request" }),
  fetchResponseBody: async () => ({ text: "full response" }),
};

describe("toHar", () => {
  it("includes only network events", async () => {
    const har = await toHar([networkEvent(), { type: "console.log" } as BrowserEvent]);
    expect(har.log.entries).toHaveLength(1);
  });

  it("re-fetches a body the inline capture truncated", async () => {
    const har = await toHar([networkEvent({ responseBody: "partial", responseBodyTruncated: true })], fetcher);
    expect(har.log.entries[0].response.content.text).toBe("full response");
  });

  it("re-fetches a body the inline capture skipped outright", async () => {
    const har = await toHar([networkEvent({ responseBodyOmittedReason: "binary content-type" })], fetcher);
    expect(har.log.entries[0].response.content.text).toBe("full response");
  });

  it("keeps the inline body when it was captured whole", async () => {
    const har = await toHar([networkEvent({ responseBody: "complete" })], fetcher);
    expect(har.log.entries[0].response.content.text).toBe("complete");
  });

  it("reports -1 for a body that does not exist", async () => {
    const har = await toHar([networkEvent()]);
    expect(har.log.entries[0].response.content.size).toBe(-1);
  });

  it("sizes base64 bodies by decoded length and flags the encoding", async () => {
    const base64: HarBodyFetcher = {
      fetchRequestBody: async () => undefined,
      fetchResponseBody: async () => ({ text: Buffer.from("abcd").toString("base64"), base64Encoded: true }),
    };
    const har = await toHar([networkEvent({ responseBodyOmittedReason: "binary content-type" })], base64);

    expect(har.log.entries[0].response.content.encoding).toBe("base64");
    expect(har.log.entries[0].response.content.size).toBe(4);
  });

  it("omits the fetcher path entirely for non-CDP clients", async () => {
    const har = await toHar([networkEvent({ responseBodyOmittedReason: "binary content-type" })]);
    expect(har.log.entries[0].response.content.text).toBeUndefined();
  });
});
