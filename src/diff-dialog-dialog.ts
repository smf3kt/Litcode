// The diff dialog (W173). Copied bodies live in ./diff-dialog-dialog-source.ts: 6 blocks, 8,741
// UTF-16 units across two modules. `si` is the dialog component; it renders the frame `_e` with the
// tab strip `sS`, the file list `K` (row `oe`, stat cell `le`, row wrapper `Vt`) and the detail view
// `pBe`, and scrolls the detail through `pee`.
//
// Ranges and module digests are recorded in ./diff-dialog-dialog-source-blocks.json and
// research/ports/W173-dialog.md. Host bindings live in ./diff-dialog-dialog-host.ts.
import { si } from './diff-dialog-dialog-source.js';
import type { SurfaceElement } from './plugin-chain-react-hooks.js';
import type { TurnDiffMessage } from './diff-turn.js';

export {
  DiffDataContext as DiffDialogDataContext,
  EMPTY_DIFF_DIALOG_DATA,
  type DiffDialogData,
} from './diff-dialog-dialog-host.js';

/**
 * The dialog's props. `messages` is the session message list the turn sources come from; `onDone`
 * receives the dismissal text and its display options.
 */
export interface DiffDialogProps {
  messages: readonly TurnDiffMessage[];
  onDone: (message: string, options?: { display?: string }) => void;
}

/** Source `si`: the diff dialog. */
export function DiffDialog(props: DiffDialogProps): SurfaceElement {
  return si(props as never) as SurfaceElement;
}

/** The copied bodies under their source names. */
export const SOURCE_BODIES = { si };
