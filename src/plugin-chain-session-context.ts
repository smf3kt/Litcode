// The session context layer (W152): the provider contexts and store hooks the AbovePrompt draft
// state reads. Copied bodies live in ./plugin-chain-session-context-source.ts:
//
//   - chunk-z6yhgx3x.js [817,867) 50 units — the session, host and project contexts plus the
//     no-op unsubscribe used by the host/project provider;
//   - [867,1334) 467 units — `$3n`, the SessionProvider that supplies session, host and project;
//   - [1334,1678) 344 units — `U3n`, the HostProjectProvider used when there is no session;
//   - [1678,1829) 151 units — `is`, the host hook;
//   - [1829,2007) 178 units — `sv`, the project hook;
//   - [2007,2042) 35 units — `hC`, the raw session context hook;
//   - [2042,2248) 206 units — `$r`, the session (project) hook;
//   - [2248,2504) 256 units — `v`, the external-store subscription hook;
//   - chunk-4bw62nzm.js [52926,52959) 33 units — the error name;
//   - [52959,53053) 94 units — `GP`, the missing-project-directory error;
//   - [53128,53194) 66 units — `So`, the project-or-throw reader.
//
// Total 4 blocks, 1,880 UTF-16 units. The provider bodies are rendered through the hook seam's
// element creator, so this module is only usable inside a component render.
import {
  l,
  d,
  P,
  j,
  $3n,
  U3n,
  is,
  sv,
  hC,
  $r,
  v,
} from './plugin-chain-session-context-source.js';

/** The session the provider accepts; `subscribe` feeds the store snapshot and `project` is read
 *  by `useSession`, which throws when it is null. */
export interface SessionLike {
  project: unknown;
  host?: unknown;
  root?: unknown;
  subscribe: (onChange: () => void) => () => void;
  [key: string]: unknown;
}

/** Source `l`: the raw session context. */
export const sessionContext = l;
/** Source `d`: the host context. */
export const hostContext = d;
/** Source `P`: the project context. */
export const projectContext = P;
/** Source `j`: the no-op unsubscribe a host/project provider hands to its store. */
export const noopUnsubscribe = j;

/** Source `$3n`: supply session, host and project to a subtree. */
export function SessionProvider(props: { session: SessionLike; children?: unknown }): unknown {
  return $3n(props);
}

/** Source `U3n`: supply host and project when there is no live session. */
export function HostProjectProvider(props: { host: unknown; project: unknown; children?: unknown }): unknown {
  return U3n(props);
}

/** Source `is`: read the host. Throws outside `<SessionProvider>`/`<HostProjectProvider>`. */
export function useHost<T = unknown>(): T {
  return is() as T;
}

/** Source `sv`: read (and optionally select from) the project. */
export function useProject<T = unknown>(selector?: (project: unknown) => T): T {
  return sv(selector) as T;
}

/** Source `hC`: read the raw session context, or undefined outside a provider. */
export function useSessionContext<T = unknown>(): T | undefined {
  return hC() as T | undefined;
}

/** Source `$r`: read (and optionally select from) the session's project. Throws outside
 *  `<SessionProvider>`. */
export function useSession<T = unknown>(selector?: (session: unknown) => T): T {
  return $r(selector) as T;
}

/** Source `v`: subscribe a component to an external store, optionally through a selector. */
export function useStore<T>(
  store: unknown,
  subscribe: (onChange: () => void) => () => void,
  read: () => unknown,
  selector?: (state: unknown) => T,
): T {
  return v(store, subscribe, read, selector) as T;
}

// The original names, for copied bodies that import the source spelling.
export { l, d, P, j, $3n, U3n, is, sv, hC, $r, v };
