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
import { configPanelInput } from '../src/config-panel-input.js';
import { interactiveLoop } from '../src/interactive.js';
import { Agt, ipn } from '../src/notification-plist.js';
import { bindTerminalEnvironmentHost, type AttacherCaps } from '../src/plugin-chain-terminal-environment-host.js';
import type { ModelProvider } from '../src/provider.js';
import { reloadConfig } from '../src/reload.js';
import { createRuntime, parseSettings } from '../src/runtime.js';
import { Session, configSchema } from '../src/session.js';
import { appleTerminalBell, notificationChannelSchema, notificationWriter, pendingPermissionNotification, TerminalNotifications } from '../src/terminal-notifications.js';
import { saveConfigPanelSetting } from '../src/theme-settings.js';
import { TuiTerminal } from '../src/tui.js';

const { Terminal: HeadlessTerminal } = createRequire(import.meta.url)('@xterm/headless') as { Terminal: typeof Terminal };
const temporary = () => fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w297-notifications-')));
const profile = '<?xml version="1.0"?><plist version="1.0"><dict><key>Window Settings</key><dict><key>Test &amp; Local</key><dict><key>Bell</key><false/></dict></dict></dict></plist>';
function fixture(userDir?: string, extra: Record<string, unknown> = {}) {
  const screen = new HeadlessTerminal({ cols: 100, rows: 30, allowProposedApi: true, logLevel: 'off' });
  const core: unknown = Reflect.get(screen, '_core');
  if (!core || typeof core !== 'object' || !('writeSync' in core) || typeof core.writeSync !== 'function') throw new Error('Pinned xterm decoder unavailable');
  const write = core.writeSync.bind(core); let raw = '';
  const input = Object.assign(new PassThrough(), { isTTY: true, setRawMode(_value: boolean) {} });
  const output = Object.assign(new Writable({ write(chunk, _encoding, done) { raw += String(chunk); write(String(chunk)); done(); } }),
    { isTTY: true, columns: 100, rows: 30 });
  const tui = new TuiTerminal({ input, output, userDir, prefersReducedMotion: true, sourceInputGestures: true, ...extra }).start();
  return { tui, input, output, key: (text: string) => input.emit('data', text), raw: () => raw,
    text: () => Array.from({ length: screen.rows }, (_, row) => screen.buffer.active.getLine(screen.buffer.active.viewportY + row)?.translateToString(true) ?? '').join('\n'),
    close() { tui.close(); screen.dispose(); } };
}

function reply(content: Anthropic.ContentBlock[], stop: Anthropic.StopReason): Anthropic.Message {
  return { id: 'fixture', type: 'message', role: 'assistant', model: 'fixture', content, stop_reason: stop, stop_sequence: null,
    container: null, diagnostics: null, stop_details: null, usage: { input_tokens: 1, output_tokens: 1, cache_creation: null,
      cache_creation_input_tokens: null, cache_read_input_tokens: null, inference_geo: null, output_tokens_details: null,
      server_tool_use: null, service_tier: null } };
}

test('local notification protocols, terminal selection and the local Apple profile probe preserve literal bytes and cancellation', async () => {
  const directory = temporary(), previousPath = process.env.PATH;
  let caps: AttacherCaps = { terminal: 'iTerm.app', mux: null }, active = true;
  const host = {}; bindTerminalEnvironmentHost({ hostKey: () => host, terminalState: () => ({}), attacherCaps: () => caps });
  const writes: string[] = [], writer = notificationWriter(text => writes.push(text), {});
  const sender = new TerminalNotifications(text => writes.push(text), () => active);
  const signal = new AbortController().signal;
  try {
    writer.notifyITerm2({ title: 'A\x1b', message: 'b\n\x07\u0085' }); assert.deepEqual(writes.splice(0), ['\x1b]9;A : b   \x07']);
    caps = { terminal: 'kitty', mux: null };
    writer.notifyKitty({ title: 'T', message: 'body', id: 42 });
    assert.deepEqual(writes.splice(0), ['\x1b]99;i=42:d=0:p=title;T\x1b\\', '\x1b]99;i=42:p=body;body\x1b\\', '\x1b]99;i=42:d=1:a=focus;\x1b\\']);
    caps = { terminal: 'ghostty', mux: 'tmux' }; writer.notifyGhostty({ title: 'T', message: 'body' });
    assert.deepEqual(writes.splice(0), ['\x1bPtmux;\x1b\x1b]777;notify;T;body\x07\x1b\\']);
    caps.mux = 'screen'; writer.notifyITerm2({ message: 'body' });
    assert.deepEqual(writes.splice(0), ['\x1bP\x1b\x1b]9;body\x07\x1b\\']);
    caps = { terminal: 'iTerm.app', mux: null };
    notificationWriter(text => writes.push(text), { TMUX: 'environment' }).notifyITerm2({ message: 'body' });
    assert.deepEqual(writes.splice(0), ['\x1b]9;body\x07'], 'attacher mux outranks the environment');
    sender.setChannel('iterm2_with_bell'); assert.equal(await sender.send({ title: 'T', message: 'body' }, signal), 'iterm2_with_bell');
    assert.deepEqual(writes.splice(0), ['\x1b]9;T: body\x07', '\x07']);
    sender.setChannel('kitty'); await sender.send({ message: 'body' }, signal);
    const id = writes[0]?.match(/i=(\d+):/)?.[1]; assert.ok(id);
    assert.deepEqual(writes.splice(0), [`\x1b]99;i=${id}:d=0:p=title;LiTcode\x07`, `\x1b]99;i=${id}:p=body;body\x07`, `\x1b]99;i=${id}:d=1:a=focus;\x07`]);
    for (const [terminal, expected, bytes] of [['iTerm.app', 'iterm2', '\x1b]9;body\x07'], ['ghostty', 'ghostty', '\x1b]777;notify;LiTcode;body\x07'], ['unknown', 'no_method_available', '']] as const) {
      caps = { terminal, mux: null }; sender.setChannel(); assert.equal(await sender.send({ message: 'body' }, signal), expected);
      assert.equal(writes.splice(0).join(''), bytes);
    }
    sender.setChannel('notifications_disabled'); assert.equal(await sender.send({ message: 'body' }, signal), 'disabled'); assert.deepEqual(writes, []);
    active = false; sender.setChannel('terminal_bell'); assert.equal(await sender.send({ message: 'body' }, signal), 'no_surface'); assert.deepEqual(writes, []); active = true;
    const cancelled = new AbortController(); cancelled.abort(); assert.equal(await sender.send({ message: 'body' }, cancelled.signal), 'no_surface');
    assert.equal(notificationChannelSchema.parse('invalid'), undefined); assert.equal(notificationChannelSchema.parse(null), undefined);
    const parsed = ipn(profile); assert.ok(Agt(parsed)); assert.equal(Agt(null), false);
    assert.deepEqual(ipn('<plist><array><string>&lt;&#x1f600;&#65;</string><integer>3</integer><true/></array></plist>'), ['<😀A', 3, true]);
    assert.equal(ipn('<plist><dict><key>Bell</key></dict></plist>'), undefined);
    const commands: Array<[string, string[]]> = [];
    assert.equal(await appleTerminalBell(signal, async (file, args) => { commands.push([file, args]); return { code: 0, stdout: file === 'osascript' ? 'Test & Local\n' : profile }; }), true);
    assert.deepEqual(commands, [['osascript', ['-e', 'tell application "Terminal" to name of current settings of front window']], ['defaults', ['export', 'com.apple.Terminal', '-']]]);
    assert.equal(await appleTerminalBell(signal, async file => ({ code: 0, stdout: file === 'osascript' ? 'Test & Local' : profile.replace('<false/>', '<true/>') })), false);
    assert.equal(await appleTerminalBell(signal, async file => ({ code: file === 'defaults' ? 1 : 0, stdout: file === 'osascript' ? 'Test & Local' : profile })), false);
    fs.writeFileSync(path.join(directory, 'osascript'), '#!/bin/sh\nprintf "Test & Local\\n"\n', { mode: 0o700 });
    fs.writeFileSync(path.join(directory, 'defaults'), `#!/bin/sh\nprintf '%s' '${profile}'\n`, { mode: 0o700 });
    process.env.PATH = `${directory}${path.delimiter}${previousPath ?? ''}`;
    caps = { terminal: 'Apple_Terminal', mux: null }; sender.setChannel();
    assert.equal(await sender.send({ message: 'body' }, signal), 'terminal_bell'); assert.deepEqual(writes.splice(0), ['\x07']);
    fs.writeFileSync(path.join(directory, 'osascript'), '#!/bin/sh\nexec /bin/sleep 2\n', { mode: 0o700 });
    const late = sender.send({ message: 'body' }, signal); sender.close(); await late; assert.deepEqual(writes, []);
    assert.equal(await sender.send({ message: 'body' }, signal), 'no_surface');
  } finally { sender.close(); bindTerminalEnvironmentHost(undefined); if (previousPath === undefined) delete process.env.PATH; else process.env.PATH = previousPath; fs.rmSync(directory, { recursive: true, force: true }); }
});

test('the six-second permission clock follows the source input predicate, sends once, and cancels on disposal', t => {
  const f = fixture(), start = Date.now();
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: start });
  const cancels: Array<() => void> = [];
  try {
    const initial = f.tui.lastInteractionTime();
    t.mock.timers.tick(100); f.key('\x1b[O\x1b[I\x1b]11;rgb:0000/0000/0000\x07\x1b[<35;5;5M');
    assert.equal(f.tui.lastInteractionTime(), initial, 'focus, responses and idle pointer motion are excluded');
    for (const key of ['\x1b[<0;5;5M', '\x1b[<0;5;5m', '\x1b[<32;5;5M', '\x1b[<64;5;5M', 'a', '\x1b[200~paste\x1b[201~']) {
      t.mock.timers.tick(100); f.key(key); assert.equal(f.tui.lastInteractionTime(), Date.now());
    }
    t.mock.timers.tick(100); f.key('\x1b'); t.mock.timers.tick(100); assert.ok(f.tui.lastInteractionTime() >= Date.now() - 100, 'standalone Escape counts after decoding');
    let count = 0;
    const cancel = pendingPermissionNotification(() => f.tui.lastInteractionTime(), () => { count++; }); cancels.push(cancel);
    t.mock.timers.tick(5999); f.key('x'); t.mock.timers.tick(1); assert.equal(count, 0, 'recent input postpones the first periodic check');
    t.mock.timers.tick(6000); assert.equal(count, 1);
    t.mock.timers.tick(18000); assert.equal(count, 1);
    const stop = pendingPermissionNotification(() => f.tui.lastInteractionTime(), () => { count++; }); cancels.push(stop); stop();
    t.mock.timers.tick(6000); assert.equal(count, 1);
    f.tui.close(); const closed = f.raw(); t.mock.timers.tick(12000); assert.equal(f.raw(), closed);
  } finally { for (const cancel of cancels) cancel(); f.close(); t.mock.timers.reset(); }
});

test('live Config persists merged channels and a mounted tool permission hooks before local notification, suppressing late sends', { timeout: 15000 }, async t => {
  const workspace = temporary(), user = path.join(workspace, 'user'); fs.mkdirSync(user); fs.mkdirSync(path.join(workspace, '.git')); fs.mkdirSync(path.join(workspace, '.harness'));
  const file = path.join(user, 'settings.json'), project = path.join(workspace, '.harness/settings.json');
  fs.writeFileSync(file, JSON.stringify({ model: 'fixture', keep: 7 }));
  const config = { ...defaultConfig(workspace, []), model: 'fixture', configSources: { userDir: user }, prefersReducedMotion: true,
    permissions: { mode: 'ask' as const, allow: [], deny: [] }, hooks: { Notification: [{ type: 'callback' as const, name: 'observe' }] } };
  const controller = new AbortController(), f = fixture(user), hooks: string[] = [];
  let hold: (() => void) | undefined, holdHook = false, calls = 0;
  const provider: ModelProvider = { count: async () => 1, complete: async () => ++calls % 2 === 1
    ? reply([{ type: 'tool_use', id: `write-${calls}`, name: 'write_file', input: { path: `result-${calls}.txt`, content: 'approved' }, caller: { type: 'direct' } }], 'tool_use')
    : reply([{ type: 'text', text: 'finished', citations: null }], 'end_turn') };
  const runtime = await createRuntime(config, provider, controller.signal, { hookCallbacks: () => ({ observe: async (_definition, _event, payload) => {
    const message = typeof payload.message === 'string' ? payload.message : ''; hooks.push(message);
    if (holdHook && message === 'Permission needed') await new Promise<void>(resolve => { hold = resolve; });
    return {};
  } }) });
  const session = Session.open(workspace, { config });
  const loop = interactiveLoop(session, provider, runtime, { input: f.input, output: f.output, status: f.output, signal: controller.signal, terminal: f.tui });
  const until = async (predicate: () => boolean) => { for (let i = 0; i < 500; i++) { if (predicate()) return; await turn(); } assert.fail(f.text()); };
  const stored = () => JSON.parse(fs.readFileSync(file, 'utf8'));
  const bells = () => [...f.raw().replace(/\x1b\]0;[^\x07]*(?:\x07|\x1b\\)/g, '').matchAll(/\x07/g)].length;
  const selectChannel = async (expected: string) => { f.key('/config\r'); await until(() => f.tui.currentScreen === 'dialog'); f.key('Local notifications\r\x1b[C'); await until(() => stored().preferredNotifChannel === expected && !f.text().includes('Saving settings')); };
  try {
    await delay(20); const id = session.id;
    await selectChannel('iterm2'); assert.match(f.text(), /Local notifications\s+‹ iterm2 ›/); f.key('\x1b'); await delay(65); await until(() => f.tui.currentScreen === 'chat');
    await selectChannel('terminal_bell'); assert.equal(session.id, id); assert.equal(stored().keep, 7); assert.equal(session.config.preferredNotifChannel, 'terminal_bell');
    f.key('\x1b'); await delay(65); await until(() => f.tui.currentScreen === 'chat');
    fs.writeFileSync(project, JSON.stringify({ preferredNotifChannel: 'notifications_disabled' }));
    await selectChannel('iterm2_with_bell'); assert.match(f.text(), /Local notifications\s+‹ notifications_disabled ›/); assert.equal(session.config.preferredNotifChannel, 'notifications_disabled');
    f.key('\x1b'); await delay(65); await until(() => f.tui.currentScreen === 'chat'); fs.rmSync(project);
    session.config.preferredNotifChannel = 'terminal_bell'; f.tui.setNotificationChannel('terminal_bell');
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.now() });
    f.key('permission fixture\r'); await until(() => f.text().includes('Allow once'));
    const before = bells(); t.mock.timers.tick(5999); assert.equal(bells(), before); t.mock.timers.tick(1);
    await until(() => hooks.includes('Permission needed')); await until(() => bells() > before);
    assert.ok(hooks.includes('Permission needed to use write_file'), 'independent legacy hook remains');
    assert.equal(bells(), before + 1); assert.equal(fs.existsSync(path.join(workspace, 'result-1.txt')), false);
    t.mock.timers.tick(18000); await turn(); assert.equal(bells(), before + 1, 'pending notification tries once');
    f.key('\r'); await until(() => fs.existsSync(path.join(workspace, 'result-1.txt')) && session.awaitingResponse === false);
    assert.equal(fs.readFileSync(path.join(workspace, 'result-1.txt'), 'utf8'), 'approved'); t.mock.timers.reset();
    holdHook = true; t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.now() });
    f.key('late hook fixture\r'); await until(() => f.text().includes('Allow once')); const lateBefore = bells(); t.mock.timers.tick(6000); await until(() => hold !== undefined);
    f.key('\r'); await until(() => fs.existsSync(path.join(workspace, 'result-3.txt')) && session.awaitingResponse === false); hold!(); await turn(); await turn(); assert.equal(bells(), lateBefore); t.mock.timers.reset();
    f.key('cancel fixture\r'); await until(() => f.text().includes('Allow once'));
    const cancelBefore = bells(); f.key('\x1b'); await delay(65); await until(() => f.tui.currentScreen === 'chat');
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.now() }); t.mock.timers.tick(12000); await turn(); assert.equal(bells(), cancelBefore); assert.equal(fs.existsSync(path.join(workspace, 'result-5.txt')), false); t.mock.timers.reset();
    const loaded = parseSettings(loadProjectConfig(workspace, { userDir: user, paths: [] }).settings);
    assert.equal(loaded.preferredNotifChannel, 'iterm2_with_bell'); assert.equal(configSchema.parse({ ...config, preferredNotifChannel: 'wrong' }).preferredNotifChannel, undefined);
    assert.equal(configPanelInput({ ...config, preferredNotifChannel: loaded.preferredNotifChannel }).config.preferredNotifChannel, 'iterm2_with_bell');
    await saveConfigPanelSetting({ id: 'notifChannel', value: 'ghostty' }, workspace, user); assert.equal(reloadConfig(config).preferredNotifChannel, 'ghostty');
    await saveConfigPanelSetting({ id: 'notifChannel', value: 'notifications_disabled' }, workspace, user);
    for (const invalid of ['invalid', null, 42, {}, []]) {
      fs.writeFileSync(project, JSON.stringify({ preferredNotifChannel: invalid }));
      assert.equal(reloadConfig(config).preferredNotifChannel, 'notifications_disabled', 'invalid higher channel falls through to the user layer');
    }
    fs.rmSync(project);
    const pinned = Session.open(workspace, { config: { ...config, preferredNotifChannel: 'kitty' } }), pinnedId = pinned.id; pinned.close();
    const resumed = Session.open(workspace, { id: pinnedId }); assert.equal(resumed.config.preferredNotifChannel, 'kitty'); resumed.close();
    fs.writeFileSync(file, JSON.stringify({ model: 'fixture', keep: 7 })); assert.equal(reloadConfig({ ...config, preferredNotifChannel: 'ghostty' }).preferredNotifChannel, undefined);
    assert.equal(parseSettings({ preferredNotifChannel: 'wrong' }).preferredNotifChannel, undefined);
    // `messageIdleNotifThresholdMs` (chunk-24k7d6mw.js 1679555): a positive millisecond delay is
    // carried, and a value that cannot arm a timer is absent rather than an error.
    assert.equal(parseSettings({ messageIdleNotifThresholdMs: 2500 }).messageIdleNotifThresholdMs, 2500);
    assert.equal(parseSettings({ messageIdleNotifThresholdMs: 0 }).messageIdleNotifThresholdMs, undefined);
    assert.equal(parseSettings({ messageIdleNotifThresholdMs: -1 }).messageIdleNotifThresholdMs, undefined);
    assert.equal(parseSettings({ messageIdleNotifThresholdMs: 'soon' }).messageIdleNotifThresholdMs, undefined);
    assert.equal(configSchema.parse({ ...config, messageIdleNotifThresholdMs: 2500 }).messageIdleNotifThresholdMs, 2500);
    assert.equal(configSchema.parse({ ...config, messageIdleNotifThresholdMs: 0 }).messageIdleNotifThresholdMs, undefined);
    fs.writeFileSync(project, JSON.stringify({ messageIdleNotifThresholdMs: 2500 }));
    assert.equal(reloadConfig(config).messageIdleNotifThresholdMs, 2500);
    fs.writeFileSync(project, JSON.stringify({ messageIdleNotifThresholdMs: 'soon' }));
    assert.equal(reloadConfig(config).messageIdleNotifThresholdMs, undefined, 'a malformed delay falls through');
    fs.rmSync(project);
  } finally { hold?.(); t.mock.timers.reset(); controller.abort(); await loop; f.close(); session.close(); await runtime.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('an idle turn raises the idle_prompt Notification hook before the local channel', { timeout: 20000 }, async t => {
  const workspace = temporary(), user = path.join(workspace, 'user'); fs.mkdirSync(user); fs.mkdirSync(path.join(workspace, '.git'));
  // `messageIdleNotifThresholdMs` (chunk-24k7d6mw.js 1679555) shortens the recovered 60000 ms.
  const config = { ...defaultConfig(workspace, []), model: 'fixture', configSources: { userDir: user },
    prefersReducedMotion: true, permissions: { mode: 'ask' as const, allow: [], deny: [] }, messageIdleNotifThresholdMs: 1_500,
    hooks: { Notification: [{ type: 'callback' as const, name: 'observe' }] } };
  const controller = new AbortController(), f = fixture(user, { messageIdleNotifThresholdMs: 1_500 }), hooks: Array<{ message: string; type: string }> = [];
  const provider: ModelProvider = { count: async () => 1, complete: async () => reply([{ type: 'text', text: 'finished', citations: null }], 'end_turn') };
  const runtime = await createRuntime(config, provider, controller.signal, { hookCallbacks: () => ({ observe: async (_definition, _event, payload) => {
    hooks.push({ message: typeof payload.message === 'string' ? payload.message : '', type: typeof payload.notification_type === 'string' ? payload.notification_type : '' });
    return {};
  } }) });
  const session = Session.open(workspace, { config });
  const loop = interactiveLoop(session, provider, runtime, { input: f.input, output: f.output, status: f.output, signal: controller.signal, terminal: f.tui });
  const until = async (predicate: () => boolean) => { for (let i = 0; i < 500; i++) { if (predicate()) return; await turn(); } assert.fail(f.text()); };
  try {
    await delay(20);
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.now() });
    f.key('idle fixture\r');
    await until(() => session.awaitingResponse === false && f.text().includes('finished'));
    await delay(20);
    t.mock.timers.tick(1_500);
    await until(() => hooks.some(hook => hook.type === 'idle_prompt'));
    assert.deepEqual(hooks.filter(hook => hook.type === 'idle_prompt'),
      [{ message: 'Claude is waiting for your input', type: 'idle_prompt' }]);
    // One notification per completion: a later tick raises nothing further.
    t.mock.timers.tick(30_000); await turn();
    assert.equal(hooks.filter(hook => hook.type === 'idle_prompt').length, 1);
  } finally { t.mock.timers.reset(); controller.abort(); await loop; f.close(); session.close(); await runtime.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});
