import type { EditorState } from './terminal.js';
import { ge } from './tui-color.js';

// chunk-24k7d6mw.js [809815,809924), UTF-16. Provenance: W284-composer-history-tag.md.
export function gue(h: number, T: number | null, M: boolean): string | undefined {
  if(h===0||M)return;if(T===null)return"History";return`History ${Math.max(1,T-h+1)}/${T}`
}

/** `tRe` [848742,848808), UTF-16. The local editor stores oldest-first indices. */
export function historyBorderText({ history, historyIndex, text }: Pick<EditorState, 'history' | 'historyIndex' | 'text'>):
  { content: string; position: 'top'; align: 'start'; offset: number } | undefined {
  const eRe = gue(history.length - historyIndex, history.length, text !== history[historyIndex]);
  return eRe?{content:` ${Reflect.get(ge, 'dim')(eRe)} `,position:"top",align:"start",offset:2}:void 0;
}
