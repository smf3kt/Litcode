// W45-74 probe: measure the image source predicates and the wire-source encoder as the source text
// defines them, including what the encode result becomes when the wire layer transmits it.
import { ac, Z4t, B_, Uto, Dss } from '../src/plugin-chain-image-model.js';
import { cFo } from '../src/plugin-chain-image-wire.js';

const out: string[] = [];
const show = (label: string, value: unknown): void => {
  out.push(`${label} = ${JSON.stringify(value)}`);
};

const png = { png: 'TQ==' };
const rgba = { rgba: 'TWFu', width: 1, height: 1 };
const file = { file: '/a.png', format: 'png' };
const shm = { shm: '/x', format: 'rgba', width: 2, height: 3 };

show('ac', [ac(png), ac(rgba), ac(file), ac(shm)]);
show('Z4t', [Z4t(png), Z4t(rgba), Z4t(file), Z4t(shm)]);
show('Uto', [Uto(png), Uto(rgba), Uto(file), Uto(shm)]);
show('B_', [B_(png), B_(rgba), B_(file), B_(shm)]);
show('B_ png 4096 chars', B_({ png: 'A'.repeat(4096) }));

show('Dss png', Dss(png));
show('Dss rgba', Dss(rgba));
show('Dss file png', Dss(file));
show('Dss file rgb', Dss({ file: '/a.rgb', format: 'rgb', width: 2, height: 3 }));
show('Dss shm png', Dss({ shm: '/x', format: 'png' }));
show('Dss shm rgba', Dss(shm));
show('Dss both file and shm', Dss({ file: '/f.png', shm: '/s.png', format: 'png' }));

show('cFo(Dss file png)', cFo({ id: 1, columns: 1, rows: 1, source: Dss(file) }));
show('cFo(Dss shm rgba)', cFo({ id: 2, columns: 1, rows: 1, source: Dss(shm) }));
show('cFo(Dss png)', cFo({ id: 3, columns: 1, rows: 1, source: Dss(png) }));
show('cFo(Dss rgba)', cFo({ id: 4, columns: 1, rows: 1, source: Dss(rgba) }));

console.log(out.join('\n'));
