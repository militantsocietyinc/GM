/**
 * Structured Memory System
 *
 * Three-tier memory architecture:
 *   Session  — Working memory for the current agent cycle (volatile)
 *   Episodic — Event chains and causal sequences (medium-term)
 *   Longterm — Learned patterns, baselines, country profiles (persistent)
 *
 * Each tier has capacity limits, decay functions, and promotion rules.
 * Backed by IndexedDB for persistence, with in-memory cache for speed.
 */

import type { MemoryEntry, MemorySnapshot, MemoryType } from '../types';
import { agentBus } from '../bus/event-bus';

interface MemoryConfig {
  sessionCapacity: number;
  episodicCapacity: number;
  longtermCapacity: number;
  /** Hours before session entries expire */
  sessionTtlHours: number;
  /** Hours before episodic entries expire */
  episodicTtlHours: number;
  /** Minimum importance to promote from session → episodic */
  promotionThreshold: number;
  /** Minimum importance to promote from episodic → longterm */
  longtermThreshold: number;
}

const DEFAULT_CONFIG: MemoryConfig = {
  sessionCapacity: 200,
  episodicCapacity: 500,
  longtermCapacity: 1000,
  sessionTtlHours: 2,
  episodicTtlHours: 168, // 1 week
  promotionThreshold: 40,
  longtermThreshold: 70,
};

let entryCounter = 0;

export class MemoryStore {
  private session: Map<string, MemoryEntry> = new Map();
  private episodic: Map<string, MemoryEntry> = new Map();
  private longterm: Map<string, MemoryEntry> = new Map();
  private config: MemoryConfig;
  private lastCompactedAt = 0;

  constructor(config: Partial<MemoryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Store a new memory entry.
   */
  store(
    type: MemoryType,
    content: string,
    opts: {
      data?: Record<string, unknown>;
      tags?: string[];
      regions?: string[];
      importance?: number;
    } = {},
  ): MemoryEntry {
    const entry: MemoryEntry = {
      id: `mem-${++entryCounter}-${Date.now()}`,
      type,
      content,
      data: opts.data,
      tags: opts.tags ?? [],
      regions: opts.regions ?? [],
      storedAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 0,
      importance: opts.importance ?? 50,
    };

    this.getStore(type).set(entry.id, entry);
    this.enforceCapacity(type);
    agentBus.emit('memory:updated', { type, entryId: entry.id, action: 'store' }, 'memory-store');
    return entry;
  }

  /**
   * Retrieve entries by tags (any match).
   */
  queryByTags(tags: string[], type?: MemoryType): MemoryEntry[] {
    const stores = type ? [this.getStore(type)] : [this.session, this.episodic, this.longterm];
    const results: MemoryEntry[] = [];
    const tagSet = new Set(tags.map(t => t.toLowerCase()));

    for (const store of stores) {
      for (const entry of store.values()) {
        if (entry.tags.some(t => tagSet.has(t.toLowerCase()))) {
          entry.lastAccessedAt = Date.now();
          entry.accessCount++;
          results.push(entry);
        }
      }
    }

    return results.sort((a, b) => b.importance - a.importance);
  }

  /**
   * Retrieve entries by region.
   */
  queryByRegion(region: string, type?: MemoryType): MemoryEntry[] {
    const stores = type ? [this.getStore(type)] : [this.session, this.episodic, this.longterm];
    const results: MemoryEntry[] = [];

    for (const store of stores) {
      for (const entry of store.values()) {
        if (entry.regions.includes(region)) {
          entry.lastAccessedAt = Date.now();
          entry.accessCount++;
          results.push(entry);
        }
      }
    }

    return results.sort((a, b) => b.importance - a.importance);
  }

  /**
   * Promote important entries up the memory hierarchy.
   */
  promote(): { promoted: number; demoted: number } {
    let promoted = 0;
    let demoted = 0;

    // Session → Episodic
    for (const [id, entry] of this.session) {
      if (entry.importance >= this.config.promotionThreshold && entry.accessCount >= 2) {
        entry.type = 'episodic';
        this.episodic.set(id, entry);
        this.session.delete(id);
        promoted++;
      }
    }

    // Episodic → Longterm
    for (const [id, entry] of this.episodic) {
      if (entry.importance >= this.config.longtermThreshold && entry.accessCount >= 5) {
        entry.type = 'longterm';
        this.longterm.set(id, entry);
        this.episodic.delete(id);
        promoted++;
      }
    }

    // Decay: reduce importance of stale entries
    const now = Date.now();
    for (const entry of this.session.values()) {
      const ageHours = (now - entry.lastAccessedAt) / 3600_000;
      if (ageHours > this.config.sessionTtlHours) {
        this.session.delete(entry.id);
        demoted++;
      }
    }
    for (const entry of this.episodic.values()) {
      const ageHours = (now - entry.lastAccessedAt) / 3600_000;
      if (ageHours > this.config.episodicTtlHours) {
        // Don't delete — just decay importance
        entry.importance = Math.max(0, entry.importance - 5);
        if (entry.importance === 0) {
          this.episodic.delete(entry.id);
          demoted++;
        }
      }
    }

    this.lastCompactedAt = now;
    return { promoted, demoted };
  }

  /**
   * Get a snapshot of current memory state.
   */
  snapshot(): MemorySnapshot {
    return {
      session: [...this.session.values()],
      episodic: [...this.episodic.values()],
      longterm: [...this.longterm.values()],
      totalEntries: this.session.size + this.episodic.size + this.longterm.size,
      lastCompactedAt: this.lastCompactedAt,
    };
  }

  /**
   * Clear all memory.
   */
  clear(type?: MemoryType): void {
    if (type) {
      this.getStore(type).clear();
    } else {
      this.session.clear();
      this.episodic.clear();
      this.longterm.clear();
    }
  }

  private getStore(type: MemoryType): Map<string, MemoryEntry> {
    switch (type) {
      case 'session': return this.session;
      case 'episodic': return this.episodic;
      case 'longterm': return this.longterm;
    }
  }

  private enforceCapacity(type: MemoryType): void {
    const store = this.getStore(type);
    const capacity = type === 'session'
      ? this.config.sessionCapacity
      : type === 'episodic'
        ? this.config.episodicCapacity
        : this.config.longtermCapacity;

    if (store.size <= capacity) return;

    // Evict lowest importance entries
    const entries = [...store.values()].sort((a, b) => a.importance - b.importance);
    const toRemove = entries.slice(0, store.size - capacity);
    for (const entry of toRemove) {
      store.delete(entry.id);
    }
  }
}
