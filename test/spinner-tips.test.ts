import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import type { Terminal } from '@xterm/headless';
const { Terminal: HeadlessTerminal } = createRequire(import.meta.url)('@xterm/headless') as { Terminal: typeof Terminal };
import { defaultConfig } from '../src/agent.js';
import { loadProjectConfig, loadManagedSettingsDirectory } from '../src/config.js';
import { reloadConfig } from '../src/reload.js';
import { Session } from '../src/session.js';
import { parseSettings } from '../src/runtime.js';
import { SpinnerTipFileCache, initializeSpinnerTips, selectSpinnerTip } from '../src/spinner-tips-source.js';
import { spinnerTipsOverrideSchema } from '../src/spinner-tips-settings.js';
import { SpinnerTips, SpinnerTipsHistory, beginSpinnerTipsStartup, type SpinnerTipText } from '../src/spinner-tips.js';
import { TuiTerminal } from '../src/tui.js';
import { acquirePluginStoreLock } from '../src/plugin-chain-lockfile.js';

function temporary(): string {
  return fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
    ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w293-tips-')));
}

test('custom Tips preserve source trust, file bounds and cache, schema projection and reload', async () => {
  const root = temporary(), user = path.join(root,'user'), file = path.join(root,'tips.json');
  fs.mkdirSync(user); fs.mkdirSync(path.join(root,'.harness')); fs.mkdirSync(path.join(root,'.git'));
  const warnings: string[] = [], cache = new SpinnerTipFileCache(), warn = (message: string)=>warnings.push(message);
  try {
    fs.writeFileSync(file,'﻿'+JSON.stringify({tips:['From file',{id:'same',text:'File duplicate'}]}));
    fs.writeFileSync(path.join(user,'settings.json'),JSON.stringify({spinnerTipsOverride:{label:'\x1b[31mLocal\x1b[0m\nLabel',tipsFile:file,
      tips:[{id:'same',text:'\x1b[32mOne\x1b[0m\n  line​',cooldownSessions:1001,priority:40,secret:'discard'},42,null,[],'x'.repeat(501),'']}}));
    fs.writeFileSync(path.join(root,'.harness/settings.json'),JSON.stringify({spinnerTipsOverride:{label:'Untrusted',tipsFile:'/project/path',
      tips:[{id:'project',text:'Ignored object'},'Project text']}}));
    const explicit = path.join(root,'flag.json');
    fs.writeFileSync(explicit,JSON.stringify({spinnerTipsOverride:{tips:['Flag text']}}));
    const managed = path.join(root,'managed.json');
    fs.writeFileSync(managed,JSON.stringify({spinnerTipsEnabled:true,spinnerTipsOverride:{tips:['Managed text']}}));
    const loaded = loadProjectConfig(root,{userDir:user,settingsFile:explicit,managedSettingsFile:managed,paths:[]});
    const {tips,trustedCount} = await initializeSpinnerTips(loaded.spinnerTipsLayers!,warn,cache).xmn();
    assert.equal(trustedCount,4);
    assert.deepEqual(await Promise.all(tips.map(async item=>[item.id,item.label,await item.content(),item.cooldownSessions,item.priority])),[
      ['custom-tip-0','Local Label','Managed text',0,0],['custom-tip-1','Local Label','Flag text',0,0],
      ['org-tip:same','Local Label','One line',1000,10],['org-tip:file:0','Local Label','From file',0,0],
      ['custom-tip-6','Tip','Project text',0,0],
    ]);
    assert.ok(warnings.some(message=>message.includes('duplicate tip id')));
    assert.ok(warnings.some(message=>message.includes('object tip entries in projectSettings')));
    assert.ok(warnings.some(message=>message.includes('longer than 500')));
    fs.writeFileSync(file,JSON.stringify(['Changed file']));
    assert.equal((await cache.read(file,warn)).entries[0],'From file');
    assert.equal((await new SpinnerTipFileCache().read(file,warn)).entries[0],'Changed file');
    const absent = path.join(root,'missing.json');
    assert.deepEqual((await cache.read(absent,warn)).entries,[]);
    fs.writeFileSync(absent,'["later"]');
    assert.deepEqual((await cache.read(absent,warn)).entries,[]);
    for (const [name,bytes] of [['large',' '.repeat(262145)],['invalid','{'],['wrong','{}']] as const) {
      const target = path.join(root,name); fs.writeFileSync(target,bytes);
      assert.deepEqual((await cache.read(target,warn)).entries,[]);
    }
    assert.deepEqual((await cache.read(root,warn)).entries,[]);
    const invalid = await initializeSpinnerTips([{source:'userSettings',override:{tipsFile:'relative.json',tips:['Valid']}}],warn,cache).xmn();
    assert.equal(await invalid.tips[0]!.content(),'Valid');
    const unc = await initializeSpinnerTips([{source:'userSettings',override:{tipsFile:'//host/file'}}],warn,cache).xmn();
    assert.equal(unc.tips.length,0);
    const boundary = await initializeSpinnerTips([{source:'userSettings',override:{label:'L'.repeat(39)+'😀',tips:['a'.repeat(500),...Array.from({length:205},(_,i)=>String(i))]}}],warn,cache).xmn();
    assert.equal(boundary.tips.length,200); assert.equal(boundary.tips[0]!.label,'L'.repeat(39));
    assert.equal((await boundary.tips[0]!.content()).length,500);
    assert.equal(spinnerTipsOverrideSchema.parse({label:7,tipsFile:2,tips:[null,4,[],{},'yes']})?.tips?.length,2);
    const config = {...defaultConfig(root,[]),model:'fixture',configSources:{userDir:user,settingsFile:explicit,managedSettingsFile:managed},spinnerTipsLayers:loaded.spinnerTipsLayers};
    const session = Session.open(root,{config}); const id = session.id; session.close();
    const resumed = Session.open(root,{id}); resumed.close();
    const journal = fs.readFileSync(path.join(root,'.agent',`${id}.jsonl`),'utf8');
    assert.equal(journal.includes('"secret"'),false);
    const directory = path.join(root,'managed'); fs.mkdirSync(directory); fs.mkdirSync(path.join(directory,'managed-settings.d'));
    fs.writeFileSync(path.join(directory,'managed-settings.json'),JSON.stringify({spinnerTipsOverride:{tips:['Base']},allowShell:false}));
    fs.writeFileSync(path.join(directory,'managed-settings.d','10.json'),JSON.stringify({spinnerTipsOverride:{label:'Policy'}}));
    const disk = loadManagedSettingsDirectory(directory);
    assert.deepEqual(disk.settings,{allowShell:false});
    assert.equal(disk.displaySettings?.spinnerTipsOverride?.label,'Policy');
    assert.equal(disk.report.ignoredKeys.length,0);
    for (const target of [path.join(user,'settings.json'),path.join(root,'.harness/settings.json'),explicit,managed]) fs.writeFileSync(target,'{}');
    const next = reloadConfig(config);
    assert.equal(next.spinnerTipsEnabled,undefined); assert.equal(next.spinnerTipsLayers,undefined);
    assert.equal(parseSettings({spinnerTipsEnabled:false}).spinnerTipsEnabled,false);
    assert.throws(()=>parseSettings({spinnerTipsEnabled:'false'}));
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});

test('Tip startup history, cooldown, priority and publication retain pending, rebind and close ownership', async () => {
  const root = temporary(), file = path.join(root,'spinner-tips.json'), warnings: string[] = [];
  try {
    const history = new SpinnerTipsHistory(file); await history.start();
    const {tips} = await initializeSpinnerTips([{source:'userSettings',override:{tips:[
      {id:'a',text:'A',priority:1,cooldownSessions:1},{id:'b',text:'B',priority:4},
    ]}}],message=>warnings.push(message)).xmn();
    assert.equal(selectSpinnerTip(tips,id=>history.sessionsSince(id))?.id,'org-tip:b');
    await history.shown('org-tip:b'); await history.shown('org-tip:b');
    assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).tipLifetimeShownCounts['org-tip:b'],1);
    assert.equal(selectSpinnerTip(tips,id=>history.sessionsSince(id))?.id,'org-tip:a');
    const sibling = new SpinnerTipsHistory(file); await sibling.start();
    await history.shown('org-tip:a');
    assert.equal(history.sessionsSince('org-tip:a'),0,'another CLI startup does not move this process startup');
    const disk = JSON.parse(fs.readFileSync(file,'utf8'));
    assert.equal(disk.numStartups,2); assert.equal(disk.tipsHistory['org-tip:a'],1);
    await sibling.shown('org-tip:a'); await history.shown('org-tip:a'); await history.shown('org-tip:a');
    const interleaved = JSON.parse(fs.readFileSync(file,'utf8'));
    assert.equal(interleaved.tipsHistory['org-tip:a'],2,'the older process keeps the newer cooldown record');
    assert.equal(interleaved.tipLifetimeShownCounts['org-tip:a'],2,'each process startup counts a Tip once');
    await sibling.shown('org-tip:future'); await history.shown('org-tip:other');
    assert.equal(history.sessionsSince('org-tip:future'),0,'a newer CLI history stays eligible at zero cooldown');
    assert.equal(fs.existsSync(file+'.lock'),false);
    let release: ((history: SpinnerTipsHistory)=>void) | undefined;
    const pending = new Promise<SpinnerTipsHistory>(resolve=>{release=resolve;});
    const published: Array<SpinnerTipText | undefined> = [];
    const owner = new SpinnerTips(pending,tip=>published.push(tip),message=>warnings.push(message));
    const layers = [{source:'userSettings' as const,override:{tips:[{id:'owned',text:'Held'}]}}];
    owner.bind('one',true,layers); assert.equal(published.length,0);
    owner.start(); owner.finish(); owner.setActive(false); owner.start(); release!(history);
    await owner.flush(); assert.equal(published.length,0,'a later active turn holds the completed selection');
    owner.finish(); owner.setActive(false); await owner.flush();
    assert.deepEqual(published,[{text:'Held',label:'Tip'}]);
    owner.bind('one',false,layers); owner.start(); owner.finish(); owner.setActive(false); await owner.flush();
    assert.equal(published.at(-1),undefined);
    owner.bind('one',true,layers); owner.start(); owner.finish(); owner.bind('two',true,[]);
    owner.setActive(false); await owner.flush(); assert.equal(published.at(-1),undefined);
    const count = published.length; owner.start(); owner.finish(); owner.close(); await owner.flush();
    assert.equal(published.length,count); assert.deepEqual(warnings,[]);
    const before = JSON.parse(fs.readFileSync(file,'utf8')).numStartups;
    const first = await beginSpinnerTipsStartup(root), second = await beginSpinnerTipsStartup(root);
    assert.equal(first,second); assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).numStartups,before+1);
    const corrupt = path.join(root,'corrupt'); fs.writeFileSync(corrupt,'{bad');
    await assert.rejects(new SpinnerTipsHistory(corrupt).start()); assert.equal(fs.readFileSync(corrupt,'utf8'),'{bad');
    const recovering = path.join(root,'recovering'); fs.mkdirSync(recovering);
    fs.writeFileSync(path.join(recovering,'spinner-tips.json'),'{bad');
    await assert.rejects(beginSpinnerTipsStartup(recovering));
    fs.writeFileSync(path.join(recovering,'spinner-tips.json'),'{}');
    await beginSpinnerTipsStartup(recovering);
    assert.equal(JSON.parse(fs.readFileSync(path.join(recovering,'spinner-tips.json'),'utf8')).numStartups,1);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});

test('the native spinner wraps dim Tips on the next turn and preserves drafts, tasks, toggle and cleanup', async () => {
  const root = temporary(), user = path.join(root,'user'); fs.mkdirSync(user);
  const input = new PassThrough(); Object.assign(input,{isTTY:true,setRawMode() {}});
  const screen = new HeadlessTerminal({cols:68,rows:24,allowProposedApi:true,logLevel:'off'});
  const output = new Writable({write(chunk,_encoding,done){
    (screen as unknown as {_core:{writeSync(text:string):void}})._core.writeSync(String(chunk));done();
  }});
  Object.assign(output,{isTTY:true,columns:68,rows:24});
  const config = {...defaultConfig(root,[]),model:'fixture',configSources:{userDir:user},spinnerTipsLayers:[{source:'userSettings' as const,
    override:{label:'Local',tips:['Keep a focused change and verify the actual command.']}}]};
  const session = Session.open(root,{config}), tui = new TuiTerminal({input,output,userDir:user,prefersReducedMotion:true}).start();
  let turn = 0;
  const start = ()=>{tui.setRunning(true);tui.setProgress({kind:'start',uuid:`tip-${++turn}`,startedAt:Date.now()});};
  const finish = async ()=>{tui.setProgress({kind:'finish',reason:'end_turn',duration:{uuid:`tip-${turn}`,durationMs:1,timestamp:new Date().toISOString()}});tui.setRunning(false);await tui.flushSpinnerTips();};
  const text = ()=>Array.from({length:screen.rows},(_,row)=>
    screen.buffer.active.getLine(screen.buffer.active.viewportY+row)?.translateToString(true)??'').join('\n');
  try {
    tui.bindSpinnerTips(session); input.emit('data','kept draft'); start();
    assert.equal(text().includes('Local:'),false); await finish(); start();
    assert.match(text(),/Local: Keep a focused change/); assert.match(text(),/actual command\./);
    tui.setTasks([{id:'1',subject:'Owned task',description:'',status:'in_progress',blockedBy:[],metadata:{}}]);
    assert.match(text(),/1 tasks/); assert.equal(text().includes('Local:'),false); tui.setTasks([]);
    Object.assign(output,{columns:36}); screen.resize(36,24); output.emit('resize');
    assert.match(text(),/Local: Keep a focused/); assert.match(text(),/actual command\./);
    const modal = tui.prompt({message:'Owned question',allowText:true},new AbortController().signal);
    input.emit('data','answer\r'); await modal; assert.equal(tui.state.text,'kept draft');
    await finish(); session.config.spinnerTipsEnabled=false; tui.bindSpinnerTips(session);
    start(); assert.match(text(),/Local:/,'an already selected Tip remains until the disabled pick');
    await finish(); start(); assert.equal(text().includes('Local:'),false); await finish();
    session.config.spinnerTipsEnabled=true; tui.bindSpinnerTips(session); start(); await finish(); start();
    assert.match(text(),/Local:/); assert.equal(tui.state.text,'kept draft');
    await finish();
    const nextUser = path.join(root,'next-user'); fs.mkdirSync(nextUser);
    session.config.configSources = { userDir: nextUser };
    session.config.spinnerTipsLayers = [{source:'userSettings',override:{label:'Next',tips:[{id:'next',text:'Next directory'}]}}];
    tui.bindSpinnerTips(session); start(); await finish(); start();
    assert.match(text(),/Next: Next directory/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(user,'spinner-tips.json'),'utf8')).tipsHistory['org-tip:next'],undefined);
    assert.equal(JSON.parse(fs.readFileSync(path.join(nextUser,'spinner-tips.json'),'utf8')).tipLifetimeShownCounts['org-tip:next'],1);
    const lockedUser = path.join(root,'locked-user'); fs.mkdirSync(lockedUser);
    const lockedFile = path.join(lockedUser,'spinner-tips.json');
    const releaseLock = await acquirePluginStoreLock(lockedFile,{realpath:false});
    let flushed = false, returnedWhileLocked = false;
    session.config.configSources = {userDir:lockedUser};
    tui.bindSpinnerTips(session); tui.close();
    const flushing = tui.flushSpinnerTips().then(()=>{flushed=true;});
    try { await delay(45); returnedWhileLocked=flushed; }
    finally { await releaseLock(); }
    await flushing; await beginSpinnerTipsStartup(lockedUser);
    assert.equal(returnedWhileLocked,false,'terminal flush waits for the startup acquisition');
    const settled = fs.readFileSync(lockedFile,'utf8'); await delay(20);
    assert.equal(fs.readFileSync(lockedFile,'utf8'),settled);
    assert.equal(fs.existsSync(path.join(user,'spinner-tips.json.lock')),false);
    assert.equal(JSON.parse(fs.readFileSync(path.join(user,'spinner-tips.json'),'utf8')).tipLifetimeShownCounts['custom-tip-0'],1);
  } finally { tui.close(); await tui.flushSpinnerTips(); screen.dispose(); session.close(); fs.rmSync(root,{recursive:true,force:true}); }
});
