// W45-83 probe: the hover group — the store accessor and adjuster, the member handle, the group
// key, the override split and normalizer, the subscription hook, the scope context, the resolver,
// the two components and the store selector hook. Values printed here belong in
// test/plugin-chain-hover.test.ts.
import '../src/plugin-chain-registry.js';
import { runComponent } from '../src/plugin-chain-react-hooks.js';
import { it } from '../src/plugin-chain-host.js';
import { PU } from '../src/plugin-chain-hover-host.js';
import {
  Fe, mt, _t, Bt, ft, ut, Kt, De, _e, jt, $t, Ut, Re, Dbr,
} from '../src/plugin-chain-hover-source.js';

type Held = Record<string, unknown>;

const fakeStore = (initial = new Map<string, number>()) => {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    getSnapshot: () => state,
    setState: (update: (state: Map<string, number>) => Map<string, number>) => {
      const next = update(state);
      if (next === state) return;
      state = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
};

const install = (store: ReturnType<typeof fakeStore>) => {
  const registry = it() as unknown as { hoverGroups: unknown };
  const real = registry.hoverGroups;
  registry.hoverGroups = store;
  return () => { registry.hoverGroups = real; };
};

console.log('Dbr', JSON.stringify(Dbr({ plugin: 'p', scope: 's' })), Dbr({ plugin: 'p', scope: 's' }) === 'p\u0000scope\u0000s');
console.log('Bt both', JSON.stringify(Bt('p', { scope: 's' })));
console.log('Bt no scope', JSON.stringify(Bt('p', undefined)), 'no plugin', JSON.stringify(Bt(undefined, { scope: 's' })), 'empty scope', JSON.stringify(Bt('p', {})));
console.log('ft', JSON.stringify(ft({ scope: 's', color: 'red', bold: true })));
console.log('De named', JSON.stringify(De({ color: 'red', backgroundColor: 'blue', borderColor: 'bogus', bold: true })));
console.log('De hex stays', JSON.stringify(De({ color: '#abc' })), 'De null', JSON.stringify(De(null)), 'De undefined', JSON.stringify(De(undefined)));
console.log('Kt', JSON.stringify(Kt));

const store = fakeStore();
const restore = install(store);
console.log('Fe is store', Fe() === store);
mt('k', 1);
console.log('mt add', JSON.stringify([...store.getState()]));
mt('k', -1);
console.log('mt remove', store.getState().size);

const member = _t();
member.enter('a');
console.log('member enter a', JSON.stringify([...store.getState()]));
member.enter('b');
console.log('member enter b', JSON.stringify([...store.getState()]));
member.leave();
console.log('member leave', store.getState().size);
member.enter('a');
member.regroup('b');
console.log('member regroup', JSON.stringify([...store.getState()]));
member.leave();

const group = { plugin: 'p', scope: 's' };
const hook1 = runComponent(() => ut(group, 'Box'), { contexts: new Map() }).result;
console.log('ut cold', JSON.stringify({ hot: hook1.isHot, enter: typeof hook1.onMouseEnter, leave: typeof hook1.onMouseLeave }));
hook1.onMouseEnter();
console.log('ut after enter count', store.getState().get(Dbr(group)));
const hook2run = runComponent(() => ut(group, 'Box'), { contexts: new Map() });
console.log('ut hot', hook2run.result.isHot);
hook2run.result.onMouseLeave();
console.log('ut after leave count', store.getState().size);
const hook3run = runComponent(() => ut(group, 'Box'), { contexts: new Map() });
hook3run.result.onMouseEnter();
console.log('ut entered count', store.getState().size);
hook3run.unmount();
console.log('ut unmount count', store.getState().size);
const noGroup = runComponent(() => ut(undefined, 'Box'), { contexts: new Map() }).result;
console.log('ut no group hot', noGroup.isHot);

store.setState(() => new Map([[Dbr(group), 1]]));
const cold = runComponent(() => jt(undefined, { scope: 's', color: 'red' }, 'Box'), { contexts: new Map() }).result;
console.log('jt no group cold', JSON.stringify(cold));
const scoped = runComponent(() => jt(undefined, { scope: 's', color: 'red', bold: true }, 'Box'), { contexts: new Map([[_e, true]]) }).result;
console.log('jt scope hot', JSON.stringify(scoped));
const grouped = runComponent(() => jt(group, { scope: 's', color: 'red' }, 'Box'), { contexts: new Map() }).result;
console.log('jt group hot', JSON.stringify({ overrides: grouped.overrides, handlers: Object.keys(grouped.handlers), enter: typeof grouped.handlers.onMouseEnter }));
store.setState(() => new Map());
const groupCold = runComponent(() => jt(group, { scope: 's', color: 'red' }, 'Box'), { contexts: new Map() }).result;
console.log('jt group cold', JSON.stringify(groupCold));

store.setState(() => new Map([[Dbr(group), 1]]));
const scope = runComponent(() => $t({
  isLive: true,
  elementKey: 'e1',
  layout: { flexDirection: 'row', color: 'blue' },
  hover: { scope: 's', color: 'red', bold: true },
  group,
  children: ['x'],
}), { contexts: new Map() }).result as Held;
console.log('scope type', scope.type === _e, 'value', JSON.stringify((scope.props as Held).value));
const box = (scope.children as unknown[])[0] as Held;
console.log('scope box props', JSON.stringify({ ...(box.props as Held), onMouseEnter: typeof (box.props as Held).onMouseEnter, onMouseLeave: typeof (box.props as Held).onMouseLeave }));

const styled = runComponent(() => Ut({
  isInline: false, props: { color: 'red' }, hover: { scope: 's', color: 'green' }, group, children: ['hi'],
}), { contexts: new Map() }).result as Held;
console.log('styled type', styled.type, 'props', JSON.stringify({ ...(styled.props as Held), onMouseEnter: typeof (styled.props as Held).onMouseEnter }));
const inline = runComponent(() => Ut({ isInline: true, props: {}, hover: undefined, group, children: ['hi'] }), { contexts: new Map() }).result as Held;
console.log('inline type', inline.type, 'props', JSON.stringify({ ...(inline.props as Held), onMouseEnter: typeof (inline.props as Held).onMouseEnter }));

let paced = 0;
const scheduler = { paced: (subscribe: (onChange: () => void) => () => void) => { paced += 1; return subscribe; } };
const selected = runComponent(() => Re(store, (state) => state.get(Dbr(group)) ?? 0), { contexts: new Map([[PU, scheduler]]) });
console.log('Re value', selected.result, 'paced', paced);
store.setState(() => new Map([[Dbr(group), 2]]));
console.log('Re value after set (same run)', selected.runtime.dirty, 'snapshot read', store.getSnapshot().get(Dbr(group)));

restore();
