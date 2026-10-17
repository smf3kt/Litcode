import { GJe, LOe, rjt, yXn } from './plugin-chain-workflow-named-source.js';
import {
  configureNamedWorkflowHost,
  type NamedWorkflowHostOptions,
  type NamedWorkflowRecord,
} from './workflow-named-host.js';

// Public seam over the recovered named-workflow catalog
// (chunk-9r54k71g.js, ranges in
// research/ports/W158-named-workflows.plan.json). Discovery reads user
// workflows from `<userDir>/workflows` and project workflows from
// `.harness/workflows` at each workspace ancestor, merges them under the
// recovered precedence, and caches the result per workspace until
// `clearNamedWorkflowCache`.

export type { NamedWorkflowHostOptions, NamedWorkflowPlugin, NamedWorkflowRecord, NamedWorkflowSource }
  from './workflow-named-host.js';

export async function listNamedWorkflows(workspace: string): Promise<NamedWorkflowRecord[]> {
  // The recovered `b` reads the user branch through storage only when a
  // storage argument is present; locally it is absent so both branches read
  // the filesystem.
  return await LOe(workspace, undefined) as NamedWorkflowRecord[];
}

export async function resolveNamedWorkflow(
  name: string, workspace: string,
): Promise<NamedWorkflowRecord | undefined> {
  return await rjt(name, workspace, undefined) as NamedWorkflowRecord | undefined;
}

export function clearNamedWorkflowCache(): void {
  yXn();
}

// `GJe`: the recovered name-only gate (HARNESS_WORKFLOW_NAME_ONLY).
export function isNamedWorkflowNameOnly(): boolean {
  return Boolean(GJe());
}

export function configureNamedWorkflows(options: NamedWorkflowHostOptions = {}): void {
  configureNamedWorkflowHost(options);
}
