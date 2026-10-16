// @ts-nocheck
// Exact source bodies; provenance: research/ports/W44-visual-copies.json.
import { kAe } from './tui-highlight-manager.js'; import { Idt } from './tui-color.js'; import { bzn } from './tui-component-host.js';
var jt=500;function MXe(l,a,i,u){let d=`${u}\x00${kAe.pluginGrammarGeneration}\x00${Idt()}`,o=bzn(d,i),m=l.get(o);if(m!==void 0){if(l.delete(o),m.code===i&&m.variant===d)return l.set(o,m),m.highlighted}let c=a.highlight(i,{language:u});if(l.size>=jt){let g=l.keys().next().value;if(g!==void 0)l.delete(g)}return l.set(o,{variant:d,code:i,highlighted:c}),c}

export { MXe };
