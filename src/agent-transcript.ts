// Zee/Lns/gie, 24k7d6mw [210978,211342), j8hqhz0c [44085,44378),
// 3gz7s57c [185681,188242), UTF-16. Journal/native-row adapters: W322 port record.
import type { AgentDescriptor } from './agent-registry.js';
import type { SessionEvent } from './session.js';
import type { TranscriptEntry } from './tui-transcript.js';

export type AgentTranscriptEvent = Extract<SessionEvent, { kind: 'message' | 'tool_start' | 'tool_result' | 'turn_end' | 'compact' }>;
export type AgentTranscriptRecord = AgentTranscriptEvent | { kind: 'pending_input'; id: string; text: string };
export type AgentTranscript = Pick<AgentDescriptor, 'id' | 'name' | 'status' | 'model'> & {
  records: AgentTranscriptRecord[];
  inProgressToolUseIDs: string[];
};
export type AgentViewHost = {
  read(): AgentTranscript | undefined;
  submit(text: string, current: () => boolean): Promise<'child' | 'main' | false | { kind: 'feedback'; text: string }>;
  escape(): void;
  release(): void;
};

export function transcriptEvent(event: SessionEvent): event is AgentTranscriptEvent {
  return event.kind === 'message' || event.kind === 'tool_start' || event.kind === 'tool_result'
    || event.kind === 'turn_end' || event.kind === 'compact';
}

// _Qr, sfn1dbxq [4505646,4505792), UTF-16; host preload/meta filtering and native rows are W322 adapters.
export function agentTranscriptEntries(snapshot: AgentTranscript): TranscriptEntry[] {
  const entries: TranscriptEntry[] = [];
  const tools = new Map<string, { name: string; input: unknown }>();
  for (const [index, event] of snapshot.records.entries()) {
    if (event.kind === 'pending_input') { entries.push({ kind: 'user', text: event.text }); continue; }
    if (event.kind === 'message') {
      if (event.isMeta) continue;
      const human = event.classifier?.origin.kind === 'human' ? event.classifier.humanText : undefined;
      const blocks = human ?? event.message.content;
      if (typeof blocks === 'string') {
        entries.push({ kind: event.message.role, text: blocks,
          ...(event.message.role === 'assistant' ? { markdown: blocks, speaker: true } : {}) });
        continue;
      }
      for (const [blockIndex, block] of blocks.entries()) {
        if (block.type === 'text') entries.push({ kind: event.message.role, text: block.text,
          ...(event.message.role === 'assistant' ? { markdown: block.text, speaker: true,
            messageKey: `${snapshot.id}-${index}-${blockIndex}` } : {}) });
        else if (block.type === 'tool_use') {
          tools.set(block.id, { name: block.name, input: block.input });
          entries.push({ kind: 'tool', text: `${block.name} ${JSON.stringify(block.input)}` });
        }
      }
    } else if (event.kind === 'tool_result') {
      const call = tools.get(event.result.tool_use_id);
      if (call === undefined) continue;
      const content = typeof event.result.content === 'string' ? event.result.content
        : (event.result.content ?? []).flatMap(block => block.type === 'text' ? [block.text] : []).join('\n');
      entries.push({ kind: 'tool', text: '', tool: { id: event.result.tool_use_id, name: call.name,
        input: call.input, content, isError: event.result.is_error === true } });
    } else if (event.kind === 'compact') entries.push({ kind: 'system', text: event.summary });
  }
  return entries;
}

// Ble, 24k7d6mw [705483,706014), UTF-16; the host has local agents, without teammate wording.
export function agentViewCommandGate(name: string, invokedAs: string):
  { kind: 'block'; message: string } | { kind: 'confirm'; title: string; label: string } | undefined {
  switch (name) {
    case 'model': case 'fast':
      return { kind: 'block', message: `/${invokedAs} changes the main conversation's ${name === 'model' ? 'model' : 'fast mode'}, not this agent's` };
    case 'compact': case 'clear': case 'rewind':
      return { kind: 'confirm', title: `/${invokedAs} acts on the main conversation, not this agent`,
        label: `Run /${invokedAs} on the main conversation` };
    default: return;
  }
}
