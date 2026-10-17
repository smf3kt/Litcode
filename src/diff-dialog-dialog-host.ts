// The diff dialog's host bindings (W173).
//
//   - `Ht` (chunk-qr9z1wer.js sha256 7c4094d82563f8ebbee3405c7ba3cdb48d5eb7701e274c48c111eb1aefc587a3,
//     [1303,1342) 39u, body 44668f063e24edb161db9540bcb530e71f24e1f78921432706ec53837c4ecf3c,
//     `function Ht(){return jn()||vr()!==null}`) asks whether this is a remote/cloud session or a
//     control channel is attached. This build keeps local features only, binds no remote session or
//     control channel, and therefore answers false.
//   - `PMr` (chunk-xmvfy87k.js sha256 fabe23b454accb5fcb9390965e13cd815400518e90b86cb9550d55aae113ade0,
//     [5796,5868) 72u, body 82a6fec62394fd5ed976da67030af3c5377737c4def9f0738fc3911046b26302,
//     `function PMr(t){let r=WKn(0,!t),o=me(t);return
//     t?o:{data:r,notice:null}}`) selects the remote workspace-diff hook when `Ht()` is true and the
//     local git-diff hook otherwise. The local branch is W163's `GitDiffDataController` already
//     adapted in ./git-diff-data.ts; a host binds its current view through `DiffDataContext`, and
//     the notice is null on the local path.
//   - `ne` (chunk-twzxjzbk.js [18642,20073) 1,431u) is the source memo hook. W164 adapted it to
//     `TurnDiffAccumulator`; the host `ne` feeds the whole message list through a fresh accumulator,
//     which returns the same completed-turn list the memo returns.
//   - `Fvn` (chunk-sfn1dbxq.js sha256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da,
//     [91100,91145) 45u, body 38218af13730b2db8d14645306d603d674d6b7dc2a3978c695975c5f48f6506d,
//     `function Fvn(e=KD){e.reachedScrollbackCap=!0}`) records a scrollback-cap telemetry fact.
//     Telemetry is a host no-op in this build, as in W170.
import { Ae, qt } from './plugin-chain-react-hooks.js';
import { buildGitDiffData, type GitDiffData } from './git-diff-data.js';
import { TurnDiffAccumulator, type TurnDiff, type TurnDiffMessage } from './diff-turn.js';

/** The dialog's data view: the local git-diff hook's value and its notice (always null locally). */
export interface DiffDialogData {
  data: GitDiffData;
  notice: string | null;
}

/** The view source `WKn(0, true)` starts from before its first collection settles. */
export const EMPTY_DIFF_DIALOG_DATA: DiffDialogData = {
  data: buildGitDiffData(null, { loading: true, enabled: true, baseMode: 'auto' }),
  notice: null,
};

/** The host binding for the local git-diff controller's current view. */
export const DiffDataContext = qt<DiffDialogData>(EMPTY_DIFF_DIALOG_DATA);

/** Source `Ht`: remote/cloud sessions and control channels are absent from this build. */
export function Ht(): boolean {
  return false;
}

/** Source `PMr`: the local branch returns the mounted git-diff view and a null notice. */
export function PMr(remote: boolean): DiffDialogData {
  if (remote) return EMPTY_DIFF_DIALOG_DATA;
  return Ae(DiffDataContext);
}

/** Source `ne` (W164 adaptation): the completed-turn list for the whole message list. */
export function ne(messages: readonly TurnDiffMessage[]): TurnDiff[] {
  return new TurnDiffAccumulator().update(messages);
}

/** Source `Fvn`: a telemetry counter, a no-op in this build. */
export function Fvn(): void {}
