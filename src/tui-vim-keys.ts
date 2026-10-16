import type { EditorAction, EditorCommand } from './terminal.js';
import type { VimKey } from './tui-vim.js';

const names: Partial<Record<EditorCommand,string>> = {left:'left',right:'right',up:'up',down:'down',home:'home',end:'end',
  backspace:'backspace',delete:'delete',submit:'return',newline:'return'};

/** Decode the already-framed owned event into source BFt's key shape. */
export function vimKey(action: EditorAction): VimKey | undefined {
  let key='',name='',ctrl=false,meta=false;
  if(action.type==='return')return {key:'',name:'return',meta:action.meta,shift:action.shift,preventDefault(){}};
  if(action.type==='insert'){key=action.text;name=key;}
  else if(action.type==='key') {
    if(action.sequence==='\x1b'){name='escape';}
    else if(action.command){name=names[action.command]??action.command;key=action.command==='newline'?'\n':'';
      ctrl=!names[action.command]&&!['extendLeft','extendRight','extendUp','extendDown'].includes(action.command);
      meta=action.sequence.startsWith('\x1b')&&action.sequence.length===2;}
    else if(action.sequence.startsWith('\x1b')&&action.sequence.length===2){key=action.sequence.slice(1);name=key;meta=true;}
    else if(/^[^\u0000-\u001f\u007f]+$/u.test(action.sequence)){key=action.sequence;name=key;}
    else return undefined;
  }else if(action.type in names){name=names[action.type as EditorCommand]!;key=action.type==='newline'?'\n':'';}
  else if(['interrupt','eof','search','undo','yank','yankPop','killLineStart','killLineEnd','killWordForward','killWordBackward','killWORDBackward','logicalHome','logicalEnd','wordLeft','wordRight','externalEditor'].includes(action.type)){
    name=action.type;ctrl=true;
  }else return undefined;
  return {key,name,ctrl,meta,preventDefault(){}};
}
