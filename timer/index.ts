// A Cloudflare Worker whose only job is to start GitHub's Edition run on time. GitHub's own
// scheduled starts ran about six hours late on 25, 26 and 27 Nov 2026; Cloudflare's timers fire
// within a minute. Each firing starts the run only if today's edition (by IST date) is not in the
// repo and no Edition run is already queued or running, so the second firing is a retry when the
// first run failed, and GitHub's late starts still find the edition and stop.
// Needs one secret, GITHUB_TOKEN: a fine-grained token for this repo with Actions read and write
// and Contents read. Without it the timer logs that and does nothing.

interface Env {
  GITHUB_TOKEN?: string;
}

const API = "https://api.github.com/repos/aaddymehndi94/newsapp";

/** Today's date in India (YYYY-MM-DD). */
const istDate = (d: Date) => new Date(d.getTime() + 5.5 * 3600e3).toISOString().slice(0, 10);

export async function startIfNeeded(env: Env, now = new Date(), fetcher: typeof fetch = fetch): Promise<string> {
  if (!env.GITHUB_TOKEN) return "no GITHUB_TOKEN secret; nothing done";
  const gh = (path: string, init: RequestInit = {}) =>
    fetcher(`${API}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${env.GITHUB_TOKEN}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "measured-edition-timer",
      },
    });

  const today = istDate(now);
  const ls = await gh("/contents/data/editions?ref=main");
  if (!ls.ok) return `listing editions failed: HTTP ${ls.status}`;
  const files = (await ls.json()) as { name: string }[];
  if (files.some((f) => f.name.startsWith(`${today}-`))) return `edition ${today} already in the repo`;

  const r = await gh("/actions/workflows/edition.yml/runs?per_page=10");
  if (!r.ok) return `listing runs failed: HTTP ${r.status}`;
  const { workflow_runs: runs } = (await r.json()) as { workflow_runs: { status: string; created_at: string }[] };
  // A run that has sat unfinished for over 12 hours is GitHub's problem, not today's edition.
  const busy = runs.find((x) => x.status !== "completed" && now.getTime() - Date.parse(x.created_at) < 12 * 3600e3);
  if (busy) return `an Edition run is already ${busy.status} (since ${busy.created_at})`;

  const d = await gh("/actions/workflows/edition.yml/dispatches", {
    method: "POST",
    body: JSON.stringify({ ref: "main", inputs: { slot: "am" } }),
  });
  return d.status === 204 ? `started the ${today} edition` : `start refused: HTTP ${d.status} ${(await d.text()).slice(0, 200)}`;
}

export default {
  async scheduled(_event: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
    ctx.waitUntil(
      startIfNeeded(env).then(
        (m) => console.log(m),
        (e) => console.error(`timer failed: ${e}`),
      ),
    );
  },
};
