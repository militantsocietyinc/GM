import type { ApiClient } from "../services/api-client";

export class WPSPanel {
  private api: ApiClient;

  constructor(api: ApiClient) {
    this.api = api;
  }

  render(): HTMLElement {
    const el = document.createElement("section");
    el.className = "panel panel-wps";
    el.innerHTML = `
      <div class="panel-header">
        <h2 class="panel-title">West Philippine Sea</h2>
        <span class="panel-badge wps">WPS</span>
      </div>
      <div class="panel-body">
        <div class="tension-score">
          <span class="score-label">Tension Score</span>
          <span class="score-value" id="wps-tension-value">--</span>
        </div>
        <div class="vessel-summary" id="wps-vessel-summary">
          <p class="panel-placeholder">Loading vessel data...</p>
        </div>
      </div>
    `;
    this.load(el);
    return el;
  }

  private async load(el: HTMLElement): Promise<void> {
    try {
      const tension = await this.api.getWPSTension();
      const scoreEl = el.querySelector("#wps-tension-value");
      if (scoreEl) scoreEl.textContent = tension.data.score.toFixed(1);
    } catch {
      // Backend not yet available
    }
  }
}
