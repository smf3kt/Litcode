import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { atomicWriteFile } from './atomic-write.js';
import { CONFIG_LIMITS, readBoundedBytes } from './config.js';
import { workspaceApprovalKey } from './mcp-approval.js';
import { queuePermissionSettingsWrite } from './permission-settings.js';

const names = z.array(z.string().min(1).max(256)).max(1024);
const object = z.record(z.unknown());
export const MCP_STATE_FILE = 'mcp-state.json';

function read(file: string): { value: Record<string, unknown>; mode: number } {
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('MCP state must be a regular file');
    const bytes = readBoundedBytes(file, CONFIG_LIMITS.settingsBytes);
    if (bytes.overflow) throw new Error('MCP state exceeds the byte limit');
    return { value: object.parse(JSON.parse(bytes.buffer.toString('utf8'))), mode: stat.mode & 0o777 };
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return { value: {}, mode: 0o600 };
    throw error;
  }
}

// Xi/Lm/nA, bk5ct2gw [596552,596827)/[596874,597536), UTF-16; user-owned workspace state.
export function disabledMcpServers(workspace: string, userDir: string): string[] {
  const document = read(path.join(userDir, MCP_STATE_FILE)).value;
  const projects = object.parse(document.projects ?? {});
  const project = object.parse(projects[workspaceApprovalKey(workspace)] ?? {});
  return names.parse(project.disabledMcpServers ?? []);
}

// m8t, sfn1dbxq [2201926,2202015), UTF-16; only identifiers are adapted.
export function setMcpMembership(e: string[], n: string, r: boolean): string[] {
  if (e.includes(n) === r) return e;
  return r ? [...e, n] : e.filter(h => h !== n);
}

// r6e, sfn1dbxq [2202015,2202442), UTF-16; ordinary servers use the disabled list.
export async function saveMcpEnabled(workspace: string, userDir: string, name: string, enabled: boolean): Promise<void> {
  names.parse([name]);
  const file = path.join(userDir, MCP_STATE_FILE);
  await queuePermissionSettingsWrite(file, () => {
    const document = read(file), projects = object.parse(document.value.projects ?? {}), key = workspaceApprovalKey(workspace);
    const project = object.parse(projects[key] ?? {}), previous = names.parse(project.disabledMcpServers ?? []);
    const next = setMcpMembership(previous, name, !enabled);
    if (next === previous) return;
    names.parse(next);
    document.value.projects = { ...projects, [key]: { ...project, disabledMcpServers: next } };
    const text = JSON.stringify(document.value, null, 2) + '\n';
    if (Buffer.byteLength(text) > CONFIG_LIMITS.settingsBytes) throw new Error('MCP state exceeds the byte limit');
    atomicWriteFile(file, text, { mode: document.mode, label: 'saveMcpEnabled' });
  });
}
