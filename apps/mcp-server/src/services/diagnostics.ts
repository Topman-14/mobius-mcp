import { PROTOCOL_VERSION } from "@mobius-mcp/capture-core";
import type { ClientRegistry } from "./registry.js";
import type { DiagnosePayload, DiagnoseState, RemediationStep } from "../types.js";
import { VERSION, WS_HOST, isTabClient } from "../data.js";
import { probeControlRequest } from "./controlClient.js";

const HEALTH_CHECK_TIMEOUT_MS = 3000;

type InProcessState = Exclude<DiagnoseState, "no_server_running" | "error">;

function basePayload(port: number, overrides: Pick<DiagnosePayload, "state" | "remediation" | "agentGuidance"> & Partial<DiagnosePayload>): DiagnosePayload {
  return {
    wsPort: port,
    wsListening: false,
    serverVersion: VERSION,
    protocolVersion: PROTOCOL_VERSION,
    clients: [],
    everConnected: false,
    lastClientSeenAt: null,
    lastDisconnectReason: null,
    rejectedHandshakes: 0,
    ...overrides,
  };
}

export class DiagnosticsService {
  static async checkExternal(port: number): Promise<DiagnosePayload> {
    const probe = await probeControlRequest(port, "mobius_diagnose", {}, HEALTH_CHECK_TIMEOUT_MS);

    if (!probe.ok) {
      if (probe.reason === "unreachable") {
        return basePayload(port, {
          state: "no_server_running",
          remediation: [
            { step: `No mobius-mcp server is listening on ws://${WS_HOST}:${port}.`, userAction: false },
            { step: "Start it (e.g. the MCP client config that launches `npx -y mobius-mcp`), or check CONSOLE_STREAM_PORT if a non-default port is configured.", userAction: true },
          ],
          agentGuidance: "No mobius-mcp process is running at all. Relay the remediation to the user and do not retry mobius tools until a server is confirmed running.",
        });
      }
      return basePayload(port, { state: "error", error: probe.error, remediation: [], agentGuidance: "" });
    }

    try {
      const wrapped = probe.result as { content: Array<{ type: string; text: string }> };
      return JSON.parse(wrapped.content[0].text) as DiagnosePayload;
    } catch {
      return basePayload(port, {
        state: "error",
        error: "Received an unparseable response from the mobius-mcp hub.",
        remediation: [],
        agentGuidance: "",
      });
    }
  }

  private wsPort: number | undefined;
  private wsListening = false;
  private wsBindError: string | undefined;
  private rejectedHandshakes = 0;

  constructor(private registry: ClientRegistry) {}

  reportListening(port: number): void {
    this.wsPort = port;
    this.wsListening = true;
    this.wsBindError = undefined;
  }

  reportBindFailed(port: number, err: unknown): void {
    this.wsPort = port;
    this.wsListening = false;
    this.wsBindError = err instanceof Error ? err.message : String(err);
  }

  reportHandshakeRejected(): void {
    this.rejectedHandshakes += 1;
  }

  diagnose(): DiagnosePayload {
    const clients = this.registry.list().filter(isTabClient);
    const extensionConnected = this.registry.list().some((c) => !isTabClient(c));
    const { everConnected, lastClientSeenAt, lastDisconnectReason } = this.registry.getHistory();

    const state: InProcessState = !this.wsListening
      ? "ws_bind_failed"
      : clients.length > 0
        ? "ready"
        : this.rejectedHandshakes > 0 && !everConnected
          ? "handshake_rejected"
          : !everConnected
            ? "no_client_ever_connected"
            : "client_disconnected";

    let remediation: RemediationStep[];
    switch (state) {
      case "ws_bind_failed":
        remediation = [
          { step: `The mobius-mcp WebSocket server failed to bind port ${this.wsPort ?? "unknown"}${this.wsBindError ? ` (${this.wsBindError})` : ""}.`, userAction: false },
          { step: "Check whether another process is using this port, or set CONSOLE_STREAM_PORT to a free one and restart.", userAction: true },
        ];
        break;
      case "ready":
        remediation = extensionConnected
          ? []
          : [
              {
                step: "A tab is streaming, but the extension's browser-control client isn't connected yet — open_tab, list_tabs, and enable_capture will fail until it reconnects (up to ~1 minute).",
                userAction: false,
              },
            ];
        break;
      case "handshake_rejected":
        remediation = [
          { step: "A client attempted to connect but its protocol version did not match this server's, and no tab is streaming — the rejected client may not be the extension at all.", userAction: false },
          { step: "Click the mobius-mcp toolbar icon on the target tab and toggle capture on.", userAction: true },
          { step: "If capture still does not come up, update the mobius-mcp browser extension to the latest version.", userAction: true },
          { step: "If the extension is already current, update the server: npx -y mobius-mcp@latest.", userAction: true },
        ];
        break;
      case "no_client_ever_connected":
        remediation = extensionConnected
          ? [{ step: "The browser extension is connected but no tab is streaming yet — the agent can start one itself via open_tab (or list_tabs) + enable_capture.", userAction: false }]
          : [
              { step: "Confirm the mobius-mcp browser extension is installed and enabled at chrome://extensions.", userAction: true },
              { step: "Click the mobius-mcp toolbar icon on the target tab and toggle capture on.", userAction: true },
              { step: "Reload the tab after enabling capture.", userAction: true },
            ];
        break;
      case "client_disconnected":
        remediation = extensionConnected
          ? [
              { step: `A tab was connected before but none are connected now${lastDisconnectReason ? ` (last disconnect: ${lastDisconnectReason})` : ""}.`, userAction: false },
              { step: "The browser extension is still connected — the agent can re-enable capture itself via list_tabs + enable_capture (or open_tab for a fresh tab).", userAction: false },
            ]
          : [
              { step: `A tab was connected before but none are connected now${lastDisconnectReason ? ` (last disconnect: ${lastDisconnectReason})` : ""}.`, userAction: false },
              { step: "Reload the target tab, or click the mobius-mcp toolbar icon to re-enable capture.", userAction: true },
            ];
        break;
    }

    return {
      state,
      wsPort: this.wsPort ?? 0,
      wsListening: this.wsListening,
      serverVersion: VERSION,
      protocolVersion: PROTOCOL_VERSION,
      clients,
      everConnected,
      lastClientSeenAt,
      rejectedHandshakes: this.rejectedHandshakes,
      lastDisconnectReason,
      remediation,
      agentGuidance:
        state === "ready"
          ? extensionConnected
            ? "mobius-mcp is ready — proceed with other tools."
            : "Tab capture is ready, but open_tab/list_tabs/enable_capture need the extension's browser-control client, which isn't connected yet — it reconnects automatically within ~1 minute. Tools that only need an already-streaming tab (e.g. get_recent_errors, evaluate_js) are unaffected; retry mobius_diagnose before using the others."
          : extensionConnected && (state === "no_client_ever_connected" || state === "client_disconnected")
            ? "The extension is connected but no tab is streaming. Enable one yourself: list_tabs (or open_tab) to find/create the target tab, then enable_capture with its chromeTabId — no user action is required."
            : state === "handshake_rejected"
              ? "A rejected handshake here does not prove the extension is outdated — it may have come from any client, including another mobius-mcp process. Ask the user to enable capture manually: click the mobius-mcp toolbar icon on the target tab and toggle it on. That normally brings the connection up. Then call mobius_diagnose again; only if it still reports handshake_rejected should you relay the version-update steps."
              :'Try open_tab once yourself first — it requires no user interaction and is the cheapest way to confirm whether the extension itself is actually reachable right now (this diagnose call may be stale). If open_tab also fails, that confirms there is no self-serve fix: relay the remediation steps to the user verbatim and stop there — do not retry in a loop, and do not silently fall back to another browser tool.',
    };
  }
}
