import fs from 'node:fs';
import { z } from 'zod';
import { atomicWriteFile } from './atomic-write.js';

const name = z.string().min(1).max(256).refine(value => !/[\r\n]/.test(value));
const scopeSchema = z.object({
  skillName: name,
  attributionName: name,
  skillPath: z.string().min(1).max(16384).optional(),
  hookIdentity: z.string().max(524288).optional(),
  effort: z.union([z.enum(['low', 'medium', 'high', 'xhigh', 'max']), z.number().int().min(1).max(1000)]).optional(),
  frozenCommandDenies: z.array(z.string().max(1024)).max(1000).optional(),
});
const markerSchema = z.object({ forkedSkill: z.literal(true), skillName: name.optional() });
export type SkillScope = z.infer<typeof scopeSchema>;
export type SkillScopeRead = { status: 'valid'; scope: SkillScope } | { status: 'absent' | 'absent-but-marked' | 'malformed' };
const limit = 524288;

// jVo/WVo/GVo, chunk-30ght5hf [1284,5940), UTF-16; host uses session journal paths and atomic writes.
function paths(journal: string): { scope: string; marker: string } {
  if (!journal.endsWith('.jsonl')) throw new Error('Skill scope requires a journal path');
  return { scope: journal.replace(/\.jsonl$/, '.forked-skill.json'), marker: journal.replace(/\.jsonl$/, '.forked-skill.marker.json') };
}

export function writeSkillScope(journal: string, value: SkillScope): void {
  const scope = scopeSchema.parse(value);
  const files = paths(journal);
  atomicWriteFile(files.marker, JSON.stringify({ forkedSkill: true, skillName: scope.skillName }));
  atomicWriteFile(files.scope, JSON.stringify(scope));
}

export function readSkillScope(journal: string): SkillScopeRead {
  const files = paths(journal);
  try {
    const stat = fs.lstatSync(files.scope);
    if (!stat.isFile() || stat.size > limit) return { status: 'malformed' };
    const parsed = scopeSchema.safeParse(JSON.parse(fs.readFileSync(files.scope, 'utf8')));
    return parsed.success ? { status: 'valid', scope: parsed.data } : { status: 'malformed' };
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) return { status: 'malformed' };
    try { fs.lstatSync(files.marker); return { status: 'absent-but-marked' }; }
    catch (markerError) { return { status: markerError instanceof Error && 'code' in markerError && markerError.code === 'ENOENT' ? 'absent' : 'absent-but-marked' }; }
  }
}

export function readSkillScopeWitness(journal: string): string | undefined {
  try {
    const file = paths(journal).marker;
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.size > limit) return undefined;
    const parsed = markerSchema.safeParse(JSON.parse(fs.readFileSync(file, 'utf8')));
    return parsed.success ? parsed.data.skillName : undefined;
  } catch { return undefined; }
}
