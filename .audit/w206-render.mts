import { jsx } from '../src/tui-jsx.js';
import { n, s } from '../src/tui-base-components.js';
import { TuiDocumentRenderer } from '../src/tui-document-renderer.js';
const r = new TuiDocumentRenderer();
const a = r.renderElement(jsx(n, { dimColor: true, children: 'STAMP-TEXT' }, 'stamp'), 60, { theme: 'dark' });
console.log('bare Text rows', JSON.stringify(a));
const b = r.renderElement(jsx(s, { children: jsx(n, { dimColor: true, children: 'STAMP-TEXT' }, 'stamp') }, 'box'), 60, { theme: 'dark' });
console.log('boxed rows', JSON.stringify(b));
