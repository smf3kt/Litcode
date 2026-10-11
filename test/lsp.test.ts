import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";
import { pathToFileURL } from "node:url";

import {
  createLspTools, lspConfigSchema, LSP_MAX_FILE_BYTES, LSP_MAX_FRAME_BYTES,
  LSP_STDERR_CAP_BYTES, type LspConfig, type LspOptions,
} from "../src/lsp.js";
import type { ToolContext } from "../src/tools.js";

// A test-owned server, launched directly with Node. No application is executed.
const MOCK = String.raw`
const fs = require('fs');
const cp = require('child_process');
const mode = process.argv[1];
const log = process.argv[2];
const ticks = process.argv[3];
const note = msg => fs.appendFileSync(log, JSON.stringify(msg)+'\n');
note({pid:process.pid});
let output = Promise.resolve();
function send(message) {
  const body = Buffer.from(JSON.stringify(message));
  const frame = Buffer.concat([Buffer.from('Content-Length: '+body.length+'\r\nContent-Type: application/vscode-jsonrpc; charset=utf-8\r\n\r\n'), body]);
  output = output.then(() => new Promise(resolve => {
    if (mode === 'split') {
      const cuts = [1, 9, 20, frame.length-2, frame.length-1, frame.length];
      let start=0;
      function next() { const end=cuts.shift(); if(end===undefined){resolve();return;} process.stdout.write(frame.subarray(start,end),()=>{start=end;setImmediate(next);}); }
      next();
    } else process.stdout.write(frame, resolve);
  }));
}
const respond = (msg,result) => send({jsonrpc:'2.0',id:msg.id,result});
const pos = {line:1, character:2};
const range = {start:pos,end:{line:1,character:4}};
let currentUri;
function handle(msg) {
  note(msg);
  if(msg.method === 'initialize') {
    if(mode==='hunginit') return;
    if(mode==='oversize') { process.stdout.write('Content-Length: '+(1048576+1)+'\r\n\r\n');return; }
    if(mode==='header') { process.stdout.write('x'.repeat(9000));return; }
    if(mode==='duplicate') { process.stdout.write('Content-Length: 2\r\nContent-Length: 2\r\n\r\n{}');return; }
    if(mode==='badjson') { process.stdout.write('Content-Length: 3\r\n\r\n???');return; }
    if(mode==='badinit') { respond(msg,{});return; }
    if(mode==='encoding') { respond(msg,{capabilities:{positionEncoding:'utf-8'}});return; }
    const capabilities = mode==='unsupported' ? {} : {
      textDocumentSync: mode==='incremental' ? 2 : 1,
      definitionProvider:true,referencesProvider:true,hoverProvider:true,
      documentSymbolProvider:true,workspaceSymbolProvider:true,
      implementationProvider:true,typeDefinitionProvider:true,callHierarchyProvider:true,
      ...(mode==='pull' ? {diagnosticProvider:{}} : {})
    };
    respond(msg,{capabilities});
    if(mode==='serverrequests') {
      send({jsonrpc:'2.0',id:'configuration',method:'workspace/configuration',params:{items:[{section:'a'},{section:'b'}]}});
      send({jsonrpc:'2.0',id:'folders',method:'workspace/workspaceFolders'});
      send({jsonrpc:'2.0',id:'unknown',method:'workspace/applyEdit',params:{edit:{}}});
    }
    if(mode==='descendant' || mode==='desc_exit') {
      const descendant=cp.spawn(process.execPath,['-e',"const fs=require('fs');const f=process.argv[1];setInterval(()=>fs.appendFileSync(f,'t'),20)",ticks],{stdio:['ignore','inherit','inherit']});
      note({descendant:descendant.pid});
    }
    return;
  }
  if(msg.method==='textDocument/didOpen' || msg.method==='textDocument/didChange') {
    currentUri=msg.params.textDocument.uri;
    if(mode==='nodiag') return;
    const version=msg.params.textDocument.version;
    const diagnostics=[{range,message:'diagnostic 中',severity:1}];
    if(mode==='bigdiag') diagnostics[0].message='D'.repeat(100000);
    send({jsonrpc:'2.0',method:'textDocument/publishDiagnostics',params:{uri:currentUri,version,diagnostics}});
    if(mode==='stale') send({jsonrpc:'2.0',method:'textDocument/publishDiagnostics',params:{uri:currentUri,version:version-1,diagnostics:[{message:'stale'}]}});
    if(mode==='cachefill') for(let i=0;i<24;i++) send({jsonrpc:'2.0',method:'textDocument/publishDiagnostics',params:{uri:currentUri.replace(/file\.ts$/, 'cache'+i+'.ts'),version:1,diagnostics:[{range,message:'D'.repeat(60000)}]}});
    return;
  }
  if(msg.method==='shutdown') {
    if(mode==='shutdownhang') return;
    respond(msg,null); return;
  }
  if(msg.method==='exit') { output.then(()=>process.exit(0)); return; }
  if(msg.id === undefined || !msg.method) return;
  if(mode==='hang') return;
  if(mode==='error') {send({jsonrpc:'2.0',id:msg.id,error:{code:-32602,message:'mock error'}});return;}
  if(mode==='exitcall') {process.stderr.write('E'.repeat(50000),()=>process.exit(7));return;}
  if(mode==='desc_exit') {setTimeout(()=>process.exit(7),100);return;}
  if(mode==='badresponse') {send({jsonrpc:'2.0',id:msg.id,result:null,error:{code:-1,message:'bad'}});return;}
  if(msg.method==='textDocument/prepareCallHierarchy') {
    respond(msg,[{name:'callee',kind:12,uri:currentUri,range,selectionRange:range,data:{token:'opaque'}}]);return;
  }
  if(msg.method.startsWith('callHierarchy/')) {
    respond(msg,[{from:msg.params.item,fromRanges:[range]}]);return;
  }
  if(msg.method==='textDocument/diagnostic') {respond(msg,{kind:'full',items:[{range,message:'pulled'}]});return;}
  if(msg.method==='textDocument/hover') {
    respond(msg,{contents:{kind:'markdown',value:mode==='large'?'中'.repeat(10000):'hover 中'},range,observed:msg.params});return;
  }
  respond(msg,{uri:currentUri || msg.params.textDocument?.uri,range,observed:msg.params,method:msg.method});
}
let buffer=Buffer.alloc(0);
process.stdin.on('data',chunk=>{
 buffer=Buffer.concat([buffer,chunk]);
 for(;;) {
  const end=buffer.indexOf('\r\n\r\n');if(end<0)return;
  const match=/Content-Length:\s*(\d+)/i.exec(buffer.subarray(0,end).toString());if(!match)process.exit(10);
  const length=Number(match[1]);if(buffer.length<end+4+length)return;
  const msg=JSON.parse(buffer.subarray(end+4,end+4+length).toString());
  buffer=buffer.subarray(end+4+length);handle(msg);
 }
});
`;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
function notes(file: string): Record<string, any>[] {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}
async function waitFor(check: () => boolean, timeout = 3000): Promise<void> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (check()) return;
    await delay(10);
  }
  assert.fail("mock condition timed out");
}
function alive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}
function fixture(t: TestContext, mode = "basic", options: LspOptions = {}) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "ccrev-lsp-"));
  const log = path.join(workspace, "requests.jsonl");
  const ticks = path.join(workspace, "ticks");
  fs.writeFileSync(path.join(workspace, "file.ts"), "const x = 1;\nabc中😀\n");
  const session = new AbortController();
  const context: ToolContext = { workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 100000 };
  const config: LspConfig = { typescript: { command: process.execPath, args: ["-e", MOCK, mode, log, ticks], extensions: [".ts"], languageId: "typescript" } };
  const adapter = createLspTools(config, { ...context, signal: session.signal }, options);
  t.after(async () => { await adapter.close(); fs.rmSync(workspace, { recursive: true, force: true }); });
  const call = async (input: unknown, overrides: Partial<ToolContext> = {}) => JSON.parse(await adapter.tools[0]!.execute(input, { ...context, ...overrides }));
  return { workspace, log, ticks, session, context, config, adapter, call };
}
const hover = { operation: "hover", path: "file.ts", line: 2, column: 3 };

test("configuration is strict, reusable, and construction is lazy", async (t) => {
  const f = fixture(t);
  assert.equal(fs.existsSync(f.log), false);
  assert.equal(f.adapter.tools[0]!.schema.name, "lsp");
  assert.equal(f.adapter.tools[0]!.readOnly, true);
  assert.match(f.adapter.tools[0]!.schema.description!, /pending/);
  assert.equal(createLspTools({}, f.context).tools.length, 0);
  assert.equal(lspConfigSchema.safeParse({ bad: { command: "node", extensions: ["ts"], env: { SECRET: "value" } } }).success, false);
  assert.throws(() => createLspTools({ a: f.config.typescript!, b: f.config.typescript! }, f.context), /Ambiguous/);
  const invalid = await f.call({ ...hover, line: 0 });
  assert.equal(invalid.status, "error");
  assert.equal(fs.existsSync(f.log), false);
  await f.adapter.close();
  assert.equal(fs.existsSync(f.log), false);
});

test("split Content-Length framing, initialization and UTF-16 semantic coordinates", async (t) => {
  const f = fixture(t, "split");
  const result = await f.call(hover);
  assert.equal(result.status, "ok");
  assert.equal(result.result.contents.value, "hover 中");
  assert.deepEqual(result.result.range.start, { line: 2, column: 3 });
  assert.deepEqual(result.result.observed.position, { line: 2, column: 3 });
  const requests = notes(f.log);
  const init = requests.find((n) => n.method === "initialize")!;
  assert.equal(init.params.rootUri, pathToFileURL(fs.realpathSync(f.workspace)).href);
  assert.deepEqual(init.params.capabilities.general.positionEncodings, ["utf-16"]);
  const opened = requests.find((n) => n.method === "textDocument/didOpen")!;
  assert.equal(opened.params.textDocument.version, 1);
  assert.equal(opened.params.textDocument.languageId, "typescript");
  assert.ok(requests.findIndex((n) => n.method === "initialized") < requests.findIndex((n) => n.method === "textDocument/didOpen"));
  assert.deepEqual(requests.find((n) => n.method === "textDocument/hover")!.params.position, { line: 1, character: 2 });
  const same = await f.call(hover);
  assert.equal(same.status, "ok");
  assert.equal(notes(f.log).filter((n) => n.method === "textDocument/didOpen").length, 1);
});

test("all operations map to LSP methods and call hierarchy retains opaque data", async (t) => {
  const f = fixture(t);
  const expected: Record<string, string> = {
    definition: "textDocument/definition", references: "textDocument/references",
    document_symbols: "textDocument/documentSymbol", workspace_symbols: "workspace/symbol",
    implementation: "textDocument/implementation", type_definition: "textDocument/typeDefinition",
  };
  for (const [operation, method] of Object.entries(expected)) {
    const result = await f.call({ ...hover, operation, query: "needle" });
    assert.equal(result.status, "ok");
    assert.equal(result.result.method, method);
    assert.equal(result.result.path, "file.ts");
  }
  assert.equal(notes(f.log).find((n) => n.method === "textDocument/references")!.params.context.includeDeclaration, true);
  assert.deepEqual(notes(f.log).find((n) => n.method === "workspace/symbol")!.params, { query: "needle" });
  assert.equal((await f.call({ operation: "workspace_symbols", query: "no-path" })).status, "ok");
  const hierarchy = await f.call({ ...hover, operation: "call_hierarchy" });
  assert.equal(hierarchy.result.length, 1);
  assert.deepEqual(hierarchy.result[0].item.data, { token: "opaque" });
  const requests = notes(f.log);
  for (const method of ["callHierarchy/incomingCalls", "callHierarchy/outgoingCalls"]) {
    const item = requests.find((n) => n.method === method)!.params.item;
    assert.deepEqual(item.range.start, { line: 1, character: 2 });
    assert.deepEqual(item.data, { token: "opaque" });
  }
  const before = requests.length;
  await f.call({ ...hover, operation: "call_hierarchy", direction: "prepare" });
  assert.equal(notes(f.log).slice(before).filter((n) => n.method?.startsWith("callHierarchy/")).length, 0);
});

test("changed documents get increasing versions and replacement ranges for incremental sync", async (t) => {
  for (const mode of ["basic", "incremental"]) {
    const f = fixture(t, mode);
    await f.call(hover);
    const original = fs.readFileSync(path.join(f.workspace, "file.ts"), "utf8");
    fs.writeFileSync(path.join(f.workspace, "file.ts"), "changed\r\nline\n");
    assert.equal((await f.call(hover)).status, "ok");
    const changes = notes(f.log).filter((n) => n.method === "textDocument/didChange");
    assert.equal(changes.length, 1);
    assert.equal(changes[0]!.params.textDocument.version, 2);
    assert.equal(changes[0]!.params.contentChanges[0].text, "changed\r\nline\n");
    if (mode === "incremental") {
      assert.deepEqual(changes[0]!.params.contentChanges[0].range, { start: { line: 0, character: 0 }, end: { line: original.split("\n").length - 1, character: 0 } });
    }
    fs.writeFileSync(path.join(f.workspace, "file.ts"), "third\nline\n");
    await f.call(hover);
    assert.equal(notes(f.log).filter((n) => n.method === "textDocument/didChange")[1]!.params.textDocument.version, 3);
  }
});

test("diagnostics cache reports pending, ignores stale versions, and supports pull", async (t) => {
  const f = fixture(t, "stale");
  await f.call(hover);
  const first = await f.call({ operation: "diagnostics", path: "file.ts" });
  assert.equal(first.source, "publishDiagnostics");
  assert.equal(first.version, 1);
  assert.equal(first.result[0].message, "diagnostic 中");
  assert.deepEqual(first.result[0].range.start, { line: 2, column: 3 });
  fs.writeFileSync(path.join(f.workspace, "file.ts"), "new\nabc\n");
  await f.call(hover);
  assert.equal((await f.call({ operation: "diagnostics", path: "file.ts" })).version, 2);
  const pending = fixture(t, "nodiag");
  await pending.call(hover);
  assert.equal((await pending.call({ operation: "diagnostics", path: "file.ts" })).status, "pending");
  const big = fixture(t, "bigdiag");
  await big.call(hover);
  const capped = await big.call({ operation: "diagnostics", path: "file.ts" });
  assert.equal(capped.truncated, true);
  assert.deepEqual(capped.result, []);
  const pull = fixture(t, "pull");
  const result = await pull.call({ operation: "diagnostics", path: "file.ts" });
  assert.equal(result.source, "pull");
  assert.equal(result.result.items[0].message, "pulled");
});

test("absent capabilities return unsupported and do not send method or didOpen", async (t) => {
  const f = fixture(t, "unsupported");
  const result = await f.call(hover);
  assert.equal(result.status, "unsupported");
  assert.equal(result.capability, "hoverProvider");
  assert.equal(notes(f.log).some((n) => n.method === "textDocument/hover" || n.method === "textDocument/didOpen"), false);
});

test("workspace configuration and folders requests receive minimal replies; unknown methods get -32601", async (t) => {
  const f = fixture(t, "serverrequests");
  await f.call(hover);
  await waitFor(() => notes(f.log).some((n) => n.id === "unknown" && n.error));
  const requests = notes(f.log);
  assert.deepEqual(requests.find((n) => n.id === "configuration" && n.result)!.result, [null, null]);
  assert.equal(requests.find((n) => n.id === "folders" && n.result)!.result[0].uri, pathToFileURL(fs.realpathSync(f.workspace)).href);
  assert.equal(requests.find((n) => n.id === "unknown" && n.error)!.error.code, -32601);
});

test("absolute, escaped, reserved, symlink, nonfile and oversize paths fail before spawn", async (t) => {
  const f = fixture(t);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "ccrev-lsp-out-"));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.writeFileSync(path.join(outside, "outside.ts"), "outside");
  fs.mkdirSync(path.join(f.workspace, ".agent"));
  fs.writeFileSync(path.join(f.workspace, ".agent", "private.ts"), "private");
  fs.symlinkSync(outside, path.join(f.workspace, "escape"));
  fs.symlinkSync(path.join(f.workspace, ".agent"), path.join(f.workspace, "alias"));
  fs.symlinkSync(path.join(outside, "outside.ts"), path.join(f.workspace, "escape.ts"));
  fs.mkdirSync(path.join(f.workspace, "directory.ts"));
  fs.writeFileSync(path.join(f.workspace, "large.ts"), Buffer.alloc(LSP_MAX_FILE_BYTES + 1));
  for (const file of [path.join(f.workspace, "file.ts"), "../outside.ts", ".agent/private.ts", "alias/private.ts", "escape/outside.ts", "escape.ts", "directory.ts", "large.ts", "missing.ts"]) {
    assert.equal((await f.call({ ...hover, path: file })).status, "error", file);
  }
  assert.equal(fs.existsSync(f.log), false);
  fs.symlinkSync(path.join(f.workspace, "file.ts"), path.join(f.workspace, "local.ts"));
  assert.equal((await f.call({ ...hover, path: "local.ts" })).status, "ok");
});

test("file bound allows didOpen above 1 MiB; frame, header and malformed protocol limits reap", async (t) => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.workspace, "file.ts"), "x".repeat(LSP_MAX_FILE_BYTES));
  assert.equal((await f.call({ ...hover, line: 1, column: 1 })).status, "ok");
  assert.equal(notes(f.log).find((n) => n.method === "textDocument/didOpen")!.params.textDocument.text.length, LSP_MAX_FILE_BYTES);
  assert.equal(LSP_MAX_FRAME_BYTES, 1048576);
  for (const mode of ["oversize", "header", "duplicate", "badjson", "badinit", "encoding", "badresponse"]) {
    const broken = fixture(t, mode);
    const result = await broken.call(hover);
    assert.equal(result.status, "error", mode);
    await broken.adapter.close();
    assert.equal(alive(notes(broken.log)[0]!.pid), false, mode);
  }
});

test("timeouts cancel requests, pre-aborted calls do not spawn, and per-call abort preserves server", async (t) => {
  const f = fixture(t, "hang", { requestTimeoutMs: 150 });
  const pre = new AbortController();
  pre.abort();
  assert.equal((await f.call(hover, { signal: pre.signal })).status, "aborted");
  assert.equal(fs.existsSync(f.log), false);
  assert.match((await f.call(hover)).message, /timed out/);
  await waitFor(() => notes(f.log).some((n) => n.method === "$/cancelRequest"));
  const cancel = new AbortController();
  const result = f.call(hover, { signal: cancel.signal });
  await waitFor(() => notes(f.log).filter((n) => n.method === "textDocument/hover").length === 2);
  cancel.abort();
  assert.equal((await result).status, "aborted");
  await waitFor(() => notes(f.log).filter((n) => n.method === "$/cancelRequest").length === 2);
  assert.equal(alive(notes(f.log)[0]!.pid), true);
  const init = fixture(t, "hunginit", { requestTimeoutMs: 150 });
  assert.match((await init.call(hover)).message, /timed out/);
  await init.adapter.close();
  assert.equal(alive(notes(init.log)[0]!.pid), false);
});

test("RPC errors are bounded, abnormal exit clears calls and bounded stderr", async (t) => {
  const f = fixture(t, "error");
  const result = await f.call(hover);
  assert.match(result.message, /-32602.*mock error/);
  assert.equal((await f.call(hover)).status, "error");
  const exit = fixture(t, "exitcall");
  const exited = await exit.call(hover);
  assert.equal(exited.status, "error");
  assert.ok(exited.message.length <= LSP_STDERR_CAP_BYTES + 300);
  await exit.adapter.close();
  assert.equal(alive(notes(exit.log)[0]!.pid), false);
  const missing = createLspTools({ bad: { command: path.join(f.workspace, "missing-command"), extensions: ["ts"] } }, f.context);
  t.after(() => missing.close());
  assert.match(await missing.tools[0]!.execute(hover, f.context), /ENOENT/);
});

test("close is idempotent, graceful shutdown bounded, session abort reaps server and same-group descendants", async (t) => {
  for (const mode of ["basic", "shutdownhang", "descendant"]) {
    const f = fixture(t, mode, { shutdownTimeoutMs: 100 });
    await f.call(hover);
    const pid = notes(f.log)[0]!.pid;
    if (mode === "descendant") await waitFor(() => fs.existsSync(f.ticks));
    const started = Date.now();
    await Promise.all([f.adapter.close(), f.adapter.close()]);
    assert.ok(Date.now() - started < 1500);
    assert.equal(alive(pid), false);
    const requests = notes(f.log);
    assert.equal(requests.filter((n) => n.method === "shutdown").length, 1);
    if (mode === "basic") assert.equal(requests.filter((n) => n.method === "exit").length, 1);
    if (mode === "descendant") {
      const size = fs.statSync(f.ticks).size;
      await delay(100);
      assert.equal(fs.statSync(f.ticks).size, size);
    }
    assert.equal((await f.call(hover)).status, "error");
  }
  const f = fixture(t, "hang");
  const pending = f.call(hover);
  await waitFor(() => notes(f.log).some((n) => n.method === "textDocument/hover"));
  f.session.abort();
  assert.equal((await pending).status, "error");
  await f.adapter.close();
  assert.equal(alive(notes(f.log)[0]!.pid), false);
  const pre = fixture(t);
  pre.session.abort();
  assert.equal((await pre.call(hover)).status, "aborted");
  assert.equal(fs.existsSync(pre.log), false);
});

test("abnormal leader exit sweeps descendants that inherited stdio", async (t) => {
  const f = fixture(t, "desc_exit");
  assert.equal((await f.call(hover)).status, "error");
  await f.adapter.close();
  const requests = notes(f.log);
  assert.equal(alive(requests[0]!.pid), false);
  assert.ok(requests.some((n) => n.descendant));
  const size = fs.existsSync(f.ticks) ? fs.statSync(f.ticks).size : 0;
  await delay(100);
  assert.equal(fs.existsSync(f.ticks) ? fs.statSync(f.ticks).size : 0, size);
});

test("queued cancellation and initialization cancellation settle without extra requests", async (t) => {
  const f = fixture(t, "hang", { requestTimeoutMs: 200 });
  const first = f.call(hover);
  await waitFor(() => notes(f.log).some((n) => n.method === "textDocument/hover"));
  const controller = new AbortController();
  const second = f.call(hover, { signal: controller.signal });
  controller.abort();
  assert.equal((await second).status, "aborted");
  assert.equal((await first).status, "error");
  assert.equal(notes(f.log).filter((n) => n.method === "textDocument/hover").length, 1);
  const init = fixture(t, "hunginit");
  const signal = new AbortController();
  const initializing = init.call(hover, { signal: signal.signal });
  await waitFor(() => notes(init.log).some((n) => n.method === "initialize"));
  signal.abort();
  assert.equal((await initializing).status, "aborted");
  await init.adapter.close();
  assert.equal(alive(notes(init.log)[0]!.pid), false);
});

test("diagnostic aggregate cache evicts oldest entries without claiming empty diagnostics", async (t) => {
  const f = fixture(t, "cachefill");
  for (let i = 0; i < 24; i++) {
    fs.writeFileSync(path.join(f.workspace, `cache${i}.ts`), "a\nbcd\n");
    await f.call({ ...hover, path: `cache${i}.ts` });
  }
  await f.call(hover);
  assert.equal((await f.call({ operation: "diagnostics", path: "cache0.ts" })).status, "pending");
  assert.equal((await f.call({ operation: "diagnostics", path: "cache23.ts" })).status, "ok");
});

test("output remains bounded and UTF-8 complete", async (t) => {
  const f = fixture(t, "large");
  const output = await f.adapter.tools[0]!.execute(hover, { ...f.context, maxOutputBytes: 200 });
  assert.ok(Buffer.byteLength(output) <= 200);
  assert.match(output, /truncated/);
  assert.equal(output.includes("�"), false);
  assert.equal((await f.call({ ...hover, column: 100 })).status, "error");
});
