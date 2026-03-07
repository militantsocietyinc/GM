import type { ApiClient } from "../services/api-client";
import type { EconomicDataPoint } from "@bantay-pilipinas/shared";

export class MarketPanel {
  private api: ApiClient;

  constructor(api: ApiClient) {
    this.api = api;
  }

  render(): HTMLElement {
    const el = document.createElement("section");
    el.className = "panel panel-market";
    el.innerHTML = `
      <div class="panel-header">
        <h2 class="panel-title">Economic Pulse</h2>
      </div>
      <div class="panel-body">
        <div id="market-indicators">
          <p class="panel-placeholder">Loading economic data...</p>
        </div>
      </div>
    `;
    this.load(el);
    return el;
  }

  private async load(el: HTMLElement): Promise<void> {
    try {
      const response = await this.api.getMarket();
      const container = el.querySelector("#market-indicators")!;
      if (response.data.length === 0) {
        container.innerHTML = '<p class="panel-placeholder">No data available</p>';
        return;
      }
      container.innerHTML = response.data
        .slice(0, 10)
        .map(
          (d: EconomicDataPoint) => `
          <div class="market-item">
            <span class="market-label">${d.indicator}</span>
            <span class="market-value">${d.currency === "PHP" ? "₱" : "$"}${d.value.toLocaleString()}</span>
          </div>
        `
        )
        .join("");
    } catch {
      // Backend not yet available
    }
  }
}
