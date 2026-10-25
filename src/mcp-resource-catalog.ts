import type { McpCatalogListing, McpCatalogResource, McpCatalogTemplate } from './mcp.js';

type CatalogFields = { resources?: McpCatalogResource[]; templates?: McpCatalogTemplate[] };
export type ResourceCatalogChange = 'notification' | 'reopen';
export interface McpCatalogSource<Fields> {
  name: string;
  identity(): object | undefined;
  load(signal: AbortSignal): Promise<Fields>;
  subscribe(changed: (cause: ResourceCatalogChange) => void): () => void;
}
export type ResourceCatalogSource = McpCatalogSource<CatalogFields>;

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
type CatalogSlot<Value> = { source: McpCatalogSource<Value | undefined>; active?: CatalogGeneration };

/** RTe, 24k7d6mw [1569414,1571741); applyQueuedUpdates, 05jp8hm2 [4214,7029), UTF-16. */
export class McpLiveCatalog<Value> {
  private readonly slots: CatalogSlot<Value>[] = [];
  private readonly unsubscribe: (() => void)[] = [];
  private readonly listeners = new Set<(listing: Record<string, Value>) => void>();
  private readonly retiring = new Set<Promise<void>>();
  private readonly listing = new Map<string, Value>();
  private started = false;
  private closed = false;
  private closing: Promise<void> | undefined;
  private readonly aborted = () => { void this.close(); };
  constructor(sources: readonly McpCatalogSource<Value | undefined>[], private readonly lifetime: AbortSignal,
    private readonly merge: (previous: Value | undefined, next: Value) => Value = (_previous, next) => next) {
    for (const source of sources) {
      const slot: CatalogSlot<Value> = { source };
      this.slots.push(slot);
      this.unsubscribe.push(source.subscribe(cause => {
        if (!this.started || this.closed) return;
        const previous = slot.active;
        const active = this.synchronize(slot);
        if (active && active === previous) {
          // ka/Km/Gm, sb190ksj [48170,48515)/[118292,118548), UTF-16; reopen calls the raw handler.
          if (cause === 'reopen') void active.load();
          else void active.refetch.request();
        }
      }));
    }
    lifetime.addEventListener('abort', this.aborted, { once: true });
    if (lifetime.aborted) void this.close();
  }
  subscribe(listener: (listing: Record<string, Value>) => void): () => void {
    if (this.closed) return () => {};
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  private snapshot(): Record<string, Value> { return structuredClone(Object.fromEntries(this.listing)); }
  private publish(): void { for (const listener of this.listeners) listener(this.snapshot()); }
  private retire(active: CatalogGeneration): void {
    active.controller.abort();
    const done = Promise.all([active.refetch.close(), ...active.pending]).then(() => {});
    this.retiring.add(done);
    void done.finally(() => { this.retiring.delete(done); });
  }
  private synchronize(slot: CatalogSlot<Value>): CatalogGeneration | undefined {
    const identity = slot.source.identity();
    if (identity === slot.active?.identity) return slot.active;
    if (slot.active) this.retire(slot.active);
    slot.active = undefined;
    if (!identity) {
      this.listing.delete(slot.source.name);
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
      if (fields !== undefined) this.listing.set(slot.source.name, this.merge(this.listing.get(slot.source.name), fields));
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
  async read(signal: AbortSignal): Promise<Record<string, Value>> {
    signal.throwIfAborted();
    if (this.closed) throw new Error('MCP catalog closed');
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

/** RTe, 24k7d6mw [1570315,1571741), UTF-16; resource families merge independently. */
export class McpResourceCatalog {
  private readonly catalog: McpLiveCatalog<CatalogFields>;
  constructor(sources: readonly ResourceCatalogSource[], lifetime: AbortSignal) {
    this.catalog = new McpLiveCatalog(sources, lifetime, (previous, next) => ({
      resources: next.resources ?? previous?.resources, templates: next.templates ?? previous?.templates,
    }));
  }
  private project(listing: Record<string, CatalogFields>): McpCatalogListing {
    const resources = Object.fromEntries(Object.entries(listing).flatMap(([name, value]) => value.resources?.length ? [[name, value.resources]] : []));
    const templates = Object.fromEntries(Object.entries(listing).flatMap(([name, value]) => value.templates?.length ? [[name, value.templates]] : []));
    return { resources, templates };
  }
  subscribe(listener: (listing: McpCatalogListing) => void): () => void {
    return this.catalog.subscribe(listing => listener(this.project(listing)));
  }
  async read(signal: AbortSignal): Promise<McpCatalogListing> { return this.project(await this.catalog.read(signal)); }
  close(): Promise<void> { return this.catalog.close(); }
}
