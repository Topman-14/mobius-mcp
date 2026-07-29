import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import { PROTOCOL_VERSION, type ServerMessage } from "@mobius-mcp/capture-core";
import type { ClientRegistry } from "./registry.js";
import type { PendingCommand } from "../types.js";
import { DEFAULT_COMMAND_TIMEOUT_MS } from "../data.js";

export class CommandDispatcher {
  private pending = new Map<string, PendingCommand>();

  constructor(private registry: ClientRegistry) {}

  sendCommand(clientId: string, command: string, params: unknown = {}, timeoutMs = DEFAULT_COMMAND_TIMEOUT_MS): Promise<unknown> {
    const ws = this.registry.getWs(clientId);
    // A grace-period client (registry keeps it around after disconnect) still has a ws
    // reference, but sending on a non-OPEN socket is a silent no-op that would only
    // surface as a timeout — fail fast instead.
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error(`No connected client with id ${clientId}`));
    }

    const commandId = randomUUID();
    const message: ServerMessage = { version: PROTOCOL_VERSION, kind: "command", commandId, clientId, command, params };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(commandId);
        reject(new Error(`Command "${command}" timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(commandId, { clientId, command, resolve, reject, timer });
      ws.send(JSON.stringify(message));
    });
  }

  /** Reject every in-flight command for a client the moment it disconnects, instead of
   * leaving callers hanging until their timeout. */
  failPendingForClient(clientId: string): void {
    for (const [commandId, pending] of this.pending) {
      if (pending.clientId !== clientId) continue;
      clearTimeout(pending.timer);
      this.pending.delete(commandId);
      pending.reject(new Error(`Client disconnected while command "${pending.command}" was in flight`));
    }
  }

  handleAck(commandId: string, result: unknown, error?: string): void {
    const pending = this.pending.get(commandId);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(commandId);
    if (error) pending.reject(new Error(error));
    else pending.resolve(result);
  }
}
