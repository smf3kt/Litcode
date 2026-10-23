import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CACHE_TTL_MS, cacheIsCold, cacheMissGate, effortChangeGate, effortKeptMessage, effortSwitchConfirm,
  lastResponseModel, maxEffortReminderEnabled, maxEffortTip, modelFamilyKey, modelKeptMessage,
  modelNotice, modelSwitchConfirm, SWITCH_CACHE_WARNING, SWITCH_CANCEL_LABEL, SWITCH_EFFORT_TITLE,
  SWITCH_MODEL_TITLE, totalOutputTokens,
} from '../src/switch-confirm.js';

test('the recovered switch dialog text is verbatim', () => {
  assert.equal(SWITCH_MODEL_TITLE, 'Switch model?');
  assert.equal(SWITCH_EFFORT_TITLE, 'Change effort level?');
  assert.equal(SWITCH_CACHE_WARNING, 'Your next response will be slower and use more tokens');
  assert.equal(SWITCH_CANCEL_LABEL, 'No, go back');
  const model = modelSwitchConfirm('next-model');
  assert.equal(model.body,
    'This conversation is cached for the current model. Switching to next-model means the full history gets re-read on your next message.');
  assert.equal(model.confirmLabel, 'Yes, switch to next-model');
  const effort = effortSwitchConfirm('max');
  assert.equal(effort.body,
    'This conversation is cached for the current effort level. Switching to max means the full history gets re-read on your next message.');
  assert.equal(effort.confirmLabel, 'Yes, switch to max');
  assert.equal(effortKeptMessage(undefined), 'Kept effort level as auto');
  assert.equal(effortKeptMessage('high'), 'Kept effort level as high');
  assert.equal(modelKeptMessage('kept-model'), 'Kept model as kept-model');
});

test('the model notice carries the saved suffix, the effort clause and a failed write', () => {
  assert.equal(modelNotice('m', { saved: true }), 'Set model to m and saved as your default for new sessions');
  assert.equal(modelNotice('m', { saved: false }), 'Set model to m for this session only');
  assert.equal(modelNotice('m', { saved: true, effort: 'high' }),
    'Set model to m and saved as your default for new sessions with high effort');
  // `max` is not persistable, so the effort clause says it is session-only even on a saved switch.
  assert.equal(modelNotice('m', { saved: true, effort: 'max', effortPersistable: false }),
    'Set model to m and saved as your default for new sessions · max effort for this session only');
  assert.equal(modelNotice('m', { saved: false, saveFailure: " · couldn't save it as your default: /tmp/settings.json isn't valid JSON" }),
    "Set model to m for this session only · couldn't save it as your default: /tmp/settings.json isn't valid JSON");
});

test('the cache-miss model gate needs a cold cache, new tokens and a different family', () => {
  const base = { totalOutputTokens: 100, cacheCold: true, nextModel: 'next-model', currentModel: 'current-model' };
  assert.equal(cacheMissGate(base), true);
  // A warm cache never asks.
  assert.equal(cacheMissGate({ ...base, cacheCold: false }), false);
  // No output yet, or nothing new since the last confirmation.
  assert.equal(cacheMissGate({ ...base, totalOutputTokens: 0 }), false);
  assert.equal(cacheMissGate({ ...base, ackedAtOutputTokens: 100 }), false);
  // The same family does not ask; the last response already from the new model does not either.
  // The recovered also accepts a served-model alias (`sin`); this host has no such latch, so the
  // comparison is exact and an alias still asks.
  assert.equal(cacheMissGate({ ...base, currentModel: 'next-model' }), false);
  assert.equal(cacheMissGate({ ...base, lastResponseModel: 'next-model' }), false);
  assert.equal(cacheMissGate({ ...base, lastResponseModel: 'next-model-20260101' }), true);
  // A last response from another family still asks.
  assert.equal(cacheMissGate({ ...base, lastResponseModel: 'other-model' }), true);
});

test('the cache-miss effort gate compares the effective level, with auto as its own value', () => {
  const base = { totalOutputTokens: 10, cacheCold: true, nextEffort: 'max', currentEffort: 'high' };
  assert.equal(effortChangeGate(base), true);
  assert.equal(effortChangeGate({ ...base, nextEffort: 'high' }), false);
  assert.equal(effortChangeGate({ ...base, nextEffort: undefined, currentEffort: undefined }), false);
  assert.equal(effortChangeGate({ ...base, nextEffort: undefined, currentEffort: 'high' }), true);
  assert.equal(effortChangeGate({ ...base, cacheCold: false }), false);
  assert.equal(effortChangeGate({ ...base, ackedAtOutputTokens: 10 }), false);
});

test('the family key drops the long-context suffix and compares case-insensitively', () => {
  assert.equal(modelFamilyKey('model-x[1m]'), 'model-x');
  assert.equal(modelFamilyKey('Model-X[2M]'), 'model-x');
  assert.equal(modelFamilyKey(' model-x '), 'model-x');
});

test('output tokens and the last response model come from the journal responses', () => {
  const events = [
    { kind: 'message', response: { model: 'first', usage: { output_tokens: 7 } } },
    { kind: 'turn_end', duration: { timestamp: new Date().toISOString() } },
    { kind: 'message', response: { model: 'second', usage: { output_tokens: 5 } } },
    { kind: 'message' },
  ];
  assert.equal(totalOutputTokens(events), 12);
  assert.equal(lastResponseModel(events), 'second');
  assert.equal(lastResponseModel([{ kind: 'message' }]), undefined);
});

test('the cache is cold only after the lifetime since the last turn end', () => {
  const stamp = Date.parse('2026-10-23T10:00:00.000Z');
  const events = [{ kind: 'turn_end', duration: { timestamp: '2026-10-23T10:00:00.000Z' } }];
  assert.equal(cacheIsCold(events, true, stamp + CACHE_TTL_MS - 1), false);
  assert.equal(cacheIsCold(events, true, stamp + CACHE_TTL_MS), true);
  // Caching off never asks; a journal with no stamped turn never asks either.
  assert.equal(cacheIsCold(events, false, stamp + CACHE_TTL_MS * 2), false);
  assert.equal(cacheIsCold([{ kind: 'message' }], true, stamp + CACHE_TTL_MS * 2), false);
});

test('the max-effort reminder follows the environment gate and the pinned row text', () => {
  assert.equal(maxEffortReminderEnabled({}), false);
  assert.equal(maxEffortReminderEnabled({ LITCODE_MAX_EFFORT_REMINDER: '0' }), false);
  assert.equal(maxEffortReminderEnabled({ LITCODE_MAX_EFFORT_REMINDER: 'false' }), false);
  assert.equal(maxEffortReminderEnabled({ LITCODE_MAX_EFFORT_REMINDER: 'on' }), true);
  assert.equal(maxEffortReminderEnabled({ LITCODE_MAX_EFFORT_REMINDER: 'TRUE' }), true);
  assert.equal(maxEffortTip('note'), 'Max effort · note · /effort to change');
});
