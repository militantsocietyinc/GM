/**
 * Sound Manager — Mode Transition & Alert Audio
 *
 * Synthesizes distinct sounds for each monitoring mode using the Web Audio API.
 * No audio files required — all sounds are generated procedurally.
 *
 * War Mode:   rapid staccato alarm (submarine battle stations feel)
 * Finance Mode: ascending market chime (trading floor open)
 * Peace Mode: soft resonant tone (situation resolved)
 *
 * Sounds respect the global mute setting stored at localStorage key 'wm-sound-muted'.
 * AudioContext is created lazily on first interaction to satisfy browser autoplay policy.
 */

import type { AppMode, ModeChangedDetail } from '@/services/mode-manager';

const MUTE_KEY = 'wm-sound-muted';

let _ctx: AudioContext | null = null;
let _initialized = false;

// ──────────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────────

/** Initialize the sound manager — wire mode-change events. Call once from App.init(). */
export function initSoundManager(): void {
  if (_initialized) return;
  _initialized = true;

  document.addEventListener('wm:mode-changed', ((e: CustomEvent<ModeChangedDetail>) => {
    const { mode, prev } = e.detail;
    if (mode !== prev) {
      _playModeSound(mode);
    }
  }) as EventListener);

  // Lazy-init AudioContext on first user gesture so browsers allow audio
  const unlockAudio = () => {
    if (!_ctx) {
      try {
        _ctx = new AudioContext();
      } catch {
        // Audio unavailable
      }
    }
    document.removeEventListener('click', unlockAudio);
    document.removeEventListener('keydown', unlockAudio);
  };
  document.addEventListener('click', unlockAudio, { once: true });
  document.addEventListener('keydown', unlockAudio, { once: true });
}

/** Toggle mute. Returns the new muted state. */
export function toggleMute(): boolean {
  const muted = !isMuted();
  localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  return muted;
}

/** Returns true if sounds are currently muted. */
export function isMuted(): boolean {
  return localStorage.getItem(MUTE_KEY) === '1';
}

// ──────────────────────────────────────────────────────────────────────────────
// Sound synthesis
// ──────────────────────────────────────────────────────────────────────────────

function _getCtx(): AudioContext | null {
  if (_ctx) return _ctx;
  try {
    _ctx = new AudioContext();
    return _ctx;
  } catch {
    return null;
  }
}

function _playModeSound(mode: AppMode): void {
  if (isMuted()) return;
  switch (mode) {
    case 'war':     return _playWarAlarm();
    case 'finance': return _playFinanceChime();
    case 'peace':   return _playPeaceTone();
  }
}

/**
 * War Mode alarm — rapid descending staccato beeps (submarine battle stations).
 * Four short sawtooth bursts at decreasing pitches, harsh and urgent.
 */
function _playWarAlarm(): void {
  const ctx = _getCtx();
  if (!ctx) return;

  const freqs = [880, 740, 880, 660];
  const noteMs = 70;
  const gapMs = 35;

  freqs.forEach((freq, i) => {
    const start = ctx.currentTime + i * ((noteMs + gapMs) / 1000);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.35, start + 0.005);
    gain.gain.setValueAtTime(0.35, start + noteMs / 1000 - 0.01);
    gain.gain.linearRampToValueAtTime(0, start + noteMs / 1000);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + noteMs / 1000 + 0.01);
  });
}

/**
 * Finance Mode chime — ascending 3-note arpeggio (market opening bell).
 * Clean sine tones with smooth attack/decay: C5 → E5 → G5.
 */
function _playFinanceChime(): void {
  const ctx = _getCtx();
  if (!ctx) return;

  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
  const noteMs = 140;
  const overlapMs = 40;

  notes.forEach((freq, i) => {
    const start = ctx.currentTime + i * ((noteMs - overlapMs) / 1000);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.28, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, start + noteMs / 1000 + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + noteMs / 1000 + 0.1);
  });
}

/**
 * Peace Mode tone — single soft resonant bell tone (situation resolved).
 * Pure sine at 432 Hz with a slow natural decay.
 */
function _playPeaceTone(): void {
  const ctx = _getCtx();
  if (!ctx) return;

  const freq = 432;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, ctx.currentTime);

  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 1.3);
}
