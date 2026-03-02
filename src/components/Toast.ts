import { t } from '../services/i18n';
import { h } from '../utils/dom-utils';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface ToastAction {
  label: string;
  callback: () => void;
}

export interface ToastOptions {
  type: ToastType;
  message: string;
  title?: string;
  duration?: number; // ms, default 5000
  actions?: ToastAction[];
}

interface ToastTypeConfig {
  icon: string;
  colorClass: string;
  defaultTitle: string;
}

const TYPE_CONFIG: Record<ToastType, ToastTypeConfig> = {
  success: { icon: '✓', colorClass: 'toast-success', defaultTitle: 'toast.success' },
  warning: { icon: '⚠', colorClass: 'toast-warning', defaultTitle: 'toast.warning' },
  error: { icon: '✕', colorClass: 'toast-error', defaultTitle: 'toast.error' },
  info: { icon: 'ℹ', colorClass: 'toast-info', defaultTitle: 'toast.info' },
};

const DEFAULT_DURATION = 5000;

export class Toast {
  private element: HTMLElement;
  private closeButton: HTMLButtonElement;
  private actionsContainer: HTMLElement | null = null;
  private autoDismissTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly id: string;
  private readonly onDismiss: (id: string) => void;

  constructor(options: ToastOptions, id: string, onDismiss: (id: string) => void) {
    this.id = id;
    this.onDismiss = onDismiss;
    this.element = this.createElement(options);
    this.closeButton = this.createCloseButton();
    this.assembleToast(options);
    this.startAutoDismiss(options.duration ?? DEFAULT_DURATION);
  }

  private createElement(options: ToastOptions): HTMLElement {
    const config = TYPE_CONFIG[options.type];
    return h('div', {
      className: `toast-item ${config.colorClass}`,
      dataset: { toastId: this.id },
      role: 'alert',
      ariaLive: 'polite',
    });
  }

  private createCloseButton(): HTMLButtonElement {
    return h('button', {
      className: 'toast-close-btn',
      'aria-label': t('toast.close') || 'Close notification',
      onClick: () => this.dismiss(),
    }, '×') as HTMLButtonElement;
  }

  private createIcon(type: ToastType): HTMLElement {
    const config = TYPE_CONFIG[type];
    return h('div', { className: 'toast-icon' }, config.icon);
  }

  private createContent(options: ToastOptions): HTMLElement {
    const config = TYPE_CONFIG[options.type];
    const title = options.title ?? t(config.defaultTitle) ?? config.defaultTitle.replace('toast.', '');

    const content = h('div', { className: 'toast-content' });

    const titleEl = h('div', { className: 'toast-title' }, title);
    content.appendChild(titleEl);

    const messageEl = h('div', { className: 'toast-message' }, options.message);
    content.appendChild(messageEl);

    return content;
  }

  private createActions(actions: ToastAction[]): HTMLElement {
    const container = h('div', { className: 'toast-actions' });

    actions.forEach((action) => {
      const btn = h('button', {
        className: 'toast-action-btn',
        onClick: () => {
          action.callback();
          this.dismiss();
        },
      }, action.label);
      container.appendChild(btn);
    });

    return container;
  }

  private assembleToast(options: ToastOptions): void {
    // Add icon
    this.element.appendChild(this.createIcon(options.type));

    // Create main body wrapper
    const body = h('div', { className: 'toast-body' });

    // Add content (title + message)
    body.appendChild(this.createContent(options));

    // Add actions if provided
    if (options.actions && options.actions.length > 0) {
      this.actionsContainer = this.createActions(options.actions);
      body.appendChild(this.actionsContainer);
    }

    this.element.appendChild(body);

    // Add close button
    this.element.appendChild(this.closeButton);
  }

  private startAutoDismiss(duration: number): void {
    if (duration > 0) {
      this.autoDismissTimer = setTimeout(() => this.dismiss(), duration);
    }
  }

  private clearAutoDismissTimer(): void {
    if (this.autoDismissTimer) {
      clearTimeout(this.autoDismissTimer);
      this.autoDismissTimer = null;
    }
  }

  public getId(): string {
    return this.id;
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public dismiss(): void {
    this.clearAutoDismissTimer();

    // Add exit animation class
    this.element.classList.add('toast-exit');

    // Remove after animation completes
    setTimeout(() => {
      this.onDismiss(this.id);
      this.element.remove();
    }, 300);
  }

  /**
   * Reset the auto-dismiss timer (e.g., when hovering)
   */
  public resetTimer(duration: number = DEFAULT_DURATION): void {
    this.clearAutoDismissTimer();
    this.startAutoDismiss(duration);
  }

  /**
   * Pause auto-dismiss
   */
  public pauseTimer(): void {
    this.clearAutoDismissTimer();
  }
}
