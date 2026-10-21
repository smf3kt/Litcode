import { DEFAULT_EFFORT, EFFORT_LEVELS, MAX_EFFORT_NOTE, effortOverride, isEffortLevel,
  type EffortLevel } from './effort-command.js';
import type { TerminalPromptRequest } from './terminal.js';
import { s, n } from './tui-base-components.js';
import { jsx } from './tui-jsx.js';
import { fB } from './tui-input-highlights-source.js';

// chunk-76jkr621.js [18962,19717), UTF-16. Module SHA-256 and adaptations: W231.
const TRACK_WIDTH = 42;
const TRIANGLE_POSITIONS = [1, 10, 20, 30, 40];
const LABEL_SPACERS = [5, 5, 5, 6];
const LEVELS = [
  { value: 'low', label: 'low', color: 'warning' },
  { value: 'medium', label: 'medium', color: 'success' },
  { value: 'high', label: 'high', color: 'permission' },
  { value: 'xhigh', label: 'xhigh', color: 'autoAccept-shimmer' },
  { value: 'max', label: 'max', color: 'rainbow-animated' },
] as const;
const track = '─'.repeat(TRACK_WIDTH);
const labelStarts = LEVELS.map((_level, index) => LEVELS.slice(0, index)
  .reduce((start, level, previous) => start + level.label.length + LABEL_SPACERS[previous]!, 0));

/** Ot/Pt/he, chunk-76jkr621.js [20622,21789), UTF-16; frame replaces the owned React timer. */
function levelLabel(level: typeof LEVELS[number], selected: boolean, frame: number, reducedMotion: boolean): unknown {
  if (!selected) return jsx(n, { dimColor: true, children: level.label }, undefined);
  if (level.color === 'rainbow-animated') {
    const tick = reducedMotion ? 0 : frame;
    return jsx(n, { bold: true, children: [...level.label].map((letter, index) =>
      jsx(n, { color: fB(index + tick), children: letter }, index)) }, undefined);
  }
  if (level.color === 'autoAccept-shimmer') {
    const position = reducedMotion ? -100 : frame % (level.label.length + 4);
    return jsx(n, { bold: true, children: [...level.label].map((letter, index) => {
      const peak = index === position;
      const adjacent = index === position - 1 || index === position + 1;
      return jsx(n, { color: peak ? '#d0b4ff' : 'autoAccept', bold: peak || adjacent, children: letter }, index);
    }) }, undefined);
  }
  return jsx(n, { bold: true, color: level.color, children: level.label }, undefined);
}

/** It, chunk-76jkr621.js [22174,30123), UTF-16: caption, track, labels and max note. */
function renderSlider(value: string, frame: number, reducedMotion: boolean): unknown {
  const selected = isEffortLevel(value) ? value : DEFAULT_EFFORT;
  const index = EFFORT_LEVELS.indexOf(selected);
  const triangle = TRIANGLE_POSITIONS[index]!;
  const last = LEVELS.at(-1)!;
  const trailing = TRACK_WIDTH - (labelStarts.at(-1)! + last.label.length);
  const labels = LEVELS.flatMap((level, position) => [
    ...(position > 0 ? [jsx(n, { children: ' '.repeat(LABEL_SPACERS[position - 1]!) }, `space-${position}`)] : []),
    jsx(s, { children: levelLabel(level, position === index, frame, reducedMotion) }, level.value),
  ]);
  return jsx(s, { flexDirection: 'column', alignItems: 'center', width: '100%', children: [
    jsx(s, { flexDirection: 'column', width: TRACK_WIDTH, children: [
      jsx(s, { children: [jsx(n, { children: 'Faster' }, undefined),
        jsx(n, { children: ' '.repeat(TRACK_WIDTH - 6 - 7) }, undefined),
        jsx(n, { children: 'Smarter' }, undefined)] }, 'caption'),
      jsx(s, { children: [jsx(n, { dimColor: true, children: track.slice(0, triangle) }, undefined),
        jsx(n, { bold: true, children: '▲' }, undefined),
        jsx(n, { dimColor: true, children: track.slice(triangle + 1) }, undefined)] }, 'track'),
      jsx(s, { children: [...labels, trailing ? jsx(n, { children: ' '.repeat(trailing) }, 'tail') : null] }, 'labels'),
    ] }, 'scale'),
    selected === 'max' ? jsx(s, { children: jsx(n, { dimColor: true, children: MAX_EFFORT_NOTE }, undefined) }, 'note') : null,
  ] }, undefined);
}

/** Te/It/Ce, chunk-76jkr621.js [21789,30123), UTF-16, with local levels and no workflow toggle. */
export function effortSliderRequest(current: EffortLevel | undefined): TerminalPromptRequest {
  const override = effortOverride();
  const initial = override?.level === null ? DEFAULT_EFFORT : override?.level ?? current ?? DEFAULT_EFFORT;
  return {
    title: 'Effort', message: '',
    adjust: { kind: 'slider', values: EFFORT_LEVELS, initial, render: renderSlider,
      guide: 'Left/Right adjust / Enter confirm / s for this session only / Esc cancel' },
    keys: [{ key: 's', label: 'for this session only' }],
  };
}
