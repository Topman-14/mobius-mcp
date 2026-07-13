import { defineSetting } from "./storage.js";

export interface GeneralSettings {
  notifications: boolean;
}

export interface PerformanceSettings {
  bufferSize: number;
  autoClearMinutes: number;
}

export interface McpSettings {
  port: number;
  reconnectBaseDelayMs: number;
}

export interface DebugSettings {
  verboseLogs: boolean;
}

export const DEFAULT_GENERAL: GeneralSettings = { notifications: false };
export const DEFAULT_PERFORMANCE: PerformanceSettings = { bufferSize: 500, autoClearMinutes: 30 };
export const DEFAULT_MCP: McpSettings = { port: 7331, reconnectBaseDelayMs: 500 };
export const DEFAULT_DEBUG: DebugSettings = { verboseLogs: false };

export const generalSettings = defineSetting("generalSettings", DEFAULT_GENERAL);
export const performanceSettings = defineSetting("performanceSettings", DEFAULT_PERFORMANCE);
export const mcpSettings = defineSetting("mcpSettings", DEFAULT_MCP);
export const debugSettings = defineSetting("debugSettings", DEFAULT_DEBUG);
