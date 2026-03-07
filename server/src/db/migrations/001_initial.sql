-- News articles from RSS scrapers
CREATE TABLE news_articles (
  id SERIAL PRIMARY KEY,
  url_hash VARCHAR(64) UNIQUE NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  source VARCHAR(100) NOT NULL,
  source_tier SMALLINT NOT NULL DEFAULT 4,
  category VARCHAR(50) NOT NULL DEFAULT 'national-politics',
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  entities JSONB DEFAULT '[]',
  sentiment VARCHAR(20) DEFAULT 'neutral',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_news_category ON news_articles(category);
CREATE INDEX idx_news_published ON news_articles(published_at DESC);
CREATE INDEX idx_news_fetched ON news_articles(fetched_at DESC);

-- AIS vessel position snapshots
CREATE TABLE vessel_tracks (
  id BIGSERIAL PRIMARY KEY,
  mmsi INTEGER NOT NULL,
  name VARCHAR(100),
  classification VARCHAR(30) NOT NULL DEFAULT 'unknown',
  flag_state VARCHAR(10),
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  heading REAL,
  speed REAL,
  in_eez BOOLEAN NOT NULL DEFAULT false,
  near_feature VARCHAR(50),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_vessel_mmsi ON vessel_tracks(mmsi);
CREATE INDEX idx_vessel_recorded ON vessel_tracks(recorded_at DESC);
CREATE INDEX idx_vessel_eez ON vessel_tracks(in_eez) WHERE in_eez = true;

-- WPS incidents (intrusions, confrontations, diplomatic protests)
CREATE TABLE wps_incidents (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  location VARCHAR(100) NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  description TEXT,
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  vessels JSONB DEFAULT '[]',
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX idx_wps_incidents_detected ON wps_incidents(detected_at DESC);

-- PAGASA typhoon data
CREATE TABLE typhoons (
  id VARCHAR(20) PRIMARY KEY,
  international_name VARCHAR(50),
  local_name VARCHAR(50),
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  max_wind_kph INTEGER,
  signal_areas JSONB DEFAULT '{}',
  forecast_track JSONB DEFAULT '[]',
  impact_score REAL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PHIVOLCS earthquake bulletins
CREATE TABLE earthquakes (
  id SERIAL PRIMARY KEY,
  magnitude REAL NOT NULL,
  depth_km REAL,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  location_text TEXT,
  intensity SMALLINT,
  tsunami_advisory BOOLEAN NOT NULL DEFAULT false,
  source VARCHAR(20) NOT NULL DEFAULT 'phivolcs',
  occurred_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_earthquakes_occurred ON earthquakes(occurred_at DESC);
CREATE INDEX idx_earthquakes_magnitude ON earthquakes(magnitude DESC);

-- Volcano alert status
CREATE TABLE volcano_status (
  id VARCHAR(30) PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  alert_level SMALLINT NOT NULL DEFAULT 0,
  alert_description TEXT,
  observations TEXT[],
  last_bulletin_at TIMESTAMPTZ
);

-- Pre-computed stability scores (time-series)
CREATE TABLE stability_scores (
  id SERIAL PRIMARY KEY,
  region_id VARCHAR(20) NOT NULL,
  score REAL NOT NULL,
  components JSONB NOT NULL,
  boosts JSONB DEFAULT '{}',
  level VARCHAR(20) NOT NULL,
  trend VARCHAR(20) NOT NULL DEFAULT 'stable',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_stability_region ON stability_scores(region_id, computed_at DESC);

-- WPS tension score (time-series)
CREATE TABLE wps_tension_scores (
  id SERIAL PRIMARY KEY,
  score REAL NOT NULL,
  components JSONB NOT NULL,
  level VARCHAR(20) NOT NULL,
  trend VARCHAR(20) NOT NULL DEFAULT 'stable',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_wps_tension_computed ON wps_tension_scores(computed_at DESC);

-- Economic indicators (BSP, PSE)
CREATE TABLE economic_data (
  id SERIAL PRIMARY KEY,
  indicator VARCHAR(50) NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  currency VARCHAR(10) DEFAULT 'PHP',
  source VARCHAR(20) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_economic_indicator ON economic_data(indicator, recorded_at DESC);

-- Feed health tracking
CREATE TABLE feed_status (
  id SERIAL PRIMARY KEY,
  feed_url TEXT UNIQUE NOT NULL,
  feed_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  cooldown_until TIMESTAMPTZ
);

-- AI summary cache
CREATE TABLE ai_summaries (
  id SERIAL PRIMARY KEY,
  headlines_hash VARCHAR(64) UNIQUE NOT NULL,
  provider VARCHAR(30) NOT NULL,
  summary_text TEXT NOT NULL,
  focal_points JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_ai_summaries_hash ON ai_summaries(headlines_hash);

-- ACLED conflict/protest events
CREATE TABLE conflict_events (
  id SERIAL PRIMARY KEY,
  acled_id INTEGER UNIQUE,
  event_type VARCHAR(50) NOT NULL,
  sub_event_type VARCHAR(50),
  location VARCHAR(200),
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  fatalities INTEGER DEFAULT 0,
  notes TEXT,
  source VARCHAR(200),
  event_date DATE NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_conflict_date ON conflict_events(event_date DESC);
