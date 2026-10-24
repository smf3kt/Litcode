import type Anthropic from '@anthropic-ai/sdk';
import type { SessionConfig } from './session.js';

export type PromptPrediction = { text: string; generationRequestId: string | null };
export type PromptSuggestion = { status: 'empty' }
  | ({ status: 'generated' } & PromptPrediction)
  | ({ status: 'shown'; shownAt: number } & PromptPrediction)
  | ({ status: 'accepted'; shownAt: number; acceptedAt: number } & PromptPrediction);

// we, 4bw62nzm [48523,48750), UTF-16; session lifetime is independent of the completed turn.
export class PromptSuggestionRun {
  abortController: AbortController | null = null;
  eligibleTurns = 0;
  unusedInARow = 0;
  askOnNextTurn(): void { this.eligibleTurns = 0; }
  reset(): void { this.abortController?.abort(); this.abortController = null; }
  arm(): AbortController { this.reset(); return this.abortController = new AbortController(); }
}

// Gun/zun, p2ct4tzw [2280,3053), UTF-16; a local default-false flag replaces the remote rollout.
export function promptSuggestionEnvironment(value = process.env.HARNESS_PROMPT_SUGGESTIONS): boolean | undefined {
  const normalized = value?.toLowerCase().trim();
  if (normalized !== undefined && ['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (normalized !== undefined && ['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return undefined;
}
// Gun, chunk-p2ct4tzw.js [2280,2928), UTF-16: local rollout or an explicit true environment opens availability.
export function promptSuggestionsAvailable(config: Pick<SessionConfig, 'features'>): boolean {
  return config.features?.promptSuggestions === true || promptSuggestionEnvironment() === true;
}
// Gun/zun, chunk-p2ct4tzw.js [2280,3053), UTF-16: environment seeds the live setting once at startup.
export function promptSuggestionsInitiallyEnabled(config: Pick<SessionConfig, 'features' | 'promptSuggestionEnabled'>): boolean {
  return promptSuggestionEnvironment() ?? (config.features?.promptSuggestions === true && config.promptSuggestionEnabled !== false);
}

// O/oNr, p2ct4tzw [3519,4154)/[5389,5622), UTF-16; cache reads do not contribute to this gate.
export function promptPredictionEligible(messages: readonly Anthropic.MessageParam[], response: Anthropic.Message | undefined): boolean {
  if (messages.filter(message => message.role === 'assistant').length < 2) return false;
  if (response === undefined || response.stop_reason === 'refusal') return false;
  const uncached = (response.usage.input_tokens ?? 0) + (response.usage.output_tokens ?? 0);
  return uncached <= 10000 && uncached + (response.usage.cache_creation_input_tokens ?? 0) <= 10000;
}

// $Jn/K2t/yKo/XGr, kyy5nfa1 [1088,1633), UTF-16; the disk adapter preserves the 20/21 latch.
export function promptSuggestionBackedOff(state: { promptSuggestionUnusedStreak: number; firstStartTime?: string }, now = Date.now()): boolean {
  return state.promptSuggestionUnusedStreak >= 20 && promptSuggestionEnvironment() !== true
    && !(now - Date.parse(state.firstStartTime ?? '1970-01-01') < 1209600000);
}
// oNr, chunk-p2ct4tzw.js [3519,4154), UTF-16: advance the ten-turn cadence after the eligibility gates.
export function promptSuggestionTurnEligible(run: PromptSuggestionRun, backedOff: boolean): boolean {
  if (!backedOff) return true;
  const eligible = run.eligibleTurns % 10 === 0;
  run.eligibleTurns++;
  return eligible;
}

// M, p2ct4tzw [5626,7028), UTF-16; product and assistant names are neutralized.
export const PROMPT_PREDICTION_INSTRUCTION = `[SUGGESTION MODE: Suggest what the user might naturally type next into the coding assistant.]

FIRST: Look at the user's recent messages and original request.

Your job is to predict what THEY would type - not what you think they should do.

THE TEST: Would they think "I was just about to type that"?

EXAMPLES:
User asked "fix the bug and run tests", bug is fixed -> "run the tests"
After code written -> "try it out"
Assistant offers options -> suggest the one the user would likely pick, based on conversation
Assistant asks to continue -> "yes" or "go ahead"
Task complete, obvious follow-up -> "commit this" or "push it"
After error or misunderstanding -> silence (let them assess/correct)

Be specific: "run the tests" beats "continue".

NEVER SUGGEST:
- Evaluative ("looks good", "thanks")
- Questions ("what about...?")
- Assistant-voice ("Let me...", "I'll...", "Here's...")
- New ideas they didn't ask about
- Multiple sentences

Stay silent if the next step isn't obvious from what the user said.

Stay silent if a suggestion could be unsafe or inappropriate, including any sensitive topic (security incidents, credentials, harm, private data). Even when the user is doing legitimate security or cybersecurity work, do not predict potentially unsafe actions.

Format: 2-12 words, match the user's style. Or nothing.

Reply with ONLY the suggestion, no quotes or explanation.`;

// R/A/T/L/y/b/w, p2ct4tzw [1555,2161), UTF-16; retain script-weighted counts.
const han = /\p{Script=Han}/u;
const phonetic = /[\p{Script=Hiragana}\p{Script=Katakana}ーｰ\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;
const hangul = /\p{Script=Hangul}/u;
const letter = /[\p{L}\p{N}]/u;
function scriptCounts(text: string) {
  let h = 0, p = 0, k = 0, other = 0;
  for (const character of text) {
    if (han.test(character)) h++;
    else if (phonetic.test(character)) p++;
    else if (hangul.test(character)) k++;
    else if (letter.test(character)) other++;
  }
  return { han: h, phonetic: p, hangul: k, other };
}
function scriptCharacters(text: string): number {
  const { han, phonetic, hangul } = scriptCounts(text);
  return han + phonetic + hangul;
}
export function promptSuggestionWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') return 0;
  let total = 0;
  for (const part of trimmed.split(/\s+/)) {
    const { han, phonetic, hangul, other } = scriptCounts(part);
    total += han === 0 && phonetic === 0 ? 1 : (other + hangul > 0 ? 1 : 0) + han / 2 + phonetic / 4;
  }
  return Math.ceil(total);
}

// W, p2ct4tzw [7695,8225), UTF-16.
export function normalizePromptSuggestion(text: string): string {
  return text.trim()
    .replace(/^<(suggestion|response|output|answer|result)>([\s\S]*)<\/\1>$/i,
      (match: string, tag: string, inner: string) => inner.includes(`</${tag.toLowerCase()}>`)
        || inner.includes(`</${tag.toUpperCase()}>`) ? match : inner)
    .replace(/^\s*(suggested\s+(response|reply|input|prompt)|suggestion|response|reply|answer|output|result|提案|回答|返信|応答|出力|結果|建议|回复|答案|输出|结果|제안|답변|응답|출력|결과)\s*[:：]\s*/i, '')
    .trim();
}

// q, p2ct4tzw [8489,11008), UTF-16; only the diagnostic reason name is neutralized.
export function promptSuggestionRejection(text: string): string | undefined {
  if (!text) return 'empty';
  const lower = text.toLowerCase(), words = promptSuggestionWords(text);
  const rules: [string, () => boolean][] = [
    ['done', () => lower === 'done' || /^\P{L}*(完了(しました)?|完成了?|완료됨?)\P{L}*$/u.test(text)],
    ['meta_text', () => lower === 'nothing found' || lower === 'nothing found.' || lower.startsWith('nothing to suggest') || lower.startsWith('no suggestion') || /\bsilence is\b|\bstay(s|ing)? silent\b/.test(lower) || /^\W*silence\W*$/.test(lower) || /^\P{L}*(沈黙|沉默|静默|침묵|提案(なし|はありません)|特に(なし|ありません)|[无没沒]有?建[议議]|(제안|해당)\s*없음)\P{L}*$/u.test(text)],
    ['meta_wrapped', () => /^(\(.*\)|\[.*\]|（.*）|［.*］|【.*】|〔.*〕)$/.test(text)],
    ['error_message', () => lower.startsWith('api error:') || lower.startsWith('prompt is too long') || lower.startsWith('request timed out') || lower.startsWith('invalid api key') || lower.startsWith('image was too large')],
    ['prefixed_label', () => /^\w+:\s/.test(text)],
    ['too_few_words', () => {
      if (words >= 2 || text.startsWith('/')) return false;
      const count = scriptCharacters(text);
      if (count > 0) return count < 2;
      return !new Set(['yes', 'yeah', 'yep', 'yea', 'yup', 'sure', 'ok', 'okay', 'push', 'commit', 'deploy', 'stop', 'continue', 'check', 'exit', 'quit', 'no']).has(lower);
    }],
    ['too_many_words', () => words > 12],
    ['too_long', () => text.length >= 100],
    ['multiple_sentences', () => /[.!?]\s+[A-Z]|[。！？]\s*[\p{L}\p{N}]/u.test(text)],
    ['has_formatting', () => /[\n*]|\*\*/.test(text)],
    ['evaluative', () => /thanks|thank you|looks good|sounds good|that works|that worked|that's all|nice|great|perfect|makes sense|awesome|excellent/.test(lower) || /^\P{L}*(ありがとう(ございます|ございました)?|助かりました|[谢謝][谢謝][你您]?|感谢[你您]?|感謝します|감사합니다|고마워요?)(\P{L}|的|$)/u.test(text) || /(良さそう|よさそう|いいですね|看起来不错|太好了|完璧|完美|좋네요)(です|ですね|だね)?\P{L}*$/u.test(text)],
    ['assistant_voice', () => /^(let me|i'll|i've|i'm|i can|i would|i think|i notice|here's|here is|here are|that's|this is|this will|you can|you should|you could|sure,|of course|certainly|让我(?!们)|我来|我会|我将)/i.test(text)],
  ];
  for (const [reason, matches] of rules) if (matches()) return reason;
  return undefined;
}
