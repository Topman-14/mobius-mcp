import { startCapture, type CapturedEvent } from "@console-stream-mcp/capture-core";

const MESSAGE_SOURCE = "console-stream-mcp";

const stop = startCapture((event: CapturedEvent) => {
  window.postMessage({ source: MESSAGE_SOURCE, event }, "*");
});

window.addEventListener("message", (message) => {
  if (message.source !== window) return;
  if (message.data?.source !== MESSAGE_SOURCE || message.data?.type !== "stop") return;
  stop();
});
