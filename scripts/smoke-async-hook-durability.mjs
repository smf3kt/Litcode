// Own fixtures only. Never execute a recovered entrypoint or contact a model.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Session } from '../dist/session.js';
import { defaultConfig } from '../dist/agent.js';
import { AsyncHookRegistry } from '../dist/async-hooks.js';

const [mode, root, phase, fault, id] = process.argv.slice(2);
const same = (a, b) => a.dev === b.dev && a.ino === b.ino;
const transition = row => row.transition.phase + ('state' in row.transition && row.transition.phase !== 'completed' ? ':' + row.transition.state : '');
if (mode === 'writer') {
  const owner = Session.open(root, { config: { ...defaultConfig(root, []), model: 'fixture' } });
  const journal = fs.statSync(owner.file), directory = fs.statSync(path.dirname(owner.file));
  const write = fs.writeSync, sync = fs.fsyncSync;
  let armed = false, fired = false, rejected = false;
  fs.writeSync = function(fd, buffer, ...args) {
    if (!fired && same(fs.fstatSync(fd), journal) && Buffer.isBuffer(buffer)) {
      const text = buffer.toString();
      if (text.startsWith('{')) {
        const row = JSON.parse(text);
        if (row.kind === 'async_hook_lifecycle' && transition(row) === phase) {
          armed = true;
          if (fault === 'short') {
            write.call(fs, fd, buffer, 0, Math.floor(buffer.length / 2)); fired = true;
            throw Error('injected lifecycle short write');
          }
        }
      }
    }
    return write.call(fs, fd, buffer, ...args);
  };
  fs.fsyncSync = function(fd) {
    if (armed && !fired && (fault === 'journal' && same(fs.fstatSync(fd), journal) || fault === 'directory' && same(fs.fstatSync(fd), directory))) {
      fired = true; throw Error('injected lifecycle fsync failure');
    }
    return sync.call(fs, fd);
  };
  const registry = new AsyncHookRegistry({ workspace: root, journalOwner: owner, onResult: async (_completion, observe) => {
    await observe({ kind: 'completion' }, () => { fs.writeFileSync(path.join(root, 'observer-effect'), 'x'); });
  } });
  try {
    const payload = { cwd: root, session_id: owner.id };
    try {
      const job = await registry.start({ definition: { command: 'printf x >> command-effect', async: true }, event: 'SessionStart', payload,
        input: JSON.stringify({ ...payload, hook_event_name: 'SessionStart' }) + '\n', cwd: root, timeoutMs: 5000, signal: new AbortController().signal });
      await registry.wait(job); await registry.close();
    } catch { rejected = true; }
    console.log(JSON.stringify({ id: owner.id, fired, rejected, fenced: owner.isJournalFenced,
      command: fs.existsSync(path.join(root, 'command-effect')), observer: fs.existsSync(path.join(root, 'observer-effect')) }));
  } finally {
    fs.writeSync = write; fs.fsyncSync = sync;
    await registry.close().catch(() => {}); await owner.close();
  }
} else if (mode === 'reader') {
  const file = path.join(root, '.agent', `${id}.jsonl`), journal = fs.statSync(file), directory = fs.statSync(path.dirname(file));
  const sync = fs.fsyncSync; let fired = false, journalSyncs = 0, directorySyncs = 0, original;
  fs.fsyncSync = function(fd) {
    const stat = fs.fstatSync(fd);
    if (same(stat, journal)) journalSyncs++;
    if (same(stat, directory)) directorySyncs++;
    if (!fired && same(stat, journal) && (fault === 'replace' || fault === 'rewrite')) {
      fired = true; original = fs.readFileSync(file);
      if (fault === 'replace') { fs.renameSync(file, file + '.original'); fs.writeFileSync(file, original); }
      else {
        const text = original.toString(), marker = '"generation":"', index = text.indexOf(marker) + marker.length;
        assert.ok(index >= marker.length); const next = text[index] === 'a' ? 'b' : 'a';
        fs.writeFileSync(file, text.slice(0, index) + next + text.slice(index + 1));
      }
    }
    if (!fired && (fault === 'journal' && same(stat, journal) || fault === 'directory' && same(stat, directory))) {
      fired = true; throw Error('injected recovery fsync failure');
    }
    return sync.call(fs, fd);
  };
  let session;
  try {
    session = Session.open(root, { id });
    console.log(JSON.stringify({ opened: true, fired, journalSyncs, directorySyncs,
      phases: session.events.filter(row => row.kind === 'async_hook_lifecycle').map(transition) }));
  } catch (error) { console.log(JSON.stringify({ opened: false, fired, journalSyncs, directorySyncs, error: error.message })); }
  finally {
    fs.fsyncSync = sync; await session?.close();
    if (original) {
      if (fault === 'replace') { fs.unlinkSync(file); fs.renameSync(file + '.original', file); }
      else fs.writeFileSync(file, original);
    }
  }
} else {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'hook-durability-')));
  const invoke = (...args) => {
    const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), ...args], { encoding: 'utf8', timeout: 15000 });
    assert.equal(child.status, 0, child.stderr); return JSON.parse(child.stdout);
  };
  const phases = ['admitted', 'completed', 'callback:pending', 'observer:pending', 'observer:returned', 'callback:returned'];
  const results = [];
  try {
    for (const stage of phases) for (const failure of ['journal', 'short', 'directory']) {
      const workspace = path.join(base, `${stage.replaceAll(':', '-')}-${failure}`); fs.mkdirSync(workspace);
      const written = invoke('writer', workspace, stage, failure);
      const journalFailure = invoke('reader', workspace, '', 'journal', written.id);
      const directoryFailure = invoke('reader', workspace, '', 'directory', written.id);
      const recovered = invoke('reader', workspace, '', 'none', written.id);
      const again = invoke('reader', workspace, '', 'none', written.id);
      results.push({ stage, failure, written, journalFailure, directoryFailure, recovered });
      if (mode !== '--observe') {
        assert.equal(written.fired, true, JSON.stringify(results.at(-1))); assert.equal(written.rejected, true);
        assert.equal(written.fenced, true);
        assert.equal(written.command, stage !== 'admitted');
        assert.equal(written.observer, ['observer:returned', 'callback:returned'].includes(stage));
        // A torn first admission has no lifecycle row to admit. All other surviving rows require resync.
        const hasRows = recovered.phases.length > 0;
        if (hasRows) { assert.equal(journalFailure.opened, false); assert.equal(directoryFailure.opened, false); }
        assert.equal(recovered.opened, true); assert.deepEqual(again.phases, recovered.phases);
        assert.deepEqual(recovered.phases, phases.slice(0, phases.indexOf(stage) + (failure === 'short' ? 0 : 1)));
        const command = path.join(workspace, 'command-effect');
        if (written.command) assert.equal(fs.readFileSync(command, 'utf8'), 'x');
        if (failure === 'short') assert.ok(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.includes('.torn-')));
        if (hasRows && stage === 'observer:returned' && failure === 'journal') {
          for (const mutation of ['replace', 'rewrite']) {
            const changed = invoke('reader', workspace, '', mutation, written.id);
            assert.equal(changed.fired, true); assert.equal(changed.opened, false);
            assert.match(changed.error, /journal changed during sync/);
          }
          assert.deepEqual(invoke('reader', workspace, '', 'none', written.id).phases, recovered.phases);
        }
      }
    }
    console.log(JSON.stringify({ cases: results.length, results }));
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
}
