import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import type { EventType } from "@console-stream-mcp/protocol";
import type { EventStore } from "./store.js";
import type { ClientRegistry } from "./registry.js";

const CONSOLE_TYPES: EventType[] = ["console.log", "console.info", "console.warn"];
const ERROR_TYPES: EventType[] = ["console.error", "window.onerror", "unhandledrejection"];
const NETWORK_TYPES: EventType[] = ["network.fetch", "network.xhr"];

function toolResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function toolError(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true as const };
}

export function createMcpServer(store: EventStore, registry: ClientRegistry): McpServer {
  const server = new McpServer({ name: "console-stream-mcp", version: "0.0.1" });

  let activeTabId: string | undefined;

  /** Resolves which tab a tool call should target: explicit param wins, then the
   * session's active tab, then auto-select if exactly one tab is connected. */
  function resolveTabId(explicitTabId?: string): { clientId: string } | { error: ReturnType<typeof toolError> } {
    if (explicitTabId) return { clientId: explicitTabId };

    const connected = registry.list();
    if (connected.length === 0) {
      return { error: toolError("No tabs connected. Ask the user to click the console-stream-mcp extension icon and enable capture on the tab they want debugged.") };
    }
    if (activeTabId && connected.some((c) => c.clientId === activeTabId)) {
      return { clientId: activeTabId };
    }
    if (connected.length === 1) {
      return { clientId: connected[0].clientId };
    }
    return {
      error: toolError(
        `Multiple tabs connected, specify tabId or call set_active_tab first. Candidates: ${JSON.stringify(connected, null, 2)}`,
      ),
    };
  }

  server.tool(
    "get_recent_logs",
    "Get the most recent console.log/info/warn events from a connected browser tab.",
    { tabId: z.string().optional(), limit: z.number().int().positive().max(500).default(50) },
    async ({ tabId, limit }) => {
      const resolved = resolveTabId(tabId);
      if ("error" in resolved) return resolved.error;
      return toolResult(store.getRecent(resolved.clientId, CONSOLE_TYPES, limit));
    },
  );

  server.tool(
    "get_recent_errors",
    "Get the most recent console.error, window.onerror, and unhandled promise rejection events from a connected browser tab.",
    { tabId: z.string().optional(), limit: z.number().int().positive().max(500).default(50) },
    async ({ tabId, limit }) => {
      const resolved = resolveTabId(tabId);
      if ("error" in resolved) return resolved.error;
      return toolResult(store.getRecent(resolved.clientId, ERROR_TYPES, limit));
    },
  );

  server.tool(
    "get_network_requests",
    "Get the most recent fetch/XHR network requests observed in a connected browser tab.",
    { tabId: z.string().optional(), limit: z.number().int().positive().max(500).default(50) },
    async ({ tabId, limit }) => {
      const resolved = resolveTabId(tabId);
      if ("error" in resolved) return resolved.error;
      return toolResult(store.getRecent(resolved.clientId, NETWORK_TYPES, limit));
    },
  );

  server.tool(
    "get_logs_since",
    "Poll for events with seq greater than the given cursor from a connected browser tab. Returns the new events and the latest cursor to pass next time.",
    { tabId: z.string().optional(), cursor: z.number().int().nonnegative().default(0), types: z.array(z.string()).optional() },
    async ({ tabId, cursor, types }) => {
      const resolved = resolveTabId(tabId);
      if ("error" in resolved) return resolved.error;
      return toolResult(store.getSince(resolved.clientId, cursor, { types: types as EventType[] | undefined }));
    },
  );

  server.tool("clear_logs", "Clear the in-memory event history for a connected tab.", { tabId: z.string().optional() }, async ({ tabId }) => {
    const resolved = resolveTabId(tabId);
    if ("error" in resolved) return resolved.error;
    store.clear(resolved.clientId);
    return toolResult({ cleared: true, tabId: resolved.clientId });
  });

  server.tool("get_connected_tabs", "List browser tabs/pages currently streaming events to this server.", {}, async () =>
    toolResult(registry.list().map((c) => ({ ...c, active: c.clientId === activeTabId }))),
  );

  server.tool(
    "set_active_tab",
    "Set the default tab used by other tools when tabId is omitted, for the rest of this session.",
    { tabId: z.string() },
    async ({ tabId }) => {
      if (!registry.list().some((c) => c.clientId === tabId)) {
        return toolError(`No connected tab with id ${tabId}. Call get_connected_tabs to see candidates.`);
      }
      activeTabId = tabId;
      return toolResult({ active: tabId });
    },
  );

  return server;
}

export async function connectStdio(server: McpServer): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
