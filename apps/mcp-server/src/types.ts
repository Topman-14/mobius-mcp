import type { WebSocket } from "ws";
import type { BrowserEvent, ClientInfo, EventType } from "@mobius-mcp/capture-core";

export type RegisteredClient = ClientInfo & { ws: WebSocket; disconnectedAt?: number };

export interface EventSink {
  append(event: BrowserEvent): void;
  remove(clientId: string): void;
  clear(clientId: string): void;
}

export type DiagnoseState =
  | "ready"
  | "no_client_ever_connected"
  | "client_disconnected"
  | "handshake_rejected"
  | "ws_bind_failed"
  | "no_server_running"
  | "error";

export interface RemediationStep {
  step: string;
  userAction: boolean;
}

export interface DiagnosePayload {
  state: DiagnoseState;
  wsPort: number;
  wsListening: boolean;
  serverVersion: string;
  protocolVersion: number;
  clients: ClientInfo[];
  everConnected: boolean;
  lastClientSeenAt: number | null;
  lastDisconnectReason: string | null;
  rejectedHandshakes: number;
  remediation: RemediationStep[];
  agentGuidance: string;
  /** Set only for state "error". */
  error?: string;
}

// commandDispatcher.ts
export interface PendingCommand {
  clientId: string;
  command: string;
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

// jobs.ts
export type JobStatus = "running" | "done" | "error" | "cancelled";

export interface Job {
  id: string;
  kind: string;
  status: JobStatus;
  result?: unknown;
  error?: string;
  createdAt: number;
}

// debugSession.ts
export interface DebugSession {
  id: string;
  clientId: string;
  startSeq: number;
  types: EventType[];
  domCapture: boolean;
}

// mcpServer.ts
export interface ToolDef {
  description: string;
  schema: any;
  handler: (args: any) => Promise<any>;
}

// Index signature required so TS accepts this as CallToolResult at every server.tool() call site.
export interface ToolContent {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }>;
  isError?: true;
}

export type TabResolution = { clientId: string } | { error: ToolContent };
