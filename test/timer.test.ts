import { test } from "node:test";
import assert from "node:assert/strict";
import { startIfNeeded } from "../timer/index.ts";

type Call = { url: string; method: string; body?: string };

// A fake GitHub API: the editions in the repo, the Edition runs, and a log of what was asked.
function fakeGitHub(editions: string[], runs: { status: string; created_at: string }[], dispatchStatus = 204) {
  const calls: Call[] = [];
  const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, method: init?.method ?? "GET", body: init?.body as string | undefined });
    if (u.includes("/contents/data/editions")) return Response.json(editions.map((name) => ({ name })));
    if (u.includes("/runs")) return Response.json({ workflow_runs: runs });
    if (u.endsWith("/dispatches")) return new Response(null, { status: dispatchStatus });
    return new Response("not found", { status: 404 });
  };
  return { calls, fetcher: fetcher as typeof fetch };
}

// 03:37 IST on 27 Nov is 22:07 UTC on 26 Nov.
const at0337 = new Date("2026-11-26T22:07:00Z");

test("timer: starts the run when today's edition is missing and nothing is running", async () => {
  const gh = fakeGitHub(["2026-11-25-am.json", "2026-11-26-am.json"], [{ status: "completed", created_at: "2026-11-26T05:15:52Z" }]);
  const msg = await startIfNeeded({ GITHUB_TOKEN: "t" }, at0337, gh.fetcher);
  assert.match(msg, /started/);
  const d = gh.calls.find((c) => c.method === "POST");
  assert.ok(d?.url.endsWith("/actions/workflows/edition.yml/dispatches"));
  assert.deepEqual(JSON.parse(d!.body!), { ref: "main", inputs: { slot: "am" } });
});

test("timer: does nothing when today's edition (by IST date) is already in the repo", async () => {
  const gh = fakeGitHub(["2026-11-26-am.json", "2026-11-27-am.json"], []);
  const msg = await startIfNeeded({ GITHUB_TOKEN: "t" }, at0337, gh.fetcher);
  assert.match(msg, /already/);
  assert.equal(gh.calls.filter((c) => c.method === "POST").length, 0);
});

test("timer: does nothing while an Edition run is queued or in progress", async () => {
  const gh = fakeGitHub(["2026-11-26-am.json"], [{ status: "queued", created_at: "2026-11-26T22:07:30Z" }]);
  const msg = await startIfNeeded({ GITHUB_TOKEN: "t" }, new Date("2026-11-26T23:10:00Z"), gh.fetcher);
  assert.match(msg, /running|queued/);
  assert.equal(gh.calls.filter((c) => c.method === "POST").length, 0);
});

test("timer: an old run stuck from an earlier day doesn't block today's start", async () => {
  const gh = fakeGitHub(["2026-11-26-am.json"], [{ status: "queued", created_at: "2026-11-25T22:07:00Z" }]);
  const msg = await startIfNeeded({ GITHUB_TOKEN: "t" }, at0337, gh.fetcher);
  assert.match(msg, /started/);
});

test("timer: without a token it does nothing and says so", async () => {
  const gh = fakeGitHub([], []);
  const msg = await startIfNeeded({}, at0337, gh.fetcher);
  assert.match(msg, /GITHUB_TOKEN/);
  assert.equal(gh.calls.length, 0);
});

test("timer: reports a refused start", async () => {
  const gh = fakeGitHub(["2026-11-26-am.json"], [], 403);
  const msg = await startIfNeeded({ GITHUB_TOKEN: "t" }, at0337, gh.fetcher);
  assert.match(msg, /403/);
});
