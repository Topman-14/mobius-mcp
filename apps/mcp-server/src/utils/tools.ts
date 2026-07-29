import type { BrowserEvent, CaptureSettings } from "@mobius-mcp/capture-core";
import type { ClientRegistry } from "../services/registry.js";
import type { CommandDispatcher } from "../services/commandDispatcher.js";
import type { TabResolution, ToolContent } from "../types.js";
import { errorMessage } from "./errors.js";
import { BROWSER_CONTROL_CAPABILITY, isTabClient } from "../data.js";

export function toolResult(data: unknown): ToolContent {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

/** get_recent_logs/get_recent_errors/get_network_requests share this: an empty array is
 * ambiguous between "nothing happened" and "that capture category is off for this tab" —
 * get_capture_settings answers it, but only if the agent knows to call it. Inline the
 * relevant flag on the empty path instead so it never has to guess. Non-empty results are
 * returned exactly as before (a bare array) — this only changes shape when it would
 * otherwise have been the least informative possible response, `[]`. */
export function toolResultWithCaptureHint(
  events: BrowserEvent[],
  registry: ClientRegistry,
  clientId: string,
  category: keyof CaptureSettings,
): ToolContent {
  if (events.length > 0) return toolResult(events);
  const captureSettings = registry.get(clientId)?.captureSettings;
  const enabled = captureSettings?.[category];
  if (enabled === false) {
    return toolResult({
      events: [],
      captureEnabled: false,
      hint: `The "${category}" capture category is off for this tab, which is why this is empty — not necessarily that nothing happened. Call get_capture_settings to confirm, or ask the user to enable it in the extension options.`,
    });
  }
  return toolResult(events);
}

export function toolError(message: string): ToolContent {
  return { content: [{ type: "text", text: message }], isError: true };
}

/** Resolves the extension's tab-independent client, for commands (open_tab,
 * enable_capture, list_tabs) reachable even before any tab has capture enabled. */
export function resolveBrowserControlClient(registry: ClientRegistry): TabResolution {
  const client = registry.list().find((c) => c.capabilities.includes(BROWSER_CONTROL_CAPABILITY));
  if (!client) {
    return { error: toolError("No mobius-mcp browser extension connected. Call mobius_diagnose for the reason and remediation steps.") };
  }
  return { clientId: client.clientId };
}

/** Resolves which tab a tool call should target: explicit param wins, then the
 * session's active tab, then auto-select if exactly one tab is connected. */
export function resolveTabId(registry: ClientRegistry, activeTabId: string | undefined, explicitTabId?: string): TabResolution {
  if (explicitTabId) return { clientId: explicitTabId };

  const connected = registry.list().filter(isTabClient);
  if (connected.length === 0) {
    return { error: toolError('No tabs connected. Call mobius_diagnose for the reason and remediation steps — do not guess.') };
  }
  if (activeTabId && connected.some((c) => c.clientId === activeTabId)) {
    return { clientId: activeTabId };
  }
  if (connected.length === 1) {
    return { clientId: connected[0].clientId };
  }
  return {
    error: toolError(`Multiple tabs connected, specify tabId or call set_active_tab first. Candidates: ${JSON.stringify(connected, null, 2)}`),
  };
}

export function requireCdp(registry: ClientRegistry, clientId: string): ToolContent | undefined {
  const client = registry.get(clientId);
  if (!client?.capabilities.includes("cdp")) {
    return toolError(`Tab ${clientId} doesn't support this (requires the browser extension, not the npm client).`);
  }
  return undefined;
}

/** resolveTabId + requireCdp combined, for the CDP-only capture/eval/profiling tools. */
export function resolveCdpTab(registry: ClientRegistry, activeTabId: string | undefined, explicitTabId?: string): TabResolution {
  const resolved = resolveTabId(registry, activeTabId, explicitTabId);
  if ("error" in resolved) return resolved;
  const cdpError = requireCdp(registry, resolved.clientId);
  return cdpError ? { error: cdpError } : resolved;
}

/** Sends a command to a tab and wraps the outcome as tool output — the try/catch +
 * toolResult/toolError pattern nearly every command-based tool needs. */
export async function runCommand(
  dispatcher: CommandDispatcher,
  clientId: string,
  command: string,
  params: unknown = {},
  timeoutMs?: number,
): Promise<ToolContent> {
  try {
    return toolResult(await dispatcher.sendCommand(clientId, command, params, timeoutMs));
  } catch (err) {
    return toolError(errorMessage(err));
  }
}

/** Same as runCommand, for screenshot commands whose ack is `{format, dataBase64}` —
 * returned as a native MCP image block, not megabytes of base64 inside a JSON string. */
export async function runImageCommand(
  dispatcher: CommandDispatcher,
  clientId: string,
  command: string,
  params: unknown = {},
): Promise<ToolContent> {
  try {
    const { format, dataBase64 } = (await dispatcher.sendCommand(clientId, command, params)) as { format: string; dataBase64: string };
    return { content: [{ type: "image", data: dataBase64, mimeType: `image/${format}` }] };
  } catch (err) {
    return toolError(errorMessage(err));
  }
}
