import { bindPluginState } from '../src/plugin-chain-notify.js';
import * as stackSrc from '../src/plugin-chain-notify-stack-source.js';
import { bindToastClock, toastStackStateKey } from '../src/plugin-chain-notify-stack.js';
import { Ge } from '../src/plugin-chain-notify-fold-source.js';

const stored = new Map<string, { value: unknown; version: number }>();
const off = bindPluginState({
  values: {
    getState: () => ({ get: (k: string) => stored.get(k) }),
    setState: (u) => { for (const [k, v] of u(new Map(stored))) stored.set(k, v); },
  },
  versionFloor: 0, readersOf: new Map(),
});
bindToastClock({});
const entry = (id: string) => ({ id, owner: 'p', plugin: 'p', isManaged: false, text: 't', shownAt: 0, leavesAt: 9_000_000, phase: 'shown' });
stored.set(toastStackStateKey(), { value: [entry('a'), entry('b')], version: 1 });

console.log('Ge is', String(Ge), '| cI is a Set:', stackSrc.cI instanceof Set, '| size', stackSrc.cI.size);
stackSrc.cI.add('x');
console.log('after add x:', stackSrc.cI.size);
stackSrc.bh(stackSrc.bu(), () => 5_000_000);
console.log('after bh:', stackSrc.cI.size, [...stackSrc.cI]);
stackSrc.cI.add('y');
console.log('after add y:', stackSrc.cI.size);
console.log('MF folds:', JSON.stringify(stackSrc.MF([], () => 5_000_000)));
off();
