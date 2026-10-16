import { Mde } from '../src/plugin-chain-label-text-source.js';
for (const input of ['a\tb\nc\td', 'abcdefg\th', 'a\tb\tc\td', 'x\ty\tz']) {
  console.log(JSON.stringify(input), '->', JSON.stringify(Mde(input)));
}
