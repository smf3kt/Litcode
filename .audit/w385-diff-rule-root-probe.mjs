// W385 diff-callback rule-root probe: which explicit root makes the child alias
// match the unanchored Read deny when the relocated policy ruleWorkspace is the parent?
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { emptySessionPermissionUpdates, permissionDecision } from '../src/permissions.js';

const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w385-diff-root-')));
const parent = path.join(root, 'parent'), child = path.join(root, 'child');
fs.mkdirSync(parent); fs.mkdirSync(path.join(child, 'protected'), { recursive: true });
fs.writeFileSync(path.join(child, 'protected', 'data.txt'), 'PROTECTED_FIXTURE');
fs.symlinkSync('protected/data.txt', path.join(child, 'alias.txt'));
const readTool = { schema: { name: 'read_file' }, readOnly: true };
const rule = 'Read(protected/data.txt)';
const base = { mode: 'default', allow: [], deny: [rule], ruleWorkspace: parent };
const state = emptySessionPermissionUpdates();
const input = { path: 'alias.txt' };
const calls = {
  base: () => permissionDecision(base, readTool, input, state, child),
  policyChild: () => permissionDecision({ ...base, ruleWorkspace: child }, readTool, input, state, child),
  stateChild: () => permissionDecision(base, readTool, input, { ...state, ruleWorkspace: child }, child),
  bothChild: () => permissionDecision({ ...base, ruleWorkspace: child }, readTool, input, { ...state, ruleWorkspace: child }, child),
  baseNoWorkspace: () => permissionDecision(base, readTool, input, state),
};
try {
  const result = Object.fromEntries(Object.entries(calls).map(([name, run]) => [name, run().decision]));
  process.stdout.write(JSON.stringify(result) + '\n');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
