// Session journal -> the message list the turn-diff walk reads.
//
// The recovered walk (`ne`, chunk-twzxjzbk.js [18642,20073)) consumes host rows shaped like the
// source's `xe` envelope: a user message carrying the API tool result plus the typed host result as
// a sibling field. This journal records those two separately — `message` for the API exchange and a
// `tool_result` event per actual call — so the projection emits one row per recorded call, in call
// order, and never invents a human turn from a tool row. The batch message the agent appends around
// the results is passed through unchanged; the walk skips it, because its first block is a
// tool_result.
import type { TurnDiffMessage } from './diff-turn.js';
import type { SessionEvent } from './session.js';

export function turnDiffMessages(events: readonly SessionEvent[]): TurnDiffMessage[] {
  const messages: TurnDiffMessage[] = [];
  for (const event of events) {
    if (event.kind === 'message') {
      messages.push({ type: event.message.role, message: { content: event.message.content },
        ...(event.isMeta === undefined ? {} : { isMeta: event.isMeta }) });
      continue;
    }
    if (event.kind === 'tool_result' && event.host !== undefined) {
      messages.push({ type: 'user', message: { content: [{ type: 'tool_result' }] }, toolUseResult: event.host });
    }
  }
  return messages;
}
