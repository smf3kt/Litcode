import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { isDeepStrictEqual, types as utilTypes } from 'node:util';
import { refreshAutoMode, transitionPlanMode } from './plan-resume.js';
import { modelPlanModeEventSchema, planHostResultSchema, type ModelPlanModeEvent, type PlanModeHost, type PlanExitMode } from './plan-mode.js';
import { sessionPlanFile, type PlanOwnership } from './plan-file.js';
import { createPlanRuntime } from './plan-runtime-host.js';
import { classifierMessageSchema, classifierMessage, markClassifierMessage } from './message-origin.js';
import { z } from 'zod';
import { effortSelectionSchema, modelSettingsSchema, type EffortSelection, type ModelSettings } from './effort-command.js';
import type Anthropic from '@anthropic-ai/sdk';
import type { GatewayConfig } from './provider.js';
import { parseTheme, type ThemeSetting } from './tui-theme-state.js';
import { HOOK_EVENTS, hooksSchema, type HooksConfig } from './hooks.js';
import { autoPolicySchema, permissionPolicySchema, permissionLayerSchema, emptySessionPermissionUpdates, seedPermissionUpdates, bindPermissionOwner, reloadPermissionState, childPermissionState, type LivePermissionOwner, applyPermissionUpdates, type PermissionUpdate, type PermissionPolicy, type SessionPermissionUpdates } from './permissions.js';
import { persistPermissionUpdate, permissionSettingsPaths, type PermissionWriteResult, type PermissionIgnoreResult } from './permission-settings.js';
import { AutoModeDenialStore, permissionRetryMessage } from './permission-denials.js';
import { observeWorkingDirectory, resolveChain, verifyIdentity, type WorkingDirectories, type DirectoryReadHandle } from './path-identity.js';
import { defaultUserDir, settingFileHasContent } from './config.js';
import type { SkillInfo, ConditionalRule, InstructionSource } from './config.js';
import { mcpServersSchema, type McpServerConfig } from './mcp.js';
import { lspConfigSchema, type LspConfig } from './lsp.js';
import { keybindingsSchema } from './keybindings.js';
import type { Keybindings } from './terminal.js';
import { webSearchConfigSchema, type WebSearchConfig } from './web-search.js';
import { pluginConfigSchema, type PluginConfig } from './plugins.js';
import { agentTypesSchema, type AgentTypeInfo } from './agent-types.js';
import { clearCheckpointAssociation, recoverCheckpointAssociations, withIdleCheckpointStore } from './checkpoints.js';
import { sessionLockSchema, recoverableSessionLockSchema, type SessionGateIdentity } from './session-lock-record.js';
import { spinnerVerbsSchema } from './tui-progress-settings.js';
import { spinnerTipsLayersSchema } from './spinner-tips-settings.js';
import { notificationChannelSchema, type NotificationChannel } from './terminal-notifications.js';
import { statusLineSchema } from './tui-statusline-schema.js';
import { editorModeSchema, vimRemapsSchema } from './tui-vim.js';
import type { FileReadHostResult, LandedFileObservation, StoredToolUseResult } from './tool-use-result.js';
import { SourceReadCache } from './controlled-read-projection-source.js';
import { findingsHostResultSchema } from './source-findings.js';
import { questionHostResultSchema } from './question-result.js';
import { toolFeedbackBlocksSchema, type ToolFeedbackBlock } from './tool-feedback.js';
import { scheduledFireSchema, loopNoopCompanion, type ScheduledFire } from './loop-noop-fold.js';
import { agentMessagePinSchema, type AgentMessagePin } from './agent-messaging-host.js';
import { SETTING_SOURCE_ORDER, settingSourcesSchema, type SettingSource } from './setting-sources.js';
import { subscribeSettingsWrites, type SettingsWrite } from './setting-writes.js';
import { atomicWriteFile, syncDirectory } from './atomic-write.js';
import { consumeNotificationAuthorization, type NotificationAuthorization } from './notification-authorization.js';
import { consumeRuntimeWriteAuthorization, type RuntimeWriteAuthorization } from './agent.js';
import { lock as flock, SkillEffectJournal, type SkillEffectRetryGrant } from './skill-effects.js';
import { directoryFileObservationSchema, boundDirectoryFileObservationSchema, copyStableDirectoryFile, probeMissingDirectoryFile, publishDirectoryFile,
  publishRetainedDirectoryFile, observeRetainedDirectoryFile, type BoundDirectoryFileObservation, type DirectoryPublication, type DirectoryPublicationExpected,
  type DirectoryRetainedPublication, type DirectoryRetainedObservation } from './directory-file-state.js';
import { directoryPublicationIntentSchema, directoryPublicationResultSchema, directoryPublicationFailureSchema, directoryPublicationReceiptSchema,
  type DirectoryPublicationIntentEvent, type DirectoryPublicationResultEvent, type DirectoryPublicationFailureEvent,
  type DirectoryPublicationRecord } from './directory-publication-journal.js';
import { beginDirectoryCheckpointBracket as beginCheckpointBracket, type DirectoryCheckpointBracket,
  type DirectoryCheckpointBracketResult } from './directory-checkpoint-bracket.js';
import { checkpointRecoveryAnchor, checkpointRecoveryPrefix, collectDirectoryCheckpointReferences, consumeDirectoryCheckpointAuthorization, hasUnresolvedDirectoryHistoryTorn, inspectDirectoryCheckpointTornRecovery, isCheckpointRecoveryTextTurn, isReconciledCheckpointTorn,
  matchesTornCheckpointInheritance, readTornCheckpointEvidence, verifyDirectoryCheckpointTornCandidate } from './directory-checkpoint.js';
import type { PathApprovalCall } from './path-approval-call-owner.js';
import { consumeDirectoryPublicationAuthorization, describeDirectoryWriteInput, directoryWriteFingerprint, type DirectoryPublicationAuthorization } from './directory-publication-authorization.js';
import { directorySnapshotIntentSchema, directorySnapshotObservationSchema, directorySnapshotSchema, directorySnapshotRecoverySchema, directoryRewindExternalSchema, directoryCheckpointPathsSchema, directoryCheckpointInheritanceSchema, directoryCheckpointTornRecoverySchema,
  directoryHistoryTrackingPath, emptyDirectoryFileHistory, nextDirectoryHistoryVersion, reduceDirectoryFileHistory, selectDirectoryRewindSnapshot, shouldTrackDirectoryHistory,
  type DirectorySnapshotIntentEvent, type DirectorySnapshotObservationEvent, type DirectorySnapshotEvent, type DirectorySnapshotRecoveryEvent,
  type DirectoryHistoryEntry, type DirectoryHistoryPath, type DirectoryHistorySnapshot, type DirectoryHistoryState, type DirectoryCheckpointPaths, type DirectoryCheckpointInheritanceEvent, type DirectoryCheckpointTornRecoveryEvent,
  type DirectoryRewindSelection, type DirectoryRewindExternal } from './directory-file-history.js';

export type SessionConfig = {
  model: string;
  system: string;
  tools: Anthropic.Tool[];
  workspace: string;
  plansDirectory?: string;
  allowShell: boolean;
  maxOutputBytes: number;
  maxTokens: number;
  contextTokens: number;
  compactAt: number;
  autoCompactEnabled?: boolean;
  maxTurns: number;
  stopHookBlockCap?: number;
  automaticCheckpoints?: boolean;
  thinking: boolean;
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  /** Source `k` in `chunk-0q6c90q6.js` 5283: ultracode rides the session, not the settings. */
  ultracode?: boolean;
  modelSettings?: ModelSettings;
  effortSelection?: EffortSelection;
  childMode?: 'explore' | 'general';
  /** Host journal owner for a child session; retained across cold opens. */
  parentSessionId?: string;
  parentPlanId?: string;
  gateway?: GatewayConfig;
  hooks?: HooksConfig;
  permissions?: PermissionPolicy;
  /** Per-spawn `agent({bashCommandClamp})` groups. Every reading of a shell
   *  command has to match a rule in every group (source `fTr`). */
  bashCommandClamp?: string[][];
  /** Per-spawn `agent({stallMs})`: abort a model request that makes no progress
   *  for this many milliseconds (source `AGr`/`_0t`). */
  stallMs?: number;
  /** The same document `managedPolicySchema` parses, so a field the schema
   *  accepts is also a field the type carries (`autoMode`, `useAutoModeDuringPlan`). */
  managedPolicy?: z.infer<typeof managedPolicySchema>;
  policyHelper?: { path: string; intervalMs?: number; defaultPolicy?: SessionConfig['managedPolicy'] };
  /** The user's own switch for instruction imports that leave the workspace;
   *  read from the user layer and carried so child builds apply the same gate. */
  approveExternalIncludes?: boolean;
  /** Imports the last load skipped because they leave the workspace and were
   *  not approved; a reload replaces the list. */
  externalIncludes?: { path: string; parent?: string }[];
  skills?: SkillInfo[];
  /** Bumped when the installed plugin catalog changes under a live session. */
  pluginGeneration?: number;
  /** Load failures the plugin component reader reported on the last full config read. */
  pluginComponentDiagnostics?: import('./plugin-components.js').ComponentDiagnostic[];
  /** Conditional skills held back by `paths`; activation moves them into `skills`.
   *  Journaled with the session metadata: a resumed session keeps the same held
   *  list, and activation survives a reload because the list is replaced from
   *  the new load. */
  heldSkills?: SkillInfo[];
  /** `<HARNESS_DIR>/skills` directories discovered beside a touched path.
   *  The recovered `dAr` keeps the same per-session set and never rescans a
   *  candidate (chunk-sfn1dbxq.js offset 3396597); the set is journaled with
   *  the session so a resume keeps its discovered catalogs. */
  dynamicSkillDirs?: string[];
  /** Instruction files loaded for the eager InstructionsLoaded raise. */
  instructionSources?: InstructionSource[];
  /** The policy helper's `claudeMd` tier, journaled so a reload and a child
   *  prompt rebuild the same instruction section (chunk-x0dc37w9.js 71537). */
  policyHelperText?: string;
  conditionalRules?: ConditionalRule[];
  keybindings?: Keybindings;
  prefersReducedMotion?: boolean;
  showTurnDuration?: boolean;
  showMessageTimestamps?: boolean;
  copyOnSelect?: boolean;
  copyFullResponse?: boolean;
  preferredNotifChannel?: NotificationChannel;
  /** `messageIdleNotifThresholdMs`: idle time before the `idle_prompt` notification; 60000 when absent
   *  (`ce().messageIdleNotifThresholdMs`, chunk-24k7d6mw.js 1679555, default at chunk-bk5ct2gw.js 558979). */
  messageIdleNotifThresholdMs?: number;
  terminalTitleFromRename?: boolean;
  autoScrollEnabled?: boolean;
  promptSuggestionEnabled?: boolean;
  /** `/focus`'s persisted view mode; `focus` is the brief transcript. */
  viewMode?: import('./focus-command.js').FocusMode;
  /** The live Verbose output switch (`Te`); `viewMode` supplies its startup value. */
  verbose?: boolean;
  /** `progressBar`/`terminalProgressBarEnabled`: OSC 9;4 progress while the agent runs. */
  terminalProgressBarEnabled?: boolean;
  timeFormat?: string;
  timeZone?: string;
  spinnerVerbs?: import('./tui-progress-settings.js').SpinnerVerbs;
  spinnerTipsEnabled?: boolean;
  spinnerTipsLayers?: import('./spinner-tips-settings.js').SpinnerTipsLayer[];
  editorMode?: import('./tui-vim.js').EditorMode;
  vimInsertModeRemaps?: Record<string,unknown>;
  maxProseWidth?: number;
  /** `Kdt`: idle time before the question dialog auto-continues; absent means never. */
  askUserQuestionTimeout?: '60s' | '5m' | '10m' | 'never';
  /** `Ade`/`onn`: how long a held peer message awaits approval; absent is 5m. */
  dialogExpiry?: '60s' | '5m' | '10m' | 'never';
  syntaxHighlightingDisabled?: boolean;
  /** Composer workflow-keyword gates: the `dg` availability switch and the `C7t` trigger setting. */
  enableWorkflows?: boolean;
  workflowKeywordTriggerEnabled?: boolean;
  /** The `:name:` emoji typeahead. Absent or true enables it. */
  emojiCompletionEnabled?: boolean;
  /** Source `ft().respondToBashCommands ?? !0` (chunk-w79px1ss.js 14067): whether a drained `!`
   *  command's result is sent to the model or recorded as context only. */
  respondToBashCommands?: boolean;
  /** Source `r` (chunk-wtdka69b.js 887): the `disableAgentView` setting closes the fleet fork. */
  disableAgentView?: boolean;
  theme?: ThemeSetting;
  statusLine?: import('./tui-statusline.js').StatusLineSetting;
  webSearch?: WebSearchConfig;
  plugins?: PluginConfig;
  agentTypes?: AgentTypeInfo[];
  mcpServers?: Record<string, McpServerConfig>;
  /**
   * Project-declared MCP servers held for approval. They are never connected
   * while held, and each entry records why: never approved, or approved and
   * then edited.
   */
  heldMcpServers?: { name: string; fingerprint: string; reason: 'unapproved' | 'declaration-changed' }[];
  mcpClient?: { roots?: boolean; sampling?: boolean; samplingImages?: boolean; samplingArrays?: boolean; samplingAudio?: boolean; elicitation?: boolean };
  autoMemory?: boolean;
  autoMemoryConsolidation?: boolean;
  dynamicInstructions?: boolean;
  watchConfig?: boolean;
  worktreeReturn?: string;
  settingSources?: SettingSource[];
  configSources?: { userDir?: string; settingsFile?: string; managedSettingsFile?: string; overrides?: {
    autoMemory?: boolean; watchConfig?: boolean; allowShell?: boolean;
    permissions?: Omit<PermissionPolicy, 'mode'> & { mode?: PermissionPolicy['mode'] };
    mcpClient?: { roots?: boolean; sampling?: boolean; samplingImages?: boolean; samplingArrays?: boolean; samplingAudio?: boolean; elicitation?: boolean }; tasks?: boolean; subagents?: boolean;
  } };
  lspServers?: LspConfig;
  features?: { tasks: boolean; subagents: boolean; notebooks?: boolean; background?: boolean; scheduler?: boolean;
    workflowPersistence?: boolean; mcpSubscriptions?: boolean; mcpLogging?: boolean; mcpNotificationStream?: boolean; mcpRecovery?: boolean; mcpPersistence?: boolean; mcpTasks?: boolean; mcpStandardTasks?: boolean;
    taskProjections?: boolean; taskSourceVisibility?: boolean; promptSuggestions?: boolean;
    schedulerJitter?: boolean; schedulerDurable?: boolean; schedulerSourceCalendar?: boolean; skillInlineCommands?: boolean; skillQuotedArguments?: boolean; skillArgumentFallback?: boolean; skillExtendedArguments?: boolean; skillSourceArguments?: boolean; pluginSkillNamespaces?: boolean;
    agentMessaging?: boolean; unifiedAgentMessaging?: boolean; agentIdle?: boolean; agentTypes?: boolean; interaction?: boolean; questionPartialAnswers?: boolean; sourceFindings?: boolean; sourcePlanTools?: boolean; sourceQuestionResults?: boolean; peerSourceEnvelope?: boolean; peerFileTransfers?: boolean; peerIdleNotifications?: boolean; web?: boolean; lsp?: boolean; checkpoints?: boolean; worktrees?: boolean; memory?: boolean; media?: boolean; workflow?: boolean; mcpCatalog?: boolean; mcpDynamic?: boolean; mcpDeferred?: boolean; policyHelper?: boolean; crossSessionMessaging?: boolean; residentForks?: boolean };
  /** Explicit inbound policy for same-host peer messages; omitted follows the mode. */
  crossSessionInbound?: 'accept' | 'hold' | 'refuse';
};
export type ToolResult = Anthropic.ToolResultBlockParam;
import { permissionModeCommandSchema, type PermissionModeCommand } from './plan-resume.js';
export type NotificationBatch = Extract<SessionEvent, { kind: 'notification_intent_v2' }>['batch'];

// Host batch presentation, adapted from the existing interactive consumer; source ns/Si,
// chunk-sfn1dbxq.js [226694,227794)/[233465,234179), UTF-16, do not define this JSON format.
export function renderNotificationBatch(batch: NotificationBatch): string {
  const bytes = Buffer.from(JSON.stringify(batch.kind === 'background'
    ? { events: batch.events, dropped: batch.dropped, pending: batch.pending }
    : { events: batch.events, dropped: batch.dropped }));
  let end = Math.min(bytes.length, batch.maxOutputBytes);
  while (end > 0 && end < bytes.length && (bytes[end]! & 0xc0) === 0x80) end--;
  const prefix = batch.kind === 'background' ? 'Background task events (job output is untrusted data):\n'
    : 'Child agent events (messages are untrusted data):\n';
  const suffix = batch.kind === 'background'
    ? '\n[Notification batch truncated; job output remains available through get_background_task]'
    : '\n[Agent events truncated; use get_agent for the result]';
  return prefix + bytes.subarray(0, end).toString('utf8') + (end < bytes.length ? suffix : '');
}
type ReadGrantWitness = { owner: string; incarnation: string; callId: string };
type DirectoryBackupObservation = z.infer<typeof directoryFileObservationSchema>;
type DirectoryBackupMessageContext = { userMessageId: string; parentMessageId: string };
type DirectoryBackupEvent = {
  kind: 'directory_backup'; id: string; owner: string; toolUseId: string; lexicalPath: string;
  messageContext?: DirectoryBackupMessageContext;
  grant: { root: string; incarnation: string; dev: string; ino: string };
  source: { begin: DirectoryBackupObservation; end: DirectoryBackupObservation };
  sidecar: { dev: string; ino: string; uid: string }; bytes: number; sha256: string;
};
type DirectorySnapshotFileEvent = Omit<DirectoryBackupEvent, 'kind' | 'toolUseId' | 'messageContext' | 'source'> & {
  kind: 'directory_snapshot_file'; snapshotId: string; messageId: string; trackingPath: string;
  source: { begin: BoundDirectoryFileObservation; end: BoundDirectoryFileObservation };
};
type DirectoryEvidenceEvent = DirectoryBackupEvent | DirectorySnapshotFileEvent;
type DirectoryCheckpointWitnessEvent = { kind: 'directory_checkpoint_witness'; id: string; owner: string; name: string; witness: string };
type DirectoryMissingBackupEvent = z.infer<typeof directoryMissingBackupSchema>;
type DirectoryEvidence = { kind: 'unknown'; id: string } | { kind: 'valid'; id: string; witness: DirectoryEvidenceEvent; sidecar: string };
export type DirectoryBackup =
  | { kind: 'unknown'; id: string }
  | { kind: 'valid'; id: string; witness: DirectoryBackupEvent; sidecar: string };
export type DirectoryFileHistory = { kind: 'unknown' } | { kind: 'available'; snapshots: DirectoryHistorySnapshot[] };
type SessionOpenOptions = { config?: SessionConfig; id?: string; recoverLock?: boolean; storageRoot?: string; startedAt?: number;
  expectedJournal?: { bytes: number; sha256: string }; childRoot?: { parent: Session; isOwner: () => boolean; verifyHistory?: () => boolean } };
type ReadGrantContinuation = { root: string; owner: string; incarnation: string };
const directoryBackupJournalToken = Symbol('directory backup journal');
const directoryPublicationJournalToken = Symbol('directory publication journal');
export type SessionEvent =
  | ScheduledFire
  | { kind: 'loop_boundary'; reason: 'foreign_user_input' | 'tool_abort' }
  | PermissionModeCommand
  | ModelPlanModeEvent
  | { kind: 'metadata'; version: 1; id: string; config: SessionConfig; fingerprint: string; startedAt?: number; rootIdentity?: { rootSessionId: string; originalCwd: string } }
  | { kind: 'file_history'; path?: string; tracked: boolean }
  | DirectoryBackupEvent
  | DirectoryMissingBackupEvent
  | DirectorySnapshotFileEvent
  | DirectorySnapshotIntentEvent
  | DirectorySnapshotObservationEvent
  | DirectorySnapshotEvent
  | DirectorySnapshotRecoveryEvent
  | DirectoryCheckpointWitnessEvent
  | DirectoryCheckpointInheritanceEvent
  | DirectoryCheckpointTornRecoveryEvent
  | DirectoryPublicationIntentEvent
  | DirectoryPublicationResultEvent
  | DirectoryPublicationFailureEvent
  | { kind: 'directory_backup_failed'; id: string; owner: string; witness: string }
  | { kind: 'directory_snapshot_failed'; id: string; owner: string; witness: string }
  | { kind: 'agent_history'; id: string; digest: string }
  | { kind: 'agent_history_intent'; parent: string; id: string; oldDigest: string; newDigest: string; journal: { bytes: number; sha256: string } }
  | { kind: 'agent_message_pin'; key: string; pin: AgentMessagePin }
  | { kind: 'notification_intent'; deliveryId: string; owner: string; entries: { source: 'background' | 'agent'; taskId: string; text: string }[] }
  | { kind: 'notification_intent_v2'; deliveryId: string; owner: string; batch:
      | { kind: 'background'; events: import('./background.js').BackgroundEvent[]; dropped: number; pending: number; maxOutputBytes: number }
      | { kind: 'agent_events'; events: import('./agent-registry.js').AgentNotification[]; dropped: number; maxOutputBytes: number } }
  | { kind: 'message'; message: Anthropic.MessageParam; messageId?: string; response?: Anthropic.Message; isMeta?: boolean; directoryHistoryDisabled?: true; classifier?: import('./message-origin.js').ClassifierMessage; notificationDelivery?: { owner: string; deliveryId: string } }
  | { kind: 'mcp_catalog'; configDigest: string; disabledServers: string[]; unavailableServers?: string[]; tools: SessionConfig['tools'] }
  | { kind: 'mcp_subscription'; server: string; configDigest: string; method: 'resources/subscribe' | 'resources/unsubscribe'; uri: string }
  | { kind: 'mcp_task'; server: string; configDigest: string; taskId: string; tool: string; createdAt: string; ttl: number | null; resolved: boolean; result?: string; isError?: boolean }
  | { kind: 'tool_start'; id: string; name: string; parentMessageId?: string; writeInputDigest?: string;
      runtimeWriteOwner?: { owner: string; incarnation: string } }
  | ({ kind: 'runtime_write_execution'; id: string; parentMessageId: string; writeInputDigest: string;
      runtimeWriteOwner: { owner: string; incarnation: string } } &
      ({ phase: 'entered' } | { phase: 'completed'; outcome: 'returned' | 'threw' | 'blocked-additional-directory' }))
  | { kind: 'tool_result'; result: ToolResult; timestamp?: string; host?: StoredToolUseResult; feedbackBlocks?: ToolFeedbackBlock[]; readGrantWitness?: ReadGrantWitness }
  | { kind: 'tool_effect'; result: ToolResult; timestamp?: string; host?: StoredToolUseResult; feedbackBlocks?: ToolFeedbackBlock[]; readGrantWitness?: ReadGrantWitness }
  | { kind: 'read_observation'; result: ToolResult; timestamp?: string; host?: FileReadHostResult; readGrantWitness?: ReadGrantWitness }
  | { kind: 'write_observation'; result: ToolResult; operation: 'write_file' | 'edit_file'; landed: LandedFileObservation }
  | { kind: 'read_invalidate'; paths: string[] }
  | { kind: 'tool_output'; result: ToolResult }
  | { kind: 'hook_once'; event: string; key: string }
  | { kind: 'checkpoint'; name: string; digest: string; boundary: number }
  | { kind: 'rewind'; source: string; boundary: number; checkpoint: string; digest: string }
  | { kind: 'title'; title: string }
  | { kind: 'session_color'; color: import('./session-color.js').SessionColor | null }
  | { kind: 'refusal'; model: string; category?: string; explanation?: string; requestId?: string }
  | { kind: 'branch'; source: string; workspace: string; boundary: number; reason: 'fork' | 'rewind' | 'reload' | 'configuration' | 'relocation'; external?: DirectoryRewindExternal; checkpointPaths?: DirectoryCheckpointPaths }
  | { kind: 'hook_start'; id: string; event: string; toolUseId?: string; parentMessageId?: string }
  | { kind: 'hook_terminal'; id: string; event: string; sequences: string[] }
  | { kind: 'instruction_watch'; workspace: string; paths: string[] }
  | { kind: 'stop_hook_count'; count: number; hookId?: string }
  | { kind: 'hook_result'; id: string; event: string; blocked: boolean; reason?: string; additionalContext: string[]; stopRequested?: boolean; suppressOutput?: boolean; systemMessages?: string[]; terminalSequences?: string[]; userDisplayMessage?: string; backgroundTasks?: string[] }
  | { kind: 'compact'; summary: string; response: Anthropic.Message }
  | { kind: 'turn_end'; reason: string; duration?: import('./tui-progress.js').TurnDuration };

type CheckpointBranch = Extract<SessionEvent, { kind: 'branch' }> & { external: DirectoryRewindExternal; checkpointPaths: DirectoryCheckpointPaths };
type CheckpointSourceLock = NonNullable<DirectoryCheckpointTornRecoveryEvent['sourceLock']>;

// Kt/KWo, hwpb27as [121053,123737), sfn1dbxq [2275902,2308030), UTF-16;
// the host journal independently checks the admitted start and ordered execution observations.
function validateRuntimeWriteExecutions(events: readonly SessionEvent[], owner: string): void {
  type Start = Extract<SessionEvent, { kind: 'tool_start' }>;
  const calls = new Map<string, { start: Start; phase: 'started' | 'entered' | 'completed' | 'delivered' }>();
  for (const event of events) {
    if (event.kind === 'tool_start' && event.runtimeWriteOwner) {
      const key = JSON.stringify([event.parentMessageId, event.id]);
      if (event.runtimeWriteOwner.owner !== owner || calls.has(key)) throw new Error('Invalid runtime Write execution history');
      calls.set(key, { start: event, phase: 'started' });
    } else if (event.kind === 'runtime_write_execution') {
      const call = calls.get(JSON.stringify([event.parentMessageId, event.id]));
      if (!call || call.start.writeInputDigest !== event.writeInputDigest ||
          call.start.runtimeWriteOwner?.owner !== event.runtimeWriteOwner.owner ||
          call.start.runtimeWriteOwner.incarnation !== event.runtimeWriteOwner.incarnation ||
          (event.phase === 'entered' ? call.phase !== 'started' : call.phase !== 'entered'))
        throw new Error('Invalid runtime Write execution history');
      call.phase = event.phase;
    } else if (event.kind === 'tool_effect' || event.kind === 'tool_result') {
      for (const call of calls.values()) if (call.start.id === event.result.tool_use_id) call.phase = 'delivered';
    }
  }
}

// Host completed-snapshot suffix for rhe/Tke/Ole, sfn1dbxq [4728518,4730433)/[4732048,4733481)/[4694145,4697475), UTF-16;
// the source has no checkpoint recovery receipt or owner lock.
function completedCheckpointSnapshotAnchor(events: readonly SessionEvent[], owner: string): number {
  let end = events.length;
  while (end > 0) {
    const index = checkpointRecoveryAnchor(events, end), last = events[index];
    if (last?.kind === 'directory_checkpoint_torn_recovery') return index;
    if (index < 4 || last?.kind !== 'turn_end') return -1;
    const user = events[index - 4], intent = directorySnapshotIntentSchema.safeParse(events[index - 3]);
    const snapshot = directorySnapshotSchema.safeParse(events[index - 2]), assistant = events[index - 1];
    if (user?.kind !== 'message' || !user.messageId || user.directoryHistoryDisabled ||
        !intent.success || !snapshot.success || !isCheckpointRecoveryTextTurn(user, assistant, last) ||
        intent.data.owner !== owner || snapshot.data.owner !== owner || intent.data.id !== snapshot.data.id ||
        intent.data.messageId !== user.messageId || snapshot.data.messageId !== user.messageId ||
        intent.data.timestamp !== snapshot.data.timestamp || intent.data.paths.length !== 0 || snapshot.data.entries.length !== 0 ||
        snapshot.data.interrupted || snapshot.data.preCheckpoint) return -1;
    end = index - 4;
  }
  return -1;
}
const checkpointBranchAuthorizations = new Map<symbol, { source: Session; target: Session; event: CheckpointBranch; journal?: Buffer }>();
const checkpointInheritanceAuthorizations = new Map<symbol, { source: Session; target: Session; event: DirectoryCheckpointInheritanceEvent;
  sourceJournal: Buffer; targetJournal: Buffer }>();
const checkpointTornRecoveryAuthorizations = new Map<symbol, { source: Session; target: Session; event: DirectoryCheckpointTornRecoveryEvent;
  sourceJournal: Buffer; targetJournal: Buffer; evidence: Buffer }>();

const policyFeaturesSchema = z.object({ tasks: z.boolean().optional(), subagents: z.boolean().optional(), notebooks: z.boolean().optional(), background: z.boolean().optional(), scheduler: z.boolean().optional(),
  workflowPersistence: z.boolean().optional(), mcpSubscriptions: z.boolean().optional(), mcpLogging: z.boolean().optional(), mcpNotificationStream: z.boolean().optional(), mcpRecovery: z.boolean().optional(), mcpPersistence: z.boolean().optional(), mcpTasks: z.boolean().optional(), mcpStandardTasks: z.boolean().optional(), taskProjections: z.boolean().optional(), taskSourceVisibility: z.boolean().optional(), promptSuggestions: z.boolean().optional(), schedulerJitter: z.boolean().optional(), schedulerDurable: z.boolean().optional(), schedulerSourceCalendar: z.boolean().optional(), skillInlineCommands: z.boolean().optional(), skillQuotedArguments: z.boolean().optional(), skillArgumentFallback: z.boolean().optional(), skillExtendedArguments: z.boolean().optional(), skillSourceArguments: z.boolean().optional(), pluginSkillNamespaces: z.boolean().optional(),
  agentMessaging: z.boolean().optional(), unifiedAgentMessaging: z.boolean().optional(), agentIdle: z.boolean().optional(), agentTypes: z.boolean().optional(), interaction: z.boolean().optional(), questionPartialAnswers: z.boolean().optional(), sourceFindings: z.boolean().optional(), sourcePlanTools: z.boolean().optional(), sourceQuestionResults: z.boolean().optional(), peerSourceEnvelope: z.boolean().optional(), peerFileTransfers: z.boolean().optional(), peerIdleNotifications: z.boolean().optional(), web: z.boolean().optional(), lsp: z.boolean().optional(), checkpoints: z.boolean().optional(), worktrees: z.boolean().optional(), memory: z.boolean().optional(), media: z.boolean().optional(), workflow: z.boolean().optional(), mcpCatalog: z.boolean().optional(), mcpDynamic: z.boolean().optional(), mcpDeferred: z.boolean().optional(), policyHelper: z.boolean().optional(), residentForks: z.boolean().optional() }).strict();
export const managedPolicySchema = z.object({ useAutoModeDuringPlan: z.boolean().optional(), autoMode: autoPolicySchema.optional(), allowManagedPermissionRulesOnly: z.boolean().optional(), allowShell: z.boolean().optional(), permissions: permissionPolicySchema.optional(),
  features: policyFeaturesSchema.optional(), mcpClient: z.object({ roots: z.boolean().optional(), sampling: z.boolean().optional(), samplingImages: z.boolean().optional(), samplingArrays: z.boolean().optional(), samplingAudio: z.boolean().optional(), elicitation: z.boolean().optional() }).strict().optional() }).strict();

/** A policy-helper document may also carry the instruction text the recovered
 *  helper exposes as `claudeMd` (chunk-x0dc37w9.js 71537, `M2n`). */
export const managedHelperSchema = managedPolicySchema.extend({ claudeMd: z.string().optional() });

/** Pin only authored fields; permission arrays replace rather than concatenate. */
export function applyManagedPolicy(config: SessionConfig, policy: SessionConfig['managedPolicy']): void {
  if (policy === undefined) { delete config.managedPolicy; return; }
  const parsed = managedPolicySchema.parse(policy);
  config.managedPolicy = structuredClone(parsed);
  if (parsed.allowShell !== undefined) config.allowShell = parsed.allowShell;
  // The managed document also owns the `policySettings` permission layer
  // (`loadProjectConfig` reads the same document), so a refreshed policy
  // replaces that layer in the slot it already occupies. A document that stops
  // declaring a layer field removes the layer instead of leaving the previous
  // one in force.
  const layerFields = parsed.permissions !== undefined || parsed.autoMode !== undefined || parsed.useAutoModeDuringPlan !== undefined;
  const permissionPolicy = config.permissions;
  const existingLayers = permissionPolicy?.layers;
  if (existingLayers !== undefined) {
    const at = existingLayers.findIndex(layer => layer.source === 'policySettings');
    if (layerFields || at !== -1) {
      const rest = existingLayers.filter(layer => layer.source !== 'policySettings');
      if (layerFields) {
        const rules = parsed.permissions;
        const layer = permissionLayerSchema.parse({ source: 'policySettings', root: config.workspace,
          ...(parsed.autoMode === undefined ? {} : { autoMode: parsed.autoMode }),
          ...(parsed.useAutoModeDuringPlan === undefined ? {} : { useAutoModeDuringPlan: parsed.useAutoModeDuringPlan }),
          ...(parsed.autoMode?.classifyAllShell === undefined ? {} : { classifyAllShell: parsed.autoMode.classifyAllShell }),
          allow: rules?.allow ?? [], deny: rules?.deny ?? [], ask: rules?.ask ?? [],
          additionalDirectories: rules?.additionalDirectories ?? [] });
        // The loaded layer sits before the `cliArg` layer, and the CLI records
        // the last layer as the one reload must re-add; keeping the slot keeps
        // that capture the CLI's own.
        const before = at === -1
          ? rest.findIndex(item => item.source === 'cliArg')
          : existingLayers.slice(0, at).filter(item => item.source !== 'policySettings').length;
        rest.splice(before === -1 ? rest.length : before, 0, layer);
      }
      if (parsed.permissions !== undefined) {
        const { layers: _declared, ...rules } = parsed.permissions;
        config.permissions = { ...structuredClone(rules), layers: rest };
      } else {
        config.permissions = { ...permissionPolicy!, layers: rest };
      }
    }
  }
  if (parsed.allowManagedPermissionRulesOnly !== undefined && config.permissions) config.permissions.managedOnly = parsed.allowManagedPermissionRulesOnly;
  if (parsed.features) config.features = { tasks: true, subagents: true, ...config.features, ...parsed.features };
  if (parsed.mcpClient) config.mcpClient = { ...config.mcpClient, ...parsed.mcpClient };
}

export const configSchema = z.object({
  model: z.string().min(1), system: z.string(), tools: z.array(z.object({ name: z.string() }).passthrough()),
  workspace: z.string(), plansDirectory: z.string().optional(), allowShell: z.boolean(), maxOutputBytes: z.number().int().positive(),
  maxTokens: z.number().int().positive(), contextTokens: z.number().int().positive(),
  compactAt: z.number().int().positive(), autoCompactEnabled: z.boolean().optional(),
  maxTurns: z.number().int().positive(), thinking: z.boolean(),
  stopHookBlockCap: z.number().int().min(0).max(1024).optional(),
  automaticCheckpoints: z.boolean().optional(),
  effort: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).optional(),
  ultracode: z.boolean().optional(),
  modelSettings: modelSettingsSchema.optional(),
  effortSelection: effortSelectionSchema.optional(),
  childMode: z.enum(['explore', 'general']).optional(),
  parentSessionId: z.string().uuid().optional(),
  parentPlanId: z.string().uuid().optional(),
  gateway: z.object({
    baseURL: z.string().url().refine(value => { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password && !u.search && !u.hash; }, 'Use an HTTP(S) endpoint without credentials, query or fragment'),
    auth: z.enum(['bearer', 'api-key']), tokenCounting: z.enum(['estimate', 'api']),
    promptCaching: z.boolean(), eagerToolInput: z.boolean(),
  }).strict().optional(),
  hooks: hooksSchema.optional(),
  permissions: permissionPolicySchema.optional(),
  /** Explicit same-host inbound policy; omitted follows the permission mode. */
  crossSessionInbound: z.enum(['accept', 'hold', 'refuse']).optional(),
  bashCommandClamp: z.array(z.array(z.string().min(1)).min(1)).min(1).optional(),
  stallMs: z.number().finite().optional(),
  managedPolicy: managedPolicySchema.optional(),
  // Opt-in managed-settings helper. Distinct from `managedSettingsFile`, which
  // is read once and is fatal when unusable: a helper is expected to change under
  // the session, so a failed read degrades to its static default or to the last
  // successful output, while a structurally invalid document is still refused.
  // The fallback is applied as a managed policy, so it carries no instruction
  // tier: the recovered static default output has no `claudeMd` (chunk-x0dc37w9.js
  // 56953), and the settle only takes text from a document the helper served.
  policyHelper: z.object({ path: z.string().min(1),
    intervalMs: z.number().int().positive().max(86_400_000).optional(),
    defaultPolicy: managedPolicySchema.optional() }).strict().optional(),
  approveExternalIncludes: z.boolean().optional(),
  externalIncludes: z.array(z.object({ path: z.string(), parent: z.string().optional() })).optional(),
  skills: z.array(z.object({ name: z.string().min(1), description: z.string(), path: z.string(), body: z.string(), source: z.enum(['userSettings', 'projectSettings', 'plugin']).optional(), format: z.enum(['skill', 'command']).optional(), plugin: z.string().optional(), disallowedTools: z.array(z.string()).optional(), userInvocable: z.boolean(), disableModelInvocation: z.boolean(), mode: z.enum(['on', 'name-only', 'user-invocable-only', 'off']).optional(),
    paths: z.array(z.string()).optional(),
    allowedTools: z.array(z.string()).optional(), argumentNames: z.array(z.string().refine(name => name.trim() !== '' && !/^\d+$/.test(name), 'argument names must be non-empty and not all digits')).optional(), model: z.string().optional(), effort: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).optional(), context: z.literal('fork').optional(), agent: z.string().trim().min(1).max(128).optional(), background: z.boolean().optional(),
    aliases: z.array(z.string().min(1).max(128).regex(/^[A-Za-z0-9_.-]+(?::[A-Za-z0-9_.-]+)*$/)).max(32).refine(names => new Set(names).size === names.length).optional(),
    hooks: hooksSchema.optional(), command: z.string().optional(), shell: z.string().optional(), metadata: z.record(z.unknown()).optional(), limitations: z.array(z.string()).optional(),
  }).strict()).optional(),
  heldSkills: z.array(z.object({ name: z.string().min(1), description: z.string(), path: z.string(), body: z.string(), source: z.enum(['userSettings', 'projectSettings', 'plugin']).optional(), format: z.enum(['skill', 'command']).optional(), plugin: z.string().optional(), disallowedTools: z.array(z.string()).optional(), userInvocable: z.boolean(), disableModelInvocation: z.boolean(), mode: z.enum(['on', 'name-only', 'user-invocable-only', 'off']).optional(),
    paths: z.array(z.string()).min(1),
    allowedTools: z.array(z.string()).optional(), argumentNames: z.array(z.string()).optional(), model: z.string().optional(), effort: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).optional(), context: z.literal('fork').optional(), agent: z.string().trim().min(1).max(128).optional(), background: z.boolean().optional(),
    aliases: z.array(z.string()).optional(),
    hooks: hooksSchema.optional(), command: z.string().optional(), shell: z.string().optional(), metadata: z.record(z.unknown()).optional(), limitations: z.array(z.string()).optional(),
  }).strict()).optional(),
  dynamicSkillDirs: z.array(z.string().min(1)).optional(),
  keybindings: keybindingsSchema.optional(),
  prefersReducedMotion: z.boolean().optional(),
  showTurnDuration: z.boolean().optional(),
  showMessageTimestamps: z.boolean().optional(),
  copyOnSelect: z.boolean().optional(),
  copyFullResponse: z.boolean().optional(),
  preferredNotifChannel: notificationChannelSchema,
  // `messageIdleNotifThresholdMs` (chunk-24k7d6mw.js 1679555, default 60000 at chunk-bk5ct2gw.js
  // 558979): a millisecond delay, so a non-positive value would arm nothing and is unset.
  messageIdleNotifThresholdMs: z.number().int().positive().optional().catch(undefined),
  terminalTitleFromRename: z.boolean().optional(),
  autoScrollEnabled: z.boolean().optional(),
  promptSuggestionEnabled: z.boolean().optional().catch(undefined),
  viewMode: z.enum(['default', 'verbose', 'focus']).optional(),
  verbose: z.boolean().optional(),
  terminalProgressBarEnabled: z.boolean().optional(),
  timeFormat: z.string().optional(),
  timeZone: z.string().optional(),
  spinnerVerbs: spinnerVerbsSchema.optional(),
  spinnerTipsEnabled: z.boolean().optional(),
  spinnerTipsLayers: spinnerTipsLayersSchema.optional(),
  editorMode: editorModeSchema,
  vimInsertModeRemaps: vimRemapsSchema,
  maxProseWidth: z.number().int().min(40).optional(),
  // Recovered schema: enum with `.catch(void 0)`, so an invalid value is unset.
  askUserQuestionTimeout: z.enum(['60s', '5m', '10m', 'never']).optional().catch(undefined),
  dialogExpiry: z.enum(['60s', '5m', '10m', 'never']).optional().catch(undefined),
  syntaxHighlightingDisabled: z.boolean().optional(),
  // `enableWorkflows` and `workflowKeywordTriggerEnabled` are the two settings the composer's
  // workflow-keyword gate reads (chunk-c5zwk83v.js `dg`/`C7t`).
  enableWorkflows: z.boolean().optional(),
  workflowKeywordTriggerEnabled: z.boolean().optional(),
  // The `:name:` emoji typeahead switch (`chunk-24k7d6mw.js` `Kl().emojiCompletionEnabled`).
  emojiCompletionEnabled: z.boolean().optional(),
  // `ft().respondToBashCommands ?? !0`: the drained-command answer switch (chunk-w79px1ss.js 14067).
  respondToBashCommands: z.boolean().optional(),
  // The agent-view switch `r` reads beside its environment flag (chunk-wtdka69b.js 887).
  disableAgentView: z.boolean().optional(),
  theme: z.string().refine(value => parseTheme(value) !== undefined, 'Invalid theme').optional(),
  statusLine: statusLineSchema,
  webSearch: webSearchConfigSchema.optional(),
  plugins: pluginConfigSchema.optional(),
  agentTypes: z.lazy(() => agentTypesSchema).optional(),
  conditionalRules: z.array(z.object({ path: z.string(), content: z.string(), patterns: z.array(z.string()),
    imports: z.array(z.object({ path: z.string(), content: z.string(), parent: z.string().optional() }).strict()).optional(),
  }).strict()).optional(),
  instructionSources: z.array(z.object({ path: z.string(), parent: z.string().optional(),
    globs: z.array(z.string()).optional() }).strict()).optional(),
  policyHelperText: z.string().optional(),
  mcpServers: mcpServersSchema.optional(),
  heldMcpServers: z.array(z.object({ name: z.string().min(1).max(256), fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    reason: z.enum(['unapproved', 'declaration-changed']) }).strict()).optional(),
  mcpClient: z.object({ roots: z.boolean().optional(), sampling: z.boolean().optional(), samplingImages: z.boolean().optional(), samplingArrays: z.boolean().optional(), samplingAudio: z.boolean().optional(), elicitation: z.boolean().optional() }).strict().optional(),
  autoMemory: z.boolean().optional(),
  autoMemoryConsolidation: z.boolean().optional(),
  dynamicInstructions: z.boolean().optional(),
  watchConfig: z.boolean().optional(),
  worktreeReturn: z.string().min(1).optional(),
  settingSources: settingSourcesSchema.optional(),
  configSources: z.object({ userDir: z.string().optional(), settingsFile: z.string().optional(), managedSettingsFile: z.string().optional(), overrides: z.object({
    autoMemory: z.boolean().optional(), watchConfig: z.boolean().optional(), allowShell: z.boolean().optional(), permissions: permissionPolicySchema.partial({ mode: true }).optional(),
    mcpClient: z.object({ roots: z.boolean().optional(), sampling: z.boolean().optional(), samplingImages: z.boolean().optional(), samplingArrays: z.boolean().optional(), samplingAudio: z.boolean().optional(), elicitation: z.boolean().optional() }).strict().optional(),
    tasks: z.boolean().optional(), subagents: z.boolean().optional(),
  }).strict().optional() }).strict().optional(),
  lspServers: lspConfigSchema.optional(),
  pluginGeneration: z.number().int().nonnegative().optional(),
  pluginComponentDiagnostics: z.array(z.object({ plugin: z.string(), component: z.enum(['skills', 'agents', 'commands']),
    path: z.string(), message: z.string() }).strict()).optional(),
  features: z.object({ tasks: z.boolean(), subagents: z.boolean(), notebooks: z.boolean().optional(), background: z.boolean().optional(), scheduler: z.boolean().optional(),
    workflowPersistence: z.boolean().optional(), mcpSubscriptions: z.boolean().optional(), mcpLogging: z.boolean().optional(), mcpNotificationStream: z.boolean().optional(), mcpRecovery: z.boolean().optional(), mcpPersistence: z.boolean().optional(), mcpTasks: z.boolean().optional(), mcpStandardTasks: z.boolean().optional(),
    taskProjections: z.boolean().optional(), taskSourceVisibility: z.boolean().optional(), promptSuggestions: z.boolean().optional(),
    schedulerJitter: z.boolean().optional(), schedulerDurable: z.boolean().optional(), schedulerSourceCalendar: z.boolean().optional(), skillInlineCommands: z.boolean().optional(), skillQuotedArguments: z.boolean().optional(), skillArgumentFallback: z.boolean().optional(), skillExtendedArguments: z.boolean().optional(), skillSourceArguments: z.boolean().optional(), pluginSkillNamespaces: z.boolean().optional(),
    agentMessaging: z.boolean().optional(), unifiedAgentMessaging: z.boolean().optional(), agentIdle: z.boolean().optional(), agentTypes: z.boolean().optional(), interaction: z.boolean().optional(), questionPartialAnswers: z.boolean().optional(), sourceFindings: z.boolean().optional(), sourcePlanTools: z.boolean().optional(), sourceQuestionResults: z.boolean().optional(), peerSourceEnvelope: z.boolean().optional(), peerFileTransfers: z.boolean().optional(), peerIdleNotifications: z.boolean().optional(), web: z.boolean().optional(), lsp: z.boolean().optional(), checkpoints: z.boolean().optional(), worktrees: z.boolean().optional(), memory: z.boolean().optional(), media: z.boolean().optional(), workflow: z.boolean().optional(), mcpCatalog: z.boolean().optional(), mcpDynamic: z.boolean().optional(), mcpDeferred: z.boolean().optional(), policyHelper: z.boolean().optional(), crossSessionMessaging: z.boolean().optional(), residentForks: z.boolean().optional() }).strict().optional(),
}).strict();
const messageSchema = z.object({ role: z.enum(['user', 'assistant']), content: z.union([z.string(), z.array(z.object({ type: z.string() }).passthrough())]) }).strict();
const responseSchema = z.object({ role: z.literal('assistant'), content: z.array(z.object({ type: z.string() }).passthrough()), stop_reason: z.string().nullable() }).passthrough();
const resultSchema = z.object({ type: z.literal('tool_result'), tool_use_id: z.string().min(1), content: z.union([z.string(), z.array(z.object({ type: z.string() }).passthrough())]), is_error: z.boolean().optional() }).strict();
// Host journal extension: KWo, chunk-sfn1dbxq [2298500,2308030), UTF-16, has no FD grant witness.
const readGrantWitnessSchema = z.object({ owner: z.string().uuid(), incarnation: z.string().uuid(), callId: z.string().min(1).max(256) }).strict();
const decimalIdentitySchema = z.string().regex(/^[0-9]+$/);
const directoryBackupSchema = z.object({ kind: z.literal('directory_backup'), id: z.string().uuid(), owner: z.string().uuid(),
  toolUseId: z.string().min(1).max(256), lexicalPath: z.string().min(1).max(4096),
  messageContext: z.object({ userMessageId: z.string().uuid(), parentMessageId: z.string().uuid() }).strict().optional(),
  grant: z.object({ root: z.string().min(1).max(4096), incarnation: z.string().uuid(), dev: decimalIdentitySchema, ino: decimalIdentitySchema }).strict(),
  source: z.object({ begin: directoryFileObservationSchema, end: directoryFileObservationSchema }).strict(),
  sidecar: z.object({ dev: decimalIdentitySchema, ino: decimalIdentitySchema, uid: decimalIdentitySchema }).strict(),
  bytes: z.number().int().nonnegative().safe(), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const directoryMissingBackupSchema = directoryBackupSchema.pick({ id: true, owner: true, toolUseId: true, lexicalPath: true, grant: true }).extend({
  kind: z.literal('directory_missing_backup'),
  messageContext: z.object({ userMessageId: z.string().uuid(), parentMessageId: z.string().uuid() }).strict(),
  parent: z.object({ dev: decimalIdentitySchema, ino: decimalIdentitySchema }).strict(),
  createMode: z.number().int().min(0).max(0o7777).optional(),
  writeInput: z.object({ content: z.object({ bytes: z.number().int().nonnegative().safe(), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
    overwrite: z.boolean() }).strict(),
}).strict();
const directoryBackupReceiptSchema = z.object({ owner: z.string().uuid(), id: z.string().uuid(),
  witness: z.string().regex(/^[a-f0-9]{64}$/), sidecar: z.string().regex(/^[a-f0-9]{64}$/),
  journal: z.object({ bytes: z.number().int().positive().safe(), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict() }).strict();
const directorySnapshotReceiptSchema = directoryBackupReceiptSchema.omit({ sidecar: true });
const directoryBackupFailureSchema = z.object({ kind: z.literal('directory_backup_failed'), id: z.string().uuid(),
  owner: z.string().uuid(), witness: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const directorySnapshotFailureSchema = directoryBackupFailureSchema.extend({ kind: z.literal('directory_snapshot_failed') });
const directoryCheckpointWitnessSchema = z.object({ kind: z.literal('directory_checkpoint_witness'), id: z.string().uuid(), owner: z.string().uuid(),
  name: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/), witness: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const directorySnapshotFileSchema = directoryBackupSchema.omit({ kind: true, toolUseId: true, messageContext: true, source: true }).extend({
  kind: z.literal('directory_snapshot_file'), snapshotId: z.string().uuid(), messageId: z.string().uuid(), trackingPath: z.string().min(1).max(4096),
  source: z.object({ begin: boundDirectoryFileObservationSchema, end: boundDirectoryFileObservationSchema }).strict(),
}).strict();
// The stored host row (`TRn`): hunks the turn-diff walk counts, plus the fields a row needs to be
// recognized at all. A create keeps its content because an empty patch leaves no other body.
const patchHunkSchema = z.object({ oldStart: z.number().int(), oldLines: z.number().int(),
  newStart: z.number().int(), newLines: z.number().int(), lines: z.array(z.string()) }).strict();
const landedSchema = z.object({ filePath: z.string().min(1), cacheKey: z.string().min(1).optional(), content: z.string(), mtimeMs: z.number().finite(),
  identity: z.object({ dev: z.string().regex(/^\d+$/), ino: z.string().regex(/^\d+$/) }).strict(), isPartialView: z.boolean().optional() }).strict();
const storedToolUseResultSchema = z.union([
  z.object({ kind: z.literal('file_read'), filePath: z.string().min(1), cacheKey: z.string().min(1).optional(), content: z.string(), mtimeMs: z.number().finite(), offset: z.number().int().positive(), limit: z.number().int().positive(), truncated: z.boolean(), identity: z.object({ dev: z.string().regex(/^\d+$/), ino: z.string().regex(/^\d+$/) }).strict().optional() }).strict(),
  findingsHostResultSchema,
  planHostResultSchema,
  questionHostResultSchema,
  z.object({ type: z.literal('create'), filePath: z.string().min(1), content: z.string(), structuredPatch: z.array(patchHunkSchema), landed: landedSchema.optional() }).strict(),
  z.object({ type: z.literal('update'), filePath: z.string().min(1), structuredPatch: z.array(patchHunkSchema), landed: landedSchema.optional() }).strict(),
  z.object({ filePath: z.string().min(1), oldString: z.string(), newString: z.string(), structuredPatch: z.array(patchHunkSchema), replaceAll: z.boolean(), landed: landedSchema.optional() }).strict(),
]);
const notificationJsonSchema: z.ZodType<import('./structured-output.js').JsonValue> = z.lazy(() => z.union([
  z.null(), z.boolean(), z.number().finite(), z.string(), z.array(notificationJsonSchema), z.record(z.string(), notificationJsonSchema),
]));
const backgroundNotificationSchema = z.object({ seq: z.number().int().nonnegative(), job_id: z.string().min(1),
  kind: z.enum(['line', 'exit']), at: z.number().finite(), stream: z.enum(['stdout', 'stderr']).optional(),
  lines: z.array(z.string()), text: z.string(), state: z.enum(['running', 'completed', 'failed', 'cancelled', 'timed_out']).optional(),
  exit_code: z.number().int().nullable().optional(), exit_signal: z.string().nullable().optional(), source: z.literal('websocket').optional(),
  close_code: z.number().int().optional(), close_reason: z.string().optional(), truncated: z.literal(true).optional(), original_bytes: z.number().int().nonnegative().optional() }).strict();
const agentNotificationSchema = z.object({ kind: z.literal('agent'), sequence: z.number().int().nonnegative(), agent: z.object({
  id: z.string().min(1), session_id: z.string().min(1), name: z.string().nullable(), status: z.enum(['queued', 'running', 'completed', 'failed', 'cancelled']),
  mode: z.enum(['explore', 'general']), model: z.string(), summary: z.string(), error: z.string().nullable(), reason: z.string().nullable(),
  model_calls: z.number().int().nonnegative(), queued_messages: z.number().int().nonnegative(), workspace: z.string().optional(), subagent_type: z.string().optional(),
  cleanup_error: z.string().optional(), structured_output: notificationJsonSchema.optional(), structured_error: z.string().optional(),
}).strict(), subscription: z.object({ id: z.string(), state: z.enum(['idle', 'expired']) }).strict().optional() }).strict();
const branchEventSchema = z.object({ kind: z.literal('branch'), source: z.string().uuid(), workspace: z.string().min(1), boundary: z.number().int().nonnegative(),
  reason: z.enum(['fork', 'rewind', 'reload', 'configuration', 'relocation']), external: directoryRewindExternalSchema.optional(),
  checkpointPaths: directoryCheckpointPathsSchema.optional() }).strict();
const eventSchema = z.discriminatedUnion('kind', [
  scheduledFireSchema,
  z.object({ kind: z.literal('model_plan_mode'), operation: z.enum(['enter', 'exit']),
    mode: permissionPolicySchema.shape.mode, planId: z.string().uuid() }).strict(),
  z.object({ kind: z.literal('loop_boundary'), reason: z.enum(['foreign_user_input', 'tool_abort']) }).strict(),
  z.object({ kind: z.literal('metadata'), version: z.literal(1), id: z.string().uuid(), config: configSchema,
    fingerprint: z.string(), startedAt: z.number().finite().nonnegative().optional(),
    rootIdentity: z.object({ rootSessionId: z.string().uuid(), originalCwd: z.string().min(1) }).strict().optional() }).strict(),
  z.object({ kind: z.literal('permission_mode_command'), operation: z.enum(['enter', 'exit', 'select']),
    mode: permissionPolicySchema.shape.mode, command: z.enum(['plan', 'permissions']) }).strict(),
  z.object({ kind: z.literal('file_history'), path: z.string().min(1).optional(), tracked: z.boolean() }).strict(),
  directoryBackupSchema,
  directoryMissingBackupSchema,
  directorySnapshotFileSchema,
  directorySnapshotIntentSchema,
  directorySnapshotObservationSchema,
  directorySnapshotSchema,
  directorySnapshotRecoverySchema,
  directoryCheckpointWitnessSchema,
  directoryCheckpointInheritanceSchema,
  directoryCheckpointTornRecoverySchema,
  directoryPublicationIntentSchema,
  directoryPublicationResultSchema,
  directoryPublicationFailureSchema,
  directoryBackupFailureSchema,
  directorySnapshotFailureSchema,
  z.object({ kind: z.literal('agent_history'), id: z.string().uuid(), digest: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  z.object({ kind: z.literal('agent_history_intent'), parent: z.string().uuid(), id: z.string().uuid(),
    oldDigest: z.string().regex(/^[a-f0-9]{64}$/), newDigest: z.string().regex(/^[a-f0-9]{64}$/),
    journal: z.object({ bytes: z.number().int().nonnegative(), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict() }).strict(),
  z.object({ kind: z.literal('agent_message_pin'), key: z.string().min(1), pin: agentMessagePinSchema }).strict(),
  z.object({ kind: z.literal('notification_intent'), deliveryId: z.string().uuid(), owner: z.string().uuid(),
    entries: z.array(z.object({ source: z.enum(['background', 'agent']), taskId: z.string().min(1), text: z.string() }).strict()).min(1).max(200) }).strict(),
  z.object({ kind: z.literal('notification_intent_v2'), deliveryId: z.string().uuid(), owner: z.string().uuid(), batch: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('background'), events: z.array(backgroundNotificationSchema).max(100), dropped: z.number().int().nonnegative(), pending: z.number().int().nonnegative(), maxOutputBytes: z.number().int().nonnegative() }).strict(),
    z.object({ kind: z.literal('agent_events'), events: z.array(agentNotificationSchema).max(100), dropped: z.number().int().nonnegative(), maxOutputBytes: z.number().int().nonnegative() }).strict(),
  ]) }).strict(),
  z.object({ kind: z.literal('message'), message: messageSchema, messageId: z.string().uuid().optional(), response: responseSchema.optional(), isMeta: z.boolean().optional(), directoryHistoryDisabled: z.literal(true).optional(), classifier: classifierMessageSchema.optional(),
    notificationDelivery: z.object({ owner: z.string().uuid(), deliveryId: z.string().uuid() }).strict().optional() }).strict(),
  z.object({ kind: z.literal('mcp_catalog'), configDigest: z.string().regex(/^[a-f0-9]{64}$/),
    disabledServers: z.array(z.string().min(1).max(256)).max(1024),
    unavailableServers: z.array(z.string().min(1).max(256)).max(1024).optional(), tools: configSchema.shape.tools }).strict(),
  z.object({ kind: z.literal('mcp_subscription'), server: z.string().min(1).max(256), configDigest: z.string().regex(/^[a-f0-9]{64}$/),
    method: z.enum(['resources/subscribe', 'resources/unsubscribe']), uri: z.string().min(1).refine(value => Buffer.byteLength(value) <= 4096 && !/[\x00-\x20\x7f]/.test(value)) }).strict(),
  z.object({ kind: z.literal('mcp_task'), server: z.string().min(1).max(256), configDigest: z.string().regex(/^[a-f0-9]{64}$/), taskId: z.string().min(1).max(128).regex(/^[\x21-\x7e]+$/), tool: z.string().min(1).max(256), createdAt: z.string().datetime({ offset: true }), ttl: z.number().finite().int().nonnegative().nullable(), resolved: z.boolean(), isError: z.boolean().optional(), result: z.string().refine(value => Buffer.byteLength(value) <= 24000).optional() }).strict(),
  z.object({ kind: z.literal('tool_start'), id: z.string(), name: z.string(), parentMessageId: z.string().uuid().optional(),
    writeInputDigest: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    runtimeWriteOwner: z.object({ owner: z.string().uuid(), incarnation: z.string().uuid() }).strict().optional() }).strict(),
  z.object({ kind: z.literal('runtime_write_execution'), id: z.string(), parentMessageId: z.string().uuid(),
    writeInputDigest: z.string().regex(/^[a-f0-9]{64}$/),
    runtimeWriteOwner: z.object({ owner: z.string().uuid(), incarnation: z.string().uuid() }).strict(),
    phase: z.enum(['entered', 'completed']), outcome: z.enum(['returned', 'threw', 'blocked-additional-directory']).optional() }).strict(),
  z.object({ kind: z.literal('tool_result'), result: resultSchema, timestamp: z.string().datetime({ offset: true }).optional(), host: storedToolUseResultSchema.optional(), feedbackBlocks: toolFeedbackBlocksSchema.optional(), readGrantWitness: readGrantWitnessSchema.optional() }).strict(),
  z.object({ kind: z.literal('tool_effect'), result: resultSchema, timestamp: z.string().datetime({ offset: true }).optional(), host: storedToolUseResultSchema.optional(), feedbackBlocks: toolFeedbackBlocksSchema.optional(), readGrantWitness: readGrantWitnessSchema.optional() }).strict(),
  z.object({ kind: z.literal('read_observation'), result: resultSchema, timestamp: z.string().datetime({ offset: true }).optional(), host: storedToolUseResultSchema.options[0].optional(), readGrantWitness: readGrantWitnessSchema.optional() }).strict(),
  z.object({ kind: z.literal('write_observation'), result: resultSchema, operation: z.enum(['write_file', 'edit_file']), landed: landedSchema }).strict(),
  z.object({ kind: z.literal('read_invalidate'), paths: z.array(z.string().min(1)) }).strict(),
  z.object({ kind: z.literal('tool_output'), result: resultSchema }).strict(),
  z.object({ kind: z.literal('title'), title: z.string().min(1).max(200).refine(value => !/[\x00-\x1f\x7f-\x9f]/.test(value)) }).strict(),
  z.object({ kind: z.literal('session_color'), color: z.enum(['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan']).nullable() }).strict(),
  z.object({ kind: z.literal('refusal'), model: z.string().min(1).max(256).refine(value => !/[\x00-\x1f\x7f-\x9f]/.test(value)),
    category: z.string().min(1).max(64).refine(value => !/[\x00-\x1f\x7f-\x9f]/.test(value)).optional(),
    explanation: z.string().min(1).max(1024).refine(value => !/[\x00-\x1f\x7f-\x9f]/.test(value)).optional(),
    requestId: z.string().min(1).max(128).regex(/^[\x21-\x7e]+$/).optional() }).strict(),
  branchEventSchema,
  z.object({ kind: z.literal('checkpoint'), name: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/), digest: z.string().regex(/^[a-f0-9]{64}$/), boundary: z.number().int().nonnegative() }).strict(),
  z.object({ kind: z.literal('rewind'), source: z.string().uuid(), boundary: z.number().int().nonnegative(), checkpoint: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/), digest: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  z.object({ kind: z.literal('hook_once'), event: z.enum(HOOK_EVENTS), key: z.string().max(256).regex(/^[A-Za-z]+:(?:0|[1-9]\d{0,3}):(?:flat|0|[1-9]\d{0,3}):[a-f0-9]{64}$/) }).strict(),
  z.object({ kind: z.literal('hook_start'), id: z.string(), event: z.string(), toolUseId: z.string().optional(), parentMessageId: z.string().uuid().optional() }).strict(),
  z.object({ kind: z.literal('stop_hook_count'), count: z.number().int().min(0).max(1024), hookId: z.string().optional() }).strict(),
  z.object({ kind: z.literal("instruction_watch"), workspace: z.string().min(1),
    paths: z.array(z.string().min(1).refine(value => path.isAbsolute(value) && Buffer.byteLength(value) <= 4096)).max(2048)
      .refine(values => Buffer.byteLength(JSON.stringify(values)) <= 65536) }).strict(),
  z.object({ kind: z.literal('hook_terminal'), id: z.string(), event: z.string(),
    sequences: z.array(z.string().min(1).refine(value => Buffer.byteLength(value) <= 4096)).max(128)
      .refine(values => values.reduce((total, value) => total + Buffer.byteLength(value), 0) <= 32768) }).strict(),
  z.object({ kind: z.literal('hook_result'), id: z.string(), event: z.string(), blocked: z.boolean(), reason: z.string().optional(), additionalContext: z.array(z.string()), stopRequested: z.boolean().optional(), suppressOutput: z.boolean().optional(), systemMessages: z.array(z.string()).optional(), userDisplayMessage: z.string().optional(),
    backgroundTasks: z.array(z.string().min(1)).optional(),
    terminalSequences: z.array(z.string().min(1).refine(value => Buffer.byteLength(value) <= 4096)).max(128)
      .refine(values => values.reduce((total, value) => total + Buffer.byteLength(value), 0) <= 32768).optional() }).strict(),
  z.object({ kind: z.literal('compact'), summary: z.string().min(1), response: responseSchema }).strict(),
  z.object({ kind: z.literal('turn_end'), reason: z.string(), duration: z.object({uuid:z.string().uuid(),
    durationMs:z.number().finite().nonnegative(), timestamp:z.string().datetime({offset:true})}).strict().optional() }).strict(),
]).superRefine((record, context) => {
  if (record.kind === 'runtime_write_execution' && ((record.phase === 'completed') !== (record.outcome !== undefined))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid runtime Write execution phase' });
  }
  if (record.kind === 'tool_start' && record.writeInputDigest && (record.name !== 'write_file' || !record.parentMessageId)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid directory publication input witness' });
  }
  if (record.kind === 'tool_start' && record.runtimeWriteOwner &&
      (record.name !== 'write_file' || !record.parentMessageId || !record.writeInputDigest)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid runtime Write start witness' });
  }
  if (record.kind === 'message' && record.directoryHistoryDisabled &&
      (record.message.role !== 'user' || !record.messageId || record.isMeta)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid disabled directory history marker' });
  }
  if ((record.kind === 'tool_result' || record.kind === 'tool_effect' || record.kind === 'read_observation') && record.readGrantWitness && record.readGrantWitness.callId !== record.result.tool_use_id) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Directory grant call identity mismatch' });
  }
  if (record.kind === 'model_plan_mode') {
    if (!modelPlanModeEventSchema.safeParse(record).success) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid model plan mode transition' });
    return;
  }
  if (record.kind === 'permission_mode_command') {
    if (!permissionModeCommandSchema.safeParse(record).success) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid local permission mode command' });
    return;
  }
  if (record.kind !== 'hook_once') return;
  const [event, entry, inner] = record.key.split(':');
  if (event !== record.event || Number(entry) >= 1024 || (inner !== 'flat' && Number(inner) >= 1024)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid once hook journal identity' });
  }
});

/** The stored identity digest. `fingerprintOf` also covers prepared documents with derived fields. */
export const fingerprintOf = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const fingerprint = (config: SessionConfig): string => fingerprintOf(config);

// Host parent witness: require the complete journal, including its final newline.
function verifyJournalWitness(bytes: Buffer, expected: { bytes: number; sha256: string }): void {
  if (bytes.length !== expected.bytes || bytes.at(-1) !== 10 ||
      createHash('sha256').update(bytes).digest('hex') !== expected.sha256) {
    throw new Error('Child journal continuity mismatch');
  }
}

// Ole [4694145,4697475), Hle [4709382,4709960), qNn [4709960,4711673), sfn1dbxq, UTF-16.
export function readSessionJournal(workspace: string, id: string, limits: { maxBytes: number; maxEvents: number },
  expected?: { bytes: number; sha256: string }): SessionEvent[] {
  z.string().uuid().parse(id);
  const root = fs.realpathSync(workspace), dir = path.join(root, '.agent');
  if (fs.lstatSync(dir).isSymbolicLink() || !fs.statSync(dir).isDirectory()) throw new Error('Invalid session directory');
  const file = path.join(dir, `${id}.jsonl`);
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size > limits.maxBytes) throw new Error('Invalid or oversized child journal');
    const bytes = fs.readFileSync(fd), boundary = bytes.lastIndexOf(10) + 1;
    if (expected) verifyJournalWitness(bytes, expected);
    const lines = bytes.subarray(0, boundary).toString('utf8').split('\n').filter(Boolean);
    if (lines.length > limits.maxEvents) throw new Error('Child journal event limit reached');
    const events = lines.map(line => {
      const event: unknown = JSON.parse(line);
      eventSchema.parse(event);
      return event as SessionEvent;
    });
    const meta = events[0];
    if (meta?.kind !== 'metadata' || meta.id !== id || meta.config.workspace !== root || meta.fingerprint !== fingerprint(meta.config)
      || events.slice(1).some(event => event.kind === 'metadata' || ((event.kind === 'notification_intent' || event.kind === 'notification_intent_v2') && event.owner !== id))) throw new Error('Child journal identity mismatch');
    return events;
  } finally { fs.closeSync(fd); }
}

export class Session {
  // Host journal rewrite of root ownership: 4bw62nzm [53194,56759), bf3z2ftn [43591,44281), UTF-16.
  get rootIdentity(): Readonly<{ rootSessionId: string; originalCwd: string }> | undefined {
    const meta = this.events[0];
    if (meta?.kind !== 'metadata' || !meta.rootIdentity) return;
    if (meta.config.parentSessionId !== undefined || meta.config.childMode !== undefined) {
      if (!this.childRootOwner?.()) return;
    }
    return { ...meta.rootIdentity };
  }
  private childRootOwner?: () => boolean;
  // w/I_n, zm79vshj [1870,4397), 40cepjpq [72739,75980), UTF-16.
  private liveReadCache?: SourceReadCache;
  get fileReadCache(): SourceReadCache {
    if (!this.liveReadCache) {
      const cache = new SourceReadCache(5000);
      const calls = new Map<string, { name: string; path: string; content?: string }>();
      const results = new Set<string>();
      for (const message of this.messages) if (Array.isArray(message.content)) for (const block of message.content) {
        if (block.type === 'tool_use' && ['read_file', 'write_file', 'edit_file'].includes(block.name) &&
            typeof block.input === 'object' && block.input !== null && 'path' in block.input && typeof block.input.path === 'string') {
          calls.set(block.id, { name: block.name, path: path.resolve(this.config.workspace, block.input.path),
            ...('content' in block.input && typeof block.input.content === 'string' ? { content: block.input.content } : {}) });
        }
        if (block.type === 'tool_result' && !block.is_error) results.add(block.tool_use_id);
      }
      const seen = new Set<string>();
      const entries: Array<[string, { content: string; timestamp: number; offset?: number; limit?: number;
        isPartialView?: boolean; contentFromTranscript?: boolean; contentNotInModelContext?: boolean; realPath?: string; identity?: { dev: string; ino: string } }]> = [];
      for (let i = this.events.length - 1; i >= 0 && seen.size < 5000; i--) {
        const event = this.events[i];
        if (event?.kind === 'read_invalidate') { for (const file of event.paths) seen.add(file); continue; }
        if (!event || (event.kind !== 'tool_result' && event.kind !== 'read_observation' && event.kind !== 'write_observation') ||
            event.result.is_error || !results.has(event.result.tool_use_id)) continue;
        const call = calls.get(event.result.tool_use_id);
        if (!call) continue;
        if (event.kind === 'write_observation' && event.operation !== call.name) break;
        // Unknown aliases across a landed mutation: do not resurrect older entries.
        if (seen.has(call.path)) {
          if (call.name !== 'read_file') break;
          continue;
        }
        // I_n, 40cepjpq [72739,75980), UTF-16; host persists fd identity because
        // source's timestamp-only write/edit reconstruction cannot satisfy inode binding.
        const landed = event.kind === 'write_observation' ? event.landed : event.host && 'landed' in event.host ? event.host.landed : undefined;
        if ((call.name === 'write_file' || call.name === 'edit_file') && landed) {
          const key = landed.cacheKey ?? call.path;
          if (seen.has(key)) break;
          seen.add(call.path); seen.add(key);
          entries.push([key, { content: landed.content, timestamp: Math.floor(landed.mtimeMs),
            identity: landed.identity, realPath: landed.filePath, ...(landed.isPartialView ? { isPartialView: true } : {}),
            ...(call.name === 'edit_file' ? { contentNotInModelContext: true } : {}) }]);
        } else if (call.name === 'write_file' && call.content !== undefined && event.kind !== 'write_observation' && event.timestamp) {
          seen.add(call.path);
          entries.push([call.path, { content: call.content.replace(/^﻿/, '').replaceAll('\r\n', '\n'), timestamp: Date.parse(event.timestamp) }]);
        } else if (call.name === 'edit_file' && event.kind !== 'write_observation') {
          try {
            const content = fs.readFileSync(call.path, 'utf8').replace(/^﻿/, '');
            const timestamp = event.timestamp ? Date.parse(event.timestamp) : 0;
            seen.add(call.path);
            entries.push([call.path, { content, timestamp, contentNotInModelContext: true }]);
          } catch { /* An unavailable edited file has no recoverable observation. */ }
        } else if (call.name === 'read_file' && event.kind !== 'write_observation' && event.timestamp && event.host && 'kind' in event.host && event.host.kind === 'file_read') {
          const read = event.host;
          const key = read.cacheKey ?? call.path;
          if (seen.has(key)) continue;
          seen.add(key);
          entries.push([key, { content: read.content, timestamp: Math.floor(read.mtimeMs), identity: read.identity, realPath: read.filePath, offset: read.offset,
            limit: read.limit, isPartialView: read.truncated || read.offset > 1 || read.content.split('\n').length >= read.limit,
            contentFromTranscript: true }]);
        }
        if (call.name !== 'read_file') break;
      }
      for (const [file, entry] of entries.reverse()) cache.set(file, entry);
      this.liveReadCache = cache;
    }
    return this.liveReadCache;
  }
  readonly id: string;
  readonly config: SessionConfig;
  readonly file: string;
  readonly events: SessionEvent[];
  readonly startedAt: number;
  private fileHistoryValue = { trackSequence: 0, trackedFiles: new Set<string>() };
  private readonly fileHistoryListeners = new Set<() => void>();
  private readonly titleListeners = new Set<() => void>();
  private liveSettingSources: SettingSource[] | undefined;
  private releaseSettingsWrites: (() => void) | undefined;

  get settingSources(): readonly SettingSource[] | undefined {
    return this.liveSettingSources === undefined ? undefined : structuredClone(this.liveSettingSources);
  }

  snapshotConfig(): SessionConfig {
    const config = structuredClone(this.config);
    if (this.liveSettingSources !== undefined) config.settingSources = structuredClone(this.liveSettingSources);
    return config;
  }

  // Pr/F8e/Er, wtch2p0g [3708,3745), 4bw62nzm [12857,13406), x0dc37w9 [106006,106115), UTF-16.
  private observeSettingsWrite(write: SettingsWrite): void {
    if (this.closed || this.liveSettingSources === undefined) return;
    const paths = permissionSettingsPaths(this.config.workspace, this.config.configSources?.userDir ?? defaultUserDir());
    const authored: Partial<Record<Exclude<SettingSource['source'], 'policySettings'>, readonly string[]>> = {
      userSettings: paths.userSettings === undefined ? [] : [paths.userSettings],
      projectSettings: paths.projectSettings === undefined ? [] : [paths.projectSettings],
      localSettings: [paths.localSettings, paths.legacyLocalSettings].filter((file): file is string => file !== undefined),
      flagSettings: this.config.configSources?.settingsFile === undefined ? [] : [path.resolve(this.config.workspace, this.config.configSources.settingsFile)],
    };
    const next = new Map(this.liveSettingSources.map(item => [item.source, item]));
    for (const source of ['userSettings', 'projectSettings', 'localSettings', 'flagSettings'] as const) {
      const files = authored[source] ?? [];
      if (!files.some(file => path.resolve(file) === write.file)) continue;
      const present = files.some(file => path.resolve(file) === write.file ? write.present : settingFileHasContent(file));
      if (present) next.set(source, { source });
      else next.delete(source);
    }
    this.liveSettingSources = SETTING_SOURCE_ORDER.flatMap(source => {
      const item = next.get(source);
      return item === undefined ? [] : [item];
    });
  }

  /** Destination buckets are session-owned; settings writes settle independently of memory. */
  permissionUpdates: SessionPermissionUpdates = emptySessionPermissionUpdates();
  readonly permissionWriteResults: PermissionWriteResult[] = [];
  readonly permissionIgnoreResults: PermissionIgnoreResult[] = [];
  /** The auto-mode classifier's recent refusals, the `/permissions` `recent` tab's list. */
  readonly autoModeDenials = new AutoModeDenialStore();
  private readonly pendingPermissionWrites = new Set<Promise<void>>();
  private readonly permissionListeners = new Set<() => void>();

  subscribePermissions(listener: () => void): () => void {
    this.permissionListeners.add(listener);
    return () => { this.permissionListeners.delete(listener); };
  }

  private readonly directoryObservations = new Map<string, readonly string[]>();
  // Host rewrite of Mk/eNe/Yg, 2bcyxj9q [214762,215541), UTF-16: source stores paths only.
  // Each opened or duplicated descriptor gets a new incarnation owned by this Session.
  private readonly directoryHandles = new Map<string, DirectoryReadHandle>();
  private readonly directoryHandleControllers = new Map<string, AbortController>();
  private readonly directoryOwnerController = new AbortController();
  private readonly unavailableDirectoryHandles = new Set<string>();
  private readonly readGrantContinuations = new Map<string, ReadGrantContinuation>();
  private directoryHandlesReleased = false;

  private releaseDirectoryHandles(): void {
    for (const controller of this.directoryHandleControllers.values()) controller.abort();
    this.directoryHandleControllers.clear();
    for (const handle of this.directoryHandles.values()) fs.closeSync(handle.fd);
    this.directoryHandles.clear();
  }

  releaseDirectoryAuthority(): void {
    this.directoryHandlesReleased = true;
    this.directoryOwnerController.abort();
    this.releaseDirectoryHandles();
  }

  private copyDirectoryHandles(previous: Session): void {
    this.releaseDirectoryHandles();
    this.unavailableDirectoryHandles.clear();
    const directories = previous.workingDirectories(false);
    for (const root of this.permissionUpdates.additionalWorkingDirectories.keys()) {
      const original = directories.readHandle?.(root);
      let fd: number | undefined;
      try {
        if (!original) throw new Error('directory grant unavailable');
        fd = fs.openSync(`${process.platform === 'linux' ? '/proc/self/fd' : '/dev/fd'}/${original.fd}`, fs.constants.O_RDONLY);
        const stat = fs.fstatSync(fd, { bigint: true });
        if (!stat.isDirectory() || stat.dev !== original.dev || stat.ino !== original.ino) throw new Error('directory changed');
        const controller = new AbortController();
        this.directoryHandleControllers.set(root, controller);
        this.directoryHandles.set(root, { fd, root, dev: stat.dev, ino: stat.ino, signal: controller.signal,
          incarnation: randomUUID(), owner: this.id });
      } catch {
        if (fd !== undefined) fs.closeSync(fd);
        this.unavailableDirectoryHandles.add(root);
      }
    }
  }

  // Ole/IFt, sfn1dbxq [4694145,4697475), 9v9tsk0a [1392,1975), UTF-16:
  // the source has no host lock or FD; this handoff keeps the same journal under its gate.
  prepareRewindRecovery(retained: Session): { restore: () => Promise<Session>; cancel: () => void } | undefined {
    if (this.inheritedPermissions || this.config.childMode !== undefined) return;
    if (this.closed || this.journalFailed || this.directoryHandlesReleased || retained.closed || retained.id === this.id ||
        retained.config.workspace !== this.config.workspace) throw new Error('Rewind recovery owner unavailable');
    const { contentRuleOwner, startupModeDecidedByProactivityLevel, ...state } = this.permissionOwner.state();
    const permissions = structuredClone(state), config = this.snapshotConfig();
    const original = this.workingDirectories(false), copied = retained.workingDirectories(false);
    const grants: Array<{ root: string; owner: string; incarnation: string; dev: bigint; ino: bigint; previous: string[] }> = [];
    for (const root of this.permissionOwner.state().additionalWorkingDirectories.keys()) {
      const before = original.readHandle?.(root), held = copied.readHandle?.(root);
      if (!before) {
        if (held) throw new Error('Rewind recovery grant mismatch');
        continue;
      }
      if (!held || before.signal.aborted || held.signal.aborted || before.owner !== this.id || held.owner !== retained.id ||
          before.dev !== held.dev || before.ino !== held.ino || before.incarnation === held.incarnation || before.fd === held.fd)
        throw new Error('Rewind recovery grant mismatch');
      const previous = [before.incarnation];
      for (const [incarnation, alias] of this.readGrantContinuations) {
        if (alias.root === root && alias.owner === before.owner && alias.incarnation === before.incarnation) previous.push(incarnation);
      }
      grants.push({ root, owner: before.owner, incarnation: held.incarnation, dev: before.dev, ino: before.ino, previous });
    }
    let invalidated = false, used = false;
    const unsubscribe = this.subscribePermissions(() => { invalidated = true; });
    const cancel = () => { if (!used) { used = true; unsubscribe(); } };
    return { cancel, restore: async () => {
      if (used) throw new Error('Rewind recovery already consumed');
      used = true; unsubscribe();
      const { contentRuleOwner: currentOwner, startupModeDecidedByProactivityLevel: currentStartup, ...current } = this.permissionOwner.state();
      const unchanged = !invalidated && currentOwner === contentRuleOwner &&
        isDeepStrictEqual(currentStartup, startupModeDecidedByProactivityLevel) && isDeepStrictEqual(current, permissions);
      if (this.closed || this.journalFailed || !this.directoryHandlesReleased || (unchanged && retained.closed) ||
          !isDeepStrictEqual(this.snapshotConfig(), config) ||
          fs.existsSync(path.join(this.config.workspace, '.agent/checkpoints/transaction.json')))
        throw new Error('Rewind recovery authority changed');
      const currentPermissions = structuredClone(current);
      const gatePath = `${this.lock}.gate`, gateFd = fs.openSync(gatePath, fs.constants.O_RDWR | fs.constants.O_NOFOLLOW);
      let next: Session | undefined, transferred = false;
      try {
        const openedGate = fs.fstatSync(gateFd, { bigint: true }), namedGate = fs.lstatSync(gatePath, { bigint: true });
        if (!openedGate.isFile() || !namedGate.isFile() || namedGate.isSymbolicLink() || openedGate.dev !== namedGate.dev ||
            openedGate.ino !== namedGate.ino || (openedGate.mode & 0o777n) !== 0o600n || !flock(gateFd, false))
          throw new Error('Rewind recovery gate unavailable');
        this.assertDirectoryBackupLock();
        const journalStat = fs.lstatSync(this.file), journalFd = fs.fstatSync(this.fd), journal = fs.readFileSync(this.file);
        if (!journalStat.isFile() || journalStat.isSymbolicLink() || journalStat.dev !== journalFd.dev || journalStat.ino !== journalFd.ino ||
            journal.at(-1) !== 10 || JSON.stringify(journal.toString('utf8').trimEnd().split('\n').map(line => JSON.parse(line))) !== JSON.stringify(this.events))
          throw new Error('Rewind recovery journal changed');
        next = Session.openInternal(this.config.workspace, { id: this.id, expectedJournal: {
          bytes: journal.length, sha256: createHash('sha256').update(journal).digest('hex') } }, { fd: gateFd, lockToken: this.lockToken });
        for (const key of Object.keys(next.config)) Reflect.deleteProperty(next.config, key);
        Object.assign(next.config, structuredClone(config));
        next.permissionUpdates = { ...currentPermissions, contentRuleOwner: currentOwner, startupModeDecidedByProactivityLevel: currentStartup };
        next.liveSettingSources = this.settingSources === undefined ? undefined : [...this.settingSources];
        next.directoryObservations.clear();
        for (const [root, observations] of this.directoryObservations) next.directoryObservations.set(root, [...observations]);
        if (unchanged) {
          next.copyDirectoryHandles(retained);
          const recovered = next.workingDirectories(false), held = retained.workingDirectories(false);
          for (const root of next.permissionOwner.state().additionalWorkingDirectories.keys()) {
            const proof = grants.find(grant => grant.root === root), currentHeld = held.readHandle?.(root), result = recovered.readHandle?.(root);
            if (!proof) { if (result) throw new Error('Rewind recovery grant mismatch'); continue; }
            if (!currentHeld || currentHeld.signal.aborted || currentHeld.owner !== retained.id || currentHeld.incarnation !== proof.incarnation ||
                currentHeld.dev !== proof.dev || currentHeld.ino !== proof.ino || !result || result.signal.aborted || result.owner !== this.id ||
                result.dev !== proof.dev || result.ino !== proof.ino || result.incarnation === proof.incarnation || result.fd === currentHeld.fd)
              throw new Error('Rewind recovery grant mismatch');
            for (const incarnation of proof.previous) next.readGrantContinuations.set(incarnation, { root, owner: proof.owner, incarnation: result.incarnation });
          }
        } else {
          next.releaseDirectoryHandles(); next.unavailableDirectoryHandles.clear();
          for (const root of next.permissionOwner.state().additionalWorkingDirectories.keys()) next.unavailableDirectoryHandles.add(root);
        }
        Object.assign(next.autoRuntime, structuredClone(this.autoRuntime));
        for (const denial of [...this.autoModeDenials.denials].reverse()) next.autoModeDenials.record(denial);
        bindPermissionOwner(next.config.permissions, next.permissionOwner);
        const afterGate = fs.lstatSync(gatePath, { bigint: true }), afterJournal = fs.lstatSync(this.file), nextJournal = fs.fstatSync(next.fd);
        this.assertDirectoryBackupLock();
        if (!afterGate.isFile() || afterGate.isSymbolicLink() || afterGate.dev !== openedGate.dev || afterGate.ino !== openedGate.ino ||
            !afterJournal.isFile() || afterJournal.isSymbolicLink() || afterJournal.dev !== journalFd.dev || afterJournal.ino !== journalFd.ino ||
            nextJournal.dev !== journalFd.dev || nextJournal.ino !== journalFd.ino || !fs.readFileSync(this.file).equals(journal))
          throw new Error('Rewind recovery journal changed');
        next.ownsLock = true; this.ownsLock = false; transferred = true;
        await this.close();
        return next;
      } catch (error) {
        if (next) await next.close();
        throw error;
      } finally {
        if (!transferred) this.ownsLock = true;
        fs.closeSync(gateFd);
      }
    } };
  }

  private inheritedPermissions?: { owner: LivePermissionOwner; allowedTools?: readonly string[] };
  private permissionAdoptionOwner?: LivePermissionOwner;
  private readonly autoRuntime = createPlanRuntime();
  prepareAutoMode(): void {
    if (this.inheritedPermissions) { this.inheritedPermissions.owner.prepareAutoMode?.(); return; }
    const mode = this.permissionUpdates.mode ?? this.config.permissions?.mode;
    if (mode === undefined || mode !== 'auto' && mode !== 'plan' && this.permissionUpdates.strippedDangerousRules === undefined) return;
    this.permissionUpdates = refreshAutoMode(this.permissionUpdates, mode, this.autoRuntime);
  }
  // F/EE, 27et44g8 [12772,12808)/[14843,14970), UTF-16; stable session IDs adapt source slugs.
  get planFilePath(): string {
    return sessionPlanFile(this.config.configSources?.userDir ?? defaultUserDir(), this.config.parentPlanId ?? this.planId,
      this.config.workspace, this.config.plansDirectory, this.config.parentPlanId ? this.id : undefined);
  }

  get planOwnership(): PlanOwnership {
    const slug = this.config.parentPlanId ?? this.planId;
    return { directory: path.dirname(this.planFilePath), slug };
  }

  get planMode(): PlanModeHost | undefined {
    if (this.config.features?.sourcePlanTools !== true) return undefined;
    const owner = this;
    return {
      get filePath() { return owner.planFilePath; },
      get ownership() { return owner.planOwnership; },
      isAgent: this.config.childMode !== undefined || this.inheritedPermissions !== undefined,
      mode: () => this.permissionOwner.state().mode ?? 'default',
      automaticMode: () => this.permissionOwner.state().isBypassPermissionsModeAvailable ? 'bypass'
        : 'auto',
      enter: () => this.changeModelPlanMode('plan'),
      exit: mode => this.changeModelPlanMode(mode),
    };
  }

  get planId(): string {
    const event = this.events.findLast(event => event.kind === 'model_plan_mode');
    return event?.kind === 'model_plan_mode' ? event.planId : this.id;
  }

  // amn/Aq, ax9zepsq [7009,8595), x2c03s1m [6222,11236), UTF-16.
  private changeModelPlanMode(mode: 'plan' | PlanExitMode): void {
    if (this.inheritedPermissions || this.config.childMode) throw new Error('Only the main session can change plan mode');
    if (this.config.managedPolicy?.permissions !== undefined) throw new Error('Permission mode is pinned by managed settings');
    const state = this.permissionOwner.state();
    if (mode !== 'plan' && state.mode !== 'plan') throw new Error('The session is not in plan mode');
    const next = transitionPlanMode(state, mode, this.autoRuntime);
    this.append(mode === 'plan'
      ? { kind: 'model_plan_mode', operation: 'enter', mode, planId: this.planId }
      : { kind: 'model_plan_mode', operation: 'exit', mode, planId: this.planId });
    this.permissionUpdates = next;
    for (const listener of this.permissionListeners) listener();
  }

  readonly permissionOwner: LivePermissionOwner = {
    prepareAutoMode: () => this.prepareAutoMode(),
    state: () => ({ ...(this.inheritedPermissions
      ? childPermissionState(this.inheritedPermissions.owner.state(), this.inheritedPermissions.allowedTools)
      : { ...this.permissionUpdates, mode: this.permissionUpdates.mode ?? this.config.permissions?.mode }),
      planFile: this.planMode?.filePath, planOwnership: this.planMode?.ownership }),
    workingDirectories: readOnly => this.workingDirectories(readOnly),
    adoptUpdates: updates => this.adoptPermissionUpdates(updates),
  };

  /** Rir sfn [2539631,2543941), eXn rgay [1086,1317), UTF-16. Both child lanes share session adoption. */
  inheritPermissionAdoption(owner: LivePermissionOwner): void {
    this.permissionAdoptionOwner = owner;
  }

  inheritPermissions(owner: LivePermissionOwner, allowedTools?: readonly string[]): void {
    this.inheritPermissionAdoption(owner);
    this.inheritedPermissions = { owner, allowedTools };
    bindPermissionOwner(this.config.permissions, this.permissionOwner);
  }

  /** HV, 24k7d6mw [348500,351100), UTF-16. Ordinary fork retains the live context without settings rehydration. */
  carryForkPermissions(previous: Session): void {
    const { contentRuleOwner, ...state } = previous.permissionOwner.state();
    this.permissionUpdates = { ...structuredClone(state), contentRuleOwner };
    this.directoryObservations.clear();
    this.copyDirectoryHandles(previous);
    for (const [directory, observations] of previous.directoryObservations) {
      this.directoryObservations.set(directory, [...observations]);
    }
    bindPermissionOwner(this.config.permissions, this.permissionOwner);
  }

  /** IFt/FVt retain the live owner across a local configuration branch. */
  carryPermissions(previous: Session, preserveMode = true): void {
    this.permissionUpdates = reloadPermissionState(previous.permissionOwner.state(), this.config.permissions,
      this.config.workspace, this.config.configSources?.userDir ?? defaultUserDir());
    // The source builds `isBypassPermissionsModeAvailable` once per session context and `UBt`
    // reads it for the cycle; a live mode change must not revoke a launch-granted availability.
    if (previous.permissionOwner.state().isBypassPermissionsModeAvailable)
      this.permissionUpdates.isBypassPermissionsModeAvailable = true;
    if (!preserveMode) delete this.permissionUpdates.mode;
    this.directoryObservations.clear();
    this.copyDirectoryHandles(previous);
    for (const [directory, observations] of previous.directoryObservations) {
      if (this.permissionUpdates.additionalWorkingDirectories.has(directory)) this.directoryObservations.set(directory, observations);
    }
    bindPermissionOwner(this.config.permissions, this.permissionOwner);
    this.workingDirectories(false);
  }

  workingDirectories(readOnly: boolean): string[] & WorkingDirectories {
    if (this.closed || this.directoryHandlesReleased) return [];
    if (this.inheritedPermissions) {
      const parent = this.inheritedPermissions.owner.workingDirectories(readOnly);
      const directories = [...parent];
      Object.defineProperty(directories, 'rootSpellings', { value: 'rootSpellings' in parent ? parent.rootSpellings : [] });
      Object.defineProperty(directories, 'readHandle', { value: (root: string) => {
        const handle = this.closed || this.directoryHandlesReleased ? undefined : this.inheritedPermissions?.owner.workingDirectories(readOnly).readHandle?.(root);
        return handle && { ...handle, signal: AbortSignal.any([handle.signal, this.directoryOwnerController.signal]) };
      } });
      return directories;
    }
    const entries = [...this.permissionUpdates.additionalWorkingDirectories.values()]
      .filter(directory => !(readOnly && this.config.permissions?.blockReadsOutsideWorkingDirectories && directory.source === 'projectSettings'));
    for (const directory of entries) {
      if (!this.directoryObservations.has(directory.path)) this.directoryObservations.set(directory.path,
        observeWorkingDirectory(this.config.workspace, directory.path));
      if (!this.unavailableDirectoryHandles.has(directory.path) && !this.directoryHandles.has(directory.path) && (this.directoryObservations.get(directory.path)?.length ?? 0) > 0) {
        let fd: number | undefined;
        try {
          const resolved = resolveChain(this.config.workspace, directory.path);
          if (!resolved.identity) throw new Error('directory missing');
          verifyIdentity(resolved);
          fd = fs.openSync(directory.path, fs.constants.O_RDONLY | (fs.constants.O_DIRECTORY ?? 0));
          const stat = fs.fstatSync(fd, { bigint: true });
          const current = fs.statSync(directory.path, { bigint: true });
          if (!stat.isDirectory() || stat.dev !== current.dev || stat.ino !== current.ino ||
              String(stat.dev) !== resolved.identity.dev || String(stat.ino) !== resolved.identity.ino) throw new Error('directory changed');
          const controller = new AbortController();
          this.directoryHandleControllers.set(directory.path, controller);
          this.directoryHandles.set(directory.path, { fd, root: directory.path, dev: stat.dev, ino: stat.ino, signal: controller.signal,
            incarnation: randomUUID(), owner: this.id });
        } catch { if (fd !== undefined) fs.closeSync(fd); this.unavailableDirectoryHandles.add(directory.path); }
      }
    }
    const valid = entries.filter(directory => (this.directoryObservations.get(directory.path)?.length ?? 0) > 0);
    const directories = valid.map(directory => directory.path);
    Object.defineProperty(directories, 'rootSpellings', { value: valid.flatMap(directory => this.directoryObservations.get(directory.path) ?? []) });
    Object.defineProperty(directories, 'readHandle', { value: (root: string) => {
      const entry = this.permissionUpdates.additionalWorkingDirectories.get(root);
      if (this.closed || this.directoryHandlesReleased || !entry ||
          (readOnly && this.config.permissions?.blockReadsOutsideWorkingDirectories && entry.source === 'projectSettings')) return undefined;
      const handle = this.directoryHandles.get(root);
      if (!handle) return undefined;
      try {
        const stat = fs.fstatSync(handle.fd, { bigint: true });
        return stat.isDirectory() && stat.dev === handle.dev && stat.ino === handle.ino ? handle : undefined;
      } catch { return undefined; }
    } });
    return directories;
  }

  /** CUt [3459,3835), O1 [199668,199720), UTF-16. Memory commits before queued persistence. */
  adoptPermissionUpdates(updates: readonly PermissionUpdate[]): ReturnType<typeof applyPermissionUpdates> {
    if (this.closed) throw new Error('Session is closed');
    // sxr sfn [3317869,3319984), UTF-16. Reduce against latest shared authority, then persist there.
    if (this.permissionAdoptionOwner?.adoptUpdates) return this.permissionAdoptionOwner.adoptUpdates(updates);
    const outcome = applyPermissionUpdates(this.permissionUpdates, updates);
    if (outcome.blocked !== undefined) return outcome;
    this.permissionUpdates = outcome.state;
    for (const update of outcome.applied ?? []) {
      if (update.type === 'removeDirectories') for (const directory of update.directories) {
        this.directoryObservations.delete(directory);
        this.unavailableDirectoryHandles.delete(directory);
        this.directoryHandleControllers.get(directory)?.abort();
        this.directoryHandleControllers.delete(directory);
        const handle = this.directoryHandles.get(directory);
        if (handle) { fs.closeSync(handle.fd); this.directoryHandles.delete(directory); }
      }
    }
    for (const directory of this.directoryObservations.keys()) {
      if (!this.permissionUpdates.additionalWorkingDirectories.has(directory)) {
        this.directoryObservations.delete(directory);
        this.unavailableDirectoryHandles.delete(directory);
        this.directoryHandleControllers.get(directory)?.abort();
        this.directoryHandleControllers.delete(directory);
        const handle = this.directoryHandles.get(directory);
        if (handle) { fs.closeSync(handle.fd); this.directoryHandles.delete(directory); }
      }
    }
    this.workingDirectories(false);
    bindPermissionOwner(this.config.permissions, this.permissionOwner);
    const paths = permissionSettingsPaths(this.config.workspace, this.config.configSources?.userDir ?? defaultUserDir());
    for (const update of outcome.applied ?? []) {
      const pending = persistPermissionUpdate(update, paths, this.config.permissions?.managedOnly === true, {
        workspace: this.config.workspace,
        schedule: work => {
          const pendingIgnore = work.then(result => { this.permissionIgnoreResults.push(result); })
            .finally(() => { this.pendingPermissionWrites.delete(pendingIgnore); });
          this.pendingPermissionWrites.add(pendingIgnore);
        },
      })
        .then(result => { this.permissionWriteResults.push(result); })
        .finally(() => { this.pendingPermissionWrites.delete(pending); });
      this.pendingPermissionWrites.add(pending);
    }
    for (const listener of this.permissionListeners) {
      try { listener(); } catch { /* UI observers do not own permission adoption or persistence. */ }
    }
    return outcome;
  }

  async drainPermissionWrites(): Promise<readonly PermissionWriteResult[]> {
    while (this.pendingPermissionWrites.size) await Promise.all([...this.pendingPermissionWrites]);
    return [...this.permissionWriteResults];
  }
  private fd: number;
  private lock: string;
  private lockToken: string;
  private lockGate: SessionGateIdentity;
  private ownsLock = true;
  private closed = false;
  private readonly closeController = new AbortController();
  private journalFailed = false;
  private readonly directoryCheckpointBracketIds = new Set<string>();
  private directoryCheckpointGate?: { fd: number; dev: bigint; ino: bigint; users: number };
  // Host rewrite: ns/Si and OMe/Tle, sfn1dbxq [226694,227794)/[233465,234179)/
  // [4543991,4544354), UTF-16, do not own this journal's receipt or coordination state.
  private readonly modelIsolatedDeliveryIds = new Set<string>();
  private readonly coordinationPendingDeliveryIds = new Set<string>();
  private recoveredUnknownDeliveryIds = new Set<string>();

  get notificationCoordination(): ReadonlyArray<{ deliveryId: string; state: 'unknown' }> {
    return [...this.coordinationPendingDeliveryIds].map(deliveryId => ({ deliveryId, state: 'unknown' }));
  }

  get unknownNotifications(): ReadonlyArray<{ deliveryId: string; state: 'unknown' }> {
    return this.notificationCoordination;
  }

  private markNotificationUnknown(deliveryId: string): void {
    this.modelIsolatedDeliveryIds.add(deliveryId);
    this.coordinationPendingDeliveryIds.add(deliveryId);
  }

  private markNotificationReceipted(deliveryId: string): void {
    this.modelIsolatedDeliveryIds.delete(deliveryId);
    this.coordinationPendingDeliveryIds.delete(deliveryId);
  }

  private notificationSidecar(deliveryId: string, kind: 'intent' | 'receipt' | 'decision' | 'decision-receipt'): string {
    return `${this.file}.notification-${deliveryId}.${kind}`;
  }

  private static notificationDigest(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  // Host decision rewrite: iye, chunk-sfn1dbxq [3368429,3370821), UTF-16,
  // does not own the effect journal or a user decision.
  private readonly skillEffectRetries = new Set<string>();

  confirmSkillEffect(owner: string, effectId: string, decision: 'processed' | 'retry' = 'processed'): void {
    if (this.closed || this.journalFailed) throw new Error('Session is closed or journal fenced');
    if (owner !== this.id) throw new Error('Skill effect owner mismatch');
    const journal = new SkillEffectJournal(this.config.workspace, this.id);
    if (decision === 'retry') {
      journal.confirmRetry(effectId);
      this.skillEffectRetries.add(effectId);
    } else journal.confirmProcessed(effectId);
  }

  consumeSkillEffectRetry(effectId: string, skill: string, index: number, command: string): SkillEffectRetryGrant | undefined {
    if (this.closed || this.journalFailed || !this.skillEffectRetries.has(effectId)) return undefined;
    const consumed = new SkillEffectJournal(this.config.workspace, this.id).consumeRetryGrant(effectId, skill, index, command);
    if (consumed) this.skillEffectRetries.delete(effectId);
    return consumed;
  }

  // Host rewrite: ns/Si and OMe/Tle, sfn1dbxq [226694,227794)/
  // [233465,234179)/[4543991,4544354), UTF-16, have no human decision journal.
  confirmNotification(owner: string, deliveryId: string): void {
    if (this.closed || this.journalFailed) throw new Error('Session is closed or journal fenced');
    if (owner !== this.id) throw new Error('Notification owner mismatch');
    const intents = this.events.filter(row => (row.kind === 'notification_intent' || row.kind === 'notification_intent_v2') && row.deliveryId === deliveryId && row.owner === owner);
    if (intents.length !== 1 || !this.modelIsolatedDeliveryIds.has(deliveryId)) throw new Error('Unknown delivery ID');
    if (!this.coordinationPendingDeliveryIds.has(deliveryId)) return;
    const journalStat = fs.lstatSync(this.file), openedJournal = fs.fstatSync(this.fd);
    if (!journalStat.isFile() || journalStat.isSymbolicLink() || journalStat.dev !== openedJournal.dev || journalStat.ino !== openedJournal.ino) throw new Error('Notification journal replaced');
    const journal = fs.readFileSync(this.file);
    if (!journal.length || journal.at(-1) !== 10 || JSON.stringify(journal.toString('utf8').trimEnd().split('\n').map(line => JSON.parse(line))) !== JSON.stringify(this.events)) throw new Error('Notification journal changed');
    const state = { owner, deliveryId, intent: Session.notificationDigest(intents[0]), state: 'unknown', decision: 'processed', journal: { bytes: journal.length, sha256: createHash('sha256').update(journal).digest('hex') } };
    try {
      fs.fsyncSync(this.fd);
      atomicWriteFile(this.notificationSidecar(deliveryId, 'decision'), JSON.stringify(state), { mode: 0o600, durable: true });
      atomicWriteFile(this.notificationSidecar(deliveryId, 'decision-receipt'), JSON.stringify({ owner, deliveryId, decision: Session.notificationDigest(state) }), { mode: 0o600, durable: true });
      this.coordinationPendingDeliveryIds.delete(deliveryId);
    } catch (error) { this.journalFailed = true; throw error; }
  }

  // Host rewrite: ns/Si and OMe/Tle, sfn1dbxq [226694,227794)/
  // [233465,234179)/[4543991,4544354), UTF-16; source has no durable retry decision.
  retryNotification(owner: string, deliveryId: string): Extract<SessionEvent, { kind: 'notification_intent_v2' }> | undefined {
    if (this.closed || this.journalFailed) throw new Error('Session is closed or journal fenced');
    if (owner !== this.id) throw new Error('Notification owner mismatch');
    const matches = this.events.filter(row => (row.kind === 'notification_intent' || row.kind === 'notification_intent_v2') && row.deliveryId === deliveryId && row.owner === owner);
    if (matches.length !== 1 || matches[0]?.kind !== 'notification_intent_v2' || !this.modelIsolatedDeliveryIds.has(deliveryId)) throw new Error('Unknown complete delivery ID');
    if (!this.coordinationPendingDeliveryIds.has(deliveryId)) return undefined;
    if (fs.existsSync(this.notificationSidecar(deliveryId, 'decision')) || fs.existsSync(this.notificationSidecar(deliveryId, 'decision-receipt'))) throw new Error('Notification decision outcome unknown');
    const journalStat = fs.lstatSync(this.file), openedJournal = fs.fstatSync(this.fd);
    if (!journalStat.isFile() || journalStat.isSymbolicLink() || journalStat.dev !== openedJournal.dev || journalStat.ino !== openedJournal.ino) throw new Error('Notification journal replaced');
    const journal = fs.readFileSync(this.file);
    if (!journal.length || journal.at(-1) !== 10 || JSON.stringify(journal.toString('utf8').trimEnd().split('\n').map(line => JSON.parse(line))) !== JSON.stringify(this.events)) throw new Error('Notification journal changed');
    const next = { ...structuredClone(matches[0]), deliveryId: randomUUID() };
    const state = { owner, deliveryId, intent: Session.notificationDigest(matches[0]), state: 'unknown', decision: 'retry', retryDeliveryId: next.deliveryId, journal: { bytes: journal.length, sha256: createHash('sha256').update(journal).digest('hex') } };
    try {
      fs.fsyncSync(this.fd);
      atomicWriteFile(this.notificationSidecar(deliveryId, 'decision'), JSON.stringify(state), { mode: 0o600, durable: true });
      atomicWriteFile(this.notificationSidecar(deliveryId, 'decision-receipt'), JSON.stringify({ owner, deliveryId, decision: Session.notificationDigest(state) }), { mode: 0o600, durable: true });
      this.coordinationPendingDeliveryIds.delete(deliveryId);
      this.append(next);
      return next;
    } catch (error) { this.journalFailed = true; throw error; }
  }

  private reconcileNotificationDecision(deliveryId: string): void {
    const descriptors: number[] = [];
    try {
      const read = (kind: 'decision' | 'decision-receipt'): unknown => {
        const file = this.notificationSidecar(deliveryId, kind), stat = fs.lstatSync(file);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4096) throw new Error('Invalid decision evidence');
        const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW); descriptors.push(fd);
        const opened = fs.fstatSync(fd);
        if (opened.dev !== stat.dev || opened.ino !== stat.ino) throw new Error('Decision evidence changed');
        return JSON.parse(fs.readFileSync(fd, 'utf8'));
      };
      const common = { owner: z.string().uuid(), deliveryId: z.string().uuid(), intent: z.string().length(64), state: z.literal('unknown') };
      const journalWitness = z.object({ bytes: z.number().int().positive(), sha256: z.string().length(64) }).strict();
      const state = z.discriminatedUnion('decision', [z.object({ ...common, decision: z.literal('processed'), journal: journalWitness }).strict(), z.object({ ...common, decision: z.literal('retry'), retryDeliveryId: z.string().uuid(), journal: journalWitness }).strict()]).parse(read('decision'));
      const receipt = z.object({ owner: z.string().uuid(), deliveryId: z.string().uuid(), decision: z.string().length(64) }).strict().parse(read('decision-receipt'));
      const intents = this.events.filter(row => (row.kind === 'notification_intent' || row.kind === 'notification_intent_v2') && row.deliveryId === deliveryId && row.owner === this.id);
      const journalStat = fs.lstatSync(this.file), openedJournal = fs.fstatSync(this.fd), journal = fs.readFileSync(this.file);
      const prefix = journal.subarray(0, state.journal.bytes);
      if (!journalStat.isFile() || journalStat.isSymbolicLink() || journalStat.dev !== openedJournal.dev || journalStat.ino !== openedJournal.ino ||
          state.owner !== this.id || state.deliveryId !== deliveryId || intents.length !== 1 || state.intent !== Session.notificationDigest(intents[0]) ||
          receipt.owner !== this.id || receipt.deliveryId !== deliveryId || receipt.decision !== Session.notificationDigest(state) ||
          prefix.length !== state.journal.bytes || prefix.at(-1) !== 10 || createHash('sha256').update(prefix).digest('hex') !== state.journal.sha256 ||
          !prefix.toString('utf8').split('\n').some(line => line === JSON.stringify(intents[0]))) throw new Error('Decision witness mismatch');
      fs.fsyncSync(this.fd); for (const fd of descriptors) fs.fsyncSync(fd);
      syncDirectory(path.dirname(path.dirname(this.file))); syncDirectory(path.dirname(this.file));
      for (let i = 0; i < descriptors.length; i++) {
        const file = this.notificationSidecar(deliveryId, i === 0 ? 'decision' : 'decision-receipt');
        const stat = fs.lstatSync(file), opened = fs.fstatSync(descriptors[i]!);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.dev !== opened.dev || stat.ino !== opened.ino || fs.readFileSync(file, 'utf8') !== JSON.stringify(i === 0 ? state : receipt)) throw new Error('Decision evidence changed during sync');
      }
      if (!fs.readFileSync(this.file).equals(journal)) throw new Error('Journal changed during sync');
      if (state.decision === 'retry') {
        const original = intents[0];
        const next = this.events.filter(row => (row.kind === 'notification_intent' || row.kind === 'notification_intent_v2') && row.deliveryId === state.retryDeliveryId);
        if (original?.kind !== 'notification_intent_v2' || state.retryDeliveryId === deliveryId || next.length > 1 || (next.length === 1 && (next[0]?.kind !== 'notification_intent_v2' || next[0].owner !== this.id || JSON.stringify(next[0].batch) !== JSON.stringify(original.batch)))) throw new Error('Retry intent mismatch');
        if (next.length === 0) this.markNotificationUnknown(state.retryDeliveryId);
      }
      this.modelIsolatedDeliveryIds.add(deliveryId);
      this.coordinationPendingDeliveryIds.delete(deliveryId);
    } catch { /* Incomplete evidence remains pending. */ }
    finally { for (const fd of descriptors) fs.closeSync(fd); }
  }

  private reconcileNotifications(): void {
    const prefix = `${path.basename(this.file)}.notification-`;
    const names = fs.readdirSync(path.dirname(this.file));
    const tornEvidence = names.some(name => name.startsWith(`${path.basename(this.file)}.torn-`));
    for (const name of names) {
      if (!name.startsWith(prefix) || !name.endsWith('.intent')) continue;
      const deliveryId = name.slice(prefix.length, -'.intent'.length);
      if (z.string().uuid().safeParse(deliveryId).success) this.markNotificationUnknown(deliveryId);
    }
    for (const event of this.events) {
      if (event.kind === 'notification_intent') this.markNotificationUnknown(event.deliveryId);
      if (event.kind === 'message' && event.notificationDelivery) this.markNotificationUnknown(event.notificationDelivery.deliveryId);
    }
    for (const intent of this.events) {
      if (intent.kind !== 'notification_intent_v2') continue;
      const rows = this.events.filter(row => row.kind === 'message' && row.notificationDelivery?.deliveryId === intent.deliveryId);
      const intents = this.events.filter(row => (row.kind === 'notification_intent_v2' || row.kind === 'notification_intent') && row.deliveryId === intent.deliveryId);
      let confirmed = false;
      try {
        const descriptors: number[] = [], contents: string[] = [];
        try {
        const read = (kind: 'intent' | 'receipt'): unknown => {
          const file = this.notificationSidecar(intent.deliveryId, kind);
          const stat = fs.lstatSync(file);
          if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4096) throw new Error('Invalid notification sidecar');
          const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
          descriptors.push(fd);
          const opened = fs.fstatSync(fd);
          if (!opened.isFile() || opened.dev !== stat.dev || opened.ino !== stat.ino) throw new Error('Notification sidecar changed');
          const content = fs.readFileSync(fd, 'utf8');
          contents.push(content);
          return JSON.parse(content);
        };
        const state = z.object({ owner: z.string().uuid(), deliveryId: z.string().uuid(), intent: z.string().length(64) }).strict().parse(read('intent'));
        const receipt = z.object({ owner: z.string().uuid(), deliveryId: z.string().uuid(), intent: z.string().length(64), message: z.string().length(64),
          journal: z.object({ bytes: z.number().int().positive(), sha256: z.string().length(64) }).strict() }).strict().parse(read('receipt'));
        const row = rows[0];
        confirmed = !tornEvidence && intents.length === 1 && rows.length === 1 && row?.kind === 'message' && row.notificationDelivery?.owner === this.id &&
          intent.owner === this.id && this.events.indexOf(intent) < this.events.indexOf(row) &&
          state.owner === this.id && state.deliveryId === intent.deliveryId && state.intent === Session.notificationDigest(intent) &&
          receipt.owner === state.owner && receipt.deliveryId === state.deliveryId && receipt.intent === state.intent &&
          receipt.message === Session.notificationDigest(row);
        if (confirmed) {
          // Re-establish durability on reopen; the earlier rename's directory sync may have failed.
          const journalStat = fs.lstatSync(this.file), openedJournal = fs.fstatSync(this.fd);
          if (!journalStat.isFile() || journalStat.isSymbolicLink() || journalStat.dev !== openedJournal.dev || journalStat.ino !== openedJournal.ino) throw new Error('Notification journal replaced');
          const journal = fs.readFileSync(this.file);
          if (!journal.length || journal.at(-1) !== 10 || JSON.stringify(journal.toString('utf8').trimEnd().split('\n').map(line => JSON.parse(line))) !== JSON.stringify(this.events)) throw new Error('Notification journal changed');
          const prefix = journal.subarray(0, receipt.journal.bytes);
          if (prefix.length !== receipt.journal.bytes || prefix.at(-1) !== 10 || createHash('sha256').update(prefix).digest('hex') !== receipt.journal.sha256) throw new Error('Notification journal witness mismatch');
          const witnessed = prefix.toString('utf8').trimEnd().split('\n').map(line => JSON.parse(line));
          if (JSON.stringify(witnessed.at(-1)) !== JSON.stringify(row)) throw new Error('Notification message is not journal witness tail');
          fs.fsyncSync(this.fd);
          for (const fd of descriptors) fs.fsyncSync(fd);
          syncDirectory(path.dirname(path.dirname(this.file)));
          syncDirectory(path.dirname(this.file));
          const journalAfter = fs.lstatSync(this.file);
          if (!journalAfter.isFile() || journalAfter.isSymbolicLink() || journalAfter.dev !== openedJournal.dev || journalAfter.ino !== openedJournal.ino || !fs.readFileSync(this.file).equals(journal)) throw new Error('Notification journal changed during sync');
          for (let i = 0; i < descriptors.length; i++) {
            const file = this.notificationSidecar(intent.deliveryId, i === 0 ? 'intent' : 'receipt');
            const actual = fs.lstatSync(file), opened = fs.fstatSync(descriptors[i]!);
            if (!actual.isFile() || actual.isSymbolicLink() || actual.dev !== opened.dev || actual.ino !== opened.ino || fs.readFileSync(file, 'utf8') !== contents[i]) throw new Error('Notification sidecar changed during sync');
          }
        }
        } finally { for (const fd of descriptors) fs.closeSync(fd); }
      } catch { confirmed = false; /* Missing, malformed or unsynced evidence is unknown. */ }
      if (confirmed) this.markNotificationReceipted(intent.deliveryId);
      else this.markNotificationUnknown(intent.deliveryId);
    }
    for (const intent of this.events) {
      if (intent.kind !== 'notification_intent' && intent.kind !== 'notification_intent_v2') continue;
      if (names.includes(path.basename(this.notificationSidecar(intent.deliveryId, 'decision'))) ||
          names.includes(path.basename(this.notificationSidecar(intent.deliveryId, 'decision-receipt')))) {
        this.markNotificationUnknown(intent.deliveryId);
        this.reconcileNotificationDecision(intent.deliveryId);
      }
    }
    this.recoveredUnknownDeliveryIds = new Set(this.modelIsolatedDeliveryIds);
  }

  private directoryBackupPath(id: string): string { return `${this.file}.backup-unknown-${id}`; }
  private directoryBackupReceiptPath(id: string): string { return `${this.file}.backup-receipt-${id}`; }
  private directoryBackupPendingPath(id: string): string { return `${this.file}.backup-pending-${id}`; }
  private directoryEvidencePath(kind: DirectoryEvidenceEvent['kind'], id: string): string {
    return kind === 'directory_backup' ? this.directoryBackupPath(id) : `${this.file}.snapshot-unknown-${id}`;
  }
  private directoryEvidenceReceiptPath(kind: DirectoryEvidenceEvent['kind'], id: string): string {
    return kind === 'directory_backup' ? this.directoryBackupReceiptPath(id) : `${this.file}.snapshot-receipt-${id}`;
  }
  private directoryEvidencePendingPath(kind: DirectoryEvidenceEvent['kind'], id: string): string {
    return kind === 'directory_backup' ? this.directoryBackupPendingPath(id) : `${this.file}.snapshot-pending-${id}`;
  }
  private hasDirectoryEvidencePending(kind: DirectoryEvidenceEvent['kind'], id: string): boolean {
    try { fs.lstatSync(this.directoryEvidencePendingPath(kind, id)); return true; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
  }
  private hasDirectoryBackupPending(id: string): boolean {
    return this.hasDirectoryEvidencePending('directory_backup', id);
  }
  private assertDirectoryBackupLock(): void {
    const named = fs.lstatSync(this.lock, { bigint: true });
    if (!named.isFile() || named.isSymbolicLink() || named.size > 4096n) throw new Error('Directory backup Session lock invalid');
    const fd = fs.openSync(this.lock, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    try {
      const opened = fs.fstatSync(fd, { bigint: true }), bytes = fs.readFileSync(fd);
      const owner: unknown = JSON.parse(bytes.toString('utf8'));
      const parsed = sessionLockSchema.parse(owner), gate = fs.lstatSync(`${this.lock}.gate`, { bigint: true });
      const after = fs.lstatSync(this.lock, { bigint: true });
      if (!opened.isFile() || opened.dev !== named.dev || opened.ino !== named.ino ||
          !after.isFile() || after.isSymbolicLink() || after.dev !== opened.dev || after.ino !== opened.ino ||
          parsed.pid !== process.pid || parsed.token !== this.lockToken || parsed.gate.dev !== this.lockGate.dev ||
          parsed.gate.ino !== this.lockGate.ino || !gate.isFile() || gate.isSymbolicLink() ||
          String(gate.dev) !== this.lockGate.dev || String(gate.ino) !== this.lockGate.ino || !fs.readFileSync(this.lock).equals(bytes))
        throw new Error('Directory backup Session lock changed');
    } finally { fs.closeSync(fd); }
  }

  private checkpointLockWitness(): CheckpointSourceLock {
    this.assertDirectoryBackupLock();
    const before = fs.lstatSync(this.lock, { bigint: true }), gate = this.checkpointGateIdentity();
    this.assertDirectoryBackupLock();
    const after = fs.lstatSync(this.lock, { bigint: true });
    if (before.dev !== after.dev || before.ino !== after.ino || before.uid !== after.uid || before.mode !== after.mode ||
        before.size !== after.size || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs || before.nlink !== 1n || after.nlink !== 1n)
      throw new Error('Checkpoint source lock changed');
    return { pid: process.pid, dev: String(before.dev), ino: String(before.ino), uid: String(before.uid), mode: String(before.mode),
      size: String(before.size), mtimeNs: String(before.mtimeNs), ctimeNs: String(before.ctimeNs), gate };
  }

  // Fet/rhe, sfn1dbxq [4731316,4732048)/[4728518,4730433), UTF-16:
  // the assistant parent and the user snapshot are separate message identities.
  private directoryBackupMessageContext(toolUseId: string, before: number): DirectoryBackupMessageContext | undefined {
    const history = this.events.slice(0, before);
    const startIndex = history.findLastIndex(event => event.kind === 'tool_start' && event.id === toolUseId);
    const start = history[startIndex];
    if (!start || start.kind !== 'tool_start' || start.name !== 'write_file' || !start.parentMessageId ||
        history.slice(startIndex + 1).some(event => (event.kind === 'tool_effect' || event.kind === 'tool_result') && event.result.tool_use_id === toolUseId)) return;
    const parentIndex = history.findLastIndex(event => event.kind === 'message' && event.messageId === start.parentMessageId);
    const parent = history[parentIndex];
    if (!parent || parent.kind !== 'message' || parent.message.role !== 'assistant' || parentIndex >= startIndex ||
        !Array.isArray(parent.message.content) || parent.message.content.filter(block => block.type === 'tool_use' && block.id === toolUseId && block.name === 'write_file').length !== 1) return;
    const boundary = history.slice(0, parentIndex).findLastIndex(event => event.kind === 'turn_end');
    const user = history.slice(boundary + 1, parentIndex).findLast(event => event.kind === 'message' && event.message.role === 'user' && !event.isMeta && !!event.messageId);
    if (!user || user.kind !== 'message' || !user.messageId ||
        history.filter(event => event.kind === 'message' && event.messageId === user.messageId).length !== 1 ||
        history.filter(event => event.kind === 'message' && event.messageId === start.parentMessageId).length !== 1) return;
    return { userMessageId: user.messageId, parentMessageId: start.parentMessageId };
  }

  // Host rewrite: uno/Fet/T$n, sfn1dbxq SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da,
  // UTF-16 [739599,743280)/[4731316,4732048)/[4739060,4739632), have no FD-bound journal or receipt.
  recordDirectoryBackup(input: { id: string; toolUseId: string; lexicalPath: string; grant: DirectoryReadHandle;
    destinationFd: number; bytes: number; sha256: string; source: { begin: BoundDirectoryFileObservation; end: BoundDirectoryFileObservation }; signal: AbortSignal }): void {
    const assertOwner = () => {
      input.signal.throwIfAborted();
      const current = this.workingDirectories(false).readHandle?.(input.grant.root);
      if (this.closed || this.journalFailed || input.grant.signal.aborted || !current || current.signal.aborted ||
          current.owner !== this.id || input.grant.owner !== this.id || current.incarnation !== input.grant.incarnation ||
          current.fd !== input.grant.fd || current.dev !== input.grant.dev || current.ino !== input.grant.ino)
        throw new Error('Directory backup owner or grant retired');
      this.assertDirectoryBackupLock();
    };
    assertOwner();
    const relative = path.relative(input.grant.root, input.lexicalPath);
    const messageContext = this.directoryBackupMessageContext(input.toolUseId, this.events.length);
    if (!path.isAbsolute(input.lexicalPath) || path.resolve(input.lexicalPath) !== input.lexicalPath || !relative ||
        relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) ||
        !messageContext)
      throw new Error('Directory backup call identity mismatch');
    const sidecar = this.directoryBackupPath(input.id);
    const source = { begin: boundDirectoryFileObservationSchema.parse(input.source.begin), end: boundDirectoryFileObservationSchema.parse(input.source.end) };
    const file = fs.fstatSync(input.destinationFd, { bigint: true }), named = fs.lstatSync(sidecar, { bigint: true });
    if (!file.isFile() || !named.isFile() || named.isSymbolicLink() || file.dev !== named.dev || file.ino !== named.ino ||
        (file.mode & 0o777n) !== 0o600n || file.size !== BigInt(input.bytes) || BigInt(source.begin.size) !== BigInt(input.bytes) ||
        JSON.stringify(source.begin) !== JSON.stringify(source.end) ||
        Number(source.begin.mtimeNanoseconds) >= 1e9 || Number(source.begin.ctimeNanoseconds) >= 1e9)
      throw new Error('Directory backup sidecar identity mismatch');
    const event = directoryBackupSchema.parse({ kind: 'directory_backup', id: input.id, owner: this.id,
      toolUseId: input.toolUseId, lexicalPath: input.lexicalPath, messageContext,
      grant: { root: input.grant.root, incarnation: input.grant.incarnation, dev: String(input.grant.dev), ino: String(input.grant.ino) },
      source, sidecar: { dev: String(file.dev), ino: String(file.ino), uid: String(file.uid) }, bytes: input.bytes, sha256: input.sha256 });
    if (this.events.some(row => (row.kind === 'directory_backup' || row.kind === 'directory_snapshot_file') && row.id === input.id) ||
        fs.existsSync(this.directoryBackupReceiptPath(input.id)) || this.hasDirectoryBackupPending(input.id))
      throw new Error('Directory backup identity already exists');
    if (this.hashDirectoryBackup(input.destinationFd, input.bytes) !== input.sha256) throw new Error('Directory backup content changed');
    fs.fsyncSync(input.destinationFd);
    assertOwner();
    syncDirectory(path.dirname(sidecar));
    assertOwner();
    this.commitDirectoryReceipt(event, assertOwner);
  }

  // Fet/T$n, sfn1dbxq [4731316,4732048)/[4739060,4739632), UTF-16;
  // the host records a pinned-parent witness instead of a pathname null backup.
  recordMissingDirectoryBackup(input: { id: string; toolUseId: string; lexicalPath: string; grant: DirectoryReadHandle;
    value: unknown; signal: AbortSignal }): boolean {
    const assertOwner = () => this.assertDirectorySnapshotOwner(input.signal, input.grant);
    assertOwner();
    const relative = path.relative(input.grant.root, input.lexicalPath);
    const messageContext = this.directoryBackupMessageContext(input.toolUseId, this.events.length);
    const writeInput = describeDirectoryWriteInput(this, input.value);
    const start = this.events.findLast(row => row.kind === 'tool_start' && row.id === input.toolUseId);
    if (!path.isAbsolute(input.lexicalPath) || path.resolve(input.lexicalPath) !== input.lexicalPath || !relative ||
        relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) || !messageContext ||
        !writeInput || writeInput.lexicalPath !== input.lexicalPath || !start || start.kind !== 'tool_start' ||
        start.parentMessageId !== messageContext.parentMessageId || start.writeInputDigest !== directoryWriteFingerprint(writeInput))
      throw new Error('Directory missing backup call identity mismatch');
    const parent = probeMissingDirectoryFile({ fd: input.grant.fd, relative });
    assertOwner();
    if (!parent) return false;
    const event = directoryMissingBackupSchema.parse({ kind: 'directory_missing_backup', id: input.id, owner: this.id,
      toolUseId: input.toolUseId, lexicalPath: input.lexicalPath, messageContext,
      grant: { root: input.grant.root, incarnation: input.grant.incarnation, dev: String(input.grant.dev), ino: String(input.grant.ino) },
      parent, createMode: 0o666 & ~process.umask(), writeInput: { content: writeInput.content, overwrite: writeInput.overwrite } });
    if (this.events.some(row => (row.kind === 'directory_backup' || row.kind === 'directory_snapshot_file' || row.kind === 'directory_missing_backup') && row.id === input.id))
      throw new Error('Directory missing backup identity already exists');
    this.commitDirectoryReceipt(event, assertOwner);
    return true;
  }

  private commitDirectoryReceipt(event: DirectoryEvidenceEvent | DirectorySnapshotEvent | DirectorySnapshotRecoveryEvent | DirectoryMissingBackupEvent, assertOwner: () => void): void {
    const { id, kind } = event;
    const snapshot = kind === 'directory_snapshot';
    const recovery = kind === 'directory_snapshot_recovery';
    const missing = kind === 'directory_missing_backup';
    const pending = snapshot ? this.directorySnapshotPendingPath(id) : recovery ? this.directorySnapshotRecoveryPendingPath(id) :
      missing ? this.directoryMissingBackupPendingPath(id) : this.directoryEvidencePendingPath(kind, id);
    const receiptPath = snapshot ? this.directorySnapshotReceiptPath(id) : recovery ? this.directorySnapshotRecoveryReceiptPath(id) :
      missing ? this.directoryMissingBackupReceiptPath(id) : this.directoryEvidenceReceiptPath(kind, id);
    const hasPending = () => snapshot ? this.hasDirectorySnapshotPending(id) : recovery ? this.hasDirectorySnapshotRecoveryPending(id) :
      missing ? this.hasDirectoryMissingBackupPending(id) : this.hasDirectoryEvidencePending(kind, id);
    let receiptExists = false;
    try { fs.lstatSync(receiptPath); receiptExists = true; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    if (hasPending() || receiptExists) throw new Error('Directory receipt identity already exists');
    try {
      atomicWriteFile(pending, JSON.stringify({ owner: this.id, id }), { mode: 0o600, durable: true });
      assertOwner();
      this.append(event, undefined, directoryBackupJournalToken);
      assertOwner();
      const stat = fs.lstatSync(this.file), opened = fs.fstatSync(this.fd);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.dev !== opened.dev || stat.ino !== opened.ino) throw new Error('Directory backup journal replaced');
      const journal = fs.readFileSync(this.file);
      if (!journal.length || journal.at(-1) !== 10 || JSON.stringify(journal.toString('utf8').trimEnd().split('\n').map(line => JSON.parse(line))) !== JSON.stringify(this.events))
        throw new Error('Directory backup journal changed');
      const receipt = { owner: this.id, id, witness: Session.notificationDigest(event), ...('sha256' in event ? { sidecar: event.sha256 } : {}),
        journal: { bytes: journal.length, sha256: createHash('sha256').update(journal).digest('hex') } };
      assertOwner();
      atomicWriteFile(receiptPath, JSON.stringify(receipt), { mode: 0o600, durable: true });
      assertOwner();
      fs.unlinkSync(pending);
      syncDirectory(path.dirname(pending));
      assertOwner();
      if (!((snapshot || recovery || missing) ? this.inspectDirectorySnapshot(event) : this.inspectDirectoryEvidence(kind, id).state.kind === 'valid'))
        throw new Error('Directory backup receipt validation failed');
      assertOwner();
    } catch (error) {
      // The existing journal FD can retain failure even when creating a pending
      // marker and renaming the receipt both fail. Never append after a torn write.
      try {
        if (!this.closed && !this.journalFailed && this.events.some(row => row.kind === kind && 'id' in row && row.id === id)) {
          this.assertDirectoryBackupLock();
          const named = fs.lstatSync(this.file), opened = fs.fstatSync(this.fd), journal = fs.readFileSync(this.file);
          if (!named.isFile() || named.isSymbolicLink() || named.dev !== opened.dev || named.ino !== opened.ino ||
              journal.at(-1) !== 10 || JSON.stringify(journal.toString('utf8').trimEnd().split('\n').map(line => JSON.parse(line))) !== JSON.stringify(this.events))
            throw new Error('Directory backup failure journal changed');
          this.append({ kind: snapshot || recovery ? 'directory_snapshot_failed' : 'directory_backup_failed', id, owner: this.id,
            witness: Session.notificationDigest(event) }, undefined, directoryBackupJournalToken);
        }
      } catch { /* Keep the original error and attempt the filesystem fences below. */ }
      this.journalFailed = true;
      // Retain a pending fence if failure followed publication or marker removal.
      try {
        if (!hasPending()) {
          const fd = fs.openSync(pending, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o600);
          try { Session.writeAll(fd, Buffer.from(JSON.stringify({ owner: this.id, id }))); fs.fsyncSync(fd); }
          finally { fs.closeSync(fd); }
          syncDirectory(path.dirname(pending));
        }
      } catch {
        // If the pending fence cannot be restored, keep receipt bytes under an
        // unconfirmed name so a cold reader will not accept the published name.
        try {
          fs.renameSync(receiptPath, `${this.file}.${kind === 'directory_backup' || missing ? 'backup' : 'snapshot'}-unconfirmed-receipt-${id}-${randomUUID()}`);
          syncDirectory(path.dirname(this.file));
        } catch { /* Preserve the original transaction failure. */ }
      }
      throw error;
    }
  }

  private hashDirectoryBackup(fd: number, bytes: number, capture = false): string | Buffer {
    const hash = createHash('sha256'), buffer = Buffer.allocUnsafe(64 * 1024), parts: Buffer[] = [];
    for (let position = 0; position < bytes;) {
      const count = fs.readSync(fd, buffer, 0, Math.min(buffer.length, bytes - position), position);
      if (count <= 0) throw new Error('Directory backup short read');
      const part = buffer.subarray(0, count);
      hash.update(part);
      if (capture) parts.push(Buffer.from(part));
      position += count;
    }
    return capture ? Buffer.concat(parts, bytes) : hash.digest('hex');
  }

  private hasUnresolvedDirectoryHistoryTorn(): boolean {
    return hasUnresolvedDirectoryHistoryTorn(this);
  }

  private inspectDirectoryEvidence(kind: DirectoryEvidenceEvent['kind'], id: string, capture = false): { state: DirectoryEvidence; bytes?: Buffer } {
    const unknown: DirectoryEvidence = { kind: 'unknown', id }, descriptors: number[] = [];
    try {
      if (this.closed || this.journalFailed || !z.string().uuid().safeParse(id).success) return { state: unknown };
      this.assertDirectoryBackupLock();
      if (this.hasDirectoryEvidencePending(kind, id)) return { state: unknown };
      if (this.events.some(row => row.kind === 'directory_backup_failed' && row.id === id)) return { state: unknown };
      const rows = this.events.filter((row): row is DirectoryEvidenceEvent =>
        (row.kind === 'directory_backup' || row.kind === 'directory_snapshot_file') && row.id === id);
      const event = rows[0];
      if (rows.length !== 1 || !event || event.kind !== kind || event.owner !== this.id || BigInt(event.source.begin.size) !== BigInt(event.bytes) ||
          JSON.stringify(event.source.begin) !== JSON.stringify(event.source.end) ||
          Number(event.source.begin.mtimeNanoseconds) >= 1e9 || Number(event.source.begin.ctimeNanoseconds) >= 1e9 ||
          !path.isAbsolute(event.grant.root) || path.resolve(event.grant.root) !== event.grant.root ||
          !path.isAbsolute(event.lexicalPath) || path.resolve(event.lexicalPath) !== event.lexicalPath) return { state: unknown };
      const relative = path.relative(event.grant.root, event.lexicalPath);
      if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return { state: unknown };
      const earlier = this.events.slice(0, this.events.indexOf(event));
      if (event.kind === 'directory_backup') {
        if (!earlier.some(row => row.kind === 'tool_start' && row.id === event.toolUseId && row.name === 'write_file') ||
            (event.messageContext && JSON.stringify(event.messageContext) !== JSON.stringify(this.directoryBackupMessageContext(event.toolUseId, this.events.indexOf(event)))))
          return { state: unknown };
      } else {
        const intents = earlier.filter((row): row is DirectorySnapshotIntentEvent => row.kind === 'directory_snapshot_intent' && row.id === event.snapshotId);
        const intent = intents[0];
        const paths = intent?.paths.filter(item => item.trackingPath === event.trackingPath && item.lexicalPath === event.lexicalPath &&
          item.grant.root === event.grant.root && item.grant.dev === event.grant.dev && item.grant.ino === event.grant.ino);
        if (intents.length !== 1 || !intent || intent.owner !== this.id || intent.messageId !== event.messageId || paths?.length !== 1 ||
            earlier.filter(row => row.kind === 'message' && row.messageId === event.messageId && row.message.role === 'user' && !row.isMeta).length !== 1)
          return { state: unknown };
      }
      if (this.hasUnresolvedDirectoryHistoryTorn()) return { state: unknown };
      const open = (file: string) => {
        const named = fs.lstatSync(file, { bigint: true });
        if (!named.isFile() || named.isSymbolicLink()) throw new Error('Invalid directory backup evidence');
        const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
        descriptors.push(fd);
        const stat = fs.fstatSync(fd, { bigint: true });
        if (!stat.isFile() || stat.dev !== named.dev || stat.ino !== named.ino || (stat.mode & 0o777n) !== 0o600n) throw new Error('Directory backup evidence replaced');
        return { fd, stat };
      };
      const sidecarPath = this.directoryEvidencePath(kind, id), receiptPath = this.directoryEvidenceReceiptPath(kind, id);
      const sidecar = open(sidecarPath), receiptFile = open(receiptPath);
      if (String(sidecar.stat.dev) !== event.sidecar.dev || String(sidecar.stat.ino) !== event.sidecar.ino ||
          String(sidecar.stat.uid) !== event.sidecar.uid || sidecar.stat.size !== BigInt(event.bytes) || receiptFile.stat.size > 4096n)
        return { state: unknown };
      const receiptBytes = fs.readFileSync(receiptFile.fd), receipt = directoryBackupReceiptSchema.parse(JSON.parse(receiptBytes.toString('utf8')));
      if (receipt.owner !== this.id || receipt.id !== id || receipt.witness !== Session.notificationDigest(event) || receipt.sidecar !== event.sha256 ||
          this.hashDirectoryBackup(sidecar.fd, event.bytes) !== event.sha256) return { state: unknown };
      const journalStat = fs.lstatSync(this.file), openedJournal = fs.fstatSync(this.fd);
      if (!journalStat.isFile() || journalStat.isSymbolicLink() || journalStat.dev !== openedJournal.dev || journalStat.ino !== openedJournal.ino) return { state: unknown };
      const journal = fs.readFileSync(this.file), prefix = journal.subarray(0, receipt.journal.bytes);
      if (prefix.length !== receipt.journal.bytes || prefix.at(-1) !== 10 || createHash('sha256').update(prefix).digest('hex') !== receipt.journal.sha256 ||
          JSON.stringify(JSON.parse(prefix.toString('utf8').trimEnd().split('\n').at(-1)!)) !== JSON.stringify(event) ||
          JSON.stringify(journal.toString('utf8').trimEnd().split('\n').map(line => JSON.parse(line))) !== JSON.stringify(this.events)) return { state: unknown };
      fs.fsyncSync(this.fd);
      fs.fsyncSync(sidecar.fd);
      fs.fsyncSync(receiptFile.fd);
      syncDirectory(path.dirname(path.dirname(this.file)));
      syncDirectory(path.dirname(this.file));
      const afterJournal = fs.lstatSync(this.file);
      if (!afterJournal.isFile() || afterJournal.isSymbolicLink() || afterJournal.dev !== openedJournal.dev || afterJournal.ino !== openedJournal.ino ||
          !fs.readFileSync(this.file).equals(journal)) return { state: unknown };
      for (const [file, descriptor] of [[sidecarPath, sidecar], [receiptPath, receiptFile]] as const) {
        const named = fs.lstatSync(file, { bigint: true }), opened = fs.fstatSync(descriptor.fd, { bigint: true });
        if (!named.isFile() || named.isSymbolicLink() || named.dev !== opened.dev || named.ino !== opened.ino ||
            opened.dev !== descriptor.stat.dev || opened.ino !== descriptor.stat.ino || opened.size !== descriptor.stat.size ||
            opened.mtimeNs !== descriptor.stat.mtimeNs || opened.ctimeNs !== descriptor.stat.ctimeNs || (opened.mode & 0o777n) !== 0o600n) return { state: unknown };
      }
      if (!fs.readFileSync(receiptPath).equals(receiptBytes) || this.hashDirectoryBackup(sidecar.fd, event.bytes) !== event.sha256) return { state: unknown };
      const bytes = capture ? this.hashDirectoryBackup(sidecar.fd, event.bytes, true) : undefined;
      if (bytes && (!Buffer.isBuffer(bytes) || createHash('sha256').update(bytes).digest('hex') !== event.sha256)) return { state: unknown };
      if (this.hasUnresolvedDirectoryHistoryTorn()) return { state: unknown };
      this.assertDirectoryBackupLock();
      return { state: { kind: 'valid', id, witness: structuredClone(event), sidecar: sidecarPath }, ...(Buffer.isBuffer(bytes) ? { bytes } : {}) };
    } catch { return { state: unknown }; }
    finally { for (const fd of descriptors) fs.closeSync(fd); }
  }

  private inspectDirectoryBackup(id: string, capture = false): { state: DirectoryBackup; bytes?: Buffer } {
    const result = this.inspectDirectoryEvidence('directory_backup', id, capture);
    if (result.state.kind === 'valid' && result.state.witness.kind !== 'directory_backup') return { state: { kind: 'unknown', id } };
    if (result.state.kind === 'valid' && result.state.witness.kind === 'directory_backup')
      return { state: { ...result.state, witness: result.state.witness }, ...(result.bytes ? { bytes: result.bytes } : {}) };
    return { state: { kind: 'unknown', id } };
  }

  get directoryBackups(): DirectoryBackup[] {
    const prefix = `${path.basename(this.file)}.backup-unknown-`, ids = new Set<string>();
    for (const event of this.events) if (event.kind === 'directory_backup') ids.add(event.id);
    for (const name of fs.readdirSync(path.dirname(this.file))) if (name.startsWith(prefix)) {
      const id = name.slice(prefix.length);
      if (z.string().uuid().safeParse(id).success) ids.add(id);
    }
    return [...ids].map(id => this.inspectDirectoryBackup(id).state);
  }

  readDirectoryBackup(id: string): Buffer | undefined { return this.inspectDirectoryBackup(id, true).bytes; }

  private directorySnapshotReceiptPath(id: string): string { return `${this.file}.snapshot-commit-receipt-${id}`; }
  private directorySnapshotPendingPath(id: string): string { return `${this.file}.snapshot-commit-pending-${id}`; }
  private directorySnapshotRecoveryReceiptPath(id: string): string { return `${this.file}.snapshot-recovery-receipt-${id}`; }
  private directorySnapshotRecoveryPendingPath(id: string): string { return `${this.file}.snapshot-recovery-pending-${id}`; }
  private directoryMissingBackupReceiptPath(id: string): string { return `${this.file}.missing-backup-receipt-${id}`; }
  private directoryMissingBackupPendingPath(id: string): string { return `${this.file}.missing-backup-pending-${id}`; }
  private hasDirectorySnapshotPending(id: string): boolean {
    try { fs.lstatSync(this.directorySnapshotPendingPath(id)); return true; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
  }
  private hasDirectorySnapshotRecoveryPending(id: string): boolean {
    try { fs.lstatSync(this.directorySnapshotRecoveryPendingPath(id)); return true; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
  }
  private hasDirectoryMissingBackupPending(id: string): boolean {
    try { fs.lstatSync(this.directoryMissingBackupPendingPath(id)); return true; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
  }

  private inspectDirectorySnapshot(event: DirectorySnapshotEvent | DirectorySnapshotRecoveryEvent | DirectoryMissingBackupEvent): boolean {
    let fd: number | undefined;
    try {
      this.assertDirectoryBackupLock();
      if (event.owner !== this.id) return false;
      if (event.kind === 'directory_missing_backup') {
        const index = this.events.findIndex(row => row.kind === 'directory_missing_backup' && row.id === event.id);
        const relative = path.relative(event.grant.root, event.lexicalPath);
        const start = this.events.slice(0, index).findLast(row => row.kind === 'tool_start' && row.id === event.toolUseId);
        if (index < 0 || JSON.stringify(this.events[index]) !== JSON.stringify(event) ||
            this.events.filter(row => row.kind === 'directory_missing_backup' && row.id === event.id).length !== 1 ||
            !path.isAbsolute(event.grant.root) || path.resolve(event.grant.root) !== event.grant.root ||
            !path.isAbsolute(event.lexicalPath) || path.resolve(event.lexicalPath) !== event.lexicalPath || !relative ||
            relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) ||
            JSON.stringify(event.messageContext) !== JSON.stringify(this.directoryBackupMessageContext(event.toolUseId, index)) ||
            !start || start.kind !== 'tool_start' || start.name !== 'write_file' || start.parentMessageId !== event.messageContext.parentMessageId ||
            start.writeInputDigest !== directoryWriteFingerprint({ lexicalPath: event.lexicalPath, ...event.writeInput })) return false;
      }
      if ((event.kind === 'directory_snapshot' ? this.hasDirectorySnapshotPending(event.id) : event.kind === 'directory_snapshot_recovery' ?
          this.hasDirectorySnapshotRecoveryPending(event.id) : this.hasDirectoryMissingBackupPending(event.id)) ||
          this.events.some(row => (row.kind === 'directory_backup_failed' || row.kind === 'directory_snapshot_failed') &&
            (event.kind === 'directory_missing_backup' ? row.kind === 'directory_backup_failed' : row.kind === 'directory_snapshot_failed') &&
            row.id === event.id && row.witness === Session.notificationDigest(event)) ||
          this.hasUnresolvedDirectoryHistoryTorn()) return false;
      const file = event.kind === 'directory_snapshot' ? this.directorySnapshotReceiptPath(event.id) : event.kind === 'directory_snapshot_recovery' ?
        this.directorySnapshotRecoveryReceiptPath(event.id) : this.directoryMissingBackupReceiptPath(event.id);
      const named = fs.lstatSync(file, { bigint: true });
      fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
      const opened = fs.fstatSync(fd, { bigint: true });
      if (!named.isFile() || named.isSymbolicLink() || !opened.isFile() || named.dev !== opened.dev || named.ino !== opened.ino ||
          (opened.mode & 0o777n) !== 0o600n || opened.size > 4096n) return false;
      const receiptBytes = fs.readFileSync(fd), receipt = directorySnapshotReceiptSchema.parse(JSON.parse(receiptBytes.toString('utf8')));
      const journalStat = fs.lstatSync(this.file), journalFd = fs.fstatSync(this.fd);
      if (receipt.owner !== this.id || receipt.id !== event.id || receipt.witness !== Session.notificationDigest(event) ||
          !journalStat.isFile() || journalStat.isSymbolicLink() || journalStat.dev !== journalFd.dev || journalStat.ino !== journalFd.ino) return false;
      const journal = fs.readFileSync(this.file), prefix = journal.subarray(0, receipt.journal.bytes);
      if (prefix.length !== receipt.journal.bytes || prefix.at(-1) !== 10 || createHash('sha256').update(prefix).digest('hex') !== receipt.journal.sha256 ||
          JSON.stringify(JSON.parse(prefix.toString('utf8').trimEnd().split('\n').at(-1)!)) !== JSON.stringify(event) ||
          JSON.stringify(journal.toString('utf8').trimEnd().split('\n').map(line => JSON.parse(line))) !== JSON.stringify(this.events)) return false;
      fs.fsyncSync(this.fd); fs.fsyncSync(fd);
      syncDirectory(path.dirname(path.dirname(this.file))); syncDirectory(path.dirname(this.file));
      const after = fs.lstatSync(file, { bigint: true }), afterJournal = fs.lstatSync(this.file);
      if (!after.isFile() || after.isSymbolicLink() || after.dev !== opened.dev || after.ino !== opened.ino ||
          after.size !== opened.size || after.mtimeNs !== opened.mtimeNs || after.ctimeNs !== opened.ctimeNs ||
          !afterJournal.isFile() || afterJournal.isSymbolicLink() || afterJournal.dev !== journalFd.dev || afterJournal.ino !== journalFd.ino ||
          !fs.readFileSync(file).equals(receiptBytes) || !fs.readFileSync(this.file).equals(journal)) return false;
      if (this.hasUnresolvedDirectoryHistoryTorn()) return false;
      this.assertDirectoryBackupLock();
      return true;
    } catch { return false; }
    finally { if (fd !== undefined) fs.closeSync(fd); }
  }

  // rhe/Fet/Tke, sfn1dbxq [4728518,4730433)/[4731316,4733481), UTF-16;
  // the host journal and receipts replace the source's pathname persistence.
  private reconstructDirectoryFileHistory(limit = this.events.length): DirectoryHistoryState {
    if (this.closed || this.journalFailed) throw new Error('Directory history unavailable');
    this.assertDirectoryBackupLock();
    let state = emptyDirectoryFileHistory(), started = false, pendingUser: string | undefined, latestUser: string | undefined, latestDisabled = false;
    let pending: { intent: DirectorySnapshotIntentEvent; observations: Map<string, DirectorySnapshotObservationEvent>; unconfirmed?: DirectorySnapshotEvent } | undefined;
    const ids = new Set<string>(), messages = new Set<string>();
    for (const row of this.events.slice(0, limit)) {
      if (row.kind === 'message' && row.message.role === 'user' && !row.isMeta && row.messageId) {
        if (messages.has(row.messageId) || pending || pendingUser) throw new Error('Directory history message mismatch');
        messages.add(row.messageId);
        latestUser = row.messageId;
        latestDisabled = row.directoryHistoryDisabled === true;
        if (started && !latestDisabled) pendingUser = row.messageId;
      } else if (row.kind === 'directory_snapshot_intent') {
        if (pending || ids.has(row.id) || row.owner !== this.id || latestDisabled || row.messageId !== latestUser || !messages.has(row.messageId) ||
            (started && row.messageId !== pendingUser) ||
            JSON.stringify(row.paths) !== JSON.stringify([...state.trackedFiles.values()])) throw new Error('Directory history intent mismatch');
        ids.add(row.id); started = true; pendingUser = row.messageId;
        pending = { intent: row, observations: new Map() };
      } else if (row.kind === 'directory_snapshot_observation') {
        if (!pending || pending.unconfirmed || row.owner !== this.id || row.snapshotId !== pending.intent.id || pending.observations.has(row.entry.path.trackingPath) ||
            !pending.intent.paths.some(item => JSON.stringify(item) === JSON.stringify(row.entry.path))) throw new Error('Directory history observation mismatch');
        pending.observations.set(row.entry.path.trackingPath, row);
      } else if (row.kind === 'directory_snapshot') {
        if (!pending || pending.unconfirmed || row.owner !== this.id || row.id !== pending.intent.id || row.messageId !== pending.intent.messageId ||
            row.timestamp !== pending.intent.timestamp) throw new Error('Directory history snapshot mismatch');
        if (!this.inspectDirectorySnapshot(row)) { pending.unconfirmed = row; continue; }
        if (row.entries.length !== pending.intent.paths.length || (!row.interrupted && pending.observations.size !== pending.intent.paths.length))
          throw new Error('Directory history snapshot mismatch');
        if (new Set(row.entries.map(entry => entry.path.trackingPath)).size !== row.entries.length) throw new Error('Duplicate directory history entry');
        for (const entry of row.entries) {
          const observed = pending.observations.get(entry.path.trackingPath), previous = state.snapshots.at(-1)?.entries.find(item => item.path.trackingPath === entry.path.trackingPath);
          if (!previous || !pending.intent.paths.some(target => JSON.stringify(target) === JSON.stringify(entry.path)) ||
              (!row.interrupted && (!observed || JSON.stringify(observed.entry) !== JSON.stringify(entry)))) throw new Error('Directory history entry mismatch');
          if (row.interrupted) {
            if (entry.reference.kind !== 'unknown' || entry.reference.reason !== 'interrupted' ||
                entry.reference.lastKnownVersion !== nextDirectoryHistoryVersion(state, entry.path.trackingPath) - 1) throw new Error('Directory history interruption mismatch');
            continue;
          }
          if (JSON.stringify(entry.reference) === JSON.stringify(previous.reference)) continue;
          const reference = entry.reference;
          if (reference.kind === 'unknown') {
            if (reference.lastKnownVersion !== nextDirectoryHistoryVersion(state, entry.path.trackingPath) - 1) throw new Error('Directory history version mismatch');
          } else if (reference.version !== nextDirectoryHistoryVersion(state, entry.path.trackingPath)) throw new Error('Directory history version mismatch');
          if (reference.kind === 'present') {
            if (reference.origin !== 'snapshot') throw new Error('Directory history backup origin mismatch');
            const evidence = this.inspectDirectoryEvidence('directory_snapshot_file', reference.backupId).state;
            if (evidence.kind !== 'valid' || evidence.witness.kind !== 'directory_snapshot_file' || evidence.witness.snapshotId !== row.id ||
                evidence.witness.trackingPath !== entry.path.trackingPath) throw new Error('Directory history backup mismatch');
          }
        }
        state = reduceDirectoryFileHistory(state, { kind: 'snapshot', snapshot: { messageId: row.messageId, timestamp: row.timestamp,
          entries: row.entries, ...(row.preCheckpoint ? { preCheckpoint: true } : {}) } });
        pending = undefined; pendingUser = undefined;
      } else if (row.kind === 'directory_snapshot_recovery') {
        if (!pending || row.owner !== this.id || row.id !== pending.intent.id || row.messageId !== pending.intent.messageId ||
            row.timestamp !== pending.intent.timestamp || row.unconfirmed !== (pending.unconfirmed ? Session.notificationDigest(pending.unconfirmed) : null) ||
            row.entries.length !== pending.intent.paths.length || new Set(row.entries.map(entry => entry.path.trackingPath)).size !== row.entries.length ||
            !this.inspectDirectorySnapshot(row)) throw new Error('Directory history recovery mismatch');
        for (const entry of row.entries) {
          if (!pending.intent.paths.some(target => JSON.stringify(target) === JSON.stringify(entry.path)) || entry.reference.kind !== 'unknown' ||
              entry.reference.reason !== 'interrupted' ||
              entry.reference.lastKnownVersion !== nextDirectoryHistoryVersion(state, entry.path.trackingPath) - 1) throw new Error('Directory history recovery entry mismatch');
        }
        state = reduceDirectoryFileHistory(state, { kind: 'snapshot', snapshot: { messageId: row.messageId, timestamp: row.timestamp, entries: row.entries } });
        pending = undefined; pendingUser = undefined;
      } else if ((row.kind === 'directory_backup' || row.kind === 'directory_missing_backup') && row.messageContext && started && !pending && !pendingUser &&
          state.snapshots.at(-1)?.messageId === row.messageContext.userMessageId) {
        const trackingPath = directoryHistoryTrackingPath(this.config.workspace, row.lexicalPath);
        if (!shouldTrackDirectoryHistory(state, trackingPath)) continue;
        const pathInfo: DirectoryHistoryPath = { trackingPath, lexicalPath: row.lexicalPath,
          grant: { root: row.grant.root, dev: row.grant.dev, ino: row.grant.ino } };
        const reference: DirectoryHistoryEntry['reference'] = row.kind === 'directory_missing_backup'
          ? this.inspectDirectorySnapshot(row) ? { kind: 'missing', parent: row.parent, version: 1 } : { kind: 'unknown', lastKnownVersion: 0, reason: 'corrupt' }
          : this.inspectDirectoryBackup(row.id).state.kind === 'valid' && boundDirectoryFileObservationSchema.safeParse(row.source.begin).success
            ? { kind: 'present', origin: 'tool', backupId: row.id, version: 1 } : { kind: 'unknown', lastKnownVersion: 0, reason: 'corrupt' };
        state = reduceDirectoryFileHistory(state, { kind: 'track', snapshotMessageId: row.messageContext.userMessageId,
          entry: { path: pathInfo, reference } });
      }
    }
    if (pending || pendingUser) throw new Error('Directory history snapshot incomplete');
    return state;
  }

  get directoryFileHistory(): DirectoryFileHistory {
    try {
      if (this.hasUnresolvedDirectoryHistoryTorn()) return { kind: 'unknown' };
      return { kind: 'available', snapshots: structuredClone(this.reconstructDirectoryFileHistory().snapshots) };
    }
    catch { return { kind: 'unknown' }; }
  }

  // Host checkpoint witness for Fet/Tke, sfn1dbxq [4731316,4733481), UTF-16; branch paths do not transfer grants.
  directoryCheckpointPathsAt(limit: number): DirectoryCheckpointPaths {
    try {
      if (!Number.isSafeInteger(limit) || limit < 0 || limit > this.events.length) return { kind: 'unknown' };
      const branch = this.events.slice(0, limit).findLast(event => event.kind === 'branch');
      let inherited: DirectoryHistoryPath[] = [];
      if (branch?.kind === 'branch') {
        if (!branch.external || branch.external.kind === 'unknown' || branch.checkpointPaths?.kind === 'unknown') return { kind: 'unknown' };
        if (!branch.checkpointPaths && branch.external.kind !== 'none') return { kind: 'unknown' };
        inherited = branch.checkpointPaths?.kind === 'available' ? branch.checkpointPaths.paths : [];
        if (branch.external.kind === 'none' && inherited.length) return { kind: 'unknown' };
        if (branch.external.kind === 'unavailable' && branch.external.paths.some(file => !inherited.some(item => item.lexicalPath === file)))
          return { kind: 'unknown' };
      }
      const paths = new Map<string, DirectoryHistoryPath>(), lexical = new Map<string, string>();
      for (const item of [...inherited, ...this.reconstructDirectoryFileHistory(limit).trackedFiles.values()]) {
        const previous = paths.get(item.trackingPath), key = lexical.get(item.lexicalPath);
        if ((previous && !isDeepStrictEqual(previous, item)) || (key !== undefined && key !== item.trackingPath)) return { kind: 'unknown' };
        paths.set(item.trackingPath, item); lexical.set(item.lexicalPath, item.trackingPath);
      }
      if (paths.size > 4096) return { kind: 'unknown' };
      return { kind: 'available', paths: structuredClone([...paths.values()]) };
    } catch { return { kind: 'unknown' }; }
  }

  // Host branch witness for Fet/Tke and gft/kHs, sfn1dbxq [4731316,4733481),
  // 24k7d6mw [38766,45161)/[45367,46476), UTF-16; source has no owner-bound path row.
  appendCheckpointBranch(source: Session, input: { boundary: number; reason: CheckpointBranch['reason'];
    expected?: { external: DirectoryRewindExternal; checkpointPaths: DirectoryCheckpointPaths } }): void {
    if (source === this || !source.isOpen || source.isJournalFenced || !this.isOpen || this.isJournalFenced)
      throw new Error('Directory checkpoint branch authorization invalid');
    source.assertDirectoryBackupLock(); this.assertDirectoryBackupLock();
    let journal: Buffer | undefined, external: DirectoryRewindExternal = { kind: 'unknown' }, checkpointPaths: DirectoryCheckpointPaths = { kind: 'unknown' };
    try {
      journal = source.checkpointJournalBytes();
      external = source.rewindExternalState;
      checkpointPaths = source.directoryCheckpointPathsAt(source.events.length);
      if (!source.checkpointJournalBytes().equals(journal)) throw new Error('Source checkpoint journal changed');
    } catch {
      journal = undefined; external = { kind: 'unknown' }; checkpointPaths = { kind: 'unknown' };
    }
    if (input.expected && (!isDeepStrictEqual(input.expected.external, external) || !isDeepStrictEqual(input.expected.checkpointPaths, checkpointPaths)))
      throw new Error('Directory checkpoint branch state changed');
    const event: CheckpointBranch = { kind: 'branch', source: source.id, workspace: source.config.workspace,
      boundary: input.boundary, reason: input.reason, external, checkpointPaths };
    const token = Symbol('directory checkpoint branch');
    checkpointBranchAuthorizations.set(token, { source, target: this, event: structuredClone(event), journal });
    try { this.append(event, undefined, token); }
    finally { checkpointBranchAuthorizations.delete(token); }
  }

  // Host inheritance for Fet/Tke/Cwt and kHs, sfn1dbxq [4731316,4733481)/[4734814,4735645),
  // 24k7d6mw [45367,46476), UTF-16; the source has no cross-Session checkpoint receipt.
  inheritCheckpointWitnesses(source: Session): void {
    if (source === this || !source.isOpen || source.isJournalFenced || !this.isOpen || this.isJournalFenced)
      throw new Error('Directory checkpoint inheritance authorization invalid');
    const branch = this.events.at(-1);
    if (!branch || branch.kind !== 'branch' || !branch.checkpointPaths || branch.source !== source.id || branch.workspace !== source.config.workspace)
      throw new Error('Directory checkpoint inheritance branch mismatch');
    let sourceJournal: Buffer, targetJournal: Buffer, references: DirectoryCheckpointInheritanceEvent['references'];
    try {
      sourceJournal = source.checkpointJournalBytes(); targetJournal = this.checkpointJournalBytes();
      references = this.directoryCheckpointPathsAt(this.events.length).kind === 'available' ? collectDirectoryCheckpointReferences(source, this) : [];
      const currentSource = source.checkpointJournalBytes(), currentTarget = this.checkpointJournalBytes();
      if (!references.length || !currentSource.equals(sourceJournal) || !currentTarget.equals(targetJournal)) return;
    } catch (error) {
      if (!source.isOpen || source.isJournalFenced || !this.isOpen || this.isJournalFenced) throw error;
      source.assertDirectoryBackupLock(); this.assertDirectoryBackupLock();
      return;
    }
    const event = directoryCheckpointInheritanceSchema.parse({ kind: 'directory_checkpoint_inheritance', owner: this.id, source: source.id,
      branch: createHash('sha256').update(JSON.stringify(branch)).digest('hex'), references });
    if (Buffer.byteLength(JSON.stringify(event)) > 8 * 1024 * 1024) return;
    const token = Symbol('directory checkpoint inheritance');
    checkpointInheritanceAuthorizations.set(token, { source, target: this, event: structuredClone(event), sourceJournal, targetJournal });
    try { this.append(event, undefined, token); }
    finally { checkpointInheritanceAuthorizations.delete(token); }
  }

  // Host recovered-reference fact for Ole/Fet/Tke, sfn1dbxq [4694145,4697475)/[4731316,4733481), UTF-16;
  // the incomplete row remains evidence and is not represented as committed.
  reconcileTornCheckpointInheritance(source: Session): { kind: 'unknown' } | { kind: 'reconciled' } {
    const unknown = { kind: 'unknown' } as const;
    if (source === this || !source.isOpen || source.isJournalFenced || !this.isOpen || this.isJournalFenced ||
        source.config.workspace !== this.config.workspace) return unknown;
    const verified = (candidate: DirectoryCheckpointInheritanceEvent) => candidate.source === source.id &&
      inspectDirectoryCheckpointTornRecovery(this, candidate);
    const previous = this.events[checkpointRecoveryAnchor(this.events, this.events.length)];
    if (previous?.kind === 'directory_checkpoint_torn_recovery') {
      try { source.checkpointGateIdentity(); this.checkpointGateIdentity(); return verified(previous.candidate) ? { kind: 'reconciled' } : unknown; }
      catch { return unknown; }
    }
    let event: DirectoryCheckpointTornRecoveryEvent, sourceJournal: Buffer, targetJournal: Buffer, evidence: Buffer;
    try {
      const branch = this.events[checkpointRecoveryAnchor(this.events, this.events.length)];
      if (!branch || branch.kind !== 'branch' || !branch.checkpointPaths || branch.source !== source.id || branch.workspace !== source.config.workspace)
        return unknown;
      sourceJournal = source.checkpointJournalBytes(); targetJournal = this.checkpointJournalBytes();
      const torn = readTornCheckpointEvidence(this);
      if (!torn || this.directoryCheckpointPathsAt(this.events.length).kind !== 'available') return unknown;
      const references = collectDirectoryCheckpointReferences(source, this);
      if (!references.length || references.some(reference => reference.origin.workspace !== source.config.workspace)) return unknown;
      const candidate = directoryCheckpointInheritanceSchema.parse({ kind: 'directory_checkpoint_inheritance', owner: this.id, source: source.id,
        branch: createHash('sha256').update(JSON.stringify(branch)).digest('hex'), references });
      const branchPrefix = checkpointRecoveryPrefix(this.events, targetJournal, this.events.length);
      if (!branchPrefix || !matchesTornCheckpointInheritance(branchPrefix.bytes, candidate, torn.bytes)) return unknown;
      evidence = torn.bytes;
      event = directoryCheckpointTornRecoverySchema.parse({ kind: 'directory_checkpoint_torn_recovery', candidate,
        evidence: { id: torn.id, sha256: createHash('sha256').update(evidence).digest('hex') },
        sourceJournal: { bytes: sourceJournal.length, sha256: createHash('sha256').update(sourceJournal).digest('hex'), events: source.events.length },
        targetJournal: { bytes: targetJournal.length, sha256: createHash('sha256').update(targetJournal).digest('hex'), events: this.events.length },
        sourceLock: source.checkpointLockWitness() });
      if (Buffer.byteLength(JSON.stringify(event)) > 8 * 1024 * 1024 || !verifyDirectoryCheckpointTornCandidate(this, event)) return unknown;
    } catch {
      if (!source.isOpen || source.isJournalFenced || !this.isOpen || this.isJournalFenced) throw new Error('Torn checkpoint recovery owner unavailable');
      source.assertDirectoryBackupLock(); this.assertDirectoryBackupLock();
      return unknown;
    }
    const token = Symbol('directory checkpoint torn recovery');
    checkpointTornRecoveryAuthorizations.set(token, { source, target: this, event: structuredClone(event), sourceJournal, targetJournal, evidence });
    try { this.append(event, undefined, token); }
    finally { checkpointTornRecoveryAuthorizations.delete(token); }
    return verified(event.candidate) ? { kind: 'reconciled' } : unknown;
  }

  // Host restart adaptation for Ole/Cwt/kHs, sfn1dbxq [4694145,4697475)/[4734814,4735645),
  // 24k7d6mw [45367,46476), UTF-16; the source has no host Session gates or torn receipts.
  async reconcileResumedCheckpointInheritance(options: { source?: Session; recoverLock?: boolean } = {}):
      Promise<{ kind: 'unknown' } | { kind: 'reconciled' } | { kind: 'reclaimed' }> {
    const unknown = { kind: 'unknown' } as const, head = this.events[checkpointRecoveryAnchor(this.events, this.events.length)];
    const last = head?.kind === 'branch' || head?.kind === 'directory_checkpoint_torn_recovery' ? head :
      this.events[completedCheckpointSnapshotAnchor(this.events, this.id)];
    if (!last || this.file !== path.join(this.config.workspace, '.agent', `${this.id}.jsonl`)) return unknown;
    if (last.kind === 'directory_checkpoint_torn_recovery') {
      if (!options.recoverLock || !last.sourceLock || last.candidate.source === this.id) return unknown;
    } else if (last.kind !== 'branch' || !last.checkpointPaths || last.source === this.id || last.workspace !== this.config.workspace) return unknown;
    const hasTornBranch = () => {
      if (last.kind !== 'branch') return false;
      const journal = this.checkpointJournalBytes(), torn = readTornCheckpointEvidence(this);
      const branchPrefix = checkpointRecoveryPrefix(this.events, journal, this.events.length);
      if (!torn || !branchPrefix || !torn.bytes.subarray(0, branchPrefix.bytes.length).equals(branchPrefix.bytes)) return false;
      const header = Buffer.from(JSON.stringify({ kind: 'directory_checkpoint_inheritance', owner: this.id, source: last.source,
        branch: createHash('sha256').update(JSON.stringify(last)).digest('hex'), references: [] }));
      const marker = Buffer.from('"references":['), end = header.indexOf(marker) + marker.length;
      return end >= marker.length && torn.bytes.length >= branchPrefix.bytes.length + end &&
        torn.bytes.subarray(branchPrefix.bytes.length, branchPrefix.bytes.length + end).equals(header.subarray(0, end));
    };
    let source: Session | undefined, owned = false, changed = false;
    try {
      if (last.kind === 'branch' && !hasTornBranch()) return unknown;
      return withIdleCheckpointStore(this.config.workspace, () => {
        if (last.kind === 'directory_checkpoint_torn_recovery') {
          if (!last.sourceLock || !isReconciledCheckpointTorn(this) || !inspectDirectoryCheckpointTornRecovery(this, last.candidate)) return unknown;
          source = Session.openInternal(this.config.workspace, { id: last.candidate.source, recoverLock: true }, undefined, true, last.sourceLock);
          owned = true; changed = true;
          source.checkpointGateIdentity(); this.checkpointGateIdentity();
          return inspectDirectoryCheckpointTornRecovery(this, last.candidate) ? { kind: 'reclaimed' } as const : unknown;
        }
        if (last.kind !== 'branch' || !hasTornBranch()) return unknown;
        if (options.source?.id === last.source && options.source.config.workspace === this.config.workspace) source = options.source;
        else {
          source = Session.openInternal(this.config.workspace, { id: last.source, recoverLock: options.recoverLock }, undefined, true);
          owned = true; changed = Boolean(options.recoverLock);
        }
        const previous = this.events.length;
        try { return this.reconcileTornCheckpointInheritance(source); }
        finally { changed ||= this.events.length !== previous; }
      }) ?? unknown;
    } catch (error) {
      if (changed || !this.isOpen || this.isJournalFenced) throw error;
      return unknown;
    } finally {
      if (owned && source) {
        await source.close();
        if (fs.existsSync(`${source.file}.lock`)) throw new Error('Checkpoint recovery source lock cleanup is unconfirmed');
      }
    }
  }

  checkpointJournalBytes(): Buffer {
    if (this.closed || this.journalFailed) throw new Error('Checkpoint journal unavailable');
    this.assertDirectoryBackupLock();
    const named = fs.lstatSync(this.file), opened = fs.fstatSync(this.fd);
    if (!named.isFile() || named.isSymbolicLink() || !opened.isFile() || opened.size > 100 * 1024 * 1024 || named.dev !== opened.dev || named.ino !== opened.ino)
      throw new Error('Checkpoint journal changed');
    const reader = fs.openSync(this.file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    try {
      const observed = fs.fstatSync(reader);
      if (!observed.isFile() || observed.dev !== opened.dev || observed.ino !== opened.ino || observed.size !== opened.size)
        throw new Error('Checkpoint journal reader changed');
      const bytes = Session.readJournalBytes(reader, observed.size);
      if (!bytes.length || bytes.at(-1) !== 10 ||
          JSON.stringify(bytes.toString('utf8').trimEnd().split('\n').map(line => JSON.parse(line))) !== JSON.stringify(this.events))
        throw new Error('Checkpoint journal content changed');
      fs.fsyncSync(this.fd);
      const after = fs.lstatSync(this.file), current = fs.fstatSync(this.fd), readAfter = fs.fstatSync(reader);
      if (!after.isFile() || after.isSymbolicLink() || after.dev !== opened.dev || after.ino !== opened.ino ||
          current.dev !== opened.dev || current.ino !== opened.ino || current.size !== opened.size || current.mtimeMs !== opened.mtimeMs ||
          current.ctimeMs !== opened.ctimeMs || readAfter.dev !== opened.dev || readAfter.ino !== opened.ino || readAfter.size !== opened.size ||
          !Session.readJournalBytes(reader, readAfter.size).equals(bytes)) throw new Error('Checkpoint journal changed during sync');
      this.assertDirectoryBackupLock();
      return bytes;
    } finally { fs.closeSync(reader); }
  }

  // Host receipt commitment for Tke/Cwt, sfn1dbxq [4732048,4733481)/[4734814,4735645), UTF-16.
  commitDirectoryCheckpointWitness(input: { id: string; name: string; witness: string }, authorization?: symbol): void {
    this.assertDirectoryBackupLock();
    const event = directoryCheckpointWitnessSchema.parse({ kind: 'directory_checkpoint_witness', owner: this.id, ...input });
    consumeDirectoryCheckpointAuthorization(this, input, authorization);
    const checkpoint = this.events.at(-1);
    if (!checkpoint || checkpoint.kind !== 'checkpoint' || checkpoint.name !== event.name ||
        this.events.some(row => row.kind === 'directory_checkpoint_witness' && (row.id === event.id || row.name === event.name)))
      throw new Error('Directory checkpoint witness identity mismatch');
    this.append(event, undefined, directoryBackupJournalToken);
    this.checkpointJournalBytes();
  }

  // Cwt/E$n, sfn1dbxq [4734814,4735645)/[4743506,4743628), UTF-16;
  // message snapshots and inherited branch uncertainty do not prove a workspace checkpoint.
  get rewindExternalState(): DirectoryRewindExternal {
    const branch = this.events.findLast(event => event.kind === 'branch');
    if (branch?.kind === 'branch' && (!branch.external || branch.external.kind === 'unknown')) return { kind: 'unknown' };
    const history = this.directoryFileHistory;
    if (history.kind === 'unknown') return { kind: 'unknown' };
    const paths = new Set(branch?.kind === 'branch' && branch.external?.kind === 'unavailable' ? branch.external.paths : []);
    for (const snapshot of history.snapshots) for (const entry of snapshot.entries) paths.add(entry.path.lexicalPath);
    return paths.size ? { kind: 'unavailable', paths: [...paths].sort() } : { kind: 'none' };
  }

  selectDirectoryRewindSnapshot(messageId: string): DirectoryRewindSelection {
    try { return structuredClone(selectDirectoryRewindSnapshot(this.reconstructDirectoryFileHistory(), messageId)); }
    catch { return { kind: 'unknown' }; }
  }

  readDirectoryHistoryBackup(id: string): { bytes: Buffer; observation: BoundDirectoryFileObservation } | undefined {
    try {
      const state = this.reconstructDirectoryFileHistory();
      const references = state.snapshots.flatMap(snapshot => snapshot.entries.map(entry => entry.reference))
        .filter(reference => reference.kind === 'present' && reference.backupId === id);
      const reference = references[0];
      if (!reference || reference.kind !== 'present' || references.some(item => item.kind !== 'present' || item.origin !== reference.origin)) return;
      const result = this.inspectDirectoryEvidence(reference.origin === 'tool' ? 'directory_backup' : 'directory_snapshot_file', id, true);
      if (result.state.kind !== 'valid' || !result.bytes) return;
      return { bytes: result.bytes, observation: boundDirectoryFileObservationSchema.parse(result.state.witness.source.begin) };
    } catch { return; }
  }

  private directoryPublicationPendingPath(id: string): string { return `${this.file}.publication-pending-${id}`; }
  private directoryPublicationReceiptPath(id: string): string { return `${this.file}.publication-receipt-${id}`; }
  private hasDirectoryPublicationPending(id: string): boolean {
    try { fs.lstatSync(this.directoryPublicationPendingPath(id)); return true; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
  }

  private inspectDirectoryPublication(id: string): DirectoryPublicationRecord {
    const unknown: DirectoryPublicationRecord = { kind: 'unknown', id };
    let receiptFd: number | undefined;
    try {
      if (this.closed || this.journalFailed || !z.string().uuid().safeParse(id).success || this.hasDirectoryPublicationPending(id) ||
          this.events.some(row => row.kind === 'directory_publication_failed' && row.id === id)) return unknown;
      this.assertDirectoryBackupLock();
      const intents = this.events.filter((row): row is DirectoryPublicationIntentEvent => row.kind === 'directory_publication_intent' && row.id === id);
      const results = this.events.filter((row): row is DirectoryPublicationResultEvent => row.kind === 'directory_publication_result' && row.id === id);
      const intent = intents[0], result = results[0];
      if (intents.length !== 1 || results.length !== 1 || !intent || !result || intent.owner !== this.id || result.owner !== this.id ||
          result.intent !== Session.notificationDigest(intent) || this.events.indexOf(result) <= this.events.indexOf(intent) ||
          JSON.stringify(intent.messageContext) !== JSON.stringify(this.directoryBackupMessageContext(intent.toolUseId, this.events.indexOf(intent)))) return unknown;
      const missing = 'kind' in intent.expected;
      if ((missing && (intent.overwrite === undefined || intent.strategy === 'retained')) || (!missing && intent.overwrite === false)) return unknown;
      const overwrite = intent.overwrite ?? true;
      const start = this.events.slice(0, this.events.indexOf(intent)).findLast(row => row.kind === 'tool_start' && row.id === intent.toolUseId);
      if (!start || start.kind !== 'tool_start' || start.name !== 'write_file' || start.parentMessageId !== intent.messageContext.parentMessageId ||
          start.writeInputDigest !== directoryWriteFingerprint({ lexicalPath: intent.lexicalPath, content: intent.content, overwrite })) return unknown;
      if (missing) {
        const backup = this.events.findLast(row => row.kind === 'directory_missing_backup' && row.id === intent.backupId);
        if (!backup || backup.kind !== 'directory_missing_backup' || !this.inspectDirectorySnapshot(backup) ||
            backup.toolUseId !== intent.toolUseId || backup.lexicalPath !== intent.lexicalPath ||
            JSON.stringify(backup.messageContext) !== JSON.stringify(intent.messageContext) || JSON.stringify(backup.grant) !== JSON.stringify(intent.grant) ||
            JSON.stringify(backup.parent) !== JSON.stringify(intent.expected.parent) || backup.createMode !== intent.expected.mode ||
            JSON.stringify(backup.writeInput) !== JSON.stringify({ content: intent.content, overwrite })) return unknown;
      } else {
        const backup = this.inspectDirectoryBackup(intent.backupId).state;
        if (backup.kind !== 'valid' || backup.witness.toolUseId !== intent.toolUseId || backup.witness.lexicalPath !== intent.lexicalPath ||
            JSON.stringify(backup.witness.messageContext) !== JSON.stringify(intent.messageContext) ||
            JSON.stringify(backup.witness.grant) !== JSON.stringify(intent.grant) || JSON.stringify(backup.witness.source.end) !== JSON.stringify(intent.expected)) return unknown;
      }
      const history = this.reconstructDirectoryFileHistory(this.events.indexOf(intent)), snapshot = history.snapshots.at(-1);
      if (!snapshot || snapshot.messageId !== intent.messageContext.userMessageId || !snapshot.entries.some(entry =>
        entry.path.lexicalPath === intent.lexicalPath && entry.path.grant.root === intent.grant.root && entry.path.grant.dev === intent.grant.dev &&
        entry.path.grant.ino === intent.grant.ino && (missing ? entry.reference.kind === 'missing' &&
          JSON.stringify(entry.reference.parent) === JSON.stringify(intent.expected.parent) : entry.reference.kind === 'present'))) return unknown;
      if (result.outcome.kind === 'durable' && (BigInt(result.outcome.observation.size) !== BigInt(intent.content.bytes) ||
          result.outcome.observation.mode !== intent.expected.mode || result.outcome.observation.nlink !== '1' ||
          Number(result.outcome.observation.mtimeNanoseconds) >= 1e9 || Number(result.outcome.observation.ctimeNanoseconds) >= 1e9 ||
          JSON.stringify(result.outcome.observation.parent) !== JSON.stringify(intent.expected.parent))) return unknown;
      if (result.outcome.kind === 'durable') {
        const held = result.outcome.retained?.held;
        if ((intent.strategy === 'retained') !== (held !== undefined)) return unknown;
        if (held && (missing || 'kind' in intent.expected || held.dev !== intent.expected.dev || held.ino !== intent.expected.ino ||
            held.size !== intent.expected.size || held.mode !== intent.expected.mode || held.nlink !== '1' ||
            held.mtimeSeconds !== intent.expected.mtimeSeconds || held.mtimeNanoseconds !== intent.expected.mtimeNanoseconds ||
            held.parent.dev !== intent.expected.parent.dev)) return unknown;
      }
      if (fs.readdirSync(path.dirname(this.file)).some(name => name.startsWith(`${path.basename(this.file)}.torn-`))) return unknown;
      const file = this.directoryPublicationReceiptPath(id), named = fs.lstatSync(file, { bigint: true });
      receiptFd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
      const opened = fs.fstatSync(receiptFd, { bigint: true });
      if (!named.isFile() || named.isSymbolicLink() || !opened.isFile() || named.dev !== opened.dev || named.ino !== opened.ino ||
          (opened.mode & 0o777n) !== 0o600n || opened.size > 4096n) return unknown;
      const receiptBytes = fs.readFileSync(receiptFd), receipt = directoryPublicationReceiptSchema.parse(JSON.parse(receiptBytes.toString('utf8')));
      const journalStat = fs.lstatSync(this.file), journalFd = fs.fstatSync(this.fd);
      if (receipt.owner !== this.id || receipt.id !== id || receipt.intent !== Session.notificationDigest(intent) ||
          receipt.result !== Session.notificationDigest(result) || !journalStat.isFile() || journalStat.isSymbolicLink() ||
          journalStat.dev !== journalFd.dev || journalStat.ino !== journalFd.ino) return unknown;
      const journal = fs.readFileSync(this.file), prefix = journal.subarray(0, receipt.journal.bytes);
      if (prefix.length !== receipt.journal.bytes || prefix.at(-1) !== 10 || createHash('sha256').update(prefix).digest('hex') !== receipt.journal.sha256 ||
          JSON.stringify(JSON.parse(prefix.toString('utf8').trimEnd().split('\n').at(-1)!)) !== JSON.stringify(result) ||
          JSON.stringify(journal.toString('utf8').trimEnd().split('\n').map(line => JSON.parse(line))) !== JSON.stringify(this.events)) return unknown;
      fs.fsyncSync(this.fd); fs.fsyncSync(receiptFd);
      syncDirectory(path.dirname(path.dirname(this.file))); syncDirectory(path.dirname(this.file));
      const after = fs.lstatSync(file, { bigint: true }), afterJournal = fs.lstatSync(this.file);
      if (!after.isFile() || after.isSymbolicLink() || after.dev !== opened.dev || after.ino !== opened.ino || after.size !== opened.size ||
          after.mtimeNs !== opened.mtimeNs || after.ctimeNs !== opened.ctimeNs || !afterJournal.isFile() || afterJournal.isSymbolicLink() ||
          afterJournal.dev !== journalFd.dev || afterJournal.ino !== journalFd.ino || !fs.readFileSync(file).equals(receiptBytes) ||
          !fs.readFileSync(this.file).equals(journal)) return unknown;
      this.assertDirectoryBackupLock();
      if (result.outcome.kind === 'unknown') return unknown;
      return result.outcome.kind === 'not_published' ? { kind: 'not_published', id } :
        { kind: 'durable', id, observation: structuredClone(result.outcome.observation),
          ...(result.outcome.retained ? { retained: { transactionId: id, held: structuredClone(result.outcome.retained.held) } } : {}) };
    } catch { return unknown; }
    finally { if (receiptFd !== undefined) fs.closeSync(receiptFd); }
  }

  get directoryPublications(): DirectoryPublicationRecord[] {
    const prefix = `${path.basename(this.file)}.publication-pending-`, ids = new Set<string>();
    for (const row of this.events) if (row.kind === 'directory_publication_intent' || row.kind === 'directory_publication_result' ||
        row.kind === 'directory_publication_failed') ids.add(row.id);
    for (const name of fs.readdirSync(path.dirname(this.file))) if (name.startsWith(prefix)) {
      const id = name.slice(prefix.length);
      if (z.string().uuid().safeParse(id).success) ids.add(id);
    }
    return [...ids].map(id => this.inspectDirectoryPublication(id));
  }

  // Host rewrite: RVr, sfn1dbxq [4740702,4743506), UTF-16; its backup has no retained owner/receipt.
  observeRetainedDirectoryPublication(input: { id: string; grant?: DirectoryReadHandle; signal: AbortSignal }): DirectoryRetainedObservation {
    const unknown: DirectoryRetainedObservation = { kind: 'unknown' };
    let gateFd: number | undefined, backupFd: number | undefined;
    try {
      const grant = input.grant;
      if (!grant) return unknown;
      const assertOwner = () => {
        this.assertDirectorySnapshotOwner(input.signal, grant);
        const named = fs.lstatSync(grant.root, { bigint: true }), opened = fs.fstatSync(grant.fd, { bigint: true });
        if (!named.isDirectory() || named.isSymbolicLink() || !opened.isDirectory() || !opened.nlink ||
            named.dev !== opened.dev || named.ino !== opened.ino || opened.dev !== grant.dev || opened.ino !== grant.ino)
          throw new Error('Retained directory grant changed');
      };
      assertOwner();
      const publication = this.inspectDirectoryPublication(input.id);
      if (publication.kind !== 'durable' || !publication.retained) return unknown;
      const intent = this.events.findLast((row): row is DirectoryPublicationIntentEvent => row.kind === 'directory_publication_intent' && row.id === input.id);
      if (!intent || intent.strategy !== 'retained' || intent.grant.root !== grant.root ||
          intent.grant.dev !== String(grant.dev) || intent.grant.ino !== String(grant.ino)) return unknown;
      const backup = this.inspectDirectoryBackup(intent.backupId).state;
      if (backup.kind !== 'valid') return unknown;
      const sidecar = this.directoryEvidencePath('directory_backup', intent.backupId);
      const namedBackup = fs.lstatSync(sidecar, { bigint: true });
      backupFd = fs.openSync(sidecar, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
      const openedBackup = fs.fstatSync(backupFd, { bigint: true });
      if (!namedBackup.isFile() || namedBackup.isSymbolicLink() || !openedBackup.isFile() || namedBackup.dev !== openedBackup.dev ||
          namedBackup.ino !== openedBackup.ino || String(openedBackup.dev) !== backup.witness.sidecar.dev ||
          String(openedBackup.ino) !== backup.witness.sidecar.ino || String(openedBackup.uid) !== backup.witness.sidecar.uid ||
          (openedBackup.mode & 0o777n) !== 0o600n || openedBackup.size !== BigInt(backup.witness.bytes) ||
          this.hashDirectoryBackup(backupFd, backup.witness.bytes) !== backup.witness.sha256) return unknown;
      const gatePath = `${this.lock}.gate`;
      gateFd = fs.openSync(gatePath, fs.constants.O_RDWR | fs.constants.O_NOFOLLOW);
      const openedGate = fs.fstatSync(gateFd, { bigint: true }), namedGate = fs.lstatSync(gatePath, { bigint: true });
      if (!openedGate.isFile() || !namedGate.isFile() || namedGate.isSymbolicLink() || openedGate.dev !== namedGate.dev ||
          openedGate.ino !== namedGate.ino || (openedGate.mode & 0o777n) !== 0o600n || !flock(gateFd, false)) return unknown;
      assertOwner();
      const observed = observeRetainedDirectoryFile({ fd: grant.fd, relative: path.relative(grant.root, intent.lexicalPath),
        expected: publication.retained.held, expectedFd: backupFd, transactionId: input.id, leaseFd: gateFd });
      const afterBackup = fs.fstatSync(backupFd, { bigint: true }), afterName = fs.lstatSync(sidecar, { bigint: true });
      const afterGate = fs.fstatSync(gateFd, { bigint: true }), afterGateName = fs.lstatSync(gatePath, { bigint: true });
      if (observed.kind !== 'observed' || !afterName.isFile() || afterName.isSymbolicLink() || afterName.dev !== openedBackup.dev ||
          afterName.ino !== openedBackup.ino || afterBackup.dev !== openedBackup.dev || afterBackup.ino !== openedBackup.ino ||
          afterBackup.size !== openedBackup.size || afterBackup.mtimeNs !== openedBackup.mtimeNs || afterBackup.ctimeNs !== openedBackup.ctimeNs ||
          (afterBackup.mode & 0o777n) !== 0o600n || this.hashDirectoryBackup(backupFd, backup.witness.bytes) !== backup.witness.sha256 ||
          !afterGate.isFile() || !afterGateName.isFile() || afterGateName.isSymbolicLink() || afterGate.dev !== openedGate.dev ||
          afterGate.ino !== openedGate.ino || afterGateName.dev !== openedGate.dev || afterGateName.ino !== openedGate.ino ||
          (afterGate.mode & 0o777n) !== 0o600n || JSON.stringify(this.inspectDirectoryPublication(input.id)) !== JSON.stringify(publication)) return unknown;
      assertOwner();
      return observed;
    } catch { return unknown; }
    finally { if (backupFd !== undefined) fs.closeSync(backupFd); if (gateFd !== undefined) fs.closeSync(gateFd); }
  }

  // Host rewrite: Tke/Cwt, sfn1dbxq [4732048,4733481)/[4734814,4735645), UTF-16;
  // Session authority and the temporary backup do not constitute a durable checkpoint receipt.
  async beginDirectoryCheckpointBracket(input: { id: string; root: string; lexicalPath: string; destinationFd: number;
    signal: AbortSignal }): Promise<DirectoryCheckpointBracket> {
    const unknown: DirectoryCheckpointBracket = { kind: 'unknown' };
    let lease: typeof this.directoryCheckpointGate, reserved = false, handedOff = false, inner: DirectoryCheckpointBracket | undefined;
    const release = () => {
      if (reserved) { this.directoryCheckpointBracketIds.delete(input.id); reserved = false; }
      if (!lease) return;
      const held = lease; lease = undefined; held.users--;
      if (!held.users) {
        if (this.directoryCheckpointGate === held) this.directoryCheckpointGate = undefined;
        fs.closeSync(held.fd);
      }
    };
    try {
      if (!z.string().uuid().safeParse(input.id).success || !path.isAbsolute(input.root) || path.resolve(input.root) !== input.root ||
          !path.isAbsolute(input.lexicalPath) || path.resolve(input.lexicalPath) !== input.lexicalPath) return unknown;
      const relative = path.relative(input.root, input.lexicalPath), grant = this.workingDirectories(false).readHandle?.(input.root);
      if (!grant || !relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return unknown;
      const combined = AbortSignal.any([input.signal, grant.signal, this.closeSignal]);
      this.assertDirectorySnapshotOwner(combined, grant);
      const sidecar = this.directoryEvidencePath('directory_snapshot_file', input.id);
      const named = fs.lstatSync(sidecar, { bigint: true }), opened = fs.fstatSync(input.destinationFd, { bigint: true });
      const unused = () => {
        if (this.events.some(row => (row.kind === 'directory_backup' || row.kind === 'directory_snapshot_file' || row.kind === 'directory_missing_backup') && row.id === input.id) ||
            this.hasDirectoryEvidencePending('directory_snapshot_file', input.id)) return false;
        try { fs.lstatSync(this.directoryEvidenceReceiptPath('directory_snapshot_file', input.id)); return false; }
        catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true; throw error; }
      };
      if (!named.isFile() || named.isSymbolicLink() || !opened.isFile() || named.dev !== opened.dev || named.ino !== opened.ino ||
          opened.size !== 0n || opened.nlink !== 1n || (opened.mode & 0o7777n) !== 0o600n ||
          (typeof process.getuid === 'function' && opened.uid !== BigInt(process.getuid())) || !unused() ||
          this.directoryCheckpointBracketIds.has(input.id)) return unknown;
      this.directoryCheckpointBracketIds.add(input.id); reserved = true;
      const gatePath = `${this.lock}.gate`;
      let shared = this.directoryCheckpointGate;
      if (!shared) {
        let fd: number | undefined;
        try {
          fd = fs.openSync(gatePath, fs.constants.O_RDWR | fs.constants.O_NOFOLLOW);
          const gate = fs.fstatSync(fd, { bigint: true }), gateName = fs.lstatSync(gatePath, { bigint: true });
          if (!gate.isFile() || !gateName.isFile() || gateName.isSymbolicLink() || gate.dev !== gateName.dev || gate.ino !== gateName.ino ||
              (gate.mode & 0o777n) !== 0o600n || !flock(fd, false)) return unknown;
          shared = { fd, dev: gate.dev, ino: gate.ino, users: 0 }; this.directoryCheckpointGate = shared; fd = undefined;
        } finally { if (fd !== undefined) fs.closeSync(fd); }
      }
      shared.users++; lease = shared;
      const gate = fs.fstatSync(shared.fd, { bigint: true }), gateName = fs.lstatSync(gatePath, { bigint: true });
      if (!gate.isFile() || !gateName.isFile() || gateName.isSymbolicLink() || gate.dev !== shared.dev || gate.ino !== shared.ino ||
          gateName.dev !== shared.dev || gateName.ino !== shared.ino || (gate.mode & 0o777n) !== 0o600n) return unknown;
      const current = () => {
        try {
          this.assertDirectorySnapshotOwner(combined, grant);
          if (!lease || this.directoryCheckpointGate !== lease || !this.directoryCheckpointBracketIds.has(input.id) || !unused()) return false;
          const sidecarName = fs.lstatSync(sidecar, { bigint: true }), sidecarFd = fs.fstatSync(input.destinationFd, { bigint: true });
          const currentGate = fs.fstatSync(lease.fd, { bigint: true }), currentGateName = fs.lstatSync(gatePath, { bigint: true });
          return sidecarName.isFile() && !sidecarName.isSymbolicLink() && sidecarFd.isFile() && sidecarName.dev === opened.dev &&
            sidecarName.ino === opened.ino && sidecarFd.dev === opened.dev && sidecarFd.ino === opened.ino && sidecarFd.uid === opened.uid &&
            sidecarFd.mode === opened.mode && sidecarFd.nlink === 1n && currentGate.isFile() && currentGateName.isFile() &&
            !currentGateName.isSymbolicLink() && currentGate.dev === lease.dev && currentGate.ino === lease.ino &&
            currentGateName.dev === lease.dev && currentGateName.ino === lease.ino && (currentGate.mode & 0o777n) === 0o600n;
        } catch { return false; }
      };
      inner = await beginCheckpointBracket({ grant, relative, destinationFd: input.destinationFd, gateFd: shared.fd, signal: combined, isCurrent: current });
      if (inner.kind !== 'ready') return unknown;
      if (!current()) { await inner.cancel(); return unknown; }
      const bracket = inner;
      let completion: Promise<DirectoryCheckpointBracketResult> | undefined;
      const onAbort = () => { void cancel().catch(() => {}); };
      const cleanup = () => { combined.removeEventListener('abort', onAbort); release(); };
      const finish = (): Promise<DirectoryCheckpointBracketResult> => {
        if (!completion) completion = (async () => {
          try {
            const result = await bracket.finish();
            return result.kind === 'stable' && current() ? result : { kind: 'unknown' };
          } finally { cleanup(); }
        })();
        return completion;
      };
      const cancel = async () => { try { await bracket.cancel(); } finally { await finish(); } };
      combined.addEventListener('abort', onAbort, { once: true });
      if (combined.aborted) { await cancel(); return unknown; }
      handedOff = true;
      void bracket.closed.then(() => finish()).catch(() => {});
      return { kind: 'ready', observation: bracket.observation, closed: bracket.closed, finish, cancel };
    } catch {
      if (inner?.kind === 'ready') await inner.cancel();
      return unknown;
    } finally { if (!handedOff) release(); }
  }

  // Host transaction for uno/Fet and pPe/sC, sfn1dbxq [739599,743280)/[4731316,4732048)
  // and f606a53w [7111,7501)/[12501,15618), UTF-16. The source has no owner-bound receipt.
  publishDirectoryFileTransaction(input: { toolUseId: string; backupId: string; grant: DirectoryReadHandle; lexicalPath: string;
    content: Uint8Array; signal: AbortSignal; authorizationSignal: AbortSignal; approvalCall: PathApprovalCall;
    authorization?: DirectoryPublicationAuthorization; strategy?: 'retained' }): DirectoryPublication | DirectoryRetainedPublication {
    if (input.strategy !== undefined && input.strategy !== 'retained') throw new Error('Directory publication strategy invalid');
    const content = Buffer.from(input.content);
    const contentWitness = { bytes: content.length, sha256: createHash('sha256').update(content).digest('hex') };
    const authorization = consumeDirectoryPublicationAuthorization(input.authorization, { session: this, toolUseId: input.toolUseId, lexicalPath: input.lexicalPath,
      content, signal: input.signal, authorizationSignal: input.authorizationSignal, approvalCall: input.approvalCall });
    const assertOwner = () => {
      input.authorizationSignal.throwIfAborted();
      if (!input.approvalCall.isActive || input.approvalCall.providerId !== input.toolUseId) throw new Error('Directory publication call retired');
      this.assertDirectorySnapshotOwner(input.signal, input.grant);
    };
    assertOwner();
    const missing = this.events.findLast((row): row is DirectoryMissingBackupEvent => row.kind === 'directory_missing_backup' && row.id === input.backupId);
    const backup = missing ? undefined : this.inspectDirectoryBackup(input.backupId).state;
    const witness = missing ?? (backup?.kind === 'valid' ? backup.witness : undefined);
    const messageContext = this.directoryBackupMessageContext(input.toolUseId, this.events.length);
    if (!witness || !messageContext || witness.toolUseId !== input.toolUseId || witness.lexicalPath !== input.lexicalPath ||
        JSON.stringify(witness.messageContext) !== JSON.stringify(messageContext) || witness.grant.root !== input.grant.root ||
        witness.grant.incarnation !== input.grant.incarnation || witness.grant.dev !== String(input.grant.dev) ||
        witness.grant.ino !== String(input.grant.ino)) throw new Error('Directory publication backup mismatch');
    if (missing && (missing.kind !== 'directory_missing_backup' || missing.createMode === undefined || !this.inspectDirectorySnapshot(missing) ||
        JSON.stringify(missing.writeInput) !== JSON.stringify({ content: contentWitness, overwrite: authorization.overwrite })))
      throw new Error('Directory publication missing backup mismatch');
    if (!missing && !authorization.overwrite) throw new Error('Directory publication authorization invalid');
    if (this.events.some(row => row.kind === 'directory_publication_intent' && row.toolUseId === input.toolUseId &&
        JSON.stringify(row.messageContext) === JSON.stringify(messageContext))) throw new Error('Directory publication already attempted');
    const start = this.events.findLast(row => row.kind === 'tool_start' && row.id === input.toolUseId);
    if (!start || start.kind !== 'tool_start' || start.name !== 'write_file' || start.parentMessageId !== messageContext.parentMessageId ||
        start.writeInputDigest !== directoryWriteFingerprint(authorization))
      throw new Error('Directory publication input witness mismatch');
    const expected: DirectoryPublicationExpected = missing && missing.kind === 'directory_missing_backup' && missing.createMode !== undefined
      ? { kind: 'missing', parent: missing.parent, mode: missing.createMode }
      : boundDirectoryFileObservationSchema.parse(backup?.kind === 'valid' ? backup.witness.source.end : undefined);
    if (input.strategy === 'retained' && ('kind' in expected || !backup || backup.kind !== 'valid'))
      throw new Error('Retained directory publication requires an existing backup');
    const history = this.reconstructDirectoryFileHistory();
    const snapshot = history.snapshots.at(-1);
    if (!snapshot || snapshot.messageId !== messageContext.userMessageId || !snapshot.entries.some(entry =>
      entry.path.lexicalPath === input.lexicalPath && entry.path.grant.root === input.grant.root &&
      entry.path.grant.dev === String(input.grant.dev) && entry.path.grant.ino === String(input.grant.ino) &&
      ('kind' in expected ? entry.reference.kind === 'missing' && JSON.stringify(entry.reference.parent) === JSON.stringify(expected.parent)
        : entry.reference.kind === 'present')))
      throw new Error('Directory publication snapshot unavailable');
    const relative = path.relative(input.grant.root, input.lexicalPath);
    const id = randomUUID(), intent = directoryPublicationIntentSchema.parse({ kind: 'directory_publication_intent', id, owner: this.id,
      toolUseId: input.toolUseId, messageContext, lexicalPath: input.lexicalPath, grant: witness.grant, backupId: input.backupId,
      expected, content: contentWitness, ...('kind' in expected ? { overwrite: authorization.overwrite } : {}),
      ...(input.strategy ? { strategy: input.strategy } : {}) });
    const gatePath = `${this.lock}.gate`, gateFd = fs.openSync(gatePath, fs.constants.O_RDWR | fs.constants.O_NOFOLLOW);
    let backupFd: number | undefined, backupStat: fs.BigIntStats | undefined;
    try {
      const opened = fs.fstatSync(gateFd, { bigint: true }), named = fs.lstatSync(gatePath, { bigint: true });
      if (!opened.isFile() || !named.isFile() || named.isSymbolicLink() || opened.dev !== named.dev || opened.ino !== named.ino ||
          (opened.mode & 0o777n) !== 0o600n || !flock(gateFd, false)) throw new Error('Directory publication gate unavailable');
      const assertGate = () => {
        assertOwner();
        const current = fs.lstatSync(gatePath, { bigint: true }), descriptor = fs.fstatSync(gateFd, { bigint: true });
        if (!current.isFile() || current.isSymbolicLink() || !descriptor.isFile() || current.dev !== opened.dev || current.ino !== opened.ino ||
            descriptor.dev !== opened.dev || descriptor.ino !== opened.ino || (descriptor.mode & 0o777n) !== 0o600n)
          throw new Error('Directory publication gate changed');
      };
      assertGate();
      if (input.strategy === 'retained') {
        if (!backup || backup.kind !== 'valid') throw new Error('Retained directory publication backup unavailable');
        const sidecar = this.directoryEvidencePath('directory_backup', input.backupId);
        const named = fs.lstatSync(sidecar, { bigint: true });
        backupFd = fs.openSync(sidecar, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
        backupStat = fs.fstatSync(backupFd, { bigint: true });
        if (!named.isFile() || named.isSymbolicLink() || !backupStat.isFile() || named.dev !== backupStat.dev || named.ino !== backupStat.ino ||
            String(backupStat.dev) !== backup.witness.sidecar.dev || String(backupStat.ino) !== backup.witness.sidecar.ino ||
            String(backupStat.uid) !== backup.witness.sidecar.uid || (backupStat.mode & 0o777n) !== 0o600n ||
            backupStat.size !== BigInt(backup.witness.bytes) || this.hashDirectoryBackup(backupFd, backup.witness.bytes) !== backup.witness.sha256)
          throw new Error('Retained directory publication backup changed');
        assertGate();
      }
      const pending = this.directoryPublicationPendingPath(id), receiptPath = this.directoryPublicationReceiptPath(id);
      let receiptExists = false;
      try { fs.lstatSync(receiptPath); receiptExists = true; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      if (this.hasDirectoryPublicationPending(id) || receiptExists ||
          this.events.some(row => row.kind === 'directory_publication_intent' && row.id === id)) throw new Error('Directory publication identity already exists');
      try {
        atomicWriteFile(pending, JSON.stringify({ owner: this.id, id, intent: Session.notificationDigest(intent) }), { mode: 0o600, durable: true });
        assertGate(); this.append(intent, undefined, directoryPublicationJournalToken); assertGate();
        let publication: DirectoryPublication | DirectoryRetainedPublication;
        if (input.strategy === 'retained') {
          if (backupFd === undefined || backupStat === undefined || 'kind' in expected || !backup || backup.kind !== 'valid')
            throw new Error('Retained directory publication backup unavailable');
          publication = publishRetainedDirectoryFile({ fd: input.grant.fd, relative, expected, expectedFd: backupFd,
            content, transactionId: id, leaseFd: gateFd });
          const after = fs.fstatSync(backupFd, { bigint: true }), named = fs.lstatSync(this.directoryEvidencePath('directory_backup', input.backupId), { bigint: true });
          if (!named.isFile() || named.isSymbolicLink() || named.dev !== backupStat.dev || named.ino !== backupStat.ino ||
              after.dev !== backupStat.dev || after.ino !== backupStat.ino || after.size !== backupStat.size ||
              after.mtimeNs !== backupStat.mtimeNs || after.ctimeNs !== backupStat.ctimeNs ||
              this.hashDirectoryBackup(backupFd, backup.witness.bytes) !== backup.witness.sha256 || this.inspectDirectoryBackup(input.backupId).state.kind !== 'valid')
            throw new Error('Retained directory publication backup changed');
        } else publication = publishDirectoryFile({ fd: input.grant.fd, relative, expected, content, leaseFd: gateFd });
        assertGate();
        const outcome = publication.kind === 'durable' ? { kind: 'durable' as const, observation: publication.observation,
          ...('held' in publication ? { retained: { held: publication.held } } : {}) } : { kind: publication.kind };
        const result = directoryPublicationResultSchema.parse({ kind: 'directory_publication_result', id, owner: this.id,
          intent: Session.notificationDigest(intent), outcome });
        this.append(result, undefined, directoryPublicationJournalToken); assertGate();
        const namedJournal = fs.lstatSync(this.file), openedJournal = fs.fstatSync(this.fd), journal = fs.readFileSync(this.file);
        if (!namedJournal.isFile() || namedJournal.isSymbolicLink() || namedJournal.dev !== openedJournal.dev || namedJournal.ino !== openedJournal.ino ||
            journal.at(-1) !== 10 || JSON.stringify(journal.toString('utf8').trimEnd().split('\n').map(line => JSON.parse(line))) !== JSON.stringify(this.events))
          throw new Error('Directory publication journal changed');
        const receipt = { owner: this.id, id, intent: Session.notificationDigest(intent), result: Session.notificationDigest(result),
          journal: { bytes: journal.length, sha256: createHash('sha256').update(journal).digest('hex') } };
        atomicWriteFile(receiptPath, JSON.stringify(receipt), { mode: 0o600, durable: true });
        assertGate(); fs.unlinkSync(pending); syncDirectory(path.dirname(pending)); assertGate();
        const verified = this.inspectDirectoryPublication(id);
        if (verified.kind !== publication.kind) throw new Error('Directory publication receipt validation failed');
        return publication;
      } catch (error) {
        try {
          if (!this.closed && !this.journalFailed && this.events.some(row => row.kind === 'directory_publication_intent' && row.id === id)) {
            this.assertDirectoryBackupLock();
            const namedJournal = fs.lstatSync(this.file), openedJournal = fs.fstatSync(this.fd), journal = fs.readFileSync(this.file);
            if (!namedJournal.isFile() || namedJournal.isSymbolicLink() || namedJournal.dev !== openedJournal.dev || namedJournal.ino !== openedJournal.ino ||
                journal.at(-1) !== 10 || JSON.stringify(journal.toString('utf8').trimEnd().split('\n').map(line => JSON.parse(line))) !== JSON.stringify(this.events))
              throw new Error('Directory publication failure journal changed');
            this.append({ kind: 'directory_publication_failed', id, owner: this.id, intent: Session.notificationDigest(intent) }, undefined, directoryPublicationJournalToken);
          }
        } catch { /* Keep the original error and retain the filesystem fence. */ }
        this.journalFailed = true;
        try {
          if (!this.hasDirectoryPublicationPending(id)) {
            const fd = fs.openSync(pending, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o600);
            try { Session.writeAll(fd, Buffer.from(JSON.stringify({ owner: this.id, id, intent: Session.notificationDigest(intent) }))); fs.fsyncSync(fd); }
            finally { fs.closeSync(fd); }
            syncDirectory(path.dirname(pending));
          }
        } catch {
          try { fs.renameSync(receiptPath, `${this.file}.publication-unconfirmed-receipt-${id}-${randomUUID()}`); syncDirectory(path.dirname(this.file)); }
          catch { /* Preserve the original transaction failure. */ }
        }
        throw error;
      }
    } finally { if (backupFd !== undefined) fs.closeSync(backupFd); fs.closeSync(gateFd); }
  }

  private assertDirectorySnapshotOwner(signal: AbortSignal, grant?: DirectoryReadHandle): void {
    signal.throwIfAborted();
    if (this.closed || this.journalFailed) throw new Error('Directory snapshot owner retired');
    if (grant) {
      const current = this.workingDirectories(false).readHandle?.(grant.root);
      if (grant.signal.aborted || !current || current.signal.aborted || grant.owner !== this.id || current.owner !== this.id ||
          current.incarnation !== grant.incarnation || current.fd !== grant.fd || current.dev !== grant.dev || current.ino !== grant.ino)
        throw new Error('Directory snapshot grant retired');
    }
    this.assertDirectoryBackupLock();
  }

  private recordDirectorySnapshotFile(input: { intent: DirectorySnapshotIntentEvent; path: DirectoryHistoryPath; id: string;
    grant: DirectoryReadHandle; destinationFd: number; bytes: number; sha256: string; metadata: BoundDirectoryFileObservation; signal: AbortSignal }): void {
    const assertOwner = () => this.assertDirectorySnapshotOwner(input.signal, input.grant);
    assertOwner();
    const sidecar = this.directoryEvidencePath('directory_snapshot_file', input.id);
    const source = boundDirectoryFileObservationSchema.parse(input.metadata);
    const opened = fs.fstatSync(input.destinationFd, { bigint: true }), named = fs.lstatSync(sidecar, { bigint: true });
    if (!opened.isFile() || !named.isFile() || named.isSymbolicLink() || opened.dev !== named.dev || opened.ino !== named.ino ||
        (opened.mode & 0o777n) !== 0o600n || opened.size !== BigInt(input.bytes) || BigInt(source.size) !== BigInt(input.bytes) ||
        this.hashDirectoryBackup(input.destinationFd, input.bytes) !== input.sha256 ||
        this.events.some(row => (row.kind === 'directory_backup' || row.kind === 'directory_snapshot_file') && row.id === input.id) ||
        fs.existsSync(this.directoryEvidenceReceiptPath('directory_snapshot_file', input.id)) || this.hasDirectoryEvidencePending('directory_snapshot_file', input.id))
      throw new Error('Directory snapshot file identity mismatch');
    const event = directorySnapshotFileSchema.parse({ kind: 'directory_snapshot_file', id: input.id, owner: this.id,
      snapshotId: input.intent.id, messageId: input.intent.messageId, trackingPath: input.path.trackingPath, lexicalPath: input.path.lexicalPath,
      grant: { root: input.grant.root, incarnation: input.grant.incarnation, dev: String(input.grant.dev), ino: String(input.grant.ino) },
      source: { begin: source, end: source }, sidecar: { dev: String(opened.dev), ino: String(opened.ino), uid: String(opened.uid) },
      bytes: input.bytes, sha256: input.sha256 });
    fs.fsyncSync(input.destinationFd); assertOwner(); syncDirectory(path.dirname(sidecar)); assertOwner();
    this.commitDirectoryReceipt(event, assertOwner);
  }

  private async captureDirectoryHistoryEntry(input: { intent: DirectorySnapshotIntentEvent; state: DirectoryHistoryState;
    path: DirectoryHistoryPath; signal: AbortSignal }): Promise<DirectoryHistoryEntry> {
    const { path: target, state, signal } = input;
    const previous = state.snapshots.at(-1)?.entries.find(entry => entry.path.trackingPath === target.trackingPath);
    const version = nextDirectoryHistoryVersion(state, target.trackingPath);
    const unknown = (reason: 'grant-unavailable' | 'interrupted' | 'unstable' | 'corrupt'): DirectoryHistoryEntry =>
      ({ path: target, reference: { kind: 'unknown', lastKnownVersion: version - 1, reason } });
    const grant = this.workingDirectories(false).readHandle?.(target.grant.root);
    if (!grant || grant.owner !== this.id || String(grant.dev) !== target.grant.dev || String(grant.ino) !== target.grant.ino)
      return unknown('grant-unavailable');
    const relative = path.relative(grant.root, target.lexicalPath), combined = AbortSignal.any([signal, grant.signal, this.closeSignal]);
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return unknown('corrupt');
    let destination: fsp.FileHandle | undefined, discard = false;
    const id = randomUUID(), sidecar = this.directoryEvidencePath('directory_snapshot_file', id);
    try {
      this.assertDirectorySnapshotOwner(combined, grant);
      const missing = probeMissingDirectoryFile({ fd: grant.fd, relative });
      this.assertDirectorySnapshotOwner(combined, grant);
      if (missing) return { path: target, reference: { kind: 'missing', parent: missing, version } };
      destination = await fsp.open(sidecar, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_RDWR | fs.constants.O_NOFOLLOW, 0o600);
      this.assertDirectorySnapshotOwner(combined, grant);
      syncDirectory(path.dirname(sidecar));
      const copied = await copyStableDirectoryFile({ fd: grant.fd, relative }, destination, combined);
      this.assertDirectorySnapshotOwner(combined, grant);
      if (previous?.reference.kind === 'present') {
        const old = this.inspectDirectoryEvidence(previous.reference.origin === 'tool' ? 'directory_backup' : 'directory_snapshot_file', previous.reference.backupId).state;
        const oldMetadata = old.kind === 'valid' ? boundDirectoryFileObservationSchema.safeParse(old.witness.source.begin) : undefined;
        if (old.kind === 'valid' && oldMetadata?.success && old.witness.sha256 === copied.sha256 && old.witness.bytes === copied.bytes &&
            oldMetadata.data.dev === copied.metadata.dev && oldMetadata.data.ino === copied.metadata.ino && oldMetadata.data.mode === copied.metadata.mode &&
            oldMetadata.data.nlink === copied.metadata.nlink && JSON.stringify(oldMetadata.data.parent) === JSON.stringify(copied.metadata.parent)) {
          discard = true;
          return { path: target, reference: previous.reference };
        }
      }
      this.recordDirectorySnapshotFile({ intent: input.intent, path: target, id, grant, destinationFd: destination.fd,
        bytes: copied.bytes, sha256: copied.sha256, metadata: copied.metadata, signal: combined });
      return { path: target, reference: { kind: 'present', origin: 'snapshot', backupId: id, version } };
    } catch {
      signal.throwIfAborted();
      if (this.closed || this.journalFailed) throw new Error('Directory snapshot transaction failed');
      return unknown(grant.signal.aborted ? 'grant-unavailable' : 'unstable');
    } finally {
      if (discard && destination) {
        try {
          const opened = await destination.stat({ bigint: true }), named = await fsp.lstat(sidecar, { bigint: true });
          if (named.isFile() && !named.isSymbolicLink() && named.dev === opened.dev && named.ino === opened.ino) {
            await fsp.unlink(sidecar); syncDirectory(path.dirname(sidecar));
          }
        } catch { /* Unconfirmed sidecars remain outside the history. */ }
      }
      await destination?.close();
    }
  }

  // Tke, sfn1dbxq [4732048,4733481), UTF-16. The FD and receipt boundary is a host rewrite.
  async captureDirectoryFileHistory(messageId: string, signal: AbortSignal): Promise<void> {
    this.assertDirectorySnapshotOwner(signal);
    const index = this.events.findLastIndex(row => row.kind === 'message' && row.messageId === messageId && row.message.role === 'user' && !row.isMeta);
    if (index < 0 || this.events.filter(row => row.kind === 'message' && row.messageId === messageId).length !== 1)
      throw new Error('Directory snapshot message mismatch');
    const message = this.events[index];
    if (message?.kind === 'message' && message.directoryHistoryDisabled) return;
    let state: DirectoryHistoryState;
    try { state = this.reconstructDirectoryFileHistory(index); }
    catch { return; }
    if (!state.snapshots.length && this.workingDirectories(false).length === 0) return;
    const intent = directorySnapshotIntentSchema.parse({ kind: 'directory_snapshot_intent', id: randomUUID(), owner: this.id,
      messageId, paths: [...state.trackedFiles.values()], timestamp: new Date().toISOString() });
    this.append(intent, undefined, directoryBackupJournalToken);
    const captured: { entry: DirectoryHistoryEntry; grant?: DirectoryReadHandle }[] = [];
    for (const target of intent.paths) {
      const grant = this.workingDirectories(false).readHandle?.(target.grant.root);
      const entry = await this.captureDirectoryHistoryEntry({ intent, state, path: target, signal });
      this.assertDirectorySnapshotOwner(signal);
      captured.push({ entry, ...(grant ? { grant } : {}) });
    }
    const entries: DirectoryHistoryEntry[] = [];
    for (const item of captured) {
      let { entry } = item;
      if (entry.reference.kind !== 'unknown') {
        try {
          if (!item.grant) throw new Error('Directory snapshot grant unavailable');
          this.assertDirectorySnapshotOwner(signal, item.grant);
        } catch {
          this.assertDirectorySnapshotOwner(signal);
          entry = { path: entry.path, reference: { kind: 'unknown', reason: 'grant-unavailable',
            lastKnownVersion: nextDirectoryHistoryVersion(state, entry.path.trackingPath) - 1 } };
        }
      }
      const observation = directorySnapshotObservationSchema.parse({ kind: 'directory_snapshot_observation', snapshotId: intent.id, owner: this.id, entry });
      this.append(observation, undefined, directoryBackupJournalToken);
      entries.push(observation.entry);
    }
    this.assertDirectorySnapshotOwner(signal);
    const event = directorySnapshotSchema.parse({ kind: 'directory_snapshot', id: intent.id, owner: this.id,
      messageId, entries, timestamp: intent.timestamp });
    this.commitDirectoryReceipt(event, () => this.assertDirectorySnapshotOwner(signal));
  }

  recoverInterruptedDirectoryFileHistory(signal: AbortSignal): void {
    this.assertDirectorySnapshotOwner(signal);
    const index = this.events.findLastIndex(row => row.kind === 'message' && row.message.role === 'user' && !row.isMeta && !!row.messageId);
    const message = this.events[index];
    if (!message || message.kind !== 'message' || !message.messageId || message.directoryHistoryDisabled) return;
    let state: DirectoryHistoryState;
    try { state = this.reconstructDirectoryFileHistory(index); }
    catch { return; }
    const tail = this.events.slice(index + 1), intents = tail.filter((row): row is DirectorySnapshotIntentEvent =>
      row.kind === 'directory_snapshot_intent' && row.messageId === message.messageId);
    const finals = tail.filter((row): row is DirectorySnapshotEvent => row.kind === 'directory_snapshot' && row.messageId === message.messageId);
    if (intents.length > 1 || finals.length > 1 || tail.some(row => row.kind === 'directory_snapshot_recovery' && row.messageId === message.messageId) ||
        fs.readdirSync(path.dirname(this.file)).some(name => name.startsWith(`${path.basename(this.file)}.torn-`))) return;
    const final = finals[0];
    if (final && this.inspectDirectorySnapshot(final)) return;
    if (!intents.length && !state.snapshots.length) return;
    let intent = intents[0];
    if (!intent) {
      intent = directorySnapshotIntentSchema.parse({ kind: 'directory_snapshot_intent', id: randomUUID(), owner: this.id,
        messageId: message.messageId, paths: [...state.trackedFiles.values()], timestamp: new Date().toISOString() });
      this.append(intent, undefined, directoryBackupJournalToken);
    }
    if (intent.owner !== this.id || JSON.stringify(intent.paths) !== JSON.stringify([...state.trackedFiles.values()]) ||
        (final && (final.id !== intent.id || final.owner !== this.id || final.timestamp !== intent.timestamp)) ||
        this.hasDirectorySnapshotRecoveryPending(intent.id)) return;
    const failed = this.events.some(row => row.kind === 'directory_snapshot_failed' && row.id === intent!.id);
    const originalPending = this.hasDirectorySnapshotPending(intent.id);
    if (final && !failed && !originalPending) return;
    const entries: DirectoryHistoryEntry[] = intent.paths.map(target => ({ path: target, reference: { kind: 'unknown',
      lastKnownVersion: nextDirectoryHistoryVersion(state, target.trackingPath) - 1, reason: 'interrupted' } }));
    const event = final || failed || originalPending
      ? directorySnapshotRecoverySchema.parse({ kind: 'directory_snapshot_recovery', id: intent.id, owner: this.id,
        messageId: intent.messageId, entries, timestamp: intent.timestamp, unconfirmed: final ? Session.notificationDigest(final) : null })
      : directorySnapshotSchema.parse({ kind: 'directory_snapshot', id: intent.id, owner: this.id,
        messageId: intent.messageId, entries, timestamp: intent.timestamp, interrupted: true });
    this.commitDirectoryReceipt(event, () => this.assertDirectorySnapshotOwner(signal));
  }

  get isOpen(): boolean { return !this.closed; }
  get closeSignal(): AbortSignal { return this.closeController.signal; }
  get isJournalFenced(): boolean { return this.journalFailed; }
  get isDirectoryAuthorityReleased(): boolean { return this.directoryHandlesReleased; }

  // Host gate witness for Ole, sfn1dbxq [4694145,4697475), UTF-16.
  checkpointGateIdentity(): SessionGateIdentity {
    this.assertDirectoryBackupLock();
    return { ...this.lockGate };
  }

  private constructor(file: string, fd: number, lock: string, lockToken: string, lockGate: SessionGateIdentity, events: SessionEvent[]) {
    const meta = events[0];
    if (meta?.kind !== 'metadata') throw new Error('Session metadata is missing');
    this.id = meta.id;
    this.config = structuredClone(meta.config);
    // RTe.kn/Bn, 24k7d6mw [1562359,1572850)/[1585446,1586735), UTF-16; replay only this configuration's accepted catalog.
    const catalog = events.findLast(event => event.kind === 'mcp_catalog');
    if (catalog?.kind === 'mcp_catalog') {
      if (catalog.configDigest !== fingerprintOf(this.config.mcpServers ?? {})) throw new Error('MCP catalog configuration mismatch');
      this.config.tools = structuredClone(catalog.tools);
    }
    this.permissionUpdates = seedPermissionUpdates(this.config.permissions, this.config.workspace,
      this.config.configSources?.userDir ?? defaultUserDir());
    this.workingDirectories(false);
    bindPermissionOwner(this.config.permissions, this.permissionOwner);
    this.file = file;
    this.events = events;
    this.fd = fd;
    this.lock = lock;
    this.lockToken = lockToken;
    this.lockGate = lockGate;
    this.reconcileNotifications();
    this.liveSettingSources = this.config.settingSources === undefined ? undefined : structuredClone(this.config.settingSources);
    this.releaseSettingsWrites = subscribeSettingsWrites(write => this.observeSettingsWrite(write));
    this.startedAt = meta.startedAt ?? Math.min(Date.now(), fs.fstatSync(fd).birthtimeMs || Date.now());
    for (const event of events) if (event.kind === 'file_history') this.updateFileHistory(event);
    this.restoreModelPlanMode();
  }

  // H9n/LBs, fh503bhf [3071,4455)/[4967,5545); i0/rge, xv9wnb67 [7974,8517)/[7064,7388), UTF-16.
  restoreModelPlanMode(history: 'current' | 'prefix' = 'current'): void {
    if (this.config.features?.sourcePlanTools !== true || this.config.managedPolicy?.permissions !== undefined ||
      history === 'current' && !this.events.some(event => event.kind === 'model_plan_mode')) return;
    const retained = history === 'prefix' ? transitionPlanMode({ ...this.permissionUpdates,
      mode: this.permissionUpdates.mode ?? this.config.permissions?.mode }, this.config.permissions?.mode ?? 'default', this.autoRuntime)
      : this.permissionUpdates;
    let state: SessionPermissionUpdates = { ...retained, mode: this.config.permissions?.mode, prePlanMode: undefined };
    for (const event of this.events) {
      if (event.kind === 'model_plan_mode' || event.kind === 'permission_mode_command')
        state = transitionPlanMode(state, event.mode, this.autoRuntime);
    }
    this.permissionUpdates = state;
  }

  static open(workspace: string, options: SessionOpenOptions): Session {
    return Session.openInternal(workspace, options);
  }

  private static openInternal(workspace: string, options: SessionOpenOptions, held?: { fd: number; lockToken: string }, checkpointRecoverySource = false,
      expectedLock?: CheckpointSourceLock): Session {
    const root = fs.realpathSync(workspace);
    if (!fs.statSync(root).isDirectory()) throw new Error('Session workspace must be a directory');
    const storage = options.storageRoot === undefined ? root : fs.realpathSync(options.storageRoot);
    if (!fs.statSync(storage).isDirectory()) throw new Error('Session storage root must be a directory');
    const dir = path.join(storage, '.agent');
    if (fs.existsSync(dir)) {
      if (fs.lstatSync(dir).isSymbolicLink() || !fs.statSync(dir).isDirectory()) throw new Error('Session directory must be a real directory');
    } else fs.mkdirSync(dir, { mode: 0o700 });
    const id = options.id ?? randomUUID();
    z.string().uuid().parse(id);
    const file = path.join(dir, `${id}.jsonl`);
    const lock = `${file}.lock`;
    const lockToken = held?.lockToken ?? randomUUID();
    // Host rewrite: Ole, sfn1dbxq [4694145,4697475), UTF-16, has no local lock protocol.
    // The permanent gate serializes compliant publishers and recoverers; never unlink it.
    const gateFd = held?.fd ?? fs.openSync(`${lock}.gate`, (checkpointRecoverySource ? 0 : fs.constants.O_CREAT) |
      fs.constants.O_RDWR | fs.constants.O_NOFOLLOW, 0o600);
    let lockFd: number | undefined;
    let lockGate: SessionGateIdentity | undefined;
    let lockIdentity: { dev: bigint; ino: bigint } | undefined;
    let published = false;
    const temporary = `${lock}.init-${lockToken}`;
    const discardPublishedLock = () => {
      if (!published || !lockGate || !lockIdentity) return;
      try {
        const namedGate = fs.lstatSync(`${lock}.gate`, { bigint: true }), namedLock = fs.lstatSync(lock, { bigint: true });
        if (namedGate.isFile() && !namedGate.isSymbolicLink() && String(namedGate.dev) === lockGate.dev && String(namedGate.ino) === lockGate.ino &&
            namedLock.isFile() && !namedLock.isSymbolicLink() && namedLock.dev === lockIdentity.dev && namedLock.ino === lockIdentity.ino)
          fs.unlinkSync(lock);
      } catch { /* Preserve unconfirmed lock names and the original error. */ }
    };
    const discardTemporaryLock = () => {
      if (lockFd === undefined) return;
      try {
        const named = fs.lstatSync(temporary, { bigint: true }), opened = fs.fstatSync(lockFd, { bigint: true });
        if (named.isFile() && !named.isSymbolicLink() && named.dev === opened.dev && named.ino === opened.ino) fs.unlinkSync(temporary);
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    };
    try {
    const gate = fs.fstatSync(gateFd, { bigint: true });
    if (!gate.isFile()) throw new Error('Invalid session lock gate');
    lockGate = { dev: String(gate.dev), ino: String(gate.ino) };
    const assertGate = () => {
      const namedGate = fs.lstatSync(`${lock}.gate`, { bigint: true });
      const currentGate = fs.fstatSync(gateFd, { bigint: true });
      if (!namedGate.isFile() || namedGate.isSymbolicLink() || !currentGate.isFile() || gate.dev !== currentGate.dev || gate.ino !== currentGate.ino ||
          gate.dev !== namedGate.dev || gate.ino !== namedGate.ino) throw new Error('Session lock gate changed');
    };
    assertGate();
    if (!flock(gateFd, false)) throw new Error('Session lock busy');
    assertGate();
    if (expectedLock && (!checkpointRecoverySource || !options.id || !options.recoverLock || !fs.existsSync(lock) ||
        expectedLock.gate.dev !== lockGate.dev || expectedLock.gate.ino !== lockGate.ino)) throw new Error('Checkpoint source lock unavailable');
    if (held) {
      if (!options.id || options.recoverLock) throw new Error('Invalid held session gate');
      const named = fs.lstatSync(lock);
      const owner = sessionLockSchema.parse(JSON.parse(fs.readFileSync(lock, 'utf8')));
      if (!named.isFile() || named.isSymbolicLink() || owner.pid !== process.pid || owner.token !== held.lockToken ||
          owner.gate.dev !== lockGate.dev || owner.gate.ino !== lockGate.ino)
        throw new Error('Held session lock changed');
    } else {
    if (options.recoverLock && fs.existsSync(lock)) {
      const before = fs.lstatSync(lock, { bigint: true });
      if (!before.isFile() || before.isSymbolicLink()) throw new Error('Invalid session lock');
      const lockBytes = fs.readFileSync(lock), owner = recoverableSessionLockSchema.parse(JSON.parse(lockBytes.toString('utf8')));
      if (owner.gate && (owner.gate.dev !== lockGate.dev || owner.gate.ino !== lockGate.ino)) throw new Error('Session lock gate changed during recovery');
      if (expectedLock && (String(before.dev) !== expectedLock.dev || String(before.ino) !== expectedLock.ino || String(before.uid) !== expectedLock.uid ||
          String(before.mode) !== expectedLock.mode || String(before.size) !== expectedLock.size || String(before.mtimeNs) !== expectedLock.mtimeNs ||
          String(before.ctimeNs) !== expectedLock.ctimeNs || before.nlink !== 1n || owner.pid !== expectedLock.pid || !owner.gate ||
          owner.gate.dev !== expectedLock.gate.dev || owner.gate.ino !== expectedLock.gate.ino)) throw new Error('Checkpoint source lock changed');
      try { process.kill(owner.pid, 0); throw new Error(`Session is active in process ${owner.pid}`); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
      const after = fs.lstatSync(lock, { bigint: true });
      if (after.dev !== before.dev || after.ino !== before.ino || after.mtimeNs !== before.mtimeNs || after.ctimeNs !== before.ctimeNs ||
          !fs.readFileSync(lock).equals(lockBytes))
        throw new Error('Session lock changed during recovery');
      assertGate();
      fs.unlinkSync(lock);
    }
    lockFd = fs.openSync(temporary, 'wx', 0o600);
    const lockStat = fs.fstatSync(lockFd, { bigint: true }); lockIdentity = { dev: lockStat.dev, ino: lockStat.ino };
    fs.writeFileSync(lockFd, JSON.stringify({ pid: process.pid, token: lockToken, gate: lockGate }));
    fs.fsyncSync(lockFd);
    assertGate();
    fs.linkSync(temporary, lock);
    published = true;
    assertGate();
    discardTemporaryLock();
    fs.closeSync(lockFd);
    lockFd = undefined;
    }
    } catch (error) {
      discardPublishedLock();
      throw error;
    } finally {
      try {
        if (!held) discardTemporaryLock();
      } finally { if (lockFd !== undefined) fs.closeSync(lockFd); if (!held) fs.closeSync(gateFd); }
    }
    if (!lockGate) throw new Error('Session lock gate unavailable');
    let fd: number | undefined;
    try {
      let events: SessionEvent[];
      if (options.id) {
        const stat = fs.lstatSync(file);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 100 * 1024 * 1024) throw new Error('Invalid or oversized session journal');
        const bytes = fs.readFileSync(file);
        if (options.expectedJournal) verifyJournalWitness(bytes, options.expectedJournal);
        const boundary = bytes.lastIndexOf(10) + 1;
        if ((held || checkpointRecoverySource) && boundary !== bytes.length) throw new Error('Held session journal is incomplete');
        events = bytes.subarray(0, boundary).toString('utf8').split('\n').filter(Boolean)
          .map((line) => {
            const event = JSON.parse(line);
            // Validate without reordering keys used by the stored fingerprint.
            eventSchema.parse(event);
            return event as SessionEvent;
          });
        const meta = events[0];
        if (meta?.kind !== 'metadata' || meta.id !== id || meta.config.workspace !== root || meta.fingerprint !== fingerprint(meta.config)) throw new Error('Session identity or config mismatch');
        if (meta.rootIdentity && meta.config.parentSessionId === undefined && meta.config.childMode === undefined && (meta.rootIdentity.rootSessionId !== id || meta.rootIdentity.originalCwd !== root)) throw new Error('Session root identity mismatch');
        if (events.slice(1).some((event) => event.kind === 'metadata')) throw new Error('Duplicate session metadata');
        if (events.some(event => (event.kind === 'notification_intent' || event.kind === 'notification_intent_v2') && event.owner !== id)) throw new Error('Notification intent owner mismatch');
        if (events.some(event => event.kind === 'tool_start' && event.runtimeWriteOwner && event.runtimeWriteOwner.owner !== id))
          throw new Error('Runtime Write start owner mismatch');
        validateRuntimeWriteExecutions(events, id);
        if (options.config && fingerprint(options.config) !== meta.fingerprint) throw new Error('Resume requires the original model, system, tools and runtime settings');
        fd = fs.openSync(file, fs.constants.O_RDWR | fs.constants.O_APPEND | fs.constants.O_NOFOLLOW);
        if (boundary !== bytes.length) {
          // Host rewrite: Ole, sfn1dbxq UTF-16 [4694145,4697475), marks torn tails;
          // this host must preserve the original before discarding any uncommitted bytes.
          const evidence = `${file}.torn-${randomUUID()}`;
          const saved = fs.openSync(evidence, 'wx+', 0o600);
          try {
            Session.writeAll(saved, bytes);
            fs.fsyncSync(saved);
            const verified = Buffer.alloc(bytes.length);
            let offset = 0;
            while (offset < verified.length) {
              const count = fs.readSync(saved, verified, offset, verified.length - offset, offset);
              if (!count) throw new Error('Torn journal evidence is incomplete');
              offset += count;
            }
            if (!verified.equals(bytes)) throw new Error('Torn journal evidence mismatch');
          } finally { fs.closeSync(saved); }
          syncDirectory(dir);
          if (!fs.readFileSync(fd).equals(bytes)) throw new Error('Session journal changed during recovery');
          fs.ftruncateSync(fd, boundary);
          fs.fsyncSync(fd);
        }
        // Host rewrite for Ole, sfn1dbxq [4694145,4697475), UTF-16: a visible recovered
        // checkpoint row must be synced and matched to this journal before its intent is cleared.
        const journal = fd;
        if (!held && !checkpointRecoverySource) {
          const syncRecoveryJournal = (expected: readonly SessionEvent[]) => {
            const named = fs.lstatSync(file), opened = fs.fstatSync(journal);
            if (!named.isFile() || named.isSymbolicLink() || !opened.isFile() || named.dev !== opened.dev || named.ino !== opened.ino)
              throw new Error('Checkpoint recovery journal changed');
            if (opened.size > 100 * 1024 * 1024) throw new Error('Checkpoint recovery journal exceeds size limit');
            const content = Session.readJournalBytes(journal, opened.size);
            if (!content.length || content.at(-1) !== 10 ||
                JSON.stringify(content.toString('utf8').trimEnd().split('\n').map(line => JSON.parse(line))) !== JSON.stringify(expected))
              throw new Error('Checkpoint recovery journal content changed');
            fs.fsyncSync(journal);
            const after = fs.lstatSync(file), current = fs.fstatSync(journal);
            if (!after.isFile() || after.isSymbolicLink() || after.dev !== opened.dev || after.ino !== opened.ino ||
                current.dev !== opened.dev || current.ino !== opened.ino || current.size !== opened.size || current.mtimeMs !== opened.mtimeMs ||
                current.ctimeMs !== opened.ctimeMs || !Session.readJournalBytes(journal, current.size).equals(content))
              throw new Error('Checkpoint recovery journal changed during sync');
          };
          let journalSyncFailed = false;
          let recovered: ReturnType<typeof recoverCheckpointAssociations> = [];
          try { recovered = recoverCheckpointAssociations(root, id, (name) => {
            const saved = events.findLast((event) => event.kind === 'checkpoint' && event.name === name);
            return saved?.kind === 'checkpoint' ? { digest: saved.digest, boundary: saved.boundary } : undefined;
          }, () => {
            try { syncRecoveryJournal(events); }
            catch (error) { journalSyncFailed = true; throw error; }
          }); } catch (error) { if (journalSyncFailed) throw error; }
          for (const pending of recovered) {
            const event = eventSchema.parse({ kind: 'checkpoint', name: pending.name, digest: pending.digest, boundary: pending.boundary }) as SessionEvent;
            Session.writeAll(journal, Buffer.from(JSON.stringify(event) + '\n'));
            syncRecoveryJournal([...events, event]);
            events.push(event);
            try { clearCheckpointAssociation(pending.file); } catch { /* a later open can clear it */ }
          }
        }
      } else {
        if (!options.config) throw new Error('New session requires config');
        configSchema.parse(options.config);
        if (options.config.workspace !== root) throw new Error('Config workspace must use its canonical path');
        fd = fs.openSync(file, 'ax', 0o600);
        // Host journal rewrite of ln/oh, 4bw62nzm [53194,56759), bf3z2ftn [43591,43758), UTF-16.
        const parent = options.childRoot?.parent;
        const inherited = parent?.isOpen && options.childRoot?.isOwner() && parent.id === options.config.parentSessionId &&
          options.config.childMode !== undefined && parent.config.workspace === root && storage === root ? parent.rootIdentity : undefined;
        const meta: SessionEvent = { kind: 'metadata', version: 1, id, config: options.config,
          fingerprint: fingerprint(options.config), startedAt: Math.min(options.startedAt ?? Date.now(), Date.now()),
          ...(options.config.parentSessionId === undefined && options.config.childMode === undefined ? { rootIdentity: { rootSessionId: id, originalCwd: root } } : inherited ? { rootIdentity: inherited } : {}) };
        const record = Buffer.from(JSON.stringify(meta) + '\n');
        Session.writeAll(fd, record);
        fs.fsyncSync(fd);
        events = [structuredClone(meta)];
      }
      const session = new Session(file, fd, lock, lockToken, lockGate, events);
      if (held) session.ownsLock = false;
      if (options.childRoot && events[0]?.kind === 'metadata' && events[0].rootIdentity && events[0].config.parentSessionId !== undefined) {
        const { parent, isOwner } = options.childRoot;
        const meta = events[0], recordedIdentity = events[0].rootIdentity, identity = parent.rootIdentity;
        if (recordedIdentity && parent.isOpen && isOwner() && identity && parent.id === meta.config.parentSessionId && meta.config.childMode !== undefined &&
            parent.config.workspace === root && storage === root && recordedIdentity.rootSessionId === identity.rootSessionId &&
            recordedIdentity.originalCwd === identity.originalCwd &&
            (!options.id || (options.expectedJournal && options.childRoot.verifyHistory?.()))) {
          session.childRootOwner = () => session.isOpen && parent.isOpen && isOwner() &&
            parent.rootIdentity?.rootSessionId === identity.rootSessionId && parent.rootIdentity?.originalCwd === identity.originalCwd;
        }
      }
      return session;
    } catch (error) {
      if (fd !== undefined) fs.closeSync(fd);
      discardPublishedLock();
      throw error;
    }
  }

  private static writeAll(fd: number, bytes: Buffer): void {
    let offset = 0;
    while (offset < bytes.length) {
      const written = fs.writeSync(fd, bytes, offset, bytes.length - offset);
      if (!written) throw new Error('Journal write made no progress');
      offset += written;
    }
  }

  private static readJournalBytes(fd: number, size: number): Buffer {
    if (!Number.isSafeInteger(size) || size < 0 || size > 100 * 1024 * 1024) throw new Error('Invalid checkpoint journal size');
    const bytes = Buffer.alloc(size);
    for (let offset = 0; offset < size;) {
      const count = fs.readSync(fd, bytes, offset, size - offset, offset);
      if (!count) throw new Error('Checkpoint journal short read');
      offset += count;
    }
    return bytes;
  }

  append(event: Exclude<SessionEvent, { kind: 'metadata' }>, authorization?: NotificationAuthorization, backupToken?: symbol,
      runtimeWriteAuthorization?: RuntimeWriteAuthorization): void {
    if (this.closed) throw new Error('Session is closed');
    if (this.journalFailed) throw new Error('Session journal write failed; close and reopen before appending');
    const runtimeStart = runtimeWriteAuthorization === undefined ? undefined : consumeRuntimeWriteAuthorization(runtimeWriteAuthorization, this, event);
    if (utilTypes.isProxy(event) || (Object.getPrototypeOf(event) !== Object.prototype && Object.getPrototypeOf(event) !== null) ||
        Object.getOwnPropertyDescriptor(event, 'toJSON') !== undefined) throw new Error('Session event must be a plain object');
    const kind = Object.getOwnPropertyDescriptor(event, 'kind'), runtimeOwner = Object.getOwnPropertyDescriptor(event, 'runtimeWriteOwner');
    if (kind && 'value' in kind && kind.value === 'runtime_write_execution' && runtimeStart === undefined)
      throw new Error('Runtime Write execution authorization invalid');
    if (!kind || !('value' in kind) || (runtimeOwner && !('value' in runtimeOwner)))
      throw new Error('Runtime Write start authorization invalid');
    if (runtimeOwner && 'value' in runtimeOwner && runtimeOwner.value !== undefined && runtimeStart === undefined)
      throw new Error('Runtime Write start authorization invalid');
    if ((kind.value === 'tool_start' || kind.value === 'runtime_write_execution') && Reflect.ownKeys(event).some(key => {
      const descriptor = Object.getOwnPropertyDescriptor(event, key);
      return !descriptor || !('value' in descriptor);
    })) throw new Error('Runtime Write start authorization invalid');
    if (event.kind === 'branch') event = branchEventSchema.parse(event);
    if (event.kind === 'directory_checkpoint_torn_recovery') {
      event = directoryCheckpointTornRecoverySchema.parse(event);
      const saved = backupToken === undefined ? undefined : checkpointTornRecoveryAuthorizations.get(backupToken);
      if (backupToken !== undefined) checkpointTornRecoveryAuthorizations.delete(backupToken);
      if (!saved || saved.target !== this || !saved.source.isOpen || saved.source.isJournalFenced || !isDeepStrictEqual(saved.event, event))
        throw new Error('Torn checkpoint recovery authorization invalid');
      try {
        const torn = readTornCheckpointEvidence(this);
        const branchPrefix = checkpointRecoveryPrefix(this.events, saved.targetJournal, this.events.length);
        if (!torn || torn.id !== event.evidence.id || !torn.bytes.equals(saved.evidence) ||
            !saved.source.checkpointJournalBytes().equals(saved.sourceJournal) || !this.checkpointJournalBytes().equals(saved.targetJournal) ||
            !event.sourceLock || !isDeepStrictEqual(saved.source.checkpointLockWitness(), event.sourceLock) ||
            !branchPrefix || !matchesTornCheckpointInheritance(branchPrefix.bytes, event.candidate, torn.bytes) ||
            !isDeepStrictEqual(collectDirectoryCheckpointReferences(saved.source, this), event.candidate.references) ||
            !verifyDirectoryCheckpointTornCandidate(this, event))
          throw new Error('Torn checkpoint recovery changed');
      } catch { throw new Error('Torn checkpoint recovery authorization invalid'); }
    }
    if (event.kind === 'directory_checkpoint_inheritance') {
      event = directoryCheckpointInheritanceSchema.parse(event);
      const saved = backupToken === undefined ? undefined : checkpointInheritanceAuthorizations.get(backupToken);
      if (backupToken !== undefined) checkpointInheritanceAuthorizations.delete(backupToken);
      if (!saved || saved.target !== this || !saved.source.isOpen || saved.source.isJournalFenced || !isDeepStrictEqual(saved.event, event))
        throw new Error('Directory checkpoint inheritance authorization invalid');
      try {
        if (!saved.source.checkpointJournalBytes().equals(saved.sourceJournal) || !this.checkpointJournalBytes().equals(saved.targetJournal) ||
            !isDeepStrictEqual(collectDirectoryCheckpointReferences(saved.source, this), event.references))
          throw new Error('Directory checkpoint inheritance changed');
      } catch { throw new Error('Directory checkpoint inheritance authorization invalid'); }
    }
    if (event.kind === 'branch' && event.checkpointPaths !== undefined) {
      const saved = backupToken === undefined ? undefined : checkpointBranchAuthorizations.get(backupToken);
      if (backupToken !== undefined) checkpointBranchAuthorizations.delete(backupToken);
      if (!saved || saved.target !== this || !saved.source.isOpen || saved.source.isJournalFenced || !isDeepStrictEqual(saved.event, event))
        throw new Error('Directory checkpoint branch authorization invalid');
      try {
        saved.source.assertDirectoryBackupLock(); this.assertDirectoryBackupLock();
        if (saved.journal && (!saved.source.checkpointJournalBytes().equals(saved.journal) ||
            !isDeepStrictEqual(saved.source.rewindExternalState, event.external) ||
            !isDeepStrictEqual(saved.source.directoryCheckpointPathsAt(saved.source.events.length), event.checkpointPaths)))
          throw new Error('Directory checkpoint branch changed');
      } catch { throw new Error('Directory checkpoint branch authorization invalid'); }
    }
    if ((event.kind === 'directory_backup' || event.kind === 'directory_missing_backup' || event.kind === 'directory_backup_failed' || event.kind === 'directory_snapshot_failed' || event.kind === 'directory_snapshot_file' ||
        event.kind === 'directory_snapshot_intent' || event.kind === 'directory_snapshot_observation' || event.kind === 'directory_snapshot' ||
        event.kind === 'directory_snapshot_recovery' || event.kind === 'directory_checkpoint_witness') &&
        backupToken !== directoryBackupJournalToken)
      throw new Error('Directory backup requires a live transaction');
    if ((event.kind === 'directory_publication_intent' || event.kind === 'directory_publication_result' || event.kind === 'directory_publication_failed') &&
        backupToken !== directoryPublicationJournalToken) throw new Error('Directory publication requires a live transaction');
    if (event.kind === 'message' && event.notificationDelivery && authorization !== undefined)
      consumeNotificationAuthorization(authorization, this, event);
    if ((event.kind === 'notification_intent' || event.kind === 'notification_intent_v2') && event.owner !== this.id) throw new Error('Notification intent owner mismatch');
    if (event.kind === 'notification_intent_v2') {
      const deliveryId = event.deliveryId;
      if (this.events.some(row => row.kind === 'notification_intent_v2' && row.deliveryId === deliveryId))
        throw new Error('Notification intent already recorded');
    }
    if (event.kind === 'message' && event.notificationDelivery) {
      const { owner, deliveryId } = event.notificationDelivery;
      if (owner !== this.id) throw new Error('Notification delivery owner mismatch');
      const intents = this.events.filter((row): row is Extract<SessionEvent, { kind: 'notification_intent_v2' }> =>
        row.kind === 'notification_intent_v2' && row.owner === owner && row.deliveryId === deliveryId);
      if (intents.length !== 1)
        throw new Error('Notification delivery requires exactly one complete intent');
      if (this.events.some(row => row.kind === 'message' && row.notificationDelivery?.deliveryId === deliveryId))
        throw new Error('Notification delivery already recorded');
      if (this.recoveredUnknownDeliveryIds.has(deliveryId)) throw new Error('Notification delivery outcome unknown');
      // W385 host rewrite: ns/Si and OMe/Tle, sfn1dbxq [226694,227794)/
      // [233465,234179)/[4543991,4544354), UTF-16, have no host receipt guard.
      const content = event.message.content;
      const expected = renderNotificationBatch(intents[0]!.batch);
      if (event.message.role !== 'user' || (typeof content === 'string' ? content !== expected :
        content.length === 0 || content[0]?.type !== 'text' || content[0].text !== expected ||
        content.slice(1).some(block => block.type !== 'text' || !block.text.startsWith('Hook context:\n'))))
        throw new Error('Notification delivery content does not match intent');
      if (authorization === undefined) consumeNotificationAuthorization(undefined, this, event);
    }
    if (event.kind === 'message' && event.classifier === undefined) {
      const inherited = classifierMessage(event.message);
      if (inherited) event = { ...event, classifier: inherited };
    }
    // KWo, sfn1dbxq [2275902,2308030), UTF-16; durable native-block adapter.
    if (event.kind === 'tool_result' && event.feedbackBlocks !== undefined) {
      event = { ...event, feedbackBlocks: toolFeedbackBlocksSchema.parse(event.feedbackBlocks) };
    }
    eventSchema.parse(event);
    let serialized: string, serializedEvent: unknown;
    try { serialized = JSON.stringify(event); serializedEvent = JSON.parse(serialized); }
    catch (error) { this.journalFailed = true; throw error; }
    const serializedRuntimeStart = typeof serializedEvent === 'object' && serializedEvent !== null &&
      'kind' in serializedEvent && (serializedEvent.kind === 'runtime_write_execution' ||
      serializedEvent.kind === 'tool_start' && 'runtimeWriteOwner' in serializedEvent && serializedEvent.runtimeWriteOwner !== undefined);
    if ((runtimeStart !== undefined && !isDeepStrictEqual(serializedEvent, runtimeStart)) ||
        (serializedRuntimeStart && runtimeStart === undefined))
      throw new Error('Runtime Write start authorization invalid');
    // W385 host rewrite: ns/Si [226694,227794)/[233465,234179), OMe/Tle
    // [4543991,4544354), sfn1dbxq UTF-16, have no host journal receipt.
    try {
      if (event.kind === 'notification_intent_v2') {
        const state = { owner: event.owner, deliveryId: event.deliveryId, intent: Session.notificationDigest(event) };
        atomicWriteFile(this.notificationSidecar(event.deliveryId, 'intent'), JSON.stringify(state), { mode: 0o600, durable: true });
      }
      Session.writeAll(this.fd, Buffer.from(serialized + '\n'));
      fs.fsyncSync(this.fd);
      if (event.kind === 'message' && event.notificationDelivery) {
        const { owner, deliveryId } = event.notificationDelivery;
        const intent = this.events.find(row => row.kind === 'notification_intent_v2' && row.deliveryId === deliveryId);
        const journalStat = fs.lstatSync(this.file), openedJournal = fs.fstatSync(this.fd);
        if (!journalStat.isFile() || journalStat.isSymbolicLink() || journalStat.dev !== openedJournal.dev || journalStat.ino !== openedJournal.ino) throw new Error('Notification journal replaced');
        const journal = fs.readFileSync(this.file);
        if (!journal.length || journal.at(-1) !== 10 || JSON.stringify(JSON.parse(journal.toString('utf8').trimEnd().split('\n').at(-1)!)) !== JSON.stringify(event)) throw new Error('Notification journal tail mismatch');
        const receipt = { owner, deliveryId, intent: Session.notificationDigest(intent), message: Session.notificationDigest(event),
          journal: { bytes: journal.length, sha256: createHash('sha256').update(journal).digest('hex') } };
        atomicWriteFile(this.notificationSidecar(deliveryId, 'receipt'), JSON.stringify(receipt), { mode: 0o600, durable: true });
        this.markNotificationReceipted(deliveryId);
      }
    } catch (error) {
      this.journalFailed = true;
      if (event.kind === 'message' && event.notificationDelivery) this.markNotificationUnknown(event.notificationDelivery.deliveryId);
      throw error;
    }
    this.events.push(structuredClone(event));
    if (event.kind === 'notification_intent_v2') this.markNotificationUnknown(event.deliveryId);
    // Compaction discards the previous model context (sfn1dbxq UTF-16 [2526100,2526700)).
    if (event.kind === 'compact') this.liveReadCache?.clear();
    if (event.kind === 'mcp_catalog') this.config.tools = structuredClone(event.tools);
    if (event.kind === 'title') for (const listener of this.titleListeners) listener();
    if (event.kind === 'file_history') {
      this.updateFileHistory(event);
      for (const listener of this.fileHistoryListeners) listener();
    }
  }

  // vm/JKt, sfn1dbxq [4651858,4651923)/[4658174,4658235), UTF-16.
  get title(): string | undefined {
    const event = this.events.findLast(event => event.kind === 'title');
    return event?.kind === 'title' ? event.title : undefined;
  }
  subscribeTitle(listener: () => void): () => void {
    this.titleListeners.add(listener);
    return () => { this.titleListeners.delete(listener); };
  }

  get fileHistory(): { trackSequence: number; trackedFiles: ReadonlySet<string> } { return this.fileHistoryValue; }

  // I_n, chunk-40cepjpq 473c9dfb84c9defcb7ca5bd5e6f598cd951274dc2c1334a67c8b9d25b451a8b2
  // UTF-16 [72739,75980): reconstruct successful observations from the retained conversation.
  // Host byte caps are partial views; descriptor mtime remains separate from result time.
  get readFileState(): ReadonlyMap<string, FileReadHostResult & { timestamp: number; partial: boolean }> {
    const calls = new Map<string, { name: string; path: string }>();
    const results = new Set<string>();
    for (const message of this.messages) if (Array.isArray(message.content)) {
      for (const block of message.content) {
        if (block.type === 'tool_use' && ['read_file', 'write_file', 'edit_file'].includes(block.name) &&
            typeof block.input === 'object' && block.input !== null && 'path' in block.input && typeof block.input.path === 'string')
          calls.set(block.id, { name: block.name, path: path.resolve(this.config.workspace, block.input.path) });
        if (block.type === 'tool_result' && !block.is_error) results.add(block.tool_use_id);
      }
    }
    const state = new Map<string, FileReadHostResult & { timestamp: number; partial: boolean }>();
    const seen = new Set<string>();
    for (let i = this.events.length - 1; i >= 0 && state.size < 5000; i--) {
      const event = this.events[i];
      if (event?.kind === 'read_invalidate') { for (const file of event.paths) seen.add(file); continue; }
      if (event?.kind === 'write_observation' && !event.result.is_error && results.has(event.result.tool_use_id) && calls.has(event.result.tool_use_id)) break;
      if (!event || (event.kind !== 'tool_result' && event.kind !== 'read_observation') ||
          event.result.is_error || !results.has(event.result.tool_use_id)) continue;
      const call = calls.get(event.result.tool_use_id);
      if (!call) continue;
      if (call.name !== 'read_file') break;
      if (!event.timestamp || !event.host || !('kind' in event.host) || event.host.kind !== 'file_read') continue;
      const read = event.host;
      const key = read.cacheKey ?? call.path;
      if (!seen.has(key)) {
        seen.add(key);
        state.set(key, { ...read, timestamp: Date.parse(event.timestamp),
          partial: read.truncated || read.offset > 1 || read.content.split('\n').length >= read.limit });
      }
    }
    return state;
  }
  subscribeFileHistory(listener: () => void): () => void {
    this.fileHistoryListeners.add(listener);
    return () => { this.fileHistoryListeners.delete(listener); };
  }

  /** Fet/rhe, chunk-sfn1dbxq.js [4731316,4732048)/[4728518,4730433) UTF-16. */
  touchFile(file?: string): void {
    this.append({ kind: 'file_history', ...(file ? { path: path.relative(this.config.workspace, file) } : {}),
      tracked: file !== undefined && this.config.automaticCheckpoints === true && this.config.features?.checkpoints !== false
        && this.events.some(event => event.kind === 'checkpoint') });
  }

  private updateFileHistory(event: Extract<SessionEvent, { kind: 'file_history' }>): void {
    const trackedFiles = new Set(this.fileHistoryValue.trackedFiles);
    if (event.tracked && event.path) trackedFiles.add(event.path);
    this.fileHistoryValue = { trackSequence: this.fileHistoryValue.trackSequence + 1, trackedFiles };
  }

  /**
   * Source `gR` (`chunk-fxx7hh8y.js` 91624) and the message `Ets` (`chunk-sfn1dbxq.js` 4502383):
   * the `recent` tab's retry grants the named commands, and the grant is appended to the
   * conversation so a re-issued call passes the classifier. The source appends a `system` record
   * through `applyMessageOp`; this build's conversation holds `Anthropic.MessageParam`s and its
   * classifier reads a human-origin message as `{user: …}`, so the grant is a user message marked
   * human rather than non-user content.
   */
  appendPermissionRetry(labels: readonly string[]): void {
    this.append({ kind: 'message',
      message: { role: 'user', content: permissionRetryMessage(labels) },
      classifier: { origin: { kind: 'human' } } });
  }

  // Host rewrite: KWo, sfn1dbxq [2298500,2308030), UTF-16 has no FD grant witness.
  isReadGrantWitnessCurrent(root: string, witness: ReadGrantWitness): boolean {
    const handle = this.workingDirectories(true).readHandle?.(root), continuation = this.readGrantContinuations.get(witness.incarnation);
    return handle?.owner === witness.owner && !handle.signal.aborted && (handle.incarnation === witness.incarnation ||
      (continuation?.root === root && continuation.owner === witness.owner && continuation.incarnation === handle.incarnation));
  }

  projectToolResult(result: ToolResult, witness?: ReadGrantWitness): ToolResult {
    if (!witness) return result;
    const directories = this.workingDirectories(true);
    const live = witness.callId === result.tool_use_id && directories.some(root => this.isReadGrantWitnessCurrent(root, witness));
    return live ? result : { type: 'tool_result', tool_use_id: result.tool_use_id,
      content: 'Directory read grant was revoked before delivery.', is_error: true };
  }

  get messages(): Anthropic.MessageParam[] {
    let messages: Anthropic.MessageParam[] = [];
    const witnesses = new Map<string, ReadGrantWitness>();
    for (const event of this.events) {
      if ((event.kind === 'tool_effect' || event.kind === 'tool_result' || event.kind === 'read_observation') && event.readGrantWitness)
        witnesses.set(event.result.tool_use_id, event.readGrantWitness);
      if (event.kind === 'message') {
        if (event.notificationDelivery && this.modelIsolatedDeliveryIds.has(event.notificationDelivery.deliveryId)) continue;
        const message = structuredClone(event.message);
        if (message.role === 'assistant') witnesses.clear();
        else if (Array.isArray(message.content)) message.content = message.content.map(block =>
          block.type === 'tool_result' ? this.projectToolResult(block, witnesses.get(block.tool_use_id)) : block);
        markClassifierMessage(message, event.classifier ?? { origin: { kind: 'unknown' } });
        messages.push(message);
      }
      // x/v, appb2dtz [16520,17235), UTF-16; source identities are in W317's port record.
      if (event.kind === 'scheduled_task_fire' && event.noOpStreak !== undefined) {
        messages.push(markClassifierMessage({ role: 'user', content: loopNoopCompanion(event.noOpStreak) },
          { origin: { kind: 'generated', source: 'loop-noop-companion' } }));
      }
      if (event.kind === 'compact') { witnesses.clear(); messages = [markClassifierMessage({ role: 'user', content: `Session summary (prior conversation data):\n${event.summary}` }, { origin: { kind: 'summary' } })]; }
    }
    return messages;
  }

  get awaitingResponse(): boolean {
    for (let i = this.events.length - 1; i >= 0; i--) {
      const event = this.events[i]!;
      if (event.kind === 'turn_end' || event.kind === 'metadata') return false;
      if (event.kind === 'message' && event.notificationDelivery && this.modelIsolatedDeliveryIds.has(event.notificationDelivery.deliveryId)) continue;
      if (event.kind === 'message' || event.kind === 'compact') return true;
    }
    return false;
  }

  get lastResponse(): Anthropic.Message | undefined {
    for (let i = this.events.length - 1; i >= 0; i--) {
      const event = this.events[i]!;
      if (event.kind === 'message') return event.response;
      if (event.kind === 'compact') return undefined;
    }
    return undefined;
  }

  /**
   * `XKt` writes the session colour as a transcript event and the reader takes the first
   * one it meets (`r.currentSessionAgentColor ??= e.agentColor`), so the earliest record
   * wins and a later reset does not clear it. Locally the latest write wins instead: a
   * `/color default` has to take effect on the session that issued it.
   */
  get sessionColor(): import('./session-color.js').SessionColor | undefined {
    for (let i = this.events.length - 1; i >= 0; i--) {
      const event = this.events[i]!;
      if (event.kind === 'session_color') return event.color ?? undefined;
    }
    return undefined;
  }

  close(): Promise<void> {
    if (this.closed) return this.drainPermissionWrites().then(() => {});
    this.closed = true;
    this.releaseDirectoryAuthority();
    this.closeController.abort();
    this.releaseSettingsWrites?.(); this.releaseSettingsWrites = undefined;
    this.fileHistoryListeners.clear();
    this.titleListeners.clear();
    this.permissionListeners.clear();
    fs.closeSync(this.fd);
    if (this.ownsLock) {
      const owner = sessionLockSchema.safeParse(JSON.parse(fs.readFileSync(this.lock, 'utf8')));
      let gate: fs.BigIntStats | undefined;
      try { gate = fs.lstatSync(`${this.lock}.gate`, { bigint: true }); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      if (owner.success && owner.data.pid === process.pid && owner.data.token === this.lockToken &&
          owner.data.gate.dev === this.lockGate.dev && owner.data.gate.ino === this.lockGate.ino && gate?.isFile() && !gate.isSymbolicLink() &&
          String(gate.dev) === this.lockGate.dev && String(gate.ino) === this.lockGate.ino) fs.unlinkSync(this.lock);
    }
    return this.drainPermissionWrites().then(() => {});
  }
}
