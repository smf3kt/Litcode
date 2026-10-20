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

Next up, scoped but not started:

- [x] W222 surface sweep of the commands reported as unresponsive. `.audit/w222-surface-sweep.mjs`
      passes 8 checks over the compiled CLI: `/workflows` opens the dynamic-workflows dialog with
      its empty message and `Esc close` footer; bare `/loop` expands to a user turn rather than
      opening a dialog (the recovered `se` prompt-expansion path); `/tasks`, `/cron`, `/status`,
      `/context` and `/usage` each print their report. The `/effort` (W212) and `/model` (W215)
      probes also still pass, so the two surfaces the request named by example are healthy.
- `/output-style` is scoped out. In this version the visible chooser is a `/config` pane: the
  `local-jsx` registration is `bNt("output-style","Output style",{workspace:!0})`, whose whole
  descriptor is `description: "Output style moved to /config"`, `isHidden: true`. Only the
  non-interactive `local` twin (`kBe`, `chunk-sfn1dbxq.js` 1133890, body
  `chunk-8w0gx47m.js` sha256 `389325e069785b8ce3217250250879ef770ff368584f89929d8b1c840f9d17b7`)
  is reachable, and it needs the built-in style table `x5` (each entry a vendor prompt body),
  an `outputStyle` settings key and the prompt application — none of which this host carries.
  Porting it would mean porting vendor prompt text, which the project rules exclude.
- `/focus` is scoped out for now. Its state is one flag (`briefTranscript`) and its body is small,
  but the flag is threaded through the recovered renderer in at least eight modules
  (`chunk-24k7d6mw.js`, `chunk-2bcyxj9q.js`, `chunk-3gz7s57c.js`, `chunk-4jr9rxry.js`,
  `chunk-7q49cqja.js`, `chunk-7vyj6mx6.js`, `chunk-bk5ct2gw.js`, `chunk-j6zmxvvx.js`), so a local
  brief-transcript mode is a multi-file renderer change, not a command port.
- `/permissions` needs a full editing pane, not a chooser (`bTo`, `immediate:!0`,
  `thinClientDispatch: "control-request"`, no `load`).
- [ ] W223 `/hooks` (in progress). Unit 1 landed: `src/hooks-event-metadata.ts` transcribes `igt`
      from `chunk-5s0t90hn.js` (sha256 `78fb5ac9b58de2292c2682ae027da0104606e0119919e1d87a6cbce32beafe89`,
      offset 861) — 33 events with the recovered `summary`, `description` and `matcherField` — plus
      the source label table `$p` and the readers `SPn`/`H4t`/`O4t` from `chunk-n3ykh62m.js`
      (sha256 `2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac`, 410486) and the
      source order `Bbe` from `chunk-wtch2p0g.js` 6070. 8 tests, all 33 local `HOOK_EVENTS` covered
      with no extra entry. The recovered `values` arrays are dropped: the dialog never renders them.
- [ ] W223 unit 2, the dialog itself. Recovered shape: three levels in `chunk-5ggmnm67.js` (sha256
      `ea9d9376a5653cc9717c6259d762931644a873dbbb103880bad9c78e5f917776`) — level 1 `So` titled
      `Hook events` with the subtitle `${n} event(s) · ${k} with hooks` and rows carrying the
      event's `summary`; level 2 `bo` titled `${event} - Matchers` with rows `[sources]` /
      matcher-or-`(all)` / `${n} hook(s)`; level 3 `Ho` titled
      `${event} - Matcher: ${matcher}` when the event declares matcher metadata. Empty states say
      `No hooks configured for this event` with the hint `To add hooks, edit settings.json directly
      or ask Claude`; the level-1 guide is `enter: open, escape: go back`.
- [ ] W223 unit 2, the attribution decision (settled, not yet coded). This host merges its settings
      layers into one `config.hooks` and keeps only `permissionLayers` as `{source, file}` pairs
      (`config.ts:1134`), so per-hook source has to be reconstructed rather than read: build a
      multiset of the `hooks` each layer file declares, walk `flattenHookDefinitions` over the merged
      config, and attribute each definition to the first matching layer; anything left over is
      `pluginHook`, which is how the recovered merge puts plugin declarations first. Do not label the
      whole merged set as one source.
- `/hooks` (`View hook configurations for tool events`, `local-jsx`, `immediate:!0`) is the next
  bounded candidate: this host already parses `HooksConfig` (`src/hooks.ts`, `config.ts:114`) and
  skill hooks, so a read-only viewer has real local state to show.
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
