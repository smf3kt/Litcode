import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AUTOCOMPACT_BUFFER, COMPACT_BUFFER, COMPACT_BUFFER_TOKENS, FREE_SPACE,
  contextCellGlyph, contextGrid, contextPanelText, contextUsageFromCounts } from '../src/context-panel.js';

test('categories follow the recovered order and buffer/free maths', () => {
  const usage = contextUsageFromCounts({ model: 'model-a', systemTokens: 1000, toolTokens: 2000,
    messageTokens: 3000, maxTokens: 1_000_000, compactAt: 512_000, autoCompact: true });
  assert.deepEqual(usage.categories.map(category => [category.name, category.tokens, category.kind]), [
    ['System prompt', 1000, 'category'],
    ['System tools', 2000, 'category'],
    ['Messages', 3000, 'category'],
    [AUTOCOMPACT_BUFFER, 488_000, 'buffer'],
    [FREE_SPACE, 506_000, 'free'],
  ]);
  assert.equal(usage.totalTokens, 6000);
  assert.equal(usage.percentage, 1);
  assert.equal(usage.gridRows.length, 10);
  assert.deepEqual(usage.gridRows.map(row => row.length), Array(10).fill(20));
});

test('a disabled automatic compaction shows the 3000-token compact reserve', () => {
  const usage = contextUsageFromCounts({ model: 'model-a', systemTokens: 1000, toolTokens: 0,
    messageTokens: 0, maxTokens: 200_000, autoCompact: false });
  assert.deepEqual(usage.categories.map(category => [category.name, category.tokens, category.kind]), [
    ['System prompt', 1000, 'category'],
    [COMPACT_BUFFER, COMPACT_BUFFER_TOKENS, 'buffer'],
    [FREE_SPACE, 196_000, 'free'],
  ]);
});

test('the grid narrows below 80 columns and widens at a 1e6 window', () => {
  const categories = [
    { name: 'Messages', tokens: 100_000, kind: 'category' as const },
    { name: FREE_SPACE, tokens: 100_000, kind: 'free' as const },
  ];
  assert.equal(contextGrid(categories, 200_000, 60).length, 5);
  assert.deepEqual(contextGrid(categories, 200_000, 60).map(row => row.length), Array(5).fill(5));
  assert.equal(contextGrid(categories, 1_000_000, 120).length, 10);
  assert.deepEqual(contextGrid(categories, 1_000_000, 120).map(row => row.length), Array(10).fill(20));
});

test('a category with no whole cell still occupies one, carrying its fraction', () => {
  const usage = contextUsageFromCounts({ model: 'model-a', systemTokens: 1000, toolTokens: 0,
    messageTokens: 0, maxTokens: 1_000_000, compactAt: 512_000, autoCompact: true });
  assert.deepEqual(usage.gridRows[0]![0], { categoryName: 'System prompt', fullness: 0.2 });
  assert.equal(contextCellGlyph({ categoryName: 'System prompt', fullness: 1 }), '⛁');
  assert.equal(contextCellGlyph({ categoryName: 'System prompt', fullness: 0.2 }), '⛀');
  assert.equal(contextCellGlyph({ categoryName: FREE_SPACE, fullness: 1 }), '⛶');
  assert.equal(contextCellGlyph({ categoryName: AUTOCOMPACT_BUFFER, fullness: 1 }), '⛝');
});

test('the panel text renders the legend, the free-space form and every glyph row', () => {
  const usage = contextUsageFromCounts({ model: 'model-a', systemTokens: 1000, toolTokens: 2000,
    messageTokens: 3000, maxTokens: 1_000_000, compactAt: 512_000, autoCompact: true });
  const lines = contextPanelText(usage).split('\n');
  assert.deepEqual(lines.slice(0, 3), ['Context Usage', 'model-a', '6k/1m tokens (1%)']);
  assert.equal(lines[4], 'Estimated usage by category');
  assert.equal(lines[5], '⛁ System prompt: 1k tokens (0.1%)');
  assert.equal(lines[6], '⛁ System tools: 2k tokens (0.2%)');
  assert.equal(lines[7], '⛁ Messages: 3k tokens (0.3%)');
  assert.equal(lines[8], '⛝ Autocompact buffer: 488k tokens (48.8%)');
  assert.equal(lines[9], '⛶ Free space: 506k (50.6%)');
  assert.equal(lines[10], '');
  assert.equal(lines.length, 11 + 10);
  assert.match(lines[11]!, /^⛀ ⛀ ⛀ ⛶/);
});
