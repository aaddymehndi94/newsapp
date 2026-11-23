// Meridian static site builder.
//
//   node site/build.ts [--data data/editions] [--out dist]
//
// Reads every *.json edition in the data directory, then wipes and rewrites the output
// directory: front pages, articles, archive, 404, robots.txt, _headers and hashed assets.

import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEdition } from "./schema.ts";
import { renderArticle } from "./templates/article.ts";
import { renderArchive, renderNotFound } from "./templates/archive.ts";
import { renderFront } from "./templates/front.ts";
import type { SiteCtx } from "./templates/layout.ts";
import { HEAD_SCRIPT } from "./templates/layout.ts";
import type { Edition } from "./types.ts";

const SITE_DIR = path.dirname(fileURLToPath(import.meta.url));
const ASSET_SRC = path.join(SITE_DIR, "assets");

export interface BuildOptions {
  dataDir: string;
  outDir: string;
  /** Silence warnings (tests). */
  quiet?: boolean;
}

export interface BuildResult {
  editions: string[];
  pages: number;
  warnings: string[];
}

export async function loadEditions(dataDir: string, warn: (m: string) => void): Promise<Edition[]> {
  let names: string[];
  try {
    names = (await readdir(dataDir)).filter((n) => n.endsWith(".json")).sort();
  } catch (err) {
    throw new Error(`Cannot read data directory ${dataDir}: ${(err as Error).message}`);
  }
  const byId = new Map<string, Edition>();
  for (const name of names) {
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(path.join(dataDir, name), "utf8"));
    } catch (err) {
      warn(`${name}: not valid JSON — ${(err as Error).message}`);
      continue;
    }
    const { edition, warnings } = parseEdition(raw, name);
    warnings.forEach(warn);
    if (!edition) continue;
    const prev = byId.get(edition.id);
    if (prev && Date.parse(prev.publishedAt) > Date.parse(edition.publishedAt)) continue;
    byId.set(edition.id, edition);
  }
  // Order by edition (date, then morning before evening), not by when a run happened to finish,
  // so re-running a morning edition never displaces that evening's edition from the front page.
  const order = (e: { date: string; slot: string }) => `${e.date}-${e.slot === "morning" ? "a" : "b"}`;
  return [...byId.values()].sort((a, b) => order(a).localeCompare(order(b)) || Date.parse(a.publishedAt) - Date.parse(b.publishedAt));
}

/** Refuse to wipe anything that is obviously not a build directory. */
function assertSafeOutDir(outDir: string, dataDir: string): void {
  const out = path.resolve(outDir);
  const data = path.resolve(dataDir);
  const within = (child: string, parent: string) => {
    const rel = path.relative(parent, child);
    return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
  };
  const forbidden = [path.parse(out).root, os.homedir(), process.cwd(), SITE_DIR, path.dirname(SITE_DIR)];
  if (forbidden.some((f) => out === path.resolve(f))) throw new Error(`Refusing to wipe ${out}`);
  if (within(process.cwd(), out) || within(data, out) || within(out, data)) {
    throw new Error(`Refusing to use ${out} as the output directory (it overlaps the data or working directory)`);
  }
  if (within(out, SITE_DIR)) throw new Error(`Refusing to build into the site source directory (${out})`);
}

const sha = (buf: Buffer | string, n = 10) => createHash("sha256").update(buf).digest("hex").slice(0, n);

async function writeAssets(outDir: string): Promise<{ css: string; js: string; fontPreloads: string[] }> {
  const out = path.join(outDir, "assets");
  await mkdir(path.join(out, "fonts"), { recursive: true });
  const css = await readFile(path.join(ASSET_SRC, "site.css"));
  const js = await readFile(path.join(ASSET_SRC, "site.js"));
  const cssName = `site.${sha(css)}.css`;
  const jsName = `site.${sha(js)}.js`;
  await writeFile(path.join(out, cssName), css);
  await writeFile(path.join(out, jsName), js);
  await copyFile(path.join(ASSET_SRC, "favicon.svg"), path.join(out, "favicon.svg"));
  for (const f of await readdir(path.join(ASSET_SRC, "fonts"))) {
    await copyFile(path.join(ASSET_SRC, "fonts", f), path.join(out, "fonts", f));
  }
  return {
    css: `/assets/${cssName}`,
    js: `/assets/${jsName}`,
    fontPreloads: ["/assets/fonts/source-serif-4-latin.woff2", "/assets/fonts/schibsted-grotesk-latin.woff2"],
  };
}

function headersFile(): string {
  const scriptHash = createHash("sha256").update(HEAD_SCRIPT).digest("base64");
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'sha256-${scriptHash}'`,
    "style-src 'self'",
    "img-src 'self' https: data:",
    "font-src 'self'",
    "frame-src https://www.youtube-nocookie.com",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
  const html = "  Cache-Control: public, max-age=120, must-revalidate";
  return `# Cloudflare static-assets headers. Generated by site/build.ts — do not edit by hand.
/*
  X-Robots-Tag: noindex, nofollow
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()
  Cross-Origin-Opener-Policy: same-origin
  Content-Security-Policy: ${csp}

/
${html}

/index.html
${html}

/e/*
${html}

/archive/*
${html}

/404.html
${html}

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`;
}

async function writePage(outDir: string, rel: string, html: string): Promise<void> {
  const file = path.join(outDir, rel);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, html);
}

export async function buildSite(opts: BuildOptions): Promise<BuildResult> {
  const warnings: string[] = [];
  const warn = (m: string) => {
    warnings.push(m);
    if (!opts.quiet) console.warn(`warning: ${m}`);
  };
  const editions = await loadEditions(opts.dataDir, warn);
  if (editions.length === 0) throw new Error(`No usable editions found in ${opts.dataDir}`);

  assertSafeOutDir(opts.outDir, opts.dataDir);
  await rm(opts.outDir, { recursive: true, force: true });
  await mkdir(opts.outDir, { recursive: true });

  const assets = await writeAssets(opts.outDir);
  const latest = editions[editions.length - 1];
  const sample = editions.some((e) => e.fixture === true);
  const ctx: SiteCtx = { editions, latest, sample, ...assets };

  let pages = 0;
  const put = async (rel: string, html: string) => {
    await writePage(opts.outDir, rel, html);
    pages++;
  };

  for (const ed of editions) {
    await put(path.join("e", ed.id, "index.html"), renderFront(ed, ctx));
    for (const story of ed.stories) {
      await put(path.join("e", ed.id, story.id, "index.html"), renderArticle(ed, story, ctx));
    }
  }
  await put("index.html", renderFront(latest, ctx));
  await put(path.join("archive", "index.html"), renderArchive(ctx));
  await put("404.html", renderNotFound(ctx));
  await writeFile(path.join(opts.outDir, "robots.txt"), "User-agent: *\nDisallow: /\n");
  await writeFile(path.join(opts.outDir, "_headers"), headersFile());

  return { editions: editions.map((e) => e.id), pages, warnings };
}

// ---------- CLI ----------

function parseArgs(argv: string[]): { dataDir: string; outDir: string } {
  const out = { dataDir: "data/editions", outDir: "dist" };
  for (let i = 0; i < argv.length; i++) {
    const [flag, inlineVal] = argv[i].split("=", 2);
    const val = () => inlineVal ?? argv[++i];
    if (flag === "--data") out.dataDir = val();
    else if (flag === "--out") out.outDir = val();
    else if (flag === "--help" || flag === "-h") {
      console.log("Usage: node site/build.ts [--data data/editions] [--out dist]");
      process.exit(0);
    } else throw new Error(`Unknown argument: ${argv[i]}`);
    if (!out.dataDir || !out.outDir) throw new Error(`Missing value for ${flag}`);
  }
  return out;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const started = performance.now();
    const res = await buildSite(args);
    const ms = Math.round(performance.now() - started);
    console.log(`Built ${res.pages} pages from ${res.editions.length} edition(s) into ${args.outDir} in ${ms} ms.`);
    console.log(`Latest: ${res.editions[res.editions.length - 1]}`);
  } catch (err) {
    console.error(`build failed: ${(err as Error).message}`);
    process.exit(1);
  }
}
