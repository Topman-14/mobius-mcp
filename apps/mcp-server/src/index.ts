#!/usr/bin/env node
import { EventStore } from "./services/store.js";
import { ClientRegistry } from "./services/registry.js";
import { CommandDispatcher } from "./services/commandDispatcher.js";
import { JobManager } from "./services/jobs.js";
import { DebugSessionManager } from "./services/debugSession.js";
import { EventPersistence } from "./services/persistence.js";
import { DiagnosticsService } from "./services/diagnostics.js";
import { startWsServer } from "./transports/wsServer.js";
import { createMcpServer, createFollowerMcpServer, connectStdio } from "./transports/mcpServer.js";
import { ControlClient } from "./services/controlClient.js";
import { WS_HOST, WS_PORT_DEFAULT } from "./data.js";

const port = Number(process.env.CONSOLE_STREAM_PORT) || WS_PORT_DEFAULT;

if (process.argv.includes("--health")) {
  const payload = await DiagnosticsService.checkExternal(port);
  console.log(JSON.stringify(payload, null, 2));
  process.exit(payload.state === "ready" ? 0 : 1);
}

// Recover whatever survived a prior crash/restart before serving any tool calls
const persistence = new EventPersistence();
const hydrated = await persistence.loadAll();

const store = new EventStore(persistence, hydrated);
const registry = new ClientRegistry();
const dispatcher = new CommandDispatcher(registry);
const jobs = new JobManager();
const debugSessions = new DebugSessionManager(store, dispatcher);
const diagnostics = new DiagnosticsService(registry);

registry.setOnPurge((clientId) => store.deleteBuffer(clientId));

const {
  server,
  toolDefs
} = createMcpServer(store, registry, dispatcher, jobs, debugSessions, diagnostics);

let mcpServer = server;
try {
  await startWsServer(port, store, registry, dispatcher, toolDefs, diagnostics);
} catch (err) {
  if ((err as NodeJS.ErrnoException).code !== "EADDRINUSE") throw err;
  console.error(`[mobius-mcp] port ${port} already in use by another mobius-mcp process — running in follower mode, forwarding tool calls to it`);
  persistence.close();

  const controlClient = new ControlClient(port);
  let promoted = false;
  const invoke = (tool: string, args: unknown): Promise<unknown> => {
    if (promoted) {
      const def = toolDefs.get(tool);
      if (!def) return Promise.reject(new Error(`Unknown tool: ${tool}`));
      return Promise.resolve(def.handler(args));
    }
    return controlClient.invoke(tool, args);
  };
  mcpServer = createFollowerMcpServer(toolDefs, invoke);

  controlClient.setOnHubLost(async () => {
    try {
      await startWsServer(port, store, registry, dispatcher, toolDefs, diagnostics);
    } catch (bindErr) {
      if ((bindErr as NodeJS.ErrnoException).code === "EADDRINUSE") return false;
      console.error(`[mobius-mcp] follower promotion attempt failed unexpectedly:`, bindErr);
      return false;
    }
    persistence.reopen();
    console.error(`[mobius-mcp] promoted from follower to hub on ws://${WS_HOST}:${port}`);
    controlClient.stop();
    promoted = true;
    return true;
  });
}

await connectStdio(mcpServer);
