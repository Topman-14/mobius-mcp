import { promises as fs } from "node:fs";
import * as path from "node:path";
import type { BrowserEvent } from "@mobius-mcp/capture-core";
import type { EventSink } from "../types.js";
import { MAX_EVENTS_PER_TAB, PERSISTENCE_DIR, PERSISTENCE_PRUNE_INTERVAL_MS, PERSISTENCE_TTL_MS } from "../data.js";

const FILE_SUFFIX = ".jsonl";
const FLUSH_INTERVAL_MS = 250;

export class EventPersistence implements EventSink {
  private queues = new Map<string, Promise<void>>();
  private pruneTimer: NodeJS.Timeout;
  private pendingLines = new Map<string, string[]>();
  private flushTimer: NodeJS.Timeout | undefined;
  private ready: Promise<unknown>;

  constructor(private dir: string = PERSISTENCE_DIR, private ttlMs: number = PERSISTENCE_TTL_MS) {
    this.ready = fs.mkdir(this.dir, { recursive: true }).catch(() => {});
    this.pruneTimer = setInterval(() => void this.prune(), PERSISTENCE_PRUNE_INTERVAL_MS);
    this.pruneTimer.unref();
  }

  private fileFor(clientId: string): string {
    return path.join(this.dir, `${clientId}${FILE_SUFFIX}`);
  }

  private enqueue(clientId: string, task: () => Promise<void>): void {
    const next = (this.queues.get(clientId) ?? Promise.resolve()).then(task, task).catch(() => {});
    this.queues.set(clientId, next);
  }

  append(event: BrowserEvent): void {
    let lines = this.pendingLines.get(event.clientId);
    if (!lines) {
      lines = [];
      this.pendingLines.set(event.clientId, lines);
    }
    lines.push(JSON.stringify(event) + "\n");
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), FLUSH_INTERVAL_MS);
      this.flushTimer.unref();
    }
  }

  private flush(): void {
    this.flushTimer = undefined;
    for (const [clientId, lines] of this.pendingLines) {
      this.enqueue(clientId, async () => {
        await this.ready;
        await fs.appendFile(this.fileFor(clientId), lines.join(""));
      });
    }
    this.pendingLines = new Map();
  }

  remove(clientId: string): void {
    this.pendingLines.delete(clientId);
    this.enqueue(clientId, async () => {
      await fs.rm(this.fileFor(clientId), { force: true });
    });
  }

  clear(clientId: string): void {
    this.remove(clientId);
  }

  async loadAll(): Promise<Map<string, BrowserEvent[]>> {
    await fs.mkdir(this.dir, { recursive: true });
    const files = await fs.readdir(this.dir).catch(() => []);
    const result = new Map<string, BrowserEvent[]>();

    for (const file of files) {
      if (!file.endsWith(FILE_SUFFIX)) continue;
      const clientId = file.slice(0, -FILE_SUFFIX.length);
      const events = await this.readEvents(path.join(this.dir, file));
      if (events.length > 0) result.set(clientId, events.slice(-MAX_EVENTS_PER_TAB));
      else await fs.rm(path.join(this.dir, file), { force: true }).catch(() => {});
    }
    return result;
  }

  private async readEvents(filePath: string): Promise<BrowserEvent[]> {
    const cutoff = Date.now() - this.ttlMs;
    const raw = await fs.readFile(filePath, "utf8").catch(() => "");
    const events: BrowserEvent[] = [];
    for (const line of raw.split("\n")) {
      if (!line) continue;
      try {
        const event = JSON.parse(line) as BrowserEvent;
        if (event.timestamp >= cutoff) events.push(event);
      } catch {
      }
    }
    return events;
  }

  private async prune(): Promise<void> {
    const files = await fs.readdir(this.dir).catch(() => []);
    for (const file of files) {
      if (!file.endsWith(FILE_SUFFIX)) continue;
      const clientId = file.slice(0, -FILE_SUFFIX.length);
      const filePath = path.join(this.dir, file);
      this.enqueue(clientId, async () => {
        const events = (await this.readEvents(filePath)).slice(-MAX_EVENTS_PER_TAB);
        if (events.length === 0) await fs.rm(filePath, { force: true }).catch(() => {});
        else await fs.writeFile(filePath, events.map((e) => JSON.stringify(e)).join("\n") + "\n");
      });
    }
  }

  close(): void {
    clearTimeout(this.flushTimer);
    this.flush();
    clearInterval(this.pruneTimer);
  }
}
