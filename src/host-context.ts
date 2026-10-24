import path from 'node:path';
import { defaultUserDir, HARNESS_DIR } from './config.js';
import type { SessionConfig } from './session.js';

// Nl/mFn/u_s, chunk-14rnebpd.js [275300,275362)/[275593,275928), UTF-16; product naming replaces vendor identity.
export const HOST_IDENTITY = 'You are LiTcode, a personal coding assistant running in the LiTcode CLI.';

// FHn/Ug, chunk-sfn1dbxq.js [118927,119601)/[114824,114914), UTF-16; configured paths replace source host facades.
export function hostContext(config: Pick<SessionConfig, 'workspace' | 'configSources' | 'model'>): string {
  const workspace = path.resolve(config.workspace);
  const userDir = path.resolve(config.configSources?.userDir ?? defaultUserDir());
  const projectDir = path.join(workspace, HARNESS_DIR);
  const fact = (label: string, value: string) => `${label}: ${JSON.stringify(value)}`;
  return [
    '# Current application host',
    HOST_IDENTITY,
    'Product: LiTcode',
    'The configured model identifies the language model, not the CLI. Keep model identity and application identity separate.',
    'Other client directories such as ~/.codex and ~/.claude may coexist. Their presence does not select this session\'s host or installation targets.',
    'For installation requests targeting this assistant, use the LiTcode directories below unless the user explicitly names another application.',
    'Install user-wide skills in the user skills directory and project-local skills in the project skills directory, using <skill-name>/SKILL.md.',
    'For plugins, use the available LiTcode plugin tools and their reported installation paths. Check package compatibility before running an installer for another CLI.',
    fact('Configured model', config.model),
    fact('Primary working directory', workspace),
    fact('User configuration directory', userDir),
    fact('User settings file', path.join(userDir, 'settings.json')),
    fact('User skills directory', path.join(userDir, 'skills')),
    fact('User agents directory', path.join(userDir, 'agents')),
    fact('Project configuration directory', projectDir),
    fact('Project settings file', path.join(projectDir, 'settings.json')),
    fact('Project skills directory', path.join(projectDir, 'skills')),
    fact('Project agents directory', path.join(projectDir, 'agents')),
    fact('Project plugin store', path.join(projectDir, 'plugins')),
    ...(config.configSources?.settingsFile === undefined ? []
      : [fact('Additional settings file', path.resolve(workspace, config.configSources.settingsFile))]),
    ...(config.configSources?.managedSettingsFile === undefined ? []
      : [fact('Managed settings file', path.resolve(workspace, config.configSources.managedSettingsFile))]),
  ].join('\n');
}
