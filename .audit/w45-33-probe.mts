// W45-33 measurements before any assertion: the toast module's four verbs — dismiss, expire, hold,
// pause — against a bound store and clock.
import { chainRecords, clearChainRecords } from '../src/plugin-chain-host.js';
import { bindPluginState } from '../src/plugin-chain-notify.js';
import { bindToastClock, drawnToastIds, toastClockHandle, toastStackStateKey } from '../src/plugin-chain-notify-stack.js';
import { dismissToast, expireToasts, holdToast, pauseToasts } from '../src/plugin-chain-notify-verbs.js';

const NOW = 1_000_000;
const stored = new Map<string, { value: unknown; version: number }>();
const off = bindPluginState({
  values: {
    getState: () => ({ get: (key: string) => stored.get(key) }),
    setState: (update) => { for (const [key, value] of update(new Map(stored))) stored.set(key, value); },
  },
  versionFloor: 0,
  readersOf: new Map(),
});

const entry = (over: Record<string, unknown> = {}) => ({
  id: 'a', owner: 'plugin-a', plugin: 'plugin-a', isManaged: false, text: 'hello',
  shownAt: NOW, leavesAt: NOW + 4000, phase: 'shown', ...over,
});
const stack = () => stored.get(toastStackStateKey())?.value as Record<string, unknown>[] | undefined;
const setStack = (value: unknown) => stored.set(toastStackStateKey(), { value, version: (stored.get(toastStackStateKey())?.version ?? 0) + 1 });
const brief = (value: unknown) => JSON.stringify(((value ?? []) as Record<string, unknown>[]).map((e) => ({ id: e.id, phase: e.phase, leavesAt: e.leavesAt, ...(e.heldAt !== undefined && { heldAt: e.heldAt }) })));

const clock: { pending?: { unref?: () => void }; pausedAt?: number } = {};
bindToastClock(clock);
const armed: number[] = [];
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = ((_: () => void, ms: number) => {
  armed.push(ms);
  return { unref: () => {} } as unknown as NodeJS.Timeout;
}) as typeof globalThis.setTimeout;

// dismiss
setStack([entry({ id: 'a' }), entry({ id: 'b' })]);
armed.length = 0;
dismissToast('a', () => NOW);
console.log('dismiss: stack', brief(stack()), '| cI', JSON.stringify([...drawnToastIds()]), '| size', drawnToastIds().size, '| armed', JSON.stringify(armed));
armed.length = 0;
dismissToast('missing', () => NOW);
console.log('dismiss a missing id: stack', brief(stack()), '| armed', JSON.stringify(armed));

// expire
setStack([entry({ id: 'a', leavesAt: NOW - 1 }), entry({ id: 'b', leavesAt: NOW + 500 })]);
armed.length = 0;
expireToasts(() => NOW);
console.log('expire: stack', brief(stack()), '| armed', JSON.stringify(armed));

// hold: hold an unheld entry, hold it again, then release it later
setStack([entry({ id: 'a' })]);
armed.length = 0;
holdToast({ id: 'a', isHeld: true }, () => NOW);
console.log('hold: stack', brief(stack()), '| armed', JSON.stringify(armed));
armed.length = 0;
holdToast({ id: 'a', isHeld: true }, () => NOW + 10);
console.log('hold again: stack', brief(stack()), '| armed', JSON.stringify(armed));
armed.length = 0;
holdToast({ id: 'a', isHeld: false }, () => NOW + 3000);
console.log('release: stack', brief(stack()), '| armed', JSON.stringify(armed));
armed.length = 0;
holdToast({ id: 'other', isHeld: false }, () => NOW + 4000);
console.log('hold an id that is not held: stack', brief(stack()), '| armed', JSON.stringify(armed));

// pause and resume
setStack([entry({ id: 'a', leavesAt: NOW + 4000 }), entry({ id: 'b', leavesAt: NOW + 9000, heldAt: NOW })]);
armed.length = 0;
clearChainRecords();
pauseToasts({ isPaused: true }, () => NOW);
console.log('pause: pausedAt', clock.pausedAt, '| stack', brief(stack()), '| armed', JSON.stringify(armed));
armed.length = 0;
pauseToasts({ isPaused: true }, () => NOW + 1000);
console.log('pause again: pausedAt', clock.pausedAt, '| stack', brief(stack()), '| armed', JSON.stringify(armed));
armed.length = 0;
pauseToasts({ isPaused: false }, () => NOW + 5000);
console.log('resume at +5000: pausedAt', clock.pausedAt, '| stack', brief(stack()), '| armed', JSON.stringify(armed));
console.log('clock handle is the bound one:', toastClockHandle() === clock, '| records',
  JSON.stringify(chainRecords().map((r) => r.message ?? r)));
globalThis.setTimeout = realSetTimeout;
off();
