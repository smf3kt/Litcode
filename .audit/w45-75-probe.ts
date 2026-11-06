// W45-75 probe: measure the two stores' state machines exactly as copied.
import {
  CapabilityReadings, CAPABILITY_NAMES, DEFAULT_CAPABILITIES, ImageFileProbe,
} from '../src/plugin-chain-terminal-capabilities.js';

const out: string[] = [];
const show = (label: string, value: unknown): void => out.push(`${label} = ${JSON.stringify(value)}`);

show('CAPABILITY_NAMES', CAPABILITY_NAMES);
show('DEFAULT_CAPABILITIES', DEFAULT_CAPABILITIES);

const probe = new ImageFileProbe();
show('probe initial', probe.get());
show('probe begin 1', probe.begin());
show('probe after begin', probe.get());
show('probe begin 2', probe.begin());
const seenBefore: Array<[boolean, string]> = [];
const unsubscribe = probe.onSettle((value: boolean) => seenBefore.push([value, 'before']));
probe.unask();
show('probe after unask', probe.get());
show('probe answer', probe.answer({ value: true, source: 'probe: answered OK' }));
show('probe after answer', probe.get());
show('probe now', probe.now());
show('probe seen before settle', seenBefore);
show('probe answer again', probe.answer({ value: false, source: 'again' }));
const seenAfter: boolean[] = [];
probe.onSettle((value: boolean) => seenAfter.push(value));
show('probe seen after settle', seenAfter);
unsubscribe();
show('probe begin after settle', probe.begin());

const readings = {
  extendedKeys: { settled: true, source: 'env: T' },
  synchronizedOutput: { likely: true, source: 'env: terminal=x, not asked yet' },
  kittyKeyboard: { settled: false, source: 'env: no' },
  kittyGraphics: { likely: false, source: 'env: terminal=x, not asked yet' },
  mousePixels: { settled: true, source: 'env: yes' },
  programStatus: { likely: false, source: 'env: no terminal' },
};
const caps = new CapabilityReadings(readings);
show('caps get extendedKeys', caps.get('extendedKeys'));
show('caps now extendedKeys', caps.now('extendedKeys'));
show('caps now synchronizedOutput', caps.now('synchronizedOutput'));
show('caps pending', caps.pending());
show('caps answer pending true', caps.answer('synchronizedOutput', true, 'asked'));
show('caps now after answer', caps.now('synchronizedOutput'));
show('caps confirmed synchronizedOutput', caps.confirmed('synchronizedOutput'));
show('caps answer settled', caps.answer('extendedKeys', false, 'asked'));
const capSeen: boolean[] = [];
caps.onSettle('kittyGraphics', (value: boolean) => capSeen.push(value));
caps.answer('kittyGraphics', false, 'asked');
show('caps seen', capSeen);
show('caps pending after answers', caps.pending());
caps.deadline();
show('caps programStatus after deadline', caps.get('programStatus'));
show('caps now programStatus', caps.now('programStatus'));
show('caps seen after deadline', capSeen);

console.log(out.join('\n'));
