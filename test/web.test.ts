import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { test } from "node:test";
import { gzipSync } from "node:zlib";

import { createWebTools } from "../src/web.js";
import type { ToolContext } from "../src/tools.js";

const tool = createWebTools()[0]!;
const context = (overrides: Partial<ToolContext> = {}): ToolContext => ({
  workspace: process.cwd(), signal: new AbortController().signal,
  allowShell: false, maxOutputBytes: 100_000, ...overrides,
});
type Result = {
  url: string; status: number; content_type: string; format: string; title: string | null;
  text: string; links: { url: string; text: string }[]; bytes_read: number;
  body_truncated: boolean; output_truncated: boolean; truncated: boolean;
  redirects: number; encoding: string; json_parse_status?: string;
};
async function run(input: unknown, overrides: Partial<ToolContext> = {}): Promise<Result> {
  return JSON.parse(await tool.execute(input, context(overrides)));
}
async function fixture(
  handler: (request: IncomingMessage, response: ServerResponse) => void,
  action: (base: string) => Promise<void>,
): Promise<void> {
  const server = createServer(handler);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  try {
    await action(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeAllConnections();
    });
  }
}
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}
async function within(promise: Promise<void>): Promise<void> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    await Promise.race([
      promise,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("fixture close timeout")), 2000); }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}

// Escapes keep source ASCII while testing actual Unicode at runtime.
const article = '<!doctype html><title>Café &amp; 世界</title>' +
  '<base href="/docs/"><style>secret-style</style><body>' +
  '<nav><a href="/nav">secret-nav</a></nav>' +
  '<main><h1>世界</h1><p>Hello &lt;friend&gt; &#x1F600; &nbsp; Café</p>' +
  '<a href="guide?q=a&amp;b=2">Read <b>more</b></a>' +
  '<a href="javascript:globalThis.webExecuted=true">inert</a>' +
  '<a href="http://name:secret@127.0.0.1/">credentials</a>' +
  '<p hidden>secret-hidden</p><p aria-hidden="true">secret-aria</p>' +
  '<script>globalThis.webExecuted = true; fetch("/executed")</script>' +
  '<template><p>secret-template</p></template></main></body>';

test("web tool is read-only and declares bounded strict extraction schema", () => {
  assert.deepEqual(createWebTools().map((item) => item.schema.name), ["web_fetch"]);
  assert.equal(tool.readOnly, true);
  assert.deepEqual(tool.schema.input_schema.required, ["url"]);
  assert.equal(tool.schema.input_schema.additionalProperties, false);
  const properties = tool.schema.input_schema.properties as Record<string, Record<string, unknown>>;
  assert.equal(properties.max_bytes!.maximum, 2 * 1024 * 1024);
  assert.equal(properties.max_bytes!.default, 256 * 1024);
  assert.equal(properties.extraction!.additionalProperties, false);
});

test("HTML extraction is inert, decodes entities, preserves Unicode, and resolves links", async () => {
  let requests = 0;
  await fixture((_, response) => {
    requests++;
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(article);
  }, async (base) => {
    const result = await run({ url: `${base}/article#fragment` });
    assert.equal(result.url, `${base}/article`);
    assert.equal(result.title, "Café & 世界");
    assert.match(result.text, /世界\n+Hello <friend> \u{1F600}/u);
    assert.match(result.text, /Café/);
    assert.doesNotMatch(result.text, /secret-|webExecuted|fetch\(/);
    assert.deepEqual(result.links, [{ url: `${base}/docs/guide?q=a&b=2`, text: "Read more" }]);
    assert.equal(result.status, 200);
    assert.equal(result.content_type, "text/html; charset=utf-8");
    assert.equal(result.encoding, "utf-8");
    assert.equal(result.bytes_read, Buffer.byteLength(article));
    assert.equal(result.truncated, false);
    assert.equal(requests, 1);
    assert.equal((globalThis as Record<string, unknown>).webExecuted, undefined);
  });
});

test("link fragments survive extraction and destinations are never fetched", async () => {
  let requests = 0;
  await fixture((_, response) => {
    requests++;
    response.writeHead(200, { "content-type": "text/html" });
    response.end('<a href="#section">Section</a><a href="/next#details">Next</a>');
  }, async (base) => {
    const result = await run({ url: `${base}/article` });
    assert.deepEqual(result.links, [
      { url: `${base}/article#section`, text: "Section" },
      { url: `${base}/next#details`, text: "Next" },
    ]);
    assert.equal(requests, 1);
  });
});

test("HTML format returns inert source with separately extracted title and links", async () => {
  await fixture((_, response) => {
    response.writeHead(200, { "content-type": "text/html" });
    response.end(article);
  }, async (base) => {
    const result = await run({ url: base, extraction: { format: "html" } });
    assert.equal(result.format, "html");
    assert.equal(result.text, article);
    assert.equal(result.title, "Café & 世界");
    assert.equal(result.links.length, 1);
  });
});

test("malformed and deeply nested HTML uses parser recovery without recursive extraction", async () => {
  const html = "<title>Recovered &copy;</title><main>" + "<div>".repeat(4000) +
    "deep<span>text</span><p>One<p>Two<!-- <a href='/fake'> -->";
  await fixture((_, response) => {
    response.writeHead(200, { "content-type": "text/html" });
    response.end(html);
  }, async (base) => {
    const result = await run({ url: base });
    assert.equal(result.title, "Recovered ©");
    assert.match(result.text, /deeptext/);
    assert.match(result.text, /One\n+Two/);
    assert.deepEqual(result.links, []);
  });
});

test("plain text and declared legacy charset decode deterministically", async () => {
  await fixture((_, response) => {
    response.writeHead(200, { "content-type": "text/plain; charset=iso-8859-1" });
    response.end(Buffer.from([0x43, 0x61, 0x66, 0xe9, 0x20, 0x80]));
  }, async (base) => {
    const result = await run({ url: base });
    assert.equal(result.text, "Café €");
    assert.equal(result.encoding, "windows-1252");
    assert.equal(result.title, null);
    assert.deepEqual(result.links, []);
  });
});

test("JSON extraction validates JSON, preserves source and does not mutate prototypes", async () => {
  const source = '{"kind":"result","text":"世界","__proto__":{"webExecuted":true}}';
  await fixture((_, response) => {
    response.writeHead(200, { "content-type": "application/problem+json; charset=utf-8" });
    response.end(source);
  }, async (base) => {
    const result = await run({ url: base, extraction: { format: "json" } });
    assert.equal(result.text, source);
    assert.equal(result.json_parse_status, "valid");
    assert.equal(result.format, "json");
    assert.equal(({} as Record<string, unknown>).webExecuted, undefined);
    assert.equal((await run({ url: base })).text, source);
  });
});

test("invalid JSON errors, capped JSON explicitly skips validation", async () => {
  await fixture((_, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end('{"value":');
  }, async (base) => {
    await assert.rejects(run({ url: base, extraction: { format: "json" } }), /invalid JSON/);
    const result = await run({ url: base, max_bytes: 4, extraction: { format: "json" } });
    assert.equal(result.json_parse_status, "skipped_truncated");
    assert.equal(result.body_truncated, true);
    assert.equal(result.text, '{"va');
  });
});

test("relative redirects preserve final URL/status, omit sensitive headers and ignore Set-Cookie", async () => {
  const requests: IncomingMessage[] = [];
  await fixture((request, response) => {
    requests.push(request);
    if (request.url === "/start") {
      response.writeHead(302, { location: "/final", "set-cookie": "session=secret" });
      response.end("redirect body");
    } else {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("complete");
    }
  }, async (base) => {
    const result = await run({ url: `${base}/start` });
    assert.equal(result.url, `${base}/final`);
    assert.equal(result.redirects, 1);
    assert.equal(result.text, "complete");
    assert.equal(requests.length, 2);
    for (const request of requests) {
      for (const header of ["authorization", "proxy-authorization", "cookie", "referer"]) {
        assert.equal(request.headers[header], undefined);
      }
    }
  });
});

test("cross-origin redirect uses fresh headers and cancels the earlier body", async () => {
  const closed = deferred();
  await fixture((request, response) => {
    assert.equal(request.headers.cookie, undefined);
    assert.equal(request.headers.authorization, undefined);
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("other origin");
  }, async (destination) => {
    await fixture((_, response) => {
      response.on("close", closed.resolve);
      response.writeHead(307, { location: `${destination}/final`, "set-cookie": "secret=1" });
      response.write("never-ending redirect body");
    }, async (base) => {
      const result = await run({ url: base });
      assert.equal(result.url, `${destination}/final`);
      assert.equal(result.text, "other origin");
      await within(closed.promise);
    });
  });
});

test("10 redirects are allowed and an eleventh redirect errors", async () => {
  let requests = 0;
  await fixture((request, response) => {
    requests++;
    const index = Number(request.url?.slice(1));
    if (index < 10) {
      response.writeHead(301, { location: `/${index + 1}` });
      response.end();
    } else if (index === 10) {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("ten");
    } else {
      response.writeHead(308, { location: "/loop" });
      response.end();
    }
  }, async (base) => {
    assert.equal((await run({ url: `${base}/0` })).redirects, 10);
    assert.equal(requests, 11);
    requests = 0;
    await assert.rejects(run({ url: `${base}/loop` }), /exceeded 10 redirects/);
    assert.equal(requests, 11);
  });
});

test("invalid protocols, URL credentials and unknown input keys fail before a request", async () => {
  let requests = 0;
  await fixture((_, response) => { requests++; response.end(); }, async (base) => {
    for (const url of ["file:///etc/passwd", "data:text/html,hello", "javascript:1", "bad-url", base.replace("http://", "http://user:password@")]) {
      await assert.rejects(run({ url }), /URL|credentials/);
    }
    for (const input of [
      { url: base, headers: { authorization: "secret" } },
      { url: base, max_bytes: 2 * 1024 * 1024 + 1 },
      { url: base, max_bytes: 0 },
      { url: base, timeout_ms: 0 },
      { url: base, timeout_ms: 120_001 },
      { url: base, extraction: { format: "xml" } },
      { url: base, extraction: { format: "text", headers: {} } },
    ]) await assert.rejects(run(input));
    assert.equal(requests, 0);
  });
});

test("redirect destinations enforce URL validation and missing Location is visible", async () => {
  let requests = 0;
  await fixture((request, response) => {
    requests++;
    const location = request.url === "/file" ? "file:///tmp/fixture" :
      request.url === "/credentials" ? "http://user:secret@127.0.0.1/" : undefined;
    response.writeHead(302, location ? { location } : {});
    response.end();
  }, async (base) => {
    await assert.rejects(run({ url: `${base}/file` }), /http or https/);
    await assert.rejects(run({ url: `${base}/credentials` }), /credentials/);
    await assert.rejects(run({ url: `${base}/missing` }), /HTTP 302 has no Location/);
    assert.equal(requests, 3);
  });
});

test("HTTP failures expose status/final URL and cancel unread response body", async () => {
  const closed = deferred();
  await fixture((_, response) => {
    response.on("close", closed.resolve);
    response.writeHead(503, { "content-type": "text/plain" });
    response.write("error stream");
  }, async (base) => {
    await assert.rejects(run({ url: `${base}/error` }), (error: Error) => {
      assert.match(error.message, /HTTP 503/);
      assert.ok(error.message.includes(`${base}/error`));
      return true;
    });
    await within(closed.promise);
  });
});

test("binary/missing content types, unsupported charset and format mismatch error and close streams", async () => {
  const closed = new Map<string, ReturnType<typeof deferred>>();
  await fixture((request, response) => {
    const route = request.url!;
    const done = closed.get(route)!;
    response.on("close", done.resolve);
    const mime = route === "/binary" ? "application/octet-stream" :
      route === "/charset" ? "text/plain; charset=unknown-fixture-encoding" :
      route === "/mismatch" ? "text/plain" : undefined;
    response.writeHead(200, mime ? { "content-type": mime } : {});
    response.write("payload");
  }, async (base) => {
    for (const [route, pattern] of [
      ["/binary", /unsupported content type/], ["/missing", /unsupported content type/],
      ["/charset", /unsupported charset/], ["/mismatch", /json extraction requires json/],
    ] as const) {
      const done = deferred();
      closed.set(route, done);
      await assert.rejects(run({ url: base + route, ...(route === "/mismatch" ? { extraction: { format: "json" } } : {}) }), pattern);
      await within(done.promise);
    }
  });
});

test("stream byte cap cancels the socket and drops incomplete Unicode tails", async () => {
  const closed = deferred();
  await fixture((_, response) => {
    response.on("close", closed.resolve);
    response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    response.write("a\u{1F600}tail");
  }, async (base) => {
    const result = await run({ url: base, max_bytes: 3 });
    assert.equal(result.bytes_read, 3);
    assert.equal(result.text, "a");
    assert.equal(result.body_truncated, true);
    assert.equal(result.truncated, true);
    assert.doesNotMatch(result.text, /�/);
    await within(closed.promise);
  });
});

test("compressed responses count decoded body bytes and default to 256 KiB", async () => {
  const body = Buffer.from("z".repeat(400_000));
  const zipped = gzipSync(body);
  assert.ok(zipped.length < 1024);
  await fixture((_, response) => {
    response.writeHead(200, {
      "content-type": "text/plain", "content-encoding": "gzip", "content-length": zipped.length,
    });
    response.end(zipped);
  }, async (base) => {
    const small = await run({ url: base, max_bytes: 100 });
    assert.equal(small.bytes_read, 100);
    assert.equal(small.text.length, 100);
    assert.equal(small.truncated, true);
    const defaults = await run({ url: base }, { maxOutputBytes: 500_000 });
    assert.equal(defaults.bytes_read, 256 * 1024);
    assert.equal(defaults.text.length, 256 * 1024);
    assert.equal(defaults.body_truncated, true);
  });
});

test("UTF-8 output cap retains valid JSON, metadata and complete code points", async () => {
  const text = '\u{1F600}"\\\n'.repeat(1000);
  await fixture((_, response) => {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end(text);
  }, async (base) => {
    const output = await tool.execute({ url: base }, context({ maxOutputBytes: 500 }));
    assert.ok(Buffer.byteLength(output) <= 500);
    const result: Result = JSON.parse(output);
    assert.equal(result.output_truncated, true);
    assert.equal(result.body_truncated, false);
    assert.equal(result.truncated, true);
    assert.equal(result.status, 200);
    assert.ok(text.startsWith(result.text));
    assert.doesNotMatch(result.text, /�/);
    await assert.rejects(tool.execute({ url: base }, context({ maxOutputBytes: 1 })), /budget is too small/);
  });
});

test("large titles and link sets carry explicit extraction truncation flags", async () => {
  const html = `<title>${"t".repeat(5000)}</title>` +
    Array.from({ length: 300 }, (_, index) => `<a href="/${index}">link ${index}</a>`).join("");
  await fixture((_, response) => {
    response.writeHead(200, { "content-type": "text/html" });
    response.end(html);
  }, async (base) => {
    const result = await run({ url: base });
    assert.equal(result.title!.length, 4096);
    assert.equal(result.links.length, 256);
    assert.equal(result.output_truncated, true);
    assert.equal(result.truncated, true);
  });
});

test("pre-aborted caller prevents any request", async () => {
  let requests = 0;
  await fixture((_, response) => { requests++; response.end(); }, async (base) => {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(run({ url: base }, { signal: controller.signal }), { name: "AbortError" });
    assert.equal(requests, 0);
  });
});

test("timeout spans stalled headers and stalled body, closing the request", async () => {
  for (const bodyStarted of [false, true]) {
    const closed = deferred();
    await fixture((request, response) => {
      request.on("close", closed.resolve);
      if (bodyStarted) {
        response.writeHead(200, { "content-type": "text/plain" });
        response.write("partial");
      }
    }, async (base) => {
      await assert.rejects(run({ url: base, timeout_ms: 100 }), { name: "TimeoutError" });
      await within(closed.promise);
    });
  }
});

test("caller abort during reading closes the body and reports AbortError", async () => {
  const started = deferred();
  const closed = deferred();
  await fixture((_, response) => {
    response.on("close", closed.resolve);
    response.writeHead(200, { "content-type": "text/plain" });
    response.write("partial");
    started.resolve();
  }, async (base) => {
    const controller = new AbortController();
    const pending = run({ url: base }, { signal: controller.signal });
    const rejected = assert.rejects(pending, { name: "AbortError" });
    await started.promise;
    controller.abort();
    await rejected;
    await within(closed.promise);
  });
});

test("timeout budget is shared across redirects and final body", async () => {
  const finalStarted = deferred();
  const closed = deferred();
  await fixture((request, response) => {
    response.on("close", () => {
      if (request.url === "/final") closed.resolve();
    });
    if (request.url === "/start") {
      const timer = setTimeout(() => {
        response.writeHead(302, { location: "/final" });
        response.end();
      }, 50);
      response.on("close", () => clearTimeout(timer));
    } else {
      response.writeHead(200, { "content-type": "text/plain" });
      response.write("partial");
      finalStarted.resolve();
    }
  }, async (base) => {
    const startedAt = Date.now();
    await assert.rejects(run({ url: `${base}/start`, timeout_ms: 120 }), { name: "TimeoutError" });
    assert.ok(Date.now() - startedAt < 500);
    await within(finalStarted.promise);
    await within(closed.promise);
  });
});

test("broken response streams surface errors instead of returning partial success", async () => {
  await fixture((_, response) => {
    response.writeHead(200, { "content-type": "text/plain", "content-length": "1000" });
    response.write("short");
    setImmediate(() => response.destroy());
  }, async (base) => {
    await assert.rejects(run({ url: base }));
  });
});
