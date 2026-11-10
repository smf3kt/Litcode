// W385 async hook start isolation probe: run the real runHooks +
// AsyncHookRegistry.start path without the Agent/CLI wrapper.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runHooks } from '../src/hooks.js';
import { AsyncHookRegistry } from '../src/async-hooks.js';

const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w385-async-start-')));
const marker = path.join(root, 'hook-started');
const script = path.join(root, 'hook.mjs');
fs.writeFileSync(script, `import fs from 'node:fs';\nfs.writeFileSync(${JSON.stringify(marker)}, 'started');\n`);
const signal = new AbortController().signal;
const completions = [];
const sessionId = '11111111-1111-4111-8111-111111111111';
const journalOwner = { id: sessionId, isOpen: true, isJournalFenced: false, recordAsyncHookLifecycle() {} };
const registry = new AsyncHookRegistry({ workspace: root, signal, journalOwner, onResult: value => completions.push(value) });
const payload = { session_id: sessionId, cwd: root,
  tool_name: 'write_file', tool_input: { path: 'x' }, tool_use_id: 'call-1' };
try {
  const result = await runHooks({ PostToolUseFailure: [{ command: `${process.execPath} ${script}`, async: true }] },
    'PostToolUseFailure', payload, signal, { startAsyncCommand: request => registry.start(request) });
  const deadline = Date.now() + 5000;
  while (!fs.existsSync(marker) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
  const observed = { marker: fs.existsSync(marker), backgroundTasks: result.backgroundTasks ?? [],
    additionalContext: result.additionalContext, completions: completions.map(value => value.additionalContext ?? null) };
  process.stdout.write(JSON.stringify(observed) + '\n');
  assert.equal(observed.marker, true, JSON.stringify(observed));
} finally {
  await registry.close?.();
  fs.rmSync(root, { recursive: true, force: true });
}
