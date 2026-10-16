// The `$` store's read and carry layer (W45-51). The copied bodies are
// src/plugin-chain-store-carry-source.ts — the read, the carry and the candidate list from the store's
// own module and the id table's, plus the parse helper and the two tests they lean on — and the seam is
// src/plugin-chain-store-carry.ts. These tests call the seam the way the store does: `readStoreFile(id,
// S(id))` answers the file's text, and when the file is not there it answers the text of the plugin's
// built-in twin. Every assertion below was measured from the ported source before it was written.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import { bindStoreCarryPlatformIdTable } from '../src/plugin-chain-store-carry-boundaries.js';
import {
  bindStoreCarryPlatformIdTable as bindTable,
  builtinTwinIds,
  carryStoreFile,
  readStoreCandidate,
  readStoreFile,
} from '../src/plugin-chain-store-carry.js';
import { chainRecords, clearChainRecords } from '../src/plugin-chain-host.js';
import { bindPluginDataDir, storeFilePath } from '../src/plugin-chain-store-path.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-reverse-store-carry-'));
bindPluginDataDir(() => root);
const store = path.join(root, 'store');
fs.mkdirSync(store, { recursive: true });

const logsFor = (id: string): string[] =>
  chainRecords()
    .filter((record) => record.kind === 'log' && (record as { message?: string }).message?.includes(`(${id})`))
    .map((record) => `${(record as { level?: string }).level}: ${(record as { message?: string }).message}`);
const carryFiles = (): string[] => fs.readdirSync(store).filter((name) => name.includes('.carry-'));

after(() => fs.rmSync(root, { recursive: true, force: true }));

test('the candidates are the built-in twins of the id, and only for a builtin id', () => {
  assert.deepEqual(builtinTwinIds('cc-plugin-tips@builtin'), ['tips@builtin']);
  assert.deepEqual(builtinTwinIds('cc-plugin-sec-default@builtin'), ['sec-default@builtin'], 'every entry of the table maps the same way');
  assert.deepEqual(builtinTwinIds('tips@builtin'), [], 'the twin itself has no twin of its own');
  assert.deepEqual(builtinTwinIds('nope@builtin'), []);
  assert.deepEqual(builtinTwinIds('cc-plugin-tips'), [], 'an id with no platform half has no candidates');

  // The platform half is canonicalized through the application's plugin table (`wD`, bounded in
  // src/plugin-chain-store-carry-boundaries.ts). Unbound, the hook answers its negative branch and the
  // half is used as written, so an uppercase half is not the builtin tag.
  assert.deepEqual(builtinTwinIds('cc-plugin-tips@BUILTIN'), []);
  bindTable((id) => id === 'builtin');
  try {
    assert.deepEqual(builtinTwinIds('cc-plugin-tips@BUILTIN'), ['tips@builtin'], 'bound, the uppercase half canonicalizes');
  } finally {
    bindTable(undefined);
  }
  assert.deepEqual(builtinTwinIds('cc-plugin-tips@BUILTIN'), [], 'binding nothing restores the negative branch');
});

test('a missing store is carried from the twin, and the carry file is removed', async () => {
  const twin = storeFilePath('tips@builtin');
  const target = storeFilePath('cc-plugin-tips@builtin');
  fs.writeFileSync(twin, '{"carried":true}', 'utf8');

  assert.equal(await readStoreFile('cc-plugin-tips@builtin', target), '{"carried":true}');
  assert.equal(fs.readFileSync(target, 'utf8'), '{"carried":true}', 'the store is really on disk afterwards');
  assert.deepEqual(carryFiles(), [], 'the staged carry file does not survive');
  assert.deepEqual(logsFor('cc-plugin-tips@builtin'), [], 'a quiet carry logs nothing');

  fs.writeFileSync(target, '{"carried":"mine"}', 'utf8');
  assert.equal(await readStoreFile('cc-plugin-tips@builtin', target), '{"carried":"mine"}', 'a store that is there is read, not carried');
});

test('the candidate read answers the twin id with its text, and nothing when there is no store', async () => {
  const twin = storeFilePath('mermaid@builtin');
  fs.writeFileSync(twin, '{"a":1}', 'utf8');
  assert.deepEqual(await readStoreCandidate('mermaid@builtin'), ['mermaid@builtin', '{"a":1}']);
  fs.rmSync(twin);
  assert.equal(await readStoreCandidate('mermaid@builtin'), undefined);
});

test('a carry with no candidate, or with content that is not a plain object, leaves nothing', async () => {
  const target = storeFilePath('cc-plugin-claude-test@builtin');
  assert.equal(await carryStoreFile('cc-plugin-claude-test@builtin'), false, 'no candidate has a store');
  assert.equal(fs.existsSync(target), false);
  assert.equal(await readStoreFile('cc-plugin-claude-test@builtin', target), undefined);

  const twin = storeFilePath('claude-test@builtin');
  for (const content of ['[1,2]', 'null', '"text"']) {
    fs.writeFileSync(twin, content, 'utf8');
    clearChainRecords();
    assert.equal(await carryStoreFile('cc-plugin-claude-test@builtin'), false, `${content} is not a plain object`);
    assert.equal(fs.existsSync(target), false, `${content} is never written`);
    assert.deepEqual(logsFor('cc-plugin-claude-test@builtin'), [], 'a refused shape is not a failure');
  }
});

test('a store another session already carried is reported at debug and answers true', async () => {
  const twin = storeFilePath('agents-md@builtin');
  const target = storeFilePath('cc-plugin-agents-md@builtin');
  fs.writeFileSync(twin, '{"carried":1}', 'utf8');
  assert.equal(await carryStoreFile('cc-plugin-agents-md@builtin'), true);

  clearChainRecords();
  assert.equal(await carryStoreFile('cc-plugin-agents-md@builtin'), true, 'the link is refused because the target exists');
  assert.deepEqual(logsFor('cc-plugin-agents-md@builtin'), [
    "debug: $.store (cc-plugin-agents-md@builtin): agents-md@builtin's store was carried by another session",
  ]);
  assert.equal(fs.readFileSync(target, 'utf8'), '{"carried":1}', 'what the other session carried is left alone');
  assert.deepEqual(carryFiles(), [], 'the refused carry still removes its staged file');
});

test('unparseable content is a failed carry, reported at warn, and publishes nothing', async () => {
  const twin = storeFilePath('diff@builtin');
  const target = storeFilePath('cc-plugin-diff@builtin');
  fs.writeFileSync(twin, '{not json', 'utf8');
  clearChainRecords();
  assert.equal(await carryStoreFile('cc-plugin-diff@builtin'), false);
  assert.equal(fs.existsSync(target), false);
  const lines = logsFor('cc-plugin-diff@builtin');
  assert.equal(lines.length, 1);
  assert.equal(lines[0].startsWith("warn: $.store (cc-plugin-diff@builtin): could not carry diff@builtin's store: "), true, lines[0]);
});

test('a store the filesystem refuses to write is a failed carry, reported at warn', async () => {
  const twin = storeFilePath('telemetry@builtin');
  const target = storeFilePath('cc-plugin-telemetry@builtin');
  fs.writeFileSync(twin, '{"carried":true}', 'utf8');
  clearChainRecords();
  fs.chmodSync(store, 0o500);
  try {
    assert.equal(await readStoreFile('cc-plugin-telemetry@builtin', target), undefined);
  } finally {
    fs.chmodSync(store, 0o700);
  }
  assert.equal(fs.existsSync(target), false);
  const lines = logsFor('cc-plugin-telemetry@builtin');
  assert.equal(lines.length, 1);
  assert.equal(lines[0].startsWith("warn: $.store (cc-plugin-telemetry@builtin): could not carry telemetry@builtin's store: EACCES"), true, lines[0]);
  assert.deepEqual(carryFiles(), []);

  assert.equal(await readStoreFile('cc-plugin-telemetry@builtin', target), '{"carried":true}', 'once it can write, the carry goes through');
});

test('the carry takes whatever the twin holds at that moment', async () => {
  const twin = storeFilePath('plugin-authoring@builtin');
  const target = storeFilePath('cc-plugin-plugin-authoring@builtin');
  fs.writeFileSync(twin, '{"v":1}', 'utf8');
  assert.equal(await readStoreFile('cc-plugin-plugin-authoring@builtin', target), '{"v":1}');
  fs.rmSync(target);
  fs.writeFileSync(twin, '{"v":2}', 'utf8');
  assert.equal(await readStoreFile('cc-plugin-plugin-authoring@builtin', target), '{"v":2}');
});

test('the seam and the boundary module share one platform table', () => {
  assert.equal(bindStoreCarryPlatformIdTable, bindTable);
});
