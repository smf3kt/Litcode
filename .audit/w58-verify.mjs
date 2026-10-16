import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { pathToFileURL } from "node:url";
import ts from "/tmp/w47-tools/node_modules/typescript/lib/typescript.js";

const root = "/Users/mant1ssa/Projects/cc-base-2188";
const { AnthropicVertex } = await import(pathToFileURL(`${root}/node_modules/@anthropic-ai/vertex-sdk/client.mjs`));
const source = fs.readFileSync(`${root}/services/api/client.ts`, "utf8");
const expression = source.match(/getRequestHeaders: (.*),/)[1];
const getRequestHeaders = vm.runInNewContext(`(${expression})`, { Headers });
async function request(headers) {
  let calls = 0;
  const client = new AnthropicVertex({
    projectId: "fixture-project", region: "us-east5", maxRetries: 0,
    googleAuth: { getClient: async () => ({ getRequestHeaders: headers }) },
    fetch: async (url, options) => {
      calls++;
      assert.match(String(url), /fixture-project/);
      assert.equal(new Headers(options.headers).get("authorization"), null);
      return new Response(JSON.stringify({ id: "fixture", type: "message", role: "assistant", content: [], model: "fixture", stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 } }), { headers: { "content-type": "application/json" } });
    },
  });
  try { await client.messages.create({ model: "fixture", max_tokens: 1, messages: [{ role: "user", content: "fixture" }] }); }
  catch (error) { assert.equal(calls, 0); throw error; }
  assert.equal(calls, 1);
}
await assert.rejects(request(() => ({})), /get is not a function/);
await request(getRequestHeaders);
console.log("PASS Vertex installed SDK: old shape fails before fetch; source adapter reaches one owned fetch");

const types = fs.readFileSync(`${root}/services/mcp/types.ts`, "utf8");
const guard = types.match(/export function isMcpStdioServerConfig\([\s\S]*?\n}/)[0];
const js = ts.transpile(guard.replace("export ", ""), { target: ts.ScriptTarget.ES2022 });
const isStdio = vm.runInNewContext(`${js}; isMcpStdioServerConfig`);
assert.equal(isStdio({ command: "fixture" }), true);
assert.equal(isStdio({ type: "stdio", command: "fixture" }), true);
assert.equal(isStdio({ type: "http", url: "https://fixture.invalid" }), false);
assert.equal(isStdio({ type: "sse", url: "https://fixture.invalid" }), false);
console.log("PASS stdio discriminator: omitted/stdio accepted, http/sse excluded");

const compact = fs.readFileSync(`${root}/services/compact/compact.ts`, "utf8");
const loop = compact.slice(compact.indexOf("      const streamIter = streamingGen[Symbol.asyncIterator]()"), compact.indexOf("      if (response)", compact.indexOf("      const streamIter = streamingGen[Symbol.asyncIterator]()")));
const evaluate = vm.runInNewContext(`(async (streamingGen, context) => { let hasStartedStreaming = false; let response; ${loop}; return response; })`);
const assistant = { type: "assistant", message: { content: [] } };
let mode;
let length = 0;
async function* stream() {
  yield { type: "stream_event", event: { type: "content_block_start", content_block: { type: "text" } } };
  yield { type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text: "abc" } } };
  yield assistant;
  return "terminal-value";
}
assert.equal(await evaluate(stream(), { setStreamMode: value => mode = value, setResponseLength: update => length = update(length) }), assistant);
assert.equal(mode, "responding");
assert.equal(length, 3);
for (const value of [true, false, undefined, null]) {
  assert.equal(Boolean(value), value === true);
  assert.equal(!value, value !== true);
}
console.log("PASS boolean/iterator: declared boolean domain preserves branches; source compact loop consumes events and excludes terminal value");
