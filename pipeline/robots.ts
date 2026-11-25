// robots.txt, read simply and conservatively: Disallow rules from the groups for "*" (every
// reader) and for our own agent are obeyed; Allow exceptions are ignored, so when unsure we
// don't fetch. Every feed and every article page goes through allowedByRobots() first.
// Groups written for other named agents (AI training crawlers, search engines) are not ours:
// we read public pages for one household's news digest, credited and linked, and train nothing.
// The owner chose this rule on 2026-11-26, and then, for the development days, chose not to
// consult robots.txt at all (see IGNORE_ROBOTS_UNTIL). What stays either way: an honest user
// agent, so any site can block us; a site that refuses us (401/403/429, challenge pages) stays
// refused; no paywall is bypassed; few requests per site.

import { fetchText } from "./util.ts";

const robotsCache = new Map<string, Promise<string>>();

/** Until this date (IST) robots.txt is not consulted (the owner's call, 2026-11-26: a household's
 *  news digest during development). After it the rule above returns on its own. */
export const IGNORE_ROBOTS_UNTIL = "2026-12-03";
export const robotsIgnored = (now = Date.now()) => now < Date.parse(`${IGNORE_ROBOTS_UNTIL}T00:00:00+05:30`);

export function parseRobots(txt: string): string[] {
  // Collect Disallow rules from groups that apply to "*" or to our agent.
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
      const hit = ua === "*" || ua.includes("measurededition");
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

export async function allowedByRobots(url: string): Promise<boolean> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (robotsIgnored()) return true;
  let p = robotsCache.get(u.origin);
  if (!p) {
    p = fetchText(`${u.origin}/robots.txt`, { timeoutMs: 8000, accept: "text/plain,*/*", maxBytes: 500_000 }).then((r) =>
      r.ok && !/<html/i.test(r.text.slice(0, 500)) ? r.text : "",
    );
    robotsCache.set(u.origin, p);
  }
  return robotsAllows(parseRobots(await p), url);
}
