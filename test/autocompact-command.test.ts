import { strict as assert } from 'node:assert';
import test from 'node:test';
import { AUTO_COMPACT_FALLBACK, AUTO_COMPACT_MAX, AUTO_COMPACT_MIN, AUTO_COMPACT_STEP,
  applyAutoCompactWindow, autoCompactChoices, autoCompactDialogMessage, autoCompactLimit,
  autoCompactSelection, autoCompactSelectionValue, autoCompactStatus, autoCompactUnchangedMessage,
  autoCompactWindowText, formatTokens, parseAutoCompactWindow,
  resolveAutoCompactWindow } from '../src/autocompact-command.js';

const LIMIT = autoCompactLimit(1_000_000, 16_384);

test('the parser takes the recovered multipliers, the thousand shorthand and the range', () => {
  assert.equal(parseAutoCompactWindow('auto'), 'auto');
  assert.equal(parseAutoCompactWindow(' 500k '), 500_000);
  assert.equal(parseAutoCompactWindow('200000'), 200_000);
  // A bare 100 to 1000 is thousands, so `200` and `200k` agree.
  assert.equal(parseAutoCompactWindow('200'), 200_000);
  assert.equal(parseAutoCompactWindow('100'), 100_000);
  assert.equal(parseAutoCompactWindow('1000'), AUTO_COMPACT_MAX);
  assert.equal(parseAutoCompactWindow('1m'), 1_000_000);
  assert.equal(parseAutoCompactWindow('0.5m'), 500_000);
  assert.equal(parseAutoCompactWindow('1.5m'), undefined);
});

test('a value outside 100k to 1M is unparseable', () => {
  for (const value of ['50k', '99k', '2m', '99', '99.5k', '', 'abc', '-200k']) {
    assert.equal(parseAutoCompactWindow(value), undefined, `${JSON.stringify(value)} is out of range`);
  }
  // 1000.5 is above the shorthand band, so it is read literally and falls below the floor.
  assert.equal(parseAutoCompactWindow('1000.5'), undefined);
  assert.equal(parseAutoCompactWindow('1000000'), 1_000_000);
  assert.equal(parseAutoCompactWindow('1000001'), undefined);
});

test('the token count is the recovered compact form', () => {
  assert.equal(formatTokens(100_000), '100k');
  assert.equal(formatTokens(500_000), '500k');
  assert.equal(formatTokens(512_000), '512k');
  assert.equal(formatTokens(1_000_000), '1m');
  assert.equal(formatTokens(975_424), '975.4k');
});

test('the resolver reports settings when stored and the built-in window otherwise', () => {
  const stored = resolveAutoCompactWindow(LIMIT, 300_000);
  assert.deepEqual(stored, { window: 300_000, configured: 300_000, source: 'settings' });
  const missing = resolveAutoCompactWindow(LIMIT, undefined);
  assert.deepEqual(missing, { window: AUTO_COMPACT_FALLBACK, configured: AUTO_COMPACT_FALLBACK,
    source: 'model-default' });
  // The ceiling wins over the built-in window and over an oversized stored value.
  const ceiling = 400_000;
  assert.deepEqual(resolveAutoCompactWindow(ceiling, undefined),
    { window: ceiling, configured: ceiling, source: 'model-default' });
  assert.deepEqual(resolveAutoCompactWindow(ceiling, 900_000),
    { window: ceiling, configured: 900_000, source: 'settings' });
});

test('the window caption carries the source label and the cap', () => {
  assert.equal(autoCompactWindowText(resolveAutoCompactWindow(LIMIT, 300_000)),
    '300k tokens (from settings)');
  assert.equal(autoCompactWindowText(resolveAutoCompactWindow(LIMIT, undefined)),
    '512k tokens (default for this model)');
  assert.equal(autoCompactWindowText(resolveAutoCompactWindow(400_000, 900_000)),
    '900k tokens (from settings) · capped to 400k by model');
});

test('the status block adds the override warning only for a stored window', () => {
  const stored = autoCompactStatus('gateway-model', resolveAutoCompactWindow(LIMIT, 300_000));
  assert.match(stored, /^Auto-compact window for gateway-model: 300k tokens \(from settings\)$/m);
  assert.match(stored, /The actual threshold is the minimum of this setting and your model's maximum context window\./);
  assert.match(stored, /The auto setting picks a window tuned for your model and is strongly recommended for the best cost and performance\./);
  assert.match(stored, /Overriding auto may result in high token usage, especially when resuming long sessions\./);
  const auto = autoCompactStatus('gateway-model', resolveAutoCompactWindow(LIMIT, undefined));
  assert.match(auto, /512k tokens \(default for this model\)/);
  assert.doesNotMatch(auto, /Overriding auto/);
});

test('the dialog names the current setting and both fixed paragraphs', () => {
  const message = autoCompactDialogMessage('gateway-model', resolveAutoCompactWindow(LIMIT, 300_000));
  assert.match(message, /^Current setting for gateway-model: 300k tokens \(from settings\)$/m);
  assert.match(message, /This command configures when auto-compaction happens\./);
  assert.match(message, /You can override it below\./);
  assert.match(message, /Overriding auto/);
  assert.doesNotMatch(autoCompactDialogMessage('gateway-model', resolveAutoCompactWindow(LIMIT, undefined)),
    /Overriding auto/);
});

test('the chooser offers auto then every step, 100k through 1M', () => {
  const choices = autoCompactChoices();
  assert.equal(choices.length, (AUTO_COMPACT_MAX - AUTO_COMPACT_MIN) / AUTO_COMPACT_STEP + 2);
  assert.deepEqual(choices[0], { label: 'auto', value: 'auto' });
  assert.deepEqual(choices[1], { label: '100k tokens', value: '100000' });
  assert.deepEqual(choices.at(-1), { label: '1m tokens', value: '1000000' });
});

test('the initial row is auto unless a stored value rounds onto a step', () => {
  const auto = resolveAutoCompactWindow(LIMIT, undefined);
  assert.equal(autoCompactSelection(auto), 0);
  assert.equal(autoCompactSelectionValue(auto), 'auto');
  // 512k rounds to the 500k row; the bounds clamp an out-of-step stored value.
  assert.equal(autoCompactChoices()[autoCompactSelection(resolveAutoCompactWindow(LIMIT, 512_000))]!.value, '500000');
  assert.equal(autoCompactChoices()[autoCompactSelection(resolveAutoCompactWindow(LIMIT, 10_000))]!.value, '100000');
  assert.equal(autoCompactSelectionValue(resolveAutoCompactWindow(LIMIT, 500_000)), '500000');
});

test('a set reports the stored value, a cap and the auto clear', () => {
  const base = { model: 'gateway-model', limit: LIMIT };
  assert.deepEqual(applyAutoCompactWindow('500k', base),
    { message: 'Auto-compact window for gateway-model set to 500k tokens', saved: 500_000 });
  assert.deepEqual(applyAutoCompactWindow('1m', base),
    { message: 'Auto-compact window for gateway-model set to 1m tokens (capped to model limit of 975.4k)',
      saved: 1_000_000 });
  assert.deepEqual(applyAutoCompactWindow('auto', base),
    { message: 'Auto-compact window for gateway-model set to auto', saved: 'auto' });
});

test('reset, unset and default are the auto aliases', () => {
  for (const alias of ['reset', 'unset', 'default', 'RESET', ' Auto ']) {
    assert.deepEqual(applyAutoCompactWindow(alias, { model: 'm', limit: LIMIT }),
      { message: 'Auto-compact window for m set to auto', saved: 'auto' });
  }
});

test('an unparseable argument repeats it inside the recovered sentence', () => {
  const result = applyAutoCompactWindow('2m', { model: 'm', limit: LIMIT });
  assert.equal(result.message,
    "Couldn't parse '2m'. Expected 'auto' or 100k–1M tokens (e.g. 500k, 200000, or 200 as shorthand)");
  assert.equal(result.saved, undefined);
});

test('the unchanged caption carries the current setting', () => {
  assert.equal(autoCompactUnchangedMessage('gateway-model', resolveAutoCompactWindow(LIMIT, undefined)),
    'Auto-compact window for gateway-model unchanged: 512k tokens (default for this model)');
});
