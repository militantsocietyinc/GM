const VALID_VARIANTS = ['full', 'tech', 'finance', 'happy', 'commodity', 'australia'] as const;
type Variant = (typeof VALID_VARIANTS)[number];

function isVariant(v: string): v is Variant {
  return (VALID_VARIANTS as readonly string[]).includes(v);
}

export const SITE_VARIANT: string = (() => {
  if (typeof window === 'undefined') return import.meta.env.VITE_VARIANT || 'full';

  const isTauri = '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
  if (isTauri) {
    const stored = localStorage.getItem('worldmonitor-variant');
    if (stored && isVariant(stored)) return stored;
    return import.meta.env.VITE_VARIANT || 'full';
  }

  const h = location.hostname;
  if (h.startsWith('tech.')) return 'tech';
  if (h.startsWith('finance.')) return 'finance';
  if (h.startsWith('happy.')) return 'happy';
  if (h.startsWith('commodity.')) return 'commodity';
  // Australia variant: australia.worldmonitor.app or australiamonitor.app
  if (h.startsWith('australia.') || h.includes('australiamonitor')) return 'australia';

  if (h === 'localhost' || h === '127.0.0.1') {
    const stored = localStorage.getItem('worldmonitor-variant');
    if (stored && isVariant(stored)) return stored;
    return import.meta.env.VITE_VARIANT || 'full';
  }

  return 'full';
})();
