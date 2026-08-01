import { EventEmitter } from "node:events";
import type { BrowserEvent, EventType } from "@mobius-mcp/capture-core";
import type { EventSink } from "../types.js";
import { MAX_EVENTS_PER_TAB } from "../data.js";
import { truncateEventFields } from "../utils/events.js";

class TabBuffer {
  private events: BrowserEvent[] = [];

  push(event: BrowserEvent): void {
    this.events.push(event);
    if (this.events.length > MAX_EVENTS_PER_TAB) {
      this.events.splice(0, this.events.length - MAX_EVENTS_PER_TAB);
    }
  }

  getRecent(types: EventType[], limit: number): BrowserEvent[] {
    return this.events.filter((e) => types.includes(e.type)).slice(-limit);
  }

  getSince(cursor: number, opts: { types?: EventType[]; limit?: number } = {}): { events: BrowserEvent[]; scannedTo: number } {
    let lo = 0;
    let hi = this.events.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.events[mid].seq > cursor) hi = mid;
      else lo = mid + 1;
    }
    const window = this.events.slice(lo);
    let events = opts.types ? window.filter((e) => opts.types!.includes(e.type)) : window;
    if (opts.limit && events.length > opts.limit) {
      events = events.slice(0, opts.limit);
      return { events, scannedTo: events[events.length - 1].seq };
    }
    return { events, scannedTo: window.length > 0 ? window[window.length - 1].seq : cursor };
  }

  clear(): void {
    this.events = [];
  }
}

export class EventStore {
  private buffers = new Map<string, TabBuffer>();
  private nextSeq = 1;
  private emitter = new EventEmitter();

  constructor(private persistence?: EventSink, hydrated?: Map<string, BrowserEvent[]>) {
    for (const [clientId, events] of hydrated ?? []) {
      const buffer = new TabBuffer();
      for (const event of events) {
        buffer.push(event);
        this.nextSeq = Math.max(this.nextSeq, event.seq + 1);
      }
      this.buffers.set(clientId, buffer);
    }
  }

  private bufferFor(clientId: string): TabBuffer {
    let buffer = this.buffers.get(clientId);
    if (!buffer) {
      buffer = new TabBuffer();
      this.buffers.set(clientId, buffer);
    }
    return buffer;
  }

  addEvent(event: Omit<BrowserEvent, "seq">): BrowserEvent {
    const stored = truncateEventFields({ ...event, seq: this.nextSeq++ } as BrowserEvent);
    this.bufferFor(event.clientId).push(stored);
    this.persistence?.append(stored);
    this.emitter.emit("event", stored);
    return stored;
  }

  onEvent(listener: (event: BrowserEvent) => void): () => void {
    this.emitter.on("event", listener);
    return () => this.emitter.off("event", listener);
  }

  getRecent(clientId: string, types: EventType[], limit: number): BrowserEvent[] {
    return this.buffers.get(clientId)?.getRecent(types, limit) ?? [];
  }

  getSince(clientId: string, cursor: number, opts: { types?: EventType[]; limit?: number } = {}): { events: BrowserEvent[]; cursor: number } {
    const result = this.buffers.get(clientId)?.getSince(cursor, opts);
    if (!result) return { events: [], cursor };
    return { events: result.events, cursor: result.scannedTo };
  }

  currentSeq(): number {
    return this.nextSeq - 1;
  }

  clear(clientId: string): void {
    this.buffers.get(clientId)?.clear();
    this.persistence?.clear(clientId);
  }

  deleteBuffer(clientId: string): void {
    this.buffers.delete(clientId);
    this.persistence?.remove(clientId);
  }
}
