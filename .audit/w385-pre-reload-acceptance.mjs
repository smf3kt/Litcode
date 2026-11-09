// Verify the copied reload gate and host raise wait together on an owned module.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import '../dist/plugin-chain-registry.js';
import { it } from '../dist/plugin-chain-host.js';
import { Cro } from '../dist/plugin-chain-classic-raise-source.js';
import { createChainRun, loadChainModuleFileInto } from '../dist/plugin-chain-loader.js';
import { raiseClassicPreToolUse } from '../dist/plugin-chain-tool-raise.js';
const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'pre-reload-gap-')));
const modulePath=path.join(root,'fixture.mjs'),marker=path.join(root,'entered');
let release;
const reload=new Promise(resolve=>{release=resolve});
let loaded,gate,running;
try {
  fs.writeFileSync(modulePath,`import fs from 'node:fs';export default {name:'reload-fixture',tier:'user',
    patterns:[{pattern:'classic.PreToolUse'}],handlers:{'classic.PreToolUse':async()=>{fs.writeFileSync(${JSON.stringify(marker)},'entered');return {}}}};`);
  loaded=await loadChainModuleFileInto(createChainRun(),{pluginName:'reload-fixture',modulePath});
  it().hooksRespawns.add(reload);
  let gateSettled=false;
  gate=Cro({event:'classic.PreToolUse',e:{}},new AbortController().signal);
  assert.ok(gate instanceof Promise);gate.then(()=>{gateSettled=true});
  let hostSettled=false;
  running=raiseClassicPreToolUse({tool:'probe',input:{}}).then(result=>{hostSettled=true;return result});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(fs.existsSync(marker),false);
  assert.equal(hostSettled,false);
  assert.equal(gateSettled,false);
  it().hooksRespawns.delete(reload);release();await gate;await running;
  assert.equal(fs.existsSync(marker),true);
  console.log(JSON.stringify({copiedGateWaited:true,hostInvokedBeforeReload:false,gateSettledAfterRelease:gateSettled,
    hostSettledAfterRelease:hostSettled,status:'verified',upstream:0,entrypointsExecuted:0}));
} finally {
  it().hooksRespawns.delete(reload);release();await gate;await running?.catch(()=>{});loaded?.unload();fs.rmSync(root,{recursive:true,force:true});
}
