import { h, replaceChildren } from '../utils/dom-utils';

/**
 * Options for configuring an empty state illustration.
 */
export interface EmptyStateOptions {
  /** SVG icon string or emoji character */
  icon: string;
  /** Main title text */
  title: string;
  /** Optional subtitle for additional context */
  subtitle?: string;
  /** Optional action button configuration */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Optional theme color (CSS variable name or color value) */
  themeColor?: string;
  /** Whether to show the pulse animation (default: true) */
  animated?: boolean;
}

/**
 * Predefined SVG icons for common panel types.
 * These are inline SVGs with no external dependencies.
 */
export const EmptyStateIcons = {
  /** Newspaper icon for news panels */
  newspaper: '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>',

  /** Globe icon for geographic/CII panels */
  globe: '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',

  /** Siren/alert icon for siren panels */
  siren: '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18v-9a5 5 0 0 1 10 0v9"/><path d="M5 21a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2H5v2Z"/><path d="M21 12h1"/><path d="M18.5 4.5 17 6"/><path d="M2 12h1"/><path d="M7 4.5 5.5 6"/></svg>',

  /** Satellite icon for satellite fire panels */
  satellite: '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 7 9 3 5 7l4 4"/><path d="m17 11 4-4-4-4-4 4"/><path d="m8 14 4 4 4-4-4-4-4 4"/><path d="m12 12 4 4 4-4-4-4-4 4"/><path d="m8 8 4-4 4 4"/><path d="M3 21l6-6"/></svg>',

  /** Peace/dove icon for conflict panels */
  peace: '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 12 2.2 8.5"/><path d="M12 12v9.8"/><path d="M12 12 21.8 8.5"/></svg>',

  /** Chart icon for financial/data panels */
  chart: '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>',

  /** Flame icon for fire panels */
  flame: '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',

  /** Database icon for data panels */
  database: '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>',

  /** Search icon for search/no results panels */
  search: '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',

  /** Box/archive icon for storage/history panels */
  archive: '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>',

  /** Cloud icon for weather/cloud panels */
  cloud: '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>',

  /** Wifi/signal icon for connectivity panels */
  wifi: '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" x2="12.01" y1="20" y2="20"/></svg>',

  /** Shield icon for security panels */
  shield: '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>',

  /** Bell icon for notification/alert panels */
  bell: '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',

  /** File/text icon for document panels */
  fileText: '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>',

  /** Users icon for population/community panels */
  users: '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',

  /** Activity/pulse icon for monitoring panels */
  activity: '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',

  /** Thermometer icon for temperature/climate panels */
  thermometer: '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/></svg>',

  /** Dollar/currency icon for financial panels */
  dollar: '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',

  /** Map icon for geographic panels */
  map: '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" x2="9" y1="3" y2="18"/><line x1="15" x2="15" y1="6" y2="21"/></svg>',

  /** Clock icon for time/history panels */
  clock: '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
} as const;

/** Type for predefined icon keys */
export type EmptyStateIconKey = keyof typeof EmptyStateIcons;

/**
 * Reusable Empty State component for panels with no data.
 * Provides consistent styling across all panels with customizable
 * icons, titles, subtitles, and optional action buttons.
 */
export class EmptyState {
  private currentElement: HTMLElement | null = null;

  /**
   * Renders the empty state to a container element.
   * @param container - The container to render into
   * @param options - Configuration options for the empty state
   * @returns The rendered empty state element
   */
  public render(container: HTMLElement, options: EmptyStateOptions): HTMLElement {
    const element = this.createElement(options);
    replaceChildren(container, element);
    this.currentElement = element;
    return element;
  }

  /**
   * Creates the empty state element without attaching it.
   * @param options - Configuration options for the empty state
   * @returns The created empty state element
   */
  public createElement(options: EmptyStateOptions): HTMLElement {
    const {
      icon,
      title,
      subtitle,
      action,
      themeColor,
      animated = true,
    } = options;

    // Determine icon content (SVG string or emoji)
    const iconContent = EmptyStateIcons[icon as EmptyStateIconKey] || icon;
    const isSvg = iconContent.startsWith('<svg');

    // Build the element structure
    const children: Array<HTMLElement | string> = [];

    // Icon wrapper
    const iconWrapper = h('div', {
      className: `empty-state-icon ${animated ? 'empty-state-animated' : ''}`,
      style: themeColor ? { color: themeColor } : undefined,
    });

    if (isSvg) {
      iconWrapper.innerHTML = iconContent;
    } else {
      iconWrapper.textContent = iconContent;
      iconWrapper.style.fontSize = '48px';
    }

    children.push(iconWrapper);

    // Title
    children.push(h('div', { className: 'empty-state-title' }, title));

    // Subtitle (optional)
    if (subtitle) {
      children.push(h('div', { className: 'empty-state-subtitle' }, subtitle));
    }

    // Action button (optional)
    if (action) {
      const actionBtn = h(
        'button',
        {
          className: 'empty-state-action',
          onClick: action.onClick,
        },
        action.label
      );
      children.push(actionBtn);
    }

    // Main container
    const element = h(
      'div',
      {
        className: 'empty-state-container',
        style: themeColor ? { '--empty-state-color': themeColor } as unknown as string : undefined,
      },
      ...children
    );

    return element;
  }

  /**
   * Gets a predefined icon SVG string by key.
   * @param key - The icon key
   * @returns The SVG string, or undefined if not found
   */
  public static getIcon(key: EmptyStateIconKey): string {
    return EmptyStateIcons[key];
  }

  /**
   * Checks if a string is a valid predefined icon key.
   * @param value - The value to check
   * @returns True if the value is a valid icon key
   */
  public static isIconKey(value: string): value is EmptyStateIconKey {
    return value in EmptyStateIcons;
  }

  /**
   * Destroys the current empty state and cleans up.
   */
  public destroy(): void {
    this.currentElement = null;
  }
}

/**
 * Convenience function to quickly render an empty state.
 * @param container - The container element
 * @param options - Empty state options
 * @returns The rendered element
 */
export function renderEmptyState(container: HTMLElement, options: EmptyStateOptions): HTMLElement {
  const emptyState = new EmptyState();
  return emptyState.render(container, options);
}

/**
 * Predefined empty state configurations for common panel types.
 */
export const EmptyStatePresets = {
  /** Empty state for news panels */
  news: (action?: { label: string; onClick: () => void }): EmptyStateOptions => ({
    icon: 'newspaper',
    title: 'No news available',
    subtitle: 'Check back later for updates',
    action,
  }),

  /** Empty state for CII (Country Instability Index) panels */
  cii: (action?: { label: string; onClick: () => void }): EmptyStateOptions => ({
    icon: 'globe',
    title: 'No CII data for selected region',
    subtitle: 'Try adjusting your filters',
    action,
  }),

  /** Empty state for OREF sirens panel when calm */
  sirensCalm: (): EmptyStateOptions => ({
    icon: '✅',
    title: 'No active sirens',
    subtitle: 'All clear - no current alerts in your area',
    themeColor: 'var(--semantic-normal)',
  }),

  /** Empty state for OREF sirens panel when not configured */
  sirensNotConfigured: (): EmptyStateOptions => ({
    icon: 'siren',
    title: 'OREF alerts not configured',
    subtitle: 'Configure OREF settings to see local alerts',
    themeColor: 'var(--text-muted)',
  }),

  /** Empty state for satellite fire panels */
  satelliteFires: (): EmptyStateOptions => ({
    icon: 'satellite',
    title: 'No fire detections',
    subtitle: 'No thermal anomalies detected in monitored regions',
    themeColor: 'var(--semantic-normal)',
  }),

  /** Empty state for UCDP conflict events panels */
  ucdpEvents: (): EmptyStateOptions => ({
    icon: 'peace',
    title: 'No conflict events',
    subtitle: 'No recorded events in this category',
    themeColor: 'var(--semantic-normal)',
  }),

  /** Empty state for stablecoin panels */
  stablecoin: (): EmptyStateOptions => ({
    icon: 'chart',
    title: 'No price deviations',
    subtitle: 'All stablecoins are trading normally',
    themeColor: 'var(--semantic-normal)',
  }),

  /** Empty state for climate panels */
  climate: (): EmptyStateOptions => ({
    icon: 'cloud',
    title: 'No anomalies detected',
    subtitle: 'Weather patterns are within normal ranges',
    themeColor: 'var(--semantic-normal)',
  }),

  /** Empty state for security advisories panels */
  securityAdvisories: (): EmptyStateOptions => ({
    icon: 'shield',
    title: 'No advisories',
    subtitle: 'No travel security alerts at this time',
    themeColor: 'var(--semantic-normal)',
  }),

  /** Empty state for displacement panels */
  displacement: (): EmptyStateOptions => ({
    icon: 'users',
    title: 'No displacement data',
    subtitle: 'No current displacement statistics available',
  }),

  /** Empty state for search results */
  search: (query?: string): EmptyStateOptions => ({
    icon: 'search',
    title: 'No results found',
    subtitle: query ? `No matches for "${query}"` : 'Try adjusting your search terms',
  }),

  /** Empty state for generic data panels */
  generic: (title = 'No data available', subtitle?: string): EmptyStateOptions => ({
    icon: 'database',
    title,
    subtitle: subtitle || 'Data will appear when available',
  }),

  /** Empty state for filter results with no matches */
  filtered: (action?: { label: string; onClick: () => void }): EmptyStateOptions => ({
    icon: 'fileText',
    title: 'No matching items',
    subtitle: 'Try adjusting your filters to see more results',
    action,
  }),

  /** Empty state for loading errors */
  error: (message?: string, retryAction?: () => void): EmptyStateOptions => ({
    icon: 'activity',
    title: 'Failed to load data',
    subtitle: message || 'An error occurred while fetching data',
    action: retryAction ? { label: 'Retry', onClick: retryAction } : undefined,
    themeColor: 'var(--semantic-critical)',
  }),
};
