/**
 * Utility for exporting and importing World Monitor dashboard settings.
 */

export interface ExportedSettings {
  version: number;
  timestamp: string;
  variant: string;
  data: Record<string, string>;
}

export function exportSettings(): void {
  const data: Record<string, string> = {};

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    // Ignore massive internal caches or transient states to avoid bloated JSON
    if (
      key.startsWith('wm-cache-') ||
      key.includes('vesselPosture') ||
      key.includes('wm-secrets-updated') ||
      key.includes('wm-waitlist-registered') ||
      key.includes('wm-debug-log') ||
      key.includes('wm-settings-open')
    ) {
      continue;
    }

    const value = localStorage.getItem(key);
    if (value !== null) {
      data[key] = value;
    }
  }

  const exportData: ExportedSettings = {
    version: 1,
    timestamp: new Date().toISOString(),
    variant: localStorage.getItem('worldmonitor-variant') || 'full',
    data,
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const timestampStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  a.download = `worldmonitor-settings-${timestampStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importSettings(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const result = e.target?.result as string;
        const parsed = JSON.parse(result) as ExportedSettings;

        if (!parsed || !parsed.data || typeof parsed.data !== 'object') {
          throw new Error('Invalid format');
        }

        // Apply settings
        for (const [key, value] of Object.entries(parsed.data)) {
          if (typeof value === 'string') {
            localStorage.setItem(key, value);
          }
        }

        // Reload to apply settings
        window.location.reload();
        resolve();
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
