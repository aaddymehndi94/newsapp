// Gather every data panel for an edition. Each panel is optional: a failing source costs that
// panel (or part of it), never the edition.
import type { Panels } from "../../site/types.ts";
import type { CostMeter } from "../llm.ts";
import { log } from "../util.ts";
import { culturePanel } from "./culture.ts";
import { marketsPanel } from "./markets.ts";
import { techPanel } from "./tech.ts";
import { weatherPanel } from "./weather.ts";

export async function gatherPanels(opts: { meter: CostMeter; marketsDir: string }): Promise<Panels> {
  const safe = async <T>(name: string, p: () => Promise<T | undefined>): Promise<T | undefined> => {
    try {
      return await p();
    } catch (e) {
      log(`panel ${name} failed: ${(e as Error).message}`);
      return undefined;
    }
  };
  const [weather, markets, tech, culture] = await Promise.all([
    safe("weather", weatherPanel),
    safe("markets", () => marketsPanel(opts.marketsDir)),
    safe("tech", () => techPanel(opts.meter)),
    safe("culture", culturePanel),
  ]);
  const panels: Panels = {};
  if (weather) panels.weather = weather;
  if (markets) panels.markets = markets;
  if (tech) panels.tech = tech;
  if (culture) panels.culture = culture;
  log(
    `panels: weather ${weather?.cities.length ?? 0} cities${weather?.satellite ? " + satellite" : ""}, markets ${markets?.quotes.length ?? 0}, ` +
      `tech ${tech ? `${tech.repos.length}/${tech.models.length}/${tech.tools.length}` : 0}, culture ${culture ? culture.charts.length + " charts" : 0}${culture?.nowShowing ? " + films" : ""}`,
  );
  return panels;
}
