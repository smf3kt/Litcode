# -*- coding: utf-8 -*-
"""Wave D step 7u cut: the SDK transport lane.

Deletes cli/remoteIO.ts and cli/transports/ (the WebSocket/SSE/Hybrid
transports, the CCR v2 client and its uploaders) and the --sdk-url option
that selected RemoteIO. Every removed surface connected a print-mode session
to a remote session endpoint; the local StructuredIO/stream-json path stays.
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


M = 'main.tsx'

cut(M, """  const hasSdkUrl = cliArgs.some(arg => arg.startsWith('--sdk-url'))
  const isNonInteractive =
    hasPrintFlag || hasInitOnlyFlag || hasSdkUrl || !process.stdout.isTTY
""", """  const isNonInteractive =
    hasPrintFlag || hasInitOnlyFlag || !process.stdout.isTTY
""")

cut(M, """      // Extract remote sdk options
      const sdkUrl = (options as { sdkUrl?: string }).sdkUrl ?? undefined

""")

cut_between(
    M,
    '      // Auto-set input/output formats, verbose mode, and print mode when SDK URL is provided\n',
    '      // Validate session ID if provided\n',
)

cut(M, """        // When --sdk-url is provided (bridge/remote mode), the session ID is a
        // server-assigned tagged ID (e.g. "session_local_01...") rather than a
        // UUID. Skip UUID validation and local existence checks in that case.
        if (!sdkUrl) {
          const validatedSessionId = validateUuid(sessionId)
          if (!validatedSessionId) {
            process.stderr.write(
              chalk.red('Error: Invalid session ID. Must be a valid UUID.\\n'),
            )
            process.exit(1)
          }

          // Check if session ID already exists
          if (sessionIdExists(validatedSessionId)) {
            process.stderr.write(
              chalk.red(
                `Error: Session ID ${validatedSessionId} is already in use.\\n`,
              ),
            )
            process.exit(1)
          }
        }
""", """        const validatedSessionId = validateUuid(sessionId)
        if (!validatedSessionId) {
          process.stderr.write(
            chalk.red('Error: Invalid session ID. Must be a valid UUID.\\n'),
          )
          process.exit(1)
        }

        // Check if session ID already exists
        if (sessionIdExists(validatedSessionId)) {
          process.stderr.write(
            chalk.red(
              `Error: Session ID ${validatedSessionId} is already in use.\\n`,
            ),
          )
          process.exit(1)
        }
""")

cut_between(
    M,
    '      // Validate sdkUrl is only used with appropriate formats (formats are auto-set above)\n',
    '      // Validate replayUserMessages is only used with stream-json formats\n',
)

cut(M, "            sdkUrl,\n")

cut_between(
    M,
    '  // Enable SDK URL for all builds but hide from help\n',
    "  if (feature('HARD_FAIL')) {\n",
)

# ------------------------------------------------------------------ print.ts
P = 'cli/print.ts'

cut(P, "import { RemoteIO } from 'src/cli/remoteIO.js'\n")
cut(P, """    fallbackModel: string | undefined
    sdkUrl: string | undefined
""", """    fallbackModel: string | undefined
""")
cut(P, "  const isUsingSdkUrl = Boolean(options.sdkUrl)\n")
cut(P, "  // Check if we need input prompt - skip if we're resuming with a valid session ID/JSONL file or using SDK URL\n",
      "  // Check if we need input prompt - skip if we're resuming with a valid session ID/JSONL file\n")
cut(P, "  if (!inputPrompt && !hasValidResumeSessionId && !isUsingSdkUrl) {\n",
      "  if (!inputPrompt && !hasValidResumeSessionId) {\n")
cut(P, """  // When using SDK URL, always use stdio permission prompting to delegate to the SDK
  const effectivePermissionPromptToolName = options.sdkUrl
    ? 'stdio'
    : options.permissionPromptToolName
""", """  const effectivePermissionPromptToolName = options.permissionPromptToolName
""")
cut(P, """  options: {
    sdkUrl: string | undefined
    replayUserMessages?: boolean
  },
""", """  options: {
    replayUserMessages?: boolean
  },
""")
cut(P, """  // Use RemoteIO if sdkUrl is provided, otherwise use regular StructuredIO
  return options.sdkUrl
    ? new RemoteIO(options.sdkUrl, inputStream, options.replayUserMessages)
    : new StructuredIO(inputStream, options.replayUserMessages)
""", """  return new StructuredIO(inputStream, options.replayUserMessages)
""")

# ------------------------------------------------------------ stale comments
G = 'utils/gracefulShutdown.ts'
cut(G, "    // sessions (--sdk-url, --init-only, non-TTY) don't register their own\n",
      "    // sessions (--init-only, non-TTY) don't register their own\n")

H = 'utils/cliHighlight.ts'
cut(H, "// highlight.js's type defs carry `/// <reference lib=\"dom\" />`. SSETransport,\n// mcp/client, ssh, dumpPrompts use DOM types (TextDecodeOptions, RequestInfo)\n",
      "// highlight.js's type defs carry `/// <reference lib=\"dom\" />`. mcp/client,\n// ssh, dumpPrompts use DOM types (TextDecodeOptions, RequestInfo)\n")

U = 'utils/userAgent.ts'
cut(U, " * Kept dependency-free so SDK-bundled code (bridge, cli/transports) can\n * import without pulling in auth.ts and its transitive dependency tree.\n",
      " * Kept dependency-free so the HTTP helpers and the SDK bundle can import it\n * without pulling in auth.ts and its transitive dependency tree.\n")

C = 'utils/caCertsConfig.ts'
cut(C, " * therefore anything using HTTPS through our proxy agent — WebSocketTransport,\n * CCRClient, telemetry) must NOT depend on that graph, or the Agent SDK\n",
      " * therefore anything using HTTPS through our proxy agent — telemetry) must\n * NOT depend on that graph, or the Agent SDK\n")

# ------------------------------------------------------------ file removal
for rel in [
    'cli/remoteIO.ts',
    'cli/transports/ccrClient.ts',
    'cli/transports/HybridTransport.ts',
    'cli/transports/SerialBatchEventUploader.ts',
    'cli/transports/SSETransport.ts',
    'cli/transports/Transport.ts',
    'cli/transports/transportUtils.ts',
    'cli/transports/WebSocketTransport.ts',
    'cli/transports/WorkerStateUploader.ts',
]:
    path = os.path.join(ROOT, rel)
    assert os.path.exists(path), rel
    os.remove(path)

os.rmdir(os.path.join(ROOT, 'cli/transports'))

print('cut ok')
