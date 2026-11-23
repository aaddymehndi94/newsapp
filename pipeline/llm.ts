import Anthropic from "@anthropic-ai/sdk";
import { log } from "./util.ts";

export const EDITOR_MODEL = "claude-opus-5-5";
export const WRITER_MODEL = "claude-sonnet-5-5";

// $ per million tokens (Anthropic list prices, Nov 2026). Batch = 50% of these.
const PRICES: Record<string, { in: number; out: number; cacheRead: number }> = {
  "claude-opus-5-5": { in: 4, out: 20, cacheRead: 0.2 },
  "claude-sonnet-5-5": { in: 2, out: 10, cacheRead: 0.1 },
};

let client: Anthropic | undefined;
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

/**
 * Submit requests as a Message Batch (50% off). Polls until done or deadline; anything not
 * finished by the deadline (or errored/expired) is re-run directly so the edition still ships.
 */
export async function runBatch<T>(
  reqs: JsonRequest[],
  meter: CostMeter,
  opts: { deadline: Date; pollMs?: number; syncConcurrency?: number },
): Promise<Map<string, JsonResult<T>>> {
  const results = new Map<string, JsonResult<T>>();
  if (reqs.length === 0) return results;
  const byId = new Map(reqs.map((r) => [r.customId, r]));
  let batch: Anthropic.Messages.MessageBatch;
  try {
    batch = await anthropic().messages.batches.create({
      requests: reqs.map((r) => ({ custom_id: r.customId, params: params(r) })),
    });
  } catch (e) {
    log(`batch submit failed (${(e as Error).message.slice(0, 200)}) — running directly`);
    const { mapLimit } = await import("./util.ts");
    await mapLimit(reqs, opts.syncConcurrency ?? 6, async (r) => {
      results.set(r.customId, await callJson<T>(r, meter));
    });
    return results;
  }
  log(`batch ${batch.id} submitted (${reqs.length} requests)`);
  let status = batch.processing_status;
  while (status !== "ended" && Date.now() < opts.deadline.getTime()) {
    await new Promise((r) => setTimeout(r, opts.pollMs ?? 30_000));
    const b = await anthropic().messages.batches.retrieve(batch.id);
    status = b.processing_status;
    log(`batch ${batch.id}: ${status} ok=${b.request_counts.succeeded} processing=${b.request_counts.processing}`);
  }
  if (status !== "ended") {
    log(`batch ${batch.id} missed deadline — cancelling and finishing remaining requests directly`);
    await anthropic().messages.batches.cancel(batch.id).catch(() => undefined);
    // Wait briefly for cancellation so completed results are retrievable.
    for (let i = 0; i < 20; i++) {
      const b = await anthropic().messages.batches.retrieve(batch.id);
      if (b.processing_status === "ended") break;
      await new Promise((r) => setTimeout(r, 5_000));
    }
  }
  try {
    for await (const r of await anthropic().messages.batches.results(batch.id)) {
      const req = byId.get(r.custom_id);
      if (!req) continue;
      if (r.result.type === "succeeded") {
        const msg = r.result.message as Anthropic.Message;
        meter.add(req.model, msg.usage as Usage, true);
        results.set(r.custom_id, extract<T>(msg));
      }
    }
  } catch (e) {
    log(`batch results read failed: ${(e as Error).message}`);
  }
  // Retry anything missing or failed (except refusals) directly.
  const retry = reqs.filter((r) => {
    const got = results.get(r.customId);
    return !got || (!got.ok && got.error !== "refusal");
  });
  if (retry.length) {
    log(`retrying ${retry.length} requests directly`);
    const { mapLimit } = await import("./util.ts");
    await mapLimit(retry, opts.syncConcurrency ?? 6, async (r) => {
      results.set(r.customId, await callJson<T>(r, meter));
    });
  }
  return results;
}
