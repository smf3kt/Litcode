import { TuiDocumentRenderer } from '../src/tui-document-renderer.js';
import { jsx } from '../src/tui-jsx.js';
import { Welcome } from '../src/tui-welcome.js';

for (const columns of [50, 58, 80, 120]) {
  const renderer = new TuiDocumentRenderer();
  try {
    const rows = renderer.renderElement(jsx(Welcome, { theme: 'dark', version: '1', compact: false }, undefined), columns,
      { theme: 'dark' });
    console.log(columns, rows.length, Math.max(...rows.map(row => row.text.length)), JSON.stringify(rows[0]?.text));
  } finally { renderer.close(); }
}
