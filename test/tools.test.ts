import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { randomUUID } from 'node:crypto';
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import { bindScopedChildTool, bindRuntimeTool, createTools, copyStableDirectoryFile, executeAgentTool, snapshotBuiltinMutationInput, type ToolContext, type ToolDefinition } from "../src/tools.js";
import { createNotebookTools } from "../src/notebooks.js";
import { publishDirectoryFile, removeDirectoryFile } from '../src/directory-file-state.js';
import { SourceReadCache } from '../src/controlled-read-projection-source.js';

const tools = createTools();
const byName = new Map(tools.map((tool) => [tool.schema.name, tool]));

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

test("edit dispatch rejects handler replacement after selection without invoking accessors", async () => {
  const context = makeContext(tmpDir());
  for (const name of ['edit_file', 'notebook_edit']) {
    for (const route of ['raw', 'wrapper', 'refresh', 'child']) {
      const raw = (name === 'edit_file' ? createTools() : createNotebookTools()).find(tool => tool.schema.name === name)!;
      let invoked = 0;
      const replace = (tool: ToolDefinition) => Object.defineProperty(tool, route === 'raw' ? 'executeBlocks' : 'execute', {
        get() { invoked++; return async () => 'substituted'; }
      });
      const tool = route === 'wrapper' || route === 'refresh' ? bindRuntimeTool(raw, {
        checkScope() {}, refresh() { if (route === 'refresh') replace(raw); }, checkJournal() {}
      }) : raw;
      const input = snapshotBuiltinMutationInput(tool, {path:'selected'});
      if (route === 'child') {
        const child = bindScopedChildTool(raw, async () => { replace(raw); return context; }, 'after-approval');
        await assert.rejects(child.execute(input, context), /implementation changed/);
      } else {
        if (route !== 'refresh') replace(tool);
        await assert.rejects(executeAgentTool(tool, input, context), /implementation changed/);
      }
      assert.equal(invoked, 0);
    }
  }
});

test("runtime wrapper rejects a generic handler introduced by refresh", async () => {
  const raw = createTools().find(value => value.schema.name === 'read_file')!;
  const original = raw.execute;
  let effect = false;
  const wrapper = bindRuntimeTool(raw, { checkScope() {}, refresh() {
    raw.execute = async () => { effect = true; return 'substituted'; };
  }, checkJournal() {} });
  try {
    await assert.rejects(wrapper.execute({ path: 'missing' }, makeContext(tmpDir())), /implementation changed/);
    assert.equal(effect, false);
  } finally { raw.execute = original; }
});

test("scoped child rejects a generic handler introduced during approval", async () => {
  const raw = createTools().find(value => value.schema.name === 'read_file')!;
  const original = raw.execute;
  let effect = false;
  const context = makeContext(tmpDir());
  const scoped = bindScopedChildTool(raw, async () => {
    raw.execute = async () => { effect = true; return 'substituted'; };
    return context;
  });
  try {
    await assert.rejects(scoped.execute({ path: 'missing' }, context), /implementation changed/);
    assert.equal(effect, false);
  } finally { raw.execute = original; }
});

test("child approval retains the selected Edit and NotebookEdit input across awaited callbacks", async () => {
  const ws = tmpDir();
  for (const definition of [tool('edit_file'), createNotebookTools().find(value => value.schema.name === 'notebook_edit')!]) {
    const notebook = definition.schema.name === 'notebook_edit';
    const original = notebook ? JSON.stringify({nbformat:4,nbformat_minor:5,cells:[{id:'a',cell_type:'markdown',source:'before'}]}) : 'before';
    const extension = notebook ? '.ipynb' : '.txt';
    const selected = 'selected' + extension, other = 'other' + extension;
    fs.writeFileSync(path.join(ws, selected), original);
    fs.writeFileSync(path.join(ws, other), original);
    const input = notebook ? {path:selected,cell_id:'a',new_source:'approved'} : {path:selected,old_string:'before',new_string:'approved'};
    const wrapped = bindRuntimeTool(definition, {checkScope() {}, refresh() {}, checkJournal() {}});
    const scoped = bindScopedChildTool(wrapped, async (checked, context) => {
      assert.equal((checked as {path:string}).path, selected);
      await Promise.resolve();
      Object.assign(input,{path:other},notebook ? {new_source:'substituted'} : {new_string:'substituted'});
      return context;
    });
    await executeAgentTool(scoped, input, makeContext(ws));
    assert.equal(fs.readFileSync(path.join(ws, other), 'utf8'), original);
    assert.match(fs.readFileSync(path.join(ws, selected), 'utf8'), /approved/);
  }
});

const tempDirs: string[] = [];
function tmpDir(prefix = "ccrev-"): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}
after(() => {
  for (const dir of tempDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

function tool(name: string): ToolDefinition {
  const found = byName.get(name);
  assert.ok(found, `tool ${name} is missing`);
  return found;
}
function run(name: string, input: unknown, context: ToolContext): Promise<string> {
  return tool(name).execute(input, context);
}
function makeContext(workspace: string, overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    workspace,
    signal: new AbortController().signal,
    allowShell: false,
    maxOutputBytes: 100_000,
    ...overrides,
  };
}
function write(ws: string, rel: string, content: string): void {
  const target = path.join(ws, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}
function read(ws: string, rel: string): string {
  return fs.readFileSync(path.join(ws, rel), "utf8");
}

test("createTools exposes the expected tool set with correct read-only flags", () => {
  assert.deepEqual(
    [...byName.keys()].sort(),
    ["edit_file", "list_files", "read_file", "run_command", "search", "write_file"],
  );
  assert.equal(tool("read_file").readOnly, true);
  assert.equal(tool("list_files").readOnly, true);
  assert.equal(tool("search").readOnly, true);
  assert.equal(tool("write_file").readOnly, false);
  assert.equal(tool("edit_file").readOnly, false);
  assert.equal(tool("run_command").readOnly, false);

  const schema = tool("read_file").schema;
  assert.equal(schema.input_schema.type, "object");
  assert.equal(schema.name, "read_file");
});

test("read_file returns the requested 1-based line range", async () => {
  const ws = tmpDir();
  write(ws, "a.txt", "l1\nl2\nl3\nl4\n");

  assert.equal(await run("read_file", { path: "a.txt" }, makeContext(ws)), "l1\nl2\nl3\nl4\n");
  assert.equal(await run("read_file", { path: "a.txt", offset: 2, limit: 2 }, makeContext(ws)), "l2\nl3");
  assert.equal(await run("read_file", { path: "a.txt", offset: 10 }, makeContext(ws)), "");
});

test('directory descriptor Read remains on the opened directory and rejects escapes', async () => {
  const ws = fs.realpathSync(tmpDir());
  const approved = path.join(ws, 'approved');
  write(ws, 'approved/sub/file.txt', 'original\nsecond\n');
  const fd = fs.openSync(approved, fs.constants.O_RDONLY);
  try {
    fs.renameSync(approved, path.join(ws, 'moved'));
    write(ws, 'approved/sub/file.txt', 'replacement');
    const ctx = makeContext(ws, { verifiedReadDirectory: { fd, root: approved } });
    assert.equal(await run('read_file', { path: 'approved/sub/file.txt' }, ctx), 'original\nsecond\n');
    assert.equal(await run('read_file', { path: 'approved/sub/file.txt', offset: 2, limit: 1 }, ctx), 'second');
    assert.equal(await run('read_file', { path: 'approved/sub/file.txt' }, makeContext(ws)), 'replacement');
    fs.symlinkSync('sub', path.join(ws, 'moved', 'link'));
    fs.symlinkSync('file.txt', path.join(ws, 'moved', 'sub', 'leaf'));
    const helper = path.resolve('native/directory-read/read');
    for (const name of ['../approved/sub/file.txt', '/etc/passwd', 'link/file.txt', 'sub/leaf', 'sub/../../approved/sub/file.txt']) {
      const child = spawnSync(helper, [name], { stdio: ['ignore', 'pipe', 'pipe', fd, 'pipe'] });
      assert.notEqual(child.status, 0, name);
      assert.equal(child.stdout.length, 0, name);
    }
    const unsupported = path.join(ws, 'unsupported-helper');
    execFileSync('cc', ['-std=c11', '-Wall', '-Wextra', '-Werror', '-DDIRECTORY_READ_UNSUPPORTED', '-o', unsupported, 'native/directory-read/read.c']);
    assert.equal(spawnSync(unsupported, ['sub/file.txt'], { stdio: ['ignore', 'pipe', 'pipe', fd, 'pipe'] }).status, 78);
    const cancelled = new AbortController();
    cancelled.abort();
    await assert.rejects(run('read_file', { path: 'approved/sub/file.txt' }, { ...ctx, signal: cancelled.signal }), /abort/i);
  } finally { fs.closeSync(fd); }
});

test('directory descriptor backup probe distinguishes a missing leaf from invalid ancestry', () => {
  const ws = fs.realpathSync(tmpDir());
  fs.mkdirSync(path.join(ws, 'sub'));
  fs.symlinkSync('sub', path.join(ws, 'link'));
  const fd = fs.openSync(ws, fs.constants.O_RDONLY);
  try {
    const helper = path.resolve('native/directory-read/read');
    const probe = (name: string) => spawnSync(helper, ['--probe-missing', name],
      { stdio: ['ignore', 'pipe', 'pipe', fd, 'pipe'] });
    const missing = probe('sub/missing');
    assert.equal(missing.status, 0);
    assert.equal(missing.stdout.length, 0);
    assert.match(String(missing.output[4]), /^v1 missing [0-9]+ [0-9]+ [0-9]+ -?[0-9]+ [0-9]+ -?[0-9]+ [0-9]+\n$/);
    for (const name of ['absent/leaf', 'link/leaf', '../escape', '/absent']) {
      const invalid = probe(name);
      assert.notEqual(invalid.status, 0, name);
      assert.doesNotMatch(String(invalid.output[4]), /v1 missing/, name);
    }
    write(ws, 'sub/existing', 'value');
    const existing = probe('sub/existing');
    assert.notEqual(existing.status, 0);
    assert.doesNotMatch(String(existing.output[4]), /v1 missing/);
  } finally { fs.closeSync(fd); }
});

test('directory backup stream copies all binary bytes from the pinned directory', async () => {
  const root = fs.realpathSync(tmpDir());
  const grant = path.join(root, 'grant');
  fs.mkdirSync(grant);
  fs.mkdirSync(path.join(grant, 'sub'));
  const original = Buffer.alloc(2 * 1024 * 1024 + 17);
  for (let i = 0; i < original.length; i++) original[i] = i % 251;
  fs.writeFileSync(path.join(grant, 'sub', 'data'), original, { mode: 0o751 });
  const fd = fs.openSync(grant, 'r');
  const destination = await fs.promises.open(path.join(root, 'sidecar'), 'wx+', 0o600);
  try {
    fs.renameSync(grant, path.join(root, 'moved'));
    fs.mkdirSync(grant);
    fs.mkdirSync(path.join(grant, 'sub'));
    fs.writeFileSync(path.join(grant, 'sub', 'data'), 'replacement');
    const result = await copyStableDirectoryFile({ fd, relative: 'sub/data' }, destination, new AbortController().signal);
    assert.deepEqual(fs.readFileSync(path.join(root, 'sidecar')), original);
    assert.equal(result.bytes, original.length);
    assert.equal(result.sha256, (await import('node:crypto')).createHash('sha256').update(original).digest('hex'));
    const stat = fs.statSync(path.join(root, 'moved', 'sub', 'data'), { bigint: true });
    assert.equal(result.metadata.dev, String(stat.dev));
    assert.equal(result.metadata.ino, String(stat.ino));
    assert.equal(result.metadata.mode, 0o751);
    assert.equal(result.metadata.nlink, String(stat.nlink));
    const parent = fs.statSync(path.join(root, 'moved', 'sub'), { bigint: true });
    assert.deepEqual(result.metadata.parent, { dev: String(parent.dev), ino: String(parent.ino) });
    const aborted = new AbortController(); aborted.abort();
    await assert.rejects(copyStableDirectoryFile({ fd, relative: 'data' }, destination, aborted.signal));
  } finally { await destination.close(); fs.closeSync(fd); }
});

test('directory backup stream rejects zero-progress writes and failed sync', async () => {
  const root = fs.realpathSync(tmpDir());
  fs.writeFileSync(path.join(root, 'data'), Buffer.alloc(128 * 1024, 42));
  const fd = fs.openSync(root, 'r');
  try {
    for (const fault of ['write', 'sync'] as const) {
      const destination = await fs.promises.open(path.join(root, `sidecar-${fault}`), 'wx+', 0o600);
      try {
        if (fault === 'write') Object.defineProperty(destination, 'write', { value: async () => ({ bytesWritten: 0, buffer: Buffer.alloc(0) }) });
        else destination.sync = async () => { throw new Error('injected sync failure'); };
        await assert.rejects(copyStableDirectoryFile({ fd, relative: 'data' }, destination, new AbortController().signal),
          fault === 'write' ? /short write/ : /injected sync failure/);
      } finally { await destination.close(); }
    }
  } finally { fs.closeSync(fd); }
});

test('bound directory publication uses prior descriptor state and restores bytes and mode', async () => {
  const root = fs.realpathSync(tmpDir()), grant = path.join(root, 'grant');
  fs.mkdirSync(grant); fs.mkdirSync(path.join(grant, 'sub'));
  const original = Buffer.from([0, 255, 67, 10, 128]), target = path.join(grant, 'sub', 'data');
  fs.writeFileSync(target, original, { mode: 0o751 });
  const fd = fs.openSync(grant, 'r');
  const before = await fs.promises.open(path.join(root, 'before'), 'wx+', 0o600);
  const current = await fs.promises.open(path.join(root, 'current'), 'wx+', 0o600);
  try {
    const backup = await copyStableDirectoryFile({ fd, relative: 'sub/data' }, before, new AbortController().signal);
    const invalid = publishDirectoryFile({ fd: -1, relative: 'sub/data', expected: backup.metadata, content: Buffer.from('INVALID') });
    assert.equal(invalid.kind, 'not_published', JSON.stringify(invalid));
    assert.deepEqual(fs.readFileSync(target), original);
    const published = publishDirectoryFile({ fd, relative: 'sub/data', expected: backup.metadata, content: Buffer.from('NEW_BYTES') });
    assert.equal(published.kind, 'durable', JSON.stringify(published));
    assert.equal(fs.readFileSync(target, 'utf8'), 'NEW_BYTES');
    assert.equal(fs.statSync(target).mode & 0o7777, 0o751);
    const stale = publishDirectoryFile({ fd, relative: 'sub/data', expected: backup.metadata, content: Buffer.from('STALE') });
    assert.equal(stale.kind, 'not_published', JSON.stringify(stale));
    assert.equal(fs.readFileSync(target, 'utf8'), 'NEW_BYTES');
    fs.chmodSync(target, 0o600);
    const changed = await copyStableDirectoryFile({ fd, relative: 'sub/data' }, current, new AbortController().signal);
    const restored = publishDirectoryFile({ fd, relative: 'sub/data', expected: changed.metadata, content: original, mode: backup.metadata.mode });
    assert.equal(restored.kind, 'durable', JSON.stringify(restored));
    assert.deepEqual(fs.readFileSync(target), original);
    assert.equal(fs.statSync(target).mode & 0o7777, 0o751);
    if (restored.kind === 'durable') {
      const stat = fs.statSync(target, { bigint: true });
      assert.equal(restored.observation.ino, String(stat.ino));
      assert.equal(restored.observation.mode, 0o751);
      assert.deepEqual(restored.observation.parent, backup.metadata.parent);
    }
  } finally { await before.close(); await current.close(); fs.closeSync(fd); }
});

test('bound directory removal checks the current target and retains uncertain effects', async () => {
  const root = fs.realpathSync(tmpDir()), target = path.join(root, 'value'), fd = fs.openSync(root, 'r');
  const helper = path.join(root, 'write-test');
  execFileSync('cc', ['-std=c11', '-Wall', '-Wextra', '-Werror', '-O2', '-DDIRECTORY_WRITE_TEST', '-o', helper, 'native/directory-write/write.c']);
  try {
    for (const scenario of ['durable', 'stale', 'hardlink', 'death', 'death-capture', 'collision', 'wrong-bytes', 'wrong-size', 'large', 'post-write', 'empty', 'uppercase-id'] as const) {
      const original = scenario === 'large' ? Buffer.alloc(2 * 1024 * 1024 + 17, 0xa5) : scenario === 'empty' ? Buffer.alloc(0) : Buffer.from('ORIGINAL');
      if (scenario === 'large') { original[0] = 0; original[original.length - 1] = 255; }
      fs.writeFileSync(target, original);
      const sidecar = await fs.promises.open(path.join(root, `${scenario}.backup`), 'wx+', 0o600);
      const priorWriter = scenario === 'post-write' ? fs.openSync(target, 'r+') : undefined;
      try {
        const backup = await copyStableDirectoryFile({ fd, relative: 'value' }, sidecar, new AbortController().signal);
        const transactionId = scenario === 'uppercase-id' ? randomUUID().toUpperCase() : randomUUID(), expectedBytes = scenario === 'wrong-bytes' ? Buffer.from('MUTATED!') :
          scenario === 'wrong-size' ? Buffer.from('SHORT') : original;
        const quarantine = path.join(root, `.litcode-remove-${transactionId}`);
        if (scenario === 'stale') fs.writeFileSync(target, 'REPLACED');
        if (scenario === 'hardlink') fs.linkSync(target, path.join(root, 'link'));
        if (scenario === 'collision') { fs.mkdirSync(quarantine); fs.writeFileSync(path.join(quarantine, 'foreign'), 'KEEP'); }
        let result: ReturnType<typeof removeDirectoryFile>;
        if (scenario === 'death' || scenario === 'death-capture') {
          const nativeSpawn = childProcess.spawnSync;
          Object.defineProperty(childProcess, 'spawnSync', { configurable: true, writable: true,
            value: (_file: unknown, args: unknown, options: object) => Reflect.apply(nativeSpawn, childProcess, [helper, args, {
              ...options, env: { ...process.env, DIRECTORY_WRITE_TEST_POINT: scenario === 'death' ? 'remove_after_quarantine' : 'remove_after_capture', DIRECTORY_WRITE_TEST_SELF_KILL: '1' },
            }]) });
          syncBuiltinESMExports();
          try { result = removeDirectoryFile({ fd, relative: 'value', expected: backup.metadata, expectedBytes, transactionId }); }
          finally {
            Object.defineProperty(childProcess, 'spawnSync', { configurable: true, writable: true, value: nativeSpawn });
            syncBuiltinESMExports();
          }
        } else result = removeDirectoryFile({ fd, relative: 'value', expected: backup.metadata, expectedBytes, transactionId });
        assert.equal(result.kind, ['durable', 'large', 'post-write', 'empty', 'uppercase-id'].includes(scenario) ? 'quarantined' : ['death', 'death-capture', 'wrong-bytes'].includes(scenario) ? 'unknown' : 'not_removed');
        if (result.kind === 'unknown' || result.kind === 'quarantined') assert.equal(result.transactionId, transactionId);
        assert.equal(fs.existsSync(target), !['durable', 'death', 'death-capture', 'wrong-bytes', 'large', 'post-write', 'empty', 'uppercase-id'].includes(scenario), scenario);
        if (scenario === 'stale') assert.equal(fs.readFileSync(target, 'utf8'), 'REPLACED');
        if (scenario === 'hardlink') { assert.equal(fs.readFileSync(path.join(root, 'link'), 'utf8'), 'ORIGINAL'); fs.unlinkSync(path.join(root, 'link')); }
        if (scenario === 'collision') assert.equal(fs.readFileSync(path.join(quarantine, 'foreign'), 'utf8'), 'KEEP');
        if (['durable', 'large', 'death', 'death-capture', 'wrong-bytes', 'post-write', 'empty', 'uppercase-id'].includes(scenario)) assert.deepEqual(fs.readFileSync(path.join(quarantine, 'held')), original);
        if (result.kind === 'quarantined') {
          const held = fs.statSync(path.join(quarantine, 'held'), { bigint: true }), directory = fs.statSync(quarantine, { bigint: true });
          assert.equal(result.observation.ino, String(held.ino));
          assert.deepEqual(result.observation.parent, { dev: String(directory.dev), ino: String(directory.ino) });
        }
        if (priorWriter !== undefined) {
          fs.writeSync(priorWriter, Buffer.from('MUTATED!'), 0, 8, 0); fs.fsyncSync(priorWriter);
          assert.equal(fs.readFileSync(path.join(quarantine, 'held'), 'utf8'), 'MUTATED!');
        }
        assert.deepEqual(fs.readFileSync(path.join(root, `${scenario}.backup`)), original);
      } finally { if (priorWriter !== undefined) fs.closeSync(priorWriter); await sidecar.close(); }
      if (fs.existsSync(target)) fs.unlinkSync(target);
    }
  } finally { fs.closeSync(fd); }
});

test('bound directory publication refuses a different parent holding the same hard-linked file', async () => {
  const root = fs.realpathSync(tmpDir());
  fs.mkdirSync(path.join(root, 'approved')); fs.mkdirSync(path.join(root, 'replacement'));
  const original = Buffer.from('PARENT_BOUND_BYTES');
  fs.writeFileSync(path.join(root, 'approved/data'), original, { mode: 0o751 });
  fs.linkSync(path.join(root, 'approved/data'), path.join(root, 'replacement/data'));
  const fd = fs.openSync(root, 'r'), sidecar = await fs.promises.open(path.join(root, 'backup'), 'wx+', 0o600);
  try {
    const backup = await copyStableDirectoryFile({ fd, relative: 'approved/data' }, sidecar, new AbortController().signal);
    fs.renameSync(path.join(root, 'approved'), path.join(root, 'original'));
    fs.renameSync(path.join(root, 'replacement'), path.join(root, 'approved'));
    const result = publishDirectoryFile({ fd, relative: 'approved/data', expected: backup.metadata, content: Buffer.from('REPLACEMENT_WRITE') });
    assert.equal(result.kind, 'not_published', JSON.stringify(result));
    assert.deepEqual(fs.readFileSync(path.join(root, 'approved/data')), original);
    assert.deepEqual(fs.readFileSync(path.join(root, 'original/data')), original);
  } finally { await sidecar.close(); fs.closeSync(fd); }
});

test('bound directory publication retains unknown on process death around rename', async () => {
  const root = fs.realpathSync(tmpDir()), helper = path.join(root, 'write-test');
  execFileSync('cc', ['-std=c11', '-Wall', '-Wextra', '-Werror', '-O2', '-DDIRECTORY_WRITE_TEST',
    '-o', helper, 'native/directory-write/write.c']);
  const fd = fs.openSync(root, 'r');
  try {
    for (const phase of ['before_rename', 'after_rename'] as const) {
      const target = path.join(root, phase), original = Buffer.from('ORIGINAL_PROCESS_DEATH');
      fs.writeFileSync(target, original, { mode: 0o751 });
      const sidecar = await fs.promises.open(path.join(root, `${phase}.backup`), 'wx+', 0o600);
      try {
        const backup = await copyStableDirectoryFile({ fd, relative: phase }, sidecar, new AbortController().signal);
        const nativeSpawn = childProcess.spawnSync;
        let result: ReturnType<typeof publishDirectoryFile>;
        Object.defineProperty(childProcess, 'spawnSync', { configurable: true, writable: true,
          value: (_file: unknown, args: unknown, options: object) => Reflect.apply(nativeSpawn, childProcess, [helper, args, {
            ...options, env: { ...process.env, DIRECTORY_WRITE_TEST_POINT: phase, DIRECTORY_WRITE_TEST_SELF_KILL: '1' },
          }]) });
        syncBuiltinESMExports();
        try { result = publishDirectoryFile({ fd, relative: phase, expected: backup.metadata, content: Buffer.from('NEW_AFTER_DEATH') }); }
        finally {
          Object.defineProperty(childProcess, 'spawnSync', { configurable: true, writable: true, value: nativeSpawn });
          syncBuiltinESMExports();
        }
        assert.equal(result.kind, 'unknown', `${phase}: ${JSON.stringify(result)}`);
        assert.deepEqual(fs.readFileSync(target), phase === 'before_rename' ? original : Buffer.from('NEW_AFTER_DEATH'));
        assert.deepEqual(fs.readFileSync(path.join(root, `${phase}.backup`)), original);
      } finally { await sidecar.close(); }
    }
  } finally { fs.closeSync(fd); }
});

test('directory Read reports same-descriptor changes after a blocked stream', async () => {
  const root = fs.realpathSync(tmpDir());
  const dir = path.join(root, 'grant');
  fs.mkdirSync(dir);
  const fd = fs.openSync(dir, fs.constants.O_RDONLY);
  const file = path.join(dir, 'data');
  const helper = path.resolve('native/directory-read/read');
  const bytes = Buffer.alloc(4 * 1024 * 1024, 65);
  try {
    for (const action of ['rewrite', 'truncate', 'replace-directory'] as const) {
      fs.writeFileSync(file, bytes);
      const child = spawn(helper, ['data'], { stdio: ['ignore', 'pipe', 'ignore', fd, 'pipe'] });
      const meta = child.stdio[4];
      assert.ok(meta && 'read' in meta);
      assert.ok(child.stdout);
      let status = '';
      const begun = new Promise<void>((resolve, reject) => {
        meta.on('data', chunk => { status += String(chunk); if (status.includes('\n')) resolve(); });
        child.once('error', reject);
      });
      const exited = new Promise<number | null>((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
      await begun;
      if (action === 'rewrite') {
        const target = fs.openSync(file, 'r+');
        try { fs.writeSync(target, Buffer.from('changed'), 0, 7, 0); } finally { fs.closeSync(target); }
      } else if (action === 'truncate') fs.truncateSync(file, 32);
      else {
        fs.renameSync(dir, path.join(root, 'moved'));
        fs.mkdirSync(dir);
        fs.writeFileSync(file, 'replacement');
      }
      let count = 0;
      for await (const chunk of child.stdout) count += Buffer.byteLength(chunk);
      assert.equal(await exited, 0);
      assert.match(status, /^v1 begin [^\n]+\nv1 (?:stable|changed) [^\n]+\n$/);
      assert.match(status, action === 'replace-directory' ? /\nv1 stable / : /\nv1 changed /);
      if (action === 'replace-directory') assert.equal(count, bytes.length);
    }
  } finally { fs.closeSync(fd); }
});

test('directory Read consumer rejects a changed descriptor and marks early windows partial', async () => {
  const root = fs.realpathSync(tmpDir());
  const dir = path.join(root, 'grant');
  fs.mkdirSync(dir);
  const file = path.join(dir, 'data');
  fs.writeFileSync(file, Buffer.alloc(4 * 1024 * 1024, 65));
  const fd = fs.openSync(dir, fs.constants.O_RDONLY);
  const originalSpawn = childProcess.spawn;
  let mutated = false;
  childProcess.spawn = ((...args: Parameters<typeof originalSpawn>) => {
    const child = originalSpawn(...args);
    if (String(args[0]).endsWith('/native/directory-read/read')) {
      const meta = child.stdio[4];
      assert.ok(meta && 'on' in meta);
      meta.once('data', () => { fs.truncateSync(file, 16); mutated = true; });
    }
    return child;
  }) as typeof originalSpawn;
  syncBuiltinESMExports();
  try {
    const ctx = makeContext(root, { verifiedReadDirectory: { fd, root: dir } });
    await assert.rejects(run('read_file', { path: 'grant/data', offset: 2 }, ctx), /changed during read/);
    assert.equal(mutated, true);
  } finally {
    childProcess.spawn = originalSpawn;
    syncBuiltinESMExports();
  }
  try {
    fs.writeFileSync(file, 'one\ntwo\nthree');
    const events: unknown[] = [];
    const ctx = makeContext(root, { verifiedReadDirectory: { fd, root: dir }, hostResult: value => events.push(value) });
    assert.equal(await run('read_file', { path: 'grant/data', limit: 1 }, ctx), 'one');
    assert.match(JSON.stringify(events), /"truncated":true/);
  } finally { fs.closeSync(fd); }
});

test("read_file truncates output at maxOutputBytes and notes it", async () => {
  const ws = tmpDir();
  write(ws, "big.txt", Array.from({ length: 200 }, (_, i) => `line-${i}`).join("\n"));

  const out = await run("read_file", { path: "big.txt" }, makeContext(ws, { maxOutputBytes: 32 }));
  assert.match(out, /read_file: output truncated/);
  assert.ok(Buffer.byteLength(out, "utf8") < 200, "output should be small");
});

test("file tools reject a symlink escape (final and ancestor)", async () => {
  const ws = tmpDir();
  const outside = tmpDir();
  write(outside, "secret.txt", "TOP SECRET");

  // Direct file symlink pointing outside the workspace.
  fs.symlinkSync(path.join(outside, "secret.txt"), path.join(ws, "link.txt"));
  await assert.rejects(run("read_file", { path: "link.txt" }, makeContext(ws)), /escapes/);

  // Directory symlink used as an ancestor component.
  fs.symlinkSync(outside, path.join(ws, "outdir"));
  await assert.rejects(run("read_file", { path: "outdir/secret.txt" }, makeContext(ws)), /escapes/);
  await assert.rejects(run("search", { pattern: "SECRET", path: "outdir" }, makeContext(ws)), /escapes/);
  await assert.rejects(run("list_files", { path: "outdir" }, makeContext(ws)), /escapes/);

  // A write through a symlinked directory must not create anything outside.
  await assert.rejects(
    run("write_file", { path: "outdir/planted.txt", content: "x" }, makeContext(ws)),
    /escapes/,
  );
  assert.equal(fs.existsSync(path.join(outside, "planted.txt")), false);
});

test("file tools reject paths that escape lexically", async () => {
  const ws = tmpDir();
  await assert.rejects(run("read_file", { path: "../outside.txt" }, makeContext(ws)), /escapes/);
  await assert.rejects(run("read_file", { path: path.join(ws, "abs.txt") }, makeContext(ws)), /escapes/);
});

test("file tools refuse the reserved .agent directory", async () => {
  const ws = tmpDir();
  write(ws, ".agent/x.txt", "hidden");
  await assert.rejects(run("read_file", { path: ".agent/x.txt" }, makeContext(ws)), /\.agent/);
  await assert.rejects(run("write_file", { path: ".agent/y.txt", content: "z" }, makeContext(ws)), /\.agent/);
});

test("an in-workspace symlink that stays inside is followed", async () => {
  const ws = tmpDir();
  write(ws, "real.txt", "content");
  fs.symlinkSync(path.join(ws, "real.txt"), path.join(ws, "alias.txt"));
  assert.equal(await run("read_file", { path: "alias.txt" }, makeContext(ws)), "content");
});

test('Write baseline checks precede history and successful publication updates cache before host result', async () => {
  const ws = fs.realpathSync(tmpDir()), file = path.join(ws, 'value'), cache = new SourceReadCache(8);
  fs.writeFileSync(file, 'ORIGINAL');
  let history = 0, results = 0;
  const context = makeContext(ws, { readFileCache: cache,
    fileMutationGate: { preReadGuard: true, readAllowed: () => true },
    fileHistory: () => { history++; assert.equal(fs.readFileSync(file, 'utf8'), 'ORIGINAL'); },
    hostResult: result => {
      results++; assert.equal(history, 1); assert.equal(cache.get(file)?.content, 'NEXT');
      assert.match(JSON.stringify(result), /ORIGINAL/); assert.match(JSON.stringify(result), /NEXT/);
    } });
  const input = { path: 'value', content: 'NEXT', overwrite: true };
  await assert.rejects(run('write_file', input, context), /not been read in full/);
  cache.set(file, { content: 'ORIGINAL', timestamp: 0, isPartialView: true });
  await assert.rejects(run('write_file', input, context), /not been read in full/);
  cache.set(file, { content: 'STALE', timestamp: 0 });
  await assert.rejects(run('write_file', input, context), /modified since read/);
  assert.equal(history, 0); assert.equal(results, 0); assert.equal(fs.readFileSync(file, 'utf8'), 'ORIGINAL');
  cache.set(file, { content: 'ORIGINAL', timestamp: 0 });
  cache.set(path.join(ws, 'alias'), { content: 'ORIGINAL', timestamp: 0 });
  await run('write_file', input, context);
  assert.equal(fs.readFileSync(file, 'utf8'), 'NEXT'); assert.equal(cache.has(path.join(ws, 'alias')), false);
  assert.equal(history, 1); assert.equal(results, 1);
});

test("write_file is atomic, refuses overwrite by default, and preserves mode", async () => {
  const ws = tmpDir();

  await run("write_file", { path: "nested/dir/w.txt", content: "one" }, makeContext(ws));
  assert.equal(read(ws, "nested/dir/w.txt"), "one");

  await assert.rejects(
    run("write_file", { path: "nested/dir/w.txt", content: "two" }, makeContext(ws)),
    /already exists/,
  );
  assert.equal(read(ws, "nested/dir/w.txt"), "one");

  fs.chmodSync(path.join(ws, "nested/dir/w.txt"), 0o600);
  await run("write_file", { path: "nested/dir/w.txt", content: "two", overwrite: true }, makeContext(ws));
  assert.equal(read(ws, "nested/dir/w.txt"), "two");
  assert.equal(fs.statSync(path.join(ws, "nested/dir/w.txt")).mode & 0o777, 0o600);

  // No temporary files left behind by the atomic write.
  const leftovers = fs.readdirSync(path.join(ws, "nested/dir")).filter((name) => name.includes(".tmp"));
  assert.deepEqual(leftovers, []);
});

test("the write tools land the verified byte count on disk", async () => {
  const ws = tmpDir();
  const multibyte = "héllo — 世界\n";

  await run("write_file", { path: "u.txt", content: multibyte }, makeContext(ws));
  assert.equal(read(ws, "u.txt"), multibyte);
  assert.equal(fs.statSync(path.join(ws, "u.txt")).size, Buffer.byteLength(multibyte, "utf8"));

  // An edit that shortens a file leaves no tail of the longer content behind.
  fs.writeFileSync(path.join(ws, "shrink.txt"), "x".repeat(4000));
  await run("edit_file", { path: "shrink.txt", old_string: "x".repeat(4000), new_string: "two\n" },
    makeContext(ws));
  assert.equal(read(ws, "shrink.txt"), "two\n");
  assert.equal(fs.statSync(path.join(ws, "shrink.txt")).size, 4);

  // The tool refuses a non-regular target before any write is attempted, so the
  // kept-content refusal belongs to the writer and is covered there.
  fs.mkdirSync(path.join(ws, "occupied"));
  await assert.rejects(
    run("write_file", { path: "occupied", content: "x", overwrite: true }, makeContext(ws)),
    /not a regular file/,
  );

  const leftovers = fs.readdirSync(ws).filter((name) => name.includes(".tmp"));
  assert.deepEqual(leftovers, []);
});

test("edit_file preserves encoding and newline style and refuses lossy text", async () => {
  const ws = tmpDir();
  for (const encoding of ['utf8', 'utf16le'] as const) {
    const file = path.join(ws, encoding);
    fs.writeFileSync(file, Buffer.from('\uFEFFalpha\r\nbeta\r\ngamma\r\n', encoding));
    await run('edit_file', { path: encoding, old_string: 'alpha\nbeta', new_string: 'first\nsecond' }, makeContext(ws));
    await run('edit_file', { path: encoding, old_string: 'second', new_string: '' }, makeContext(ws));
    assert.deepEqual(fs.readFileSync(file), Buffer.from('\uFEFFfirst\r\ngamma\r\n', encoding));
  }
  const bytes = Buffer.from([0xff, 0x41]);
  fs.writeFileSync(path.join(ws, 'invalid'), bytes);
  await assert.rejects(run('edit_file', { path: 'invalid', old_string: 'A', new_string: 'B' }, makeContext(ws)), /encoding|UTF-8/i);
  assert.deepEqual(fs.readFileSync(path.join(ws, 'invalid')), bytes);
});

test("edit_file requires a unique match and supports replace_all", async () => {
  const ws = tmpDir();
  write(ws, "e.txt", "alpha\nbeta\nalpha\n");

  await assert.rejects(
    run("edit_file", { path: "e.txt", old_string: "alpha", new_string: "X" }, makeContext(ws)),
    /not unique/,
  );
  await assert.rejects(
    run("edit_file", { path: "e.txt", old_string: "zzz", new_string: "q" }, makeContext(ws)),
    /not found/,
  );

  await run("edit_file", { path: "e.txt", old_string: "beta", new_string: "B" }, makeContext(ws));
  assert.equal(read(ws, "e.txt"), "alpha\nB\nalpha\n");

  await run("edit_file", { path: "e.txt", old_string: "alpha", new_string: "A", replace_all: true }, makeContext(ws));
  assert.equal(read(ws, "e.txt"), "A\nB\nA\n");
});

test("edit_file preserves the matched quote and Unicode escape spellings", async () => {
  const ws = tmpDir();
  write(ws, 'styled.txt', '“old” and \\u00E9\n');
  await run('edit_file', { path: 'styled.txt', old_string: '"old"', new_string: '"new"' }, makeContext(ws));
  await run('edit_file', { path: 'styled.txt', old_string: 'é', new_string: 'éè' }, makeContext(ws));
  assert.equal(read(ws, 'styled.txt'), '“new” and \\u00E9\\u00E8\n');
});

test("list_files lists workspace-relative paths, honors glob and limit", async () => {
  const ws = tmpDir();
  write(ws, "root.ts", "");
  write(ws, "src/a.ts", "");
  write(ws, "src/b.ts", "");
  write(ws, "src/c.txt", "");

  const all = await run("list_files", {}, makeContext(ws));
  assert.match(all, /^root\.ts$/m);
  assert.match(all, /^src\/a\.ts$/m);

  const tsOnly = await run("list_files", { glob: "*.ts" }, makeContext(ws));
  assert.match(tsOnly, /src\/a\.ts/);
  assert.doesNotMatch(tsOnly, /c\.txt/);

  const limited = await run("list_files", { limit: 2 }, makeContext(ws));
  assert.match(limited, /truncated at limit 2/);
});

test("search finds literal matches, supports regex and limit", async () => {
  const ws = tmpDir();
  write(ws, "s.txt", "hello world\nfoo bar\nHELLO again\n");

  const literal = await run("search", { pattern: "hello" }, makeContext(ws));
  assert.match(literal, /s\.txt:1:hello world/);
  assert.doesNotMatch(literal, /HELLO again/);

  const regex = await run("search", { pattern: "(?i)hello", regex: true }, makeContext(ws));
  assert.match(regex, /s\.txt:1:hello world/);
  assert.match(regex, /s\.txt:3:HELLO again/);

  assert.equal(await run("search", { pattern: "zzzznomatch" }, makeContext(ws)), "");

  write(ws, "many.txt", Array.from({ length: 10 }, (_, i) => `hit ${i}`).join("\n"));
  const limited = await run("search", { pattern: "hit", limit: 3 }, makeContext(ws));
  assert.match(limited, /truncated at limit 3/);
});

test("input is validated strictly by zod", async () => {
  const ws = tmpDir();
  write(ws, "a.txt", "x");
  await assert.rejects(run("read_file", { path: "a.txt", bogus: true }, makeContext(ws)));
  await assert.rejects(run("read_file", { path: "a.txt", limit: 99999 }, makeContext(ws)));
});

test("run_command refuses to run when allowShell is false", async () => {
  const ws = tmpDir();
  await assert.rejects(
    run("run_command", { command: "echo hi" }, makeContext(ws)),
    /shell access is disabled/,
  );
});

test("run_command combines stdout/stderr and reports the exit code", async () => {
  const ws = tmpDir();
  const out = await run(
    "run_command",
    { command: "echo out-line; echo err-line 1>&2; exit 3" },
    makeContext(ws, { allowShell: true }),
  );
  assert.match(out, /out-line/);
  assert.match(out, /err-line/);
  assert.match(out, /exit code 3/);
});

test("run_command caps output keeping the tail and still drains the process", async () => {
  const ws = tmpDir();
  const out = await run(
    "run_command",
    { command: "for i in $(seq 1 2000); do echo line$i; done" },
    makeContext(ws, { allowShell: true, maxOutputBytes: 200 }),
  );
  assert.match(out, /output truncated/);
  assert.match(out, /line2000/);
  assert.match(out, /exit code 0/);
  assert.ok(!out.includes("line1\n"), "head of the output should be dropped");
});

test("run_command times out and cleans up the whole process group", async () => {
  const ws = tmpDir();
  const ticks = path.join(ws, "ticks.txt");
  const started = Date.now();
  const out = await run(
    "run_command",
    { command: "for i in $(seq 1 400); do echo tick >> ticks.txt; sleep 0.05; done", timeout_ms: 400 },
    makeContext(ws, { allowShell: true }),
  );
  const elapsed = Date.now() - started;

  assert.match(out, /timed out/);
  assert.ok(elapsed < 5000, `command should be killed promptly, took ${elapsed}ms`);

  // If the process group were still alive, the background loop would keep writing.
  const sizeAfterKill = fs.statSync(ticks).size;
  await delay(400);
  assert.equal(fs.statSync(ticks).size, sizeAfterKill, "process group should be dead after timeout");
});

test("run_command abort signal kills the process group", async () => {
  const ws = tmpDir();
  const ticks = path.join(ws, "ticks.txt");
  const controller = new AbortController();
  const pending = run(
    "run_command",
    { command: "for i in $(seq 1 400); do echo tick >> ticks.txt; sleep 0.05; done" },
    makeContext(ws, { allowShell: true, signal: controller.signal }),
  );
  setTimeout(() => controller.abort(), 300);
  const out = await pending;

  assert.match(out, /aborted/);
  const sizeAfterKill = fs.statSync(ticks).size;
  await delay(300);
  assert.equal(fs.statSync(ticks).size, sizeAfterKill, "process group should be dead after abort");
});

test("run_command reports a shell progress frame on the source's 2000 ms cadence", async () => {
  const ws = tmpDir();
  const frames: Array<{ elapsedTimeSeconds: number; totalBytes: number; fullOutput: string }> = [];
  const out = await run(
    "run_command",
    { command: "echo first; sleep 2.4; echo second" },
    makeContext(ws, { allowShell: true, onProgress: progress => frames.push(progress) }),
  );
  assert.match(out, /first/);
  assert.match(out, /second/);
  // Source `hOn` = 2000: a 2.4 s command yields one frame, and that frame sees the first line.
  assert.equal(frames.length, 1);
  assert.match(frames[0]!.fullOutput, /first/);
  assert.ok(frames[0]!.totalBytes > 0);
  assert.equal(frames[0]!.elapsedTimeSeconds, 2);
});

test("search treats a leading-dash literal pattern as data, not an option", async () => {
  const ws = tmpDir();
  write(ws, "dash.txt", "-leading dash\nplain line\n");

  const out = await run("search", { pattern: "-leading" }, makeContext(ws));
  assert.match(out, /dash\.txt:1:-leading dash/);
});

test("search and list include hidden files but never the reserved .agent directory", async () => {
  const ws = tmpDir();
  write(ws, "visible.txt", "hello secret world\n");
  write(ws, ".env", "HELLO_SECRET_ENV=1\n");
  write(ws, ".agent/other.txt", "hello secret world\n");

  const found = await run("search", { pattern: "hello secret" }, makeContext(ws));
  assert.match(found, /visible\.txt:1:hello secret world/);
  assert.doesNotMatch(found, /\.agent/);

  const listed = await run("list_files", {}, makeContext(ws));
  assert.match(listed, /^\.env$/m);
  assert.match(listed, /^visible\.txt$/m);
  assert.doesNotMatch(listed, /\.agent/);
});

test("a caller glob cannot re-include .agent, and the exclusion glob itself excludes it", async () => {
  const ws = tmpDir();
  write(ws, "keep.txt", "");
  write(ws, ".agent/hidden.txt", "");

  const broad = await run("list_files", { glob: "**" }, makeContext(ws));
  assert.match(broad, /^keep\.txt$/m);
  assert.doesNotMatch(broad, /\.agent/);

  const agentGlob = await run("list_files", { glob: "**/.agent/**" }, makeContext(ws));
  assert.equal(agentGlob, "");
});

test("a symlink aliasing .agent is rejected when directly selected", async () => {
  const ws = tmpDir();
  write(ws, ".agent/hidden.txt", "inner");
  fs.symlinkSync(path.join(ws, ".agent"), path.join(ws, "agentlink"));
  fs.symlinkSync(path.join(ws, ".agent", "hidden.txt"), path.join(ws, "filelink.txt"));

  await assert.rejects(run("list_files", { path: "agentlink" }, makeContext(ws)), /\.agent/);
  await assert.rejects(
    run("search", { pattern: "inner", path: "agentlink" }, makeContext(ws)),
    /\.agent/,
  );
  await assert.rejects(run("read_file", { path: "filelink.txt" }, makeContext(ws)), /\.agent/);
});

test("an absolute path inside the workspace is rejected", async () => {
  const ws = tmpDir();
  write(ws, "abs-target.txt", "x");
  await assert.rejects(
    run("read_file", { path: path.join(ws, "abs-target.txt") }, makeContext(ws)),
    /escapes/,
  );
});

test("a pre-aborted signal prevents all side effects before spawn or write", async () => {
  const ws = tmpDir();
  const controller = new AbortController();
  controller.abort();
  const ctx = makeContext(ws, { signal: controller.signal, allowShell: true });

  await assert.rejects(run("write_file", { path: "p.txt", content: "y" }, ctx), /aborted/);
  assert.equal(fs.existsSync(path.join(ws, "p.txt")), false);

  write(ws, "e.txt", "orig");
  await assert.rejects(run("edit_file", { path: "e.txt", old_string: "orig", new_string: "z" }, ctx), /aborted/);
  assert.equal(read(ws, "e.txt"), "orig");

  const ticks = path.join(ws, "ticks.txt");
  await assert.rejects(
    run("run_command", { command: `echo tick >> "${ticks}"` }, ctx),
    /aborted/,
  );
  assert.equal(fs.existsSync(ticks), false);

  await assert.rejects(run("read_file", { path: "e.txt" }, ctx), /aborted/);
});

test("edit_file inserts new_string literally (no dollar-pattern expansion)", async () => {
  const ws = tmpDir();
  write(ws, "r.txt", "value=PLACEHOLDER;\n");
  const replacement = "$&$`$'";

  await run("edit_file", { path: "r.txt", old_string: "PLACEHOLDER", new_string: replacement }, makeContext(ws));
  assert.equal(read(ws, "r.txt"), `value=${replacement};\n`);

  write(ws, "r2.txt", "a\na\n");
  await run(
    "edit_file",
    { path: "r2.txt", old_string: "a", new_string: "$1", replace_all: true },
    makeContext(ws),
  );
  assert.equal(read(ws, "r2.txt"), "$1\n$1\n");
});

test("read_file truncation never emits a U+FFFD replacement char", async () => {
  const ws = tmpDir();
  write(ws, "u.txt", "aaaa😀bbbb");

  const out = await run("read_file", { path: "u.txt" }, makeContext(ws, { maxOutputBytes: 6 }));
  assert.ok(!out.includes("�"), "truncated output must stay valid UTF-8");
  assert.match(out, /read_file: output truncated/);
});

test("run_command returns promptly when a detached descendant holds the pipes", async () => {
  const ws = tmpDir();
  const started = Date.now();
  const out = await run(
    "run_command",
    { command: "sleep 30 & echo bg-started", timeout_ms: 5000 },
    makeContext(ws, { allowShell: true }),
  );
  const elapsed = Date.now() - started;

  assert.match(out, /bg-started/);
  assert.ok(elapsed < 3000, `must not wait for the detached sleep, took ${elapsed}ms`);
});

test("run_command kills a detached descendant that redirects output when the shell exits", async () => {
  const ws = tmpDir();
  const ticks = path.join(ws, "ticks.txt");
  const out = await run(
    "run_command",
    {
      command: `( for i in $(seq 1 400); do echo tick >> "${ticks}"; sleep 0.05; done ) >/dev/null 2>&1 & echo spawned`,
      timeout_ms: 5000,
    },
    makeContext(ws, { allowShell: true }),
  );

  assert.match(out, /spawned/);
  await delay(200);
  const sizeAfterExit = fs.existsSync(ticks) ? fs.statSync(ticks).size : 0;
  await delay(400);
  const sizeLater = fs.existsSync(ticks) ? fs.statSync(ticks).size : 0;
  assert.equal(sizeLater, sizeAfterExit, "detached descendant should be killed when the shell exits");
});

// ---------------------------------------------------------------------------
// Bounded subprocess regression guards (ripgrep path)
// ---------------------------------------------------------------------------

test("search reports an in-flight abort as aborted, not a partial result", async () => {
  const ws = tmpDir();
  // A FIFO makes ripgrep block on open, giving a deterministic window in which
  // the abort fires while the child is genuinely still running.
  execFileSync("mkfifo", [path.join(ws, "pipe.txt")]);
  const controller = new AbortController();
  const pending = run(
    "search",
    { pattern: "x", path: "pipe.txt" },
    makeContext(ws, { signal: controller.signal }),
  );
  setTimeout(() => controller.abort(), 100);

  // Before the fix the bounded runner resolved with an empty (partial) result
  // and aborted:false, so the abort vanished instead of surfacing.
  await assert.rejects(pending, /aborted/);
});

test("search bounds surfaced ripgrep stderr by maxOutputBytes (byte cap, not chunk count)", async (t) => {
  const ws = tmpDir();
  const denied = path.join(ws, "denied");
  fs.mkdirSync(denied);
  fs.writeFileSync(path.join(denied, "a.txt"), "x");
  fs.chmodSync(denied, 0o000);

  let unreadable = false;
  try {
    fs.readdirSync(denied);
  } catch {
    unreadable = true;
  }
  if (!unreadable) {
    // The directory stayed readable (for example when running as root); there
    // is no way to make ripgrep emit stderr, so skip rather than assert falsely.
    fs.chmodSync(denied, 0o700);
    t.skip("cannot deny directory read in this environment");
    return;
  }

  const maxBytes = 16;
  try {
    await assert.rejects(
      run("search", { pattern: "x", path: "denied" }, makeContext(ws, { maxOutputBytes: maxBytes })),
      (error: Error) => {
        const marker = "): ";
        const at = error.message.indexOf(marker);
        assert.notEqual(at, -1, `expected an rg failure message, got: ${error.message}`);
        const stderrPart = error.message.slice(at + marker.length);
        assert.ok(
          Buffer.byteLength(stderrPart, "utf8") <= maxBytes,
          `surfaced stderr exceeded the byte cap: ${JSON.stringify(stderrPart)}`,
        );
        return true;
      },
    );
  } finally {
    fs.chmodSync(denied, 0o700);
  }
});

test("run_command keeps a UTF-8 boundary at the truncated tail (no U+FFFD)", async () => {
  const ws = tmpDir();
  // 7 bytes: emoji (4) followed by "abc" (3). Caps of 4..6 force the tail cut
  // to land at every position around the emoji's continuation bytes.
  for (const cap of [4, 5, 6]) {
    const out = await run(
      "run_command",
      { command: "printf '\\360\\237\\230\\200abc'" },
      makeContext(ws, { allowShell: true, maxOutputBytes: cap }),
    );
    assert.ok(!out.includes("�"), `cap ${cap} emitted U+FFFD: ${JSON.stringify(out)}`);
    assert.match(out, /abc|😀/, `cap ${cap} should keep a decodable tail: ${JSON.stringify(out)}`);
  }
});
