import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'acorn';
import * as walk from 'acorn-walk';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '..'), output = path.join(process.env.CLAUDE_JOB_DIR, 'tmp');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const sha = text => createHash('sha256').update(text).digest('hex');
const manifest = JSON.parse(read('extracted-v2/manifest.json'));
const modules = new Map(), identities = [];
for (const id of ['6sz429bf','tw1h5pks','24k7d6mw','sfn1dbxq','bk5ct2gw','yze9xmwg','g9z2s3cs','ax7r0qj7','bmffdtcn','sb190ksj']) {
  const file = `chunk-${id}.js`, text = read(`extracted-v2/modules/${file}`), digest = sha(text);
  assert.equal(digest, manifest.modules.find(module => module.path === file)?.decodedSha256, file);
  modules.set(id, text); identities.push({ file, sha256: digest });
}
const parsed = new Map();
function declaration(id, name, start) {
  if (!parsed.has(id)) parsed.set(id, parse(modules.get(id), { ecmaVersion: 'latest', sourceType: 'module' }));
  let found;
  walk.simple(parsed.get(id), { FunctionDeclaration(node) { if (node.id.name === name && (start === undefined || node.start === start)) found = node; },
    VariableDeclarator(node) { if (node.id?.name === name && (start === undefined || node.start === start)) found = node; } });
  assert.ok(found, `${id}/${name}`); return found;
}
const bodies = [['6sz429bf','At',36657,42135],['tw1h5pks','icn',114759,117497],['tw1h5pks','lNt',117520,121025],
  ['tw1h5pks','cNt',121409,123419],['24k7d6mw','Bn',1585446,1586735],['24k7d6mw','kn',1562359,1572850],
  ['sfn1dbxq','m8t',2201926,2202015],['sfn1dbxq','r6e',2202015,2202442],['sfn1dbxq','Px',2208651,2208730],
  ['bk5ct2gw','Xi',596552,596776],['bk5ct2gw','Lm',596776,596827],['bk5ct2gw','nA',596874,597536],
  ['g9z2s3cs','grn',2260,2325],['g9z2s3cs','hrn',2325,2462],['ax7r0qj7','_c',4917,5021],
  ['ax7r0qj7','ne',1128,1272],['ax7r0qj7','WMt',1544,1645],['bmffdtcn','vxn',1323,1331],['bmffdtcn','Gns',1332,1341],
  ['sb190ksj','nd',127220,130322]];
for (const [id,name,start,end] of bodies) { const node = declaration(id,name,start); assert.deepEqual([node.start,node.end],[start,end],`${id}/${name}`); }
const target = file => ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext } }).outputText;
function targetFunction(file, name) { const text = target(file); let found; walk.simple(parse(text,{ecmaVersion:'latest',sourceType:'module'}),
  { FunctionDeclaration(node) { if (node.id.name === name) found = node; } }); assert.ok(found,name); return found; }
const clean = node => JSON.parse(JSON.stringify(node,(key,value)=>['start','end','raw'].includes(key)?undefined:key==='kind'&&value==='const'?'let':value));
for (const [sourceName,targetName,file] of [['_c','truncateMcpDetail','src/mcp-detail-source.ts'],['ne','ne','src/mcp-detail-source.ts']])
  assert.deepEqual(clean(targetFunction(file,targetName).body),clean(declaration('ax7r0qj7',sourceName).body),targetName);
const membership = clean(targetFunction('src/mcp-state.ts','setMcpMembership').body);
const reference = clean(declaration('sfn1dbxq','m8t').body);
const rename = value => { if(Array.isArray(value))return value.map(rename);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,key==='name'&&typeof item==='string'?({e:'e',n:'n',r:'r',h:'h'}[item]??item):rename(item)]));return value; };
assert.deepEqual(rename(membership),reference,'membership copy');
const groups = [
  ['navigation',modules.get('6sz429bf').slice(36657,42135),read('src/interactive.ts').split("if (prompt === '/mcp' && terminal?.prompt)")[1].split("if (prompt === '/mcp')")[0]],
  ['detail',modules.get('tw1h5pks').slice(114759,123419)+modules.get('g9z2s3cs').slice(2260,2462),read('src/mcp-panel.ts')],
  ['state',modules.get('sfn1dbxq').slice(2201756,2202442)+modules.get('bk5ct2gw').slice(596552,597536),read('src/mcp-state.ts')],
  ['owner',modules.get('24k7d6mw').slice(1562359,1572850)+modules.get('24k7d6mw').slice(1585446,1586735),read('src/mcp.ts')+read('src/runtime.ts')+read('src/session.ts')],
];
const diffs = [];
for(const [name,before,after] of groups) {
  const left=path.join(output,`w300-source-${name}.txt`),right=path.join(output,`w300-port-${name}.txt`);
  fs.writeFileSync(left,before);fs.writeFileSync(right,after);
  const diff=spawnSync('git',['diff','--no-index','--no-ext-diff','--word-diff=porcelain','--word-diff-regex=.',left,right],{encoding:'utf8',maxBuffer:16*1024*1024});
  assert.ok(diff.status===0||diff.status===1,diff.stderr); fs.writeFileSync(path.join(output,`w300-diff-${name}.txt`),diff.stdout);
  diffs.push({name,sourceSha256:sha(before),targetSha256:sha(after),diffSha256:sha(diff.stdout)});
}
fs.writeFileSync(path.join(output,'w300-source-comparison.json'),JSON.stringify({modules:identities,bodies:bodies.map(([id,name,start,end])=>({id,name,start,end,unit:'utf16',sha256:sha(modules.get(id).slice(start,end))})),copiedBodies:3,diffs},null,2));
console.log(`PASS ${identities.length} module digests, ${bodies.length} exact ranges, three copied bodies, four adapted char comparisons`);
