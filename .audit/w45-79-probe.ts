// W45-79 probe: the link normalizer (`mxn`/`Rf`), the pressable-link guard (`nur`), the ui.press
// dispatch (`BPn`), its terminal entry (`TIe`) and the settle wrapper (`Ohe`). Values printed here
// belong in test/plugin-chain-press-dispatch.test.ts.
import '../src/plugin-chain-registry.js';
import { installChainModule, chainRecords, clearChainRecords } from '../src/plugin-chain-host.js';
import { AK, Rto } from '../src/plugin-chain-press.js';
import { mxn, Cot, Yoo } from '../src/plugin-chain-press-url-source.js';
import { Rf, nur, E_, BPn, TIe, Ohe } from '../src/plugin-chain-press-dispatch-source.js';

const pressed: Array<{ handle: number; argument: unknown }> = [];
const uninstall = installChainModule({
  name: 'dispatch-fixture',
  hooks: () => false,
  record: () => ({ name: 'dispatch-fixture', tier: 'core', run: () => undefined }) as never,
  press: (handle, argument) => {
    pressed.push({ handle, argument });
    return { ok: true };
  },
});

const identity = { component: 'Fixture', requestId: 'r1', surface: 'terminal' };
const held = (type: string, key: string, handle: number, props: Record<string, unknown>) =>
  ({ type, props: { key, ...props }, press: { plugin: 'dispatch-fixture', handle } });
const drawing = { type: 'Box', props: {}, children: [held('Button', 'b1', 1, {}), held('Markdown', 'm1', 2, { pressableLinks: ['https://example.com/a', '/tmp/a b'] })] };

console.log('Rf url', Rf('https://example.com/a'));
console.log('Rf www', Rf('www.example.com/x'));
console.log('Rf abs', Rf('/tmp/a b'));
console.log('Rf file', Rf('file:///tmp/x'));
console.log('Rf unc', Rf('//server/share/x'));
console.log('Rf rel', Rf('../x'));
console.log('mxn traversal', mxn('/tmp/../etc/passwd'));
console.log('mxn query', mxn('/tmp/x?q=1#f'));
console.log('mxn localhost', mxn('file://localhost/tmp/x'));
console.log('mxn encoded traversal', mxn('file:///tmp/%2e%2e/etc'));
console.log('mxn drive', mxn('/C:/x'), mxn('C:/x'));
console.log('Cot', Cot('../etc'), Cot('a/../b'), Yoo('file:///tmp/../x'));
console.log('nur none', nur('https://x'));
console.log('nur same', nur('https://example.com/a', ['https://example.com/a']));
console.log('nur slash', nur('https://example.com', ['https://example.com/']));
console.log('nur file', nur('/tmp/a%20b', ['file:///tmp/a b']));
console.log('nur other', nur('https://y', ['https://example.com/a']));
console.log('nur traversal', nur('file:///tmp/../etc', ['file:///etc']));

const hosted = Rto(drawing, identity);
const press = (value: unknown): Record<string, unknown> => value as Record<string, unknown>;
const buttons = (press(press(hosted).children as unknown[])[0]);
const markdown = (press((press(hosted).children as unknown[])[1]));
console.log('hosted', JSON.stringify(press(hosted).children));

pressed.length = 0;
const byHandle = await BPn({ plugin: 'dispatch-fixture', handle: buttons.press?.handle, surface: 'terminal' });
console.log('BPn button', JSON.stringify(byHandle), JSON.stringify(pressed.at(-1)));

pressed.length = 0;
const byKey = await BPn({ plugin: 'dispatch-fixture', handle: -1, element: 'b1', surface: 'terminal' });
console.log('BPn byKey', JSON.stringify(byKey));

pressed.length = 0;
const missing = await BPn({ plugin: 'dispatch-fixture', handle: -1, element: 'nope', surface: 'terminal' });
console.log('BPn missing', missing, pressed.length);

pressed.length = 0;
const linkOk = await BPn({ plugin: 'dispatch-fixture', handle: markdown.press?.handle, surface: 'terminal', link: { href: 'https://example.com/a' } });
console.log('BPn link ok', JSON.stringify(linkOk), JSON.stringify(pressed.at(-1)));

pressed.length = 0;
const linkSame = await BPn({ plugin: 'dispatch-fixture', handle: markdown.press?.handle, surface: 'terminal', link: { href: '/tmp/a%20b' } });
console.log('BPn link file', JSON.stringify(linkSame));
pressed.length = 0;
const linkBad = await BPn({ plugin: 'dispatch-fixture', handle: markdown.press?.handle, surface: 'terminal', link: { href: 'https://y' } });
console.log('BPn link bad', linkBad, pressed.length);

pressed.length = 0;
const markdownAsButton = await BPn({ plugin: 'dispatch-fixture', handle: markdown.press?.handle, surface: 'terminal' });
console.log('BPn tag mismatch', markdownAsButton, pressed.length);

clearChainRecords();
const settled = Ohe('probe', Promise.reject(new Error('boom')));
console.log('Ohe result', await settled, JSON.stringify(chainRecords().at(-1)));

pressed.length = 0;
const terminal = TIe({ plugin: 'dispatch-fixture', handle: buttons.press?.handle }, undefined);
console.log('TIe return', terminal);
await new Promise((resolve) => setTimeout(resolve, 20));
console.log('TIe pressed', JSON.stringify(pressed.at(-1)));

clearChainRecords();
TIe({ plugin: 'ghost', handle: 999 }, undefined);
await new Promise((resolve) => setTimeout(resolve, 20));
console.log('TIe ghost log', JSON.stringify(chainRecords().at(-1)));

console.log('E_', JSON.stringify(E_({ plugin: 'p', element: 'e', component: 'C', requestId: 'r', surface: 'terminal' }, 'terminal', undefined)));
console.log('E_ link', JSON.stringify(E_({ plugin: 'p', element: 'e', component: 'C', requestId: 'r', surface: 'terminal' }, 'terminal', { href: 'https://x' })));

AK.forgetPresses('dispatch-fixture');
uninstall();

console.log('mxn empty', JSON.stringify(mxn('')), 'slash', mxn('/'), 'Rf slash', Rf('/'));
console.log('nur www', nur('https://example.com/a', ['www.example.com/a']));

const uninstall2 = installChainModule({
  name: 'dispatch-fixture',
  hooks: () => false,
  record: () => ({ name: 'dispatch-fixture', tier: 'core', run: () => undefined }) as never,
  press: (handle, argument) => {
    pressed.push({ handle, argument });
    return { ok: true };
  },
});
const hosted2 = Rto({
  type: 'Box',
  props: {},
  children: [held('Button', 'b9', 21, {}), held('Markdown', 'm9', 22, { pressableLinks: ['https://example.com/a'] })],
}, { ...identity, requestId: 'r3' });
const parts2 = press(hosted2).children as Array<Record<string, unknown>>;
const m9 = Number((parts2[1].press as Record<string, unknown>).handle);

clearChainRecords();
const refused = await BPn({ plugin: 'dispatch-fixture', handle: m9, surface: 'terminal', link: { href: 'https://y' } });
console.log('BPn link refused', refused, JSON.stringify(chainRecords().at(-1)));
clearChainRecords();
await BPn({ plugin: 'dispatch-fixture', handle: -1, element: 'nope', surface: 'terminal' });
console.log('BPn missing log', JSON.stringify(chainRecords().at(-1)));

const ghostHosted = Rto({
  type: 'Box',
  props: {},
  children: [{ type: 'Button', props: { key: 'g1' }, press: { plugin: 'ghost', handle: 11 } }],
}, { ...identity, requestId: 'r4' });
const ghostHandle = Number(((press(ghostHosted).children as Array<Record<string, unknown>>)[0].press as Record<string, unknown>).handle);
clearChainRecords();
TIe({ plugin: 'ghost', handle: ghostHandle }, undefined);
await new Promise((resolve) => setTimeout(resolve, 20));
console.log('TIe ghost held log', JSON.stringify(chainRecords().at(-1)));

AK.forgetPresses('dispatch-fixture');
AK.forgetPresses('ghost');
uninstall2();
