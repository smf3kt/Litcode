import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scratch = process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir();
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(scratch, 'leaf-permission-cli-')));
const compiled = process.argv.includes('--compiled');
const baseline = process.argv.includes('--baseline');
const invalidBaseline = process.argv.includes('--invalid-baseline');
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
      const events = calls === 1 ? [
        { type: 'message_start', message: { id: 'leaf-fixture', type: 'message', role: 'assistant', model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
        { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'leaf-call', name: current.name, input: {} } },
        { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: JSON.stringify(current.input) } },
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
  for (const name of ['write_file', 'edit_file', 'notebook_edit']) {
    for (const state of ['leaf', 'normal', 'parent', 'rewrite', 'invalid-rewrite', 'invalid-direct']) {
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
      if (state === 'rewrite' || state === 'invalid-rewrite') {
        const target = state === 'rewrite' ? alias : ordinary;
        const answer = JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'allow', updatedInput: inputFor(target) } } });
        settings.permissions = { mode: 'default', allow: [], deny: [], ask: [name] };
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
      const shouldDeny = state === 'invalid-direct' || invalidBaseline && state === 'invalid-rewrite' || !baseline && (state === 'leaf' || state === 'rewrite');
      if (shouldDeny) {
        assert.equal(result.is_error, true, `${name}/${state}: ${result.content}`);
        const expected = state === 'invalid-direct' && notebook && !invalidBaseline ? /path does not exist/i
          : state.startsWith('invalid-') ? /replacement character/i : /symbolic link/i;
        assert.match(String(result.content), expected);
        assert.equal(changed, original);
      } else {
        assert.equal(result.is_error, undefined, `${name}/${state}: ${result.content}`);
        assert.match(changed, /CHANGED/);
      }
      if (state === 'invalid-rewrite') assert.equal(fs.existsSync(path.join(workspace, 'hook-called')), !invalidBaseline);
      assert.equal(fs.existsSync(path.join(workspace, invalid)), false);
      assert.equal(fs.lstatSync(path.join(workspace, alias)).isSymbolicLink(), true);
      rows.push({ tool: name, state, denied: result.is_error === true, calls });
    }
  }
  console.log(JSON.stringify({ compiled, baseline, invalidBaseline, cases: rows.length, rows }));
} finally {
  if (child) { const closed = new Promise(resolve => child.once('close', resolve)); child.kill('SIGKILL'); await closed; }
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  fs.rmSync(temporary, { recursive: true, force: true });
}
