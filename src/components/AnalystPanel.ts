/**
 * AnalystPanel — JP 3-60 Military Analysis panel.
 *
 * Extends Panel base class with vanilla DOM (h() helper, NOT JSX).
 * Provides query input, region/timeframe selectors, and renders
 * 6-dimension scores as horizontal bars with overall probability.
 */

import { Panel } from './Panel';
import { t } from '@/services/i18n';
import { h, replaceChildren } from '@/utils/dom-utils';
import { createErrorDisplay } from './sentinel/error-display';
import { createDataFreshnessIndicator, type FreshnessStatus } from './sentinel/DataFreshnessIndicator';
import { runAssessment } from '@/services/analyst';
import type { AssessmentResponse, DimensionScore } from '@/generated/client/worldmonitor/analyst/v1/service_client';

const COOLDOWN_MS = 5_000;

const REGIONS = [
  { value: 'middle-east', label: 'Middle East' },
  { value: 'east-asia', label: 'East Asia' },
  { value: 'europe', label: 'Europe' },
  { value: 'africa', label: 'Africa' },
  { value: 'south-asia', label: 'South Asia' },
  { value: 'americas', label: 'Americas' },
];

const TIMEFRAMES = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
];

function getConfidenceColor(level: string): string {
  switch (level) {
    case 'high': return '#22c55e';
    case 'medium': return '#eab308';
    case 'low': return '#ef4444';
    default: return '#6b7280';
  }
}

function getProbabilityColor(prob: number): string {
  if (prob >= 0.7) return '#ef4444';
  if (prob >= 0.4) return '#eab308';
  return '#22c55e';
}

function getBarColor(score: number): string {
  if (score >= 0.7) return '#ef4444';
  if (score >= 0.4) return '#eab308';
  return '#22c55e';
}

export class AnalystPanel extends Panel {
  private formEl: HTMLFormElement;
  private queryInput: HTMLTextAreaElement;
  private regionSelect: HTMLSelectElement;
  private timeframeSelect: HTMLSelectElement;
  private submitBtn: HTMLButtonElement;
  private resultContainer: HTMLElement;
  private freshnessEl: HTMLElement | null = null;
  private isSubmitting = false;

  constructor() {
    super({
      id: 'analyst',
      title: t('sentinel.analyst.title'),
      className: 'panel-wide',
      infoTooltip: 'JP 3-60 Joint Targeting framework: scores 6 military analysis dimensions to estimate conflict probability.',
    });

    this.queryInput = h('textarea', {
      className: 'analyst-query-input',
      placeholder: t('sentinel.analyst.placeholder'),
      required: true,
      rows: 3,
    }) as HTMLTextAreaElement;

    this.regionSelect = h('select', { className: 'analyst-region-select' },
      ...REGIONS.map(r => h('option', { value: r.value }, r.label)),
    ) as HTMLSelectElement;

    this.timeframeSelect = h('select', { className: 'analyst-timeframe-select' },
      ...TIMEFRAMES.map(tf => h('option', { value: tf.value }, tf.label)),
    ) as HTMLSelectElement;

    this.submitBtn = h('button', {
      className: 'analyst-submit-btn',
      type: 'submit',
    }, t('sentinel.analyst.analyze')) as HTMLButtonElement;

    const selectors = h('div', { className: 'analyst-selectors' },
      h('label', { className: 'analyst-selector-label' },
        'Region:',
        this.regionSelect,
      ),
      h('label', { className: 'analyst-selector-label' },
        t('sentinel.analyst.timeframe') + ':',
        this.timeframeSelect,
      ),
      this.submitBtn,
    );

    this.formEl = h('form', { className: 'analyst-form' },
      this.queryInput,
      selectors,
    ) as HTMLFormElement;

    this.formEl.addEventListener('submit', this.handleSubmit.bind(this));

    this.resultContainer = h('div', { className: 'analyst-result' });
    this.resultContainer.textContent = t('sentinel.analyst.noResults');

    const container = h('div', { className: 'analyst-panel-content' },
      this.formEl,
      this.resultContainer,
    );

    replaceChildren(this.content, container);
    this.injectStyles();
  }

  private injectStyles(): void {
    if (document.getElementById('analyst-panel-styles')) return;

    const style = document.createElement('style');
    style.id = 'analyst-panel-styles';
    style.textContent = `
      .analyst-panel-content { display: flex; flex-direction: column; gap: 12px; padding: 8px; height: 100%; overflow-y: auto; }
      .analyst-form { display: flex; flex-direction: column; gap: 8px; }
      .analyst-query-input { width: 100%; padding: 8px; background: var(--bg-secondary, #2a2a2a); border: 1px solid var(--border-color, #444); color: var(--text-primary, #fff); border-radius: 4px; font-family: inherit; resize: vertical; font-size: 0.9em; }
      .analyst-selectors { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; }
      .analyst-selector-label { display: flex; flex-direction: column; gap: 4px; font-size: 0.8em; color: var(--text-secondary, #aaa); }
      .analyst-region-select, .analyst-timeframe-select { padding: 6px 8px; background: var(--bg-secondary, #2a2a2a); border: 1px solid var(--border-color, #444); color: var(--text-primary, #fff); border-radius: 4px; font-size: 0.9em; }
      .analyst-submit-btn { padding: 8px 20px; background: var(--accent-color, #3b82f6); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; align-self: flex-end; white-space: nowrap; }
      .analyst-submit-btn:hover { background: var(--accent-hover, #2563eb); }
      .analyst-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .analyst-result { flex: 1; margin-top: 8px; }
      .analyst-result.loading { opacity: 0.7; font-style: italic; color: var(--text-secondary, #aaa); }
      .analyst-result.error { color: var(--semantic-critical, #ef4444); }
      .analyst-dimensions { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
      .analyst-dim-row { display: flex; flex-direction: column; gap: 2px; }
      .analyst-dim-header { display: flex; justify-content: space-between; font-size: 0.85em; color: var(--text-primary, #ddd); }
      .analyst-dim-name { font-weight: 500; }
      .analyst-dim-score { font-variant-numeric: tabular-nums; }
      .analyst-dim-bar-bg { width: 100%; height: 8px; background: var(--bg-secondary, #333); border-radius: 4px; overflow: hidden; }
      .analyst-dim-bar-fill { height: 100%; border-radius: 4px; transition: width 0.4s ease-out; }
      .analyst-dim-reasoning { font-size: 0.75em; color: var(--text-secondary, #888); margin-top: 2px; }
      .analyst-probability { display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-secondary, #2a2a2a); border-radius: 6px; margin-bottom: 12px; }
      .analyst-prob-value { font-size: 2em; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1; }
      .analyst-prob-label { font-size: 0.85em; color: var(--text-secondary, #aaa); }
      .analyst-confidence-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; text-transform: uppercase; }
      .analyst-analysis-text { font-size: 0.9em; line-height: 1.6; color: var(--text-primary, #ddd); margin-bottom: 12px; white-space: pre-wrap; }
      .analyst-disclaimer { font-size: 0.75em; color: var(--text-secondary, #888); border-top: 1px solid var(--border-color, #444); padding-top: 8px; font-style: italic; }
    `;
    document.head.appendChild(style);
  }

  private async handleSubmit(e: Event): Promise<void> {
    e.preventDefault();
    if (this.isSubmitting) return;

    const query = this.queryInput.value.trim();
    if (!query) return;

    const region = this.regionSelect.value;
    const timeframe = this.timeframeSelect.value;

    this.isSubmitting = true;
    this.submitBtn.disabled = true;
    this.submitBtn.textContent = t('sentinel.analyst.analyzing');
    this.resultContainer.className = 'analyst-result loading';
    this.resultContainer.textContent = t('sentinel.analyst.analyzing');
    this.updateFreshness('loading');

    try {
      const resp = await runAssessment(query, region, timeframe);
      if (!this.element?.isConnected) return;

      if (resp.status === 'error') {
        this.resultContainer.className = 'analyst-result error';
        this.resultContainer.textContent = resp.errorMessage || t('sentinel.analyst.error');
        this.updateFreshness('unavailable');
        return;
      }

      this.renderAssessment(resp);
      const cachedStr = resp.cachedAt ? new Date(resp.cachedAt).toISOString() : null;
      this.updateFreshness('live', cachedStr);
    } catch (err) {
      if (!this.element?.isConnected) return;
      console.error('[AnalystPanel] Error:', err);
      createErrorDisplay('Analyst', this.resultContainer, err instanceof Error ? err : new Error('Analysis failed'));
      this.updateFreshness('unavailable');
    } finally {
      this.isSubmitting = false;
      this.submitBtn.textContent = t('sentinel.analyst.analyze');
      if (this.element?.isConnected) {
        setTimeout(() => { this.submitBtn.disabled = false; }, COOLDOWN_MS);
      }
    }
  }

  private renderAssessment(resp: AssessmentResponse): void {
    this.resultContainer.className = 'analyst-result';

    // Probability + Confidence header
    const probColor = getProbabilityColor(resp.overallProbability);
    const confColor = getConfidenceColor(resp.confidenceLevel);
    const probPercent = `${(resp.overallProbability * 100).toFixed(1)}%`;

    const probabilitySection = h('div', { className: 'analyst-probability' },
      h('div', null,
        h('div', { className: 'analyst-prob-value', style: `color: ${probColor}` }, probPercent),
        h('div', { className: 'analyst-prob-label' }, t('sentinel.analyst.probability')),
      ),
      h('div', null,
        h('span', {
          className: 'analyst-confidence-badge',
          style: `background: ${confColor}20; color: ${confColor}; border: 1px solid ${confColor}40;`,
        }, `${t('sentinel.analyst.confidence')}: ${resp.confidenceLevel}`),
      ),
    );

    // Dimension score bars
    const dimensionsSection = h('div', { className: 'analyst-dimensions' },
      h('div', { style: 'font-size: 0.9em; font-weight: 600; color: var(--text-primary, #ddd); margin-bottom: 4px;' },
        t('sentinel.analyst.dimensions'),
      ),
      ...resp.dimensions.map(dim => this.renderDimensionBar(dim)),
    );

    // Analysis text
    const analysisSection = h('div', { className: 'analyst-analysis-text' }, resp.analysisText);

    // Disclaimer
    const disclaimerSection = h('div', { className: 'analyst-disclaimer' },
      resp.disclaimer || t('sentinel.analyst.disclaimer'),
    );

    replaceChildren(this.resultContainer,
      probabilitySection,
      dimensionsSection,
      analysisSection,
      disclaimerSection,
    );
  }

  private renderDimensionBar(dim: DimensionScore): HTMLElement {
    const pct = `${(dim.score * 100).toFixed(0)}%`;
    const barColor = getBarColor(dim.score);

    const row = h('div', { className: 'analyst-dim-row' },
      h('div', { className: 'analyst-dim-header' },
        h('span', { className: 'analyst-dim-name' }, dim.name),
        h('span', { className: 'analyst-dim-score' }, pct),
      ),
      h('div', { className: 'analyst-dim-bar-bg' },
        h('div', {
          className: 'analyst-dim-bar-fill',
          style: `width: ${pct}; background-color: ${barColor};`,
        }),
      ),
    );

    if (dim.reasoning) {
      row.appendChild(h('div', { className: 'analyst-dim-reasoning' }, dim.reasoning));
    }

    return row;
  }

  private updateFreshness(status: FreshnessStatus, lastUpdated?: string | null): void {
    if (this.freshnessEl) {
      this.freshnessEl.remove();
    }
    this.freshnessEl = createDataFreshnessIndicator(status, lastUpdated);
    this.element.insertBefore(this.freshnessEl, this.header.nextSibling);
  }
}
