import type { ApiClient } from "../services/api-client";
import type { NewsArticle } from "@bantay-pilipinas/shared";
import { escapeHtml } from "../utils/sanitize";

export class NewsPanel {
  private api: ApiClient;

  constructor(api: ApiClient) {
    this.api = api;
  }

  render(): HTMLElement {
    const el = document.createElement("section");
    el.className = "panel panel-news";
    el.innerHTML = `
      <div class="panel-header">
        <h2 class="panel-title">National News</h2>
        <span class="panel-badge">LIVE</span>
      </div>
      <div class="panel-body">
        <p class="panel-placeholder">Loading news feeds...</p>
      </div>
    `;
    this.load(el);
    return el;
  }

  private async load(el: HTMLElement): Promise<void> {
    try {
      const response = await this.api.getNews();
      const body = el.querySelector(".panel-body")!;
      if (response.data.length === 0) {
        body.innerHTML = '<p class="panel-placeholder">No articles yet</p>';
        return;
      }
      body.innerHTML = response.data
        .slice(0, 20)
        .map(
          (a: NewsArticle) => `
          <div class="news-item">
            <a href="${escapeHtml(a.url)}" target="_blank" rel="noopener">${escapeHtml(a.title)}</a>
            <span class="news-source">${escapeHtml(a.source)}</span>
          </div>
        `
        )
        .join("");
    } catch {
      const body = el.querySelector(".panel-body");
      if (body) body.innerHTML = '<p class="panel-placeholder">Waiting for backend...</p>';
    }
  }
}
