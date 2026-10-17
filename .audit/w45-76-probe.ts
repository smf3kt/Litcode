// W45-76 probe: measure the Image resolver, its file probe and the site component through the host
// seam, before any assertion.
import {
  E, uFo, Eo, Lo, tr, rr, dt, or, Ho, xt, Ke, vo, Mo, Oo, Ao, No, xi, hi, yi, gi,
} from '../src/plugin-chain-image-component.js';
import { ee, runComponent } from '../src/plugin-chain-react-surface.js';
import { CapabilityReadings, ImageFileProbe } from '../src/plugin-chain-terminal-capabilities.js';
import { configureImageHost, resetImageHost, ge } from '../src/plugin-chain-image-host.js';
import { cFo, lFo } from '../src/plugin-chain-image-wire.js';
import { Dss } from '../src/plugin-chain-image-model.js';
import { Yj, e5t } from '../src/plugin-chain-ui-blit-source.js';
import { chainRecords, clearChainRecords } from '../src/plugin-chain-host.js';

const out: string[] = [];
const show = (label: string, value: unknown): void => out.push(`${label} = ${JSON.stringify(value)}`);

const settledCapabilities = (kittyGraphics: boolean) => new CapabilityReadings({
  extendedKeys: { settled: false, source: 'probe' },
  synchronizedOutput: { settled: false, source: 'probe' },
  kittyKeyboard: { settled: false, source: 'probe' },
  kittyGraphics: { settled: kittyGraphics, source: 'probe' },
  mousePixels: { settled: false, source: 'probe' },
  programStatus: { settled: false, source: 'probe' },
});

function terminalClient() {
  const sends: Array<{ id: number; resend: boolean; built: string }> = [];
  const allocated: number[] = [];
  const freed: number[] = [];
  return {
    sends,
    allocated,
    freed,
    nextId: 9,
    accept: true,
    backedUp: false,
    allocate(width: number): number | undefined {
      allocated.push(width);
      return this.nextId;
    },
    free(id: number): void { freed.push(id); },
    transmit(id: number, build: (id: number) => string, options: { resend: boolean }): boolean {
      sends.push({ id, resend: options.resend, built: build(id) });
      return this.accept;
    },
    isBackedUp(): boolean { return this.backedUp; },
  };
}

function querier(answer: () => Promise<{ message: string } | undefined>, flush: boolean) {
  const requests: string[] = [];
  return {
    requests,
    send(query: { request: string }): Promise<{ message: string } | undefined> {
      requests.push(query.request);
      return answer();
    },
    flush(): Promise<boolean> { return Promise.resolve(flush); },
  };
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

show('constants', { xi, hi, yi, gi: [...gi] });
show('E', [E({ code: 'EAGAIN' }), E(new Error('x')), E(null)]);
show('uFo', uFo(7, '/tmp/x.rgba'));

const placeholdersSettled = { state: 'settled', value: true, source: 'probe' };
const placeholdersUnset = { state: 'settled', value: false, source: 'probe: none' };
show('Eo no root', Eo({ hasRoot: false, placeholders: placeholdersSettled, hasId: true, isReference: false, files: { state: 'settled', value: true, source: 'p' } }));
show('Eo no placeholders', Eo({ hasRoot: true, placeholders: placeholdersUnset, hasId: true, isReference: false, files: { state: 'settled', value: true, source: 'p' } }));
show('Eo no id', Eo({ hasRoot: true, placeholders: placeholdersSettled, hasId: false, isReference: false, files: { state: 'settled', value: true, source: 'p' } }));
show('Eo files unasked', Eo({ hasRoot: true, placeholders: placeholdersSettled, hasId: true, isReference: true, files: { state: 'unasked' } }));
show('Eo files yes', Eo({ hasRoot: true, placeholders: placeholdersSettled, hasId: true, isReference: true, files: { state: 'settled', value: true, source: 'p' } }));
show('Eo files no', Eo({ hasRoot: true, placeholders: placeholdersSettled, hasId: true, isReference: true, files: { state: 'settled', value: false, source: 'probe: no reply' } }));
show('Eo inline with files no', Eo({ hasRoot: true, placeholders: placeholdersSettled, hasId: true, isReference: false, files: { state: 'settled', value: false, source: 'p' } }));

clearChainRecords();
const refusal = Ho({ plugin: 'plug', requestId: 'req', key: 'k' });
refusal('one');
refusal('one');
refusal('two');
show('Ho records', chainRecords().map((record) => (record as { message?: string }).message));

show('or inline', or({ source: { png: 'TQ==' }, columns: 2, rows: 1 })(5));
show('or file', or({ source: { file: '/a.png', format: 'png' }, columns: 1, rows: 1 })(6));

function voAt(level: number, graphics: boolean): unknown {
  resetImageHost();
  configureImageHost({ capabilityLevel: level, capabilities: settledCapabilities(graphics) });
  const run = runComponent(() => vo());
  const answer = run.result;
  run.unmount();
  return answer;
}
show('vo', { l0: voAt(0, true), l1: voAt(1, true), l2: voAt(2, true), l3: voAt(3, true), l3nographics: voAt(3, false) });

resetImageHost();
Yj().clear();
const mo = runComponent(() => Mo({ plugin: 'plug', requestId: 'req', key: 'k' }, { columns: 2, rows: 1 }, () => 'ALT'));
const row = Yj().get(e5t('req', 'k', 'plug'));
const mount = row === undefined ? undefined : [...row.images][0];
show('Mo row', row === undefined ? undefined : { images: row.images.size, mount: { plugin: mount.plugin, requestId: mount.requestId, key: mount.key, columns: mount.columns, rows: mount.rows, swapType: typeof mount.swap } });
mo.unmount();
show('Mo after unmount', Yj().get(e5t('req', 'k', 'plug')));

resetImageHost();
const probeStore = new ImageFileProbe();
configureImageHost({ imageFiles: probeStore });
const oo = runComponent(() => Oo(false));
show('Oo initial', oo.result);
oo.unmount();

// The file probe's success and no-reply paths.
const probeClient = terminalClient();
const okQuerier = querier(() => Promise.resolve({ message: 'OK' }), true);
const files = new ImageFileProbe();
configureImageHost({ terminalImages: probeClient, internalQuerier: okQuerier, imageFiles: files, capabilities: settledCapabilities(true) });
dt(okQuerier as never, probeClient as never);
await sleep(30);
show('dt ok', { reading: files.get(), requestPrefix: okQuerier.requests[0]?.slice(0, 30), allocatedWidth: probeClient.allocated });

const silentQuerier = querier(() => Promise.resolve(undefined), true);
const files2 = new ImageFileProbe();
configureImageHost({ terminalImages: probeClient, internalQuerier: silentQuerier, imageFiles: files2, capabilities: settledCapabilities(true) });
dt(silentQuerier as never, probeClient as never);
await sleep(30);
show('dt no reply', files2.get());

// The component, with a terminal that takes the source.
resetImageHost();
Yj().clear();
const client = terminalClient();
configureImageHost({
  terminalImages: client as never,
  capabilityLevel: 3,
  capabilities: settledCapabilities(true),
  imageFiles: (() => { const store = new ImageFileProbe(); return store; })(),
});
const inline = { png: 'TQ==' };
const run = runComponent(() => No({ plugin: 'plug', elementKey: 'k', source: inline, columns: 2, rows: 1, alt: 'ALT' }), { contexts: new Map([[ee, { requestId: 'req' }]]) });
show('No inline root', { type: run.root?.type, props: run.root?.props, child: run.root?.children[0] && { type: run.root.children[0].type, rawText: run.root.children[0].props.rawText, rawWidth: run.root.children[0].props.rawWidth, rawHeight: run.root.children[0].props.rawHeight } });
show('No inline expected alt', lFo(9, 2, 1));
show('No inline sends', client.sends);
const altCallback = [...(Yj().get(e5t('req', 'k', 'plug'))?.images ?? [])][0]?.swap;
show('No inline alt callback', typeof altCallback === 'function' ? altCallback(inline) : altCallback);
run.unmount();
show('No inline freed', client.freed);

// A terminal that cannot read files, with a file reference source.
resetImageHost();
Yj().clear();
const client2 = terminalClient();
configureImageHost({
  terminalImages: client2 as never,
  capabilityLevel: 3,
  capabilities: settledCapabilities(true),
});
const files3 = new ImageFileProbe();
configureImageHost({ imageFiles: files3 });
files3.begin();
files3.answer({ value: false, source: 'probe: no reply to the file query' });
const run2 = runComponent(() => No({ plugin: 'plug', elementKey: 'k', source: { file: '/a.png', format: 'png' }, columns: 2, rows: 1, alt: 'ALT' }), { contexts: new Map([[ee, { requestId: 'req' }]]) });
show('No file root', { type: run2.root?.type, props: run2.root?.props });
const alt2 = [...(Yj().get(e5t('req', 'k', 'plug'))?.images ?? [])][0]?.swap;
show('No file alt callback', typeof alt2 === 'function' ? alt2({ file: '/a.png', format: 'png' }) : alt2);
run2.unmount();

// No terminal at all.
resetImageHost();
Yj().clear();
const run3 = runComponent(() => No({ plugin: 'plug', elementKey: 'k', source: inline, columns: 2, rows: 1, alt: 'ALT' }));
show('No clientless root', { type: run3.root?.type, props: run3.root?.props, children: run3.root?.children });
run3.unmount();
show('ge after reset', ge.level);

console.log(out.join('\n'));
