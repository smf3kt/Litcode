import { strict as assert } from 'node:assert';
import test from 'node:test';
import { PROMPT_BORDER_SLOT, SESSION_COLORS, SESSION_COLOR_SLOTS, SUBAGENT_COLOR_FALLBACK_SLOT,
  composeBanner, effectiveSessionColor, isSessionColor, parseSessionColor, sessionColorArgumentHint,
  sessionColorMessage, sessionColorSlot } from '../src/session-color.js';

test('the eight names and the reset words are the recovered ones', () => {
  assert.deepEqual([...SESSION_COLORS],
    ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan']);
  assert.equal(sessionColorArgumentHint(), '[red|blue|green|yellow|purple|orange|pink|cyan|default]');
  assert.equal(isSessionColor('cyan'), true);
  assert.equal(isSessionColor('grey'), false);
});

test('a reset word clears the colour and reports the recovered line', () => {
  for (const word of ['default', 'reset', 'none', 'gray', 'grey', 'DEFAULT', '  Reset  ']) {
    const result = parseSessionColor(word);
    assert.equal(result.kind, 'reset');
    assert.equal(sessionColorMessage(result as { kind: 'reset' }), 'Session color reset to default');
  }
});

test('a name sets the colour and reports it lowercased', () => {
  const result = parseSessionColor('  PURPLE ');
  assert.deepEqual(result, { kind: 'set', color: 'purple' });
  assert.equal(sessionColorMessage(result as { kind: 'set'; color: 'purple' }),
    'Session color set to: purple');
});

test('an empty argument picks a colour instead of reporting one', () => {
  assert.deepEqual(parseSessionColor('', () => 'pink'), { kind: 'set', color: 'pink' });
  assert.deepEqual(parseSessionColor(undefined, () => 'orange'), { kind: 'set', color: 'orange' });
  assert.deepEqual(parseSessionColor('   ', () => 'cyan'), { kind: 'set', color: 'cyan' });
  assert.equal(SESSION_COLORS.includes(parseSessionColor('') as never), false);
  assert.equal(isSessionColor((parseSessionColor('') as { color: string }).color), true);
});

test('an unknown name reports the list verbatim', () => {
  const result = parseSessionColor('Teal');
  assert.equal(result.kind, 'invalid');
  assert.equal((result as { message: string }).message,
    'Invalid color "teal". Available colors: red, blue, green, yellow, purple, orange, pink, cyan, default');
});

test('a name resolves to its slot and anything else to the caller fallback', () => {
  assert.equal(sessionColorSlot('red'), 'red_FOR_SUBAGENTS_ONLY');
  assert.equal(sessionColorSlot('red'), SESSION_COLOR_SLOTS.red);
  assert.equal(sessionColorSlot('grey'), SUBAGENT_COLOR_FALLBACK_SLOT);
  assert.equal(sessionColorSlot(undefined), SUBAGENT_COLOR_FALLBACK_SLOT);
  assert.equal(sessionColorSlot(undefined, PROMPT_BORDER_SLOT), 'promptBorder');
  assert.equal(sessionColorSlot('red', PROMPT_BORDER_SLOT), 'red_FOR_SUBAGENTS_ONLY');
});

test('the user pick wins over the agent definition', () => {
  assert.equal(effectiveSessionColor({ userOverride: 'blue', agentDefinitionColor: 'red' }), 'blue');
  assert.equal(effectiveSessionColor({ agentDefinitionColor: 'red' }), 'red');
  assert.equal(effectiveSessionColor({}), undefined);
});

test('the banner is a full-width rule once the chip collapses', () => {
  assert.equal(composeBanner('', 10), '──────────');
  assert.equal(composeBanner('', 1), '─');
});

test('a banner text is cut to the room the rule leaves and the row still fills', () => {
  // `Mk`: the text is cut to `columns - 3`, and the row is that chip plus one dash.
  assert.equal(composeBanner('abcd', 10), '─── abcd ─');
  assert.equal(composeBanner('abcdefgh', 10), ' abcdef… ─');
  assert.equal(composeBanner('x'.repeat(40), 12), ' xxxxxxxx… ─');
  assert.equal(composeBanner('x'.repeat(40), 12).length, 12);
});
