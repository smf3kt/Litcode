import '../src/plugin-chain-registry.js';
import { tickLedger } from '../src/plugin-chain-notify.js';
import { splitToastQueue, DEFAULT_TOAST_TIMEOUT_MS } from '../src/plugin-chain-ui.js';
const key = (id: string) => 'plugin-toast-' + id + ':fixture-bar';
const toast = (k: string, leftMs: number, extra: any = {}) => ({
  key: k, plugin: 'fixture-bar', text: k, isManaged: false, leftMs, wasShown: false, lentMs: 0, untoldMs: 0, ...extra,
});
const n = { current: { key: key('k1'), timeoutMs: 4000 }, queue: [] as any[] };
const sp = () => splitToastQueue(n, false, DEFAULT_TOAST_TIMEOUT_MS);
const stored0 = { toasts: [toast(key('k1'), 4000)], at: 0, slot: void 0 };
const t0 = tickLedger({ toasts: [], at: 0, slot: void 0 }, stored0, sp(), 0);
console.log('t0', JSON.stringify(t0));
const t1 = tickLedger(t0.ledger, t0.ledger, sp(), 1000);
console.log('t1', JSON.stringify(t1.ledger), [...t1.texts]);
const t2 = tickLedger(t1.ledger, t1.ledger, sp(), 5000);
console.log('t5', JSON.stringify(t2.ledger));
console.log('d0', (await import('../src/plugin-chain-notify.js')).nextTickDelayMs(t0.ledger));
