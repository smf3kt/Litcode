# W187/C11 question images, timeout setting and AFK result

Date: 2026-10-19. Source carrier: `extracted-v2/modules/chunk-sfn1dbxq.js`, SHA-256
`4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da`. All ranges
are zero-based UTF-16 half-open. Supporting modules and digests:

- `chunk-24k7d6mw.js` `1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31`
- `chunk-v96accjb.js` `254872d392ad7917b0f7d66e55a4fcac638af5a0ec459ce30f108f404021c499`
- `chunk-ktr9sak2.js` `485ac7186fe7255d928c3985b94b2e97d5f12674f228026e9f68e1f9deb67755`
- `chunk-x0dc37w9.js` `0b4db31ad035eb234d6943552606135e83405b719e32a114283cadad4e957d92`
- `chunk-3cynezh1.js` `c3fc78a29a64dc725d32fe549b7dc11190e7646368c939bb8d61e755799955b3`
- `chunk-14rnebpd.js` `d1ba8228f324b01eb984c0a09eed1095d0bb0e6ace7c295b0c0fdb03a17be810`
- `chunk-rx2nah4x.js` `cfb79b3b3d580f450f8184e5873a686eb083e9ea3abd4e0a58268425de6acc51`

## Ported source

Question images:

- `Fo` [1169060,1169368) (`chunk-24k7d6mw.js`): the per-question image store. An
  entry is `{id, type: "image", content, mediaType: _o?.mediaType || "image/png",
  filename, dimensions}` keyed by the question key; removal is in-memory only.
  Ported as `QuestionImages` (`add`/`remove`/`last`/`list`/`flatten`/`clear`).
- `Jet` [1180182,1180348): an empty list returns `undefined`; otherwise every entry
  converts through `mb` and the block list is returned. Ported as
  `questionImageBlocks`.
- `mb` [13228,14061) (`chunk-v96accjb.js`): one image to a native block; a failed
  conversion degrades to the `[Image could not be processed: …]` text block.
  `WNe` [8222,12752) is the decision procedure behind it; `Xuo` [12885,13222) and
  `Juo` [15776,16572) are its palette-webp and direct-webp compressors.
  Ported as `imageCodecBlock`/`imageResize` in `src/image-codec.ts`.
- `P3` [1178668,1179279) and `Qet` [1179279,1179811): allow returns
  `updatedInput` plus `contentBlocks`; the deny/clarification result carries the
  same blocks. The tool boundary admits and forwards them
  (`askEntry`/`executeBlocks` in `src/interaction-tools.ts`).
- `hwe` [1168121,1177646): the dialog consumer. `onImagePaste` calls `Fo` with the
  focused question key; `onRemoveImage` removes from the same map; the review
  submission flattens every question's images. Ported into `TuiTerminal`:
  `chat:imagePaste` (paste chord from `plugin-chain-keys-source.ts`), empty-input
  Backspace removal, per-dialog `QuestionImages`, clear on close, and cancellation
  of an in-flight clipboard capture.

Timeout setting and AFK result:

- `Kdt` [109538,109592) (`chunk-x0dc37w9.js`): reads the `askUserQuestionTimeout`
  setting. `XZe` [1165013,1165119) (`chunk-24k7d6mw.js`) maps `60s`/`5m`/`10m` to
  60000/300000/600000 and `never`/`undefined` to `null`. The settings schema entry
  (`chunk-3cynezh1.js` [261191,261459)) is an optional enum with `.catch(void 0)`.
  Ported as `askUserQuestionTimeoutMs` (`src/tui-afk.ts`), the
  `askUserQuestionTimeout` session/config/settings field (`src/session.ts`,
  `src/runtime.ts`, `src/cli.ts`, `src/reload.ts`), and the grouped-dialog
  `afkTimeoutMs` request field wired in `src/interactive.ts`.
- `Zbe` [1163297,1163934): `T = CLAUDE_AFK_TIMEOUT_MS ?? timeoutMs ?? default`;
  the countdown window is `min(countdownThreshold, T)`; on fire it calls
  `onTimeout(T)`. `ywe` [1177646,1178182) renders
  `auto-continue in Ns · any key to stay`. Ported as `afkTimeoutSettings`,
  `afkCountdown`, `startAfk`/`tickAfk` and `dialogCountdown`.
- `P3` stores `afkTimeoutMs` only when the caller passes it
  (`...h.afkTimeoutMs && {afkTimeoutMs: h.afkTimeoutMs}`); the dialog passes the
  timeout it fired on (`onTimeout: sl` → `P3({... afkTimeoutMs: Qa})`), not the
  observed idle span. The answer schema field
  (`chunk-ktr9sak2.js` [12031,12222)) documents it as set only on auto-resolve.
  Ported through `TerminalPromptAnswer.afkTimeoutMs`, the interactive answer, and
  the ask host-answer shape (`afkTimeoutMs: z.number().int().positive().optional()`).
- The result renderer `mapToolResultToToolResultBlockParam`
  (`chunk-ktr9sak2.js` [17751,19621)) has `W` [12467,12694): an AFK result is
  `No response after Ns — the user may be away from keyboard. Proceed using your
  best judgment based on the context so far; you can re-ask this question later if
  it's still relevant.` and, when answers were already taken,
  `\n\nBefore going idle the user had selected: <"question"="answer" entries>.`
  Entries join `", "`; a question with notes only is
  `"question"=(no option selected)`, followed by `notes: …` and
  `selected preview:\n…`.

## Adaptations and dispositions

- No image engine. The source decodes and encodes through `Bun.Image`; this host
  has none, so `WNe`'s first decode step fails exactly like the source's diskless
  stub (`ERR_IMAGE_DECODE_FAILED`) and control reaches the recovery path, which
  measures the original bytes from the file header (`K1`) and returns them
  unchanged when they already fit the API contract. The source's
  "could not verify image dimensions" branch requires a decoder that returns
  metadata without dimensions; with no decoder it is unreachable, so a
  header-readable image over the pixel limit correctly produces the recovery
  text (`… at WxHpx it is over the 2000x2000px limit, so it cannot be sent. …`).
  `rejectBounds` keeps `rejectMax*` at the configured maxima; a future dynamic
  `image_limits` source must carry its own reject fields into `ImageLimits`.
- Structured results. This product returns JSON tool results, so the source's
  AFK tool_result prose travels as a `notice` field beside
  `answers`/`afkTimeoutMs`; the other renderer branches stay represented by the
  structured answer fields (the established product contract).
- `afkTimeoutMs` is a host field. The model-input admission refuses it
  (`host_field`), which `admitCardAnswer` already enforced.
- `dialogExpiry` (`Ade` [216426,216500) `chunk-14rnebpd.js`;
  `CLAUDE_CODE_USER_DIALOG_TIMEOUT_MS` override; settings enum
  `chunk-3cynezh1.js` [261459,262093)) has two consumers. The remote-client
  parked-dialog half is part of the excluded account/remote feature set. The
  local half is the held cross-session approval window (`chunk-rx2nah4x.js`
  `JUt` callback [493933,494541)): a held message whose cause is `mode-mismatch` or
  `no-mode-asserted` arms a timer for `Ade()` ms; at expiry, if it is still held
  and no approval surface parked it, it is dropped with an `expired` receipt.
  `never` and a non-positive value disable the timer; a unit-suffixed environment
  value is not numeric and falls back to the setting (the recovered release-note
  fix). Ported as `heldApprovalTimeoutMs` and the `HeldQueue` expiry map in
  `src/local-peer.ts`, with the `dialogExpiry` session/config/settings field and
  the transport getter that keeps a reload live. This product has no separate
  held-approval prompt, so expiry is the same drop-with-expired outcome as the
  source's no-approval-surface branch.
- The setting applies to the grouped modal dialog. The line-reader question path
  has no countdown and never sets the marker.

## Validation

- Check clean; `test/interaction-tools.test.ts` 47/47 with `test/question-images.test.ts`,
  `test/tui.test.ts` 59/59, `test/reload.test.ts` with `test/runtime.test.ts` 26/26.
- Full suite 2647/2647; build clean; identity `6e81d1b6…`.
