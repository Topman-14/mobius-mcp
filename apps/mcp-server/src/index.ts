#!/usr/bin/env node
import { EventStore } from "./store.js";
import { ClientRegistry } from "./registry.js";
import { startWsServer } from "./wsServer.js";
import { createMcpServer, connectStdio } from "./mcpServer.js";

const port = Number(process.env.CONSOLE_STREAM_PORT) || 7331;

const store = new EventStore();
const registry = new ClientRegistry();
registry.setOnPurge((clientId) => store.deleteBuffer(clientId));

startWsServer(port, store, registry);

const mcpServer = createMcpServer(store, registry);
await connectStdio(mcpServer);
