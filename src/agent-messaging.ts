import path from 'node:path';
import { z } from 'zod';
import { createAgentNames } from './agent-names-source.js';
import { createAgentResolver } from './agent-resolver-source.js';
import { createAgentRoster } from './agent-roster-source.js';
import { xh } from './agent-address-source.js';
import { createAgentRegistryTools, type AgentRegistry } from './agent-registry.js';
import { peerAddress, type LocalPeerTransport, type PeerRecord } from './local-peer.js';
import type { AgentCandidateIndex, AgentMessagePin, AgentResolvedTarget, AgentResolverAvailability, AgentResolverState } from './agent-messaging-host.js';
import type { Session } from './session.js';
import type { ToolContext, ToolDefinition } from './tools.js';
import { capChildOutput } from './subagents.js';

// Ps/Ns, 1fr2177j [33220,33279)/[34527,35744), UTF-16.
const sendSchema = z.object({ id: z.string().min(1).regex(/^[^\n\r]*$/u).regex(/^[\s\S]{0,300}$/u), message: z.string().optional(), notify_when_idle: z.boolean().default(false),
  expires_ms: z.number().int().min(1).max(1_800_000).optional() }).strict();

export function createUnifiedAgentTools(registry: AgentRegistry, options: {
  owner: string;
  peer: () => LocalPeerTransport | undefined;
  session: () => Session | undefined;
  idle?: boolean;
  enableAdvanced?: boolean;
  assertCurrent: () => void;
}): ToolDefinition[] {
  const names = createAgentNames({ sessionId: () => options.owner, socket: () => options.peer()?.address.slice(4) });
  const resolver = createAgentResolver({ names, isChildId: id => registry.list().some(child => child.id === id) });
  const roster = createAgentRoster(names.printed);
  const ephemeralPins: Record<string, AgentMessagePin> = Object.create(null);
  const pins = (): Record<string, AgentMessagePin> => {
    const session = options.session();
    if (session === undefined) return ephemeralPins;
    const result: Record<string, AgentMessagePin> = Object.create(null);
    for (const event of session.events) if (event.kind === 'agent_message_pin') result[event.key] = event.pin;
    return result;
  };
  const savePin = (key: string, pin: AgentMessagePin): void => {
    options.assertCurrent();
    const old = pins()[key];
    if (old?.id === pin.id && old.name === pin.name && old.sock === pin.sock) return;
    const session = options.session();
    if (session) session.append({ kind: 'agent_message_pin', key, pin });
    else ephemeralPins[key] = pin;
  };
  const snapshot = async () => {
    const children = registry.list(), state: AgentResolverState = { agentNameRegistry: new Map(), tasks: Object.create(null), sendMessagePins: pins() };
    for (const child of children) {
      const detail = registry.detail(child.id);
      state.tasks[child.id] = { id: child.id, type: 'local_agent', agentType: child.subagent_type ?? child.mode,
        status: child.status === 'queued' ? 'running' : child.status, startTime: detail?.startedAt ?? 0,
        ...(child.status === 'cancelled' ? { stoppedByUser: true } : {}) };
      if (child.name !== null) state.agentNameRegistry.set(child.name, child.id);
    }
    let records: PeerRecord[] = [], unavailable = false;
    const peer = options.peer();
    if (peer) try { records = await peer.records(); } catch { unavailable = true; }
    const index = names.index(state, { teamFile: null, sessions: records, cloud: [], bridge: [] });
    const availability: AgentResolverAvailability = { bridgeSettled: true, cloudUnavailable: false, bridgeUnavailable: false,
      localUnavailable: unavailable, localClaimedRemoteBodies: new Set(), socksMirroredRemotely: new Set(), searchTruncated: false };
    return { children, state, records, index, availability, peer };
  };
  const encode = (value: unknown, context: ToolContext) => capChildOutput(JSON.stringify(value), context.maxOutputBytes);
  const tools = createAgentRegistryTools(registry, { idle: options.idle, enableAdvanced: options.enableAdvanced });
  return tools.map(tool => {
    if (tool.schema.name === 'list_agents') return {
      ...tool,
      schema: { ...tool.schema, description: 'List this session\'s children and other live same-host sessions. Each row has a kind and an exact name or ID. Use send_message with that name; append a printed [ref] to choose among same-host namesakes. A child name takes precedence over a same-host name; use its uds: address in that case.' },
      async execute(raw, context) {
        context.signal.throwIfAborted(); registry.assertCaller(context.session); z.object({}).strict().parse(raw);
        const current = await snapshot(); context.signal.throwIfAborted(); options.assertCurrent();
        const candidates = new Map(current.index.candidates.map(candidate => [`${candidate.kind}\0${candidate.id}`, candidate]));
        const sections = [];
        if (current.children.length) sections.push(roster.subagents(current.children.map(child => ({ agentId: child.id,
          ...(child.name === null ? {} : { name: child.name }), agentType: child.subagent_type ?? child.mode,
          status: child.status, startTime: current.state.tasks[child.id]!.startTime })), candidates));
        if (current.records.length) sections.push(roster.section('sessions', 'Peer sessions', current.records.map(record => {
          const candidate = candidates.get(`session\0${record.sock}`);
          // ie local rows, w9kaj2q7 [9679,11556), UTF-16.
          return roster.row(roster.candidate(candidate, names.display(record.name || path.basename(record.cwd)), '(untitled)'),
            [record.kind === undefined ? undefined : { type: record.kind }, record.status === undefined ? undefined : { status: record.status },
              `started ${roster.age(Date.now() - record.startedAt)} ago`]);
        })));
        const notes = current.availability.localUnavailable ? [{ kind: 'local_list_failed', text: 'The local session list could not be read. A later listing retries.' }] : [];
        return encode({ listing: [...sections.map(section => section.text), ...notes.map(note => note.text)].join('\n\n') || 'No reachable agents.',
          sections: sections.map(section => ({ kind: section.kind, total: section.total, rows: section.rows.map(row => row.agent) })), notes,
          children: current.children, peers: current.records.map(record => ({ address: peerAddress(record.sock), pid: record.pid,
            ...(record.sessionId === undefined ? {} : { session_id: record.sessionId }) })) }, context);
      },
    } satisfies ToolDefinition;
    if (tool.schema.name !== 'send_message') return tool;
    return {
      ...tool,
      schema: { ...tool.schema, description: 'Send to a child ID/name or another same-host session\'s listed name, printed name [ref], or uds: address. Child names take precedence. An optional notify_when_idle requests one notice; omitting message creates a pure subscription. A changed recipient name requires a current printed [ref].',
        input_schema: { type: 'object', properties: { id: { type: 'string', minLength: 1, maxLength: 300 }, message: { type: 'string' },
          ...(options.idle ? { notify_when_idle: { type: 'boolean' }, expires_ms: { type: 'integer', minimum: 1, maximum: 1_800_000 } } : {}) }, required: ['id'], additionalProperties: false } },
      async execute(raw, context) {
        context.signal.throwIfAborted(); registry.assertCaller(context.session); const args = sendSchema.parse(raw);
        if (!options.idle && (args.notify_when_idle || args.expires_ms !== undefined)) throw new Error('Idle subscription is disabled');
        const message = args.message ?? '';
        if (message.trim().length === 0 && !args.notify_when_idle) throw new Error('Message or idle subscription is required');
        const current = await snapshot(); context.signal.throwIfAborted(); options.assertCurrent();
        const address = xh(args.id);
        let target: AgentResolvedTarget;
        if (address.scheme === 'uds') {
          if (!current.peer) return encode({ success: false, reason: 'no-inbox' }, context);
          const sock = names.canonical(address.target);
          if (sock === undefined) return encode({ success: false, reason: 'invalid-target' }, context);
          target = { kind: 'local-session', sock, pinId: sock, displayName: args.id };
        } else if (address.scheme !== 'other') return encode({ success: false, reason: 'non-local' }, context);
        else {
          const childId = current.children.find(child => child.id === args.id || child.id === names.key(args.id));
          const child = childId ?? current.children.find(child => child.name === args.id)
            ?? current.children.find(child => child.name !== null && names.key(child.name) === names.key(args.id));
          const parsed = names.parseRef(args.id), key = names.key(parsed?.name ?? args.id);
          if (args.id === 'main') target = { kind: 'main' };
          // zUt, n2jtmdcb [7410,11760), UTF-16.
          else if (child) target = resolver.child(current.state, child.id, childId ? args.id : child.name ?? child.id);
          else if (parsed) {
            const candidate = resolver.byRef(current.index, key, parsed.ref);
            target = candidate ? resolver.route(candidate, current.state) : resolver.missing(key, current.index);
          } else target = resolver.exact(current.index, key, args.id, current.state, current.availability)
            ?? resolver.prefix(current.index, key, current.state, current.availability) ?? resolver.missing(key, current.index);
        }
        if (target.kind === 'main') return encode({ success: false, reason: 'self-target' }, context);
        if (target.kind === 'agent-stopped-by-user') return encode({ success: false, reason: 'agent-stopped-by-user' }, context);
        if (target.kind === 'ambiguous' || target.kind === 'not-found') return encode({ success: false, ...target }, context);
        const named = address.scheme === 'other';
        const recipientName = target.kind === 'local-session' ? target.displayName : target.agentName;
        const key = names.key(recipientName), id = target.kind === 'local-session' ? target.pinId : target.agentId;
        const previous = current.state.sendMessagePins[key];
        const explicitRef = names.parseRef(args.id);
        // kjo/Q7e, 0767hfs9 [1205,2330), n2jtmdcb [2495,2856), UTF-16.
        if (named && previous && previous.id !== id && explicitRef === null)
          return encode({ success: false, reason: 'recipient-rebound', previous,
            candidates: current.index.byName.get(key) ?? [] }, context);
        const pin: AgentMessagePin = { id, name: recipientName, ref: names.ref(target.kind === 'local-session' ? 'session' : 'subagent', id),
          ...(target.kind === 'local-session' ? { sock: target.sock } : {}) };
        if (target.kind !== 'local-session') {
          savePin(key, pin);
          return encode(await registry.sendMessage(target.agentId, message.trim().length ? message : undefined, context.signal,
            { notifyWhenIdle: args.notify_when_idle, expiresMs: args.expires_ms }), context);
        }
        const peer = current.peer;
        if (!peer) return encode({ success: false, reason: 'no-inbox' }, context);
        if (names.canonical(peer.address.slice(4)) === names.canonical(target.sock)) return encode({ success: false, reason: 'self-target' }, context);
        const record = current.records.find(row => names.canonical(row.sock) === names.canonical(target.sock));
        if (named && !record) return encode({ success: false, reason: 'peer-gone' }, context);
        try {
          // SendMessage local-session, 1fr2177j [85447,88430), UTF-16.
          const sent = message.trim().length ? await peer.send(peerAddress(target.sock), message, { signal: context.signal,
            expectPeerPid: record?.pid, expectPeerProcStart: record?.procStart ?? record?.procStartFt }) : undefined;
          options.assertCurrent(); context.signal.throwIfAborted();
          const subscription = args.notify_when_idle ? await peer.subscribeIdle(peerAddress(target.sock), context.signal) : undefined;
          if (named && (sent || subscription?.success || subscription?.success === false && subscription.reason === 'send-uncertain')) savePin(key, pin);
          return encode({ success: sent !== undefined || subscription?.success === true,
            ...(sent ? { msg_id: sent.msgId } : {}), ...(subscription ? { subscription } : {}) }, context);
        } catch (error) {
          return encode({ success: false, reason: error instanceof Error ? error.message : String(error) }, context);
        }
      },
    } satisfies ToolDefinition;
  });
}
