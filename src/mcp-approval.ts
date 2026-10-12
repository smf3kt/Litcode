import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { McpServerConfig } from "./mcp.js";

/**
 * Admission for MCP servers a project-owned settings file declares.
 *
 * A repository can ship `.harness/settings.json`, so a server named there is
 * controlled by whoever wrote the checkout rather than by the person running
 * the session. Each such server is a decision, not a setting: it stays pending
 * until that person answers, an approved declaration connects, a rejected one
 * is never asked about again, and the answer covers the exact declaration it
 * was granted for.
 *
 * Both the answer and the answers' key live in the user directory. The store is
 * keyed by workspace, so approving a name in one checkout never admits the same
 * name in another, and it is keyed by declaration fingerprint, so editing the
 * command, arguments or URL of an approved server asks again. A store that
 * cannot be read vouches for nothing.
 */

export const MCP_APPROVALS_FILE = "mcp-approvals.json";

export type McpDecision = "approved" | "rejected";
export type McpApprovalState = "read" | "absent" | "unreadable";

export type McpApproval = { fingerprint: string; decision: McpDecision };

export type McpApprovals = {
  /** Server name to the decision recorded for that exact declaration. */
  decisions: Map<string, McpApproval>;
  state: McpApprovalState;
  /** Why the store could not be read; present only when state is unreadable. */
  detail?: string;
};

/** A declared server that is not connected and still needs an answer. */
export type HeldMcpServer = {
  name: string;
  fingerprint: string;
  reason: "unapproved" | "declaration-changed";
};

export type McpAdmission = {
  /** Declared names to connect, sorted. */
  connect: string[];
  /** Declared names held for an answer, sorted. */
  pending: HeldMcpServer[];
  /** Declared names the person declined, sorted. */
  declined: string[];
};

/** Stable digest of a server declaration, independent of key order. */
export function mcpServerFingerprint(config: McpServerConfig): string {
  return createHash("sha256").update(canonicalJson(config)).digest("hex");
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
}

/**
 * Key a decision to the checkout it was made in.
 *
 * The real path is used so a session started through a symlink or a relative
 * path keys the same workspace, and two checkouts that happen to declare the
 * same server name stay independent.
 */
export function workspaceApprovalKey(workspace: string): string {
  let real = workspace;
  try {
    real = fs.realpathSync(workspace);
  } catch {
    real = path.resolve(workspace);
  }
  return createHash("sha256").update(real).digest("hex").slice(0, 32);
}

/**
 * Read the approval store for one workspace.
 *
 * A missing file is a machine that has answered nothing, not a failed read. A
 * file that exists but cannot be parsed or read is reported as unreadable and
 * admits nothing, so a damaged store cannot silently connect a server.
 */
export function readMcpApprovals(userDir: string, workspaceKey: string): McpApprovals {
  const empty = (state: McpApprovalState, detail?: string): McpApprovals =>
    detail === undefined ? { decisions: new Map(), state } : { decisions: new Map(), state, detail };
  const file = path.join(userDir, MCP_APPROVALS_FILE);
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return empty("absent");
    return empty("unreadable", (error as Error).message);
  }
  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return empty("unreadable", "the store is not an object");
    }
    const workspaces = (parsed as { workspaces?: unknown }).workspaces;
    if (workspaces === undefined) return empty("read");
    if (workspaces === null || typeof workspaces !== "object" || Array.isArray(workspaces)) {
      return empty("unreadable", "workspaces is not an object");
    }
    const entry = (workspaces as Record<string, unknown>)[workspaceKey];
    if (entry === undefined) return empty("read");
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      return empty("unreadable", "the workspace entry is not an object");
    }
    const decisions = new Map<string, McpApproval>();
    for (const [name, record] of Object.entries(entry as Record<string, unknown>)) {
      if (record === null || typeof record !== "object" || Array.isArray(record)) {
        return empty("unreadable", `the entry for ${name} is not a record`);
      }
      const { fingerprint, decision } = record as { fingerprint?: unknown; decision?: unknown };
      if (typeof fingerprint !== "string" || !/^[a-f0-9]{64}$/.test(fingerprint)) {
        return empty("unreadable", `the fingerprint for ${name} is not a digest`);
      }
      if (decision !== "approved" && decision !== "rejected") {
        return empty("unreadable", `the decision for ${name} is neither approved nor rejected`);
      }
      decisions.set(name, { fingerprint, decision });
    }
    return { decisions, state: "read" };
  } catch (error) {
    return empty("unreadable", (error as Error).message);
  }
}

/**
 * Record decisions for one workspace, replacing any earlier answer for the same
 * name and keeping the answers already stored for the other names.
 *
 * Throwing is deliberate: the caller reports a failed save as "you will be
 * asked again", which is only true while nothing was written.
 */
export function recordMcpApprovals(
  userDir: string,
  workspaceKey: string,
  entries: readonly { name: string; fingerprint: string; decision: McpDecision }[],
): void {
  const current = readMcpApprovals(userDir, workspaceKey);
  const stored: Record<string, McpApproval> = {};
  if (current.state !== "unreadable") {
    for (const [name, approval] of current.decisions) stored[name] = approval;
  }
  for (const entry of entries) {
    stored[entry.name] = { fingerprint: entry.fingerprint, decision: entry.decision };
  }

  const file = path.join(userDir, MCP_APPROVALS_FILE);
  // Every other workspace's answers are carried over: a save must not drop them.
  const all = readWorkspaces(userDir);
  all[workspaceKey] = stored;
  const body = `${JSON.stringify({ version: 1, workspaces: all }, null, 2)}\n`;
  fs.mkdirSync(userDir, { recursive: true, mode: 0o700 });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, body, { mode: 0o600 });
  fs.renameSync(temporary, file);
}

/** Other workspaces' entries, preserved verbatim so a save never drops them. */
function readWorkspaces(userDir: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(userDir, MCP_APPROVALS_FILE), "utf8")) as unknown;
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const workspaces = (parsed as { workspaces?: unknown }).workspaces;
    if (workspaces === null || typeof workspaces !== "object" || Array.isArray(workspaces)) return {};
    if (workspaces === undefined) return {};
    return { ...(workspaces as Record<string, unknown>) };
  } catch {
    return {};
  }
}

/**
 * Decide every declared server.
 *
 * A rejection stands until the declaration changes, an approval covers exactly
 * the declaration it was granted for, and `approveAll` - a switch the person
 * keeps in their own settings - admits every declaration in this workspace
 * without recording an answer for any of them.
 */
export function resolveMcpServers(
  declared: Record<string, McpServerConfig>,
  approvals: McpApprovals,
  options: { approveAll?: boolean } = {},
): McpAdmission {
  const connect: string[] = [];
  const pending: HeldMcpServer[] = [];
  const declined: string[] = [];
  for (const [name, config] of Object.entries(declared)) {
    const fingerprint = mcpServerFingerprint(config);
    const recorded = approvals.decisions.get(name);
    if (recorded?.fingerprint === fingerprint) {
      if (recorded.decision === "approved") connect.push(name);
      else declined.push(name);
      continue;
    }
    // A changed declaration is a new question: the old answer does not carry.
    if (options.approveAll) {
      connect.push(name);
      continue;
    }
    pending.push({ name, fingerprint, reason: recorded === undefined ? "unapproved" : "declaration-changed" });
  }
  const byName = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
  return {
    connect: connect.sort(byName),
    pending: pending.sort((a, b) => byName(a.name, b.name)),
    declined: declined.sort(byName),
  };
}

/** One line naming what is held and how to answer it. */
export function heldMcpServerNotice(
  pending: readonly HeldMcpServer[],
  declined: readonly string[],
  approvals: McpApprovalState,
): string | undefined {
  if (!pending.length && !declined.length) return undefined;
  const parts: string[] = [];
  if (pending.length) {
    const changed = pending.filter(item => item.reason === "declaration-changed").map(item => item.name);
    const cause = changed.length ? `; changed since approval: ${changed.join(", ")}` : "";
    const store = approvals === "unreadable" ? "; the approval store could not be read" : "";
    parts.push(
      `${pending.length} project server(s) awaiting approval (${pending.map(item => item.name).join(", ")})${cause}${store}; approve with --approve-mcp-server NAME or decline with --reject-mcp-server NAME`,
    );
  }
  if (declined.length) parts.push(`declined: ${declined.join(", ")}`);
  return `mcp: ${parts.join("; ")}`;
}
