import type Anthropic from '@anthropic-ai/sdk';

/**
 * `/btw` asks one question against the conversation without touching it, ported from the recovered
 * application. Coordinates are zero-based UTF-16 offsets in the extracted modules.
 *
 * - `chunk-d3s5r8h5.js` (SHA-256
 *   202506d3996b4fffe72418c623c884a93169f9352a17331ba6268b2e2eb4e2db): `d3n` 320 the slash
 *   notice (already ported in `./tui-input-highlights-source.js`), the five companion strings at
 *   1005, `kmt` 1289 the side request, `x` 3457 the fork-context tool placeholder, `N` 4300 the
 *   answer classifier, `T` 4757 the API-error event test.
 * - `chunk-qskwh3r4.js` (SHA-256
 *   502871b1307a183388e1c2d295749e7a64d266b330b49fbe4e155e4e899ed588): `we` 1877 the panel
 *   state, its history window and the `[`/`]`, `x`, `c` and close keys.
 * - `chunk-5b2hxy2e.js`: `Qd` 8863 the tool-call text detector, `NLr` 9077.
 * - `chunk-hb620t8k.js` 12324: `Al`, the `API Error` prefix the synthetic reply strips.
 */

/** The reminder the side call receives instead of tools; the source string plus its trailing gap. */
export const SIDE_QUESTION_REMINDER = `<system-reminder>This is a side question from the user. You must answer this question directly in a single response.

IMPORTANT CONTEXT:
- You are a separate, lightweight agent spawned to answer this one question
- The main agent is NOT interrupted - it continues working independently in the background
- You share the conversation context but are a completely separate instance
- Do NOT reference being interrupted or what you were "previously doing" - that framing is incorrect

CRITICAL CONSTRAINTS:
- You have NO tools available - you cannot read files, run commands, search, or take any actions
- Do NOT write tool calls or tool output as text (for example invoke or function_calls XML blocks) - nothing you write here is executed; if answering would need reading files, running commands, or searching, say that can't be checked from a side question and suggest asking in the main conversation
- This is a one-off response - there will be no follow-up turns
- You can ONLY provide information based on what you already know from the conversation context
- NEVER say things like "Let me try...", "I'll now...", "Let me check...", or promise to take any action
- If you don't know the answer, say so - do not offer to look it up or investigate

Simply answer the question with the information you have.</system-reminder>

`;

/** Source `M`: the notice under an answer that wrote tool calls as text. */
export const SIDE_QUESTION_TOOL_NOTE = "_/btw can't run tools: any tool calls or tool output shown above were not executed and may not reflect your actual files or data. Ask in the main conversation to check._";
/** Source `_`: what a history entry shows instead of such an answer. */
export const SIDE_QUESTION_TOOL_HISTORY = '(That answer wrote tool calls as text. Nothing was executed, so it is omitted here.)';
/** Source `b`: the notice under an answer the provider cut off. */
export const SIDE_QUESTION_TRUNCATED_NOTE = '_(This answer was cut off before it finished. Ask again to retry.)_';
/** Source `E`: what a history entry shows instead of such an answer. */
export const SIDE_QUESTION_TRUNCATED_HISTORY = '(That answer was cut off before it finished, so it is omitted here.)';
/** Source `k`: the placeholder a tool call without a result receives in fork context. */
export const SIDE_QUESTION_NO_RESULT = '[No result yet — this call is still in progress in the main conversation (running, awaiting approval, or queued)]';
/** Source `Al`: the prefix a synthetic API-error reply strips. */
export const API_ERROR_PREFIX = 'API Error';

/** Source `Qd`: a written-out tool-call block, which a side answer must never be trusted to hold. */
export const TOOL_CALL_TEXT = /<(?:antml:)?(?:function_calls>|invoke name=)|<\/(?:antml:)?(?:function_calls|invoke)>/;

/** Source `NLr`: joins the tool-call detector over the first slash of the file. */
export function sideQuestionHasToolCalls(text: string): boolean {
  return TOOL_CALL_TEXT.test(text);
}

/** Source `Co` with the caller's `\n\n` separator: every text block of a message set. */
export function joinTextBlocks(blocks: Iterable<{ type: string; text?: string }>): string {
  return [...blocks].filter((block): block is { type: 'text'; text: string } =>
    block.type === 'text' && typeof block.text === 'string').map(block => block.text).join('\n\n');
}

export interface SideQuestionExchange { question: string; response: string }

/**
 * Source `kmt`'s history arm: prior exchanges become plain user/assistant text. An answer that
 * wrote tool calls or was cut off is replaced by its omission note, because the side call must not
 * treat unexecuted tool text as fact.
 */
export function sideQuestionHistoryText(response: string): string {
  if (sideQuestionHasToolCalls(response)) return SIDE_QUESTION_TOOL_HISTORY;
  if (response.endsWith(SIDE_QUESTION_TRUNCATED_NOTE)) return SIDE_QUESTION_TRUNCATED_HISTORY;
  return response;
}

/** Source `kmt`: the reminder block and the question block, in that order. */
export function sideQuestionUserContent(question: string): { type: 'text'; text: string }[] {
  return [{ type: 'text', text: SIDE_QUESTION_REMINDER }, { type: 'text', text: question }];
}

export interface SideQuestionOutcome { response: string | null; synthetic: boolean }

/**
 * Source `N`: a side call's assistant messages become one answer. Text wins; the tool-call and
 * truncation notices follow it. Without text, a tool call or an API error becomes a synthetic
 * reply that the panel does not add to history. `null` means the call produced nothing usable.
 */
export function classifySideQuestion(messages: readonly Anthropic.Message[]): SideQuestionOutcome {
  const apiError = messages.find(message => (message as { isApiErrorMessage?: boolean }).isApiErrorMessage === true);
  // Source `n`: API-error messages are excluded from the answer text and only feed the synthetic
  // branch below, so their payload never becomes a normal answer.
  const blocks = messages.filter(message => message !== apiError).flatMap(message => message.content);
  const text = joinTextBlocks(blocks).trim();
  if (text) {
    const suffix = [
      ...(sideQuestionHasToolCalls(text) ? [SIDE_QUESTION_TOOL_NOTE] : []),
      ...(apiError ? [SIDE_QUESTION_TRUNCATED_NOTE] : []),
    ];
    return { response: [text, ...suffix].join('\n\n'), synthetic: false };
  }
  const tool = blocks.find(block => block.type === 'tool_use');
  if (tool && tool.type === 'tool_use') {
    return { response: `(The model tried to call ${tool.name} instead of answering directly. Try rephrasing or ask in the main conversation.)`, synthetic: true };
  }
  if (apiError) {
    const errorText = joinTextBlocks(apiError.content).trim();
    const message = errorText.startsWith(`${API_ERROR_PREFIX}: `) ? errorText.slice(API_ERROR_PREFIX.length + 2) : errorText;
    return { response: `(API error: ${message})`, synthetic: true };
  }
  return { response: null, synthetic: false };
}

/** The panel body: the asked question, then the answer or the synthetic reply. */
export function sideQuestionPanelText(question: string, response: string | null, fallbackNotice?: string): string {
  const head = `/btw ${question}`;
  const notice = fallbackNotice === undefined ? '' : `⚠ ${fallbackNotice}\n\n`;
  return response === null ? head : `${head}\n\n${notice}${response}`;
}

/** The bare-command line for a session without a modal surface. */
export const SIDE_QUESTION_USAGE = 'Usage: /btw <question>';
/** The input prompt for a bare `/btw` at a terminal. */
export const SIDE_QUESTION_PROMPT = 'Ask a quick side question without interrupting the main conversation.';
/** Source `Re`: the error line when the call produced no usable answer. */
export const SIDE_QUESTION_NO_RESPONSE = 'No response received';
/** Source `qskwh3r4.js` footer: the copy confirmation. */
export const SIDE_QUESTION_COPIED = 'Copied to clipboard';
