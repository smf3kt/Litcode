# -*- coding: utf-8 -*-
"""Wave D step 7c: remove metadata.ts's dead telemetry-record builders.

Everything from the EnvContext type to the end of the file is one contiguous
region whose only entry point was getEventMetadata, and getEventMetadata had no
reader left after 7a deleted the two transports that consumed its output. The
surviving half is the tool-name / skill-name / file-extension helpers, which the
tool execution path and the permission dialogs still call.
"""
B = '/Users/mant1ssa/Projects/cc-base-2188/'
P = 'services/analytics/metadata.ts'
DEAD = '/**\n * Environment context metadata\n */\nexport type EnvContext = {\n'

t = open(B + P, encoding='utf-8').read()
i = t.index(DEAD)
surviving = t[:i]
assert 'EnvContext' not in surviving, 'a live line names the dead region'
assert surviving.rstrip().endswith('return result as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS\n}')

# The import block was written for the dead half: of its twenty-one bindings only
# four are still referenced, and none of them for the tool-name helpers.
old_head = """// biome-ignore-all assist/source/organizeImports: ANT-ONLY import markers must not be reordered
import { feature } from 'bun:bundle'
/**
 * Shared event metadata enrichment for analytics systems
 *
 * This module provides a single source of truth for collecting and formatting
 * event metadata. The two transports that consumed it (Datadog, 1P) are gone;
 * the tool-name and skill-name helpers below still have live callers in the
 * tool execution path.
 */

import { extname } from 'path'
import memoize from 'lodash-es/memoize.js'
import { env, getHostPlatformForAnalytics } from '../../utils/env.js'
import { envDynamic } from '../../utils/envDynamic.js'
import { getModelBetas } from '../../utils/betas.js'
import { getMainLoopModel } from '../../utils/model/model.js'
import {
  getSessionId,
  getIsInteractive,
  getKairosActive,
  getClientType,
  getParentSessionId as getParentSessionIdFromState,
} from '../../bootstrap/state.js'
import { isEnvTruthy } from '../../utils/envUtils.js'
import { isOfficialMcpUrl } from '../mcp/officialRegistry.js'
import { isClaudeAISubscriber, getSubscriptionType } from '../../utils/auth.js'
import { getRepoRemoteHash } from '../../utils/git.js'
import {
  getWslVersion,
  getLinuxDistroInfo,
  detectVcs,
} from '../../utils/platform.js'
import type { CoreUserData } from 'src/utils/user.js'
import { getAgentContext } from '../../utils/agentContext.js'
import type { EnvironmentMetadata } from '../../types/generated/events_mono/claude_code/v1/claude_code_internal_event.js'
import type { PublicApiAuth } from '../../types/generated/events_mono/common/v1/auth.js'
import { jsonStringify } from '../../utils/slowOperations.js'
import {
  getAgentId,
  getParentSessionId as getTeammateParentSessionId,
  getTeamName,
  isTeammate,
} from '../../utils/teammate.js'
"""
new_head = """/**
 * Shared analytics metadata helpers.
 *
 * The module used to hold a single source of truth for event metadata: an
 * environment context builder, a process-metrics sampler, a user-data record and
 * a 1P snake_case formatter. All of it existed to feed the two transports that
 * went in wave D step 7a, so it went with them.
 *
 * What is left is the part the tree still calls, and it is all PII redaction:
 * the tool-name sanitizer, the MCP-detail and skill-name extractors, the
 * bounded tool-input serializer, and the file-extension helpers. Callers are the
 * tool execution path and the permission dialogs.
 */

import { extname } from 'path'
import { isEnvTruthy } from '../../utils/envUtils.js'
import { isOfficialMcpUrl } from '../mcp/officialRegistry.js'
import { jsonStringify } from '../../utils/slowOperations.js'
"""
assert surviving.count(old_head) == 1
surviving = surviving.replace(old_head, new_head)

open(B + P, 'w', encoding='utf-8').write(surviving)
print('kept lines:', len(surviving.split('\n')))
