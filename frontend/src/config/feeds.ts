import { NewsCategory, SourceTier } from "@bantay-pilipinas/shared";

export interface FeedDefinition {
  id: string;
  name: string;
  url: string;
  tier: SourceTier;
  category: NewsCategory;
  language: "en" | "fil";
}

export const PH_FEEDS: FeedDefinition[] = [
  // Tier 1 — Wire Services & Official Government
  { id: "pna", name: "Philippine News Agency", url: "https://www.pna.gov.ph/rss.xml", tier: SourceTier.WireGov, category: NewsCategory.NationalPolitics, language: "en" },
  { id: "dfa", name: "Department of Foreign Affairs", url: "https://dfa.gov.ph/rss", tier: SourceTier.WireGov, category: NewsCategory.NationalPolitics, language: "en" },

  // Tier 2 — Major National Outlets
  { id: "inquirer", name: "Inquirer.net", url: "https://newsinfo.inquirer.net/feed", tier: SourceTier.MajorNational, category: NewsCategory.NationalPolitics, language: "en" },
  { id: "rappler", name: "Rappler", url: "https://www.rappler.com/feed/", tier: SourceTier.MajorNational, category: NewsCategory.NationalPolitics, language: "en" },
  { id: "philstar", name: "PhilStar", url: "https://www.philstar.com/rss/nation", tier: SourceTier.MajorNational, category: NewsCategory.NationalPolitics, language: "en" },
  { id: "mb", name: "Manila Bulletin", url: "https://mb.com.ph/rss/news", tier: SourceTier.MajorNational, category: NewsCategory.NationalPolitics, language: "en" },
  { id: "gma", name: "GMA News Online", url: "https://data.gmanetwork.com/gno/rss/news/feed.xml", tier: SourceTier.MajorNational, category: NewsCategory.NationalPolitics, language: "en" },
  { id: "abs-cbn", name: "ABS-CBN News", url: "https://news.abs-cbn.com/rss.xml", tier: SourceTier.MajorNational, category: NewsCategory.NationalPolitics, language: "en" },
  { id: "bworld", name: "BusinessWorld", url: "https://www.bworldonline.com/feed/", tier: SourceTier.MajorNational, category: NewsCategory.Economy, language: "en" },
  { id: "bmirror", name: "BusinessMirror", url: "https://businessmirror.com.ph/feed/", tier: SourceTier.MajorNational, category: NewsCategory.Economy, language: "en" },

  // Tier 3 — Specialist & Regional
  { id: "verafiles", name: "Vera Files", url: "https://verafiles.org/feed", tier: SourceTier.SpecialistRegional, category: NewsCategory.NationalPolitics, language: "en" },
  { id: "mindanews", name: "MindaNews", url: "https://www.mindanews.com/feed/", tier: SourceTier.SpecialistRegional, category: NewsCategory.Regional, language: "en" },
  { id: "sunstar", name: "SunStar", url: "https://www.sunstar.com.ph/rssFeed/0", tier: SourceTier.SpecialistRegional, category: NewsCategory.Regional, language: "en" },
  { id: "manilatimes", name: "The Manila Times", url: "https://www.manilatimes.net/feed/", tier: SourceTier.SpecialistRegional, category: NewsCategory.NationalPolitics, language: "en" },

  // Tier 4 — Aggregators & International Coverage
  { id: "reuters-ph", name: "Reuters Philippines", url: "https://www.reuters.com/rss/news/philippines", tier: SourceTier.AggregatorInternational, category: NewsCategory.NationalPolitics, language: "en" },
  { id: "scmp", name: "South China Morning Post", url: "https://www.scmp.com/rss/91/feed", tier: SourceTier.AggregatorInternational, category: NewsCategory.WPSMaritime, language: "en" },
  { id: "diplomat", name: "The Diplomat", url: "https://thediplomat.com/feed/", tier: SourceTier.AggregatorInternational, category: NewsCategory.Defense, language: "en" },
  { id: "benarnews", name: "Benar News", url: "https://www.benarnews.org/english/rss/rss.xml", tier: SourceTier.AggregatorInternational, category: NewsCategory.Defense, language: "en" },
];
