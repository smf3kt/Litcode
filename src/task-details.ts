// YG/zG/Eae [667037,671410), chunk-24k7d6mw.js, zero-based UTF-16.
// Registry/output/width adapters and module digests: research/ports/W320-task-details.md.
import { stripVTControlCharacters } from 'node:util';
import type { BackgroundJobView } from './background.js';
import type { BackgroundTaskSnapshot } from './tasks-panel.js';
import { shellBytesText, shellDurationText } from './tui-bash-mode.js';
import { ra } from './tui-graphemes.js';
import { ae } from './tui-render-host.js';
import { wrapMessageText } from './tui-wrap.js';

export type BackgroundTaskDetail = Pick<BackgroundJobView, 'id' | 'kind' | 'state' | 'command' | 'duration_ms'
  | 'exit_code' | 'stdout' | 'stderr' | 'stdout_bytes' | 'stderr_bytes'>;

export function initialTaskDetail(snapshot: BackgroundTaskSnapshot): string | undefined {
  if (snapshot.jobs.length + snapshot.agents.length + snapshot.crons.length !== 1) return;
  const job = snapshot.jobs[0];
  return job?.source === 'websocket' ? undefined : job?.id;
}

// ct [8443,8612), chunk-yn0pfn70.js, UTF-16; ae and ra use existing source host seams.
export function taskDetailClip(text: string, width: number): string {
  if (ae(text) <= width) return text;
  if (width <= 1) return '…';
  let used = 0, result = '';
  for (const { segment } of ra().segment(text)) {
    const size = ae(segment);
    if (used + size > width - 1) break;
    result += segment; used += size;
  }
  return result + '…';
}

export function taskDetailOutput(detail: BackgroundTaskDetail): { content: string; bytesTotal: number; lines: string[] } {
  const bytes = Buffer.from(detail.stdout + detail.stderr);
  let start = Math.max(0, bytes.length - 8192);
  while (start < bytes.length && (bytes[start]! & 0xc0) === 0x80) start++;
  const content = bytes.subarray(start).toString('utf8');
  const offsets: number[] = [];
  let end = content.length;
  for (let index = 0; index < 10 && end > 0; index++) {
    const newline = content.lastIndexOf('\n', end - 1);
    offsets.push(newline + 1); end = newline;
  }
  offsets.reverse();
  const lines: string[] = [];
  for (let index = 0; index < offsets.length; index++) {
    const to = index < offsets.length - 1 ? offsets[index + 1]! - 1 : content.length;
    const line = content.slice(offsets[index], to);
    if (line) lines.push(line);
  }
  return { content, bytesTotal: detail.stdout_bytes + detail.stderr_bytes, lines };
}

export function taskDetailFrame(detail: BackgroundTaskDetail, columns: number): { title: string; lines: string[] } {
  const output = taskDetailOutput(detail);
  const clean = (text: string) => stripVTControlCharacters(text).replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, '');
  const boxWidth = Math.max(4, columns - 6), innerWidth = Math.max(1, boxWidth - 4);
  const command = taskDetailClip(clean(detail.command), 280);
  const status = `${detail.state}${detail.exit_code === null ? '' : ` (exit code: ${detail.exit_code})`}`;
  const lines = [`Status:  ${status}`, `Runtime: ${shellDurationText(detail.duration_ms)}`,
    ...wrapMessageText(`${detail.kind === 'monitor' ? 'Script:' : 'Command:'} ${command}`, Math.max(1, columns),
      { hard: true, trim: false }).split('\n'), '', 'Output:'];
  if (!output.content) lines.push('No output available');
  else {
    lines.push('╭' + '─'.repeat(boxWidth - 2) + '╮');
    for (let index = 0; index < 10; index++) {
      const line = taskDetailClip(clean(output.lines[index] ?? '').replace(/\r/g, ''), innerWidth);
      lines.push(`│ ${line}${' '.repeat(Math.max(0, innerWidth - ae(line)))} │`);
    }
    lines.push('╰' + '─'.repeat(boxWidth - 2) + '╯');
    lines.push(`Showing ${output.lines.length} lines${output.bytesTotal > output.content.length ? ` of ${shellBytesText(output.bytesTotal)}` : ''}`);
  }
  return { title: detail.kind === 'monitor' ? 'Monitor details' : 'Shell details', lines };
}
