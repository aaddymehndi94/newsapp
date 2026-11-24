// Curated news sources. Leaning labels are rough editorial-stance guides (AllSides /
// Media Bias ratings where they exist, common perception for Indian outlets). They are
// used to make sure the editor sees — and the reader is shown — coverage from across
// the spectrum. They are not a judgement of accuracy.

export type Leaning = "left" | "centre-left" | "centre" | "centre-right" | "right";
export type Region = "india" | "world" | "bengaluru";
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
  | "bengaluru"
  | "ai"
  | "weather"
  | "entertainment";

export interface Source {
  id: string;
  outlet: string;
  url: string;
  region: Region;
  section: SectionHint;
  leaning: Leaning;
  /** "gnews" = Google News RSS (links are redirects; headline-only), "reddit" = trend signal only */
  kind?: "rss" | "gnews" | "reddit";
  /** Try to fetch article pages for og:image + text (default true for rss). */
  fetchPages?: boolean;
}

const gnews = (q: string) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-IN&gl=IN&ceid=IN:en`;

export const SOURCES: Source[] = [
  // ───────────── India — general / national ─────────────
  { id: "hindu-national", outlet: "The Hindu", url: "https://www.thehindu.com/news/national/feeder/default.rss", region: "india", section: "india", leaning: "centre-left" },
  { id: "ie-india", outlet: "The Indian Express", url: "https://indianexpress.com/section/india/feed/", region: "india", section: "india", leaning: "centre-left" },
  { id: "ht-india", outlet: "Hindustan Times", url: "https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml", region: "india", section: "india", leaning: "centre" },
  { id: "toi-india", outlet: "The Times of India", url: "https://timesofindia.indiatimes.com/rssfeeds/-2128936835.cms", region: "india", section: "india", leaning: "centre-right" },
  { id: "ndtv-india", outlet: "NDTV", url: "https://feeds.feedburner.com/ndtvnews-india-news", region: "india", section: "india", leaning: "centre" },
  { id: "ndtv-top", outlet: "NDTV", url: "https://feeds.feedburner.com/ndtvnews-top-stories", region: "india", section: "general", leaning: "centre" },
  { id: "scroll", outlet: "Scroll", url: "https://feeds.feedburner.com/ScrollinArticles.rss", region: "india", section: "india", leaning: "left" },
  { id: "news18-india", outlet: "News18", url: "https://www.news18.com/commonfeeds/v1/eng/rss/india.xml", region: "india", section: "india", leaning: "right" },
  { id: "firstpost-india", outlet: "Firstpost", url: "https://www.firstpost.com/commonfeeds/v1/mfp/rss/india.xml", region: "india", section: "india", leaning: "centre-right" },
  { id: "organiser", outlet: "Organiser", url: "https://organiser.org/feed/", region: "india", section: "india", leaning: "right" },
  // Outlets whose own feeds are unavailable to us: headlines via Google News only (no page fetch).
  { id: "gn-theprint", outlet: "ThePrint", url: gnews("site:theprint.in when:1d"), region: "india", section: "india", leaning: "centre", kind: "gnews" },
  { id: "gn-thewire", outlet: "The Wire", url: gnews("site:thewire.in when:1d"), region: "india", section: "india", leaning: "left", kind: "gnews" },
  { id: "gn-quint", outlet: "The Quint", url: gnews("site:thequint.com when:1d"), region: "india", section: "india", leaning: "left", kind: "gnews" },
  { id: "gn-swarajya", outlet: "Swarajya", url: gnews("site:swarajyamag.com when:2d"), region: "india", section: "india", leaning: "right", kind: "gnews" },
  // What Google News India is leading with (importance signal).
  { id: "gn-india-top", outlet: "Google News India", url: "https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en", region: "india", section: "general", leaning: "centre", kind: "gnews" },
  { id: "gn-nation", outlet: "Google News India", url: "https://news.google.com/rss/headlines/section/topic/NATION?hl=en-IN&gl=IN&ceid=IN:en", region: "india", section: "india", leaning: "centre", kind: "gnews" },
  { id: "gnews-pti", outlet: "PTI (via Google News)", url: gnews("PTI when:1d"), region: "india", section: "india", leaning: "centre", kind: "gnews" },

  // ───────────── India — business ─────────────
  { id: "mint", outlet: "Mint", url: "https://www.livemint.com/rss/news", region: "india", section: "business", leaning: "centre" },
  { id: "mint-markets", outlet: "Mint", url: "https://www.livemint.com/rss/markets", region: "india", section: "business", leaning: "centre" },
  { id: "et-top", outlet: "The Economic Times", url: "https://economictimes.indiatimes.com/rssfeedstopstories.cms", region: "india", section: "business", leaning: "centre-right" },
  { id: "bs-latest", outlet: "Business Standard", url: "https://www.business-standard.com/rss/latest.rss", region: "india", section: "business", leaning: "centre" },
  { id: "hindu-business", outlet: "The Hindu", url: "https://www.thehindu.com/business/feeder/default.rss", region: "india", section: "business", leaning: "centre-left" },

  // ───────────── Bengaluru ─────────────
  { id: "hindu-blr", outlet: "The Hindu", url: "https://www.thehindu.com/news/cities/bangalore/feeder/default.rss", region: "bengaluru", section: "bengaluru", leaning: "centre-left" },
  { id: "toi-blr", outlet: "The Times of India", url: "https://timesofindia.indiatimes.com/rssfeeds/-2128833038.cms", region: "bengaluru", section: "bengaluru", leaning: "centre-right" },
  { id: "ie-bangalore", outlet: "The Indian Express", url: "https://indianexpress.com/section/cities/bangalore/feed/", region: "bengaluru", section: "bengaluru", leaning: "centre-left" },
  { id: "ht-bengaluru", outlet: "Hindustan Times", url: "https://www.hindustantimes.com/feeds/rss/cities/bengaluru-news/rssfeed.xml", region: "bengaluru", section: "bengaluru", leaning: "centre" },
  { id: "hindu-karnataka", outlet: "The Hindu", url: "https://www.thehindu.com/news/national/karnataka/feeder/default.rss", region: "bengaluru", section: "bengaluru", leaning: "centre-left" },

  { id: "gn-dh-blr", outlet: "Deccan Herald", url: gnews("site:deccanherald.com bengaluru when:1d"), region: "bengaluru", section: "bengaluru", leaning: "centre", kind: "gnews" },

  // ───────────── World ─────────────
  { id: "bbc-world", outlet: "BBC News", url: "https://feeds.bbci.co.uk/news/world/rss.xml", region: "world", section: "world", leaning: "centre-left" },
  { id: "bbc-top", outlet: "BBC News", url: "https://feeds.bbci.co.uk/news/rss.xml", region: "world", section: "general", leaning: "centre-left" },
  { id: "bbc-asia", outlet: "BBC News", url: "https://feeds.bbci.co.uk/news/world/asia/rss.xml", region: "world", section: "world", leaning: "centre-left" },
  { id: "aljazeera", outlet: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", region: "world", section: "world", leaning: "centre-left" },
  { id: "guardian-world", outlet: "The Guardian", url: "https://www.theguardian.com/world/rss", region: "world", section: "world", leaning: "left" },
  { id: "npr-world", outlet: "NPR", url: "https://feeds.npr.org/1004/rss.xml", region: "world", section: "world", leaning: "centre-left" },
  { id: "dw", outlet: "DW", url: "https://rss.dw.com/rdf/rss-en-all", region: "world", section: "world", leaning: "centre" },
  { id: "france24", outlet: "France 24", url: "https://www.france24.com/en/rss", region: "world", section: "world", leaning: "centre" },
  { id: "hindu-intl", outlet: "The Hindu", url: "https://www.thehindu.com/news/international/feeder/default.rss", region: "world", section: "world", leaning: "centre-left" },
  { id: "ie-world", outlet: "The Indian Express", url: "https://indianexpress.com/section/world/feed/", region: "world", section: "world", leaning: "centre-left" },
  { id: "nyt-world", outlet: "The New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", region: "world", section: "world", leaning: "centre-left" },
  { id: "fox-world", outlet: "Fox News", url: "https://moxie.foxnews.com/google-publisher/world.xml", region: "world", section: "world", leaning: "right" },
  { id: "fox-politics", outlet: "Fox News", url: "https://moxie.foxnews.com/google-publisher/politics.xml", region: "world", section: "world", leaning: "right" },
  { id: "nypost", outlet: "New York Post", url: "https://nypost.com/news/feed/", region: "world", section: "world", leaning: "right" },
  { id: "gn-telegraph", outlet: "The Telegraph", url: gnews("site:telegraph.co.uk world when:1d"), region: "world", section: "world", leaning: "centre-right", kind: "gnews" },
  { id: "wsj-world", outlet: "The Wall Street Journal", url: "https://feeds.content.dowjones.io/public/rss/RSSWorldNews", region: "world", section: "world", leaning: "centre-right" },
  { id: "dailywire", outlet: "The Daily Wire", url: "https://www.dailywire.com/feeds/rss.xml", region: "world", section: "world", leaning: "right" },
  { id: "cna", outlet: "CNA", url: "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml", region: "world", section: "world", leaning: "centre" },
  { id: "scmp", outlet: "South China Morning Post", url: "https://www.scmp.com/rss/91/feed", region: "world", section: "world", leaning: "centre" },
  { id: "abc-au", outlet: "ABC News (Australia)", url: "https://www.abc.net.au/news/feed/2942460/rss.xml", region: "world", section: "world", leaning: "centre-left" },
  { id: "gnews-reuters", outlet: "Reuters (via Google News)", url: gnews("site:reuters.com when:1d"), region: "world", section: "world", leaning: "centre", kind: "gnews" },
  { id: "gnews-ap", outlet: "AP (via Google News)", url: gnews("site:apnews.com when:1d"), region: "world", section: "world", leaning: "centre", kind: "gnews" },
  { id: "gnews-world-top", outlet: "Google News — World", url: "https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-IN&gl=IN&ceid=IN:en", region: "world", section: "world", leaning: "centre", kind: "gnews" },

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

  // ───────────── AI & software ─────────────
  { id: "verge-ai", outlet: "The Verge", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", region: "world", section: "ai", leaning: "centre-left" },
  { id: "techcrunch-ai", outlet: "TechCrunch", url: "https://techcrunch.com/category/artificial-intelligence/feed/", region: "world", section: "ai", leaning: "centre" },
  { id: "ars-ai", outlet: "Ars Technica", url: "https://arstechnica.com/ai/feed/", region: "world", section: "ai", leaning: "centre-left" },
  { id: "mittr-ai", outlet: "MIT Technology Review", url: "https://www.technologyreview.com/topic/artificial-intelligence/feed", region: "world", section: "ai", leaning: "centre" },
  { id: "register-ai", outlet: "The Register", url: "https://www.theregister.com/software/ai_ml/headlines.atom", region: "world", section: "ai", leaning: "centre" },
  { id: "willison", outlet: "Simon Willison’s Weblog", url: "https://simonwillison.net/atom/everything/", region: "world", section: "ai", leaning: "centre" },
  { id: "hf-blog", outlet: "Hugging Face", url: "https://huggingface.co/blog/feed.xml", region: "world", section: "ai", leaning: "centre" },
  { id: "openai-news", outlet: "OpenAI", url: "https://openai.com/news/rss.xml", region: "world", section: "ai", leaning: "centre" },
  { id: "google-ai", outlet: "Google", url: "https://blog.google/technology/ai/rss/", region: "world", section: "ai", leaning: "centre" },
  { id: "github-blog", outlet: "GitHub", url: "https://github.blog/feed/", region: "world", section: "ai", leaning: "centre" },
  { id: "gn-ai", outlet: "Google News — AI", url: gnews('(AI OR "artificial intelligence" OR OpenAI OR Anthropic OR Gemini OR LLM) when:1d'), region: "world", section: "ai", leaning: "centre", kind: "gnews" },
  { id: "gn-ai-india", outlet: "Google News — AI in India", url: gnews('(AI OR "artificial intelligence" OR IndiaAI) India when:1d'), region: "india", section: "ai", leaning: "centre", kind: "gnews" },

  // ───────────── Weather ─────────────
  { id: "gn-weather-india", outlet: "Google News — Weather (India)", url: gnews('(IMD OR monsoon OR cyclone OR heatwave OR "cold wave" OR fog OR "heavy rain") India when:1d'), region: "india", section: "weather", leaning: "centre", kind: "gnews" },
  { id: "gn-weather-world", outlet: "Google News — Weather (world)", url: gnews('(hurricane OR typhoon OR cyclone OR "extreme weather" OR blizzard OR floods OR heatwave) when:1d'), region: "world", section: "weather", leaning: "centre", kind: "gnews" },

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
  { id: "ie-sports", outlet: "The Indian Express", url: "https://indianexpress.com/section/sports/feed/", region: "india", section: "sports", leaning: "centre" },
  { id: "guardian-sport", outlet: "The Guardian", url: "https://www.theguardian.com/sport/rss", region: "world", section: "sports", leaning: "centre" },

];

// Outlets that reach us via Google News under their own names. Leaning per AllSides /
// common perception; unknown outlets fall back to the feed's own label.
const EXTRA_LEANINGS: Record<string, Leaning> = {
  Reuters: "centre", "AP News": "centre", "Associated Press": "centre", "Financial Times": "centre",
  Bloomberg: "centre", "The Economist": "centre", "CNN": "centre-left", "The Washington Post": "centre-left",
  "Times Now": "right", "Republic World": "right", "OpIndia": "right", "Zee News": "right", "News18": "right",
  "Moneycontrol": "centre", "Business Today": "centre", "Livemint": "centre", "Mint": "centre",
  "Deccan Chronicle": "centre", "The New Indian Express": "centre", "The Tribune": "centre",
  "The Statesman": "centre", "DNA India": "centre-right", "WION": "centre-right", "Free Press Journal": "centre",
  "The Wire": "left", "Scroll": "left", "The Quint": "left", "Newslaundry": "left", "ThePrint": "centre",
  "Swarajya": "right", "Organiser": "right", "The Telegraph": "centre-right", "The Telegraph India": "centre-left",
  "Al Jazeera": "centre-left", "BBC": "centre-left", "Cricbuzz": "centre", "Sportstar": "centre",
};

const ALIASES: Record<string, string> = {
  "TheWire.in": "The Wire", "The Wire": "The Wire", "Scroll.in": "Scroll", "The Quint": "The Quint",
  "Moneycontrol.com": "Moneycontrol", "Livemint": "Mint", "mint": "Mint", "AP News": "AP News",
  "Business Standard": "Business Standard", "The Hindu BusinessLine": "The Hindu BusinessLine",
  "NDTV Sports": "NDTV", "India Today NE": "India Today", "Hindustan Times": "Hindustan Times",
};

export function canonicalOutlet(name: string): string {
  const n = name.trim();
  return ALIASES[n] ?? n.replace(/\.(com|in|co\.uk|org)$/i, "");
}

const SOURCE_LEANINGS = new Map<string, Leaning>();
// First (main news) feed of an outlet defines its leaning; section feeds like sport may be labelled differently.
for (const s of SOURCES) if ((!s.kind || s.kind === "rss") && !SOURCE_LEANINGS.has(s.outlet)) SOURCE_LEANINGS.set(s.outlet, s.leaning);

export function leaningFor(outlet: string): Leaning | undefined {
  const o = canonicalOutlet(outlet);
  return SOURCE_LEANINGS.get(o) ?? EXTRA_LEANINGS[o];
}

/** Image hosts that refuse pictures embedded on other sites (checked in a real browser). */
export const HOTLINK_BLOCKED_HOSTS = new Set(["c.ndtvimg.com"]);
