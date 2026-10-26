import { z } from 'zod';
import type { AskUserQuestionAnswer, AskUserQuestionRequest } from './interaction-tools.js';

// le/z/J/Se, ktr9sak2 [2202,4005)/[4845,4988)/[9560,9924)/[11698,12225), UTF-16.
// Parse entries before rebuilding the map because z.record drops the question named __proto__.
function questionRecord<T>(valueSchema: z.ZodType<T>) {
  return z.unknown().transform((value, context) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Expected a question-keyed record' });
      return z.NEVER;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Expected a plain question-keyed record' });
      return z.NEVER;
    }
    return Object.entries(value);
  }).pipe(z.array(z.tuple([z.string(), valueSchema]))).transform(entries => {
    const result: Record<string, T> = Object.create(null);
    for (const [key, value] of entries) result[key] = value;
    return result;
  });
}

// Se/ke/fX, ktr9sak2 [11698,12443)/[12897,19623), UTF-16.
const resultQuestionSchema = z.object({
  question: z.string(), header: z.string().optional(),
  options: z.array(z.object({ label: z.string(), description: z.string().optional(), preview: z.string().optional() })).default(() => []),
  multiSelect: z.boolean().optional(), kind: z.enum(['choice', 'text', 'number']).optional(),
  description: z.string().optional(), placeholder: z.string().optional(), min: z.number().optional(), max: z.number().optional(),
  step: z.number().optional(), defaultValue: z.number().optional(), unit: z.string().optional(),
});
export const questionHostResultSchema = z.object({
  kind: z.literal('questions'), questions: z.array(resultQuestionSchema), answers: questionRecord(z.string()),
  annotations: questionRecord(z.object({ preview: z.string().optional(), notes: z.string().optional() }).strict()).optional(),
  response: z.string().optional(), followUp: z.literal(true).optional(), afkTimeoutMs: z.number().int().positive().optional(),
}).strict();
export type QuestionHostResult = z.infer<typeof questionHostResultSchema>;
const cardResultSchema = questionHostResultSchema.omit({ kind: true }).extend({
  answers: questionHostResultSchema.shape.answers.default(() => ({})), followUp: z.boolean().optional(),
}).strip();

// fX.create.call, ktr9sak2 [16872,17748), UTF-16.
export function cardQuestionResult(input: unknown): QuestionHostResult {
  const { response, followUp, ...result } = cardResultSchema.parse(input);
  return { kind: 'questions', ...result, ...(response?.trim() ? { response } : {}), ...(followUp === true ? { followUp } : {}) };
}

// P3/fX, 24k7d6mw [1178668,1179279), ktr9sak2 [16872,17748), UTF-16.
export function indexedQuestionResult(request: AskUserQuestionRequest, answer: AskUserQuestionAnswer): QuestionHostResult {
  const answers: Record<string, string> = Object.create(null);
  const annotations: NonNullable<QuestionHostResult['annotations']> = Object.create(null);
  for (const entry of answer.answers) {
    const question = request.questions[entry.questionIndex];
    if (!question) continue;
    const parts = [...entry.selected, ...(entry.other === undefined ? [] : [entry.other])];
    const [first] = parts;
    if (first !== undefined) answers[question.question] = question.multiSelect ? joinQuestionAnswers(parts) : first;
    if (entry.annotations !== undefined) annotations[question.question] = entry.annotations;
  }
  return { kind: 'questions', questions: request.questions, answers, annotations,
    ...(answer.afkTimeoutMs === undefined ? {} : { afkTimeoutMs: answer.afkTimeoutMs }) };
}

// qht/L, ktr9sak2 [1397,2011), UTF-16.
export function joinQuestionAnswers(parts: readonly string[]): string {
  return parts.map(part => part.includes(', ') || part.includes('"') ? JSON.stringify(part) : part).join(', ');
}
function splitQuestionAnswers(input: string): string[] | null {
  const parts: string[] = [];
  let rest = input;
  for (;;) {
    if (rest.startsWith('"')) {
      let end = -1, escaped = false;
      for (let index = 1; index < rest.length; index++) {
        const char = rest[index];
        if (escaped) { escaped = false; continue; }
        if (char === '\\') { escaped = true; continue; }
        if (char === '"') { end = index; break; }
      }
      if (end === -1) return null;
      try {
        const part: unknown = JSON.parse(rest.slice(0, end + 1));
        if (typeof part !== 'string') return null;
        parts.push(part);
      } catch { return null; }
      rest = rest.slice(end + 1);
    } else {
      const end = rest.indexOf(', '), part = end === -1 ? rest : rest.slice(0, end);
      if (part.includes('"')) return null;
      parts.push(part); rest = end === -1 ? '' : rest.slice(end);
    }
    if (rest === '') break;
    if (!rest.startsWith(', ')) return null;
    rest = rest.slice(2);
    if (rest === '') return null;
  }
  return parts;
}

// fX.mapToolResultToToolResultBlockParam, ktr9sak2 [17751,19621), UTF-16.
export function questionResultText(result: QuestionHostResult): string {
  const { questions, answers, annotations, response, afkTimeoutMs, followUp } = result;
  const selected = questions.map(({ question }) => {
    const value = Object.hasOwn(answers, question) ? answers[question] : undefined;
    const note = annotations && Object.hasOwn(annotations, question) ? annotations[question] : undefined;
    const taken = value && value !== '(notes only)';
    if (!taken && !note?.notes) return null;
    const parts = [taken ? `"${question}"="${value}"` : `"${question}"=(no option selected)`];
    if (note?.preview) parts.push(`selected preview:\n${note.preview}`);
    if (note?.notes) parts.push(`notes: ${note.notes}`);
    return parts.join(' ');
  }).filter(value => value !== null).join(', ');
  if (afkTimeoutMs) {
    const notice = `No response after ${Math.round(afkTimeoutMs / 1000)}s — the user may be away from keyboard. ` +
      'Proceed using your best judgment based on the context so far; you can re-ask this question later if it\'s still relevant.';
    return selected ? `${notice}\n\nBefore going idle the user had selected: ${selected}.` : notice;
  }
  if (followUp) {
    const extra = response?.trim() ? ` They also wrote: "${response}".` : '';
    return selected
      ? `The user asked for more questions before you proceed. So far they answered: ${selected}.${extra} Call ask_user_question again with follow-up questions that build on these answers (do not repeat these); do not start the task yet.`
      : `The user asked for more questions before answering.${extra} Call ask_user_question again now with further questions about this decision (do not repeat these); do not proceed with the task yet.`;
  }
  if (response?.trim()) return `The user responded: ${response}`;
  if (!selected) return 'The user did not answer the questions.';
  const structured = questions.every(({ question, options, multiSelect, kind, min, max }) => {
    if (annotations && Object.hasOwn(annotations, question) && annotations[question]?.notes) return false;
    const value = Object.hasOwn(answers, question) ? answers[question] : undefined;
    if (kind === 'text' || kind === 'number') {
      if (value === undefined || value === '') return true;
      if (kind === 'text') return false;
      const text = value.trim(), number = Number(text);
      return /^-?\d+(\.\d+)?$/.test(text) && Number.isFinite(number) && (min === undefined || number >= min) && (max === undefined || number <= max);
    }
    const labels = new Set(options.map(option => option.label));
    if (!value || value === '(notes only)') return true;
    if (labels.has(value)) return true;
    if (!multiSelect) return false;
    const parts = splitQuestionAnswers(value);
    return parts !== null && parts.length >= 1 && joinQuestionAnswers(parts) === value && parts.every(part => labels.has(part));
  });
  return structured ? `Your questions have been answered: ${selected}. You can now continue with these answers in mind.`
    : `The user answered: ${selected}. Read the answers carefully — they may request clarification, changes, or that you not proceed — and follow what they actually say.`;
}

// Dh/jh/Nh/F_/O_/B_, phg89898 [46384,48473)/[48525,48700), UTF-16.
export function questionResultLines(result: QuestionHostResult): string[] {
  const entries = Object.entries(result.answers), supplied = Boolean(result.response) || entries.length > 0;
  if (result.afkTimeoutMs) return ['Questions asked:',
    ...(entries.length ? entries.map(([question, value]) => `· ${question} → ${value}`)
      : result.questions.map(question => `· ${question.question} (${question.options.map(option => option.label).join(' / ')})`)),
    `No response after ${Math.round(result.afkTimeoutMs / 1000)}s — ${entries.length ? 'continued with the answers selected so far' : 'continued without an answer'}`];
  if (!result.followUp && !supplied) return [];
  return [result.followUp ? supplied ? 'User asked for more questions (so far):' : 'User asked for more questions' : 'User answered questions:',
    ...(result.followUp || !result.response ? entries.map(([question, value]) => `· ${question} → ${value}`) : []),
    ...(result.response ? [`· ${result.response}`] : [])];
}
