import { ApiClient } from "./services/api-client";
import { MapContainer } from "./components/MapContainer";
import { NewsPanel } from "./components/NewsPanel";
import { WPSPanel } from "./components/WPSPanel";
import { DisasterPanel } from "./components/DisasterPanel";
import { MarketPanel } from "./components/MarketPanel";
import { StabilityPanel } from "./components/StabilityPanel";
import { InsightsPanel } from "./components/InsightsPanel";

export class App {
  private container: HTMLElement;
  private api: ApiClient;
  private panels: Map<string, HTMLElement> = new Map();

  constructor(container: HTMLElement) {
    this.container = container;
    this.api = new ApiClient();
  }

  async init(): Promise<void> {
    this.container.innerHTML = "";
    this.renderLayout();
    this.initMap();
    this.initPanels();
    this.registerKeyboardShortcuts();
    this.startPolling();
  }

  private renderLayout(): void {
    const layout = document.createElement("div");
    layout.className = "app-layout";
    layout.innerHTML = `
      <header class="app-header">
        <h1 class="app-title">BANTAY PILIPINAS</h1>
        <div class="header-controls">
          <span class="status-indicator" id="connection-status">LIVE</span>
        </div>
      </header>
      <main class="app-main">
        <div class="map-area" id="map-container"></div>
        <aside class="panel-sidebar" id="panel-sidebar"></aside>
      </main>
    `;
    this.container.appendChild(layout);
  }

  private initMap(): void {
    const mapEl = document.getElementById("map-container");
    if (mapEl) {
      new MapContainer(mapEl);
    }
  }

  private initPanels(): void {
    const sidebar = document.getElementById("panel-sidebar");
    if (!sidebar) return;

    const panelConfigs = [
      { id: "news", component: NewsPanel },
      { id: "wps", component: WPSPanel },
      { id: "disaster", component: DisasterPanel },
      { id: "market", component: MarketPanel },
      { id: "stability", component: StabilityPanel },
      { id: "insights", component: InsightsPanel },
    ];

    for (const config of panelConfigs) {
      const panel = new config.component(this.api);
      const el = panel.render();
      sidebar.appendChild(el);
      this.panels.set(config.id, el);
    }
  }

  private registerKeyboardShortcuts(): void {
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        // TODO: open search modal
      }
    });
  }

  private startPolling(): void {
    // TODO: set up polling intervals for each data type
  }
}
