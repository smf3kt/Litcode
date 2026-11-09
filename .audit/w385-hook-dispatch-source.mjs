// Static source bodies and an isolated copied guard only. Never run recovered entrypoints.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const module = 'chunk-sfn1dbxq.js';
const source = fs.readFileSync(`extracted-v2/modules/${module}`, 'utf8');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const moduleSha256 = hash(source);
const manifest = JSON.parse(fs.readFileSync('extracted-v2/manifest.json', 'utf8'));
assert.equal(moduleSha256, '4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da');
assert.equal(moduleSha256, manifest.modules.find(row => row.path === module).decodedSha256);
const specs = [['dG',3002364,3002772], ['$dn',3004815,3009564], ['Bkr',3013410,3045702],
  ['b0',3046410,3055699], ['Gkr',3059322,3059924], ['g5e',2968826,2969056], ['gdn',3010061,3010145],
  ['Bkr.agent.PermissionRequest',3023184,3023443], ['qLe',633548,633961],
  ['ETn',2919219,2921427], ['UF',2969279,2980094], ['$dn.httpStartupFilter',3009066,3009247], ['m5e',2955889,2958184],
  ['ATn',2952802,2952853], ['G_r',2952853,2952904], ['CTn',2952923,2954231], ['Xir',2954231,2955189]];
const ledger = specs.map(([symbol,start,end]) => ({ module, moduleSha256, symbol, range: [start,end],
  coordinates: 'zero-based half-open UTF-16', bodySha256: hash(source.slice(start,end)) }));
const file = '.audit/w385-hook-dispatch-source.json';
if (process.argv.includes('--record')) fs.writeFileSync(file, JSON.stringify(ledger,null,2)+'\n');
else assert.deepEqual(ledger,JSON.parse(fs.readFileSync(file,'utf8')));
const guard = new Function('Je', source.slice(3023184,3023443));
assert.throws(() => guard('PermissionRequest'), /agent-type hooks are not supported for PermissionRequest/);
for (const event of ['PreToolUse','Stop','Notification']) assert.doesNotThrow(() => guard(event));
const scriptFailure = new Function('SV','lie', source.slice(2968826,2969056)+';return g5e;')(
  new Set(['PermissionRequest']), () => ({}));
assert.equal(scriptFailure({type:'agent'},'PermissionRequest','fixture','unsupported'),undefined);
assert.equal(scriptFailure({type:'script'},'PermissionRequest','fixture','unsupported').outcome,'blocking');
let rows=[];
const track=new Function('TJn',source.slice(633548,633961)+';return qLe;')(()=>({setState:update=>{rows=update(rows)}}));
const active=track({hookEvent:'Notification',hooks:['first','second']});
active.settle(1);active.settle(1);assert.deepEqual([...rows[0].settled],[1]);
active[Symbol.dispose]();active.settle(0);assert.deepEqual(rows,[]);
const selectHttp=new Function('r','Mn','t','return '+source.slice(3009066,3009247));
const http={hook:{type:'http',url:'http://fixture.invalid'}},command={hook:{type:'command',command:'fixture'}};
for(const event of ['SessionStart','Setup'])assert.deepEqual(selectHttp(event,[http,command],()=>{}),[command]);
for(const event of ['UserPromptSubmit','Notification'])assert.deepEqual(selectHttp(event,[http,command],()=>{}),[http,command]);
console.log(JSON.stringify({sourceBodies:ledger.length,copiedGuardCases:4,errorClassificationCases:2,uiSettlementCases:2,httpSelectionCases:4,entrypointsExecuted:0}));
