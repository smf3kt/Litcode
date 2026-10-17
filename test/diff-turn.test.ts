import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  TurnDiffAccumulator, countTurnHunkLines, isCreatedOrUpdatedResult, isTurnDiffResult,
  settleTurnStats, turnPromptPreview, turnSource, turnToDiffData,
  type TurnDiff, type TurnDiffMessage,
} from '../src/diff-turn.js';

const prompt = (text: string): TurnDiffMessage => ({ type: 'user', message: { content: text } });
const tool = (toolUseResult: unknown): TurnDiffMessage => ({
  type: 'user', message: { content: [{ type: 'tool_result' }] }, toolUseResult,
});

test('the prompt preview keeps 30 characters and ellipsizes the rest', () => {
  assert.equal(turnPromptPreview(prompt('123456789012345678901234567890')), '123456789012345678901234567890');
  assert.equal(turnPromptPreview(prompt('1234567890123456789012345678901')), '12345678901234567890123456789…');
  assert.equal(turnPromptPreview({ type: 'assistant', message: { content: 'x' } }), '');
  assert.equal(turnPromptPreview({ type: 'user', message: { content: [{ type: 'text' }] } }), '');
});

test('turn diff results and create/update types are recognized', () => {
  assert.equal(isTurnDiffResult({ filePath: 'a.ts', structuredPatch: [{}] }), true);
  assert.equal(isTurnDiffResult({ filePath: 'a.ts', type: 'create', content: 'x' }), true);
  assert.equal(isTurnDiffResult({ filePath: 'a.ts' }), false);
  assert.equal(isTurnDiffResult(null), false);
  assert.equal(isCreatedOrUpdatedResult({ type: 'create' }), true);
  assert.equal(isCreatedOrUpdatedResult({ type: 'update' }), true);
  assert.equal(isCreatedOrUpdatedResult({ type: 'read' }), false);
});

test('hunk lines count plus and minus prefixes only', () => {
  assert.deepEqual(countTurnHunkLines([
    { oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: [' ctx', '+add', '-del'] },
    { oldStart: 5, oldLines: 1, newStart: 5, newLines: 1, lines: ['+second'] },
  ]), { added: 2, removed: 1 });
});

test('messages accumulate into turns newest first with update and create results', () => {
  const messages: TurnDiffMessage[] = [
    prompt('first prompt'),
    tool({ filePath: 'a.ts', type: 'update', structuredPatch: [
      { oldStart: 1, oldLines: 1, newStart: 1, newLines: 2, lines: [' ctx', '+add', '-del'] },
    ] }),
    prompt('second prompt'),
    tool({ filePath: 'b.ts', type: 'create', content: 'l1\nl2' }),
    prompt('third prompt'),
  ];
  const turns = new TurnDiffAccumulator().update(messages);
  assert.deepEqual(turns.map((turn) => turn.turnIndex), [2, 1]);
  const [second, first] = turns;
  assert.equal(first?.userPromptPreview, 'first prompt');
  assert.deepEqual(first?.stats, { filesChanged: 1, linesAdded: 1, linesRemoved: 1 });
  assert.deepEqual(first?.files.get('a.ts'), {
    filePath: 'a.ts', hunks: [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 2, lines: [' ctx', '+add', '-del'] }],
    isNewFile: false, linesAdded: 1, linesRemoved: 1,
  });
  assert.deepEqual(second?.files.get('b.ts'), {
    filePath: 'b.ts', hunks: [{ oldStart: 0, oldLines: 0, newStart: 1, newLines: 2, lines: ['+l1', '+l2'] }],
    isNewFile: true, linesAdded: 2, linesRemoved: 0,
  });
  assert.deepEqual(second?.stats, { filesChanged: 1, linesAdded: 2, linesRemoved: 0 });
});

test('the accumulator only walks messages added since the previous call', () => {
  const accumulator = new TurnDiffAccumulator();
  const head: TurnDiffMessage[] = [
    prompt('one'),
    tool({ filePath: 'a.ts', structuredPatch: [{ oldStart: 1, oldLines: 0, newStart: 1, newLines: 1, lines: ['+x'] }] }),
  ];
  const firstView = accumulator.update(head);
  assert.deepEqual(firstView.map((turn) => turn.turnIndex), [1]);
  const full = [...head, prompt('two'), tool({ filePath: 'c.ts', type: 'create', content: 'z' })];
  const secondView = accumulator.update(full);
  assert.deepEqual(secondView.map((turn) => turn.turnIndex), [2, 1]);
  assert.equal(secondView[1], firstView[0], 'the same open turn object is completed in place');
});

test('a shrinking message list resets the walk', () => {
  const accumulator = new TurnDiffAccumulator();
  accumulator.update([
    prompt('one'),
    tool({ filePath: 'a.ts', structuredPatch: [{ oldStart: 1, oldLines: 0, newStart: 1, newLines: 1, lines: ['+x'] }] }),
  ]);
  assert.deepEqual(accumulator.update([]), []);
});

test('meta and tool-result-only messages do not open a turn', () => {
  const accumulator = new TurnDiffAccumulator();
  const turn = { ...prompt('x'), isMeta: true };
  assert.deepEqual(accumulator.update([turn, { type: 'user', message: { content: [{ type: 'tool_result' }] } }]), []);
});

test('a turn converts to the dialog diff data shape', () => {
  const turn: TurnDiff = {
    turnIndex: 1,
    userPromptPreview: 'p',
    files: new Map([
      ['z.ts', { filePath: 'z.ts', hunks: [], isNewFile: false, linesAdded: 2, linesRemoved: 1 }],
      ['a.ts', { filePath: 'a.ts', hunks: [{ oldStart: 1, oldLines: 0, newStart: 1, newLines: 1, lines: ['+x'] }], isNewFile: true, linesAdded: 1, linesRemoved: 0 }],
    ]),
    stats: { filesChanged: 2, linesAdded: 3, linesRemoved: 1 },
  };
  const data = turnToDiffData(turn);
  assert.deepEqual(data.files.map((file) => file.path), ['a.ts', 'z.ts']);
  assert.deepEqual(data.stats, { filesCount: 2, linesAdded: 3, linesRemoved: 1 });
  assert.equal(data.loading, false);
  assert.deepEqual(data.source, { kind: 'working-tree' });
  assert.equal(data.baseMode, 'auto');
  assert.equal(data.files[0]?.isNewFile, true);
  assert.equal(data.hunks.get('z.ts')?.length, 0);
  assert.deepEqual(turnSource(turn), { type: 'turn', turn });
});

test('settling stats recomputes them from the file rows', () => {
  const turn: TurnDiff = {
    turnIndex: 1, userPromptPreview: '',
    files: new Map([
      ['a', { filePath: 'a', hunks: [], isNewFile: false, linesAdded: 4, linesRemoved: 2 }],
      ['b', { filePath: 'b', hunks: [], isNewFile: false, linesAdded: 1, linesRemoved: 0 }],
    ]),
    stats: { filesChanged: 0, linesAdded: 0, linesRemoved: 0 },
  };
  settleTurnStats(turn);
  assert.deepEqual(turn.stats, { filesChanged: 2, linesAdded: 5, linesRemoved: 2 });
});
