// W45-79: the ui.press path — the link normalizer (`mxn`/`Rf`), the pressable-link guard (`nur`),
// the argument (`E_`), the dispatch (`BPn`), its terminal entry (`TIe`) and the settle wrapper
// (`Ohe`). Expected values were measured through the ported bodies (see .audit/w45-79-probe.txt).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import '../src/plugin-chain-registry.js';
import { installChainModule, chainRecords, clearChainRecords } from '../src/plugin-chain-host.js';
import { AK, Rto } from '../src/plugin-chain-press.js';
import { mxn, Cot, Yoo } from '../src/plugin-chain-press-url-source.js';
import { Rf, nur, E_, BPn, TIe, Ohe } from '../src/plugin-chain-press-dispatch-source.js';

type Held = Record<string, unknown>;

// The copied bodies answer a destructured argument whose every field they read; a dispatch call
// omits the ones it does not give, as the source's own callers do.
const dispatch = BPn as unknown as (input: Record<string, unknown>) => Promise<unknown>;
const terminalPress = TIe as unknown as (input: Record<string, unknown>, link: unknown) => void;
const normalizeGuard = nur as unknown as (href: string, links?: readonly string[]) => boolean;

const pressed: Array<{ handle: number; argument: unknown }> = [];
function installFixture(name: string): () => void {
  return installChainModule({
    name,
    hooks: () => false,
    record: () => ({ name, tier: 'core', run: () => undefined }) as never,
    press: (handle, argument) => {
      pressed.push({ handle, argument });
      return { ok: true };
    },
  });
}

const identity = (requestId: string) => ({ component: 'Fixture', requestId, surface: 'terminal' });
const element = (type: string, key: string, handle: number, plugin: string, props: Record<string, unknown> = {}): Held =>
  ({ type, props: { key, ...props }, press: { plugin, handle } });
const drawing = (children: Held[]): Held => ({ type: 'Box', props: {}, children });

const parts = (hosted: unknown): Held[] => ((hosted as Held).children as Held[]);
const press = (part: Held): { plugin: string; handle: number } => part.press as { plugin: string; handle: number };

describe('the link normalizer', () => {
  it('keeps a web href, prefixes a bare host and leaves a relative href raw', () => {
    assert.equal(Rf('https://example.com/a'), 'https://example.com/a');
    assert.equal(Rf('www.example.com/x'), 'http://www.example.com/x');
    assert.equal(Rf('../x'), '../x');
    assert.equal(Rf('//server/share/x'), '//server/share/x');
  });

  it('turns an absolute path into a file URL and keeps the query and fragment', () => {
    assert.equal(Rf('/tmp/a b'), 'file:///tmp/a%20b');
    assert.equal(Rf('file:///tmp/x'), 'file:///tmp/x');
    assert.equal(Rf('/'), 'file:///');
    assert.equal(mxn('/tmp/x?q=1#f'), 'file:///tmp/x?q=1#f');
    assert.equal(mxn('file://localhost/tmp/x'), 'file:///tmp/x');
    assert.equal(mxn('/'), 'file:///');
    assert.equal(mxn(''), '');
  });

  it('collapses a dot-dot path before it becomes a URL', () => {
    assert.equal(mxn('/tmp/../etc/passwd'), 'file:///etc/passwd');
    assert.equal(mxn('file:///tmp/%2e%2e/etc'), 'file:///etc');
  });

  it('reports no traversal for a plain or relative dot-dot path', () => {
    assert.equal(Cot('../etc'), false);
    assert.equal(Cot('a/../b'), false);
    assert.equal(Yoo('file:///tmp/../x'), false);
  });
});

describe('the pressable-link guard', () => {
  it('accepts any link when the drawing declared none', () => {
    assert.equal(normalizeGuard('https://x'), true);
  });

  it('compares the normalized forms', () => {
    assert.equal(normalizeGuard('https://example.com/a', ['https://example.com/a']), true);
    assert.equal(normalizeGuard('https://example.com', ['https://example.com/']), true);
    assert.equal(normalizeGuard('/tmp/a%20b', ['file:///tmp/a b']), true);
    assert.equal(normalizeGuard('file:///tmp/../etc', ['file:///etc']), true);
    assert.equal(normalizeGuard('https://y', ['https://example.com/a']), false);
    assert.equal(normalizeGuard('https://example.com/a', ['www.example.com/a']), false);
  });
});

describe('the ui.press dispatch', () => {
  it('runs the held Button and answers its element', async () => {
    const name = 'press-b1';
    const uninstall = installFixture(name);
    pressed.length = 0;
    const hosted = Rto(drawing([element('Button', 'b1', 1, name)]), identity('b1'));
    const handle = press(parts(hosted)[0]).handle;
    const result = await dispatch({ plugin: name, handle, surface: 'terminal' });
    assert.deepEqual(result, { element: 'b1' });
    assert.deepEqual(pressed.at(-1), {
      handle: 1,
      argument: { plugin: name, element: 'b1', component: 'Fixture', requestId: 'b1', surface: 'terminal' },
    });
    AK.forgetPresses(name);
    uninstall();
  });

  it('has no full-key fallback: a handle the store does not hold runs nothing', async () => {
    const name = 'press-nokey';
    const uninstall = installFixture(name);
    pressed.length = 0;
    Rto(drawing([element('Button', 'b1', 2, name)]), identity('nokey'));
    clearChainRecords();
    const result = await dispatch({ plugin: name, handle: -1, element: 'b1', surface: 'terminal' });
    assert.equal(result, undefined);
    assert.deepEqual(pressed, []);
    assert.deepEqual(chainRecords().at(-1), {
      kind: 'log', level: 'debug',
      message: `ui.press: no Button of ${name} is held under handle -1 and the key the press names; nothing ran`,
    });
    AK.forgetPresses(name);
    uninstall();
  });

  it('names the missing key only when the dispatch gave one', async () => {
    const name = 'press-miss';
    const uninstall = installFixture(name);
    pressed.length = 0;
    clearChainRecords();
    await dispatch({ plugin: name, handle: -1, element: 'nope', surface: 'terminal' });
    assert.equal(
      (chainRecords().at(-1) as { message?: string }).message,
      `ui.press: no Button of ${name} is held under handle -1 and the key the press names; nothing ran`,
    );
    clearChainRecords();
    await dispatch({ plugin: name, handle: -1, surface: 'terminal' });
    assert.equal(
      (chainRecords().at(-1) as { message?: string }).message,
      `ui.press: no Button of ${name} is held under handle -1; nothing ran`,
    );
    uninstall();
  });

  it('runs a Markdown press only when its link is one the drawing declared', async () => {
    const name = 'press-md';
    const uninstall = installFixture(name);
    pressed.length = 0;
    const hosted = Rto(
      drawing([element('Markdown', 'm1', 11, name, { pressableLinks: ['https://example.com/a', '/tmp/a b'] })]),
      identity('md'),
    );
    const handle = press(parts(hosted)[0]).handle;
    const ok = await dispatch({ plugin: name, handle, surface: 'terminal', link: { href: 'https://example.com/a' } });
    assert.deepEqual(ok, { element: 'm1' });
    assert.deepEqual(pressed.at(-1), {
      handle: 11,
      argument: {
        plugin: name, element: 'm1', component: 'Fixture', requestId: 'md', surface: 'terminal',
        link: { href: 'https://example.com/a' },
      },
    });
    pressed.length = 0;
    assert.deepEqual(
      await dispatch({ plugin: name, handle, surface: 'terminal', link: { href: '/tmp/a%20b' } }),
      { element: 'm1' },
    );
    pressed.length = 0;
    clearChainRecords();
    const refused = await dispatch({ plugin: name, handle, surface: 'terminal', link: { href: 'https://y' } });
    assert.equal(refused, undefined);
    assert.deepEqual(pressed, []);
    assert.equal(
      (chainRecords().at(-1) as { message?: string }).message,
      `ui.press: the Markdown ${name} holds under handle ${handle} names that link none of its own; nothing ran`,
    );
    AK.forgetPresses(name);
    uninstall();
  });

  it('refuses a Markdown press drawn while the dispatch named no link', async () => {
    const name = 'press-tag';
    const uninstall = installFixture(name);
    pressed.length = 0;
    const hosted = Rto(drawing([element('Markdown', 'm1', 12, name, { pressableLinks: ['https://x'] })]), identity('tag'));
    clearChainRecords();
    const result = await dispatch({ plugin: name, handle: press(parts(hosted)[0]).handle, surface: 'terminal' });
    assert.equal(result, undefined);
    assert.deepEqual(pressed, []);
    assert.equal(
      (chainRecords().at(-1) as { message?: string }).message,
      `ui.press: no Button of ${name} is held under handle ${press(parts(hosted)[0]).handle}; nothing ran`,
    );
    AK.forgetPresses(name);
    uninstall();
  });

  it('rejects when the drawing plugin is not loaded', async () => {
    const name = 'ghost-direct';
    const hosted = Rto(drawing([element('Button', 'g1', 13, name)]), identity('ghost'));
    await assert.rejects(
      dispatch({ plugin: name, handle: press(parts(hosted)[0]).handle, surface: 'terminal' }),
      { message: `ui.press: ${name}, which drew g1, is not loaded` },
    );
    AK.forgetPresses(name);
  });

  it('answers the argument the dispatch builds', () => {
    const held = { plugin: 'p', element: 'e', component: 'C', requestId: 'r', surface: 'terminal' };
    assert.deepEqual(E_(held, 'terminal', undefined), held);
    assert.deepEqual(E_(held, 'terminal', { href: 'https://x' }), { ...held, link: { href: 'https://x' } });
  });
});

describe('the terminal press entry', () => {
  it('starts the dispatch without waiting and logs the press once it lands', async () => {
    const name = 'press-tie';
    const uninstall = installFixture(name);
    pressed.length = 0;
    const hosted = Rto(drawing([element('Button', 'b1', 14, name)]), identity('tie'));
    assert.equal(terminalPress({ plugin: name, handle: press(parts(hosted)[0]).handle }, undefined), undefined);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(pressed.at(-1), {
      handle: 14,
      argument: { plugin: name, element: 'b1', component: 'Fixture', requestId: 'tie', surface: 'terminal' },
    });
    AK.forgetPresses(name);
    uninstall();
  });

  it('logs a rejected dispatch through the settle wrapper', async () => {
    const name = 'ghost-tie';
    const hosted = Rto(drawing([element('Button', 'g1', 15, name)]), identity('ghost-tie'));
    clearChainRecords();
    terminalPress({ plugin: name, handle: press(parts(hosted)[0]).handle }, undefined);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(chainRecords().at(-1), {
      kind: 'log', level: 'error',
      message: `ui.press ${name}: ui.press: ${name}, which drew g1, is not loaded`,
    });
    AK.forgetPresses(name);
  });
});

describe('the settle wrapper', () => {
  it('passes a value through and turns a rejection into a log line', async () => {
    clearChainRecords();
    assert.equal(await Ohe('probe', Promise.resolve(7)), 7);
    assert.deepEqual(chainRecords(), []);
    assert.equal(await Ohe('probe', Promise.reject(new Error('boom'))), undefined);
    assert.deepEqual(chainRecords().at(-1), { kind: 'log', level: 'error', message: 'probe: boom' });
  });
});
