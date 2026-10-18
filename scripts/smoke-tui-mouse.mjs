import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { TerminalScreen } from './terminal-screen.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const cliIndex = process.argv.indexOf('--cli');
const cli = cliIndex < 0 ? path.join(root, 'bin/litcode.mjs') : process.argv[cliIndex + 1];
assert.ok(cli, '--cli requires an executable path');
const line = process.argv.includes('--line');
const questionEditorCancel = process.argv.includes('--question-editor-cancel');
const questionEditor = process.argv.includes('--question-editor') || questionEditorCancel;
const previews = process.argv.includes('--preview') || questionEditor;
const clarification = process.argv.includes('--clarification');
const narrow = process.argv.includes('--narrow');
const dialogs = process.argv.includes('--dialogs') || previews || clarification;
const actions = process.argv.includes('--actions');
const inputClose = process.argv.includes('--input-close');
const pacing = process.argv.includes('--pacing') || inputClose;
const visibility = process.argv.includes('--visibility');
const proseWidth = process.argv.includes('--prose-width');
const highlighting = process.argv.includes('--highlight-setting');
const theming = process.argv.includes('--theme-setting');
const systemTheme = process.argv.includes('--system-theme');
const systemThemeMux = process.argv.includes('--system-theme-mux');
const customTheme = process.argv.includes('--custom-theme');
const pluginTheme = process.argv.includes('--plugin-theme');
const themeEditor = process.argv.includes('--theme-editor');
const thinkingProgress = process.argv.includes('--thinking-progress');
const progressSettings = process.argv.includes('--progress-settings');
const themeBody = 'Use `sample` text.\n\n> Quote preview\n\n';
const highlightBody = '```ts\nconst value = 1;\n```\n\n';
const windowsTerminal = process.argv.includes('--windows-terminal');
const killing = process.argv.includes('--kill-ring');
const undoing = process.argv.includes('--undo');
const folding = process.argv.includes('--fold-paste');
const externalEditing = process.argv.includes('--external-editor');
const vimEditing = process.argv.includes('--vim');
const returnEditing = process.argv.includes('--return-gesture');
const confirmingInput = process.argv.includes('--input-gestures');
const terminalFocus = process.argv.includes('--terminal-focus');
const statusLineMode = process.argv.includes('--status-line');
const diffPanel = process.argv.includes('--diff-panel');
const returnExpected=[];
const vimExpected=[];
const editing = process.argv.includes('--editing') || killing || undoing || folding;
const messages = process.argv.includes('--messages') || pacing || visibility || proseWidth || highlighting || theming || systemTheme || customTheme || pluginTheme || themeEditor || thinkingProgress || progressSettings;
const proseText = 'ProseWord '.repeat(9).trim();
const prosePrefix = proseText + '\n\n';
const proseSuffix = '```text\n' + 'CodeWide'.repeat(9) + '\n```\n\n'
  + '| Long cell | End |\n|---|---|\n| ' + 'TableWide'.repeat(6) + ' | cell |\n';
const messageUnicode = '界👩‍💻é'.repeat(12);
const streamingChunks = process.argv.includes('--stream-chunks');
const messageText = (streamingChunks ? 'Frozen prefix paragraph.\n\n'.repeat(180) : '')
  + '# Message layout\n\nOne streamed sentence keeps its words together.\n\n- First item\n- 第二项\n\n'
  + messageUnicode + '\n\n```ts\n' + (streamingChunks ? 'const frozen = 1;\n'.repeat(240) : '')
  + 'const value = 1;\n```\n';
const temporary = fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? `${process.env.CLAUDE_JOB_DIR}/tmp` : root, '.tui-mouse-'));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user);
if (diffPanel) {
  const git = args => {
    const result = spawnSync('git', args, { cwd: workspace, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  };
  git(['init', '-b', 'main']);
  fs.writeFileSync(path.join(workspace, 'sample.txt'), Array.from({ length: 70 }, (_, i) => `before ${i}`).join('\n') + '\n');
  git(['add', 'sample.txt']);
  git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-m', 'baseline']);
}
const statusLineCalls=path.join(workspace,'statusline-calls.jsonl');
const statusLineConfig=mode=>({editorMode:'vim',statusLine:{type:'command',command:process.execPath+' statusline-fixture.cjs '+mode,
  padding:2,refreshInterval:1,hideVimModeIndicator:true}});
if(statusLineMode){
  fs.writeFileSync(path.join(workspace,'statusline-fixture.cjs'),String.raw`const fs=require('node:fs');let text='';
process.stdin.on('data',chunk=>text+=chunk);process.stdin.on('end',()=>{const payload=JSON.parse(text),mode=process.argv[2];
fs.appendFileSync('statusline-calls.jsonl',JSON.stringify({pid:process.pid,mode,payload})+'\n');
if(mode==='slow'){setTimeout(()=>process.stdout.write('STALE\n'),4000);return;}
process.stdout.write('\x1b[31mFOOT '+mode+' '+(payload.vim?.mode??'plain')+'\nDETAIL '+(payload.context_window.current_usage?.input_tokens??0)+'\x1b[0m\n');});`);
  fs.writeFileSync(path.join(user,'settings.json'),JSON.stringify(statusLineConfig('A')));
}
if (visibility) fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ prefersReducedMotion: true }));
if (proseWidth) fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ maxProseWidth: 40 }));
if (highlighting) fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ syntaxHighlightingDisabled: true }));
if (theming) fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ theme: 'dark', unrelated: { keep: 1 } }));
if (systemTheme) fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ theme: 'auto' }));
const customThemeFile = path.join(user, 'themes/ocean.json');
const writeCustomTheme = (text, border, name = 'Ocean') => fs.writeFileSync(customThemeFile,
  JSON.stringify({ name, base: 'light', overrides: { text, promptBorder: border, unknown: '#ffffff' } }));
if (customTheme) {
  fs.mkdirSync(path.join(user, 'themes'));
  writeCustomTheme('#112233', '#445566');
  fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ theme: 'custom:ocean', unrelated: { keep: 1 } }));
}
let installThemePlugin;
if (pluginTheme || themeEditor) {
  const { createPluginTools } = await import('../dist/plugins.js');
  const source = path.join(temporary, 'theme-plugin'); fs.mkdirSync(path.join(source, 'themes'), { recursive: true });
  fs.writeFileSync(path.join(source, 'plugin.json'), JSON.stringify({ name: 'sample', version: '1' }));
  installThemePlugin = async (text = '#112233', border = '#445566') => {
    fs.writeFileSync(path.join(source, 'themes/ocean.json'), JSON.stringify({ name: 'Ocean', base: 'light', overrides: { text, promptBorder: border } }));
    const context = { workspace, signal: new AbortController().signal, maxOutputBytes: 100000, allowShell: false };
    const tools = createPluginTools({ enabled: true });
    const listed = JSON.parse(await tools.find(tool => tool.schema.name === 'plugin_list').execute({}, context));
    const previous = listed.plugins[0];
    await tools.find(tool => tool.schema.name === (previous ? 'plugin_update' : 'plugin_install')).execute(
      previous ? { name: 'sample', directory: source, expected_digest: previous.digest } : { directory: source }, context);
  };
  await installThemePlugin();
  fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ plugins: { enabled: true }, theme: themeEditor ? 'dark' : 'custom:sample:ocean', unrelated: { keep: 1 } }));
}
let progressTaskId;
if (thinkingProgress) {
  const {createTaskTools} = await import('../dist/tasks.js');
  const tools=createTaskTools(workspace), context={workspace,signal:new AbortController().signal,allowShell:false,maxOutputBytes:24000};
  const ids=[];
  for (let index=0;index<15;index++) {
    const row=JSON.parse(await tools.find(tool=>tool.schema.name==='task_create').execute({subject:'Fixture '+(index+1),description:'owned',activeForm:'Building fixture'},context));
    ids.push(row.id);
    await tools.find(tool=>tool.schema.name==='task_update').execute({id:row.id,status:index===14?'in_progress':'completed'},context);
  }
  progressTaskId=ids.at(-1);
  fs.writeFileSync(path.join(user,'settings.json'),JSON.stringify({thinking:true,permissions:{mode:'default',allow:['task_*'],deny:[]}}));
}
const initialProgressSettings = {thinking:true,timeFormat:'24-hour-utc',timeZone:'Asia/Tokyo',spinnerVerbs:{mode:'replace',verbs:['Owned building']}};
if (progressSettings) fs.writeFileSync(path.join(user,'settings.json'),JSON.stringify(initialProgressSettings));
if(vimEditing||terminalFocus)fs.writeFileSync(path.join(user,'settings.json'),JSON.stringify({editorMode:'vim',vimInsertModeRemaps:{jj:'<Esc>',jk:'<Esc>'},unrelated:{keep:1}}));
const questions = { questions: [{ question: 'Choose output', header: 'Fixture choice', multiSelect: false,
  options: [{ label: 'A', description: 'First', ...(previews || clarification ? { preview: '# Preview A\n\n```\nFirst layout\n```' } : {}) },
    { label: 'B', description: 'Second', ...(previews ? { preview: '# Preview B\n\n```\n'
      + Array.from({ length: 24 }, (_, index) => `preview-row-${index}`).join('\n') + '\n```' } : {}) }] }] };
if (clarification) questions.questions.push({ ...questions.questions[0], question: 'Choose follow-up' },
  { ...questions.questions[0], question: 'Choose tags', multiSelect: true });
if (questionEditor && !clarification) {
  questions.questions.push({question:'Single Other',header:'Fixture choice',multiSelect:false,options:[{label:'X',description:'X'},{label:'Z',description:'Z'}]},
    {question:'Multi Other',header:'Fixture choice',multiSelect:true,options:[{label:'Y',description:'Y'},{label:'Z',description:'Z'}]});
}
const requests = [];
const pacingStreams = new Map();
const pacingFrames = [];
function holdStream(res, emit, index) {
  return new Promise(resolve => {
    const closed = () => { pacingStreams.delete(index); resolve(false); };
    res.once('close', closed);
    pacingStreams.set(index, { emit: text => emit('content_block_delta', { type: 'content_block_delta', index: 0,
      delta: { type: 'text_delta', text } }), resume: () => {
      res.off('close', closed); pacingStreams.delete(index); resolve(true);
    } });
  });
}
const dialogCalls = [
  { type: 'tool_use', id: 'question', name: 'ask_user_question', input: questions },
  { type: 'tool_use', id: 'plan', name: 'submit_plan', input: { plan: 'Fixture plan body\nCreate the approved fixture file.' } },
  { type: 'tool_use', id: 'write', name: 'write_file', input: { path: 'approved.txt', content: 'approved B\n' } },
  { type: 'tool_use', id: 'cancel-write', name: 'write_file', input: { path: 'cancelled.txt', content: 'must stay absent\n' } },
];
const server = http.createServer(async (req, res) => {
  try {
    let text = ''; for await (const chunk of req) text += chunk;
    const body = JSON.parse(text); requests.push(body);
    const tool = dialogs ? dialogCalls[requests.length - 1] : undefined;
    const answer = statusLineMode ? `status accepted ${requests.length}` : terminalFocus ? `focus accepted ${requests.length}` : confirmingInput ? `gesture accepted ${requests.length}` : returnEditing ? `return accepted ${requests.length}` : vimEditing ? `vim accepted ${requests.length}` : externalEditing ? `editor accepted ${requests.length}` : editing ? `edit accepted ${requests.length}` : messages ? requests.length === 1 ? messageText : 'Second response stays separate.' : dialogs ? 'dialogs accepted' : requests.length === 1
      ? Array.from({ length: 20 }, (_, i) => `mouse-line-${i}`).join('\n') : 'draft accepted';
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    const emit = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    emit('message_start', { type: 'message_start', message: { id: 'mouse-fixture', type: 'message',
      role: 'assistant', model: body.model, content: [], stop_reason: null, stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 0 } } });
    if (progressSettings) {
      const index=requests.length;
      emit('content_block_start',{type:'content_block_start',index:0,content_block:{type:'thinking',thinking:'',signature:''}});
      emit('content_block_delta',{type:'content_block_delta',index:0,delta:{type:'thinking_delta',thinking:'Owned settings reasoning.'}});
      if (!await holdStream(res,emit,index)) return;
      emit('content_block_delta',{type:'content_block_delta',index:0,delta:{type:'signature_delta',signature:'owned-signature'}});
      emit('content_block_stop',{type:'content_block_stop',index:0});
      emit('content_block_start',{type:'content_block_start',index:1,content_block:{type:'text',text:''}});
      emit('content_block_delta',{type:'content_block_delta',index:1,delta:{type:'text_delta',text:`Settings phase ${index} complete.`}});
      emit('content_block_stop',{type:'content_block_stop',index:1});
      emit('message_delta',{type:'message_delta',delta:{stop_reason:'end_turn',stop_sequence:null},usage:{output_tokens:10}});
      emit('message_stop',{type:'message_stop'});res.end();return;
    }
    if (thinkingProgress) {
      const index=requests.length;
      emit('content_block_start',{type:'content_block_start',index:0,content_block:{type:'thinking',thinking:'',signature:''}});
      emit('content_block_delta',{type:'content_block_delta',index:0,delta:{type:'thinking_delta',thinking:'Owned reasoning fixture.'}});
      if (index!==5 && !await holdStream(res,emit,index)) return;
      if (index===3) {emit('error',{type:'error',error:{type:'api_error',message:'owned thinking failure'}});res.end();return;}
      emit('content_block_delta',{type:'content_block_delta',index:0,delta:{type:'signature_delta',signature:'owned-signature'}});
      emit('content_block_stop',{type:'content_block_stop',index:0});
      const update=index===1;
      emit('content_block_start',{type:'content_block_start',index:1,content_block:update
        ? {type:'tool_use',id:'task-complete',name:'task_update',input:{}} : {type:'text',text:''}});
      emit('content_block_delta',{type:'content_block_delta',index:1,delta:update
        ? {type:'input_json_delta',partial_json:JSON.stringify({id:progressTaskId,status:'completed'})}
        : {type:'text_delta',text:index===5?'Recovered thinking response.':'Thinking fixture complete.'}});
      emit('content_block_stop',{type:'content_block_stop',index:1});
      emit('message_delta',{type:'message_delta',delta:{stop_reason:update?'tool_use':'end_turn',stop_sequence:null},usage:{output_tokens:10}});
      emit('message_stop',{type:'message_stop'});res.end();return;
    }
    emit('content_block_start', { type: 'content_block_start', index: 0,
      content_block: tool ? { ...tool, input: {} } : { type: 'text', text: '' } });
    if (customTheme || pluginTheme || themeEditor) {
      emit('content_block_delta', { type: 'content_block_delta', index: 0,
        delta: { type: 'text_delta', text: `# Custom phase ${requests.length}\n\n` + themeBody } });
      if (!await holdStream(res, emit, requests.length)) return;
    } else if (systemTheme) {
      emit('content_block_delta', { type: 'content_block_delta', index: 0,
        delta: { type: 'text_delta', text: `# System phase ${requests.length}\n\n` + themeBody } });
      if (!await holdStream(res, emit, requests.length)) return;
    } else if (theming) {
      emit('content_block_delta', { type: 'content_block_delta', index: 0,
        delta: { type: 'text_delta', text: `# Theme phase ${requests.length}\n\n` + themeBody } });
      if (!await holdStream(res, emit, requests.length)) return;
    } else if (highlighting) {
      emit('content_block_delta', { type: 'content_block_delta', index: 0,
        delta: { type: 'text_delta', text: `# Highlight phase ${requests.length}\n\n` + highlightBody } });
      if (!await holdStream(res, emit, requests.length)) return;
    } else if (proseWidth) {
      emit('content_block_delta', { type: 'content_block_delta', index: 0,
        delta: { type: 'text_delta', text: `Prose phase ${requests.length}\n\n` + prosePrefix } });
      if (!await holdStream(res, emit, requests.length)) return;
      emit('content_block_delta', { type: 'content_block_delta', index: 0,
        delta: { type: 'text_delta', text: proseSuffix } });
    } else if (visibility) {
      emit('content_block_delta', { type: 'content_block_delta', index: 0,
        delta: { type: 'text_delta', text: `Preview prefix ${requests.length}\nPartial tail ${requests.length}` } });
      if (!await holdStream(res, emit, requests.length)) return;
    } else if (pacing) {
      const index = requests.length;
      const delta = text => emit('content_block_delta', { type: 'content_block_delta', index: 0,
        delta: { type: 'text_delta', text } });
      if (index === 3) delta('Fast response is complete.');
      else {
        delta(index === 1 ? 'Complete prefix\nHidden tail' : index === 2 ? 'Cancel prefix\nCancel tail'
          : index === 4 ? 'Failure prefix\nFailure tail' : 'Close prefix\nClose tail');
        if (!await holdStream(res, emit, index)) return;
        if (index === 4) {
          emit('error', { type: 'error', error: { type: 'api_error', message: 'owned pacing failure' } });
          res.end(); return;
        }
      }
    } else if (messages) {
      for (let offset = 0, chunkSize = streamingChunks ? 333 : 5; offset < answer.length; offset += chunkSize) {
        emit('content_block_delta', { type: 'content_block_delta', index: 0,
          delta: { type: 'text_delta', text: answer.slice(offset, offset + chunkSize) } });
        await delay(2);
      }
    } else emit('content_block_delta', { type: 'content_block_delta', index: 0,
      delta: tool ? { type: 'input_json_delta', partial_json: JSON.stringify(tool.input) } : { type: 'text_delta', text: answer } });
    emit('content_block_stop', { type: 'content_block_stop', index: 0 });
    emit('message_delta', { type: 'message_delta', delta: { stop_reason: tool ? 'tool_use' : 'end_turn', stop_sequence: null }, usage: { output_tokens: 10 } });
    emit('message_stop', { type: 'message_stop' }); res.end();
  } catch (error) { res.writeHead(500); res.end(String(error)); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
const pidFile = path.join(temporary, 'cli.pid');
const editorScript=path.join(temporary,'editor-fixture.mjs');
const editorCalls=path.join(temporary,'editor-calls.json');
if(externalEditing) fs.writeFileSync(editorScript,`import fs from 'node:fs';import {execFileSync,spawn} from 'node:child_process';
const calls=${JSON.stringify(editorCalls)},file=process.argv.at(-1);const previous=fs.existsSync(calls)?JSON.parse(fs.readFileSync(calls,'utf8')):[];
const index=previous.length+1;const descendant=index===4?spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'inherit'}):undefined;previous.push({index,file,pid:process.pid,descendant:descendant?.pid,content:fs.readFileSync(file,'utf8'),mode:fs.statSync(file).mode&511,terminal:execFileSync('stty',['-a'],{stdio:[0,'pipe','pipe'],encoding:'utf8'})});fs.writeFileSync(calls,JSON.stringify(previous));
if(index===2)process.exit(7);else if(index===4)setInterval(()=>{},1000);else fs.writeFileSync(file,fs.readFileSync(file,'utf8')+' editor suffix\\n');\n`,{flag:'wx'});
if(questionEditorCancel) fs.writeFileSync(editorScript,`import fs from 'node:fs';import {execFileSync,spawn} from 'node:child_process';const file=process.argv.at(-1),descendant=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'inherit'});fs.writeFileSync(${JSON.stringify(editorCalls)},JSON.stringify([{file,pid:process.pid,descendant:descendant.pid,mode:fs.statSync(file).mode&511,terminal:execFileSync('stty',['-a'],{stdio:[0,'pipe','pipe'],encoding:'utf8'})}]));setInterval(()=>{},1000);`,{flag:'wx'});
else if(questionEditor) fs.writeFileSync(editorScript,`import fs from 'node:fs';import {execFileSync} from 'node:child_process';
const file=process.argv.at(-1),calls=${JSON.stringify(editorCalls)},previous=fs.existsSync(calls)?JSON.parse(fs.readFileSync(calls,'utf8')):[];
previous.push({file,pid:process.pid,content:fs.readFileSync(file,'utf8'),mode:fs.statSync(file).mode&511,terminal:execFileSync('stty',['-a'],{stdio:[0,'pipe','pipe'],encoding:'utf8'})});fs.writeFileSync(calls,JSON.stringify(previous));fs.writeFileSync(file,fs.readFileSync(file,'utf8')+' edited\\n');`,{flag:'wx'});
const inputCloseModule = path.join(temporary, 'input-close.mjs');
if (inputClose) fs.writeFileSync(inputCloseModule,
  `const emit = process.stdin.emit;
process.stdin.emit = function(event, ...args) {
  if (event === 'data' && String(args[0]).includes('\\x1b[997~')) {
    process.stdin.emit = emit;
    return emit.call(this, 'error', new Error('owned input-close fixture'));
  }
  return emit.call(this, event, ...args);
};\n`, { flag: 'wx' });
const progressSettingsModule=path.join(temporary,'progress-settings.mjs');
// Fix source word selection to the last candidate, so append and empty replacement are deterministic.
if (progressSettings) fs.writeFileSync(progressSettingsModule,'Math.random = () => 1 - Number.EPSILON;\n',{flag:'wx'});
const command = `printf '%s' "$$" > ${quote(pidFile)}; stty rows ${diffPanel ? 28 : previews || messages ? 24 : 10} cols ${diffPanel ? 160 : actions || (previews || messages) && !narrow ? 100 : 40}; exec ${quote(process.execPath)}${inputClose ? ` --import ${quote(inputCloseModule)}` : ''}${progressSettings ? ` --import ${quote(progressSettingsModule)}` : ''} ${quote(cli)}${line ? ' --no-tui' : ''} --workspace ${quote(workspace)} --user-dir ${quote(user)}${dialogs ? ' --permission-mode ask' : ''}`;
// A shell pipe gives macOS script a pipe rather than Node's stdin socket.
const child = spawn('/bin/sh', ['-c', `cat | script -q /dev/null /bin/sh -c ${quote(command)}`], {
  cwd: root, detached: true,
  env: { ...process.env, TERM: 'xterm-256color',
    ...(externalEditing||questionEditor?{VISUAL:process.execPath+' '+editorScript,EDITOR:'unused-owned-editor'}:{}), ...(theming || customTheme || pluginTheme || themeEditor || thinkingProgress || progressSettings || statusLineMode ? { FORCE_COLOR: '3', COLORFGBG: '0;15', TMUX: '', STY: '' } : {}),
    ...(systemTheme ? { FORCE_COLOR: '3', COLORFGBG: '0;0', TMUX: systemThemeMux ? 'owned-mux-fixture' : '', STY: '' } : {}),
    WT_SESSION: windowsTerminal ? 'owned-terminal-fixture' : '',
    LLM_INHERIT_GATEWAY: 'false', LLM_API_KEY: 'owned-mouse-fixture',
    LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_MODEL: 'fixture/mouse',
    LLM_AUTH: 'bearer', LLM_THINKING: thinkingProgress || progressSettings ? 'true' : 'false', LLM_TOKEN_COUNTING: 'estimate',
    LLM_PROMPT_CACHE: 'false', LLM_EAGER_TOOL_INPUT: 'false' },
});
let output = '', errors = '';
const screen = new TerminalScreen(diffPanel ? 160 : actions || (previews || messages) && !narrow ? 100 : 40,
  diffPanel ? 28 : previews || messages ? 24 : 10);
const frame = () => screen.lines().join('\n');
// PTY reads can split one UTF-8 character across chunks.
child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
child.stdout.on('data', bytes => { output += bytes; screen.write(bytes); });
child.stderr.on('data', bytes => errors += bytes);
const exited = new Promise((resolve, reject) => {
  child.once('error', reject); child.once('close', code => resolve(code));
});
function killFixture() {
  if (fs.existsSync(pidFile)) {
    const pid = Number(fs.readFileSync(pidFile, 'utf8'));
    if (Number.isSafeInteger(pid) && pid > 0) {
      try { process.kill(pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
    }
  }
  try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
}
const timer = setTimeout(killFixture, 20000);
async function until(predicate) {
  const deadline = Date.now() + 10000;
  while (!predicate()) {
    if (child.exitCode !== null) throw new Error(`CLI exited early: ${errors}`);
    if (Date.now() >= deadline) throw new Error(`CLI condition timed out: ${errors}\nScreen: ${JSON.stringify(frame())}\nOutput tail: ${JSON.stringify(output.slice(-2400))}`);
    await delay(10);
  }
}
const topLine = () => screen.lines()[0].trim();
try {
  await until(() => line ? output.includes('/help for commands.') : output.includes('\x1b[?1049h') && (statusLineMode?frame().includes('FOOT A'):output.includes('ctrl+o')));
  if (diffPanel) {
    fs.writeFileSync(path.join(workspace, 'sample.txt'), Array.from({ length: 70 }, (_, i) => `after ${i}`).join('\n') + '\n');
    child.stdin.write('/diff\r');
    await until(() => frame().includes('Diff panel shown'));
    child.stdin.write('retained draft\u0018b');
    await until(() => frame().includes('uncommitted (vs HEAD)') && frame().includes('sample.txt'));
    assert.ok(frame().includes('retained draft'));
    const before = frame(); child.stdin.write('\x1b[<65;120;18M');
    await until(() => frame() !== before);
    assert.ok(frame().includes('retained draft'));
    const selectionRow = screen.lines().findIndex(row => row.includes('before '));
    assert.ok(selectionRow > 0, frame());
    const selectionColumn = screen.lines()[selectionRow].indexOf('before ');
    child.stdin.write(`\x1b[<0;${selectionColumn + 1};${selectionRow + 1}M\x1b[<32;${selectionColumn + 5};${selectionRow + 1}M\x1b[<0;${selectionColumn + 5};${selectionRow + 1}m`);
    await until(() => frame().includes('1 line from diff'));
    assert.ok(frame().includes('retained draft'));
    child.stdin.write('\x1b[99;6u');
    await until(() => output.includes('\x1b]52;c;' + Buffer.from('befor').toString('base64')));
    const closeRow = screen.lines().findIndex(row => row.includes('✕'));
    const closeColumn = screen.lines()[closeRow].indexOf('✕');
    assert.ok(closeRow >= 0 && closeColumn > 80);
    child.stdin.write(`\x1b[<0;${closeColumn + 1};${closeRow + 1}M\x1b[<0;${closeColumn + 1};${closeRow + 1}m`);
    await until(() => !frame().includes('✕') && frame().includes('retained draft'));
    assert.equal(requests.length, 0);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(user, 'settings.json'), 'utf8')),
      { diffSidebarOpen: false, diffSidebarBaseMode: 'uncommitted' });
    child.stdin.write('\r');
    await until(() => requests.length === 1 && frame().includes('ready'));
    const users = requests[0].messages.filter(message => message.role === 'user');
    assert.equal(users.at(-2).content, 'retained draft');
    assert.equal(users.at(-1).content, '<system-reminder>\nThe user selected the following 1 line from the diff view (in sample.txt):\nbefor\n\nThis may or may not be related to the current task.\n</system-reminder>');
    child.stdin.write('/exit\r'); child.stdin.end();
    assert.equal(await exited, 0, errors);
  } else if(statusLineMode){
    const sessions=()=>fs.readdirSync(path.join(workspace,'.agent')).filter(name=>name.endsWith('.jsonl')).map(name=>{
      const text=fs.readFileSync(path.join(workspace,'.agent',name),'utf8'),cut=text.lastIndexOf('\n');
      const rows=cut<0?[]:text.slice(0,cut).split('\n').filter(Boolean).map(JSON.parse);return{id:name.slice(0,-6),rows};
    }).filter(row=>row.rows[0]?.kind==='metadata');
    const calls=()=>fs.existsSync(statusLineCalls)?fs.readFileSync(statusLineCalls,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
    const send=async text=>{child.stdin.write(text);if(text==='\x1b')await delay(80);};
    const active=()=>sessions().find(row=>fs.existsSync(path.join(workspace,'.agent',row.id+'.jsonl.lock')));
    const draft=text=>screen.lines().some(row=>row.includes('❯ '+text));
    await until(()=>active()&&frame().includes('FOOT A INSERT'));const original=active().id;
    const colors=()=>{for(const term of ['FOOT','DETAIL']){const y=screen.lines().findIndex(row=>row.includes(term));assert.ok(y>=0);assert.equal(screen.cell(2,y).getFgColor(),1);}};colors();
    assert.equal(frame().includes('-- INSERT --'),false);const count=calls().length;await until(()=>calls().length>count);
    await send('é👩‍💻 draft');await send('\x1b');await until(()=>frame().includes('FOOT A NORMAL'));colors();
    const row=screen.lines().findIndex(row=>row.includes('❯ é👩‍💻 draft'));assert.equal(screen.cursor.row,row);
    await send('\r');await until(()=>requests.length===1&&frame().includes('status accepted 1')&&frame().includes('ready')&&frame().includes('DETAIL 1'));
    assert.equal(requests[0].messages.filter(row=>row.role==='user').at(-1).content,'é👩‍💻 draft');
    await until(()=>calls().some(row=>row.payload.context_window.total_output_tokens===10));
    const latest=calls().findLast(row=>row.payload.context_window.total_output_tokens===10);assert.equal(latest.payload.session_id,original);assert.equal(latest.payload.context_window.context_window_size,1000000);
    await send('/vim\r');await until(()=>topLine()==='Editor mode');const modalCalls=calls().length;await delay(1400);assert.equal(calls().length,modalCalls);
    await send('\u0003');await until(()=>frame().includes('FOOT A INSERT'));assert.ok(fs.existsSync(path.join(workspace,'.agent',original+'.jsonl.lock')));
    fs.writeFileSync(path.join(user,'settings.json'),JSON.stringify(statusLineConfig('B')));await send('/reload\r');
    await until(()=>active()?.id!==original&&frame().includes('FOOT B'));assert.equal(active().rows[0].config.statusLine.command.endsWith(' B'),true);
    await send(`/resume ${original}\r`);await until(()=>active()?.id===original&&frame().includes('FOOT A'));
    fs.writeFileSync(path.join(user,'settings.json'),'{}');await send('/reload\r');await until(()=>active()?.id!==original&&!active().rows[0].config.statusLine&&frame().includes('ctrl+o'));
    const removed=calls().length;await delay(1400);assert.equal(calls().length,removed);assert.equal(frame().includes('FOOT'),false);
    fs.writeFileSync(path.join(user,'settings.json'),JSON.stringify(statusLineConfig('slow')));await send('/reload\r');await until(()=>calls().some(row=>row.mode==='slow'));
    const pids=calls().filter(row=>row.mode==='slow').map(row=>row.pid);process.kill(Number(fs.readFileSync(pidFile,'utf8')),'SIGTERM');child.stdin.end();assert.equal(await exited,130,errors);
    for(const pid of pids)assert.throws(()=>process.kill(pid,0));assert.equal(requests.length,1);assert.equal(frame().includes('STALE'),false);
  }else if(terminalFocus){
    const draft=text=>screen.lines().some(row=>row.includes((line?'> ':'❯ ')+text));
    const inverse=text=>{const row=screen.lines().findIndex(row=>row.includes((line?'> ':'❯ ')+text));
      return row<0?-1:Array.from({length:40},(_,column)=>screen.cell(column,row)?.isInverse()?1:0).reduce((a,b)=>a+b,0);};
    const send=async bytes=>{child.stdin.write(bytes);if(bytes==='\x1b')await delay(80);};
    const expected=[];
    const submit=async text=>{const index=expected.length+1;expected.push(text);await send('\r');
      await until(()=>requests.length===index&&frame().includes(`focus accepted ${index}`)&&(line?
        (output.match(/finished: end_turn/g)??[]).length===index:frame().includes('ready')));
      assert.equal(requests[index-1].messages.filter(row=>row.role==='user').at(-1).content,text);};
    await until(()=>output.includes('\x1b[?1004h'));
    const raw='é👩‍💻abc';await send(raw);await send('\x1b');await send('0vl');await until(()=>inverse(raw)===3);
    await send('\x1b[');await delay(10);await send('O');await until(()=>inverse(raw)===0);assert.equal(requests.length,0);
    await send('\x1b[<64;2;2M\x1b]11;#000\x07');await delay(40);assert.equal(inverse(raw),0);
    await send('\x1b[I');await until(()=>inverse(raw)===3);await send('\x1b[Ol');await until(()=>inverse(raw)===4);
    await send('xu');await until(()=>draft(raw));await submit(raw);
    const folded='one\ntwo\nthree\nfour';await send('\x1b[O\x1b[200~'+folded+'\x1b[201~');await until(()=>draft('[Pasted text #1 +3 lines]'));
    await send('\x1b');await send('0');await until(()=>inverse('[Pasted text #1 +3 lines]')===1);
    await send('\x1b[O');await until(()=>inverse('[Pasted text #1 +3 lines]')===0);await send('\x1b[I');
    await until(()=>inverse('[Pasted text #1 +3 lines]')===1);await submit(folded);
    await send('/vim\r');await until(()=>line?output.includes('Choose input editing'):topLine()==='Editor mode');
    await send('\x1b[O\x1b[I\u0003');await until(()=>line?output.includes('error: Interaction cancelled'):topLine()!=='Editor mode'&&frame().includes('ready'));
    await send('draftj\x1b[O\x1b[Ij');await until(()=>draft('draft'));await send('A\x1b[O\x1b[200~é👩‍💻\x1b[201~');
    await until(()=>draft('drafté👩‍💻'));await submit('drafté👩‍💻');
    await send('\x1b[O');process.kill(Number(fs.readFileSync(pidFile,'utf8')),'SIGTERM');child.stdin.end();assert.equal(await exited,130,errors);
    assert.deepEqual(requests.map(row=>row.messages.filter(message=>message.role==='user').at(-1).content),expected);
    assert.ok(output.includes('\x1b[?1004l'));
  }else if(vimEditing){
    const sessions=()=>fs.readdirSync(path.join(workspace,'.agent')).filter(name=>name.endsWith('.jsonl')).map(name=>{
      const text=fs.readFileSync(path.join(workspace,'.agent',name),'utf8'),cut=text.lastIndexOf('\n');
      const rows=cut<0?[]:text.slice(0,cut).split('\n').filter(Boolean).map(JSON.parse);
      return {id:name.slice(0,-6),rows};
    }).filter(row=>row.rows[0]?.kind==='metadata');
    await until(()=>sessions().length===1);let current=sessions()[0].id;const original=current;
    const active=()=>sessions().find(row=>row.id===current);
    const records=()=>active()?.rows??[];
    const draft=text=>screen.lines().some(row=>row.includes((line?'> ':'❯ ')+text));
    const send=async bytes=>{child.stdin.write(bytes);if(bytes==='\x1b')await delay(80);};
    const completed=()=>records().filter(row=>row.kind==='turn_end').length;
    const submitCurrent=async text=>{const count=completed(),index=vimExpected.length+1;vimExpected.push(text);await send('\r');
      await until(()=>requests.length===index&&completed()>count&&frame().includes(`vim accepted ${index}`));
      assert.equal(requests[index-1].messages.filter(row=>row.role==='user').at(-1).content,text);
    };
    await send('alpha beta gamma');await send('\x1b');await send('0dw.iX');await send('\x1b');await send('vl');
    await until(()=>screen.lines().some((row,y)=>row.includes('Xgamma')&&Array.from({length:40},(_,x)=>screen.cell(x,y)).filter(cell=>cell?.isInverse()).length>=2));
    await send('x');await until(()=>draft('amma'));await submitCurrent('amma');
    await send('one two three four');await send('\x1b');await send('02dw');await until(()=>draft('three four'));await submitCurrent('three four');
    await send('draftj');await send('j');await send('0xiQjk.');await until(()=>draft('QQraft'));await submitCurrent('QQraft');
    await send('é👩‍💻');await send('\x1b');await send('0x');await send('u');await until(()=>draft('é👩‍💻'));await submitCurrent('é👩‍💻');
    const raw='one\ntwo\nthree\nfour';await send('\x1b[200~'+raw+'\x1b[201~');await send('\x1b');await send('0ddp');await until(()=>frame().includes('one')&&frame().includes('two'));await submitCurrent(raw);
    const reload=async settings=>{fs.writeFileSync(path.join(user,'settings.json'),JSON.stringify(settings));const previous=current,wantedMode=['normal','vim'].includes(settings.editorMode)?settings.editorMode:undefined,
      wantedRemaps=settings.vimInsertModeRemaps&&typeof settings.vimInsertModeRemaps==='object'?settings.vimInsertModeRemaps:undefined;
      const matches=row=>row.id!==previous&&fs.existsSync(path.join(workspace,'.agent',row.id+'.jsonl.lock'))&&row.rows[0].config.editorMode===wantedMode
        &&JSON.stringify(row.rows[0].config.vimInsertModeRemaps)===JSON.stringify(wantedRemaps);
      await send('/reload\r');await until(()=>sessions().some(matches));current=sessions().findLast(matches).id;
      await until(()=>line?output.includes('Local configuration reloaded'):frame().includes('Local'));};
    await reload({});await send('literaljj');await until(()=>draft('literaljj'));await submitCurrent('literaljj');
    await send(`/resume ${original}\r`);await until(()=>fs.existsSync(path.join(workspace,'.agent',original+'.jsonl.lock')));current=original;
    await send('restorejj');await send('0x');await until(()=>draft('estore'));await submitCurrent('estore');
    await send('/config editor=normal\r');await until(()=>sessions().some(row=>row.id!==current&&fs.existsSync(path.join(workspace,'.agent',row.id+'.jsonl.lock'))&&row.rows[0].config.editorMode==='normal'));
    current=sessions().find(row=>row.id!==current&&fs.existsSync(path.join(workspace,'.agent',row.id+'.jsonl.lock'))&&row.rows[0].config.editorMode==='normal').id;
    assert.equal(JSON.parse(fs.readFileSync(path.join(user,'settings.json'),'utf8')).editorMode,'normal');
    let chooserCount=(output.match(/Choose input editing/g)??[]).length;
    await send('/vim\r');await until(()=>line?(output.match(/Choose input editing/g)??[]).length>chooserCount:topLine()==='Editor mode');
    await send('\u0003');await until(()=>line?output.includes('error: Interaction cancelled'):topLine()!=='Editor mode'&&frame().includes('ready'));
    assert.ok(fs.existsSync(path.join(workspace,'.agent',current+'.jsonl.lock')));
    assert.equal(JSON.parse(fs.readFileSync(path.join(user,'settings.json'),'utf8')).editorMode,'normal');
    chooserCount=(output.match(/Choose input editing/g)??[]).length;
    await send('/vim\r');await until(()=>line?(output.match(/Choose input editing/g)??[]).length>chooserCount:topLine()==='Editor mode');
    if(line)await send('2\r');else await send('\x1b[B\r');
    await until(()=>sessions().some(row=>row.id!==current&&fs.existsSync(path.join(workspace,'.agent',row.id+'.jsonl.lock'))&&row.rows[0].config.editorMode==='vim'));
    current=sessions().find(row=>row.id!==current&&fs.existsSync(path.join(workspace,'.agent',row.id+'.jsonl.lock'))&&row.rows[0].config.editorMode==='vim').id;
    await until(()=>line?output.includes('Editor mode: vim'):frame().includes('-- INSERT --'));
    assert.equal(JSON.parse(fs.readFileSync(path.join(user,'settings.json'),'utf8')).editorMode,'vim');
    await send('savedjk');await send('0x');await until(()=>draft('aved'));await submitCurrent('aved');
    await reload({editorMode:'invalid',vimInsertModeRemaps:42});await send('invalidjj');await until(()=>draft('invalidjj'));await submitCurrent('invalidjj');
    await send('pending close');process.kill(Number(fs.readFileSync(pidFile,'utf8')),'SIGTERM');child.stdin.end();assert.equal(await exited,130,errors);
    assert.deepEqual(requests.map(request=>request.messages.filter(row=>row.role==='user').at(-1).content),vimExpected);
    for(const session of sessions()){
      assert.equal(JSON.stringify(session.rows).includes('owned-mouse-fixture'),false);
      assert.equal(session.rows.some(row=>row.kind==='turn_start')&&!session.rows.some(row=>row.kind==='turn_end'),false);
    }
  }else if(confirmingInput){
    const draft=text=>screen.lines().some(row=>row.includes((line?'> ':'❯ ')+text));
    const send=async text=>{child.stdin.write(text);if(text==='\x1b')await delay(80);};
    const submit=async(index,text)=>{await send('\r');await until(()=>requests.length===index&&frame().includes(`gesture accepted ${index}`)
      &&(line?(output.match(/finished: end_turn/g)??[]).length===index:frame().includes('ready')));
      assert.equal(requests[index-1].messages.filter(row=>row.role==='user').at(-1).content,text);};
    await send('clear draft\u0003');await until(()=>frame().includes('Press Ctrl-C again to exit'));assert.equal(requests.length,0);
    await until(()=>!frame().includes('Press Ctrl-C again to exit'));await send('after expiry');await until(()=>draft('after expiry'));await submit(1,'after expiry');
    await send('abc\u0001\u0004');await until(()=>draft('bc'));await submit(2,'bc');
    const raw='one\ntwo\nthree\nfour';await send('\x1b[200~'+raw+'\x1b[201~');await until(()=>draft('[Pasted text #1 +3 lines]'));
    await send('\x1b');await until(()=>frame().includes('Esc again to clear'));await send('\x1b');await until(()=>!draft('[Pasted text #1'));
    await send('\x1b[A');await until(()=>draft('[Pasted text #1 +3 lines]'));await submit(3,raw);
    await send('/config editor=vim\r');await until(()=>fs.existsSync(path.join(user,'settings.json'))&&JSON.parse(fs.readFileSync(path.join(user,'settings.json'),'utf8')).editorMode==='vim'
      &&(line?output.includes('Editor mode: vim'):frame().includes('-- INSERT --')));
    await send('retained');await send('\x1b');await send('\x1b');assert.equal(requests.length,3);await until(()=>draft('retained'));await submit(4,'retained');
    await send('\u0004');await until(()=>frame().includes('Press Ctrl-D again to exit'));assert.equal(child.exitCode,null);await send('\u0004');child.stdin.end();assert.equal(await exited,0,errors);
    assert.deepEqual(requests.map(row=>row.messages.filter(message=>message.role==='user').at(-1).content),['after expiry','bc',raw,'retained']);
  }else if(returnEditing){
    const draft=text=>screen.lines().some(row=>row.includes((line?'> ':'❯ ')+text));
    const send=async text=>{child.stdin.write(text);if(text==='\x1b')await delay(80);};
    const submit=async text=>{const index=returnExpected.length+1;returnExpected.push(text);await send('\r');
      await until(()=>requests.length===index&&frame().includes(`return accepted ${index}`)&&(line?
        (output.match(/finished: end_turn/g)??[]).length===index:frame().includes('ready')));
      assert.equal(requests[index-1].messages.filter(row=>row.role==='user').at(-1).content,text);
    };
    await send('one\\\r');await until(()=>draft('one'));assert.equal(requests.length,0);
    await send('\u001f');await until(()=>draft('one\\'));await send('\rtwo');await until(()=>frame().includes('two'));await submit('one\ntwo');
    await send('ab\\cd\x1b[D\x1b[D\r');await until(()=>draft('ab')&&frame().includes('cd'));await submit('ab\ncd');
    await send('é👩‍💻\\\x1b[13;2u中');await until(()=>draft('é👩‍💻')&&frame().includes('中'));await submit('é👩‍💻\n中');
    await send('alt\\\x1b\rline');await until(()=>draft('alt')&&frame().includes('line'));await submit('alt\nline');
    const raw='one\ntwo\nthree\nfour';await send('\x1b[200~'+raw+'\x1b[201~\\\rtail');await until(()=>frame().includes('tail'));
    await submit(raw+'\ntail');
    await send('/config editor=vim\r');await until(()=>fs.existsSync(path.join(user,'settings.json'))&&JSON.parse(fs.readFileSync(path.join(user,'settings.json'),'utf8')).editorMode==='vim'
      &&(line?output.includes('Editor mode: vim'):frame().includes('-- INSERT --')));
    await send('one');await send('\x1b');await send('A\\\ré👩‍💻');await send('\x1b');await send('.');await until(()=>frame().includes('é👩‍💻'));await submit('one\né👩‍💻\né👩‍💻');
    if(!line){
      await send('search draft\u0012');await until(()=>!frame().includes('-- INSERT --'));
      await submit('search draft');await until(()=>frame().includes('-- INSERT --'));
    }
    await send('pending\\\r');await until(()=>draft('pending'));assert.equal(requests.length,line?6:7);
    process.kill(Number(fs.readFileSync(pidFile,'utf8')),'SIGTERM');child.stdin.end();assert.equal(await exited,130,errors);
    assert.deepEqual(requests.map(row=>row.messages.filter(message=>message.role==='user').at(-1).content),returnExpected);
  } else if (line && !editing && !externalEditing) {
    assert.ok(previews, '--line exercises the preview question fixture');
    child.stdin.write('first task\r');
    await until(() => output.includes('One number, or Other text:'));
    assert.ok(output.replace(/\r+\n/g, '\n').includes('Preview:\n# Preview A'), JSON.stringify(output));
    assert.ok(output.includes('Preview B') && output.includes('preview-row-23'));
    child.stdin.write('2\r');
    await until(() => output.includes('Approve this plan? [y/N]'));
    child.stdin.write('y\r');
    await until(() => output.includes('approved.txt') && output.includes('Allow once? [y/N]'));
    child.stdin.write('y\r');
    await until(() => output.includes('cancelled.txt') && requests.length === 4);
    child.stdin.write('n\r');
    await until(() => (line ? output : frame()).includes('dialogs accepted'));
    child.stdin.write('/exit\r'); child.stdin.end();
    assert.equal(await exited, 0, errors);
    assert.equal(requests.length, 5);
    const results = requests.at(-1).messages.flatMap(message => Array.isArray(message.content) ? message.content : [])
      .filter(block => block.type === 'tool_result');
    assert.deepEqual(JSON.parse(results.find(result => result.tool_use_id === 'question').content),
      { answers: [{ questionIndex: 0, selected: ['B'] }] });
    assert.deepEqual(JSON.parse(results.find(result => result.tool_use_id === 'plan').content), { approved: true });
    assert.equal(fs.readFileSync(path.join(workspace, 'approved.txt'), 'utf8'), 'approved B\n');
    assert.equal(fs.existsSync(path.join(workspace, 'cancelled.txt')), false);
    assert.ok(results.find(result => result.tool_use_id === 'cancel-write').is_error);
  } else if (externalEditing) {
    const calls=()=>fs.existsSync(editorCalls)?JSON.parse(fs.readFileSync(editorCalls,'utf8')):[];
    const draft=text=>screen.lines().some(row=>row.includes((line?'> ':'❯ ')+text));
    const ready=()=>line?output.includes('External editor returned'):frame().includes('ready  External');
    const submit=async(text,index)=>{child.stdin.write('\r');await until(()=>requests.length===index&&(line?
      output.includes(`editor accepted ${index}`)&&(output.match(/finished: end_turn/g)?.length??0)>=index:
      frame().includes(`editor accepted ${index}`)&&frame().includes('ready  finished:')));
      assert.equal(requests[index-1].messages.filter(message=>message.role==='user').at(-1).content,text);};
    const raw='one\ntwo\nthree\nfour';child.stdin.write('\x1b[200~'+raw+'\x1b[201~');
    await until(()=>draft('[Pasted text #1 +3 lines]'));
    child.stdin.write('\u0007\r');await until(()=>calls().length===1&&draft('[Pasted text #1 +3 lines] editor')&&frame().includes('suffix')&&ready());
    assert.equal(calls()[0].content,raw);assert.equal(requests.length,0);
    child.stdin.write('\u001f');await until(()=>draft('[Pasted text #1 +3 lines]')&&!draft('[Pasted text #1 +3 lines] editor'));
    await submit(raw,1);
    child.stdin.write('failure draft\u0007');await until(()=>calls().length===2&&(line?output.includes('exit code 7'):frame().includes('ready  External')));
    await until(()=>draft('failure draft'));await submit('failure draft',2);
    child.stdin.write('third draft'+(line?'\u0007':'\u0018\u0005'));
    await until(()=>calls().length===3&&draft('third draft editor suffix'));await submit('third draft editor suffix',3);
    child.stdin.write('pending editor\u0007');await until(()=>calls().length===4);
    const active=calls().at(-1);assert.ok(fs.existsSync(active.file));
    process.kill(Number(fs.readFileSync(pidFile,'utf8')),'SIGTERM');child.stdin.end();assert.equal(await exited,130,errors);
    for(const call of calls()) {assert.equal(call.mode,0o600);assert.ok(/(?:^|[\s;])icanon(?:[\s;]|$)/.test(call.terminal),call.terminal);
      assert.equal(fs.existsSync(call.file),false);assert.throws(()=>process.kill(call.pid,0),{code:'ESRCH'});
      if(call.descendant)assert.throws(()=>process.kill(call.descendant,0),{code:'ESRCH'});}
    assert.equal(requests.length,3);
  } else if (editing) {
    const raw = 'abcdefghijklmnopqrstuvwx0123456789ABCDEFGHIJ';
    const expected = 'Z' + raw.slice(0, 7) + 'X' + raw.slice(7, 36) + 'Y' + raw.slice(36);
    const userText = request => {
      const content = request.messages.filter(item => item.role === 'user').at(-1).content;
      return typeof content === 'string' ? content : content.filter(block => block.type === 'text').map(block => block.text).join('');
    };
    const submit = async (bytes, text, index) => {
      child.stdin.write(bytes);
      await until(() => requests.length === index && (line ? output.includes(`edit accepted ${index}`)
        && (output.match(/finished: end_turn/g)?.length ?? 0) >= index
        : frame().includes(`edit accepted ${index}`) && frame().includes('ready  finished:')));
      assert.equal(userText(requests[index - 1]), text);
    };
    if (folding) {
      const raw='one\ntwo\nthree\nfour',paste='\x1b[200~'+raw+'\x1b[201~';
      const draft=text=>screen.lines().some(row=>row.includes((line?'> ':'❯ ')+text));
      child.stdin.write(paste);await until(()=>draft('[Pasted text #1 +3 lines]'));
      await delay(1100);child.stdin.write(' suffix\u001f');await until(()=>draft('[Pasted text #1 +3 lines]')&&!draft('[Pasted text #1 +3 lines] suffix'));
      await submit('\r',raw,1);await submit('\x1b[A\r',raw,2);
      child.stdin.write(paste);await until(()=>draft('[Pasted text #2 +3 lines]'));
      child.stdin.write(paste);await until(()=>screen.lines().some(row=>row.trim()==='four')&&!draft('[Pasted text #2'));
      await submit('\r',raw,3);
      const unicode='é👩‍💻\tA\rB\r\nC';
      child.stdin.write('\x1b[200~'+unicode+'\x1b[201~');await until(()=>draft('[Pasted text #3 +2 lines]'));
      await submit('\r','é👩‍💻    A\nB\nC',4);
      child.stdin.write('[Pasted text #7]'+paste);await until(()=>draft('[Pasted text #7][Pasted text #8'));
      if (!line) {child.stdin.write('\u0013scratch\u0013');await until(()=>draft('[Pasted text #7][Pasted text #8'));}
      await submit('\r','[Pasted text #7]'+raw,5);
      child.stdin.write('\u0012two');await until(()=>draft('[Pasted text #7][Pasted text #8'));
      await submit('\r','[Pasted text #7]'+raw,6);
      child.stdin.write(paste);await until(()=>draft('[Pasted text #10 +3 lines]'));
      child.stdin.write('\u007f');await until(()=>screen.cursor.column===2);
      await submit('[Pasted text #10 +3 lines]\r','[Pasted text #10 +3 lines]',7);
      child.stdin.write(paste+'\u0015scratch\u0003\u0019');await until(()=>screen.lines().some(row=>row.trim()==='four'));
      await submit('\r',raw,8);
      child.stdin.write(paste);await until(()=>draft('[Pasted text #12 +3 lines]'));
      process.kill(Number(fs.readFileSync(pidFile,'utf8')),'SIGTERM');child.stdin.end();assert.equal(await exited,130,errors);
    } else if (undoing) {
      const promptPrefix = line ? '> ' : '❯ ';
      const draft = text => screen.lines().some(row => row === promptPrefix + text);
      const settled = async text => {
        await until(() => draft(text));
        // The source buffer takes a pre-change snapshot after its1000ms quiet period.
        await delay(1100);
      };
      child.stdin.write('undo base'); await settled('undo base');
      child.stdin.write(' suffix'); await until(() => draft('undo base suffix'));
      child.stdin.write('\u001f'); await until(() => draft('undo base'));
      await submit('\r', 'undo base', 1);
      child.stdin.write('\u001f');
      await until(() => screen.cursor.column === 2);
      child.stdin.write('é\u{1f469}‍\u{1f4bb}中');
      await settled('é\u{1f469}‍\u{1f4bb}中');
      child.stdin.write('\x1b[D!'); await until(() => screen.cursor.column === 6);
      child.stdin.write('\u001f'); await until(() => screen.cursor.column === 5);
      await submit('?\r', 'é\u{1f469}‍\u{1f4bb}?中', 2);
      child.stdin.write('first'); await settled('first');
      child.stdin.write(' second'); await settled('first second');
      child.stdin.write(' third\u001f'); await until(() => draft('first second'));
      child.stdin.write('\u001f'); await until(() => draft('first'));
      await delay(1100);
      child.stdin.write(' branch'); await until(() => draft('first branch'));
      child.stdin.write('\u001f'); await until(() => draft('first'));
      await submit('\r', 'first', 3);
      child.stdin.write('\x1b[200~line one\nline two\x1b[201~');
      await until(()=>draft('[Pasted text #1 +1 lines]'));
      child.stdin.write('\x1b[200~line one\nline two\x1b[201~');
      await settled('line one');
      child.stdin.write('\u0015'); await until(() => draft('line one'));
      child.stdin.write('\u001f');
      await submit('\r', 'line one\nline two', 4);
      child.stdin.write('pending base'); await settled('pending base');
      child.stdin.write(' next'); await until(() => draft('pending base next'));
      child.stdin.write(' tail\u001f'); await until(() => draft('pending base'));
      await submit('\r', 'pending base', 5);
      child.stdin.write('close draft'); await settled('close draft');
      child.stdin.write(' pending'); await until(() => draft('close draft pending'));
      child.stdin.write(' timer'); await until(() => draft('close draft pending timer'));
      process.kill(Number(fs.readFileSync(pidFile, 'utf8')), 'SIGTERM'); child.stdin.end();
      assert.equal(await exited, 130, errors);
    } else if (killing) {
      await submit('alpha beta gamma\u0017\u0017\u0019\r', 'alpha beta gamma', 1);
      await submit('one two-three\x1b\u007f\x1b[D\x1b\u007f\u0019\x1by\x1by\r', 'one beta gamma-', 2);
      await submit('\x1b[200~ab\ncd\x1b[201~\u0001\u000b\u0015\u0019\r', 'ab\ncd', 3);
      await submit('é\u{1f469}‍\u{1f4bb}中\u0015\u0019\x1b[D!\r', 'é\u{1f469}‍\u{1f4bb}!中', 4);
      await submit('[Pasted text #1 +3 lines] tail\u0017\u0017\u0019\x1by\x1b[D!\x1by\r',
        'é\u{1f469}‍\u{1f4bb}!中', 5);
    } else {
    child.stdin.write(raw);
    await until(() => screen.lines().some(row => row.includes((line ? '> ' : '❯ ') + raw.slice(0, 37)))
      && screen.lines().includes('  ' + raw.slice(37)) && screen.cursor.column === 9);
    const bottom = screen.cursor.row;
    child.stdin.write('\x1b[A');
    await until(() => screen.cursor.row === bottom - 1 && screen.cursor.column === 9);
    child.stdin.write('X\x1b[B');
    await until(() => screen.cursor.row === bottom && screen.cursor.column === 10);
    child.stdin.write('\x1b[H');
    await until(() => screen.cursor.row === bottom && screen.cursor.column === 2);
    await submit('Y\u0001Z\u0005\r', expected, 1);
    child.stdin.write('\x1b[A');
    await until(() => frame().includes((line ? '> ' : '❯ ') + expected.slice(0, 37)));
    child.stdin.write('\u0005\x1b[B');
    await until(() => screen.cursor.column === 2 && (line ? screen.lines().some(row => row.trim() === '>')
      : screen.lines().at(-3).trim() === '❯'));
    const unicode = 'é\u{1f469}‍\u{1f4bb}中';
    await submit(unicode + '\x1b[D!\r', unicode.slice(0, -1) + '!中', 2);
    await submit('one two-three\x1b[1;5D\x1bb\x1bfX\r', 'one twoX-three', 3);
    await submit('[Pasted text #1 +3 lines]\x1b[DZ\r', 'Z[Pasted text #1 +3 lines]', 4);
    child.stdin.write('\x1b[200~first\nsecond\x1b[201~');
    await until(()=>frame().includes('[Pasted text #1 +1 lines]'));
    await submit('\x1b[200~first\nsecond\x1b[201~\x1b[D!\r', 'first\nsecon!d', 5);
    }
    if (!undoing && !folding) {
      child.stdin.write('/exit\r'); child.stdin.end();
      assert.equal(await exited, 0, errors);
    }
  } else if (progressSettings) {
    const {progressTime}=await import('../dist/tui-progress-settings.js');
    const sessions=()=>fs.readdirSync(path.join(workspace,'.agent')).filter(file=>file.endsWith('.jsonl')).flatMap(file=> {
      const bytes=fs.readFileSync(path.join(workspace,'.agent',file)),boundary=bytes.lastIndexOf(10)+1;
      if (!boundary) return [];
      const rows=bytes.subarray(0,boundary).toString('utf8').trimEnd().split('\n').map(JSON.parse);
      return rows[0]?.kind==='metadata' ? [{id:rows[0].id,rows}] : [];
    });
    let currentSession;
    const records=()=>sessions().find(session=>session.id===currentSession)?.rows ?? [];
    const compact=()=>screen.lines().map(row=>row.trim()).join(' ');
    await until(()=>sessions().length===1);currentSession=sessions()[0].id;
    const originalSession=currentSession;
    const phase=async (index,word,settings)=> {
      child.stdin.write(`settings task ${index}\r`);
      await until(()=>pacingStreams.has(index)&&frame().includes(word+'…'));
      if (index===1) {child.stdin.write('retained settings draft');await until(()=>frame().includes('retained settings draft'));}
      pacingStreams.get(index).resume();
      await until(()=>frame().includes(`Settings phase ${index} complete.`)&&frame().includes('ready  finished:'));
      const end=records().findLast(row=>row.kind==='turn_end');assert.ok(end?.duration);
      const expected=progressTime(settings).format(end.duration.timestamp);
      await until(()=>compact().includes('done '+expected));
      assert.ok(end.duration.durationMs>=0);
    };
    const reload=async settings=> {
      fs.writeFileSync(path.join(user,'settings.json'),JSON.stringify(settings));
      const previous=currentSession;child.stdin.write('\x15/reload\r');
      await until(()=>frame().includes('ready  Local')&&sessions().some(session=>session.id!==previous
        && JSON.stringify(session.rows[0].config.spinnerVerbs)===JSON.stringify(settings.spinnerVerbs)
        && session.rows[0].config.timeFormat===settings.timeFormat&&session.rows[0].config.timeZone===settings.timeZone));
      currentSession=sessions().findLast(session=>session.id!==previous
        && JSON.stringify(session.rows[0].config.spinnerVerbs)===JSON.stringify(settings.spinnerVerbs)
        && session.rows[0].config.timeFormat===settings.timeFormat&&session.rows[0].config.timeZone===settings.timeZone).id;
    };
    await phase(1,'Owned building',initialProgressSettings);
    const next={thinking:true,timeFormat:'fixture %H:%M',timeZone:'UTC',spinnerVerbs:{mode:'replace',verbs:['Next building']}};
    fs.writeFileSync(path.join(user,'settings.json'),JSON.stringify(next));
    child.stdin.write('\x15');await phase(2,'Owned building',initialProgressSettings);
    await reload(next);await until(()=>compact().includes('done fixture '));await phase(3,'Next building',next);
    child.stdin.write(`/resume ${originalSession}\r`);
    await until(()=>frame().includes('ready  Session res')&&/done \d\d:\d\dZ/.test(compact()));currentSession=originalSession;
    await phase(4,'Owned building',initialProgressSettings);
    const appended={thinking:true,timeFormat:'24-hour',timeZone:'Asia/Tokyo',spinnerVerbs:{mode:'append',verbs:['Appended fixture']}};
    await reload(appended);await phase(5,'Appended fixture',appended);
    const fallback={thinking:true,timeFormat:'bad',timeZone:'not-a-zone',spinnerVerbs:{mode:'replace',verbs:[]}};
    await reload(fallback);await phase(6,'Zigzagging',fallback);
    await reload({});await phase(7,'Zigzagging',{});
    child.stdin.write('pending settings close\r');await until(()=>pacingStreams.has(8)&&frame().includes('Zigzagging…'));
    process.kill(Number(fs.readFileSync(pidFile,'utf8')),'SIGTERM');child.stdin.end();assert.equal(await exited,130,errors);
    assert.equal(pacingStreams.size,0);assert.equal(requests.length,8);
    const userText=request=>request.messages.filter(message=>message.role==='user').at(-1).content;
    assert.deepEqual(requests.slice(0,7).map(userText),Array.from({length:7},(_,index)=>`settings task ${index+1}`));
    assert.equal(requests.some(request=>JSON.stringify(request.messages).includes('retained settings draft')),false);
    for (const session of sessions()) assert.equal(JSON.stringify(session.rows).includes('owned-mouse-fixture'),false);
    assert.equal(records().findLast(row=>row.kind==='turn_end').reason,'aborted');
  } else if (thinkingProgress) {
    let currentSession;
    const sessions = () => fs.readdirSync(path.join(workspace,'.agent')).filter(name=>name.endsWith('.jsonl')).flatMap(file=> {
      const bytes=fs.readFileSync(path.join(workspace,'.agent',file)),end=bytes.lastIndexOf(10)+1;
      if (!end) return [];
      const rows=bytes.subarray(0,end).toString('utf8').trimEnd().split('\n').map(JSON.parse);
      return rows[0]?.kind==='metadata' ? [{id:rows[0].id,rows}] : [];
    });
    const records = () => sessions().find(session=>session.id===currentSession)?.rows ?? sessions()[0]?.rows ?? [];
    const compact = () => screen.lines().map(row=>row.trim()).join(' ');
    const summary = () => compact().includes('15 tasks (14 done, 1 in progress, 0 open)')
      || /15 tasks \(14 done, 1 in progress, 0\s+open\)/.test(compact());
    await until(summary);
    child.stdin.write('thinking fixture\r'); await until(()=>pacingStreams.has(1)&&frame().includes('Building fixture'));
    const frames=new Set(),shimmer=new Set();
    for (let index=0;index<9;index++) {
      await delay(160);const lines=screen.lines(),row=lines.findIndex(line=>line.includes('Building fixture'));
      if (row>=0) {frames.add(lines[row].trim()[0]);shimmer.add(screen.cell(lines[row].indexOf('Building'),row)?.getFgColor());}
    }
    assert.ok(frames.size>=2); assert.ok(shimmer.size>=2); await until(()=>frame().includes('thinking'));
    child.stdin.write('retained thinking draft'); await delay(50); assert.ok(frame().includes('retained thinking draft'));
    pacingStreams.get(1).resume(); await until(()=>pacingStreams.has(2));
    await until(()=>/15 tasks \(15 done, 0 open\)/.test(compact()));
    pacingStreams.get(2).resume(); await until(()=>frame().includes('ready  finished:'));
    await until(()=>frame().includes(' for ')&&frame().includes('done '));
    const end=records().findLast(row=>row.kind==='turn_end');assert.ok(end.duration&&end.duration.durationMs>0);
    const originalSession=records()[0].id; currentSession=originalSession;
    fs.writeFileSync(path.join(user,'settings.json'),JSON.stringify({showTurnDuration:false,features:{tasks:false},permissions:{mode:'default',allow:['task_*'],deny:[]}}));
    child.stdin.write('\x15/reload\r');
    await until(()=>sessions().some(session=>session.rows[0].config.showTurnDuration===false)&&frame().includes('ready  Local'));
    currentSession=sessions().find(session=>session.rows[0].config.showTurnDuration===false).id;
    await until(()=>!frame().includes('15 tasks')&&!frame().includes(' for '));
    child.stdin.write(`/resume ${originalSession}\r`);await until(()=>frame().includes('ready  Session res')&&frame().includes('15 tasks')&&frame().includes(' for '));
    currentSession=originalSession;
    const doneCount=records().filter(row=>row.kind==='turn_end'&&row.reason==='end_turn').length;
    child.stdin.write('\x15thinking failure\r');await until(()=>pacingStreams.has(3));pacingStreams.get(3).resume();
    await until(()=>frame().includes('ready  error:'));assert.equal(records().filter(row=>row.kind==='turn_end'&&row.reason==='end_turn').length,doneCount);
    child.stdin.write('/continue\r');await until(()=>pacingStreams.has(4));child.stdin.write('\u0003');
    await until(()=>!pacingStreams.has(4)&&frame().includes('ready  finished:'));
    assert.equal(records().findLast(row=>row.kind==='turn_end').reason,'aborted');
    child.stdin.write('recover after cancel\r');await until(()=>requests.length===5&&frame().includes('ready  finished:'));
    assert.ok(records().filter(row=>row.kind==='message'&&row.message.role==='assistant').some(row=>row.message.content.some(block=>block.type==='text'&&block.text==='Recovered thinking response.')));
    child.stdin.write('pending close\r');await until(()=>pacingStreams.has(6));
    process.kill(Number(fs.readFileSync(pidFile,'utf8')),'SIGTERM');child.stdin.end();assert.equal(await exited,130,errors);
    assert.equal(pacingStreams.size,0);assert.equal(requests.length,6);
    assert.equal(requests[0].messages.find(message=>message.role==='user').content,'thinking fixture');
    assert.equal(requests.some(request=>JSON.stringify(request.messages).includes('retained thinking draft')),false);
    const finalRecords=records();assert.ok(finalRecords.filter(row=>row.kind==='turn_end').every(row=>row.duration));
    const {Session}=await import('../dist/session.js');
    const reopen=Session.open(workspace,{id:finalRecords[0].id});
    try {assert.deepEqual(reopen.events.findLast(row=>row.kind==='turn_end'),finalRecords.findLast(row=>row.kind==='turn_end'));}
    finally {reopen.close();}
    assert.equal(fs.existsSync(path.join(workspace,'.agent/tasks.json.lock')),false);
  } else if (themeEditor) {
    const sessions = () => fs.readdirSync(path.join(workspace, '.agent')).filter(file => file.endsWith('.jsonl')).flatMap(file => {
      const bytes = fs.readFileSync(path.join(workspace, '.agent', file)), boundary = bytes.lastIndexOf(10) + 1;
      if (!boundary) return [];
      const records = bytes.subarray(0, boundary).toString('utf8').trimEnd().split('\n').map(JSON.parse);
      return records[0]?.kind === 'metadata' ? [{file, records}] : [];
    });
    const initial = sessions()[0]; assert.ok(initial);
    const preview = () => {
      const rows = screen.lines(), row = rows.findIndex(text => text.includes('Theme preview'));
      return row < 0 ? undefined : screen.cell(0, row)?.getFgColor();
    };
    const speaker = () => {
      const rows = screen.lines(), row = rows.findLastIndex(text => text.includes('Custom phase'));
      return row < 0 ? undefined : screen.cell(0, row)?.getFgColor();
    };
    const themeFile = path.join(user, 'themes/editor-ocean.json');
    const fileTheme = () => JSON.parse(fs.readFileSync(themeFile, 'utf8'));
    child.stdin.write('editor task 1\r'); await until(() => pacingStreams.has(1) && frame().includes('Custom phase 1'));
    pacingStreams.get(1).resume(); await until(() => frame().includes('ready  finished:'));
    child.stdin.write('/theme\r'); await until(() => topLine() === 'Theme'); child.stdin.write('\x1b[F\r');
    await until(() => topLine() === 'New custom theme'); child.stdin.write('Editor Ocean\r');
    await until(() => topLine().includes('Editor Ocean') && frame().includes('Filter color tokens') && fs.existsSync(themeFile) && sessions().length === 2);
    assert.deepEqual(fileTheme(), {name:'Editor Ocean', base:'dark', overrides:{}});
    child.stdin.write('text\x1b[B'); await until(() => frame().includes('current: ██ rgb(255,255,255)'));
    const focusedToken = () => { const lines = screen.lines(), row = lines.findIndex(text => text.includes('> ██ text'));
      return row < 0 ? undefined : screen.cell(2, row)?.getFgColor(); };
    assert.equal(focusedToken(), 0xffffff);
    child.stdin.write('\r'); await until(() => frame().includes('Color: text'));
    child.stdin.write('\x15#334455'); await until(() => preview() === 0x334455); assert.deepEqual(fileTheme().overrides, {});
    const swatch = () => {const lines = screen.lines(), row = lines.findIndex(text => text.includes('██ text'));
      return row < 0 ? undefined : screen.cell(0, row)?.getFgColor();};
    assert.equal(swatch(), 0x334455);
    child.stdin.write('\x1b'); await until(() => frame().includes('Filter color tokens'));
    child.stdin.write('text\x1b[B\r'); await until(() => frame().includes('Color: text'));
    child.stdin.write('\x15invalid\r'); await until(() => frame().includes('Accepts rgb')); assert.deepEqual(fileTheme().overrides, {});
    assert.equal(swatch(), 0xffffff);
    child.stdin.write('\x15#334455\r'); await until(() => fileTheme().overrides.text === '#334455' && frame().includes('Filter color tokens'));
    child.stdin.write('text\x1b[B'); await until(() => frame().includes('> ██ text (custom)') && frame().includes('current: ██ #334455'));
    assert.equal(focusedToken(), 0x334455); assert.ok(frame().includes('preset: ██ rgb(255,255,255)'));
    child.stdin.write('\t'); await until(() => Object.keys(fileTheme().overrides).length === 0);
    await until(() => focusedToken() === 0xffffff && !frame().includes('(custom)'));
    child.stdin.write('\x15text\x1b[B\r'); await until(() => frame().includes('Color: text'));
    child.stdin.write('\x15#223344\r'); await until(() => fileTheme().overrides.text === '#223344');
    child.stdin.write('\x1b'); await until(() => frame().includes('ready  Theme editor') && speaker() === 0x223344);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(user, 'settings.json'), 'utf8')),
      {plugins:{enabled:true}, theme:'custom:editor-ocean', unrelated:{keep:1}});
    child.stdin.write('/theme\r'); await until(() => topLine() === 'Theme' && frame().includes('Selected: Editor Ocean'));
    child.stdin.write('\x05'); await until(() => frame().includes('Filter color tokens'));
    child.stdin.write('text\x1b[B\r'); await until(() => frame().includes('Color: text'));
    child.stdin.write('\x15#445566'); await until(() => preview() === 0x445566);
    child.stdin.write('\x1b'); await until(() => frame().includes('Filter color tokens'));
    child.stdin.write('\x1b'); await until(() => frame().includes('ready  Theme editor') && speaker() === 0x223344);
    child.stdin.write('/theme\r'); await until(() => topLine() === 'Theme' && frame().includes('Selected: Editor Ocean'));
    child.stdin.write('\x1b[B'); await until(() => frame().includes('Selected: Ocean') && frame().includes('from sample'));
    child.stdin.write('\x05'); await until(() => topLine().includes('Fork Ocean'));
    child.stdin.write('\x15Fork Ocean\r'); const forkFile = path.join(user, 'themes/fork-ocean.json');
    await until(() => frame().includes('Filter color tokens') && fs.existsSync(forkFile) && sessions().length === 4);
    assert.deepEqual(JSON.parse(fs.readFileSync(forkFile, 'utf8')), {name:'Fork Ocean', base:'light', overrides:{text:'#112233', promptBorder:'#445566'}});
    child.stdin.write('\x1b'); await until(() => frame().includes('ready  Theme editor') && speaker() === 0x112233);
    assert.equal(JSON.parse(fs.readFileSync(path.join(workspace, '.harness/plugins/sample/themes/ocean.json'), 'utf8')).overrides.text, '#112233');
    child.stdin.write(`/resume ${initial.file.slice(0,-6)}\r`); await until(() => frame().includes('ready  Session res') && speaker() === 0xffffff);
    child.stdin.write('/reload\r'); await until(() => frame().includes('ready  Local') && speaker() === 0x112233 && sessions().length === 5);
    child.stdin.write('retained editor draft'); await delay(30); assert.ok(frame().includes('retained editor draft')); child.stdin.write('\r');
    await until(() => pacingStreams.has(2)); assert.equal(requests[1].messages.filter(message => message.role === 'user').at(-1).content, 'retained editor draft');
    pacingStreams.get(2).resume(); await until(() => frame().includes('ready  finished:'));
    child.stdin.write('/theme\r'); await until(() => topLine() === 'Theme' && frame().includes('Selected: Fork Ocean'));
    child.stdin.write('\x05'); await until(() => frame().includes('Filter color tokens'));
    child.stdin.write('text\x1b[B\r'); await until(() => frame().includes('Color: text'));
    child.stdin.write('\x15#abcdef'); await until(() => preview() === 0xabcdef);
    process.kill(Number(fs.readFileSync(pidFile, 'utf8')), 'SIGTERM'); child.stdin.end(); assert.equal(await exited, 130, errors);
    assert.equal(JSON.parse(fs.readFileSync(forkFile, 'utf8')).overrides.text, '#112233');
    assert.equal(requests.length, 2); assert.equal(pacingStreams.size, 0);
    for (const session of sessions()) {
      const raw = fs.readFileSync(path.join(workspace, '.agent', session.file), 'utf8'); assert.equal(raw.includes('owned-mouse-fixture'), false);
      for (const record of session.records.filter(event => event.kind === 'message' && event.message.role === 'assistant')) {
        const body = record.message.content.filter(block => block.type === 'text').map(block => block.text).join('');
        assert.equal(body.replace(/^# Custom phase [1-2]\n\n/, ''), themeBody);
      }
    }
  } else if (pluginTheme) {
    const sessions = () => fs.readdirSync(path.join(workspace, '.agent')).filter(file => file.endsWith('.jsonl')).flatMap(file => {
      const bytes = fs.readFileSync(path.join(workspace, '.agent', file)), boundary = bytes.lastIndexOf(10) + 1;
      if (!boundary) return [];
      const records = bytes.subarray(0, boundary).toString('utf8').trimEnd().split('\n').map(JSON.parse);
      return records[0]?.kind === 'metadata' ? [{ file, records }] : [];
    });
    const initial = sessions()[0]; assert.ok(initial); assert.equal(initial.records[0].config.plugins.enabled, true);
    assert.equal(initial.records[0].config.theme, 'custom:sample:ocean');
    const check = (speaker, border, inline = 5728759) => {
      const rows = screen.lines(), row = rows.findLastIndex(text => text.includes('Use sample'));
      const start = rows.findLastIndex((text, index) => index < row && text.includes('Custom phase'));
      const input = rows.findIndex(text => text.includes('────'));
      return row >= 0 && screen.cell(0, start)?.getFgColor() === speaker && screen.cell(0, input)?.getFgColor() === border
        && screen.cell(rows[row].indexOf('sample'), row)?.getFgColor() === inline;
    };
    const phase = async (index, speaker = 0x112233, border = 0x445566) => {
      child.stdin.write(`plugin task ${index}\r`);
      await until(() => pacingStreams.has(index) && frame().includes(`Custom phase ${index}`) && check(speaker, border));
      pacingStreams.get(index).resume(); await until(() => frame().includes('ready  finished:')); assert.ok(check(speaker, border));
    };
    await phase(1);
    child.stdin.write('retained plugin draft'); await installThemePlugin('#334455', '#667788'); await delay(450);
    assert.ok(check(0x112233, 0x445566)); assert.ok(frame().includes('retained plugin draft')); assert.equal(sessions().length, 1);
    child.stdin.write('\r'); await until(() => pacingStreams.has(2));
    assert.equal(requests[1].messages.filter(message => message.role === 'user').at(-1).content, 'retained plugin draft');
    pacingStreams.get(2).resume(); await until(() => frame().includes('ready  finished:'));
    child.stdin.write('/reload\r'); await until(() => sessions().length === 2 && frame().includes('ready  Local') && check(0x334455, 0x667788));
    fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ plugins: { enabled: false }, theme: 'custom:sample:ocean', unrelated: { keep: 1 } }));
    child.stdin.write('/reload\r'); await until(() => sessions().length === 3 && frame().includes('ready  Local') && check(0xffffff, 0x888888, 11647481));
    child.stdin.write(`/resume ${initial.file.slice(0, -6)}\r`); await until(() => frame().includes('ready  Session res') && check(0x334455, 0x667788));
    child.stdin.write('/theme\r'); await until(() => topLine() === 'Theme' && frame().includes('Selected: Ocean') && frame().includes('from sample'));
    child.stdin.write('\x1b[A'); await until(() => frame().includes('Selected: Light mode (ANSI colors only)'));
    child.stdin.write('\u0003'); await until(() => frame().includes('Theme selection cancelled') && check(0x334455, 0x667788));
    child.stdin.write('/theme\r'); await until(() => topLine() === 'Theme' && frame().includes('Selected: Ocean'));
    child.stdin.write('\r'); await until(() => sessions().length === 4 && frame().includes('Theme: custom:sample:ocean'));
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(user, 'settings.json'), 'utf8')),
      { plugins: { enabled: false }, theme: 'custom:sample:ocean', unrelated: { keep: 1 } });
    fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ plugins: { enabled: true }, theme: 'custom:sample:ocean', unrelated: { keep: 1 } }));
    child.stdin.write('/reload\r'); await until(() => sessions().length === 5 && frame().includes('ready  Local') && check(0x334455, 0x667788));
    await phase(3, 0x334455, 0x667788);
    fs.writeFileSync(path.join(workspace, '.harness/plugins/sample/themes/ocean.json'), '{}');
    child.stdin.write('/reload\r'); await until(() => frame().includes('ready  error: invalid installed plugin catalog')); assert.equal(sessions().length, 5); assert.ok(check(0x334455, 0x667788));
    process.kill(Number(fs.readFileSync(pidFile, 'utf8')), 'SIGTERM'); child.stdin.end(); assert.equal(await exited, 130, errors);
    assert.equal(requests.length, 3); assert.equal(pacingStreams.size, 0);
    for (const session of sessions()) {
      assert.equal(fs.readFileSync(path.join(workspace, '.agent', session.file), 'utf8').includes('owned-mouse-fixture'), false);
      for (const event of session.records.filter(event => event.kind === 'message' && event.message.role === 'assistant')) {
        const body = event.message.content.filter(block => block.type === 'text').map(block => block.text).join('');
        assert.equal(body.replace(/^# Custom phase [1-3]\n\n/, ''), themeBody);
      }
    }
  } else if (customTheme) {
    const sessions = () => fs.readdirSync(path.join(workspace, '.agent')).filter(file => file.endsWith('.jsonl'))
      .flatMap(file => {
        const bytes = fs.readFileSync(path.join(workspace, '.agent', file));
        const boundary = bytes.lastIndexOf(10) + 1; if (!boundary) return [];
        const records = bytes.subarray(0, boundary).toString('utf8').trimEnd().split('\n').map(JSON.parse);
        assert.equal(records[0].kind, 'metadata'); return [{ file, records }];
      });
    const initial = sessions()[0]; assert.ok(initial);
    assert.equal(initial.records[0].config.theme, 'custom:ocean');
    const colors = () => {
      const rows = screen.lines(); const row = rows.findLastIndex(text => text.includes('Use sample'));
      const start = row < 0 ? -1 : rows.findLastIndex((text, index) => index < row && text.includes('Custom phase'));
      const border = rows.findIndex(text => text.includes('────'));
      return { speaker: screen.cell(0, start)?.getFgColor(), border: screen.cell(0, border)?.getFgColor(),
        inline: row < 0 ? undefined : screen.cell(rows[row].indexOf('sample'), row)?.getFgColor() };
    };
    const check = (speaker, border, inline = 5728759) => {
      const actual = colors(); return actual.speaker === speaker && actual.border === border && actual.inline === inline;
    };
    const phase = async index => {
      child.stdin.write(`custom task ${index}\r`);
      await until(() => pacingStreams.has(index) && frame().includes(`Custom phase ${index}`) && check(0x112233, 0x445566));
      pacingStreams.get(index).resume();
      await until(() => frame().includes(`Custom phase ${index}`) && frame().includes('ready  finished:'));
      assert.ok(check(0x112233, 0x445566));
    };
    await phase(1);
    child.stdin.write('retained draft');
    writeCustomTheme('#334455', '#667788'); await until(() => check(0x334455, 0x667788));
    assert.ok(frame().includes('retained draft')); assert.equal(sessions().length, 1);
    fs.writeFileSync(customThemeFile, '{'); await until(() => check(0xffffff, 0x888888, 11647481));
    assert.ok(frame().includes('retained draft')); assert.equal(sessions().length, 1);
    writeCustomTheme('#112233', '#445566'); await until(() => check(0x112233, 0x445566));
    fs.unlinkSync(customThemeFile); await until(() => check(0xffffff, 0x888888, 11647481));
    writeCustomTheme('#112233', '#445566'); await until(() => check(0x112233, 0x445566));
    child.stdin.write('\r'); await until(() => pacingStreams.has(2) && frame().includes('Custom phase 2'));
    assert.equal(requests[1].messages.filter(message => message.role === 'user').at(-1).content, 'retained draft');
    pacingStreams.get(2).resume(); await until(() => frame().includes('ready  finished:'));
    child.stdin.write('/theme\r'); await until(() => topLine() === 'Theme' && frame().includes('Selected: Ocean'));
    child.stdin.write('\x1b[A'); await until(() => frame().includes('Selected: Light mode (ANSI colors only)'));
    child.stdin.write('\u0003'); await until(() => frame().includes('Theme selection cancelled') && check(0x112233, 0x445566));
    child.stdin.write('/theme\r'); await until(() => topLine() === 'Theme' && frame().includes('Selected: Ocean'));
    child.stdin.write('\r'); await until(() => sessions().length === 2 && frame().includes('Theme: custom:ocean') && check(0x112233, 0x445566));
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(user, 'settings.json'), 'utf8')),
      { theme: 'custom:ocean', unrelated: { keep: 1 } });
    child.stdin.write('/theme dark\r'); await until(() => sessions().length === 3 && frame().includes('Theme: dark'));
    child.stdin.write(`/resume ${initial.file.slice(0, -6)}\r`);
    await until(() => frame().includes('ready  Session res') && check(0x112233, 0x445566));
    fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ theme: 'custom:ocean', unrelated: { keep: 1 } }));
    child.stdin.write('/reload\r'); await until(() => sessions().length === 4 && frame().includes('ready  Local') && check(0x112233, 0x445566));
    await phase(3);
    writeCustomTheme('#abcdef', '#fedcba');
    process.kill(Number(fs.readFileSync(pidFile, 'utf8')), 'SIGTERM'); child.stdin.end();
    assert.equal(await exited, 130, errors); assert.equal(pacingStreams.size, 0); assert.equal(requests.length, 3);
    for (const session of sessions()) {
      const raw = fs.readFileSync(path.join(workspace, '.agent', session.file), 'utf8');
      assert.equal(raw.includes('owned-mouse-fixture'), false);
      for (const record of session.records.filter(event => event.kind === 'message' && event.message.role === 'assistant')) {
        const body = record.message.content.filter(block => block.type === 'text').map(block => block.text).join('');
        assert.match(body, /^# Custom phase [1-3]\n\n/);
        assert.equal(body.replace(/^# Custom phase [1-3]\n\n/, ''), themeBody);
      }
    }
  } else if (systemTheme) {
    const lightColor = systemThemeMux ? 105 : 5728759;
    const darkColor = systemThemeMux ? 153 : 11647481;
    const queries = () => (output.match(/\x1b\]11;\?/g) ?? []).length;
    const sampleColor = () => {
      const rows = screen.lines(); const row = rows.findLastIndex(text => text.includes('Use sample'));
      return row < 0 ? undefined : screen.cell(rows[row].indexOf('sample'), row)?.getFgColor();
    };
    const respond = async color => {
      child.stdin.write('\x1b]11;rgb:'); await delay(10);
      child.stdin.write(color === 'light' ? 'ffff/ffff/ffff\x1b' : '0000/0000/0000\x1b'); await delay(10);
      child.stdin.write('\\\x1b[?1;2c' + (systemThemeMux ? '\x1b[?1;2c' : ''));
    };
    await until(() => queries() >= 1);
    if (systemThemeMux) {
      assert.ok(output.includes('\x1bPtmux;\x1b\x1b]11;?'));
      await until(() => queries() >= 2);
    }
    await respond('light'); await delay(50);
    const phase = async (index, color) => {
      child.stdin.write(`system task ${index}\r`);
      await until(() => pacingStreams.has(index) && frame().includes(`System phase ${index}`) && sampleColor() === color);
      pacingStreams.get(index).resume();
      await until(() => frame().includes('ready  finished:') && frame().includes(`System phase ${index}`));
      assert.equal(sampleColor(), color);
    };
    await phase(1, lightColor);
    child.stdin.write('retained draft'); const previousQueries = queries();
    child.stdin.write('\x1b[?997;1n'); await until(() => queries() > previousQueries); await respond('dark');
    await until(() => sampleColor() === darkColor); assert.ok(frame().includes('retained draft'));
    child.stdin.write('\r');
    await until(() => pacingStreams.has(2) && frame().includes('System phase 2') && sampleColor() === darkColor);
    const latestUser = requests[1].messages.filter(message => message.role === 'user').at(-1);
    assert.equal(latestUser.content, 'retained draft'); pacingStreams.get(2).resume();
    await until(() => frame().includes('ready  finished:'));
    child.stdin.write('/theme dark\r'); await until(() => frame().includes('Theme: dark'));
    const manualQueries = queries(); child.stdin.write('\x1b[?997;2n');
    child.stdin.write('\x1b]11;#fff\x07\x1b[?1;2c'); await delay(100);
    assert.equal(queries(), manualQueries); assert.equal(sampleColor(), darkColor);
    child.stdin.write('/theme auto\r'); await until(() => frame().includes('Theme: auto') && queries() > manualQueries);
    const resumedQueries = queries();
    await respond('light'); await until(() => sampleColor() === lightColor);
    child.stdin.write('/theme\r'); await until(() => topLine() === 'Theme' && frame().includes('Selected: Auto'));
    child.stdin.write('\x1b[B'); await until(() => frame().includes('Selected: Dark mode') && sampleColor() === darkColor);
    child.stdin.write('\u0003'); await until(() => frame().includes('Theme selection cancelled') && sampleColor() === lightColor);
    assert.ok(queries() > resumedQueries);
    child.stdin.write('\x1b[?997;1n');
    process.kill(Number(fs.readFileSync(pidFile, 'utf8')), 'SIGTERM'); child.stdin.end();
    assert.equal(await exited, 130, errors); assert.ok(output.includes('\x1b[?2031h') && output.includes('\x1b[?2031l'));
    assert.equal(pacingStreams.size, 0); assert.equal(requests.length, 2);
    for (const file of fs.readdirSync(path.join(workspace, '.agent')).filter(file => file.endsWith('.jsonl'))) {
      const raw = fs.readFileSync(path.join(workspace, '.agent', file), 'utf8');
      assert.equal(raw.includes('rgb:'), false); assert.equal(raw.includes('997;'), false); assert.equal(raw.includes('owned-mouse-fixture'), false);
    }
  } else if (theming) {
    const settingsFile = path.join(user, 'settings.json');
    const sessions = () => fs.readdirSync(path.join(workspace, '.agent')).filter(file => file.endsWith('.jsonl'))
      .flatMap(file => {
        const bytes = fs.readFileSync(path.join(workspace, '.agent', file));
        const boundary = bytes.lastIndexOf(10) + 1; if (!boundary) return [];
        const records = bytes.subarray(0, boundary).toString('utf8').trimEnd().split('\n').map(JSON.parse);
        assert.equal(records[0].kind, 'metadata'); return [{ file, records }];
      });
    const initial = sessions()[0]; assert.ok(initial); assert.equal(initial.records[0].config.theme, 'dark');
    const sample = () => {
      const rows = screen.lines(); const row = rows.findLastIndex(text => text.includes('Use sample'));
      return row < 0 ? undefined : screen.cell(rows[row].indexOf('sample'), row);
    };
    const sampleColor = () => sample()?.getFgColor();
    const phase = async (index, color) => {
      child.stdin.write(`theme task ${index}\r`);
      await until(() => pacingStreams.has(index) && frame().includes('running')
        && frame().includes(`Theme phase ${index}`) && sampleColor() === color);
      assert.ok(sample().isFgRGB()); pacingStreams.get(index).resume();
      await until(() => frame().includes(`Theme phase ${index}`) && frame().includes('ready  finished:'));
      assert.equal(sampleColor(), color);
    };
    await phase(1, 11647481);
    child.stdin.write('/theme\r'); await until(() => topLine() === 'Theme' && frame().includes('Selected: Dark mode'));
    child.stdin.write('\x1b[B'); await until(() => frame().includes('Selected: Light mode') && sampleColor() === 5728759);
    child.stdin.write('\u0003'); await until(() => frame().includes('Theme selection cancelled') && sampleColor() === 11647481);
    assert.equal(sessions().length, 1); assert.equal(JSON.parse(fs.readFileSync(settingsFile, 'utf8')).theme, 'dark');
    child.stdin.write('/theme\r'); await until(() => topLine() === 'Theme'); child.stdin.write('\x1b[B\r');
    await until(() => sessions().length === 2 && frame().includes('Theme: light') && sampleColor() === 5728759);
    assert.deepEqual(JSON.parse(fs.readFileSync(settingsFile, 'utf8')), { theme: 'light', unrelated: { keep: 1 } });
    await phase(2, 5728759);
    fs.writeFileSync(settingsFile, '{'); child.stdin.write('/theme dark\r');
    await until(() => frame().includes('ready  error:'));
    assert.equal(fs.readFileSync(settingsFile, 'utf8'), '{'); assert.equal(sessions().length, 2);
    assert.equal(sampleColor(), 5728759);
    fs.writeFileSync(settingsFile, JSON.stringify({ theme: 'light', unrelated: { keep: 1 } }));
    child.stdin.write(`/resume ${initial.file.slice(0, -6)}\r`);
    await until(() => frame().includes('ready  Session res') && sampleColor() === 11647481);
    await phase(3, 11647481);
    child.stdin.write('/reload\r'); await until(() => sessions().length === 3 && frame().includes('ready  Local') && sampleColor() === 5728759);
    await phase(4, 5728759);
    child.stdin.write('/theme auto\r'); await until(() => sessions().length === 4 && frame().includes('Theme: auto'));
    await phase(5, 5728759);
    child.stdin.write('/exit\r'); child.stdin.end(); assert.equal(await exited, 0, errors);
    const restarted = spawnSync(process.execPath, [cli, '--interactive', '--workspace', workspace, '--user-dir', user], {
      cwd: root, encoding: 'utf8', input: '/status\n/exit\n', timeout: 10000,
      env: { ...process.env, LLM_INHERIT_GATEWAY: 'false', LLM_API_KEY: 'owned-mouse-fixture',
        LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_MODEL: 'fixture/mouse',
        LLM_AUTH: 'bearer', LLM_THINKING: 'false', LLM_TOKEN_COUNTING: 'estimate',
        LLM_PROMPT_CACHE: 'false', LLM_EAGER_TOOL_INPUT: 'false' },
    });
    assert.equal(restarted.status, 0, restarted.stderr); assert.match(restarted.stdout, /"theme": "auto"/);
    assert.equal(sessions().length, 5); assert.equal(requests.length, 5); assert.equal(pacingStreams.size, 0);
    for (const session of sessions()) {
      const raw = fs.readFileSync(path.join(workspace, '.agent', session.file), 'utf8');
      assert.equal(raw.includes('owned-mouse-fixture'), false);
      for (const record of session.records.filter(event => event.kind === 'message' && event.message.role === 'assistant')) {
        const body = record.message.content.filter(block => block.type === 'text').map(block => block.text).join('');
        assert.match(body, /^# Theme phase [1-5]\n\n/);
        assert.equal(body.replace(/^# Theme phase [1-5]\n\n/, ''), themeBody);
      }
    }
  } else if (highlighting) {
    const settingsFile = path.join(user, 'settings.json');
    const sessions = () => fs.readdirSync(path.join(workspace, '.agent')).filter(file => file.endsWith('.jsonl'))
      .flatMap(file => {
        const bytes = fs.readFileSync(path.join(workspace, '.agent', file));
        const boundary = bytes.lastIndexOf(10) + 1; if (!boundary) return [];
        const records = bytes.subarray(0, boundary).toString('utf8').trimEnd().split('\n').map(JSON.parse);
        assert.equal(records[0].kind, 'metadata'); return [{ file, records }];
      });
    const initial = sessions()[0]; assert.ok(initial);
    assert.equal(initial.records[0].config.syntaxHighlightingDisabled, true);
    const codeRow = () => screen.lines().findLastIndex(row => row.includes('const value = 1;'));
    const highlighted = () => {
      const cell = screen.cell(2, codeRow());
      return Boolean(cell?.isFgPalette() || cell?.isFgRGB());
    };
    const checkStyle = disabled => {
      const row = codeRow(); assert.ok(row >= 0);
      assert.equal(highlighted(), !disabled);
      if (disabled) {
        assert.equal(screen.cell(2, row)?.getFgColorMode(), 0);
        assert.equal(screen.lines()[row - 1].trim(), 'ts');
        assert.ok(screen.cell(2, row - 1)?.isDim());
      } else assert.equal(screen.lines()[row - 1].trim(), '');
    };
    const phase = async (index, disabled) => {
      child.stdin.write(`highlight task ${index}\r`);
      await until(() => pacingStreams.has(index) && frame().includes('running')
        && frame().includes(`Highlight phase ${index}`) && codeRow() >= 0 && highlighted() === !disabled);
      checkStyle(disabled);
      const heading = screen.lines().findLastIndex(row => row.includes(`Highlight phase ${index}`));
      assert.ok(screen.cell(2, heading)?.isBold());
      pacingStreams.get(index).resume();
      await until(() => frame().includes(`Highlight phase ${index}`) && frame().includes('ready  finished:'));
      checkStyle(disabled);
    };
    await phase(1, true);
    fs.writeFileSync(settingsFile, JSON.stringify({ syntaxHighlightingDisabled: false }));
    await phase(2, true);
    child.stdin.write('/reload\r');
    await until(() => sessions().length === 2 && frame().includes('ready  Local'));
    assert.equal(sessions().find(item => item.file !== initial.file).records[0].config.syntaxHighlightingDisabled, false);
    await phase(3, false);
    child.stdin.write(`/resume ${initial.file.slice(0, -6)}\r`);
    await until(() => frame().includes('ready  Session res')); await phase(4, true);
    fs.writeFileSync(settingsFile, '{}'); child.stdin.write('/reload\r');
    await until(() => sessions().length === 3 && frame().includes('ready  Local'));
    assert.ok(sessions().some(item => !Object.hasOwn(item.records[0].config, 'syntaxHighlightingDisabled')));
    await phase(5, false);
    child.stdin.write('/exit\r'); child.stdin.end(); assert.equal(await exited, 0, errors);
    assert.equal(pacingStreams.size, 0); assert.equal(requests.length, 5);
    for (const session of sessions()) {
      const raw = fs.readFileSync(path.join(workspace, '.agent', session.file), 'utf8');
      assert.equal(raw.includes('owned-mouse-fixture'), false);
      for (const record of session.records.filter(event => event.kind === 'message' && event.message.role === 'assistant')) {
        const body = record.message.content.filter(block => block.type === 'text').map(block => block.text).join('');
        assert.match(body, /^# Highlight phase [1-5]\n\n/);
        assert.equal(body.replace(/^# Highlight phase [1-5]\n\n/, ''), highlightBody);
      }
    }
  } else if (proseWidth) {
    const settingsFile = path.join(user, 'settings.json');
    const sessions = () => fs.readdirSync(path.join(workspace, '.agent')).filter(file => file.endsWith('.jsonl'))
      .flatMap(file => {
        const bytes = fs.readFileSync(path.join(workspace, '.agent', file));
        const boundary = bytes.lastIndexOf(10) + 1;
        if (!boundary) return [];
        const records = bytes.subarray(0, boundary).toString('utf8').trimEnd().split('\n').map(JSON.parse);
        assert.equal(records[0].kind, 'metadata'); return [{ file, records }];
      });
    const initial = sessions()[0]; assert.ok(initial);
    assert.equal(initial.records[0].config.maxProseWidth, 40);
    const proseRows = () => {
      const rows = screen.lines();
      const end = rows.findLastIndex(row => row.includes('ProseWord'));
      let start = end;
      while (start > 0 && rows[start - 1].includes('ProseWord')) start--;
      return end < 0 ? [] : rows.slice(start, end + 1);
    };
    const phase = async (index, expectedRows) => {
      child.stdin.write(`prose task ${index}\r`);
      await until(() => pacingStreams.has(index) && frame().includes('running') && frame().includes(`Prose phase ${index}`)
        && proseRows().length === expectedRows);
      assert.equal(proseRows().map(row => row.replace(/^(?:⏺ |● |  )/, '')).join(' ').replace(/ +/g, ' '), proseText);
      pacingStreams.get(index).resume();
      await until(() => frame().includes('CodeWide'.repeat(9)) && frame().includes('TableWide'.repeat(6))
        && frame().includes('ready  finished:'));
      assert.equal(proseRows().length, expectedRows);
      assert.ok(screen.lines().find(row => row.includes('CodeWide')).length > 62);
      assert.ok(screen.lines().find(row => row.includes('TableWide')).length > 62);
    };
    await phase(1, 3);
    fs.writeFileSync(settingsFile, JSON.stringify({ maxProseWidth: 60 }));
    await phase(2, 3);
    child.stdin.write('/reload\r');
    await until(() => sessions().length === 2 && frame().includes('ready  Local'));
    assert.equal(sessions().find(item => item.file !== initial.file).records[0].config.maxProseWidth, 60);
    await phase(3, 2);
    child.stdin.write(`/resume ${initial.file.slice(0, -6)}\r`);
    await until(() => frame().includes('ready  Session res'));
    await phase(4, 3);
    fs.writeFileSync(settingsFile, '{}'); child.stdin.write('/reload\r');
    await until(() => sessions().length === 3 && frame().includes('ready  Local'));
    assert.ok(sessions().some(item => !Object.hasOwn(item.records[0].config, 'maxProseWidth')));
    await phase(5, 1);
    fs.writeFileSync(settingsFile, JSON.stringify({ maxProseWidth: 39 })); child.stdin.write('/reload\r');
    await until(() => sessions().length === 4 && frame().includes('ready  Local'));
    assert.equal(sessions().filter(item => !Object.hasOwn(item.records[0].config, 'maxProseWidth')).length, 2);
    await phase(6, 1);
    child.stdin.write('/exit\r'); child.stdin.end(); assert.equal(await exited, 0, errors);
    assert.equal(pacingStreams.size, 0); assert.equal(requests.length, 6);
    for (const session of sessions()) {
      const raw = fs.readFileSync(path.join(workspace, '.agent', session.file), 'utf8');
      assert.equal(raw.includes('owned-mouse-fixture'), false);
      for (const record of session.records.filter(event => event.kind === 'message' && event.message.role === 'assistant')) {
        const body = record.message.content.filter(block => block.type === 'text').map(block => block.text).join('');
        assert.match(body, /^Prose phase [1-6]\n\n/);
        assert.equal(body.replace(/^Prose phase [1-6]\n\n/, ''), prosePrefix + proseSuffix);
      }
    }
  } else if (visibility) {
    const settingsFile = path.join(user, 'settings.json');
    const sessions = () => fs.readdirSync(path.join(workspace, '.agent')).filter(file => file.endsWith('.jsonl'))
      .flatMap(file => {
        const bytes = fs.readFileSync(path.join(workspace, '.agent', file));
        const boundary = bytes.lastIndexOf(10) + 1;
        if (!boundary) return [];
        // Like Session.open, only complete newline-terminated records are committed.
        const records = bytes.subarray(0, boundary).toString('utf8').trimEnd().split('\n').map(JSON.parse);
        assert.equal(records[0].kind, 'metadata');
        return [{ file, records }];
      });
    const initial = sessions()[0]; assert.ok(initial);
    assert.equal(initial.records[0].config.prefersReducedMotion, true);
    const phase = async (index, expectedPreview) => {
      child.stdin.write(`visibility task ${index}\r`);
      await until(() => pacingStreams.has(index) && frame().includes('running'));
      if (expectedPreview) await until(() => frame().includes(`Preview prefix ${index}`));
      else {
        // The response remains held across multiple publication intervals.
        await delay(250);
        assert.equal(frame().includes(`Preview prefix ${index}`), false);
      }
      assert.equal(frame().includes(`Partial tail ${index}`), false);
      pacingStreams.get(index).resume();
      await until(() => frame().includes(`Partial tail ${index}`) && frame().includes('ready  finished:'));
    };
    await phase(1, false);
    fs.writeFileSync(settingsFile, JSON.stringify({ prefersReducedMotion: false }));
    await phase(2, false);
    child.stdin.write('/reload\r');
    await until(() => sessions().length === 2 && frame().includes('ready  Local'));
    assert.equal(sessions().find(item => item.file !== initial.file).records[0].config.prefersReducedMotion, false);
    await phase(3, !windowsTerminal);
    child.stdin.write(`/resume ${initial.file.slice(0, -6)}\r`);
    await until(() => frame().includes('ready  Session res'));
    await phase(4, false);
    fs.writeFileSync(settingsFile, '{}');
    child.stdin.write('/reload\r');
    await until(() => sessions().length === 3 && frame().includes('ready  Local'));
    const reset = sessions().find(item => !Object.hasOwn(item.records[0].config, 'prefersReducedMotion'));
    assert.ok(reset);
    await phase(5, !windowsTerminal);
    child.stdin.write('/exit\r'); child.stdin.end();
    assert.equal(await exited, 0, errors);
    assert.equal(pacingStreams.size, 0);
    assert.equal(requests.length, 5);
  } else if (pacing) {
    const capture = stage => pacingFrames.push({ stage, body: screen.lines().filter(row =>
      /Complete prefix|Hidden tail|Cancel prefix|Cancel tail|Fast response|Failure prefix|Failure tail|Close prefix|Close tail/.test(row)) });
    child.stdin.write('paced task\r');
    await until(() => pacingStreams.has(1) && frame().includes('Complete prefix'));
    assert.equal(frame().includes('Hidden tail'), false);
    capture('streaming');
    pacingStreams.get(1).emit(' completed'); pacingStreams.get(1).resume();
    await until(() => frame().includes('Hidden tail completed') && frame().includes('ready  finished:'));
    capture('completed');
    const completedFrame = frame(); await delay(250); assert.equal(frame(), completedFrame);

    child.stdin.write('cancel task\r');
    await until(() => pacingStreams.has(2) && frame().includes('Cancel prefix'));
    assert.equal(frame().includes('Cancel tail'), false);
    child.stdin.write('\u0003');
    await until(() => !pacingStreams.has(2) && frame().includes('Cancel tail') && frame().includes('ready  finished:'));
    capture('cancelled');
    child.stdin.write('fast task\r');
    await until(() => requests.length === 3 && frame().includes('Fast response is complete.') && frame().includes('ready  finished:'));
    capture('fast');
    assert.equal(screen.lines().filter(row => row.includes('Fast response is complete.')).length, 1);

    child.stdin.write('failure task\r');
    await until(() => pacingStreams.has(4) && frame().includes('Failure prefix'));
    assert.equal(frame().includes('Failure tail'), false);
    pacingStreams.get(4).emit(' retained'); pacingStreams.get(4).resume();
    await until(() => frame().includes('Failure tail retained') && frame().includes('ready  error:'));
    capture('failed');
    const failedFrame = frame(); await delay(250); assert.equal(frame(), failedFrame);

    child.stdin.write('/continue\r');
    await until(() => pacingStreams.has(5) && frame().includes('Close prefix'));
    assert.equal(frame().includes('Close tail'), false);
    capture('closing');
    pacingStreams.get(5).emit(' pending');
    if (inputClose) child.stdin.write('\x1b[997~');
    else process.kill(Number(fs.readFileSync(pidFile, 'utf8')), 'SIGTERM');
    child.stdin.end();
    assert.equal(await exited, inputClose ? 0 : 130, `${errors}\n${output.slice(-1800)}`);
    assert.equal(pacingStreams.has(5), false);
    assert.equal(requests.length, 5);
  } else if (messages) {
    child.stdin.write('render this\r');
    await until(() => frame().includes('ready  finished:') && frame().includes('const value = 1;'));
    if (streamingChunks) {
      assert.ok(frame().includes('const frozen = 1;'));
      assert.equal(frame().includes('```'), false);
      child.stdin.write('next task\r');
      await until(() => requests.length === 2 && frame().includes('Second response stays separate.') && frame().includes('ready  finished:'));
      child.stdin.write('/exit\r'); child.stdin.end();
      assert.equal(await exited, 0, errors);
    } else {
    const first = frame();
    const speaker = process.platform === 'darwin' ? '⏺' : '●';
    assert.ok(first.includes(`${speaker} Message layout`));
    const headingRow = screen.lines().findIndex(row => row.includes(`${speaker} Message layout`));
    const codeRow = screen.lines().findIndex(row => row.includes('const value = 1;'));
    assert.ok(screen.cell(2, headingRow)?.isBold());
    assert.ok(screen.cell(2, codeRow)?.isFgPalette() || screen.cell(2, codeRow)?.isFgRGB());
    assert.ok(first.includes('One streamed sentence keeps its words'));
    assert.ok(first.includes('- First item') && first.includes('- 第二项'));
    const unicodeLines = first.split('\n')
      .filter(row => row.includes('界') || row.includes('👩‍💻'));
    assert.equal(unicodeLines.map(row => row.replace(/^ {2}/, '').trimEnd()).join(''), messageUnicode);
    assert.equal(first.includes('```'), false);
    assert.equal(first.includes('earlier lines'), false);
    assert.equal(first.split(`${speaker} `).length - 1, 1);
    child.stdin.write('next task\r');
    await until(() => requests.length === 2 && frame().includes(`${speaker} Second response stays separate.`) && frame().includes('ready  finished:'));
    child.stdin.write('/exit\r'); child.stdin.end();
    assert.equal(await exited, 0, errors);
    assert.equal(requests.length, 2);
    }
  } else if (actions) {
    child.stdin.write('retained\x1bp');
    await until(() => topLine() === 'Model');
    child.stdin.write('fixture/other\r');
    await until(() => frame().includes('Model: fixture/other'));
    child.stdin.write('\x1bt');
    await until(() => frame().includes('Thinking: on'));
    child.stdin.write('\u0013');
    await until(() => frame().includes('draft stashed'));
    child.stdin.write('scratch\u0013');
    await until(() => frame().includes('drafts swapped'));
    child.stdin.write('\u0014');
    await until(() => topLine() === '[]');
    assert.equal(requests.length, 0);
    child.stdin.write('\r');
    await until(() => frame().includes('ready  finished:'));
    assert.equal(requests.length, 1);
    assert.equal(requests[0].model, 'fixture/other');
    assert.equal(requests[0].thinking.type, 'adaptive');
    assert.equal(requests[0].messages.at(-1).content, 'retained');
    child.stdin.write('\x1bp');
    await until(() => topLine() === 'Model');
    child.stdin.write('\u0003');
    await until(() => frame().includes('Model selection cancelled'));
    child.stdin.write('/exit\r'); child.stdin.end();
    assert.equal(await exited, 0, errors);
    assert.equal(requests.length, 1);
  } else if (questionEditorCancel) {
    child.stdin.write('first task\r');await until(()=>frame().includes('Choose output'));
    child.stdin.write('n');await until(()=>frame().includes('Notes ·'));child.stdin.write('pending\u0007');
    await until(()=>fs.existsSync(editorCalls));const active=JSON.parse(fs.readFileSync(editorCalls,'utf8'))[0];
    assert.equal(active.mode,0o600);assert.match(active.terminal,/(?:^|[\s;])icanon(?:[\s;]|$)/);
    process.kill(Number(fs.readFileSync(pidFile,'utf8')),'SIGTERM');child.stdin.end();assert.equal(await exited,130,errors);
    assert.equal(fs.existsSync(active.file),false);assert.equal(fs.existsSync(path.dirname(active.file)),false);
    for(const pid of [active.pid,active.descendant])assert.throws(()=>process.kill(pid,0),{code:'ESRCH'});
    assert.equal(requests.length,1);
  } else if (questionEditor && !clarification) {
    const calls=()=>fs.existsSync(editorCalls)?JSON.parse(fs.readFileSync(editorCalls,'utf8')):[];
    const edit=async(text,index,chord='\u0007')=>{child.stdin.write(text+chord+'\r');await until(()=>calls().length===index&&frame().includes(text+' edited'));};
    child.stdin.write('first task\r');await until(()=>frame().includes('Choose output'));
    child.stdin.write('\u0007');await delay(50);assert.equal(calls().length,0);
    child.stdin.write('\x1b[Bn');await until(()=>frame().includes('Notes ·'));
    await edit('notes',1);assert.ok(frame().includes('Preview B'));assert.equal(requests.length,1);
    child.stdin.write('\r');await until(()=>frame().includes('Single Other'));
    child.stdin.write('\x1b[B\x1b[B');await edit('single',2,'\u0018\u0005');child.stdin.write('\r');
    await until(()=>frame().includes('Multi Other'));child.stdin.write(' \x1b[B\x1b[B');await edit('multi',3);
    child.stdin.write('\r');await until(()=>frame().includes('Review your answers'));child.stdin.write('\r');
    await until(()=>topLine()==='Approve this plan');
    const result=requests[1].messages.flatMap(message=>Array.isArray(message.content)?message.content:[]).find(block=>block.type==='tool_result'&&block.tool_use_id==='question');
    const value=JSON.parse(typeof result.content==='string'?result.content:result.content.map(item=>item.text??'').join(''));
    assert.deepEqual(value,{answers:[{questionIndex:0,selected:['B'],annotations:{preview:questions.questions[0].options[1].preview,notes:'notes edited'}},
      {questionIndex:1,selected:[],other:'single edited'},{questionIndex:2,selected:['Y'],other:'multi edited'}]});
    child.stdin.write('\u0003');await until(()=>frame().includes('approved.txt'));child.stdin.write('\u0003');
    await until(()=>frame().includes('cancelled.txt'));child.stdin.write('\u0003');await until(()=>frame().includes('dialogs accepted'));
    child.stdin.write('/exit\r');child.stdin.end();assert.equal(await exited,0,errors);
    assert.deepEqual(calls().map(call=>call.content),['notes','single','multi']);
    for(const call of calls()){assert.equal(call.mode,0o600);assert.match(call.terminal,/(?:^|[\s;])icanon(?:[\s;]|$)/);assert.equal(fs.existsSync(call.file),false);assert.throws(()=>process.kill(call.pid,0),{code:'ESRCH'});}
  } else if (clarification) {
    child.stdin.write('first task\r');
    await until(() => topLine() === 'Fixture choice');
    child.stdin.write('\x1b[B\r');
    await until(() => frame().includes('Choose follow-up'));
    child.stdin.write('n');
    await until(() => frame().includes('Notes'));
    child.stdin.write('clarify the layout');
    if(questionEditor){child.stdin.write('\u0007');await until(()=>frame().includes('clarify the layout edited'));}
    child.stdin.write('\x1b'); await delay(80);
    child.stdin.write('\x1b[C');
    await until(() => frame().includes('Choose tags'));
    child.stdin.write(' \x1b[B\x1b[Bextra');
    if(questionEditor){child.stdin.write('\u0007');await until(()=>frame().includes('extra edited'));}
    child.stdin.write('\x1b[B');
    await until(() => frame().includes('> Chat about this'));
    child.stdin.write('\r');
    await until(() => topLine() === 'Approve this plan');
    const result = requests[1].messages.flatMap(message => Array.isArray(message.content) ? message.content : [])
      .find(block => block.type === 'tool_result' && block.tool_use_id === 'question');
    assert.ok(result); assert.ok(!result.is_error);
    const value = JSON.parse(typeof result.content === 'string' ? result.content : result.content.map(item => item.text ?? '').join(''));
    assert.equal(value.behavior, 'deny');
    assert.ok(value.feedback.includes(`- "Choose output"\n  Answer: B\n- "Choose follow-up"\n  (No answer provided)\n  User notes: clarify the layout${questionEditor?' edited':''}\n- "Choose tags"\n  Answer: A, extra${questionEditor?' edited':''}`));
    child.stdin.write('\u0003');
    await until(() => frame().includes('approved.txt')); child.stdin.write('\u0003');
    await until(() => requests.length === 4 && frame().includes('cancelled.txt')); child.stdin.write('\u0003');
    await until(() => frame().includes('dialogs accepted'));
    child.stdin.write('/exit\r'); child.stdin.end();
    assert.equal(await exited, 0, errors);
    assert.equal(fs.existsSync(path.join(workspace, 'approved.txt')), false);
    assert.equal(fs.existsSync(path.join(workspace, 'cancelled.txt')), false);
  } else if (dialogs) {
    child.stdin.write('first task\r');
    await until(() => topLine() === 'Fixture choice');
    if (previews) {
        await until(() => frame().includes('Preview A') && frame().includes('└'));
      assert.equal(frame().includes('# Preview A'), false);
      child.stdin.write('\x1b[B');
      await until(() => frame().includes('Preview B') && /\d+ lines hidden/.test(frame()) && frame().includes('└'));
      assert.equal(frame().includes('Preview A'), false);
      child.stdin.write('\r');
    } else child.stdin.write('\x1b[B\r');
    // The source submits a single non-multi-select question immediately.

    await until(() => topLine() === 'Approve this plan');
    child.stdin.write('\x1b[B\r');
    await until(() => topLine() === 'Allow once');
    child.stdin.write('\x1b[B\r');
    await until(() => requests.length === 4 && frame().includes('cancelled.txt'));
    child.stdin.write('\u0003');
    await until(() => (line ? output : frame()).includes('dialogs accepted'));
    child.stdin.write('/exit\r'); child.stdin.end();
    assert.equal(await exited, 0, errors);
    assert.equal(requests.length, 5);
    const results = requests.at(-1).messages.flatMap(message => Array.isArray(message.content) ? message.content : [])
      .filter(block => block.type === 'tool_result');
    const content = id => {
      const block = results.find(result => result.tool_use_id === id);
      assert.ok(block, id);
      return typeof block.content === 'string' ? block.content : block.content.map(item => item.text ?? '').join('');
    };
    assert.deepEqual(JSON.parse(content('question')), { answers: [{ questionIndex: 0, selected: ['B'],
      ...(previews ? { annotations: { preview: questions.questions[0].options[1].preview } } : {}) }] });
    assert.deepEqual(JSON.parse(content('plan')), { approved: true });
    assert.equal(fs.readFileSync(path.join(workspace, 'approved.txt'), 'utf8'), 'approved B\n');
    assert.equal(fs.existsSync(path.join(workspace, 'cancelled.txt')), false);
    assert.ok(results.find(result => result.tool_use_id === 'cancel-write').is_error);
  } else {
  child.stdin.write('first task\r');
  await until(() => frame().includes('ready  finished:') && /^mouse-line-\d+$/.test(topLine()));
  const initialTop=Number(topLine().slice('mouse-line-'.length));
  assert.equal(initialTop,16); // The completed-time row now follows the twenty model rows.
  child.stdin.write('draft\x1b[<64;2;');
  await delay(30); child.stdin.write('3M');
  await until(() => topLine() === `mouse-line-${initialTop-1}`);
  child.stdin.write('\x1b[M' + String.fromCharCode(97, 34, 35));
  await until(() => topLine() === `mouse-line-${initialTop}`);
  child.stdin.write('\u000f');
  await until(() => frame().includes('ctrl+o chat'));
  child.stdin.write('k'); await until(() => topLine() === `mouse-line-${initialTop-1}`);
  child.stdin.write('j'); await until(() => topLine() === `mouse-line-${initialTop}`);
  child.stdin.write('\u0005q');
  await until(() => frame().includes('ctrl+o transcript'));
  assert.ok(output.includes('\x1b[?1002h'));
  // Model rows now have the recovered two-cell speaker gutter; select the same body span.
  child.stdin.write('\x1b[<0;3;1M\x1b[<32;7;1M\x1b[<0;7;9m');
  await until(() => [2, 3, 4, 5, 6].every(column => screen.cell(column, 0)?.isInverse()));
  assert.equal(screen.lines()[0].slice(2, 7), 'mouse');
  child.stdin.write('\x1b[1;2C\x1b[99;6u');
  await until(() => output.includes(`\x1b]52;c;${Buffer.from('mouse-').toString('base64')}`));
  // Start at the body again after copy clears the selection; a distant click resets its sequence.
  child.stdin.write('\x1b[<0;30;2M\x1b[<0;30;2m\x1b[<0;3;1M\x1b[<0;3;1m\x1b[1;2C\x1bc');
  await until(() => output.includes(`\x1b]52;c;${Buffer.from('mo').toString('base64')}`));
  child.stdin.write('\x1b[<0;2;3M\x1b[<0;2;3m\r');
  await until(() => frame().includes('draft accepted'));
  child.stdin.write('/exit\r'); child.stdin.end();
  assert.equal(await exited, 0, errors);
  assert.equal(requests.length, 2);
  const message = requests[1].messages.filter(item => item.role === 'user').at(-1);
  assert.ok(JSON.stringify(message).includes('draft'));
  assert.equal(JSON.stringify(message).includes('[<'), false);
  assert.equal(JSON.stringify(message).includes('[M'), false);
  }
  if (line) assert.equal(output.includes('\x1b[?1049h'), false);
  else {
    assert.ok(output.includes('\x1b[?1049h') && output.includes('\x1b[?1049l'));
    assert.ok(output.includes('\x1b[?1006l'));
  }
  const files = fs.readdirSync(path.join(workspace, '.agent'));
  assert.equal(files.some(file => file.endsWith('.lock')), false);
  const journal = files.find(file => file.endsWith('.jsonl'));
  assert.ok(journal);
  const journalText = fs.readFileSync(path.join(workspace, '.agent', journal), 'utf8');
  assert.equal(journalText.includes('owned-mouse-fixture'), false);
  if (editing) {
    const records = journalText.trim().split('\n').map(JSON.parse);
    const submitted = records.filter(event => event.kind === 'message' && event.message.role === 'user')
      .map(event => event.message.content).filter(content => typeof content === 'string');
    assert.deepEqual(submitted, folding ? ['one\ntwo\nthree\nfour','one\ntwo\nthree\nfour','one\ntwo\nthree\nfour',
      'é👩‍💻    A\nB\nC','[Pasted text #7]one\ntwo\nthree\nfour','[Pasted text #7]one\ntwo\nthree\nfour',
      '[Pasted text #10 +3 lines]','one\ntwo\nthree\nfour'] : undoing ? ['undo base', 'é\u{1f469}‍\u{1f4bb}?中', 'first',
      'line one\nline two', 'pending base'] : killing ? ['alpha beta gamma', 'one beta gamma-', 'ab\ncd',
      'é\u{1f469}‍\u{1f4bb}!中', 'é\u{1f469}‍\u{1f4bb}!中']
      : ['ZabcdefgXhijklmnopqrstuvwx0123456789ABYCDEFGHIJ',
        'é\u{1f469}‍\u{1f4bb}!中', 'one twoX-three', 'Z[Pasted text #1 +3 lines]', 'first\nsecon!d']);
    assert.equal(records.filter(event => event.kind === 'turn_end').length, folding ? 8 : 5);
  }
  if (pacing) {
    const records = journalText.trim().split('\n').map(text => JSON.parse(text));
    assert.deepEqual(records.filter(event => event.kind === 'turn_end').map(event => event.reason),
      ['end_turn', 'aborted', 'end_turn', 'aborted']);
    assert.equal(pacingStreams.size, 0);
    assert.ok(output.includes('\x1b[?2004l') && output.includes('\x1b[?25h'));
  }
  console.log(JSON.stringify(questionEditorCancel ? {tuiQuestionEditorCancel:'passed',exitCode:130,descendantsReaped:true,privateTemporaryFiles:true} :{ ...(diffPanel ? { tuiDiffPanel: 'passed', commandToggles: true,
    nativeSourceComponent: true, baseSwitch: true, sidebarWheel: true, closeClick: true, draftPreserved: true,
    nativeSelection: true, clipboardExact: true, selectionAttachment: true } : {}), ...(statusLineMode?{tuiStatusLine:'passed',sourceCoalescing:true,periodicRefresh:true,multilineANSI:true,
    modePayload:true,usagePayload:true,draftSubmissionExact:true,modalPauses:true,reloadChanges:true,resumePinned:true,
    removalStops:true,pendingChildReaped:true,exitCode:130,narrow}:{}), ...(terminalFocus?{tuiTerminalFocus:'passed',fragmentedReports:true,sourceVisualInverse:true,
    keyboardAndPasteRegain:true,foldedRawRetained:true,modalOwnerRetained:true,remapRetained:true,preciseSubmission:true,
    focusModesRestored:true,pendingBlurClose:true,exitCode:130}:{}), ...(confirmingInput?{tuiInputGestures:'passed',source800ms:true,firstClear:true,expiryClearsHint:true,
    ctrlDDeletesNonempty:true,doubleEscapeHistory:true,foldedRawRetained:true,vimEscapeRetained:true,confirmedExit:true,exactSubmission:true,exitCode:0}:{}), ...(returnEditing?{tuiReturnGesture:'passed',sourceBackslashPrecedence:true,caretMiddle:true,modifiedReturns:true,
    atomicUndo:true,rawUnicode:true,foldedPayload:true,vimDotRepeat:true,searchContextRestored:!line,exactSubmission:true,pendingClose:true,exitCode:130}:{}), ...(vimEditing?{tuiVim:'passed',sourceModes:true,visualInverseCells:true,countOperators:true,dotRepeat:true,
    twoKeyRemaps:true,rawUnicode:true,foldedRegister:true,undo:true,reloadRemoves:true,resumePinned:true,settingSaves:true,
    vimCommandRedirect:true,chooserCancellationContinues:true,invalidSettingFallback:true,exactSubmission:true,pendingClose:true,exitCode:130}:{}), ...(externalEditing?{tuiExternalEditor:'passed',sourceExpandRefold:true,undoRestoresDraft:true,
    failureRetainsDraft:true,cookedChildInput:true,modeHandoff:true,exactSubmission:true,chordBinding:!line,
    privateTemporaryFiles:true,pendingChildReaped:true,descendantsReaped:true,sameBatchSubmitSuppressed:true,exitCode:130}:{}), ...(progressSettings ? {tuiProgressSettings:'passed',sourceWords:true,appendAndEmptyFallback:true,
    utcPreset:true,customPattern:true,timeZone:true,invalidFallback:true,pinnedUntilReload:true,cacheReflow:true,
    resumeRestores:true,removedSettingResets:true,draftPreserved:true,durableTiming:true,pendingClose:true,narrow,exitCode:130} : {}), ...(thinkingProgress ? {tuiThinkingProgress:'passed',animationFrames:true,sourceShimmer:true,
    elapsedThinking:true,completionTime:true,taskSummary:true,liveTaskMutation:true,draftPreserved:true,
    failureRecovery:true,cancelStopsClock:true,pendingClose:true,durableTiming:true,settingsReload:true,resumeRestores:true,narrow,exitCode:130} : {}), ...(themeEditor ? { tuiThemeEditor:'passed', sourceColorComponents:true, createSelects:true, livePreview:true,
    cancelValuePreservesFile:true, invalidValueStaysEditing:true, autoSave:true, tabReset:true, editShortcut:true,
    pluginForkPreservesOriginal:true, savePreservesFields:true, resumeRestoresPinned:true, reloadRefresh:true,
    draftSubmissionExact:true, rawMessagesComplete:true, pendingPreviewClose:true, exitCode:130 } : {}), ...(pluginTheme ? { tuiPluginTheme: 'passed', sourceNamespace: true,
    explicitActivation: true, updatePinnedUntilReload: true, disabledFallback: true, resumeRestoresPinned: true,
    originShown: true, previewCancelRestores: true, savePreservesFields: true, reloadRefresh: true,
    integrityFailurePreservesSession: true, draftSubmissionExact: true, streamedAndFinalColors: true,
    rawMessagesComplete: true, exitCode: 130 } : {}), ...(customTheme ? { tuiCustomTheme: 'passed', sourceOverrideFilter: true,
    hotEditRefresh: true, invalidRemovesTheme: true, deleteFallback: true, recreateRestores: true,
    draftSubmissionExact: true, customPicker: true, previewCancelRestores: true, savePreservesFields: true,
    resumeRestoresPinned: true, reloadRefresh: true, streamedAndFinalColors: true, rawMessagesComplete: true,
    pendingClose: true, exitCode: 130 } : {}), ...(systemTheme ? { tuiSystemTheme: 'passed', muxFallback: systemThemeMux,
    fragmentedResponse: true, themeNotificationRequeries: true, draftSubmissionExact: true,
    explicitThemeStopsQuery: true, autoRestoresCache: true, previewCancelRestores: true,
    pendingClose: true, exitCode: 130, responseTextAbsentFromJournal: true } : {}),
    ...(theming ? { tuiThemeSetting: 'passed', focusPreview: true, cancelRestores: true,
    savePreservesFields: true, failedSavePreservesFileAndSession: true, resumeRestoresPinned: true,
    reloadRefresh: true, autoEnvironmentFallback: true, restartReadsSaved: true,
    phaseColors: [11647481, 5728759, 11647481, 5728759, 5728759], streamedAndFinalColors: true,
    rawMessagesComplete: true } : {}), ...(highlighting ? { tuiHighlightSetting: 'passed', pinnedUntilReload: true,
    reloadRefresh: true, resumeRestoresPinned: true, removedSettingResets: true,
    disabledPhases: [true, true, false, true, false], streamedAndFinalStyles: true,
    sourceLanguageLabel: true, headingStyleRetained: true, rawMessagesComplete: true } : {}),
    ...(proseWidth ? { tuiProseWidth: 'passed', pinnedUntilReload: true,
    reloadRefresh: true, resumeRestoresPinned: true, removedSettingResets: true, invalidSettingResets: true,
    proseRows: [3, 3, 2, 3, 1, 1], streamedAndFinalWidths: true, codeAndTableFullWidth: true,
    rawMessagesComplete: true } : {}), ...(visibility ? { tuiVisibility: 'passed', reducedMotion: true, windowsTerminal,
    pinnedUntilReload: true, reloadRefresh: true, resumeRestoresPinned: true, removedSettingResets: true,
    finalBodiesComplete: true, heldIntervals: true } : {}), ...(pacing ? { tuiPacing: 'passed', phaseHandshake: true,
    hiddenTrailingLine: true, completionFlush: true, cancellationFlush: true, fastCompletion: true,
    failureFlush: true, pendingClose: true, noDelayedRepaint: true,
    ...(inputClose ? { fatalInputCancelsProvider: true, exitCode: 0, inputCloseFixture: 'owned Node preload stream error' } : {}), pacingFrames } : {}),
    ...(streamingChunks ? { tuiStreamingChunks: 'passed', frozenPrefix: true,
    openFence: true, sourceChars: messageText.length } : {}), ...(messages ? { tuiMessages: 'passed', cumulativeStream: true,
    markdownRendered: true, ...(!streamingChunks && !pacing && !visibility && !proseWidth && !highlighting && !theming && !systemTheme && !customTheme && !pluginTheme && !themeEditor && !thinkingProgress && !progressSettings ? { sourceHeadingStyle: true, sourceCodeHighlight: true } : {}), responseBoundaries: true, narrow } : diffPanel || externalEditing || vimEditing || returnEditing || confirmingInput || terminalFocus || statusLineMode ? {} : folding ? {tuiFoldPaste:'passed',sourceThresholds:true,exactExpandedSubmit:true,repeatedPasteExpands:true,
    undoRetainsPayload:true,historyRetainsPayload:true,rawHistorySearch:true,deletedPayloadReleased:true,killCancelYankRaw:true,
    literalIdsAvoided:true,unicodeAndCR:true,
    stashRetainsPayload:!line,pendingClose:true,exitCode:130,durableSubmissionMatched:true} : undoing ? { tuiUndo: 'passed', debounceSnapshots: true, cursorRestored: true,
    undoBranchTruncated: true, submitResets: true, rawUnicode: true, multilinePaste: true, pendingClose: true,
    exitCode: 130, durableSubmissionMatched: true } : killing ? { tuiKillRing: 'passed', killCoalescing: true, yankHead: true,
    yankPopCycle: true, yankSpanInterrupted: true, newlineKill: true, rawUnicode: true, wholePlaceholder: true,
    retainedAcrossTurns: true, durableSubmissionMatched: true } : editing ? { tuiEditing: 'passed', visualRowNavigation: true,
    logicalLineCommands: true, historyRestored: true, rawUnicode: true, readlineWords: true, placeholderStep: true,
    multilinePaste: true, durableSubmissionMatched: true } : actions ? { tuiActions: 'passed', modelPicker: true, thinking: true,
    tasks: true, stash: true, pickerCancelled: true, draftPreserved: true } : clarification ? {
    tuiClarification: 'passed', question: true, permissionCancelled: true, fileEffectsAbsent: true } : dialogs ? {
    tuiDialogs: 'passed', question: true, plan: true,
    permissionApproved: true, permissionCancelled: true, fileEffectsVerified: true } : {
    tuiMouse: 'passed', transcriptKeys: true, splitSgrWheel: true, x10Wheel: true,
    pointerSelection: true, keyboardExtension: true, osc52PayloadVerified: true, draftUnchanged: true }),
    ...(previews ? { choicePreview: true, markdownRendered: !line, markdownSourceShown: line, hiddenLines: !line, narrow } : {}),
    ...(clarification ? { clarificationFeedback: true, notesPreserved: true, nextModelRequestVerified: true } : {}),
    compiled: true, installedCLI: cliIndex >= 0, defaultTui: !line, lineInput: line, modesRestored: true, locksReleased: true,
    modelCalls: requests.length, provider: 'owned loopback SSE', paidUpstreamCalls: 0 }));
} finally {
  clearTimeout(timer); if (child.exitCode === null) { killFixture(); await exited; }
  await new Promise(resolve => server.close(resolve));
  screen.close();
  fs.rmSync(temporary, { recursive: true, force: true });
}
