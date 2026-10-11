import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'litcode-coding-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user);
fs.writeFileSync(path.join(workspace, 'sum.mjs'), 'export const sum = (a, b) => a - b;\n');
fs.writeFileSync(path.join(workspace, 'sum.test.mjs'), 'import assert from "node:assert/strict"; import {sum} from "./sum.mjs"; assert.equal(sum(2,3),5); assert.equal(sum(-2,3),1); console.log("sum checks passed");\n');
const compiled = process.argv.includes('--compiled');
const plan = [
  ['read_file', { path: 'sum.mjs' }],
  ['edit_file', { path: 'sum.mjs', old_string: 'a - b', new_string: 'a + b' }],
  ['run_command', { command: 'node sum.test.mjs' }],
  null,
  ['read_file', { path: 'sum.mjs' }],
  ['run_command', { command: 'node sum.test.mjs' }],
  null,
];
let calls = 0;
const requests = [];
const server = http.createServer(async (req, res) => {
  try {
    let text = ''; for await (const chunk of req) text += chunk;
    const body = JSON.parse(text); requests.push(body);
    const step = plan[calls++];
    const content = step ? { type: 'tool_use', id: `coding-${calls}`, name: step[0], input: step[1] }
      : { type: 'text', text: 'Code fixed and checks passed.' };
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    const emit = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    emit('message_start', { type: 'message_start', message: { id: `coding-${calls}`, type: 'message', role: 'assistant', model: body.model,
      content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } } });
    emit('content_block_start', { type: 'content_block_start', index: 0,
      content_block: step ? { ...content, input: {} } : { type: 'text', text: '' } });
    emit('content_block_delta', { type: 'content_block_delta', index: 0, delta: step
      ? { type: 'input_json_delta', partial_json: JSON.stringify(content.input) } : { type: 'text_delta', text: content.text } });
    emit('content_block_stop', { type: 'content_block_stop', index: 0 });
    emit('message_delta', { type: 'message_delta', delta: { stop_reason: step ? 'tool_use' : 'end_turn', stop_sequence: null }, usage: { output_tokens: 10 } });
    emit('message_stop', { type: 'message_stop' }); res.end();
  } catch (error) { res.writeHead(500); res.end(String(error)); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const endpoint = `http://127.0.0.1:${server.address().port}`;
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('LLM_') && !key.startsWith('ANTHROPIC_')));
env.LLM_API_KEY = 'owned-coding-fixture-credential'; env.LLM_BASE_URL = endpoint; env.LLM_MODEL = 'fixture/coding';
async function run(extra, prompt) {
  const args = compiled ? [path.join(root, 'bin/litcode.mjs')] : ['--import', 'tsx', path.join(root, 'src/cli.ts')];
  const child = spawn(process.execPath, [...args, '--workspace', workspace, ...(extra.includes('--resume') ? [] : ['--user-dir', user]), ...extra, prompt], { cwd: root, env });
  let stdout = '', stderr = '';
  child.stdout.on('data', bytes => stdout += bytes); child.stderr.on('data', bytes => stderr += bytes);
  const timer = setTimeout(() => child.kill('SIGKILL'), 20000);
  const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
  clearTimeout(timer); assert.equal(code, 0, stderr); assert.match(stdout, /Code fixed and checks passed/);
}
try {
  await run(['--allow-shell', '--allow-tool', 'read_file', '--allow-tool', 'edit_file', '--allow-tool', 'run_command'], 'Fix sum.mjs and run the checks.');
  assert.equal(fs.readFileSync(path.join(workspace, 'sum.mjs'), 'utf8'), 'export const sum = (a, b) => a + b;\n');
  const journals = fs.readdirSync(path.join(workspace, '.agent')).filter(name => name.endsWith('.jsonl'));
  assert.equal(journals.length, 1); const id = journals[0].slice(0, -6);
  env.LLM_API_KEY = 'owned-rotated-fixture-credential';
  await run(['--resume', id], 'Verify the fixed code after resuming.');
  assert.equal(calls, 7);
  const text = fs.readFileSync(path.join(workspace, '.agent', journals[0]), 'utf8');
  const events = text.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(events.filter(event => event.kind === 'tool_start' && event.name === 'edit_file').length, 1);
  assert.equal(events.filter(event => event.kind === 'tool_start' && event.name === 'run_command').length, 2);
  assert.equal(JSON.stringify(requests).includes('sum checks passed'), true);
  assert.equal(text.includes('fixture-credential'), false);
  assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.endsWith('.lock')), false);
  console.log(JSON.stringify({ codingTask: 'passed', compiled, modelCalls: calls, edits: 1, actualCommandChecks: 2,
    resumedSameJournal: true, credentialsExcluded: true, locksReleased: true, provider: 'owned loopback scripted SSE' }));
} finally { await new Promise(resolve => server.close(resolve)); fs.rmSync(temporary, { recursive: true, force: true }); }
