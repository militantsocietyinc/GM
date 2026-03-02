export const SITE_VARIANT: string = (() => {
  const env = import.meta.env.VITE_VARIANT || 'full';
  // Build-time variant (non-full) takes priority — each deployment is variant-specific.
  // Only fall back to localStorage when env is 'full' (allows desktop app variant switching).
  if (env !== 'full') return env;
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('worldmonitor-variant');
    // 'happy' (TV/Good News Mode) is web-only — desktop app never supports it.
    // If stuck in happy from a previous web session, silently revert to 'full'.
    const isDesktop =
      import.meta.env.VITE_DESKTOP_RUNTIME === '1' ||
      '__TAURI_INTERNALS__' in window ||
      '__TAURI__' in window;
    if (stored === 'tech' || stored === 'full' || stored === 'finance') return stored;
    if (stored === 'happy') {
      if (isDesktop) {
        // Auto-correct: clear stale 'happy' so App.ts sees the mismatch and resets settings.
        try { localStorage.setItem('worldmonitor-variant', 'full'); } catch { /* ignore */ }
        return 'full';
      }
      return stored;
    }
  }
  return env;
})();
