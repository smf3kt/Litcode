/**
 * The thinking-mode toggle dialog. Text and structure are recovered from `SG` at
 * chunk-24k7d6mw.js 625719 (module SHA-256
 * 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31; zero-based UTF-16).
 *
 * | Offset | Contents |
 * | --- | --- |
 * | 625719 | `SG` component |
 * | 625859 / 625941 | `Enabled` / `Disabled` rows and their descriptions |
 * | 626784 | `Toggle thinking mode` title |
 * | 626835 | `Enable or disable thinking for this session.` subtitle |
 * | 627114 / 627288 | mid-conversation warning and `Do you want to proceed?` |
 * | 838388 | `lL` handler (`chat:thinkingToggle`) |
 * | 898567 / 898638 | `kp` accept and `ph` cancel |
 *
 * The handler's `lZt` "thinking is always on" arm needs the model capability table this host has
 * no source for, so the dialog is always offered.
 */

import type { TerminalPromptRequest } from './terminal.js';

export const THINKING_DIALOG_TITLE = 'Toggle thinking mode';
export const THINKING_DIALOG_MESSAGE = 'Enable or disable thinking for this session.';
export const THINKING_MID_CONVERSATION_WARNING =
  'Changing thinking mode mid-conversation will increase latency and may reduce quality. ' +
  'For best results, set this at the start of a session.';

/** `SG` rows at 625859 / 625941, in source order, with the current value preselected. */
export function thinkingDialogRequest(current: boolean): TerminalPromptRequest {
  return {
    title: THINKING_DIALOG_TITLE,
    message: THINKING_DIALOG_MESSAGE,
    choices: [
      { value: 'true', label: 'Enabled', description: 'Claude will think before responding' },
      { value: 'false', label: 'Disabled', description: 'Claude will respond without extended thinking' },
    ],
    defaultIndex: current ? 0 : 1,
  };
}
