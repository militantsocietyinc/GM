import Parser from "rss-parser";
import { CircuitBreaker } from "../services/circuit-breaker.js";

const parser = new Parser({ timeout: 10_000 });

interface FeedConfig {
  id: string;
  name: string;
  url: string;
  tier: number;
  category: string;
}

const breakers = new Map<string, CircuitBreaker>();

function getBreaker(feedId: string): CircuitBreaker {
  if (!breakers.has(feedId)) {
    breakers.set(feedId, new CircuitBreaker(feedId));
  }
  return breakers.get(feedId)!;
}

export async function fetchFeed(feed: FeedConfig): Promise<void> {
  const breaker = getBreaker(feed.id);
  if (!breaker.canExecute()) return;

  try {
    const result = await parser.parseURL(feed.url);
    breaker.recordSuccess();

    for (const item of result.items) {
      if (!item.link || !item.title) continue;
      // TODO: Insert into news_articles table with deduplication by URL hash
      void item;
    }
  } catch (err) {
    breaker.recordFailure();
    console.error(`[rss] Failed to fetch ${feed.name}:`, err);
  }
}

export async function runAggregator(feeds: FeedConfig[]): Promise<void> {
  const batchSize = 10;
  for (let i = 0; i < feeds.length; i += batchSize) {
    const batch = feeds.slice(i, i + batchSize);
    await Promise.allSettled(batch.map(fetchFeed));
  }
}
