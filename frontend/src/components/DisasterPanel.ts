import type { ApiClient } from "../services/api-client";
import type { Typhoon, Earthquake, VolcanoStatus } from "@bantay-pilipinas/shared";
import { escapeHtml } from "../utils/sanitize";

export class DisasterPanel {
  private api: ApiClient;

  constructor(api: ApiClient) {
    this.api = api;
  }

  render(): HTMLElement {
    const el = document.createElement("section");
    el.className = "panel panel-disaster";
    el.innerHTML = `
      <div class="panel-header">
        <h2 class="panel-title">Disaster Monitor</h2>
      </div>
      <div class="panel-body">
        <div class="disaster-section">
          <h3>Active Typhoons</h3>
          <div id="typhoon-list"><p class="panel-placeholder">No active typhoons</p></div>
        </div>
        <div class="disaster-section">
          <h3>Recent Earthquakes</h3>
          <div id="earthquake-list"><p class="panel-placeholder">Loading...</p></div>
        </div>
        <div class="disaster-section">
          <h3>Volcano Status</h3>
          <div id="volcano-list"><p class="panel-placeholder">Loading...</p></div>
        </div>
      </div>
    `;
    this.load(el);
    return el;
  }

  private async load(el: HTMLElement): Promise<void> {
    try {
      const response = await this.api.getDisaster();
      const { typhoons, earthquakes, volcanoes } = response.data;

      const typhoonList = el.querySelector("#typhoon-list")!;
      if (typhoons.length > 0) {
        typhoonList.innerHTML = typhoons
          .map((t: Typhoon) => {
            const name = t.localName
              ? `${escapeHtml(t.localName)} (${escapeHtml(t.internationalName || "")})`
              : escapeHtml(t.internationalName || t.id);
            return `<div class="disaster-item">${name} — ${t.maxWindKph || "?"}kph</div>`;
          })
          .join("");
      }

      const eqList = el.querySelector("#earthquake-list")!;
      if (earthquakes.length > 0) {
        eqList.innerHTML = earthquakes
          .slice(0, 5)
          .map((e: Earthquake) => `<div class="disaster-item">M${e.magnitude} — ${escapeHtml(e.locationText || "Unknown")}</div>`)
          .join("");
      } else {
        eqList.innerHTML = '<p class="panel-placeholder">No recent earthquakes</p>';
      }

      const volList = el.querySelector("#volcano-list")!;
      if (volcanoes.length > 0) {
        volList.innerHTML = volcanoes
          .map((v: VolcanoStatus) => `<div class="disaster-item">${escapeHtml(v.name)} — Alert Level ${v.alertLevel}</div>`)
          .join("");
      } else {
        volList.innerHTML = '<p class="panel-placeholder">All quiet</p>';
      }
    } catch {
      // Backend not yet available
    }
  }
}
