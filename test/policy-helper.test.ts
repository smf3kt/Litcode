import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { PolicyHelper, policyHelperInstructionText, policyHelperPolicy, readPolicyHelper } from '../src/policy-helper.js';
import { managedHelperSchema } from '../src/session.js';

function workspace(t: { after(fn: () => void): void }): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-policy-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('a readable helper document is served as the helper tier', async t => {
  const root = workspace(t);
  const file = path.join(root, 'policy.json');
  fs.writeFileSync(file, JSON.stringify({ permissions: { mode: 'plan', allow: [], deny: [] } }));
  const machine = new PolicyHelper({ path: file });
  const output = machine.refresh();
  assert.equal(output.serving, 'helper');
  assert.deepEqual(output.policy, { permissions: { mode: 'plan', allow: [], deny: [] } });
  assert.deepEqual(output.warnings, []);
  assert.deepEqual(machine.state, { serving: 'helper', policy: output.policy, failure: null });
});

test('a failed read falls back to the static default, then to the last successful output, then recovers', async t => {
  const root = workspace(t);
  const file = path.join(root, 'policy.json');
  const fallback = { permissions: { mode: 'plan', allow: [], deny: ['write_file'] } };
  const machine = new PolicyHelper({ path: file, defaultPolicy: fallback });
  // No document at all, but a default exists: the default governs and says so once.
  const first = machine.refresh();
  assert.equal(first.serving, 'default');
  assert.deepEqual(first.policy, fallback);
  assert.match(first.warnings[0] ?? '', /applying the static default settings payload/);
  assert.equal(machine.state.failure, 'helper_failed');
  // A repeated failure of the same kind does not repeat the warning.
  assert.deepEqual(machine.refresh().warnings, []);
  // The helper returns, and the recovery is announced once.
  fs.writeFileSync(file, JSON.stringify({ permissions: { mode: 'bypass', allow: [], deny: [] } }));
  const recovered = machine.refresh();
  assert.equal(recovered.serving, 'helper');
  assert.match(recovered.warnings[0] ?? '', /recovered; its output replaces the static default/);
  assert.equal(machine.state.failure, null);
  // A later failure with no default to fall back to keeps the successful output.
  fs.rmSync(file);
  const withoutDefault = new PolicyHelper({ path: file });
  assert.equal(withoutDefault.refresh().serving, 'default');
  assert.equal(withoutDefault.state.policy, undefined);
});

test('a structurally invalid document is refused rather than replaced', async t => {
  const root = workspace(t);
  const file = path.join(root, 'policy.json');
  fs.writeFileSync(file, JSON.stringify({ permissions: { mode: 'plan', allow: [], deny: [] } }));
  const fallback = { permissions: { mode: 'bypass', allow: [], deny: [] } };
  const machine = new PolicyHelper({ path: file, defaultPolicy: fallback,
    validate: policy => 'permissions' in (policy as object) && (policy as { permissions?: { mode?: string } }).permissions?.mode === 'plan' ? undefined : 'unusable policy' });
  assert.equal(machine.refresh().serving, 'helper');
  // A document the validator rejects is policy_invalid: the serving tier and the
  // policy it was serving are both left alone, and the static default is not used.
  fs.writeFileSync(file, JSON.stringify({ permissions: { mode: 'bypass', allow: [], deny: [] } }));
  const invalid = machine.refresh();
  assert.equal(invalid.serving, 'helper');
  assert.deepEqual(invalid.policy, { permissions: { mode: 'plan', allow: [], deny: [] } });
  assert.equal(machine.state.failure, 'policy_invalid');
  assert.match(invalid.warnings[0] ?? '', /document is invalid .*not applied/);
  // Malformed JSON is a read failure, not a structural one, so it does fall back.
  fs.writeFileSync(file, '{not json');
  const broken = machine.refresh();
  assert.equal(broken.serving, 'default');
  assert.deepEqual(broken.policy, fallback);
  assert.equal(machine.state.failure, 'helper_failed');
});

test('classification keeps unreadable documents and unusable ones apart', async t => {
  const root = workspace(t);
  const missing = path.join(root, 'absent.json');
  assert.deepEqual(readPolicyHelper(missing), { ok: false, failure: 'helper_failed', reason: `policy helper is unreadable: ENOENT: no such file or directory, open '${missing}'` });
  const text = path.join(root, 'list.json');
  fs.writeFileSync(text, '[1,2,3]');
  const malformed = readPolicyHelper(text);
  assert.equal(malformed.ok, false);
  assert.equal(malformed.ok === false && malformed.failure, 'policy_invalid');
  const good = path.join(root, 'ok.json');
  fs.writeFileSync(good, '{"allowShell":true}');
  assert.deepEqual(readPolicyHelper(good), { ok: true, policy: { allowShell: true } });
});

test("the instruction tier is the helper document's non-empty claudeMd", () => {
  assert.equal(policyHelperInstructionText({ claudeMd: 'HELPER_TEXT' }), 'HELPER_TEXT');
  // `qZn` pushes the block only when the value is truthy, so an empty string,
  // a non-string and a non-object are all absence (chunk-sfn1dbxq.js 669530).
  assert.equal(policyHelperInstructionText({ claudeMd: '' }), undefined);
  assert.equal(policyHelperInstructionText({ claudeMd: 5 }), undefined);
  assert.equal(policyHelperInstructionText({ allowShell: false }), undefined);
  assert.equal(policyHelperInstructionText(null), undefined);
  assert.equal(policyHelperInstructionText([{ claudeMd: 'HELPER_TEXT' }]), undefined);
  // The instruction key is not policy: the managed-policy path never sees it.
  assert.deepEqual(policyHelperPolicy({ claudeMd: 'HELPER_TEXT', allowShell: false }), { allowShell: false });
  assert.deepEqual(policyHelperPolicy({ claudeMd: 'HELPER_TEXT' }), {});
  assert.equal(policyHelperPolicy('not a document'), undefined);
});

test('the helper schema accepts claudeMd and still refuses unknown keys', () => {
  assert.deepEqual(managedHelperSchema.parse({ claudeMd: 'HELPER_TEXT', allowShell: false }),
    { claudeMd: 'HELPER_TEXT', allowShell: false });
  assert.equal(managedHelperSchema.safeParse({ claudeMd: 5 }).success, false);
  assert.equal(managedHelperSchema.safeParse({ claudeMd: 'HELPER_TEXT', unknownKey: true }).success, false);
});
