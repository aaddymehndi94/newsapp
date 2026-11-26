// The edition data contract (docs/superpowers/specs/2026-11-24-meridian-design.md).
// Type-only module: safe under Node's type stripping.

export type SectionId =
  | "india"
  | "world"
  | "business"
  | "science-tech"
  | "sports"
  | "health-environment"
  | "bengaluru"
  | "chennai"
  | "delhi"
  | "hyderabad"
  | "kochi"
  | "kolkata"
  | "mumbai"
  | "weather"
  | "markets"
  | "ai-software"
  | "entertainment";

export type Leaning = "left" | "centre-left" | "centre" | "centre-right" | "right";

export interface StoryImage {
  url: string;
  credit: string;
  sourceUrl: string;
  alt: string;
  width?: number;
  height?: number;
  kind: "outlet" | "wikimedia";
}

export interface StoryVideo {
  youtubeId: string;
  title: string;
  channel: string;
}

export interface StorySource {
  outlet: string;
  title: string;
  url: string;
  leaning?: Leaning;
}

export interface Perspective {
  label: string;
  summary: string;
  outlets: string[];
}

export interface Story {
  id: string;
  section: SectionId;
  rank: number;
  headline: string;
  dek: string;
  summary: string;
  body: string[];
  keyFacts: string[];
  background?: string;
  whyItMatters?: string;
  perspectives?: Perspective[];
  dateline?: string;
  developing?: boolean;
  image?: StoryImage;
  video?: StoryVideo;
  sources: StorySource[];
  tags: string[];
  readingMinutes: number;
}

export interface EditionSection {
  id: SectionId;
  name: string;
  storyIds: string[];
}

export interface Edition {
  id: string;
  date: string;
  slot: "morning" | "evening";
  publishedAt: string;
  lead: string[];
  sections: EditionSection[];
  stories: Story[];
  stats: { feedsScanned: number; itemsSeen: number; pagesRead: number; costUsd: number; feedsTried?: number; feedsFailed?: string[]; windowHours?: number; coverageAdded?: Record<string, string[]> };
  /** Data panels (weather, markets, tech lists, charts) shown inside their sections. */
  panels?: Panels;
  /** Fixtures only (not part of the pipeline contract): marks invented sample content. */
  fixture?: boolean;
}

// ───────────── data panels ─────────────
// Facts fetched from data services at edition time (not written by the model, except the
// one-line "what it is" notes on tech items). Each panel is optional and renders inside the
// section named in PANEL_SECTION.

export interface DayForecast {
  date: string;
  max: number;
  min: number;
  /** WMO weather code (Open-Meteo). */
  code: number;
  rainChance: number;
}

export interface WeatherCity {
  name: string;
  lat: number;
  lon: number;
  today: DayForecast;
  tomorrow?: DayForecast;
  /** CPCB-style AQI estimated from modelled PM2.5 / PM10 (24 h means). */
  aqi?: { value: number; category: string; pm25: number; pm10: number };
}

export interface SatelliteImage {
  url: string;
  width: number;
  height: number;
  /** ISO time of the satellite scan. */
  time: string;
  /** [south, west, north, east] in degrees; the image is a plain lat/lon grid. */
  bbox: [number, number, number, number];
  credit: string;
}

export interface WeatherPanel {
  fetchedAt: string;
  cities: WeatherCity[];
  satellite?: SatelliteImage;
}

export interface MarketPoint {
  date: string;
  value: number;
}

export interface MarketQuote {
  id: string;
  name: string;
  /** "₹", "$" or "" — shown before the value. */
  unit: string;
  /** Shown after the value, e.g. "per 10 g". */
  per?: string;
  decimals: number;
  value: number;
  change: number;
  changePct: number;
  /** Date (YYYY-MM-DD) the value is for. */
  asOf: string;
  history: MarketPoint[];
  source: string;
}

export interface MarketsPanel {
  fetchedAt: string;
  quotes: MarketQuote[];
}

export interface RepoItem {
  name: string;
  url: string;
  stars: number;
  /** Average stars a day since it was created. */
  perDay?: number;
  language?: string;
  createdAt: string;
  what: string;
}

export interface ModelItem {
  name: string;
  url: string;
  likes: number;
  downloads: number;
  task?: string;
  what: string;
}

export interface ToolItem {
  name: string;
  url: string;
  discussionUrl: string;
  points: number;
  comments: number;
  what: string;
}

export interface TechPanel {
  fetchedAt: string;
  repos: RepoItem[];
  models: ModelItem[];
  tools: ToolItem[];
}

export interface ChartSong {
  rank: number;
  title: string;
  artist: string;
  url: string;
  artwork?: string;
}

export interface Movie {
  /** YouTube video ID of the trailer. */
  trailer?: string;
  title: string;
  date: string;
  url: string;
  poster?: string;
  language?: string;
}

export interface CulturePanel {
  fetchedAt: string;
  charts: { id: string; name: string; songs: ChartSong[] }[];
  nowShowing?: Movie[];
  comingSoon?: Movie[];
}

export interface Panels {
  weather?: WeatherPanel;
  markets?: MarketsPanel;
  tech?: TechPanel;
  culture?: CulturePanel;
}
