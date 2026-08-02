import { AsyncLocalStorage } from "node:async_hooks";
import { LOCAL_SESSION_ID } from "../data.js";

const storage = new AsyncLocalStorage<string>();

export function runInSession<T>(sessionId: string, fn: () => T): T {
  return storage.run(sessionId, fn);
}

export function currentSessionId(): string {
  return storage.getStore() ?? LOCAL_SESSION_ID;
}
