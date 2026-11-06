import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { Agent, defaultConfig } from '../dist/agent.js';
import { Session } from '../dist/session.js';

const script = fileURLToPath(import.meta.url);
const [mode, workspace, stage] = process.argv.slice(2);
const marker = path.join(workspace || os.tmpdir(), 'effect');
const response = (content, stop_reason = 'end_turn') => ({ id: 'fixture', model: 'fixture', type: 'message', role: 'assistant', content, stop_reason, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } });
const tool = { schema: { name: 'mutate', input_schema: { type: 'object', properties: {} } }, readOnly: false,
  execute: async () => { fs.appendFileSync(marker, 'x'); return 'EFFECT_OUTPUT'; } };
const output = JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', updatedToolOutput: 'REWRITTEN' } });
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;

if (mode === 'writer') {
  const hold = stage === 'hook-output' ? `; touch ${quote(path.join(workspace, 'hook-output'))}; while :; do sleep 1; done` : '';
  const config = { ...defaultConfig(workspace, [tool]), model: 'fixture', hooks: { PostToolUse: [{ command: `printf %s ${quote(output)}${hold}` }] } };
  const session = Session.open(workspace, { config });
  fs.writeFileSync(path.join(workspace, 'identity'), JSON.stringify({ id: session.id, file: session.file }));
  const write = fs.writeSync, sync = fs.fsyncSync;
  let current, shortened = false;
  const barrier = name => { fs.writeFileSync(path.join(workspace, 'barrier'), name); process.kill(process.pid, 'SIGSTOP'); };
  fs.writeSync = function(fd, bytes, ...args) {
    if (Buffer.isBuffer(bytes)) {
      try { const row = JSON.parse(bytes.toString()); if (['tool_effect', 'tool_result', 'hook_start', 'hook_result'].includes(row.kind)) current = row.kind; } catch {}
      if ((stage === 'result-short' || stage === 'result-short-error') && current === 'tool_result') {
        if (shortened) return 0;
        shortened = true;
        const count = Math.floor(bytes.length / 2); write.call(fs, fd, bytes, 0, count);
        if (stage === 'result-short') barrier(stage);
        return count;
      }
    }
    const result = write.call(fs, fd, bytes, ...args);
    if (stage === 'result-write' && current === 'tool_result') barrier(stage);
    return result;
  };
  fs.fsyncSync = function(fd) {
    const result = sync.call(fs, fd);
    if ((stage === 'effect-sync' && current === 'tool_effect') || (stage === 'hook-start' && current === 'hook_start') ||
        (stage === 'hook-complete' && current === 'hook_result') || (['result-sync', 'legacy-result', 'legacy-output'].includes(stage) && current === 'tool_result')) barrier(stage);
    current = undefined;
    return result;
  };
  let calls = 0;
  const provider = { count: async () => 1, complete: async () => { calls++; return calls === 1 ? response([{ type: 'tool_use', id: 'one', name: 'mutate', input: {} }], 'tool_use') : response([{ type: 'text', text: 'done' }]); } };
  await new Agent(session, provider, [tool]).run('task');
  throw new Error(`missed ${stage}`);
} else if (mode === 'reader') {
  const { id } = JSON.parse(fs.readFileSync(path.join(workspace, 'identity')));
  const session = Session.open(workspace, { id, recoverLock: true });
  let seen;
  const provider = { count: async () => 1, complete: async request => { seen = request.messages; return response([{ type: 'text', text: 'done' }]); } };
  try {
    if (stage === 'first') await new Agent(session, provider, [tool]).run();
    const results = session.messages.flatMap(message => Array.isArray(message.content) ? message.content.filter(block => block.type === 'tool_result' && block.tool_use_id === 'one') : []);
    assert.equal(results.length, 1);
    console.log(JSON.stringify({ result: results[0], seen, effect: session.events.filter(row => row.kind === 'tool_effect').length }));
  } finally { session.close(); }
} else {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'post-hook-crash-')));
  try {
    for (const cut of ['effect-sync', 'hook-start', 'hook-output', 'hook-complete', 'result-short', 'result-short-error', 'result-write', 'result-sync', 'legacy-result', 'legacy-output']) {
      const dir = path.join(root, cut); fs.mkdirSync(dir);
      const child = spawn(process.execPath, [script, 'writer', dir, cut], { detached: true, stdio: ['ignore', 'ignore', 'pipe'] });
      let stderr = ''; child.stderr.on('data', data => { stderr += data; });
      const exited = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
      const target = path.join(dir, cut === 'hook-output' ? 'hook-output' : 'barrier');
      const deadline = Date.now() + 15000;
      if (cut === 'result-short-error') {
        const result = await Promise.race([exited, delay(15000).then(() => { throw new Error('short write timeout'); })]);
        assert.notEqual(result.code, 0); assert.match(stderr, /Journal write made no progress/);
      } else {
        while (!fs.existsSync(target)) { assert.ok(Date.now() < deadline && child.exitCode === null && child.signalCode === null, `${cut}: ${stderr}`); await delay(20); }
        process.kill(-child.pid, 'SIGKILL');
        assert.equal((await exited).signal, 'SIGKILL');
      }
      const { file } = JSON.parse(fs.readFileSync(path.join(dir, 'identity')));
      if (cut.startsWith('legacy-')) {
        const rows = fs.readFileSync(file, 'utf8').trimEnd().split('\n').map(JSON.parse).filter(row => row.kind !== 'tool_effect');
        if (cut === 'legacy-output') rows.push({ kind: 'tool_output', result: { ...rows.find(row => row.kind === 'tool_result').result, content: 'LEGACY_REWRITE' } });
        fs.writeFileSync(file, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
      }
      const old = fs.readFileSync(file);
      assert.equal(fs.readFileSync(path.join(dir, 'effect'), 'utf8'), 'x');
      const reader = pass => {
        const r = spawnSync(process.execPath, [script, 'reader', dir, pass], { encoding: 'utf8', timeout: 15000 });
        assert.ifError(r.error); assert.equal(r.status, 0, `${cut} ${pass}: ${r.stderr}`); return JSON.parse(r.stdout);
      };
      const first = reader('first'), second = reader('second');
      assert.equal(first.effect, cut.startsWith('legacy-') ? 0 : 1); assert.equal(second.effect, first.effect);
      assert.deepEqual(first.result, second.result);
      if (cut === 'legacy-output') assert.equal(first.result.content, 'LEGACY_REWRITE');
      else if (['result-write', 'result-sync', 'legacy-result'].includes(cut)) assert.equal(first.result.content, 'REWRITTEN');
      else {
        assert.match(first.result.content, /post-hook result was interrupted before commit/);
        assert.match(JSON.stringify(first.seen), /post-hook result was interrupted before commit/);
        assert.doesNotMatch(JSON.stringify(first.seen), /EFFECT_OUTPUT|REWRITTEN/);
      }
      assert.equal(fs.readFileSync(path.join(dir, 'effect'), 'utf8'), 'x');
      if (!cut.startsWith('result-short')) assert.ok(fs.readFileSync(file).subarray(0, old.length).equals(old));
      else {
        const evidence = fs.readdirSync(path.dirname(file)).filter(name => name.includes('torn'));
        assert.ok(evidence.length > 0, 'torn evidence retained');
        assert.ok(evidence.some(name => fs.readFileSync(path.join(path.dirname(file), name)).equals(old)), 'original journal bytes retained');
      }
      console.log(`${cut}: passed`);
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
