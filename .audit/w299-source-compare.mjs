import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'acorn';
import * as walk from 'acorn-walk';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '..'), output = process.env.W299_RESULT_DIR ?? path.join(process.env.CLAUDE_JOB_DIR, 'tmp');
const sha = value => createHash('sha256').update(value).digest('hex');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = JSON.parse(read('extracted-v2/manifest.json'));
const modules = new Map(), identities = [];
for (const id of ['tm17ttjb', 'nrk8z90j', 'tw1h5pks', 'g5swwp2g', '9faebf06', 'x876fw6t', 'p2ct4tzw', 'nybcbd9t', 'sfn1dbxq', '9yh2xzb7', 'xmmahshv', 'hyft8yrm']) {
  const file = `chunk-${id}.js`, bytes = fs.readFileSync(path.join(root, 'extracted-v2/modules', file)), hash = sha(bytes);
  assert.equal(hash, manifest.modules.find(item => item.path === file)?.decodedSha256, file);
  modules.set(id, bytes.toString('utf8')); identities.push({ file, sha256: hash });
}
function declaration(module, name) {
  let found;
  walk.simple(parse(modules.get(module), { ecmaVersion: 'latest', sourceType: 'module' }), {
    FunctionDeclaration(node) { if (node.id.name === name) found = node; },
    VariableDeclarator(node) { if (node.id?.name === name) found = node; },
  });
  assert.ok(found, name); return found;
}
const bodies = [['tm17ttjb','Sn',90191,100347], ['tm17ttjb','Vft',100347,100400], ['tm17ttjb','YYe',100400,100453],
  ['tm17ttjb','jn',128356,128738], ['nrk8z90j','mIt',11254,11384], ['nrk8z90j','Clt',10632,11156],
  ['g5swwp2g','FOe',665,2698], ['tw1h5pks','fc',216895,218065], ['9faebf06','R',14414,16173],
  ['x876fw6t','Yr',16694,19097], ['9yh2xzb7','q4',3332,4231], ['9yh2xzb7','oL',1781,3332],
  ['sfn1dbxq','sc',3707033,3707202], ['sfn1dbxq','WRn',3399814,3399910], ['xmmahshv','kn',45274,46871],
  ['p2ct4tzw','Gun',2280,2928], ['p2ct4tzw','I',7029,7695]];
for (const [id,name,start,end] of bodies) assert.deepEqual([declaration(id,name).start,declaration(id,name).end],[start,end],name);
const sn = modules.get('tm17ttjb').slice(90191,100347), panel = modules.get('tw1h5pks');
assert.match(sn, /alreadyInGoalState:!0/);
assert.match(sn, /Successfully \$\{p\}d plugin: \$\{de\} \(scope: \$\{y\}\)/);
assert.match(sn, /let\{error:V\}=await jn\(O,d,n,/);
assert.match(panel.slice(216895,218065), /if\(v!==void 0&&v==="enabled"!==de\)/);
assert.match(panel.slice(216895,218065), /run \/reload-plugins to apply/);
assert.match(panel.slice(168900,171028), /me==="will-disable"\?await Vft/);
assert.match(panel.slice(172681,172787), /Disable plugin":"Enable plugin/);
assert.match(panel.slice(155146,155218), /Applies when you close this menu/);
assert.match(modules.get('nybcbd9t').slice(17490,17759), /tengu_chomp_inflection",!1/);
assert.match(modules.get('p2ct4tzw').slice(7029,7695), /await MC\(/);
const sourceParser = declaration('g5swwp2g','FOe');
const targetText = ts.transpileModule(read('src/plugin-panel.ts'), { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext } }).outputText;
let targetParser;
walk.simple(parse(targetText,{ecmaVersion:'latest',sourceType:'module'}),{ FunctionDeclaration(node) { if(node.id.name==='parsePluginCommand')targetParser=node; } });
const clean = node => JSON.parse(JSON.stringify(node,(key,value)=>['start','end','raw'].includes(key)?undefined:key==='kind'&&value==='const'?'let':value));
const sourceCases = sourceParser.body.body.find(node=>node.type==='SwitchStatement').cases;
const targetCases = targetParser.body.body.find(node=>node.type==='SwitchStatement').cases;
for (const value of ['list','ls','enable','disable']) assert.deepEqual(clean(targetCases.find(node=>node.test?.value===value)),clean(sourceCases.find(node=>node.test?.value===value)),value);
const groups = [
  ['settings', sn + modules.get('tm17ttjb').slice(128356,128738) + modules.get('nrk8z90j').slice(10487,11384), read('src/plugin-toggle.ts')],
  ['catalog', modules.get('nrk8z90j').slice(10632,11384), read('src/plugins.ts')],
  ['panel', panel.slice(155040,155218)+panel.slice(166093,171028)+panel.slice(172681,172787)+panel.slice(216895,218065)+modules.get('g5swwp2g').slice(665,2698), read('src/plugin-panel.ts')+read('src/interactive.ts')],
  ['reload', modules.get('x876fw6t').slice(16694,19097)+modules.get('9yh2xzb7').slice(1781,4231)+modules.get('sfn1dbxq').slice(3707033,3707202), read('src/config.ts')+read('src/reload.ts')+read('src/interactive.ts')],
  ['observers', modules.get('xmmahshv').slice(45274,46871)+modules.get('sfn1dbxq').slice(3399814,3399910)+modules.get('nybcbd9t').slice(11800,12330)+modules.get('nybcbd9t').slice(19980,20620)+modules.get('nybcbd9t').slice(21780,22300)+modules.get('nybcbd9t').slice(14800,15110)+modules.get('nybcbd9t').slice(9550,9760)+modules.get('nybcbd9t').slice(23900,24250), read('src/interactive.ts')+read('src/skill-catalog.ts')],
];
const diffs=[];
for(const [name,before,after]of groups){const left=path.join(output,`w299-source-${name}.txt`),right=path.join(output,`w299-port-${name}.txt`);fs.writeFileSync(left,before);fs.writeFileSync(right,after);const result=spawnSync('git',['diff','--no-index','--no-ext-diff','--word-diff=porcelain','--word-diff-regex=.',left,right],{encoding:'utf8',maxBuffer:16*1024*1024});assert.ok(result.status===0||result.status===1,result.stderr);fs.writeFileSync(path.join(output,`w299-diff-${name}.txt`),result.stdout);diffs.push({name,sourceSha256:sha(before),targetSha256:sha(after),diffSha256:sha(result.stdout)});}
fs.writeFileSync(path.join(output,'w299-source-comparison.json'),JSON.stringify({modules:identities,bodies:bodies.map(([module,name,start,end])=>({module,name,range:[start,end],unit:'utf16',sha256:sha(modules.get(module).slice(start,end))})),copiedParserCases:['list','ls','enable','disable'],diffs},null,2));
console.log(`PASS ${identities.length} module digests, ${bodies.length} exact body ranges, four copied parser cases, pending/status facts and ${diffs.length} adapted comparisons`);
