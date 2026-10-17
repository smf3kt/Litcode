// W45-75: the terminal capability and image-file probe stores — the one-shot file probe state machine
// (`ImageFileProbe`) and the capability readings table (`CapabilityReadings`) with its defaults and
// names. Expected values were measured through the ported bodies (see .audit/w45-75-probe.txt).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CapabilityReadings, CAPABILITY_NAMES, DEFAULT_CAPABILITIES, ImageFileProbe,
} from '../src/plugin-chain-terminal-capabilities.js';

// The source constructor reads its argument as possibly absent; the seam's inferred arity does not.
const Probe = ImageFileProbe as unknown as new () => {
  get(): unknown;
  now(): unknown;
  begin(): boolean;
  unask(): void;
  answer(reading: { value: boolean; source: string }): boolean;
  onSettle(listener: (value: boolean) => void): () => void;
};

const readings = () => ({
  extendedKeys: { settled: true, source: 'env: T' },
  synchronizedOutput: { likely: true, source: 'env: terminal=x, not asked yet' },
  kittyKeyboard: { settled: false, source: 'env: no' },
  kittyGraphics: { likely: false, source: 'env: terminal=x, not asked yet' },
  mousePixels: { settled: true, source: 'env: yes' },
  programStatus: { likely: false, source: 'env: no terminal' },
});

describe('the image-file probe store', () => {
  it('starts unasked and moves to asking only once', () => {
    const probe = new Probe();
    assert.deepEqual(probe.get(), { state: 'unasked' });
    assert.equal(probe.begin(), true);
    assert.deepEqual(probe.get(), { state: 'asking' });
    assert.equal(probe.begin(), false);
  });

  it('returns an asking probe to unasked', () => {
    const probe = new Probe();
    probe.begin();
    probe.unask();
    assert.deepEqual(probe.get(), { state: 'unasked' });
    assert.equal(probe.begin(), true);
  });

  it('settles once, answers its value, and refuses a second answer', () => {
    const probe = new Probe();
    probe.begin();
    assert.equal(probe.answer({ value: true, source: 'probe: answered OK' }), true);
    assert.deepEqual(probe.get(), { state: 'settled', value: true, source: 'probe: answered OK' });
    assert.equal(probe.now(), true);
    assert.equal(probe.answer({ value: false, source: 'again' }), false);
    assert.equal(probe.now(), true);
  });

  it('calls a listener at once when settled, and on the answer when not', () => {
    const probe = new Probe();
    const seen: boolean[] = [];
    probe.onSettle((value: boolean) => seen.push(value));
    probe.begin();
    probe.answer({ value: true, source: 'asked' });
    assert.deepEqual(seen, [true]);
    const later: boolean[] = [];
    probe.onSettle((value: boolean) => later.push(value));
    assert.deepEqual(later, [true]);
  });
});

describe('the capability readings store', () => {
  it('exposes the six capability names and their defaults', () => {
    assert.deepEqual(CAPABILITY_NAMES, [
      'extendedKeys', 'synchronizedOutput', 'kittyKeyboard', 'kittyGraphics', 'mousePixels', 'programStatus',
    ]);
    assert.deepEqual(DEFAULT_CAPABILITIES, {
      extendedKeys: false,
      synchronizedOutput: false,
      kittyKeyboard: true,
      kittyGraphics: false,
      mousePixels: false,
      programStatus: false,
    });
  });

  it('builds settled readings at their value and pending ones at their guess', () => {
    const caps = new CapabilityReadings(readings());
    assert.deepEqual(caps.get('extendedKeys'), { state: 'settled', value: true, source: 'env: T' });
    assert.deepEqual(caps.get('synchronizedOutput'), { state: 'pending', likely: true, source: 'env: terminal=x, not asked yet' });
    assert.deepEqual(caps.pending(), ['synchronizedOutput', 'kittyGraphics', 'programStatus']);
  });

  it('answers a settled value, else the default, not the pending guess', () => {
    const caps = new CapabilityReadings(readings());
    assert.equal(caps.now('extendedKeys'), true);
    assert.equal(caps.now('synchronizedOutput'), false);
    assert.equal(caps.now('kittyGraphics'), DEFAULT_CAPABILITIES.kittyGraphics);
  });

  it('settles a pending capability once and records a yes', () => {
    const caps = new CapabilityReadings(readings());
    const seen: boolean[] = [];
    caps.onSettle('kittyGraphics', (value: boolean) => seen.push(value));
    assert.equal(caps.answer('synchronizedOutput', true, 'asked'), true);
    assert.equal(caps.now('synchronizedOutput'), true);
    assert.equal(caps.confirmed('synchronizedOutput'), true);
    assert.equal(caps.answer('extendedKeys', false, 'asked'), false);
    caps.answer('kittyGraphics', false, 'asked');
    assert.deepEqual(seen, [false]);
    assert.deepEqual(caps.pending(), ['programStatus']);
  });

  it('settles every pending capability at its guess on the deadline', () => {
    const caps = new CapabilityReadings(readings());
    caps.deadline();
    assert.deepEqual(caps.get('programStatus'), { state: 'settled', value: false, source: 'env: no terminal, no answer' });
    assert.deepEqual(caps.pending(), []);
  });
});
