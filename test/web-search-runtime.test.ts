import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { test, type TestContext } from "node:test";

import type { Anthropic } from "@anthropic-ai/sdk";
import { Agent, defaultConfig } from "../src/agent.js";
import type { ModelProvider } from "../src/provider.js";
import { createRuntime, parseSettings, pinToolSchemas } from "../src/runtime.js";
import { Session, type SessionConfig } from "../src/session.js";
import { createTools } from "../src/tools.js";
import type { WebSearchConfig } from "../src/web-search.js";

type Request = Parameters<ModelProvider["complete"]>[0];
type Response = Awaited<ReturnType<ModelProvider["complete"]>>;
function response(content: Anthropic.ContentBlock[], stop_reason: Anthropic.StopReason): Response {
  return { id: "test-search-message", type: "message", role: "assistant", model: "test-model", content, stop_reason,
    stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } as Response;
}
class ScriptedProvider implements ModelProvider {
  readonly requests: Request[] = [];
  constructor(private script: Response[]) {}
  async count(): Promise<number> { return 0; }
  async complete(request: Request): Promise<Response> {
    this.requests.push(structuredClone(request));
    const next = this.script.shift();
    assert.ok(next, "scripted response exists");
    return next;
  }
}
function searchProvider(query = "runtime query"): ScriptedProvider {
  return new ScriptedProvider([
    response([{ type: "tool_use", id: "search-call", name: "web_search", input: { query, limit: 2 }, caller: { type: "direct" } }], "tool_use"),
    response([{ type: "text", text: "Search completed.", citations: null }], "end_turn"),
  ]);
}
function workspace(t: TestContext): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "ccrev-search-runtime-")));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function config(dir: string, search?: WebSearchConfig): SessionConfig {
  const result = defaultConfig(dir, createTools());
  result.model = "test-model";
  if (search) result.webSearch = search;
  return result;
}
async function loopback(handler: (request: IncomingMessage, response: ServerResponse) => void, fn: (url: string) => Promise<void>): Promise<void> {
  const server = createServer(handler);
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  try { await fn(`http://127.0.0.1:${address.port}`); }
  finally {
    await new Promise<void>((resolve, reject) => { server.close((error) => error ? reject(error) : resolve()); server.closeAllConnections(); });
  }
}
function resultFromModelRequest(provider: ScriptedProvider): Record<string, any> {
  const blocks = provider.requests[1]!.messages.flatMap((message) => typeof message.content === "string" ? [] : message.content);
  const result = blocks.find((block) => block.type === "tool_result" && block.tool_use_id === "search-call");
  assert.ok(result && result.type === "tool_result");
  assert.equal(result.is_error, undefined);
  assert.equal(typeof result.content, "string");
  return JSON.parse(result.content as string);
}

test("configured loopback search runs through actual Agent and durable tool result", async (t) => {
  const dir = workspace(t);
  let requests = 0;
  await loopback((request, res) => {
    requests++;
    const url = new URL(request.url!, "http://127.0.0.1");
    assert.equal(url.pathname, "/search");
    assert.equal(url.searchParams.get("q"), "runtime query");
    assert.equal(url.searchParams.get("limit"), "2");
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ results: [{ url: "https://citation.example.test/one", title: "One", snippet: "Matching content" }] }));
  }, async (endpoint) => {
    const provider = searchProvider();
    const cfg = config(dir, { endpoint: `${endpoint}/search` });
    const runtime = await createRuntime(cfg, provider, new AbortController().signal);
    try {
      assert.equal(runtime.tools.filter((tool) => tool.schema.name === "web_search").length, 1);
      cfg.tools = pinToolSchemas(runtime.tools);
      const session = Session.open(dir, { config: cfg });
      try {
        const agent = new Agent(session, provider, runtime.buildTools(session.config, session.id));
        const output = await agent.run("Search the configured service.");
        assert.equal(output.text, "Search completed.");
        assert.equal(requests, 1);
        const returned = resultFromModelRequest(provider);
        assert.deepEqual(returned.citations, [{ url: "https://citation.example.test/one", title: "One", snippet: "Matching content" }]);
        const event = session.events.find((event) => event.kind === "tool_result");
        assert.ok(event && event.kind === "tool_result");
        assert.deepEqual(JSON.parse(event.result.content as string), returned);
        assert.ok(provider.requests[0]!.tools?.some((schema) => "name" in schema && schema.name === "web_search") ?? false);
      } finally { session.close(); }
    } finally { await runtime.close(); }
  });
});

test("resumed search pins provider configuration and resolves fresh synthetic headerEnv values", async (t) => {
  const dir = workspace(t);
  const envName = "CC_REVERSE_SEARCH_RUNTIME_OWNED_TOKEN";
  assert.equal(process.env[envName], undefined);
  const received: { route: string; token: string | undefined }[] = [];
  process.env[envName] = "runtime-owned-token-first";
  try {
    await loopback((request, res) => {
      received.push({ route: new URL(request.url!, "http://127.0.0.1").pathname, token: request.headers["x-key"] as string | undefined });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ entries: [{ link: "https://citation.example.test/resume", heading: "Resume", excerpt: "Pinned provider" }] }));
    }, async (endpoint) => {
      const search = { endpoint: `${endpoint}/original`, headerEnv: { "X-Key": envName }, queryParam: "search", limitParam: "count",
        fields: { results: "entries", url: "link", title: "heading", snippet: "excerpt" } } satisfies WebSearchConfig;
      assert.deepEqual(parseSettings({ webSearch: search }).webSearch, search);
      const cfg = config(dir, search);
      const firstProvider = searchProvider("first");
      const firstRuntime = await createRuntime(cfg, firstProvider, new AbortController().signal);
      cfg.tools = pinToolSchemas(firstRuntime.tools);
      const initial = Session.open(dir, { config: cfg });
      const id = initial.id;
      const journal = initial.file;
      try {
        await new Agent(initial, firstProvider, firstRuntime.buildTools(initial.config, id)).run("First search.");
        assert.equal(resultFromModelRequest(firstProvider).citations[0].title, "Resume");
      } finally { initial.close(); await firstRuntime.close(); }
      process.env[envName] = "runtime-owned-token-second";
      const changed = structuredClone(cfg);
      changed.webSearch!.endpoint = `${endpoint}/changed`;
      assert.throws(() => Session.open(dir, { id, config: changed }), /Resume requires/);
      const reopened = Session.open(dir, { id });
      const secondProvider = searchProvider("second");
      const secondRuntime = await createRuntime(reopened.config, secondProvider, new AbortController().signal);
      try {
        assert.deepEqual(reopened.config.webSearch, search);
        assert.deepEqual(pinToolSchemas(secondRuntime.tools), reopened.config.tools);
        const agent = new Agent(reopened, secondProvider, secondRuntime.buildTools(reopened.config, id));
        await agent.run("Resume search.");
        // Both persisted and fresh calls exist; use the final journal result to
        // validate the resumed call independently of the earlier history.
        const results = reopened.events.filter((event) => event.kind === "tool_result");
        const last = results.at(-1)!;
        assert.ok(last.kind === "tool_result");
        assert.equal(JSON.parse(last.result.content as string).citations[0].url, "https://citation.example.test/resume");
        assert.deepEqual(received, [
          { route: "/original", token: "runtime-owned-token-first" },
          { route: "/original", token: "runtime-owned-token-second" },
        ]);
        const text = fs.readFileSync(journal, "utf8");
        assert.equal(text.includes("runtime-owned-token-first"), false);
        assert.equal(text.includes("runtime-owned-token-second"), false);
        assert.equal(text.includes(envName), true);
      } finally { reopened.close(); await secondRuntime.close(); }
    });
  } finally { delete process.env[envName]; }
});

test("unconfigured search is absent from runtime, pinned schemas, and Agent requests", async (t) => {
  const dir = workspace(t);
  const provider = new ScriptedProvider([response([{ type: "text", text: "No search service configured.", citations: null }], "end_turn")]);
  const cfg = config(dir);
  const runtime = await createRuntime(cfg, provider, new AbortController().signal);
  try {
    assert.equal(runtime.tools.some((tool) => tool.schema.name === "web_search"), false);
    cfg.tools = pinToolSchemas(runtime.tools);
    const session = Session.open(dir, { config: cfg });
    try {
      await new Agent(session, provider, runtime.buildTools(session.config, session.id)).run("Available tools?");
      assert.equal(provider.requests[0]!.tools?.some((schema) => "name" in schema && schema.name === "web_search") ?? false, false);
      assert.equal(session.config.webSearch, undefined);
    } finally { session.close(); }
  } finally { await runtime.close(); }
});
