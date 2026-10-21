/**
 * iTerm2/ConEmu progress reporting behind the Config "Terminal progress bar" row.
 *
 * Ported from the recovered gate `s7e` (chunk-z7whhrje.js [3953,4315)) and writer
 * `p` (chunk-z7whhrje.js [8457,8902)): OSC 9;4 with the CLEAR/SET/ERROR/
 * INDETERMINATE codes `vkt` (chunk-kexg5hxg.js 15871). `gh`/`OI`
 * (chunk-kexg5hxg.js [8412,8488)/[8488,8667)) supply the OSC framing and the
 * tmux/screen passthrough. Coordinates are zero-based UTF-16. The recovered
 * React effect `qa` (chunk-3gz7s57c.js [138941,139637)) chooses the state with
 * `om` [138656,138739): off is null, any active work is indeterminate, and idle
 * completes (clears). No caller in the recovered tree emits `running` or `error`
 * percentages for an agent turn.
 */

export type TerminalProgressState = 'running' | 'indeterminate' | 'completed' | 'error' | null;

const ESC = '\x1b';
const BEL = '\x07';

function parseVersion(value: string | undefined): [number, number, number] | undefined {
  // `semver.coerce`: the first numeric run anywhere, with missing components zero-filled.
  const match = value?.match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  return match ? [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)] : undefined;
}

function atLeast(version: [number, number, number], minimum: [number, number, number]): boolean {
  for (let index = 0; index < 3; index++) {
    if (version[index]! !== minimum[index]!) return version[index]! > minimum[index]!;
  }
  return true;
}

/**
 * `s7e`'s gate: an explicit override wins, then ConEmu, then a versioned
 * Ghostty (1.2.0) or iTerm2 (3.6.6). Windows Terminal and non-TTY outputs
 * report nothing.
 */
export function terminalProgressSupported(isTTY: boolean,
  env: NodeJS.ProcessEnv = process.env, override?: boolean): boolean {
  if (override !== undefined) return override;
  if (!isTTY) return false;
  if (env.WT_SESSION) return false;
  if (env.ConEmuANSI || env.ConEmuPID || env.ConEmuTask) return true;
  const version = parseVersion(env.TERM_PROGRAM_VERSION);
  if (!version) return false;
  if (env.TERM_PROGRAM === 'ghostty') return atLeast(version, [1, 2, 0]);
  if (env.TERM_PROGRAM === 'iTerm.app') return atLeast(version, [3, 6, 6]);
  return false;
}

export interface TerminalProgressOptions {
  /** `OI`: tmux and screen need their passthrough wrapper. */
  mux?: 'tmux' | 'screen';
}

/** One OSC 9;4 write; `null` is the source writer's falsy arm and clears. */
export function terminalProgressSequence(state: TerminalProgressState, percent = 0,
  options: TerminalProgressOptions = {}): string {
  const code = state === 'completed' || state === null ? 0 : state === 'running' ? 1 : state === 'error' ? 2 : 3;
  const value = state === 'running' || state === 'error'
    ? `;${Math.max(0, Math.min(100, Math.round(percent)))}` : ';';
  const body = `${ESC}]9;4;${code}${value}${BEL}`;
  if (options.mux === 'tmux') return `${ESC}Ptmux;${body.replaceAll(ESC, ESC + ESC)}${ESC}\\`;
  if (options.mux === 'screen') return `${ESC}P${body.replaceAll(ESC, ESC + ESC)}${ESC}\\`;
  return body;
}

/** `K3t`'s process-level multiplexer detection. Zellij receives the raw sequence. */
export function terminalProgressMux(env: NodeJS.ProcessEnv = process.env): 'tmux' | 'screen' | undefined {
  if (env.TMUX) return 'tmux';
  if (env.STY) return 'screen';
  return undefined;
}
