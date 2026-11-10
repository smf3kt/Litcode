import type { FileHandle } from "node:fs/promises";
import { StringDecoder } from "node:string_decoder";
import { TrustedReadContract, type PathApprovalCall } from "./path-approval-call-owner.js";
import type { ToolDefinition } from "./tools.js";

// Unwired host adaptation of bhn, chunk-sfn1dbxq.js SHA-256
// 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da,
// UTF-16 [3551998,3552396): the opener owns the handle and its close operation.
export async function readTrustedHandleLines(
  contract: TrustedReadContract,
  call: PathApprovalCall,
  tool: ToolDefinition,
  offset: number,
  limit: number,
  maxBytes: number,
  signal: AbortSignal,
): Promise<string> {
  const opened = await TrustedReadContract.prototype.open.call(contract, call, tool);
  try {
    return await readControlledHandleLines(opened.handle, offset, limit, maxBytes, signal);
  } finally {
    const closing = opened.close();
    if (signal.aborted) void closing.catch(() => {});
    else await closing;
  }
}

// Host adaptation: bhn/GIr pass controlled I/O to the reader; the caller owns
// the handle. chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da,
// UTF-16 [3551998,3552396) and [3546500,3549105). Window logic follows tools.ts readFileLines.
export type ControlledHandleLinesResult = { content: string; truncated: boolean };

export async function readControlledHandleLinesResult(
  handle: FileHandle,
  offset: number,
  limit: number,
  maxBytes: number,
  signal: AbortSignal,
): Promise<ControlledHandleLinesResult> {
  const endLine = offset + limit - 1;
  const lines: string[] = [];
  let lineNo = 1;
  let current = "";
  let windowChars = 0;
  let capped = false;
  let finished = false;
  const decoder = new StringDecoder("utf8");
  const buffer = Buffer.alloc(64 * 1024);
  let position = 0;

  function consume(chunk: string): void {
    let cursor = 0;
    while (true) {
      const nl = chunk.indexOf("\n", cursor);
      const seg = nl === -1 ? chunk.slice(cursor) : chunk.slice(cursor, nl);
      const inWindow = lineNo >= offset && lineNo <= endLine;
      if (inWindow) {
        const room = maxBytes - windowChars;
        if (seg.length > room) {
          current += room > 0 ? seg.slice(0, room) : "";
          capped = true;
          lines.push(current);
          current = "";
          finished = true;
          break;
        }
        current += seg;
        windowChars += seg.length;
      }
      if (nl === -1) break;
      if (inWindow) {
        lines.push(current);
        current = "";
        if (lineNo === endLine) {
          finished = true;
          break;
        }
      }
      lineNo += 1;
      cursor = nl + 1;
    }
  }

  while (!finished) {
    if (signal.aborted) throw abortError();
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, position);
    if (signal.aborted) throw abortError();
    if (bytesRead === 0) {
      const last = decoder.end();
      if (last) {
        if (signal.aborted) throw abortError();
        consume(last);
      }
      break;
    }
    position += bytesRead;
    const chunk = decoder.write(buffer.subarray(0, bytesRead));
    if (chunk) {
      if (signal.aborted) throw abortError();
      consume(chunk);
    }
  }
  if (!finished && lineNo >= offset && lineNo <= endLine) lines.push(current);

  const joined = lines.join("\n");
  const buf = Buffer.from(joined, "utf8");
  if (!capped && buf.length <= maxBytes) return { content: joined, truncated: false };
  let end = Math.min(maxBytes, buf.length);
  while (end > 0 && end < buf.length && (buf[end]! & 0xc0) === 0x80) end -= 1;
  const suffix = capped ? "file continues" : `${buf.length - end} more bytes omitted`;
  return { content: `${buf.subarray(0, end).toString("utf8")}\n[read_file: output truncated; ${suffix}]`, truncated: true };
}

export async function readControlledHandleLines(
  handle: FileHandle,
  offset: number,
  limit: number,
  maxBytes: number,
  signal: AbortSignal,
): Promise<string> {
  return (await readControlledHandleLinesResult(handle, offset, limit, maxBytes, signal)).content;
}

function abortError(): Error {
  const error = new Error("operation aborted before it started");
  error.name = "AbortError";
  return error;
}
