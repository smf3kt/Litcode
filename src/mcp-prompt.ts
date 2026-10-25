import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { imageCodecBlock } from './image-codec.js';
import type { MediaBlocks } from './media.js';

const promptArgumentSchema = z.object({ name: z.string(), description: z.string().optional(), required: z.boolean().optional() });
const promptSchema = z.object({ name: z.string(), description: z.string().optional(), arguments: z.array(promptArgumentSchema).optional() });
export type McpPromptCommand = z.infer<typeof promptSchema> & { server: string; commandName: string; displayName: string };
export interface McpPromptCommands {
  list(signal: AbortSignal): Promise<McpPromptCommand[]>;
  subscribe(listener: (commands: McpPromptCommand[]) => void): () => void;
  invoke(command: McpPromptCommand, args: string, signal: AbortSignal): Promise<MediaBlocks>;
}

/** $on/mf/_r/UO, gyf58rwf [10666,11554), UTF-16; native NFKC replaces source chunked normalization. */
function sanitizeDiscovery(value: unknown): unknown {
  if (typeof value === 'string') {
    if (!/[^\0-\x7f]/.test(value)) return value;
    let text = value, previous = '', iteration = 0;
    while (text !== previous && iteration < 10) {
      previous = text;
      text = text.normalize('NFKC').replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
        .replace(/[\p{Cf}\p{Co}\p{Cn}]/gu, '').replace(/[​-‏‪-‮⁦-⁩﻿-]/g, '');
      iteration++;
    }
    if (iteration >= 10) throw new Error(`Unicode sanitization reached maximum iterations (10) for input: ${value.slice(0, 100)}`);
    return text;
  }
  if (Array.isArray(value)) return value.map(sanitizeDiscovery);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
    const name = sanitizeDiscovery(key);
    return typeof name === 'string' && name !== '__proto__' ? [[name, sanitizeDiscovery(item)]] : [];
  }));
  return value;
}

let normalizationCosts: Uint8Array | undefined;
/** T/Qht/b/O/q, cn1c6arp [4225,5683), UTF-16. */
function discoveryBudget(): (value: unknown) => boolean {
  let size = 0, work = 0, nonAscii = 0;
  const valid = () => size <= 16777216 && work <= 16 * 1048576;
  const text = (value: string, name: boolean) => {
    size += value.length;
    if (!valid() || !/[^\0-\x7f]/.test(value)) return;
    if (name) { work += 16 * value.length; return; }
    work += value.length;
    for (let index = 0; index < value.length && valid(); index++) {
      const code = value.charCodeAt(index);
      if (code <= 127) continue;
      if (nonAscii++ < 65536) { work += 15; continue; }
      normalizationCosts ??= Uint8Array.from({ length: 65536 }, (_value, unit) => {
        const char = String.fromCharCode(unit);
        return /[\p{M}ᄀ-ᇿꥠ-꥿ힰ-\udfff]/u.test(char) || sanitizeDiscovery(char) !== char ? 1 : 0;
      });
      if (normalizationCosts[code] === 1) work += 15;
    }
  };
  const visit = (value: unknown, root = false, name = false): boolean => {
    size += 16;
    if (typeof value === 'string') text(value, name);
    else if (Array.isArray(value)) { for (const item of value) if (!visit(item)) return false; }
    else if (value !== null && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) { text(key, false); if (!visit(item, false, root && key === 'name')) return false; }
    }
    return valid();
  };
  return value => { if (!valid()) return false; size += 256; return visit(value, true); };
}

/** mi/In/Eot, sb190ksj [150584,152344), 4xj6t50t [653,790), xrjhyksm [5740,6016), UTF-16. */
export function mcpPromptCommands(server: string, prompts: readonly unknown[]): McpPromptCommand[] {
  const before = discoveryBudget(), after = discoveryBudget();
  let exhausted = false;
  return prompts.flatMap(value => {
    if (exhausted || !before(value)) return [];
    const sanitized = sanitizeDiscovery(value);
    if (!after(sanitized)) { exhausted = true; return []; }
    const prompt = promptSchema.parse(sanitized);
    const commandName = `mcp__${server.replace(/[^a-zA-Z0-9_-]/g, '_')}__${prompt.name}`;
    const displayName = `${server}:${prompt.name} (MCP)`;
    if (commandName.length > 512 || displayName.length > 512 || !/^[A-Za-z0-9_.-]+(?::[A-Za-z0-9_.-]+)*$/.test(commandName)) return [];
    return [{ ...prompt, server, commandName, displayName }];
  });
}

/** mi/ogn, sb190ksj [150584,152344), zqyjdv9s [2652,2705), UTF-16. */
export function mcpPromptArguments(command: McpPromptCommand, raw: string): Record<string, string> {
  const text = raw.trim(), values = text ? text.split(/\s+/) : [];
  const arguments_ = command.arguments ?? [];
  const missing = arguments_.filter((argument, index) => argument.required && values[index] === undefined).map(argument => argument.name);
  if (missing.length) throw new Error(`Missing required ${missing.length === 1 ? 'argument' : 'arguments'}: ${missing.join(', ')}. Usage: /${command.commandName} ${arguments_.map(argument => argument.name).join(' ')}`);
  return Object.fromEntries(arguments_.flatMap((argument, index) => values[index] === undefined ? [] : [[argument.name, values[index]!]]));
}

const textContent = z.object({ type: z.literal('text'), text: z.string() });
const mediaContent = z.object({ type: z.enum(['image', 'audio']), data: z.string(), mimeType: z.string() });
const resource = z.object({ uri: z.string(), mimeType: z.string().optional(), text: z.string().optional(), blob: z.string().optional() });
const contentSchema = z.union([textContent, mediaContent,
  z.object({ type: z.literal('resource'), resource }),
  z.object({ type: z.literal('resource_link'), name: z.string(), uri: z.string(), description: z.string().optional() }),
]);
const resultSchema = z.object({ messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: contentSchema })) });
const imageTypes = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
function imageMime(mime?: string): boolean {
  const normalized = mime?.split(';', 1)[0]?.trim().toLowerCase();
  return imageTypes.has(normalized === 'image/jpg' ? 'image/jpeg' : normalized ?? '');
}

/** s0n, dxp0113e [2508,3920), UTF-16. */
const extensions: Readonly<Record<string, string>> = {
  'application/pdf': 'pdf', 'application/json': 'json', 'text/csv': 'csv', 'text/plain': 'txt', 'text/html': 'html', 'text/markdown': 'md',
  'application/zip': 'zip', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/msword': 'doc', 'application/vnd.ms-excel': 'xls', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/ogg': 'ogg',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp',
  'image/svg+xml': 'svg', 'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico', 'text/css': 'css', 'text/javascript': 'js',
  'application/javascript': 'js', 'application/xml': 'xml', 'text/xml': 'xml', 'application/manifest+json': 'webmanifest',
  'font/woff2': 'woff2', 'application/font-woff2': 'woff2', 'font/woff': 'woff', 'application/font-woff': 'woff',
  'font/ttf': 'ttf', 'font/otf': 'otf', 'application/wasm': 'wasm',
};

/** Qt, 5sxzysbh [615,844), UTF-16. */
function byteText(bytes: number): string {
  const kilobytes = bytes / 1024;
  if (kilobytes < 1) return `${bytes} bytes`;
  if (kilobytes < 1024) return `${kilobytes.toFixed(1).replace(/\.0$/, '')}KB`;
  const megabytes = kilobytes / 1024;
  if (megabytes < 1024) return `${megabytes.toFixed(1).replace(/\.0$/, '')}MB`;
  return `${(megabytes / 1024).toFixed(1).replace(/\.0$/, '')}GB`;
}

/** ar/ks/Ho, sb190ksj [163052,165011); Ak, dxp0113e [3932,4731), UTF-16. */
export async function mcpPromptContent(value: unknown, server: string, workspace: string, signal: AbortSignal): Promise<MediaBlocks> {
  const result = resultSchema.parse(value);
  const persist = async (bytes: Buffer, mime: string | undefined): Promise<string> => {
    if (bytes.length > 104857600) throw new Error(`content is ${bytes.length} bytes, over the 104857600 byte persist limit`);
    signal.throwIfAborted();
    const normalized = mime?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
    const directory = await fs.mkdtemp(path.join(workspace, '.mcp-content-'));
    const file = path.join(directory, `mcp-${server.replace(/[^a-zA-Z0-9_-]/g, '_')}-blob-${randomUUID()}.${extensions[normalized] ?? 'bin'}`);
    try {
      await fs.writeFile(file, bytes, { flag: 'wx', mode: 0o600, signal });
      signal.throwIfAborted();
      return file;
    } catch (error) { await fs.rm(directory, { recursive: true, force: true }); throw error; }
  };
  const binary = async (bytes: Buffer, mime: string | undefined, prefix: string): Promise<MediaBlocks> => {
    try {
      const file = await persist(bytes, mime);
      return [{ type: 'text', text: `${prefix}Binary content (${mime || 'unknown type'}, ${byteText(bytes.length)}) saved to ${file}` }];
    } catch (error) {
      signal.throwIfAborted();
      return [{ type: 'text', text: `${prefix}Binary content (${mime || 'unknown type'}, ${bytes.length} bytes) could not be saved to disk: ${error instanceof Error ? error.message : String(error)}` }];
    }
  };
  const image = async (bytes: Buffer, mime?: string): Promise<MediaBlocks> => {
    signal.throwIfAborted();
    const { block } = imageCodecBlock({ data: bytes, mediaType: mime });
    try { return [block, { type: 'text', text: `[Image source: ${await persist(bytes, mime)}]` }]; }
    catch { signal.throwIfAborted(); return [block]; }
  };
  const blocks = await Promise.all(result.messages.map(async ({ content }): Promise<MediaBlocks> => {
    signal.throwIfAborted();
    switch (content.type) {
      case 'text': return [{ type: 'text', text: content.text }];
      case 'audio': return binary(Buffer.from(content.data, 'base64'), content.mimeType, `[Audio from ${server}] `);
      case 'image': return imageMime(content.mimeType) ? image(Buffer.from(content.data, 'base64'), content.mimeType)
        : binary(Buffer.from(content.data, 'base64'), content.mimeType, `[Image from ${server}] `);
      case 'resource': {
        const item = content.resource, prefix = `[Resource from ${server} at ${item.uri}] `;
        if (item.text !== undefined) return [{ type: 'text', text: prefix + item.text }];
        if (item.blob !== undefined) return imageMime(item.mimeType)
          ? [{ type: 'text', text: prefix }, ...await image(Buffer.from(item.blob, 'base64'), item.mimeType)]
          : binary(Buffer.from(item.blob, 'base64'), item.mimeType, prefix);
        return [];
      }
      case 'resource_link': return [{ type: 'text', text: `[Resource link: ${content.name}] ${content.uri}${content.description ? ` (${content.description})` : ''}` }];
    }
  }));
  signal.throwIfAborted();
  return blocks.flat();
}
