import { osc52Payload } from './clipboard-osc52.js';
import { ra } from './tui-graphemes.js';
import { Nx } from './tui-text-style.js';

export interface CopySelectionHost {
  getState(): { isDragging: boolean } | null;
  hasSelection(): boolean;
  copySelectionNoClear(): string;
}

// xBe callback, qh0w98pn [5223,5742), UTF-16; refs/effect event live in this terminal's owner.
export function selectionAutoCopy(l: CopySelectionHost, ce: ()=>{copyOnSelect?: boolean}, _: (text: string)=>void) {
  const x = {current:false}, I = {current:null as string | null};
  const change = ()=>{let U=l.getState(),F=l.hasSelection();if(U?.isDragging){x.current=false,I.current=null;return}if(!F){x.current=false,I.current=null;return}if(x.current){I.current=null;return}if(!(ce().copyOnSelect??true))return;let j=l.copySelectionNoClear();if(!j||!j.trim()){x.current=true;return}x.current=true,I.current=j,_(j)};
  return { change, peek:()=>I.current, invalidate:()=>{I.current=null;},
    reset:()=>{x.current=false;I.current=null;} };
}

export interface SelectionKey {
  wheelUp?: boolean; wheelDown?: boolean; escape?: boolean; pageUp?: boolean; pageDown?: boolean;
  home?: boolean; end?: boolean; ctrl?: boolean; leftArrow?: boolean; rightArrow?: boolean;
  upArrow?: boolean; downArrow?: boolean; shift?: boolean; meta?: boolean; super?: boolean;
}

// QLt, qh0w98pn [3815,4061), UTF-16.
export function QLt(l: SelectionKey){if(l.wheelUp||l.wheelDown||l.escape)return false;if(l.pageUp||l.pageDown)return false;if((l.home||l.end)&&l.ctrl)return false;if((l.leftArrow||l.rightArrow||l.upArrow||l.downArrow||l.home||l.end)&&(l.shift||l.meta||l.super))return false;return true}

// lbt, 24k7d6mw [124140,124299), UTF-16.
export function lbt(h: string,T: SelectionKey){if(T.upArrow||T.downArrow||T.home||T.end)return true;if(h.length!==1)return false;if(T.ctrl)return"udbfnp".includes(h);return"jkgGb {}".includes(h)}

// AZ, eb9r2hbv [991,1071), UTF-16; copied ra supplies the grapheme iterator.
function AZ(e: string){if(!e)return 0;let t=0;for(let r of ra().segment(e))t++;return t}

const Fse = ['pycharm','intellij','webstorm','phpstorm','rubymine','clion','goland','rider','datagrip','appcode','dataspell','aqua','gateway','fleet','jetbrains','androidstudio'];
const pt = new Set(['ghostty','kitty','WezTerm','alacritty','xterm','gnome-terminal','vte-based','konsole','windows-terminal','mintty',...Fse]);
const ft = new Set(['vscode','cursor','windsurf','antigravity','codium']);

// ITo/xt/Z, yvnhkg35 [6878,9042)/[12597,12692), UTF-16.
function ITo(t: string){let o=t.toLowerCase();return o.includes("windsurf")||o.includes("devin.app")||o.includes("devin desktop")||o.includes("devin-desktop")||/appdata[\\/]local[\\/](programs[\\/])?devin[\\/]/.test(o)}
function xt(){if(process.env.CURSOR_TRACE_ID)return"cursor";let t=process.env.VSCODE_GIT_ASKPASS_MAIN?.toLowerCase()??"";if(t.includes("cursor"))return"cursor";if(ITo(t))return"windsurf";if(t.includes("antigravity"))return"antigravity";let o=process.env.__CFBundleIdentifier?.toLowerCase();if(o?.includes("vscodium"))return"codium";if(o?.includes("windsurf")||o?.includes("devin"))return"windsurf";if(o?.includes("com.google.android.studio"))return"androidstudio";if(o){for(let _ of Fse)if(o.includes(_))return _}if(process.env.VisualStudioVersion)return"visualstudio";if(process.env.TERMINAL_EMULATOR==="JetBrains-JediTerm")return"pycharm";if(process.env.TERM==="xterm-ghostty")return"ghostty";if(process.env.TERM?.includes("kitty"))return"kitty";if(process.env.TERM_PROGRAM){if(/^devin([ -]desktop)?$/i.test(process.env.TERM_PROGRAM))return"windsurf";return process.env.TERM_PROGRAM}if(process.env.TMUX)return"tmux";if(process.env.STY)return"screen";if(process.env.KONSOLE_VERSION)return"konsole";if(process.env.GNOME_TERMINAL_SERVICE)return"gnome-terminal";if(process.env.XTERM_VERSION)return"xterm";if(process.env.VTE_VERSION)return"vte-based";if(process.env.TERMINATOR_UUID)return"terminator";if(process.env.KITTY_WINDOW_ID)return"kitty";if(process.env.ALACRITTY_LOG)return"alacritty";if(process.env.TILIX_ID)return"tilix";if(process.env.WT_SESSION)return"windows-terminal";if(process.env.SESSIONNAME&&process.env.TERM==="cygwin")return"cygwin";if(process.env.MSYSTEM)return process.env.MSYSTEM.toLowerCase();if(process.env.ConEmuANSI||process.env.ConEmuPID||process.env.ConEmuTask)return"conemu";if(process.env.WSL_DISTRO_NAME)return`wsl-${process.env.WSL_DISTRO_NAME}`;if(Z())return"ssh-session";if(process.env.TERM){let _=process.env.TERM;if(_.includes("alacritty"))return"alacritty";if(_.includes("rxvt"))return"rxvt";if(_.includes("termite"))return"termite";return process.env.TERM}if(!process.stdout.isTTY)return"non-interactive";return null}
function Z(){return!!(process.env.SSH_CONNECTION||process.env.SSH_CLIENT||process.env.SSH_TTY)}
export { xt as detectTerminal };

// P6e, kexg5hxg [7870,8411), UTF-16; this host has no attached-terminal override.
function nativeSelectionModifier(env: NodeJS.ProcessEnv, platform: NodeJS.Platform): string {
  const terminal = xt();
  if (terminal === 'Apple_Terminal') return 'Fn';
  if (terminal === 'iTerm.app') return 'Option';
  if (terminal && ft.has(terminal)) return platform === 'darwin' ? 'Option' : 'Shift';
  if (terminal && pt.has(terminal)) return 'Shift';
  if (env.LC_TERMINAL === 'iTerm2') return 'Option';
  return env.SSH_CONNECTION || env.TMUX || env.STY || env.ZELLIJ || platform === 'darwin'
    ? 'Shift (Option in iTerm2, Fn in Terminal.app)' : 'Shift';
}

// mt/_xn and Vln, kexg5hxg [10057,10253), qh0w98pn [4719,5223), UTF-16; W37 owns OSC52.
export function selectionCopyFeedback(text: string): { text: string; timeoutMs: number } {
  const count = AZ(text), unit = count === 1 ? 'char' : 'chars';
  const warning = Nx.hasOsc52ClipboardUtf8Bug() && /[^\x00-\x7f]/.test(text)
    ? 'VS Code 1.123/1.124 will mojibake this paste — update to ≥1.125' : null;
  const feedback = `sent ${count} ${unit} via OSC 52 · if paste fails, hold ${nativeSelectionModifier(process.env, process.platform)} while selecting for native copy`;
  return { text: warning ? `⚠ ${warning} · ${feedback}` : feedback, timeoutMs: warning ? 6000 : 4000 };
}

export function copySelectionText(text: string, write: (payload: string)=>void): void {
  write(osc52Payload(text));
}
