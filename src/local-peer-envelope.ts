import { z } from 'zod';
import { peerHopChainSchema } from './local-peer-guard.js';
import { Htn, L5e } from './subagent-output-scrub-tags-source.js';

// V/ldt/_/D$e, 64ag51qf [3664,4923)/[5316,5575), UTF-16.
const envelopeTag = 'cross-session-message';
const sessionPattern = /^[A-Za-z0-9_-]{1,80}$/;
const hopPattern = /^[0-9a-f]{24}(?:,[0-9a-f]{24}){0,31}$/;
const addressCharacters = 'A-Za-z0-9%:_/.\\\\-';
const modes = ['bypass', 'prompting'] as const;
export const peerEnvelopeMetadataSchema = z.object({
  name: z.string().optional(),
  fromSession: z.string().regex(sessionPattern).optional(),
  hopChain: peerHopChainSchema.optional(),
  fromMode: z.enum(modes).optional(),
  body: z.string().optional(),
  plugin: z.string().optional(),
});
export type PeerEnvelopeMetadata = z.infer<typeof peerEnvelopeMetadataSchema>;
type Envelope = Omit<PeerEnvelopeMetadata, 'name' | 'plugin'> & {
  body: string;
  from?: string;
  fromName?: string;
  fromPlugin?: string;
};

// Ny/B/idt, 64ag51qf [1613,1782)/[2199,2301), UTF-16.
function peerDisplayName(value: string): string {
  const characters = [...value.replace(/[\p{Cf}\p{Cc}\p{Cs}\p{Zl}\p{Zp}]/gu, '').trim()];
  return characters.length > 64 ? `${characters.slice(0, 64).join('')}…` : characters.join('');
}
export function peerPluginName(value: unknown): string | undefined {
  if (typeof value !== 'string') return;
  const name = peerDisplayName(value.replace(/["<>]/g, ''));
  return name === '' ? undefined : name;
}

// R/aV, 64ag51qf [2929,3101)/[3140,3175), UTF-16.
export function encodePeerAddress(value: string): string {
  const encoder = new TextEncoder();
  return value.replace(/[^A-Za-z0-9:_/.\\-]/gu, character => Array.from(encoder.encode(character),
    byte => `%${byte.toString(16).toUpperCase().padStart(2, '0')}`).join(''));
}

function envelopeAttributes(value: Envelope): string {
  const attributes: string[] = [];
  if (value.from) attributes.push(`from="${value.from}"`);
  if (value.fromSession && sessionPattern.test(value.fromSession)) attributes.push(`from-session="${value.fromSession}"`);
  if (value.hopChain !== undefined && value.hopChain.length > 0) {
    const chain = value.hopChain.join(',');
    if (hopPattern.test(chain)) attributes.push(`hop-chain="${chain}"`);
  }
  const name = value.fromName === undefined ? undefined : peerDisplayName(value.fromName.replace(/["<>]/g, ''));
  if (name) attributes.push(`from-name="${name}"`);
  if (value.fromMode) attributes.push(`from-mode="${value.fromMode}"`);
  const plugin = value.fromPlugin === undefined ? undefined : peerDisplayName(value.fromPlugin.replace(/["<>]/g, ''));
  if (plugin) attributes.push(`from-plugin="${plugin}"`);
  return attributes.length > 0 ? ` ${attributes.join(' ')}` : '';
}
export function encodePeerEnvelope(value: Envelope): string {
  return `<${envelopeTag}${envelopeAttributes(value)}>\n${L5e(envelopeTag, value.body)}\n</${envelopeTag}>`;
}
export function parsePeerEnvelope(value: unknown): Envelope | undefined {
  if (typeof value !== 'string') return;
  const session = sessionPattern.source.replace(/^\^|\$$/g, '');
  const hops = hopPattern.source.replace(/^\^|\$$/g, '');
  const match = value.match(new RegExp(`^<${envelopeTag}(?: from="([${addressCharacters}]+)")?`
    + `(?: from-session="(${session})")?(?: hop-chain="(${hops})")?(?: from-name="([^"<>\\n\\r]+)")?`
    + `(?: from-mode="(${modes.join('|')})")?(?: from-plugin="([^"<>\\n\\r]+)")?>\\n([\\s\\S]*)\\n</${envelopeTag}>$`));
  if (!match) return;
  const mode = match[5];
  const parsed: Envelope = {
    ...(match[1] === undefined ? {} : { from: match[1] }),
    ...(match[2] === undefined ? {} : { fromSession: match[2] }),
    ...(match[3] === undefined ? {} : { hopChain: match[3].split(',') }),
    ...(match[4] === undefined ? {} : { fromName: match[4] }),
    ...(mode === 'bypass' || mode === 'prompting' ? { fromMode: mode } : {}),
    ...(match[6] === undefined ? {} : { fromPlugin: match[6] }),
    body: match[7] ?? '',
  };
  if (encodePeerEnvelope(parsed) !== value) return;
  return parsed;
}

// H/Zct, m7864yc0 [1887,2018); oBo/h/B/O, 7yyzmq2m [814,948)/[1488,1847), UTF-16.
const neutralizer = Htn([{ tags: [envelopeTag, 'teammate-message', 'agent-message'] }]);
const outerFrom = new RegExp(`^<${envelopeTag} from="([^"]+)"`);
const outerTag = new RegExp(`^<${envelopeTag}[ \\t>]`);
const closingTag = `</${envelopeTag}>`;
const pluginAttribute = /\sfrom-plugin\s*(?:=\s*(?:"[^"<>]*"|'[^'<>]*'|[^\s>]*))?/gi;
function envelopeHeader(value: string): string {
  const end = value.indexOf('>');
  return end < 0 ? value : value.slice(0, end);
}
export function preparePeerInput(value: string): string {
  const trimmed = value.trimEnd(), end = trimmed.length - closingTag.length;
  if (!(end > 0 && trimmed.endsWith(closingTag) && (outerFrom.test(value) || outerTag.test(value))))
    return neutralizer.neutralize(value);
  const header = envelopeHeader(value.slice(1, end));
  const inner = header.replace(pluginAttribute, '') + value.slice(1 + header.length, end);
  if (/from-plugin/i.test(envelopeHeader(inner))) return neutralizer.neutralize(value);
  return `<${neutralizer.neutralize(inner)}${value.slice(end)}`;
}

// D$e/Tbe, 64ag51qf [5233,5575), UTF-16.
export function peerEnvelopeMetadata(value: string, queued: string): PeerEnvelopeMetadata {
  const parsed = parsePeerEnvelope(value);
  if (!parsed) return {};
  const name = parsed.fromName ? peerDisplayName(parsed.fromName) : '';
  return {
    ...(name ? { name } : {}),
    ...(parsed.fromSession === undefined ? {} : { fromSession: parsed.fromSession }),
    ...(parsed.hopChain === undefined ? {} : { hopChain: parsed.hopChain }),
    ...(parsed.fromMode === undefined ? {} : { fromMode: parsed.fromMode }),
    ...(value === queued ? { body: parsed.body } : {}),
  };
}
