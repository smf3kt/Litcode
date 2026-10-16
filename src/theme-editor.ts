import fs from 'node:fs';
import path from 'node:path';
import { atomicWriteFile } from './atomic-write.js';
import { defaultUserDir } from './config.js';
import { initializeThemeFileWriter, initializeThemeEditorActions, gn } from './tui-theme-editor-source.js';
import { HK } from './tui-theme-overrides-source.js';
import { S1 } from './tui-theme-colors.js';
import type { CustomTheme } from './tui-custom-themes.js';
import type { BuiltinTheme, ThemeSetting } from './tui-theme-state.js';

export function themeFileWriter(userDir = defaultUserDir()): (theme: CustomTheme) => Promise<void> {
  const directory = path.join(path.resolve(userDir), 'themes');
  const save = initializeThemeFileWriter({
    j: () => false, mr: () => false, _: JSON.stringify, Fe: {}, t: () => {}, gt: String,
    C: path.join, PQe: () => directory, K: () => {},
    Jne: (file: string) => ({ write: async (value: unknown) => {
      let mode = 0o600;
      for (const target of [directory, file]) {
        try {
          const stat = fs.lstatSync(target);
          if (stat.isSymbolicLink() || (target === directory ? !stat.isDirectory() : !stat.isFile()))
            throw new Error('Theme target must be a regular file in a directory');
          if (target === file) mode = stat.mode & 0o777;
        } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      }
      const content = JSON.stringify(value, null, 2) + '\n';
      if (Buffer.byteLength(content) > 262144) throw new Error('Theme file exceeds 256KB');
      atomicWriteFile(file, content, {mode, label: 'saveCustomTheme'});
    } }),
  });
  return async theme => {
    if (!theme.slug || theme.slug.length > 200 || /[/\\\x00-\x1f\x7f]/.test(theme.slug) || theme.slug === '.' || theme.slug === '..')
      throw new Error('Theme slug must name one local file');
    await save(theme, undefined);
  };
}

export interface ThemeEditorHost {
  save(theme: CustomTheme): Promise<void>;
  reload(): Promise<unknown>;
  pick(theme: ThemeSetting): Promise<void>;
  preview(overrides: Record<string, string> | null): void;
  changed(): void;
}

/** React state setters bind the copied callbacks to one modal owner and serialized writes. */
export class ThemeEditor {
  mode: 'name' | 'colors' = 'name';
  name: string;
  slug: string;
  readonly base: BuiltinTheme;
  overrides: Record<string, string>;
  token: string | null = null;
  value = '';
  cursor = 0;
  error: string | undefined;
  private pending: Promise<void> = Promise.resolve();
  private closed = false;
  private creating: Promise<void> | undefined;
  private finishCreating: (() => void) | undefined;
  readonly fork: boolean;

  constructor(initial: CustomTheme | undefined, defaultBase: BuiltinTheme,
    private readonly catalog: readonly CustomTheme[], private readonly host: ThemeEditorHost) {
    this.fork = initial !== undefined && initial.source !== 'user';
    this.mode = initial && !this.fork ? 'colors' : 'name';
    this.name = initial?.name ?? '';
    this.slug = this.fork ? '' : initial?.slug ?? '';
    this.base = initial?.base ?? defaultBase;
    this.overrides = {...initial?.overrides};
  }

  get tokens(): string[] { return Object.keys(S1(this.base)).sort(); }
  filtered(query: string): string[] { const lower = query.toLowerCase(); return lower ? this.tokens.filter(key => key.toLowerCase().includes(lower)) : this.tokens; }
  get theme(): CustomTheme { return {slug:this.slug, name:this.name, base:this.base, overrides:{...this.overrides}, source:'user'}; }
  get valid(): boolean { return HK(this.value); }
  effective(token: string): string { return this.actions().effective(token); }
  preset(token: string): string { const colors = S1(this.base); return colors[token as keyof typeof colors]; }

  private actions() {
    const save = (theme: CustomTheme) => {
      const owned = structuredClone(theme);
      this.pending = this.pending.catch(() => {}).then(() => this.host.save(owned));
      return this.pending;
    };
    const report = (message: string) => {
      if (this.closed) return;
      this.error = message; this.host.changed();
      this.pending = this.pending.catch(() => {});
      this.finishCreating?.(); this.finishCreating = undefined;
    };
    return initializeThemeEditorActions({
      i:this.overrides, f:S1(this.base), c:this.token, T:this.value, g:this.slug, m:this.name, u:this.base, le:undefined,
      Mn:(value: Record<string,string>) => { this.overrides = {...value}; },
      v:(value: Record<string,string> | null) => { if (!this.closed) this.host.preview(value); },
      rWt:save, t:report,
      lt:(value: string) => { this.value = value; }, ft:(cursor: number) => { this.cursor = cursor; },
      De:(token: string | null) => { this.token = token; },
      qs:(record: Record<string,string>, key: string) => Object.fromEntries(Object.entries(record).filter(([name]) => name !== key)),
      Re:this.name.trim().length > 0, U:this.slug || gn(this.name, this.catalog), Ke:this.name.trim(),
      Je:(slug: string) => { this.slug = slug; }, at:(name: string) => { this.name = name; },
      Ue:(mode: 'name' | 'colors') => { this.mode = mode; },
      Te:() => this.closed ? undefined : this.host.reload(),
      ie:(theme: ThemeSetting) => {
        if (this.closed) return;
        this.pending = this.host.pick(theme).catch(error => report(String(error))).finally(() => {
          this.finishCreating?.(); this.finishCreating = undefined;
        });
      },
      DX:(slug: string) => `custom:${slug}`, d:() => {},
    });
  }

  create(name: string): void {
    if (this.closed || !name.trim()) return;
    this.name = name; this.error = undefined;
    this.creating = new Promise(resolve => { this.finishCreating = resolve; });
    this.actions().create();
  }
  edit(token: string): void { if (this.closed || !this.tokens.includes(token)) return; this.error = undefined; this.actions().edit(token); }
  change(value: string): void { if (!this.closed) { this.error = undefined; this.actions().change(value); } }
  accept(): boolean { if (this.closed || !this.valid) return false; this.error = undefined; this.actions().accept(); return true; }
  cancelValue(): void { if (!this.closed) { this.actions().cancel(); this.error = undefined; } }
  reset(token: string): void { if (!this.closed) { this.error = undefined; this.actions().reset(token); } }
  async flush(): Promise<void> { await this.creating; await this.pending.catch(() => {}); }
  close(): void {
    if (this.closed) return;
    this.actions().done(); this.closed = true;
    this.finishCreating?.(); this.finishCreating = undefined;
  }
}
