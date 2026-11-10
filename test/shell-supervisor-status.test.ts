import { strict as assert } from 'node:assert';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decodeSupervisorStatus, SupervisorStatusReader, supervisorEffectDisposition } from '../src/shell-supervisor-status.js';
import { runShellSupervisor } from '../src/shell-supervisor-status.js';

const supervisor = fileURLToPath(new URL('../native/shell-supervisor/supervisor', import.meta.url));

function supervisorTemporary(prefix: string): string {
  const base = process.env.CLAUDE_JOB_DIR ? join(process.env.CLAUDE_JOB_DIR, 'tmp') : join(tmpdir(), 'supervisor-status');
  mkdirSync(base, { recursive: true });
  return mkdtempSync(join(base, prefix));
}

test('caller distinguishes real exit 125, exec failure and a truncated protocol', { skip: process.platform !== 'darwin' }, async () => {
  async function run(file: string, args: string[]) {
    const child = spawn(file, args, { stdio: ['pipe', 'ignore', 'ignore', 'pipe'] });
    const status = child.stdio[3];
    assert.ok(status instanceof Readable);
    const reader = new SupervisorStatusReader();
    let raw = '';
    status.on('data', (chunk: Buffer) => { reader.write(chunk); raw += chunk.toString(); });
    const ended = once(status, 'end');
    const [code, signal] = await once(child, 'exit');
    await ended;
    return { outcome: reader.finish({ code, signal }), raw };
  }
  const { outcome: exited } = await run(supervisor, ['/bin/sh', '-c', 'exit 125']);
  assert.deepEqual(exited, { kind: 'exited', code: 125 });
  assert.equal(supervisorEffectDisposition(exited), 'failed');
  const { outcome: missing } = await run(supervisor, ['/definitely-missing-executable']);
  assert.equal(missing.kind, 'not-started');
  if (missing.kind === 'not-started') assert.equal(missing.stage, 'exec');
  const { outcome: truncated, raw } = await run(process.execPath, ['-e', 'require("fs").writeSync(3, \'{"kind":"exit"\')']);
  assert.equal(raw, '{"kind":"exit"');
  assert.equal(truncated.kind, 'unknown');
  assert.equal(supervisorEffectDisposition(truncated), 'unknown');
});

test('caller preserves unknown outcome after supervisor death', { skip: process.platform !== 'darwin' }, async () => {
  const child = spawn(supervisor, ['/bin/sh', '-c', 'echo $$; exec sleep 30'], { stdio: ['pipe', 'pipe', 'ignore', 'pipe'] });
  const status = child.stdio[3];
  assert.ok(status instanceof Readable);
  const reader = new SupervisorStatusReader();
  status.on('data', (chunk: Buffer) => reader.write(chunk));
  const ended = once(status, 'end');
  assert.ok(child.stdout);
  const [output] = await once(child.stdout, 'data');
  const pid = Number(String(output).trim());
  assert.ok(Number.isInteger(pid) && pid > 1);
  try {
    child.kill('SIGKILL');
    const [code, signal] = await once(child, 'exit');
    await ended;
    const outcome = reader.finish({ code, signal });
    assert.equal(outcome.kind, 'unknown');
    assert.equal(supervisorEffectDisposition(outcome), 'unknown');
  } finally {
    try { process.kill(pid, 'SIGKILL'); } catch { /* Already exited. */ }
    child.kill('SIGKILL');
  }
});

test('persistent watcher cleans the worker after either owner dies', { skip: process.platform !== 'darwin', timeout: 15000 }, async () => {
  const gone = (pid: number) => {
    try { return execFileSync('ps', ['-o', 'stat=', '-p', String(pid)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().startsWith('Z'); }
    catch { return true; }
  };
  for (const victim of ['supervisor', 'watcher'] as const) {
    const child = spawn(supervisor, ['/bin/sh', '-c', 'echo $$; exec sleep 30'], { stdio: ['pipe', 'pipe', 'ignore', 'pipe'] });
    const status = child.stdio[3];
    assert.ok(status instanceof Readable);
    const reader = new SupervisorStatusReader();
    status.on('data', (chunk: Buffer) => reader.write(chunk));
    const ended = once(status, 'end');
    const exited = once(child, 'exit');
    assert.ok(child.stdout);
    const [output] = await once(child.stdout, 'data');
    const worker = Number(String(output).trim());
    const watcher = Number(execFileSync('ps', ['-o', 'ppid=', '-p', String(worker)], { encoding: 'utf8' }).trim());
    assert.ok(worker > 1 && watcher > 1 && watcher !== child.pid);
    try {
      if (victim === 'supervisor') child.kill('SIGKILL');
      else process.kill(watcher, 'SIGKILL');
      const [code, signal] = await exited;
      await ended;
      assert.equal(supervisorEffectDisposition(reader.finish({ code, signal })), 'unknown');
      const deadline = Date.now() + 5000;
      while (!gone(worker) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
      assert.ok(gone(worker), `${victim} loss left worker running`);
    } finally {
      try { process.kill(worker, 'SIGKILL'); } catch { /* Already exited. */ }
      try { process.kill(watcher, 'SIGKILL'); } catch { /* Already exited. */ }
      child.kill('SIGKILL');
    }
  }
});

test('malformed or contradictory protocol never establishes a terminal effect', () => {
  const exit = { code: 125, signal: null };
  for (const text of ['', '{"kind":"exit","code":125}', '{"kind":"exit","code":0}\n', '{"kind":"exit","code":125}\n{}\n', 'x'.repeat(1025)]) {
    assert.equal(supervisorEffectDisposition(decodeSupervisorStatus(Buffer.from(text), exit)), 'unknown');
  }
  assert.equal(supervisorEffectDisposition(decodeSupervisorStatus(Buffer.from('{"kind":"error","stage":"waitid","errno":10}\n'), exit)), 'unknown');
  assert.equal(supervisorEffectDisposition(decodeSupervisorStatus(Buffer.from('{"kind":"error","stage":"gate","errno":5}\n'), exit)), 'unknown');
  assert.equal(supervisorEffectDisposition(decodeSupervisorStatus(Buffer.from('{"kind":"error","stage":"child_setup","errno":5}\n'), exit)), 'unknown');
});

test('supervisor API drains output and preserves cancellation after a real effect', { skip: process.platform !== 'darwin' }, async () => {
  const directory = supervisorTemporary('supervisor-api-');
  const marker = join(directory, 'marker');
  try {
    const controller = new AbortController();
    const resultPromise = runShellSupervisor({ supervisor, command: '/bin/sh', args: ['-c', 'printf effect > "$1"; printf ready; exec sleep 30', 'sh', marker], signal: controller.signal });
    const deadline = Date.now() + 5000;
    while (true) {
      try { if (readFileSync(marker, 'utf8') === 'effect') break; } catch { /* Wait for the actual effect. */ }
      if (Date.now() > deadline) { controller.abort(); await resultPromise; throw new Error('effect marker timeout'); }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    controller.abort();
    const result = await resultPromise;
    assert.equal(readFileSync(marker, 'utf8'), 'effect');
    assert.equal(result.outcome.kind, 'cancelled');
    assert.equal(result.effect, 'unknown');
    assert.equal(result.stdout.toString(), 'ready');
    const capped = await runShellSupervisor({ supervisor, command: '/bin/sh', args: ['-c', 'printf 123456'], maxOutputBytes: 3 });
    assert.equal(capped.stdout.toString(), '123');
    assert.equal(capped.truncated, true);
    assert.equal(capped.effect, 'finished');
    const malformed = await runShellSupervisor({ supervisor: process.execPath, command: '-e', args: [`require('fs').writeSync(3, '{"kind":"exit"')`] });
    assert.equal(malformed.effect, 'unknown');
    assert.deepEqual(malformed.outcome, { kind: 'unknown', reason: 'incomplete or multiple status records' });
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('supervisor streams both outputs before completion and permits cancellation on overflow', { skip: process.platform !== 'darwin', timeout: 10000 }, async () => {
  const controller = new AbortController();
  const events: string[] = [];
  const result = await runShellSupervisor({
    supervisor, command: '/bin/sh', args: ['-c', 'printf first; sleep 0.1; printf second >&2; exec sleep 30'],
    signal: controller.signal, maxOutputBytes: 3,
    onOutput(stream, chunk) {
      events.push(`${stream}:${chunk.toString()}`);
      if (stream === 'stderr') controller.abort();
    },
  });
  assert.deepEqual(events, ['stdout:first', 'stderr:second']);
  assert.equal(result.stdout.toString(), 'fir');
  assert.equal(result.truncated, true);
  assert.equal(result.outcome.kind, 'cancelled');
  assert.equal(result.effect, 'unknown');
});

test('output overflow cancels a running supervisor and keeps the effect unknown', { skip: process.platform !== 'darwin', timeout: 10000 }, async () => {
  const start = Date.now();
  const result = await runShellSupervisor({
    supervisor, command: '/bin/sh', args: ['-c', 'printf 1234; exec sleep 30'],
    maxOutputBytes: 3, stopOnOutputLimit: true,
  });
  assert.ok(Date.now() - start < 5000);
  assert.equal(result.stdout.toString(), '123');
  assert.equal(result.outputLimitExceeded, true);
  assert.equal(result.effect, 'unknown');
  const exact = await runShellSupervisor({
    supervisor, command: '/bin/sh', args: ['-c', 'printf 123'], maxOutputBytes: 3, stopOnOutputLimit: true,
  });
  assert.equal(exact.outputLimitExceeded, false);
  assert.equal(exact.effect, 'finished');
  const race = await runShellSupervisor({
    supervisor: process.execPath, command: '-e', args: ["process.stdout.write('1234'); require('fs').writeSync(3, '{\"kind\":\"exit\",\"code\":0}\\n')"],
    maxOutputBytes: 3, stopOnOutputLimit: true,
  });
  assert.equal(race.outcome.kind, 'exited');
  assert.equal(race.effect, 'unknown');
});

test('immediate supervisor cancellation does not run a TERM trap', { skip: process.platform !== 'darwin', timeout: 10000 }, async () => {
  const directory = supervisorTemporary('supervisor-immediate-');
  const marker = join(directory, 'term');
  const controller = new AbortController();
  try {
    const result = await runShellSupervisor({
      supervisor, command: '--kill-immediately', args: ['/bin/sh', '-c', 'trap "printf term > \"$1\"" TERM; printf ready; while :; do :; done', 'sh', marker],
      signal: controller.signal, onOutput(_stream, chunk) { if (chunk.includes('ready')) controller.abort(); },
    });
    assert.equal(result.outcome.kind, 'cancelled');
    assert.equal(result.effect, 'unknown');
    assert.equal(result.stdout.toString(), 'ready');
    assert.throws(() => readFileSync(marker), { code: 'ENOENT' });
    const complete = await runShellSupervisor({ supervisor, command: '--kill-immediately', args: ['/bin/sh', '-c', 'printf done'] });
    assert.equal(complete.outcome.kind, 'exited');
    assert.equal(complete.effect, 'finished');
    assert.equal(complete.stdout.toString(), 'done');
    const missing = await runShellSupervisor({ supervisor, command: '--kill-immediately', args: ['/definitely-missing-executable'] });
    assert.equal(missing.outcome.kind, 'not-started');
    assert.equal(missing.effect, 'failed');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('supervisor API bounds inherited descriptors and preserves unknown status', async () => {
  for (const held of [3, 1, 2]) {
    const controller = new AbortController();
    const fixture = `const {spawn}=require('node:child_process');
      const io=['ignore','ignore','ignore','ignore']; io[${held}]=${held};
      spawn(process.execPath,['-e','setTimeout(()=>{},1500)'],{stdio:io}).unref();
      require('node:fs').writeSync(3, '{"kind":"exit","code":0}\\n');`;
    const abort = held === 3 ? setTimeout(() => controller.abort(), 120) : undefined;
    const result = await Promise.race([
      runShellSupervisor({ supervisor: process.execPath, command: '-e', args: [fixture], signal: controller.signal }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`fd ${held} drain timeout`)), 900).unref()),
    ]);
    if (abort) clearTimeout(abort);
    if (held === 3) assert.equal(result.effect, 'unknown');
    else { assert.equal(result.effect, 'finished'); assert.equal(result.truncated, true); }
  }
});

test('supervisor API settles spawn failure and cancellation race', async () => {
  const missing = await runShellSupervisor({ supervisor: '/definitely-missing-supervisor', command: 'ignored' });
  assert.equal(missing.effect, 'unknown');
  const controller = new AbortController();
  controller.abort();
  const result = await runShellSupervisor({ supervisor: process.execPath, command: '-e', args: [
    `process.stdin.resume(); process.stdin.on('end',()=>{require('fs').writeSync(3,'{"kind":"cancelled"}\\n');process.exitCode=130})`,
  ], signal: controller.signal });
  assert.deepEqual(result.outcome, { kind: 'cancelled' });
  assert.equal(result.effect, 'unknown');
});

test('supervisor cleanup deadline bounds an unresponsive supervisor', async () => {
  const controller = new AbortController();
  const result = await runShellSupervisor({
    supervisor: process.execPath, command: '-e',
    args: ['process.stdout.write("ready"); setInterval(() => {}, 1000)'],
    signal: controller.signal, stopGraceMs: 200, drainMs: 200,
    onOutput: () => controller.abort(),
  });
  assert.deepEqual(result.outcome, { kind: 'unknown', reason: 'supervisor cleanup deadline exceeded' });
  assert.equal(result.effect, 'unknown');
});
