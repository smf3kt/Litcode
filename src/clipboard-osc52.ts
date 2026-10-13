/** Adapted Sv/gh/OI OSC52 branches; exact ranges and host differences are in research/ports/W37-tui-selection.md. */
export const CLIPBOARD_TEXT_MAX_BYTES = 100_000;

/** Emits a clipboard request; terminals may decline it and send no acknowledgement. */
export function osc52Payload(text: string, env: NodeJS.ProcessEnv = process.env): string {
  if (Buffer.byteLength(text, 'utf8') > CLIPBOARD_TEXT_MAX_BYTES) {
    throw new Error(`Selection exceeds ${CLIPBOARD_TEXT_MAX_BYTES} UTF-8 bytes`);
  }
  const body = Buffer.from(text, 'utf8').toString('base64');
  const raw = `\x1b]52;c;${body}\x07`;
  if (env.TMUX) return raw + `\x1bPtmux;${raw.replaceAll('\x1b', '\x1b\x1b')}\x1b\\`;
  if (env.STY || env.TERM?.startsWith('screen')) {
    const chunks: string[] = [];
    for (let index = 0; index < body.length; index += 76) chunks.push(body.slice(index, index + 76));
    return `\x1bP\x1b]52;c;${chunks.join('\x1b\\\x1bP')}\x07\x1b\\`;
  }
  return env.TERM === 'xterm-kitty' || env.TERM_PROGRAM === 'kitty'
    ? `\x1b]52;c;${body}\x1b\\` : raw;
}
