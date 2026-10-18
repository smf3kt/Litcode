import type Anthropic from '@anthropic-ai/sdk';
import type { ModelProvider, ModelRequest } from './provider.js';
import { O0e, Jdo, Jgs, j0e, CLt, xLt, ico, zuo, quo } from './auto-classifier-source.js';
import { AUTO_RULES } from './auto-classifier-rules-source.js';

export type AutoAssessment = {
  stage: 'fast' | 'thinking'; attempts: number; messageId: string;
  verdict: boolean | null; reason?: string; category?: string; thinking?: string;
};
export type AutoDecision =
  | { kind: 'allow'; classifierRan: true; assessments: AutoAssessment[] }
  | { kind: 'block'; classifierRan: true; reason: string; category?: string; assessments: AutoAssessment[] }
  | { kind: 'no-verdict'; classifierRan: true; failure: 'unparseable' | 'policy-refusal'; reason: string; assessments: AutoAssessment[] }
  | { kind: 'unavailable'; classifierRan: true; reason: string; assessments: AutoAssessment[] }
  | { kind: 'cancelled'; classifierRan: true; reason: string; assessments: AutoAssessment[] };

export type AutoPolicy = { allow?: string[]; soft_deny?: string[]; hard_deny?: string[]; environment?: string[] };
export function classifierSystem(denyRules: readonly string[], overrides?: AutoPolicy): string {
  // Wuo [1090128,1090941), UTF-16. Account/project/remote attribution branches are absent locally.
  const prompt = O0e().replace('<cross_session_messages_rule>', '').replace('<permissions_template>',
    `<cc_automode_permissions>\n${AUTO_RULES}\n</cc_automode_permissions>`);
  return Jdo(prompt, { allow: overrides?.allow, softDeny: overrides?.soft_deny,
    hardDeny: overrides?.hard_deny, environment: overrides?.environment,
    settingsDenyBlock: Jgs([...denyRules]) }, { collapseEmptySlotLines: false })
    .replaceAll('Claude Code', 'the coding agent').replaceAll('Claude-in-Chrome', 'browser');
}
const responseText = (response: Anthropic.Message) => response.content.flatMap(block => block.type === 'text' ? [block.text] : []).join('');

/** lco/OLt/B0e, sfn [1096896,1104081)/[1106686,1107369)/[1105290,1105951), UTF-16. */
export async function classifyAutoAction(options: {
  provider: ModelProvider; model: string; system: string; transcript: string; signal: AbortSignal;
}): Promise<AutoDecision> {
  const assessments: AutoAssessment[] = [];
  let provisional: AutoAssessment | undefined;
  let firstRefused = false;
  const stageOneDeadline = Math.min(120_000, 60_000 + Math.max(0, Math.ceil((Buffer.byteLength(options.system + options.transcript) / 4 - 50_000) / 50_000)) * 10_000);
  try {
    for (const stage of ['fast', 'thinking'] as const) {
      options.signal.throwIfAborted();
      const controller = new AbortController();
      const forward = () => controller.abort(options.signal.reason);
      options.signal.addEventListener('abort', forward, { once: true });
      const timer = setTimeout(() => controller.abort(new Error('Classifier deadline exceeded')), stage === 'fast' ? stageOneDeadline : 120_000);
      timer.unref();
      let response: Anthropic.Message;
      let attempts = 0;
      try {
        const request: ModelRequest = { model: options.model, max_tokens: stage === 'fast' ? 64 : 8192,
          system: options.system, messages: [{ role: 'user', content: `<transcript>\n${options.transcript}</transcript>\n${stage === 'fast' ? zuo : quo}` }],
          ...(stage === 'fast' ? { stop_sequences: ['</block>'] } : {}) };
        // Only unparseable output retries. SDK transport retries remain inside the same owned deadline.
        do {
          controller.signal.throwIfAborted();
          attempts++;
          response = await options.provider.complete(request, controller.signal);
          controller.signal.throwIfAborted();
          const text = responseText(response);
          if (j0e(text) !== null || response.stop_reason === 'refusal' || text === '' &&
            response.stop_reason !== 'max_tokens' && response.stop_reason !== 'model_context_window_exceeded') break;
        } while (attempts <= 4);
      } finally {
        clearTimeout(timer);
        options.signal.removeEventListener('abort', forward);
      }
      options.signal.throwIfAborted();
      const raw = responseText(response);
      const verdict: boolean | null = j0e(raw);
      const category = xLt(raw)?.slug;
      const reason: string | null = CLt(raw);
      const thinking: string | null = ico(raw);
      const assessment: AutoAssessment = { stage, attempts, messageId: response.id, verdict,
        ...(reason === null ? {} : { reason }), ...(category === undefined ? {} : { category }),
        ...(thinking === null ? {} : { thinking }) };
      assessments.push(assessment);
      if (verdict === false) return { kind: 'allow', classifierRan: true, assessments };
      if (stage === 'fast') {
        firstRefused = verdict === null && response.stop_reason === 'refusal';
        if (verdict === true) provisional = assessment;
        continue;
      }
      if (verdict === true) return { kind: 'block', classifierRan: true,
        reason: reason ?? 'No reason provided', ...(category === undefined ? {} : { category }), assessments };
      if (provisional && response.stop_reason === 'refusal') return { kind: 'block', classifierRan: true,
        reason: provisional.reason ?? 'Blocked by fast classifier', category: provisional.category, assessments };
      const refused = firstRefused || response.stop_reason === 'refusal' || raw === '' &&
        response.stop_reason !== 'max_tokens' && response.stop_reason !== 'model_context_window_exceeded';
      return { kind: 'no-verdict', classifierRan: true, failure: refused ? 'policy-refusal' : 'unparseable',
        reason: refused ? 'Classifier returned no policy verdict' : 'Classifier response could not be parsed', assessments };
    }
  } catch {
    if (options.signal.aborted) return { kind: 'cancelled', classifierRan: true, reason: 'Classifier request aborted', assessments };
    if (firstRefused) return { kind: 'no-verdict', classifierRan: true, failure: 'policy-refusal',
      reason: 'Classifier returned no policy verdict', assessments };
    if (assessments.length) return { kind: 'block', classifierRan: true,
      reason: provisional?.reason ?? 'Stage 2 classifier error, blocking based on stage 1 assessment', category: provisional?.category, assessments };
    return { kind: 'unavailable', classifierRan: true, reason: 'Classifier unavailable', assessments };
  }
  return { kind: 'unavailable', classifierRan: true, reason: 'Classifier unavailable', assessments };
}
