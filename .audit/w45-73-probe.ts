// W45-73 probe: measure the image wire layer as the source text defines it, before any assertion.
import {
  u, D, k, v, O, S, lFo, d, Y, M, cFo,
  hun, G, N, h$t, b, R, f, y, m, L,
} from '../src/plugin-chain-image-wire.js';

const out: string[] = [];
const show = (label: string, value: unknown): void => {
  out.push(`${label} = ${JSON.stringify(value)}`);
};
const attempt = (label: string, fn: () => unknown): void => {
  try {
    show(label, { ok: fn() });
  } catch (error) {
    show(label, { threw: (error as TypeError).constructor.name, message: (error as TypeError).message });
  }
};

show('constants', { G, hun, h$t, b, R, f, m, L, yLength: y.length, N, NCodePoint: N.codePointAt(0) });
show('codes', { Y, M });

attempt('u(1,10)', () => u(1, 10));
attempt('u(10,10)', () => u(10, 10));
attempt('u(0,10)', () => u(0, 10));
attempt('u(11,10)', () => u(11, 10));
attempt('u(1.5,10)', () => u(1.5, 10));
attempt('u(NaN,10)', () => u(NaN, 10));

attempt('D("TWFu")', () => D('TWFu'));
attempt('D("TWE=")', () => D('TWE='));
attempt('D("TQ==")', () => D('TQ=='));
attempt('D("TW E=")', () => D('TW E='));
attempt('D("=TWFu")', () => D('=TWFu'));
attempt('D(7)', () => D(7 as never));

attempt('k("a.png")', () => k('a.png'));
attempt('k("")', () => k(''));
attempt('k("a\\0b")', () => k('a\x00b'));
attempt('k(3072 bytes)', () => k('a'.repeat(3072)));
attempt('k(3073 bytes)', () => k('a'.repeat(3073)));
attempt('k("\\u00e9".repeat(1536)) (3072 utf8 bytes)', () => k('é'.repeat(1536)));
attempt('k("\\u00e9".repeat(1537)) (3074 utf8 bytes)', () => k('é'.repeat(1537)));

show('v("f")', v('f'));
show('v("\\u00e9")', v('é'));

attempt('O(0)', () => O(0));
show('O(3)', O(3));
show('O(255)', O(255));
show('O(256)', O(256));
show('O(0x010203)', O(0x010203));
show('O(0xffffff)', O(0xffffff));
attempt('O(b+1)', () => O(b + 1));

show('S(0)', S(0));
show('S(3)', S(3));
show('S(3) code points', S(3).map((character) => character.codePointAt(0)));

show('lFo(0x010203,2,2)', lFo(0x010203, 2, 2));
show('lFo row terminator', lFo(0x010203, 1, 2).split('\n')[0].endsWith(hun));
show('lFo line count', lFo(0x010203, 2, 2).split('\n').length);
attempt('lFo(0x010203,0,2)', () => lFo(0x010203, 0, 2));
attempt('lFo(0x010203,y.length+1,2)', () => lFo(0x010203, y.length + 1, 2));

show('d("a=T,U=1,q=2,f=100,i=1,c=1,r=1")', d('a=T,U=1,q=2,f=100,i=1,c=1,r=1'));
show('d(body,"TWFu")', d('body', 'TWFu'));

const pngFile = { id: 1, columns: 2, rows: 3, source: { format: 'png', medium: 'file', name: '/tmp/a.png' } };
show('cFo(png file)', cFo(pngFile));
const shm = { id: 2, columns: 1, rows: 1, source: { format: 'rgba', medium: 'shm', name: 'shm-name', width: 4, height: 5 } };
show('cFo(rgba shm)', cFo(shm));
attempt('cFo(non-png medium without width)', () => cFo({ id: 2, columns: 1, rows: 1, source: { format: 'rgba', medium: 'shm', name: 'shm-name' } }));
const rgb = { id: 3, columns: 2, rows: 2, source: { format: 'rgb', width: 300, height: 200, base64: 'TWFu' } };
show('cFo(rgb inline)', cFo(rgb));
const rgbShort = { id: 4, columns: 1, rows: 1, source: { format: 'rgb', width: 1, height: 1, base64: 'TQ==' } };
show('cFo(rgb inline, 4 chars)', cFo(rgbShort));

// Chunking: exactly the chunk size, one over, and a little over two.
const chunked = (size: number): { total: number; messages: string[]; headers: string[]; payloads: string[] } => {
  const base64 = 'A'.repeat(size);
  const text = cFo({ id: 5, columns: 1, rows: 1, source: { format: 'png', base64 } });
  // Each framed message is G + body + ';' + payload + ST; split on the introducer.
  const messages = text.split(G).slice(1);
  return {
    total: text.length,
    messages: messages.map((message) => message.length),
    headers: messages.map((message) => message.slice(0, message.indexOf(';'))),
    payloads: messages.map((message) => message.slice(message.indexOf(';') + 1, -2)),
  };
};
show('cFo inline exactly 4096', chunked(4096));
show('cFo inline 4097', chunked(4097));
show('cFo inline 9000', chunked(9000));

attempt('cFo medium present skips base64 check', () => cFo({ id: 6, columns: 1, rows: 1, source: { format: 'png', medium: 'file', name: 'x', base64: 'not base64!' } }).slice(0, 40));
attempt('cFo inline invalid base64', () => cFo({ id: 6, columns: 1, rows: 1, source: { format: 'png', base64: 'not base64!' } }));
attempt('cFo id 0', () => cFo({ id: 0, columns: 1, rows: 1, source: { format: 'png', base64: 'TQ==' } }));
attempt('cFo columns y.length+1', () => cFo({ id: 1, columns: y.length + 1, rows: 1, source: { format: 'png', base64: 'TQ==' } }));
attempt('cFo non-png width 0', () => cFo({ id: 1, columns: 1, rows: 1, source: { format: 'rgb', width: 0, height: 1, base64: 'TQ==' } }));
attempt('cFo non-png width R+1', () => cFo({ id: 1, columns: 1, rows: 1, source: { format: 'rgb', width: R + 1, height: 1, base64: 'TQ==' } }));
attempt('cFo unknown format', () => cFo({ id: 1, columns: 1, rows: 1, source: { format: 'gif', width: 1, height: 1, base64: 'TQ==' } }));

console.log(out.join('\n'));
