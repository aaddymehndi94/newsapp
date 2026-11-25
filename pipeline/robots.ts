// robots.txt, read simply and conservatively: Disallow rules from the groups for "*" and for
// our own agent are obeyed; Allow exceptions are ignored, so when unsure we don't fetch.
// Every feed and every article page goes through allowedByRobots() before it is fetched.
// Article pages are read for Claude to write from, so for them we also obey the groups a site
// writes for Claude-User, Anthropic's agent for reading a page because a person asked (and for
// plain "Claude"): our agent isn't named, but that is what we do, so we respect what they mean.
// Groups for Anthropic's training crawler (ClaudeBot) and its older names (anthropic-ai,
// Claude-Web) are about training, which we don't do; the owner decides whether to honour those
// too (2026-11-26 note). Feeds are syndication offered to readers: only "*" and our agent count.

import { fetchText } from "./util.ts";

const robotsCache = new Map<string, Promise<string>>();

/** Anthropic's agent names for reading a page on a person's behalf. */
const AI_READERS = new Set(["claude", "claude-user"]);

export function parseRobots(txt: string, opts: { ai?: boolean } = {}): string[] {
  // Collect Disallow rules from groups that apply to "*" or to our agent (and, for pages Claude
  // will read, to Anthropic's reading agents).
  const lines = txt.split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim());
  const rules: string[] = [];
  let applies = false;
  let lastWasAgent = false;
  for (const line of lines) {
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === "user-agent") {
      const ua = val.toLowerCase();
      const hit = ua === "*" || ua.includes("measurededition") || (!!opts.ai && AI_READERS.has(ua));
      applies = lastWasAgent ? applies || hit : hit;
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (applies && key === "disallow" && val) rules.push(val);
  }
  return rules;
}

/** Whether these Disallow rules leave the URL open to us. */
export function robotsAllows(rules: string[], url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const pathQ = u.pathname + u.search;
  return !rules.some((rule) => {
    if (rule === "/") return true;
    const re = new RegExp("^" + rule.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"));
    return re.test(pathQ);
  });
}

export async function allowedByRobots(url: string, opts: { ai?: boolean } = {}): Promise<boolean> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  let p = robotsCache.get(u.origin);
  if (!p) {
    p = fetchText(`${u.origin}/robots.txt`, { timeoutMs: 8000, accept: "text/plain,*/*", maxBytes: 500_000 }).then((r) =>
      r.ok && !/<html/i.test(r.text.slice(0, 500)) ? r.text : "",
    );
    robotsCache.set(u.origin, p);
  }
  return robotsAllows(parseRobots(await p, opts), url);
}
