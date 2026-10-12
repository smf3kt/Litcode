import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const pattern = process.argv.includes('--arrays') ? 'CLI array sampling' : 'CLI image sampling';
const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', '--test-name-pattern=' + pattern,
  'test/cli-mcp-requests.test.ts'], { cwd: root, stdio: 'inherit', env: { ...process.env,
  HARNESS_SMOKE_COMPILED: process.argv.includes('--compiled') ? '1' : '0', HARNESS_SMOKE_RECEIPT: '1' } });
process.exitCode = result.status ?? 1;
