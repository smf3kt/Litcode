import { z } from 'zod';

// kt/Ro/As, tar639dc [60313,61632), UTF-16.
export const sourceFindingSchema = z.object({
  file: z.string(),
  line: z.number().int().optional(),
  summary: z.string(),
  short_summary: z.string().max(60).optional(),
  failure_scenario: z.string(),
  category: z.string().max(40).optional(),
  verdict: z.enum(['CONFIRMED', 'PLAUSIBLE']).optional(),
  outcome: z.enum(['fixed', 'skipped', 'no_change_needed']).optional(),
});
const levelSchema = z.enum(['low', 'medium', 'high', 'xhigh', 'max']);
export const sourceFindingsRequestSchema = z.object({
  level: levelSchema.optional(), findings: z.array(sourceFindingSchema).max(32),
}).strict();
export const sourceFindingsResultSchema = z.object({
  count: z.number(), level: levelSchema.optional(), findings: z.array(sourceFindingSchema),
}).strict();
export const findingsHostResultSchema = sourceFindingsResultSchema.extend({ kind: z.literal('findings') });
export type SourceFinding = z.infer<typeof sourceFindingSchema>;
export type SourceFindingsRequest = z.infer<typeof sourceFindingsRequestSchema>;
export type SourceFindingsResult = z.infer<typeof sourceFindingsResultSchema>;
export type FindingsHostResult = z.infer<typeof findingsHostResultSchema>;

// Eo, tar639dc [61633,62418), UTF-16; host data and model output remain separate.
export function sourceFindingsResult(request: SourceFindingsRequest): FindingsHostResult {
  return { kind: 'findings', count: request.findings.length, ...request };
}
export function sourceFindingsText(count: number): string {
  return count === 0 ? 'No findings reported.' : `${count} ${count === 1 ? 'finding' : 'findings'} reported.`;
}

export const SOURCE_FINDINGS_DESCRIPTION = 'Report code-review findings as a typed list so the host UI can render them. ' +
  'Use this only when the active code-review instructions tell you to report findings with this tool; otherwise follow whatever output format those instructions specify. ' +
  'When reporting a review\'s results, call it once with the verified findings ranked most-severe first (empty array if nothing survived verification) and do not also print the findings as text. ' +
  'When re-reporting after applying fixes (only if the apply instructions ask for it), set `outcome` on each finding to what actually happened.';
