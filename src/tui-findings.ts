import type { SourceFinding } from './source-findings.js';
import { s, n } from './tui-base-components.js';
import { ke } from './tui-component-host.js';
import { jsx } from './tui-jsx.js';
import { cellWidth } from './terminal.js';

// Mn/yn/Kh, phg89898 [50896,50938)/[52785,53386), UTF-16.
function FindingMarker({ finding }: { finding: SourceFinding }) {
  const color = finding.outcome === 'fixed' ? 'success'
    : finding.verdict === 'CONFIRMED' ? 'error' : finding.verdict === 'PLAUSIBLE' ? 'warning' : undefined;
  return jsx(n, { color, children: finding.outcome === 'fixed' ? '✓' : '●' }, undefined);
}
function FindingSummary({ finding }: { finding: SourceFinding }) {
  const suffix = finding.outcome && finding.outcome !== 'fixed'
    ? jsx(n, { dimColor: true, children: ` [${finding.outcome === 'skipped' ? 'skipped' : 'no change needed'}]` }, undefined)
    : null;
  return jsx(n, { wrap: 'wrap', children: [finding.summary, suffix] }, undefined);
}

// ev/ov/Vh/Zh/eT, phg89898 [50767,50892)/[50939,50944)/[50945,52785), UTF-16.
// $e, rrrfrwjr [1610,2287), UTF-16; document ownership supplies the offscreen lifecycle.
export function FindingsRows({ findings, verbose }: { findings: readonly SourceFinding[]; verbose: boolean }) {
  const { columns } = ke();
  if (findings.length === 0) return null;
  const groups = new Map<string, SourceFinding[]>();
  for (const finding of findings) {
    const group = groups.get(finding.file) ?? [];
    group.push(finding);
    groups.set(finding.file, group);
  }
  const lineWidth = Math.max(0, ...findings.map(finding => finding.line === undefined ? 0 : String(finding.line).length));
  const categoryWidth = Math.min(24, Math.max(0, ...findings.map(finding => finding.category ? cellWidth(`[${finding.category}]`) : 0)));
  const wide = columns - 14 - (lineWidth > 0 ? lineWidth + 1 : 0) - (categoryWidth > 0 ? categoryWidth + 1 : 0) >= 16;
  return jsx(s, { flexDirection: 'row', overflowY: 'hidden', children: [
    jsx(n, { dimColor: true, children: '  ⎿  ' }, 'gutter'),
    jsx(s, { flexShrink: 1, flexGrow: 1, flexDirection: 'column', children: [...groups].map(([file, entries]) =>
      jsx(s, { flexDirection: 'column', children: [
        jsx(n, { color: 'suggestion', children: file }, 'file'),
        ...entries.map((finding, index) => jsx(s, { flexDirection: 'column', children: [
          wide ? jsx(s, { columnGap: 1, paddingLeft: 2, children: [
            jsx(s, { flexShrink: 0, children: jsx(FindingMarker, { finding }, undefined) }, 'marker'),
            lineWidth > 0 ? jsx(s, { flexShrink: 0, width: lineWidth, justifyContent: 'flex-end',
              children: jsx(n, { color: 'suggestion', children: finding.line }, undefined) }, 'line') : null,
            categoryWidth > 0 ? jsx(s, { flexShrink: 0, width: categoryWidth,
              children: jsx(n, { dimColor: true, children: finding.category ? `[${finding.category}]` : '' }, undefined) }, 'category') : null,
            jsx(s, { flexGrow: 1, children: jsx(FindingSummary, { finding }, undefined) }, 'summary'),
          ] }, 'row') : jsx(s, { paddingLeft: 2, children: jsx(n, { wrap: 'wrap', children: [
            jsx(FindingMarker, { finding }, 'marker'),
            finding.line === undefined ? null : jsx(n, { color: 'suggestion', children: ` ${finding.line}` }, 'line'),
            finding.category ? jsx(n, { dimColor: true, children: ` [${finding.category}]` }, 'category') : null,
            ' ', jsx(FindingSummary, { finding }, 'summary'),
          ] }, undefined) }, 'row'),
          verbose && jsx(s, { paddingLeft: 4,
            children: jsx(n, { dimColor: true, wrap: 'wrap', children: finding.failure_scenario }, undefined) }, 'scenario'),
        ] }, index)),
      ] }, file)) }, 'body'),
  ] }, undefined);
}
