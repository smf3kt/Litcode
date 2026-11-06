import { runComponent } from '../src/plugin-chain-react-hooks.js';
import { paneMeasureContext } from '../src/plugin-chain-above-prompt-host-glue.js';
import { Zm } from '../src/plugin-chain-input-field-source.js';
import { appStateContext } from '../src/plugin-chain-app-state.js';
import { sessionContext, type SessionLike } from '../src/plugin-chain-session-context.js';
import { aq } from '../src/plugin-chain-press-button-source.js';
import { eE } from '../src/plugin-chain-markdown-host.js';
import { AbovePrompt } from '../src/plugin-chain-above-prompt-component.js';

const root = {};
const session = { project: { root }, host: {}, root, subscribe: () => () => {} } as unknown as SessionLike;
const appState = { getSnapshot: () => ({ viewingAgentTaskId: undefined, tasks: {} }), subscribe: () => () => {} };
const contexts = new Map<unknown, unknown>([
  [paneMeasureContext, () => null],
  [Zm, { rows: 24, columns: 80 }],
  [appStateContext, appState],
  [sessionContext, session],
  [aq, { getState: () => ({ open: [] }), subscribe: () => () => {} }],
  [eE, { now: () => Date.now(), setTimeout: () => () => {} }],
]);
const run = runComponent(() => AbovePrompt({ survey: false, working: false, setInputValue: () => {} }), { contexts });
let el: any = run.result;
for (let d = 0; d < 8 && el; d += 1) {
  const name = typeof el.type === 'function' ? el.type.name : typeof el.type === 'object' ? (el.type.type?.name ?? 'obj') : String(el.type);
  console.log(d, name, 'props', el.props ? Object.keys(el.props).filter((k) => k !== 'children') : null, 'value', el.props?.value === undefined ? undefined : JSON.stringify(el.props.value));
  el = el.children?.[0];
}
run.unmount();
