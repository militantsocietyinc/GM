import type { ApiClient } from "../services/api-client";
import type { RegionalStabilityScore } from "@bantay-pilipinas/shared";
import { escapeHtml } from "../utils/sanitize";

export class StabilityPanel {
  private api: ApiClient;

  constructor(api: ApiClient) {
    this.api = api;
  }

  render(): HTMLElement {
    const el = document.createElement("section");
    el.className = "panel panel-stability";
    el.innerHTML = `
      <div class="panel-header">
        <h2 class="panel-title">Stability Index</h2>
      </div>
      <div class="panel-body" id="stability-body">
        <p class="panel-placeholder">Loading regional scores...</p>
      </div>
    `;
    this.load(el);
    return el;
  }

  private async load(el: HTMLElement): Promise<void> {
    try {
      const response = await this.api.getRiskScores();
      const body = el.querySelector("#stability-body")!;

      const regionHtml = response.data.regions
        .map(
          (r: RegionalStabilityScore) => `
          <div class="stability-region">
            <span class="region-id">${escapeHtml(r.regionId.toUpperCase())}</span>
            <span class="region-score level-${r.level}">${r.score.toFixed(1)}</span>
            <span class="region-trend trend-${r.trend}">${r.trend}</span>
          </div>
        `
        )
        .join("");

      body.innerHTML = `
        <div class="wps-tension-summary">
          <span>WPS Tension</span>
          <span class="score-value level-${response.data.wpsTension.level}">
            ${response.data.wpsTension.score.toFixed(1)}
          </span>
        </div>
        <div class="stability-regions">${regionHtml}</div>
      `;
    } catch {
      // Backend not yet available
    }
  }
}
