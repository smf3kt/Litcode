// W45-13 measurement: the seven value sites the source's table overrides by hand, read through the
// registered site table. Prints every sentence the copied rules answer with, so the regression asserts
// measured strings instead of plausible ones.
import '../src/plugin-chain-registry.js';
import { $be } from '../src/plugin-chain-host.js';

const s = (n: string): any => ($be() as any)[n];
const show = (label: string, v: unknown) => console.log(label + ' -> ' + JSON.stringify(v));

const uo = s('ui.open');
show('ui.open keys', Object.keys(uo).sort());
show('ui.open same', uo.checkArgument({ id: 'a', origin: 1 }, { id: 'a', origin: 1 }));
show('ui.open changed', uo.checkArgument({ id: 'b', origin: 1 }, { id: 'a', origin: 1 }));
show('ui.open value ok', uo.check({ value: 1 }, {}, []));
show('ui.open value bad', uo.check({}, {}, []));

const uc = s('ui.close');
show('ui.close keys', Object.keys(uc).sort());
show('ui.close bad id', uc.checkArgument({ id: 'a b' }, { id: 'a b' }));
show('ui.close id change', uc.checkArgument({ id: 'abc', origin: {} }, { id: 'ab', origin: {} }));
show('ui.close no origin', uc.checkArgument({ id: 'ab' }, { id: 'ab' }));
show('ui.close origin change', uc.checkArgument({ id: 'ab', origin: { x: 1 } }, { id: 'ab', origin: { x: 2 } }));
show('ui.close equal', uc.checkArgument({ id: 'ab', origin: { x: 1 } }, { id: 'ab', origin: { x: 1 } }));

const ub = s('ui.blit');
show('ui.blit keys', Object.keys(ub).sort());
show('ui.blit changed key', ub.checkArgument({ requestId: 1, key: 'k' }, { requestId: 1, key: 'j' }));
show('ui.blit source appears', ub.checkArgument({ requestId: 1, key: 'k', source: 7 }, { requestId: 1, key: 'k' }));
show('ui.blit equal', ub.checkArgument({ requestId: 1, key: 'k' }, { requestId: 1, key: 'k' }));

const eg = s('env.get'), es = s('env.set'), sg = s('state.get'), ss = s('state.set');
show('env.get keys', Object.keys(eg).sort());
show('env.get name change', eg.checkArgument({ name: 'A' }, { name: 'B' }));
show('env.set keys', Object.keys(es).sort());
show('env.set deny', es.check({ deny: 'no' }, {}, []));
show('env.set empty', es.check({}, {}, []));
show('env.set deny answered below', es.check({ deny: 'no' }, {}, [{ deny: undefined }]));
show('state.get keys', Object.keys(sg).sort());
show('state.get ref change', sg.checkArgument({ plugin: 'p', key: 'k', id: 'i' }, { plugin: 'p', key: 'k', id: 'j' }));
show('state.get equal', sg.checkArgument({ plugin: 'p', key: 'k', id: 'i' }, { plugin: 'p', key: 'k', id: 'i' }));
show('state.set keys', Object.keys(ss).sort());
show('state.set version change', ss.checkArgument({ plugin: 'p', key: 'k', id: 'i', ifVersion: 3, previous: 1 }, { plugin: 'p', key: 'k', id: 'i', ifVersion: 2, previous: 1 }));
show('state.set previous change', ss.checkArgument({ plugin: 'p', key: 'k', id: 'i', ifVersion: 3, previous: 1 }, { plugin: 'p', key: 'k', id: 'i', ifVersion: 3, previous: 2 }));
show('state.set equal', ss.checkArgument({ plugin: 'p', key: 'k', id: 'i', ifVersion: 3, previous: 1 }, { plugin: 'p', key: 'k', id: 'i', ifVersion: 3, previous: 1 }));
show('state.set restore', ss.restoreArgument({ previous: { a: 1 }, ifVersion: 9, value: 5 }, { previous: { a: 2 }, ifVersion: 8, value: 5 }));
show('total sites', Object.keys($be() as any).length);
