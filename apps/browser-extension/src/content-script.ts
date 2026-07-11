const MESSAGE_SOURCE = "console-stream-mcp";

window.addEventListener("message", (message) => {
  if (message.source !== window) return;
  const data = message.data;
  if (!data || data.source !== MESSAGE_SOURCE || !data.event) return;

  chrome.runtime.sendMessage({ type: "console-stream-mcp/event", event: data.event });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "console-stream-mcp/stop") return;
  window.postMessage({ source: MESSAGE_SOURCE, type: "stop" }, "*");
});
