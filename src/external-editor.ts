import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { initializeExternalEditor } from './external-editor-source.js';
import { HF, tJ, sce } from './tui-input-paste-source.js';
import type { InputSnapshot } from './tui-input-paste.js';

export interface EditorHandoff {
  suspend(): void;
  resume(): void;
}
export interface ExternalEditorResult { content: string | null; error?: string }

function executable(name: string): string | undefined {
  const candidates = name.includes(path.sep) ? [name] : (process.env.PATH ?? '').split(path.delimiter).map(directory => path.join(directory,name));
  for (const candidate of candidates) {
    try {if (fs.statSync(candidate).isFile()) {fs.accessSync(candidate,fs.constants.X_OK);return candidate;}}
    catch { /* A missing PATH candidate falls through to the next source default. */ }
  }
  return undefined;
}

function descendantPids(root: number): number[] {
  const rows = execFileSync('ps',['-axo','pid=,ppid='],{encoding:'utf8',timeout:2000}).trim().split('\n')
    .map(row => row.trim().split(/\s+/).map(Number));
  const descendants: number[] = [];
  const visit = (parent: number) => {
    for(const [pid,ppid] of rows) if(pid!==undefined && ppid===parent && pid!==root && !descendants.includes(pid)) {
      descendants.push(pid);visit(pid);
    }
  };
  visit(root);return descendants.reverse();
}

/** Source file/argument/refold lifecycle; Node owns the cancellable child and private directory. */
export async function editExternal(snapshot: InputSnapshot, handoff: EditorHandoff, signal: AbortSignal,
  workspace = process.cwd()): Promise<ExternalEditorResult> {
  const directory = fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR,'tmp') : os.tmpdir(),'litcode-editor-'));
  fs.chmodSync(directory,0o700);
  const filename = path.join(directory,'prompt.md');
  const source = initializeExternalEditor({
    a:process.env, MN:executable, h:path.basename, oi:() => new Map([[process.stdout,{
      enterAlternateScreen:handoff.suspend,exitAlternateScreen:handoff.resume,
      prepareTerminalForHandoff:handoff.suspend,restoreTerminalAfterHandoff:handoff.resume,
    }]]),
    ie:() => fs, lPe:() => filename,
    A8e:(file: string, content: string) => fs.writeFileSync(file,content,{encoding:'utf8',mode:0o600,flag:'wx'}),
    sce,HF,tJ,Ub:(command: string) => path.basename(command.split(' ')[0] ?? command),
    I:(command: string, args: string[]) => new Promise(resolve => {
      if (signal.aborted) {resolve({status:null,signal:'SIGTERM'});return;}
      let child: ReturnType<typeof spawn>;
      try {child = spawn(command,args,{cwd:workspace,stdio:'inherit',windowsHide:true});}
      catch (error) {resolve({status:null,error});return;}
      let escalation: ReturnType<typeof setTimeout> | undefined;
      let failure: Error | undefined;
      let cancelling: Promise<void> | undefined;
      // Keep the editor in the foreground TTY group; stop its descendants before the launcher.
      const signalDescendants = (pids: readonly number[], name: NodeJS.Signals) => {
        for(const pid of pids) {
          try {process.kill(pid,name);} catch(error) {if((error as NodeJS.ErrnoException).code!=='ESRCH')throw error;}
        }
      };
      const abort = () => {
        if(cancelling)return;
        cancelling=(async()=>{
          if(process.platform==='win32') {
            if(child.pid)try {execFileSync('taskkill',['/pid',String(child.pid),'/T','/F'],{timeout:2000,stdio:'ignore'});}catch{}
          } else if(child.pid) {
            const descendants=descendantPids(child.pid);
            signalDescendants(descendants,'SIGTERM');await delay(50);
            signalDescendants(descendants,'SIGKILL');await delay(25);
          }
          child.kill('SIGTERM');
          escalation=setTimeout(()=>child.kill('SIGKILL'),250);escalation.unref();
        })().catch(error=>{failure=error;child.kill('SIGKILL');});
      };
      signal.addEventListener('abort',abort,{once:true});
      child.once('error',error => {failure = error;});
      child.once('close',async(status,terminated) => {
        signal.removeEventListener('abort',abort);await cancelling;if(escalation)clearTimeout(escalation);
        resolve({status,signal:terminated,error:failure});
      });
      if(signal.aborted)abort();
    }),
  });
  try {
    if (signal.aborted) return {content:null};
    return await source.edit(snapshot.text,snapshot.pastedContents,undefined,snapshot.cursor);
  } finally {fs.rmSync(directory,{recursive:true,force:true});}
}
