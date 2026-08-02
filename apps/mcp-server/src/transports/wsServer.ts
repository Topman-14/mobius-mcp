import { randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import { PROTOCOL_VERSION, isProtocolVersionSupported, type ClientMessage, type ControlMessage } from "@mobius-mcp/capture-core";
import { KEEPALIVE_INTERVAL_MS, LOCAL_SESSION_ID, WS_HOST } from "../data.js";
import { runInSession } from "../services/session.js";
import type { EventStore } from "../services/store.js";
import type { ClientRegistry } from "../services/registry.js";
import type { CommandDispatcher } from "../services/commandDispatcher.js";
import type { DiagnosticsService } from "../services/diagnostics.js";
import type { ToolDef } from "../types.js";

export function startWsServer(
  port: number,
  store: EventStore,
  registry: ClientRegistry,
  dispatcher: CommandDispatcher,
  toolDefs: Map<string, ToolDef>,
  diagnostics: DiagnosticsService,
): Promise<WebSocketServer> {
  const wss = new WebSocketServer({ host: WS_HOST, port });

  return new Promise((resolve, reject) => {
    let settled = false;

    wss.on("listening", () => {
      console.error(`[mobius-mcp] WebSocket server listening on ws://${WS_HOST}:${port}`);
      diagnostics.reportListening(port);
      if (!settled) {
        settled = true;
        resolve(wss);
      }
    });

    wss.on("error", (err) => {
      console.error(`[mobius-mcp] WebSocket server error:`, err);
      diagnostics.reportBindFailed(port, err);
      if (!settled) {
        settled = true;
        reject(err);
      }
    });

    wss.on("connection", (ws: WebSocket) => {
      const clientIds = new Set<string>();
      console.error("[mobius-mcp] client connected");

      const keepalive = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ version: PROTOCOL_VERSION, kind: "ping" }));
      }, KEEPALIVE_INTERVAL_MS);
      keepalive.unref();

      ws.on("message", (raw) => {
        let message: ClientMessage | ControlMessage;
        try {
          message = JSON.parse(raw.toString());
        } catch {
          return;
        }

        if (!isProtocolVersionSupported(message.version)) {
          diagnostics.reportHandshakeRejected();
          ws.close(4000, `unsupported protocol version, server expects ${PROTOCOL_VERSION}`);
          return;
        }

        if (message.kind === "control-request") {
          const def = toolDefs.get(message.tool);
          if (!def) {
            ws.send(JSON.stringify({ version: PROTOCOL_VERSION, kind: "control-response", requestId: message.requestId, error: `Unknown tool: ${message.tool}` }));
            return;
          }
          Promise.resolve()
            .then(() => runInSession(message.sessionId ?? LOCAL_SESSION_ID, () => def.handler(def.parse(message.args))))
            .then((result) => {
              ws.send(JSON.stringify({ version: PROTOCOL_VERSION, kind: "control-response", requestId: message.requestId, result }));
            })
            .catch((err) => {
              ws.send(JSON.stringify({ version: PROTOCOL_VERSION, kind: "control-response", requestId: message.requestId, error: err instanceof Error ? err.message : String(err) }));
            });
          return;
        }

        if (message.kind === "hello") {
          const clientId = message.client.clientId || randomUUID();
          clientIds.add(clientId);
          registry.register({ ...message.client, clientId, connectedAt: Date.now() }, ws);
          return;
        }

        if (message.kind === "event" && clientIds.has(message.clientId)) {
          store.addEvent({ ...message.event, id: randomUUID(), clientId: message.clientId });
          return;
        }

        if (message.kind === "bye" && clientIds.has(message.clientId)) {
          clientIds.delete(message.clientId);
          registry.markDisconnected(message.clientId, "bye");
          dispatcher.failPendingForClient(message.clientId);
          return;
        }

        if (message.kind === "ack") {
          dispatcher.handleAck(message.commandId, message.result, message.error);
          return;
        }

        if (message.kind === "pong") return;
      });

      ws.on("close", () => {
        clearInterval(keepalive);
        console.error("[mobius-mcp] client disconnected");
        for (const clientId of clientIds) {
          registry.markDisconnected(clientId);
          dispatcher.failPendingForClient(clientId);
        }
      });
    });
  });
}
