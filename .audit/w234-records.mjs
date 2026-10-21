import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { captureIdentity } from '../scripts/identity.mjs';

const root = path.resolve(import.meta.dirname, '..');
const [cliFile, configFile, sourceFile, destination] = process.argv.slice(2);
assert.ok(cliFile && configFile && sourceFile && destination,
  'Usage: node .audit/w234-records.mjs CLI_RESULT CONFIG_RESULT SOURCE_EVIDENCE NEW_JSON');
const identity = captureIdentity(root), hash = value => crypto.createHash('sha256').update(value).digest('hex');
const results = [cliFile, configFile].map(file => {
  const result = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(result.identity, identity.sha256, `Stale source result ${file}`);
  assert.equal(result.build, identity.build.sha256); assert.equal(result.validation, identity.validation.sha256);
  return { name: path.basename(path.dirname(file)), checks: result.checks, captures: result.captures,
    requests: result.requests, counts: result.counts };
});
const source = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
for (const group of source.groups) for (const item of group.target) {
  const text = fs.readFileSync(path.join(root, item.file), 'utf8').slice(...item.range);
  assert.equal(hash(text), item.sha256, `Stale adapted body ${item.file}`);
}
const evidence = { schema: 'W234Validation.v1', identity: identity.sha256,
  inputs: { sha256: identity.inputs.sha256, count: identity.inputs.files.length },
  validation: { sha256: identity.validation.sha256, count: identity.validation.files.length },
  build: { sha256: identity.build.sha256, count: identity.build.files.length },
  drivers: ['.audit/w234-autocompact.mjs', '.audit/w233-config-panel.mjs', '.audit/w234-source-compare.mjs']
    .map(file => ({ file, sha256: hash(fs.readFileSync(path.join(root, file))) })),
  results, source, upstream: 'owned-loopback', paidCalls: 0, magpie: 'not_run', fullSuite: 'not_run' };
fs.writeFileSync(destination, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify({ destination, identity: identity.sha256, checks: results.map(result => result.checks.length), sourceGroups: source.groups.length }));
