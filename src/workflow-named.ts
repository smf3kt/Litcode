import { GJe, LOe } from './plugin-chain-workflow-named-source.js';
import {
  createNamedWorkflowState, withNamedWorkflowState,
  type NamedWorkflowHostOptions,
  type NamedWorkflowRecord,
} from './workflow-named-host.js';

// Public seam over the recovered named-workflow catalog
// (chunk-9r54k71g.js, ranges in
// research/ports/W158-named-workflows.plan.json). Discovery reads user
// workflows from `<userDir>/workflows` and project workflows from
// `.harness/workflows` at each workspace ancestor, merges them under the
// recovered precedence, and caches the result per workspace until
// owner invalidation.

export type { NamedWorkflowHostOptions, NamedWorkflowPlugin, NamedWorkflowRecord, NamedWorkflowSource }
  from './workflow-named-host.js';

async function listNamedWorkflows(workspace: string): Promise<NamedWorkflowRecord[]> {
  // The recovered `b` reads the user branch through storage only when a
  // storage argument is present; locally it is absent so both branches read
  // the filesystem.
  return await LOe(workspace, undefined) as NamedWorkflowRecord[];
}


// `GJe`: the recovered name-only gate (HARNESS_WORKFLOW_NAME_ONLY).
export function isNamedWorkflowNameOnly(): boolean {
  return Boolean(GJe());
}


// Host-keyed xr/it (chunk-qm4226vk.js [3461,3497), chunk-3ph567jx.js
// [3729,3763), UTF-16). Bind the copied catalog at its public boundary.
export class NamedWorkflowCatalog {
  private current;
  private closed = false;
  private pluginIdentity: string | undefined;
  constructor(private readonly options: NamedWorkflowHostOptions = {}) {
    this.current = createNamedWorkflowState(options);
  }
  async list(workspace: string): Promise<NamedWorkflowRecord[]> {
    if (this.closed) throw new Error('Named workflow catalog is closed');
    // The local index is shared across runtimes/processes; copied P/LOe memoize
    // bodies, so refresh the owner generation when its committed identity changes.
    const identity = this.options.pluginIdentity?.();
    if (identity !== this.pluginIdentity) {
      this.invalidate();
      this.pluginIdentity = identity;
    }
    const generation = this.current;
    const records = await withNamedWorkflowState(generation, () => listNamedWorkflows(workspace));
    if (identity !== this.options.pluginIdentity?.()) {
      this.invalidate();
      throw new Error('Named workflow plugins changed during discovery');
    }
    if (this.closed || generation !== this.current) throw new Error('Named workflow catalog changed during discovery');
    return records;
  }
  async resolve(name: string, workspace: string): Promise<NamedWorkflowRecord | undefined> {
    const pending = this.list(workspace);
    const generation = this.current;
    const records = await pending;
    if (this.closed || generation !== this.current) throw new Error('Named workflow catalog changed during resolution');
    return records.find(record => record.name === name);
  }
  invalidate(): void {
    if (this.closed) return;
    this.current = createNamedWorkflowState(this.options);
  }
  close(): void {
    this.closed = true;
    this.current = createNamedWorkflowState();
  }
}
