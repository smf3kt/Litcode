import type { QuestionHostResult } from './question-result.js';
import { questionResultLines } from './question-result.js';
import { s, n } from './tui-base-components.js';
import { jsx } from './tui-jsx.js';

// Nh/Dh/jh/F_, phg89898 [46633,48473)/[48525,48700), UTF-16.
export function QuestionResultRows({ result }: { result: QuestionHostResult }) {
  const [heading, ...lines] = questionResultLines(result);
  if (heading === undefined) return null;
  return jsx(s, { flexDirection: 'column', marginTop: 1, children: [
    jsx(s, { flexDirection: 'row', children: [
      jsx(n, { children: process.platform === 'darwin' ? '⏺ ' : '● ' }, 'marker'),
      jsx(n, { wrap: 'wrap', children: heading }, 'heading'),
    ] }, 'title'),
    jsx(s, { paddingLeft: 2, flexDirection: 'column', children: lines.map((line, index) =>
      jsx(n, { dimColor: true, wrap: 'wrap', children: line }, index)) }, 'answers'),
  ] }, undefined);
}
