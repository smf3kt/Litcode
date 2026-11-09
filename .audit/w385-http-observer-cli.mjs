import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
const url = name => new URL(`../dist/${name}.js`, import.meta.url).href;
for (const cut of ['normal', 'admitted', 'settled', 'returned']) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w385-http-observer-cli-')));
  const user = path.join(root, 'user'), preload = path.join(root, 'provider.mjs');
  let requests = 0;
  const server = http.createServer((request, response) => { requests++; request.resume(); response.end('{}'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}`;
  try {
    fs.mkdirSync(user); fs.mkdirSync(path.join(root, '.git')); fs.mkdirSync(path.join(root, '.harness'));
    fs.writeFileSync(path.join(root, 'value'), 'LOCAL');
    fs.writeFileSync(path.join(root, '.harness/settings.json'), JSON.stringify({ hooks: { PreToolUse: [{ type: 'http', url: endpoint, once: true }] } }));
    fs.writeFileSync(preload, `const original=globalThis.fetch;globalThis.fetch=(input,init)=>{
      if(String(input)!==${JSON.stringify(endpoint)})throw Error('external network disabled');return original(input,init)};
      const {Session}=await import(${JSON.stringify(url('session'))});
      const {GatewayProvider}=await import(${JSON.stringify(url('provider'))});
      const resume=process.env.HTTP_OBSERVER_RESUME==='1',append=Session.prototype.append;
      Session.prototype.append=function(event,...args){
        if(resume&&event.kind==='hook_resolver')throw Error('HTTP replay');
        const result=Reflect.apply(append,this,[event,...args]);
        if(!resume&&event.kind==='hook_resolver'&&event.transition.phase===${JSON.stringify(cut)})process.kill(process.pid,'SIGKILL');
        return result;};
      let calls=0;GatewayProvider.prototype.count=async()=>1;GatewayProvider.prototype.complete=async()=>{
        const tool=!resume&&++calls===1;return{id:'fixture',model:'fixture',type:'message',role:'assistant',stop_sequence:null,
          content:tool?[{type:'tool_use',id:'read',name:'read_file',input:{path:'value'}}]:[{type:'text',text:'DONE'}],
          stop_reason:tool?'tool_use':'end_turn',usage:{input_tokens:1,output_tokens:1}};};`);
    const env = { ...process.env, HOME: user, LLM_API_KEY: 'fixture-only', NODE_OPTIONS: `--import=${preload}` };
    const run = (args, extra = {}) => new Promise((resolve, reject) => {
      const child = spawn(process.execPath, args, { env: { ...env, ...extra }, stdio: ['pipe', 'pipe', 'pipe'], timeout: 20000 });
      let output = ''; child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; });
      child.on('error', reject); child.on('close', (code, signal) => resolve({ code, signal, output })); child.stdin.end('continue\n');
    });
    const first = await run(['bin/litcode.mjs', '--workspace', root, '--user-dir', user, '--model', 'fixture', '--interactive', '--no-tui', '--no-inherit-gateway']);
    if (cut === 'normal') assert.equal(first.code, 0, first.output); else assert.equal(first.signal, 'SIGKILL', first.output);
    const files = fs.readdirSync(path.join(root, '.agent')).filter(name => name.endsWith('.jsonl')); assert.equal(files.length, 1);
    const id = files[0].slice(0, -6);
    const expected = fs.readFileSync(path.join(root, '.agent', files[0]), 'utf8').trim().split('\n').map(JSON.parse).filter(row => row.kind === 'hook_resolver');
    assert.equal(expected.length, cut === 'admitted' ? 1 : cut === 'settled' ? 2 : 3);
    assert.ok(expected.every(row => row.resolverType === 'http'));
    for (let reader = 0; reader < 2; reader++) {
      const cold = spawnSync(process.execPath, ['--input-type=module', '-e', `
        import assert from 'node:assert/strict';import {Session,readSessionJournal} from ${JSON.stringify(url('session'))};
        import {forkSession} from ${JSON.stringify(url('sessions'))};
        const s=Session.open(process.argv[1],{id:process.argv[2],recoverLock:true});
        assert.deepEqual(readSessionJournal(process.argv[1],process.argv[2],{maxBytes:10000000,maxEvents:10000}),s.events);
        assert.deepEqual(s.events.filter(e=>e.kind==='hook_resolver'),JSON.parse(process.argv[3]));
        const state=s.hookResolverObservations[0];assert.equal(state.resolver,process.argv[4]==='admitted'?'pending':'fulfilled');
        assert.equal(state.runner,['normal','returned'].includes(process.argv[4])?'completed':undefined);
        if(!s.awaitingResponse){const f=forkSession(s);assert.deepEqual(f.hookResolverObservations,[]);f.close();}s.close();`,
        root, id, JSON.stringify(expected), cut], { encoding: 'utf8', timeout: 10000 });
      assert.equal(cold.status, 0, cold.stderr + cold.stdout);
      if (reader === 0) {
        const resumed = await run(['bin/litcode.mjs', '--workspace', root, '--interactive', '--no-tui', '--resume', id], { HTTP_OBSERVER_RESUME: '1' });
        assert.equal(resumed.code, 0, resumed.output);
      }
    }
    assert.equal(requests, cut === 'admitted' ? 0 : 1);
    console.log(JSON.stringify({ cut, requests, records: expected.length, coldReaders: 2, resumed: true, upstream: 0 }));
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); fs.rmSync(root, { recursive: true, force: true }); }
}
