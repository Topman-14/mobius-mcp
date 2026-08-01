export interface TabState {
  clientId: string;
  mode: "manual" | "rule";
  paused?: boolean;
  sticky?: boolean;
}

function key(tabId: number): string {
  return `tabState:${tabId}`;
}

function reverseKey(clientId: string): string {
  return `clientTab:${clientId}`;
}

// In-memory cache over chrome.storage.session — getTabState is on the hottest event path. `null` caches a confirmed miss.
const stateCache = new Map<number, TabState | null>();
const tabIdCache = new Map<string, number | null>();

export async function getTabState(tabId: number): Promise<TabState | undefined> {
  const cached = stateCache.get(tabId);
  if (cached !== undefined) return cached ?? undefined;
  const result = await chrome.storage.session.get(key(tabId));
  const state: TabState | undefined = result[key(tabId)];
  stateCache.set(tabId, state ?? null);
  return state;
}

export async function setTabState(tabId: number, state: TabState): Promise<void> {
  stateCache.set(tabId, state);
  tabIdCache.set(state.clientId, tabId);
  await chrome.storage.session.set({ [key(tabId)]: state, [reverseKey(state.clientId)]: tabId });
}

export async function setPaused(tabId: number, paused: boolean): Promise<TabState | undefined> {
  const state = await getTabState(tabId);
  if (!state) return undefined;
  const next = { ...state, paused };
  await setTabState(tabId, next);
  return next;
}

export async function clearTabState(tabId: number): Promise<void> {
  const state = await getTabState(tabId);
  stateCache.set(tabId, null);
  const toRemove = [key(tabId)];
  if (state) {
    toRemove.push(reverseKey(state.clientId));
    tabIdCache.set(state.clientId, null);
  }
  await chrome.storage.session.remove(toRemove);
}

export async function getTabIdForClient(clientId: string): Promise<number | undefined> {
  const cached = tabIdCache.get(clientId);
  if (cached !== undefined) return cached ?? undefined;
  const result = await chrome.storage.session.get(reverseKey(clientId));
  const tabId: number | undefined = result[reverseKey(clientId)];
  tabIdCache.set(clientId, tabId ?? null);
  return tabId;
}

export async function getAllTabStates(): Promise<Record<number, TabState>> {
  const all = await chrome.storage.session.get(null);
  const result: Record<number, TabState> = {};
  for (const [k, value] of Object.entries(all)) {
    if (!k.startsWith("tabState:")) continue;
    result[Number(k.slice("tabState:".length))] = value as TabState;
  }
  return result;
}
