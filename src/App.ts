/**
 * SalesIntel App — Main application orchestrator
 * Manages the app shell (sidebar + topbar + page routing),
 * data loading, and service initialization.
 */

import { STORAGE_KEYS } from '@/config';
import { Dashboard } from '@/components/Dashboard';
import { TargetsPanel } from '@/components/TargetsPanel';
import { SignalAlertsPanel } from '@/components/SignalAlertsPanel';
import { CompanyIntelligence } from '@/components/CompanyIntelligence';
import { PipelineDashboard } from '@/components/PipelineDashboard';
import { EngagementTracker } from '@/components/EngagementTracker';
import { CompetitiveBattlecard } from '@/components/CompetitiveBattlecard';
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard';
import { loadFromStorage } from '@/utils';
import { mlWorker } from '@/services/ml-worker';
import { getAiFlowSettings, isHeadlineMemoryEnabled } from '@/services/ai-flow-settings';
import { dataFreshness } from '@/services/data-freshness';

type Page = 'dashboard' | 'targets' | 'signals' | 'pipeline' | 'prospects' | 'campaigns' | 'analytics' | 'compete' | 'settings' | 'company-detail';

// SVG icon paths (Lucide-style, stroke-width 1.5, 20x20 viewBox)
const ICONS: Record<string, string> = {
  dashboard: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  targets: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  signals: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  pipeline: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
  prospects: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  campaigns: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
  analytics: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  compete: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C5.71 4 7 5.29 7 6.5V8"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5C18.29 4 17 5.29 17 6.5V8"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
};

function icon(name: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] ?? ''}</svg>`;
}

const NAV_ITEMS: Array<{ id: Page; label: string; icon: string; badge?: number }> = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'targets', label: 'My Targets', icon: 'targets' },
  { id: 'signals', label: 'Signal Alerts', icon: 'signals', badge: 0 },
  { id: 'pipeline', label: 'Pipeline', icon: 'pipeline' },
  { id: 'prospects', label: 'Prospects', icon: 'prospects' },
  { id: 'campaigns', label: 'Campaigns', icon: 'campaigns' },
  { id: 'analytics', label: 'Analytics', icon: 'analytics' },
  { id: 'compete', label: 'Compete', icon: 'compete' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

export class App {
  private container: HTMLElement;
  private currentPage: Page = 'dashboard';
  private pageContainer: HTMLElement | null = null;
  private navButtons: Map<Page, HTMLElement> = new Map();

  // Page instances
  private dashboard: Dashboard | null = null;
  private targetsPanel: TargetsPanel | null = null;
  private signalAlertsPanel: SignalAlertsPanel | null = null;
  private companyIntelligence: CompanyIntelligence | null = null;
  private pipelineDashboard: PipelineDashboard | null = null;
  private engagementTracker: EngagementTracker | null = null;
  private competitiveBattlecard: CompetitiveBattlecard | null = null;
  private analyticsDashboard: AnalyticsDashboard | null = null;

  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container ${containerId} not found`);
    this.container = el;
  }

  async init(): Promise<void> {
    // Clear the skeleton
    this.container.innerHTML = '';

    // Build the app shell
    this.renderShell();

    // Navigate to default page
    this.navigateTo('dashboard');

    // Initialize ML worker in background (non-blocking)
    this.initServices();

    console.log('[SalesIntel] App initialized');
  }

  private renderShell(): void {
    // Sidebar
    const sidebar = document.createElement('aside');
    sidebar.className = 'si-sidebar';
    sidebar.innerHTML = `
      <div class="si-sidebar-logo">Sales<span>Intel</span></div>
      <nav class="si-sidebar-nav" id="si-nav"></nav>
      <div class="si-sidebar-footer">
        <div class="si-plan-badge">
          <span><strong>Pro Plan</strong></span>
          <span>750 / 1,000</span>
        </div>
      </div>
    `;

    // Render nav items
    const nav = sidebar.querySelector('#si-nav')!;
    for (const item of NAV_ITEMS) {
      const btn = document.createElement('button');
      btn.className = 'si-nav-item';
      btn.dataset.page = item.id;
      btn.innerHTML = `
        ${icon(item.icon)}
        <span>${item.label}</span>
        ${item.badge !== undefined && item.badge > 0 ? `<span class="si-nav-badge">${item.badge}</span>` : ''}
      `;
      btn.addEventListener('click', () => this.navigateTo(item.id));
      nav.appendChild(btn);
      this.navButtons.set(item.id, btn);
    }

    // Main area
    const main = document.createElement('div');
    main.className = 'si-main';

    // Top bar
    const topbar = document.createElement('header');
    topbar.className = 'si-topbar';
    topbar.innerHTML = `
      <div class="si-topbar-search">
        ${icon('search')}
        <input type="text" placeholder="Search for companies or leads..." />
      </div>
      <div class="si-live-indicator">
        <div class="si-live-dot"></div>
        <span>Live Market Data</span>
      </div>
      <div class="si-topbar-actions">
        <button class="si-topbar-btn" aria-label="Notifications">
          ${icon('bell')}
        </button>
        <div class="si-user-avatar">U</div>
      </div>
    `;

    // Global search handler
    const searchInput = topbar.querySelector('input')!;
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const query = searchInput.value.trim();
        if (query) {
          this.showCompanyIntelligence(query);
        }
      }
    });

    // Page container
    const page = document.createElement('main');
    page.className = 'si-page';
    page.id = 'si-page-content';
    this.pageContainer = page;

    main.appendChild(topbar);
    main.appendChild(page);

    this.container.appendChild(sidebar);
    this.container.appendChild(main);
  }

  navigateTo(page: Page): void {
    if (page === this.currentPage && page !== 'company-detail') return;

    this.currentPage = page;

    // Update nav active state
    this.navButtons.forEach((btn, id) => {
      btn.classList.toggle('active', id === page);
    });

    // Clear current page
    this.destroyCurrentPage();
    if (this.pageContainer) {
      this.pageContainer.innerHTML = '';
    }

    // Render new page
    switch (page) {
      case 'dashboard':
        this.renderDashboard();
        break;
      case 'targets':
        this.renderTargets();
        break;
      case 'signals':
        this.renderSignalAlerts();
        break;
      case 'pipeline':
        this.renderPipeline();
        break;
      case 'prospects':
        this.renderEngagement();
        break;
      case 'campaigns':
        this.renderEngagement();
        break;
      case 'analytics':
        this.renderAnalytics();
        break;
      case 'compete':
        this.renderCompete();
        break;
      case 'settings':
        this.renderPlaceholder('Settings', 'Signal preferences, API keys, and team configuration.');
        break;
      case 'company-detail':
        // Handled by showCompanyIntelligence
        break;
    }
  }

  private renderDashboard(): void {
    if (!this.pageContainer) return;
    this.dashboard = new Dashboard();
    this.dashboard.onSearch((company, _email) => {
      if (company) {
        this.showCompanyIntelligence(company);
      }
    });
    this.dashboard.render(this.pageContainer);
  }

  private renderTargets(): void {
    if (!this.pageContainer) return;
    this.targetsPanel = new TargetsPanel();
    this.targetsPanel.onViewTarget((company) => {
      this.showCompanyIntelligence(company);
    });
    this.targetsPanel.render(this.pageContainer);

    // Load saved targets
    const savedTargets = loadFromStorage(STORAGE_KEYS.targets, []);
    if (savedTargets.length > 0) {
      this.targetsPanel.setTargets(savedTargets);
    }
  }

  private renderSignalAlerts(): void {
    if (!this.pageContainer) return;
    this.signalAlertsPanel = new SignalAlertsPanel();
    this.signalAlertsPanel.onAction((action, signalId) => {
      console.log(`[SalesIntel] Signal action: ${action} on ${signalId}`);
      if (action === 'view_detail') {
        this.showCompanyIntelligence(signalId);
      }
    });
    this.signalAlertsPanel.render(this.pageContainer);
  }

  showCompanyIntelligence(companyName: string): void {
    this.currentPage = 'company-detail';

    // Update nav — no nav item is active for detail page
    this.navButtons.forEach((btn) => {
      btn.classList.remove('active');
    });

    this.destroyCurrentPage();
    if (this.pageContainer) {
      this.pageContainer.innerHTML = '';
    }

    this.companyIntelligence = new CompanyIntelligence();
    this.companyIntelligence.setCompanyData({
      name: companyName,
      category: 'Enterprise SaaS',
      location: 'San Francisco, CA',
      employeeRange: '1,000 - 5,000',
      fundingStage: 'Series C',
      executives: [
        { name: 'Sarah Chen', title: 'Chief Technology Officer', quote: 'We are doubling down on cloud infrastructure this year.', quoteSource: 'Earnings Call Q4' },
        { name: 'Michael Torres', title: 'VP Engineering', quote: 'Our migration to Kubernetes is our top priority.', quoteSource: 'LinkedIn Post' },
      ],
      triggers: [
        { label: 'Cloud Migration', type: 'new', description: 'CTO mentioned Kubernetes migration in earnings call', actionText: 'VIEW TECH STACK' },
        { label: 'EMEA Expansion', type: 'detected', description: '12 new job postings in London and Berlin offices', actionText: 'EMEA CLOUD PLAY' },
      ],
      socialPosts: [
        { author: 'Sarah Chen', authorTitle: 'CTO', preview: 'Excited to share our journey migrating 200+ microservices to Kubernetes...', likes: 342, comments: 47, shares: 89, timestamp: new Date().toISOString() },
      ],
      icebreakers: [
        'Congrats on the K8s migration milestone — we helped Stripe navigate a similar transition. Happy to share what we learned.',
        'Noticed your EMEA expansion — we have deep experience scaling cloud infra across EU regions. Worth a quick chat?',
      ],
      timeline: [
        { date: new Date(Date.now() - 2 * 86400000).toISOString(), title: 'CTO LinkedIn Post', description: 'Kubernetes migration progress update' },
        { date: new Date(Date.now() - 5 * 86400000).toISOString(), title: 'Series C Announced', description: '$85M round led by Sequoia Capital' },
        { date: new Date(Date.now() - 14 * 86400000).toISOString(), title: 'VP Engineering Hired', description: 'Michael Torres joins from Datadog' },
        { date: new Date(Date.now() - 30 * 86400000).toISOString(), title: 'EMEA Office Opening', description: 'London office announced, 50 roles posted' },
      ],
      accountHealthScore: 82,
    });
    if (this.pageContainer) {
      this.companyIntelligence.render(this.pageContainer);
    }
  }

  private renderPipeline(): void {
    if (!this.pageContainer) return;
    this.pipelineDashboard = new PipelineDashboard();
    this.pipelineDashboard.onDealSelect((dealId) => {
      console.log(`[SalesIntel] View deal: ${dealId}`);
    });
    this.pipelineDashboard.onNewDeal(() => {
      console.log('[SalesIntel] Create new deal');
    });
    this.pipelineDashboard.render(this.pageContainer);
  }

  private renderEngagement(): void {
    if (!this.pageContainer) return;
    this.engagementTracker = new EngagementTracker();
    this.engagementTracker.onSequenceSelect((seqId) => {
      console.log(`[SalesIntel] View sequence: ${seqId}`);
    });
    this.engagementTracker.render(this.pageContainer);
  }

  private renderAnalytics(): void {
    if (!this.pageContainer) return;
    this.analyticsDashboard = new AnalyticsDashboard();
    this.analyticsDashboard.render(this.pageContainer);
  }

  private renderCompete(): void {
    if (!this.pageContainer) return;
    this.competitiveBattlecard = new CompetitiveBattlecard();
    this.competitiveBattlecard.render(this.pageContainer);
  }

  private renderPlaceholder(title: string, description: string): void {
    if (!this.pageContainer) return;
    const placeholder = document.createElement('div');
    placeholder.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:60vh;text-align:center;';
    placeholder.innerHTML = `
      <h2 style="font-size:24px;font-weight:600;color:#e2e8f0;margin-bottom:12px;">${title}</h2>
      <p style="font-size:14px;color:#94a3b8;max-width:400px;">${description}</p>
    `;
    this.pageContainer.appendChild(placeholder);
  }

  private destroyCurrentPage(): void {
    this.dashboard?.destroy();
    this.dashboard = null;
    this.targetsPanel?.destroy();
    this.targetsPanel = null;
    this.signalAlertsPanel?.destroy();
    this.signalAlertsPanel = null;
    this.companyIntelligence?.destroy();
    this.companyIntelligence = null;
    this.pipelineDashboard?.destroy();
    this.pipelineDashboard = null;
    this.engagementTracker?.destroy();
    this.engagementTracker = null;
    this.competitiveBattlecard?.destroy();
    this.competitiveBattlecard = null;
    this.analyticsDashboard?.destroy();
    this.analyticsDashboard = null;
  }

  private async initServices(): Promise<void> {
    try {
      // Initialize ML worker for NER and embeddings
      const aiSettings = getAiFlowSettings();
      if (aiSettings.browserModel) {
        mlWorker.init().catch(err => {
          console.warn('[SalesIntel] ML worker init failed:', err);
        });
      }

      // Initialize headline memory / signal memory if enabled
      if (isHeadlineMemoryEnabled()) {
        console.log('[SalesIntel] Signal Memory (RAG) enabled');
      }

      // Report data freshness
      dataFreshness.reportUpdate('rss', 0);

    } catch (err) {
      console.warn('[SalesIntel] Service init error:', err);
    }
  }

  destroy(): void {
    this.destroyCurrentPage();
    this.container.innerHTML = '';
    this.navButtons.clear();
  }
}
