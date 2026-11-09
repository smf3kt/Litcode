import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { defaultConfig } from '../dist/agent.js';
import { Session } from '../dist/session.js';
import { createChildHookLifecycle } from '../dist/subagents.js';
import { runHooks } from '../dist/hooks.js';
const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'child-hook-observer-')));
const observations = [];
try {
  for (const mode of ['returned', 'threw', 'pending']) {
    const workspace = path.join(root, mode); fs.mkdirSync(workspace);
    const config = { ...defaultConfig(workspace, []), model: 'fixture', childMode: 'general' };
    const session = Session.open(workspace, { config });
    let entered = false, finished = false, release;
    const gate = new Promise(resolve => { release = resolve; });
    let pending;
    const lifecycle = createChildHookLifecycle(session, { onHookCompletion: () => {
      entered = true;
      if (mode === 'threw') throw Error('owned observer failure');
      if (mode === 'pending') {
        pending = gate.then(() => { fs.writeFileSync(path.join(workspace, 'observer-effect'), 'late'); finished = true; });
        return pending;
      }
      finished = true;
    } });
    try {
      const result = await runHooks({ SessionStart: [{ command: "printf x > command-effect; printf '{}'", async: true }] },
        'SessionStart', { cwd: workspace, session_id: session.id }, new AbortController().signal, lifecycle.hookOptions);
      assert.equal(result.backgroundTasks.length, 1);
      await lifecycle.close();
      assert.equal(entered, true); assert.equal(fs.readFileSync(path.join(workspace, 'command-effect'), 'utf8'), 'x');
      const atClose = { entered, finished, effect: fs.existsSync(path.join(workspace, 'observer-effect')) };
      session.close();
      if (mode === 'pending') { release(); await pending; }
      const reopened = Session.open(workspace, { id: session.id });
      try {
        observations.push({ mode, closeReturned: true, atClose, afterCloseEffect: fs.existsSync(path.join(workspace, 'observer-effect')),
          journal: reopened.events.filter(row => row.kind === 'async_hook_lifecycle' && row.transition.phase === 'observer').map(row => ({ state: row.transition.state, owner: row.owner === session.id, observer: row.transition.observer.kind })) });
      } finally { reopened.close(); }
      const reader = spawnSync(process.execPath, ['--input-type=module', '-e', `
        import { Session } from './dist/session.js';
        const session = Session.open(process.argv[1], { id: process.argv[2] });
        try { console.log(JSON.stringify(session.events.filter(row => row.kind === 'async_hook_lifecycle' && row.transition.phase === 'observer').map(row => row.transition.state))); }
        finally { await session.close(); }
      `, workspace, session.id], { encoding: 'utf8', timeout: 10000 });
      assert.equal(reader.status, 0, reader.stderr);
      assert.deepEqual(JSON.parse(reader.stdout), observations.at(-1).journal.map(row => row.state));
    } finally { release(); await pending; await lifecycle.close(); session.close(); }
  }
  assert.deepEqual(observations.map(row => row.journal.map(event => event.state)), [['pending', 'returned'], ['pending', 'threw'], ['pending']]);
  assert.equal(observations.every(row => row.journal.every(event => event.owner && event.observer === 'completion')), true);
  assert.equal(observations[2].atClose.effect, false); assert.equal(observations[2].afterCloseEffect, true);
  console.log(JSON.stringify({ probe: 'actual child observer settlement is distinguished; post-close outcomes remain pending', observations }));
} finally { fs.rmSync(root, { recursive: true, force: true }); }
