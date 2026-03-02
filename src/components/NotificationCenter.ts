import type { CorrelationSignal } from '@/services/correlation';
import type { UnifiedAlert } from '@/services/cross-module-integration';
import { t } from '@/services/i18n';
import { escapeHtml } from '@/utils/sanitize';

export type NotificationType = 'signal' | 'alert' | 'update' | 'data';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  data?: any;
}

export interface NotificationOptions {
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
}

const NOTIFICATIONS_KEY = 'worldmonitor-notifications';
const MAX_NOTIFICATIONS = 100;

// Type icons for notifications
const typeIcons: Record<NotificationType, string> = {
  signal: '🎯',
  alert: '⚠️',
  update: '📊',
  data: '📡',
};

// Type colors for notifications
const typeColors: Record<NotificationType, string> = {
  signal: '#44ff88',
  alert: '#ff4444',
  update: '#3388ff',
  data: '#ffaa00',
};

/**
 * NotificationCenter - Activity feed for signals, alerts, and data updates
 * Features:
 * - Bell icon with unread count badge
 * - Slide-out panel with chronological feed
 * - Mark as read/unread functionality
 * - Clear all notifications
 * - Persistence in localStorage
 * - Keyboard shortcut (N key)
 */
export class NotificationCenter {
  private notifications: Notification[] = [];
  private element: HTMLElement | null = null;
  private panel: HTMLElement | null = null;
  private bellBtn: HTMLElement | null = null;
  private badge: HTMLElement | null = null;
  private isOpen = false;
  private boundKeyHandler: ((e: KeyboardEvent) => void) | null = null;
  private onNotificationClick?: (notification: Notification) => void;

  constructor() {
    this.loadFromStorage();
    this.render();
    this.setupEventListeners();
  }

  /**
   * Generate a unique ID for notifications
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Load notifications from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(NOTIFICATIONS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Notification[];
        this.notifications = parsed.map(n => ({
          ...n,
          timestamp: new Date(n.timestamp),
        }));
      }
    } catch (e) {
      console.warn('[NotificationCenter] Failed to load from storage:', e);
      this.notifications = [];
    }
  }

  /**
   * Save notifications to localStorage
   */
  private saveToStorage(): void {
    try {
      // Keep only the most recent MAX_NOTIFICATIONS
      const toSave = this.notifications.slice(0, MAX_NOTIFICATIONS);
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.warn('[NotificationCenter] Failed to save to storage:', e);
    }
  }

  /**
   * Get relative time string (e.g., "2m ago")
   */
  private getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 10) return t('notifications.time.justNow');
    if (diffSecs < 60) return t('notifications.time.secondsAgo', { seconds: diffSecs });
    if (diffMins < 60) return t('notifications.time.minutesAgo', { minutes: diffMins });
    if (diffHours < 24) return t('notifications.time.hoursAgo', { hours: diffHours });
    if (diffDays < 7) return t('notifications.time.daysAgo', { days: diffDays });
    return new Date(date).toLocaleDateString();
  }

  /**
   * Render the notification center UI
   */
  private render(): void {
    // Create container element
    this.element = document.createElement('div');
    this.element.className = 'notification-center';

    // Create bell button with badge
    this.bellBtn = document.createElement('button');
    this.bellBtn.className = 'notification-bell-btn';
    this.bellBtn.title = t('notifications.title');
    this.bellBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
      </svg>
      <span class="notification-badge" style="display: none;"></span>
    `;

    // Create badge element reference
    this.badge = this.bellBtn.querySelector('.notification-badge');

    // Create slide-out panel
    this.panel = document.createElement('div');
    this.panel.className = 'notification-panel';
    this.panel.innerHTML = `
      <div class="notification-panel-header">
        <span class="notification-panel-title">${t('notifications.title')}</span>
        <div class="notification-panel-actions">
          <button class="notification-mark-all-btn" title="${t('notifications.markAllRead')}">
            ${t('notifications.markAllRead')}
          </button>
          <button class="notification-clear-all-btn" title="${t('notifications.clearAll')}">
            ${t('notifications.clearAll')}
          </button>
          <button class="notification-close-btn" title="${t('common.close')}">×</button>
        </div>
      </div>
      <div class="notification-list"></div>
      <div class="notification-empty" style="display: none;">
        <div class="notification-empty-icon">🔔</div>
        <div class="notification-empty-text">${t('notifications.empty')}</div>
      </div>
    `;

    // Add overlay for closing on outside click
    const overlay = document.createElement('div');
    overlay.className = 'notification-overlay';
    this.panel.appendChild(overlay);

    this.element.appendChild(this.bellBtn);
    this.element.appendChild(this.panel);

    // Update badge and list
    this.updateBadge();
    this.renderList();
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Bell button click
    this.bellBtn?.addEventListener('click', () => {
      this.toggle();
    });

    // Close button click
    const closeBtn = this.panel?.querySelector('.notification-close-btn');
    closeBtn?.addEventListener('click', () => {
      this.hide();
    });

    // Mark all as read button
    const markAllBtn = this.panel?.querySelector('.notification-mark-all-btn');
    markAllBtn?.addEventListener('click', () => {
      this.markAllAsRead();
    });

    // Clear all button
    const clearAllBtn = this.panel?.querySelector('.notification-clear-all-btn');
    clearAllBtn?.addEventListener('click', () => {
      this.clearAll();
    });

    // Overlay click to close
    const overlay = this.panel?.querySelector('.notification-overlay');
    overlay?.addEventListener('click', () => {
      this.hide();
    });

    // Keyboard shortcut: N key to open
    this.boundKeyHandler = (e: KeyboardEvent) => {
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        const active = document.activeElement;
        if (active?.tagName !== 'INPUT' && active?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          this.toggle();
        }
      }
      if (e.key === 'Escape' && this.isOpen) {
        this.hide();
      }
    };
    document.addEventListener('keydown', this.boundKeyHandler);

    // Delegate click handler for notification items
    this.panel?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // Mark as read button
      if (target.classList.contains('notification-item-mark-read')) {
        const id = target.closest('.notification-item')?.getAttribute('data-id');
        if (id) this.markAsRead(id);
        return;
      }

      // Dismiss button
      if (target.classList.contains('notification-item-dismiss')) {
        const id = target.closest('.notification-item')?.getAttribute('data-id');
        if (id) this.clear(id);
        return;
      }

      // Click on notification item (but not on action buttons)
      const item = target.closest('.notification-item');
      if (item && !target.closest('.notification-item-actions')) {
        const id = item.getAttribute('data-id');
        if (id) {
          const notification = this.notifications.find(n => n.id === id);
          if (notification) {
            this.markAsRead(id);
            this.onNotificationClick?.(notification);
          }
        }
      }
    });
  }

  /**
   * Render the notification list
   */
  private renderList(): void {
    const listContainer = this.panel?.querySelector('.notification-list');
    const emptyState = this.panel?.querySelector('.notification-empty');

    if (!listContainer || !emptyState) return;

    if (this.notifications.length === 0) {
      listContainer.innerHTML = '';
      emptyState.setAttribute('style', 'display: flex;');
      return;
    }

    emptyState.setAttribute('style', 'display: none;');

    const html = this.notifications.map(notification => {
      const icon = typeIcons[notification.type];
      const color = typeColors[notification.type];
      const timeAgo = this.getRelativeTime(notification.timestamp);
      const unreadClass = notification.read ? '' : 'unread';

      return `
        <div class="notification-item ${unreadClass}" data-id="${notification.id}" style="border-left-color: ${color}">
          <div class="notification-item-icon" style="background: ${color}22; color: ${color}">
            ${icon}
          </div>
          <div class="notification-item-content">
            <div class="notification-item-title">${escapeHtml(notification.title)}</div>
            <div class="notification-item-message">${escapeHtml(notification.message)}</div>
            <div class="notification-item-meta">
              <span class="notification-item-time">${timeAgo}</span>
              <span class="notification-item-type">${notification.type}</span>
            </div>
          </div>
          <div class="notification-item-actions">
            ${!notification.read ? `
              <button class="notification-item-mark-read" title="${t('notifications.markRead')}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </button>
            ` : ''}
            <button class="notification-item-dismiss" title="${t('notifications.dismiss')}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      `;
    }).join('');

    listContainer.innerHTML = html;
  }

  /**
   * Update the badge count
   */
  private updateBadge(): void {
    const unreadCount = this.getUnreadCount();
    if (this.badge) {
      if (unreadCount > 0) {
        this.badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
        this.badge.style.display = 'flex';
        this.bellBtn?.classList.add('has-unread');
      } else {
        this.badge.style.display = 'none';
        this.bellBtn?.classList.remove('has-unread');
      }
    }
  }

  /**
   * Show the notification panel
   */
  public show(): void {
    this.isOpen = true;
    this.panel?.classList.add('active');
    this.bellBtn?.classList.add('active');
    document.body.classList.add('notification-panel-open');
  }

  /**
   * Hide the notification panel
   */
  public hide(): void {
    this.isOpen = false;
    this.panel?.classList.remove('active');
    this.bellBtn?.classList.remove('active');
    document.body.classList.remove('notification-panel-open');
  }

  /**
   * Toggle the notification panel
   */
  public toggle(): void {
    if (this.isOpen) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Add a new notification
   */
  public add(options: NotificationOptions): void {
    const notification: Notification = {
      id: this.generateId(),
      type: options.type,
      title: options.title,
      message: options.message,
      timestamp: new Date(),
      read: false,
      data: options.data,
    };

    // Add to beginning of list
    this.notifications.unshift(notification);

    // Trim to max size
    if (this.notifications.length > MAX_NOTIFICATIONS) {
      this.notifications = this.notifications.slice(0, MAX_NOTIFICATIONS);
    }

    this.saveToStorage();
    this.updateBadge();
    this.renderList();
  }

  /**
   * Add a signal notification
   */
  public addSignal(signal: CorrelationSignal): void {
    this.add({
      type: 'signal',
      title: signal.title,
      message: signal.description,
      data: signal,
    });
  }

  /**
   * Add an alert notification
   */
  public addAlert(alert: UnifiedAlert): void {
    this.add({
      type: 'alert',
      title: alert.title,
      message: alert.summary,
      data: alert,
    });
  }

  /**
   * Mark a notification as read
   */
  public markAsRead(id: string): void {
    const notification = this.notifications.find(n => n.id === id);
    if (notification && !notification.read) {
      notification.read = true;
      this.saveToStorage();
      this.updateBadge();
      this.renderList();
    }
  }

  /**
   * Mark all notifications as read
   */
  public markAllAsRead(): void {
    let changed = false;
    for (const notification of this.notifications) {
      if (!notification.read) {
        notification.read = true;
        changed = true;
      }
    }
    if (changed) {
      this.saveToStorage();
      this.updateBadge();
      this.renderList();
    }
  }

  /**
   * Clear a specific notification
   */
  public clear(id: string): void {
    const index = this.notifications.findIndex(n => n.id === id);
    if (index !== -1) {
      this.notifications.splice(index, 1);
      this.saveToStorage();
      this.updateBadge();
      this.renderList();
    }
  }

  /**
   * Clear all notifications
   */
  public clearAll(): void {
    if (this.notifications.length > 0) {
      this.notifications = [];
      this.saveToStorage();
      this.updateBadge();
      this.renderList();
    }
  }

  /**
   * Get unread count
   */
  public getUnreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  /**
   * Get all notifications
   */
  public getNotifications(): Notification[] {
    return [...this.notifications];
  }

  /**
   * Set callback for when a notification is clicked
   */
  public setOnNotificationClick(callback: (notification: Notification) => void): void {
    this.onNotificationClick = callback;
  }

  /**
   * Get the bell button element for mounting
   */
  public getElement(): HTMLElement {
    return this.element!;
  }

  /**
   * Get the bell button specifically for header placement
   */
  public getBellButton(): HTMLElement {
    return this.bellBtn!;
  }

  /**
   * Destroy the notification center
   */
  public destroy(): void {
    if (this.boundKeyHandler) {
      document.removeEventListener('keydown', this.boundKeyHandler);
    }
    this.element?.remove();
  }
}

// Export singleton instance for global access
let globalNotificationCenter: NotificationCenter | null = null;

export function getNotificationCenter(): NotificationCenter | null {
  return globalNotificationCenter;
}

export function setNotificationCenter(center: NotificationCenter | null): void {
  globalNotificationCenter = center;
}
