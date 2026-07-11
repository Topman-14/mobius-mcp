export interface TabState {
  clientId: string;
  mode: "manual" | "rule";
}

function key(tabId: number): string {
  return `tabState:${tabId}`;
}

export async function getTabState(tabId: number): Promise<TabState | undefined> {
  const result = await chrome.storage.session.get(key(tabId));
  return result[key(tabId)];
}

export async function setTabState(tabId: number, state: TabState): Promise<void> {
  await chrome.storage.session.set({ [key(tabId)]: state });
}

export async function clearTabState(tabId: number): Promise<void> {
  await chrome.storage.session.remove(key(tabId));
}
