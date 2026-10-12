import fs from "node:fs";

/**
 * Refuse the permission mode that skips every check when it would be skipping
 * them for a user who is not the one being protected.
 *
 * The bypass mode exists so a person can tell the harness to stop asking. It
 * stops meaning that when the process runs as root: the tools then write and
 * execute as the machine's owner rather than as the person who typed the
 * command, and a workspace-relative path is no longer a boundary between the
 * two. The recovered product refuses the mode outright in that situation
 * rather than warning, because a warning is read after the tools have run.
 *
 * Running as root inside a container is a different situation - there the
 * process is already the sandbox's owner and being root is the arrangement, not
 * an accident - so the refusal is for root *outside* a deliberate sandbox, and
 * the signals for "inside" are the container marker files Docker and Podman
 * leave behind plus an explicit environment opt-in for a sandbox that leaves
 * none.
 */

export const BYPASS_ROOT_REFUSAL =
  "--permission-mode bypass cannot be used with root/sudo privileges outside a container " +
  "for security reasons: the tools would run as the machine's owner rather than as you.";

export type RootProbe = {
  /** The effective user id, or undefined where the platform has none. */
  uid?: number | undefined;
  /** The environment the process was started with. */
  env?: NodeJS.ProcessEnv;
  /** Whether a file exists; injectable so the refusal is testable. */
  exists?: (file: string) => boolean;
};

/** Container marker files, and the opt-in for a sandbox that leaves none. */
export const CONTAINER_MARKERS: readonly string[] = ["/.dockerenv", "/run/.containerenv"];
export const SANDBOX_OPT_IN = "HARNESS_SANDBOX";

/**
 * Whether this process is root outside a deliberate sandbox.
 *
 * The uid is the whole test: a process that is root because someone ran `sudo`
 * and a login shell that is root are indistinguishable here and refused for the
 * same reason, so nothing needs to read the invoking account back out of the
 * environment. Platforms with no uid belong to no one and are not refused.
 */
export function isRootOutsideDeliberateSandbox(probe: RootProbe = {}): boolean {
  const uid = probe.uid ?? process.getuid?.();
  const env = probe.env ?? process.env;
  if (uid !== 0) return false;
  if (env[SANDBOX_OPT_IN] === "1") return false;
  const exists = probe.exists ?? fs.existsSync;
  for (const marker of CONTAINER_MARKERS) {
    try {
      if (exists(marker)) return false;
    } catch {
      // An unreadable marker is not evidence of a sandbox.
    }
  }
  return true;
}

export type BypassRequest = {
  /** The resolved permission mode, when one was chosen. */
  mode?: string | undefined;
};

/** Whether this configuration asks for the mode that skips every check. */
export function bypassRequested(request: BypassRequest | undefined): boolean {
  return request?.mode === "bypass";
}

export type BypassRefusal = { refused: true; message: string } | { refused: false };

/**
 * The decision, separated from the exit so a caller can report it before it
 * stops: a refusal that only exists as a process exit is one a test cannot
 * observe, and one a wrapper cannot explain.
 */
export function refuseBypassUnderRoot(
  request: BypassRequest | undefined,
  probe: RootProbe = {},
): BypassRefusal {
  if (!bypassRequested(request)) return { refused: false };
  if (!isRootOutsideDeliberateSandbox(probe)) return { refused: false };
  return { refused: true, message: BYPASS_ROOT_REFUSAL };
}
