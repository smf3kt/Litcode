// W45-53 probe: measure `settings.read` with a bound store and without one, before anything is
// asserted about it.
import fs from 'node:fs';
import {
  bindSettingsStore, checkSettingsRead, copySettingsValue, readSettings, SETTINGS_SOURCES,
} from '../src/plugin-chain-settings.js';

const seen: Array<[string, unknown]> = [];
const store = {
  all: () => ({ theme: 'dark', maxProseWidth: 100 }),
  one: (source: string | undefined) => {
    seen.push(['one', source]);
    if (source === undefined) return undefined;
    if (source === 'flagSettings') return null;
    return { from: source };
  },
};

console.log('sources:', JSON.stringify(SETTINGS_SOURCES));
console.log('check:', JSON.stringify(checkSettingsRead(undefined)), JSON.stringify(checkSettingsRead({})),
  JSON.stringify(checkSettingsRead({ source: 'user' })), JSON.stringify(checkSettingsRead({ source: 'nope' })),
  JSON.stringify(checkSettingsRead({ source: 1 })), JSON.stringify(checkSettingsRead('user')),
  JSON.stringify(checkSettingsRead(null)));

console.log('copy:', JSON.stringify(copySettingsValue(undefined)), JSON.stringify(copySettingsValue({ a: 1 })),
  JSON.stringify(copySettingsValue(null)));

bindSettingsStore(store);
console.log('merged:', JSON.stringify(await readSettings({})));
console.log('one source:', JSON.stringify(await readSettings({ source: 'user' })));

const merged = await readSettings({}) as Record<string, unknown>;
const direct = store.all() as Record<string, unknown>;
console.log('copy is independent:', merged !== direct, '| same shape:', JSON.stringify(merged) === JSON.stringify(direct));
merged.theme = 'mutated';
console.log('store untouched:', direct.theme);

console.log('a source the store answers null for:', JSON.stringify(await readSettings({ source: 'flag' })));
console.log('a source the store does not know:', JSON.stringify(await readSettings({ source: 'policy' })));
console.log('an unknown name with no check:', JSON.stringify(await readSettings({ source: 'bogus' })));
console.log('seen by the store:', JSON.stringify(seen));

const circular: Record<string, unknown> = {};
circular.self = circular;
try { await readSettings({ source: 'local' }) && store.all !== undefined; } catch { /* not this branch */ }
bindSettingsStore({ all: () => circular, one: () => ({}) });
try { console.log('circular:', JSON.stringify(await readSettings({}))); }
catch (error: any) { console.log('circular threw:', error?.name, JSON.stringify(String(error?.message).slice(0, 80))); }

bindSettingsStore(undefined);
try { await readSettings({}); console.log('unbound answered'); }
catch (error: any) { console.log('unbound threw:', JSON.stringify(error?.message)); }
try { console.log(checkSettingsRead(undefined)); await readSettings({ source: 'user' }); }
catch (error: any) { console.log('unbound with a source threw:', JSON.stringify(error?.message)); }

console.log('fs import used:', typeof fs);
