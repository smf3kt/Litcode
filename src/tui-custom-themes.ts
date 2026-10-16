import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { defaultUserDir } from './config.js';
import { discoverInstalledPluginComponents, type PluginConfig } from './plugins.js';
import { initializeCustomThemes } from './tui-custom-theme-source.js';
import { initializePluginThemes } from './tui-plugin-theme-source.js';
import type { BuiltinTheme } from './tui-theme-state.js';

export interface CustomTheme {
  slug: string;
  name: string;
  base: BuiltinTheme;
  overrides: Record<string, string>;
  source: 'user' | { plugin: string };
}

export function lookupCustomTheme(themes: readonly CustomTheme[], slug: string): CustomTheme | undefined {
  return initializePluginThemes({ VJn: () => [], br: () => false, g: () => {},
    BU: () => ({ cachedUserThemes: () => themes.filter(theme => theme.source === 'user'),
      pluginThemes: { getState: () => themes.filter(theme => theme.source !== 'user') } }) }).lookup(slug);
}

/** User watching and plugin activation have separate generations and publish only owned results. */
export class CustomThemeCatalog {
  private themes: CustomTheme[] = [];
  private userThemes: CustomTheme[] = [];
  private pluginThemes: CustomTheme[] = [];
  private directory: string | undefined;
  private generation = 0;
  private pluginGeneration = 0;
  private closed = false;
  private stopWatching: (() => void) | undefined;
  private loading: Promise<CustomTheme[]> = Promise.resolve([]);
  private pluginLoading: Promise<void> = Promise.resolve();
  private source: ReturnType<typeof initializeCustomThemes> | undefined;

  constructor(private readonly changed: (themes: CustomTheme[]) => void,
    private readonly warning: (message: string) => void) {}

  get values(): readonly CustomTheme[] { return this.themes; }

  private publish(): void {
    const themes = [...this.userThemes, ...this.pluginThemes];
    if (!isDeepStrictEqual(themes, this.themes)) { this.themes = themes; this.changed(themes); }
  }

  bind(userDir = defaultUserDir(), workspace?: string, plugins?: PluginConfig): void {
    if (this.closed) return;
    const directory = path.resolve(userDir);
    if (this.directory !== directory) {
      this.stopWatching?.(); this.stopWatching = undefined;
      this.directory = directory; const generation = ++this.generation;
      this.userThemes = []; this.pluginThemes = []; this.publish();
      let cached: CustomTheme[] = [];
      this.source = initializeCustomThemes({
        be: () => directory,
        BU: () => ({ cachedUserThemes: () => cached,
          commitUserThemes: (themes: CustomTheme[]) => {
            if (!isDeepStrictEqual(cached, themes)) cached = themes;
            return cached;
          } }),
        t: (message: string) => { if (!this.closed && generation === this.generation) this.warning(message); },
      });
      this.stopWatching = this.source.watch(() => { void this.reload(); });
      void this.reload();
    }
    this.loadPlugins(workspace, plugins);
  }

  private loadPlugins(workspace?: string, plugins?: PluginConfig): void {
    const generation = ++this.pluginGeneration, source = this.source;
    if (!workspace || !plugins?.enabled || !source) {
      this.pluginThemes = []; this.publish(); return;
    }
    const config = structuredClone(plugins);
    this.pluginLoading = this.pluginLoading.then(async () => {
      if (this.closed || generation !== this.pluginGeneration) return;
      try {
        const before = discoverInstalledPluginComponents(workspace, config);
        let candidate = this.pluginThemes;
        const loader = initializePluginThemes({
          VJn: source.readPath,
          BU: () => ({ addCustomThemeBases: () => {}, cachedUserThemes: () => this.userThemes,
            pluginThemes: { getState: () => candidate, setState: (update: (previous: CustomTheme[]) => CustomTheme[]) => { candidate = update(candidate); } } }),
          br: () => false, g: () => {},
        });
        await loader.load(before.flatMap(item => item.themePaths ? [item.themePaths] : []));
        const after = discoverInstalledPluginComponents(workspace, config);
        if (!isDeepStrictEqual(before, after)) throw new Error('Installed plugin catalog changed during theme load');
        if (this.closed || generation !== this.pluginGeneration) return;
        this.pluginThemes = candidate; this.publish();
      } catch (error) {
        if (this.closed || generation !== this.pluginGeneration) return;
        this.pluginThemes = []; this.publish();
        this.warning(error instanceof Error ? error.message : String(error));
      }
    });
  }

  reload(): Promise<CustomTheme[]> {
    if (this.closed || !this.source) return Promise.resolve(this.themes);
    const source = this.source, generation = this.generation;
    this.loading = source.load(undefined).then((themes: CustomTheme[]) => {
      if (this.closed || generation !== this.generation) return this.themes;
      this.userThemes = themes; this.publish();
      return this.themes;
    }).catch((error: unknown) => {
      if (!this.closed && generation === this.generation) this.warning(error instanceof Error ? error.message : String(error));
      return this.themes;
    });
    return this.loading;
  }

  async ready(): Promise<CustomTheme[]> { await Promise.all([this.loading, this.pluginLoading]); return this.themes; }

  choices(): { label: string; value: string; origin?: string }[] {
    return this.source ? this.themes.map(theme => this.source!.choice(theme)) : [];
  }

  close(): void {
    if (this.closed) return;
    this.closed = true; this.generation++; this.pluginGeneration++;
    this.stopWatching?.(); this.stopWatching = undefined; this.source = undefined;
  }
}
