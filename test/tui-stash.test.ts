import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { STASH_HINT_SHRINK_FROM, STASH_HINT_SHRINK_TO, STASH_HINT_TIMEOUT_MS, STASH_RESTORED,
  STASH_RESTORED_TIMEOUT_MS, StashHintGate, hasUsedStash, markStashUsed, stashHintText } from '../src/tui-stash.js';

function workspace(): string { return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-stash-'))); }

test('the stash tip and restore notice carry the recovered copy and timings', () => {
  // `Pr({key:"stash-hint"…})` (chunk-24k7d6mw.js 828775) renders `["Tip:", " ", <pt …/>]`, and
  // `z` (chunk-0qkpwgr4.js 4270) joins the chord and its action with `" to "`.
  assert.equal(stashHintText('ctrl+s'), 'Tip: ctrl+s to stash');
  assert.equal(STASH_HINT_TIMEOUT_MS, 5_000);
  assert.equal(STASH_RESTORED, 'Draft restored');
  assert.equal(STASH_RESTORED_TIMEOUT_MS, 5_000);
  assert.equal(STASH_HINT_SHRINK_FROM, 20);
  assert.equal(STASH_HINT_SHRINK_TO, 5);
});

test('the tip gate fires on the render that crosses to five lines', () => {
  const gate = new StashHintGate();
  // Both counters seed at the mount length, so the first observation is never a change.
  assert.equal(gate.observe(0), false);
  // `nh > ow` only moves the baseline.
  assert.equal(gate.observe(30), false);
  // `jN`: the last seen length was itself at least 20, so a one-render drop to 5 is not the
  // shrink this tip watches for.
  assert.equal(gate.observe(4), false);
  // Crossing 20 first, then 5, is the source's window.
  assert.equal(gate.observe(19), false);
  assert.equal(gate.observe(4), true);
  // The gate moves its baseline after raising, so the same shrink is not raised twice.
  assert.equal(gate.observe(3), false);
  assert.equal(gate.observe(0), false);
  // A fresh run past 20 and back below 5 raises it again.
  assert.equal(gate.observe(25), false);
  assert.equal(gate.observe(19), false);
  assert.equal(gate.observe(5), true);
});

test('the tip gate keeps its shrink window on the exact boundaries', () => {
  const atTwenty = new StashHintGate();
  atTwenty.observe(0);
  atTwenty.observe(20);
  atTwenty.observe(19);
  assert.equal(atTwenty.observe(5), true);
  // A baseline below 20 is not the shrink the source watches.
  const justShort = new StashHintGate();
  justShort.observe(0);
  justShort.observe(19);
  assert.equal(justShort.observe(5), false);
  // Five is the far edge; six is still inside the window's upper side.
  const notFarEnough = new StashHintGate();
  notFarEnough.observe(0);
  notFarEnough.observe(30);
  notFarEnough.observe(19);
  assert.equal(notFarEnough.observe(6), false);
  // Clearing the draft takes the `nh === 0` arm, which never raises the tip.
  const cleared = new StashHintGate();
  cleared.observe(0);
  cleared.observe(30);
  assert.equal(cleared.observe(0), false);
});

test('hasUsedStash latches once and survives the other settings keys', () => {
  const userDir = workspace();
  try {
    // `Ze` (chunk-bk5ct2gw.js 558688) starts the record at `hasUsedStash:!1`.
    assert.equal(hasUsedStash(userDir), false);
    fs.writeFileSync(path.join(userDir, 'settings.json'), JSON.stringify({ theme: 'dark' }));
    assert.equal(hasUsedStash(userDir), false);
    markStashUsed(userDir);
    assert.equal(hasUsedStash(userDir), true);
    // The write keeps the other authored fields.
    const saved = JSON.parse(fs.readFileSync(path.join(userDir, 'settings.json'), 'utf8'));
    assert.equal(saved.theme, 'dark');
    assert.equal(saved.hasUsedStash, true);
    // `bJt` returns the record unchanged once the latch is set.
    markStashUsed(userDir);
    assert.equal(hasUsedStash(userDir), true);
  } finally { fs.rmSync(userDir, { recursive: true, force: true }); }
});

test('an unreadable stash latch reads as never used', () => {
  const userDir = workspace();
  try {
    fs.writeFileSync(path.join(userDir, 'settings.json'), '{');
    assert.equal(hasUsedStash(userDir), false);
  } finally { fs.rmSync(userDir, { recursive: true, force: true }); }
});
