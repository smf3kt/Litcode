import assert from "node:assert/strict";
import http from "node:http";
import { test } from "node:test";
import { JSON_SCHEMA_MAX_DEPTH, validateJsonSchema } from "../src/json-schema.js";
import { connectMcpServers, McpToolOutputError, type McpConnectOptions } from "../src/mcp.js";
import type { ToolContext } from "../src/tools.js";

const context = (signal = new AbortController().signal): ToolContext => ({ workspace: process.cwd(), signal, allowShell: false, maxOutputBytes: 100_000 });

test("the bounded validator enforces the keywords it documents", () => {
  const schema = {
    type: "object",
    required: ["kind", "count"],
    additionalProperties: false,
    properties: {
      kind: { const: "results" },
      count: { type: "integer", minimum: 0, maximum: 10 },
      label: { type: "string", minLength: 2, maxLength: 4, pattern: "^[a-z]+$" },
      tags: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3, uniqueItems: true },
      mode: { anyOf: [{ const: "fast" }, { const: "slow" }] },
      pick: { oneOf: [{ type: "string" }, { type: "integer" }] },
      ratio: { type: "number", exclusiveMinimum: 0, multipleOf: 0.5 },
      nested: { $ref: "#/definitions/nested" },
    },
    definitions: { nested: { type: "object", required: ["ok"], properties: { ok: { type: "boolean" } } } },
  };
  const good = { kind: "results", count: 3, label: "abc", tags: ["a", "b"], mode: "fast", pick: 2, ratio: 1.5, nested: { ok: true } };
  assert.deepEqual(validateJsonSchema(schema, good), { valid: true });

  const cases: [unknown, string][] = [
    [{ ...good, extra: 1 }, "not a member the contract allows"],
    [{ ...good, kind: "other" }, "fixes"],
    [{ ...good, count: 11 }, "above the maximum"],
    [{ kind: "results" }, "missing the required member \"count\""],
    [{ ...good, label: "abcde" }, "longer than 4"],
    [{ ...good, label: "ABC" }, "does not match the required pattern"],
    [{ ...good, tags: [] }, "fewer than 1"],
    [{ ...good, tags: ["a", "a"] }, "repeats an item"],
    [{ ...good, mode: "medium" }, "satisfies none of the 2 anyOf"],
    [{ ...good, pick: true }, "satisfies 0 of the 2 oneOf"],
    [{ ...good, ratio: 0 }, "exclusive minimum"],
    [{ ...good, ratio: 0.3 }, "not a multiple of"],
    [{ ...good, nested: { ok: "yes" } }, "requires boolean"],
    [{ ...good, nested: null }, "\"nested\" is null where the contract requires object"],
  ];
  for (const [value, expected] of cases) {
    const result = validateJsonSchema(schema, value);
    assert.equal(result.valid, false, JSON.stringify(value));
    assert.ok(result.valid === false && result.errorMessage.includes(expected), `${expected} :: ${JSON.stringify(result)}`);
  }

  // A keyword this validator does not know constrains nothing, which is what the specification asks.
  assert.deepEqual(validateJsonSchema({ if: { type: "string" }, then: { const: "x" } }, "anything"), { valid: true });
  // Depth is bounded, and a reference outside the document is reported rather than followed.
  let deepSchema: Record<string, unknown> = { type: "string" };
  let deepValue: Record<string, unknown> = { next: "leaf" };
  for (let index = 0; index <= JSON_SCHEMA_MAX_DEPTH + 1; index++) {
    deepSchema = { type: "object", properties: { next: deepSchema } };
    deepValue = { next: deepValue };
  }
  const bounded = validateJsonSchema(deepSchema, deepValue);
  assert.ok(bounded.valid === false && bounded.errorMessage.includes("schema depth"), JSON.stringify(bounded));
  const remote = validateJsonSchema({ $ref: "https://example.test/schema.json" }, 1);
  assert.ok(remote.valid === false && remote.errorMessage.includes("not a local pointer"));
});

// A server whose one tool declares an output contract, answering with `mode`:
// ok | bare (no structured content) | wrong (structured content off-contract) | error (isError result).
const SCHEMA = { type: "object", required: ["kind"], properties: { kind: { const: "results" }, count: { type: "integer" } }, additionalProperties: false };
const STDIO = String.raw`
const readline = require('node:readline');
const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');
const schema = ${JSON.stringify(SCHEMA)};
const tool = (name, outputSchema) => ({ name, inputSchema: { type: 'object' }, ...(outputSchema ? { outputSchema } : {}) });
readline.createInterface({ input: process.stdin }).on('line', (line) => {
  const msg = JSON.parse(line);
  if (msg.method === 'initialize') send({ jsonrpc:'2.0', id:msg.id, result:{ protocolVersion:'2024-11-05', capabilities:{ tools:{} } } });
  else if (msg.method === 'tools/list') send({ jsonrpc:'2.0', id:msg.id, result:{ tools:[tool('strict', schema), tool('bare', schema), tool('wrong', schema), tool('error', schema), tool('plain')] } });
  else if (msg.method === 'tools/call') {
    const name = msg.params.name;
    const text = [{ type: 'text', text: 'done' }];
    if (name === 'bare') return send({ jsonrpc:'2.0', id:msg.id, result:{ content: text } });
    if (name === 'wrong') return send({ jsonrpc:'2.0', id:msg.id, result:{ content: text, structuredContent: { kind: 'nope' } } });
    if (name === 'error') return send({ jsonrpc:'2.0', id:msg.id, result:{ content: text, isError: true } });
    if (name === 'plain') return send({ jsonrpc:'2.0', id:msg.id, result:{ content: text, structuredContent: { anything: true } } });
    send({ jsonrpc:'2.0', id:msg.id, result:{ content: text, structuredContent: { kind: 'results', count: 2 } } });
  }
});
`;

async function withServer<T>(options: McpConnectOptions, fn: (call: (name: string) => Promise<string>) => Promise<T>): Promise<T> {
  const connection = await connectMcpServers(
    { fixture: { command: process.execPath, args: ["-e", STDIO] } }, context(), { requestTimeoutMs: 400, ...options });
  try {
    const byName = new Map(connection.tools.map((tool) => [tool.schema.name, tool]));
    return await fn(async (name) => (await byName.get(`mcp__fixture__${name}`)!.execute({}, context())));
  } finally { await connection.close(); }
}

test("a declared output contract decides what a successful result may be", { timeout: 5000 }, async () => {
  await withServer({}, async (call) => {
    assert.match(await call("strict"), /"kind": "results",\n\s+"count": 2/);
    await assert.rejects(call("bare"), (error: unknown) => {
      assert.ok(error instanceof McpToolOutputError);
      assert.equal(error.code, -32600);
      assert.equal(error.message, 'Tool "bare" on MCP server "fixture" has an output schema but did not return structured content');
      return true;
    });
    await assert.rejects(call("wrong"), (error: unknown) => {
      assert.ok(error instanceof McpToolOutputError);
      assert.equal(error.code, -32602);
      assert.match(error.message, /^Structured content from tool "wrong" on MCP server "fixture" does not match the tool's output schema: /);
      return true;
    });
    // An error result is the server's own report, and a tool without a contract is unchecked.
    await assert.rejects(call("error"), /done/);
    assert.match(await call("plain"), /anything/);
  });
});

test("the HTTP transport applies the same contract, including a body carrying the violation", { timeout: 5000 }, async () => {
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString());
      const json = (result: unknown) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ jsonrpc: "2.0", id: body.id, result })); };
      if (body.method === "initialize") return json({ protocolVersion: "2025-06-18", capabilities: { tools: {} } });
      if (body.method === "tools/list") return json({ tools: [{ name: "strict", inputSchema: { type: "object" }, outputSchema: SCHEMA }] });
      if (body.method === "tools/call") {
        return json(body.params.arguments?.bad === true
          ? { content: [], structuredContent: { kind: "results", count: 0, extra: 1 } }
          : { content: [{ type: "text", text: "done" }], structuredContent: { kind: "results", count: 1 } });
      }
      res.writeHead(202); res.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const connection = await connectMcpServers({ fixture: { type: "http", url: `http://127.0.0.1:${address.port}/mcp` } }, context(), { requestTimeoutMs: 400 });
  try {
    const tool = connection.tools[0]!;
    assert.match(await tool.execute({}, context()), /"kind": "results"/);
    await assert.rejects(tool.execute({ bad: true }, context()), (error: unknown) => {
      assert.ok(error instanceof McpToolOutputError);
      assert.equal(error.code, -32602);
      assert.match(error.message, /is not a member the contract allows$/);
      return true;
    });
  } finally {
    await connection.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
