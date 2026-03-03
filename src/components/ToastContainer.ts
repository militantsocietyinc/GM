import { Toast, ToastOptions } from './Toast';

const MAX_VISIBLE_TOASTS = 5;

export class ToastContainer {
  private container: HTMLElement | null = null;
  private toasts: Map<string, Toast> = new Map();
  private toastOrder: string[] = [];
  private static instance: ToastContainer | null = null;

  constructor() {
    // Singleton pattern - only create one container instance
    if (ToastContainer.instance) {
      return ToastContainer.instance;
    }
    ToastContainer.instance = this;
    this.ensureContainer();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): ToastContainer {
    if (!ToastContainer.instance) {
      ToastContainer.instance = new ToastContainer();
    }
    return ToastContainer.instance;
  }

  /**
   * Create and append the toast container to the document body
   */
  private ensureContainer(): void {
    if (this.container) return;

    this.container = document.createElement('div');
    this.container.className = 'toast-container';
    this.container.setAttribute('aria-live', 'polite');
    this.container.setAttribute('aria-atomic', 'true');

    // Append to body when DOM is ready
    if (document.body) {
      document.body.appendChild(this.container);
    } else {
      // If body isn't ready yet, wait for DOMContentLoaded
      document.addEventListener('DOMContentLoaded', () => {
        if (this.container && !this.container.parentElement) {
          document.body.appendChild(this.container);
        }
      });
    }
  }

  /**
   * Show a new toast notification
   * @param options Toast configuration options
   * @returns The toast ID
   */
  public show(options: ToastOptions): string {
    this.ensureContainer();

    // Remove oldest toast if at max capacity
    if (this.toastOrder.length >= MAX_VISIBLE_TOASTS) {
      const oldestId = this.toastOrder[0];
      if (oldestId) {
        this.dismiss(oldestId);
      }
    }

    // Generate unique ID
    const id = this.generateId();

    // Create toast instance
    const toast = new Toast(options, id, (toastId) => this.handleToastDismiss(toastId));

    // Store and track
    this.toasts.set(id, toast);
    this.toastOrder.push(id);

    // Add to DOM with animation
    if (this.container) {
      this.container.appendChild(toast.getElement());

      // Trigger enter animation on next frame
      requestAnimationFrame(() => {
        toast.getElement().classList.add('toast-enter');
      });
    }

    return id;
  }

  /**
   * Dismiss a specific toast by ID
   * @param toastId The ID of the toast to dismiss
   */
  public dismiss(toastId: string): void {
    const toast = this.toasts.get(toastId);
    if (toast) {
      toast.dismiss();
    }
  }

  /**
   * Dismiss all visible toasts
   */
  public dismissAll(): void {
    // Copy array since dismiss modifies toastOrder
    const ids = [...this.toastOrder];
    ids.forEach((id) => this.dismiss(id));
  }

  /**
   * Get the number of currently visible toasts
   */
  public getCount(): number {
    return this.toasts.size;
  }

  /**
   * Check if a toast with the given ID exists
   */
  public has(toastId: string): boolean {
    return this.toasts.has(toastId);
  }

  /**
   * Handle internal toast dismissal (called by Toast instances)
   */
  private handleToastDismiss(toastId: string): void {
    this.toasts.delete(toastId);
    const index = this.toastOrder.indexOf(toastId);
    if (index > -1) {
      this.toastOrder.splice(index, 1);
    }

    // Remove container if empty and no more toasts
    if (this.toasts.size === 0 && this.container) {
      this.container.classList.add('toast-container-empty');
    }
  }

  /**
   * Generate a unique toast ID
   */
  private generateId(): string {
    return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Destroy the container and clean up all toasts
   */
  public destroy(): void {
    this.dismissAll();
    if (this.container && this.container.parentElement) {
      this.container.remove();
    }
    this.container = null;
    ToastContainer.instance = null;
  }
}

// Global singleton instance
export const toast = new ToastContainer();

// Re-export types for convenience
export type { ToastOptions, ToastAction, ToastType } from './Toast';

/**
 * Test usage examples (for development):
 * 
 * ```typescript
 * import { toast } from './components/ToastContainer';
 * 
 * // Basic success toast
 * toast.show({ type: 'success', message: 'Settings saved!' });
 * 
 * // Error toast with custom duration
 * toast.show({ type: 'error', message: 'Connection failed', duration: 8000 });
 * 
 * // Warning toast with custom title
 * toast.show({ 
 *   type: 'warning', 
 *   title: 'Attention',
 *   message: 'API rate limit approaching' 
 * });
 * 
 * // Info toast with action button
 * toast.show({
 *   type: 'info',
 *   message: 'New data available for your region',
 *   actions: [
 *     { label: 'View', callback: () => console.log('Viewing data...') }
 *   ]
 * });
 * 
 * // Dismiss a specific toast (using returned ID)
 * const toastId = toast.show({ type: 'info', message: 'Processing...' });
 * // Later...
 * toast.dismiss(toastId);
 * 
 * // Dismiss all toasts
 * toast.dismissAll();
 * ```
 */
