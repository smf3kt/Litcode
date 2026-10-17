import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runComponent } from '../src/plugin-chain-react-hooks.js';
import { eE } from '../src/plugin-chain-markdown-host.js';
import { Zm } from '../src/plugin-chain-input-field-source.js';
import { a } from '../src/diff-dialog-spinner-host.js';
import { SpinnerSettings } from '../src/diff-dialog-spinner-host.js';
import { d, f, l, p, T, Vdn } from '../src/diff-dialog-spinner-frames-source.js';
import {
  FRAME_QUANTUM, FRAME_SETS, REPAINT_FLOOR, Spinner, SpinnerMessage,
  frameSetForTerminal, isVisibleInViewport, reducedMotionSelector, repaintInterval, spinnerFrames,
  useAnimationFrame,
} from '../src/diff-dialog-spinner.js';

interface SurfaceNode {
  type: unknown;
  props: Record<string, unknown>;
  children: unknown[];
}

function isNode(value: unknown): value is SurfaceNode {
  return typeof value === 'object' && value !== null && 'type' in value && 'props' in value;
}

function textOf(node: unknown): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isNode(node)) return textOf(node.props.children);
  return '';
}

function findAll(node: unknown, type: unknown, out: SurfaceNode[] = []): SurfaceNode[] {
  if (Array.isArray(node)) {
    for (const child of node) findAll(child, type, out);
    return out;
  }
  if (!isNode(node)) return out;
  if (node.type === type) out.push(node);
  findAll(node.props.children, type, out);
  return out;
}

function spinnerClock(now: number) {
  const clock = {
    now: () => now,
    setTimeout: () => () => {},
    subscribeKeepAlive: () => () => {},
  };
  return clock;
}

function frameAt(now: number, interval = 120): string {
  const run = runComponent(
    () => Spinner(),
    { contexts: new Map<unknown, unknown>([[eE, spinnerClock(now)]]) },
  );
  const box = run.result as SurfaceNode;
  const text = findAll(box, 'Text')[0];
  const value = textOf(box);
  run.unmount();
  return String(value);
}

test('the reduced-motion selector reads the setting', () => {
  assert.equal(reducedMotionSelector({ settings: { prefersReducedMotion: true } }), true);
  assert.equal(reducedMotionSelector({ settings: { prefersReducedMotion: false } }), false);
});

test('the frame quantum and the repaint floor are the source constants', () => {
  assert.equal(FRAME_QUANTUM, 16);
  assert.equal(REPAINT_FLOOR, 480);
  assert.equal(repaintInterval(120), 120);
  const previous = a.CLAUDE_CODE_ALT_SCREEN_FULL_REPAINT;
  a.CLAUDE_CODE_ALT_SCREEN_FULL_REPAINT = true;
  try {
    assert.equal(repaintInterval(120), 480);
    assert.equal(repaintInterval(600), 600);
  } finally {
    a.CLAUDE_CODE_ALT_SCREEN_FULL_REPAINT = previous;
  }
});

test('the frame sets are the alternating cycles', () => {
  assert.deepEqual(d, [...l, ...l.toReversed()]);
  assert.deepEqual(f, [...p, ...p.toReversed()]);
  assert.deepEqual(FRAME_SETS.cycles, d);
  assert.deepEqual(FRAME_SETS.cyclesAlt, f);
  assert.deepEqual(FRAME_SETS.plain, T);
  assert.deepEqual(frameSetForTerminal(), p);
});

test('the frame picker follows the terminal environment', () => {
  const previous = a.TERM;
  try {
    a.TERM = 'xterm-ghostty';
    assert.equal(Vdn(), l);
    assert.equal(spinnerFrames(), d);
    a.TERM = 'xterm-256color';
    assert.equal(spinnerFrames(), f);
  } finally {
    a.TERM = previous;
  }
});

test('the spinner renders the single dot under reduced motion', () => {
  const run = runComponent(
    () => Spinner(),
    {
      contexts: new Map<unknown, unknown>([
        [SpinnerSettings, { settings: { prefersReducedMotion: true } }],
      ]),
    },
  );
  const box = run.result as SurfaceNode;
  assert.equal(box.type, 'Box');
  assert.equal(box.props['aria-hidden'], true);
  assert.equal(textOf(box), '●');
  run.unmount();
});

test('the spinner renders the quantized animation frame without reduced motion', () => {
  const previous = a.TERM;
  a.TERM = 'xterm-256color';
  try {
    const frames = spinnerFrames();
    // The clock is quantized to a 128 ms grid (120 ms rounded to the 16 ms quantum) and the spinner
    // divides that by 120 ms, so 1000 ms lands on frame 7 of the cycle.
    const expected = frames[Math.floor(896 / 120) % frames.length];
    assert.equal(frameAt(1000), expected);
    assert.equal(frameAt(128), frames[Math.floor(128 / 120) % frames.length]);
    assert.equal(frameAt(127), frames[Math.floor(0 / 120) % frames.length]);
  } finally {
    a.TERM = previous;
  }
});

test('the animation clock pauses on a null interval and under a hidden node', () => {
  const clock = spinnerClock(1000);
  const paused = runComponent(
    () => useAnimationFrame(null),
    { contexts: new Map<unknown, unknown>([[eE, clock]]) },
  );
  assert.equal(paused.result[1], 0);
  paused.unmount();

  const missingClock = runComponent(() => useAnimationFrame(120), { contexts: new Map() });
  assert.equal(missingClock.result[1], 0);
  missingClock.unmount();
});

test('a node hidden below the viewport rows is not visible', () => {
  const yoga = (top: number, height: number) => ({
    getComputedTop: () => top,
    getComputedHeight: () => height,
  });
  const viewport = { rows: 24, columns: 80 };
  const visible = { yogaNode: yoga(0, 1), parentNode: null, style: {} };
  const hidden = { yogaNode: yoga(30, 1), parentNode: null, style: {} };
  assert.equal(isVisibleInViewport(visible, viewport), true);
  assert.equal(isVisibleInViewport(hidden, viewport), false);
  assert.equal(isVisibleInViewport(null, viewport), null);
  assert.equal(isVisibleInViewport(visible, null), null);
});

test('the remeasure closure returns the initial visibility for an unbound ref', () => {
  const clock = spinnerClock(1000);
  const run = runComponent(
    () => useAnimationFrame(120),
    {
      contexts: new Map<unknown, unknown>([
        [eE, clock],
        [Zm, { rows: 24, columns: 80 }],
      ]),
    },
  );
  assert.equal(typeof run.result[0], 'function');
  assert.ok(run.result[1] > 0);
  run.unmount();
});

test('the message renders the spinner, the text and an optional dim subtitle', () => {
  const plain = runComponent(
    () => SpinnerMessage({ message: 'working' }),
    { contexts: new Map<unknown, unknown>([[eE, spinnerClock(0)]]) },
  );
  const column = plain.result as SurfaceNode;
  assert.equal(column.type, 'Box');
  assert.equal(column.props.flexDirection, 'column');
  const text = findAll(column, 'Text');
  assert.equal(text.length, 1);
  assert.equal((text[0].props.children as unknown[])[1], 'working');
  plain.unmount();

  const withSubtitle = runComponent(
    () => SpinnerMessage({ message: 'working', bold: true, dimColor: true, subtitle: 'step 2' }),
    { contexts: new Map<unknown, unknown>([[eE, spinnerClock(0)]]) },
  );
  const texts = findAll(withSubtitle.result, 'Text');
  assert.equal(texts.length, 2);
  assert.equal(texts[0].props.bold, true);
  assert.equal(texts[0].props.dimColor, true);
  assert.equal(texts[1].props.dimColor, true);
  assert.equal(texts[1].props.children, 'step 2');
  withSubtitle.unmount();
});
