import cron from "node-cron";

export function startScheduler(): void {
  // RSS feeds — every 3 minutes
  cron.schedule("*/3 * * * *", () => {
    // TODO: rssAggregator.run()
    console.log("[scheduler] RSS aggregator tick");
  });

  // PAGASA typhoon bulletins — every 30 minutes
  cron.schedule("*/30 * * * *", () => {
    // TODO: pagasaScraper.run()
    console.log("[scheduler] PAGASA scraper tick");
  });

  // PHIVOLCS earthquakes — every 5 minutes
  cron.schedule("*/5 * * * *", () => {
    // TODO: phivolcsScraper.run()
    console.log("[scheduler] PHIVOLCS scraper tick");
  });

  // BSP exchange rates — every 30 minutes
  cron.schedule("*/30 * * * *", () => {
    // TODO: bspScraper.run()
    console.log("[scheduler] BSP scraper tick");
  });

  // ACLED conflict events — every hour
  cron.schedule("0 * * * *", () => {
    // TODO: acledFetcher.run()
    console.log("[scheduler] ACLED fetcher tick");
  });

  // Score computation — every 10 minutes
  cron.schedule("*/10 * * * *", () => {
    // TODO: stabilityScorer.compute() + wpsTensionScorer.compute()
    console.log("[scheduler] Score computation tick");
  });

  console.log("[scheduler] All cron jobs registered");
}
