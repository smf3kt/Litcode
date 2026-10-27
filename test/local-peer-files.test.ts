import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { test } from 'node:test';
import { defaultConfig } from '../src/agent.js';
import { createLocalPeerTransport, createLocalPeerTools, PeerSendRefusal, sendPeerFrame, type AcceptedMessage, type InboundPolicy } from '../src/local-peer.js';
import { createLocalPeerFileTool, materializeLocalPeerFiles, peerTransferSpool, peerUploadDirectory, readPeerFileBounded, sanitizePeerFileName,
  stageLocalPeerFile, sweepPeerFileSpool, validatePeerFilePath, PEER_FILE_MAX_BYTES } from '../src/local-peer-files.js';
import { permissionDecision, type PermissionPolicy } from '../src/permissions.js';
import { classifierMessage } from '../src/message-origin.js';
import { Session, managedPolicySchema } from '../src/session.js';
import { parseSettings, pinToolSchemas } from '../src/runtime.js';
import { reloadConfig } from '../src/reload.js';
import type { ToolContext } from '../src/tools.js';

const temporary = () => fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'peer-files-')));
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until(check: () => boolean): Promise<void> {
  const start = Date.now();
  while (!check()) { if (Date.now() - start > 5000) throw new Error('Peer file condition not reached'); await delay(10); }
}

test('local peer files preserve source caps, integrity, spool ownership and literal references', async () => {
  const root = temporary(), userDir = path.join(root, 'user'), workspace = path.join(root, 'workspace');
  fs.mkdirSync(workspace); fs.mkdirSync(userDir);
  const host = { workspace, sessionId: 'recipient' }, source = path.join(workspace, 'payload.txt');
  const bytes = Buffer.from([0, 1, 2, 10, 255]); fs.writeFileSync(source, bytes);
  try {
    assert.equal(sanitizePeerFileName('abc中.txt'), 'abc_.txt');
    assert.equal(sanitizePeerFileName('a'.repeat(220) + '.pdf'), 'a'.repeat(196) + '.pdf');
    for (const file of ['https://example.test/a', '//server/path', '/net/host/a', '/Network/a', '/.vol/a', '/??/C:/a']) assert.throws(() => validatePeerFilePath(file));
    const over = path.join(workspace, 'over'); const fd = fs.openSync(over, 'w'); fs.ftruncateSync(fd, PEER_FILE_MAX_BYTES + 1); fs.closeSync(fd);
    assert.equal(await readPeerFileBounded(over), null);
    fs.symlinkSync(source, path.join(workspace, 'link')); assert.equal(await readPeerFileBounded(path.join(workspace, 'link')), null);
    assert.equal(await readPeerFileBounded(workspace), null);
    const staged = await stageLocalPeerFile(source, userDir);
    assert.equal(fs.statSync(staged.path).mode & 0o777, 0o600); assert.equal(staged.media_type, 'text/plain');
    fs.writeFileSync(source, 'changed');
    const received = await materializeLocalPeerFiles([staged], userDir, host);
    assert.deepEqual({ received: received.received, verified: received.verified }, { received: 1, verified: 1 });
    const reference = /^@"([^"]+)" $/.exec(received.prefix); assert.ok(reference);
    assert.deepEqual(fs.readFileSync(path.join(workspace, reference[1]!)), bytes);
    assert.equal(fs.existsSync(staged.path), false);
    const corrupted = await stageLocalPeerFile(source, userDir); fs.writeFileSync(corrupted.path, 'corrupt');
    const failed = await materializeLocalPeerFiles([corrupted], userDir, host);
    assert.equal(failed.verified, 0); assert.match(failed.prefix, /failed integrity verification/); assert.equal(fs.existsSync(corrupted.path), true);
    assert.deepEqual(await materializeLocalPeerFiles([staged, {}], userDir, host), { prefix: '', received: 0, verified: 0 });
    const otherUser = path.join(root, 'other'); fs.mkdirSync(otherUser);
    const foreign = await stageLocalPeerFile(source, otherUser), foreignResult = await materializeLocalPeerFiles([foreign], userDir, host);
    assert.equal(foreignResult.verified, 1); assert.equal(fs.existsSync(foreign.path), true);
    const clipped = await materializeLocalPeerFiles(Array(18).fill({ ...staged, path: source }), userDir, host);
    assert.equal(clipped.received, 16); assert.match(clipped.prefix, /2 additional attachment\(s\).*max 16/);
    assert.equal(clipped.verified, 0);
    const old = path.join(peerTransferSpool(userDir), 'old'), current = path.join(peerTransferSpool(userDir), 'current');
    fs.writeFileSync(old, 'old'); fs.writeFileSync(current, 'current'); fs.utimesSync(old, 1, 1);
    await sweepPeerFileSpool(userDir); assert.equal(fs.existsSync(old), false); assert.equal(fs.existsSync(current), true);
    assert.equal(fs.statSync(peerUploadDirectory(host)).mode & 0o777, 0o700);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('file tool uses Read decisions before effects and keeps feature versions and original catalogs pinned', async (t) => {
  const root = temporary(), workspace = path.join(root, 'workspace'), userDir = path.join(root, 'user');
  fs.mkdirSync(workspace); fs.mkdirSync(userDir); fs.writeFileSync(path.join(workspace, 'ok.txt'), 'ok');
  let current: PermissionPolicy = { mode: 'bypass', allow: [], deny: [], ask: [], ruleWorkspace: workspace };
  let enabled = true, attempts = 0;
  const transport = await createLocalPeerTransport({ userDir, workspace, socketPath: path.join(root, 'p.sock'), onEvent: () => {} });
  const send = transport.send;
  transport.send = async () => { attempts++; throw new PeerSendRefusal('no-live-inbox', 'fixture prewrite'); };
  const tool = createLocalPeerFileTool(transport, { userDir, enabled: () => enabled, permissions: () => current });
  const context: ToolContext = { workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 24000 };
  const input = { address: 'uds:/absent.sock', files: ['ok.txt'], message: 'file' };
  try {
    assert.equal(createLocalPeerTools(transport).some(tool => tool.schema.name === 'send_peer_files'), false);
    const tools = createLocalPeerTools(transport, { files: { userDir, enabled: () => enabled, permissions: () => current } });
    assert.equal(pinToolSchemas(tools).filter(tool => tool.name === 'send_peer_files').length, 1);
    for (const deny of ['Read', 'read_file', 'Read(ok.txt)']) {
      current = { ...current, deny: [deny] };
      assert.equal(permissionDecision(current, tool, input).decision, 'deny');
      await assert.rejects(tool.execute(input, context)); assert.equal(attempts, 0);
    }
    current = { ...current, deny: [], ask: ['Read(ok.txt)'] };
    assert.equal(permissionDecision(current, tool, input).decision, 'ask');
    current = { ...current, mode: 'auto' }; assert.equal(permissionDecision(current, tool, input).floor, 'rule');
    current = { ...current, ask: [], mode: 'plan' }; assert.equal(permissionDecision(current, tool, input).decision, 'deny');
    current = { ...current, mode: 'bypass' };
    const failed = JSON.parse(await tool.execute(input, context)); assert.equal(failed.success, false); assert.equal(attempts, 1);
    assert.deepEqual(fs.readdirSync(peerTransferSpool(userDir)), []);
    const cancelled = new AbortController(); cancelled.abort();
    await assert.rejects(tool.execute(input, { ...context, signal: cancelled.signal })); assert.equal(attempts, 1);
    fs.symlinkSync(path.join(workspace, 'ok.txt'), path.join(workspace, 'alias.txt'));
    const linked = JSON.parse(await tool.execute({ ...input, files: ['alias.txt'] }, context));
    assert.equal(linked.success, false); assert.equal(attempts, 1); assert.equal(linked.files[0].error.includes('regular'), true);
    fs.mkdirSync(path.join(workspace, 'approved')); fs.mkdirSync(path.join(workspace, 'denied'));
    fs.writeFileSync(path.join(workspace, 'approved', 'source.txt'), 'allowed');
    fs.writeFileSync(path.join(workspace, 'denied', 'source.txt'), 'denied-content');
    const alias = path.join(workspace, 'alias'); fs.symlinkSync('approved', alias);
    current = { ...current, deny: ['Read(denied/**)'] };
    const aliasInput = { ...input, files: ['alias/source.txt'] };
    assert.equal(permissionDecision(current, tool, aliasInput).decision, 'allow');
    const stable = JSON.parse(await tool.execute(aliasInput, context));
    assert.equal(stable.files[0].size, 7); assert.equal(attempts, 2);
    for (const boundary of ['stat', 'open', 'opened']) {
      let swapped = false;
      const operation = boundary === 'stat' ? 'stat' : 'open', original = fsp[operation];
      const hook = (file: unknown) => {
        if (!swapped && file === path.join(alias, 'source.txt')) {
          swapped = true; fs.unlinkSync(alias); fs.symlinkSync('denied', alias);
        }
      };
      t.mock.method(fsp, operation, async (...args: unknown[]) => {
        if (boundary !== 'opened') hook(args[0]);
        const result = await Reflect.apply(original, fsp, args);
        if (boundary === 'opened') hook(args[0]);
        return result;
      });
      try {
        const changed = JSON.parse(await tool.execute(aliasInput, context));
        assert.equal(swapped, true); assert.equal(changed.success, false);
        assert.equal(attempts, 2); assert.equal(changed.files[0].error.includes('regular'), true);
        assert.deepEqual(fs.readdirSync(peerTransferSpool(userDir)), []);
      } finally { t.mock.restoreAll(); fs.unlinkSync(alias); fs.symlinkSync('approved', alias); }
    }
    enabled = false; await assert.rejects(tool.execute(input, context), /disabled/);
    assert.equal(parseSettings({ features: { peerFileTransfers: true } }).features?.peerFileTransfers, true);
    assert.throws(() => parseSettings({ features: { peerFileTransfers: 'true' } }));
    assert.equal(managedPolicySchema.parse({ features: { peerFileTransfers: false } }).features?.peerFileTransfers, false);
    for (const version of [undefined, false, true]) {
      const config = { ...defaultConfig(workspace, []), model: 'fixture', configSources: { userDir },
        features: { tasks: false, subagents: false, ...(version === undefined ? {} : { peerFileTransfers: version }) } };
      const session = Session.open(workspace, { config }), id = session.id; await session.close();
      fs.writeFileSync(path.join(userDir, 'settings.json'), JSON.stringify({ features: { peerFileTransfers: true } }));
      const cold = Session.open(workspace, { id });
      try { assert.equal(cold.config.features?.peerFileTransfers, version); assert.equal(reloadConfig(cold.config).features?.peerFileTransfers, true); }
      finally { await cold.close(); }
    }
  } finally { transport.send = send; await transport.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('source file frames materialize before held approval, preserve cold origin and skip consumed or refused files', async () => {
  const root = temporary(), workspace = path.join(root, 'workspace'), userDir = path.join(root, 'user');
  fs.mkdirSync(workspace); fs.mkdirSync(userDir); const source = path.join(workspace, 'data.txt'); fs.writeFileSync(source, 'source snapshot');
  let policy: InboundPolicy = 'hold', consumed = false, feature = true, hostId = 'receiver-1';
  const accepted: AcceptedMessage[] = [], seen: string[] = [];
  const receiver = await createLocalPeerTransport({ userDir, workspace, socketPath: path.join(root, 'r.sock'),
    sourceEnvelope: () => true, fileHost: () => feature ? { workspace, sessionId: hostId } : undefined,
    policy: () => policy, receive: frame => { seen.push(frame.text); return consumed ? { consume: true } : {}; },
    onEvent: event => { if (event.kind === 'message') accepted.push(event.message); } });
  const sender = await createLocalPeerTransport({ userDir, workspace, socketPath: path.join(root, 's.sock'),
    sourceEnvelope: () => true, sessionId: () => 'sender-1', name: 'sender', onEvent: () => {} });
  const sendFile = async (name: string) => {
    const file = await stageLocalPeerFile(source, userDir), sent = await sender.send(receiver.address, name, { fileAttachments: [file] });
    return { file, sent };
  };
  try {
    const { file, sent } = await sendFile('held files'); await until(() => receiver.held().length === 1);
    const held = receiver.held()[0]!; assert.equal(held.origin.metadata?.body, undefined); assert.equal(held.origin.metadata?.fromSession, 'sender-1');
    assert.equal(seen[0]?.includes('@"'), false); assert.match(held.text, /\n@"\.harness\/peer-uploads\/receiver-1\//);
    assert.equal(fs.existsSync(file.path), false); assert.equal(await receiver.resolveHeld(sent.msgId, 'approve'), 'delivered');
    await until(() => accepted.length === 1 && sender.status(sent.msgId)?.status === 'delivered');
    assert.equal(accepted[0]?.text, held.text);
    const session = Session.open(workspace, { config: { ...defaultConfig(workspace, []), model: 'fixture' } }), id = session.id;
    session.append({ kind: 'message', message: { role: 'user', content: held.text }, classifier: { origin: { kind: 'peer', source: 'uds', ...held.origin.metadata } } });
    session.append({ kind: 'turn_end', reason: 'end_turn' }); await session.close();
    const cold = Session.open(workspace, { id });
    try {
      assert.equal(cold.messages[0]?.content, held.text); assert.equal(classifierMessage(cold.messages[0]!)?.origin.kind, 'peer');
      const reference = /@"([^"]+)"/.exec(held.text); assert.ok(reference); assert.equal(fs.readFileSync(path.join(workspace, reference[1]!), 'utf8'), 'source snapshot');
    } finally { await cold.close(); }
    consumed = true; const ignored = await sendFile('consumed'); await delay(30); assert.equal(fs.existsSync(ignored.file.path), true); assert.equal(receiver.held().length, 0);
    consumed = false; policy = 'refuse'; const refused = await sendFile('refused'); await until(() => sender.status(refused.sent.msgId)?.status === 'refused'); assert.equal(fs.existsSync(refused.file.path), true);
    policy = 'accept'; feature = false; const legacy = await sendFile('feature off'); await until(() => accepted.length === 2); assert.equal(fs.existsSync(legacy.file.path), true); assert.equal(accepted[1]?.metadata?.body, 'feature off');
    feature = true; hostId = 'receiver-2'; await sendFile('successor'); await until(() => accepted.length === 3); assert.match(accepted[2]!.text, /peer-uploads\/receiver-2\//);
    await sendPeerFrame(receiver.address, { type: 'user', from: sender.address, from_mode: 'prompting', msg_id: 'malformed-file', message: { role: 'user', content: 'raw' }, file_attachments: [{}] }, { userDir });
    await until(() => accepted.length === 4); assert.equal(accepted[3]?.text, 'raw');
  } finally { await sender.close(); await receiver.close(); fs.rmSync(root, { recursive: true, force: true }); }
});
