/**
 * Recovered AFK timeout state from `Zbe` and `ywe` (chunk-24k7d6mw.js
 * [1163297,1163934) and [1177646,1178182)). The source components time the
 * dialog while the terminal is unfocused: every idle second past the threshold
 * is shown as `auto-continue in Ns · any key to stay`, and reaching the timeout
 * submits the answers taken so far. Environment parsing follows the source
 * `M.int()` schema: a non-finite value reads as unset.
 */
export interface AfkTimeoutSettings {
  timeoutMs: number;
  countdownMs: number;
}

export interface AfkCountdown {
  remainingSeconds: number;
  showCountdown: boolean;
}

function intEnv(value: string | undefined): number | undefined {
  const text = value?.trim();
  if (!text) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * `enabled` is the source gate `(we !== null || env.CLAUDE_AFK_TIMEOUT_MS !==
 * void 0)`: a null request field disables AFK unless the environment sets a
 * timeout, while an absent field with no environment timeout also stays off.
 * The environment value overrides the request field, and the countdown window
 * is clamped to the timeout.
 */
export function afkTimeoutSettings(
  requested: number | null | undefined,
  env: Readonly<Record<string, string | undefined>> = process.env,
): AfkTimeoutSettings | undefined {
  const envTimeout = intEnv(env.CLAUDE_AFK_TIMEOUT_MS);
  if (envTimeout === undefined && (requested === undefined || requested === null)) return undefined;
  const timeoutMs = envTimeout ?? requested ?? 60_000;
  return { timeoutMs, countdownMs: Math.min(intEnv(env.CLAUDE_AFK_COUNTDOWN_MS) ?? 20_000, timeoutMs) };
}

/** The source tick's remaining/countdown computation, with the same ceiling. */
export function afkCountdown(settings: AfkTimeoutSettings, fullSeconds: number, elapsedMs: number): AfkCountdown {
  const remainingSeconds = elapsedMs >= settings.timeoutMs - settings.countdownMs
    ? Math.max(0, Math.ceil((settings.timeoutMs - elapsedMs) / 1000))
    : fullSeconds;
  return { remainingSeconds, showCountdown: remainingSeconds * 1000 <= settings.countdownMs };
}
