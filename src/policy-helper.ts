import fs from 'node:fs';

// A managed-settings helper reads the machine's managed policy from outside the
// workspace, so its input can change while a session runs and can disappear or
// go bad between refreshes. The recovered client therefore keeps a small state
// machine around it: the helper's output governs while it is healthy, a static
// default payload governs when the helper fails and a default exists, the last
// successful output governs when it fails and no default exists, and a
// structurally invalid document is not a failure to fall back from at all - it
// is refused.
//
// This port keeps that local triangle. The recovered helper reads three
// mechanisms, `plist`, `hklm` and `file`; only the file mechanism is executable
// on this host, and remote consent plus remote refusal enforcement live in an
// external service, so both are out of scope here.

/** The only helper mechanism this runtime executes. */
export const POLICY_HELPER_MECHANISMS = ['file'] as const;

/** Reported when the helper read fails. */
export type PolicyHelperFailure = 'helper_failed' | 'policy_invalid';

export type PolicyHelperConfig = {
  /** Absolute path of the managed-policy document the helper reads. */
  path: string;
  /**
   * Static payload that governs while the helper is failing. A helper without
   * one retains its last successful output instead.
   */
  defaultPolicy?: unknown;
  /**
   * Rejects a well-formed document whose contents are still not a usable
   * managed policy. A document that fails this check is `policy_invalid`, the
   * recovered payload-refusal case, and is refused rather than replaced.
   */
  validate?: (policy: unknown) => string | undefined;
};

export type PolicyHelperOutput = {
  /** Which tier is governing: the helper's output or the static default. */
  serving: 'helper' | 'default';
  /** Parsed managed policy, or undefined when nothing governs yet. */
  policy: unknown;
  /** Warnings the caller should surface, in the order they occurred. */
  warnings: string[];
};

export type PolicyHelperRead =
  | { ok: true; policy: unknown }
  | { ok: false; failure: PolicyHelperFailure; reason: string };

/**
 * Read and classify one helper document.
 *
 * A missing or unreadable file, or one that is not JSON, is `helper_failed`:
 * the helper could not produce an answer, which is what the fallback tiers are
 * for. A readable document whose top level is not an object is `policy_invalid`
 * instead, and the recovered code refuses rather than degrading, so the two are
 * kept apart here as well.
 */
export function readPolicyHelper(path: string): PolicyHelperRead {
  let text: string;
  try { text = fs.readFileSync(path, 'utf8'); }
  catch (error) { return { ok: false, failure: 'helper_failed', reason: `policy helper is unreadable: ${error instanceof Error ? error.message : String(error)}` }; }
  let parsed: unknown;
  try { parsed = JSON.parse(text); }
  catch { return { ok: false, failure: 'helper_failed', reason: 'policy helper is not valid JSON' }; }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, failure: 'policy_invalid', reason: 'policy helper document must be a JSON object' };
  }
  return { ok: true, policy: parsed };
}

/**
 * The helper state machine.
 *
 * `refresh` is the only mutation: it reads once, applies the tier rules and
 * returns the warnings raised by this pass. A structural failure is reported and
 * remembered as `policy_invalid`; it never silently swaps in another tier.
 */
export class PolicyHelper {
  private serving: 'helper' | 'default';
  private policy: unknown;
  private lastFailure: PolicyHelperFailure | null = null;
  private announcedFailure: PolicyHelperFailure | null = null;

  constructor(private readonly config: PolicyHelperConfig) {
    this.serving = 'default';
    this.policy = config.defaultPolicy;
  }

  get state(): { serving: 'helper' | 'default'; policy: unknown; failure: PolicyHelperFailure | null } {
    return { serving: this.serving, policy: this.policy, failure: this.lastFailure };
  }

  refresh(): PolicyHelperOutput {
    const warnings: string[] = [];
    let read: PolicyHelperRead = readPolicyHelper(this.config.path);
    if (read.ok && this.config.validate) {
      const problem = this.config.validate(read.policy);
      if (problem !== undefined) read = { ok: false, failure: 'policy_invalid', reason: problem };
    }
    if (read.ok) {
      if (this.serving === 'default' && this.announcedFailure !== null) {
        warnings.push('policy helper recovered; its output replaces the static default settings payload');
      }
      this.serving = 'helper';
      this.policy = read.policy;
      this.lastFailure = null;
      this.announcedFailure = null;
      return { serving: this.serving, policy: this.policy, warnings };
    }
    const changed = this.announcedFailure !== read.failure;
    this.lastFailure = read.failure;
    this.announcedFailure = read.failure;
    if (read.failure === 'helper_failed' && this.config.defaultPolicy !== undefined) {
      if (changed) warnings.push(`policy helper refresh failed (${read.reason}); applying the static default settings payload`);
      this.serving = 'default';
      this.policy = this.config.defaultPolicy;
      return { serving: this.serving, policy: this.policy, warnings };
    }
    if (read.failure === 'helper_failed') {
      if (changed) warnings.push(`policy helper refresh failed (${read.reason}); the last successful output still governs`);
      return { serving: this.serving, policy: this.policy, warnings };
    }
    // A structurally invalid document is refused rather than replaced, so the
    // tier that was governing before the bad document appeared is left alone.
    if (changed) warnings.push(`policy helper document is invalid (${read.reason}); the helper is not applied`);
    return { serving: this.serving, policy: this.policy, warnings };
  }
}
