import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import {
  MEMORY_EDITOR_HINT, memoryDisplayPath, memoryOpenFailedMessage, memoryOpenedMessage,
  memoryPanelReport, memoryPanelRows, openMemoryFile,
} from '../src/memory-panel.js';

function fixture(t: { after: (fn: () => void) => void }): { home: string; workspace: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-panel-'));
  const home = path.join(root, 'home');
  const workspace = path.join(root, 'project');
  fs.mkdirSync(home); fs.mkdirSync(workspace);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { home, workspace };
}

test('loaded instruction rows carry the recovered labels and descriptions', t => {
  const { home, workspace } = fixture(t);
  fs.mkdirSync(path.join(workspace, '.git'));
  const project = path.join(workspace, 'HARNESS.md');
  const imported = path.join(workspace, 'rules', 'extra.md');
  fs.mkdirSync(path.dirname(imported));
  const rows = memoryPanelRows({
    home, workspace, userDir: path.join(home, '.harness'), checkedIn: true,
    instructions: [
      { path: project, content: '' },
      { path: imported, content: '', parent: project },
    ],
  });
  assert.deepEqual(rows.slice(0, 2), [
    { path: project, label: 'Project instructions', description: 'Checked in at ./HARNESS.md', exists: true },
    { path: imported, label: `  L ${memoryDisplayPath(imported, workspace, home)}`, description: '@-imported', exists: true },
  ]);
  // The absent user file is listed last so picking it can create one.
  assert.deepEqual(rows.at(-1), {
    path: path.join(home, 'HARNESS.md'), label: 'User instructions',
    description: 'Saved in ~/HARNESS.md', exists: false,
  });
});

test('an absent project file is a placeholder and a loaded user file is user instructions', t => {
  const { home, workspace } = fixture(t);
  const user = path.join(home, 'AGENTS.md');
  const rows = memoryPanelRows({
    home, workspace, userDir: path.join(home, '.harness'), checkedIn: false,
    instructions: [{ path: user, content: '' }],
  });
  assert.deepEqual(rows[0], { path: user, label: 'User instructions', description: 'Saved in ~/AGENTS.md', exists: true });
  // The placeholder is the canonical `HARNESS.md` existence check, not any user-type file.
  assert.deepEqual(rows[1], {
    path: path.join(home, 'HARNESS.md'), label: 'User instructions',
    description: 'Saved in ~/HARNESS.md', exists: false,
  });
  assert.deepEqual(rows[2], {
    path: path.join(workspace, 'HARNESS.md'), label: 'Project instructions',
    description: 'Saved in ./HARNESS.md', exists: false,
  });
  assert.equal(rows.length, 3);
});

test('the displayed path prefers the shorter home or workspace spelling', () => {
  const workspace = '/Users/example/projects/app';
  const home = '/Users/example';
  assert.equal(memoryDisplayPath(`${home}/HARNESS.md`, workspace, home), '~/HARNESS.md');
  assert.equal(memoryDisplayPath(`${workspace}/rules/a.md`, workspace, home), './rules/a.md');
  assert.equal(memoryDisplayPath('/opt/notes.md', workspace, home), '/opt/notes.md');
});

test('opening a missing file creates it and hands it to the editor', async t => {
  const { home, workspace } = fixture(t);
  const file = path.join(home, '.harness', 'memory', 'note.md');
  const seen: string[] = [];
  const result = await openMemoryFile(file, new AbortController().signal, workspace,
    async target => { seen.push(target); return { content: null }; }, () => true);
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(seen, [file]);
  assert.equal(fs.readFileSync(file, 'utf8'), '');
});

test('a missing editor and an editor failure both report the recovered failure line', async t => {
  const { home, workspace } = fixture(t);
  const file = path.join(workspace, 'HARNESS.md');
  const noEditor = await openMemoryFile(file, new AbortController().signal, workspace,
    async () => { throw new Error('must not open'); }, () => false);
  assert.deepEqual(noEditor, { ok: false });
  assert.equal(memoryOpenFailedMessage(file, workspace, home),
    "Couldn't open ./HARNESS.md in an editor. If no editor is configured, set $EDITOR or $VISUAL, then run /memory again.");
  const failed = await openMemoryFile(file, new AbortController().signal, workspace,
    async () => ({ content: null, error: 'editor quit' }), () => true);
  assert.equal(failed.ok, false);
});

test('the opened report names the editor source and the change hint', t => {
  const { home, workspace } = fixture(t);
  const file = path.join(workspace, 'HARNESS.md');
  assert.equal(memoryOpenedMessage(file, workspace, { VISUAL: 'code -w', EDITOR: 'vi' }, home),
    'Opened ./HARNESS.md\n\n> Using $VISUAL="code -w". To change editor, set $EDITOR or $VISUAL environment variable.');
  assert.equal(memoryOpenedMessage(file, workspace, { EDITOR: 'vi' }, home),
    'Opened ./HARNESS.md\n\n> Using $EDITOR="vi". To change editor, set $EDITOR or $VISUAL environment variable.');
  assert.equal(memoryOpenedMessage(file, workspace, {}, home), `Opened ./HARNESS.md\n\n${MEMORY_EDITOR_HINT}`);
});

test('the piped report lists the same rows', t => {
  const { home, workspace } = fixture(t);
  const report = memoryPanelReport(memoryPanelRows({
    home, workspace, userDir: path.join(home, '.harness'), checkedIn: false, instructions: [],
  }));
  assert.equal(report, 'Memory\n  User instructions  Saved in ~/HARNESS.md\n'
    + '  Project instructions  Saved in ./HARNESS.md');
});
