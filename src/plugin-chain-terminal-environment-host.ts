// The host boundary for the terminal environment probe (W157b). The copied probe in
// ./plugin-chain-terminal-environment-source.ts reads three host-owned facts and nothing else:
//
//   B()  — source `function B(){return n()}` in chunk-4bw62nzm.js: the current session, whose
//          `host` object keys the per-host singleton `S`. The product has no session store, so the
//          host supplies the key object; `S` still memoizes per key exactly as the source does.
//   Su() — source `function Su(){return n().surfaceCapabilities.attacherCaps()}` in the same
//          module: the attaching surface's capabilities, or undefined when no attacher answers.
//   DT() — source `function DT(){return v.of(B().host)}` in chunk-mvsmkx6d.js: the terminal state
//          record for the host. The source class `f` behind it carries the capability readings
//          (`o`, ported in W45-75), the image-file probe (`i`, same package) and two lazy getters
//          that build the terminal capability defaults through `d()` — a builder whose closure
//          (T/_/E/b/y/g/x, `we`, `ny`, `Zb`) is the terminal-capabilities defaults subsystem, not
//          this package. The probe reads one field of the record (`xtversionName`), so the host
//          exposes the record and keeps the capability getters with the subsystem that owns them.
//
// The defaults match the source's absent answers: no attacher (`undefined`), no terminal reply
// (`xtversionName` undefined), and one stable host key. Binding a host replaces them.

/** Source `DT()` shape, narrowed to the field the probe reads. */
export interface TerminalStateView {
  /** Source `f.xtversionName`: the terminal's DA reply name, set from `lWo` when it arrives. */
  xtversionName?: string;
}

/** Source `Su()` shape, narrowed to the fields the probe reads. */
export interface AttacherCaps {
  wheelFlood?: boolean;
  terminal?: string;
  mux?: string | null;
  wtSession?: boolean;
  isVscodeTerm?: boolean;
}

export interface TerminalEnvironmentHost {
  /** Source `DT()`: the terminal state record for the currently bound host. */
  terminalState(): TerminalStateView;
  /** Source `Su()`: the surface's attacher capabilities, or undefined when none answers. */
  attacherCaps(): AttacherCaps | undefined;
  /** Source `B().host`: a stable object identifying the host, used as the `S` cache key. */
  hostKey(): object;
}

let bound: TerminalEnvironmentHost | undefined;
const fallbackState: TerminalStateView = {};
const fallbackHost: object = {};
let hostToken: object = fallbackHost;
let hostWrapper: { host: object } = { host: hostToken };

/** Bind the host the copied probe asks; binding undefined restores the defaults above. */
export function bindTerminalEnvironmentHost(host: TerminalEnvironmentHost | undefined): void {
  bound = host;
  hostToken = host === undefined ? fallbackHost : host.hostKey();
  hostWrapper = { host: hostToken };
}

/** Source `DT()`: the terminal state record. The host must keep its identity stable per key. */
export function DT(): TerminalStateView {
  return bound === undefined ? fallbackState : bound.terminalState();
}

/** Source `Su()`: the attacher capabilities, undefined when no attacher answers. */
export function Su(): AttacherCaps | undefined {
  return bound === undefined ? undefined : bound.attacherCaps();
}

/** Source `B()`: `{ host }`, the key the probe singleton memoizes under. The token identity is
 *  stable until the host is rebound, so `uq()` keeps answering the same object. */
export function B(): { host: object } {
  return hostWrapper;
}
