import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const usage = 'Usage: node scripts/launch-magpie.mjs [--check] [--base-url URL] [--model ID] [--start-app PATH | --start-command JSON_ARGV] [--startup-timeout-ms N] -- CLI_ARGS';
const raw = process.argv.slice(2), separator = raw.indexOf('--');
const options = separator < 0 ? raw : raw.slice(0, separator);
const childArgs = separator < 0 ? [] : raw.slice(separator + 1);
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
let base = process.env.LLM_BASE_URL ?? 'http://127.0.0.1:3425';
let model = process.env.LLM_MODEL, check = false, startApp, startCommand, startupTimeout = 15000;
const seen = new Set();
for (let i = 0; i < options.length; i++) {
  const option = options[i];
  if (seen.has(option)) throw new Error('Duplicate launcher option');
  seen.add(option);
  if (option === '--check') check = true;
  else if (['--base-url', '--model', '--start-app', '--start-command', '--startup-timeout-ms'].includes(option) && options[i + 1]) {
    const value = options[++i];
    if (option === '--base-url') base = value;
    if (option === '--model') model = value;
    if (option === '--start-app') startApp = value;
    if (option === '--start-command') {
      try { startCommand = JSON.parse(value); } catch { throw new Error('Start command must be a JSON argument array'); }
      if (!Array.isArray(startCommand) || !startCommand.length || startCommand.length > 128 || startCommand.some(x => typeof x !== 'string' || x.includes('\0') || x.length > 4096) || !startCommand[0]) throw new Error('Invalid start command argument array');
    }
    if (option === '--startup-timeout-ms') {
      if (!/^\d+$/.test(value) || Number(value) < 100 || Number(value) > 120000) throw new Error('Startup timeout must be 100..120000ms');
      startupTimeout = Number(value);
    }
  } else throw new Error(usage);
}
if (startApp && startCommand) throw new Error('Select one start action');
if (startApp) {
  if (process.platform !== 'darwin') throw new Error('Application launch requires macOS; use an explicit command on other platforms');
  startApp = fs.realpathSync(startApp);
  if (!startApp.endsWith('.app') || !fs.statSync(startApp).isDirectory()) throw new Error('Start application must be an existing .app directory');
}
function childOption(name) {
  let found;
  for (let i = 0; i < childArgs.length; i++) {
    const arg = childArgs[i];
    if (arg !== name && !arg.startsWith(name + '=')) continue;
    const value = arg === name ? childArgs[++i] : arg.slice(name.length + 1);
    if (!value || value.startsWith('--') || found !== undefined) throw new Error('Invalid or duplicate child option');
    found = value;
  }
  return found;
}
const resume = childOption('--resume');
if (resume !== undefined) {
  if (!uuid.test(resume)) throw new Error('Resume requires a session UUID');
  const workspace = childOption('--workspace') ?? process.cwd();
  const file = path.join(workspace, '.agent', `${resume}.jsonl`);
  const storage = fs.lstatSync(path.dirname(file));
  if (!storage.isDirectory() || storage.isSymbolicLink()) throw new Error('Session storage must be a real directory');
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  let metadata;
  try {
    if (!fs.fstatSync(fd).isFile()) throw new Error('Session metadata requires a regular journal');
    const bytes = Buffer.alloc(1024 * 1024), size = fs.readSync(fd, bytes, 0, bytes.length, 0);
    const end = bytes.subarray(0, size).indexOf(10);
    if (end < 0) throw new Error('Session metadata exceeds launcher limit');
    try { metadata = JSON.parse(bytes.subarray(0, end).toString('utf8')); } catch { throw new Error('Invalid pinned session metadata'); }
  } finally { fs.closeSync(fd); }
  if (metadata.kind !== 'metadata' || (metadata.id !== undefined && metadata.id !== resume) ||
      typeof metadata.config?.model !== 'string' || typeof metadata.config?.gateway?.baseURL !== 'string' ||
      (metadata.config.gateway.auth !== undefined && !['bearer', 'api-key'].includes(metadata.config.gateway.auth))) throw new Error('Invalid pinned session metadata');
  base = metadata.config.gateway.baseURL; model = metadata.config.model;
}
let url;
try { url = new URL(base); } catch { throw new Error('Invalid gateway origin'); }
if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) {
  throw new Error('Magpie launcher requires an HTTP loopback origin without embedded credentials');
}
base = url.origin;
if (!model || !model.trim()) throw new Error('Select a model with --model or LLM_MODEL');
const credential = process.env.LLM_API_KEY ?? (process.env.ANTHROPIC_BASE_URL?.replace(/\/$/, '') === base ? process.env.ANTHROPIC_AUTH_TOKEN : undefined);
if (!check) {
  if (!credential) throw new Error('Set LLM_API_KEY or use an existing credential reference for this exact gateway');
  if (!childArgs.length) throw new Error('Pass CLI arguments after --, or use --check');
  if (childArgs.some(arg => /^(--base-url|--model|--auth)(=|$)/.test(arg))) throw new Error('Gateway/model options belong before --');
}
const controller = new AbortController();
let interruption;
const onInterrupt = () => { interruption = 130; controller.abort(); };
const onTerminate = () => { interruption = 143; controller.abort(); };
process.on('SIGINT', onInterrupt); process.on('SIGTERM', onTerminate);
const children = new Set();
function start(command, args, options = {}) {
  const child = spawn(command, args, options);
  const record = { child, stopped: false, group: options.detached === true };
  // Install listeners immediately so spawn errors cannot become unhandled.
  record.done = new Promise(resolve => {
    child.once('error', () => { record.stopped = true; resolve({ code: 1, error: true }); });
    child.once('close', (code, signal) => { record.stopped = true; resolve({ code: code ?? (signal === 'SIGINT' ? 130 : 143) }); });
  });
  children.add(record);
  return record;
}
function kill(record, signal) {
  if (record.stopped) return;
  try { if (record.group && process.platform !== 'win32' && record.child.pid) process.kill(-record.child.pid, signal); else record.child.kill(signal); }
  catch (error) { if (error.code !== 'ESRCH') throw error; }
}
async function cleanup(record) {
  if (record.stopped) return;
  kill(record, 'SIGTERM');
  const timer = setTimeout(() => kill(record, 'SIGKILL'), 1000);
  try { await record.done; } finally { clearTimeout(timer); }
}
function refused(error) {
  const cause = error?.cause;
  return cause?.code === 'ECONNREFUSED' || (Array.isArray(cause?.errors) && cause.errors.length > 0 && cause.errors.every(e => e.code === 'ECONNREFUSED'));
}
async function read(endpoint, timeout = 3000) {
  const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(Math.max(1, timeout))]);
  const response = await fetch(base + endpoint, { redirect: 'error', signal });
  if (!response.ok) throw new Error(`Magpie discovery ${endpoint}: HTTP ${response.status}`);
  const length = response.headers.get('content-length');
  if (length && Number(length) > 1024 * 1024) { await response.body?.cancel(); throw new Error('Magpie discovery exceeds limit'); }
  if (!response.body) throw new Error('Empty Magpie discovery');
  const reader = response.body.getReader(), chunks = []; let size = 0;
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length;
    if (size > 1024 * 1024) throw new Error('Magpie discovery exceeds limit'); chunks.push(value); } }
  finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Error('Malformed Magpie discovery'); }
}
async function discover() {
  let startupAction = 'none', discovery;
  let deadline;
  try { discovery = await read('/'); }
  catch (error) {
    if (!refused(error) || (!startCommand && !startApp) || controller.signal.aborted) throw error;
    let owned;
    if (startCommand) {
      const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('LLM_') && !key.startsWith('ANTHROPIC_')));
      owned = start(startCommand[0], startCommand.slice(1), { env, stdio: 'ignore', detached: process.platform !== 'win32' });
      startupAction = 'command';
    } else {
      const opener = start('/usr/bin/open', ['-g', '-a', startApp], { stdio: 'ignore' });
      const result = await Promise.race([opener.done, delay(3000, undefined, { signal: controller.signal }).then(() => ({ error: true }))]);
      if (result.error || result.code !== 0) throw new Error('Application launch failed');
      startupAction = 'application';
    }
    deadline = Date.now() + startupTimeout;
    for (;;) {
      controller.signal.throwIfAborted();
      if (owned?.stopped) throw new Error('Gateway start command exited before readiness');
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error('Magpie startup deadline exceeded');
      try { discovery = await read('/', Math.min(3000, remaining)); break; }
      catch (error) {
        if (controller.signal.aborted) throw error;
        if (Date.now() >= deadline) throw new Error('Magpie startup deadline exceeded');
        if (!refused(error) && error.name !== 'TimeoutError') throw error;
        await delay(Math.min(50, Math.max(1, deadline - Date.now())), undefined, { signal: controller.signal });
      }
    }
  }
  if (discovery?.name !== 'magpie' || !Array.isArray(discovery.apis) || !discovery.apis.includes('/v1/messages')) throw new Error('Gateway did not advertise Magpie Messages');
  return { discovery, startupAction, deadline };
}
try {
  const { discovery, startupAction, deadline } = await discover();
  if (deadline !== undefined && deadline <= Date.now()) throw new Error('Magpie startup deadline exceeded');
  const catalog = await read('/v1/models', deadline === undefined ? 3000 : Math.min(3000, deadline - Date.now()));
  controller.signal.throwIfAborted();
  const selected = Array.isArray(catalog.data) ? catalog.data.find(item => item.id === model) : undefined;
  if (!selected) throw new Error('Selected model is absent from the gateway catalog');
  if (Array.isArray(selected.native_endpoints) && !selected.native_endpoints.includes('/v1/messages')) throw new Error('Selected model does not advertise Messages');
  if (check) {
    console.log(JSON.stringify({ launcher: 'ready', baseURL: base, gatewayVersion: discovery.version,
      model, credentialPresent: !!credential, resumePinned: resume !== undefined, startupAction, modelCalls: 0 }));
  } else {
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('ANTHROPIC_')));
    Object.assign(env, { LLM_API_KEY: credential, LLM_BASE_URL: base, LLM_MODEL: model });
    const child = start(process.execPath, [path.join(root, 'bin/litcode.mjs'), ...childArgs], { env, stdio: 'inherit' });
    let termination;
    const abort = () => {
      kill(child, interruption === 130 ? 'SIGINT' : 'SIGTERM');
      termination ??= cleanup(child);
      void termination.catch(() => {});
    };
    controller.signal.addEventListener('abort', abort, { once: true });
    try {
      if (controller.signal.aborted) abort();
      const result = await child.done;
      if (result.error) throw new Error('LiTcode process failed to start');
      process.exitCode = interruption ?? result.code;
    } finally {
      controller.signal.removeEventListener('abort', abort);
      await termination;
    }
  }
} catch (error) {
  process.exitCode = interruption ?? 1;
  if (!interruption) console.error(error instanceof TypeError ? 'Magpie gateway connection failed' : error.message);
} finally {
  await Promise.all([...children].map(cleanup));
  process.off('SIGINT', onInterrupt); process.off('SIGTERM', onTerminate);
}
