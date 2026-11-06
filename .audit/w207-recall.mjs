import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TerminalScreen } from '../scripts/terminal-screen.mjs';
const root='/Users/mant1ssa/Projects/cc_reverse';
const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'w207r-ws-'));
const user=fs.mkdtempSync(path.join(os.tmpdir(),'w207r-user-'));
fs.mkdirSync(path.join(workspace,'.harness'),{recursive:true});
const env={...process.env,TERM:'xterm-256color',LC_ALL:'en_US.UTF-8',LANG:'en_US.UTF-8',LLM_API_KEY:'f',LLM_MODEL:'fixture/probe',LLM_BASE_URL:'http://127.0.0.1:9',LLM_AUTH:'bearer',LLM_TOKEN_COUNTING:'estimate',LLM_THINKING:'false'};
for(const k of Object.keys(env)) if(/^ANTHROPIC_/.test(k)) delete env[k];
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function run(drive){const child=spawn('/usr/bin/expect',[path.join(root,'.audit/w205-footer.exp'),process.execPath,path.join(root,'bin/personal-harness.mjs'),'--workspace',workspace,'--user-dir',user,'--interactive'],{cwd:root,env,stdio:['pipe','pipe','pipe']});
 const chunks=[];child.stdout.on('data',c=>chunks.push(c));child.stderr.on('data',()=>{});
 await delay(1500);await drive(child);
 if(drive.snapshot){const screen=new TerminalScreen(100,30);screen.write(Buffer.concat(chunks).toString('utf8'));const rows=screen.lines();screen.close();console.log('ROWS',JSON.stringify(rows.filter(r=>r.trim()).slice(-4)));}
 child.kill('SIGKILL');await new Promise(r=>child.once('close',r));}
const lines=Array.from({length:60},(_,i)=>`paste line ${i} ${'x'.repeat(20)}`);
await run(async child=>{child.stdin.write('\u001b[200~'+lines.join('\n')+'\u001b[201~');await delay(600);child.stdin.write('\r');await delay(1500);});
const cache=path.join(user,'paste-cache');
console.log('files',JSON.stringify(fs.existsSync(cache)?fs.readdirSync(cache):[]));
for(const f of fs.readdirSync(cache)) fs.rmSync(path.join(cache,f));
const drive=async child=>{child.stdin.write('\u001b[A');await delay(800);};
drive.snapshot=true;
await run(drive);
fs.rmSync(workspace,{recursive:true,force:true});fs.rmSync(user,{recursive:true,force:true});
