const attached = new Set<number>();
// Best-effort requestId lookup for get_response_body, populated from Network domain
// events while attached. Keyed per tab, most-recent request per URL wins.
const recentRequestIds = new Map<number, Map<string, string>>();
const idleTimers = new Map<number, ReturnType<typeof setTimeout>>();

const MAX_REQUEST_IDS_PER_TAB = 300;
// Longer than the longest CDP command (a 60s max profile) so the debugger never detaches
// mid-command, but short enough that Chrome's "being debugged" bar doesn't linger all day.
const IDLE_DETACH_MS = 5 * 60_000;

function scheduleIdleDetach(tabId: number): void {
  clearTimeout(idleTimers.get(tabId));
  idleTimers.set(
    tabId,
    setTimeout(() => detach(tabId), IDLE_DETACH_MS),
  );
}

export async function ensureAttached(tabId: number): Promise<void> {
  if (attached.has(tabId)) return;
  await chrome.debugger.attach({ tabId }, "1.3");
  attached.add(tabId);
  await chrome.debugger.sendCommand({ tabId }, "Network.enable");
}

export async function sendCdp(tabId: number, method: string, params: object = {}): Promise<unknown> {
  await ensureAttached(tabId);
  scheduleIdleDetach(tabId);
  try {
    return await chrome.debugger.sendCommand({ tabId }, method, params);
  } finally {
    scheduleIdleDetach(tabId);
  }
}

export function detach(tabId: number): void {
  clearTimeout(idleTimers.get(tabId));
  idleTimers.delete(tabId);
  if (!attached.has(tabId)) return;
  attached.delete(tabId);
  recentRequestIds.delete(tabId);
  chrome.debugger.detach({ tabId }).catch(() => {});
}

export function findRequestId(tabId: number, requestUrl: string): string | undefined {
  return recentRequestIds.get(tabId)?.get(requestUrl);
}

chrome.debugger.onEvent.addListener((source, method, params) => {
  if (method !== "Network.responseReceived" || source.tabId === undefined) return;
  const p = params as { requestId: string; response: { url: string } };
  let byUrl = recentRequestIds.get(source.tabId);
  if (!byUrl) {
    byUrl = new Map();
    recentRequestIds.set(source.tabId, byUrl);
  }
  // Delete-then-set keeps Map insertion order acting as an LRU for the size cap below.
  byUrl.delete(p.response.url);
  byUrl.set(p.response.url, p.requestId);
  if (byUrl.size > MAX_REQUEST_IDS_PER_TAB) {
    byUrl.delete(byUrl.keys().next().value!);
  }
});

chrome.debugger.onDetach.addListener((source) => {
  if (source.tabId !== undefined) {
    attached.delete(source.tabId);
    recentRequestIds.delete(source.tabId);
    clearTimeout(idleTimers.get(source.tabId));
    idleTimers.delete(source.tabId);
  }
});
