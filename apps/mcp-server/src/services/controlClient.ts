import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import { PROTOCOL_VERSION, type ControlMessage } from "@mobius-mcp/capture-core";
import { CONTROL_REQUEST_TIMEOUT_MS, HUB_ELECTION_JITTER_MS, WS_HOST } from "../data.js";

export type ControlProbeResult = { ok: true; result: unknown } | { ok: false; reason: "unreachable" | "error"; error?: string };

export function probeControlRequest(port: number, tool: string, args: unknown, timeoutMs: number): Promise<ControlProbeResult> {
  return new Promise((resolve) => {
    const requestId = randomUUID();
    const sessionId = randomUUID();
    let settled = false;
    const settle = (result: ControlProbeResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      ws.terminate();
      resolve(result);
    };

    const ws = new WebSocket(`ws://${WS_HOST}:${port}`);
    const timer = setTimeout(() => settle({ ok: false, reason: "unreachable" }), timeoutMs);

    ws.on("open", () => {
      const message: ControlMessage = { version: PROTOCOL_VERSION, kind: "control-request", requestId, sessionId, tool, args };
      ws.send(JSON.stringify(message));
    });
    ws.on("message", (raw) => {
      let message: ControlMessage;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (message.kind !== "control-response" || message.requestId !== requestId) return;
      if (message.error) settle({ ok: false, reason: "error", error: message.error });
      else settle({ ok: true, result: message.result });
    });
    ws.on("error", () => settle({ ok: false, reason: "unreachable" }));
  });
}

export class ControlClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private retryDelay = 500;
  private reconnectTimer: NodeJS.Timeout | undefined;
  private stopped = false;
  private onHubLost?: () => Promise<boolean>;
  private readonly sessionId = randomUUID();

  constructor(private port: number) {
    this.connect();
  }

  setOnHubLost(callback: () => Promise<boolean>): void {
    this.onHubLost = callback;
  }

  stop(): void {
    this.stopped = true;
    clearTimeout(this.reconnectTimer);
    this.ws?.removeAllListeners();
    this.ws?.close();
  }

  private connect(): void {
    const ws = new WebSocket(`ws://${WS_HOST}:${this.port}`);
    this.ws = ws;

    ws.on("open", () => {
      this.retryDelay = 500;
      console.error(`[mobius-mcp] follower mode: connected to hub on ws://${WS_HOST}:${this.port}`);
    });

    ws.on("message", (raw) => {
      let message: ControlMessage;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (message.kind !== "control-response") return;
      const pending = this.pending.get(message.requestId);
      if (!pending) return;
      this.pending.delete(message.requestId);
      if (message.error) pending.reject(new Error(message.error));
      else pending.resolve(message.result);
    });

    ws.on("close", () => {
      if (this.stopped) return;
      this.failPending(new Error("mobius-mcp hub connection lost while the request was in flight"));
      const delay = this.retryDelay + Math.floor(Math.random() * HUB_ELECTION_JITTER_MS);
      console.error(`[mobius-mcp] follower mode: lost connection to hub, attempting promotion in ${delay}ms`);
      this.reconnectTimer = setTimeout(async () => {
        if (this.stopped) return;
        if (await this.onHubLost?.()) return;
        this.connect();
      }, delay);
      this.retryDelay = Math.min(this.retryDelay * 2, 10_000);
    });

    ws.on("error", () => ws.close());
  }

  private failPending(error: Error): void {
    for (const [requestId, pending] of this.pending) {
      this.pending.delete(requestId);
      pending.reject(error);
    }
  }

  invoke(tool: string, args: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const requestId = randomUUID();

      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error("mobius-mcp hub unavailable or request timed out — is another mobius-mcp process still running?"));
      }, CONTROL_REQUEST_TIMEOUT_MS);

      this.pending.set(requestId, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });

      const message: ControlMessage = { version: PROTOCOL_VERSION, kind: "control-request", requestId, sessionId: this.sessionId, tool, args };
      const send = () => this.ws?.send(JSON.stringify(message));
      if (this.ws && this.ws.readyState === WebSocket.OPEN) send();
      else this.ws?.once("open", send);
    });
  }
}
