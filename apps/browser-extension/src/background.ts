import { PROTOCOL_VERSION, type ClientMessage } from "@console-stream-mcp/protocol";
import type { CapturedEvent } from "@console-stream-mcp/capture-core";
import { findMatchingRule, getRules } from "./rules.js";
import { getTabState, setTabState, clearTabState, type TabState } from "./tabState.js";

const PORT = 7331;

let ws: WebSocket | null = null;
let retryDelay = 500;
const queue: ClientMessage[] = [];

function send(message: ClientMessage) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  } else {
    queue.push(message);
  }
}

function connect() {
  ws = new WebSocket(`ws://localhost:${PORT}`);

  ws.addEventListener("open", () => {
    retryDelay = 500;
    while (queue.length > 0) {
      ws!.send(JSON.stringify(queue.shift()!));
    }
  });

  ws.addEventListener("close", () => {
    setTimeout(connect, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 10_000);
  });

  ws.addEventListener("error", () => ws?.close());
}

connect();

async function enableTab(tabId: number, mode: TabState["mode"]): Promise<void> {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.url) return;

  const clientId = crypto.randomUUID();
  await setTabState(tabId, { clientId, mode });

  await chrome.scripting.executeScript({ target: { tabId }, files: ["iife/content-script.js"] });
  await chrome.scripting.executeScript({ target: { tabId }, world: "MAIN", files: ["iife/injected.js"] });

  send({
    version: PROTOCOL_VERSION,
    kind: "hello",
    client: { clientId, clientType: "extension", pageUrl: tab.url, title: tab.title },
  });
}

async function disableTab(tabId: number): Promise<void> {
  const state = await getTabState(tabId);
  if (!state) return;

  send({ version: PROTOCOL_VERSION, kind: "bye", clientId: state.clientId });
  await clearTabState(tabId);

  try {
    await chrome.tabs.sendMessage(tabId, { type: "console-stream-mcp/stop" });
  } catch {
    // tab may already be closed/navigated away; nothing to clean up in-page
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "console-stream-mcp/event" && sender.tab?.id !== undefined) {
    const tabId = sender.tab.id;
    getTabState(tabId).then((state) => {
      if (!state) return;
      const event: CapturedEvent = { ...message.event, metadata: { ...message.event.metadata, tabId } };
      send({ version: PROTOCOL_VERSION, kind: "event", clientId: state.clientId, event });
    });
    return;
  }

  if (message?.type === "console-stream-mcp/get-state") {
    getTabState(message.tabId).then((state) => sendResponse({ state: state ?? null }));
    return true;
  }

  if (message?.type === "console-stream-mcp/toggle") {
    getTabState(message.tabId).then(async (state) => {
      if (state) {
        await disableTab(message.tabId);
        sendResponse({ state: null });
      } else {
        await enableTab(message.tabId, "manual");
        sendResponse({ state: await getTabState(message.tabId) });
      }
    });
    return true;
  }
});

// Injected scripts run per-document, so any prior state is gone the moment a tab
// navigates. Re-evaluate rule matches fresh on every top-level navigation; a
// manual toggle does not persist across navigation and must be re-clicked.
chrome.webNavigation.onCommitted.addListener(async (details) => {
  if (details.frameId !== 0) return;
  await clearTabState(details.tabId);

  const rules = await getRules();
  const rule = findMatchingRule(details.url, rules);
  if (rule) {
    await enableTab(details.tabId, "rule");
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  disableTab(tabId);
});
