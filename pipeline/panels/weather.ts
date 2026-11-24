// Weather panel: today's and tomorrow's forecast for eight Indian cities, an air-quality
// estimate, and a pinned infrared satellite image of the subcontinent.
//   Forecasts and air quality: Open-Meteo (CC BY 4.0; air quality is the CAMS model).
//   Satellite: EUMETSAT Meteosat IODC, 10.8 µm infrared, via its public WMS (© EUMETSAT).
import type { DayForecast, SatelliteImage, WeatherCity, WeatherPanel } from "../../site/types.ts";
import { fetchText, log } from "../util.ts";

export const CITIES: { name: string; lat: number; lon: number }[] = [
  { name: "Bengaluru", lat: 12.9716, lon: 77.5946 },
  { name: "Delhi", lat: 28.6139, lon: 77.209 },
  { name: "Mumbai", lat: 19.076, lon: 72.8777 },
  { name: "Chennai", lat: 13.0827, lon: 80.2707 },
  { name: "Kolkata", lat: 22.5726, lon: 88.3639 },
  { name: "Hyderabad", lat: 17.385, lon: 78.4867 },
  { name: "Pune", lat: 18.5204, lon: 73.8567 },
  { name: "Kochi", lat: 9.9312, lon: 76.2673 },
];

/** [south, west, north, east]: India and its seas. */
export const SAT_BBOX: [number, number, number, number] = [6, 66, 37, 98];
const SAT_W = 800;
const SAT_H = Math.round((SAT_W * (SAT_BBOX[2] - SAT_BBOX[0])) / (SAT_BBOX[3] - SAT_BBOX[1]));
const WMS = "https://view.eumetsat.int/geoserver/ows";
const SAT_LAYER = "msg_iodc:ir108";

// CPCB National AQI breakpoints (24-hour means, µg/m³) → index bands.
const BANDS = [
  { cat: "Good", lo: 0, hi: 50 },
  { cat: "Satisfactory", lo: 51, hi: 100 },
  { cat: "Moderate", lo: 101, hi: 200 },
  { cat: "Poor", lo: 201, hi: 300 },
  { cat: "Very poor", lo: 301, hi: 400 },
  { cat: "Severe", lo: 401, hi: 500 },
];
const PM25 = [0, 30, 60, 90, 120, 250, 380];
const PM10 = [0, 50, 100, 250, 350, 430, 510];

function subIndex(c: number, bp: number[]): number {
  // Linear within each band: concentration [bp[i], bp[i+1]] → index [lo, hi] of band i.
  for (let i = 0; i < BANDS.length; i++) {
    const lo = bp[i];
    const hi = bp[i + 1];
    if (c <= hi || i === BANDS.length - 1) {
      const t = Math.min(1, Math.max(0, (c - lo) / (hi - lo)));
      return Math.round(BANDS[i].lo + t * (BANDS[i].hi - BANDS[i].lo));
    }
  }
  return 500;
}

/** India's AQI from 24-hour PM2.5 and PM10 means: the worse of the two sub-indices. */
export function cpcbAqi(pm25: number, pm10: number): { value: number; category: string } {
  const value = Math.max(subIndex(pm25, PM25), subIndex(pm10, PM10));
  const band = BANDS.find((b) => value <= b.hi) ?? BANDS[BANDS.length - 1];
  return { value, category: band.cat };
}

interface ForecastJson {
  daily?: {
    time: string[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
    precipitation_probability_max: (number | null)[];
    weather_code: (number | null)[];
  };
}
interface AirJson {
  hourly?: { time: string[]; pm2_5: (number | null)[]; pm10: (number | null)[] };
}

function day(d: NonNullable<ForecastJson["daily"]>, i: number): DayForecast | undefined {
  const max = d.temperature_2m_max[i];
  const min = d.temperature_2m_min[i];
  const code = d.weather_code[i];
  if (max == null || min == null || code == null) return undefined;
  return { date: d.time[i], max: Math.round(max), min: Math.round(min), code, rainChance: Math.round(d.precipitation_probability_max[i] ?? 0) };
}

/** Mean of the last 24 hourly values at or before `nowIso` (IST local time strings). */
export function last24Mean(times: string[], values: (number | null)[], nowLocal: string): number | undefined {
  const upto = times.findLastIndex((t) => t <= nowLocal);
  if (upto < 0) return undefined;
  const xs = values.slice(Math.max(0, upto - 23), upto + 1).filter((v): v is number => typeof v === "number");
  if (xs.length < 12) return undefined;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

async function getJson<T>(url: string): Promise<T> {
  const r = await fetchText(url, { accept: "application/json", timeoutMs: 30_000 });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return JSON.parse(r.text) as T;
}

async function forecasts(): Promise<WeatherCity[]> {
  const lat = CITIES.map((c) => c.lat).join(",");
  const lon = CITIES.map((c) => c.lon).join(",");
  const [fc, air] = await Promise.all([
    getJson<ForecastJson[]>(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=Asia%2FKolkata&forecast_days=2`,
    ),
    getJson<AirJson[]>(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=pm2_5,pm10&past_days=1&forecast_days=1&timezone=Asia%2FKolkata`,
    ).catch((e) => {
      log(`weather: air quality failed: ${(e as Error).message}`);
      return [] as AirJson[];
    }),
  ]);
  const nowLocal = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 16);
  const out: WeatherCity[] = [];
  CITIES.forEach((c, i) => {
    const d = fc[i]?.daily;
    const today = d && day(d, 0);
    if (!d || !today) return;
    const city: WeatherCity = { ...c, today, tomorrow: day(d, 1) };
    const h = air[i]?.hourly;
    if (h) {
      const pm25 = last24Mean(h.time, h.pm2_5, nowLocal);
      const pm10 = last24Mean(h.time, h.pm10, nowLocal);
      if (pm25 !== undefined && pm10 !== undefined) {
        city.aqi = { ...cpcbAqi(pm25, pm10), pm25: Math.round(pm25), pm10: Math.round(pm10) };
      }
    }
    out.push(city);
  });
  return out;
}

/** The latest scan time the WMS offers for the infrared layer. */
export function latestScan(capabilities: string, layer = SAT_LAYER): string | undefined {
  const i = capabilities.indexOf(`<Name>${layer}</Name>`);
  if (i < 0) return undefined;
  const m = capabilities.slice(i, i + 8000).match(/<Dimension name="time"[^>]*>([^<]+)</);
  const end = m?.[1].split(",").pop()?.split("/")[1] ?? m?.[1].split(",").pop();
  return end && !Number.isNaN(Date.parse(end)) ? new Date(end).toISOString() : undefined;
}

async function satellite(): Promise<SatelliteImage | undefined> {
  const caps = await fetchText(`${WMS}?service=WMS&version=1.3.0&request=GetCapabilities`, { timeoutMs: 45_000, maxBytes: 8_000_000 });
  if (!caps.ok) throw new Error(`capabilities ${caps.status}`);
  const time = latestScan(caps.text);
  if (!time) throw new Error("no scan time for the infrared layer");
  const [s, w, n, e] = SAT_BBOX;
  const q = new URLSearchParams({
    service: "WMS",
    version: "1.3.0",
    request: "GetMap",
    layers: `${SAT_LAYER},backgrounds:ne_10m_coastline`,
    styles: "",
    crs: "EPSG:4326",
    bbox: `${s},${w},${n},${e}`,
    width: String(SAT_W),
    height: String(SAT_H),
    format: "image/jpeg",
    time: time.replace(".000Z", "Z"),
  });
  const url = `${WMS}?${q}`;
  // Check the image is really there before pinning the edition to it.
  const probe = await fetchText(url, { accept: "image/jpeg", timeoutMs: 45_000, maxBytes: 2_000_000 });
  if (!probe.ok || !probe.contentType.startsWith("image/")) throw new Error(`satellite image ${probe.status} ${probe.contentType}`);
  return { url, width: SAT_W, height: SAT_H, time, bbox: SAT_BBOX, credit: "© EUMETSAT" };
}

export async function weatherPanel(): Promise<WeatherPanel | undefined> {
  const [cities, sat] = await Promise.all([
    forecasts(),
    satellite().catch((e) => {
      log(`weather: satellite failed: ${(e as Error).message}`);
      return undefined;
    }),
  ]);
  if (cities.length === 0) return undefined;
  return { fetchedAt: new Date().toISOString(), cities, satellite: sat };
}
