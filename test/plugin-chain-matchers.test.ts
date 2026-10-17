// The matcher runner (W45-87 regression): `aUn`/`Slt`/`b` evaluate through the recovered `l`
// runner rather than the error-text helper the seam used to resolve `l` to. Scalar mismatches are
// false, object matchers are partial, regex matchers test the value, and tool aliases expand.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { aUn as aUnSource, Slt as SltSource, b as bSource } from '../src/plugin-chain-matchers.js';

// The copied bodies declare every parameter position; the runner's third argument is optional in
// the caller (the seam passes `undefined` when no alias table exists).
const aUn = aUnSource as (value: unknown, matcher: unknown, names?: unknown) => boolean;
const Slt = SltSource as (matcher: unknown, value: unknown, names?: unknown) => boolean;
const b = bSource as (value: unknown, matcher: unknown, names?: unknown) => boolean;

const names = { table: { Task: 'Agent', ListPeers: 'ListAgents' }, paths: [[]] };

describe('the matcher runner', () => {
  it('compares scalars by equality', () => {
    assert.equal(aUn(1, 1), true);
    assert.equal(aUn(2, 1), false);
    assert.equal(aUn('x', 'x'), true);
    assert.equal(aUn('x', 'y'), false);
  });

  it('matches objects partially and recursively', () => {
    assert.equal(aUn({ a: 1 }, { a: 1 }), true);
    assert.equal(aUn({ a: 2 }, { a: 1 }), false);
    assert.equal(aUn({ a: { b: 2 } }, { a: { b: 2 } }), true);
    assert.equal(aUn({ a: { b: 3 } }, { a: { b: 2 } }), false);
  });

  it('expands tool aliases on either side', () => {
    assert.equal(aUn('Agent', 'Task', names as never), true);
    assert.equal(aUn('Task', 'Agent', names as never), true);
    assert.equal(aUn('Agent', 'Other', names as never), false);
  });

  it('tests a regex matcher against the value', () => {
    assert.equal(Slt(/^x/, 'x'), true);
    assert.equal(Slt(/^x/, 'y'), false);
    assert.equal(Slt(/^Agent$/, 'Task', names as never), true);
  });

  it('checks one matcher field and lets an absent matcher through', () => {
    assert.equal(b({ a: 1 }, { field: 'a', value: 1 }), true);
    assert.equal(b({ a: 2 }, { field: 'a', value: 1 }), false);
    assert.equal(b(undefined, { field: 'a', value: 1 }), true);
  });
});
