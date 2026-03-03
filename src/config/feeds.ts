import type { Feed } from '@/types';

// Helper to create RSS proxy URL (Vercel)
const rss = (url: string) => `/api/rss-proxy?url=${encodeURIComponent(url)}`;

// Source tier system for prioritization (lower = more authoritative)
// Tier 1: Wire services - fastest, most reliable breaking news
// Tier 2: Major outlets - high-quality journalism
// Tier 3: Specialty sources - domain expertise
// Tier 4: Aggregators & blogs - useful but less authoritative
export const SOURCE_TIERS: Record<string, number> = {
  // Tier 1 - Wire Services
  'Reuters': 1,
  'AP News': 1,
  'AFP': 1,
  'Bloomberg': 1,

  // Tier 2 - Major Outlets
  'BBC World': 2,
  'BBC Middle East': 2,
  'Guardian World': 2,
  'Guardian ME': 2,
  'NPR News': 2,
  'CNN World': 2,
  'CNBC': 2,
  'MarketWatch': 2,
  'Al Jazeera': 2,
  'Financial Times': 2,
  'Politico': 2,
  'Axios': 2,
  'EuroNews': 2,
  'France 24': 2,
  'Le Monde': 2,
  // Spanish
  'El País': 2,
  'El Mundo': 2,
  'BBC Mundo': 2,
  // German
  'Tagesschau': 1,
  'Der Spiegel': 2,
  'Die Zeit': 2,
  'DW News': 2,
  // Italian
  'ANSA': 1,
  'Corriere della Sera': 2,
  'Repubblica': 2,
  // Dutch
  'NOS Nieuws': 1,
  'NRC': 2,
  'De Telegraaf': 2,
  // Swedish
  'SVT Nyheter': 1,
  'Dagens Nyheter': 2,
  'Svenska Dagbladet': 2,
  'Reuters World': 1,
  'Reuters Business': 1,
  'Reuters US': 1,
  'Fox News': 2,
  'NBC News': 2,
  'CBS News': 2,
  'ABC News': 2,
  'PBS NewsHour': 2,
  'Wall Street Journal': 1,
  'The Hill': 3,
  'The National': 2,
  'Yonhap News': 2,
  'Chosun Ilbo': 2,
  'OpenAI News': 3,
  // Portuguese
  'Brasil Paralelo': 2,

  // Tier 1 - Official Government & International Orgs
  'White House': 1,
  'State Dept': 1,
  'Pentagon': 1,
  'UN News': 1,
  'CISA': 1,
  'Treasury': 2,
  'DOJ': 2,
  'DHS': 2,
  'CDC': 2,
  'FEMA': 2,

  // Tier 2 - Business & Tech
  'TechCrunch': 2,
  'TechCrunch Startups': 2,
  'TechCrunch Funding': 2,
  'VentureBeat': 2,
  'The Verge': 2,
  'Ars Technica': 2,
  'Wired': 2,
  'MIT Tech Review': 2,

  // Tier 3 - Funding & VC
  'Crunchbase News': 2,
  'PitchBook News': 2,
  'PitchBook': 2,
  'SaaStr': 3,
  'First Round Review': 3,
  'a16z Blog': 3,
  'Sequoia Blog': 3,
  'AngelList': 3,
  'CB Insights': 3,

  // Tier 2 - Research & Analysis
  'Gartner News': 2,
  'Forrester': 2,
  'G2 Research': 3,
  'G2 News': 3,

  // Tier 3 - Cloud & DevOps
  'InfoQ': 3,
  'The New Stack': 3,
  'DevOps.com': 3,
  'Container Journal': 3,

  // Tier 3 - Specialty
  'Foreign Policy': 3,
  'The Diplomat': 3,
  'Krebs on Security': 3,
  'Dark Reading': 3,
  'The Hacker News': 3,
  'BleepingComputer': 3,
  'SEC News': 2,
  'SEC EDGAR 8-K': 2,
  'SEC Filings': 2,
  'Finextra': 3,
  'Tearsheet': 3,
  'Finovate': 3,
  'Healthcare IT News': 3,
  'MobiHealthNews': 3,
  'Product Hunt': 4,
  'FedScoop': 3,
  'GovTech': 3,
  'SAM.gov': 2,
  'Glassdoor Blog': 3,
  'Seeking Alpha': 3,
  'Federal Reserve': 3,
  'SEC': 3,
  'Atlantic Council': 3,
  'Foreign Affairs': 3,
  'CrisisWatch': 3,
  'CSIS': 3,
  'RAND': 3,
  'Brookings': 3,
  'Carnegie': 3,
  'IAEA': 1,
  'WHO': 1,
  'UNHCR': 1,
  'Xinhua': 3,
  'TASS': 3,
  'RT': 3,
  'RT Russia': 3,
  'Layoffs.fyi': 3,
  'BBC Persian': 2,
  'Iran International': 3,
  'Fars News': 3,
  'MIIT (China)': 1,
  'MOFCOM (China)': 1,
  // Turkish
  'BBC Turkce': 2,
  'DW Turkish': 2,
  'Hurriyet': 2,
  // Polish
  'TVN24': 2,
  'Polsat News': 2,
  'Rzeczpospolita': 2,
  // Russian (independent)
  'BBC Russian': 2,
  'Meduza': 2,
  'Novaya Gazeta Europe': 2,
  // Thai
  'Bangkok Post': 2,
  'Thai PBS': 2,
  // Australian
  'ABC News Australia': 2,
  'Guardian Australia': 2,
  // Vietnamese
  'VnExpress': 2,
  'Tuoi Tre News': 2,

  // Tier 2 - Premium Startup/VC Sources
  'Y Combinator Blog': 2,
  'The Information': 2,

  // Tier 3 - Regional/Specialty Startup Sources
  'EU Startups': 3,
  'Tech.eu': 3,
  'Sifted (Europe)': 3,
  'The Next Web': 3,
  'Tech in Asia': 3,
  'TechCabal (Africa)': 3,
  'Inc42 (India)': 3,
  'YourStory': 3,
  'Paul Graham Essays': 2,
  'Stratechery': 2,
  // Asia - Regional
  'e27 (SEA)': 3,
  'DealStreetAsia': 3,
  'Pandaily (China)': 3,
  '36Kr English': 3,
  'TechNode (China)': 3,
  'China Tech News': 3,
  'The Bridge (Japan)': 3,
  'Japan Tech News': 3,
  'Nikkei Tech': 2,
  'NHK World': 2,
  'Nikkei Asia': 2,
  'Korea Tech News': 3,
  'KED Global': 3,
  'Entrackr (India)': 3,
  'India Tech News': 3,
  'Taiwan Tech News': 3,
  'GloNewswire (Taiwan)': 4,
  // LATAM
  'La Silla Vacía': 3,
  'LATAM Tech News': 3,
  'Startups.co (LATAM)': 3,
  'Contxto (LATAM)': 3,
  'Brazil Tech News': 3,
  'Mexico Tech News': 3,
  'LATAM Fintech': 3,
  // Africa & MENA
  'Wamda (MENA)': 3,
  'Magnitt': 3,
  // Nigeria
  'Premium Times': 2,
  'Vanguard Nigeria': 2,
  'Channels TV': 2,
  'Daily Trust': 3,
  'ThisDay': 2,
  // Greek
  'Kathimerini': 2,
  'Naftemporiki': 2,
  'in.gr': 3,
  'iefimerida': 3,
  'Proto Thema': 3,

  // Tier 3 - Think Tanks
  'Brookings Tech': 3,
  'CSIS Tech': 3,
  'MIT Tech Policy': 3,
  'Stanford HAI': 2,
  'AI Now Institute': 3,
  'OECD Digital': 2,
  'Bruegel (EU)': 3,
  'Chatham House Tech': 3,
  'ISEAS (Singapore)': 3,
  'ORF Tech (India)': 3,
  'RIETI (Japan)': 3,
  'Lowy Institute': 3,
  'China Tech Analysis': 3,
  'DigiChina': 2,
  // Security/Defense Think Tanks
  'RUSI': 2,
  'Wilson Center': 3,
  'GMF': 3,
  'Stimson Center': 3,
  'CNAS': 2,
  // Nuclear & Arms Control
  'Arms Control Assn': 2,
  'Bulletin of Atomic Scientists': 2,
  // Food Security
  'FAO GIEWS': 2,
  'EU ISS': 3,
  // New verified think tanks
  'War on the Rocks': 2,
  'AEI': 3,
  'Responsible Statecraft': 3,
  'FPRI': 3,
  'Jamestown': 3,

  // Tier 3 - Policy Sources
  'Politico Tech': 2,
  'AI Regulation': 3,
  'Tech Antitrust': 3,
  'EFF News': 3,
  'EU Digital Policy': 3,
  'Euractiv Digital': 3,
  'EU Commission Digital': 2,
  'China Tech Policy': 3,
  'UK Tech Policy': 3,
  'India Tech Policy': 3,

  // Tier 2-3 - Podcasts & Newsletters
  'Acquired Podcast': 2,
  'All-In Podcast': 2,
  'a16z Podcast': 2,
  'This Week in Startups': 3,
  'The Twenty Minute VC': 2,
  'Lex Fridman Tech': 3,
  'The Vergecast': 3,
  'Decoder (Verge)': 3,
  'Hard Fork (NYT)': 2,
  'Pivot (Vox)': 2,
  'Benedict Evans': 2,
  'The Pragmatic Engineer': 2,
  'Lenny Newsletter': 2,
  'AI Podcast (NVIDIA)': 3,
  'Gradient Dissent': 3,
  'Eye on AI': 3,
  'How I Built This': 2,
  'Masters of Scale': 2,
  'The Pitch': 3,

  // Tier 4 - Aggregators
  'The Verge AI': 4,
  'VentureBeat AI': 4,
  'Yahoo Finance': 4,
  'TechCrunch Layoffs': 4,
  'ArXiv AI': 4,
  'AI News': 4,
  'Layoffs News': 4,

  // Tier 2 - Positive News Sources (Happy variant)
  'Good News Network': 2,
  'Positive.News': 2,
  'Reasons to be Cheerful': 2,
  'Optimist Daily': 2,
  'GNN Science': 3,
  'GNN Animals': 3,
  'GNN Health': 3,
  'GNN Heroes': 3,
};

export function getSourceTier(sourceName: string): number {
  return SOURCE_TIERS[sourceName] ?? 4; // Default to tier 4 if unknown
}

export type SourceType = 'wire' | 'gov' | 'intel' | 'mainstream' | 'market' | 'tech' | 'other';

export const SOURCE_TYPES: Record<string, SourceType> = {
  // Wire services - fastest, most authoritative
  'Reuters': 'wire', 'Reuters World': 'wire', 'Reuters Business': 'wire',
  'AP News': 'wire', 'AFP': 'wire', 'Bloomberg': 'wire',

  // Government & International Org sources
  'White House': 'gov', 'State Dept': 'gov', 'Pentagon': 'gov',
  'Treasury': 'gov', 'DOJ': 'gov', 'DHS': 'gov', 'CDC': 'gov',
  'FEMA': 'gov', 'Federal Reserve': 'gov', 'SEC': 'gov',
  'UN News': 'gov', 'CISA': 'gov',

  // Intel/Defense specialty
  'Defense One': 'intel', 'Breaking Defense': 'intel', 'The War Zone': 'intel',
  'Defense News': 'intel', 'Janes': 'intel', 'Military Times': 'intel', 'Task & Purpose': 'intel',
  'USNI News': 'intel', 'gCaptain': 'intel', 'Oryx OSINT': 'intel', 'UK MOD': 'gov',
  'Bellingcat': 'intel', 'Krebs Security': 'intel',
  'Foreign Policy': 'intel', 'The Diplomat': 'intel',
  'Atlantic Council': 'intel', 'Foreign Affairs': 'intel',
  'CrisisWatch': 'intel',
  'CSIS': 'intel', 'RAND': 'intel', 'Brookings': 'intel', 'Carnegie': 'intel',
  'IAEA': 'gov', 'WHO': 'gov', 'UNHCR': 'gov',
  'Xinhua': 'wire', 'TASS': 'wire', 'RT': 'wire', 'RT Russia': 'wire',
  'NHK World': 'mainstream', 'Nikkei Asia': 'market',

  // Mainstream outlets
  'BBC World': 'mainstream', 'BBC Middle East': 'mainstream',
  'Guardian World': 'mainstream', 'Guardian ME': 'mainstream',
  'NPR News': 'mainstream', 'Al Jazeera': 'mainstream',
  'CNN World': 'mainstream', 'Politico': 'mainstream', 'Axios': 'mainstream',
  'EuroNews': 'mainstream', 'France 24': 'mainstream', 'Le Monde': 'mainstream',
  // European Addition
  'El País': 'mainstream', 'El Mundo': 'mainstream', 'BBC Mundo': 'mainstream',
  'Tagesschau': 'mainstream', 'Der Spiegel': 'mainstream', 'Die Zeit': 'mainstream', 'DW News': 'mainstream',
  'ANSA': 'wire', 'Corriere della Sera': 'mainstream', 'Repubblica': 'mainstream',
  'NOS Nieuws': 'mainstream', 'NRC': 'mainstream', 'De Telegraaf': 'mainstream',
  'SVT Nyheter': 'mainstream', 'Dagens Nyheter': 'mainstream', 'Svenska Dagbladet': 'mainstream',
  // Brazilian Addition
  'Brasil Paralelo': 'mainstream',

  // Market/Finance
  'CNBC': 'market', 'MarketWatch': 'market', 'Yahoo Finance': 'market',
  'Financial Times': 'market',

  // Tech
  'Hacker News': 'tech', 'Ars Technica': 'tech', 'The Verge': 'tech',
  'The Verge AI': 'tech', 'MIT Tech Review': 'tech', 'TechCrunch Layoffs': 'tech',
  'AI News': 'tech', 'ArXiv AI': 'tech', 'VentureBeat AI': 'tech',
  'Layoffs.fyi': 'tech', 'Layoffs News': 'tech',

  // Regional Tech Startups
  'EU Startups': 'tech', 'Tech.eu': 'tech', 'Sifted (Europe)': 'tech',
  'The Next Web': 'tech', 'Tech in Asia': 'tech', 'e27 (SEA)': 'tech',
  'DealStreetAsia': 'tech', 'Pandaily (China)': 'tech', '36Kr English': 'tech',
  'TechNode (China)': 'tech', 'The Bridge (Japan)': 'tech', 'Nikkei Tech': 'tech',
  'Inc42 (India)': 'tech', 'YourStory': 'tech', 'TechCabal (Africa)': 'tech',
  'Wamda (MENA)': 'tech', 'Magnitt': 'tech',

  // Think Tanks & Policy
  'Brookings Tech': 'intel', 'CSIS Tech': 'intel', 'Stanford HAI': 'intel',
  'AI Now Institute': 'intel', 'OECD Digital': 'intel', 'Bruegel (EU)': 'intel',
  'Chatham House Tech': 'intel', 'DigiChina': 'intel', 'Lowy Institute': 'intel',
  'EFF News': 'intel', 'Politico Tech': 'intel',
  // Security/Defense Think Tanks
  'RUSI': 'intel', 'Wilson Center': 'intel', 'GMF': 'intel',
  'Stimson Center': 'intel', 'CNAS': 'intel',
  // Nuclear & Arms Control
  'Arms Control Assn': 'intel', 'Bulletin of Atomic Scientists': 'intel',
  // Food Security & Regional
  'FAO GIEWS': 'gov', 'EU ISS': 'intel',
  // New verified think tanks
  'War on the Rocks': 'intel', 'AEI': 'intel', 'Responsible Statecraft': 'intel',
  'FPRI': 'intel', 'Jamestown': 'intel',

  // Podcasts & Newsletters
  'Acquired Podcast': 'tech', 'All-In Podcast': 'tech', 'a16z Podcast': 'tech',
  'This Week in Startups': 'tech', 'The Twenty Minute VC': 'tech',
  'Hard Fork (NYT)': 'tech', 'Pivot (Vox)': 'tech', 'Stratechery': 'tech',
  'Benedict Evans': 'tech', 'How I Built This': 'tech', 'Masters of Scale': 'tech',
};

export function getSourceType(sourceName: string): SourceType {
  return SOURCE_TYPES[sourceName] ?? 'other';
}

// Propaganda risk assessment for sources (Quick Win #5)
// 'high' = State-controlled media, known to push government narratives
// 'medium' = State-affiliated or known editorial bias toward specific governments
// 'low' = Independent journalism with editorial standards
export type PropagandaRisk = 'low' | 'medium' | 'high';

export interface SourceRiskProfile {
  risk: PropagandaRisk;
  stateAffiliated?: string;
  knownBiases?: string[];
  note?: string;
}

export const SOURCE_PROPAGANDA_RISK: Record<string, SourceRiskProfile> = {
  // High risk - State-controlled media
  'Xinhua': { risk: 'high', stateAffiliated: 'China', note: 'Official CCP news agency' },
  'TASS': { risk: 'high', stateAffiliated: 'Russia', note: 'Russian state news agency' },
  'RT': { risk: 'high', stateAffiliated: 'Russia', note: 'Russian state media, banned in EU' },
  'RT Russia': { risk: 'high', stateAffiliated: 'Russia', note: 'Russian state media, Russia desk' },
  'Sputnik': { risk: 'high', stateAffiliated: 'Russia', note: 'Russian state media' },
  'CGTN': { risk: 'high', stateAffiliated: 'China', note: 'Chinese state broadcaster' },
  'Press TV': { risk: 'high', stateAffiliated: 'Iran', note: 'Iranian state media' },
  'KCNA': { risk: 'high', stateAffiliated: 'North Korea', note: 'North Korean state media' },

  // Medium risk - State-affiliated or known bias
  'Al Jazeera': { risk: 'medium', stateAffiliated: 'Qatar', note: 'Qatari state-funded, independent editorial' },
  'Al Arabiya': { risk: 'medium', stateAffiliated: 'Saudi Arabia', note: 'Saudi-owned, reflects Gulf perspective' },
  'TRT World': { risk: 'medium', stateAffiliated: 'Turkey', note: 'Turkish state broadcaster' },
  'France 24': { risk: 'medium', stateAffiliated: 'France', note: 'French state-funded, editorially independent' },
  'EuroNews': { risk: 'low', note: 'European public broadcaster consortium', knownBiases: ['Pro-EU'] },
  'Le Monde': { risk: 'low', note: 'French newspaper of record' },
  'DW News': { risk: 'medium', stateAffiliated: 'Germany', note: 'German state-funded, editorially independent' },
  'Voice of America': { risk: 'medium', stateAffiliated: 'USA', note: 'US government-funded' },
  'Kyiv Independent': { risk: 'medium', knownBiases: ['Pro-Ukraine'], note: 'Ukrainian perspective on Russia-Ukraine war' },
  'Moscow Times': { risk: 'medium', knownBiases: ['Anti-Kremlin'], note: 'Independent, critical of Russian government' },

  // Low risk - Independent with editorial standards (explicit)
  'Reuters': { risk: 'low', note: 'Wire service, strict editorial standards' },
  'AP News': { risk: 'low', note: 'Wire service, nonprofit cooperative' },
  'AFP': { risk: 'low', note: 'Wire service, editorially independent' },
  'BBC World': { risk: 'low', note: 'Public broadcaster, editorial independence charter' },
  'BBC Middle East': { risk: 'low', note: 'Public broadcaster, editorial independence charter' },
  'Guardian World': { risk: 'low', knownBiases: ['Center-left'], note: 'Scott Trust ownership, no shareholders' },
  'Financial Times': { risk: 'low', note: 'Business focus, Nikkei-owned' },
  'Bellingcat': { risk: 'low', note: 'Open-source investigations, methodology transparent' },
  'Brasil Paralelo': { risk: 'low', note: 'Independent media company: no political ties, no public funding, 100% subscriber-funded.' },
};

export function getSourcePropagandaRisk(sourceName: string): SourceRiskProfile {
  return SOURCE_PROPAGANDA_RISK[sourceName] ?? { risk: 'low' };
}

export function isStateAffiliatedSource(sourceName: string): boolean {
  const profile = SOURCE_PROPAGANDA_RISK[sourceName];
  return !!profile?.stateAffiliated;
}

// SalesIntel Business Intelligence Feeds
const SALESINTEL_FEEDS: Record<string, Feed[]> = {
  // Tier 1: Wire Services & Major Business
  business: [
    { name: 'Reuters Business', url: rss('https://news.google.com/rss/search?q=source:reuters+business&hl=en-US&gl=US&ceid=US:en'), type: 'wire' },
    { name: 'Bloomberg', url: rss('https://news.google.com/rss/search?q=source:bloomberg+business&hl=en-US&gl=US&ceid=US:en'), type: 'wire' },
    { name: 'Financial Times', url: rss('https://news.google.com/rss/search?q=source:"financial+times"&hl=en-US&gl=US&ceid=US:en'), type: 'wire' },
    { name: 'Wall Street Journal', url: rss('https://feeds.a.dj.com/rss/WSJcomUSBusiness.xml'), type: 'wire' },
    { name: 'CNBC', url: rss('https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10001147'), type: 'business' },
    { name: 'Forbes', url: rss('https://www.forbes.com/innovation/feed2'), type: 'business' },
    { name: 'Business Insider', url: rss('https://news.google.com/rss/search?q=source:"business+insider"&hl=en-US&gl=US&ceid=US:en'), type: 'business' },
  ],

  // Tier 2: Tech & Startup
  tech: [
    { name: 'TechCrunch', url: rss('https://techcrunch.com/feed/'), type: 'tech' },
    { name: 'TechCrunch Startups', url: rss('https://techcrunch.com/category/startups/feed/'), type: 'tech' },
    { name: 'The Verge', url: rss('https://www.theverge.com/rss/index.xml'), type: 'tech' },
    { name: 'Ars Technica', url: rss('https://feeds.arstechnica.com/arstechnica/index'), type: 'tech' },
    { name: 'Wired', url: rss('https://www.wired.com/feed/rss'), type: 'tech' },
    { name: 'MIT Tech Review', url: rss('https://www.technologyreview.com/feed/'), type: 'tech' },
    { name: 'VentureBeat', url: rss('https://venturebeat.com/feed/'), type: 'tech' },
  ],

  // Tier 3: Funding & Venture Capital
  funding: [
    { name: 'Crunchbase News', url: rss('https://news.crunchbase.com/feed/'), type: 'funding' },
    { name: 'PitchBook News', url: rss('https://news.google.com/rss/search?q=site:pitchbook.com&hl=en-US&gl=US&ceid=US:en'), type: 'funding' },
    { name: 'SaaStr', url: rss('https://www.saastr.com/feed/'), type: 'funding' },
    { name: 'First Round Review', url: rss('https://review.firstround.com/feed.xml'), type: 'funding' },
    { name: 'a16z Blog', url: rss('https://a16z.com/feed/'), type: 'funding' },
    { name: 'Sequoia Blog', url: rss('https://news.google.com/rss/search?q=site:sequoiacap.com+blog&hl=en-US&gl=US&ceid=US:en'), type: 'funding' },
  ],

  // Tier 3: Cloud & Infrastructure
  cloud: [
    { name: 'InfoQ', url: rss('https://feed.infoq.com/'), type: 'cloud' },
    { name: 'The New Stack', url: rss('https://thenewstack.io/feed/'), type: 'cloud' },
    { name: 'DevOps.com', url: rss('https://devops.com/feed/'), type: 'cloud' },
    { name: 'Container Journal', url: rss('https://containerjournal.com/feed/'), type: 'cloud' },
  ],

  // Tier 3: Cybersecurity
  cybersecurity: [
    { name: 'Dark Reading', url: rss('https://www.darkreading.com/rss.xml'), type: 'cyber' },
    { name: 'Krebs on Security', url: rss('https://krebsonsecurity.com/feed/'), type: 'cyber' },
    { name: 'The Hacker News', url: rss('https://feeds.feedburner.com/TheHackersNews'), type: 'cyber' },
    { name: 'BleepingComputer', url: rss('https://www.bleepingcomputer.com/feed/'), type: 'cyber' },
  ],

  // Tier 3: Fintech
  fintech: [
    { name: 'Finextra', url: rss('https://www.finextra.com/rss/headlines.aspx'), type: 'fintech' },
    { name: 'Tearsheet', url: rss('https://tearsheet.co/feed/'), type: 'fintech' },
    { name: 'Finovate', url: rss('https://finovate.com/feed/'), type: 'fintech' },
  ],

  // Tier 3: Healthcare IT
  healthtech: [
    { name: 'Healthcare IT News', url: rss('https://www.healthcareitnews.com/feed'), type: 'healthtech' },
    { name: 'MobiHealthNews', url: rss('https://www.mobihealthnews.com/feed'), type: 'healthtech' },
  ],

  // Tier 2: SEC & Financial Filings
  filings: [
    { name: 'SEC EDGAR 8-K', url: rss('https://efts.sec.gov/LATEST/search-index?q=%228-K%22&dateRange=custom&startdt=2024-01-01&forms=8-K'), type: 'filing' },
    { name: 'SEC News', url: rss('https://www.sec.gov/news/pressreleases.rss'), type: 'filing' },
  ],

  // Tier 4: Product & Community
  product: [
    { name: 'Product Hunt', url: rss('https://www.producthunt.com/feed'), type: 'product' },
    { name: 'Hacker News', url: rss('https://news.ycombinator.com/rss'), type: 'product' },
    { name: 'G2 News', url: rss('https://news.google.com/rss/search?q=site:g2.com+research&hl=en-US&gl=US&ceid=US:en'), type: 'product' },
  ],

  // Tier 2: Government Procurement
  procurement: [
    { name: 'SAM.gov', url: rss('https://news.google.com/rss/search?q=site:sam.gov+contract+award&hl=en-US&gl=US&ceid=US:en'), type: 'procurement' },
    { name: 'FedScoop', url: rss('https://fedscoop.com/feed/'), type: 'procurement' },
    { name: 'GovTech', url: rss('https://www.govtech.com/rss'), type: 'procurement' },
  ],

  // Tier 2: Market Analysis
  markets: [
    { name: 'MarketWatch', url: rss('https://feeds.marketwatch.com/marketwatch/topstories/'), type: 'market' },
    { name: 'Seeking Alpha', url: rss('https://news.google.com/rss/search?q=source:"seeking+alpha"&hl=en-US&gl=US&ceid=US:en'), type: 'market' },
  ],
};

// SalesIntel exports (single variant)
export const FEEDS = SALESINTEL_FEEDS;

export const SOURCE_REGION_MAP: Record<string, { labelKey: string; feedKeys: string[] }> = {
  // Full (geopolitical) variant regions
  worldwide: { labelKey: 'header.sourceRegionWorldwide', feedKeys: ['politics', 'crisis'] },
  us: { labelKey: 'header.sourceRegionUS', feedKeys: ['us', 'gov'] },
  europe: { labelKey: 'header.sourceRegionEurope', feedKeys: ['europe'] },
  middleeast: { labelKey: 'header.sourceRegionMiddleEast', feedKeys: ['middleeast'] },
  africa: { labelKey: 'header.sourceRegionAfrica', feedKeys: ['africa'] },
  latam: { labelKey: 'header.sourceRegionLatAm', feedKeys: ['latam'] },
  asia: { labelKey: 'header.sourceRegionAsiaPacific', feedKeys: ['asia'] },
  topical: { labelKey: 'header.sourceRegionTopical', feedKeys: ['energy', 'tech', 'ai', 'finance', 'layoffs', 'thinktanks'] },
  intel: { labelKey: 'header.sourceRegionIntel', feedKeys: [] },

  // Tech variant regions
  techNews: { labelKey: 'header.sourceRegionTechNews', feedKeys: ['tech', 'hardware'] },
  aiMl: { labelKey: 'header.sourceRegionAiMl', feedKeys: ['ai'] },
  startupsVc: { labelKey: 'header.sourceRegionStartupsVc', feedKeys: ['startups', 'vcblogs', 'funding', 'unicorns', 'accelerators', 'ipo'] },
  regionalTech: { labelKey: 'header.sourceRegionRegionalTech', feedKeys: ['regionalStartups'] },
  developer: { labelKey: 'header.sourceRegionDeveloper', feedKeys: ['github', 'cloud', 'dev', 'producthunt', 'outages'] },
  cybersecurity: { labelKey: 'header.sourceRegionCybersecurity', feedKeys: ['security'] },
  techPolicy: { labelKey: 'header.sourceRegionTechPolicy', feedKeys: ['policy', 'thinktanks'] },
  techMedia: { labelKey: 'header.sourceRegionTechMedia', feedKeys: ['podcasts', 'layoffs', 'finance'] },

  // Finance variant regions
  marketsAnalysis: { labelKey: 'header.sourceRegionMarkets', feedKeys: ['markets', 'analysis', 'ipo'] },
  fixedIncomeFx: { labelKey: 'header.sourceRegionFixedIncomeFx', feedKeys: ['forex', 'bonds'] },
  commoditiesRegion: { labelKey: 'header.sourceRegionCommodities', feedKeys: ['commodities'] },
  cryptoDigital: { labelKey: 'header.sourceRegionCryptoDigital', feedKeys: ['crypto', 'fintech'] },
  centralBanksEcon: { labelKey: 'header.sourceRegionCentralBanks', feedKeys: ['centralbanks', 'economic'] },
  dealsCorpFin: { labelKey: 'header.sourceRegionDeals', feedKeys: ['institutional', 'derivatives'] },
  finRegulation: { labelKey: 'header.sourceRegionFinRegulation', feedKeys: ['regulation'] },
  gulfMena: { labelKey: 'header.sourceRegionGulfMena', feedKeys: ['gccNews'] },
};

export const INTEL_SOURCES: Feed[] = [
  // Sales Intelligence Sources (Tier 1-2)
  { name: 'Crunchbase News', url: rss('https://news.crunchbase.com/feed/'), type: 'funding' },
  { name: 'TechCrunch Funding', url: rss('https://techcrunch.com/category/venture/feed/'), type: 'funding' },
  { name: 'PitchBook', url: rss('https://news.google.com/rss/search?q=site:pitchbook.com+when:7d&hl=en-US&gl=US&ceid=US:en'), type: 'funding' },
  { name: 'SEC Filings', url: rss('https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&dateb=&owner=include&count=40&search_text=&action=getcurrent&output=atom'), type: 'filing' },
  { name: 'AngelList', url: rss('https://news.google.com/rss/search?q=site:angel.co+OR+site:wellfound.com+hiring+startup&hl=en-US&gl=US&ceid=US:en'), type: 'hiring' },
  { name: 'Glassdoor Blog', url: rss('https://news.google.com/rss/search?q=site:glassdoor.com+blog&hl=en-US&gl=US&ceid=US:en'), type: 'hiring' },
  { name: 'G2 Research', url: rss('https://news.google.com/rss/search?q=site:g2.com+research&hl=en-US&gl=US&ceid=US:en'), type: 'technology' },
  { name: 'Gartner News', url: rss('https://news.google.com/rss/search?q=source:gartner&hl=en-US&gl=US&ceid=US:en'), type: 'research' },
  { name: 'Forrester', url: rss('https://news.google.com/rss/search?q=source:forrester&hl=en-US&gl=US&ceid=US:en'), type: 'research' },
  { name: 'CB Insights', url: rss('https://news.google.com/rss/search?q=site:cbinsights.com&hl=en-US&gl=US&ceid=US:en'), type: 'research' },
];

export function computeDefaultDisabledSources(): string[] {
  // All sources from FEEDS and INTEL_SOURCES are enabled by default in SalesIntel
  return [];
}

// Keywords that trigger high-priority signal alerts
export const ALERT_KEYWORDS = [
  'series a', 'series b', 'series c', 'series d', 'funding round',
  'raised million', 'raised billion', 'ipo filing', 's-1 filing',
  'acquisition', 'merger', 'appointed cto', 'appointed cio', 'new ceo',
  'rfp issued', 'vendor evaluation', 'digital transformation',
  'cloud migration', 'hiring surge', 'expansion into', 'new headquarters',
  'layoffs', 'restructuring', 'earnings beat', 'revenue growth',
];

// Patterns that indicate non-signal content
export const ALERT_EXCLUSIONS = [
  'protein', 'couples', 'relationship', 'dating', 'diet', 'fitness',
  'recipe', 'cooking', 'shopping', 'fashion', 'celebrity', 'movie',
  'tv show', 'sports', 'game', 'concert', 'festival', 'wedding',
  'vacation', 'travel tips', 'life hack', 'self-care', 'wellness',
];
