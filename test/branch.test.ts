import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BRANCH_FALLBACK_TITLE, branchFailureMessage, branchMessage, branchTitle, customBranchTitle,
  cutGraphemes, deriveFirstPrompt, unwrapPastedContent } from '../src/branch.js';

test('the grapheme cut never splits a surrogate pair', () => {
  assert.equal(cutGraphemes('abc', 0), '');
  assert.equal(cutGraphemes('abc', 5), 'abc');
  assert.equal(cutGraphemes('abcdef', 3), 'abc');
  // The pair at index 1 is cut away, not halved.
  assert.equal(cutGraphemes('a😀bc', 2), 'a');
  assert.equal(cutGraphemes('a😀bc', 3), 'a😀');
});

test('a pasted-content block keeps only its body', () => {
  const text = 'before\n<pasted_content id="1a2b">\nline one\nline two\n</pasted_content id="1a2b">\nafter';
  assert.equal(unwrapPastedContent(text), 'before\nline one\nline two\nafter');
  // The body keeps its own trailing newline; the block's closing line is what gets dropped.
  assert.equal(unwrapPastedContent('<pasted_content id="aaaa">\nA\n</pasted_content id="aaaa">\nB'), 'A\nB');
  assert.equal(unwrapPastedContent('<pasted_content id="aaaa">\nA'), '<pasted_content id="aaaa">\nA');
});

test('the first prompt skips meta, summary, tool-result and interrupted rows', () => {
  assert.equal(deriveFirstPrompt([
    { texts: ['host note'], meta: true },
    { texts: ['summary text'], meta: false, compactSummary: true },
    { texts: ['tool output'], meta: false, toolResult: true },
    { texts: ['[Request interrupted by user]'], meta: false },
    { texts: ['  Fix the parser  '], meta: false },
  ]), 'Fix the parser');
  assert.equal(deriveFirstPrompt([]), BRANCH_FALLBACK_TITLE);
});

test('a slash command names the branch only when no plain prompt follows', () => {
  assert.equal(deriveFirstPrompt([{ texts: ['<command-name>/compact</command-name>'], meta: false },
    { texts: ['do the thing'], meta: false }]), 'do the thing');
  assert.equal(deriveFirstPrompt([{ texts: ['<command-name>/compact</command-name>'], meta: false }]), '/compact');
  assert.equal(deriveFirstPrompt([{ texts: ['<bash-input>ls -la</bash-input>'], meta: false }]), '! ls -la');
});

test('a long prompt is cut to 200 units, then the whole title to 100', () => {
  const long = 'x'.repeat(240);
  // `d8e` adds the ellipsis at 200, but `te` then cuts the assembled title to 100 units.
  assert.equal(deriveFirstPrompt([{ texts: [long], meta: false }]), 'x'.repeat(100));
  assert.equal(deriveFirstPrompt([{ texts: ['   '], meta: false }]), BRANCH_FALLBACK_TITLE);
});

test('text blocks are read in order within one message', () => {
  assert.equal(deriveFirstPrompt([{ texts: ['', '  second block  '], meta: false }]), 'second block');
});

test('a branch title takes the first free ordinal', () => {
  assert.equal(branchTitle('Fix parser', []), 'Fix parser (Branch)');
  assert.equal(branchTitle('Fix parser', ['Fix parser (Branch)']), 'Fix parser (Branch 2)');
  assert.equal(branchTitle('Fix parser', ['Fix parser (Branch)', 'Fix parser (Branch 2)']), 'Fix parser (Branch 3)');
  // A gap fills before the next unused ordinal above the highest.
  assert.equal(branchTitle('Fix parser', ['Fix parser (Branch)', 'Fix parser (Branch 3)']), 'Fix parser (Branch 2)');
  // A title that only shares the prefix is not an ordinal.
  assert.equal(branchTitle('Fix parser', ['Fix parser (Branch) extra']), 'Fix parser (Branch)');
});

test('the success line quotes only a custom title', () => {
  assert.equal(branchMessage({ sessionId: 'new', originalSessionId: 'old' }),
    'Branched conversation. Resume with: /resume new');
  assert.equal(branchMessage({ customTitle: 'my-topic', sessionId: 'new', originalSessionId: 'old',
    originalTitle: 'Fix', resumed: true }),
    'Branched conversation "my-topic". You are now in the new branch (session new). '
    + 'Use /resume old ("Fix") to return to the original, or run `claude -r old` in a new terminal.');
});

test('a custom name is stored collapsed and trimmed, without a branch suffix', () => {
  assert.equal(customBranchTitle('  my   topic \n'), 'my topic');
  assert.equal(customBranchTitle('my-topic'), 'my-topic');
});

test('a failure line keeps the source wording', () => {
  assert.equal(branchFailureMessage(new Error('No messages to branch')), 'Failed to branch conversation: No messages to branch');
  assert.equal(branchFailureMessage('odd'), 'Failed to branch conversation: Unknown error occurred');
});
