import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import { decodeKeybindingsJson } from '../src/keybindings.js';
import { NON_REBINDABLE_KEYBINDINGS, keybindingsFilePath, keybindingsReport,
  keybindingsTemplate, writeKeybindingsTemplate } from '../src/keybindings-command.js';

const roots: string[] = [];
function temp(): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ccrev-keybindings-cmd-')));
  roots.push(dir); return dir;
}
after(() => { for (const root of roots) fs.rmSync(root, { recursive: true, force: true }); });

test('the file is the reader\'s own user-level keybindings.json', () => {
  assert.equal(keybindingsFilePath('/tmp/example'), path.join('/tmp/example', 'keybindings.json'));
});

test('the template is the defaults minus the keys a terminal cannot deliver', () => {
  const template = JSON.parse(keybindingsTemplate()) as Record<string, string>;
  // The strongest assertion available: the product's own reader accepts what the command writes.
  const decoded = decodeKeybindingsJson(keybindingsTemplate());
  assert.deepEqual({ ...decoded }, template);
  for (const sequence of Object.keys(NON_REBINDABLE_KEYBINDINGS)) {
    assert.equal(sequence in template, false, `${JSON.stringify(sequence)} must not be offered`);
  }
  assert.equal(template['\u0012'], 'search');
  assert.equal(template['\u0019'], 'yank');
  assert.equal(template['\u0007'], 'externalEditor');
  assert.ok(Object.keys(template).length > 30);
});

test('a missing file is created once and an existing one is left alone', () => {
  const directory = temp();
  const file = keybindingsFilePath(directory);
  assert.equal(writeKeybindingsTemplate(file), true);
  const written = fs.readFileSync(file, 'utf8');
  assert.equal(written, keybindingsTemplate());
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  fs.writeFileSync(file, '{"\\u0012": "yank"}');
  assert.equal(writeKeybindingsTemplate(file), false);
  assert.equal(fs.readFileSync(file, 'utf8'), '{"\\u0012": "yank"}');
});

test('the report distinguishes created from opened and appends a failure', () => {
  const file = '/tmp/example/keybindings.json';
  assert.equal(keybindingsReport(file, true), `Created ${file} with template. Opened in your editor.`);
  assert.equal(keybindingsReport(file, false), `Opened ${file} in your editor.`);
  assert.equal(keybindingsReport(file, true, 'vi quit unexpectedly (exit code 1)'),
    `Created ${file}. vi quit unexpectedly (exit code 1)`);
  assert.equal(keybindingsReport(file, false, 'vi closed unexpectedly (SIGTERM)'),
    `Opened ${file}. vi closed unexpectedly (SIGTERM)`);
});
