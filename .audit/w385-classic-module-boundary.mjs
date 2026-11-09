// Owned fixtures through the compiled loader; never execute recovered entrypoints.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import '../dist/plugin-chain-registry.js';
import { createChainRun, loadChainModuleFileInto } from '../dist/plugin-chain-loader.js';
import { classicHookInput, raiseClassicEvent } from '../dist/plugin-chain-classic-raise.js';
import { Session } from '../dist/session.js';
import { defaultConfig } from '../dist/agent.js';
import { createClassicChainObserver } from '../dist/classic-hook-observer.js';

const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(fs.readFileSync('extracted-v2/manifest.json', 'utf8'));
const sources = [];
for (const [module, expected, ranges] of [
  ['chunk-2kdsvp3x.js', '2005e8ff7e9534510b3d7f687d6a190f21c5930f1d8e5397070e2fa018bf52d2',
    [['Rpr',33818,34569],['$o',34872,35397],['tt/rt',36530,37034],['jDe',37704,37996],['P0',39124,39281]]],
  ['chunk-nyce03br.js', '6a5164eba0f55eaa3a7122eaefb51a98b369a2422284bf6062b22cf91fab855f',
    [['chain region including aP/dx/Xt',111504,128400]]],
  ['chunk-p16hdq43.js', '0876812e3099d9038f2c1c8eaf18b9f878583ce15621d5867f58b46e91050c38',
    [['W',12696,14205],['bgo dispatch v',18214,18751]]],
]) {
  const bytes = fs.readFileSync(`extracted-v2/modules/${module}`), text = bytes.toString('utf8');
  assert.equal(hash(bytes), expected);
  assert.equal(manifest.modules.find(row => row.path === module).decodedSha256, expected);
  for (const [symbol,start,end] of ranges) sources.push({module,moduleSha256:expected,symbol,range:[start,end],
    coordinates:'zero-based half-open UTF-16',bodySha256:hash(text.slice(start,end))});
}
const cases = [];
for (const mode of ['return','throw','throw-with-core','pre-aborted']) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'classic-module-boundary-')));
  const trace = path.join(root,'trace'), modulePath = path.join(root,'fixture.mjs');
  fs.writeFileSync(modulePath, `import fs from 'node:fs';export default {name:'boundary-${mode}',tier:'user',
    patterns:[{pattern:'classic.WorktreeCreate'}],handlers:{'classic.WorktreeCreate':async()=>{
      fs.appendFileSync(${JSON.stringify(trace)},'entered\\n');
      ${mode.startsWith('throw') ? "fs.appendFileSync("+JSON.stringify(trace)+",'throwing\\n');throw Error('owned module failure');" : "fs.appendFileSync("+JSON.stringify(trace)+",'returning\\n');return {worktreePath:"+JSON.stringify(root)+"};"}
    }}};`);
  let loaded, session;
  try {
    loaded = await loadChainModuleFileInto(createChainRun(),{pluginName:`boundary-${mode}`,modulePath});
    session = Session.open(root,{config:{...defaultConfig(root,[]),model:'fixture'}});
    const id = crypto.randomUUID(); session.append({kind:'hook_start',id,event:'classic:WorktreeCreate'});
    const controller = new AbortController(); if(mode==='pre-aborted') controller.abort();
    const running = raiseClassicEvent({event:'WorktreeCreate',hookInput:classicHookInput('WorktreeCreate'),
      ...(mode==='throw-with-core'?{core:{name:'fixture-core',isCore:true,run:async()=>({})}}:{}),
      signal:controller.signal,observeChain:createClassicChainObserver(session,id)});
    let result;
    if(mode==='throw') await assert.rejects(running,/no implementation for classic.WorktreeCreate/);
    else result = await running;
    const entries = fs.readFileSync(trace,'utf8').trim().split('\n');
    assert.deepEqual(entries,['entered',mode.startsWith('throw')?'throwing':'returning']);
    const phase=mode==='throw'?'rejected':'fulfilled';
    assert.equal(session.classicHookChains[0].phase,phase);
    const modulePhase = mode.startsWith('throw') ? 'rejected' : 'fulfilled';
    assert.equal(session.classicHookModules.length,1);
    assert.equal(session.classicHookModules[0].phase,modulePhase);
    assert.equal(session.classicHookModules[0].chainInvocationId,session.classicHookChains[0].invocationId);
    assert.equal(result?.answer.worktreePath,mode.startsWith('throw')?undefined:root);
    const owner=session.id;session.close();session=Session.open(root,{id:owner});
    assert.equal(session.classicHookChains[0].phase,phase);
    assert.equal(session.classicHookModules[0].phase,modulePhase);
    cases.push({mode,handler:entries,chain:phase,module:modulePhase,cold:phase});
  } finally {loaded?.unload();session?.close();fs.rmSync(root,{recursive:true,force:true});}
}
console.log(JSON.stringify({sources,cases,upstream:0,entrypointsExecuted:0},null,2));
