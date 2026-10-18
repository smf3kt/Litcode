import { Ace } from './plugin-chain-keys-rows-source.js';
import { w1 } from './plugin-chain-keys-source.js';
import { E1 } from './diff-dialog-keyhint-source.js';
import { Oe } from './plugin-chain-registry-stores-source.js';

interface Handler {
  action: string;
  context: string;
  handler: () => unknown;
  singleKey?: boolean;
  fallback?: boolean;
}
interface KeyRecord { key: string; ctrl: boolean; alt: boolean; shift: boolean; meta: boolean; super: boolean }
interface Binding { context: string; action: string | null; chord: KeyRecord[] }

/** Jmt/Yt handler ownership. The terminal keymap resolves shared composer chords once. */
export class NativeKeybindings {
  readonly bindings = Ace(w1) as Binding[];
  readonly keyHandlerRegistry = {
    decls: new WeakMap(), scopesChanged: Oe(), preemptiveScopes: new Map(), swallowAll: new Map(),
  };
  private readonly handlers = new Set<Handler>();
  private readonly contexts = new Map<string, number>();

  registerHandler = (handler: Handler): (() => void) => {
    this.handlers.add(handler);
    return () => { this.handlers.delete(handler); };
  };
  registerActiveContext = (context: string): void => {
    this.contexts.set(context, (this.contexts.get(context) ?? 0) + 1);
  };
  unregisterActiveContext = (context: string): void => {
    const count = (this.contexts.get(context) ?? 0) - 1;
    if (count > 0) this.contexts.set(context, count);
    else this.contexts.delete(context);
  };
  getDisplayText = (action: string, context: string): string | undefined => {
    const binding = this.bindings.findLast(entry => entry.action === action && entry.context === context);
    return binding ? E1(binding.chord) : undefined;
  };
  get handlerCount(): number { return this.handlers.size; }
  get activeContexts(): string[] { return [...new Set([...this.handlers].map(handler => handler.context).concat([...this.contexts.keys()]))]; }

  /** Yt, chunk-frj2b06g.js [7157,11338) UTF-16. Primary handlers precede fallbacks. */
  dispatchAction(action: string): boolean {
    if (this.keyHandlerRegistry.swallowAll.size) return true;
    const held = [...this.handlers];
    const primary = held.filter(handler => !handler.fallback);
    const ordered = [...primary, ...held.filter(handler => handler.fallback
      && !primary.some(other => other.action === handler.action))];
    for (const handler of ordered) {
      if (handler.action === action && handler.handler() !== false) return true;
    }
    return false;
  }

  close(): void { this.handlers.clear(); this.contexts.clear(); this.keyHandlerRegistry.scopesChanged.clear(); }
}
