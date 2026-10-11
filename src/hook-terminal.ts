const ESC = "\x1b";
const BEL = "\x07";
const OSC_CODES = new Set([0, 1, 2, 9, 99, 777]);
const MAX_SEQUENCE_BYTES = 4096;

/** Wrap only already validated effects; environment values are never interpolated. */
export function formatHookTerminalSequence(value: unknown, environment: { TMUX?: string; STY?: string } = { TMUX: process.env.TMUX, STY: process.env.STY }): string | undefined {
  const sequence = validateHookTerminalSequence(value);
  if (sequence === undefined) return undefined;
  const escaped = sequence.replaceAll(ESC, ESC + ESC);
  if (environment.TMUX) return `${ESC}Ptmux;${escaped}${ESC}\\`;
  if (environment.STY) return `${ESC}P${escaped}${ESC}\\`;
  return sequence;
}

/** Validate the whole hook field before returning any terminal output. */
export function validateHookTerminalSequence(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0 || Buffer.byteLength(value, "utf8") > MAX_SEQUENCE_BYTES) return undefined;
  const parts: string[] = [];
  let position = 0;
  while (position < value.length) {
    if (value[position] === BEL) {
      parts.push(BEL);
      position++;
      continue;
    }
    if (value[position] !== ESC || value[position + 1] !== "]") return undefined;
    let end = position + 2;
    let terminatorBytes = 0;
    while (end < value.length) {
      if (value[end] === BEL) { terminatorBytes = 1; break; }
      if (value[end] === ESC) {
        if (value[end + 1] !== "\\") return undefined;
        terminatorBytes = 2;
        break;
      }
      end++;
    }
    if (terminatorBytes === 0) return undefined;
    const body = value.slice(position + 2, end);
    const separator = body.indexOf(";");
    const codeText = separator < 0 ? body : body.slice(0, separator);
    if (!/^\d+$/.test(codeText)) return undefined;
    const code = Number(codeText);
    if (!OSC_CODES.has(code)) return undefined;
    const payload = (separator < 0 ? "" : body.slice(separator + 1)).replace(/[\x00-\x1f\x7f-\x9f]/g, "");
    if (code === 9 && !/^4;[0-4](;(100|\d{1,2})?)?$/.test(payload) && /^[\s᠎​]*[+-]?\p{Nd}/u.test(payload)) return undefined;
    // Normalize before the terminal sink applies any multiplexer passthrough.
    parts.push(`${ESC}]${code};${payload}${ESC}\\`);
    position = end + terminatorBytes;
  }
  const normalized = parts.join("");
  return Buffer.byteLength(normalized, "utf8") <= MAX_SEQUENCE_BYTES ? normalized : undefined;
}
