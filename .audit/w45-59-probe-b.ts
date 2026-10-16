import { it } from '../src/plugin-chain-host.js';
import { mountImage } from '../src/plugin-chain-raster-mount.js';
import { raiseUiCall } from '../src/plugin-chain-ui.js';

const caller = { plugin: 'tips', origin: [] };
const show = (label: string, value: unknown) => console.log(label, JSON.stringify(value));
const SEP = String.fromCharCode(0);
const png = Buffer.alloc(33);
png.write('\x89PNG\r\n\x1a\n', 0, 'binary');
png.write('IHDR', 12, 'binary');
png.writeUInt32BE(1, 16);
png.writeUInt32BE(1, 20);
const source = { png: png.toString('base64') };

const swaps: unknown[] = [];
const image = { requestId: 'r', key: 'i', plugin: 'tips', columns: 1, rows: 1, swap: (s: unknown) => { swaps.push(s); return true; } };
const offI = mountImage(image as never);
show('image blit', await raiseUiCall({ event: 'ui.blit', args: { requestId: 'r', key: 'i', source }, caller: caller as never }));
show('swap called', swaps.length, Buffer.isBuffer(swaps[0]));
show('image row blits', it().mountedImages.get(['tips', 'r', 'i'].join(SEP))!.blits);
offI();
show('after unmount', await raiseUiCall({ event: 'ui.blit', args: { requestId: 'r', key: 'i', source }, caller: caller as never }));

const refusing = { requestId: 'r', key: 'j', plugin: 'tips', columns: 1, rows: 1, swap: () => false };
const offJ = mountImage(refusing as never);
show('refused swap', await raiseUiCall({ event: 'ui.blit', args: { requestId: 'r', key: 'j', source }, caller: caller as never }));
offJ();

// Two Images under one key: the refusal of a later element is dropped (the measured hole).
const hole = { requestId: 'r', key: 'm', plugin: 'tips', columns: 1, rows: 1, swap: () => 'refused by the second' };
const ok = { requestId: 'r', key: 'm', plugin: 'tips', columns: 1, rows: 1, swap: () => true };
const offK = mountImage(ok as never);
const offL = mountImage(hole as never);
show('two images, first ok', await raiseUiCall({ event: 'ui.blit', args: { requestId: 'r', key: 'm', source }, caller: caller as never }));
offK(); offL();

// A remount under a key whose row survives keeps the row's blit count.
const row = it().mountedImages.get(['tips', 'r', 'j'] as unknown as string);
show('nothing left', it().mountedImages.size, row === undefined);
