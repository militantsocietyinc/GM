import { t } from '@/services/i18n';

interface ShortcutItem {
  key: string;
  description: string;
}

interface ShortcutCategory {
  name: string;
  shortcuts: ShortcutItem[];
}

export class KeyboardShortcutsModal {
  private overlay: HTMLElement | null = null;
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public open(): void {
    if (this.overlay) return;
    this.createModal();
    document.addEventListener('keydown', this.handleEscape);
  }

  public close(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
      document.removeEventListener('keydown', this.handleEscape);
    }
  }

  public isOpen(): boolean {
    return this.overlay !== null;
  }

  private handleEscape = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      this.close();
    }
  };

  private getCategories(): ShortcutCategory[] {
    return [
      {
        name: t('shortcuts.categories.general'),
        shortcuts: [
          { key: '?', description: t('shortcuts.keys.showShortcuts') },
          { key: '/ / Ctrl+K', description: t('shortcuts.keys.focusSearch') },
          { key: 'Esc', description: t('shortcuts.keys.closeModals') },
        ],
      },
      {
        name: t('shortcuts.categories.map'),
        shortcuts: [
          { key: '+ / - / scroll', description: t('shortcuts.keys.zoom') },
          { key: '↑ ↓ ← →', description: t('shortcuts.keys.pan') },
          { key: 'R', description: t('shortcuts.keys.resetView') },
        ],
      },
      {
        name: t('shortcuts.categories.navigation'),
        shortcuts: [
          { key: '[', description: t('shortcuts.keys.prevPanel') },
          { key: ']', description: t('shortcuts.keys.nextPanel') },
          { key: 'Space', description: t('shortcuts.keys.toggleExpand') },
        ],
      },
      {
        name: t('shortcuts.categories.search'),
        shortcuts: [
          { key: '/ / Ctrl+K', description: t('shortcuts.keys.focusSearch') },
        ],
      },
    ];
  }

  private createModal(): void {
    this.overlay = document.createElement('div');
    this.overlay.className = 'shortcuts-modal-overlay';

    const categories = this.getCategories();
    const categoriesHtml = categories.map(cat => `
      <div class="shortcuts-category">
        <div class="shortcuts-category-name">${cat.name}</div>
        <div class="shortcuts-list">
          ${cat.shortcuts.map(s => `
            <div class="shortcuts-item">
              <kbd class="shortcuts-key">${s.key}</kbd>
              <span class="shortcuts-description">${s.description}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');

    this.overlay.innerHTML = `
      <div class="shortcuts-modal">
        <div class="shortcuts-modal-header">
          <span class="shortcuts-modal-title">⌨️ ${t('shortcuts.title')}</span>
          <button class="shortcuts-modal-close" aria-label="Close">×</button>
        </div>
        <div class="shortcuts-modal-content">
          ${categoriesHtml}
        </div>
        <div class="shortcuts-modal-footer">
          <span><kbd>esc</kbd> ${t('modals.search.close')}</span>
        </div>
      </div>
    `;

    // Close on overlay click
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });

    // Close on X button
    this.overlay.querySelector('.shortcuts-modal-close')?.addEventListener('click', () => {
      this.close();
    });

    this.container.appendChild(this.overlay);
  }
}
