import Anthropic from '@anthropic-ai/sdk';
import type { CompactionAttempt } from './reactive-compaction-source.js';

// Adapt Ndr/Qae/uze/Qio/Lee, sfn1dbxq SHA 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da,
// [2508498,2511003)/[880251,880587)/[881859,881931)/[141549,141721), UTF-16.
// The gateway throws SDK APIError instead of MC's normalized error message record.
export function compactionFailure(error: unknown, signal: AbortSignal): CompactionAttempt {
  if (signal.aborted) return { ok: false, reason: 'aborted' };
  const detail = error instanceof Error ? error.message : String(error);
  if (error instanceof Anthropic.APIError) {
    if (/prompt is too long/i.test(detail)) {
      const match = detail.match(/prompt is too long[^0-9]*(\d+)\s*tokens?\s*>\s*(\d+)/i);
      const gap = match ? Number(match[1]) - Number(match[2]) : undefined;
      return { ok: false, reason: 'prompt_too_long', ...(gap !== undefined && gap > 0 ? { tokenGap: gap } : {}) };
    }
    if (mediaFailure(detail)) return { ok: false, reason: 'media_too_large' };
  }
  return { ok: false, reason: 'error', detail };
}

// DI/Peo/I6/M6/fv, n3ykh62m SHA 2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac,
// [676665,676886)/[677244,677808)/[678791,679218), UTF-16. No additional guessed gateway aliases.
function mediaFailure(text: string): boolean {
  if (text.includes('request_too_large')) return true;
  for (const kind of ['image_block', 'document_block', 'media_budget']) {
    const marker = `capability_rejected: ${kind}`;
    let start = 0;
    for (;;) {
      const index = text.indexOf(marker, start);
      if (index === -1) break;
      const next = text[index + marker.length];
      if (next === undefined || !/[A-Za-z0-9_:.-]/.test(next)) return true;
      start = index + 1;
    }
  }
  if (/messages[.[](\d+)[\].]+content[.[](\d+)[\].]+(?:tool_result[.[]content[.[](\d+)[\].]+)?(image|document|pdf)/.test(text)) return true;
  const lower = text.toLowerCase();
  return ['could not process image', 'image exceeds', 'image dimensions exceed', 'image does not match the provided media type',
    'image cannot be empty', 'exceeds api limit', 'images exceed the api limit', 'unable to resize image', 'unable to compress image',
    'image file is empty', 'could not process pdf', 'pdf pages', 'the pdf specified was not valid',
    'the pdf specified is password protected', 'pdf cannot be empty', 'does not support pdf input', 'does not support pdfs',
    'too much media'].some(fragment => lower.includes(fragment));
}
