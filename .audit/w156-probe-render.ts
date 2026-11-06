import { runComponent } from '../src/plugin-chain-react-hooks.js';
import { paneMeasureContext } from '../src/plugin-chain-above-prompt-host-glue.js';
import { Zm } from '../src/plugin-chain-input-field-source.js';
import { appStateContext } from '../src/plugin-chain-app-state.js';
import { sessionContext, type SessionLike } from '../src/plugin-chain-session-context.js';
import { AbovePrompt } from '../src/plugin-chain-above-prompt-component.js';
import { aq } from '../src/plugin-chain-press-button-source.js';
import { eE } from '../src/plugin-chain-markdown-host.js';

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
const run = runComponent(
  () => AbovePrompt({ survey: false, working: false, setInputValue: () => {} }),
  { contexts },
);
const result = run.result as { type?: unknown; props?: unknown; children?: unknown[] };
console.log('type', typeof result.type, String(result.type).slice(0, 40));
console.log('childCount', result.children?.length);
run.unmount();
