import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const raw = process.argv.slice(2), separator = raw.indexOf('--');
const options = separator < 0 ? raw : raw.slice(0, separator);
const childArgs = separator < 0 ? [] : raw.slice(separator + 1);
let base = process.env.LLM_BASE_URL ?? 'http://127.0.0.1:3425';
let model = process.env.LLM_MODEL, check = false;
for (let i = 0; i < options.length; i++) {
  if (options[i] === '--check') check = true;
  else if (options[i] === '--base-url' && options[i + 1]) base = options[++i];
  else if (options[i] === '--model' && options[i + 1]) model = options[++i];
  else throw new Error('Usage: node scripts/launch-magpie.mjs [--check] [--base-url URL] [--model ID] -- CLI_ARGS');
}
const resumeAt = childArgs.indexOf('--resume');
if (resumeAt >= 0) {
  const id = childArgs[resumeAt + 1], workspaceAt = childArgs.indexOf('--workspace');
  if (!/^[a-f0-9-]{36}$/.test(id ?? '')) throw new Error('Resume requires a session UUID');
  const workspace = workspaceAt >= 0 ? childArgs[workspaceAt + 1] : process.cwd();
  const file = path.join(workspace, '.agent', `${id}.jsonl`);
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  let metadata;
  try {
    if (!fs.fstatSync(fd).isFile()) throw new Error('Session metadata requires a regular journal');
    const bytes = Buffer.alloc(1024 * 1024), size = fs.readSync(fd, bytes, 0, bytes.length, 0);
    const end = bytes.subarray(0, size).indexOf(10);
    if (end < 0) throw new Error('Session metadata exceeds launcher limit');
    metadata = JSON.parse(bytes.subarray(0, end).toString('utf8'));
  } finally { fs.closeSync(fd); }
  if (metadata.kind !== 'metadata' || typeof metadata.config?.model !== 'string') throw new Error('Invalid pinned session metadata');
  base = metadata.config.gateway.baseURL; model = metadata.config.model;
}
const url = new URL(base);
if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) {
  throw new Error('Magpie launcher requires an HTTP loopback origin without embedded credentials');
}
base = url.origin;
async function read(endpoint) {
  const response = await fetch(base + endpoint, { redirect: 'error', signal: AbortSignal.timeout(3000) });
  if (!response.ok) throw new Error(`Magpie discovery ${endpoint}: HTTP ${response.status}`);
  const length = response.headers.get('content-length');
  if (length && Number(length) > 1024 * 1024) throw new Error('Magpie discovery exceeds limit');
  const reader = response.body.getReader(), chunks = []; let size = 0;
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length;
    if (size > 1024 * 1024) throw new Error('Magpie discovery exceeds limit'); chunks.push(value); } }
  finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
const discovery = await read('/');
if (discovery.name !== 'magpie' || !Array.isArray(discovery.apis) || !discovery.apis.includes('/v1/messages')) throw new Error('Gateway did not advertise Magpie Messages');
if (!model) throw new Error('Select a model with --model or LLM_MODEL');
const catalog = await read('/v1/models');
const selected = Array.isArray(catalog.data) ? catalog.data.find(item => item.id === model) : undefined;
if (!selected) throw new Error('Selected model is absent from the gateway catalog');
if (Array.isArray(selected.native_endpoints) && !selected.native_endpoints.includes('/v1/messages')) throw new Error('Selected model does not advertise Messages');
const credential = process.env.LLM_API_KEY ?? (process.env.ANTHROPIC_BASE_URL?.replace(/\/$/, '') === base ? process.env.ANTHROPIC_AUTH_TOKEN : undefined);
if (check) {
  console.log(JSON.stringify({ launcher: 'ready', baseURL: base, gatewayVersion: discovery.version,
    model, credentialPresent: !!credential, resumePinned: resumeAt >= 0, modelCalls: 0 }));
} else {
  if (!credential) throw new Error('Set LLM_API_KEY or use an existing credential reference for this exact gateway');
  if (!childArgs.length) throw new Error('Pass CLI arguments after --, or use --check');
  if (childArgs.some(arg => /^(--base-url|--model|--auth)(=|$)/.test(arg))) throw new Error('Gateway/model options belong before --');
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('ANTHROPIC_')));
  Object.assign(env, { LLM_API_KEY: credential, LLM_BASE_URL: base, LLM_MODEL: model });
  const child = spawn(process.execPath, [path.join(root, 'bin/litcode.mjs'), ...childArgs], { env, stdio: 'inherit' });
  const interrupt = () => child.kill('SIGINT'), terminate = () => child.kill('SIGTERM');
  process.on('SIGINT', interrupt); process.on('SIGTERM', terminate);
  try { process.exitCode = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', (code, signal) => resolve(code ?? (signal === 'SIGINT' ? 130 : 143))); }); }
  finally { process.off('SIGINT', interrupt); process.off('SIGTERM', terminate); }
}
