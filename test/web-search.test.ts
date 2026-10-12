import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { test } from "node:test";
import { gzipSync } from "node:zlib";

import { createWebSearchTools, webSearchConfigSchema, type WebSearchConfig } from "../src/web-search.js";
import type { ToolContext } from "../src/tools.js";

const context = (overrides: Partial<ToolContext> = {}): ToolContext => ({
  workspace: process.cwd(), signal: new AbortController().signal, allowShell: false, maxOutputBytes: 100000, ...overrides,
});
async function fixture(handler: (request: IncomingMessage, response: ServerResponse) => void, action: (base: string) => Promise<void>): Promise<void> {
  const server = createServer(handler);
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  try { await action(`http://127.0.0.1:${address.port}`); }
  finally {
    await new Promise<void>((resolve, reject) => { server.close((error) => error ? reject(error) : resolve()); server.closeAllConnections(); });
  }
}
function tool(endpoint: string, config: Partial<WebSearchConfig> = {}) {
  return createWebSearchTools({ endpoint, ...config })[0]!;
}
function json(response: ServerResponse, value: unknown): void {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}
async function deadline(promise: Promise<void>): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  try { await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("fixture timeout")), 1500); })]); }
  finally { clearTimeout(timer); }
}

test("strict provider configuration and optional factory preserve absent dependency", () => {
  assert.deepEqual(createWebSearchTools(), []);
  const search = tool("http://127.0.0.1/search");
  assert.equal(search.schema.name, "web_search");
  assert.equal(search.readOnly, true);
  assert.deepEqual(search.schema.input_schema.required, ["query"]);
  assert.equal(search.schema.input_schema.additionalProperties, false);
  for (const config of [
    { endpoint: "file:///tmp/search" }, { endpoint: "http://name:secret@127.0.0.1" },
    { endpoint: "http://127.0.0.1/#fragment" }, { endpoint: "http://127.0.0.1", token: "raw-secret" },
    { endpoint: "http://127.0.0.1", headerEnv: { host: "FAKE" } },
    { endpoint: "http://127.0.0.1", headerEnv: { "X-Key": "FAKE", "x-key": "OTHER" } },
    { endpoint: "http://127.0.0.1", fields: { results: "a[0]" } },
    { endpoint: "http://127.0.0.1", queryParam: "limit" },
  ]) assert.equal(webSearchConfigSchema.safeParse(config).success, false);
});

test("GET query mapping, citation parsing and result URLs remain inert", async () => {
  let requests = 0;
  await fixture((request, response) => {
    requests++;
    assert.equal(request.method, "GET");
    const url = new URL(request.url!, "http://127.0.0.1");
    assert.equal(url.searchParams.get("q"), "a & 中");
    assert.equal(url.searchParams.get("limit"), "2");
    assert.equal(url.searchParams.get("fixed"), "yes");
    json(response, { results: [
      { url: "https://example.test/a#section", title: "Title 中", snippet: "Snippet" },
      { url: "https://example.test/b", title: "Second", snippet: "More" },
      { url: "https://example.test/extra", title: "Third" },
    ] });
  }, async (base) => {
    const result = JSON.parse(await tool(`${base}/search?fixed=yes`).execute({ query: "a & 中", limit: 2 }, context()));
    assert.equal(result.status, "ok");
    assert.equal(result.query, "a & 中");
    assert.deepEqual(result.citations[0], { url: "https://example.test/a#section", title: "Title 中", snippet: "Snippet" });
    assert.equal(result.returned, 2);
    assert.equal(result.omitted, 1);
    assert.equal(result.truncated, true);
    assert.equal(requests, 1);
  });
});

test("POST JSON supports configured fields and call-time headerEnv without exposing secrets", async () => {
  const envName = "CC_REVERSE_SEARCH_TEST_OWNED_HEADER";
  assert.equal(process.env[envName], undefined);
  process.env[envName] = "test-owned-token-1";
  try {
    await fixture((request, response) => {
      assert.equal(request.method, "POST");
      assert.equal(request.headers["x-key"], "test-owned-token-2");
      let body = "";
      request.setEncoding("utf8");
      request.on("data", (chunk: string) => { body += chunk; });
      request.on("end", () => {
        assert.deepEqual(JSON.parse(body), { search: "query", count: 10 });
        json(response, { data: { hits: [
          { link: { href: "https://example.test/page" }, heading: "token test-owned-token-2", abstract: "snippet test-owned-token-2" },
          { link: { href: "https://example.test/test-owned-token-2" }, heading: "secret URL" },
        ] } });
      });
    }, async (base) => {
      const search = tool(base, { method: "POST", queryParam: "search", limitParam: "count", headerEnv: { "X-Key": envName }, fields: { results: "data.hits", url: "link.href", title: "heading", snippet: "abstract" } });
      process.env[envName] = "test-owned-token-2";
      const output = await search.execute({ query: "query" }, context());
      assert.equal(output.includes("test-owned-token"), false);
      const result = JSON.parse(output);
      assert.deepEqual(result.citations[0], { url: "https://example.test/page", title: "token [redacted]", snippet: "snippet [redacted]" });
      assert.equal(result.returned, 1);
    });
  } finally { delete process.env[envName]; }
});

test("root arrays and own-property mappings reject invalid citation URL schemes and userinfo", async () => {
  await fixture((_, response) => json(response, [
    { url: "javascript:run()" }, { url: "file:///tmp/x" }, { url: "https://u:p@example.test" },
    { url: "/relative" }, { url: "https://example.test/valid", title: 123, snippet: null },
  ]), async (base) => {
    const result = JSON.parse(await tool(base, { fields: { results: "" } }).execute({ query: "q" }, context()));
    assert.deepEqual(result.citations, [{ url: "https://example.test/valid", title: "", snippet: "" }]);
    assert.equal(result.omitted, 4);
  });
  await fixture((_, response) => json(response, { results: [{ url: "https://example.test", title: "__proto__" }] }), async (base) => {
    await assert.rejects(tool(base, { fields: { results: "__proto__.results" } }).execute({ query: "q" }, context()), /not an array/);
    assert.equal(({} as Record<string, unknown>).results, undefined);
  });
});

test("HTTP, redirect, MIME, malformed JSON and results field errors never expose response payload", async () => {
  let redirected = 0;
  await fixture((request, response) => {
    if (request.url?.startsWith("/target")) redirected++;
    if (request.url?.startsWith("/redirect")) { response.writeHead(302, { location: "/target" }); response.end("SECRET_PAYLOAD"); }
    else if (request.url?.startsWith("/http")) { response.writeHead(503); response.end("SECRET_PAYLOAD"); }
    else if (request.url?.startsWith("/mime")) { response.writeHead(200, { "content-type": "text/html" }); response.end("SECRET_PAYLOAD"); }
    else if (request.url?.startsWith("/invalid")) { response.writeHead(200, { "content-type": "application/json" }); response.end("SECRET_PAYLOAD"); }
    else json(response, { results: {} });
  }, async (base) => {
    for (const route of ["redirect", "http", "mime", "invalid", "field"]) {
      await assert.rejects(tool(`${base}/${route}`).execute({ query: "q" }, context()), (error: Error) => error.message.startsWith("web_search:") && !error.message.includes("SECRET_PAYLOAD"));
    }
    assert.equal(redirected, 0);
  });
});

test("split UTF-8 JSON, exact byte cap, overflow and decompressed response cap", async () => {
  const payload = Buffer.from(JSON.stringify({ results: [{ url: "https://example.test", title: "中", snippet: "😀" }] }));
  await fixture((request, response) => {
    if (request.url?.startsWith("/gzip")) { response.writeHead(200, { "content-type": "application/json", "content-encoding": "gzip" }); response.end(gzipSync(payload)); }
    else {
      response.writeHead(200, { "content-type": "application/json" });
      response.write(payload.subarray(0, payload.length - 3));
      response.end(payload.subarray(payload.length - 3));
    }
  }, async (base) => {
    const result = JSON.parse(await tool(base, { maxResponseBytes: payload.length }).execute({ query: "q" }, context()));
    assert.equal(result.bytes_read, payload.length);
    assert.equal(result.citations[0].title, "中");
    await assert.rejects(tool(base, { maxResponseBytes: payload.length - 1 }).execute({ query: "q" }, context()), /response byte limit/);
    await assert.rejects(tool(`${base}/gzip`, { maxResponseBytes: payload.length - 1 }).execute({ query: "q" }, context()), /response byte limit/);
  });
});

test("output cap preserves valid JSON and UTF-8 with explicit omissions", async () => {
  await fixture((_, response) => json(response, { results: Array.from({ length: 20 }, (_, i) => ({ url: `https://example.test/${i}`, title: "中".repeat(100), snippet: "😀".repeat(1000) })) }), async (base) => {
    const output = await tool(base).execute({ query: "q", limit: 20 }, context({ maxOutputBytes: 1200 }));
    assert.ok(Buffer.byteLength(output) <= 1200);
    assert.equal(output.includes("�"), false);
    const result = JSON.parse(output);
    assert.equal(result.truncated, true);
    assert.equal(result.returned + result.omitted, 20);
    await assert.rejects(tool(base).execute({ query: "q" }, context({ maxOutputBytes: 1 })), /byte budget/);
  });
});

test("preabort and missing synthetic header prevent network calls", async () => {
  let requests = 0;
  await fixture((_, response) => { requests++; json(response, { results: [] }); }, async (base) => {
    const abort = new AbortController(); abort.abort();
    await assert.rejects(tool(base).execute({ query: "q" }, context({ signal: abort.signal })), { name: "AbortError" });
    await assert.rejects(tool(base, { headerEnv: { "X-Key": "CC_REVERSE_SEARCH_TEST_UNSET" } }).execute({ query: "q" }, context()), /missing or invalid/);
    for (const input of [{ query: "" }, { query: "q", limit: 51 }, { query: "q", timeout_ms: 0 }, { query: "q", extra: true }]) await assert.rejects(tool(base).execute(input, context()));
    assert.equal(requests, 0);
  });
});

test("timeout and mid-body cancellation close connections and release listeners", async () => {
  for (const mode of ["timeout", "abort"]) {
    const started = deferred(); const closed = deferred();
    await fixture((request, response) => {
      request.on("close", closed.resolve);
      response.writeHead(200, { "content-type": "application/json" });
      response.write('{"results":[');
      started.resolve();
    }, async (base) => {
      const abort = new AbortController();
      const pending = tool(base, { timeoutMs: mode === "timeout" ? 50 : 1000 }).execute({ query: "q" }, context({ signal: abort.signal }));
      await deadline(started.promise);
      if (mode === "abort") abort.abort();
      await assert.rejects(pending, { name: mode === "timeout" ? "TimeoutError" : "AbortError" });
      await deadline(closed.promise);
    });
  }
});

test("a provider-shaped credential this session was never configured with is also kept out", async () => {
  // The known-secret path can only remove strings this session was given. A
  // result carrying a token of a recognized shape is removed for the same
  // reason, and a citation URL carrying one is dropped like the known-secret
  // case above.
  const shaped = `ghp_${"a".repeat(36)}`;
  const slack = "xoxb-1234567890-1234567890-abcdef";
  await fixture((_request, response) => {
    json(response, { data: { hits: [
      { link: { href: "https://example.test/one" }, heading: "key", abstract: `use ${shaped} and ${slack} here` },
      { link: { href: `https://example.test/${shaped}` }, heading: "shape URL" },
      { link: { href: "https://example.test/three" }, heading: "plain", abstract: "nothing to remove" },
    ] } });
  }, async (base) => {
    const search = tool(base, { method: "POST", queryParam: "search", limitParam: "count", fields: { results: "data.hits", url: "link.href", title: "heading", snippet: "abstract" } });
    const result = JSON.parse(await search.execute({ query: `query with ${shaped}` }, context()));
    assert.equal(JSON.stringify(result).includes(shaped), false);
    assert.equal(JSON.stringify(result).includes(slack), false);
    assert.equal(result.query, "query with [redacted]");
    assert.deepEqual(result.citations[0], { url: "https://example.test/one", title: "key", snippet: "use [redacted] and [redacted] here" });
    assert.deepEqual(result.citations[1], { url: "https://example.test/three", title: "plain", snippet: "nothing to remove" });
    assert.equal(result.returned, 2);
  });
});
