import { Terminal, WarningCircle, Globe, Pulse } from "@phosphor-icons/react";
import type { ConnectionStatus, EventCounters } from "../../hooks/use-popup-port.js";

export const WS_URL = "ws://localhost:7331";
export const REPO_URL = "https://github.com/Topman-14/console-stream-mcp";

export const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connected: "Connected",
  connecting: "Connecting",
  disconnected: "Disconnected",
};

export const STATUS_DOT: Record<ConnectionStatus, string> = {
  connected: "bg-success",
  connecting: "bg-warning animate-pulse",
  disconnected: "bg-muted-foreground",
};

export const COUNTER_ITEMS: Array<{ key: keyof EventCounters; label: string; icon: typeof Terminal; tone: string }> = [
  { key: "console", label: "Console", icon: Terminal, tone: "text-foreground" },
  { key: "errors", label: "Errors", icon: WarningCircle, tone: "text-destructive" },
  { key: "network", label: "Network", icon: Globe, tone: "text-foreground" },
  { key: "runtime", label: "Runtime", icon: Pulse, tone: "text-foreground" },
];

export const KIND_DOT: Record<keyof EventCounters, string> = {
  console: "bg-foreground/50",
  errors: "bg-destructive",
  network: "bg-primary",
  runtime: "bg-warning",
};
