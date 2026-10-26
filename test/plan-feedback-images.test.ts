import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import type { Terminal } from '@xterm/headless';
import { PassThrough, Writable } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import { Agent, assertPaired, defaultConfig } from '../src/agent.js';
import { Session } from '../src/session.js';
import { createInteractionTools } from '../src/interaction-tools.js';
import { createTools, type ToolContext } from '../src/tools.js';
import { ToolFeedbackError } from '../src/tool-feedback.js';
import { readPlanFile, savePlanFile } from '../src/plan-file.js';
import { TuiTerminal } from '../src/tui.js';
import type { ClipboardSpawn } from '../src/clipboard.js';
import type { TerminalPromptRequest } from '../src/terminal.js';
import type { ModelProvider } from '../src/provider.js';

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PzWvWQAAAABJRU5ErkJggg==';
const image: Anthropic.ImageBlockParam = { type: 'image', source: { type: 'base64', media_type: 'image/png', data: png } };
const text: Anthropic.TextBlockParam = { type: 'text', text: '[Image could not be processed: Image file is empty (0 bytes)]' };
const temporary = () => fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'plan-feedback-test-')));
function reply(content: Anthropic.ContentBlock[], stop: 'tool_use' | 'end_turn'): Anthropic.Message {
  return { id: 'fixture', model: 'fixture', role: 'assistant', type: 'message', content, stop_reason: stop,
    stop_sequence: null, container: null, diagnostics: null, stop_details: null,
    usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
      cache_creation: null, inference_geo: null, output_tokens_details: null, server_tool_use: null, service_tier: null } };
}
const call = (id: string, name: string): Anthropic.ToolUseBlock => ({ type: 'tool_use', id, name, input: {}, caller: { type: 'direct' } });
const done = () => reply([{ type: 'text', text: 'done', citations: null }], 'end_turn');
async function until(check: () => boolean, label: string) {
  const deadline = Date.now() + 4000;
  while (!check()) { assert.ok(Date.now() < deadline, label); await delay(10); }
}

test('plan feedback retains native siblings, per-call ownership and cold pending recovery without replay', async () => {
  const workspace = temporary(), tools = [...createTools(), ...createInteractionTools({ sourcePlanTools: true })];
  let session = Session.open(workspace, { config: { ...defaultConfig(workspace, tools), model: 'fixture',
    configSources: { userDir: path.join(workspace, 'user') }, features: { tasks: false, subagents: false, sourcePlanTools: true },
    permissions: { mode: 'bypass', allow: [], deny: [] } } });
  try {
    const host = session.planMode; assert.ok(host); host.enter();
    savePlanFile(workspace, host.filePath, '# Plan\n');
    let requests = 0, reviews = 0;
    const provider: ModelProvider = { count: async () => 0, complete: async request => {
      if (++requests === 1) return reply([call('feedback', 'exit_plan_mode'), call('unavailable', 'missing_tool')], 'tool_use');
      assert.deepEqual(request.messages.at(-1)?.content, [
        { type: 'tool_result', tool_use_id: 'feedback', content: 'Inspect the screenshot.', is_error: true },
        { type: 'tool_result', tool_use_id: 'unavailable', content: 'Unknown tool: missing_tool', is_error: true }, image, text,
      ]);
      return done();
    } };
    await new Agent(session, provider, tools, { interaction: { reviewPlan: async () => {
      reviews++; return { behavior: 'deny', feedback: 'Inspect the screenshot.', contentBlocks: [image, text] };
    } } }).run('Review this plan');
    assert.equal(reviews, 1); assert.equal(host.mode(), 'plan'); assertPaired(session.messages);
    const stored = session.events.filter(row => row.kind === 'tool_result');
    assert.equal(stored.length, 2); assert.deepEqual(stored[0]?.feedbackBlocks, [image, text]);
    assert.equal(stored[1]?.feedbackBlocks, undefined);
    assert.equal(session.events.some(row => row.kind === 'model_plan_mode' && row.operation === 'exit'), false);
    const id = session.id, bytes = fs.readFileSync(session.file); session.close(); session = Session.open(workspace, { id });
    assert.deepEqual(fs.readFileSync(session.file), bytes); assert.equal(session.planMode?.mode(), 'plan');
    assert.deepEqual(session.messages.at(-2)?.content, [
      { type: 'tool_result', tool_use_id: 'feedback', content: 'Inspect the screenshot.', is_error: true },
      { type: 'tool_result', tool_use_id: 'unavailable', content: 'Unknown tool: missing_tool', is_error: true }, image, text,
    ]);
    const pending = Session.open(workspace, { config: { ...session.config, tools: session.config.tools } });
    try {
      pending.planMode?.enter();
      pending.append({ kind: 'message', message: { role: 'user', content: 'Recover feedback' } });
      pending.append({ kind: 'message', message: { role: 'assistant', content: [call('recover', 'exit_plan_mode')] } });
      pending.append({ kind: 'tool_start', id: 'recover', name: 'exit_plan_mode' });
      pending.append({ kind: 'tool_result', result: { type: 'tool_result', tool_use_id: 'recover', content: 'Original feedback', is_error: true }, feedbackBlocks: [image, text] });
      pending.append({ kind: 'tool_output', result: { type: 'tool_result', tool_use_id: 'recover', content: 'Hook feedback', is_error: true } });
      const pendingId = pending.id; pending.close();
      const cold = Session.open(workspace, { id: pendingId });
      try {
        const recovering: ModelProvider = { count: async () => 0, complete: async request => {
          assert.deepEqual(request.messages.at(-1)?.content, [
            { type: 'tool_result', tool_use_id: 'recover', content: 'Hook feedback', is_error: true }, image, text,
          ]); return done();
        } };
        await new Agent(cold, recovering, tools, { interaction: { reviewPlan: async () => { throw new Error('Must not replay'); } } }).run();
        assertPaired(cold.messages); assert.equal(cold.events.filter(row => row.kind === 'tool_result').length, 1);
        assert.equal(cold.planMode?.mode(), 'plan');
      } finally { cold.close(); }
    } finally { pending.close(); }
  } finally { session.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('plan feedback blocks obey admission, output budget and cancellation before mode or journal changes', async () => {
  const workspace = temporary(), tools = createInteractionTools({ sourcePlanTools: true });
  const session = Session.open(workspace, { config: { ...defaultConfig(workspace, tools), model: 'fixture', configSources: { userDir: path.join(workspace, 'user') },
    features: { tasks: false, subagents: false, sourcePlanTools: true }, permissions: { mode: 'bypass', allow: [], deny: [] } } });
  try {
    const host = session.planMode; assert.ok(host); host.enter(); savePlanFile(workspace, host.filePath, '# Plan\n');
    const exit = tools.find(tool => tool.schema.name === 'exit_plan_mode'); assert.ok(exit);
    const context: ToolContext = { workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 24000, planMode: host };
    const before = fs.readFileSync(session.file), plan = readPlanFile(workspace, host.filePath);
    let error: unknown;
    try { await exit.execute({}, { ...context, interaction: { reviewPlan: async () => ({ behavior: 'deny', contentBlocks: [image] }) } }); }
    catch (caught) { error = caught; }
    assert.ok(error instanceof ToolFeedbackError); assert.equal(error.message, '(See attached image)'); assert.deepEqual(error.blocks, [image]);
    for (const blocks of [[{ type: 'text', text: '' }], [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: png } }], Array(17).fill(image)]) {
      await assert.rejects(exit.execute({}, { ...context, interaction: { reviewPlan: async () => ({ behavior: 'deny', contentBlocks: blocks }) } }), /content block|contentBlocks/);
      assert.throws(() => session.append({ kind: 'tool_result', result: { type: 'tool_result', tool_use_id: 'bad', content: 'bad', is_error: true }, feedbackBlocks: blocks }));
    }
    await assert.rejects(exit.execute({}, { ...context, maxOutputBytes: 1, interaction: { reviewPlan: async () => ({ behavior: 'deny', contentBlocks: [image] }) } }), /output byte limit/);
    const controller = new AbortController();
    await assert.rejects(exit.execute({}, { ...context, signal: controller.signal, interaction: { reviewPlan: async () => {
      controller.abort(); return { behavior: 'deny', contentBlocks: [image] };
    } } }), { name: 'AbortError' });
    assert.equal(host.mode(), 'plan'); assert.deepEqual(fs.readFileSync(session.file), before); assert.equal(readPlanFile(workspace, host.filePath), plan);
    await assert.rejects(exit.execute({}, { ...context, interaction: { reviewPlan: async () => ({ behavior: 'allow', mode: 'bypass', contentBlocks: [image] }) } }), /host answer/);
    assert.equal(host.mode(), 'plan');
    const inherited = Object.create(image), inheritedSource = { type: 'image', source: Object.create(image.source) };
    const serialized = { ...image, toJSON: () => ({}) }, serializedText = { type: 'text', text: 'Retained note', toJSON: () => ({}) };
    const blocks = [inherited, inheritedSource, serialized, serializedText];
    const admitted = [image, image, image, { type: 'text', text: 'Retained note' }];
    for (const [index, block] of blocks.entries()) {
      session.append({ kind: 'tool_result', result: { type: 'tool_result', tool_use_id: `journal-${index}`, content: 'Feedback', is_error: true }, feedbackBlocks: [block] });
      assert.deepEqual(session.events.at(-1), { kind: 'tool_result', result: { type: 'tool_result', tool_use_id: `journal-${index}`, content: 'Feedback', is_error: true }, feedbackBlocks: [admitted[index]] });
    }
    const id = session.id, journal = fs.readFileSync(session.file);
    const events = session.events.filter(row => row.kind === 'tool_result');
    assert.deepEqual(events.map(row => row.feedbackBlocks), admitted.map(block => [block]));
    session.close();
    const cold = Session.open(workspace, { id });
    try {
      assert.deepEqual(cold.events.filter(row => row.kind === 'tool_result'), events);
      assert.deepEqual(fs.readFileSync(cold.file), journal);
    } finally { cold.close(); }
  } finally { session.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('plan review images use the existing focused input owner, survive edit handoff and release stale captures', async () => {
  const workspace = temporary(), input = Object.assign(new PassThrough(), { isTTY: true, isRaw: false, setRawMode(_raw: boolean) {} });
  const { Terminal: HeadlessTerminal }: { Terminal: typeof Terminal } = createRequire(import.meta.url)('@xterm/headless');
  const decoder = new HeadlessTerminal({ cols: 100, rows: 34, allowProposedApi: true, logLevel: 'off' });
  const frame = () => Array.from({ length: decoder.rows }, (_, row) =>
    decoder.buffer.active.getLine(decoder.buffer.active.viewportY + row)?.translateToString(true) ?? '').join('\n');
  let captures = 0, slow = false;
  const sink = Object.assign(new Writable({ write(chunk, _encoding, callback) { decoder.write(String(chunk), callback); } }), { isTTY: true, columns: 100, rows: 34 });
  const clipboard: ClipboardSpawn = (_command, _args, options) => {
    captures++;
    return spawn(process.execPath, ['-e', `${slow ? 'setTimeout(()=>{' : ''}process.stdout.write(${JSON.stringify(`«data PNGf${Buffer.from(png, 'base64').toString('hex')}»\n`)});${slow ? '}, 250);' : ''}`], options);
  };
  const tui = new TuiTerminal({ input, output: sink, workspace, clipboard: { platform: 'darwin', spawn: clipboard } }).start();
  const request: TerminalPromptRequest = { title: 'Ready to code?', message: '# Plan', choices: [{ label: 'Approve', value: 'bypass' }, { label: 'Manual', value: 'default' }],
    allowText: true, planReview: { filePath: path.join(workspace, 'plan.md'), automaticMode: 'bypass' } };
  const key = (value: string) => input.emit('data', value), attachments = path.join(workspace, '.harness', 'attachments');
  const count = () => fs.existsSync(attachments) ? fs.readdirSync(attachments).length : 0;
  try {
    let pending = tui.prompt(request, new AbortController().signal);
    key('\x16'); await delay(80); assert.equal(captures, 0);
    key('\x1b[B\x1b[B\x16'); await until(() => count() === 1, 'focused image capture');
    await until(() => frame().includes('[Image #image-1]'), 'image label');
    key('\x7f'); await until(() => count() === 0, 'remove image');
    key('\x16'); await until(() => count() === 1 && frame().includes('[Image #image-2]'), 'second image capture'); key('Keep this feedback'); key('\x07');
    const edit = await pending; assert.equal(edit?.key, 'plan-edit'); assert.equal(edit.text, 'Keep this feedback');
    assert.equal(edit.images?.[0]?.content, png); await until(() => count() === 0, 'edit capture cleanup');
    pending = tui.prompt({ ...request, initialText: edit.text, planReview: { ...request.planReview!, images: edit.images } }, new AbortController().signal);
    key('\x1b[B\x1b[B\r'); const feedback = await pending;
    assert.equal(feedback?.text, 'Keep this feedback'); assert.equal(feedback.images?.length, 1); assert.equal(feedback.images[0]?.content, png);
    pending = tui.prompt(request, new AbortController().signal); key('\x1b[B\x1b[B\x16');
    await until(() => count() === 1 && frame().includes('[Image #image-1]'), 'image-only capture'); key('\r');
    const onlyImage = await pending; assert.equal(onlyImage?.text, ''); assert.equal(onlyImage.images?.[0]?.content, png);
    await until(() => count() === 0, 'image-only cleanup');
    slow = true; const before = captures, controller = new AbortController(); pending = tui.prompt(request, controller.signal);
    key('\x1b[B\x1b[B\x16'); await until(() => captures === before + 1, 'slow capture started'); controller.abort(); assert.equal(await pending, undefined);
    await delay(350); assert.equal(count(), 0);
    slow = false; pending = tui.prompt(request, new AbortController().signal); key('\r'); assert.deepEqual((await pending)?.selected, ['bypass']);
  } finally { tui.close(); decoder.dispose(); fs.rmSync(workspace, { recursive: true, force: true }); }
});
