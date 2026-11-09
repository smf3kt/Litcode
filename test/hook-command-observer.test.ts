import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { Agent, defaultConfig } from '../src/agent.js';
import { Session, readSessionJournal } from '../src/session.js';
import { forkSession } from '../src/sessions.js';
import { AsyncHookRegistry } from '../src/async-hooks.js';
import type { HookDefinition, HookRunOptions } from '../src/hooks.js';
import type { ModelProvider } from '../src/provider.js';

const provider: ModelProvider = { count: async () => 1, complete: async () => { throw Error('unexpected model'); } };
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function fixture(definition: HookDefinition = { command: 'printf fixture' }) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'command-observer-')));
  const session = Session.open(root, { config: { ...defaultConfig(root, []), model: 'fixture', hooks: { Notification: [definition] } } });
  return { root, session };
}
test('actual foreground, rejected adoption and configured forwarding bind original command resolver and cold readers', async () => {
  for (const mode of ['foreground', 'rejected', 'configured', 'absent']) {
    const f = fixture({ command: mode === 'rejected' ? `printf '{"async":true}\\n'; sleep 0.02; printf fixture` : 'printf fixture',
      ...(mode === 'configured' ? { async: true } : {}) });
    let session = f.session, calls = 0;
    const registry = new AsyncHookRegistry({ workspace: f.root, journalOwner: session });
    try {
      const options: HookRunOptions = { startAsyncCommand: mode === 'rejected' ? async () => { throw Error('rejected adoption'); } : registry.start };
      if (mode !== 'absent') options.onCommandResult = function (raw) {
        assert.equal(this.observeResolver instanceof Function, true); assert.equal(raw.stdout.endsWith('fixture'), true); calls++;
      };
      const agent = new Agent(session, provider, [], { hookOptions: options });
      await agent.emitHook('Notification', {});
      if (mode === 'configured') await registry.wait(registry.list()[0]!.id);
      assert.equal(calls, mode === 'configured' || mode === 'absent' ? 0 : 1);
      const observed = session.hookCommandObservations;
      assert.equal(observed.length, 1);
      assert.deepEqual(observed[0]!.transition, { phase: 'returned', mode: mode === 'absent' ? 'absent' : 'sync' });
      assert.equal(observed[0]!.resolverInvocationId, session.hookResolverObservations[0]!.event.invocationId);
      assert.throws(() => session.append(structuredClone(observed[0]!)), /Command observer write authorization/);
      const id = session.id; session.close(); session = Session.open(f.root, { id });
      assert.deepEqual(session.hookCommandObservations, observed);
      assert.deepEqual(readSessionJournal(f.root, id, { maxBytes: 1000000, maxEvents: 1000 }), session.events);
      const fork = forkSession(session); try { assert.deepEqual(fork.hookCommandObservations, []); } finally { fork.close(); }
    } finally { await registry.close(); session.close(); fs.rmSync(f.root, { recursive: true, force: true }); }
  }
});
test('callback throw and actual nonawaited Promise settlement retain original live owner only', async () => {
  for (const mode of ['throw', 'fulfilled', 'rejected', 'closed', 'thenable']) {
    const f = fixture(); let session = f.session;
    let release = () => {}, reject = (_error: Error) => {};
    const gate = new Promise<void>((resolve, failure) => { release = resolve; reject = failure; });
    const options: HookRunOptions = { onCommandResult: () => {
      if (mode === 'throw') throw Error('callback failure');
      if (mode === 'thenable') return { get then() { throw Error('must not assimilate'); } };
      return gate;
    } };
    try {
      const agent = new Agent(session, provider, [], { hookOptions: options });
      if (mode === 'throw') await assert.rejects(agent.emitHook('Notification', {}), /callback failure/);
      else await agent.emitHook('Notification', {});
      assert.deepEqual(session.hookCommandObservations[0]!.transition, mode === 'throw' ? { phase: 'threw' }
        : { phase: 'returned', mode: mode === 'thenable' ? 'sync' : 'promise' });
      if (mode === 'closed') { const id = session.id; session.close(); session = Session.open(f.root, { id }); }
      if (mode === 'rejected') reject(Error('late rejection')); else release();
      await tick();
      if (mode === 'fulfilled' || mode === 'rejected') assert.deepEqual(session.hookCommandObservations[0]!.transition,
        { phase: 'settled', outcome: mode });
      if (mode === 'closed') assert.deepEqual(session.hookCommandObservations[0]!.transition, { phase: 'returned', mode: 'promise' });
      assert.deepEqual(readSessionJournal(f.root, session.id, { maxBytes: 1000000, maxEvents: 1000 }), session.events);
    } finally { release(); session.close(); fs.rmSync(f.root, { recursive: true, force: true }); }
  }
});
test('journal faults prevent callback entry or retain unknown settlement; cold readers reject forged resolver', async () => {
  for (const phase of ['admitted', 'returned', 'settled']) {
    const f = fixture(); let session = f.session, calls = 0;
    const write = fs.writeSync;
    try {
      fs.writeSync = new Proxy(write, { apply(target, receiver, args) {
        if (Buffer.isBuffer(args[1]) && args[1].includes('"kind":"hook_command_observer"') && args[1].includes(`"phase":"${phase}"`))
          throw Error('command observer journal fault');
        return Reflect.apply(target, receiver, args);
      } });
      const agent = new Agent(session, provider, [], { hookOptions: { onCommandResult: () => { calls++; return Promise.resolve(); } } });
      await agent.emitHook('Notification', {}).catch(error => assert.match(String(error), /fault|fenced|journal write failed/));
      await tick();
    } finally { fs.writeSync = write; }
    try {
      assert.equal(calls, phase === 'admitted' ? 0 : 1);
      assert.equal(session.isJournalFenced, true);
      const id = session.id; session.close(); session = Session.open(f.root, { id });
      assert.deepEqual(session.hookCommandObservations[0]?.transition, phase === 'admitted' ? undefined :
        phase === 'returned' ? { phase: 'admitted' } : { phase: 'returned', mode: 'promise' });
      if (phase === 'settled') {
        const file = session.file; session.close();
        const rows = fs.readFileSync(file, 'utf8').trim().split('\n').map(line => JSON.parse(line));
        rows.find(row => row.kind === 'hook_command_observer').resolverInvocationId = randomUUID();
        fs.writeFileSync(file, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
        assert.throws(() => Session.open(f.root, { id }), /Invalid command observer history/);
        assert.throws(() => readSessionJournal(f.root, id, { maxBytes: 1000000, maxEvents: 1000 }), /Invalid command observer history/);
      }
    } finally { session.close(); fs.rmSync(f.root, { recursive: true, force: true }); }
  }
});
