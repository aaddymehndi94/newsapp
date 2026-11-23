import fs from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { log, mapLimit, readJson, writeJson } from "./util.ts";

export const EDITOR_MODEL = "claude-opus-5-5";
export const WRITER_MODEL = "claude-sonnet-5-5";

// $ per million tokens (Anthropic list prices, Nov 2026). Batch = 50% of these.
const PRICES: Record<string, { in: number; out: number; cacheRead: number }> = {
  "claude-opus-5-5": { in: 4, out: 20, cacheRead: 0.2 },
  "claude-sonnet-5-5": { in: 2, out: 10, cacheRead: 0.1 },
};

let client: Anthropic | undefined;
/** Tests substitute a fake client here. */
export function setClient(c: Anthropic | undefined): void {
  client = c;
}
export function anthropic(): Anthropic {
  client ??= new Anthropic({ maxRetries: 4, timeout: 15 * 60_000 });
  return client;
}

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

export class CostMeter {
  total = 0;
  calls = 0;
  byModel: Record<string, number> = {};
  add(model: string, u: Usage, batch: boolean): number {
    const p = PRICES[model] ?? { in: 4, out: 20, cacheRead: 0.2 };
    const k = batch ? 0.5 : 1;
    const cost =
      k *
      ((u.input_tokens * p.in +
        (u.cache_creation_input_tokens ?? 0) * p.in * 1.25 +
        (u.cache_read_input_tokens ?? 0) * p.cacheRead +
        u.output_tokens * p.out) /
        1e6);
    this.total += cost;
    this.calls++;
    this.byModel[model] = (this.byModel[model] ?? 0) + cost;
    return cost;
  }
}

export interface JsonRequest {
  customId: string;
  model: string;
  system: string;
  user: string;
  schema: Record<string, unknown>;
  effort: "low" | "medium" | "high";
  maxTokens: number;
}

export type JsonResult<T> = { ok: true; data: T; usage: Usage } | { ok: false; error: string; usage?: Usage };

function params(req: JsonRequest): Anthropic.MessageCreateParamsNonStreaming {
  return {
    model: req.model,
    max_tokens: req.maxTokens,
    system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: req.user }],
    output_config: { effort: req.effort, format: { type: "json_schema", schema: req.schema } },
  } as Anthropic.MessageCreateParamsNonStreaming;
}

function extract<T>(msg: Anthropic.Message): JsonResult<T> {
  const usage = msg.usage as Usage;
  if (msg.stop_reason === "refusal") return { ok: false, error: "refusal", usage };
  if (msg.stop_reason === "max_tokens") return { ok: false, error: "max_tokens", usage };
  const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  try {
    return { ok: true, data: JSON.parse(text) as T, usage };
  } catch (e) {
    return { ok: false, error: `bad json: ${(e as Error).message}`, usage };
  }
}

export async function callJson<T>(req: JsonRequest, meter: CostMeter): Promise<JsonResult<T>> {
  try {
    const msg = await anthropic().messages.create(params(req));
    const res = extract<T>(msg);
    meter.add(req.model, msg.usage as Usage, false);
    return res;
  } catch (e) {
    const err = e as Error & { status?: number };
    return { ok: false, error: `api ${err.status ?? ""} ${err.message}` };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Submit requests as a Message Batch (50% off). Polls until done or the deadline; anything not
 * finished by then (or errored/expired) is re-run directly so the edition still ships.
 * Transient API/network errors while polling are tolerated. With `stateFile`, the batch id is
 * saved so a re-run of the same edition resumes the batch instead of paying for it twice.
 */
export async function runBatch<T>(
  reqs: JsonRequest[],
  meter: CostMeter,
  opts: { deadline: Date; pollMs?: number; syncConcurrency?: number; stateFile?: string },
): Promise<Map<string, JsonResult<T>>> {
  const results = new Map<string, JsonResult<T>>();
  if (reqs.length === 0) return results;
  const direct = (list: JsonRequest[]) =>
    mapLimit(list, opts.syncConcurrency ?? 6, async (r) => {
      results.set(r.customId, await callJson<T>(r, meter));
    });

  // Too close to the deadline for a batch to be worth it: go direct.
  if (opts.deadline.getTime() - Date.now() < 10 * 60e3) {
    log(`deadline too close for a batch — running ${reqs.length} requests directly`);
    await direct(reqs);
    return results;
  }

  const byId = new Map(reqs.map((r) => [r.customId, r]));
  const ids = reqs.map((r) => r.customId).sort().join(",");
  let batchId: string | undefined;
  const saved = opts.stateFile ? readJson<{ id: string; ids: string }>(opts.stateFile) : undefined;
  if (saved?.id && saved.ids === ids) {
    batchId = saved.id;
    log(`resuming batch ${batchId}`);
  } else {
    try {
      const b = await anthropic().messages.batches.create({
        requests: reqs.map((r) => ({ custom_id: r.customId, params: params(r) })),
      });
      batchId = b.id;
      if (opts.stateFile) writeJson(opts.stateFile, { id: batchId, ids });
      log(`batch ${batchId} submitted (${reqs.length} requests)`);
    } catch (e) {
      log(`batch submit failed (${(e as Error).message.slice(0, 200)}) — running directly`);
      await direct(reqs);
      return results;
    }
  }

  const retrieve = async () => {
    try {
      return await anthropic().messages.batches.retrieve(batchId!);
    } catch (e) {
      log(`batch poll error (will retry): ${(e as Error).message.slice(0, 120)}`);
      return undefined;
    }
  };

  let status: string = "in_progress";
  while (Date.now() < opts.deadline.getTime()) {
    const b = await retrieve();
    if (b) {
      status = b.processing_status;
      if (status === "ended") break;
      log(`batch ${batchId}: ${status} ok=${b.request_counts.succeeded} processing=${b.request_counts.processing}`);
    }
    await sleep(opts.pollMs ?? 30_000);
  }
  if (status !== "ended") {
    log(`batch ${batchId} missed the deadline — cancelling; finished results are kept`);
    await anthropic().messages.batches.cancel(batchId).catch(() => undefined);
    // Wait (up to 10 min) for cancellation to settle so already-finished results can be read.
    for (let i = 0; i < 60 && status !== "ended"; i++) {
      await sleep(10_000);
      status = (await retrieve())?.processing_status ?? status;
    }
  }
  try {
    for await (const r of await anthropic().messages.batches.results(batchId)) {
      const req = byId.get(r.custom_id);
      if (!req) continue;
      if (r.result.type === "succeeded") {
        const msg = r.result.message as Anthropic.Message;
        meter.add(req.model, msg.usage as Usage, true);
        results.set(r.custom_id, extract<T>(msg));
      }
    }
  } catch (e) {
    log(`batch results read failed: ${(e as Error).message.slice(0, 200)}`);
  }
  // Retry anything missing or failed (except refusals) directly.
  const retry = reqs.filter((r) => {
    const got = results.get(r.customId);
    return !got || (!got.ok && got.error !== "refusal");
  });
  if (retry.length) {
    log(`retrying ${retry.length} requests directly`);
    await direct(retry);
  }
  if (opts.stateFile) fs.rmSync(opts.stateFile, { force: true });
  return results;
}
