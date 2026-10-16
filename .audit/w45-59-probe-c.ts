import { it } from '../src/plugin-chain-host.js';
import { mountImage } from '../src/plugin-chain-raster-mount.js';
import { raiseUiCall } from '../src/plugin-chain-ui.js';

const caller = { plugin: 'tips', origin: [] };
const show = (label: string, value: unknown) => console.log(label, JSON.stringify(value));
const png = Buffer.alloc(33);
png.write('\x89PNG\r\n\x1a\n', 0, 'binary');
png.write('IHDR', 12, 'binary');
png.writeUInt32BE(1, 16);
png.writeUInt32BE(1, 20);
const source = { png: png.toString('base64') };
const calls: string[] = [];
const blit = () => raiseUiCall({ event: 'ui.blit', args: { requestId: 'r', key: 'k', source }, caller: caller as never });
const element = (name: string, answer: () => unknown) => ({ requestId: 'r', key: 'k', plugin: 'tips', columns: 1, rows: 1, swap: () => { calls.push(name); return answer(); } });

const offA = mountImage(element('a', () => undefined) as never);
show('one accepting image', await blit(), calls);
offA();

it().mountedImages.clear();
const offB = mountImage(element('first', () => undefined) as never);
const offC = mountImage(element('second', () => 'refused by the second') as never);
show('first accepts, second refuses', await blit(), calls);
offB(); offC();

it().mountedImages.clear();
const offD = mountImage(element('only', () => 'refused by the only') as never);
show('the only one refuses', await blit(), calls);
offD();
