// W45-83: the hover group — the store accessor (`Fe`), the count adjuster (`mt`), the member handle
// (`_t`), the group key (`Bt`/`Dbr`), the override split (`ft`), the normalizer (`De`), the
// subscription hook (`ut`), the scope context (`_e`), the resolver (`jt`), the two components
// (`$t`/`Ut`) and the store selector hook (`Re`). Expected values were measured through the ported
// bodies (see .audit/w45-83-probe.txt).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import '../src/plugin-chain-registry.js';
import { runComponent } from '../src/plugin-chain-react-hooks.js';
import { it as registry } from '../src/plugin-chain-host.js';
import { PU } from '../src/plugin-chain-hover-host.js';
import {
  Fe, mt, _t, Bt, ft, ut, Kt, De, _e, jt, $t, Ut, Re, Dbr,
} from '../src/plugin-chain-hover-source.js';
import {
  hoverGroupsStore, adjustHoverGroup, groupMember, groupOf, hoverOverridesOf,
  HEX_COLOR_PROPS, ScopeHovered, HoverScope, HoverStyled,
} from '../src/plugin-chain-hover.js';

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

const withStore = (run: (store: ReturnType<typeof fakeStore>) => void, initial?: Map<string, number>) => {
  const store = fakeStore(initial);
  const holder = registry() as unknown as { hoverGroups: unknown };
  const real = holder.hoverGroups;
  holder.hoverGroups = store;
  try {
    run(store);
  } finally {
    holder.hoverGroups = real;
  }
};

const group = { plugin: 'p', scope: 's' };
const key = 'p\u0000scope\u0000s';

describe('the hover key and the overrides', () => {
  it('builds the key from plugin and scope, and the group only when both are given', () => {
    assert.equal(Dbr(group), key);
    assert.deepEqual(Bt('p', { scope: 's' }), group);
    assert.equal(Bt('p', undefined), undefined);
    assert.equal(Bt(undefined, { scope: 's' }), undefined);
    assert.equal(Bt('p', {}), undefined);
    assert.deepEqual(ft({ scope: 's', color: 'red', bold: true }), { color: 'red', bold: true });
  });

  it('maps named colors to hex and leaves everything else', () => {
    assert.deepEqual(Kt, ['color', 'backgroundColor', 'borderColor']);
    assert.deepEqual(
      De({ color: 'red', backgroundColor: 'blue', borderColor: 'bogus', bold: true }),
      { color: '#e5484d', backgroundColor: '#3e63dd', borderColor: 'bogus', bold: true },
    );
    assert.deepEqual(De({ color: '#abc' }), { color: '#abc' });
    assert.equal(De(null), null);
    assert.equal(De(undefined), null);
  });
});

describe('the hover store and its members', () => {
  it('adjusts a count and drops the key at zero', () => {
    withStore((store) => {
      assert.equal(Fe(), store);
      mt('k', 1);
      assert.deepEqual([...store.getState()], [['k', 1]]);
      mt('k', -1);
      assert.equal(store.getState().size, 0);
    });
  });

  it('counts a member in one group at a time', () => {
    withStore((store) => {
      const member = _t();
      member.enter('a');
      assert.deepEqual([...store.getState()], [['a', 1]]);
      member.enter('b');
      assert.deepEqual([...store.getState()], [['a', 1]]);
      member.leave();
      assert.equal(store.getState().size, 0);
      member.enter('a');
      member.regroup('b');
      assert.deepEqual([...store.getState()], [['b', 1]]);
      member.leave();
      assert.equal(store.getState().size, 0);
    });
  });
});

describe('the group subscription', () => {
  it('answers the hot flag and counts enter and leave on one mount', () => {
    withStore((store) => {
      const cold = runComponent(() => ut(group, 'Box'), { contexts: new Map() }).result;
      assert.equal(cold.isHot, false);
      assert.equal(typeof cold.onMouseEnter, 'function');
      assert.equal(typeof cold.onMouseLeave, 'function');
      cold.onMouseEnter();
      assert.equal(store.getState().get(key), 1);
      const hot = runComponent(() => ut(group, 'Box'), { contexts: new Map() }).result;
      assert.equal(hot.isHot, true);
      const mounted = runComponent(() => ut(group, 'Box'), { contexts: new Map() });
      mounted.result.onMouseEnter();
      assert.equal(store.getState().get(key), 2);
      mounted.unmount();
      assert.equal(store.getState().get(key), 1);
      const none = runComponent(() => ut(undefined, 'Box'), { contexts: new Map() }).result;
      assert.equal(none.isHot, false);
    });
  });
});

describe('the override resolver', () => {
  it('uses the enclosing scope for a site without a group', () => {
    withStore((store) => {
      const cold = runComponent(
        () => jt(undefined, { scope: 's', color: 'red' }, 'Box'),
        { contexts: new Map() },
      ).result;
      assert.deepEqual(cold, { overrides: {}, handlers: {} });
      const hot = runComponent(
        () => jt(undefined, { scope: 's', color: 'red', bold: true }, 'Box'),
        { contexts: new Map([[_e, true]]) },
      ).result;
      assert.deepEqual(hot.overrides, { color: '#e5484d', bold: true });
      assert.deepEqual(hot.handlers, {});
      store.setState(() => new Map([[key, 1]]));
      const grouped = runComponent(
        () => jt(group, { scope: 's', color: 'red' }, 'Box'),
        { contexts: new Map() },
      ).result;
      assert.deepEqual(grouped.overrides, { color: '#e5484d' });
      assert.equal(typeof grouped.handlers.onMouseEnter, 'function');
      assert.equal(typeof grouped.handlers.onMouseLeave, 'function');
      assert.equal(grouped.handlers.hoverFollowsPaint, true);
      store.setState(() => new Map());
      const groupCold = runComponent(
        () => jt(group, { scope: 's', color: 'red' }, 'Box'),
        { contexts: new Map() },
      ).result;
      assert.deepEqual(groupCold.overrides, {});
      assert.equal(groupCold.handlers.hoverFollowsPaint, true);
    });
  });
});

describe('the hover components', () => {
  it('draws a HoverScope with its provider, merged layout and group handlers', () => {
    withStore((store) => {
      store.setState(() => new Map([[key, 1]]));
      const scope = runComponent(() => $t({
        isLive: true,
        elementKey: 'e1',
        layout: { flexDirection: 'row', color: 'blue' },
        hover: { scope: 's', color: 'red', bold: true },
        group,
        children: ['x'],
      }), { contexts: new Map() }).result as unknown as Held;
      assert.equal(scope.type, _e);
      assert.deepEqual(scope.props, { value: false });
      const box = (scope.children as unknown[])[0] as Held;
      assert.equal(box.type, 'Box');
      const props = box.props as Held;
      assert.equal(props.flexDirection, 'row');
      assert.equal(props.color, '#e5484d');
      assert.equal(props.bold, true);
      assert.equal(props.elementKey, 'e1');
      assert.equal(props.hoverFollowsPaint, true);
      assert.equal(typeof props.onMouseEnter, 'function');
      assert.equal(typeof props.onMouseLeave, 'function');
      store.setState(() => new Map());
      const cold = runComponent(() => $t({
        isLive: true,
        elementKey: 'e1',
        layout: { flexDirection: 'row', color: 'blue' },
        hover: { scope: 's', color: 'red' },
        group,
        children: ['x'],
      }), { contexts: new Map() }).result as unknown as Held;
      const coldBox = (cold.children as unknown[])[0] as Held;
      assert.equal((coldBox.props as Held).color, '#3e63dd');
    });
  });

  it('draws HoverStyled as a Box or a Text with the resolved overrides', () => {
    withStore((store) => {
      store.setState(() => new Map([[key, 1]]));
      const styled = runComponent(() => Ut({
        isInline: false,
        props: { color: 'red' },
        hover: { scope: 's', color: 'green' },
        group,
        children: ['hi'],
      }), { contexts: new Map() }).result as unknown as Held;
      assert.equal(styled.type, 'Box');
      const props = styled.props as Held;
      assert.equal(props.color, '#46a758');
      assert.equal(props.hoverFollowsPaint, true);
      assert.equal(typeof props.onMouseEnter, 'function');
      assert.deepEqual(styled.children, ['hi']);
      const inline = runComponent(() => Ut({
        isInline: true,
        props: {},
        hover: undefined,
        group,
        children: ['hi'],
      }), { contexts: new Map() }).result as unknown as Held;
      assert.equal(inline.type, 'Text');
      assert.equal((inline.props as Held).hoverFollowsPaint, true);
    });
  });
});

describe('the store selector', () => {
  it('selects through the store and the mounted scheduler', () => {
    withStore((store) => {
      store.setState(() => new Map([[key, 1]]));
      let paced = 0;
      const scheduler = {
        paced: (subscribe: (onChange: () => void) => () => void) => { paced += 1; return subscribe; },
      };
      const selected = runComponent(
        () => Re(store, (state: Map<string, number>) => state.get(key) ?? 0),
        { contexts: new Map([[PU, scheduler]]) },
      );
      assert.equal(selected.result, 1);
      assert.equal(paced, 1);
      store.setState(() => new Map([[key, 2]]));
      assert.equal(selected.runtime.dirty, true);
      assert.equal(store.getSnapshot().get(key), 2);
    });
  });
});

describe('the seam names', () => {
  it('declares the store, the members and the components under their source names', () => {
    assert.equal(hoverGroupsStore, Fe);
    assert.equal(adjustHoverGroup, mt);
    assert.equal(groupMember, _t);
    assert.equal(groupOf, Bt);
    assert.equal(hoverOverridesOf, ft);
    assert.equal(HEX_COLOR_PROPS, Kt);
    assert.equal(ScopeHovered, _e);
    assert.equal(HoverScope, $t);
    assert.equal(HoverStyled, Ut);
  });
});
