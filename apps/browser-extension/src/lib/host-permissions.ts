export function hasOrigin(origin: string): Promise<boolean> {
  return chrome.permissions.contains({ origins: [origin] });
}

export function requestOrigin(origin: string): Promise<boolean> {
  return chrome.permissions.request({ origins: [origin] });
}

export function removeOrigin(origin: string): Promise<boolean> {
  return chrome.permissions.remove({ origins: [origin] });
}
