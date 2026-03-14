import { Panel } from './Panel';
import type {
  GetShippingRatesResponse,
  GetChokepointStatusResponse,
  GetCriticalMineralsResponse,
} from '@/services/supply-chain';
import type { TransitDayCount } from '@/generated/client/worldmonitor/supply_chain/v1/service_client';
import * as d3 from 'd3';
import { t } from '@/services/i18n';
import { escapeHtml } from '@/utils/sanitize';
import { getCSSColor } from '@/utils';
import { isFeatureAvailable } from '@/services/runtime-config';
import { isDesktopRuntime } from '@/services/runtime';

type TabId = 'chokepoints' | 'shipping' | 'minerals';

const CHART_MARGIN = { top: 6, right: 8, bottom: 20, left: 32 };
const CHART_HEIGHT = 70;

export class SupplyChainPanel extends Panel {
  private shippingData: GetShippingRatesResponse | null = null;
  private chokepointData: GetChokepointStatusResponse | null = null;
  private mineralsData: GetCriticalMineralsResponse | null = null;
  private activeTab: TabId = 'chokepoints';
  private expandedChokepoint: string | null = null;

  constructor() {
    super({ id: 'supply-chain', title: t('panels.supplyChain') });
    this.content.addEventListener('click', (e) => {
      const tab = (e.target as HTMLElement).closest('.panel-tab') as HTMLElement | null;
      if (tab) {
        const tabId = tab.dataset.tab as TabId;
        if (tabId && tabId !== this.activeTab) {
          this.activeTab = tabId;
          this.render();
        }
        return;
      }
      const card = (e.target as HTMLElement).closest('.trade-restriction-card') as HTMLElement | null;
      if (card?.dataset.cpId) {
        this.expandedChokepoint = this.expandedChokepoint === card.dataset.cpId ? null : card.dataset.cpId;
        this.render();
      }
    });
  }

  public updateShippingRates(data: GetShippingRatesResponse): void {
    this.shippingData = data;
    this.render();
  }

  public updateChokepointStatus(data: GetChokepointStatusResponse): void {
    this.chokepointData = data;
    this.render();
  }

  public updateCriticalMinerals(data: GetCriticalMineralsResponse): void {
    this.mineralsData = data;
    this.render();
  }

  private render(): void {
    const tabsHtml = `
      <div class="panel-tabs">
        <button class="panel-tab ${this.activeTab === 'chokepoints' ? 'active' : ''}" data-tab="chokepoints">
          ${t('components.supplyChain.chokepoints')}
        </button>
        <button class="panel-tab ${this.activeTab === 'shipping' ? 'active' : ''}" data-tab="shipping">
          ${t('components.supplyChain.shipping')}
        </button>
        <button class="panel-tab ${this.activeTab === 'minerals' ? 'active' : ''}" data-tab="minerals">
          ${t('components.supplyChain.minerals')}
        </button>
      </div>
    `;

    const activeHasData = this.activeTab === 'chokepoints'
      ? (this.chokepointData?.chokepoints?.length ?? 0) > 0
      : this.activeTab === 'shipping'
        ? (this.shippingData?.indices?.length ?? 0) > 0
        : (this.mineralsData?.minerals?.length ?? 0) > 0;
    const activeData = this.activeTab === 'chokepoints' ? this.chokepointData
      : this.activeTab === 'shipping' ? this.shippingData
      : this.mineralsData;
    const unavailableBanner = !activeHasData && activeData?.upstreamUnavailable
      ? `<div class="economic-warning">${t('components.supplyChain.upstreamUnavailable')}</div>`
      : '';

    let contentHtml = '';
    switch (this.activeTab) {
      case 'chokepoints': contentHtml = this.renderChokepoints(); break;
      case 'shipping': contentHtml = this.renderShipping(); break;
      case 'minerals': contentHtml = this.renderMinerals(); break;
    }

    this.setContent(`
      ${tabsHtml}
      ${unavailableBanner}
      <div class="economic-content">${contentHtml}</div>
      <div class="economic-footer">
        <span class="economic-source">${t('components.supplyChain.sources')}</span>
      </div>
    `);

    if (this.activeTab === 'chokepoints' && this.expandedChokepoint) {
      requestAnimationFrame(() => {
        const el = this.content.querySelector(`[data-chart-cp="${this.expandedChokepoint}"]`) as HTMLElement | null;
        if (!el) return;
        const cp = this.chokepointData?.chokepoints?.find(c => c.name === this.expandedChokepoint);
        if (cp?.transitSummary?.history?.length) {
          this.renderTransitChart(el, cp.transitSummary.history);
        }
      });
    }
  }

  private renderChokepoints(): string {
    if (!this.chokepointData || !this.chokepointData.chokepoints?.length) {
      return `<div class="economic-empty">${t('components.supplyChain.noChokepoints')}</div>`;
    }

    return `<div class="trade-restrictions-list">
      ${[...this.chokepointData.chokepoints].sort((a, b) => b.disruptionScore - a.disruptionScore).map(cp => {
        const statusClass = cp.status === 'red' ? 'status-active' : cp.status === 'yellow' ? 'status-notified' : 'status-terminated';
        const statusDot = cp.status === 'red' ? 'sc-dot-red' : cp.status === 'yellow' ? 'sc-dot-yellow' : 'sc-dot-green';
        const aisDisruptions = cp.aisDisruptions ?? (cp.congestionLevel === 'normal' ? 0 : 1);
        const ts = cp.transitSummary;
        const transitRow = ts && ts.todayTotal > 0
          ? `<div class="trade-sector">${t('components.supplyChain.transit24h')}: ${ts.todayTotal} vessels (${ts.todayTanker} ${t('components.supplyChain.tankers')}, ${ts.todayCargo} ${t('components.supplyChain.cargo')}, ${ts.todayOther} other) | ${t('components.supplyChain.wowChange')}: <span class="trade-flow-change ${ts.wowChangePct >= 0 ? 'change-positive' : 'change-negative'}">${ts.wowChangePct >= 0 ? '\u25B2' : '\u25BC'}${Math.abs(ts.wowChangePct).toFixed(1)}%</span></div>`
          : '';
        const riskRow = ts?.riskLevel
          ? `<div class="trade-sector">${t('components.supplyChain.riskLevel')}: ${escapeHtml(ts.riskLevel)} | ${ts.incidentCount7d} incidents (7d)</div>`
          : '';
        const expanded = this.expandedChokepoint === cp.name;
        const chartPlaceholder = expanded && ts?.history?.length
          ? `<div data-chart-cp="${escapeHtml(cp.name)}" style="margin-top:8px;min-height:${CHART_HEIGHT + CHART_MARGIN.top + CHART_MARGIN.bottom + 20}px"></div>`
          : '';
        return `<div class="trade-restriction-card${expanded ? ' expanded' : ''}" data-cp-id="${escapeHtml(cp.name)}" style="cursor:pointer">
          <div class="trade-restriction-header">
            <span class="trade-country">${escapeHtml(cp.name)}</span>
            <span class="sc-status-dot ${statusDot}"></span>
            <span class="trade-badge">${cp.disruptionScore}/100</span>
            <span class="trade-status ${statusClass}">${escapeHtml(cp.status)}</span>
          </div>
          <div class="trade-restriction-body">
            <div class="trade-sector">${cp.activeWarnings} ${t('components.supplyChain.warnings')} · ${aisDisruptions} ${t('components.supplyChain.aisDisruptions')}${cp.directions?.length ? ` · ${escapeHtml(cp.directions.join('/'))}` : ''}</div>
            ${transitRow}
            ${riskRow}
            <div class="trade-description">${escapeHtml(cp.description)}</div>
            <div class="trade-affected">${escapeHtml(cp.affectedRoutes.join(', '))}</div>
            ${chartPlaceholder}
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }

  private renderShipping(): string {
    if (isDesktopRuntime() && !isFeatureAvailable('supplyChain')) {
      return `<div class="economic-empty">${t('components.supplyChain.fredKeyMissing')}</div>`;
    }

    if (!this.shippingData || !this.shippingData.indices?.length) {
      return `<div class="economic-empty">${t('components.supplyChain.noShipping')}</div>`;
    }

    return `<div class="trade-restrictions-list">
      ${this.shippingData.indices.map(idx => {
        const changeClass = idx.changePct >= 0 ? 'change-positive' : 'change-negative';
        const changeArrow = idx.changePct >= 0 ? '\u25B2' : '\u25BC';
        const sparkline = this.renderSparkline(idx.history.map(h => h.value));
        const spikeBanner = idx.spikeAlert
          ? `<div class="economic-warning">${t('components.supplyChain.spikeAlert')}</div>`
          : '';
        return `<div class="trade-restriction-card">
          ${spikeBanner}
          <div class="trade-restriction-header">
            <span class="trade-country">${escapeHtml(idx.name)}</span>
            <span class="trade-badge">${idx.currentValue.toFixed(0)} ${escapeHtml(idx.unit)}</span>
            <span class="trade-flow-change ${changeClass}">${changeArrow} ${Math.abs(idx.changePct).toFixed(1)}%</span>
          </div>
          <div class="trade-restriction-body">
            ${sparkline}
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }

  private renderSparkline(values: number[]): string {
    if (values.length < 2) return '';
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const w = 200;
    const h = 40;
    const points = values.map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block;margin:4px 0">
      <polyline points="${points}" fill="none" stroke="var(--accent-primary, #4fc3f7)" stroke-width="1.5" />
    </svg>`;
  }

  private renderTransitChart(container: HTMLElement, history: TransitDayCount[]): void {
    const containerWidth = container.clientWidth || this.content.clientWidth - 16;
    if (containerWidth <= 0 || history.length < 2) return;

    const label = document.createElement('div');
    label.style.cssText = 'font-size:11px;font-weight:600;color:var(--text-dim);padding:0 0 4px 4px;';
    label.textContent = t('components.supplyChain.vesselTransits');
    container.appendChild(label);

    const width = containerWidth - CHART_MARGIN.left - CHART_MARGIN.right;
    const height = CHART_HEIGHT;
    const parseDate = (s: string) => new Date(s);

    const svg = d3.select(container)
      .append('svg')
      .attr('width', containerWidth)
      .attr('height', height + CHART_MARGIN.top + CHART_MARGIN.bottom)
      .style('display', 'block');

    const g = svg.append('g')
      .attr('transform', `translate(${CHART_MARGIN.left},${CHART_MARGIN.top})`);

    const x = d3.scaleTime()
      .domain(d3.extent(history, d => parseDate(d.date)) as [Date, Date])
      .range([0, width]);

    const yMax = d3.max(history, d => Math.max(d.tanker, d.cargo)) ?? 10;
    const y = d3.scaleLinear().domain([0, yMax * 1.1]).range([height, 0]);

    const tankerColor = getCSSColor('--accent-primary') || '#4fc3f7';
    const cargoColor = '#ff9800';

    const makeLine = (accessor: (d: TransitDayCount) => number) =>
      d3.line<TransitDayCount>().x(d => x(parseDate(d.date))).y(d => y(accessor(d))).curve(d3.curveMonotoneX);

    g.append('path').datum(history).attr('d', makeLine(d => d.tanker)).attr('fill', 'none').attr('stroke', tankerColor).attr('stroke-width', 1.5);
    g.append('path').datum(history).attr('d', makeLine(d => d.cargo)).attr('fill', 'none').attr('stroke', cargoColor).attr('stroke-width', 1.5);

    const xAxisG = g.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(x).ticks(5).tickFormat(d => d3.timeFormat('%b %d')(d as Date)));
    xAxisG.selectAll('text').attr('fill', 'var(--text-dim)').attr('font-size', '9px');
    xAxisG.selectAll('line').attr('stroke', 'var(--border-subtle)');
    xAxisG.select('.domain').attr('stroke', 'var(--border-subtle)');

    const yAxisG = g.append('g').call(d3.axisLeft(y).ticks(3));
    yAxisG.selectAll('text').attr('fill', 'var(--text-dim)').attr('font-size', '9px');
    yAxisG.selectAll('line').attr('stroke', 'var(--border-subtle)');
    yAxisG.select('.domain').attr('stroke', 'var(--border-subtle)');

    const bisector = d3.bisector<TransitDayCount, Date>(d => parseDate(d.date)).left;
    const focusLine = g.append('line').attr('stroke', 'var(--text-dim)').attr('stroke-width', 1).attr('stroke-dasharray', '3,3').attr('opacity', 0);
    const focusDot1 = g.append('circle').attr('r', 3).attr('fill', tankerColor).attr('stroke', '#fff').attr('stroke-width', 1).attr('opacity', 0);
    const focusDot2 = g.append('circle').attr('r', 3).attr('fill', cargoColor).attr('stroke', '#fff').attr('stroke-width', 1).attr('opacity', 0);

    const tooltip = document.createElement('div');
    Object.assign(tooltip.style, {
      position: 'absolute', pointerEvents: 'none', background: getCSSColor('--bg'), border: `1px solid ${getCSSColor('--border')}`,
      borderRadius: '6px', padding: '4px 8px', fontSize: '11px', color: getCSSColor('--text'), zIndex: '9999', display: 'none', whiteSpace: 'nowrap',
    });
    container.style.position = 'relative';
    container.appendChild(tooltip);

    g.append('rect').attr('width', width).attr('height', height).attr('fill', 'none').attr('pointer-events', 'all').style('cursor', 'crosshair')
      .on('mousemove', (event: MouseEvent) => {
        const [mx] = d3.pointer(event);
        const dateVal = x.invert(mx);
        const idx = bisector(history, dateVal, 1);
        const d0 = history[idx - 1];
        const d1 = history[idx];
        if (!d0) return;
        const nearest = d1 && (+dateVal - +parseDate(d0.date) > +parseDate(d1.date) - +dateVal) ? d1 : d0;
        const cx = x(parseDate(nearest.date));
        focusLine.attr('x1', cx).attr('x2', cx).attr('y1', 0).attr('y2', height).attr('opacity', 0.4);
        focusDot1.attr('cx', cx).attr('cy', y(nearest.tanker)).attr('opacity', 1);
        focusDot2.attr('cx', cx).attr('cy', y(nearest.cargo)).attr('opacity', 1);
        tooltip.textContent = `${nearest.date}: T:${nearest.tanker} C:${nearest.cargo} Tot:${nearest.total}`;
        tooltip.style.display = 'block';
        tooltip.style.left = `${CHART_MARGIN.left + cx + 10}px`;
        tooltip.style.top = `${CHART_MARGIN.top + Math.min(y(nearest.tanker), y(nearest.cargo)) - 12}px`;
      })
      .on('mouseleave', () => {
        focusLine.attr('opacity', 0);
        focusDot1.attr('opacity', 0);
        focusDot2.attr('opacity', 0);
        tooltip.style.display = 'none';
      });

    const legend = document.createElement('div');
    legend.style.cssText = 'display:flex;gap:12px;padding:4px;font-size:10px;color:var(--text-dim);';
    const tankerSpan = document.createElement('span');
    tankerSpan.style.color = tankerColor;
    tankerSpan.textContent = '\u25CF Tanker';
    const cargoSpan = document.createElement('span');
    cargoSpan.style.color = cargoColor;
    cargoSpan.textContent = '\u25CF Cargo';
    legend.appendChild(tankerSpan);
    legend.appendChild(cargoSpan);
    container.appendChild(legend);
  }

  private renderMinerals(): string {
    if (!this.mineralsData || !this.mineralsData.minerals?.length) {
      return `<div class="economic-empty">${t('components.supplyChain.noMinerals')}</div>`;
    }

    const rows = this.mineralsData.minerals.map(m => {
      const riskClass = m.riskRating === 'critical' ? 'sc-risk-critical'
        : m.riskRating === 'high' ? 'sc-risk-high'
        : m.riskRating === 'moderate' ? 'sc-risk-moderate'
        : 'sc-risk-low';
      const top3 = m.topProducers.slice(0, 3).map(p =>
        `${escapeHtml(p.country)} ${p.sharePct.toFixed(0)}%`
      ).join(', ');
      return `<tr>
        <td>${escapeHtml(m.mineral)}</td>
        <td>${top3}</td>
        <td>${m.hhi.toFixed(0)}</td>
        <td><span class="${riskClass}">${escapeHtml(m.riskRating)}</span></td>
      </tr>`;
    }).join('');

    return `<div class="trade-tariffs-table">
      <table>
        <thead>
          <tr>
            <th>${t('components.supplyChain.mineral')}</th>
            <th>${t('components.supplyChain.topProducers')}</th>
            <th>HHI</th>
            <th>${t('components.supplyChain.risk')}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }
}
