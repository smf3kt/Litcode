import { strict as assert } from 'node:assert';
import test from 'node:test';
import { DEFAULT_EFFORT, EFFORT_LEVELS, effortArgumentHint, effortArgumentHintWithUltracode,
  effortCommand, effortDescription, effortGlyph, effortIndicator, effortOverride, effortStatus,
  effortUsage, effortUsageWithUltracode, parseEffortLevel, parseUltracodeArgument,
  persistableEffort } from '../src/effort-command.js';

const base = { current: undefined as 'low' | 'medium' | 'high' | 'xhigh' | 'max' | undefined,
  fallback: DEFAULT_EFFORT, save: true };

test('the level list is the recovered order and the alias folds into medium', () => {
  assert.deepEqual([...EFFORT_LEVELS], ['low', 'medium', 'high', 'xhigh', 'max']);
  assert.equal(parseEffortLevel('MED'), 'medium');
  assert.equal(parseEffortLevel(' Medium '), 'medium');
  assert.equal(parseEffortLevel('max'), 'max');
  assert.equal(parseEffortLevel('ultra'), undefined);
});

test('only max stays session-scoped', () => {
  assert.equal(persistableEffort('low'), 'low');
  assert.equal(persistableEffort('xhigh'), 'xhigh');
  assert.equal(persistableEffort('max'), undefined);
});

test('each level carries its own glyph', () => {
  assert.equal(EFFORT_LEVELS.map(effortGlyph).join(''), '○◐●◉◈');
});

test('the usage text lists every level and the auto default', () => {
  assert.equal(effortUsage(), `Usage: /effort [low|medium|high|xhigh|max|auto]

Effort levels:
- low: Quick, straightforward implementation
- medium: Balanced approach with standard testing
- high: Comprehensive implementation with extensive testing
- xhigh: Extended reasoning with thorough analysis (on supported models)
- max: Maximum capability with deepest reasoning (on supported models)
- auto: Use the default effort level for your model`);
  assert.equal(effortArgumentHint(), '<low|medium|high|xhigh|max|auto>');
});

test('the max description carries the excessive-token note', () => {
  assert.equal(effortDescription('max'), 'Maximum capability with deepest reasoning. May use excessive tokens ' +
    'resulting in long response times or overthinking. Use sparingly for the hardest tasks.');
});

test('a bare argument prints the argument hint, and a help word prints the usage', () => {
  assert.equal(effortCommand('', base).message, 'Usage: /effort <low|medium|high|xhigh|max|auto>');
  for (const word of ['help', '-h', '--help']) assert.equal(effortCommand(word, base).message, effortUsage());
});

test('an unknown argument names itself and the valid options', () => {
  const result = effortCommand('extreme', base);
  assert.equal(result.message, 'Invalid argument: extreme. Valid options are: low, medium, high, xhigh, max, auto');
  assert.equal(result.effort, undefined);
  assert.equal(result.saved, undefined);
});

test('setting a level reports the save scope and the description', () => {
  const result = effortCommand('high', base);
  assert.equal(result.message, 'Set effort level to high (saved as your default for new sessions): ' +
    'Comprehensive implementation with extensive testing and documentation');
  assert.equal(result.effort, 'high');
  assert.equal(result.saved, 'high');
});

test('max is session-only and leaves the stored default alone', () => {
  const result = effortCommand('max', base);
  assert.equal(result.message, 'Set effort level to max (this session only): Maximum capability with deepest ' +
    'reasoning. May use excessive tokens resulting in long response times or overthinking. Use sparingly for ' +
    'the hardest tasks.');
  assert.equal(result.effort, 'max');
  // The recovered `X9` gate on a session-only level writes nothing at all: an absent `saved` keeps
  // the stored default, where null would clear it.
  assert.equal(result.saved, undefined);
});

test('auto clears the level and the stored default', () => {
  const result = effortCommand('auto', { ...base, current: 'high' });
  assert.equal(result.message, 'Effort level set to auto');
  assert.equal(result.effort, null);
  assert.equal(result.saved, null);
  assert.equal(effortCommand('unset', base).effort, null);
});

test('status reports the level with its description, and auto reports what it resolves to', () => {
  assert.equal(effortCommand('status', { ...base, current: 'low' }).message,
    'Current effort level: low (Quick, straightforward implementation with minimal overhead)');
  assert.equal(effortCommand('current', base).message, 'Effort level: auto (currently high)');
  assert.equal(effortStatus('xhigh', DEFAULT_EFFORT),
    'Current effort level: xhigh (Deeper reasoning than high, just below maximum (on supported models))');
  // A read-only answer leaves the session alone.
  assert.equal(effortCommand('status', base).effort, undefined);
});

test('the indicator is the glyph and the command name', () => {
  assert.equal(effortIndicator('high'), '● high · /effort');
  assert.equal(effortIndicator('low', true), 'effort: low · /effort');
});

test('LLM_EFFORT overrides the session and the message names the raw value', () => {
  const env = { LLM_EFFORT: 'low' } as NodeJS.ProcessEnv;
  assert.deepEqual(effortOverride(env), { raw: 'low', level: 'low' });
  assert.equal(effortOverride({ LLM_EFFORT: 'unset' } as NodeJS.ProcessEnv)?.level, null);
  assert.equal(effortOverride({ LLM_EFFORT: 'auto' } as NodeJS.ProcessEnv)?.level, null);
  assert.equal(effortOverride({} as NodeJS.ProcessEnv), null);
  const previous = process.env.LLM_EFFORT;
  process.env.LLM_EFFORT = 'low';
  try {
    const result = effortCommand('high', base);
    assert.equal(result.message, 'LLM_EFFORT=low overrides this session — clear it and high takes over');
    assert.equal(result.effort, 'high');
    // The settings write still happens, as the recovered `D` starts `X9` before the override check.
    assert.equal(result.saved, 'high');
    // A session-only level cannot win against the override, and nothing is saved for it.
    const maxed = effortCommand('max', base);
    assert.equal(maxed.message, 'Not applied: LLM_EFFORT=low overrides effort this session, and max is ' +
      'session-only (nothing saved)');
    assert.equal(maxed.saved, undefined);
    // Clearing back to auto reports that the override still decides the session.
    assert.equal(effortCommand('auto', base).message,
      'Cleared effort from settings, but LLM_EFFORT=low still controls this session');
  } finally {
    if (previous === undefined) delete process.env.LLM_EFFORT; else process.env.LLM_EFFORT = previous;
  }
});

test('ultracode parses only its own verb and mode', () => {
  assert.equal(parseUltracodeArgument('ultracode'), true);
  assert.equal(parseUltracodeArgument('ultracode on'), true);
  assert.equal(parseUltracodeArgument('ultracode off'), false);
  assert.equal(parseUltracodeArgument('ultracode maybe'), undefined);
  assert.equal(parseUltracodeArgument('ultracode on extra'), undefined);
  assert.equal(parseUltracodeArgument('high'), undefined);
});

test('the ultracode arm reports the effort that stays in force', () => {
  const workflows = { ...base, workflowsEnabled: true };
  assert.deepEqual(effortCommand('ultracode', workflows),
    { message: 'Ultracode on (this session only): dynamic workflows on every task. Effort stays high.',
      ultracode: true });
  assert.deepEqual(effortCommand('ultracode off', { ...workflows, current: 'low' }),
    { message: 'Ultracode off. Effort stays low.', ultracode: false });
});

test('ultracode refuses without dynamic workflows', () => {
  const refused = effortCommand('ultracode', base);
  assert.equal(refused.message, 'Ultracode needs dynamic workflows enabled (see /config). ' +
    'Valid options are: low, medium, high, xhigh, max, auto');
  assert.equal(refused.ultracode, undefined);
  // Turning it off is always allowed, even with workflows disabled.
  assert.equal(effortCommand('ultracode off', base).ultracode, false);
});

test('the usage and option list grow only with dynamic workflows', () => {
  assert.ok(!effortUsage().includes('ultracode'));
  assert.ok(effortUsageWithUltracode().includes('Ultracode (any effort level, dynamic workflows on every task)'));
  assert.equal(effortArgumentHintWithUltracode(), '<low|medium|high|xhigh|max|auto|ultracode [on|off]>');
  assert.equal(effortCommand('', { ...base, workflowsEnabled: true }).message,
    'Usage: /effort <low|medium|high|xhigh|max|auto|ultracode [on|off]>');
  assert.equal(effortCommand('nope', { ...base, workflowsEnabled: true }).message,
    'Invalid argument: nope. Valid options are: low, medium, high, xhigh, max, auto, ultracode');
});
