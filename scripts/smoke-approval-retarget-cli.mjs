import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scratch = process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir();
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(scratch, 'approval-retarget-cli-')));
const baseline = process.argv.includes('--baseline');
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
      const toolCalls = calls === 1 ? [
        ...(current.primer ? [{ id: current.primer.id, name: current.primer.name, input: current.primer.input }] : []),
        { id: 'approval-call', name: current.name, input: current.input },
      ] : [];
      const events = calls === 1 ? [
        { type: 'message_start', message: { id: 'approval-fixture', type: 'message', role: 'assistant', model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
        ...toolCalls.flatMap((toolCall, index) => [
          { type: 'content_block_start', index, content_block: { type: 'tool_use', id: toolCall.id, name: toolCall.name, input: {} } },
          { type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: JSON.stringify(toolCall.input) } },
          { type: 'content_block_stop', index },
        ]),
        { type: 'message_delta', delta: { stop_reason: 'tool_use', stop_sequence: null }, usage: { output_tokens: 2 } },
        { type: 'message_stop' },
      ] : [
        { type: 'message_start', message: { id: 'approval-done', type: 'message', role: 'assistant', model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
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
  Object.assign(env, { LLM_API_KEY: 'owned-approval', LLM_MODEL: 'fixture/approval', LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`,
    LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false' });

  const rows = [];
  const cases = [
    { name: 'read_file', file: 'file.txt', write: false, format: 'text' },
    { name: 'write_file', file: 'file.txt', write: true, format: 'text' },
    { name: 'edit_file', file: 'file.txt', write: true, format: 'text' },
    { name: 'notebook_read', file: 'file.ipynb', write: false, format: 'notebook' },
    { name: 'notebook_edit', file: 'file.ipynb', write: true, format: 'notebook' },
    { name: 'read_media', file: 'file.gif', write: false, format: 'image' },
  ];
  for (const { name, file, write, format } of cases) {
    for (const state of ['stable', 'retarget', 'direct']) {
      const workspace = path.join(temporary, `${name}-${state}`), user = path.join(temporary, `${name}-${state}-user`);
      fs.mkdirSync(workspace); fs.mkdirSync(user); fs.mkdirSync(path.join(workspace, '.harness'));
      fs.mkdirSync(path.join(workspace, 'public')); fs.mkdirSync(path.join(workspace, 'protected'));
      const fixture = text => format === 'notebook'
        ? Buffer.from(JSON.stringify({ cells: [{ id: 'cell', cell_type: 'markdown', source: text, metadata: {} }], metadata: {}, nbformat: 4, nbformat_minor: 5 }))
        : format === 'image' ? Buffer.concat([Buffer.from([71, 73, 70, 56, 57, 97, 1, 0, 1, 0, 0, 0, 0]), Buffer.from(text)])
        : Buffer.from(text);
      const publicPath = path.join(workspace, 'public', file), protectedPath = path.join(workspace, 'protected', file);
      const publicFixture = fixture('PUBLIC_FIXTURE'), protectedFixture = fixture('PROTECTED_FIXTURE');
      fs.writeFileSync(publicPath, publicFixture);
      fs.writeFileSync(protectedPath, protectedFixture);
      fs.symlinkSync('public', path.join(workspace, 'alias'));
      const selected = state === 'direct' ? `protected/${file}` : `alias/${file}`;
      const input = name === 'write_file' ? { path: selected, content: 'WRITE_FIXTURE', overwrite: true }
        : name === 'edit_file' ? { path: selected, old_string: 'FIXTURE', new_string: 'CHANGED' }
        : name === 'notebook_edit' ? { path: selected, cell_id: 'cell', new_source: 'WRITE_FIXTURE' } : { path: selected };
      const answer = JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'allow' } } });
      const command = `${state === 'retarget' ? 'rm alias; ln -s protected alias; ' : ''}printf '%s' '${answer}'`;
      fs.writeFileSync(path.join(workspace, '.harness', 'settings.json'), JSON.stringify({
        features: { notebooks: true, media: true },
        permissions: { mode: 'default', allow: [], deny: [`Read(protected/${file})`],
          ask: [`${write ? 'Edit' : 'Read'}(alias/${file})`] },
        hooks: { PermissionRequest: [{ matcher: name, command }] },
      }));
      current = { name, input, ...(name === 'notebook_edit' ? { primer: { id: 'approval-read', name: 'notebook_read', input: { path: selected } } } : {}) };
      calls = 0;
      child = spawn(process.execPath, [path.join(project, 'bin/personal-harness.mjs'), '--workspace', workspace, '--user-dir', user,
        '--max-turns', '4', '--output-format', 'json', 'Exercise the local fixture'],
      { cwd: project, env, stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      child.stderr.on('data', chunk => { stderr += chunk; });
      child.stdout.resume();
      const timer = setTimeout(() => child?.kill('SIGKILL'), 20000);
      const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
      clearTimeout(timer); child = undefined;
      assert.equal(code, 0, `${name}/${state}: ${stderr}`);
      const journal = fs.readdirSync(path.join(workspace, '.agent')).find(entry => entry.endsWith('.jsonl'));
      assert.ok(journal);
      const records = fs.readFileSync(path.join(workspace, '.agent', journal), 'utf8').trim().split('\n').map(line => JSON.parse(line));
      const result = records.find(record => record.kind === 'tool_result' && record.result.tool_use_id === 'approval-call')?.result;
      assert.ok(result, `${name}/${state}`);
      assert.equal(calls, 2, `${name}/${state}`);
      const publicBytes = fs.readFileSync(publicPath), protectedBytes = fs.readFileSync(protectedPath);
      if (state === 'direct' || state === 'retarget' && !baseline) {
        assert.equal(result.is_error, true, `${name}/${state}: ${JSON.stringify(result.content)}`);
        assert.deepEqual(protectedBytes, protectedFixture);
        assert.deepEqual(publicBytes, publicFixture);
      } else if (!write) {
        assert.equal(result.is_error, undefined, `${name}/${state}: ${JSON.stringify(result.content)}`);
        const target = state === 'retarget' ? protectedFixture : publicFixture;
        if (format === 'image') {
          const image = result.content.find(block => block.type === 'image');
          assert.ok(image, `${name}/${state}`);
          assert.deepEqual(Buffer.from(image.source.data, 'base64'), target);
        } else {
          assert.match(String(result.content), new RegExp(state === 'retarget' ? 'PROTECTED_FIXTURE' : 'PUBLIC_FIXTURE'));
        }
        assert.deepEqual(protectedBytes, protectedFixture);
        assert.deepEqual(publicBytes, publicFixture);
      } else {
        assert.equal(result.is_error, undefined, `${name}/${state}: ${JSON.stringify(result.content)}`);
        const changed = state === 'retarget' ? protectedBytes : publicBytes;
        assert.match(changed.toString('utf8'), name === 'edit_file' ? /CHANGED/ : /WRITE_FIXTURE/);
        assert.deepEqual(state === 'retarget' ? publicBytes : protectedBytes, state === 'retarget' ? publicFixture : protectedFixture);
      }
      rows.push({ tool: name, state, denied: result.is_error === true, calls });
    }
  }
  console.log(JSON.stringify({ baseline, cases: rows.length, rows }));
} finally {
  if (child) { const closed = new Promise(resolve => child.once('close', resolve)); child.kill('SIGKILL'); await closed; }
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  fs.rmSync(temporary, { recursive: true, force: true });
}
