/**
 * Event Bus — Decoupled pub/sub backbone for the agent system.
 * Optimized: Map-based subscriptions for O(1) unsubscribe.
 */

import type { BusEvent, BusEventType, BusHandler } from '../types';

export class EventBus {
  private subs = new Map<number, { type: BusEventType | '*'; handler: BusHandler; once: boolean }>();
  private nextId = 0;
  private history: BusEvent[] = [];
  private maxHistory = 500;
  private paused = false;
  private queue: BusEvent[] = [];

  on<T>(type: BusEventType | '*', handler: BusHandler<T>): () => void {
    const id = this.nextId++;
    this.subs.set(id, { type, handler: handler as BusHandler, once: false });
    return () => { this.subs.delete(id); };
  }

  once<T>(type: BusEventType, handler: BusHandler<T>): () => void {
    const id = this.nextId++;
    this.subs.set(id, { type, handler: handler as BusHandler, once: true });
    return () => { this.subs.delete(id); };
  }

  emit<T>(type: BusEventType, payload: T, source: string): void {
    const event: BusEvent<T> = { type, payload, timestamp: Date.now(), source };

    this.history.push(event as BusEvent);
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }

    if (this.paused) {
      this.queue.push(event as BusEvent);
      return;
    }
    this.dispatch(event as BusEvent);
  }

  pause(): void { this.paused = true; }

  resume(): void {
    this.paused = false;
    const queued = this.queue.splice(0);
    for (const event of queued) this.dispatch(event);
  }

  getHistory(type?: BusEventType): BusEvent[] {
    if (!type) return [...this.history];
    return this.history.filter(e => e.type === type);
  }

  replay(type: BusEventType, handler: BusHandler, limit = 50): void {
    for (const event of this.getHistory(type).slice(-limit)) {
      try { handler(event); } catch { /* replay errors ignored */ }
    }
  }

  clear(): void {
    this.subs.clear();
    this.history = [];
    this.queue = [];
  }

  get subscriberCount(): number { return this.subs.size; }

  private dispatch(event: BusEvent): void {
    const toRemove: number[] = [];

    for (const [id, sub] of this.subs) {
      if (sub.type !== '*' && sub.type !== event.type) continue;
      try {
        const result = sub.handler(event);
        if (result && typeof (result as Promise<void>).catch === 'function') {
          (result as Promise<void>).catch(() => {});
        }
      } catch { /* handler errors don't propagate */ }
      if (sub.once) toRemove.push(id);
    }

    for (const id of toRemove) this.subs.delete(id);
  }
}

export const agentBus = new EventBus();
