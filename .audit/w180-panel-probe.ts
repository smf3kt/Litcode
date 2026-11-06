import assert from 'node:assert/strict';
import { TuiRenderer } from '../src/tui-renderer.js';
import { Xe, nativeElement } from '../src/plugin-chain-react-hooks.js';
import { rxe } from '../src/diff-panel-source.js';
import { DiffPanelContext } from '../src/diff-panel-host.js';
import { gs } from '../src/plugin-chain-registry-stores-source.js';
import { NativeKeybindings } from '../src/tui-native-keys.js';
import { u } from '../src/plugin-chain-press-button-host.js';
import { Zy } from '../src/plugin-chain-press-button-source.js';
import { eE, systemMarkdownClock } from '../src/plugin-chain-markdown-host.js';
import { Zm } from '../src/plugin-chain-input-field-source.js';
import { l, P as ProjectContext } from '../src/plugin-chain-session-context-source.js';
import { sx } from '../src/plugin-chain-app-state-source.js';
import { ThemeContext } from '../src/tui-theme.js';

const renderer = new TuiRenderer({ write() {} });
const keys = new NativeKeybindings();
const store = gs({ fileHistory: { trackSequence: 0 }, todos: {}, toolPermissionContext: { denied: () => false }, panelFileView: null, settings: {} });
const project = { cwd: process.cwd() };
const session = { project, subscribe: () => () => {} };
const host = { store, data: { stats: { filesCount: 1, linesAdded: 1, linesRemoved: 1 },
  files: [{ path: 'package.json', linesAdded: 1, linesRemoved: 1 }],
  hunks: new Map([['package.json', [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ['-old', '+new'] }]]]),
  loading: false, source: { kind: 'working-tree' }, baseMode: 'uncommitted' },
  baseMode: 'uncommitted', cycleBase: () => 'branch', close() {}, denied: () => false, attachSelection() {} };
const contexts = [[DiffPanelContext, host], [u, keys], [Zy, renderer.appContext], [eE, systemMarkdownClock],
  [Zm, { columns: 60, rows: 25 }], [l, session], [ProjectContext, { get: () => project, subscribe: session.subscribe }], [sx, store]];
let element: unknown = Xe(rxe, { width: 60, minCol: 0 });
for (const [context, value] of contexts.reverse()) element = Xe(context, { value, children: element });
renderer.renderElement(nativeElement(element), 60, 25, { row: 0, column: 0, visible: false });
console.log(renderer.frame.join('\n'));
assert.match(renderer.frame.join('\n'), /package.json/);
assert.match(renderer.frame.join('\n'), /new/);
assert.ok(keys.handlerCount > 0);
renderer.close();
assert.equal(keys.handlerCount, 0);
assert.equal(renderer.liveNodes, 0);
console.log('native sidebar mounted and released');
