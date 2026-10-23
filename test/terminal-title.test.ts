import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { PassThrough, Writable } from 'node:stream';
import { setImmediate as turn, setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import type { Terminal } from '@xterm/headless';
import { defaultConfig } from '../src/agent.js';
import { loadProjectConfig } from '../src/config.js';
import { interactiveLoop } from '../src/interactive.js';
import { bindTerminalEnvironmentHost, type AttacherCaps } from '../src/plugin-chain-terminal-environment-host.js';
import type { ModelProvider } from '../src/provider.js';
import { reloadConfig } from '../src/reload.js';
import { createRuntime, parseSettings } from '../src/runtime.js';
import { Session, configSchema } from '../src/session.js';
import { eve, resolveTerminalTitle, terminalTitleSequence, TerminalTitle, type TerminalTitleSnapshot } from '../src/terminal-title.js';
import { TuiTerminal } from '../src/tui.js';

const temporary = () => fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w298-title-')));
const { Terminal: HeadlessTerminal } = createRequire(import.meta.url)('@xterm/headless') as { Terminal: typeof Terminal };
function fixture(userDir?: string) {
  const screen = new HeadlessTerminal({ cols: 100, rows: 30, allowProposedApi: true, logLevel: 'off' });
  const core: unknown = Reflect.get(screen, '_core');
  if (!core || typeof core !== 'object' || !('writeSync' in core) || typeof core.writeSync !== 'function') throw new Error('Pinned xterm decoder unavailable');
  const write = core.writeSync.bind(core); let raw = '';
  const input = Object.assign(new PassThrough(), { isTTY: true, setRawMode(_value: boolean) {} });
  const output = Object.assign(new Writable({ write(chunk, _encoding, done) { raw += String(chunk); write(String(chunk)); done(); } }),
    { isTTY: true, columns: 100, rows: 30 });
  const tui = new TuiTerminal({ input, output, userDir, prefersReducedMotion: true, sourceInputGestures: true }).start();
  return { tui, input, output, key: (value: string) => input.emit('data', value), raw: () => raw,
    titles: () => [...raw.matchAll(/\x1b\]0;([^\x07\x1b]*)(?:\x07|\x1b\\)/g)].map(match => match[1]!),
    text: () => Array.from({ length: screen.rows }, (_, row) => screen.buffer.active.getLine(screen.buffer.active.viewportY + row)?.translateToString(true) ?? '').join('\n'),
    close() { tui.close(); screen.dispose(); } };
}
const response = (content: Anthropic.ContentBlock[], stop: Anthropic.StopReason): Anthropic.Message => ({
  id: 'fixture', type: 'message', role: 'assistant', model: 'fixture', content, stop_reason: stop, stop_sequence: null,
  container: null, diagnostics: null, stop_details: null, usage: { input_tokens: 1, output_tokens: 1, cache_creation: null,
    cache_creation_input_tokens: null, cache_read_input_tokens: null, inference_geo: null, output_tokens_details: null,
    server_tool_use: null, service_tier: null },
});

test('ordinary title precedence, status resolver, OSC bytes and the source focused animation retain literal behavior', t => {
  let caps: AttacherCaps = { terminal: 'iTerm.app', mux: null };
  const key = {}; bindTerminalEnvironmentHost({ hostKey: () => key, terminalState: () => ({}), attacherCaps: () => caps });
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 10000 });
  const writes: string[] = [], owner = new TerminalTitle(text => writes.push(text), '');
  const snapshot: TerminalTitleSnapshot = { sessionTitle: 'chosen', focused: true, active: true, activity: { isLoading: false, isQueryActive: false } };
  try {
    const names = { sessionTitle: 'manual', aiSessionTitle: 'AI', agentTitle: 'agent', haikuTitle: 'topic' };
    assert.equal(resolveTerminalTitle(names), 'manual'); assert.equal(resolveTerminalTitle(names, false), 'AI');
    assert.equal(resolveTerminalTitle({ agentTitle: 'agent', haikuTitle: 'topic' }), 'agent');
    assert.equal(resolveTerminalTitle({ haikuTitle: 'topic' }), 'topic'); assert.equal(resolveTerminalTitle({}), 'LiTcode');
    assert.deepEqual(eve({ isLoading: true, isQueryActive: true, topDialogWaitingFor: 'permission prompt' }), { status: 'waiting', waitingFor: 'permission prompt', working: false });
    assert.equal(eve({ isLoading: true, isQueryActive: true, isShowingLocalJSXCommand: true }).status, 'waiting');
    assert.equal(eve({ isLoading: true, isQueryActive: true, isShowingLocalJSXCommand: true, isResponseStreaming: true }).status, 'busy');
    assert.equal(eve({ isLoading: false, isQueryActive: true }).status, 'idle');
    assert.equal(eve({ isLoading: false, isQueryActive: false, delegatedActive: true }).status, 'busy');
    assert.equal(eve({ isLoading: true, isQueryActive: true, queuedElicitation: true }).waitingFor, 'input needed');
    assert.equal(terminalTitleSequence('\x1b[31mcolor\x1b[0m'), '\x1b]0;color\x07');
    caps.terminal = 'kitty'; assert.equal(terminalTitleSequence('title'), '\x1b]0;title\x1b\\'); caps.terminal = 'iTerm.app';
    owner.update(snapshot); assert.deepEqual(writes.splice(0), ['\x1b]0;✳ chosen\x07']);
    owner.update(snapshot); assert.equal(writes.length, 0);
    snapshot.activity = { isLoading: true, isQueryActive: true }; owner.update(snapshot);
    assert.deepEqual(writes.splice(0), ['\x1b]0;◐ chosen\x07']); t.mock.timers.tick(959); assert.equal(writes.length, 0);
    t.mock.timers.tick(1); assert.deepEqual(writes.splice(0), ['\x1b]0;◑ chosen\x07']);
    snapshot.focused = false; owner.update(snapshot); t.mock.timers.tick(3000); assert.equal(writes.length, 0);
    snapshot.focused = true; owner.update(snapshot); t.mock.timers.tick(960); assert.deepEqual(writes.splice(0), ['\x1b]0;◐ chosen\x07']);
    snapshot.activity.topDialogWaitingFor = 'permission prompt'; owner.update(snapshot); assert.deepEqual(writes.splice(0), ['\x1b]0;✳ chosen\x07']);
    t.mock.timers.tick(3000); assert.equal(writes.length, 0); delete snapshot.activity.topDialogWaitingFor;
    caps.mux = 'tmux'; owner.update(snapshot); t.mock.timers.tick(3000); assert.equal(writes.length, 0, 'static default under mux, with no DCS wrapper');
    caps.mux = null; owner.update(snapshot); assert.deepEqual(writes.splice(0), ['\x1b]0;◐ chosen\x07']);
    snapshot.active = false; owner.update(snapshot); t.mock.timers.tick(3000); assert.equal(writes.length, 0);
    snapshot.active = true; owner.update(snapshot); assert.deepEqual(writes.splice(0), ['\x1b]0;◐ chosen\x07']);
    snapshot.active = false; owner.update(snapshot);
    const disabled = new TerminalTitle(text => writes.push(text), '1'); disabled.update({ ...snapshot, active: true }); t.mock.timers.tick(3000); disabled.close(); assert.equal(writes.length, 0);
    owner.close(); t.mock.timers.tick(3000); owner.update(snapshot); assert.equal(writes.length, 0);
  } finally { owner.close(); t.mock.timers.reset(); bindTerminalEnvironmentHost(undefined); }
});

test('the actual terminal follows durable session titles and releases title clocks across rebinding, editor handoff and close', { timeout: 10000 }, async () => {
  const workspace = temporary(), script = path.join(workspace, 'editor.mjs'), marker = path.join(workspace, 'entered'), release = path.join(workspace, 'release');
  fs.writeFileSync(script, "import fs from 'node:fs';fs.writeFileSync(process.argv[2],'entered');while(!fs.existsSync(process.argv[3]))await new Promise(r=>setTimeout(r,10));");
  const before = { VISUAL: process.env.VISUAL, EDITOR: process.env.EDITOR };
  process.env.VISUAL = `${process.execPath} ${script} ${marker} ${release}`; delete process.env.EDITOR;
  const first = Session.open(workspace, { config: { ...defaultConfig(workspace, []), model: 'fixture' } });
  const second = Session.open(workspace, { config: { ...defaultConfig(workspace, []), model: 'fixture', terminalTitleFromRename: false } });
  const f = fixture();
  try {
    assert.equal(f.titles().at(-1), '✳ LiTcode'); await f.tui.bindInputHistory(first);
    first.append({ kind: 'title', title: 'durable' }); assert.equal(f.titles().at(-1), '✳ durable');
    assert.match(fs.readFileSync(first.file, 'utf8'), /"kind":"title","title":"durable"/);
    await f.tui.bindInputHistory(second); assert.equal(f.titles().at(-1), '✳ LiTcode');
    second.append({ kind: 'title', title: 'ignored by setting' }); assert.equal(f.titles().at(-1), '✳ LiTcode');
    const count = f.titles().length; first.append({ kind: 'title', title: 'old owner' }); assert.equal(f.titles().length, count);
    second.config.terminalTitleFromRename = true; await f.tui.bindInputHistory(second); assert.equal(f.titles().at(-1), '✳ ignored by setting');
    f.tui.setRunning(true); assert.equal(f.titles().at(-1), '✳ ignored by setting', 'local running is not model loading');
    f.tui.setRunning(false);
    f.tui.setProgress({ kind: 'start', uuid: 'turn', startedAt: Date.now() }); assert.match(f.titles().at(-1)!, /^[◐◑] ignored by setting$/);
    const controller = new AbortController(); f.key('draft');
    const editing = f.tui.editDraft(controller.signal, workspace);
    for (let i = 0; i < 200 && !fs.existsSync(marker); i++) await delay(10);
    assert.ok(fs.existsSync(marker)); const suspended = f.titles().length;
    await delay(1100); assert.equal(f.titles().length, suspended, 'editor owns the terminal');
    fs.writeFileSync(release, 'go'); await editing; assert.equal(f.tui.state.text, 'draft'); assert.ok(f.titles().length > suspended);
    const prompt = f.tui.prompt({ title: 'Permission', message: 'owned', titleWaitingFor: 'permission prompt', choices: [{ label: 'Yes', value: 'yes' }] }, controller.signal);
    assert.equal(f.titles().at(-1), '✳ ignored by setting'); f.key('\r'); await prompt; assert.match(f.titles().at(-1)!, /^[◐◑]/);
    f.tui.setProgress({ kind: 'finish', reason: 'end_turn', duration: { uuid: 'turn', durationMs: 1000, timestamp: new Date().toISOString() } }); assert.equal(f.titles().at(-1), '✳ ignored by setting');
    f.close(); const closed = f.raw(); second.append({ kind: 'title', title: 'after close' }); await delay(1100); assert.equal(f.raw(), closed);
  } finally { fs.writeFileSync(release, 'go'); f.close(); first.close(); second.close(); for (const [key, value] of Object.entries(before)) if (value === undefined) delete process.env[key]; else process.env[key] = value; fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('interactive rename, Config, model loading, permission waiting and reload all use the current title authority', { timeout: 12000 }, async t => {
  const workspace = temporary(), user = path.join(workspace, 'user'); fs.mkdirSync(user); fs.mkdirSync(path.join(workspace, '.git')); fs.mkdirSync(path.join(workspace, '.harness'));
  const file = path.join(user, 'settings.json'); fs.writeFileSync(file, JSON.stringify({ model: 'fixture', terminalTitleFromRename: true }));
  const config = { ...defaultConfig(workspace, []), model: 'fixture', configSources: { userDir: user }, prefersReducedMotion: true,
    permissions: { mode: 'ask' as const, allow: [], deny: [] },
    hooks: { PostToolUse: [{ type: 'callback' as const, name: 'hold' }] } };
  const controller = new AbortController(), f = fixture(user); let calls = 0, releaseModel: (() => void) | undefined, releaseTool: (() => void) | undefined;
  const provider: ModelProvider = { count: async () => 1, complete: async () => {
    if (++calls === 1) { await new Promise<void>(resolve => { releaseModel = resolve; }); return response([{ type: 'tool_use', id: 'write', name: 'write_file', input: { path: 'result.txt', content: 'approved' }, caller: { type: 'direct' } }], 'tool_use'); }
    return response([{ type: 'text', text: 'finished', citations: null }], 'end_turn');
  } };
  const runtime = await createRuntime(config, provider, controller.signal, { hookCallbacks: () => ({ hold: async () => {
    await new Promise<void>(resolve => { releaseTool = resolve; }); return {};
  } }) }), session = Session.open(workspace, { config });
  const loop = interactiveLoop(session, provider, runtime, { input: f.input, output: f.output, status: f.output, signal: controller.signal, terminal: f.tui });
  const until = async (predicate: () => boolean) => { for (let i = 0; i < 1000; i++) { if (predicate()) return; await turn(); } assert.fail(f.text()); };
  try {
    await delay(20); f.key('/name owned title\r'); await until(() => f.titles().at(-1) === '✳ owned title');
    f.key('/config\r'); await until(() => f.tui.currentScreen === 'dialog'); assert.equal(f.titles().at(-1), '✳ owned title');
    f.key('\x1b'); await delay(65); if (f.tui.currentScreen === 'dialog') { f.key('\x1b'); await delay(65); }
    await until(() => f.tui.currentScreen === 'chat');
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.now() }); f.key('tool fixture\r'); await until(() => releaseModel !== undefined);
    assert.equal(f.titles().at(-1), '◐ owned title'); t.mock.timers.tick(960); assert.equal(f.titles().at(-1), '◑ owned title');
    f.key('\x1b[O'); const blurred = f.titles().length; t.mock.timers.tick(3000); assert.equal(f.titles().length, blurred);
    f.key('\x1b[I'); t.mock.timers.tick(960); assert.equal(f.titles().at(-1), '◐ owned title'); releaseModel!(); await until(() => f.text().includes('Allow once'));
    assert.equal(f.titles().at(-1), '✳ owned title'); t.mock.timers.tick(960); assert.equal(f.titles().at(-1), '✳ owned title');
    f.key('\r'); await until(() => fs.existsSync(path.join(workspace, 'result.txt')) && releaseTool !== undefined);
    f.key('\x1bp'); await until(() => f.tui.currentScreen === 'dialog' && f.text().includes('Select model'));
    assert.match(f.titles().at(-1)!, /^[◐◑] owned title$/);
    const pickerFrames = f.titles().length; t.mock.timers.tick(960); assert.equal(f.titles().length, pickerFrames + 1, 'live model picker does not suspend ongoing tool work');
    f.key('\x1bp'); await until(() => f.tui.currentScreen === 'chat'); releaseTool!();
    await until(() => session.awaitingResponse === false); assert.equal(f.titles().at(-1), '✳ owned title'); t.mock.timers.reset();
    fs.writeFileSync(file, JSON.stringify({ model: 'fixture', terminalTitleFromRename: false }));
    assert.equal(parseSettings(loadProjectConfig(workspace, { userDir: user, paths: [] }).settings).terminalTitleFromRename, false);
    f.key('/reload\r'); await until(() => f.text().includes('Local configuration reloaded') && f.tui.currentScreen === 'chat'); await until(() => f.titles().at(-1) === '✳ LiTcode');
    f.key('/rename hidden title\r'); await until(() => f.text().includes('Session title: hidden title')); assert.equal(f.titles().at(-1), '✳ LiTcode');
    fs.writeFileSync(file, JSON.stringify({ model: 'fixture' })); assert.equal(reloadConfig({ ...config, terminalTitleFromRename: false }).terminalTitleFromRename, undefined);
    f.key('/reload\r'); await until(() => f.titles().at(-1) === '✳ hidden title');
    assert.throws(() => parseSettings({ terminalTitleFromRename: 'wrong' }), /terminalTitleFromRename/);
    const pinned = Session.open(workspace, { config: { ...config, terminalTitleFromRename: false } }), id = pinned.id; pinned.append({ kind: 'title', title: 'stored' }); pinned.close();
    const resumed = Session.open(workspace, { id }); assert.equal(resumed.config.terminalTitleFromRename, false); assert.equal(resumed.title, 'stored'); resumed.close();
    assert.equal(configSchema.parse({ ...config, terminalTitleFromRename: false }).terminalTitleFromRename, false);
  } finally { releaseModel?.(); releaseTool?.(); t.mock.timers.reset(); controller.abort(); await loop; f.close(); session.close(); await runtime.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});
