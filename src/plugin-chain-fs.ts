// The `$` call table's filesystem floor (W45-46): the five entries a plugin reaches the filesystem
// through. The copied bodies live in ./plugin-chain-fs-source.ts; this module is the host seam around
// them.
//
// Source: the entries of the plugin-method table `Iqo(state)` (chunk-sfn1dbxq.js, its literal opened
// by `var Iqo=(e)=>szt({…})` at [2346570,…)), taken verbatim, chunk-sfn1dbxq.js:
//
//   "fs.read":hzt                                               [2353753,2353766)  13 units
//   "fs.write":_zt                                              [2353767,2353781)  14 units
//   "fs.list":gzt                                               [2353782,2353795)  13 units
//   "fs.exists":{check:XAt,raise:IE,run:(n,r)=>HE({event:      [2353796,2353905) 109 units
//     "exists",path:n.path},r.plugin,r.cwd).then((s)=>s===!0)}
//   "fs.stat":yzt                                               [2353906,2353919)  13 units
//
// Four of the five are named vars in the source's own scope, so the table line names the entry and the
// entry is copied whole; `fs.exists` is an inline object and so is ported here, as the arrow above,
// with the key the source gives it. Every entry carries the same three fields the dispatcher reads:
// `check` refuses the argument with a text, `raise` is the descriptor the site is built from, and
// `run` is the floor — `HE` with the event, the caller's plugin name and the caller's cwd.
//
// What the ported bodies do, all measured from the source:
//  · `HE` resolves the path against the caller's cwd (or the process's), refuses a location the
//    policy says is not reached from here, and then runs one of five events. `read` opens the file
//    (`O_RDONLY|O_NONBLOCK` on POSIX, `"r"` on Windows), reads in 64 KiB chunks until end of file or
//    a Non-Blocking `EAGAIN`/`EWOULDBLOCK`, refuses past `cGe` (4 MiB) with the byte count in the
//    text, and answers the bytes as base64 for `as:"bytes"` or as UTF-8 text otherwise. `write`
//    refuses text over `C3` (4 MiB), makes the directory, and writes UTF-8. `exists` is a stat that
//    answers false instead of throwing. `stat` lstats, and when the path is a symbolic link whose
//    target is not itself a refused location, stats the link's target instead — answering the target's
//    kind, size and mtime, `isLink` true, and `realPath` when the caller asked to resolve. `list`
//    reads the directory with its entry kinds, stats each non-directory entry for its size and mtime,
//    and sorts by name.
//  · A refusal or a failure is a `He` whose text names the plugin, the event, the path and the reason;
//    the same line goes to the log sink under `$.fs.${event} (${plugin})`.
//
// This package binds five table names: fs.read, fs.write, fs.list, fs.exists and fs.stat. The rest of
// the table's filesystem family is not here: `fs.ancestors` (`mzt`, chunk-sfn1dbxq.js
// [1849518,1849976) 458 units) walks the roots the tool context holds (`fzt`, `pzt`, `RCn`, `cLo`),
// which this product does not carry, and its check `kNs` (chunk-tvdq3hrk.js [11564,12056) 492 units)
// is copied only when that entry lands.
import { raiseHostCall, type HostCallBottom, type HostCallCaller } from './plugin-chain-host-call.js';
import { HE, IE, XAt, ANs, CNs, gzt, hzt, yzt, _zt } from './plugin-chain-fs-source.js';

/** The caller an fs call carries: the dispatcher's caller plus the `cwd` every entry resolves its
 *  path against (`n.cwd` in the entries, `e.cwd` in the raise descriptor). */
export type FsCallCaller = HostCallCaller & { cwd?: string };

/** One table entry as the `$` dispatcher reads it: the `check`, the `raise` descriptor and the run. */
export type FsCallEntry = HostCallBottom & { raise?: unknown };

/** The filesystem names this package's table slice holds. */
export type FsCallEvent = 'fs.read' | 'fs.write' | 'fs.list' | 'fs.exists' | 'fs.stat';

/** The argument an fs entry reads: `path` on every one, plus `as` for read, `text` for write and
 *  `resolve` for stat. */
export type FsCallArgs = {
  path?: string;
  as?: 'text' | 'bytes';
  text?: string;
  resolve?: boolean;
};

/** The `fs.exists` entry's own run, ported from the inline object above: the existence probe's answer
 *  narrowed to a boolean. */
const existsRun = (n: FsCallArgs, r: FsCallCaller): Promise<boolean> =>
  HE({ event: 'exists', path: n.path }, r.plugin, r.cwd).then((s) => s === true) as Promise<boolean>;

/** The filesystem slice, ported verbatim from the source's literal above. */
export function fsCallTable(): Record<FsCallEvent, FsCallEntry> {
  return {
    'fs.read': hzt as FsCallEntry,
    'fs.write': _zt as FsCallEntry,
    'fs.list': gzt as FsCallEntry,
    'fs.exists': { check: XAt, raise: IE, run: existsRun as FsCallEntry['run'] },
    'fs.stat': yzt as FsCallEntry,
  } as Record<FsCallEvent, FsCallEntry>;
}

/** Raise one `$` fs call the way the plugin-method dispatcher does: `{event, args, caller, bottom}`,
 *  with the table's entry for the name as the floor, so a plugin's hooks may answer first and `next()`
 *  reaches the floor. The entry's own `raise` descriptor stays on the entry, as the literal holds it. */
export async function raiseFsCall(request: {
  event: FsCallEvent;
  args: unknown;
  caller: FsCallCaller;
  raise?: unknown;
}): Promise<unknown> {
  return raiseHostCall({
    event: request.event,
    args: request.args,
    caller: request.caller,
    bottom: fsCallTable()[request.event],
    raise: request.raise,
  });
}

/** Source `IE`: the descriptor an fs entry raises a refused path with — the field `path`, at the
 *  caller's cwd or, when it gave none, the process's own. */
export function fsRaiseDescriptor(caller: { cwd?: string }): unknown {
  return IE(caller);
}

/** Source `XAt`: the text an fs entry refuses a path with, or `undefined`. */
export function fsPathRefusal(args: unknown): string | undefined {
  return XAt(args);
}

/** Source `ANs`: the `fs.read` check — the path, then `as` being `"text"` or `"bytes"`. */
export function fsReadRefusal(args: unknown): string | undefined {
  return ANs(args);
}

/** Source `CNs`: the `fs.stat` check — the path, then `resolve` being a boolean. */
export function fsStatRefusal(args: unknown): string | undefined {
  return CNs(args);
}

/** Source `HE`: run one filesystem event directly, the way an entry's run does. */
export function runFsEvent(
  request: { event: 'read' | 'write' | 'list' | 'exists' | 'stat'; path?: string; as?: 'text' | 'bytes'; text?: string; resolve?: boolean },
  plugin: string,
  cwd?: string,
): Promise<unknown> {
  return HE(request, plugin, cwd);
}
