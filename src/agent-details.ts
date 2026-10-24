// kG/gE [632415,637661), chunk-24k7d6mw.js; GD [812,1038), chunk-n7mc1kmr.js, UTF-16.
// Registry, model, tool-label and rendering adapters: research/ports/W321-agent-details.md.
import { stripVTControlCharacters } from 'node:util';
import type { AgentDescriptor } from './agent-registry.js';
import type { AgentDetailProgress } from './agent-progress.js';
import type { EffortLevel } from './effort-command.js';
import { compactNumber } from './usage-panel.js';
import { shellDurationText } from './tui-bash-mode.js';
import { wrapMessageText } from './tui-wrap.js';

export type AgentTaskDetail = Pick<AgentDescriptor, 'id' | 'name' | 'status' | 'mode' | 'model' | 'error'> & {
  kind: 'agent'; prompt: string; agentType: string; effort?: EffortLevel;
  startedAt: number; endedAt?: number; progress: AgentDetailProgress;
};

// Cs [662,1101), chunk-g8ycwp9n.js; gl [677,739), chunk-ax7r0qj7.js, UTF-16.
export function agentPlanContent(text: string, tag: string): string | null {
  if (!text.trim() || !tag.trim()) return null;
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const open = new RegExp(`<${escaped}(?=[\\s>])`, 'gi');
  const close = new RegExp(`<\\/${escaped}>`, 'gi');
  let position = 0;
  for (;;) {
    open.lastIndex = position; const start = open.exec(text);
    close.lastIndex = position; const firstClose = close.exec(text);
    if (!start || !firstClose) return null;
    const end = text.indexOf('>', start.index + start[0].length);
    if (end === -1) return null;
    close.lastIndex = end + 1; const finish = close.exec(text);
    if (!finish) return null;
    const before = firstClose.index + firstClose[0].length <= start.index;
    const content = text.slice(end + 1, finish.index);
    if (content && !before) return content;
    position = finish.index + finish[0].length;
  }
}

// Nr [5245,5312), chunk-ax7r0qj7.js, UTF-16.
function agentTypeText(text: string): string {
  return text.replace(/[\x00-\x08\x0e-\x1f\x7f-\x9f]/g, '').replace(/\s+/g, ' ').trim();
}

// xw [331063,331199), chunk-bk5ct2gw.js; yXe [188975,189117), chunk-phg89898.js, UTF-16.
function agentModelText(model: string, effort: EffortLevel | undefined): string {
  let value = model.replace(/[^A-Za-z0-9._:/@[\]-]/g, '');
  if (value.length === 0) value = '(unrecognized model name)';
  else if (value.length > 128) value = value.slice(0, 128) + '…';
  return effort === undefined ? value : `${value} (${effort})`;
}

export function agentTaskFrame(detail: AgentTaskDetail, columns: number): { title: string; lines: string[] } {
  const clean = (text: string) => stripVTControlCharacters(text).replace(/\r/g, '')
    .replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, '');
  const prompt = detail.prompt.length > 300 ? detail.prompt.substring(0, 297) + '…' : detail.prompt;
  const plan = agentPlanContent(detail.prompt, 'plan');
  const elapsed = shellDurationText(Math.max(0, (detail.endedAt ?? Date.now()) - detail.startedAt));
  const summary = [elapsed];
  if (detail.progress.tokenCount > 0) summary.push(`${compactNumber(detail.progress.tokenCount)} tokens`);
  if (detail.progress.toolUseCount > 0) summary.push(`${detail.progress.toolUseCount} ${detail.progress.toolUseCount === 1 ? 'tool' : 'tools'}`);
  if (detail.model) summary.push(agentModelText(detail.model, detail.effort));
  const state = detail.status === 'running' ? '' : detail.status === 'completed' ? 'Completed' : detail.status === 'failed' ? 'Failed' : 'Stopped';
  const lines = [state ? `${state} · ${summary.join(' · ')}` : summary.join(' · ')];
  if (detail.status === 'running' && detail.progress.recentActivities.length > 0) {
    lines.push('', 'Progress');
    for (const [index, activity] of detail.progress.recentActivities.entries()) {
      lines.push(`${index === detail.progress.recentActivities.length - 1 ? '› ' : '  '}${clean(activity.toolName)}`);
    }
  }
  lines.push('', plan ? 'Plan to implement' : 'Prompt', ...wrapMessageText(clean(plan ?? prompt),
    Math.max(1, columns), { hard: true, trim: false }).split('\n'));
  if (detail.status === 'failed' && detail.error) lines.push('', 'Error', ...wrapMessageText(clean(detail.error),
    Math.max(1, columns), { hard: true, trim: false }).split('\n'));
  return { title: `${agentTypeText(detail.agentType)} › ${clean(detail.name || 'Async agent')}`, lines };
}
