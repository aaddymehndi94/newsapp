// Refresh the data panels of an existing edition without re-running the editor or writers.
//   node pipeline/panels-cli.ts [--edition YYYY-MM-DD-am] [--dry]
import path from "node:path";
import fs from "node:fs";
import { CostMeter } from "./llm.ts";
import { gatherPanels } from "./panels/index.ts";
import { loadDotEnv, log, readJson, writeJson } from "./util.ts";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
process.chdir(ROOT);
loadDotEnv(path.join(ROOT, ".env"));
const argv = process.argv.slice(2);
const i = argv.indexOf("--edition");
const dir = path.join(ROOT, "data/editions");
const id = i >= 0 ? argv[i + 1] : fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort().at(-1)?.replace(/\.json$/, "");
if (!id || !/^\d{4}-\d{2}-\d{2}-(am|pm)$/.test(id)) throw new Error(`no such edition: ${id}`);
const file = path.join(dir, `${id}.json`);
const ed = readJson<Record<string, unknown>>(file);
if (!ed) throw new Error(`cannot read ${file}`);

const meter = new CostMeter();
const panels = await gatherPanels({ meter, marketsDir: path.join(ROOT, "data/markets") });
if (argv.includes("--dry")) {
  console.log(JSON.stringify(panels, null, 1));
} else {
  writeJson(file, { ...ed, panels });
  log(`panels written into ${id}; cost $${meter.total.toFixed(3)}`);
}
