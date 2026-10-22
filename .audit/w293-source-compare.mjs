import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'acorn';
import * as walk from 'acorn-walk';
import ts from 'typescript';

const root=path.resolve(import.meta.dirname,'..');
const output=process.env.W293_RESULT_DIR??path.join(process.env.CLAUDE_JOB_DIR,'tmp');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'extracted-v2/manifest.json'),'utf8'));
const sha=text=>createHash('sha256').update(text).digest('hex');
const records=[];
function source(file) {
  const bytes=fs.readFileSync(path.join(root,'extracted-v2/modules',file));
  const digest=sha(bytes); assert.equal(digest,manifest.modules.find(item=>item.path===file)?.decodedSha256,file);
  records.push({file,sha256:digest}); return bytes.toString('utf8');
}
const modules=new Map();
for(const file of ['chunk-ecfjn15r.js','chunk-gwwwxdvd.js','chunk-hxewh5k1.js','chunk-khw18tw4.js',
  'chunk-24k7d6mw.js','chunk-f7x3yeg4.js','chunk-rrrfrwjr.js','chunk-3cynezh1.js','chunk-wtch2p0g.js',
  'chunk-nybcbd9t.js','chunk-7vyj6mx6.js','chunk-bk5ct2gw.js','chunk-gyf58rwf.js','chunk-ax7r0qj7.js',
  'chunk-68wmv4pr.js','chunk-wh2vcbh8.js','chunk-ae84tp6z.js','chunk-c6qwr3kc.js','chunk-x0dc37w9.js'])modules.set(file,source(file));
function functions(text) {
  const result=new Map();
  walk.simple(parse(text,{ecmaVersion:'latest',sourceType:'module'}),{FunctionDeclaration(node){
    if(!result.has(node.id.name))result.set(node.id.name,node);
  }}); return result;
}
const targetFile='src/spinner-tips-source.ts', target=fs.readFileSync(path.join(root,targetFile),'utf8');
const emitted=ts.transpileModule(target,{compilerOptions:{target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext}}).outputText;
const actual=functions(emitted), expected=functions(modules.get('chunk-ecfjn15r.js'));
const canonical=node=>JSON.parse(JSON.stringify(node,(key,item)=>{
  if(['start','end','raw'].includes(key))return undefined;
  if(item?.type==='CallExpression'&&item.callee?.name==='t'&&item.arguments.length===2
    &&item.arguments[1]?.type==='ObjectExpression'&&item.arguments[1].properties.length===1
    &&item.arguments[1].properties[0].key.name==='level'&&item.arguments[1].properties[0].value.value==='warn')
    return {...item,arguments:item.arguments.slice(0,1)};
  if(item?.type==='UnaryExpression'&&item.operator==='void'&&item.argument.value===0)return {type:'Identifier',name:'undefined'};
  if(item?.type==='UnaryExpression'&&item.operator==='!'&&[0,1].includes(item.argument.value))return {type:'Literal',value:!item.argument.value};
  if(item?.regex){
    const pattern=item.regex.pattern.replace(/\\u\{([a-f0-9]{1,4})\}/gi,(_all,code)=>'\\u'+code.padStart(4,'0'));
    return {type:'Literal',regex:{pattern,flags:pattern==='[\\t\\n\\r\\u2028\\u2029]+'?'g':item.regex.flags}};
  }
  return item;
}));
const copies=[];
for(const [name,file,original] of [
  ['N','chunk-ecfjn15r.js','N'],['Q','chunk-ecfjn15r.js','Q'],['w','chunk-ecfjn15r.js','w'],
  ['Ept','chunk-gyf58rwf.js','Ept'],['Gw','chunk-ax7r0qj7.js','Gw'],['ne','chunk-ax7r0qj7.js','ne'],
  ['Io','chunk-68wmv4pr.js','Io'],['selectSpinnerTip','chunk-gwwwxdvd.js','l'],
]) {
  const before=functions(modules.get(file)).get(original),after=actual.get(name);
  assert.ok(before&&after,name);
  assert.deepEqual(canonical(before.body),canonical(after.body),name);
  copies.push({symbol:name,module:file,range:[before.start,before.end],unit:'utf16',sha256:sha(modules.get(file).slice(before.start,before.end))});
}
const startup=modules.get('chunk-7vyj6mx6.js').slice(61512,61564);
assert.equal(startup,'Ce((H)=>({...H,numStartups:(H.numStartups??0)+1}),P)');
const compare=[
  ['content',modules.get('chunk-ecfjn15r.js').slice(1407,6672),target],
  ['owner',modules.get('chunk-24k7d6mw.js').slice(1384069,1386468)+modules.get('chunk-khw18tw4.js').slice(1269,2040),fs.readFileSync(path.join(root,'src/spinner-tips.ts'),'utf8')],
  ['view',modules.get('chunk-f7x3yeg4.js').slice(21559,24232)+modules.get('chunk-rrrfrwjr.js').slice(1610,2287),fs.readFileSync(path.join(root,'src/tui-progress.ts'),'utf8')],
  ['schema',modules.get('chunk-3cynezh1.js').slice(191254,191675)+modules.get('chunk-3cynezh1.js').slice(253886,254933),fs.readFileSync(path.join(root,'src/spinner-tips-settings.ts'),'utf8')],
];
const diffs=[];
for(const [name,before,after] of compare) {
  const left=path.join(output,`w293-source-${name}.txt`),right=path.join(output,`w293-port-${name}.txt`);
  fs.writeFileSync(left,before);fs.writeFileSync(right,after);
  const diff=spawnSync('git',['diff','--no-index','--no-ext-diff','--word-diff=porcelain','--word-diff-regex=.',left,right],{encoding:'utf8',maxBuffer:2*1024*1024});
  assert.ok(diff.status===0||diff.status===1,diff.stderr);
  const file=path.join(output,`w293-diff-${name}.txt`);fs.writeFileSync(file,diff.stdout);
  diffs.push({name,sourceSha256:sha(before),targetSha256:sha(after),diffSha256:sha(diff.stdout),bytes:Buffer.byteLength(diff.stdout)});
}
fs.writeFileSync(path.join(output,'w293-source-comparison.json'),JSON.stringify({modules:records,copies,startup:{range:[61512,61564],unit:'utf16',sha256:sha(startup)},diffs},null,2));
console.log(`PASS ${records.length} module digests and ${copies.length} erased copied-function ASTs`);
console.log('PASS adapted content, owner, schema and native view character comparisons recorded');
