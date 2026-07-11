const statusEl = document.getElementById("status")!;
const toggleEl = document.getElementById("toggle") as HTMLButtonElement;
const optionsLink = document.getElementById("options-link")!;

optionsLink.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

function render(state: { mode: "manual" | "rule" } | null) {
  if (state) {
    statusEl.innerHTML = `Capturing <div class="mode">${state.mode === "rule" ? "enabled by a settings rule" : "manually enabled"}</div>`;
    toggleEl.textContent = "Disable capture";
  } else {
    statusEl.textContent = "Not capturing";
    toggleEl.textContent = "Enable capture";
  }
  toggleEl.disabled = false;
}

async function getActiveTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

async function init() {
  const tabId = await getActiveTabId();
  if (tabId === undefined) {
    statusEl.textContent = "No active tab";
    return;
  }

  const { state } = await chrome.runtime.sendMessage({ type: "console-stream-mcp/get-state", tabId });
  render(state);

  toggleEl.addEventListener("click", async () => {
    toggleEl.disabled = true;
    const { state: newState } = await chrome.runtime.sendMessage({ type: "console-stream-mcp/toggle", tabId });
    render(newState);
  });
}

init();
