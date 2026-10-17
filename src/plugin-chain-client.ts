// The Client host (W45-85): the island a plugin's terminal client runs in. It acquires the client
// for one element, subscribes to its snapshot, mounts the terminal view over it, forwards pointer
// and key events, and draws the client's tree or its failure text under an error boundary. The
// copied bodies live in ./plugin-chain-client-host-source.ts; this module is the seam around them.
//
// Source, chunk-kjfwbh4w.js:
//   var Vo="…"; class XD extends iZr{…} [3241,4161) — the error boundary: a new `resetKey` clears a
//   caught throw; a throw is reported once through `telemetryMessage`, the capture sink and the
//   caller's `onError`; the fallback (or null) is drawn while caught.
//   function wo(o){…} [28121,28534) — the hosted client's view hooks: its click ref, the focus
//   effects, and the pre-dispatch key handler that only the focused client consumes.
//   function To({host,instance,snapshot}){…} [28534,29637) — the terminal mount: props, layout,
//   redraw and resize; the pointer and key handlers; the drawn tree or the failed text.
//   function Ro(o){…} [29641,29858) — the clock adapter: a real clock every interval, else
//   `setInterval`.
//   var bo=Object.freeze({status:"loading"}); var Co=Object.freeze({…}) [29858,30201) — the loading
//   snapshot and the inert client (`Ce`'s request id: react-surface).
//   function So(o){…} [30219,30538) — acquire the client for the element and release it on unmount.
//   function Io(o){…} [30538,30927) — the Client host component: acquire, subscribe, mount `To`
//   under `XD`, with the layout box as the fallback.
// Source, chunk-am9mebpw.js: function Ey(o,{isActive}={}) [1357,1549) — register a key handler
// that sees every key before dispatch.
//
// The host bindings (the focus stores, the client registry and the telemetry sink) live in
// ./plugin-chain-client-host.ts.
export { XD, wo, To, Ro, bo, Co, So, Io, Ey } from './plugin-chain-client-host-source.js';

/** Source `Io`: the Client host component. */
export { Io as ClientHost } from './plugin-chain-client-host-source.js';
/** Source `So`: acquire one element's plugin client. */
export { So as acquireClient } from './plugin-chain-client-host-source.js';
/** Source `To`: the terminal mount over one client instance. */
export { To as ClientMount } from './plugin-chain-client-host-source.js';
/** Source `wo`: the hosted client's mouse/keyboard binding. */
export { wo as useClientInput } from './plugin-chain-client-host-source.js';
/** Source `XD`: the error boundary the client tree draws under. */
export { XD as ErrorBoundary } from './plugin-chain-client-host-source.js';
/** Source `Ey`: register a handler that sees keys before dispatch. */
export { Ey as usePreDispatch } from './plugin-chain-client-host-source.js';
/** Source `Ro`: the clock adapter the client heartbeat uses. */
export { Ro as clockEvery } from './plugin-chain-client-host-source.js';
/** Source `bo`: the loading snapshot. */
export { bo as CLIENT_LOADING_SNAPSHOT } from './plugin-chain-client-host-source.js';
/** Source `Co`: the inert client instance. */
export { Co as INERT_CLIENT } from './plugin-chain-client-host-source.js';
