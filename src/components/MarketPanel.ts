import { Panel } from './Panel';
import { t } from '@/services/i18n';
import type { MarketData, CryptoData } from '@/types';
import { formatPrice, formatChange, getChangeClass, getHeatmapClass } from '@/utils';
import { escapeHtml } from '@/utils/sanitize';
import { miniSparkline } from '@/utils/sparkline';
import {
  STOCK_CATALOG,
  REGION_LABELS,
  MARKET_SYMBOLS,
  type CatalogSymbol,
} from '@/config/markets';
import {
  getCatalogSelection,
  setCatalogSelection,
  clearCatalogSelection,
} from '@/services/market-watchlist';

export class MarketPanel extends Panel {
  private pickerOverlay: HTMLElement | null = null;
  private escHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor() {
    super({ id: 'markets', title: t('panels.markets'), infoTooltip: t('components.markets.infoTooltip') });
    this.addEditButton();
  }

  private addEditButton(): void {
    const btn = document.createElement('button');
    btn.className = 'icon-btn market-edit-btn';
    btn.title = 'Customize watchlist';
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`;

    const closeBtn = this.header.querySelector('.panel-close-btn');
    if (closeBtn) {
      this.header.insertBefore(btn, closeBtn);
    } else {
      this.header.appendChild(btn);
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openPicker();
    });
  }

  public renderMarkets(data: MarketData[], rateLimited?: boolean): void {
    if (data.length === 0) {
      this.showRetrying(rateLimited ? t('common.rateLimitedMarket') : t('common.failedMarketData'));
      return;
    }

    const html = data
      .map(
        (stock) => `
      <div class="market-item">
        <div class="market-info">
          <span class="market-name">${escapeHtml(stock.name)}</span>
          <span class="market-symbol">${escapeHtml(stock.display)}</span>
        </div>
        <div class="market-data">
          ${miniSparkline(stock.sparkline, stock.change)}
          <span class="market-price">${formatPrice(stock.price!)}</span>
          <span class="market-change ${getChangeClass(stock.change!)}">${formatChange(stock.change!)}</span>
        </div>
      </div>
    `
      )
      .join('');

    this.setContent(html);
  }

  private openPicker(): void {
    if (this.pickerOverlay) return;

    const saved = getCatalogSelection();
    const defaultSyms = MARKET_SYMBOLS.map((s) => s.symbol);
    const selected = new Set(saved || defaultSyms);

    let activeRegion = 'all';
    let filterText = '';

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Customize Markets');
    this.pickerOverlay = overlay;

    const regionKeys = Object.keys(REGION_LABELS);

    const getVisible = (): CatalogSymbol[] => {
      let list: CatalogSymbol[] = STOCK_CATALOG;
      if (activeRegion !== 'all') {
        list = list.filter((s) => s.region === activeRegion);
      }
      if (filterText) {
        const q = filterText.toLowerCase();
        list = list.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.symbol.toLowerCase().includes(q) ||
            s.display.toLowerCase().includes(q),
        );
      }
      return list;
    };

    const renderPills = () => {
      const bar = overlay.querySelector('.wl-region-bar');
      if (!bar) return;
      let html = `<button class="wl-pill${activeRegion === 'all' ? ' active' : ''}" data-region="all">All</button>`;
      for (const key of regionKeys) {
        html += `<button class="wl-pill${activeRegion === key ? ' active' : ''}" data-region="${key}">${escapeHtml(REGION_LABELS[key] || key)}</button>`;
      }
      bar.innerHTML = html;
    };

    const renderGrid = () => {
      const grid = overlay.querySelector('.wl-grid');
      if (!grid) return;
      const visible = getVisible();
      grid.innerHTML = visible
        .map((s) => {
          const on = selected.has(s.symbol);
          return `<div class="wl-item${on ? ' active' : ''}" data-symbol="${escapeHtml(s.symbol)}">
          <div class="wl-check">${on ? '&#10003;' : ''}</div>
          <div class="wl-item-info">
            <span class="wl-item-name">${escapeHtml(s.name)}</span>
            <span class="wl-item-ticker">${escapeHtml(s.display)}</span>
          </div>
        </div>`;
        })
        .join('');
      updateCounter();
    };

    const updateCounter = () => {
      const el = overlay.querySelector('.wl-counter');
      if (el) el.textContent = `${selected.size} selected`;
    };

    overlay.innerHTML = `
      <div class="modal wl-modal">
        <div class="modal-header">
          <span class="modal-title">Customize Watchlist</span>
          <button class="modal-close wl-close" aria-label="Close">&times;</button>
        </div>
        <div class="wl-region-bar"></div>
        <div class="wl-search">
          <input type="text" placeholder="Search stocks, indices..." />
        </div>
        <div class="wl-grid"></div>
        <div class="wl-footer">
          <span class="wl-counter"></span>
          <div class="wl-actions">
            <button class="wl-btn wl-reset">Reset defaults</button>
            <button class="wl-btn wl-btn-primary wl-save">Save</button>
          </div>
        </div>
      </div>
    `;

    overlay.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      if (target === overlay || target.closest('.wl-close')) {
        this.closePicker();
        return;
      }

      const pill = target.closest<HTMLElement>('.wl-pill');
      if (pill?.dataset.region) {
        activeRegion = pill.dataset.region;
        renderPills();
        renderGrid();
        return;
      }

      const item = target.closest<HTMLElement>('.wl-item');
      if (item?.dataset.symbol) {
        const sym = item.dataset.symbol;
        if (selected.has(sym)) selected.delete(sym);
        else selected.add(sym);
        item.classList.toggle('active');
        const check = item.querySelector('.wl-check');
        if (check) check.innerHTML = selected.has(sym) ? '&#10003;' : '';
        updateCounter();
        return;
      }

      if (target.closest('.wl-reset')) {
        clearCatalogSelection();
        this.closePicker();
        return;
      }

      if (target.closest('.wl-save')) {
        const ordered = STOCK_CATALOG
          .filter((s) => selected.has(s.symbol))
          .map((s) => s.symbol);
        if (ordered.length > 0) {
          setCatalogSelection(ordered);
        } else {
          clearCatalogSelection();
        }
        this.closePicker();
        return;
      }
    });

    overlay.addEventListener('input', (e) => {
      const input = e.target as HTMLInputElement;
      if (input.closest('.wl-search')) {
        filterText = input.value;
        renderGrid();
      }
    });

    this.escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.closePicker();
    };
    document.addEventListener('keydown', this.escHandler);

    document.body.appendChild(overlay);
    renderPills();
    renderGrid();
  }

  private closePicker(): void {
    if (this.pickerOverlay) {
      this.pickerOverlay.remove();
      this.pickerOverlay = null;
    }
    if (this.escHandler) {
      document.removeEventListener('keydown', this.escHandler);
      this.escHandler = null;
    }
  }
}

export class HeatmapPanel extends Panel {
  constructor() {
    super({ id: 'heatmap', title: t('panels.heatmap'), infoTooltip: t('components.heatmap.infoTooltip') });
  }

  public renderHeatmap(data: Array<{ name: string; change: number | null }>): void {
    if (data.length === 0) {
      this.showRetrying(t('common.failedSectorData'));
      return;
    }

    const html =
      '<div class="heatmap">' +
      data
        .map(
          (sector) => {
            const change = sector.change ?? 0;
            return `
        <div class="heatmap-cell ${getHeatmapClass(change)}">
          <div class="sector-name">${escapeHtml(sector.name)}</div>
          <div class="sector-change ${getChangeClass(change)}">${formatChange(change)}</div>
        </div>
      `;
          }
        )
        .join('') +
      '</div>';

    this.setContent(html);
  }
}

export class CommoditiesPanel extends Panel {
  constructor() {
    super({ id: 'commodities', title: t('panels.commodities'), infoTooltip: t('components.commodities.infoTooltip') });
  }

  public renderCommodities(data: Array<{ display: string; price: number | null; change: number | null; sparkline?: number[] }>): void {
    const validData = data.filter((d) => d.price !== null);

    if (validData.length === 0) {
      this.showRetrying(t('common.failedCommodities'));
      return;
    }

    const html =
      '<div class="commodities-grid">' +
      validData
        .map(
          (c) => `
        <div class="commodity-item">
          <div class="commodity-name">${escapeHtml(c.display)}</div>
          ${miniSparkline(c.sparkline, c.change, 60, 18)}
          <div class="commodity-price">${formatPrice(c.price!)}</div>
          <div class="commodity-change ${getChangeClass(c.change!)}">${formatChange(c.change!)}</div>
        </div>
      `
        )
        .join('') +
      '</div>';

    this.setContent(html);
  }
}

export class CryptoPanel extends Panel {
  constructor() {
    super({ id: 'crypto', title: t('panels.crypto') });
  }

  public renderCrypto(data: CryptoData[]): void {
    if (data.length === 0) {
      this.showRetrying(t('common.failedCryptoData'));
      return;
    }

    const html = data
      .map(
        (coin) => `
      <div class="market-item">
        <div class="market-info">
          <span class="market-name">${escapeHtml(coin.name)}</span>
          <span class="market-symbol">${escapeHtml(coin.symbol)}</span>
        </div>
        <div class="market-data">
          ${miniSparkline(coin.sparkline, coin.change)}
          <span class="market-price">$${coin.price.toLocaleString()}</span>
          <span class="market-change ${getChangeClass(coin.change)}">${formatChange(coin.change)}</span>
        </div>
      </div>
    `
      )
      .join('');

    this.setContent(html);
  }
}
