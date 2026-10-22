import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
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
export interface ExternalEditorSelection { command: string | undefined }
function executable(name: string): string | undefined {
  const candidates = name.includes(path.sep) ? [name] : (process.env.PATH ?? '').split(path.delimiter).map(directory => path.join(directory,name));
  for (const candidate of candidates) {
    try {if (fs.statSync(candidate).isFile()) {fs.accessSync(candidate,fs.constants.X_OK);return candidate;}}
    catch { /* A missing PATH candidate falls through to the next source default. */ }
  }
  return undefined;
}

// Node adaptation of Zie [3072,3957), UTF-16, chunk-7tnkhv2k.js:
// inherited ownership survives wrapper exit without changing the foreground TTY group.
function editorProcesses(owner: string, pid?: number): {pid: number; started: string}[] {
  const rows = execFileSync('ps',['eww',...(pid === undefined ? ['-axo'] : ['-p',String(pid),'-o']),
    'pid=,stat=,lstart=,command='],{encoding:'utf8',timeout:2000,maxBuffer:32*1024*1024});
  return rows.split('\n').flatMap(row => {
    const match = /^\s*(\d+)\s+(\S+)\s+(\w+\s+\w+\s+\d+\s+[\d:]+\s+\d+)\s+(.*)$/.exec(row);
    if (!match || match[2]?.startsWith('Z') || !match[4]?.split(/\s+/).includes(`LITCODE_EDITOR_OWNER=${owner}`)) return [];
    return [{pid:Number(match[1]),started:match[3] ?? ''}];
  });
}

async function settleEditorProcesses(owner: string): Promise<void> {
  const signalOwned = (name: NodeJS.Signals) => {
    for (const processInfo of editorProcesses(owner).reverse()) {
      try {
        const current = editorProcesses(owner,processInfo.pid)[0];
        if (current?.started === processInfo.started) process.kill(current.pid,name);
      } catch (error) {
        // ps exits 1 when a selected process has already disappeared.
        if (!(error instanceof Error && ('status' in error && error.status === 1 || 'code' in error && error.code === 'ESRCH'))) throw error;
      }
    }
  };
  signalOwned('SIGTERM');
  for (let attempt=0;attempt<10;attempt++) {
    if (editorProcesses(owner).length === 0) return;
    await delay(25);
  }
  signalOwned('SIGKILL');
  for (let attempt=0;attempt<80;attempt++) {
    if (editorProcesses(owner).length === 0) return;
    await delay(25);
  }
  throw new Error('External editor processes did not settle');
}

/** Source file/argument/refold lifecycle; Node owns the cancellable child and private directory. */
export async function editExternal(snapshot: Omit<InputSnapshot, 'cursor' | 'pastedContents'> & Partial<Pick<InputSnapshot, 'cursor' | 'pastedContents'>>, handoff: EditorHandoff, signal: AbortSignal,
  workspace = process.cwd(), selection?: ExternalEditorSelection): Promise<ExternalEditorResult> {
  const directory = fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR,'tmp') : os.tmpdir(),'litcode-editor-'));
  fs.chmodSync(directory,0o700);
  const filename = path.join(directory,'prompt.md');
  let suspended = false;
  const suspend = () => {suspended = true;handoff.suspend();};
  const resume = () => {};
  const source = initializeExternalEditor(editorDependencies(suspend, resume, signal, workspace, filename, selection));
  try {
    if (signal.aborted) return {content:null};
    return await source.edit(snapshot.text,snapshot.pastedContents,undefined,snapshot.cursor);
  } finally {
    try {fs.rmSync(directory,{recursive:true,force:true});}
    finally {if(suspended)handoff.resume();}
  }
}

/**
 * `Zie`: open an existing file in the user's editor and read it back. The draft flow above
 * writes its own temporary file, so this one takes the path as given and returns `content:
 * null` when the file is absent or the editor failed, with `error` set only for a failure.
 */
export async function openExternalFile(file: string, handoff: EditorHandoff | undefined, signal: AbortSignal,
  workspace = process.cwd(), selection?: ExternalEditorSelection): Promise<ExternalEditorResult> {
  let suspended = false;
  const suspend = () => {suspended = true;handoff?.suspend();};
  const resume = () => {};
  const source = initializeExternalEditor(editorDependencies(suspend, resume, signal, workspace, file, selection));
  try {
    if (signal.aborted) return {content:null};
    return await source.open(file, undefined);
  } finally {if(suspended)handoff?.resume();}
}

/** hx, 7tnkhv2k [2859,2908), UTF-16: resolved command for the local editor consumer. */
export function externalEditorCommand(): string | undefined {
  const source = initializeExternalEditor(editorDependencies(() => {}, () => {}, new AbortController().signal, process.cwd(), ''));
  return source.resolve();
}

/** hx/XG, 7tnkhv2k [2859,2988), UTF-16: use the same resolver as the editor handoff. */
export function externalEditorName(): string | undefined {
  const source = initializeExternalEditor(editorDependencies(() => {}, () => {}, new AbortController().signal, process.cwd(), ''));
  const editor: string | undefined = source.resolve();
  return editor === undefined ? undefined : source.editorName(editor);
}

/** C/P/hx and Zie, 7tnkhv2k [2499,2908)/[3072,3957), UTF-16: one selection for both consumers. */
function editorDependencies(suspend: () => void, resume: () => void, signal: AbortSignal,
  workspace: string, filename: string, selection?: ExternalEditorSelection) {
  return {
    resolveEditor: selection === undefined ? undefined : () => selection.command,
    a:process.env, MN:executable, h:path.basename, oi:() => new Map([[process.stdout,{
      enterAlternateScreen:suspend,exitAlternateScreen:resume,
      prepareTerminalForHandoff:suspend,restoreTerminalAfterHandoff:resume,
    }]]),
    ie:() => fs, lPe:() => filename,
    A8e:(file: string, content: string) => fs.writeFileSync(file,content,{encoding:'utf8',mode:0o600,flag:'wx'}),
    sce,HF,tJ,Ub:(command: string) => path.basename(command.split(' ')[0] ?? command),
    I:(command: string, args: string[]) => new Promise(resolve => {
      if (signal.aborted) {resolve({status:null,signal:'SIGTERM'});return;}
      const owner = randomUUID();
      let child: ReturnType<typeof spawn>;
      try {child = spawn(command,args,{cwd:workspace,stdio:'inherit',windowsHide:true,
        env:{...process.env,LITCODE_EDITOR_OWNER:owner}});}
      catch (error) {resolve({status:null,error});return;}
      let failure: Error | undefined;
      let settling: Promise<void> | undefined;
      const settle = () => settling ??= (async () => {
        if(process.platform==='win32') {
          if(signal.aborted && child.pid && child.exitCode === null && child.signalCode === null)try {execFileSync('taskkill',['/pid',String(child.pid),'/T','/F'],{timeout:2000,stdio:'ignore'});}catch{}
        } else await settleEditorProcesses(owner);
      })().catch(error => {
        failure=error instanceof Error ? error : new Error(String(error));
        // Enumeration failure must still release the directly owned launcher (Zie host adaptation).
        if(child.exitCode === null && child.signalCode === null)child.kill('SIGKILL');
      });
      const abort = () => {void settle();};
      signal.addEventListener('abort',abort,{once:true});
      child.once('error',error => {failure = error;});
      child.once('close',async(status,terminated) => {
        await settle();signal.removeEventListener('abort',abort);
        resolve({status,signal:terminated,error:failure});
      });
      if(signal.aborted)abort();
    }),
  };
}
