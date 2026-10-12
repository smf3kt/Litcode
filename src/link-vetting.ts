// Link vetting for instruction imports.
//
// An instruction file that is a symlink can point anywhere, and the file a
// reader ends up with is not the file the path looked like. The recovered
// client vets the link chain before it treats such a file as instructions
// (chunk-pn44qc66.js, `async function On(e)` [11287, ...), with the bound
// `Un=32` declared at [11281, ...)), and three of its
// rules are worth keeping because they are about the link text rather than
// about the cloud session that module serves:
//
//   - every link body must be valid UTF-8, because a body that is not cannot be
//     interpreted as a path at all;
//   - a link body must not climb out of a directory it entered, so `docs/../x`
//     is refused even though it normalizes, while a leading `../` is not what
//     this rule is for; and
//   - the chain is bounded, at 32 hops on this surface, rather than followed
//     until it stops.
//
// Not ported from the same function: the send-or-don't-send verdict its caller
// derives from the chain (`symlink_not_sent`, `too_many_links`), which exists to
// decide what a cloud session may receive, and the `home_unvettable` and
// `outside_root` checks, which belong to that same handoff.

import fs from "node:fs";
import path from "node:path";

/** The recovered bound on this surface is its own local, `Un=32`. */
export const LINK_VET_HOP_LIMIT = 32;

export type LinkVetReason = "not-utf8" | "climbs-out" | "cycle" | "too-long";

export class LinkVetError extends Error {
  readonly reason: LinkVetReason;
  constructor(reason: LinkVetReason, message: string) {
    super(message);
    this.name = "LinkVetError";
    this.reason = reason;
  }
}

/** The separator set the link body is split on, so `\` counts on every platform. */
const SEPARATORS = /[\\/]+/;

/**
 * True when a link body enters a directory and then climbs back out of it. The
 * leading `..` segments are not what this rule is about - a link that is simply
 * relative is fine - so the flag is only raised once a real component has been
 * seen. This is the recovered `$n` [12206, ...) exactly.
 */
export function linkBodyClimbsOut(body: string): boolean {
  let entered = false;
  for (const part of body.split(SEPARATORS)) {
    if (part === "..") {
      if (entered) return true;
    } else if (part !== "" && part !== ".") {
      entered = true;
    }
  }
  return false;
}

/**
 * Refuse a file whose link chain breaks one of the rules above. A file that is
 * not a link, or whose chain ends at something that is not a link, passes; a
 * path that does not exist passes too, so the caller keeps deciding what a
 * missing file means.
 */
export function vetLinkChain(file: string): void {
  const seen = new Set<string>();
  let current = file;
  for (let hop = 0; hop < LINK_VET_HOP_LIMIT; hop += 1) {
    if (seen.has(current)) throw new LinkVetError("cycle", `link chain loops: ${file}`);
    seen.add(current);
    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      // A link that points at nothing is the caller's problem, not this one.
      if (code === "ENOENT" || code === "ENOTDIR" || code === "EINVAL") return;
      throw error;
    }
    if (!stat.isSymbolicLink()) return;
    // The body is decoded fatally so a body that is not UTF-8 is refused as
    // such, rather than arriving as a path full of replacement characters.
    const raw = fs.readlinkSync(current, { encoding: "buffer" });
    let body: string;
    try {
      body = new TextDecoder("utf-8", { fatal: true }).decode(raw);
    } catch {
      throw new LinkVetError("not-utf8", `link body is not valid UTF-8: ${current}`);
    }
    if (linkBodyClimbsOut(body)) {
      throw new LinkVetError("climbs-out", `link body climbs out of a directory it entered: ${current}`);
    }
    current = path.resolve(path.dirname(current), body);
  }
  throw new LinkVetError("too-long", `link chain too long to vet: ${file}`);
}
