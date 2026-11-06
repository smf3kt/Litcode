import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { TerminalScreen } from './terminal-screen.mjs';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scratch = process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir();
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(scratch, 'leaf-permission-cli-')));
const compiled = process.argv.includes('--compiled');
const baseline = process.argv.includes('--baseline');
const invalidBaseline = process.argv.includes('--invalid-baseline');
const aliasCache = process.argv.includes('--alias-cache');
const aliasPolicy = process.argv.includes('--alias-policy');
const aliasReversePolicy = process.argv.includes('--alias-reverse-policy');
const aliasMatrix = aliasPolicy || aliasReversePolicy;
const aliasPty = process.argv.includes('--alias-pty');
let server;
let child;
let current;
let calls = 0;

try {
  server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks));
      calls += 1;
      const selected = (aliasCache || aliasMatrix || aliasPty) && calls === 2 ? current.write : current;
      const events = (calls === 1 || (aliasCache || aliasMatrix || aliasPty) && calls === 2) ? [
        { type: 'message_start', message: { id: 'leaf-fixture', type: 'message', role: 'assistant', model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
        { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: (aliasCache || aliasMatrix || aliasPty) && calls === 2 ? 'alias-write' : 'leaf-call', name: selected.name, input: {} } },
        { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: JSON.stringify(selected.input) } },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_delta', delta: { stop_reason: 'tool_use', stop_sequence: null }, usage: { output_tokens: 2 } },
        { type: 'message_stop' },
      ] : [
        { type: 'message_start', message: { id: 'leaf-done', type: 'message', role: 'assistant', model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'done' } },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } },
        { type: 'message_stop' },
      ];
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''));
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(key)) delete env[key];
  Object.assign(env, { LLM_API_KEY: 'owned-leaf', LLM_MODEL: 'fixture/leaf', LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`,
    LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false' });

  const rows = [];
  if (aliasPty) {
    assert.ok(compiled, '--alias-pty requires --compiled');
    const pty = path.join(temporary, 'pty.exp');
    fs.writeFileSync(pty, 'set stty_init "rows 40 columns 120"\n' + fs.readFileSync(path.join(project, 'scripts/pty-cli.exp'), 'utf8'));
    for (const forward of [true, false]) for (const approved of [true, false]) {
      const label = `${forward ? 'link-target' : 'target-link'}-${approved ? 'approve' : 'deny'}`;
      const workspace = path.join(temporary, label), user = path.join(temporary, `${label}-user`);
      fs.mkdirSync(workspace); fs.mkdirSync(user); fs.mkdirSync(path.join(workspace, '.harness'));
      fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ model: 'fixture/leaf', thinking: false, prefersReducedMotion: true, preferredNotifChannel: 'notifications_disabled' }));
      fs.writeFileSync(path.join(workspace, '.harness/settings.json'), JSON.stringify({ permissions: { mode: 'default', allow: ['write_file', 'read_file'], ask: ['read_file'], deny: [] } }));
      fs.writeFileSync(path.join(workspace, 'target.txt'), 'BEFORE');
      fs.writeFileSync(path.join(workspace, 'other.txt'), 'RETARGETED');
      fs.symlinkSync('target.txt', path.join(workspace, 'alias.txt'));
      current = { name: 'read_file', input: { path: forward ? 'alias.txt' : 'target.txt' }, write: { name: 'write_file', input: { path: forward ? 'target.txt' : 'alias.txt', content: 'AFTER', overwrite: true } } };
      let id, journal;
      for (const restart of [false, true]) {
        if (restart && forward && approved) {
          fs.unlinkSync(path.join(workspace, 'alias.txt'));
          fs.symlinkSync('other.txt', path.join(workspace, 'alias.txt'));
        }
        calls = 0;
        current.write.input.content = restart ? 'AFTER_RESTART' : 'AFTER';
        const screen = new TerminalScreen(120, 40);
        const frame = () => screen.lines().map(line => line.trimEnd()).join('\n');
        child = spawn('/usr/bin/expect', [pty, process.execPath, path.join(project, 'bin/litcode.mjs'), '--workspace', workspace, '--interactive', ...(restart ? ['--resume', id] : ['--user-dir', user, '--no-inherit-gateway'])], { cwd: project, env, stdio: ['pipe', 'pipe', 'pipe'] });
        const exited = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
        child.stdout.setEncoding('utf8'); child.stdout.on('data', text => screen.write(text)); child.stderr.on('data', text => screen.write(String(text)));
        const until = async (fn, what) => { const end = Date.now() + 15000; while (!fn()) { assert.ok(Date.now() < end && child.exitCode === null, `${label} ${what}\n${frame()}`); await delay(30); } };
        const ready = () => frame().includes('· ready') && !frame().includes('Prompt');
        await until(ready, 'ready');
        child.stdin.write('Exercise the local fixture\r');
        await until(() => frame().includes('Allow once') && frame().includes('read_file'), 'read approval');
        child.stdin.write(approved ? '\r' : '\x1b');
        await until(() => calls === 3 && ready() && !frame().includes('Allow once'), 'completed');
        child.stdin.write('/exit\r');
        assert.equal(await Promise.race([exited, delay(8000).then(() => 'timeout')]), 0, label);
        child = undefined;
        const dir = path.join(workspace, '.agent');
        journal ??= fs.readdirSync(dir).find(file => file.endsWith('.jsonl'));
        const records = fs.readFileSync(path.join(dir, journal), 'utf8').trim().split('\n').map(JSON.parse);
        id ??= records[0].id;
        const reads = records.filter(record => record.kind === 'tool_result' && record.result.tool_use_id === 'leaf-call');
        const writes = records.filter(record => record.kind === 'tool_result' && record.result.tool_use_id === 'alias-write');
        assert.equal(reads.length, restart ? 2 : 1); assert.equal(writes.length, reads.length);
        const read = reads.at(-1).result, write = writes.at(-1).result;
        assert.equal(read.is_error === true, !approved, String(read.content));
        if (approved) assert.match(String(read.content), restart && forward ? /RETARGETED/ : /BEFORE|unchanged/);
        else assert.match(String(read.content), /declined|denied/i);
        assert.equal(write.is_error === true, true, String(write.content));
        if (!forward) assert.match(String(write.content), /symbolic link/i);
        else assert.match(String(write.content), /not been read in full/i);
        assert.equal(fs.readFileSync(path.join(workspace, 'target.txt'), 'utf8'), 'BEFORE');
        assert.equal(fs.readdirSync(dir).some(name => name.endsWith('.lock')), false);
        const { Session } = await import('../dist/session.js');
        const session = Session.open(workspace, { id });
        try {
          assert.equal(session.fileReadCache.get(path.join(workspace, 'target.txt'))?.content ?? null, approved && !forward ? 'BEFORE' : null);
          assert.equal(session.fileReadCache.get(path.join(workspace, 'alias.txt'))?.content ?? null, approved && forward ? (restart ? 'RETARGETED' : 'BEFORE') : null);
        } finally { session.close(); }
        rows.push({ label, restart, read: read.content, write: write.content });
      }
    }
    console.log(JSON.stringify({ compiled, aliasPty, rows }));
  }
  if (aliasCache || aliasMatrix) {
    for (const direction of aliasMatrix ? ['allow', 'ask', 'deny'] : ['link-to-target', 'target-to-link']) {
      const workspace = path.join(temporary, direction), user = path.join(temporary, `${direction}-user`);
      fs.mkdirSync(workspace); fs.mkdirSync(user); fs.mkdirSync(path.join(workspace, '.harness'));
      const permissions = aliasMatrix ? { mode: 'default', allow: ['write_file', 'read_file'], ask: [], deny: [] }
        : { mode: 'bypass', allow: [], deny: [] };
      if (aliasMatrix && direction !== 'allow') permissions[direction].push('read_file');
      fs.writeFileSync(path.join(workspace, '.harness/settings.json'), JSON.stringify({ permissions }));
      fs.writeFileSync(path.join(workspace, 'target.txt'), 'BEFORE');
      fs.symlinkSync('target.txt', path.join(workspace, 'alias.txt'));
      const forward = !aliasReversePolicy && (aliasPolicy || direction === 'link-to-target');
      current = { name: 'read_file', input: { path: forward ? 'alias.txt' : 'target.txt' },
        write: { name: 'write_file', input: { path: forward ? 'target.txt' : 'alias.txt', content: 'AFTER', overwrite: true } } };
      calls = 0;
      child = spawn(process.execPath, [...(compiled ? [path.join(project, 'bin/personal-harness.mjs')] : ['--import', 'tsx', path.join(project, 'src/cli.ts')]),
        '--workspace', workspace, '--user-dir', user, '--max-turns', '4', '--output-format', 'json', 'Exercise the local fixture'],
      { cwd: project, env, stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = ''; child.stderr.on('data', chunk => { stderr += chunk; }); child.stdout.resume();
      const timer = setTimeout(() => child?.kill('SIGKILL'), 20000);
      const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
      clearTimeout(timer); child = undefined;
      assert.equal(code, 0, `${direction}: ${stderr}`);
      assert.equal(calls, 3, direction);
      const journal = fs.readdirSync(path.join(workspace, '.agent')).find(file => file.endsWith('.jsonl'));
      assert.ok(journal, direction);
      const records = fs.readFileSync(path.join(workspace, '.agent', journal), 'utf8').trim().split('\n').map(line => JSON.parse(line));
      const read = records.find(record => record.kind === 'tool_result' && record.result.tool_use_id === 'leaf-call')?.result;
      const write = records.find(record => record.kind === 'tool_result' && record.result.tool_use_id === 'alias-write')?.result;
      assert.ok(read && write, direction);
      const readDenied = aliasMatrix && direction !== 'allow';
      assert.equal(read.is_error === true, readDenied, String(read.content));
      if (direction === 'ask') assert.match(String(read.content), /approv/i);
      if (!readDenied) assert.match(String(read.content), /BEFORE/);
      const denied = readDenied || !forward;
      assert.equal(write.is_error === true, denied, String(write.content));
      if (!forward) assert.match(String(write.content), /symbolic link/i);
      assert.equal(fs.readFileSync(path.join(workspace, 'target.txt'), 'utf8'), denied ? 'BEFORE' : 'AFTER');
      const cache = {};
      if (compiled && aliasMatrix) {
        const { Session } = await import('../dist/session.js');
        const id = records[0].id;
        assert.ok(id, 'session id');
        const reopened = Session.open(workspace, { id });
        try {
          cache.target = reopened.fileReadCache.get(path.join(workspace, 'target.txt'))?.content ?? null;
          cache.alias = reopened.fileReadCache.get(path.join(workspace, 'alias.txt'))?.content ?? null;
          assert.equal(cache.target, readDenied ? null : denied ? 'BEFORE' : 'AFTER');
          assert.equal(cache.alias, null);
        } finally { reopened.close(); }
        current.write.input.content = 'AFTER_RESTART';
        calls = 0;
        child = spawn(process.execPath, [path.join(project, 'bin/personal-harness.mjs'),
          '--workspace', workspace, '--resume', id, '--output-format', 'json', 'Repeat the local fixture'],
        { cwd: project, env, stdio: ['ignore', 'pipe', 'pipe'] });
        let restartStderr = ''; child.stderr.on('data', chunk => { restartStderr += chunk; }); child.stdout.resume();
        const restartTimer = setTimeout(() => child?.kill('SIGKILL'), 20000);
        const restartCode = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
        clearTimeout(restartTimer); child = undefined;
        assert.equal(restartCode, 0, restartStderr);
        assert.equal(calls, 3);
        const after = fs.readFileSync(path.join(workspace, '.agent', journal), 'utf8').trim().split('\n').map(line => JSON.parse(line)).slice(records.length);
        const reread = after.find(record => record.kind === 'tool_result' && record.result.tool_use_id === 'leaf-call')?.result;
        const rewrite = after.find(record => record.kind === 'tool_result' && record.result.tool_use_id === 'alias-write')?.result;
        assert.ok(reread && rewrite);
        assert.equal(reread.is_error === true, readDenied, String(reread.content));
        assert.equal(rewrite.is_error === true, denied, String(rewrite.content));
        if (!forward) assert.match(String(rewrite.content), /symbolic link/i);
        assert.equal(fs.readFileSync(path.join(workspace, 'target.txt'), 'utf8'), denied ? 'BEFORE' : 'AFTER_RESTART');
        const afterRestart = Session.open(workspace, { id });
        try {
          cache.afterTarget = afterRestart.fileReadCache.get(path.join(workspace, 'target.txt'))?.content ?? null;
          cache.afterAlias = afterRestart.fileReadCache.get(path.join(workspace, 'alias.txt'))?.content ?? null;
          assert.equal(cache.afterTarget, readDenied ? null : denied ? 'BEFORE' : 'AFTER_RESTART');
          assert.equal(cache.afterAlias, null);
        } finally { afterRestart.close(); }
        cache.reread = reread.content;
        cache.rewrite = rewrite.content;
      }
      rows.push({ direction, read: read.content, write: write.content, denied, readDenied, cache });
    }
    console.log(JSON.stringify({ compiled, aliasCache, rows }));
  }
  if (!aliasCache && !aliasMatrix && !aliasPty)
  for (const name of ['write_file', 'edit_file', 'notebook_edit']) {
    for (const state of ['leaf', 'normal', 'parent', 'rewrite', 'invalid-rewrite', 'invalid-rewrite-conditional', 'invalid-direct']) {
      const workspace = path.join(temporary, `${name}-${state}`), user = path.join(temporary, `${name}-${state}-user`);
      fs.mkdirSync(workspace); fs.mkdirSync(user); fs.mkdirSync(path.join(workspace, '.harness')); fs.mkdirSync(path.join(workspace, 'dir'));
      const notebook = name === 'notebook_edit';
      const basename = notebook ? 'target.ipynb' : 'target.txt';
      const alias = notebook ? 'alias.ipynb' : 'alias.txt';
      const original = notebook ? JSON.stringify({ cells: [{ id: 'cell', cell_type: 'markdown', source: 'ORIGINAL', metadata: {} }], metadata: {}, nbformat: 4, nbformat_minor: 5 }) : 'ORIGINAL';
      const file = path.join(workspace, 'dir', basename);
      fs.writeFileSync(file, original);
      fs.symlinkSync(path.join('dir', basename), path.join(workspace, alias));
      fs.symlinkSync('dir', path.join(workspace, 'parent'));
      const inputFor = selected => name === 'write_file' ? { path: selected, content: 'CHANGED', overwrite: true }
        : name === 'edit_file' ? { path: selected, old_string: 'ORIGINAL', new_string: 'CHANGED' }
        : { path: selected, cell_id: 'cell', new_source: 'CHANGED' };
      const ordinary = path.join('dir', basename);
      const invalid = path.join('dir', `bad�${notebook ? '.ipynb' : '.txt'}`);
      const selected = state.startsWith('invalid-') ? invalid : state === 'leaf' ? alias : state === 'parent' ? path.join('parent', basename) : ordinary;
      const settings = { features: { notebooks: true }, permissions: { mode: 'bypass', allow: [], deny: [] } };
      if (state === 'rewrite' || state.startsWith('invalid-rewrite')) {
        const target = state === 'rewrite' ? alias : ordinary;
        const answer = JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'allow', updatedInput: inputFor(target) } } });
        settings.permissions = state === 'invalid-rewrite-conditional'
          ? { mode: 'default', allow: [], deny: [], inputRules: [{ tool: name, path: invalid, decision: 'ask' }] }
          : { mode: 'default', allow: [], deny: [], ask: [name] };
        settings.hooks = { PermissionRequest: [{ matcher: name, command: `printf called > hook-called; printf '%s' '${answer}'` }] };
      }
      fs.writeFileSync(path.join(workspace, '.harness', 'settings.json'), JSON.stringify(settings));
      current = { name, input: inputFor(selected) };
      calls = 0;
      child = spawn(process.execPath, [...(compiled ? [path.join(project, 'bin/personal-harness.mjs')] : ['--import', 'tsx', path.join(project, 'src/cli.ts')]),
        '--workspace', workspace, '--user-dir', user, '--max-turns', '4', '--output-format', 'json', 'Exercise the local fixture'],
      { cwd: project, env, stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      child.stderr.on('data', chunk => { stderr += chunk; });
      child.stdout.resume();
      const timer = setTimeout(() => child?.kill('SIGKILL'), 20000);
      const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
      clearTimeout(timer); child = undefined;
      assert.equal(code, 0, `${name}/${state}: ${stderr}`);
      const journal = fs.readdirSync(path.join(workspace, '.agent')).find(file => file.endsWith('.jsonl'));
      assert.ok(journal);
      const records = fs.readFileSync(path.join(workspace, '.agent', journal), 'utf8').trim().split('\n').map(line => JSON.parse(line));
      const result = records.find(record => record.kind === 'tool_result' && record.result.tool_use_id === 'leaf-call')?.result;
      assert.ok(result, `${name}/${state}`);
      assert.equal(calls, 2, `${name}/${state}`);
      const changed = fs.readFileSync(file, 'utf8');
      const shouldDeny = state === 'invalid-direct' || state === 'invalid-rewrite' || invalidBaseline && state === 'invalid-rewrite-conditional' || !baseline && (state === 'leaf' || state === 'rewrite');
      if (shouldDeny) {
        assert.equal(result.is_error, true, `${name}/${state}: ${result.content}`);
        const expected = state === 'invalid-rewrite' && !invalidBaseline ? /requires approval by permission rule/i
          : state === 'invalid-direct' && notebook && !invalidBaseline ? /path does not exist/i
          : state.startsWith('invalid-') ? /replacement character/i : /symbolic link/i;
        assert.match(String(result.content), expected);
        assert.equal(changed, original);
      } else {
        assert.equal(result.is_error, undefined, `${name}/${state}: ${result.content}`);
        assert.match(changed, /CHANGED/);
      }
      if (state.startsWith('invalid-rewrite')) assert.equal(fs.existsSync(path.join(workspace, 'hook-called')), !invalidBaseline);
      assert.equal(fs.existsSync(path.join(workspace, invalid)), false);
      assert.equal(fs.lstatSync(path.join(workspace, alias)).isSymbolicLink(), true);
      rows.push({ tool: name, state, denied: result.is_error === true, calls });
    }
  }
  if (!aliasCache && !aliasMatrix && !aliasPty) console.log(JSON.stringify({ compiled, baseline, invalidBaseline, cases: rows.length, rows }));
} finally {
  if (child && child.exitCode === null && child.signalCode === null) { const closed = new Promise(resolve => child.once('close', resolve)); child.kill('SIGKILL'); await closed; }
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  fs.rmSync(temporary, { recursive: true, force: true });
}
