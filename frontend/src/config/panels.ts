export interface PanelConfig {
  id: string;
  title: string;
  category: string;
  refreshMs: number;
  defaultOpen: boolean;
}

export const PANEL_CONFIGS: PanelConfig[] = [
  { id: "news", title: "National News", category: "intelligence", refreshMs: 180_000, defaultOpen: true },
  { id: "wps", title: "West Philippine Sea", category: "maritime", refreshMs: 60_000, defaultOpen: true },
  { id: "disaster", title: "Disaster Monitor", category: "safety", refreshMs: 300_000, defaultOpen: true },
  { id: "market", title: "Economic Pulse", category: "economy", refreshMs: 60_000, defaultOpen: false },
  { id: "stability", title: "Stability Index", category: "risk", refreshMs: 600_000, defaultOpen: true },
  { id: "insights", title: "AI Insights", category: "intelligence", refreshMs: 900_000, defaultOpen: false },
  { id: "military", title: "Defense & Military", category: "security", refreshMs: 300_000, defaultOpen: false },
  { id: "infrastructure", title: "Infrastructure", category: "infrastructure", refreshMs: 300_000, defaultOpen: false },
  { id: "ofw", title: "OFW & Diaspora", category: "social", refreshMs: 600_000, defaultOpen: false },
];
