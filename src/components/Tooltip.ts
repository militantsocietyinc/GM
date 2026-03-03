import { h } from '../utils/dom-utils';
import { safeHtml } from '../utils/dom-utils';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';
export type TooltipTrigger = 'hover' | 'click' | 'focus';

export interface TooltipOptions {
  content: string | HTMLElement;
  position?: TooltipPosition;
  delay?: number; // ms, default 300
  maxWidth?: number; // px, default 300
  allowHTML?: boolean;
  trigger?: TooltipTrigger;
}

interface PositionCoords {
  top: number;
  left: number;
  arrowPosition: TooltipPosition;
}

const DEFAULT_DELAY = 300;
const DEFAULT_MAX_WIDTH = 300;

export class Tooltip {
  private tooltipEl: HTMLElement | null = null;
  private targetEl: HTMLElement;
  private options: Required<TooltipOptions>;
  private showTimeout: ReturnType<typeof setTimeout> | null = null;
  private hideTimeout: ReturnType<typeof setTimeout> | null = null;
  private isPinned = false;
  private documentClickHandler: ((e: MouseEvent) => void) | null = null;
  private targetMouseEnterHandler: () => void;
  private targetMouseLeaveHandler: () => void;
  private targetClickHandler: (e: MouseEvent) => void;
  private targetFocusHandler: () => void;
  private targetBlurHandler: () => void;
  private tooltipMouseEnterHandler: () => void;
  private tooltipMouseLeaveHandler: () => void;

  constructor(target: HTMLElement, options: TooltipOptions) {
    this.targetEl = target;
    this.options = {
      content: options.content,
      position: options.position ?? 'top',
      delay: options.delay ?? DEFAULT_DELAY,
      maxWidth: options.maxWidth ?? DEFAULT_MAX_WIDTH,
      allowHTML: options.allowHTML ?? false,
      trigger: options.trigger ?? 'hover',
    };

    // Bind handlers
    this.targetMouseEnterHandler = this.handleTargetMouseEnter.bind(this);
    this.targetMouseLeaveHandler = this.handleTargetMouseLeave.bind(this);
    this.targetClickHandler = this.handleTargetClick.bind(this);
    this.targetFocusHandler = this.handleTargetFocus.bind(this);
    this.targetBlurHandler = this.handleTargetBlur.bind(this);
    this.tooltipMouseEnterHandler = this.handleTooltipMouseEnter.bind(this);
    this.tooltipMouseLeaveHandler = this.handleTooltipMouseLeave.bind(this);

    this.attachListeners();
  }

  private attachListeners(): void {
    const trigger = this.options.trigger;

    if (trigger === 'hover' || trigger === 'click') {
      this.targetEl.addEventListener('mouseenter', this.targetMouseEnterHandler);
      this.targetEl.addEventListener('mouseleave', this.targetMouseLeaveHandler);
    }

    if (trigger === 'click') {
      this.targetEl.addEventListener('click', this.targetClickHandler);
    }

    if (trigger === 'focus') {
      this.targetEl.addEventListener('focus', this.targetFocusHandler);
      this.targetEl.addEventListener('blur', this.targetBlurHandler);
    }

    // Remove native title to prevent duplicate tooltips
    if (this.targetEl.hasAttribute('title')) {
      this.targetEl.removeAttribute('title');
    }
  }

  private handleTargetMouseEnter(): void {
    if (this.isPinned) return;
    this.scheduleShow();
  }

  private handleTargetMouseLeave(): void {
    if (this.isPinned) return;
    this.scheduleHide();
  }

  private handleTargetClick(e: MouseEvent): void {
    e.stopPropagation();
    if (this.isPinned) {
      this.hide();
    } else {
      this.show();
      this.pin();
    }
  }

  private handleTargetFocus(): void {
    this.show();
  }

  private handleTargetBlur(): void {
    this.hide();
  }

  private handleTooltipMouseEnter(): void {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }

  private handleTooltipMouseLeave(): void {
    if (!this.isPinned) {
      this.scheduleHide();
    }
  }

  private handleDocumentClick(e: MouseEvent): void {
    if (!this.isPinned) return;
    
    const clickedInsideTooltip = this.tooltipEl?.contains(e.target as Node);
    const clickedTarget = this.targetEl === e.target || this.targetEl.contains(e.target as Node);
    
    if (!clickedInsideTooltip && !clickedTarget) {
      this.hide();
    }
  }

  private scheduleShow(): void {
    this.clearTimeouts();
    this.showTimeout = setTimeout(() => {
      this.show();
    }, this.options.delay);
  }

  private scheduleHide(): void {
    this.clearTimeouts();
    this.hideTimeout = setTimeout(() => {
      this.hide();
    }, 100); // Small delay for smooth cursor movement
  }

  private clearTimeouts(): void {
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
      this.showTimeout = null;
    }
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }

  private createTooltipElement(): HTMLElement {
    const tooltip = h('div', {
      className: 'tooltip',
      style: { maxWidth: `${this.options.maxWidth}px` },
    });

    // Create arrow
    const arrow = h('div', { className: 'tooltip-arrow' });
    tooltip.appendChild(arrow);

    // Create content container
    const content = h('div', { className: 'tooltip-content' });
    
    if (typeof this.options.content === 'string') {
      if (this.options.allowHTML) {
        content.appendChild(safeHtml(this.options.content));
      } else {
        content.textContent = this.options.content;
      }
    } else if (this.options.content instanceof HTMLElement) {
      content.appendChild(this.options.content);
    }

    tooltip.appendChild(content);

    // Add hover handlers to tooltip itself
    tooltip.addEventListener('mouseenter', this.tooltipMouseEnterHandler);
    tooltip.addEventListener('mouseleave', this.tooltipMouseLeaveHandler);

    return tooltip;
  }

  private calculatePosition(): PositionCoords {
    const targetRect = this.targetEl.getBoundingClientRect();
    const tooltipEl = this.tooltipEl!;
    
    // Temporarily show to get dimensions
    tooltipEl.style.visibility = 'hidden';
    tooltipEl.style.opacity = '0';
    document.body.appendChild(tooltipEl);
    
    const tooltipRect = tooltipEl.getBoundingClientRect();
    const margin = 8;
    const arrowSize = 8;

    let position = this.options.position;
    let top = 0;
    let left = 0;

    // Calculate available space in each direction
    const spaceAbove = targetRect.top;
    const spaceBelow = window.innerHeight - targetRect.bottom;
    const spaceLeft = targetRect.left;
    const spaceRight = window.innerWidth - targetRect.right;

    // Smart positioning - flip if there's not enough space
    const shouldFlipVertical = 
      (position === 'top' && spaceAbove < tooltipRect.height + arrowSize) ||
      (position === 'bottom' && spaceBelow < tooltipRect.height + arrowSize);
    
    const shouldFlipHorizontal = 
      (position === 'left' && spaceLeft < tooltipRect.width + arrowSize) ||
      (position === 'right' && spaceRight < tooltipRect.width + arrowSize);

    if (shouldFlipVertical) {
      position = position === 'top' ? 'bottom' : 'top';
    }
    if (shouldFlipHorizontal) {
      position = position === 'left' ? 'right' : 'left';
    }

    // Calculate position based on final direction
    switch (position) {
      case 'top':
        top = targetRect.top - tooltipRect.height - arrowSize - margin;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = targetRect.bottom + arrowSize + margin;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        left = targetRect.left - tooltipRect.width - arrowSize - margin;
        break;
      case 'right':
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        left = targetRect.right + arrowSize + margin;
        break;
    }

    // Ensure tooltip stays within viewport
    left = Math.max(margin, Math.min(left, window.innerWidth - tooltipRect.width - margin));
    top = Math.max(margin, Math.min(top, window.innerHeight - tooltipRect.height - margin));

    return { top, left, arrowPosition: position };
  }

  private updateArrowPosition(position: TooltipPosition): void {
    if (!this.tooltipEl) return;
    
    const arrow = this.tooltipEl.querySelector('.tooltip-arrow') as HTMLElement;
    if (!arrow) return;

    // Reset all position classes
    arrow.classList.remove('tooltip-arrow-top', 'tooltip-arrow-bottom', 'tooltip-arrow-left', 'tooltip-arrow-right');
    arrow.classList.add(`tooltip-arrow-${position}`);
  }

  public show(): void {
    if (this.tooltipEl?.classList.contains('visible')) return;

    if (!this.tooltipEl) {
      this.tooltipEl = this.createTooltipElement();
    }

    const { top, left, arrowPosition } = this.calculatePosition();
    this.updateArrowPosition(arrowPosition);

    this.tooltipEl.style.top = `${top + window.scrollY}px`;
    this.tooltipEl.style.left = `${left + window.scrollX}px`;
    this.tooltipEl.style.visibility = 'visible';

    // Force reflow for animation
    void this.tooltipEl.offsetWidth;

    this.tooltipEl.classList.add('visible');
  }

  public hide(): void {
    if (!this.tooltipEl) return;

    this.tooltipEl.classList.remove('visible');
    this.isPinned = false;

    // Remove document click handler
    if (this.documentClickHandler) {
      document.removeEventListener('click', this.documentClickHandler);
      this.documentClickHandler = null;
    }

    // Remove after animation
    setTimeout(() => {
      if (!this.tooltipEl?.classList.contains('visible')) {
        this.tooltipEl?.remove();
        this.tooltipEl = null;
      }
    }, 200);
  }

  private pin(): void {
    this.isPinned = true;
    
    // Add document click handler to close when clicking outside
    this.documentClickHandler = this.handleDocumentClick.bind(this);
    // Use setTimeout to avoid immediate trigger from the click that pinned it
    setTimeout(() => {
      document.addEventListener('click', this.documentClickHandler!);
    }, 0);
  }

  public destroy(): void {
    this.hide();
    this.clearTimeouts();

    // Remove event listeners
    this.targetEl.removeEventListener('mouseenter', this.targetMouseEnterHandler);
    this.targetEl.removeEventListener('mouseleave', this.targetMouseLeaveHandler);
    this.targetEl.removeEventListener('click', this.targetClickHandler);
    this.targetEl.removeEventListener('focus', this.targetFocusHandler);
    this.targetEl.removeEventListener('blur', this.targetBlurHandler);

    if (this.documentClickHandler) {
      document.removeEventListener('click', this.documentClickHandler);
    }
  }

  /**
   * Update tooltip content
   */
  public setContent(content: string | HTMLElement, allowHTML = this.options.allowHTML): void {
    this.options.content = content;
    this.options.allowHTML = allowHTML;

    if (this.tooltipEl) {
      const contentEl = this.tooltipEl.querySelector('.tooltip-content');
      if (contentEl) {
        contentEl.innerHTML = '';
        if (typeof content === 'string') {
          if (allowHTML) {
            contentEl.appendChild(safeHtml(content));
          } else {
            contentEl.textContent = content;
          }
        } else if (content instanceof HTMLElement) {
          contentEl.appendChild(content);
        }
      }
    }
  }

  /**
   * Update tooltip position
   */
  public setPosition(position: TooltipPosition): void {
    this.options.position = position;
    if (this.tooltipEl?.classList.contains('visible')) {
      const { top, left, arrowPosition } = this.calculatePosition();
      this.updateArrowPosition(arrowPosition);
      this.tooltipEl.style.top = `${top + window.scrollY}px`;
      this.tooltipEl.style.left = `${left + window.scrollX}px`;
    }
  }

  /**
   * Initialize tooltips for elements matching a selector
   */
  public static init(
    selector: string,
    optionsGetter: (el: HTMLElement) => TooltipOptions,
  ): void {
    const elements = document.querySelectorAll<HTMLElement>(selector);
    elements.forEach((el) => {
      // Skip if already has a tooltip
      if ((el as HTMLElement & { _tooltip?: Tooltip })._tooltip) return;

      const options = optionsGetter(el);
      const tooltip = new Tooltip(el, options);
      (el as HTMLElement & { _tooltip?: Tooltip })._tooltip = tooltip;
    });
  }

  /**
   * Destroy all tooltips matching a selector
   */
  public static destroyAll(selector: string): void {
    const elements = document.querySelectorAll<HTMLElement>(selector);
    elements.forEach((el) => {
      const tooltip = (el as HTMLElement & { _tooltip?: Tooltip })._tooltip;
      if (tooltip) {
        tooltip.destroy();
        delete (el as HTMLElement & { _tooltip?: Tooltip })._tooltip;
      }
    });
  }
}

/**
 * Utility function for easy tooltip attachment
 */
export function attachTooltip(
  element: HTMLElement,
  content: string,
  options: Partial<Omit<TooltipOptions, 'content'>> = {},
): Tooltip {
  const tooltip = new Tooltip(element, {
    content,
    ...options,
  });
  
  // Store reference on element for cleanup
  (element as HTMLElement & { _tooltip?: Tooltip })._tooltip = tooltip;
  
  return tooltip;
}

/**
 * Auto-initialize tooltips from data attributes
 * Usage: <button data-tooltip="Help text" data-tooltip-position="bottom">?</button>
 */
export function initDataAttributeTooltips(): void {
  Tooltip.init('[data-tooltip]', (el) => ({
    content: el.dataset.tooltip!,
    position: (el.dataset.tooltipPosition as TooltipPosition) || 'top',
    allowHTML: el.dataset.tooltipHtml === 'true',
    delay: el.dataset.tooltipDelay ? parseInt(el.dataset.tooltipDelay, 10) : DEFAULT_DELAY,
    trigger: (el.dataset.tooltipTrigger as TooltipTrigger) || 'hover',
  }));
}

/**
 * Clean up all tooltips - useful for page transitions
 */
export function destroyAllTooltips(): void {
  Tooltip.destroyAll('[data-tooltip]');
}
