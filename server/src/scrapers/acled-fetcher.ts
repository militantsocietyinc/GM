// TODO: Implement ACLED conflict/protest data fetcher
// API: https://acleddata.com/acled-api/
// Filter: country=Philippines

export async function fetchACLED(): Promise<void> {
  const token = process.env.ACLED_ACCESS_TOKEN;
  if (!token) {
    console.log("[acled] No access token configured, skipping");
    return;
  }
  // TODO: Fetch from ACLED API with PH filter
  // Store in conflict_events table
  console.log("[acled] Fetcher not yet implemented");
}
