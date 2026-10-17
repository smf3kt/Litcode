// The terminal environment probe (W157b): what the wheel path asks before it steps — whether the
// terminal takes the decay curve, the base scroll step, whether wheel events flood, whether the
// terminal is JediTerm, and the terminal identity fields the debug line prints.
//
// The copied bodies live in ./plugin-chain-terminal-environment-source.ts: the probe class `E`, its
// per-host singleton `S`, the reader `uq`, the flood tests `fLr`/`oe`, the base helpers `v4n`/`ie`,
// the invalidator `s$t`, the JetBrains terminal list `Fse`, and the two terminal-state readers
// `U1t`/`jg`. The host-owned facts (`DT`, `Su`, `B`) bound in
// ./plugin-chain-terminal-environment-host.ts.
//
// Source: chunk-z7whhrje.js [1978,3336) 1,358 units; chunk-yvnhkg35.js [6703,6878) 175 units;
// chunk-mvsmkx6d.js [6611,6789) 178 units — zero-based UTF-16 half-open ranges.
import { uq, s$t } from './plugin-chain-terminal-environment-source.js';

export {
  bindTerminalEnvironmentHost,
  type AttacherCaps,
  type TerminalEnvironmentHost,
  type TerminalStateView,
} from './plugin-chain-terminal-environment-host.js';

/** Source `E.value`: the probe's answer. */
export interface TerminalEnvironment {
  /** Whether the wheel uses the decay curve rather than the window curve. */
  useDecayCurve: boolean;
  /** Source `useAdaptiveDrain`, the xterm.js flag. */
  useAdaptiveDrain: boolean;
  /** The base scroll step, from the environment and the terminal kind. */
  base: number;
  /** Whether the terminal identifies as xterm.js. */
  xtermJs: boolean;
  /** Whether wheel events arrive as a flood (Cursor, old VS Code, xterm.js). */
  wheelFlood: boolean;
  /** Whether the terminal is a JetBrains IDE terminal or an attacher names one. */
  jediTerm: boolean;
  /** `TERM_PROGRAM`, or `unset`. */
  termProgram: string;
  /** `TERM_PROGRAM_VERSION`, or `unset`. */
  termProgramVersion: string;
  /** The terminal's DA reply name, or `(no reply)`. */
  xtversion: string;
  /** Whether the surface runs under Windows Terminal. */
  wtSession: boolean;
  /** `CLAUDE_CODE_SCROLL_SPEED`, or `unset`. */
  scrollSpeedEnv: string;
  /** The platform the source records; this build always reports `darwin`. */
  platform: string;
}

/** Source `uq`: the probe for the bound host, cached until one of its inputs changes or
 *  `invalidateTerminalEnvironment()` runs. */
export function terminalEnvironment(): TerminalEnvironment {
  return uq() as TerminalEnvironment;
}

/** Source `s$t`: drop the cached probe for the bound host. */
export function invalidateTerminalEnvironment(): void {
  s$t();
}
