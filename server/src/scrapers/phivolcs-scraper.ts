// TODO: Implement PHIVOLCS earthquake and volcano scraper
// Sources:
// - https://earthquake.phivolcs.dost.gov.ph/
// - Volcano bulletin pages

export async function scrapePHIVOLCS(): Promise<void> {
  // TODO: Use cheerio to parse earthquake bulletin table
  // Extract: magnitude, depth, location, intensity, time
  // Store in earthquakes table
  console.log("[phivolcs] Scraper not yet implemented");
}

export async function scrapeVolcanoStatus(): Promise<void> {
  // TODO: Parse volcano alert level pages
  // Store in volcano_status table
  console.log("[phivolcs] Volcano status scraper not yet implemented");
}
