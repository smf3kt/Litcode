import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

test('compiled lifecycle journals recover real write/fsync faults without replay and reject changes during sync', { timeout: 90000 }, () => {
  const result = spawnSync(process.execPath, ['scripts/smoke-async-hook-durability.mjs'], { encoding: 'utf8', timeout: 85000 });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.cases, 18);
});
