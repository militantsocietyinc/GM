import { Panel } from './Panel';

const COUNTRY_FLAGS: Record<string, string> = {
  US: '🇺🇸',
  GB: '🇬🇧',
  UK: '🇬🇧',
  EU: '🇪🇺',
  EUR: '🇪🇺',
  DE: '🇩🇪',
  FR: '🇫🇷',
  JP: '🇯🇵',
  CN: '🇨🇳',
  CA: '🇨🇦',
  AU: '🇦🇺',
};

const IMPACT_COLORS: Record<string, string> = {
  high: '#e74c3c',
  medium: '#f39c12',
  low: 'rgba(255,255,255,0.3)',
};

interface EconomicEvent {
  event: string;
  country: string;
  date: string;
  impact: string;
  actual: string;
  estimate: string;
  previous: string;
  unit: string;
}

function groupByDate(events: EconomicEvent[]): Map<string, EconomicEvent[]> {
  const map = new Map<string, EconomicEvent[]>();
  for (const ev of events) {
    const key = ev.date || 'Unknown';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ev);
  }
  return map;
}

function formatDate(dateStr: string): string {
  if (!dateStr || dateStr === 'Unknown') return 'Unknown Date';
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatMetaValue(val: string, unit: string): string {
  if (!val) return '—';
  return unit ? `${val} ${unit}` : val;
}

export class EconomicCalendarPanel extends Panel {
  private _hasData = false;
  private _events: EconomicEvent[] = [];

  constructor() {
    super({ id: 'economic-calendar', title: 'Economic Calendar', showCount: false });
    this.showLoading('Loading economic calendar...');
    void this.fetchData();
  }

  private async fetchData(): Promise<void> {
    try {
      const { EconomicServiceClient } = await import('@/generated/client/worldmonitor/economic/v1/service_client');
      const { getRpcBaseUrl } = await import('@/services/rpc-client');
      const client = new EconomicServiceClient(getRpcBaseUrl(), { fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args) });
      const today = new Date();
      const fromDate = today.toISOString().slice(0, 10);
      const toDate = new Date(today.getTime() + 30 * 86400_000).toISOString().slice(0, 10);
      const resp = await client.getEconomicCalendar({ fromDate, toDate });

      if (resp.unavailable || !resp.events || resp.events.length === 0) {
        this.showError('Economic calendar data unavailable.');
        return;
      }

      this._events = resp.events as EconomicEvent[];
      this._hasData = true;
      this.render();
    } catch (err) {
      if (this.isAbortError(err)) return;
      this.showError('Failed to load economic calendar.');
    }
  }

  protected render(): void {
    if (!this._hasData || this._events.length === 0) {
      this.showError('No upcoming economic events.');
      return;
    }

    const grouped = groupByDate(this._events);
    const sections: string[] = [];

    for (const [date, events] of grouped) {
      const dateHeader = `<div class="econ-cal-date-header">${formatDate(date)}</div>`;
      const rows = events.map((ev) => {
        const impact = (ev.impact || 'low').toLowerCase();
        const color = IMPACT_COLORS[impact] ?? IMPACT_COLORS.low;
        const flag = COUNTRY_FLAGS[ev.country] ?? ev.country;
        const isHigh = impact === 'high';
        const badge = `<span class="econ-cal-badge" style="background:${color};color:#fff;padding:1px 5px;border-radius:3px;font-size:0.7em;font-weight:700;text-transform:uppercase;">${impact}</span>`;
        const name = isHigh
          ? `<strong>${ev.event}</strong>`
          : ev.event;
        const meta = [
          ev.actual ? `<span>Actual: ${formatMetaValue(ev.actual, ev.unit)}</span>` : '',
          ev.estimate ? `<span>Est: ${formatMetaValue(ev.estimate, ev.unit)}</span>` : '',
          ev.previous ? `<span>Prev: ${formatMetaValue(ev.previous, ev.unit)}</span>` : '',
        ].filter(Boolean).join(' &nbsp;');

        return `<div class="econ-cal-event">
          <div class="econ-cal-event-main">
            <span class="econ-cal-flag">${flag}</span>
            <span class="econ-cal-name">${name}</span>
            ${badge}
          </div>
          ${meta ? `<div class="econ-cal-meta">${meta}</div>` : ''}
        </div>`;
      }).join('');

      sections.push(`<div class="econ-cal-group">${dateHeader}${rows}</div>`);
    }

    this.setContent(`<div class="econ-cal-panel">${sections.join('')}</div>`);
  }
}
