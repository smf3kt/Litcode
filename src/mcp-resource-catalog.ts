import type { McpCatalogListing, McpCatalogResource, McpCatalogTemplate } from './mcp.js';

type CatalogFields = { resources?: McpCatalogResource[]; templates?: McpCatalogTemplate[] };
export type ResourceCatalogChange = 'notification' | 'reopen';
export interface ResourceCatalogSource {
  name: string;
  identity(): object | undefined;
  load(signal: AbortSignal): Promise<CatalogFields>;
  subscribe(changed: (cause: ResourceCatalogChange) => void): () => void;
}

/** T2e, chunk-zqyjdv9s.js [7849,8425), UTF-16. Host owns timer cancellation and fetch abort. */
class ResourceRefetch {
  private idle = true;
  private pending: { settled: Promise<void>; settle(): void } | undefined;
  private last = Number.NEGATIVE_INFINITY;
  private interval = 1000;
  private timer: NodeJS.Timeout | undefined;
  private running: Promise<void> | undefined;
  private closed = false;
  constructor(private readonly fetch: () => Promise<void>) {}
  request(): Promise<void> {
    if (this.closed) return Promise.resolve();
    if (!this.pending) {
      let settle = () => {};
      const settled = new Promise<void>(resolve => { settle = resolve; });
      this.pending = { settled, settle };
      if (this.idle) this.schedule();
      return settled;
    }
    return this.pending.settled;
  }
  private schedule(): void {
    this.idle = false;
    const remaining = this.last + this.interval - performance.now();
    if (remaining > 0) this.timer = setTimeout(() => { this.timer = undefined; this.run(); }, remaining).unref();
    else this.run();
  }
  private run(): void {
    const pending = this.pending;
    this.pending = undefined;
    if (!pending || this.closed) { pending?.settle(); this.idle = true; this.interval = 1000; return; }
    this.running = this.fetch().catch(() => {}).finally(() => {
      this.last = performance.now(); pending.settle(); this.running = undefined;
      if (!this.pending || this.closed) { this.idle = true; this.interval = 1000; return; }
      this.schedule(); this.interval = Math.min(this.interval * 2, 30000);
    });
  }
  close(): Promise<void> {
    this.closed = true; clearTimeout(this.timer); this.timer = undefined;
    this.pending?.settle(); this.pending = undefined;
    return this.running ?? Promise.resolve();
  }
}

type CatalogGeneration = {
  identity: object;
  controller: AbortController;
  refetch: ResourceRefetch;
  load(): Promise<void>;
  pending: Set<Promise<void>>;
  initial: Promise<void>;
};
type CatalogSlot = { source: ResourceCatalogSource; active?: CatalogGeneration };

/** RTe, 24k7d6mw [1570315,1571741); applyQueuedUpdates, 05jp8hm2 [4214,7029), UTF-16. */
export class McpResourceCatalog {
  private readonly slots: CatalogSlot[] = [];
  private readonly unsubscribe: (() => void)[] = [];
  private readonly listeners = new Set<(listing: McpCatalogListing) => void>();
  private readonly retiring = new Set<Promise<void>>();
  private readonly listing: McpCatalogListing = { resources: {}, templates: {} };
  private started = false;
  private closed = false;
  private closing: Promise<void> | undefined;
  private readonly aborted = () => { void this.close(); };
  constructor(sources: readonly ResourceCatalogSource[], private readonly lifetime: AbortSignal) {
    for (const source of sources) {
      const slot: CatalogSlot = { source };
      this.slots.push(slot);
      this.unsubscribe.push(source.subscribe(cause => {
        if (!this.started || this.closed) return;
        const previous = slot.active;
        const active = this.synchronize(slot);
        if (active && active === previous) {
          // ka/Gm, sb190ksj [48170,48515)/[118418,118548), UTF-16; reopen calls the raw handler.
          if (cause === 'reopen') void active.load();
          else void active.refetch.request();
        }
      }));
    }
    lifetime.addEventListener('abort', this.aborted, { once: true });
    if (lifetime.aborted) void this.close();
  }
  subscribe(listener: (listing: McpCatalogListing) => void): () => void {
    if (this.closed) return () => {};
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  private snapshot(): McpCatalogListing { return structuredClone(this.listing); }
  private publish(): void { for (const listener of this.listeners) listener(this.snapshot()); }
  private retire(active: CatalogGeneration): void {
    active.controller.abort();
    const done = Promise.all([active.refetch.close(), ...active.pending]).then(() => {});
    this.retiring.add(done);
    void done.finally(() => { this.retiring.delete(done); });
  }
  private synchronize(slot: CatalogSlot): CatalogGeneration | undefined {
    const identity = slot.source.identity();
    if (identity === slot.active?.identity) return slot.active;
    if (slot.active) this.retire(slot.active);
    slot.active = undefined;
    if (!identity) {
      delete this.listing.resources[slot.source.name]; delete this.listing.templates[slot.source.name];
      this.publish(); return;
    }
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, this.lifetime]);
    let revision = 0;
    const fetch = async () => {
      if (this.closed || signal.aborted || slot.source.identity() !== identity) return;
      const current = ++revision;
      const fields = await slot.source.load(signal);
      if (this.closed || signal.aborted || slot.source.identity() !== identity || current !== revision) return;
      const name = slot.source.name;
      if (fields.resources !== undefined) {
        if (fields.resources.length) this.listing.resources[name] = fields.resources;
        else delete this.listing.resources[name];
      }
      if (fields.templates !== undefined) {
        if (fields.templates.length) this.listing.templates[name] = fields.templates;
        else delete this.listing.templates[name];
      }
      this.publish();
    };
    const pending = new Set<Promise<void>>();
    const load = () => {
      const done = fetch().catch(() => {}).finally(() => { pending.delete(done); });
      pending.add(done);
      return done;
    };
    const refetch = new ResourceRefetch(load);
    const active: CatalogGeneration = { identity, controller, refetch, load, pending, initial: load() };
    slot.active = active;
    return active;
  }
  async read(signal: AbortSignal): Promise<McpCatalogListing> {
    signal.throwIfAborted();
    if (this.closed) throw new Error('MCP resource catalog closed');
    this.started = true;
    const pending = this.slots.map(slot => this.synchronize(slot)?.initial);
    await new Promise<void>((resolve, reject) => {
      const abort = () => reject(signal.reason);
      signal.addEventListener('abort', abort, { once: true });
      void Promise.all(pending).then(() => { signal.removeEventListener('abort', abort); resolve(); });
    });
    signal.throwIfAborted();
    return this.snapshot();
  }
  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.closed = true;
    this.lifetime.removeEventListener('abort', this.aborted);
    for (const unsubscribe of this.unsubscribe) unsubscribe();
    this.listeners.clear();
    for (const slot of this.slots) if (slot.active) this.retire(slot.active);
    return this.closing = Promise.all(this.retiring).then(() => {});
  }
}
