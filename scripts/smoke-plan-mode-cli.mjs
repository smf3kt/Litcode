import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { TerminalScreen } from './terminal-screen.mjs';

const root = path.resolve(import.meta.dirname, '..');
const directory = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : root, 'plan-mode-cli-')));
const workspace = path.join(directory, 'workspace'), userDir = path.join(directory, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(userDir);
fs.writeFileSync(path.join(userDir, 'settings.json'), JSON.stringify({ prefersReducedMotion: true, promptSuggestionEnabled: false }));
const plan = '# Owned plan\n\nWrite the fixture result and verify its bytes.\n';
const editing = process.argv.includes('--editor'), cancelling = process.argv.includes('--cancel'), denying = process.argv.includes('--deny');
const inline = process.argv.includes('--inline'), images = process.argv.includes('--images');
const image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PzWvWQAAAABJRU5ErkJggg==';
const imageBlock = { type: 'image', source: { type: 'base64', media_type: 'image/png', data: image } };
const preload = path.join(directory, 'clipboard.mjs');
if (images) fs.writeFileSync(preload, `import cp from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';
const original=cp.spawn;cp.spawn=function(command,args,options){
if(command==='/usr/bin/osascript'&&args?.[0]==='-e'&&args[1]==='the clipboard as \\u00abclass PNGf\\u00bb')
return original(process.execPath,['-e',${JSON.stringify(`process.stdout.write(${JSON.stringify(`«data PNGf${Buffer.from(image, 'base64').toString('hex')}»\n`)})`)}],options);
return original(command,args,options);};syncBuiltinESMExports();`);
const editedPlan = plan + '\nReviewer edit retained.\n';
const editor = path.join(directory, 'editor.cjs');
fs.writeFileSync(editor, `require('node:fs').writeFileSync(process.argv.at(-1), ${JSON.stringify(editedPlan)});`);
const requests = [];
let phase = 'plan', step = 0, planFile, failure, rejectedReview = false, imageReviews = 0;
const boundaryNames = ['legacy', 'managed', 'headless', 'child'];
function send(response, block) {
  const tool = block.type === 'tool_use';
  const events = [
    ['message_start', { type: 'message_start', message: { id: 'plan', type: 'message', role: 'assistant', model: 'fixture', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } }],
    ['content_block_start', { type: 'content_block_start', index: 0, content_block: tool ? { ...block, input: {} } : { type: 'text', text: '' } }],
    ['content_block_delta', { type: 'content_block_delta', index: 0, delta: tool ? { type: 'input_json_delta', partial_json: JSON.stringify(block.input) } : { type: 'text_delta', text: block.text } }],
    ['content_block_stop', { type: 'content_block_stop', index: 0 }],
    ['message_delta', { type: 'message_delta', delta: { stop_reason: tool ? 'tool_use' : 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } }],
    ['message_stop', { type: 'message_stop' }],
  ];
  response.writeHead(200, { 'content-type': 'text/event-stream' });
  response.end(events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join(''));
}
const server = http.createServer(async (request, response) => {
  try {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8')); requests.push(body);
    const result = body.messages.flatMap(message => Array.isArray(message.content) ? message.content : []).findLast(block => block.type === 'tool_result');
    const call = (name, input = {}) => send(response, { type: 'tool_use', id: `${phase}-${step}`, name, input });
    const systemText = typeof body.system === 'string' ? body.system : body.system.map(block => block.text).join('\n');
    if (phase === 'rewind') {
      if (step++ === 0) {
        assert.equal(systemText.includes('Plan mode is active'), false);
        send(response, { type: 'text', text: 'REWIND_FIRST' });
      } else if (step === 2) call('enter_plan_mode');
      else { assert.equal(result?.is_error ?? false, false); send(response, { type: 'text', text: 'REWIND_PLANNED' }); }
      return;
    }
    if (phase === 'rewound') {
      assert.equal(systemText.includes('Plan mode is active'), false, 'Earlier history must not retain a later plan mode');
      assert.equal(body.messages.some(message => message.role === 'user' && message.content === 'REWIND_PLAN'), false);
      send(response, { type: 'text', text: 'REWIND_RESTORED' }); return;
    }
    if (phase === 'resume') {
      if (images) assert.deepEqual(body.messages.flatMap(message => Array.isArray(message.content) ? message.content : [])
        .filter(block => block.type === 'image'), [imageBlock, imageBlock]);
      assert.equal(body.tools.some(tool => tool.name === 'enter_plan_mode'), true);
      assert.equal(systemText.includes('Plan mode is active'), false);
      send(response, { type: 'text', text: 'PLAN_RESUMED' }); return;
    }
    if (phase === 'reload') {
      assert.equal(body.tools.some(tool => tool.name === 'enter_plan_mode'), false);
      send(response, { type: 'text', text: 'PLAN_RELOADED' }); return;
    }
    if (boundaryNames.includes(phase)) {
      if (phase === 'child' && body.messages.some(message => message.role === 'user' && message.content === 'PLAN_CHILD')) {
        const lastChild = body.messages.flatMap(message => Array.isArray(message.content) ? message.content : []).findLast(block => block.type === 'tool_result');
        if (!lastChild) call('enter_plan_mode');
        else { assert.equal(lastChild.is_error, true); assert.match(String(lastChild.content), /Only the main session/); send(response, { type: 'text', text: 'CHILD_BLOCKED' }); }
        return;
      }
      if (step++ === 0) {
        if (phase === 'legacy' || phase === 'managed') {
          assert.equal(body.tools.some(tool => tool.name === 'enter_plan_mode'), false);
          send(response, { type: 'text', text: 'BOUNDARY_DONE' });
        } else if (phase === 'headless') call('exit_plan_mode');
        else call('agent', { prompt: 'PLAN_CHILD', mode: 'general' });
      } else {
        if (phase === 'headless') { assert.equal(result?.is_error, true); assert.match(String(result.content), /host review callback is missing/); }
        if (phase === 'child') { assert.equal(result?.is_error ?? false, false); assert.ok(String(result.content).includes('CHILD_BLOCKED')); }
        send(response, { type: 'text', text: 'BOUNDARY_DONE' });
      }
      return;
    }
    if (phase === 'blank') {
      if (step++ === 0) call('enter_plan_mode');
      else if (step === 2) call('exit_plan_mode');
      else { assert.match(String(result?.content), /approved exiting plan mode/); send(response, { type: 'text', text: 'BLANK_DONE' }); }
      return;
    }
    switch (step++) {
      case 0:
        assert.ok(body.tools.some(tool => tool.name === 'enter_plan_mode'), 'Fresh CLI must expose source plan tools');
        call('enter_plan_mode'); break;
      case 1: {
        assert.equal(result?.is_error ?? false, false, JSON.stringify(result));
        assert.match(String(result.content), /Entered plan mode/);
        const system = typeof body.system === 'string' ? body.system : body.system.map(block => block.text).join('\n');
        const match = /^Plan file: (".*")$/m.exec(system); assert.ok(match, 'Plan reminder must name the owned file');
        planFile = JSON.parse(match[1]);
        assert.ok(planFile.startsWith(path.join(userDir, 'plans') + path.sep));
        call('write_file', { path: planFile, content: plan }); break;
      }
      case 2:
        assert.equal(result?.is_error ?? false, false, JSON.stringify(result));
        assert.equal(fs.readFileSync(planFile, 'utf8'), plan);
        call('write_file', { path: 'during-plan.txt', content: 'must remain absent\n' }); break;
      case 3:
        assert.equal(result?.is_error, true); assert.equal(fs.existsSync(path.join(workspace, 'during-plan.txt')), false);
        call('exit_plan_mode'); break;
      case 4:
        if (images && imageReviews < 2) {
          assert.equal(result?.is_error, true);
          assert.match(String(result.content), imageReviews === 0 ? editing ? /Retain image feedback/ : /\(See attached image\)/ : /Add image verification/);
          const content = body.messages.at(-1)?.content; assert.ok(Array.isArray(content));
          assert.deepEqual(content.filter(block => block.type === 'image'), [imageBlock]);
          assert.equal(String(result.content).includes(image), false);
          assert.match(systemText, /Plan mode is active/);
          assert.equal(fs.existsSync(path.join(workspace, 'approved.txt')), false);
          imageReviews++; step--; call('exit_plan_mode'); break;
        }
        if ((cancelling || denying) && !rejectedReview) {
          assert.equal(result?.is_error, true);
          if (denying) assert.match(String(result.content), /Add verification/);
          const system = typeof body.system === 'string' ? body.system : body.system.map(block => block.text).join('\n');
          assert.match(system, /Plan mode is active/);
          rejectedReview = true; step--; call('exit_plan_mode'); break;
        }
        assert.equal(result?.is_error ?? false, false, JSON.stringify(result));
        assert.match(String(result.content), /User has approved your plan/); assert.ok(String(result.content).includes(editing ? editedPlan : plan));
        if (editing && !images) assert.match(String(result.content), /Approved Plan \(edited by user\)/);
        if (editing && images) assert.ok(String(result.content).includes('## Approved Plan:\n' + editedPlan));
        call('write_file', { path: 'approved.txt', content: 'approved plan\n' }); break;
      case 5:
        if (images) assert.deepEqual(body.messages.at(-1).content.filter(block => block.type === 'image'), []);
        assert.equal(result?.is_error ?? false, false, JSON.stringify(result));
        assert.equal(fs.readFileSync(path.join(workspace, 'approved.txt'), 'utf8'), 'approved plan\n');
        send(response, { type: 'text', text: 'PLAN_MODE_DONE' }); break;
      default: throw new Error('Unexpected fixture request');
    }
  } catch (error) {
    failure = error; send(response, { type: 'text', text: 'PLAN_FIXTURE_FAILED' });
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, HOME: directory, TERM: 'xterm-256color', HARNESS_LOOP_KEEPALIVE: 'off',
  VISUAL: `${process.execPath} ${editor}`, EDITOR: `${process.execPath} ${editor}` };
for (const key of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(key)) delete env[key];
Object.assign(env, { LLM_API_KEY: 'owned-plan-fixture', LLM_MODEL: 'fixture', LLM_AUTH: 'bearer', LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false' });
const screen = new TerminalScreen(120, 38);
const pty = path.join(directory, 'pty.exp');
fs.writeFileSync(pty, `set stty_init "rows 38 columns 120"\nsource {${path.join(root, 'scripts/pty-cli.exp')}}\n`);
let child, exit, closed = true, errors = '', processText = '';
function launch(args) {
  closed = false; errors = ''; processText = ''; screen.write('\x1bc');
  child = spawn('/usr/bin/expect', [pty, process.execPath, ...(images ? ['--import', preload] : []), path.join(root, 'bin/litcode.mjs'), '--workspace', workspace,
    '--no-inherit-gateway', ...args], { cwd: root, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
  child.stdout.setEncoding('utf8'); child.stdout.on('data', text => { screen.write(text); processText += text; });
  child.stderr.on('data', text => { errors += text; });
  exit = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', code => { closed = true; resolve(code); }); });
}
const interactiveArgs = ['--interactive', ...(inline ? ['--no-tui'] : [])];
launch(['--user-dir', userDir, ...interactiveArgs]);
const frame = () => screen.lines().join('\n');
async function until(check, label) {
  const deadline = Date.now() + 10000;
  while (!check()) {
    if (failure) throw failure;
    assert.equal(closed, false, errors); assert.ok(Date.now() < deadline, `${label}\n${frame()}\n${errors}`); await delay(20);
  }
  if (failure) throw failure;
}
try {
  await until(() => inline ? frame().includes('>') : frame().includes('ready'), 'startup'); child.stdin.write('PLAN_BEGIN\r');
  await until(() => inline ? frame().includes('Choose a number') : frame().includes('Ready to code?'), 'file-backed plan approval');
  assert.ok(frame().includes('Owned plan'));
  const attachments = path.join(workspace, '.harness', 'attachments');
  const captured = () => fs.existsSync(attachments) && fs.readdirSync(attachments).length === 1;
  if (images) {
    for (let review = 0; review < 2; review++) {
      child.stdin.write('\x1b[B\x1b[B\x16');
      await until(captured, 'plan image captured');
      await until(() => frame().includes('[Image #'), 'plan image label');
      if (review === 0) {
        child.stdin.write('\x7f'); await until(() => fs.readdirSync(attachments).length === 0, 'plan image removed');
        child.stdin.write('\x16'); await until(captured, 'plan image restored');
        if (editing) {
          child.stdin.write('Retain image feedback'); child.stdin.write('\x07');
          await until(() => fs.readFileSync(planFile, 'utf8') === editedPlan && frame().includes('Reviewer edit retained.'), 'plan editor with image feedback');
          child.stdin.write('\x1b[B\x1b[B');
          await until(() => frame().includes('[Image #') && frame().includes('Retain image feedback'), 'image and text retained through editor');
        }
      } else child.stdin.write('Add image verification');
      child.stdin.write('\r');
      await until(() => imageReviews === review + 1 && frame().includes('Ready to code?'), 'plan image feedback retry');
      await until(() => fs.readdirSync(attachments).length === 0, 'plan image feedback cleanup');
    }
    child.stdin.write('\x1b[B\x1b[B\x16'); await until(captured, 'image before approval');
    child.stdin.write('\x1b[A\x1b[A');
  }
  if (cancelling || denying) {
    child.stdin.write(denying ? 'Add verification\r' : '\x1b');
    await until(() => rejectedReview && (inline ? frame().includes('Choose a number') : frame().includes('Ready to code?')), 'plan review retry');
  }
  if (editing && !images) {
    child.stdin.write(inline ? 'edit\r' : '\x07');
    await until(() => fs.readFileSync(planFile, 'utf8') === editedPlan && frame().includes('Reviewer edit retained.'), 'external plan editor');
  }
  child.stdin.write(inline ? '1\r' : editing ? '\x1b[Z' : '\r');
  await until(() => frame().includes('PLAN_MODE_DONE') && (inline ? frame().includes('finished:') : frame().includes('ready')), 'implementation after approval');
  const journals = fs.readdirSync(path.join(workspace, '.agent')).filter(name => name.endsWith('.jsonl'));
  const records = journals.flatMap(name => fs.readFileSync(path.join(workspace, '.agent', name), 'utf8').trim().split('\n').map(JSON.parse));
  assert.ok(records.some(record => record.kind === 'tool_result' && record.host?.kind === 'plan' && record.host.operation === 'exit'));
  if (images) {
    assert.deepEqual(records.filter(record => record.kind === 'tool_result' && record.feedbackBlocks?.length)
      .map(record => record.feedbackBlocks), [[imageBlock], [imageBlock]]);
    assert.deepEqual(fs.readdirSync(attachments), []);
  }
  if (editing && !images) assert.ok(records.some(record => record.host?.kind === 'plan' && record.host.planWasEdited === true && record.host.plan === editedPlan));
  if (editing && images) assert.ok(records.some(record => record.host?.kind === 'plan' && record.host.operation === 'exit'
    && record.host.planWasEdited === undefined && record.host.plan === editedPlan));
  child.stdin.write('/exit\r'); assert.equal(await Promise.race([exit, delay(5000).then(() => -1)]), 0, errors);
  assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.endsWith('.lock')), false);
  const active = records.find(record => record.kind === 'metadata'); assert.ok(active);
  const original = fs.readFileSync(path.join(workspace, '.agent', `${active.id}.jsonl`));
  fs.writeFileSync(path.join(userDir, 'settings.json'), JSON.stringify({ prefersReducedMotion: true,
    promptSuggestionEnabled: false, features: { sourcePlanTools: false } }));
  phase = 'resume'; launch(['--resume', active.id, ...interactiveArgs]);
  await until(() => inline ? frame().includes('>') : frame().includes('ready'), 'original resume startup');
  assert.deepEqual(fs.readFileSync(path.join(workspace, '.agent', `${active.id}.jsonl`)), original);
  child.stdin.write('PLAN_RESUME_CHECK\r');
  await until(() => frame().includes('PLAN_RESUMED') && (inline ? frame().includes('finished:') : frame().includes('ready')), 'pinned plan catalog on resume');
  phase = 'reload'; child.stdin.write('/reload\r');
  await until(() => /Local configuration reloa/i.test(frame()) || /reloaded/i.test(frame()), 'explicit catalog reload'); child.stdin.write('PLAN_RELOAD_CHECK\r');
  await until(() => frame().includes('PLAN_RELOADED') && (inline ? frame().includes('finished:') : frame().includes('ready')), 'reloaded legacy catalog');
  child.stdin.write('/exit\r'); assert.equal(await Promise.race([exit, delay(5000).then(() => -1)]), 0, errors);
  for (const name of boundaryNames) {
    phase = name; step = 0;
    const boundaryUser = path.join(directory, `user-${name}`); fs.mkdirSync(boundaryUser);
    fs.writeFileSync(path.join(boundaryUser, 'settings.json'), JSON.stringify({ features: { sourcePlanTools: name !== 'legacy' },
      ...(name === 'headless' ? { permissions: { mode: 'plan', allow: [], deny: [] } } : {}) }));
    const managed = path.join(directory, 'managed.json');
    if (name === 'managed') fs.writeFileSync(managed, JSON.stringify({ features: { sourcePlanTools: false } }));
    launch(['--user-dir', boundaryUser, ...(name === 'managed' ? ['--managed-settings', managed] : []), 'PLAN_BOUNDARY']);
    assert.equal(await Promise.race([exit, delay(10000).then(() => -1)]), 0, `${name}\n${errors}\n${processText}`);
    if (failure) throw failure;
    assert.ok(processText.includes('BOUNDARY_DONE'), `${name}\n${processText}`);
    assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(file => file.endsWith('.lock')), false);
  }
  phase = 'blank'; step = 0;
  const blankUser = path.join(directory, 'user-blank'); fs.mkdirSync(blankUser);
  fs.writeFileSync(path.join(blankUser, 'settings.json'), JSON.stringify({ prefersReducedMotion: true, promptSuggestionEnabled: false }));
  launch(['--user-dir', blankUser, ...interactiveArgs]);
  await until(() => inline ? frame().includes('>') : frame().includes('ready'), 'blank-plan startup'); child.stdin.write('BLANK_BEGIN\r');
  await until(() => inline ? frame().includes('Choose a number') : frame().includes('Exit plan mode?'), 'empty plan confirmation');
  child.stdin.write(inline ? '1\r' : '\r');
  await until(() => frame().includes('BLANK_DONE') && (inline ? frame().includes('finished:') : frame().includes('ready')), 'empty plan approved');
  child.stdin.write('/exit\r'); assert.equal(await Promise.race([exit, delay(5000).then(() => -1)]), 0, errors);
  assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.endsWith('.lock')), false);
  phase = 'rewind'; step = 0;
  const rewindUser = path.join(directory, 'user-rewind'); fs.mkdirSync(rewindUser);
  fs.writeFileSync(path.join(rewindUser, 'settings.json'), JSON.stringify({ prefersReducedMotion: true, promptSuggestionEnabled: false }));
  launch(['--user-dir', rewindUser, ...interactiveArgs]);
  await until(() => inline ? frame().includes('>') : frame().includes('ready'), 'rewind startup');
  child.stdin.write('REWIND_FIRST\r');
  await until(() => frame().includes('REWIND_FIRST') && (inline ? frame().includes('finished:') : frame().includes('ready')), 'first rewind turn');
  child.stdin.write('REWIND_PLAN\r');
  await until(() => frame().includes('REWIND_PLANNED') && (inline ? frame().includes('finished:') : frame().includes('ready')), 'plan before rewind');
  const planJournal = fs.readdirSync(path.join(workspace, '.agent')).filter(file => file.endsWith('.jsonl'))
    .find(file => fs.readFileSync(path.join(workspace, '.agent', file), 'utf8').includes('REWIND_PLAN'));
  assert.ok(planJournal);
  const planId = planJournal.slice(0, -6);
  child.stdin.write('/rewind 1\r');
  let rewindId;
  await until(() => {
    const branch = fs.readdirSync(path.join(workspace, '.agent')).filter(file => file.endsWith('.jsonl')).find(file => {
      const rows = fs.readFileSync(path.join(workspace, '.agent', file), 'utf8').trim().split('\n').map(JSON.parse);
      return rows.some(row => row.kind === 'branch' && row.source === planId && row.reason === 'rewind');
    });
    rewindId = branch?.slice(0, -6);
    return rewindId !== undefined && frame().includes(rewindId.slice(0, 8)) && (inline ? frame().includes('>') : frame().includes('ready'));
  }, 'earlier conversation branch');
  phase = 'rewound'; child.stdin.write('REWIND_CHECK\r');
  await until(() => frame().includes('REWIND_RESTORED') && (inline ? frame().includes('finished:') : frame().includes('ready')), 'live rewind mode');
  child.stdin.write('/exit\r'); assert.equal(await Promise.race([exit, delay(5000).then(() => -1)]), 0, errors);
  launch(['--resume', rewindId, ...interactiveArgs]);
  await until(() => inline ? frame().includes('>') : frame().includes('ready'), 'cold rewind startup');
  child.stdin.write('REWIND_COLD_CHECK\r');
  await until(() => frame().includes('REWIND_RESTORED') && (inline ? frame().includes('finished:') : frame().includes('ready')), 'cold rewind mode');
  child.stdin.write('/exit\r'); assert.equal(await Promise.race([exit, delay(5000).then(() => -1)]), 0, errors);
  assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.endsWith('.lock')), false);
  console.log(JSON.stringify({ planMode: 'passed', requests: requests.length, planFile: true, ordinaryWriteBlocked: true,
    approvedEffect: true, typedHost: true, editor: editing, denied: denying, cancelled: cancelling, inline,
    originalResume: true, reload: true, legacy: true, managed: true, headlessMissingCallback: true, childAuthority: true,
    blankPlan: true, preEntryRewind: true, coldRewind: true, imageReviews, images, externalCalls: 0 }));
} finally {
  if (!closed) { try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; } await exit; }
  screen.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); fs.rmSync(directory, { recursive: true, force: true });
}
