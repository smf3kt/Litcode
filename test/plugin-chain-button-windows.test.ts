// The Windows branch of the keybinding header (W45-66). The copied header decides two of its default
// keys from the platform: `Me` is `alt+v` there and `ctrl+v` elsewhere, and `Le` — the toggle key — is
// decided by a version comparison the header only runs on Windows. That comparison reaches the
// application runtime's own semver (`Yho`, chunk-bk5ct2gw.js [342203,342254): `Bun.semver.satisfies`),
// so this file binds both the platform and that global before the copied header runs — which is why the
// seam is imported dynamically rather than statically. The fixture answers what the source's runtime
// would; what is under test is that the header takes the gate and asks the right question, not the
// comparison itself.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bindHostPlatform } from '../src/plugin-chain-fs-boundaries.js';

const asked: Array<[string, string]> = [];
(globalThis as { Bun?: unknown }).Bun = {
  semver: {
    satisfies: (version: string, range: string): boolean => {
      asked.push([version, range]);
      return true;
    },
  },
};
bindHostPlatform(() => 'windows');
const keys = await import('../src/plugin-chain-keys.js');

test('the Windows header asks its runtime for the version gate and derives its two keys from it', () => {
  assert.equal(keys.KEY_PLATFORM, 'windows', 'the platform the header was handed');
  assert.equal(keys.KEY_PLATFORM_IS_WINDOWS, true, 'the source\'s own word for Windows');
  assert.equal(keys.KEY_PASTE_KEY, 'alt+v', 'measured: the paste binding is the Windows one');
  assert.equal(keys.KEY_PLATFORM_USES_TOGGLE, true, 'and the fixture said the version gate passes');
  assert.equal(keys.KEY_TOGGLE_KEY, 'shift+tab', 'so the toggle key is the versioned one');
  assert.deepEqual(asked, [['1.4.3', '>=1.2.23']],
    'the source asks about the helper\'s own version before the running one, and `nA` answers true');
});
