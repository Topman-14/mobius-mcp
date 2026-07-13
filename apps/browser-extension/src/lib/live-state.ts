import type { CapturedEvent } from "@console-stream-mcp/capture-core";

export type ConnectionStatus = "connected" | "connecting" | "disconnected";

export interface EventCounters {
  console: number;
  errors: number;
  network: number;
  runtime: number;
}

export interface FeedItem {
  timestamp: number;
  kind: keyof EventCounters;
  summary: string;
}

export interface TabLiveState {
  counters: EventCounters;
  feed: FeedItem[];
  recordingStartedAt?: number;
}

const FEED_LIMIT = 5;

function emptyCounters(): EventCounters {
  return { console: 0, errors: 0, network: 0, runtime: 0 };
}

function bucketFor(type: CapturedEvent["type"]): keyof EventCounters {
  if (type === "console.error" || type === "window.onerror" || type === "unhandledrejection") return "errors";
  if (type === "console.log" || type === "console.info" || type === "console.warn") return "console";
  if (type === "network.fetch" || type === "network.xhr") return "network";
  return "runtime";
}

function summarize(event: CapturedEvent): string {
  switch (event.type) {
    case "console.log":
    case "console.info":
    case "console.warn":
    case "console.error":
      return event.message;
    case "window.onerror":
      return event.message;
    case "unhandledrejection":
      return event.reason;
    case "network.fetch":
    case "network.xhr":
      return `${event.method} ${event.requestUrl}${event.status ? ` (${event.status})` : ""}`;
    case "navigation":
      return `navigated to ${event.toUrl}`;
    case "dom.mutation":
      return `${event.mutationType} on ${event.targetSelector ?? "document"}`;
  }
}

const tabs = new Map<number, TabLiveState>();

export let connectionStatus: ConnectionStatus = "disconnected";
export let lastEventAt: number | undefined;

export function setConnectionStatus(status: ConnectionStatus) {
  connectionStatus = status;
  notify();
}

export function getTabLiveState(tabId: number): TabLiveState {
  let state = tabs.get(tabId);
  if (!state) {
    state = { counters: emptyCounters(), feed: [] };
    tabs.set(tabId, state);
  }
  return state;
}

export function startRecording(tabId: number) {
  const state = getTabLiveState(tabId);
  state.counters = emptyCounters();
  state.feed = [];
  state.recordingStartedAt = Date.now();
  notify(tabId);
}

export function stopRecording(tabId: number) {
  tabs.delete(tabId);
  notify(tabId);
}

export function recordEvent(tabId: number, event: CapturedEvent): keyof EventCounters {
  const state = getTabLiveState(tabId);
  const kind = bucketFor(event.type);
  state.counters[kind]++;
  state.feed.unshift({ timestamp: event.timestamp, kind, summary: summarize(event) });
  if (state.feed.length > FEED_LIMIT) state.feed.length = FEED_LIMIT;
  lastEventAt = Date.now();
  notify(tabId);
  return kind;
}

export function getAllLiveState(): Record<number, TabLiveState> {
  return Object.fromEntries(tabs.entries());
}

export function clearTabLiveState(tabId: number) {
  const state = getTabLiveState(tabId);
  state.counters = emptyCounters();
  state.feed = [];
  notify(tabId);
}

export function clearAllTabLiveState() {
  for (const tabId of tabs.keys()) clearTabLiveState(tabId);
}

const ports = new Map<chrome.runtime.Port, number>();

export function registerPort(port: chrome.runtime.Port, tabId: number) {
  ports.set(port, tabId);
  port.onDisconnect.addListener(() => ports.delete(port));
  pushToPort(port, tabId);
}

function pushToPort(port: chrome.runtime.Port, tabId: number) {
  port.postMessage({
    connection: { status: connectionStatus, lastEventAt },
    live: getTabLiveState(tabId),
  });
}

function notify(tabId?: number) {
  for (const [port, portTabId] of ports) {
    if (tabId !== undefined && portTabId !== tabId) continue;
    try {
      pushToPort(port, portTabId);
    } catch {
      ports.delete(port);
    }
  }
}
