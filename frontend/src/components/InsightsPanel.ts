import type { ApiClient } from "../services/api-client";

export class InsightsPanel {
  private api: ApiClient;

  constructor(api: ApiClient) {
    this.api = api;
  }

  render(): HTMLElement {
    const el = document.createElement("section");
    el.className = "panel panel-insights";
    el.innerHTML = `
      <div class="panel-header">
        <h2 class="panel-title">AI Insights</h2>
      </div>
      <div class="panel-body">
        <p class="panel-placeholder">AI briefing will appear here when backend is connected.</p>
      </div>
    `;
    void this.api;
    return el;
  }
}
