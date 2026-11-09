// Owned dependency-injected fixture. Copies individual verified bodies, never
// imports or executes a recovered application entrypoint. See W385 #43 ledger.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { parse } from 'acorn';
import { z } from 'zod';

const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const manifest = JSON.parse(fs.readFileSync('extracted-v2/manifest.json', 'utf8'));
assert.equal(manifest.sha256, 'c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937');
const modules = [
  ['chunk-sfn1dbxq.js', '4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da',
    ['_bt', 'kbt', 'm5e', 'WLe', 'Sbt', 'bbt', 'wbt', 'AXo', 'CXo', 'LLr', 'CDr', 'ble', 'Zt', 'ubt', 'dbt',
      '_yn', 'yyn', 'iDr', 'rDr', 'sDr',
      'wk', 'mnt', 'nb', 'oVr', 'Uvn', 'sVr', 'Cle', 'LKt', 'Ii', 'NLs', 'insertMessageChain',
      'appendEntry', 'shouldSkipPersistence', 'enqueueWrite', 'pushQueueItem', 'scheduleDrain',
      'drainWriteQueue', 'drainQueuesOnce', 'appendToFile', 'VEe', 'Ole',
      'd$n', 'aFn', 'ZFt', 'A2r', 'jZe', 'rVr', 'Go', 'Mvt', 'M2r', 'qFn', 'D2r', 'O2r', 'sNs', 'mAe', 'AJr', 'slr',
      'P2r', 'e$t', 'XFt', 't$t', 'n$t', 'YEe', 'I0', 'VFn', 'eI', 'JU', 'fv', 'nRe', 'KFn', '_ce', 'yce', 'ygo', 'tN',
      'lSe', 'Gtt', 'w1', 'ri', 'WMe', 'PYe', 'Cir']],
  ['chunk-08y6bv7r.js', '2b88e13fa78be922b842ad142e0b7ed1eb415009911237a89927ca9d408d7bbc', ['K0']],
  ['chunk-rx2nah4x.js', 'cfb79b3b3d580f450f8184e5873a686eb083e9ea3abd4e0a58268425de6acc51', ['Mv']],
  ['chunk-gyf58rwf.js', '7a6a01732760c89b5d434cc5ba98faf72b10917d85b771671f8201e9e3d8d2ad', ['LN']],
  ['chunk-y9e5d83w.js', '99515915b6a3f863e5c254b7ae432e26fc0d445b14e3bd312cfd69a076025ad1', ['Mgr', 'nt']],
];
const bodies = new Map();
const ledger = [];
for (const [module, expected, names] of modules) {
  const source = fs.readFileSync(`extracted-v2/modules/${module}`, 'utf8');
  assert.equal(hash(source), expected);
  assert.equal(manifest.modules.find(entry => entry.path === module)?.decodedSha256, expected);
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const candidates = [];
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (['FunctionDeclaration', 'ClassDeclaration', 'VariableDeclarator', 'MethodDefinition'].includes(node.type)) candidates.push(node);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') walk(value);
    }
  }
  walk(ast);
  for (const symbol of names) {
    const matches = candidates.filter(node => (node.id?.name ?? node.key?.name) === symbol);
    assert.equal(matches.length, 1, `${module}:${symbol} must identify one body`);
    const node = matches[0];
    const body = source.slice(node.start, node.end);
    bodies.set(symbol, body);
    ledger.push({ module, moduleSha256: expected, symbol, range: [node.start, node.end],
      coordinates: 'zero-based half-open UTF-16', bodySha256: hash(body) });
  }
}
const ledgerPath = '.audit/w385-hook-attachment-source.json';
if (process.argv.includes('--record')) fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
else assert.deepEqual(ledger, JSON.parse(fs.readFileSync(ledgerPath, 'utf8')));
const noop = () => {};

test('source reactive compact summarizes earlier groups and preserves the final group with its hook', async () => {
  let summarized;
  const compact = new Function('deps', `const {j8,uF,Ptt,WSs,t,i,pe,d,Ndr}=deps;
    ${['lSe', 'Gtt', 'w1', 'ri', 'WMe', 'Go', 'K0'].map(name => bodies.get(name)).join('\n')}
    return lSe;
  `)({ j8: noop, uF: noop, Ptt: noop, WSs: () => false, t: noop, i: noop,
    pe: value => value, d: value => value, Ndr: async rows => {
      summarized = rows;
      return { ok: true, messages: [{ type: 'user', uuid: 'summary', message: { content: 'owned summary' } }],
        summaryText: 'owned summary', totalUsage: {}, forkAssistantMessageCount: 0 };
    } });
  const rows = [
    { type: 'user', uuid: 'u', message: { content: 'request' } },
    { type: 'assistant', uuid: 'first', message: { id: 'r1', content: [] } },
    { type: 'user', uuid: 'result', message: { content: [] } },
    { type: 'assistant', uuid: 'last', message: { id: 'r2', content: [] } },
    { type: 'attachment', uuid: 'hook', attachment: { type: 'async_hook_response', response: { systemMessage: 'keep me' } } },
  ];
  const result = await compact(rows, { toolUseContext: { abortController: new AbortController() } });
  assert.equal(result.ok, true);
  assert.deepEqual(summarized.map(row => row.uuid), ['u', 'first', 'result']);
  assert.deepEqual(result.result.messagesToPreserve.map(row => row.uuid), ['last', 'hook']);
  assert.equal(result.result.groupsPreserved, 1);
});

test('source sanitizer repairs conversational rows and reconnects dropped parents', () => {
  const create = new Function('deps', `const {L,o$t}=deps;
    function s$t(){throw Error('system-row sanitization is outside this fixture');}
    ${['ZFt', 'e$t', 'XFt', 't$t', 'n$t'].map(name => bodies.get(name)).join('\n')}
    return ZFt;
  `)({ L: value => value !== null && typeof value === 'object' && !Array.isArray(value), o$t: noop });
  const normalizer = create(), rows = new Map();
  const input = [
    { type: 'user', uuid: 'u', parentUuid: null, message: { content: 'user' } },
    { type: 'assistant', uuid: 'bad', parentUuid: 'u', message: { content: 42 } },
    { type: 'attachment', uuid: 'hook', parentUuid: 'bad', attachment: { type: 'async_hook_response' } },
    { type: 'assistant', uuid: 'text', parentUuid: 'hook', message: { content: 'text response' } },
    { type: 'user', uuid: 'mixed', parentUuid: 'text', message: { content: [null, { type: 'text', text: 'valid' }] } },
  ];
  for (const row of input) if (normalizer.admit(row, rows)) rows.set(row.uuid, row);
  normalizer.finish(rows);
  assert.equal(rows.has('bad'), false);
  assert.equal(rows.get('hook').parentUuid, 'u');
  assert.deepEqual(rows.get('text').message.content, [{ type: 'text', text: 'text response' }]);
  assert.deepEqual(rows.get('mixed').message.content, [{ type: 'text', text: 'valid' }]);
});

test('source compact relinking preserves selected hook attachments and rejects broken preservation', () => {
  const relink = new Function('deps', `const {i,pe,S,F}=deps;
    ${['Go', 'A2r', 'P2r'].map(name => bodies.get(name)).join('\n')}
    return A2r;
  `)({ i: noop, pe: value => value, S: value => value, F: (rows, predicate) => rows.filter(predicate).length });
  for (const variant of ['list', 'segment', 'missing']) {
    const metadata = variant === 'segment'
      ? { preservedSegment: { anchorUuid: 'summary', headUuid: 'a', tailUuid: 'hook' } }
      : { preservedMessages: { anchorUuid: 'summary', uuids: variant === 'missing' ? ['absent'] : ['a', 'hook'] } };
    const rows = new Map([
      ['old', { type: 'user', uuid: 'old', parentUuid: null }],
      ['a', { type: 'assistant', uuid: 'a', parentUuid: 'old', message: { usage: { input_tokens: 12 } } }],
      ['hook', { type: 'attachment', uuid: 'hook', parentUuid: 'a', attachment: { type: 'async_hook_response', response: { systemMessage: 'kept' } } }],
      ['boundary', { type: 'system', subtype: 'compact_boundary', uuid: 'boundary', parentUuid: null, compactMetadata: metadata }],
      ['summary', { type: 'user', uuid: 'summary', parentUuid: 'boundary' }],
      ['later', { type: 'user', uuid: 'later', parentUuid: 'summary' }],
    ]);
    const before = structuredClone([...rows]);
    const last = relink(rows);
    if (variant === 'missing') { assert.equal(last, undefined); assert.deepEqual([...rows], before); continue; }
    assert.equal(last, 'hook'); assert.equal(rows.has('old'), false);
    assert.equal(rows.get('a').parentUuid, 'summary'); assert.equal(rows.get('later').parentUuid, 'hook');
    assert.equal(rows.get('hook').attachment.response.systemMessage, 'kept');
    assert.equal(rows.get('a').message.usage.input_tokens, 0);
  }
});

test('source parallel tool recovery includes sibling results and their attachment tails', () => {
  for (const repairCallIds of [false, true]) {
    const recover = new Function('deps', `const {L,of,i,D2}=deps;
      ${['D2r', 'YEe', 'I0', 'VFn', 'eI', 'JU', 'fv', 'nRe', 'KFn', '_ce', 'yce', 'ygo', 'tN'].map(name => bodies.get(name)).join('\n')}
      return D2r;
    `)({ L: value => value !== null && typeof value === 'object' && !Array.isArray(value), of: () => repairCallIds, i: noop, D2: noop });
    for (const misplaced of [false, true]) {
      const u = { type: 'user', uuid: 'u', parentUuid: null, message: { content: 'user' } };
      const a = { type: 'assistant', uuid: 'a', parentUuid: 'u', message: { id: 'response', content: [{ type: 'tool_use', id: 't1' }] } };
      const b = { type: 'assistant', uuid: 'b', parentUuid: 'u', message: { id: 'response', content: [{ type: 'tool_use', id: 't2' }] } };
      const r1 = { type: 'user', uuid: 'r1', parentUuid: 'a', message: { content: [{ type: 'tool_result', tool_use_id: 't1' }] } };
      const r2 = { type: 'user', uuid: 'r2', parentUuid: misplaced ? 'u' : 'b', sourceToolAssistantUUID: 'b', message: { content: [{ type: 'tool_result', tool_use_id: 't2' }] } };
      const hook = { type: 'attachment', uuid: 'hook', parentUuid: 'r2', attachment: { type: 'async_hook_response' } };
      const map = new Map([u, a, b, r1, r2, hook].map(row => [row.uuid, row]));
      const chain = [u, a, r1];
      const recovered = recover(map, chain, new Set(chain.map(row => row.uuid)));
      assert.deepEqual(recovered.map(row => row.uuid), misplaced && !repairCallIds
        ? ['u', 'a', 'b', 'r1'] : ['u', 'a', 'b', 'r1', 'r2', 'hook']);
    }
  }
});
// Schema constructors use the host's installed Zod; no recovered schema module
// or original application runtime is loaded. Memoization is irrelevant here.
const dedup = new Function('z', `
  const p=fn=>fn,o=z.string,u=z.object,C=z.literal,Wr=z.discriminatedUnion,A=z.array,oe=z.unknown;
  const ${bodies.get('rDr')},${bodies.get('sDr')};
  ${['yyn', 'iDr', '_yn'].map(name => bodies.get(name)).join('\n')}
  return _yn;
`)(z);

function hookHarness() {
  const order = [];
  let payload;
  // The output parser/schema remains a supplied seam. The SessionStart de-dup
  // body is copied, with schema constructors supplied by the installed Zod.
  const api = new Function('deps', `
    const {t,l,_,Rie,gbt,hbt,ybt,dbt,gc,qq,ri,Vze,_yn,ubt}=deps;
    const pJn=250,ze=async promise=>promise,F=(items,predicate)=>items.filter(predicate).length;
    ${['_bt', 'WLe', 'Sbt', 'bbt', 'wbt', 'LLr', 'AXo', 'CXo'].map(name => bodies.get(name)).join('\n')}
    const registry=new _bt(); function n4(){return registry;}
    return {registry,Sbt,bbt,LLr,AXo,CXo};
  `)({ t: noop, l: String, _: JSON.stringify, Rie: () => ({}), gbt: () => payload,
    hbt: () => false, ybt: value => value, dbt: value => value, gc: () => order.push('published'),
    qq: noop, ri: value => value, Vze: noop, _yn: dedup, ubt: value => value });
  function job(id, response, { code = 0, stderr = '', cleanupThrows = false } = {}) {
    payload = response;
    const shellCommand = { status: 'completed', result: Promise.resolve({ code }),
      taskOutput: { getStdout: async () => 'owned output', getStderr: () => stderr },
      cleanup() { order.push('cleanup'); if (cleanupThrows) throw Error('owned cleanup failure'); } };
    const value = { processId: id, hookId: `hook-${id}`, hookName: 'owned', hookEvent: 'PostToolUse',
      command: 'owned-command', responseAttachmentSent: false, shellCommand,
      stopProgressInterval: () => order.push('progress-stopped') };
    api.registry.register(value);
    return value;
  }
  return { ...api, job, order };
}

test('ordinary result becomes an attachment; silent success is suppressed, failure retained', async () => {
  const h = hookHarness();
  h.job('one', { hookSpecificOutput: { additionalContext: 'owned-context' } });
  const result = await h.LLr([]);
  assert.equal(result.length, 1);
  assert.equal(result[0].type, 'async_hook_response');
  assert.equal(result[0].response.hookSpecificOutput.additionalContext, 'owned-context');
  assert.equal(result[0].command, undefined); // command is retained only for SessionStart
  assert.equal(h.registry.size(), 0);
  assert.deepEqual(h.order, ['progress-stopped', 'cleanup', 'published']);
  h.job('silent', undefined);
  assert.deepEqual(await h.LLr([]), []);
  h.job('failed', undefined, { code: 1 });
  assert.equal((await h.LLr([]))[0].exitCode, 1);

  // Both configured async and header adoption call this same source transfer.
  // Spawn/stdin/header detection remain outside this fixture's boundary.
  const transfers = [], wakes = [], pending = new Set(), events = [];
  const transfer = new Function('deps', `
    const {kbt,kdn,setImmediate,gc,Ebt,Abt,Cbt,B,z6t,zLe,UT}=deps;
    ${bodies.get('m5e')}
    return m5e;
  `)({ kbt: value => transfers.push(value), kdn: () => pending, setImmediate,
    gc: value => events.push(value), Ebt: async () => undefined, Abt: () => false,
    Cbt: { of: () => ({}) }, B: () => ({host: 'owned'}), z6t: value => wakes.push(value), zLe: value => value, UT: value => value });
  const shell = { background: () => false };
  const request = { processId: 'owned-transfer', hookId: 'owned-hook', shellCommand: shell,
    asyncResponse: { async: true }, hookEvent: 'PostToolUse', hookName: 'owned', command: 'owned-command' };
  assert.equal(transfer(request), false);
  assert.equal(transfers.length, 0);
  shell.background = (id, options) => { assert.equal(id, request.processId); assert.deepEqual(options, { skipSpill: true }); return true; };
  assert.equal(transfer(request), true);
  assert.equal(transfers[0].shellCommand, shell);
  for (const code of [0, 2]) {
    let backgroundCalls = 0, cleanups = 0;
    const rewakeShell = { result: Promise.resolve({code}), background: () => { backgroundCalls++; },
      taskOutput: { getStdout: async () => 'owned stdout', getStderr: () => 'owned stderr' }, cleanup: () => { cleanups++; } };
    assert.equal(transfer({ ...request, shellCommand: rewakeShell, asyncRewake: true }), true);
    await Promise.all([...pending]);
    assert.equal(backgroundCalls, 0);
    assert.equal(cleanups, 1);
    assert.equal(pending.size, 0);
  }
  assert.equal(transfers.length, 1); // rewake never enters the normal registry
  assert.equal(events.length, 2);
  assert.equal(wakes.length, 1);
  assert.equal(wakes[0].priority, 'next');
  assert(wakes[0].body.endsWith('owned stderr'));

  const prior = { type: 'async_hook_response', hookEvent: 'SessionStart', command: 'owned-command',
    response: { systemMessage: 'owned start' }, exitCode: 0 };
  const duplicate = h.job('duplicate-start', { systemMessage: 'owned start' });
  duplicate.hookEvent = 'SessionStart';
  assert.deepEqual(await h.LLr([{ type: 'attachment', attachment: prior }]), []);
  assert.equal(h.registry.size(), 0);
  assert.equal(dedup({ command: 'different', response: prior.response }, [prior]), false);
  assert.equal(dedup({ command: prior.command, response: prior.response }, [prior,
    { ...prior, response: {}, exitCode: 0 }]), false); // same-command empty success resets de-dup
  assert.equal(dedup({ command: prior.command, response: prior.response }, [prior,
    { ...prior, response: {}, exitCode: 1 }]), true);
});

test('delivery flag precedes cleanup; failed cleanup can leave no deliverable attachment', async () => {
  const h = hookHarness();
  const job = h.job('cleanup-fails', { systemMessage: 'owned-note' }, { cleanupThrows: true });
  assert.deepEqual(await h.bbt(), []);
  assert.equal(job.responseAttachmentSent, true);
  assert.equal(h.registry.size(), 1);
  assert.deepEqual(await h.bbt(), []);
  assert.equal(h.registry.size(), 0);
  assert(!h.order.includes('published'));

  const settled = hookHarness();
  const start = settled.job('session-start', { systemMessage: 'owned start' });
  start.hookEvent = 'SessionStart';
  assert.deepEqual(await settled.AXo({ hookEvent: 'SessionStart', graceMs: 100 }), { pending: 1, delivered: 1 });
  assert.equal(settled.registry.size(), 0);
  assert.equal((await settled.bbt()).length, 1); // held response, separate from live jobs
  assert.deepEqual(await settled.bbt(), []);

  const closing = hookHarness();
  closing.job('finished', { systemMessage: 'not attached by close' });
  const running = closing.job('running', undefined);
  running.shellCommand.status = 'running';
  let killed = 0;
  running.shellCommand.kill = () => { killed++; running.shellCommand.status = 'killed'; };
  await closing.CXo();
  assert.equal(killed, 1);
  assert.equal(closing.registry.size(), 0);
  assert.deepEqual(await closing.bbt(), []); // close publishes status, not response attachments
});

test('attachment survives source filter and JSONL queue; enqueue success is not durable settlement', async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'w385-hook-attachment-'));
  try {
    const errors = [];
    const file = path.join(dir, 'session.jsonl');
    const store = { project: undefined, writerHealth: {}, localGcEnabled: false };
    let failAppend = false;
    // These are local-file/no-backend seams. Timed scheduling is held by the
    // fixture so queue-before-write and write-failure boundaries are observable.
    const api = new Function('deps', `
      const {Jar,Uvn,_lr,hMn,ld,j,OZe,iD,P_,JLn,E,xs,t,c,Iw,IZe,fee}=deps;
      const ow=Number.MAX_SAFE_INTEGER,td='fixture-excluded-tool';
      const ${bodies.get('oVr')};
      ${['nb', 'sVr', 'mnt', 'LN', 'VEe'].map(name => bodies.get(name)).join('\n')}
      class Writer {
        ${['enqueueWrite', 'pushQueueItem', 'drainQueuesOnce', 'appendToFile'].map(name => bodies.get(name)).join('\n')}
      }
      return {mnt,Writer};
    `)({ Jar: () => 'neutral', Uvn: () => false, _lr: () => new Set(), hMn: () => [],
      ld: () => store, j: () => false,
      OZe: async (...args) => { if (failAppend) throw Error('owned append fault'); await fsp.appendFile(...args); },
      iD: fsp.mkdir, P_: path.dirname, JLn: noop, E: String, xs: () => false,
      t: noop, c: error => errors.push(error.message), Iw: noop, IZe: () => undefined, fee: noop });
    const writer = new api.Writer();
    Object.assign(writer, { writeQueues: new Map(), scheduleDrain: noop, mirrors: [], store,
      sessionFile: file, MAX_CHUNK_BYTES: 65536, directAppendsInFlight: 0,
      bytesSinceMetadataReAppend: 0, bytesSinceCompact: 0, replaySources: new Map(), queuedToolResults: new Map() });
    const row = { type: 'attachment', uuid: 'owned-hook-row', timestamp: '2026-11-06T00:00:00.000Z',
      attachment: { type: 'async_hook_response', response: { systemMessage: 'owned-note' }, exitCode: 0 } };
    assert.deepEqual(api.mnt([row]), [row]);
    const queued = writer.enqueueWrite(file, api.mnt([row])[0]);
    assert.equal(fs.existsSync(file), false);
    await writer.drainQueuesOnce();
    await queued;
    const cold = execFileSync(process.execPath, ['-e',
      'const fs=require("node:fs");const rows=fs.readFileSync(process.argv[1],"utf8").trim().split("\\n").map(JSON.parse);process.stdout.write(JSON.stringify(rows))', file], { encoding: 'utf8' });
    assert.deepEqual(JSON.parse(cold), [row]);
    failAppend = true;
    const lost = writer.enqueueWrite(file, { ...row, uuid: 'not-persisted' });
    await writer.drainQueuesOnce();
    await lost; // source drain resolves its queued promise even on this error
    assert.equal(errors.length, 1);
    assert.equal(writer.writeQueues.size, 0);
    assert.equal(fs.readFileSync(file, 'utf8').includes('not-persisted'), false);

    // Copy the actual ordinary reader/leaf and parent/tail selection bodies.
    // Input messages are normalized, unbranched and uncompacted. Sanitization,
    // parallel-tool repair and telemetry are explicit seams, not parity claims.
    for (const depthFirst of [false, true]) {
      const restore = new Function('deps', `
        const {L,ZFt,v1e,xFt,c,i,D2r,zFt,dAs}=deps;
        const ${bodies.get('nt')};
        ${['Mgr', 'aFn', 'jZe', 'rVr', 'Go', 'A2r', 'd$n', 'qFn', 'M2r', 'Mvt'].map(name => bodies.get(name)).join('\n')}
        const vM=Mgr;
        function O2r(){throw Error('fixture must not need timestamp repair');}
        return rows=>{const reducer=d$n(false);for(const row of rows)reducer.processEntry(row);
          const result=reducer.finish();const leaves=[...result.leafUuids];
          if(leaves.length!==1)throw Error('expected one ordinary conversational leaf');
          return {leaf:leaves[0],rows:Mvt(result.messages,result.messages.get(leaves[0]))};};
      `)({ L: value => value !== null && typeof value === 'object' && !Array.isArray(value),
        ZFt: () => ({ admit: () => true, finish: noop }), v1e: noop, xFt: noop, c: error => { throw error; },
        i: noop, D2r: (_map, rows) => rows, zFt: noop, dAs: () => depthFirst });
      const user = { type: 'user', uuid: 'user', parentUuid: null, timestamp: '2026-11-06T00:00:00.000Z', message: { content: 'owned' } };
      const assistant = { type: 'assistant', uuid: 'assistant', parentUuid: user.uuid, timestamp: '2026-11-06T00:00:01.000Z', message: { content: [] } };
      const attachment = { ...JSON.parse(cold)[0], parentUuid: assistant.uuid, timestamp: '2026-11-06T00:00:02.000Z' };
      const orphan = { ...attachment, uuid: 'orphan', parentUuid: 'missing', timestamp: '2026-11-06T00:00:03.000Z' };
      const restored = restore([user, assistant, attachment, orphan]);
      assert.equal(restored.leaf, assistant.uuid);
      assert.deepEqual(restored.rows.map(value => value.uuid), ['user', 'assistant', attachment.uuid]);
      assert.equal(restored.rows[2].attachment.response.systemMessage, 'owned-note');
    }
  } finally { await fsp.rm(dir, { recursive: true, force: true }); }
});
