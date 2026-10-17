// W45-74: the plugin image source model — the png/file/shm predicates (`ac`, `Z4t`, `Uto`), the
// decoded-size reader (`B_`) and the encoder to the transmit shape (`Dss`), including what the wire
// layer makes of the result. Expected values were measured through the ported bodies (see
// .audit/w45-74-probe.txt).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ac, Z4t, B_, Uto, Dss } from '../src/plugin-chain-image-model.js';
import { cFo } from '../src/plugin-chain-image-wire.js';

const png = { png: 'TQ==' };
const rgba = { rgba: 'TWFu', width: 1, height: 1 };
const file = { file: '/a.png', format: 'png' };
const shm = { shm: '/x', format: 'rgba', width: 2, height: 3 };

describe('the source shape predicates', () => {
  it('tells the inline png shape from the others', () => {
    assert.deepEqual([ac(png), ac(rgba), ac(file), ac(shm)], [true, false, false, false]);
  });

  it('tells a file or shm reference from an inline source', () => {
    assert.deepEqual([Z4t(png), Z4t(rgba), Z4t(file), Z4t(shm)], [false, false, true, true]);
  });

  it('tells the shm reference from the file one', () => {
    assert.deepEqual([Uto(png), Uto(rgba), Uto(file), Uto(shm)], [false, false, false, true]);
  });
});

describe('the decoded-size reader', () => {
  it('counts the base64 payload of an inline source and nothing for a reference', () => {
    assert.deepEqual([B_(png), B_(rgba), B_(file), B_(shm)], [1, 3, 0, 0]);
  });

  it('reads four base64 characters as three bytes', () => {
    assert.equal(B_({ png: 'A'.repeat(4096) }), 3072);
  });
});

describe('the wire-source encoder', () => {
  it('passes an inline png through with its base64', () => {
    assert.deepEqual(Dss(png), { format: 'png', base64: 'TQ==' });
  });

  it('passes an inline rgba source through with its pixel size', () => {
    assert.deepEqual(Dss(rgba), { format: 'rgba', base64: 'TWFu', width: 1, height: 1 });
  });

  it('names the medium and the file path, carrying the pixel size only when the format is not png', () => {
    assert.deepEqual(Dss(file), { medium: 'file', name: '/a.png', format: 'png' });
    assert.deepEqual(
      Dss({ file: '/a.rgb', format: 'rgb', width: 2, height: 3 }),
      { medium: 'file', name: '/a.rgb', format: 'rgb', width: 2, height: 3 },
    );
  });

  it('names the medium and the shared-memory name', () => {
    assert.deepEqual(Dss({ shm: '/x', format: 'png' }), { medium: 'shm', name: '/x', format: 'png' });
    assert.deepEqual(
      Dss(shm),
      { medium: 'shm', name: '/x', format: 'rgba', width: 2, height: 3 },
    );
  });

  it('prefers shm when a malformed source carries both references', () => {
    assert.deepEqual(
      Dss({ file: '/f.png', shm: '/s.png', format: 'png' }),
      { medium: 'shm', name: '/s.png', format: 'png' },
    );
  });
});

describe('the encoder feeds the transmit', () => {
  it('sends a file source as the q=1 control message with its name as the payload', () => {
    assert.equal(
      cFo({ id: 1, columns: 1, rows: 1, source: Dss(file) }),
      '\x1b_Ga=T,U=1,q=1,f=100,t=f,i=1,c=1,r=1;L2EucG5n\x1b\\',
    );
  });

  it('sends a shm rgba source with the medium and pixel size', () => {
    assert.equal(
      cFo({ id: 2, columns: 1, rows: 1, source: Dss(shm) }),
      '\x1b_Ga=T,U=1,q=1,f=32,s=2,v=3,t=s,i=2,c=1,r=1;L3g=\x1b\\',
    );
  });

  it('sends an inline source as the q=2 message', () => {
    assert.equal(
      cFo({ id: 3, columns: 1, rows: 1, source: Dss(png) }),
      '\x1b_Ga=T,U=1,q=2,f=100,i=3,c=1,r=1;TQ==\x1b\\',
    );
    assert.equal(
      cFo({ id: 4, columns: 1, rows: 1, source: Dss(rgba) }),
      '\x1b_Ga=T,U=1,q=2,f=32,s=1,v=1,i=4,c=1,r=1;TWFu\x1b\\',
    );
  });
});
