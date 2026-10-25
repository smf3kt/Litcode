import { fitForkRow, type ForkRowFields } from './fork-row.js';
import { cellWidth } from './terminal.js';
import { s, n } from './tui-base-components.js';
import { ke } from './tui-component-host.js';
import { jsx, Fragment } from './tui-jsx.js';

const FORK_GLYPH = '⑂';
const GUTTER = '  ⎿  ';

/** Up [112568,113022), chunk-phg89898.js: the first fork glyph has its own accessibility label. */
function ForkName({ children }: { children: string }) {
  const index = children.indexOf(FORK_GLYPH);
  if (index === -1) return children;
  return jsx(Fragment, { children: [children.slice(0, index),
    jsx(n, { 'aria-label': 'of', children: FORK_GLYPH }, 'fork'),
    children.slice(index + FORK_GLYPH.length)] }, undefined);
}

/** Ip [113052,114313), chunk-phg89898.js. No live attach owner, so retain the id and omit hover. */
export function ForkRow({ fields }: { fields: ForkRowFields }) {
  const { columns } = ke();
  const row = fitForkRow(fields, columns - cellWidth(GUTTER), false);
  const primary = row.name ?? row.id;
  const both = row.name !== undefined && row.id !== undefined;
  return jsx(s, { flexDirection: 'row', children: [
    jsx(n, { 'aria-label': 'fork:', dimColor: true, children: GUTTER }, 'gutter'),
    jsx(n, { children: [
      jsx(n, { dimColor: true, children: [row.state,
        (primary !== undefined || both || row.chips.length > 0) && ' · '] }, 'state'),
      primary !== undefined && jsx(n, { bold: true,
        children: jsx(ForkName, { children: primary }, undefined) }, 'primary'),
      both && jsx(n, { dimColor: true, children: ' · ' + row.id }, 'id'),
      row.chips.length > 0 && jsx(n, { dimColor: true, children: ' · ' + row.chips.join(' · ') }, 'chips'),
    ] }, 'body'),
  ] }, undefined);
}
