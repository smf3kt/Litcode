import { environmentTheme, initializeThemeActions, resolveThemeSource, themeChoices, mot } from './tui-theme-source.js';
import { i9t } from './tui-theme-overrides-source.js';
import { S1 } from './tui-theme-colors.js';
import { lookupCustomTheme, type CustomTheme } from './tui-custom-themes.js';

export type BuiltinTheme = 'dark' | 'light' | 'light-daltonized' | 'dark-daltonized' | 'light-ansi' | 'dark-ansi';
export type ThemeSetting = BuiltinTheme | 'auto' | `custom:${string}`;
export { themeChoices };

export function parseTheme(value: unknown): ThemeSetting | undefined {
  return mot(value) ? value as ThemeSetting : undefined;
}

/** Saved and preview values follow the source provider; reset binds a session. */
export class ThemeState {
  private saved: ThemeSetting = 'dark';
  private preview: ThemeSetting | null = null;
  private system: BuiltinTheme = 'dark';
  private cachedSystem: 'dark' | 'light' | undefined;
  private customs: readonly CustomTheme[] = [];
  private revision = 0;
  private previewOverrides: Record<string, string> | null = null;
  private readonly actions: {
    setThemeSetting(value: ThemeSetting): void;
    setPreviewTheme(value: ThemeSetting): void;
    cancelPreview(): void;
  };

  constructor(value?: ThemeSetting) {
    this.actions = initializeThemeActions({
      rt: (theme: ThemeSetting) => { this.saved = theme; },
      J: (theme: ThemeSetting | null) => { this.preview = theme; },
      C: (theme: BuiltinTheme) => { this.system = theme; },
      Zme: () => this.cachedSystem ?? environmentTheme() ?? 'dark',
      I: () => {},
    });
    this.reset(value);
  }

  get setting(): ThemeSetting { return this.saved; }
  get automatic(): boolean { return (this.preview ?? this.saved) === 'auto'; }
  get activeCustom(): CustomTheme | undefined {
    const value = this.preview ?? this.saved;
    return value.startsWith('custom:') ? lookupCustomTheme(this.customs, value.slice(7)) : undefined;
  }
  get current(): BuiltinTheme { return resolveThemeSource(this.preview ?? this.saved, this.system, this.activeCustom); }
  get overrides(): Record<string, string> | undefined { return this.previewOverrides ?? this.activeCustom?.overrides; }
  setPreviewOverrides(value: Record<string, string> | null): void { this.previewOverrides = value === null ? null : {...value}; this.revision++; }
  get resolved(): Record<string, string> { return i9t(S1(this.current), this.overrides); }
  get generation(): number { return this.revision; }
  setCustomThemes(themes: readonly CustomTheme[]): void { this.customs = themes; this.revision++; }
  setSystemTheme(value: 'dark' | 'light'): void { this.cachedSystem = value; this.system = value; }
  reset(value?: ThemeSetting): void { this.actions.setThemeSetting(value ?? 'dark'); }
  previewTheme(value: ThemeSetting): void { this.actions.setPreviewTheme(value); }
  cancelPreview(): void { this.actions.cancelPreview(); }
}
