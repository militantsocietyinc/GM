import { Panel } from './Panel';
import { WindowedList } from './VirtualList';
import type { NewsItem, ClusteredEvent, DeviationLevel, RelatedAsset, RelatedAssetContext } from '@/types';
import { THREAT_PRIORITY } from '@/services/threat-classifier';
import { formatTime, getCSSColor } from '@/utils';
import { escapeHtml, sanitizeUrl } from '@/utils/sanitize';
import { analysisWorker, enrichWithVelocityML, getClusterAssetContext, MAX_DISTANCE_KM, activityTracker, generateSummary, translateText } from '@/services';
import { getSourcePropagandaRisk, getSourceTier, getSourceType } from '@/config/feeds';
import { SITE_VARIANT } from '@/config';
import { t, getCurrentLanguage } from '@/services/i18n';

/** Threshold for enabling virtual scrolling */
const VIRTUAL_SCROLL_THRESHOLD = 15;

/** Summary cache TTL in milliseconds (10 minutes) */
const SUMMARY_CACHE_TTL = 10 * 60 * 1000;

/** localStorage key for bookmarks */
const BOOKMARKS_KEY = 'worldmonitor-bookmarks';

/** Maximum number of bookmarks (FIFO eviction) */
const MAX_BOOKMARKS = 100;

/** Bookmarked article data structure */
interface BookmarkedArticle {
  id: string;
  title: string;
  source: string;
  url: string;
  summary?: string;
  timestamp: string;
  savedAt: number;
}

/** Prepared cluster data for rendering */
interface PreparedCluster {
  cluster: ClusteredEvent;
  isNew: boolean;
  shouldHighlight: boolean;
  showNewTag: boolean;
}

/** Current tab type */
type NewsTab = 'latest' | 'saved';

export class NewsPanel extends Panel {
  private clusteredMode = true;
  private deviationEl: HTMLElement | null = null;
  private relatedAssetContext = new Map<string, RelatedAssetContext>();
  private onRelatedAssetClick?: (asset: RelatedAsset) => void;
  private onRelatedAssetsFocus?: (assets: RelatedAsset[], originLabel: string) => void;
  private onRelatedAssetsClear?: () => void;
  private isFirstRender = true;
  private windowedList: WindowedList<PreparedCluster> | null = null;
  private useVirtualScroll = true;
  private renderRequestId = 0;
  private boundScrollHandler: (() => void) | null = null;
  private boundClickHandler: (() => void) | null = null;

  // Panel summary feature
  private summaryBtn: HTMLButtonElement | null = null;
  private summaryContainer: HTMLElement | null = null;
  private currentHeadlines: string[] = [];
  private lastHeadlineSignature = '';
  private isSummarizing = false;

  // Bookmark feature
  private bookmarks: Map<string, BookmarkedArticle> = new Map();
  private currentTab: NewsTab = 'latest';
  private tabContainer: HTMLElement | null = null;
  private latestTabBtn: HTMLButtonElement | null = null;
  private savedTabBtn: HTMLButtonElement | null = null;
  private currentClusters: ClusteredEvent[] = [];
  private currentFlatItems: NewsItem[] = [];

  // Read/Unread tracking (TODO-048)
  private readArticleIds: Set<string> = new Set();
  private currentArticles: NewsItem[] = [];
  private readonly READ_ARTICLES_KEY = 'worldmonitor-read-articles';
  private readonly MAX_READ_ARTICLES = 1000;
  private markAllReadBtn: HTMLButtonElement | null = null;
  private unreadBadge: HTMLElement | null = null;

  constructor(id: string, title: string) {
    super({ id, title, showCount: true, trackActivity: true });
    this.createDeviationIndicator();
    this.createSummarizeButton();
    this.setupActivityTracking();
    this.initWindowedList();
    this.loadBookmarks();
    this.createTabContainer();
    this.createMarkAllReadButton();
    this.loadReadState();
  }

  private createTabContainer(): void {
    // Create tab container (inserted between header and content)
    this.tabContainer = document.createElement('div');
    this.tabContainer.className = 'news-tab-container';

    // Latest tab button
    this.latestTabBtn = document.createElement('button');
    this.latestTabBtn.className = 'news-tab-btn active';
    this.latestTabBtn.textContent = t('components.newsPanel.latest');
    this.latestTabBtn.addEventListener('click', () => this.switchTab('latest'));

    // Saved tab button
    this.savedTabBtn = document.createElement('button');
    this.savedTabBtn.className = 'news-tab-btn';
    this.savedTabBtn.textContent = t('components.newsPanel.saved');
    this.savedTabBtn.addEventListener('click', () => this.switchTab('saved'));

    // Bookmark count badge
    const bookmarkCount = document.createElement('span');
    bookmarkCount.className = 'news-tab-count';
    bookmarkCount.dataset.bookmarkCount = 'true';
    bookmarkCount.textContent = String(this.bookmarks.size);
    this.savedTabBtn.appendChild(bookmarkCount);

    this.tabContainer.appendChild(this.latestTabBtn);
    this.tabContainer.appendChild(this.savedTabBtn);

    // Insert after summary container (if exists) or before content
    const insertBeforeElement = this.summaryContainer || this.content;
    this.element.insertBefore(this.tabContainer, insertBeforeElement);
  }

  private switchTab(tab: NewsTab): void {
    if (this.currentTab === tab) return;

    this.currentTab = tab;

    // Update tab button styles
    if (this.latestTabBtn) {
      this.latestTabBtn.classList.toggle('active', tab === 'latest');
    }
    if (this.savedTabBtn) {
      this.savedTabBtn.classList.toggle('active', tab === 'saved');
    }

    // Re-render with current data
    if (this.clusteredMode && this.currentClusters.length > 0) {
      this.renderClusters(this.currentClusters);
    } else if (this.currentFlatItems.length > 0) {
      this.renderFlat(this.currentFlatItems);
    } else {
      // Show empty state for saved tab when no bookmarks
      if (tab === 'saved') {
        this.renderSavedEmpty();
      }
    }
  }

  private renderSavedEmpty(): void {
    this.setCount(0);
    this.currentArticles = []; // Clear current articles for read tracking (TODO-048)
    this.updateUnreadBadge();
    this.setContent(`
      <div class="panel-empty">
        <div class="panel-empty-icon">☆</div>
        <div class="panel-empty-text">${t('components.newsPanel.noBookmarks')}</div>
        <div class="panel-empty-hint">${t('components.newsPanel.bookmarkHint')}</div>
      </div>
    `);
  }

  private loadBookmarks(): void {
    try {
      const stored = localStorage.getItem(BOOKMARKS_KEY);
      if (stored) {
        const parsed: BookmarkedArticle[] = JSON.parse(stored);
        this.bookmarks = new Map(parsed.map(b => [b.id, b]));
      }
    } catch {
      this.bookmarks = new Map();
    }
  }

  private saveBookmarks(): void {
    try {
      const data = Array.from(this.bookmarks.values());
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(data));
      this.updateBookmarkCount();
    } catch { /* storage full */ }
  }

  private updateBookmarkCount(): void {
    const countEl = this.savedTabBtn?.querySelector('[data-bookmark-count]');
    if (countEl) {
      countEl.textContent = String(this.bookmarks.size);
    }
  }

  private toggleBookmark(cluster: ClusteredEvent): void {
    const id = cluster.id;

    if (this.bookmarks.has(id)) {
      this.bookmarks.delete(id);
    } else {
      // Evict oldest if at max
      if (this.bookmarks.size >= MAX_BOOKMARKS) {
        const oldest = Array.from(this.bookmarks.values())
          .sort((a, b) => a.savedAt - b.savedAt)[0];
        if (oldest) {
          this.bookmarks.delete(oldest.id);
        }
      }

      this.bookmarks.set(id, {
        id,
        title: cluster.primaryTitle,
        source: cluster.primarySource,
        url: cluster.primaryLink,
        summary: cluster.threat?.category,
        timestamp: cluster.lastUpdated.toISOString(),
        savedAt: Date.now()
      });
    }

    this.saveBookmarks();
    this.updateBookmarkIcon(id);

    // If in saved tab, re-render to show changes
    if (this.currentTab === 'saved') {
      this.renderSavedBookmarks();
    }
  }

  private updateBookmarkIcon(clusterId: string): void {
    const icon = this.content.querySelector(`[data-bookmark-icon="${clusterId}"]`) as HTMLElement | null;
    if (icon) {
      const isBookmarked = this.bookmarks.has(clusterId);
      icon.classList.toggle('bookmarked', isBookmarked);
      icon.textContent = isBookmarked ? '★' : '☆';
      icon.title = isBookmarked ? t('components.newsPanel.removeBookmark') : t('components.newsPanel.addBookmark');
    }
  }

  private removeBookmark(id: string): void {
    this.bookmarks.delete(id);
    this.saveBookmarks();
    this.renderSavedBookmarks();
  }

  private renderSavedBookmarks(): void {
    const bookmarks = Array.from(this.bookmarks.values())
      .sort((a, b) => b.savedAt - a.savedAt);

    if (bookmarks.length === 0) {
      this.renderSavedEmpty();
      return;
    }

    this.setCount(bookmarks.length);
    this.currentArticles = []; // Clear current articles for read tracking (TODO-048)
    this.updateUnreadBadge();

    const html = bookmarks
      .map((bookmark) => `
        <div class="item clustered saved-bookmark" data-bookmark-id="${escapeHtml(bookmark.id)}">
          <div class="item-source">
            <span class="saved-tag">${t('components.newsPanel.savedTag')}</span>
            ${escapeHtml(bookmark.source)}
            <button class="news-remove-bookmark" data-remove-id="${escapeHtml(bookmark.id)}" title="${t('components.newsPanel.removeBookmark')}">×</button>
          </div>
          <a class="item-title" href="${sanitizeUrl(bookmark.url)}" target="_blank" rel="noopener">${escapeHtml(bookmark.title)}</a>
          <div class="cluster-meta">
            <span class="item-time">${formatTime(new Date(bookmark.timestamp))}</span>
          </div>
        </div>
      `)
      .join('');

    this.setContent(html);
    this.bindBookmarkRemovalEvents();
  }

  private bindBookmarkRemovalEvents(): void {
    const removeButtons = this.content.querySelectorAll<HTMLButtonElement>('.news-remove-bookmark');
    removeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.removeId;
        if (id) this.removeBookmark(id);
      });
    });
  }

  private initWindowedList(): void {
    this.windowedList = new WindowedList<PreparedCluster>(
      {
        container: this.content,
        chunkSize: 8, // Render 8 items per chunk
        bufferChunks: 1, // 1 chunk buffer above/below
      },
      (prepared) => this.renderClusterHtmlSafely(
        prepared.cluster,
        prepared.isNew,
        prepared.shouldHighlight,
        prepared.showNewTag
      ),
      () => {
        this.bindRelatedAssetEvents();
        this.bindReadStateEvents();
        this.updateUnreadBadge();
      }
    );
  }

  // ==================== Read/Unread State (TODO-048) ====================

  private createMarkAllReadButton(): void {
    // Create mark all read button (inserted before summarize button)
    this.markAllReadBtn = document.createElement('button');
    this.markAllReadBtn.className = 'panel-mark-all-read-btn';
    this.markAllReadBtn.innerHTML = '✓';
    this.markAllReadBtn.title = 'Mark all as read';
    this.markAllReadBtn.addEventListener('click', () => this.handleMarkAllRead());

    // Insert before summarize button
    if (this.summaryBtn) {
      this.header.insertBefore(this.markAllReadBtn, this.summaryBtn);
    } else {
      const countEl = this.header.querySelector('.panel-count');
      if (countEl) {
        this.header.insertBefore(this.markAllReadBtn, countEl);
      } else {
        this.header.appendChild(this.markAllReadBtn);
      }
    }

    // Create unread badge (hidden by default)
    this.unreadBadge = document.createElement('span');
    this.unreadBadge.className = 'panel-unread-badge hidden';
    this.header.insertBefore(this.unreadBadge, this.markAllReadBtn);
  }

  private loadReadState(): void {
    try {
      const stored = localStorage.getItem(this.READ_ARTICLES_KEY);
      if (stored) {
        const ids = JSON.parse(stored) as string[];
        this.readArticleIds = new Set(ids);
      }
    } catch {
      // localStorage unavailable or corrupt, start fresh
      this.readArticleIds = new Set();
    }
  }

  private saveReadState(): void {
    try {
      // Limit to MAX_READ_ARTICLES to prevent storage bloat
      let ids = Array.from(this.readArticleIds);
      if (ids.length > this.MAX_READ_ARTICLES) {
        // Keep only the most recent IDs (assuming newer IDs are added later)
        ids = ids.slice(-this.MAX_READ_ARTICLES);
        this.readArticleIds = new Set(ids);
      }
      localStorage.setItem(this.READ_ARTICLES_KEY, JSON.stringify(ids));
    } catch {
      // localStorage unavailable
    }
  }

  private getArticleId(article: NewsItem | ClusteredEvent): string {
    // Use link as ID, or generate from title + source + pubDate
    if ('link' in article && article.link) {
      return this.hashString(article.link);
    }
    if ('primaryLink' in article && article.primaryLink) {
      return this.hashString(article.primaryLink);
    }
    // Fallback hash from title + source
    const title = 'title' in article ? article.title : article.primaryTitle;
    const source = 'source' in article ? article.source : article.primarySource;
    const date = 'pubDate' in article ? article.pubDate.getTime() : article.lastUpdated.getTime();
    return this.hashString(`${title}-${source}-${date}`);
  }

  private hashString(str: string): string {
    // Simple hash function for strings
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private markAsRead(articleId: string): void {
    if (!this.readArticleIds.has(articleId)) {
      this.readArticleIds.add(articleId);
      this.saveReadState();
    }
    this.updateArticleVisualState(articleId);
    this.updateUnreadBadge();
  }

  private isRead(articleId: string): boolean {
    return this.readArticleIds.has(articleId);
  }

  private getUnreadCount(): number {
    return this.currentArticles.filter(a => !this.isRead(this.getArticleId(a))).length;
  }

  private updateArticleVisualState(articleId: string): void {
    const element = this.content.querySelector(`[data-article-id="${articleId}"]`);
    if (element) {
      element.classList.remove('unread');
      element.classList.add('read');
    }
  }

  private updateUnreadBadge(): void {
    if (!this.unreadBadge) return;
    
    const unreadCount = this.getUnreadCount();
    if (unreadCount > 0) {
      this.unreadBadge.textContent = String(unreadCount);
      this.unreadBadge.classList.remove('hidden');
      if (this.markAllReadBtn) {
        this.markAllReadBtn.disabled = false;
      }
    } else {
      this.unreadBadge.classList.add('hidden');
      if (this.markAllReadBtn) {
        this.markAllReadBtn.disabled = true;
      }
    }
  }

  private handleMarkAllRead(): void {
    // Mark all current articles as read
    this.currentArticles.forEach(article => {
      const articleId = this.getArticleId(article);
      this.readArticleIds.add(articleId);
    });
    this.saveReadState();

    // Update all visual states
    const unreadElements = this.content.querySelectorAll('.item.unread');
    unreadElements.forEach(el => {
      el.classList.remove('unread');
      el.classList.add('read');
    });

    this.updateUnreadBadge();
  }

  private bindReadStateEvents(): void {
    // Bind click events to article links for read tracking
    const articleLinks = this.content.querySelectorAll<HTMLAnchorElement>('.item-title');
    articleLinks.forEach(link => {
      link.addEventListener('click', () => {
        const item = link.closest('.item') as HTMLElement | null;
        if (item) {
          const articleId = item.dataset.articleId;
          if (articleId) {
            this.markAsRead(articleId);
          }
        }
      });
    });
  }

  private setupActivityTracking(): void {
    // Register with activity tracker
    activityTracker.register(this.panelId);

    // Listen for new count changes
    activityTracker.onChange(this.panelId, (newCount) => {
      // Pulse if there are new items
      this.setNewBadge(newCount, newCount > 0);
    });

    // Mark as seen when panel content is scrolled
    this.boundScrollHandler = () => {
      activityTracker.markAsSeen(this.panelId);
    };
    this.content.addEventListener('scroll', this.boundScrollHandler);

    // Mark as seen on click anywhere in panel
    this.boundClickHandler = () => {
      activityTracker.markAsSeen(this.panelId);
    };
    this.element.addEventListener('click', this.boundClickHandler);
  }

  public setRelatedAssetHandlers(options: {
    onRelatedAssetClick?: (asset: RelatedAsset) => void;
    onRelatedAssetsFocus?: (assets: RelatedAsset[], originLabel: string) => void;
    onRelatedAssetsClear?: () => void;
  }): void {
    this.onRelatedAssetClick = options.onRelatedAssetClick;
    this.onRelatedAssetsFocus = options.onRelatedAssetsFocus;
    this.onRelatedAssetsClear = options.onRelatedAssetsClear;
  }

  private createDeviationIndicator(): void {
    const header = this.getElement().querySelector('.panel-header-left');
    if (header) {
      this.deviationEl = document.createElement('span');
      this.deviationEl.className = 'deviation-indicator';
      header.appendChild(this.deviationEl);
    }
  }

  private createSummarizeButton(): void {
    // Create summary container (inserted between header and content)
    this.summaryContainer = document.createElement('div');
    this.summaryContainer.className = 'panel-summary';
    this.summaryContainer.style.display = 'none';
    this.element.insertBefore(this.summaryContainer, this.content);

    // Create summarize button
    this.summaryBtn = document.createElement('button');
    this.summaryBtn.className = 'panel-summarize-btn';
    this.summaryBtn.innerHTML = '✨';
    this.summaryBtn.title = t('components.newsPanel.summarize');
    this.summaryBtn.addEventListener('click', () => this.handleSummarize());

    // Insert before count element (use inherited this.header directly)
    const countEl = this.header.querySelector('.panel-count');
    if (countEl) {
      this.header.insertBefore(this.summaryBtn, countEl);
    } else {
      this.header.appendChild(this.summaryBtn);
    }
  }

  private async handleSummarize(): Promise<void> {
    if (this.isSummarizing || !this.summaryContainer || !this.summaryBtn) return;
    if (this.currentHeadlines.length === 0) return;

    // Check cache first (include variant, version, and language)
    const currentLang = getCurrentLanguage();
    const cacheKey = `panel_summary_v3_${SITE_VARIANT}_${this.panelId}_${currentLang}`;
    const cached = this.getCachedSummary(cacheKey);
    if (cached) {
      this.showSummary(cached);
      return;
    }

    // Show loading state
    this.isSummarizing = true;
    this.summaryBtn.innerHTML = '<span class="panel-summarize-spinner"></span>';
    this.summaryBtn.disabled = true;
    this.summaryContainer.style.display = 'block';
    this.summaryContainer.innerHTML = `<div class="panel-summary-loading">${t('components.newsPanel.generatingSummary')}</div>`;

    const sigAtStart = this.lastHeadlineSignature;

    try {
      const result = await generateSummary(this.currentHeadlines.slice(0, 8), undefined, this.panelId, currentLang);
      if (!this.element?.isConnected) return;
      if (this.lastHeadlineSignature !== sigAtStart) {
        this.hideSummary();
        return;
      }
      if (result?.summary) {
        this.setCachedSummary(cacheKey, result.summary);
        this.showSummary(result.summary);
      } else {
        this.summaryContainer.innerHTML = '<div class="panel-summary-error">Could not generate summary</div>';
        setTimeout(() => this.hideSummary(), 3000);
      }
    } catch {
      if (!this.element?.isConnected) return;
      this.summaryContainer.innerHTML = '<div class="panel-summary-error">Summary failed</div>';
      setTimeout(() => this.hideSummary(), 3000);
    } finally {
      this.isSummarizing = false;
      if (this.summaryBtn) {
        this.summaryBtn.innerHTML = '✨';
        this.summaryBtn.disabled = false;
      }
    }
  }

  private async handleTranslate(element: HTMLElement, text: string): Promise<void> {
    const currentLang = getCurrentLanguage();
    if (currentLang === 'en') return; // Assume news is mostly English, no need to translate if UI is English (or add detection later)

    const titleEl = element.closest('.item')?.querySelector('.item-title') as HTMLElement;
    if (!titleEl) return;

    const originalText = titleEl.textContent || '';

    // Visual feedback
    element.innerHTML = '...';
    element.style.pointerEvents = 'none';

    try {
      const translated = await translateText(text, currentLang);
      if (!this.element?.isConnected) return;
      if (translated) {
        titleEl.textContent = translated;
        titleEl.dataset.original = originalText;
        element.innerHTML = '✓';
        element.title = 'Original: ' + originalText;
        element.classList.add('translated');
      } else {
        element.innerHTML = '文';
        // Shake animation or error state could be added here
      }
    } catch (e) {
      if (!this.element?.isConnected) return;
      console.error('Translation failed', e);
      element.innerHTML = '文';
    } finally {
      if (element.isConnected) {
        element.style.pointerEvents = 'auto';
      }
    }
  }

  private showSummary(summary: string): void {
    if (!this.summaryContainer || !this.element?.isConnected) return;
    this.summaryContainer.style.display = 'block';
    this.summaryContainer.innerHTML = `
      <div class="panel-summary-content">
        <span class="panel-summary-text">${escapeHtml(summary)}</span>
        <button class="panel-summary-close" title="${t('components.newsPanel.close')}">×</button>
      </div>
    `;
    this.summaryContainer.querySelector('.panel-summary-close')?.addEventListener('click', () => this.hideSummary());
  }

  private hideSummary(): void {
    if (!this.summaryContainer) return;
    this.summaryContainer.style.display = 'none';
    this.summaryContainer.innerHTML = '';
  }

  private getHeadlineSignature(): string {
    return JSON.stringify(this.currentHeadlines.slice(0, 5).sort());
  }

  private updateHeadlineSignature(): void {
    const newSig = this.getHeadlineSignature();
    if (newSig !== this.lastHeadlineSignature) {
      this.lastHeadlineSignature = newSig;
      if (this.summaryContainer?.style.display === 'block') {
        this.hideSummary();
      }
    }
  }

  private getCachedSummary(key: string): string | null {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      if (!parsed.headlineSignature) { localStorage.removeItem(key); return null; }
      if (parsed.headlineSignature !== this.lastHeadlineSignature) return null;
      if (Date.now() - parsed.timestamp > SUMMARY_CACHE_TTL) { localStorage.removeItem(key); return null; }
      return parsed.summary;
    } catch {
      return null;
    }
  }

  private setCachedSummary(key: string, summary: string): void {
    try {
      localStorage.setItem(key, JSON.stringify({
        headlineSignature: this.lastHeadlineSignature,
        summary,
        timestamp: Date.now(),
      }));
    } catch { /* storage full */ }
  }

  public setDeviation(zScore: number, percentChange: number, level: DeviationLevel): void {
    if (!this.deviationEl) return;

    if (level === 'normal') {
      this.deviationEl.textContent = '';
      this.deviationEl.className = 'deviation-indicator';
      return;
    }

    const arrow = zScore > 0 ? '↑' : '↓';
    const sign = percentChange > 0 ? '+' : '';
    this.deviationEl.textContent = `${arrow}${sign}${percentChange}%`;
    this.deviationEl.className = `deviation-indicator ${level}`;
    this.deviationEl.title = `z-score: ${zScore} (vs 7-day avg)`;
  }

  public renderNews(items: NewsItem[]): void {
    if (items.length === 0) {
      this.renderRequestId += 1; // Cancel in-flight clustering from previous renders.
      this.setDataBadge('unavailable');
      this.currentArticles = []; // Clear current articles for read tracking (TODO-048)
      this.updateUnreadBadge();
      this.showError(t('common.noNewsAvailable'));
      return;
    }

    this.setDataBadge('live');

    // Store for tab switching
    this.currentFlatItems = items;

    // If in saved tab, don't overwrite
    if (this.currentTab === 'saved') {
      return;
    }

    // Always show flat items immediately for instant visual feedback,
    // then upgrade to clustered view in the background when ready.
    this.renderFlat(items);

    if (this.clusteredMode) {
      void this.renderClustersAsync(items);
    }
  }

  public renderFilteredEmpty(message: string): void {
    this.renderRequestId += 1; // Cancel in-flight clustering from previous renders.
    this.setDataBadge('live');
    this.setCount(0);
    this.relatedAssetContext.clear();
    this.currentHeadlines = [];
    this.updateHeadlineSignature();
    this.currentFlatItems = [];
    this.currentClusters = [];
    this.currentArticles = []; // Clear current articles for read tracking (TODO-048)
    this.updateUnreadBadge();
    this.setContent(`<div class="panel-empty">${escapeHtml(message)}</div>`);
  }

  private async renderClustersAsync(items: NewsItem[]): Promise<void> {
    const requestId = ++this.renderRequestId;

    try {
      const clusters = await analysisWorker.clusterNews(items);
      if (requestId !== this.renderRequestId) return;
      const enriched = await enrichWithVelocityML(clusters);
      this.renderClusters(enriched);
    } catch (error) {
      if (requestId !== this.renderRequestId) return;
      // Keep already-rendered flat list visible when clustering fails.
      console.warn('[NewsPanel] Failed to cluster news, keeping flat list:', error);
    }
  }

  private renderFlat(items: NewsItem[]): void {
    // If in saved tab, don't render flat items
    if (this.currentTab === 'saved') {
      return;
    }

    this.setCount(items.length);
    this.currentArticles = items; // Store for read tracking (TODO-048)
    this.currentHeadlines = items
      .slice(0, 5)
      .map(item => item.title)
      .filter((title): title is string => typeof title === 'string' && title.trim().length > 0);

    this.updateHeadlineSignature();

    const html = items
      .map(
        (item) => {
          const articleId = this.getArticleId(item);
          const isRead = this.isRead(articleId);
          const readClass = isRead ? 'read' : 'unread';
          return `
      <div class="item ${readClass} ${item.isAlert ? 'alert' : ''}" data-article-id="${escapeHtml(articleId)}" ${item.monitorColor ? `style="border-inline-start-color: ${escapeHtml(item.monitorColor)}"` : ''}>
        <div class="item-source">
          ${escapeHtml(item.source)}
          ${item.lang && item.lang !== getCurrentLanguage() ? `<span class="lang-badge">${item.lang.toUpperCase()}</span>` : ''}
          ${item.isAlert ? '<span class="alert-tag">ALERT</span>' : ''}
        </div>
        <a class="item-title" href="${sanitizeUrl(item.link)}" target="_blank" rel="noopener">${escapeHtml(item.title)}</a>
        <div class="item-time">
          ${formatTime(item.pubDate)}
          ${getCurrentLanguage() !== 'en' ? `<button class="item-translate-btn" title="Translate" data-text="${escapeHtml(item.title)}">文</button>` : ''}
        </div>
      </div>
    `;
        }
      )
      .join('');

    this.setContent(html);
    this.bindReadStateEvents();
    this.updateUnreadBadge();
  }

  private renderClusters(clusters: ClusteredEvent[]): void {
    // Store for tab switching
    this.currentClusters = clusters;

    // If in saved tab, render saved bookmarks instead
    if (this.currentTab === 'saved') {
      this.renderSavedBookmarks();
      return;
    }

    // Sort by threat priority, then by time within same level
    const sorted = [...clusters].sort((a, b) => {
      const pa = THREAT_PRIORITY[a.threat?.level ?? 'info'];
      const pb = THREAT_PRIORITY[b.threat?.level ?? 'info'];
      if (pb !== pa) return pb - pa;
      return b.lastUpdated.getTime() - a.lastUpdated.getTime();
    });

    const totalItems = sorted.reduce((sum, c) => sum + c.sourceCount, 0);
    this.setCount(totalItems);
    this.relatedAssetContext.clear();

    // Store headlines for summarization (cap at 5 to reduce entity conflation in small models)
    this.currentHeadlines = sorted.slice(0, 5).map(c => c.primaryTitle);

    this.updateHeadlineSignature();

    const clusterIds = sorted.map(c => c.id);
    let newItemIds: Set<string>;

    if (this.isFirstRender) {
      // First render: mark all items as seen
      activityTracker.updateItems(this.panelId, clusterIds);
      activityTracker.markAsSeen(this.panelId);
      newItemIds = new Set();
      this.isFirstRender = false;
    } else {
      // Subsequent renders: track new items
      const newIds = activityTracker.updateItems(this.panelId, clusterIds);
      newItemIds = new Set(newIds);
    }

    // Prepare all clusters with their rendering data (defer HTML creation)
    const prepared: PreparedCluster[] = sorted.map(cluster => {
      const isNew = newItemIds.has(cluster.id);
      const shouldHighlight = activityTracker.shouldHighlight(this.panelId, cluster.id);
      const showNewTag = activityTracker.isNewItem(this.panelId, cluster.id) && isNew;

      return {
        cluster,
        isNew,
        shouldHighlight,
        showNewTag,
      };
    });

    // Store clusters as current articles for read tracking (TODO-048)
    this.currentArticles = sorted.map(c => ({
      id: c.id,
      title: c.primaryTitle,
      source: c.primarySource,
      link: c.primaryLink,
      pubDate: c.lastUpdated,
      description: '',
      isAlert: c.isAlert,
      lang: c.lang,
    } as NewsItem));

    // Use windowed rendering for large lists, direct render for small
    if (this.useVirtualScroll && sorted.length > VIRTUAL_SCROLL_THRESHOLD && this.windowedList) {
      this.windowedList.setItems(prepared);
      this.updateUnreadBadge();
    } else {
      // Direct render for small lists
      const html = prepared
        .map(p => this.renderClusterHtmlSafely(p.cluster, p.isNew, p.shouldHighlight, p.showNewTag))
        .join('');
      this.setContent(html);
      this.bindRelatedAssetEvents();
      this.bindBookmarkEvents();
      this.bindReadStateEvents();
      this.updateUnreadBadge();
    }
  }

  private bindBookmarkEvents(): void {
    const bookmarkIcons = this.content.querySelectorAll<HTMLElement>('.news-bookmark-icon');
    bookmarkIcons.forEach(icon => {
      icon.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const clusterId = icon.dataset.bookmarkIcon;
        if (!clusterId) return;

        const cluster = this.currentClusters.find(c => c.id === clusterId);
        if (cluster) {
          this.toggleBookmark(cluster);
        }
      });
    });
  }

  private renderClusterHtmlSafely(
    cluster: ClusteredEvent,
    isNew: boolean,
    shouldHighlight: boolean,
    showNewTag: boolean
  ): string {
    try {
      return this.renderClusterHtml(cluster, isNew, shouldHighlight, showNewTag);
    } catch (error) {
      console.error('[NewsPanel] Failed to render cluster card:', error, cluster);
      const clusterId = typeof cluster?.id === 'string' ? cluster.id : 'unknown-cluster';
      return `
        <div class="item clustered item-render-error" data-cluster-id="${escapeHtml(clusterId)}">
          <div class="item-source">${t('common.error')}</div>
          <div class="item-title">Failed to display this cluster.</div>
        </div>
      `;
    }
  }

  /**
   * Render a single cluster to HTML string
   */
  private renderClusterHtml(
    cluster: ClusteredEvent,
    isNew: boolean,
    shouldHighlight: boolean,
    showNewTag: boolean
  ): string {
    const sourceBadge = cluster.sourceCount > 1
      ? `<span class="source-count">${t('components.newsPanel.sources', { count: String(cluster.sourceCount) })}</span>`
      : '';

    const velocity = cluster.velocity;
    const velocityBadge = velocity && velocity.level !== 'normal' && cluster.sourceCount > 1
      ? `<span class="velocity-badge ${velocity.level}">${velocity.trend === 'rising' ? '↑' : ''}+${velocity.sourcesPerHour}/hr</span>`
      : '';

    const sentimentIcon = velocity?.sentiment === 'negative' ? '⚠' : velocity?.sentiment === 'positive' ? '✓' : '';
    const sentimentBadge = sentimentIcon && Math.abs(velocity?.sentimentScore || 0) > 2
      ? `<span class="sentiment-badge ${velocity?.sentiment}">${sentimentIcon}</span>`
      : '';

    const newTag = showNewTag ? `<span class="new-tag">${t('common.new')}</span>` : '';
    const langBadge = cluster.lang && cluster.lang !== getCurrentLanguage()
      ? `<span class="lang-badge">${cluster.lang.toUpperCase()}</span>`
      : '';

    // Propaganda risk indicator for primary source
    const primaryPropRisk = getSourcePropagandaRisk(cluster.primarySource);
    const primaryPropBadge = primaryPropRisk.risk !== 'low'
      ? `<span class="propaganda-badge ${primaryPropRisk.risk}" title="${escapeHtml(primaryPropRisk.note || `State-affiliated: ${primaryPropRisk.stateAffiliated || 'Unknown'}`)}">${primaryPropRisk.risk === 'high' ? '⚠ State Media' : '! Caution'}</span>`
      : '';

    // Source credibility badge for primary source (T1=Wire, T2=Verified outlet)
    const primaryTier = getSourceTier(cluster.primarySource);
    const primaryType = getSourceType(cluster.primarySource);
    const tierLabel = primaryTier === 1 ? 'Wire' : ''; // Don't show "Major" - confusing with story importance
    const tierBadge = primaryTier <= 2
      ? `<span class="tier-badge tier-${primaryTier}" title="${primaryType === 'wire' ? 'Wire Service - Highest reliability' : primaryType === 'gov' ? 'Official Government Source' : 'Verified News Outlet'}">${primaryTier === 1 ? '★' : '●'}${tierLabel ? ` ${tierLabel}` : ''}</span>`
      : '';

    // Build "Also reported by" section for multi-source confirmation
    const otherSources = cluster.topSources.filter(s => s.name !== cluster.primarySource);
    const topSourcesHtml = otherSources.length > 0
      ? `<span class="also-reported">Also:</span>` + otherSources
        .map(s => {
          const propRisk = getSourcePropagandaRisk(s.name);
          const propBadge = propRisk.risk !== 'low'
            ? `<span class="propaganda-badge ${propRisk.risk}" title="${escapeHtml(propRisk.note || `State-affiliated: ${propRisk.stateAffiliated || 'Unknown'}`)}">${propRisk.risk === 'high' ? '⚠' : '!'}</span>`
            : '';
          return `<span class="top-source tier-${s.tier}">${escapeHtml(s.name)}${propBadge}</span>`;
        })
        .join('')
      : '';

    const assetContext = getClusterAssetContext(cluster);
    if (assetContext && assetContext.assets.length > 0) {
      this.relatedAssetContext.set(cluster.id, assetContext);
    }

    const relatedAssetsHtml = assetContext && assetContext.assets.length > 0
      ? `
        <div class="related-assets" data-cluster-id="${escapeHtml(cluster.id)}">
          <div class="related-assets-header">
            ${t('components.newsPanel.relatedAssetsNear', { location: escapeHtml(assetContext.origin.label) })}
            <span class="related-assets-range">(${MAX_DISTANCE_KM}km)</span>
          </div>
          <div class="related-assets-list">
            ${assetContext.assets.map(asset => `
              <button class="related-asset" data-cluster-id="${escapeHtml(cluster.id)}" data-asset-id="${escapeHtml(asset.id)}" data-asset-type="${escapeHtml(asset.type)}">
                <span class="related-asset-type">${escapeHtml(this.getLocalizedAssetLabel(asset.type))}</span>
                <span class="related-asset-name">${escapeHtml(asset.name)}</span>
                <span class="related-asset-distance">${Math.round(asset.distanceKm)}km</span>
              </button>
            `).join('')}
          </div>
        </div>
      `
      : '';

    // Category tag from threat classification
    const cat = cluster.threat?.category;
    const catLabel = cat && cat !== 'general' ? cat.charAt(0).toUpperCase() + cat.slice(1) : '';
    const threatVarMap: Record<string, string> = { critical: '--threat-critical', high: '--threat-high', medium: '--threat-medium', low: '--threat-low', info: '--threat-info' };
    const catColor = cluster.threat ? getCSSColor(threatVarMap[cluster.threat.level] || '--text-dim') : '';
    const categoryBadge = catLabel
      ? `<span class="category-tag" style="color:${catColor};border-color:${catColor}40;background:${catColor}20">${catLabel}</span>`
      : '';

    // Bookmark icon
    const isBookmarked = this.bookmarks.has(cluster.id);
    const bookmarkIcon = `<span class="news-bookmark-icon ${isBookmarked ? 'bookmarked' : ''}" data-bookmark-icon="${escapeHtml(cluster.id)}" title="${isBookmarked ? t('components.newsPanel.removeBookmark') : t('components.newsPanel.addBookmark')}">${isBookmarked ? '★' : '☆'}</span>`;

    // Read/Unread state tracking (TODO-048)
    const articleId = this.getArticleId(cluster);
    const isRead = this.isRead(articleId);
    const readClass = isRead ? 'read' : 'unread';

    // Build class list for item
    const itemClasses = [
      'item',
      'clustered',
      readClass,
      cluster.isAlert ? 'alert' : '',
      shouldHighlight ? 'item-new-highlight' : '',
      isNew ? 'item-new' : '',
    ].filter(Boolean).join(' ');

    return `
      <div class="${itemClasses}" ${cluster.monitorColor ? `style="border-inline-start-color: ${escapeHtml(cluster.monitorColor)}"` : ''} data-cluster-id="${escapeHtml(cluster.id)}" data-article-id="${escapeHtml(articleId)}" data-news-id="${escapeHtml(cluster.primaryLink)}">
        <div class="item-source">
          ${tierBadge}
          ${escapeHtml(cluster.primarySource)}
          ${primaryPropBadge}
          ${langBadge}
          ${newTag}
          ${sourceBadge}
          ${velocityBadge}
          ${sentimentBadge}
          ${cluster.isAlert ? '<span class="alert-tag">ALERT</span>' : ''}
          ${categoryBadge}
          ${bookmarkIcon}
        </div>
        <a class="item-title" href="${sanitizeUrl(cluster.primaryLink)}" target="_blank" rel="noopener">${escapeHtml(cluster.primaryTitle)}</a>
        <div class="cluster-meta">
          <span class="top-sources">${topSourcesHtml}</span>
          <span class="item-time">${formatTime(cluster.lastUpdated)}</span>
          ${getCurrentLanguage() !== 'en' ? `<button class="item-translate-btn" title="Translate" data-text="${escapeHtml(cluster.primaryTitle)}">文</button>` : ''}
        </div>
        ${relatedAssetsHtml}
      </div>
    `;
  }

  private bindRelatedAssetEvents(): void {
    const containers = this.content.querySelectorAll<HTMLDivElement>('.related-assets');
    containers.forEach((container) => {
      const clusterId = container.dataset.clusterId;
      if (!clusterId) return;
      const context = this.relatedAssetContext.get(clusterId);
      if (!context) return;

      container.addEventListener('mouseenter', () => {
        this.onRelatedAssetsFocus?.(context.assets, context.origin.label);
      });

      container.addEventListener('mouseleave', () => {
        this.onRelatedAssetsClear?.();
      });
    });

    const assetButtons = this.content.querySelectorAll<HTMLButtonElement>('.related-asset');
    assetButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const clusterId = button.dataset.clusterId;
        const assetId = button.dataset.assetId;
        const assetType = button.dataset.assetType as RelatedAsset['type'] | undefined;
        if (!clusterId || !assetId || !assetType) return;
        const context = this.relatedAssetContext.get(clusterId);
        const asset = context?.assets.find(item => item.id === assetId && item.type === assetType);
        if (asset) {
          this.onRelatedAssetClick?.(asset);
        }
      });
    });

    // Translation buttons
    const translateBtns = this.content.querySelectorAll<HTMLElement>('.item-translate-btn');
    translateBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = btn.dataset.text;
        if (text) this.handleTranslate(btn, text);
      });
    });

    // Bookmark icons
    this.bindBookmarkEvents();
  }

  private getLocalizedAssetLabel(type: RelatedAsset['type']): string {
    const keyMap: Record<RelatedAsset['type'], string> = {
      pipeline: 'modals.countryBrief.infra.pipeline',
      cable: 'modals.countryBrief.infra.cable',
      datacenter: 'modals.countryBrief.infra.datacenter',
      base: 'modals.countryBrief.infra.base',
      nuclear: 'modals.countryBrief.infra.nuclear',
    };
    return t(keyMap[type]);
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    // Clean up windowed list
    this.windowedList?.destroy();
    this.windowedList = null;

    // Remove activity tracking listeners
    if (this.boundScrollHandler) {
      this.content.removeEventListener('scroll', this.boundScrollHandler);
      this.boundScrollHandler = null;
    }
    if (this.boundClickHandler) {
      this.element.removeEventListener('click', this.boundClickHandler);
      this.boundClickHandler = null;
    }

    // Unregister from activity tracker
    activityTracker.unregister(this.panelId);

    // Call parent destroy
    super.destroy();
  }
}
