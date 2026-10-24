// iCn/Zor/aCn/lCn/_tt [4219665,4221217), chunk-sfn1dbxq.js, zero-based UTF-16.
// Source digests and final-response/stream adapters: research/ports/W321-agent-details.md.
import type Anthropic from '@anthropic-ai/sdk';

export type AgentActivity = { toolName: string; input: unknown; recordedAtMs: number; toolUseId: string };
export type AgentDetailProgress = { toolUseCount: number; tokenCount: number; recentActivities: AgentActivity[] };
export type AgentProgressTracker = {
  toolUseCount: number; latestInputTokens: number; cumulativeOutputTokens: number;
  streamedTokenEstimate: number; streamedTokenEstimateAtResponseStart: number;
  lastStampedResponseId: string | undefined; recentActivities: AgentActivity[]; seenToolUseIds: Set<string>;
};

export function createAgentProgress(): AgentProgressTracker {
  return { toolUseCount: 0, latestInputTokens: 0, cumulativeOutputTokens: 0, streamedTokenEstimate: 0,
    streamedTokenEstimateAtResponseStart: 0, lastStampedResponseId: undefined, recentActivities: [], seenToolUseIds: new Set() };
}

export function agentProgressSnapshot(tracker: AgentProgressTracker): AgentDetailProgress {
  return { toolUseCount: tracker.toolUseCount,
    tokenCount: tracker.latestInputTokens + tracker.cumulativeOutputTokens + tracker.streamedTokenEstimate,
    recentActivities: structuredClone(tracker.recentActivities) };
}

export function observeAgentStream(tracker: AgentProgressTracker,
  event: { type: 'response_start' } | { type: 'tokens'; estimatedTokensDelta: number }): void {
  switch (event.type) {
    case 'response_start': tracker.streamedTokenEstimateAtResponseStart = tracker.streamedTokenEstimate; return;
    case 'tokens': tracker.streamedTokenEstimate += event.estimatedTokensDelta; return;
  }
}

export function observeAgentResponse(tracker: AgentProgressTracker, message: Anthropic.Message): void {
  const usage = message.usage;
  if (typeof usage.input_tokens === 'number' && typeof usage.output_tokens === 'number') {
    tracker.latestInputTokens = usage.input_tokens + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
    tracker.cumulativeOutputTokens += usage.output_tokens;
    if (message.id !== tracker.lastStampedResponseId) {
      tracker.lastStampedResponseId = message.id;
      tracker.streamedTokenEstimate -= tracker.streamedTokenEstimateAtResponseStart;
      tracker.streamedTokenEstimateAtResponseStart = 0;
    }
  }
  for (const block of message.content) {
    if (block.type !== 'tool_use') continue;
    tracker.toolUseCount++;
    if (block.name === 'StructuredOutput' || block.name === 'REPL') continue;
    if (tracker.seenToolUseIds.has(block.id)) continue;
    tracker.seenToolUseIds.add(block.id);
    tracker.recentActivities.push({ toolName: block.name, input: block.input, recordedAtMs: Date.now(), toolUseId: block.id });
  }
  while (tracker.recentActivities.length > 5) tracker.recentActivities.shift();
}
