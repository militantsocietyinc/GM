// Drizzle ORM schema definitions
// These mirror the SQL migration in migrations/001_initial.sql

// TODO: Define drizzle-orm table schemas when ORM integration is ready
// For now, raw SQL queries via pg Pool are used

export const TABLES = {
  NEWS_ARTICLES: "news_articles",
  VESSEL_TRACKS: "vessel_tracks",
  WPS_INCIDENTS: "wps_incidents",
  TYPHOONS: "typhoons",
  EARTHQUAKES: "earthquakes",
  VOLCANO_STATUS: "volcano_status",
  STABILITY_SCORES: "stability_scores",
  WPS_TENSION_SCORES: "wps_tension_scores",
  ECONOMIC_DATA: "economic_data",
  FEED_STATUS: "feed_status",
  AI_SUMMARIES: "ai_summaries",
  CONFLICT_EVENTS: "conflict_events",
} as const;
