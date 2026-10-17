// W45-73: the kitty image wire layer — the placeholder table and its alt renderer (`S`, `lFo`), the
// colour sequence (`O`), the framed message (`d`), the payload and name checks (`D`, `k`, `v`, `u`)
// and the transmit builder (`cFo`) with its chunking. Expected values were measured through the
// ported bodies (see .audit/w45-73-probe.txt).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  u, D, k, v, O, S, lFo, d, Y, M, cFo,
  hun, G, N, h$t, b, R, f, y, m, L,
} from '../src/plugin-chain-image-wire.js';

const RANGE_MESSAGE = 'kitty graphics: an id, cell count or pixel size must be a positive integer within its range';
const BASE64_MESSAGE = 'kitty graphics: payload must be standard base64 (A-Z a-z 0-9 + / =)';
const NAME_MESSAGE = 'kitty graphics: a file path or shared-memory name must be a non-empty string of at most 3072 bytes, no NUL';
const ST = '\x1b\\';

describe('the wire constants', () => {
  it('carries the introducer, the chunk size, the name cap and the placeholder prefix', () => {
    assert.equal(G, '\x1b_G');
    assert.equal(hun, '\x1b[39m');
    assert.equal(m, 4096);
    assert.equal(L, 3072);
    assert.equal(h$t, 256);
    assert.equal(b, 4294967295);
    assert.equal(R, 10000);
    assert.deepEqual(f, { mask: 255, redShift: 16, greenShift: 8 });
    assert.equal(N.codePointAt(0), 1109742);
    assert.equal(y.length, 297);
  });

  it('maps the format and medium codes', () => {
    assert.deepEqual(Y, { png: 'f=100', rgba: 'f=32', rgb: 'f=24' });
    assert.deepEqual(M, { file: 't=f', shm: 't=s' });
  });
});

describe('the range check', () => {
  it('accepts any integer from one to the limit inclusive', () => {
    assert.equal(u(1, 10), undefined);
    assert.equal(u(10, 10), undefined);
  });

  it('rejects zero, the limit plus one, fractions and NaN', () => {
    for (const value of [0, 11, 1.5, NaN]) {
      assert.throws(() => u(value, 10), { name: 'TypeError', message: RANGE_MESSAGE });
    }
  });
});

describe('the payload check', () => {
  it('accepts standard base64 with up to two trailing equals', () => {
    assert.equal(D('TWFu'), undefined);
    assert.equal(D('TWE='), undefined);
    assert.equal(D('TQ=='), undefined);
    assert.equal(D(''), undefined);
  });

  it('rejects whitespace, a leading equals and non-strings', () => {
    for (const value of ['TW E=', '=TWFu', 7 as never]) {
      assert.throws(() => D(value), { name: 'TypeError', message: BASE64_MESSAGE });
    }
  });
});

describe('the file and shared-memory name check', () => {
  it('accepts a non-empty name of up to 3072 bytes', () => {
    assert.equal(k('a.png'), undefined);
    assert.equal(k('a'.repeat(3072)), undefined);
  });

  it('counts UTF-8 bytes, not code units', () => {
    assert.equal(k('é'.repeat(1536)), undefined);
    assert.throws(() => k('é'.repeat(1537)), { name: 'TypeError', message: NAME_MESSAGE });
  });

  it('rejects an empty name, a NUL and an over-long name', () => {
    for (const value of ['', 'a\x00b', 'a'.repeat(3073)]) {
      assert.throws(() => k(value), { name: 'TypeError', message: NAME_MESSAGE });
    }
  });
});

describe('the UTF-8 to base64 helper', () => {
  it('encodes the source bytes', () => {
    assert.equal(v('f'), 'Zg==');
    assert.equal(v('é'), 'w6k=');
  });
});

describe('the colour sequence', () => {
  it('uses the 256-colour form below 256', () => {
    assert.equal(O(3), '\x1b[38;5;3m');
    assert.equal(O(255), '\x1b[38;5;255m');
  });

  it('uses the truecolor form from 256, reading the number as a 24-bit colour', () => {
    assert.equal(O(256), '\x1b[38;2;0;1;0m');
    assert.equal(O(0x010203), '\x1b[38;2;1;2;3m');
    assert.equal(O(0xffffff), '\x1b[38;2;255;255;255m');
  });

  it('rejects zero and anything above the 32-bit colour cap', () => {
    assert.throws(() => O(0), { name: 'TypeError', message: RANGE_MESSAGE });
    assert.throws(() => O(b + 1), { name: 'TypeError', message: RANGE_MESSAGE });
  });
});

describe('the placeholder table and the alt text', () => {
  it('takes the first n code points', () => {
    assert.deepEqual(S(0), []);
    assert.deepEqual(S(3).map((character) => character.codePointAt(0)), [773, 781, 782]);
  });

  it('renders one colour sequence and one placeholder per cell, one row per line', () => {
    const text = lFo(0x010203, 2, 2);
    const rows = text.split('\n');
    assert.equal(rows.length, 2);
    const colour = O(0x010203);
    assert.equal(rows[0], `${colour}${N}${S(2)[0]}${S(2)[0]}${N}${S(2)[0]}${S(2)[1]}${hun}`);
    assert.equal(rows[1], `${colour}${N}${S(2)[1]}${S(2)[0]}${N}${S(2)[1]}${S(2)[1]}${hun}`);
  });

  it('rejects a zero or oversized cell count against the placeholder table', () => {
    assert.throws(() => lFo(0x010203, 0, 2), { name: 'TypeError', message: RANGE_MESSAGE });
    assert.throws(() => lFo(0x010203, y.length + 1, 2), { name: 'TypeError', message: RANGE_MESSAGE });
  });
});

describe('the framed message', () => {
  // The source declares the payload parameter without a default and tests it with `void 0`; the
  // seam's inferred arity would otherwise make the one-argument call a type error.
  const frame = d as (body: string, payload?: string) => string;

  it('wraps the body in the introducer and the string terminator', () => {
    assert.equal(frame('a=T,U=1,q=2'), `${G}a=T,U=1,q=2${ST}`);
  });

  it('appends a payload after a semicolon when given one', () => {
    assert.equal(frame('body', 'TWFu'), `${G}body;TWFu${ST}`);
  });
});

describe('the transmit builder', () => {
  it('sends a file name as a q=1 control message with the name as its payload', () => {
    assert.equal(
      cFo({ id: 1, columns: 2, rows: 3, source: { format: 'png', medium: 'file', name: '/tmp/a.png' } }),
      `${G}a=T,U=1,q=1,f=100,t=f,i=1,c=2,r=3;L3RtcC9hLnBuZw==${ST}`,
    );
  });

  it('sends a shared-memory name with the pixel size a non-png format carries', () => {
    assert.equal(
      cFo({ id: 2, columns: 1, rows: 1, source: { format: 'rgba', medium: 'shm', name: 'shm-name', width: 4, height: 5 } }),
      `${G}a=T,U=1,q=1,f=32,s=4,v=5,t=s,i=2,c=1,r=1;c2htLW5hbWU=${ST}`,
    );
  });

  it('checks the pixel size before the medium, so a non-png medium still needs one', () => {
    assert.throws(
      () => cFo({ id: 2, columns: 1, rows: 1, source: { format: 'rgba', medium: 'shm', name: 'shm-name' } }),
      { name: 'TypeError', message: RANGE_MESSAGE },
    );
  });

  it('does not base64-check a name payload', () => {
    assert.equal(
      cFo({ id: 6, columns: 1, rows: 1, source: { format: 'png', medium: 'file', name: 'x', base64: 'not base64!' } }),
      `${G}a=T,U=1,q=1,f=100,t=f,i=6,c=1,r=1;eA==${ST}`,
    );
  });

  it('sends inline base64 as a q=2 message with the pixel size a non-png format needs', () => {
    assert.equal(
      cFo({ id: 3, columns: 2, rows: 2, source: { format: 'rgb', width: 300, height: 200, base64: 'TWFu' } }),
      `${G}a=T,U=1,q=2,f=24,s=300,v=200,i=3,c=2,r=2;TWFu${ST}`,
    );
  });

  it('rejects an inline payload that is not base64', () => {
    assert.throws(
      () => cFo({ id: 6, columns: 1, rows: 1, source: { format: 'png', base64: 'not base64!' } }),
      { name: 'TypeError', message: BASE64_MESSAGE },
    );
  });

  it('keeps a payload at the chunk size in one message', () => {
    const base64 = 'A'.repeat(4096);
    const text = cFo({ id: 5, columns: 1, rows: 1, source: { format: 'png', base64 } });
    assert.equal(text, `${G}a=T,U=1,q=2,f=100,i=5,c=1,r=1;${base64}${ST}`);
  });

  it('splits a longer payload at the chunk size, m=1 until the last chunk', () => {
    const base64 = 'A'.repeat(4097);
    const text = cFo({ id: 5, columns: 1, rows: 1, source: { format: 'png', base64 } });
    assert.equal(
      text,
      `${G}a=T,U=1,q=2,f=100,i=5,c=1,r=1,m=1;${base64.slice(0, 4096)}${ST}`
      + `${G}m=0,q=2;${base64.slice(4096)}${ST}`,
    );
  });

  it('marks every middle chunk m=1 and the last one m=0', () => {
    const base64 = 'A'.repeat(9000);
    const text = cFo({ id: 5, columns: 1, rows: 1, source: { format: 'png', base64 } });
    const messages = text.split(G).slice(1);
    assert.equal(messages.length, 3);
    const headers = messages.map((message) => message.slice(0, message.indexOf(';')));
    assert.deepEqual(headers, [
      'a=T,U=1,q=2,f=100,i=5,c=1,r=1,m=1',
      'm=1,q=2',
      'm=0,q=2',
    ]);
    const payloads = messages.map((message) => message.slice(message.indexOf(';') + 1, -2));
    assert.deepEqual(payloads.map((payload) => payload.length), [4096, 4096, 808]);
  });

  it('rejects an id, a cell count and a pixel size outside their ranges', () => {
    const source = { format: 'png', base64: 'TQ==' };
    for (const call of [
      () => cFo({ id: 0, columns: 1, rows: 1, source }),
      () => cFo({ id: 1, columns: y.length + 1, rows: 1, source }),
      () => cFo({ id: 1, columns: 1, rows: 1, source: { format: 'rgb', width: 0, height: 1, base64: 'TQ==' } }),
      () => cFo({ id: 1, columns: 1, rows: 1, source: { format: 'rgb', width: R + 1, height: 1, base64: 'TQ==' } }),
    ]) {
      assert.throws(call, { name: 'TypeError', message: RANGE_MESSAGE });
    }
  });
});
