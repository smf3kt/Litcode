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

Next up, scoped but not started:

- W215 model selection, named in the loop request. The recovered pair is `SWe` (`local`,
  `<model>`, loader `chunk-naxwgf3s.js`) and `bWe` (`local-jsx`, `[model]`, `immediate:!0`,
  `thinClientDispatch:"control-request"`, description `Set the AI model for Claude Code
  (currently <qo>)`), both in `chunk-sfn1dbxq.js` at 1650535 and 1650764. The picker component
  and its effort slider live in `chunk-24k7d6mw.js`; its keybinding contexts are declared in
  `chunk-6ccen3s8.js` as `ModelPicker` (`left`/`right` = `modelPicker:decreaseEffort`/
  `increaseEffort`, `s` = `modelPicker:thisSessionOnly`) and `EffortSlider`
  (`left`/`right`, `tab` = `effortSlider:toggleUltracode`, `s` = `effortSlider:thisSessionOnly`).
  The local `/model` currently opens a list of the current model plus skill-declared models with
  a text entry; the recovered picker adds the family list, the per-row effort adjustment and the
  session-only toggle. The effort slider is W212's vocabulary already, so the work is the picker
  host and the two extra verbs, not new semantics.

Explicitly out of scope for this loop:

- The full React reconciler / Ink host / screen renderer (noted as pending in row 50;
  the local renderer is the product's own).
- The vendor command set and the account-gated option sources (local-only constraint).
