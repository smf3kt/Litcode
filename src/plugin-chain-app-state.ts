// The app-state hooks (W152): the context tokens `chunk-7n39kxwj.js` uses to expose the host
// application state to the plugin chain. Copied bodies live in
// ./plugin-chain-app-state-source.ts:
//
//   - chunk-7n39kxwj.js [768,810) 42 units — the app-state, app-state-session and MCP-connection
//     context tokens;
//   - [1239,1422) 183 units — `t` (the app-state context reader) and `V` (the selector form).
//
// Total 2 blocks, 225 UTF-16 units. The provider itself lives in the host application; this seam
// only carries the read side the plugin chain needs.
import { sx, l4n, c4n, t, V } from './plugin-chain-app-state-source.js';

/** Source `sx`: the app-state context token. */
export const appStateContext = sx;
/** Source `l4n`: the app-state session context token. */
export const appStateSessionContext = l4n;
/** Source `c4n`: the MCP-connection context token. */
export const mcpConnectionsContext = c4n;

/** Source `t`: read the app state. Throws outside an `<AppStateProvider>`. */
export function useAppState<T = unknown>(): T {
  return t() as T;
}

/** Source `V`: read a selected slice of the app state. Throws outside `<AppStateProvider>`. */
export function useAppStateSelector<T>(selector: (state: unknown) => T): T {
  return V(selector) as T;
}

// The original names, for copied bodies that import the source spelling.
export { sx, l4n, c4n, t, V };
