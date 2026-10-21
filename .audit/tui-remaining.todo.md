# Remaining TUI display work

Source of the list: `research/FEATURES.md` row 50 (Interactive terminal/headless I/O) plus
the per-package "remain out" notes in the same row. One package per iteration; each one
ends in a record under `research/ports/`, a FEATURES row update and a local commit.

Order is by how much a user sees.

- [x] W196 composer suggestion list takes a click.
- [x] W197 suggestion kind/source lanes: the 7-cell kind lane (`config`/`action`/`info`/
      `agent`/`skill`), the `[tag]` and `[sourceTag]` lanes, the description column the
      source computes from `maxColumnWidth` and 40% of the terminal, and the per-segment
      colour (accent on `skill`/`agent`, `suggestion` when selected, dim otherwise).
      Source `ze` [4084,8770) and `_t`/`ee`/`No` [10298,11400) in
      `chunk-qfjvvpwpv.js`; kind table `Ixs`/`a` in `chunk-wtch2p0g.js`.
- [x] W198 suggestion description wrap: source `Ue`/`_o` give a row a second line when the
      description does not fit, and `iEe` counts row heights. Needs the band hit test to
      map rows to suggestions instead of assuming one row each.
- [x] W199 emoji completion (`:name:`): the `emoji:` id family, its own row branch in `ze`,
      and the `emojiCompletionEnabled` setting. Ported `H0e`/`B0e`/`rse`/`KDt`/`GDt`/`tE`
      from `chunk-24k7d6mw.js`; see `research/ports/W199-emoji-completion.md`.
- [x] W200 file completion (`@path`): the `file-` id family and its three-column layout.
      Ported `mnn`/`SDs`/`ak`/`jre`/`pbn` and the `ze` special branch; see
      `research/ports/W200-file-completion.md`.
- [x] W201 agent completion (`@agent`): the roster provider behind the `agent` lane.
      Ported `tse`/`$0e`/`HDt`/`q0`/`wLe` and the fuse merge; see
      `research/ports/W201-agent-completion.md`.
- [x] W202 MCP resource and template completion: the `mcp-resource-`/`mcp-template-` id
      families and their branches. Ported `He`/`$e`/`$0e`/`ose`/`ese`/`aAt` and the catalog
      listing; see `research/ports/W202-mcp-resource-completion.md`.
- [x] W203 theme storage. Measured first: custom names do resolve and the store does
      round-trip, so the named symptoms were a probe artefact and a misreading. The real gap
      was the suggestion band, whose `slotForeground` dropped the `#rrggbb`/`#rgb`/
      `ansi256(n)` overrides `HK` accepts; it now carries the source's `zye` foreground
      grammar. Source `zye` [3226,4818) and `HK` [20509,20555) in `chunk-5dxmnnh1.js`, `be`
      [5451,5713) and `D` [5713,6254) in `chunk-04m6g9sr.js`; see
      `research/ports/W203-theme-storage.md`.
- [x] W204 Vim immediate/continuous gesture and `editRelay` consumers. Scouting first: the Vim
      command table, its pending state machine and the relay host were already ported, so the
      item reduced to the source's own undo push `tx` (`Du`). Ported it as `pushUndo` behind
      `EditorPolicy.undoPush`, plus the `ds` mode-change reset. Source `tx` [829348,829655),
      `ds` [819278,819346), `Er = R(!1)` 819252, `ss = Ww()`/`Xn = Dh()` 819236 in
      `chunk-24k7d6mw.js`; see `research/ports/W204-undo-gesture.md`.
- [x] W205 footer service branches beyond the current port. The one branch with local data is
      the permission-mode chip: ported `DR` and the `ur` descriptor table, bound to the session's
      effective mode, with the `Ei` interrupt branch while a turn runs. Source `DR`
      [628129,628675) in `chunk-24k7d6mw.js`, `ur` [69464,70196) in `chunk-3cynezh1.js`; see
      `research/ports/W205-footer-mode-chip.md`.
- [x] W206 time widgets and the remaining timestamp consumers. Ported the `Os` stamp gate
      [128934,129659) and `Va`'s clock choice with `fKo`/`mKo` from `chunk-7d9mja9n.js`;
      `showMessageTimestamps` now flows from the settings file to the transcript, and each
      message carries its arrival time. See `research/ports/W206-message-stamps.md`.
- [x] W207 unavailable-paste UI. Ported the submit strip `jE`/`kPn`, the notice `Fdr` and the
      local submit branch at 1345194 in `chunk-24k7d6mw.js`: a placeholder whose paste record is
      gone is cut from the prompt, announced on the status row for the source's 8000 ms, and a
      prompt left empty (or a slash command) is handed back with its caret at the end. The
      history binding now keeps the unavailable marker instead of dropping it. See
      `research/ports/W207-paste-gone-ui.md`.
- [x] W209 a pending dialog keeps the chat frame. `renderDialog` takes its body height from the
      caller, the transcript keeps the top third, the footer stays on the last row, and the cursor
      sits on the dialog's own answer row. See `research/ports/W209-dialog-chat-frame.md`.
- [x] W210 the built-in `/loop` command: the recovered parse-and-schedule prompt becomes the user
      turn, with the tool display names mapped to this host's registry and the composer's
      suggestion row. The no-argument autonomous default is W208's. See
      `research/ports/W210-loop-command.md`.
- [x] W211 the `/workflows` panel: the run list, a run detail and a task card, over a read-only
      dialog form that draws rows without an answer input. See
      `research/ports/W211-workflows-panel.md`.
- [x] W208 native storage V5 / transformed session-storage producers. Split out of W207 as a durable
      service; the one thing this product needs it for is the `loop.md` file `/loop` reads, so it
      landed as the loop-file runtime: the four sentinels, the truncation, the project-then-user
      resolution, the tick texts, the delivery state, the autonomous default and the `/cron` label.
      Native storage V5 is the stub `Mbr` in this build, so the recovered direct-`fs` fallback is the
      live path. See `research/ports/W208-loop-file-runtime.md`.
- [x] W212 the `/effort` command. The recovered argument grammar (`yhn`/`g`/`qJ`/`D`/`V`/`VBt`/`P`),
      the persistable-level write through `X9`/`we`, the `LLM_EFFORT` override and the `eee`
      level-change notice. See `research/ports/W212-effort-command.md`.
- [x] W213 `/copy [N]`. The recovered newest-first collection capped at 20, the argument arms, the
      byte-exact OSC 52 request through its own sink, and the scratch file and report. See
      `research/ports/W213-copy-command.md`.
- [x] W214 `/autocompact [auto|<tokens>]`. The recovered parser (`fVt` with the `m`/`k` multipliers
      and the thousand shorthand), the two-source resolver (`aE`, `Mwt`), the status block (`w`),
      the setter (`$2t`) and the window dialog (`ue`) with its step, its bounds and its auto
      sentinel. See `research/ports/W214-autocompact.md`.
- [x] W215 model selection. The recovered picker host: the `Select model` title and caption, the
      `Current model` row description, the effort axis (`KHe`) on left/right with its
      `glyph level effort (default)` line, the `s` session-only accept, and the default write to
      `userSettings.model`. Needed two dialog-host additions in `src/tui.ts` (an `adjust` axis and
      request-declared keys). See `research/ports/W215-model-picker.md`.

- [x] W216 `/color [red|blue|green|yellow|purple|orange|pink|cyan|default]`. The recovered name
      list, the five reset words, the random pick for an empty argument and the verbatim invalid
      line, plus `p2`/`bLe` over the eight slots; the visible surface is `Mk`'s banner rule, which
      exists only while a colour or a title needs it. See `research/ports/W216-color.md`.

- [x] W217 `/keybindings`. `k9t`'s path, `a`/`m`'s create-once template with `QDe`'s seven
      unrebindable keys stripped, and `O`'s `wx` write whose `EEXIST` arm selects the `Created`
      or `Opened` report. The template is the local reader's flat sequence map, not the recovered
      context document. Also added the missing editor capability: `Zie` without the draft write,
      exposed as `openFile` on both terminal surfaces. See `research/ports/W217-keybindings.md`.

- [x] W218 `/scroll-speed`. The value model (`v4n`'s auto step, `k`'s snap and clamp, `Me`'s
      ruler, `Dt`/`xe`'s terminal row, `I`'s notch text), the chooser over the reachable values
      plus `auto`, the settings `env` write and the live variable, and the recovered save, reset
      and cancel lines. The settings `env` block gained its missing reader
      (`applyStoredEnvironment`, applied at the start of the interactive loop, where the
      session's own user directory is known). See `research/ports/W218-scroll-speed.md`.

- [x] W219 `/help`. The recovered three-tab panel: the builtin/custom split (`Uo`), the name-sorted
      deduped rows (`U`/`Po`), the General tab's intro and `hft`'s three-column shortcuts table, the
      two browse titles with the custom empty state, the docs footer and the tall-layout feedback
      line. The tabs are the chooser's rows, and `Esc` dismisses. See
      `research/ports/W219-help-panel.md`.

- [x] W220 `/tui`. The recovered argument grammar (`lZ`'s two names, `b1s`'s trim/lowercase and its
      current/unknown/renderer arms) and the three report strings, plus the local refusal for the
      classic arm this build cannot honour. This product draws one renderer — `Rc()`'s fullscreen
      arm, since `TerminalModeController` always enters the alternate screen — and has no relaunch,
      so the setting is not written and the arms that need a second renderer stay out. See
      `research/ports/W220-tui.md`.

- [x] W221 `/add-dir`. The path validator in `gge`'s recovered order with `hge`'s seven messages,
      the `iGt` branch left to fall through, and the success apply through
      `Session.adoptPermissionUpdates` (`{type:'addDirectories', directories:[abs], destination:
      'session'}`) plus `lwn`'s session report. Wiring note resolved: the live interactive loop has
      no `setToolPermissionContext`, but `Session.adoptPermissionUpdates` is the apply-and-persist
      path for the same `SessionPermissionUpdates` shape, so `reducePermissionState` was not
      needed. The `localSettings` destination, the non-interactive `local` registration, `iGt`'s
      skills-loading note and the `local-jsx` path box stay out; an empty argument reaches the
      usage arm because this build is fullscreen-only, where `Slo.immediate` holds. See
      `research/ports/W221-add-dir.md`.

- [x] W223 `/hooks`. Both units landed: `src/hooks-event-metadata.ts` (the `igt` transcription with
      the `$p` labels) and `src/hooks-panel.ts` (the four surfaces of the recovered `ft` machine, the
      type tables, the guidance arms and `attributeHooks`), wired in `src/interactive.ts` with
      `hookSettingsLayers` and the piped-session text form. The source of each merged hook is
      recovered by matching it back to the layer that declares it, since the local config folds
      plugin declarations and every settings layer into one `config.hooks`. See
      `research/ports/W223-hooks.md`.

- [x] W224 `/reload-skills`. The recovered body `v` (`chunk-hyft8yrm.js` [13938,14479), exported as
      `call`): snapshot the catalog by name, rescan in place, report the added and removed counts.
      The rescan is the existing `reloadSkills`; the composer keeps the command list it captured at
      startup, so the rebuilt rows are handed back through a new `TerminalSurface.setCommands`, the
      local counterpart of the recovered `Nhr`/`Fhr` voiding the shared command and skill tables
      (`chunk-3ph567jx.js` 3862/3898). The cloud-sync invalidation `gL()`, the MCP and synced-skill
      merge `JOn`/`tre` and the safe-mode suffix `Tr()` stay out. See
      `research/ports/W224-reload-skills.md`.

- [x] W222 surface sweep of the commands reported as unresponsive. `.audit/w222-surface-sweep.mjs`
      passes 8 checks over the compiled CLI: `/workflows` opens the dynamic-workflows dialog with
      its empty message and `Esc close` footer; bare `/loop` expands to a user turn rather than
      opening a dialog (the recovered `se` prompt-expansion path); `/tasks`, `/cron`, `/status`,
      `/context` and `/usage` each print their report. The `/effort` (W212) and `/model` (W215)
      probes also still pass, so the two surfaces the request named by example are healthy.

- [x] W225 `/focus`. The first renderer-level package of the loop. Both recovered registrations
      (`bEo` the panel, `PWe` the `local` twin with `r` [4693,5262) as its body): the
      `on`/`off`/empty-toggle grammar, the recovered invalid line, the `viewMode` write into the user
      settings file and the live flag the renderer reads. The brief transcript is `vNt`'s fold: while
      a tool call runs, the in-flight streaming preview comes off screen and the retained source text
      is re-appended when the fold ends. The non-fullscreen arm, the managed-`viewMode` override, the
      local-stdin refusal, the panel's key clear and the remote suffix stay out. See
      `research/ports/W225-focus.md`.

Next up, scoped but not started:

- [x] W226 `/permissions`, part one. The panel shell, the Allow/Ask/Deny rule tabs with their
      intros and sorted rows, the add-rule input and its save-scope picker, the detail pane with its
      three read-only arms and its delete confirm, the deny-then-ask shadow analysis with the Bash
      sandbox exemption, and the four report strings. The dialog accumulates its reports and returns
      them joined as the command's result (the recovered `wu`), rendered through `writeNotice` as one
      `system` transcript entry. See `research/ports/W226-permissions.md`.
- [x] W227 `/permissions`, part two: the Workspace tab. The directory list in insertion order under
      the shared label dedup, the add row last, the original-directory row, the removal confirm
      (`xn`) and the path input (`TXe`) with its validation message, the two reports, and the tab's
      own dismissal message. See `research/ports/W227-workspace.md`.
- [x] W228 `/permissions`, part three: the `recent` tab. The denial store (`pEe`, `chunk-frj2b06g.js`
      2696: `getDenials`/`recordDenial`/`removeDenial`, cap 20, newest first), the record written at
      the classifier's own refusal (`{toolName, display, inputKey, reason}`, `chunk-24k7d6mw.js`
      1506012), the list `Rn`/`Wr` with its status icons and the `r` retry mark, and the Esc apply
      `bu`: approved rows leave the store and report `Approved <labels>`, a retry appends
      `Allowed <labels>` as a human-origin message and starts a turn. The panel now opens on
      `recent` whenever the list is non-empty. `.audit/w228-live.mjs` drives the whole path against
      the compiled CLI with a Messages-API stub standing in for the model (9 checks); the grant check
      keys on the human-origin rendering and was proven to fail when that origin is wrong. See
      `research/ports/W228-recent-denials.md`.
- [x] W229 `/permissions`, part four: the `automode` tab. The intro, the four sections with their
      builtins rows (the count read out of the classifier's rules document by `SL`/`Rue`), the
      `· off`/`· from <source>` states `me` derives, the entry rows in `Vm`'s column with their
      `flag`/`org` tags, the environment document row `hi` and the two read-only cards `Hn`/`Nn`.
      The add/edit/delete and document-editor writes (`Jr`/`ts`/`os`/`Xr`/`qr`/`Ho`) are W230; the
      legacy `autoMode.deny` arm is out because this build's classifier does not enforce it. See
      `research/ports/W229-automode.md`.

Next up, scoped but not started:

- [x] W230 `/permissions`, part five: the `automode` writes. The settings-document writer `Ho` with
      its three refusals, the add input and section picker, the edit and delete arms, the builtins
      toggle `Xr` (which splices or removes `$defaults`), and the environment document editor `qr`
      with `wl`'s validation. Turns W229's `enter to view` back into the recovered `enter to edit`.
      Recovered source is already mapped, with offsets and digests, in
      `.audit/w230-automode-writes.md`. Completed with 20/20 compiled checks and three regression
      groups; conflict refresh and recent-denial continuity were independently reviewed.
      See `research/ports/W230-automode-writes.md`.

- [x] W231 `/effort` interactive axis. Recovered 42-cell track, five label positions, selected
      colors, xhigh shimmer, max rainbow/note, left/right clamp, Enter/default and s/session scope.
      Same-level Enter now saves; cancel preserves state. Actual request effort resolves the
      environment override separately from the session choice. Three regression groups, compiled
      slider 18/18, argument path 14/14 and model picker 11/11; independent review accepted.
      See `research/ports/W231-effort-slider.md`.

- [x] W232 model picker list. Gse canEnter=false closes the preliminary search candidate.
      Ported numbered current/focus rows, wrap/page/Home/End, numeric/pointer acceptance,
      wheel viewport, measured narrow rows, explicit effort touch and same-model default save.
      Check/build, 135/135 related, compiled picker 23/23 at 90/20/24 columns, prior model 11/11
      and slider 18/18 pass. Independent narrow hidden-focus defect repaired and rechecked.
      See `research/ports/W232-model-picker.md`. Account-backed catalogue stays excluded.

- [x] W233 `/config` local list. Nine settings, source search and line viewport, immediate writes,
      Theme/Time format/Model child return, per-model effort defaults, errors and restart pass
      compiled acceptance 35/35. Check/build and 264 affected tests pass. Six independent findings
      repaired and rechecked. See `research/ports/W233-config-panel.md`.
- [x] W234 Config Auto-compact enable. Default true, immediate user persistence, live/reloaded/
      restored boolean, neutral environment gates, automatic and manual separation, hard capacity
      and oversized-summary recovery. Compiled chain 26/26, Config compatibility 35/35 and 164
      related regressions pass; independent recheck 13/13 at 50e07b23. See
      `research/ports/W234-autocompact-toggle.md`.
- [x] W235 Config Verbose output. Independent persisted boolean with viewMode-first startup and
      stored fallback, live successor application, restart/resume, `/focus` reuse and live
      Read/list/search/error result rows with recovered gutters and transcript-screen detail.
      Compiled 20/20, 89 affected regressions and check/build pass; full suite 2977/2978 with the
      CLI-effort failure reproduced at HEAD. Independent review fixes: precedence, blank-line
      count, reload fallback, unfinished-turn refusal, uncapped detailed tool rows. Thinking,
      Bash/edit/MCP and nested renderers stay unported. See `research/ports/W235-verbose-view.md`.
- [x] W236 Config Terminal progress bar. Default-on row after Verbose with user persistence,
      fresh/reload/live successor application and restart. An agent turn writes the recovered
      OSC 9;4 indeterminate sequence and clears when idle, gated by iTerm2/Ghostty/ConEmu and
      wrapped for tmux/screen; disabled or unsupported terminals stay silent. Compiled 10/10,
      89 affected regressions and check/build pass; full suite 2980/2981 with the CLI-effort
      failure reproduced at HEAD. Independent review's low findings are closed. See
      `research/ports/W236-terminal-progress.md`.
- [x] W237 Config Default permission mode. Enum row after Time format reads the merged settings
      `permissions.defaultMode` (not the live mode), cycles default/plan/acceptEdits/auto/dontAsk,
      persists the nested userSettings value while preserving authored rules, keeps higher layers
      authoritative, survives resume and is adopted live by a fresh session with no mode flag.
      Compiled 13/13, 28 affected regressions and check/build pass; full suite 2980/2981 with the
      CLI-effort failure reproduced at HEAD. Independent review's medium and low items are closed.
      See `research/ports/W237-permission-mode.md`.
- [x] W238 shift+tab permission-mode cycle. The Chat keybinding advances the live mode by the
      recovered `BBt` order (manual -> accept edits -> plan -> auto -> manual; plan reaches bypass
      only for a launch-granted bypass session), applies through the existing `/permissions MODE`
      transition, updates the chip and writes no settings. Launch-granted bypass availability is
      carried across a live mode change; a press that lands before the previous queued step runs
      computes from that pending step and a wrap repeats a queued step; the vendor auto gate has a
      documented adapter; the key is inert during a turn. Compiled 14/14 and cycle/TUI tests pass;
      full suite 2986/2987 with the CLI-effort failure reproduced at HEAD. Independent review found
      no high findings; its wrap-drop medium is fixed, its Windows branch medium is refuted by the
      resolved `le`, and its low items are closed.
      See `research/ports/W238-shift-tab-cycle.md`.
- [x] W239 input-bar send-now and queue-submit. ctrl+x ctrl+s and ctrl+enter (`chat:sendNow`, source
      `e9`/`Zat`/`tlt`) queue a non-empty draft and cancel the running turn so the queued prompt
      sends immediately (the recovered fallback; this host has no low-latency mid-turn channel); an
      empty composer with an empty queue is a no-op, and with a queued prompt it only flushes it.
      ctrl+x enter (`chat:queueSubmit`, source `Bq`) submits
      the draft as a queued submission. The TUI owns submission, the interactive loop owns the
      abort. Compiled 11/11 at identity `2fa9da4b1…`, 73 TUI tests and check/build pass; full suite
      2987/2988 with the CLI-effort failure reproduced at HEAD. Independent review found no blocking
      defect; its low items are fixed and its two mediums are recorded adapters (no local draft
      mode; approval dialog owns the keyboard). See `research/ports/W239-send-now.md`.
- [x] W240 queued-prompt selection and pop-to-edit. An empty draft paints the recovered hints;
      with `CLAUDE_CODE_KB_COHESION_FIXES` up/down select the editable queue (newest first toward
      the oldest), Enter pulls the selected prompt above the draft via the source merge and
      removes it from the loop queue, Escape clears the selection without cancelling, and a stale
      index consumes the key; without the flag up is the recovered `popAllEditable` default and
      pulls every editable queued prompt. Internal slash commands are source `isMeta` and stay
      unselectable; event prompts are excluded. Compiled 15/15 at identity `9b389688…`, 75/75 TUI
      tests and check/build pass; full suite 2989/2990 with the CLI-effort failure reproduced at
      HEAD. Independent review returned SOUND; its mediums (Vim external mutation on pull,
      attachment replace/dismiss, SessionStart meta) are fixed and its lows assessed.
      See `research/ports/W240-queue-edit.md`.
- [x] W241 clear chords repaint the screen. The source binds `chat:clearInput` (ctrl+l) and
      `chat:clearScreen` (cmd+k) to one handler `yM` (chunk-24k7d6mw.js 881185): a counter
      increment whose only effect calls `forceRedraw()`. Both chords now invalidate the renderer
      and repaint (the alt-screen repaint writes `ESC[2J ESC[3J` first) and leave the draft, undo
      stack, gestures and Vim mode untouched. Test setup clears moved to home+kill-line or
      backspaces, and the Vim suite asserts the draft survives. Compiled 9/9 at identity
      `a3840ef3…`, 76/76 TUI tests and check/build pass; full suite 2990/2991 with the CLI-effort
      failure reproduced at HEAD. Independent review returned SOUND; its two lows are fixed.
      See `research/ports/W241-clear-screen.md`.
- [x] W242 kill-agents chord confirmation and stop. Source `Jr` (chunk-24k7d6mw.js 435644) gates
      `chat:killAgents` on running background work (`ane` 429125): the none arm shows
      `No background agents running` for 2000 ms, and with work the first press arms a 3000 ms
      confirmation and the second stops it. The chord now counts `Runtime.backgroundWorkCount`
      (running background jobs plus running child agents, the local `ane` set) and stops through
      `Runtime.stopBackground` (`BackgroundRegistry.stop`/`AgentRegistry.stop`), bound with
      `TerminalSurface.bindBackgroundWork`. Compiled 10/10 at identity `174700e3…` with a live
      `run_background` job killed on confirm, 80/80 TUI tests, 15/15 runtime-resources tests and
      check/build pass; full suite 2997/2998 with the CLI-effort failure reproduced at HEAD. The
      first none-only delivery was rejected by review; the corrected delivery and a delta
      re-review returned SOUND and the medium and lows are fixed.
      See `research/ports/W242-kill-agents.md`.
- [x] W243 model-picker chord live open and switch. Source `aL` (chunk-24k7d6mw.js 881614)
      opens the picker panel directly for local sessions (`fa(S8t)`); `/model` with
      `fromKeybinding` is the cloud branch only. The accept arm `w9`/`FL` (894465/895434) writes
      the model and touched effort to live state and persists the default on Enter. The chord now
      calls `openModelPickerLive` and `switchModelInPlace`, sharing the extracted `preModelSwitch`
      gate and emitting `PostModelSwitch`, so a running turn's next request uses the new model.
      Compiled 8/8 at identity `2fc7033f…` with the picker opened mid-turn and the second provider
      request on `second-model`, 87/87 picker tests and check/build pass; full suite 2997/2998
      with the CLI-effort failure reproduced at HEAD. Independent review requested.
      See `research/ports/W243-model-picker-live.md`.
- [x] W244 `/effort` applies live, including mid-turn. Source `kEo` (chunk-sfn1dbxq.js 1659299)
      is `immediate`, the submit gate (`zn`, chunk-24k7d6mw.js 1491124) runs it beside an active
      turn, and `MOe` (chunk-0q6c90q6.js 6286) writes live `sessionEffort` with rollback. `onLine`
      executes `/effort` directly during a turn and shares `applyEffortCommand` with the queued
      path; the slider uses the session signal, and the command mutates
      `session.config.effort/effortSelection` without a successor session. The runtime fingerprint
      excludes the live model/effort fields, fixing the next-turn owner error that also affected
      W243. Compiled 10/10 at identity `6f893fe2…` (argument arm and mid-turn slider), interactive
      25/25 and check/build pass; full suite 2997/2998 with the CLI-effort failure reproduced at
      HEAD. Independent review requested.
      See `research/ports/W244-effort-live.md`.
- [x] W245 typed `/model` runs mid-turn. Source `bWe` (chunk-sfn1dbxq.js 1650742) is `immediate`;
      the submit gate (`zn`, chunk-24k7d6mw.js 1491124) runs it beside the active turn. `onLine`
      calls `applyModelCommand`: bare `/model` opens the W243 picker, `/model ID` uses
      `switchModelInPlace` (hook gate, live state, default save, `PostModelSwitch`). Compiled
      10/10 at identity `2ae8a9fb…` for both arms mid-turn, W243 9/9 and W244 10/10 rerun on the
      same tree, interactive 25/25 and check/build pass; full suite 2997/2998 with the CLI-effort
      failure reproduced at HEAD. Independent review pending.
      See `research/ports/W245-model-typed.md`.
- [x] W246 thinking chord opens its dialog and applies live. Source `lL` (chunk-24k7d6mw.js
      882215) opens `SG` (625719); accept `kp` (898567) writes `thinkingEnabled` in place, cancel
      `ph` (898638) only closes, and a changed value mid-conversation asks first (627114). The
      chord now calls `applyThinkingToggle` instead of queueing `/thinking`, so `alt+t` works
      mid-turn, and `session.config.thinking` joins the runtime fingerprint exclusion. Compiled
      12/12 at identity `b1555844…` (mid-turn dialog, next requests with and without
      `thinking`), new `test/thinking-dialog.test.ts` 2/2, W243/W244/W245 rerun 9/9, 10/10,
      10/10, interactive 25/25 and check/build pass; full suite 2999/3000 with the CLI-effort
      failure reproduced at HEAD. Independent review pending with the W243/W244 findings.
      See `research/ports/W246-thinking-live.md`.
- [x] W247 review fixes for W243/W244/W246. The completed independent review returned SOUND
      with no high findings; this package closes the mediums and lows against source: the picker
      applies the model before its default write and reports a failed write through `x_t`
      (with `gne`'s success suffix), `preModelSwitch` ports `dk`'s one-pass revalidation,
      `MOe` restores the effort snapshot on a throwing write, `connectionConfigDigest` excludes
      the live request fields so the MCP journal owner survives a mid-turn switch, and a modal
      dialog hands `alt+p`/`alt+t` to the host so the same chord closes its panel. Compiled
      12/12 at identity `16917da4…` (corrupt settings: effort rollback and non-fatal model save;
      both chord closes; next request on `second-model`), new digest regression fails without
      the fix, W243–W246 rerun 9/9, 10/10, 10/10, 12/12, thinking-dialog 3/3 and check/build
      pass; full suite 3000/3001 with the CLI-effort failure reproduced at HEAD.
      See `research/ports/W247-review-fixes.md`.
- [x] W248 `/config` Thinking mode row applies live. The recovered row (`thinking`,
      chunk-nybcbd9t.js 15590) writes `thinkingEnabled` in place and persists its setting
      (`_4e`, chunk-bk5ct2gw.js 400925) instead of restarting the session. The callback now
      persists `settings.thinking` (the only adaptation), writes `session.config.thinking` and
      repaints via `configPanelInput`; other rows keep the successor path and the model
      capability lock stays out with the W246 gap. Compiled 9/9 at identity `5ab78a06…`
      (thinking on persists, next request `adaptive`, no branch; Auto-compact still branches),
      W233 35/35, W246/W247 12/12, focused 31/31 and check/build pass; full suite 3000/3001
      with the CLI-effort failure reproduced at HEAD.
      See `research/ports/W248-config-thinking.md`.
- [ ] Config residuals without complete consumers. Tips, notifications, terminal tab status
      and selection flags remain unported. Read each source consumer closure before choosing the
      next complete local package.
      Not portable now: tips (vendor/service content), prompt suggestions / timestamps / tab
      status / copy-on-select / auto-scroll (source rows sit behind `tengu_*` flags default off),
      recap (no local consumer), fast mode (model routing), gitignore/copyFullResponse (no
      matching host consumer), notifications (no local trigger set).

Scoped out:

- `/output-style` is scoped out. In this version the visible chooser is a `/config` pane: the
  `local-jsx` registration is `bNt("output-style","Output style",{workspace:!0})`, whose whole
  descriptor is `description: "Output style moved to /config"`, `isHidden: true`. Only the
  non-interactive `local` twin (`kBe`, `chunk-sfn1dbxq.js` 1133890, body
  `chunk-8w0gx47m.js` sha256 `389325e069785b8ce3217250250879ef770ff368584f89929d8b1c840f9d17b7`)
  is reachable, and it needs the built-in style table `x5` (each entry a vendor prompt body),
  an `outputStyle` settings key and the prompt application — none of which this host carries.
  Porting it would mean porting vendor prompt text, which the project rules exclude.
- `/focus` is ported (W225). Its state is one flag (`briefTranscript`) and its body is small; the
  local renderer is this product's own, so the threading landed as the `setBriefTranscript` +
  `holdsFocusPreview` pair in `src/tui.ts` rather than the recovered eight-module thread.
- The remaining registrations are out or blocked: `/radio` streams audio from a network source;
  `/powerup` is a lesson runner over the vendor's own content; `/auto-mode-setup` is gated on an
  env-onboarding flag this host does not carry; `/privacy-settings` is account-adjacent;
  `/skill-doctor` needs per-skill usage tracking, which this host does not record.
- The live input-bar names from the earlier scan are exhausted. `/loops` (`RTo`) and `/branch`
  (`CTo`) are `isEnabled:()=>!1`; `/insights` is a `prompt`-type command behind an `allow_insights`
  policy gate; `/memory` (`xfo`) is a thin-client `local-jsx` over CLAUDE.md and the memory
  settings.

Explicitly out of scope for this loop:
- The full React reconciler / Ink host / screen renderer (noted as pending in row 50;
  the local renderer is the product's own).
- The vendor command set and the account-gated option sources (local-only constraint).
