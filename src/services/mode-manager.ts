/**
 * App Mode Manager — Peace / Finance / War
 *
 * Three monitoring modes that shift panel focus and visual accent.
 * War Mode and Finance Mode can auto-trigger when data signals reach a threshold.
 * Auto-triggered modes restore to Peace after signals quiet for a cooldown period.
 * Persists selection to localStorage so it survives page reload.
 */

import type { CorrelationSignal } from '@/services/correlation';
import type { MarketData, CryptoData } from '@/types';

export type AppMode = 'peace' | 'finance' | 'war';

const MODE_STORAGE_KEY = 'wm-app-mode';

// ──────────────────────────────────────────────────────────────────────────────
// Thresholds — War Mode
// ──────────────────────────────────────────────────────────────────────────────

/** Number of war-class signals (above confidence threshold) that trigger auto War Mode */
const WAR_AUTO_TRIGGER_SCORE = 2;

/**
 * Correlation signal types that count toward the war threat score.
 *
 * hotspot_escalation — armed conflict locations heating up
 * military_surge     — unusual military movement detected
 * geo_convergence    — multiple geo-data streams converging on one region
 * velocity_spike     — sudden surge in news volume (breaking events, crises)
 * keyword_spike      — conflict/threat keywords spiking across sources
 */
const WAR_SIGNAL_TYPES = new Set<string>([
  'hotspot_escalation',
  'military_surge',
  'geo_convergence',
  'velocity_spike',
  'keyword_spike',
]);

const WAR_SIGNAL_MIN_CONFIDENCE = 0.6;

/** After this many ms with zero war signals, auto-triggered War Mode restores to Peace */
const WAR_QUIET_RESTORE_MS = 20 * 60 * 1000; // 20 minutes

// ──────────────────────────────────────────────────────────────────────────────
// Thresholds — Finance Mode
// ──────────────────────────────────────────────────────────────────────────────

/** S&P 500 daily move (absolute %) that auto-triggers Finance Mode from Peace Mode */
const FINANCE_TRIGGER_SP500_PCT = 2.5;
/** BTC daily move (absolute %) that auto-triggers Finance Mode from Peace Mode */
const FINANCE_TRIGGER_BTC_PCT = 5.0;
/** Crude Oil (CL=F) daily move (absolute %) that auto-triggers Finance Mode */
const FINANCE_TRIGGER_OIL_PCT = 4.0;
/** Gold (GC=F) daily move (absolute %) that auto-triggers Finance Mode (safe-haven flight) */
const FINANCE_TRIGGER_GOLD_PCT = 2.0;

/** After this many ms with normalized markets, auto-triggered Finance Mode restores to Peace */
const FINANCE_QUIET_RESTORE_MS = 60 * 60 * 1000; // 60 minutes

// ──────────────────────────────────────────────────────────────────────────────
// Runtime state
// ──────────────────────────────────────────────────────────────────────────────

let currentMode: AppMode = 'peace';

/**
 * Which mode was last auto-triggered (null if user set it manually).
 * Auto-triggered modes are eligible for auto-restore to Peace.
 */
let _autoTriggeredMode: AppMode | null = null;

/** Timestamp of the last non-zero war-signal evaluation, used for quiet-window detection. */
let _lastWarSignalTime = 0;

/** Timestamp of when Finance auto-trigger last fired, used for quiet-window detection. */
let _financeAutoTriggerTime = 0;

// ──────────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────────

/** Return the current active mode. */
export function getMode(): AppMode {
  return currentMode;
}

/**
 * Switch to a new mode.
 * @param mode  Target mode.
 * @param auto  If true, the switch was triggered automatically (not by user).
 */
export function setMode(mode: AppMode, auto = false): void {
  if (mode === currentMode) return;
  const prev = currentMode;
  currentMode = mode;
  localStorage.setItem(MODE_STORAGE_KEY, mode);

  if (auto) {
    _autoTriggeredMode = mode;
  } else {
    // User manually chose a mode — disable auto-restore to avoid overriding intent
    _autoTriggeredMode = null;
  }

  document.dispatchEvent(
    new CustomEvent<ModeChangedDetail>('wm:mode-changed', {
      detail: { mode, prev, auto },
    }),
  );

  if (auto && mode === 'war') {
    _notifyWarModeActivated();
  }
  if (auto && mode === 'finance') {
    _notifyFinanceModeActivated();
  }
}

/**
 * Read the persisted mode from localStorage on startup.
 * Should be called once during app init before rendering the sidebar.
 */
export function initMode(): AppMode {
  try {
    const saved = localStorage.getItem(MODE_STORAGE_KEY) as AppMode | null;
    if (saved === 'peace' || saved === 'finance' || saved === 'war') {
      currentMode = saved;
    }
  } catch {
    // localStorage unavailable — stay at default
  }
  return currentMode;
}

/**
 * Evaluate a batch of correlation signals and, if enough war-class signals
 * are detected, automatically switch to War Mode from Peace Mode.
 *
 * Dispatches `wm:war-score` with `{ score, threshold }` regardless of outcome
 * so the UI can update a threat indicator.
 *
 * Auto-deescalation: if War Mode was auto-triggered and all signals drop to
 * zero for WAR_QUIET_RESTORE_MS, automatically restores to Peace Mode.
 */
export function evaluateWarThreat(signals: CorrelationSignal[]): void {
  const warSignals = signals.filter(
    s => WAR_SIGNAL_TYPES.has(s.type) && (s.confidence ?? 0) >= WAR_SIGNAL_MIN_CONFIDENCE,
  );
  const score = warSignals.length;

  document.dispatchEvent(
    new CustomEvent<WarScoreDetail>('wm:war-score', {
      detail: { score, threshold: WAR_AUTO_TRIGGER_SCORE },
    }),
  );

  const now = Date.now();

  if (score > 0) {
    _lastWarSignalTime = now;
    // Auto-escalate from Peace → War; never override an explicit user choice
    if (score >= WAR_AUTO_TRIGGER_SCORE && currentMode === 'peace') {
      setMode('war', true);
    }
  } else if (
    currentMode === 'war' &&
    _autoTriggeredMode === 'war' &&
    _lastWarSignalTime > 0 &&
    now - _lastWarSignalTime > WAR_QUIET_RESTORE_MS
  ) {
    // Signals have been quiet for the cooldown window — de-escalate to Peace
    _autoTriggeredMode = null;
    setMode('peace', true);
  }
}

/**
 * Evaluate live market data and auto-switch from Peace → Finance Mode when
 * the S&P 500 OR Bitcoin makes a significant intraday move.
 *
 * Only triggers from Peace Mode — never overrides an explicit user choice.
 */
export function evaluateFinanceTrigger(
  markets: MarketData[],
  crypto: CryptoData[],
): void {
  if (currentMode !== 'peace') {
    // Auto-deescalation: if Finance was auto-triggered and markets have calmed
    if (
      currentMode === 'finance' &&
      _autoTriggeredMode === 'finance' &&
      _financeAutoTriggerTime > 0 &&
      Date.now() - _financeAutoTriggerTime > FINANCE_QUIET_RESTORE_MS
    ) {
      const sp500 = markets.find(m => m.symbol === '^GSPC');
      const btc = crypto.find(c => c.symbol === 'BTC');
      const sp500Calm = sp500?.change != null && Math.abs(sp500.change) < FINANCE_TRIGGER_SP500_PCT * 0.6;
      const btcCalm = btc?.change != null && Math.abs(btc.change) < FINANCE_TRIGGER_BTC_PCT * 0.6;
      if (sp500Calm && btcCalm) {
        _autoTriggeredMode = null;
        setMode('peace', true);
      }
    }
    return;
  }

  const sp500 = markets.find(m => m.symbol === '^GSPC');
  const btc = crypto.find(c => c.symbol === 'BTC');

  const sp500Big = sp500?.change != null && Math.abs(sp500.change) >= FINANCE_TRIGGER_SP500_PCT;
  const btcBig = btc?.change != null && Math.abs(btc.change) >= FINANCE_TRIGGER_BTC_PCT;

  if (sp500Big || btcBig) {
    _financeAutoTriggerTime = Date.now();
    setMode('finance', true);
  }
}

/**
 * Evaluate commodity data (Oil, Gold) and auto-switch from Peace → Finance Mode
 * when a major commodity price move is detected.
 *
 * A large Oil move signals supply/geopolitical shocks.
 * A large Gold move signals safe-haven demand (financial fear or crisis).
 *
 * Only triggers from Peace Mode — never overrides an explicit user choice.
 */
export function evaluateCommodityTrigger(commodities: MarketData[]): void {
  if (currentMode !== 'peace') return;

  const oil = commodities.find(c => c.symbol === 'CL=F');
  const gold = commodities.find(c => c.symbol === 'GC=F');

  const oilBig = oil?.change != null && Math.abs(oil.change) >= FINANCE_TRIGGER_OIL_PCT;
  const goldBig = gold?.change != null && Math.abs(gold.change) >= FINANCE_TRIGGER_GOLD_PCT;

  if (oilBig || goldBig) {
    _financeAutoTriggerTime = Date.now();
    setMode('finance', true);
  }
}

/**
 * Copy a pre-formatted family safety alert to the clipboard.
 * The user can then paste it into SMS / messaging apps.
 */
export function alertFamily(): void {
  const now = new Date();
  const dateStr = now.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const msg = [
    '⚠️  WORLD MONITOR — SAFETY ALERT',
    `Time: ${dateStr}`,
    '',
    'World Monitor has detected elevated conflict or crisis signals.',
    'Please stay informed, follow local emergency guidance,',
    'and check in with each other.',
    '',
    'Stay safe,',
    '— World Monitor',
  ].join('\n');

  navigator.clipboard.writeText(msg).catch(() => {
    // Clipboard API unavailable — silently ignore
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ──────────────────────────────────────────────────────────────────────────────

function _notifyWarModeActivated(): void {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('⚠️ World Monitor — War Mode Activated', {
        body: 'Elevated conflict signals detected. Monitoring has switched to War Mode.',
        tag: 'wm-war-mode',
        requireInteraction: false,
      });
    }
  } catch {
    // Notifications unavailable in this environment
  }
}

function _notifyFinanceModeActivated(): void {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('📈 World Monitor — Finance Mode Activated', {
        body: 'Significant market movement detected. Monitoring has switched to Finance Mode.',
        tag: 'wm-finance-mode',
        requireInteraction: false,
      });
    }
  } catch {
    // Notifications unavailable in this environment
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Event detail types (exported for consumers)
// ──────────────────────────────────────────────────────────────────────────────

export interface ModeChangedDetail {
  mode: AppMode;
  prev: AppMode;
  auto: boolean;
}

export interface WarScoreDetail {
  score: number;
  threshold: number;
}
