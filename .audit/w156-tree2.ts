import { runComponent } from '../src/plugin-chain-react-hooks.js';
import { paneMeasureContext } from '../src/plugin-chain-above-prompt-host-glue.js';
import { Zm } from '../src/plugin-chain-input-field-source.js';
import { appStateContext } from '../src/plugin-chain-app-state.js';
import { sessionContext, type SessionLike } from '../src/plugin-chain-session-context.js';
import { aq } from '../src/plugin-chain-press-button-source.js';
import { eE } from '../src/plugin-chain-markdown-host.js';
import { u as keybindingContext } from '../src/plugin-chain-press-button-host.js';
import { AbovePrompt } from '../src/plugin-chain-above-prompt-component.js';
const root = {};
const session = { project: { root }, host: {}, root, subscribe: () => () => {} } as unknown as SessionLike;
const service = { registerHandler: () => () => {}, registerPreDispatch: () => () => {}, getDisplayText: () => '', registrations: [] as unknown[] };
const contexts = new Map<unknown, unknown>([
  [paneMeasureContext, () => null],
  [Zm, { rows: 24, columns: 80 }],
  [appStateContext, { getSnapshot: () => ({ viewingAgentTaskId: undefined, tasks: {} }), subscribe: () => () => {} }],
  [sessionContext, session],
  [aq, { getState: () => ({ open: [] }), subscribe: () => () => {} }],
  [eE, { now: () => Date.now(), setTimeout: () => () => {} }],
  [keybindingContext, service],
]);
const run = runComponent(() => AbovePrompt({ survey: false, working: false, setInputValue: () => {}, onHoldsBandChange: (v) => console.log('hold', v) }), { contexts });
console.log('result type', Array.isArray(run.result), typeof run.result, Object.keys(run.result ?? {}));
let el: any = run.result;
for (let d = 0; d < 9 && el; d += 1) {
  console.log(d, el.type?.name ?? String(el.type), JSON.stringify(el.props?.value, (k,v)=>typeof v==='function'?'[fn]':v), el.children?.length);
  el = el.children?.[0];
}
run.unmount();
