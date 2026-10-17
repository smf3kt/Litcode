# -*- coding: utf-8 -*-
"""Wave D step 7v cut: the CCR v2 session-state residue.

Deletes the machinery whose only producer was RemoteIO: the session-state and
session-metadata listeners, the sessionStorage internal-event writer/reader
with hydrateFromCCRv2InternalEvents, the StructuredIO restoredWorkerState
field and the print-mode CCR v2 resume branch with its external-metadata
restore. The local session state, the SDK status stream and the SDK
control-protocol requires_action details stay.
"""
import os

ROOT = '/Users/mant1ssa/Projects/cc-base-2188'


def rd(rel):
    return open(os.path.join(ROOT, rel), encoding='utf-8').read()


def wr(rel, text):
    open(os.path.join(ROOT, rel), 'w', encoding='utf-8').write(text)


def cut(rel, old, new='', n=1):
    text = rd(rel)
    count = text.count(old)
    assert count == n, (rel, 'found', count, 'expected', n, old[:120])
    wr(rel, text.replace(old, new))


def cut_between(rel, start, end, new=''):
    text = rd(rel)
    assert text.count(start) == 1, (rel, 'start', text.count(start), start[:120])
    assert text.count(end) >= 1, (rel, 'end', text.count(end), end[:120])
    i = text.index(start)
    j = text.index(end, i + len(start))
    wr(rel, text[:i] + new + text[j:])


# ------------------------------------------------------------------ print.ts
P = 'cli/print.ts'

cut(P, """import {
  getSessionState,
  notifySessionStateChanged,
  notifySessionMetadataChanged,
  setPermissionModeChangedListener,
  type RequiresActionDetails,
  type SessionExternalMetadata,
} from 'src/utils/sessionState.js'
import { externalMetadataToAppState } from 'src/state/onChangeAppState.js'
""", """import {
  getSessionState,
  notifySessionStateChanged,
  setPermissionModeChangedListener,
  type RequiresActionDetails,
} from 'src/utils/sessionState.js'
""")

cut(P, """import {
  hydrateFromCCRv2InternalEvents,
  resetSessionFilePointer,
""", """import {
  resetSessionFilePointer,
""")

cut(P, "    restoredWorkerState: structuredIO.restoredWorkerState,\n")

cut(P, """    | 'waiting_for_agents'
    | 'finally_flush'
    | 'finally_post_flush'
    | undefined
""", """    | 'waiting_for_agents'
    | undefined
""")

cut(P, "      internal_events_pending: structuredIO.internalEventsPending,\n")

cut(P, """  // The wrapper's body was fully redundant (it enqueued here AND called
  // notifySessionMetadataChanged, both of which onChangeAppState now covers);
  // keeping it would double-emit status messages.
""", """  // The wrapper's body was fully redundant (it enqueued here, which
  // onChangeAppState now covers); keeping it would double-emit status
  // messages.
""")

cut(P, """    } finally {
      runPhase = 'finally_flush'
      // Flush pending internal events before going idle
      await structuredIO.flushInternalEvents()
      runPhase = 'finally_post_flush'
      if (!isShuttingDown()) {
""", """    } finally {
      if (!isShuttingDown()) {
""")

cut(P, "    restoredWorkerState: Promise<SessionExternalMetadata | null>\n")

cut_between(
    P,
    '      // Hydrate local transcript from remote before loading\n',
    '      // Load the conversation with the specified session ID\n',
)

cut(P, """      // hydrateFromCCRv2InternalEvents writes an empty transcript file for
      // fresh sessions (writeFile(sessionFile, '') with zero events), so
      // loadConversationForResume returns {messages: []} not null. Treat
      // empty the same as null so SessionStart still fires.
      if (!result || result.messages.length === 0) {
        // For URL-based or CCR v2 resume, start with empty session (it was hydrated but empty)
        if (
          parsedSessionId.isUrl ||
          isEnvTruthy(process.env.CLAUDE_CODE_USE_CCR_V2)
        ) {
          // Execute SessionStart hooks for startup since we're starting a new session
          return {
            messages: await (options.sessionStartHooksPromise ??
              processSessionStartHooks('startup')),
          }
        } else {
          emitLoadError(
            `No conversation found with session ID: ${parsedSessionId.sessionId}`,
            options.outputFormat,
          )
          gracefulShutdownSync(1)
          return { messages: [] }
        }
      }
""", """      if (!result || result.messages.length === 0) {
        emitLoadError(
          `No conversation found with session ID: ${parsedSessionId.sessionId}`,
          options.outputFormat,
        )
        gracefulShutdownSync(1)
        return { messages: [] }
      }
""")

cut(P, """          // handleSetPermissionMode sends the control_response; the
          // notifySessionMetadataChanged that used to follow here is
          // now fired by onChangeAppState (with externalized mode name).
""", """          // handleSetPermissionMode sends the control_response; the mode
          // change is mirrored to the SDK status stream by onChangeAppState.
""")

cut(P, "          notifySessionMetadataChanged({ model })\n")

cut(P, """          // If the model changed, inject breadcrumbs so the model sees the
          // mid-conversation switch, and notify metadata listeners (CCR).
""", """          // If the model changed, inject breadcrumbs so the model sees the
          // mid-conversation switch.
""")

cut(P, "            notifySessionMetadataChanged({ model: newModel })\n")

# ------------------------------------------------------------ structuredIO.ts
S = 'cli/structuredIO.ts'

cut(S, "  type SessionExternalMetadata,\n")

cut(S, """  // CCR external_metadata read back on worker start; null when the
  // transport doesn't restore. Assigned by RemoteIO.
  restoredWorkerState: Promise<SessionExternalMetadata | null> =
    Promise.resolve(null)

""")

cut(S, """  /** Flush pending internal events. No-op for non-remote IO. Overridden by RemoteIO. */
  flushInternalEvents(): Promise<void> {
    return Promise.resolve()
  }

  /** Internal-event queue depth. Overridden by RemoteIO; zero otherwise. */
  get internalEventsPending(): number {
    return 0
  }

""")

# ----------------------------------------------------------- sessionState.ts
T = 'utils/sessionState.ts'

cut(T, """/**
 * Context carried with requires_action transitions so downstream
 * surfaces (CCR sidebar, push notifications) can show what the
 * session is blocked on, not just that it's blocked.
 *
 * Two delivery paths:
 * - tool_name + action_description → RequiresActionDetails proto
 *   (webhook payload, typed, logged in Datadog)
 * - full object → external_metadata.pending_action (queryable JSON
 *   on the Session, lets the frontend iterate on shape without
 *   proto round-trips)
 */
""", """/**
 * Context carried with requires_action transitions so SDK consumers can
 * show what the session is blocked on, not just that it's blocked.
 */
""")

cut(T, """  /** Raw tool input — the frontend reads from external_metadata.pending_action.input
   * to parse question options / plan content without scanning the event stream. */
  input?: Record<string, unknown>
""", """  /** Raw tool input, so a consumer can parse question options or plan
   * content without scanning the event stream. */
  input?: Record<string, unknown>
""")

cut_between(
    T,
    '// CCR external_metadata keys — push in onChangeAppState, restore in\n// externalMetadataToAppState.\n',
    'type SessionStateChangedListener = (',
)

cut(T, """type SessionStateChangedListener = (
  state: SessionState,
  details?: RequiresActionDetails,
) => void
type SessionMetadataChangedListener = (
  metadata: SessionExternalMetadata,
) => void
type PermissionModeChangedListener = (mode: PermissionMode) => void

let stateListener: SessionStateChangedListener | null = null
let metadataListener: SessionMetadataChangedListener | null = null
let permissionModeListener: PermissionModeChangedListener | null = null

export function setSessionStateChangedListener(
  cb: SessionStateChangedListener | null,
): void {
  stateListener = cb
}

export function setSessionMetadataChangedListener(
  cb: SessionMetadataChangedListener | null,
): void {
  metadataListener = cb
}

/**
 * Register a listener for permission-mode changes from onChangeAppState.
 * Wired by print.ts to emit an SDK system:status message so CCR/IDE clients
 * see mode transitions in real time — regardless of which code path mutated
 * toolPermissionContext.mode (Shift+Tab, ExitPlanMode dialog, slash command,
 * bridge set_permission_mode, etc.).
 */
""", """type PermissionModeChangedListener = (mode: PermissionMode) => void

let permissionModeListener: PermissionModeChangedListener | null = null

/**
 * Register a listener for permission-mode changes from onChangeAppState.
 * Wired by print.ts to emit an SDK system:status message so IDE clients see
 * mode transitions in real time — regardless of which code path mutated
 * toolPermissionContext.mode (Shift+Tab, ExitPlanMode dialog, slash command,
 * set_permission_mode, etc.).
 */
""")

cut(T, """let hasPendingAction = false
let currentState: SessionState = 'idle'
""", """let currentState: SessionState = 'idle'
""")

cut(T, """export function notifySessionStateChanged(
  state: SessionState,
  details?: RequiresActionDetails,
): void {
  currentState = state
  stateListener?.(state, details)

  // Mirror details into external_metadata so GetSession carries the
  // pending-action context without proto changes. Cleared via RFC 7396
  // null on the next non-blocked transition.
  if (state === 'requires_action' && details) {
    hasPendingAction = true
    metadataListener?.({
      pending_action: details,
    })
  } else if (hasPendingAction) {
    hasPendingAction = false
    metadataListener?.({ pending_action: null })
  }

  // task_summary is written mid-turn by the forked summarizer; clear it at
  // idle so the next turn doesn't briefly show the previous turn's progress.
  if (state === 'idle') {
    metadataListener?.({ task_summary: null })
  }

  // Mirror to the SDK event stream so non-CCR consumers (scmuxd, VS Code)
  // see the same authoritative idle/running signal the CCR bridge does.
  // 'idle' fires after heldBackResult flushes — lets scmuxd flip IDLE and
  // show the bg-task dot instead of a stuck generating spinner.
  //
  // Opt-in until CCR web + mobile clients learn to ignore this subtype in
  // their isWorking() last-message heuristics — the trailing idle event
  // currently pins them at "Running...".
  // https://anthropic.slack.com/archives/C093BJBD1CP/p1774152406752229
""", """export function notifySessionStateChanged(state: SessionState): void {
  currentState = state

  // Mirror to the SDK event stream so external consumers (scmuxd, VS Code)
  // see the same authoritative idle/running signal.
  // 'idle' fires after heldBackResult flushes — lets scmuxd flip IDLE and
  // show the bg-task dot instead of a stuck generating spinner.
  //
  // Opt-in until external clients learn to ignore this subtype in their
  // isWorking() last-message heuristics — the trailing idle event currently
  // pins them at "Running...".
  // https://anthropic.slack.com/archives/C093BJBD1CP/p1774152406752229
""")

cut(T, """export function notifySessionMetadataChanged(
  metadata: SessionExternalMetadata,
): void {
  metadataListener?.(metadata)
}

/**
 * Fired by onChangeAppState when toolPermissionContext.mode changes.
 * Downstream listeners (CCR external_metadata PUT, SDK status stream) are
 * both wired through this single choke point so no mode-mutation path can
 * silently bypass them.
 */
""", """/**
 * Fired by onChangeAppState when toolPermissionContext.mode changes.
 * The SDK status stream is wired through this single choke point so no
 * mode-mutation path can silently bypass it.
 */
""")

# print.ts call sites of the removed notify
cut(P, "    notifySessionStateChanged('requires_action', details)\n",
      "    notifySessionStateChanged('requires_action')\n")

# -------------------------------------------------------- onChangeAppState.ts
O = 'state/onChangeAppState.ts'

cut(O, """import {
  permissionModeFromString,
  toExternalPermissionMode,
} from '../utils/permissions/PermissionMode.js'
""")

cut(O, """import {
  notifyPermissionModeChanged,
  notifySessionMetadataChanged,
  type SessionExternalMetadata,
} from '../utils/sessionState.js'
""", """import { notifyPermissionModeChanged } from '../utils/sessionState.js'
""")

cut(O, """// Inverse of the push below — restore on worker restart.
export function externalMetadataToAppState(
  metadata: SessionExternalMetadata,
): (prev: AppState) => AppState {
  return prev => ({
    ...prev,
    ...(typeof metadata.permission_mode === 'string'
      ? {
          toolPermissionContext: {
            ...prev.toolPermissionContext,
            mode: permissionModeFromString(metadata.permission_mode),
          },
        }
      : {}),
  })
}

""")

cut(O, """  // toolPermissionContext.mode — single choke point for CCR/SDK mode sync.
  //
  // Prior to this block, mode changes were relayed to CCR by only 2 of 8+
  // mutation paths: a bespoke setAppState wrapper in print.ts (headless/SDK
  // mode only) and a manual notify in the set_permission_mode handler.
  // Every other path — Shift+Tab cycling, ExitPlanModePermissionRequest
  // dialog options, the /plan slash command, rewind, the REPL bridge's
  // onSetPermissionMode — mutated AppState without telling
  // CCR, leaving external_metadata.permission_mode stale and the web UI out
  // of sync with the CLI's actual mode.
  //
  // Hooking the diff here means ANY setAppState call that changes the mode
  // notifies CCR (via notifySessionMetadataChanged → ccrClient.reportMetadata)
  // and the SDK status stream (via notifyPermissionModeChanged → registered
  // in print.ts). The scattered callsites above need zero changes.
  const prevMode = oldState.toolPermissionContext.mode
  const newMode = newState.toolPermissionContext.mode
  if (prevMode !== newMode) {
    // CCR external_metadata must not receive internal-only mode names
    // (bubble, ungated auto). Externalize first — and skip
    // the CCR notify if the EXTERNAL mode didn't change (e.g.,
    // default→bubble→default is noise from CCR's POV since both
    // externalize to 'default'). The SDK channel (notifyPermissionModeChanged)
    // passes raw mode; its listener in print.ts applies its own filter.
    const prevExternal = toExternalPermissionMode(prevMode)
    const newExternal = toExternalPermissionMode(newMode)
    if (prevExternal !== newExternal) {
      notifySessionMetadataChanged({ permission_mode: newExternal })
    }
    notifyPermissionModeChanged(newMode)
  }
""", """  // toolPermissionContext.mode — the SDK status stream's single choke point.
  //
  // Prior to this block, mode changes were relayed by only 2 of 8+ mutation
  // paths: a bespoke setAppState wrapper in print.ts (headless/SDK mode only)
  // and a manual notify in the set_permission_mode handler. Every other path —
  // Shift+Tab cycling, ExitPlanModePermissionRequest dialog options, the /plan
  // slash command, rewind, the REPL bridge's onSetPermissionMode — mutated
  // AppState without telling the SDK, leaving external clients out of sync
  // with the CLI's actual mode.
  //
  // Hooking the diff here means ANY setAppState call that changes the mode
  // notifies the SDK status stream (via notifyPermissionModeChanged →
  // registered in print.ts). The scattered callsites above need zero
  // changes.
  const prevMode = oldState.toolPermissionContext.mode
  const newMode = newState.toolPermissionContext.mode
  if (prevMode !== newMode) {
    notifyPermissionModeChanged(newMode)
  }
""")

# ----------------------------------------------------------- sessionStorage.ts
R = 'utils/sessionStorage.ts'

cut_between(
    R,
    'type InternalEventWriter = (',
    'class Project {',
)

cut(R, """  private internalEventWriter: InternalEventWriter | null = null
  private internalEventReader: InternalEventReader | null = null
  private internalSubagentEventReader: InternalEventReader | null = null
""")

cut(R, """            if (isTranscriptMessage(entry)) {
              await this.persistToRemote(sessionId, entry)
            }
""")

cut_between(
    R,
    '  private async persistToRemote(',
    '\n}\n\nexport type TeamInfo',
)

cut_between(
    R,
    '/**\n * Hydrate session state from CCR v2 internal events.',
    'function extractFirstPrompt(transcript: TranscriptMessage[]): string {',
)

cut(R, "  asSessionId,\n")
cut(R, "import { logForDiagnosticsNoPII } from './diagLogs.js'\n")
cut(R, "import { gracefulShutdownSync, isShuttingDown } from './gracefulShutdown.js'\n",
      "import { gracefulShutdownSync } from './gracefulShutdown.js'\n")

# -------------------------------------------------------------- sessionUrl.ts
U = 'utils/sessionUrl.ts'

cut(U, """export type ParsedSessionUrl = {
  sessionId: UUID
  ingressUrl: string | null
  isUrl: boolean
  jsonlFile: string | null
  isJsonlFile: boolean
}

/**
 * Parses a session resume identifier which can be either:
 * - A URL containing session ID (e.g., https://api.example.com/v1/session_ingress/session/550e8400-e29b-41d4-a716-446655440000)
 * - A plain session ID (UUID)
 *
 * @param resumeIdentifier - The URL or session ID to parse
 * @returns Parsed session information or null if invalid
 */
""", """export type ParsedSessionUrl = {
  sessionId: UUID
  jsonlFile: string | null
  isJsonlFile: boolean
}

/**
 * Parses a session resume identifier which can be either a JSONL transcript
 * path or a plain session ID (UUID).
 *
 * @param resumeIdentifier - The JSONL path or session ID to parse
 * @returns Parsed session information or null if invalid
 */
""")

cut(U, """    return {
      sessionId: randomUUID() as UUID,
      ingressUrl: null,
      isUrl: false,
      jsonlFile: resumeIdentifier,
      isJsonlFile: true,
    }
""", """    return {
      sessionId: randomUUID() as UUID,
      jsonlFile: resumeIdentifier,
      isJsonlFile: true,
    }
""")

cut(U, """    return {
      sessionId: resumeIdentifier as UUID,
      ingressUrl: null,
      isUrl: false,
      jsonlFile: null,
      isJsonlFile: false,
    }
""", """    return {
      sessionId: resumeIdentifier as UUID,
      jsonlFile: null,
      isJsonlFile: false,
    }
""")

cut(U, """  // Check if it's a URL
  try {
    const url = new URL(resumeIdentifier)

    // Use the entire URL as the ingress URL
    // Always generate a random session ID
    return {
      sessionId: randomUUID() as UUID,
      ingressUrl: url.href,
      isUrl: true,
      jsonlFile: null,
      isJsonlFile: false,
    }
  } catch {
    // Not a valid URL
  }

""")

print('cut ok')
