import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// This entrypoint requires explicit paid-call approval for this selected model.
if (!process.argv.includes('--approved-usd-1')) throw new Error('Explicit --approved-usd-1 is required');
const root = fileURLToPath(new URL('..', import.meta.url));
const model = 'deepseek/deepseek-flash', gateway = 'http://127.0.0.1:3425';
const credential = process.env.LLM_API_KEY ?? (process.env.ANTHROPIC_BASE_URL === gateway ? process.env.ANTHROPIC_AUTH_TOKEN : undefined);
if (!credential) throw new Error('Local gateway credential reference is absent');
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'litcode-live-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user); fs.mkdirSync(path.join(workspace, '.harness'));
fs.writeFileSync(path.join(workspace, '.harness/settings.json'), JSON.stringify({ features: {
  tasks: false, subagents: false, notebooks: false, background: false, scheduler: false, agentMessaging: false,
  agentIdle: false, agentTypes: false, interaction: false, web: false, checkpoints: false, worktrees: false,
  memory: false, media: false, workflow: false, workflowPersistence: false, lsp: false,
} }));
let upstreamRequests = 0;
const observations = [], runs = [];
const server = http.createServer(async (req, res) => {
  try {
    if (req.url !== '/v1/messages' || req.method !== 'POST') { res.writeHead(400); res.end('Only Messages requests are accepted'); return; }
    let text = ''; for await (const chunk of req) { text += chunk; if (Buffer.byteLength(text) > 100000) throw new Error('Input byte budget exceeded'); }
    const body = JSON.parse(text);
    if (upstreamRequests >= 2 || body.model !== model || body.max_tokens > 512 || body.thinking) throw new Error('Live acceptance request budget exceeded');
    upstreamRequests++;
    const response = await fetch(gateway + '/v1/messages', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(60000),
      headers: { authorization: `Bearer ${credential}`, 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' }, body: text });
    observations.push({ request: upstreamRequests, status: response.status, requestBytes: Buffer.byteLength(text), maxOutputTokens: body.max_tokens });
    res.writeHead(response.status, { 'Content-Type': response.headers.get('content-type') ?? 'application/json' });
    for await (const bytes of response.body) res.write(bytes);
    res.end();
  } catch { if (!res.headersSent) res.writeHead(502); res.end('Live acceptance guard ended the request'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('LLM_') && !key.startsWith('ANTHROPIC_')));
env.LLM_API_KEY = credential;
async function run(args) {
  const child = spawn(process.execPath, [path.join(root, 'bin/litcode.mjs'), '--workspace', workspace,
    '--max-model-calls', '1', ...args], { cwd: root, env });
  let stdout = '', stderr = '';
  child.stdout.on('data', bytes => stdout += bytes); child.stderr.on('data', bytes => stderr += bytes);
  const timer = setTimeout(() => child.kill('SIGKILL'), 70000);
  const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
  clearTimeout(timer);
  runs.push({ code, budgetStopped: /budget/i.test(stdout + stderr) });
  return { code, stdout, stderr };
}
try {
  const baseURL = `http://127.0.0.1:${server.address().port}`;
  await run(['--user-dir', user, '--model', model, '--base-url', baseURL, '--effort', 'low', '--max-tokens', '512',
    '--allow-tool', 'write_file', 'Call write_file exactly once to create hello.txt containing exactly "Hello from live Magpie.\\n" (a real newline). Then finish briefly. Do not call any other tool.']);
  assert.equal(fs.readFileSync(path.join(workspace, 'hello.txt'), 'utf8'), 'Hello from live Magpie.\n');
  const journals = fs.readdirSync(path.join(workspace, '.agent')).filter(name => name.endsWith('.jsonl'));
  assert.equal(journals.length, 1);
  const id = journals[0].slice(0, -6), file = path.join(workspace, '.agent', journals[0]);
  let events = fs.readFileSync(file, 'utf8').trim().split('\n').map(line => JSON.parse(line));
  const paired = events.some(event => event.kind === 'message' && event.message?.role === 'user' && Array.isArray(event.message.content) && event.message.content.some(block => block.type === 'tool_result'));
  assert.equal(events.filter(event => event.kind === 'tool_start' && event.name === 'write_file').length, 1);
  assert.equal(paired, true);
  const second = await run(['--resume', id, '--continue']);
  assert.equal(second.code, 0);
  const journal = fs.readFileSync(file, 'utf8');
  assert.equal(journal.includes(credential), false);
  events = journal.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(events.filter(event => event.kind === 'tool_start' && event.name === 'write_file').length, 1);
  assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.endsWith('.lock')), false);
  const usage = events.filter(event => event.kind === 'message' && event.message?.role === 'assistant').map(event => event.response?.usage ?? null);
  console.log(JSON.stringify({ liveMagpie: 'passed', model, upstreamRequests, requestLimits: { requests: 2, bytesPerRequest: 100000, outputPerRequest: 512 },
    observations, runs, actualFileWrite: true, pairedToolResults: paired, resumedSameJournal: true, noToolReplay: true,
    credentialsExcluded: true, locksReleased: true, usage, routeChanged: false, credentialRotated: false,
    budgetUsd: 1, pricingBasis: 'DeepSeek official peak rates input0.30/output1.20 USD per million; Magpie markup unverified' }));
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); fs.rmSync(temporary, { recursive: true, force: true }); }
