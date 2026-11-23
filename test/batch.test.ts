import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CostMeter, runBatch, setClient, type JsonRequest } from "../pipeline/llm.ts";

const req = (id: string): JsonRequest => ({ customId: id, model: "claude-sonnet-5-5", system: "s", user: "u", schema: {}, effort: "low", maxTokens: 10 });
const okMsg = (text: string) => ({ stop_reason: "end_turn", content: [{ type: "text", text }], usage: { input_tokens: 10, output_tokens: 5 } });

function fakeClient(opts: { failPolls?: number; results: Record<string, string>; directCalls: string[] }) {
  let polls = 0;
  return {
    messages: {
      create: async (p: { messages: { content: string }[] }) => {
        opts.directCalls.push(p.messages[0].content);
        return okMsg('{"direct":true}');
      },
      batches: {
        create: async () => ({ id: "msgbatch_test", processing_status: "in_progress" }),
        retrieve: async () => {
          polls++;
          if (polls <= (opts.failPolls ?? 0)) throw new Error("Connection error.");
          return { processing_status: "ended", request_counts: { succeeded: 2, processing: 0 } };
        },
        cancel: async () => ({}),
        results: async () =>
          (async function* () {
            for (const [id, text] of Object.entries(opts.results)) yield { custom_id: id, result: { type: "succeeded", message: okMsg(text) } };
          })(),
      },
    },
  } as never;
}

test("runBatch survives poll errors and only re-runs what's missing", async () => {
  const directCalls: string[] = [];
  setClient(fakeClient({ failPolls: 2, results: { a: '{"n":1}' }, directCalls }));
  const state = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mb-")), "batch.json");
  const res = await runBatch<{ n?: number }>([req("a"), req("b")], new CostMeter(), { deadline: new Date(Date.now() + 3600e3), pollMs: 1, stateFile: state });
  assert.deepEqual(res.get("a"), { ok: true, data: { n: 1 }, usage: { input_tokens: 10, output_tokens: 5 } });
  assert.equal(res.get("b")?.ok, true); // retried directly
  assert.equal(directCalls.length, 1);
  assert.equal(fs.existsSync(state), false);
  setClient(undefined);
});

test("runBatch goes direct when the deadline is too close", async () => {
  const directCalls: string[] = [];
  setClient(fakeClient({ results: {}, directCalls }));
  const res = await runBatch([req("a")], new CostMeter(), { deadline: new Date(Date.now() + 60e3), pollMs: 1 });
  assert.equal(res.get("a")?.ok, true);
  assert.equal(directCalls.length, 1);
  setClient(undefined);
});
