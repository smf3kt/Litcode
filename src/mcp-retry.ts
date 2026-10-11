import { McpHttpStatusError } from "./mcp-http.js";

/** Source-derived backoff formula; finite fast/slow lifecycle is owned here. */
export function mcpReconnectDelay(attempt: number, recovery: boolean, random: () => number = Math.random): number | undefined {
  if (!Number.isInteger(attempt) || attempt < 0) throw new Error("Invalid MCP reconnect attempt");
  if (attempt < 5) return attempt === 0 ? 0 : 1000 * 2 ** (attempt - 1);
  if (!recovery || attempt >= 13) return undefined;
  const ceiling = Math.min(300_000, 30_000 * 2 ** (attempt - 5));
  const floor = Math.min(15_000, ceiling);
  const sample = random();
  if (!Number.isFinite(sample) || sample < 0 || sample > 1) throw new Error("Invalid MCP retry randomness");
  return Math.floor(floor + sample * (ceiling - floor));
}

export function isTransientMcpFailure(error: unknown): boolean {
  return error instanceof McpHttpStatusError ? [500, 502, 503, 504].includes(error.status)
    : error instanceof Error && (error.message === "MCP HTTP transport request failed" ||
      /^MCP request ".*" on server ".*" timed out after \d+ms$/.test(error.message));
}
