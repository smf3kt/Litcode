import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extracted-v2/manifest.json'), 'utf8'));
function source(file) {
  const bytes = fs.readFileSync(path.join(root, 'extracted-v2/modules', file));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.modules.find(row => row.path === file).decodedSha256);
  return bytes.toString('utf8');
}
const main = source('chunk-24k7d6mw.js');
const bindings = source('chunk-6ccen3s8.js').slice(5984, 6216);
for (const [chord, action] of [['up', 'up'], ['"ctrl+p"', 'up'], ['down', 'down'], ['"ctrl+n"', 'down'],
  ['right', 'next'], ['left', 'previous'], ['enter', 'openSelected'], ['escape', 'clearSelection'], ['x', 'close']])
  assert.ok(bindings.includes(`${chord}:"footer:${action}"`));
const makeNavigation = Function('read', 'select', 'open', `return function(direction, leave=false) {
  const {items:gd,selection:jl}=read(); const Yc=false, za=0, wi=[]; const qa=()=>{}, ec=()=>{};
  const Kd=select; const Ua=jl==='tasks', Za=false, Vr=-1, ed=-1, Qu=0;
  const x8t=()=>{}, R8t=()=>{}, P8t=()=>{}, A8t=()=>{}; const he={openBashesDialog:open};
  ${main.slice(870856, 871116)}
  ${main.slice(889030, 889398)}
  if(direction==='up') pf(); else if(direction==='down') Wp();
  else if(direction==='left') rh(gd,-1); else if(direction==='right') rh(gd,1);
}`);
let observed = 0;
for (const items of [[], ['tasks'], ['ideSelection'], ['tasks', 'ideSelection']]) {
  for (const selection of [null, ...items]) {
    for (const direction of ['up', 'down', 'left', 'right']) {
      let selected = selection, opens = 0;
      const navigate = makeNavigation(() => ({items, selection:selected}), next => { selected = next; }, () => { opens++; });
      navigate(direction);
      let expected = selection, expectedOpens = 0;
      const index = selection === null ? -1 : items.indexOf(selection);
      const delta = direction === 'up' || direction === 'left' ? -1 : 1;
      const next = items[index + delta];
      if (next !== undefined) expected = next;
      else if (direction === 'up') expected = null;
      else if (direction === 'down' && selection === 'tasks') { expected = null; expectedOpens = 1; }
      assert.deepEqual({selected, opens}, {selected:expected, opens:expectedOpens}); observed++;
    }
  }
}
assert.ok(main.slice(834853, 835119).includes('if(Ju())go()'));
assert.ok(main.slice(830027, 830557).includes('gr(pT)'));
assert.equal(main.slice(825973, 825984), 'ec=!co&&!Ct');
console.log(`PASS source module hashes, Footer bindings and ${observed} isolated source navigation cases`);
const child = spawn(process.execPath, [path.join(root, '.audit/w290-background-footer-click.mjs')], {
  cwd: root, stdio: 'inherit', env: { ...process.env, W291_KEYBOARD: '1',
    ...(process.env.W291_RESULT ? { W290_RESULT: process.env.W291_RESULT } : {}) },
});
const code = await new Promise(resolve => child.once('close', resolve));
assert.equal(code, 0, 'compiled keyboard chain');
