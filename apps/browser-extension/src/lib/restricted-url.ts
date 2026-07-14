// chrome.scripting/chrome.debugger can't attach to these — capture would silently fail.
const RESTRICTED_PREFIXES = ["chrome://", "edge://", "about:", "extension://", "chrome.google.com/webstore", "microsoftedge.microsoft.com/addons", "devtools://", "view-source:"];

export function getRestrictedUrlReason(url: string | undefined): string | undefined {
  if (!url) return "No active tab";
  if (url.startsWith(`chrome-extension://${chrome.runtime.id}/`)) {
    return "Can't capture the extension's own pages (options, logs).";
  }
  if (RESTRICTED_PREFIXES.some((prefix) => url.startsWith(prefix)) || url.startsWith("chrome-extension://")) {
    return "Can't capture browser-internal pages.";
  }
  return undefined;
}
