import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { SkillEffectJournal } from '../src/skill-effects.js';

const workspaces: string[] = [];
function workspace(): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ccrev-skill-effects-')));
  workspaces.push(root);
  return root;
}
after(() => { for (const root of workspaces) fs.rmSync(root, { recursive: true, force: true }); });

function lines(journal: SkillEffectJournal): Record<string, unknown>[] {
  return fs.readFileSync(journal.file, 'utf8').trimEnd().split('\n').map(line => JSON.parse(line) as Record<string, unknown>);
}

test('a start and its terminal record close the effect without storing the command', () => {
  const journal = new SkillEffectJournal(workspace(), 'session-1');
  const command = 'printf secret-argument';
  const effect = journal.start('fixture', 0, command);
  journal.finish(effect, 'finished');
  assert.deepEqual(journal.unresolved('fixture'), []);
  const stored = lines(journal);
  assert.deepEqual(stored.map(record => record.phase), ['started', 'finished']);
  assert.equal(stored[0]!.digest, createHash('sha256').update(command, 'utf8').digest('hex'));
  assert.equal(fs.readFileSync(journal.file, 'utf8').includes('secret-argument'), false);
  assert.deepEqual([stored[0]!.skill, stored[0]!.index], ['fixture', 0]);
});

test('a start without a terminal record is unresolved until acknowledged', () => {
  const journal = new SkillEffectJournal(workspace(), 'session-2');
  const first = journal.start('fixture', 1, 'first');
  journal.start('other', 0, 'other');
  assert.deepEqual(journal.unresolved('fixture').map(record => [record.id, record.index]), [[first.id, 1]]);
  assert.equal(journal.unresolved('other').length, 1, 'records are per skill');
  journal.acknowledge(journal.unresolved('fixture'));
  assert.deepEqual(journal.unresolved('fixture'), []);
  assert.equal(lines(journal).at(-1)!.phase, 'unknown');
});

test('a torn trailing append is discarded and a malformed complete line fails closed', () => {
  const root = workspace();
  const journal = new SkillEffectJournal(root, 'session-3');
  const effect = journal.start('fixture', 0, 'printf a');
  // Simulate a crash in the middle of the next append.
  const complete = fs.readFileSync(journal.file);
  fs.appendFileSync(journal.file, '{"v":1,"id":"torn');
  assert.equal(journal.unresolved('fixture')[0]!.id, effect.id);
  // A complete but malformed line is corruption, not a torn append.
  fs.writeFileSync(journal.file, complete); fs.appendFileSync(journal.file, 'not json\n');
  assert.throws(() => journal.unresolved('fixture'), /unreadable: line 2 is not JSON/);
});

test('the owner must be a session id and the journal is bounded', () => {
  const root = workspace();
  assert.throws(() => new SkillEffectJournal(root, '../escape'), /owner must be a session id/);
  assert.throws(() => new SkillEffectJournal(root, ''), /owner must be a session id/);
  const journal = new SkillEffectJournal(root, 'session-4');
  fs.mkdirSync(journal.directory, { recursive: true });
  fs.writeFileSync(journal.file, 'x'.repeat(4 * 1024 * 1024 + 1));
  assert.throws(() => journal.unresolved('fixture'), /exceeds 4194304 bytes/);
  assert.throws(() => journal.start('fixture', 0, 'printf a'), /exceeds 4194304 bytes/);
});
