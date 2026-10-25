/**
 * The `/fork` row: its grammar, its name and its width fitting.
 *
 * Recovered bodies, all zero-based half-open UTF-16 code units:
 *
 * - `Bcn` (chunk-t721xmjm.js [47101,47446), sha256
 *   `c88d190d4b973f293465e812bffa970b235dcf6b7f2e12525af0551168a2cb26`): the row text back into
 *   `{state, name, id, chips}`. The state must be one of the two recovered labels, a multi-line
 *   text is not a row, the id is the last eight-hex segment and everything before it is the name.
 * - `RMr` (same module [47446,47819)): the fitting ladder. A row that does not fit first collapses
 *   `session waiting for a prompt` to `session waiting`, then drops the id when the row is
 *   clickable, then clips the name to at least `gn` cells.
 * - `gft`'s `at` (chunk-24k7d6mw.js 38766): the copy's name, the parent's name and the fork glyph
 *   plus the prompt, or the glyph and prompt alone.
 * - `Nr` (chunk-ax7r0qj7.js [5245,5312)) and `TMr`/`UKn` (chunk-t721xmjm.js [46946,47911)).
 *
 * Adapted, with the reason: the source's `ps` is its general secret redactor; this host's
 * equivalent surface is `redactCredentialShapes`. The source fits the row to `columns - Yy` where
 * `Yy` is the width of its own `  ⎿  ` gutter (`Ip`, chunk-phg89898.js [113052,114313)); this
 * host frames a system row with `- ` instead, so the caller passes its own prefix width. The
 * React row component's bold/dim styling, its hover underline and its attach click are not
 * modelled here: the host has no attach owner for a background session.
 */
import { cellWidth } from './terminal.js';
import { clipEnd } from './tui-autocomplete.js';
import { redactCredentialShapes } from './credential-shapes.js';
import { forkSessionLine } from './fork-command.js';

/** `Ucn`/`rFt`/`Xr` (chunk-t721xmjm.js 46831/46853/46888): the two labels and the short one. */
export const FORK_STATE_RUNNING = 'session running';
export const FORK_STATE_WAITING_PROMPT = 'session waiting for a prompt';
export const FORK_STATE_WAITING = 'session waiting';

/** `_e` (chunk-t721xmjm.js 46909): the row's separator. */
const ROW_SEPARATOR = ' · ';

/** `Yr` (chunk-t721xmjm.js 46921): a short session id. */
const SHORT_ID = /^[0-9a-f]{8}$/;

/** `gn` (chunk-t721xmjm.js 46940): the narrowest a clipped name may become. */
const MIN_NAME_CELLS = 20;

/** `OR` (chunk-3cynezh1.js 65963): the fork glyph. */
const FORK_GLYPH = '⑂';

/** `Wse` (chunk-ax7r0qj7.js 5182): the control range `Nr` strips. */
const CONTROL = /[\x00-\x08\x0e-\x1f\x7f-\x9f]/g;

export type ForkRowFields = {
  state: string;
  name?: string;
  id?: string;
  chips: readonly string[];
};

/** `Nr`: strip the C0/C1 range outside tab and newline, collapse whitespace, trim. */
export function forkRowText(text: string): string {
  return text.replace(CONTROL, '').replace(/\s+/g, ' ').trim();
}

/** `ne` (chunk-ax7r0qj7.js 1128): cut at UTF-16 units without splitting a surrogate pair. */
function cutUnits(text: string, max: number): string {
  if (max <= 0) return '';
  if (text.length <= max) return text;
  const head = text.slice(0, max);
  const last = head.charCodeAt(max - 1);
  return last >= 0xd800 && last <= 0xdbff ? head.slice(0, -1) : head;
}

/** `gft`'s `at`: `parent ⑂ prompt`, `⑂ prompt`, or nothing when neither part exists. */
export function forkCopyName(parent: string | undefined, prompt: string): string {
  const detail = cutUnits(redactCredentialShapes(forkRowText(prompt ?? '')), 60);
  const head = parent === undefined ? '' : forkRowText(redactCredentialShapes(parent));
  if (head !== '') return `${head} ${FORK_GLYPH}${detail ? ` ${detail}` : ''}`;
  return detail ? `${FORK_GLYPH} ${detail}` : '';
}

/**
 * `Ue`'s `de`: the name as the row shows it. `TMr` splits on the glyph and rejoins the parts with
 * the row separator, so a parent name and a prompt read as two segments.
 */
export function forkRowName(name: string): string | undefined {
  const parts = redactCredentialShapes(forkRowText(name)).split(FORK_GLYPH)
    .map(part => part.trim()).filter(Boolean);
  if (parts.length === 0) return undefined;
  const [head, ...rest] = parts;
  return rest.length === 0 ? head : `${head} ${FORK_GLYPH} ${rest.join(ROW_SEPARATOR)}`;
}

/** `Bcn`: the row text back into fields, or null when the text is not a fork row. */
export function forkRowFields(text: string): ForkRowFields | null {
  if (!text.startsWith(FORK_STATE_RUNNING) && !text.startsWith(FORK_STATE_WAITING_PROMPT)) return null;
  if (text.includes('\n')) return null;
  const parts = text.split(ROW_SEPARATOR);
  const state = parts[0];
  if (state !== FORK_STATE_RUNNING && state !== FORK_STATE_WAITING_PROMPT) return null;
  const idIndex = parts.findLastIndex(part => SHORT_ID.test(part));
  const id = idIndex === -1 ? undefined : parts[idIndex];
  const nameParts = parts.slice(1, idIndex === -1 ? parts.length : idIndex);
  const chips = idIndex === -1 ? [] : parts.slice(idIndex + 1);
  return { state: state!, ...(nameParts.length > 0 ? { name: nameParts.join(ROW_SEPARATOR) } : {}),
    ...(id === undefined ? {} : { id }), chips };
}

/**
 * `RMr`: fit the row into `columns`. `attachAvailable` is the source's third parameter, whether the
 * row can be clicked to attach the copy; the host has no such owner, so its callers pass false and
 * the id is never dropped.
 */
export function fitForkRow(fields: ForkRowFields, columns: number, attachAvailable = false): ForkRowFields {
  // `UKn`, already ported as `forkSessionLine`: the row is the state, the name, the id and the chips.
  const width = (row: ForkRowFields): number => cellWidth(forkSessionLine(row));
  let row: ForkRowFields = { ...fields, chips: [...fields.chips] };
  if (width(row) <= columns) return row;
  if (row.state === FORK_STATE_WAITING_PROMPT) {
    row = { ...row, state: FORK_STATE_WAITING };
    if (width(row) <= columns) return row;
  }
  if (row.id !== undefined && row.name !== undefined && attachAvailable) {
    row = { ...row, id: undefined };
    if (width(row) <= columns) return row;
  }
  if (row.name !== undefined) {
    const withoutName = width({ ...row, name: undefined });
    const room = columns - withoutName - cellWidth(ROW_SEPARATOR);
    const nameCells = cellWidth(row.name);
    const budget = nameCells > MIN_NAME_CELLS ? Math.max(room, MIN_NAME_CELLS) : room;
    if (budget >= 1 && budget < nameCells) row = { ...row, name: clipEnd(row.name, budget) };
  }
  return row;
}
