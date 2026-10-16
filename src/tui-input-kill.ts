import { inputCursor } from './tui-input-navigation.js';

export type InputKillCommand = 'killLineStart' | 'killLineEnd' | 'killWordForward' | 'killWordBackward' | 'killWORDBackward';

/** BFt/Si range semantics with owned raw mutation instead of NFC modifyText. */
export function inputKillRange(text: string, offset: number, columns: number, command: InputKillCommand) {
  const cursor = inputCursor(text, columns, offset);
  let start = offset, end = offset;
  const direction = command === 'killLineEnd' || command === 'killWordForward' ? 'append' : 'prepend';
  switch (command) {
    case 'killLineStart': start = text[offset - 1] === '\n' ? cursor.left().offset : cursor.startOfLine().offset; break;
    case 'killLineEnd': end = text[offset] === '\n' ? cursor.right().offset : cursor.endOfLine().offset; break;
    case 'killWordForward': end = cursor.forwardWord().offset; break;
    case 'killWordBackward': start = cursor.backwardWord().offset; break;
    case 'killWORDBackward': start = cursor.prevWORD().offset; break;
  }
  start = cursor.snapOutOfPlaceholder(start, 'start');
  end = cursor.snapOutOfPlaceholder(end, 'end');
  return { start, end, text: text.slice(start, end), direction } as const;
}
