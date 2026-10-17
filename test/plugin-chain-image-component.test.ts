// W45-76: the Image site component and its resolver — the alt decision (`Eo`), the refusal log (`Ho`),
// the transmit builder (`or`), the id width (`vo`), the mount registration (`Mo`), the file-read probe
// (`Lo`/`dt`), the resolver (`Ao`) and the component (`No`). Expected values were measured through the
// ported bodies with the host seam configured (see .audit/w45-76-probe.txt).
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import {
  E, uFo, Eo, dt, or, Ho, vo, Mo, Oo, No, xi, gi,
} from '../src/plugin-chain-image-component.js';
import { ee, runComponent } from '../src/plugin-chain-react-surface.js';
import { CapabilityReadings, ImageFileProbe } from '../src/plugin-chain-terminal-capabilities.js';
import type { CapabilityStore } from '../src/plugin-chain-terminal-capabilities.js';
import { configureImageHost, resetImageHost, ge } from '../src/plugin-chain-image-host.js';
import { cFo, lFo } from '../src/plugin-chain-image-wire.js';
import { Dss } from '../src/plugin-chain-image-model.js';
import { Yj, e5t } from '../src/plugin-chain-ui-blit-source.js';
import { chainRecords, clearChainRecords } from '../src/plugin-chain-host.js';

const CONTEXTS = new Map([[ee, { requestId: 'req' }]]);
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const settledCapabilities = (kittyGraphics: boolean): CapabilityStore => new CapabilityReadings({
  extendedKeys: { settled: false, source: 'probe' },
  synchronizedOutput: { settled: false, source: 'probe' },
  kittyKeyboard: { settled: false, source: 'probe' },
  kittyGraphics: { settled: kittyGraphics, source: 'probe' },
  mousePixels: { settled: false, source: 'probe' },
  programStatus: { settled: false, source: 'probe' },
});

interface Client {
  sends: Array<{ id: number; resend: boolean; built: string }>;
  allocated: number[];
  freed: number[];
  nextId: number;
  accept: boolean;
  backedUp: boolean;
  allocate(width: number): number | undefined;
  free(id: number): void;
  transmit(id: number, build: (id: number) => string, options: { resend: boolean }): boolean;
  isBackedUp(id: number): boolean;
}

function terminalClient(): Client {
  return {
    sends: [],
    allocated: [],
    freed: [],
    nextId: 9,
    accept: true,
    backedUp: false,
    allocate(width: number): number | undefined {
      this.allocated.push(width);
      return this.nextId;
    },
    free(id: number): void { this.freed.push(id); },
    transmit(id: number, build: (id: number) => string, options: { resend: boolean }): boolean {
      this.sends.push({ id, resend: options.resend, built: build(id) });
      return this.accept;
    },
    isBackedUp(): boolean { return this.backedUp; },
  };
}

function querier(response: { message: string } | undefined, flush: boolean) {
  const requests: string[] = [];
  return {
    requests,
    send(query: { request: string }): Promise<{ message: string } | undefined> {
      requests.push(query.request);
      return Promise.resolve(response);
    },
    flush(): Promise<boolean> { return Promise.resolve(flush); },
  };
}

const placeholders = (value: boolean) => ({ state: 'settled' as const, value, source: value ? 'probe' : 'probe: none' });
const files = (state: 'unasked' | 'asking' | 'settled', value?: boolean, source?: string) => (
  state === 'settled' ? { state, value, source } : { state }
);

beforeEach(() => {
  resetImageHost();
  Yj().clear();
  clearChainRecords();
});

describe('the probe helpers', () => {
  it('reads an error code and nothing else', () => {
    assert.equal(E({ code: 'EAGAIN' }), 'EAGAIN');
    assert.equal(E(new Error('x')), undefined);
    assert.equal(E(null), undefined);
    assert.deepEqual([...gi], ['EAGAIN', 'EBUSY', 'EINTR', 'EMFILE', 'ENFILE', 'ENOSPC']);
    assert.equal(xi, 24);
  });

  it('builds the file-read probe query', () => {
    assert.equal(uFo(7, '/tmp/x.rgba'), '\x1b_Gi=7,s=1,v=1,a=q,t=f,f=32;L3RtcC94LnJnYmE=\x1b\\');
  });
});

describe('the alt decision', () => {
  it('names the first reason the alt is drawn', () => {
    assert.equal(
      Eo({ hasRoot: false, placeholders: placeholders(true), hasId: true, isReference: false, files: files('settled', true, 'p') }),
      'the Image is not drawn under a terminal root',
    );
    assert.equal(
      Eo({ hasRoot: true, placeholders: placeholders(false), hasId: true, isReference: false, files: files('settled', true, 'p') }),
      'the Image draws its alt here: the terminal draws no placeholder images (probe: none)',
    );
    assert.equal(
      Eo({ hasRoot: true, placeholders: placeholders(true), hasId: false, isReference: false, files: files('settled', true, 'p') }),
      'the Image draws its alt here: every 8-bit image id is in use',
    );
    assert.equal(
      Eo({ hasRoot: true, placeholders: placeholders(true), hasId: true, isReference: true, files: files('unasked') }),
      'the terminal has not yet said whether it reads files on this machine; asked now, blit again',
    );
    assert.equal(
      Eo({ hasRoot: true, placeholders: placeholders(true), hasId: true, isReference: true, files: files('settled', false, 'probe: no reply') }),
      'the Image draws its alt here: this terminal cannot read files on this machine (probe: no reply); a { file } or { shm } source shows nothing, bytes still draw',
    );
  });

  it('lets an inline source draw even when the terminal cannot read files', () => {
    assert.equal(
      Eo({ hasRoot: true, placeholders: placeholders(true), hasId: true, isReference: false, files: files('settled', false, 'p') }),
      undefined,
    );
    assert.equal(
      Eo({ hasRoot: true, placeholders: placeholders(true), hasId: true, isReference: true, files: files('settled', true, 'p') }),
      undefined,
    );
  });
});

describe('the refusal log', () => {
  it('reports the first refusal and a changed one, and drops the repeat', () => {
    const refusal = Ho({ plugin: 'plug', requestId: 'req', key: 'k' });
    refusal('one');
    refusal('one');
    refusal('two');
    assert.deepEqual(
      chainRecords().map((record) => (record as { message?: string }).message),
      [
        'Image "k" (plug) in req: the terminal refused its source: one',
        'Image "k" (plug) in req: the terminal refused its source: two',
      ],
    );
  });
});

describe('the transmit builder', () => {
  it('builds the inline and the file source against an id', () => {
    assert.equal(
      or({ source: { png: 'TQ==' }, columns: 2, rows: 1 })(5),
      cFo({ id: 5, columns: 2, rows: 1, source: Dss({ png: 'TQ==' }) }),
    );
    assert.equal(
      or({ source: { file: '/a.png', format: 'png' }, columns: 1, rows: 1 })(6),
      '\x1b_Ga=T,U=1,q=1,f=100,t=f,i=6,c=1,r=1;L2EucG5n\x1b\\',
    );
  });
});

describe('the id width', () => {
  it('is undefined below indexed colour and 8 or 24 bits above it', () => {
    const widthAt = (level: number, graphics: boolean): unknown => {
      resetImageHost();
      configureImageHost({ capabilityLevel: level, capabilities: settledCapabilities(graphics) });
      const run = runComponent(() => vo());
      const width = run.result;
      run.unmount();
      return width;
    };
    assert.equal(widthAt(0, true), undefined);
    assert.equal(widthAt(1, true), undefined);
    assert.equal(widthAt(2, true), 8);
    assert.equal(widthAt(3, true), 24);
    assert.equal(widthAt(3, false), undefined);
  });
});

describe('the mount registration', () => {
  it('registers the alt answer under the site key and drops it on unmount', () => {
    const run = runComponent(() => Mo({ plugin: 'plug', requestId: 'req', key: 'k' }, { columns: 2, rows: 1 }, () => 'ALT'));
    const row = Yj().get(e5t('req', 'k', 'plug'));
    assert.ok(row);
    assert.equal(row!.images.size, 1);
    const mount = [...row!.images][0] as unknown as { key: string; columns: number; rows: number; swap: unknown };
    assert.equal(mount.key, 'k');
    assert.equal(mount.columns, 2);
    assert.equal(mount.rows, 1);
    assert.equal(typeof mount.swap, 'function');
    run.unmount();
    assert.equal(Yj().get(e5t('req', 'k', 'plug')), undefined);
  });
});

describe('the file-read probe', () => {
  it('starts from the store reading', () => {
    configureImageHost({ imageFiles: new ImageFileProbe() });
    const run = runComponent(() => Oo(false));
    assert.deepEqual(run.result, { state: 'unasked' });
    run.unmount();
  });

  it('settles the store with the terminal answer and removes its temp file', async () => {
    const client = terminalClient();
    const query = querier({ message: 'OK' }, true);
    const store = new ImageFileProbe();
    configureImageHost({
      terminalImages: client,
      internalQuerier: query,
      imageFiles: store,
      capabilities: settledCapabilities(true),
    });
    dt(query as never, client as never);
    await sleep(30);
    assert.deepEqual(store.get(), { state: 'settled', value: true, source: 'probe: file query answered OK' });
    assert.deepEqual(client.allocated, [24]);
    const request = query.requests[0]!;
    assert.ok(request.startsWith('\x1b_Gi=9,s=1,v=1,a=q,t=f,f=32;'));
    const path = Buffer.from(request.slice(request.indexOf(';') + 1, -2), 'base64').toString('utf8');
    assert.match(path, /tty-graphics-protocol-[0-9a-f]+\.rgba$/);
    assert.equal(existsSync(path), false);
  });

  it('settles false when the terminal gives no reply but the query was flushed', async () => {
    const client = terminalClient();
    const query = querier(undefined, true);
    const store = new ImageFileProbe();
    configureImageHost({
      terminalImages: client,
      internalQuerier: query,
      imageFiles: store,
      capabilities: settledCapabilities(true),
    });
    dt(query as never, client as never);
    await sleep(30);
    assert.deepEqual(store.get(), { state: 'settled', value: false, source: 'probe: no reply to the file query' });
  });

  it('leaves the question unasked when the query was dropped', async () => {
    const client = terminalClient();
    const query = querier(undefined, false);
    const store = new ImageFileProbe();
    configureImageHost({
      terminalImages: client,
      internalQuerier: query,
      imageFiles: store,
      capabilities: settledCapabilities(true),
    });
    dt(query as never, client as never);
    await sleep(30);
    assert.deepEqual(store.get(), { state: 'unasked' });
  });
});

describe('the Image component', () => {
  it('draws an inline source as a Box holding the raw-ansi alt for the transmitted id', () => {
    const client = terminalClient();
    configureImageHost({
      terminalImages: client,
      capabilityLevel: 3,
      capabilities: settledCapabilities(true),
      imageFiles: new ImageFileProbe(),
    });
    const source = { png: 'TQ==' };
    const run = runComponent(
      () => No({ plugin: 'plug', elementKey: 'k', source, columns: 2, rows: 1, alt: 'ALT' }),
      { contexts: CONTEXTS },
    );
    assert.equal(run.root!.type, 'Box');
    assert.deepEqual(run.root!.props, {
      flexShrink: 0, width: 2, height: 1, overflow: 'hidden', elementKey: 'k', elementPlugin: 'plug',
    });
    const child = run.root!.children[0] as { type: unknown; props: Record<string, unknown> };
    assert.equal(child.type, 'ink-raw-ansi');
    assert.equal(child.props.rawText, lFo(9, 2, 1));
    assert.equal(child.props.rawWidth, 2);
    assert.equal(child.props.rawHeight, 1);
    assert.deepEqual(client.sends, [{
      id: 9,
      resend: true,
      built: cFo({ id: 9, columns: 2, rows: 1, source: Dss(source) }),
    }]);
    run.unmount();
    assert.deepEqual(client.freed, [9]);
  });

  it('draws the alt text when no terminal client is configured', () => {
    const run = runComponent(
      () => No({ plugin: 'plug', elementKey: 'k', source: { png: 'TQ==' }, columns: 2, rows: 1, alt: 'ALT' }),
      { contexts: CONTEXTS },
    );
    assert.equal(run.root!.type, 'Text');
    assert.deepEqual(run.root!.props, { dimColor: true });
    assert.deepEqual(run.root!.children, ['ALT']);
    run.unmount();
  });

  it('answers the mounted alt with the cannot-read-files message for a file source', () => {
    const client = terminalClient();
    const store = new ImageFileProbe();
    store.begin();
    store.answer({ value: false, source: 'probe: no reply to the file query' });
    configureImageHost({
      terminalImages: client,
      capabilityLevel: 3,
      capabilities: settledCapabilities(true),
      imageFiles: store,
    });
    const source = { file: '/a.png', format: 'png' };
    const run = runComponent(
      () => No({ plugin: 'plug', elementKey: 'k', source, columns: 2, rows: 1, alt: 'ALT' }),
      { contexts: CONTEXTS },
    );
    assert.equal(run.root!.type, 'Text');
    const row = Yj().get(e5t('req', 'k', 'plug'));
    const mount = [...row!.images][0] as unknown as { swap: (source: unknown) => unknown };
    assert.equal(
      mount.swap(source),
      'the Image draws its alt here: this terminal cannot read files on this machine (probe: no reply to the file query); a { file } or { shm } source shows nothing, bytes still draw',
    );
    run.unmount();
  });
});
