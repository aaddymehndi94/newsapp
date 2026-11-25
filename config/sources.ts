// Curated news sources. Each outlet has an owner, a tier and a leaning (see OUTLETS below).
// Leaning labels are rough editorial-stance guides (AllSides / Media Bias ratings where they
// exist, common perception for Indian outlets); they are not a judgement of accuracy. In India,
// bias runs more along closeness to government and owners' interests than left and right, so
// the tier and owner matter more: see docs/retro/2026-11-25-editorial-retrospective.md.

export type Leaning = "left" | "centre-left" | "centre" | "centre-right" | "right";
export type City = "bengaluru" | "chennai" | "delhi" | "hyderabad" | "kochi" | "kolkata" | "mumbai";
export type Region = "india" | "world" | City;
export type SectionHint =
  | "general"
  | "india"
  | "world"
  | "business"
  | "science"
  | "tech"
  | "sports"
  | "health"
  | "environment"
  | City
  | "ai"
  | "weather"
  | "entertainment";

/**
 * How far a story may lean on an outlet:
 * - primary: the body itself (a regulator, a court, a lab, a company announcing its own news)
 * - wire: a news agency (PTI)
 * - core: an outlet with its own reporting and corrections that can lead a story
 * - corroborate: may confirm a story but never be its first or only source (owner conflicts,
 *   paid-content business models, a record of trial balloons or partisan framing)
 * - perspective: advocacy outlets, only to show what a side is saying
 */
export type Tier = "primary" | "wire" | "core" | "corroborate" | "perspective";

export interface OutletInfo {
  owner: string;
  tier: Tier;
  leaning: Leaning;
}

export interface Source {
  id: string;
  outlet: string;
  url: string;
  region: Region;
  section: SectionHint;
  leaning: Leaning;
  /** "rss" (default): RSS/Atom/RDF. "sitemap": a Google News sitemap or sitemap index (headlines and links). */
  kind?: "rss" | "sitemap";
  /** Fetch article pages for text and pictures (default true; PTI's pages need JavaScript). Pages
   *  are also skipped wherever robots.txt bars Claude-User (pipeline/robots.ts). */
  fetchPages?: boolean;
  /** Keep only links whose path matches (sitemaps carry every section). */
  path?: RegExp;
  /** Keep only items whose headline matches (routes wire copy to a city). */
  match?: RegExp;
  /** Timestamps are Indian time: "ist" when they carry no offset, "ist-as-utc" when they are
   *  Indian time wrongly labelled +00:00. */
  times?: "ist" | "ist-as-utc";
  /** Rewrite links' host (an outlet whose sitemap points at a host that doesn't resolve). */
  host?: [from: string, to: string];
  /** Read only to find other reports of a story the editor picked (pipeline/coverage.ts); never
   *  shown to the editor. */
  searchOnly?: boolean;
}

// No Google News feeds: news.google.com/robots.txt bars /rss/ for every reader (found
// 2026-11-25; the 17 headline-only feeds that used it were removed). Every feed is also checked
// against its site's robots.txt before each fetch (pipeline/robots.ts); CNA (/api/ barred) and
// The Register (only named search engines allowed) were removed for the same reason.

// The two Indian wire agencies route their national copy to a city when the headline names it
// (or its state, where the city section also carries state news that touches the city).
const PTI = "https://www.ptinews.com/news-sitemap.xml";
const PTI_NATIONAL = /\/story\/national\//;
const UNI = "https://www.uniindia.com/news-sitemap.xml";
const UNI_NATIONAL = /^\/(national|north-india|south-india|east-india|west-india)\//;
const CITY_MATCH: Record<City, RegExp> = {
  delhi: /\bDelhi\b/,
  mumbai: /\bMumbai\b|\bThane\b|\bBMC\b/,
  kolkata: /\bKolkata\b|\bBengal\b/,
  bengaluru: /\bBengaluru\b|\bBangalore\b|\bKarnataka\b/,
  chennai: /\bChennai\b|\bTamil Nadu\b/,
  hyderabad: /\bHyderabad\b|\bTelangana\b/,
  kochi: /\bKochi\b|\bKerala\b/,
};
const CITIES = Object.keys(CITY_MATCH) as City[];
const pti = (city: City): Source => ({
  id: `pti-${city}`, outlet: "Press Trust of India", url: PTI, kind: "sitemap", path: PTI_NATIONAL, match: CITY_MATCH[city],
  region: city, section: city, leaning: "centre", fetchPages: false,
});
const uni = (city: City): Source => ({
  id: `uni-${city}`, outlet: "United News of India", url: UNI, kind: "sitemap", path: UNI_NATIONAL, match: CITY_MATCH[city],
  region: city, section: city, leaning: "centre",
});

export const SOURCES: Source[] = [
  // ───────────── India — general / national ─────────────
  // PTI's article pages need JavaScript, so its sitemap gives headlines only (fetchPages false).
  // City routes come first so a Delhi item lands in Delhi, not in the national list.
  ...CITIES.map(pti),
  ...CITIES.map(uni),
  // UNI, India's other wire agency: its pages can be read.
  { id: "uni-india", outlet: "United News of India", url: UNI, kind: "sitemap", path: UNI_NATIONAL, region: "india", section: "india", leaning: "centre" },
  { id: "pti-india", outlet: "Press Trust of India", url: PTI, kind: "sitemap", path: PTI_NATIONAL, region: "india", section: "india", leaning: "centre", fetchPages: false },
  { id: "hindu-national", outlet: "The Hindu", url: "https://www.thehindu.com/news/national/feeder/default.rss", region: "india", section: "india", leaning: "centre-left" },
  { id: "ie-india", outlet: "The Indian Express", url: "https://indianexpress.com/section/india/feed/", region: "india", section: "india", leaning: "centre-left" },
  { id: "ht-india", outlet: "Hindustan Times", url: "https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml", region: "india", section: "india", leaning: "centre" },
  // ThePrint also republishes PTI and Reuters copy in full (used to read PTI's text) and paid ANI
  // press releases (left out).
  { id: "theprint", outlet: "ThePrint", url: "https://theprint.in/googlenews.xml", kind: "sitemap", path: /^\/(?!ani-press-releases|opinion|talk-point|brandma)/, region: "india", section: "india", leaning: "centre" },
  { id: "thewire", outlet: "The Wire", url: "https://thewire.in/news-sitemap.xml", kind: "sitemap", host: ["thewirenews.in", "thewire.in"], times: "ist-as-utc", region: "india", section: "india", leaning: "left" },
  { id: "quint-today", outlet: "The Quint", url: "https://www.thequint.com/sitemap/today", kind: "sitemap", path: /^\/news\//, region: "india", section: "india", leaning: "centre-left" },
  { id: "quint-yesterday", outlet: "The Quint", url: "https://www.thequint.com/sitemap/yesterday", kind: "sitemap", path: /^\/news\//, region: "india", section: "india", leaning: "centre-left" },
  { id: "scroll", outlet: "Scroll", url: "https://feeds.feedburner.com/ScrollinArticles.rss", region: "india", section: "india", leaning: "centre-left" },
  { id: "tnm", outlet: "The News Minute", url: "https://www.thenewsminute.com/stories.rss", region: "india", section: "india", leaning: "centre-left" },
  { id: "newslaundry", outlet: "Newslaundry", url: "https://www.newslaundry.com/stories.rss", region: "india", section: "india", leaning: "centre-left" },
  { id: "frontline", outlet: "Frontline", url: "https://frontline.thehindu.com/feeder/default.rss", region: "india", section: "india", leaning: "centre-left" },
  { id: "bbc-india", outlet: "BBC News", url: "https://feeds.bbci.co.uk/news/world/asia/india/rss.xml", region: "india", section: "india", leaning: "centre-left" },
  // Courts.
  { id: "livelaw", outlet: "LiveLaw", url: "https://www.livelaw.in/google_feeds.xml", region: "india", section: "india", leaning: "centre" },
  { id: "barandbench", outlet: "Bar & Bench", url: "https://www.barandbench.com/stories.rss", region: "india", section: "india", leaning: "centre" },
  // Fact-checkers: what is being falsely claimed, and by whom.
  { id: "altnews", outlet: "Alt News", url: "https://www.altnews.in/feed/", region: "india", section: "india", leaning: "centre-left" },
  { id: "boom", outlet: "BOOM", url: "https://www.boomlive.in/google_feeds.xml", region: "india", section: "india", leaning: "centre" },
  { id: "factly", outlet: "Factly", url: "https://factly.in/feed/", region: "india", section: "india", leaning: "centre" },
  // Corroboration only (see OUTLETS): never a story's first or only source.
  { id: "ndtv-india", outlet: "NDTV", url: "https://feeds.feedburner.com/ndtvnews-india-news", region: "india", section: "india", leaning: "centre-right" },
  { id: "news18-india", outlet: "News18", url: "https://www.news18.com/commonfeeds/v1/eng/rss/india.xml", region: "india", section: "india", leaning: "right" },

  // ───────────── India — business ─────────────
  { id: "pti-business", outlet: "Press Trust of India", url: PTI, kind: "sitemap", path: /\/story\/business\//, region: "india", section: "business", leaning: "centre", fetchPages: false },
  { id: "rbi", outlet: "Reserve Bank of India", url: "https://www.rbi.org.in/pressreleases_rss.xml", times: "ist", region: "india", section: "business", leaning: "centre" },
  { id: "mint", outlet: "Mint", url: "https://www.livemint.com/rss/news", region: "india", section: "business", leaning: "centre" },
  { id: "mint-markets", outlet: "Mint", url: "https://www.livemint.com/rss/markets", region: "india", section: "business", leaning: "centre" },
  { id: "bs-latest", outlet: "Business Standard", url: "https://www.business-standard.com/rss/latest.rss", region: "india", section: "business", leaning: "centre" },
  { id: "hindu-business", outlet: "The Hindu", url: "https://www.thehindu.com/business/feeder/default.rss", region: "india", section: "business", leaning: "centre-left" },
  { id: "et-top", outlet: "The Economic Times", url: "https://economictimes.indiatimes.com/rssfeedstopstories.cms", region: "india", section: "business", leaning: "centre-right" },

  // ───────────── Cities (readers pick one on the site) ─────────────
  // Each city is led by outlets with their own city desks; The Times of India's city feeds only
  // corroborate, and the editor sees at most 4 of their items per city. Thin days give a city
  // fewer stories rather than letting one outlet fill it.
  // Bengaluru
  { id: "hindu-blr", outlet: "The Hindu", url: "https://www.thehindu.com/news/cities/bangalore/feeder/default.rss", region: "bengaluru", section: "bengaluru", leaning: "centre-left" },
  { id: "hindu-karnataka", outlet: "The Hindu", url: "https://www.thehindu.com/news/national/karnataka/feeder/default.rss", region: "bengaluru", section: "bengaluru", leaning: "centre-left" },
  { id: "ie-bangalore", outlet: "The Indian Express", url: "https://indianexpress.com/section/cities/bangalore/feed/", region: "bengaluru", section: "bengaluru", leaning: "centre-left" },
  { id: "ht-bengaluru", outlet: "Hindustan Times", url: "https://www.hindustantimes.com/feeds/rss/cities/bengaluru-news/rssfeed.xml", region: "bengaluru", section: "bengaluru", leaning: "centre" },
  { id: "dh-bengaluru", outlet: "Deccan Herald", url: "https://www.deccanherald.com/stories.rss?section=bengaluru", region: "bengaluru", section: "bengaluru", leaning: "centre" },
  { id: "southfirst-karnataka", outlet: "South First", url: "https://thesouthfirst.com/category/karnataka/feed/", region: "bengaluru", section: "bengaluru", leaning: "centre" },
  { id: "citizenmatters", outlet: "Citizen Matters", url: "https://citizenmatters.in/feed/", region: "bengaluru", section: "bengaluru", leaning: "centre" },
  { id: "toi-blr", outlet: "The Times of India", url: "https://timesofindia.indiatimes.com/rssfeeds/-2128833038.cms", region: "bengaluru", section: "bengaluru", leaning: "centre-right" },
  // Chennai
  { id: "hindu-che", outlet: "The Hindu", url: "https://www.thehindu.com/news/cities/chennai/feeder/default.rss", region: "chennai", section: "chennai", leaning: "centre-left" },
  { id: "hindu-tn", outlet: "The Hindu", url: "https://www.thehindu.com/news/national/tamil-nadu/feeder/default.rss", region: "chennai", section: "chennai", leaning: "centre-left" },
  { id: "nie-chennai", outlet: "The New Indian Express", url: "https://www.newindianexpress.com/cities/chennai/rssfeed/", region: "chennai", section: "chennai", leaning: "centre" },
  { id: "dtnext-chennai", outlet: "DT Next", url: "https://www.dtnext.in/api/v1/collections/newschennai-news.rss", region: "chennai", section: "chennai", leaning: "centre" },
  { id: "southfirst-tn", outlet: "South First", url: "https://thesouthfirst.com/category/tamilnadu/feed/", region: "chennai", section: "chennai", leaning: "centre" },
  { id: "toi-chennai", outlet: "The Times of India", url: "https://timesofindia.indiatimes.com/rssfeeds/2950623.cms", region: "chennai", section: "chennai", leaning: "centre-right" },
  // Delhi
  { id: "hindu-del", outlet: "The Hindu", url: "https://www.thehindu.com/news/cities/Delhi/feeder/default.rss", region: "delhi", section: "delhi", leaning: "centre-left" },
  { id: "ie-delhi", outlet: "The Indian Express", url: "https://indianexpress.com/section/cities/delhi/feed/", region: "delhi", section: "delhi", leaning: "centre-left" },
  { id: "ht-delhi", outlet: "Hindustan Times", url: "https://www.hindustantimes.com/feeds/rss/cities/delhi-news/rssfeed.xml", region: "delhi", section: "delhi", leaning: "centre" },
  { id: "toi-delhi", outlet: "The Times of India", url: "https://timesofindia.indiatimes.com/rssfeeds/-2128839596.cms", region: "delhi", section: "delhi", leaning: "centre-right" },
  // Hyderabad (Telangana Today is left out: it is aligned with the BRS party)
  { id: "hindu-hyd", outlet: "The Hindu", url: "https://www.thehindu.com/news/cities/Hyderabad/feeder/default.rss", region: "hyderabad", section: "hyderabad", leaning: "centre-left" },
  { id: "hindu-telangana", outlet: "The Hindu", url: "https://www.thehindu.com/news/national/telangana/feeder/default.rss", region: "hyderabad", section: "hyderabad", leaning: "centre-left" },
  { id: "nie-hyderabad", outlet: "The New Indian Express", url: "https://www.newindianexpress.com/cities/hyderabad/rssfeed/", region: "hyderabad", section: "hyderabad", leaning: "centre" },
  { id: "southfirst-telangana", outlet: "South First", url: "https://thesouthfirst.com/category/telangana/feed/", region: "hyderabad", section: "hyderabad", leaning: "centre" },
  { id: "siasat", outlet: "Siasat", url: "https://www.siasat.com/feed/", region: "hyderabad", section: "hyderabad", leaning: "centre-left" },
  { id: "deccanchronicle", outlet: "Deccan Chronicle", url: "https://www.deccanchronicle.com/google_feeds.xml", region: "hyderabad", section: "hyderabad", leaning: "centre" },
  { id: "toi-hyderabad", outlet: "The Times of India", url: "https://timesofindia.indiatimes.com/rssfeeds/-2128816011.cms", region: "hyderabad", section: "hyderabad", leaning: "centre-right" },
  // Kochi (Onmanorama and Mathrubhumi sit on either side of each other, so they balance)
  { id: "hindu-kochi", outlet: "The Hindu", url: "https://www.thehindu.com/news/cities/Kochi/feeder/default.rss", region: "kochi", section: "kochi", leaning: "centre-left" },
  { id: "hindu-kerala", outlet: "The Hindu", url: "https://www.thehindu.com/news/national/kerala/feeder/default.rss", region: "kochi", section: "kochi", leaning: "centre-left" },
  { id: "nie-kochi", outlet: "The New Indian Express", url: "https://www.newindianexpress.com/cities/kochi/rssfeed/", region: "kochi", section: "kochi", leaning: "centre" },
  { id: "onmanorama", outlet: "Onmanorama", url: "https://www.onmanorama.com/kerala.feeds.onmrss.xml", region: "kochi", section: "kochi", leaning: "centre" },
  { id: "mathrubhumi", outlet: "Mathrubhumi English", url: "https://english.mathrubhumi.com/rss", region: "kochi", section: "kochi", leaning: "centre-left" },
  { id: "southfirst-kerala", outlet: "South First", url: "https://thesouthfirst.com/category/keralam/feed/", region: "kochi", section: "kochi", leaning: "centre" },
  // Kolkata (the thinnest city: The Telegraph refuses every reader, Indian Express posts again)
  { id: "hindu-kol", outlet: "The Hindu", url: "https://www.thehindu.com/news/cities/kolkata/feeder/default.rss", region: "kolkata", section: "kolkata", leaning: "centre-left" },
  { id: "hindu-wb", outlet: "The Hindu", url: "https://www.thehindu.com/news/national/west-bengal/feeder/default.rss", region: "kolkata", section: "kolkata", leaning: "centre-left" },
  { id: "ie-kolkata", outlet: "The Indian Express", url: "https://indianexpress.com/section/cities/kolkata/feed/", region: "kolkata", section: "kolkata", leaning: "centre-left" },
  { id: "ht-kolkata", outlet: "Hindustan Times", url: "https://www.hindustantimes.com/feeds/rss/cities/kolkata-news/rssfeed.xml", region: "kolkata", section: "kolkata", leaning: "centre" },
  { id: "toi-kolkata", outlet: "The Times of India", url: "https://timesofindia.indiatimes.com/rssfeeds/-2128830821.cms", region: "kolkata", section: "kolkata", leaning: "centre-right" },
  // Mumbai
  { id: "hindu-mum", outlet: "The Hindu", url: "https://www.thehindu.com/news/cities/Mumbai/feeder/default.rss", region: "mumbai", section: "mumbai", leaning: "centre-left" },
  { id: "ie-mumbai", outlet: "The Indian Express", url: "https://indianexpress.com/section/cities/mumbai/feed/", region: "mumbai", section: "mumbai", leaning: "centre-left" },
  { id: "ht-mumbai", outlet: "Hindustan Times", url: "https://www.hindustantimes.com/feeds/rss/cities/mumbai-news/rssfeed.xml", region: "mumbai", section: "mumbai", leaning: "centre" },
  { id: "midday", outlet: "Mid-Day", url: "https://www.mid-day.com/Resources/midday/rss/mumbai-news.xml", times: "ist", region: "mumbai", section: "mumbai", leaning: "centre" },
  { id: "fpj-mumbai", outlet: "Free Press Journal", url: "https://www.freepressjournal.in/stories.rss", path: /^\/mumbai\//, region: "mumbai", section: "mumbai", leaning: "centre" },
  { id: "toi-mumbai", outlet: "The Times of India", url: "https://timesofindia.indiatimes.com/rssfeeds/-2128838597.cms", region: "mumbai", section: "mumbai", leaning: "centre-right" },

  // ───────────── World ─────────────
  { id: "bbc-world", outlet: "BBC News", url: "https://feeds.bbci.co.uk/news/world/rss.xml", region: "world", section: "world", leaning: "centre-left" },
  { id: "bbc-top", outlet: "BBC News", url: "https://feeds.bbci.co.uk/news/rss.xml", region: "world", section: "general", leaning: "centre-left" },
  { id: "bbc-asia", outlet: "BBC News", url: "https://feeds.bbci.co.uk/news/world/asia/rss.xml", region: "world", section: "world", leaning: "centre-left" },
  { id: "aljazeera", outlet: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", region: "world", section: "world", leaning: "centre-left" },
  { id: "guardian-world", outlet: "The Guardian", url: "https://www.theguardian.com/world/rss", region: "world", section: "world", leaning: "left" },
  { id: "npr-world", outlet: "NPR", url: "https://feeds.npr.org/1004/rss.xml", region: "world", section: "world", leaning: "centre-left" },
  { id: "dw", outlet: "DW", url: "https://rss.dw.com/rdf/rss-en-all", region: "world", section: "world", leaning: "centre" },
  { id: "france24", outlet: "France 24", url: "https://www.france24.com/en/rss", region: "world", section: "world", leaning: "centre" },
  { id: "pti-world", outlet: "Press Trust of India", url: PTI, kind: "sitemap", path: /\/story\/international\//, region: "world", section: "world", leaning: "centre", fetchPages: false },
  { id: "nyt-asia", outlet: "The New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/AsiaPacific.xml", region: "world", section: "world", leaning: "centre-left" },
  { id: "diplomat-southasia", outlet: "The Diplomat", url: "https://thediplomat.com/regions/south-asia/feed/", region: "world", section: "world", leaning: "centre" },
  { id: "hindu-intl", outlet: "The Hindu", url: "https://www.thehindu.com/news/international/feeder/default.rss", region: "world", section: "world", leaning: "centre-left" },
  { id: "ie-world", outlet: "The Indian Express", url: "https://indianexpress.com/section/world/feed/", region: "world", section: "world", leaning: "centre-left" },
  { id: "nyt-world", outlet: "The New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", region: "world", section: "world", leaning: "centre-left" },
  { id: "fox-world", outlet: "Fox News", url: "https://moxie.foxnews.com/google-publisher/world.xml", region: "world", section: "world", leaning: "right" },
  { id: "fox-politics", outlet: "Fox News", url: "https://moxie.foxnews.com/google-publisher/politics.xml", region: "world", section: "world", leaning: "right" },
  { id: "nypost", outlet: "New York Post", url: "https://nypost.com/news/feed/", region: "world", section: "world", leaning: "right" },
  { id: "wsj-world", outlet: "The Wall Street Journal", url: "https://feeds.content.dowjones.io/public/rss/RSSWorldNews", region: "world", section: "world", leaning: "centre-right" },
  { id: "dailywire", outlet: "The Daily Wire", url: "https://www.dailywire.com/feeds/rss.xml", region: "world", section: "world", leaning: "right" },
  { id: "scmp", outlet: "South China Morning Post", url: "https://www.scmp.com/rss/91/feed", region: "world", section: "world", leaning: "centre" },
  { id: "abc-au", outlet: "ABC News (Australia)", url: "https://www.abc.net.au/news/feed/2942460/rss.xml", region: "world", section: "world", leaning: "centre-left" },

  // ───────────── Business (world) ─────────────
  { id: "bbc-business", outlet: "BBC News", url: "https://feeds.bbci.co.uk/news/business/rss.xml", region: "world", section: "business", leaning: "centre-left" },
  { id: "cnbc", outlet: "CNBC", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html", region: "world", section: "business", leaning: "centre" },
  { id: "guardian-business", outlet: "The Guardian", url: "https://www.theguardian.com/business/rss", region: "world", section: "business", leaning: "left" },
  { id: "wsj-markets", outlet: "The Wall Street Journal", url: "https://feeds.content.dowjones.io/public/rss/RSSMarketsMain", region: "world", section: "business", leaning: "centre-right" },

  // ───────────── Science / tech / health / environment ─────────────
  { id: "bbc-sci", outlet: "BBC News", url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", region: "world", section: "science", leaning: "centre-left" },
  { id: "bbc-tech", outlet: "BBC News", url: "https://feeds.bbci.co.uk/news/technology/rss.xml", region: "world", section: "tech", leaning: "centre-left" },
  { id: "bbc-health", outlet: "BBC News", url: "https://feeds.bbci.co.uk/news/health/rss.xml", region: "world", section: "health", leaning: "centre-left" },
  { id: "hindu-scitech", outlet: "The Hindu", url: "https://www.thehindu.com/sci-tech/feeder/default.rss", region: "india", section: "science", leaning: "centre-left" },
  { id: "ars", outlet: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", region: "world", section: "tech", leaning: "centre-left" },
  { id: "verge", outlet: "The Verge", url: "https://www.theverge.com/rss/index.xml", region: "world", section: "tech", leaning: "centre-left" },
  { id: "techcrunch", outlet: "TechCrunch", url: "https://techcrunch.com/feed/", region: "world", section: "tech", leaning: "centre" },
  { id: "guardian-sci", outlet: "The Guardian", url: "https://www.theguardian.com/science/rss", region: "world", section: "science", leaning: "left" },
  { id: "guardian-env", outlet: "The Guardian", url: "https://www.theguardian.com/environment/rss", region: "world", section: "environment", leaning: "left" },
  { id: "sciencedaily", outlet: "ScienceDaily", url: "https://www.sciencedaily.com/rss/top/science.xml", region: "world", section: "science", leaning: "centre" },
  { id: "phys", outlet: "Phys.org", url: "https://phys.org/rss-feed/", region: "world", section: "science", leaning: "centre" },
  { id: "sciencenews", outlet: "Science News", url: "https://www.sciencenews.org/feed", region: "world", section: "science", leaning: "centre" },
  { id: "nasa", outlet: "NASA", url: "https://www.nasa.gov/news-release/feed/", region: "world", section: "science", leaning: "centre" },
  { id: "quanta", outlet: "Quanta Magazine", url: "https://www.quantamagazine.org/feed/", region: "world", section: "science", leaning: "centre" },
  { id: "space", outlet: "Space.com", url: "https://www.space.com/feeds/all", region: "world", section: "science", leaning: "centre" },
  { id: "statnews", outlet: "STAT", url: "https://www.statnews.com/feed/", region: "world", section: "health", leaning: "centre" },
  { id: "mongabay-india", outlet: "Mongabay India", url: "https://india.mongabay.com/feed/", region: "india", section: "environment", leaning: "centre" },
  { id: "downtoearth", outlet: "Down To Earth", url: "https://www.downtoearth.org.in/news_sitemap.xml", kind: "sitemap", region: "india", section: "environment", leaning: "centre" },

  // ───────────── AI & software ─────────────
  { id: "verge-ai", outlet: "The Verge", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", region: "world", section: "ai", leaning: "centre-left" },
  { id: "techcrunch-ai", outlet: "TechCrunch", url: "https://techcrunch.com/category/artificial-intelligence/feed/", region: "world", section: "ai", leaning: "centre" },
  { id: "ars-ai", outlet: "Ars Technica", url: "https://arstechnica.com/ai/feed/", region: "world", section: "ai", leaning: "centre-left" },
  { id: "mittr-ai", outlet: "MIT Technology Review", url: "https://www.technologyreview.com/topic/artificial-intelligence/feed", region: "world", section: "ai", leaning: "centre" },
  { id: "willison", outlet: "Simon Willison’s Weblog", url: "https://simonwillison.net/atom/everything/", region: "world", section: "ai", leaning: "centre" },
  { id: "hf-blog", outlet: "Hugging Face", url: "https://huggingface.co/blog/feed.xml", region: "world", section: "ai", leaning: "centre" },
  { id: "openai-news", outlet: "OpenAI", url: "https://openai.com/news/rss.xml", region: "world", section: "ai", leaning: "centre" },
  { id: "google-ai", outlet: "Google", url: "https://blog.google/technology/ai/rss/", region: "world", section: "ai", leaning: "centre" },
  { id: "github-blog", outlet: "GitHub", url: "https://github.blog/feed/", region: "world", section: "ai", leaning: "centre" },

  // ───────────── Weather ─────────────

  // ───────────── Entertainment, music, fashion ─────────────
  { id: "variety", outlet: "Variety", url: "https://variety.com/feed/", region: "world", section: "entertainment", leaning: "centre" },
  { id: "thr", outlet: "The Hollywood Reporter", url: "https://www.hollywoodreporter.com/feed/", region: "world", section: "entertainment", leaning: "centre" },
  { id: "billboard", outlet: "Billboard", url: "https://www.billboard.com/feed/", region: "world", section: "entertainment", leaning: "centre" },
  { id: "rollingstone", outlet: "Rolling Stone", url: "https://www.rollingstone.com/feed/", region: "world", section: "entertainment", leaning: "centre-left" },
  { id: "pitchfork", outlet: "Pitchfork", url: "https://pitchfork.com/feed/feed-news/rss", region: "world", section: "entertainment", leaning: "centre" },
  { id: "vogue", outlet: "Vogue", url: "https://www.vogue.com/feed/rss", region: "world", section: "entertainment", leaning: "centre" },
  { id: "wwd", outlet: "WWD", url: "https://wwd.com/feed/", region: "world", section: "entertainment", leaning: "centre" },
  { id: "bh-news", outlet: "Bollywood Hungama", url: "https://www.bollywoodhungama.com/rss/news.xml", region: "india", section: "entertainment", leaning: "centre" },
  { id: "ht-ent", outlet: "Hindustan Times", url: "https://www.hindustantimes.com/feeds/rss/entertainment/rssfeed.xml", region: "india", section: "entertainment", leaning: "centre" },
  { id: "ie-ent", outlet: "The Indian Express", url: "https://indianexpress.com/section/entertainment/feed/", region: "india", section: "entertainment", leaning: "centre-left" },
  { id: "hindu-ent", outlet: "The Hindu", url: "https://www.thehindu.com/entertainment/feeder/default.rss", region: "india", section: "entertainment", leaning: "centre-left" },
  { id: "ndtv-ent", outlet: "NDTV", url: "https://feeds.feedburner.com/ndtvmovies-latest", region: "india", section: "entertainment", leaning: "centre" },
  { id: "pinkvilla", outlet: "Pinkvilla", url: "https://www.pinkvilla.com/rss.xml", region: "india", section: "entertainment", leaning: "centre" },
  { id: "filmfare", outlet: "Filmfare", url: "https://www.filmfare.com/feeds/feeds.xml", region: "india", section: "entertainment", leaning: "centre" },
  { id: "ht-fashion", outlet: "Hindustan Times", url: "https://www.hindustantimes.com/feeds/rss/lifestyle/fashion/rssfeed.xml", region: "india", section: "entertainment", leaning: "centre" },

  // ───────────── Sports ─────────────
  { id: "bbc-sport", outlet: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/rss.xml", region: "world", section: "sports", leaning: "centre" },
  { id: "sportstar", outlet: "Sportstar", url: "https://sportstar.thehindu.com/feeder/default.rss", region: "india", section: "sports", leaning: "centre" },
  { id: "cricinfo", outlet: "ESPNcricinfo", url: "https://www.espncricinfo.com/rss/content/story/feeds/0.xml", region: "world", section: "sports", leaning: "centre" },
  { id: "hindu-sport", outlet: "The Hindu", url: "https://www.thehindu.com/sport/feeder/default.rss", region: "india", section: "sports", leaning: "centre" },
  { id: "pti-sports", outlet: "Press Trust of India", url: PTI, kind: "sitemap", path: /\/story\/sports\//, region: "india", section: "sports", leaning: "centre", fetchPages: false },
  { id: "ie-sports", outlet: "The Indian Express", url: "https://indianexpress.com/section/sports/feed/", region: "india", section: "sports", leaning: "centre" },

  // ───────────── Search only: a library for finding other reports of a picked story ─────────────
  // Never shown to the editor (pipeline/coverage.ts). Paid press releases are filtered out.
  { id: "lib-bs", outlet: "Business Standard", url: "https://www.business-standard.com/sitemap/news-sitemap.xml", kind: "sitemap", path: /^\/(?!content\/press-releases)/, searchOnly: true, region: "india", section: "india", leaning: "centre" },
  { id: "lib-outlook", outlet: "Outlook", url: "https://www.outlookindia.com/oisitemap-news.xml", kind: "sitemap", path: /^\/(?!.*spotlight)/, searchOnly: true, region: "india", section: "india", leaning: "centre-left" },
  { id: "lib-dh", outlet: "Deccan Herald", url: "https://www.deccanherald.com/news_sitemap.xml", kind: "sitemap", searchOnly: true, region: "india", section: "india", leaning: "centre" },
  { id: "guardian-sport", outlet: "The Guardian", url: "https://www.theguardian.com/sport/rss", region: "world", section: "sports", leaning: "centre" },

];

const TIMES = "Bennett Coleman (Times group)";
const MURDOCH = "Murdoch family (News Corp, Fox Corporation)";
const PENSKE = "Penske Media";
const CONDE = "Condé Nast (Advance)";
const HINDU = "THG Publishing (The Hindu group)";

/**
 * Every outlet we read, by the name its feeds carry. Owners count as one outlet when the editor
 * checks how many independent outlets carry a story. Judgements for Indian outlets are from the
 * 2026-11-25 source review (docs/retro); world outlets follow AllSides where it rates them.
 */
export const OUTLETS: Record<string, OutletInfo> = {
  // Indian news
  "Press Trust of India": { owner: "Press Trust of India (newspapers' cooperative)", tier: "wire", leaning: "centre" },
  "United News of India": { owner: "United News of India", tier: "wire", leaning: "centre" },
  "The Hindu": { owner: HINDU, tier: "core", leaning: "centre-left" },
  Frontline: { owner: HINDU, tier: "core", leaning: "centre-left" },
  Sportstar: { owner: HINDU, tier: "core", leaning: "centre" },
  "The Indian Express": { owner: "Indian Express group", tier: "core", leaning: "centre-left" },
  "The New Indian Express": { owner: "Express Publications (Madurai)", tier: "core", leaning: "centre" },
  "Hindustan Times": { owner: "HT Media (Birla)", tier: "core", leaning: "centre" },
  Mint: { owner: "HT Media (Birla)", tier: "core", leaning: "centre" },
  "Business Standard": { owner: "Business Standard (Kotak)", tier: "core", leaning: "centre" },
  ThePrint: { owner: "ThePrint", tier: "core", leaning: "centre" },
  "The Wire": { owner: "Foundation for Independent Journalism", tier: "core", leaning: "left" },
  "The Quint": { owner: "Quintillion Media", tier: "core", leaning: "centre-left" },
  Scroll: { owner: "Scroll Media", tier: "core", leaning: "centre-left" },
  Newslaundry: { owner: "Newslaundry (reader-funded)", tier: "core", leaning: "centre-left" },
  "The News Minute": { owner: "The News Minute", tier: "core", leaning: "centre-left" },
  LiveLaw: { owner: "LiveLaw", tier: "core", leaning: "centre" },
  "Bar & Bench": { owner: "Bar & Bench", tier: "core", leaning: "centre" },
  "Alt News": { owner: "Pravda Media Foundation", tier: "core", leaning: "centre-left" },
  BOOM: { owner: "BOOM Live", tier: "core", leaning: "centre" },
  Factly: { owner: "Factly Media", tier: "core", leaning: "centre" },
  "Down To Earth": { owner: "Centre for Science and Environment (non-profit)", tier: "core", leaning: "centre" },
  "Mongabay India": { owner: "Mongabay (non-profit)", tier: "core", leaning: "centre" },
  "Reserve Bank of India": { owner: "Reserve Bank of India", tier: "primary", leaning: "centre" },
  "Deccan Herald": { owner: "The Printers (Mysore)", tier: "core", leaning: "centre" },
  "South First": { owner: "South First", tier: "core", leaning: "centre" },
  "Citizen Matters": { owner: "Oorvani Foundation (non-profit)", tier: "core", leaning: "centre" },
  "DT Next": { owner: "Daily Thanthi group", tier: "core", leaning: "centre" },
  Onmanorama: { owner: "Malayala Manorama", tier: "core", leaning: "centre" },
  "Mathrubhumi English": { owner: "Mathrubhumi", tier: "core", leaning: "centre-left" },
  "Mid-Day": { owner: "Jagran Prakashan", tier: "core", leaning: "centre" },
  "Free Press Journal": { owner: "Free Press Journal", tier: "core", leaning: "centre" },
  // Corroboration only: paid-content and equity-for-ads business, owner conflicts, partisan framing.
  "The Times of India": { owner: TIMES, tier: "corroborate", leaning: "centre-right" },
  "The Economic Times": { owner: TIMES, tier: "corroborate", leaning: "centre-right" },
  Filmfare: { owner: TIMES, tier: "corroborate", leaning: "centre" },
  NDTV: { owner: "Adani group (AMG Media)", tier: "corroborate", leaning: "centre-right" },
  News18: { owner: "Reliance (Network18)", tier: "corroborate", leaning: "right" },
  Siasat: { owner: "Siasat", tier: "corroborate", leaning: "centre-left" },
  "Deccan Chronicle": { owner: "Deccan Chronicle Holdings", tier: "corroborate", leaning: "centre" },
  Pinkvilla: { owner: "Pinkvilla", tier: "corroborate", leaning: "centre" },
  "Bollywood Hungama": { owner: "Bollywood Hungama", tier: "core", leaning: "centre" },
  // Found through the coverage search only (pipeline/coverage.ts).
  "India Today": { owner: "Living Media (India Today group)", tier: "core", leaning: "centre" },
  "The Tribune": { owner: "The Tribune Trust", tier: "core", leaning: "centre" },
  Outlook: { owner: "Outlook Publishing (Rajan Raheja)", tier: "core", leaning: "centre-left" },
  // World
  "BBC News": { owner: "BBC", tier: "core", leaning: "centre-left" },
  "BBC Sport": { owner: "BBC", tier: "core", leaning: "centre" },
  "Al Jazeera": { owner: "Al Jazeera Media Network (Qatar)", tier: "core", leaning: "centre-left" },
  "The Guardian": { owner: "Guardian Media Group (Scott Trust)", tier: "core", leaning: "left" },
  NPR: { owner: "NPR", tier: "core", leaning: "centre-left" },
  DW: { owner: "Deutsche Welle (German public broadcaster)", tier: "core", leaning: "centre" },
  "France 24": { owner: "France Médias Monde (French state)", tier: "core", leaning: "centre" },
  "The New York Times": { owner: "The New York Times Company", tier: "core", leaning: "centre-left" },
  "The Wall Street Journal": { owner: MURDOCH, tier: "core", leaning: "centre-right" },
  "Fox News": { owner: MURDOCH, tier: "corroborate", leaning: "right" },
  "New York Post": { owner: MURDOCH, tier: "corroborate", leaning: "right" },
  "The Daily Wire": { owner: "The Daily Wire", tier: "perspective", leaning: "right" },
  "South China Morning Post": { owner: "Alibaba", tier: "core", leaning: "centre" },
  "ABC News (Australia)": { owner: "Australian Broadcasting Corporation", tier: "core", leaning: "centre-left" },
  "The Diplomat": { owner: "Diplomat Media", tier: "core", leaning: "centre" },
  CNBC: { owner: "Comcast (NBCUniversal)", tier: "core", leaning: "centre" },
  CNA: { owner: "Mediacorp (Singapore state)", tier: "core", leaning: "centre" },
  Dawn: { owner: "Dawn Media Group", tier: "core", leaning: "centre-left" },
  "The Daily Star (Bangladesh)": { owner: "Mediaworld", tier: "core", leaning: "centre" },
  "The Kathmandu Post": { owner: "Kantipur Media Group", tier: "core", leaning: "centre" },
  "The Independent": { owner: "Independent Digital News & Media", tier: "core", leaning: "centre-left" },
  "The Japan Times": { owner: "The Japan Times", tier: "core", leaning: "centre" },
  "The Straits Times": { owner: "SPH Media Trust", tier: "core", leaning: "centre" },
  // Science, technology, AI
  "Ars Technica": { owner: CONDE, tier: "core", leaning: "centre-left" },
  "The Verge": { owner: "Vox Media", tier: "core", leaning: "centre-left" },
  TechCrunch: { owner: "Yahoo", tier: "core", leaning: "centre" },
  ScienceDaily: { owner: "ScienceDaily", tier: "core", leaning: "centre" },
  "Phys.org": { owner: "Science X", tier: "core", leaning: "centre" },
  "Science News": { owner: "Society for Science (non-profit)", tier: "core", leaning: "centre" },
  NASA: { owner: "NASA", tier: "primary", leaning: "centre" },
  "Quanta Magazine": { owner: "Simons Foundation", tier: "core", leaning: "centre" },
  "Space.com": { owner: "Future plc", tier: "core", leaning: "centre" },
  STAT: { owner: "Boston Globe Media", tier: "core", leaning: "centre" },
  "MIT Technology Review": { owner: "MIT", tier: "core", leaning: "centre" },
  "Simon Willison’s Weblog": { owner: "Simon Willison", tier: "core", leaning: "centre" },
  "Hugging Face": { owner: "Hugging Face", tier: "primary", leaning: "centre" },
  OpenAI: { owner: "OpenAI", tier: "primary", leaning: "centre" },
  Google: { owner: "Alphabet", tier: "primary", leaning: "centre" },
  GitHub: { owner: "Microsoft", tier: "primary", leaning: "centre" },
  // Entertainment and sport
  Variety: { owner: PENSKE, tier: "core", leaning: "centre" },
  "The Hollywood Reporter": { owner: PENSKE, tier: "core", leaning: "centre" },
  Billboard: { owner: PENSKE, tier: "core", leaning: "centre" },
  "Rolling Stone": { owner: PENSKE, tier: "core", leaning: "centre-left" },
  WWD: { owner: PENSKE, tier: "core", leaning: "centre" },
  Pitchfork: { owner: CONDE, tier: "core", leaning: "centre" },
  Vogue: { owner: CONDE, tier: "core", leaning: "centre" },
  ESPNcricinfo: { owner: "Disney (ESPN)", tier: "core", leaning: "centre" },
};

// Names that appear in older editions (from the retired Google News feeds) or that other outlets
// share. "The Telegraph" in an Indian edition is the Kolkata paper, not the British one.
const OTHER_LEANINGS: Record<string, Leaning> = {
  Reuters: "centre", "AP News": "centre", "Associated Press": "centre", "Financial Times": "centre",
  Bloomberg: "centre", "The Economist": "centre", "CNN": "centre-left", "The Washington Post": "centre-left",
  "Times Now": "right", "Republic World": "right", "OpIndia": "right", "Zee News": "right",
  "Moneycontrol": "centre", "Business Today": "centre", "The Tribune": "centre", "The Statesman": "centre",
  "DNA India": "centre-right", "WION": "centre-right", "Swarajya": "right", "Organiser": "right",
  Firstpost: "centre-right", "The Telegraph": "centre-left", "The Telegraph India": "centre-left",
  "The Telegraph (UK)": "centre-right", BBC: "centre-left", Cricbuzz: "centre",
};

const ALIASES: Record<string, string> = {
  "TheWire.in": "The Wire", "Scroll.in": "Scroll", "Moneycontrol.com": "Moneycontrol", Livemint: "Mint", mint: "Mint",
  "NDTV Sports": "NDTV", UNI: "United News of India", "India Today NE": "India Today", "Mongabay-India": "Mongabay India", "PTI": "Press Trust of India",
};

export function canonicalOutlet(name: string): string {
  const n = name.trim();
  if (OUTLETS[n]) return n; // "Phys.org" and "Space.com" are names, not web addresses
  return ALIASES[n] ?? n.replace(/\.(com|in|co\.uk|org)$/i, "");
}

export function outletInfo(outlet: string): OutletInfo | undefined {
  return OUTLETS[canonicalOutlet(outlet)];
}

export function leaningFor(outlet: string): Leaning | undefined {
  const o = canonicalOutlet(outlet);
  return OUTLETS[o]?.leaning ?? OTHER_LEANINGS[o];
}

/** Image hosts that refuse pictures embedded on other sites (checked in a real browser). */
export const HOTLINK_BLOCKED_HOSTS = new Set(["c.ndtvimg.com"]);
