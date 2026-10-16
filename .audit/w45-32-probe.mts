// W45-32 measurements before any assertion: what the host toast stack does — the reader, the cap,
// the fold, the writer, the timer, the undrawn report and the label boundary.
import { chainRecords, clearChainRecords } from '../src/plugin-chain-host.js';
import { bindPluginState } from '../src/plugin-chain-notify.js';
import { bindToastClock, EMPTY_TOAST_STACK, TOAST_LEAVING_MS, TOAST_HOLD_REBASE_MS, TOAST_STACK_KEY,
  armToastTimer, foldToastStack, hostToast, listEquals, pluginLabel, readToastStack, reportUndrawnToast,
  toastStackStateKey, trimToastStack, writeToastStack } from '../src/plugin-chain-notify-stack.js';
import { ACn as MAX_WAITING_TOASTS } from '../src/plugin-chain-toast-source.js';

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

console.log('constants: leaving', TOAST_LEAVING_MS, '| rebase', TOAST_HOLD_REBASE_MS,
  '| cap', MAX_WAITING_TOASTS, '| key', JSON.stringify(TOAST_STACK_KEY), '| state key', toastStackStateKey());
console.log('empty read:', JSON.stringify(readToastStack()), '| frozen identity', readToastStack() === EMPTY_TOAST_STACK);
console.log('listEquals:', listEquals([1, 2], [1, 2]), listEquals([1, 2], [2, 1]), listEquals([1], [1, 2]),
  listEquals(undefined, undefined), listEquals([1], undefined));

// The cap: one plugin holding more than the cap loses its oldest member.
const many = Array.from({ length: 6 }, (_, i) => entry({ id: `t${i}`, owner: `p${i % 2}`, leavesAt: NOW + i }));
console.log('trim of', many.length, '→', trimToastStack(many).map((e) => e.id).join(','));
const over = Array.from({ length: 51 }, (_, i) => entry({ id: `t${i}`, owner: i % 2 === 0 ? 'big' : 'small', leavesAt: NOW + i }));
const trimmed = trimToastStack(over);
console.log('trim of 51 (two owners, even/odd):', trimmed.length, '| dropped',
  over.map((e) => e.id).filter((id) => !trimmed.some((e) => e.id === id)).join(','));
const grown = [...over, entry({ id: 't51', owner: 'big', leavesAt: NOW + 51, isManaged: true })];
const trimmed2 = trimToastStack(grown);
console.log('trim of 52 with a managed last:', trimmed2.length, '| dropped',
  grown.map((e) => e.id).filter((id) => !trimmed2.some((e) => e.id === id)).join(','));

// The fold: fresh, spent, leaving and held entries.
const folded = foldToastStack([
  entry({ id: 'fresh', leavesAt: NOW + 1000 }),
  entry({ id: 'spent', leavesAt: NOW - 1, phase: 'shown' }),
  entry({ id: 'leaving', leavesAt: NOW - TOAST_LEAVING_MS - 1, phase: 'leaving' }),
  entry({ id: 'held', heldAt: NOW - TOAST_HOLD_REBASE_MS - 500, leavesAt: NOW + 100, phase: 'leaving' }),
], NOW);
console.log('folded:', JSON.stringify(folded));

// The writer: a stack that differs from the store is written, the same stack is not.
const clock = { pending: undefined as undefined | { unref: () => void }, pausedAt: undefined as undefined | number };
let unrefs = 0;
bindToastClock(clock);
const armed: number[] = [];
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = ((fn: () => void, ms: number) => {
  armed.push(ms);
  return { unref: () => { unrefs += 1; }, fire: fn } as unknown as NodeJS.Timeout;
}) as typeof globalThis.setTimeout;

clearChainRecords();
writeToastStack([entry({ id: 'one', leavesAt: NOW + 250 })], () => NOW);
console.log('after write: stored', JSON.stringify((stored.get(toastStackStateKey())?.value as { stack?: unknown } | undefined)?.stack ?? stored.get(toastStackStateKey())?.value));
console.log('after write: record', JSON.stringify(chainRecords().map((r) => r.message ?? r)));
console.log('after write: armed', JSON.stringify(armed), '| pending set', clock.pending !== undefined, '| unrefs', unrefs);

// Writing the same stack again: no store write, no report, but the fold still arms.
const before = JSON.stringify(stored.get(toastStackStateKey())?.value);
armed.length = 0;
writeToastStack([entry({ id: 'one', leavesAt: NOW + 250 })], () => NOW);
console.log('same stack: store unchanged', JSON.stringify(stored.get(toastStackStateKey())?.value) === before,
  '| armed', JSON.stringify(armed));

// A toast that left without being drawn is reported.
armed.length = 0;
clearChainRecords();
const survivor = entry({ id: 'kept', leavesAt: NOW + 100 });
writeToastStack([survivor], () => NOW);
console.log('undrawn: records', JSON.stringify(chainRecords().map((r) => r.message ?? r)));

// The timer: paused or empty arms nothing; otherwise the next deadline, at least 1ms.
clock.pending = undefined;
armed.length = 0;
const emptyStore = new Map(stored);
stored.delete(toastStackStateKey());
armToastTimer(() => NOW, () => { armed.push(-1); });
console.log('timer over an empty stack: armed', JSON.stringify(armed));
for (const [key, value] of emptyStore) stored.set(key, value);
clock.pausedAt = NOW;
armed.length = 0;
armToastTimer(() => NOW, () => { armed.push(-1); });
console.log('timer while paused: armed', JSON.stringify(armed));
clock.pausedAt = undefined;
armed.length = 0;
armToastTimer(() => NOW, () => { armed.push(-1); });
console.log('timer on a live stack: armed', JSON.stringify(armed));
globalThis.setTimeout = realSetTimeout;

// The label boundary.
try { pluginLabel('engine'); console.log('label: no throw'); }
catch (error) { console.log('label error:', (error as Error).name, (error as Error).message); }
try { hostToast({ plugin: 'engine', text: 'hi', timeoutMs: 4000 }); console.log('host toast: no throw'); }
catch (error) { console.log('host toast error:', (error as Error).name, (error as Error).message); }

// The undrawn report on its own is the same path the writer took.
clearChainRecords();
reportUndrawnToast(entry({ id: 'gone' }));
console.log('report: records', JSON.stringify(chainRecords().map((r) => r.message ?? r)));
off();
