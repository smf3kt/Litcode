import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = process.argv.includes('--source');
const module = new URL(source ? '../src/memory-consolidation-state.ts' : '../dist/memory-consolidation-state.js', import.meta.url).href;
const workspace = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'memory-consolidation-race-')));
const children = [];
const worker = `
  import fs from 'node:fs';
  import { acquireMemoryConsolidation } from ${JSON.stringify(module)};
  const [workspace, pause] = process.argv.slice(1);
  const lock = workspace + '/.harness/memory-consolidation.json.lock';
  const proceed = workspace + '/proceed';
  const unlink = fs.unlinkSync;
  fs.unlinkSync = function(file) {
    if (pause === 'yes' && file === lock && !fs.existsSync(proceed)) {
      process.send({ event: 'paused', pid: process.pid });
      const until = Date.now() + 8000;
      while (!fs.existsSync(proceed)) {
        if (Date.now() >= until) throw new Error('Race barrier expired');
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
      }
    }
    return unlink.call(fs, file);
  };
  const lease = acquireMemoryConsolidation(workspace, 900002);
  process.send({ event: 'admitted', acquired: lease !== undefined, pid: process.pid });
  if (!lease) process.disconnect();
  else process.on('message', message => {
    if (message === 'finish') {
      try { lease.complete(); lease.release(); process.send({ event: 'finished', pid: process.pid }); }
      catch (error) { process.send({ event: 'failure', message: error.message, pid: process.pid }); }
      process.disconnect();
    }
  });
`;
function start(pause) {
  const child = spawn(process.execPath, [...source ? ['--import', 'tsx'] : [], '--input-type=module', '-e', worker,
    workspace, pause ? 'yes' : 'no'], { cwd: root, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk; });
  const messages = [];
  const waiting = new Set();
  child.on('message', message => { messages.push(message); for (const wake of waiting) wake(); });
  const exit = new Promise(resolve => child.once('close', (code, signal) => { resolve({ code, signal, stderr }); }));
  const wait = event => new Promise((resolve, reject) => {
    const timer = setTimeout(() => { waiting.delete(check); reject(new Error(`Missing ${event}: ${stderr}`)); }, 10000);
    const check = () => {
      const message = messages.find(item => item.event === event);
      if (message) { clearTimeout(timer); waiting.delete(check); resolve(message); }
    };
    waiting.add(check); check();
  });
  const result = { child, exit, wait };
  children.push(result);
  return result;
}
try {
  fs.mkdirSync(path.join(workspace, '.harness'));
  const file = path.join(workspace, '.harness/memory-consolidation.json');
  fs.writeFileSync(file, JSON.stringify({ version: 1, lastConsolidatedAt: 333333 }));
  fs.writeFileSync(file + '.lock', JSON.stringify({ pid: 99999999, token: randomUUID() }));
  const first = start(true);
  await first.wait('paused');
  const second = start(false);
  const competing = await second.wait('admitted');
  fs.writeFileSync(path.join(workspace, 'proceed'), 'continue');
  const acquired = await first.wait('admitted');
  assert.equal(acquired.acquired, true);
  assert.equal(competing.acquired, false, 'only one stale-lock recoverer may enter the critical section');
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).lastConsolidatedAt, 333333);
  first.child.send('finish');
  assert.equal((await first.wait('finished')).pid, acquired.pid);
  assert.equal((await first.exit).code, 0);
  assert.equal((await second.exit).code, 0);
  const successor = start(false);
  assert.equal((await successor.wait('admitted')).acquired, true);
  successor.child.send('finish');
  await successor.wait('finished');
  assert.equal((await successor.exit).code, 0);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).lastConsolidatedAt, 900002);
  assert.equal(fs.existsSync(file + '.lock'), false);
  console.log(JSON.stringify({ leaseRace: 'passed', compiled: !source, recoverers: 2,
    admitted: 1, successor: true, stampPreservedUntilSuccess: true, processes: children.length }));
} finally {
  fs.writeFileSync(path.join(workspace, 'proceed'), 'cleanup');
  for (const item of children) {
    if (item.child.exitCode === null && item.child.signalCode === null) item.child.kill('SIGKILL');
  }
  await Promise.all(children.map(item => item.exit));
  fs.rmSync(workspace, { recursive: true, force: true });
}
