/**
 * Event Bus — Decoupled communication backbone for the agent system.
 *
 * Replaces direct method calls between services with typed pub/sub.
 * Supports sync handlers, async handlers, wildcards, and replay.
 */

import type { BusEvent, BusEventType, BusHandler } from '../types';

interface Subscription {
  id: number;
  type: BusEventType | '*';
  handler: BusHandler;
  once: boolean;
}

export class EventBus {
  private subscriptions: Subscription[] = [];
  private nextId = 0;
  private history: BusEvent[] = [];
  private maxHistory = 500;
  private paused = false;
  private queue: BusEvent[] = [];

  /**
   * Subscribe to a specific event type.
   * Returns an unsubscribe function.
   */
  on<T>(type: BusEventType | '*', handler: BusHandler<T>): () => void {
    const id = this.nextId++;
    this.subscriptions.push({
      id,
      type,
      handler: handler as BusHandler,
      once: false,
    });
    return () => {
      this.subscriptions = this.subscriptions.filter(s => s.id !== id);
    };
  }

  /**
   * Subscribe once — handler auto-removes after first invocation.
   */
  once<T>(type: BusEventType, handler: BusHandler<T>): () => void {
    const id = this.nextId++;
    this.subscriptions.push({
      id,
      type,
      handler: handler as BusHandler,
      once: true,
    });
    return () => {
      this.subscriptions = this.subscriptions.filter(s => s.id !== id);
    };
  }

  /**
   * Emit an event. Handlers are called synchronously for sync handlers,
   * and errors in one handler don't prevent others from running.
   */
  emit<T>(type: BusEventType, payload: T, source: string): void {
    const event: BusEvent<T> = {
      type,
      payload,
      timestamp: Date.now(),
      source,
    };

    // Record history
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

  /**
   * Pause event delivery — events queue up until resume().
   */
  pause(): void {
    this.paused = true;
  }

  /**
   * Resume event delivery and flush queued events.
   */
  resume(): void {
    this.paused = false;
    const queued = [...this.queue];
    this.queue = [];
    for (const event of queued) {
      this.dispatch(event);
    }
  }

  /**
   * Get event history, optionally filtered by type.
   */
  getHistory(type?: BusEventType): BusEvent[] {
    if (!type) return [...this.history];
    return this.history.filter(e => e.type === type);
  }

  /**
   * Replay recent events to a new subscriber.
   */
  replay(type: BusEventType, handler: BusHandler, limit = 50): void {
    const events = this.getHistory(type).slice(-limit);
    for (const event of events) {
      try {
        handler(event);
      } catch {
        // Replay errors are silently ignored
      }
    }
  }

  /**
   * Remove all subscriptions.
   */
  clear(): void {
    this.subscriptions = [];
    this.history = [];
    this.queue = [];
  }

  /**
   * How many active subscriptions exist.
   */
  get subscriberCount(): number {
    return this.subscriptions.length;
  }

  private dispatch(event: BusEvent): void {
    const toRemove: number[] = [];

    for (const sub of this.subscriptions) {
      if (sub.type !== '*' && sub.type !== event.type) continue;

      try {
        const result = sub.handler(event);
        // If handler returns a promise, catch errors but don't await
        if (result && typeof (result as Promise<void>).catch === 'function') {
          (result as Promise<void>).catch(err => {
            console.error(`[EventBus] Async handler error for ${event.type}:`, err);
          });
        }
      } catch (err) {
        console.error(`[EventBus] Handler error for ${event.type}:`, err);
      }

      if (sub.once) {
        toRemove.push(sub.id);
      }
    }

    if (toRemove.length > 0) {
      this.subscriptions = this.subscriptions.filter(
        s => !toRemove.includes(s.id)
      );
    }
  }
}

/** Singleton event bus for the agent system */
export const agentBus = new EventBus();
