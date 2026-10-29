import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fTr } from '../src/shell-command-clamp-source.js';

test('source clamp checks each parsed command against every rule group', async () => {
  const echo = ['Bash(echo:*)'];
  assert.equal(await fTr({ command: 'echo ok' }, []), null);
  assert.equal(await fTr({ command: 'echo ok' }, [echo]), null);
  assert.equal(await fTr({ command: 'timeout 2s echo ok' }, [echo]), null);
  assert.equal(await fTr({ command: 'command echo ok' }, [echo]), null);
  assert.deepEqual(await fTr({ command: 'echo ok; rm target' }, [echo]),
    { span: 'rm target', group: echo, kind: 'unmatched' });
  assert.equal(await fTr({ command: 'echo ok; printf hi' }, [['Bash(echo:*)', 'Bash(printf:*)']]), null);
  assert.equal(await fTr({ command: 'echo ok | cat' }, [['Bash(echo:*)', 'Bash(cat:*)']]), null);
  assert.equal(await fTr({ command: 'echo hi > out' }, [['Bash(echo hi)']]), null);
  assert.equal(await fTr({ command: 'echo "雪"' }, [echo]), null);
  const second = ['Bash(printf:*)'];
  assert.deepEqual(await fTr({ command: 'echo ok' }, [echo, second]),
    { span: 'echo ok', group: second, kind: 'unmatched' });
});

test('source clamp returns unverifiable when analysis cannot bound command spans', async () => {
  const group = ['Bash(echo:*)'];
  for (const command of ['', 'echo $(whoami)', 'x'.repeat(10001)]) {
    assert.deepEqual(await fTr({ command }, [group]), { span: command.trim(), group, kind: 'unverifiable' });
  }
});
