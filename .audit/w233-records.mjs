import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { captureIdentity } from '../scripts/identity.mjs';

const root = path.resolve(import.meta.dirname, '..');
const [configResult, modelResult, effortResult, destination] = process.argv.slice(2);
assert.ok(configResult && modelResult && effortResult && destination,
  'Usage: node .audit/w233-records.mjs CONFIG_RESULT MODEL_RESULT EFFORT_RESULT NEW_JSON');
const identity = captureIdentity(root);
const results = [configResult, modelResult, effortResult].map(file => {
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(value.build, identity.build.sha256, `Stale compiled validation ${file}`);
  assert.equal(value.validation, identity.validation.sha256, `Stale regression identity ${file}`);
  assert.ok(Array.isArray(value.checks) && value.checks.length > 0);
  return { driver: path.basename(path.dirname(file)), identity: value.identity, inputs: value.inputs,
    build: value.build, validation: value.validation, checks: value.checks, captures: value.captures,
    requests: value.requests, hooks: value.hooks };
});
const driverPaths = ['.audit/w233-config-panel.mjs', '.audit/w232-model-picker.mjs', '.audit/w231-effort-slider.mjs'];
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const evidence = { schema: 'W233Validation.v1', identity: identity.sha256,
  inputs: { sha256: identity.inputs.sha256, count: identity.inputs.files.length },
  validation: { sha256: identity.validation.sha256, count: identity.validation.files.length },
  build: { sha256: identity.build.sha256, count: identity.build.files.length },
  drivers: driverPaths.map(file => ({ path: file, sha256: hash(fs.readFileSync(path.join(root, file))) })),
  sourceComparisons: JSON.parse(fs.readFileSync(path.join(root, '.audit/w233-source-evidence.json'), 'utf8')),
  results, sourceOnlyDifference: 'The compatibility results precede an exact provenance-range comment correction in src/theme-settings.ts. Build and test digests are identical.',
  upstream: 'owned-loopback-sse', magpie: 'not_run', paidCalls: 0 };
fs.writeFileSync(destination, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify({ file: destination, identity: identity.sha256, checks: results.map(value => value.checks.length) }));
