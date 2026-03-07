/**
 * Base adapter with shared fetch logic, circuit breaker, and health tracking.
 */

import type { AUSourceAdapter, AUSourceHealth, AUEvent, AUEventCategory, AUState, AUSourceType } from '../types';

export abstract class BaseAUAdapter implements AUSourceAdapter {
  abstract id: string;
  abstract name: string;
  abstract category: AUEventCategory;
  abstract states: AUState[];
  abstract sourceType: AUSourceType;
  abstract attribution: string;
  abstract refreshIntervalMs: number;

  health: AUSourceHealth = {
    lastFetch: null,
    lastSuccess: null,
    lastError: null,
    consecutiveFailures: 0,
    itemCount: 0,
    avgLatencyMs: 0,
  };

  private _cache: AUEvent[] = [];
  private _cacheExpiry = 0;

  /** Subclasses implement this to do the actual fetch + parse */
  protected abstract fetchAndParse(): Promise<AUEvent[]>;

  async fetch(): Promise<AUEvent[]> {
    const now = Date.now();

    // Return cache if still fresh
    if (this._cache.length > 0 && now < this._cacheExpiry) {
      return this._cache;
    }

    // Circuit breaker: back off after repeated failures
    if (this.health.consecutiveFailures >= 5) {
      const backoffMs = Math.min(
        this.refreshIntervalMs * Math.pow(2, this.health.consecutiveFailures - 5),
        30 * 60 * 1000, // max 30 min
      );
      if (this.health.lastFetch && now - this.health.lastFetch.getTime() < backoffMs) {
        return this._cache;
      }
    }

    this.health.lastFetch = new Date();
    const start = performance.now();

    try {
      const events = await this.fetchAndParse();
      const latency = performance.now() - start;

      this.health.lastSuccess = new Date();
      this.health.lastError = null;
      this.health.consecutiveFailures = 0;
      this.health.itemCount = events.length;
      this.health.avgLatencyMs = this.health.avgLatencyMs
        ? (this.health.avgLatencyMs * 0.7 + latency * 0.3)
        : latency;

      this._cache = events;
      this._cacheExpiry = now + this.refreshIntervalMs;

      return events;
    } catch (err) {
      this.health.consecutiveFailures++;
      this.health.lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[AU:${this.id}] fetch failed (${this.health.consecutiveFailures}x): ${this.health.lastError}`);
      return this._cache; // return stale data
    }
  }
}
