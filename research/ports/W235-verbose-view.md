# W235 Config Verbose view

Status: implemented and verified locally, 2026-10-21. Local only; no push, no paid calls.

## Task card

- Entry is the remaining local Config Verbose control behind the slash composer.
- Outcome requires a visible renderer effect, immediate persistence, live application and restart/resume.
- Preserve the source's independent verbose, viewMode, briefTranscript and transcript-screen state.
- Reuse the existing settings queue, successor-session application and document renderer.
- Validate 0-3 necessary regression groups, the compiled CLI, source character comparisons and independent review.
- One lead writer. Account/network/OAuth, paid upstream calls and push stay excluded.

## Baseline

At HEAD5717eb9, a private compiled CLI with saved viewMode=verbose opens Config and searching verbose
shows No settings match. A second owned read_file probe delivers its marker content to the provider
but shows only assistant text. After that completed turn, /focus on mutates pinned configuration and
the next task reports Runtime owner configuration changed with no further provider request.
The first probe waited for the full error string at 90 columns and timed out because the footer
visibly ends at Runtime own; the captured frame and unchanged request count hold the evidence.
Captures live under the job scratch directory in w235-before-kxMmiI and w235-tool-before-DejYVf.

## Source gate

Artifact SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937.
Every range is zero-based UTF-16 code units, half-open. Static Acorn reads verify each module against
extracted-v2/manifest.json. Recovered application entrypoints remain inert.

| Module | SHA-256 | Bodies |
| --- | --- | --- |
| chunk-nybcbd9t.js | 0abe0d704940977466d81c1efab7f953d8f9dac0f30cd758c4a3d0286b5c1bca | U2t/K [5051,6155), W [8208,8266), Te [9556,9662), rows autoCompact [12034,12244), verbose [20115,20201); row label offsets reduceMotion 15321, thinking 15608, turnDuration 20796 |
| chunk-js2bhabe.js | f196bcf7599a185ad08c73d32ce68b25130ce9db48d781138b1899a3f6e786de | hs/D6 [1114,1554) |
| chunk-bk5ct2gw.js | efbc2d987608904a4a3ad7221f39f6e6afe34c13076d2ce3e4be2d49f43e6dd1 | Ze [558427,559209), verbose false |
| chunk-9shw4xrd.js | 3772f0aeaf18af96248c2eae193c2f99cb0b68f20d94f9f34e5059e6709d27c4 | startup [106333,106421), prepared verbose [145659,145669) |
| chunk-3cynezh1.js | c3fc78a29a64dc725d32fe549b7dc11190e7646368c939bb8d61e755799955b3 | boolean schema [272446,272537) |
| chunk-3gz7s57c.js | 9d44818f1c5a17e8ddddbce66694eab43a75e489d8afbeaf0369756daf2e378b | FI [162568,162602), jw [167024,183767), row [179188,180341) |
| chunk-phg89898.js | b52cc8f30379c267a8f9afb0f475b87c00d8fd96f8ddadcd0bdab1549234dfe3 | Ss [34846,35948), ja [16372,16668), qa [42163,43376), Ym [43718,44128), fa [213032,215054), Gg [216398,219164), rf [230971,234205), z0 [234205,235190) |
| chunk-c0zba9s1.js | 72b9953506a7314a796004e4ac6ed4b75021a075f297b32b742428eab3c5fb19 | Read b [9316,9697), F [9804,10796), y [10796,11114) |
| chunk-fch65n13.js | 6e1551dd09c1ae780b6ecd8c70a64f8aad20b496c9b767afbcc8474b6aa55aca | wu [1196,1496), wy [1496,1994) |
| chunk-rrrfrwjr.js | a2b463ee9902f79771cc69927f7d0259c9e2712372aa7fcd62c32907d17aca6d | $e [1610,2287), result gutter |
| chunk-6k07rctx.js | 395c421cd03b32a9b62bf2ceb9c1dde49e784eda1862ae7741a107b3d28c272b | Jf [1389,2637), error body |
| chunk-yn0pfn70.js | 1d90c3c5bfa8d28f4dec90c70ae77bec0236285ddf3c034790236238a90b940f | xZ [13795,13867), hidden-line count |
| chunk-2bcyxj9q.js | fac54023446990731332f837b388955e357036b2797a11f93150648afb45f7e0 | iTe/VTt [43499,43662), XMn [43708,43839), zh [83349,83388), tag constants [82966,83349) |
| chunk-4jr9rxry.js | 48124b0b95bafa326126fe7b0d1a214eb73ac4ad0a2a1f8315d0bf51e424bb00 | focus r [4693,5262), apply_flag_settings |

Config Te writes userSettings.verbose, updates its snapshot and live AppState.verbose and leaves
viewMode and briefTranscript untouched. Startup `It` is `o.verbose ?? (viewMode ? viewMode === "verbose"
: legacyFocus ? false : merged("verbose", false))`: a present viewMode decides, and the merged stored
boolean (default false) is the fallback only when viewMode is absent. This host has no explicit verbose
CLI flag and no legacy focus boolean, so its resolver is viewMode first, then stored. Config changes
apply the boolean live; startup precedence is never reapplied to a live toggle. Reload resolves the
same way, so a removed key returns to the authored viewMode instead of keeping a stale live value.

jw uses live verbose OR transcript screen and a separately expanded-row flag. rf hides ordinary
thinking/redacted thinking only when both verbose and transcript are false. Ss strips presentation
tags via zh, trims, and renders dim Markdown with capped prose width. The original text remains
stored. The thinking renderer, Bash/edit/write, MCP, nested-agent and proprietary output bodies
remain unported; the live result lane covers Read, list_files, search and failed calls only.

Read's actual F always summarizes line count, even in verbose mode. The count follows the file tool's
numLines: blank returned lines count, and the host projection's trailing empty segment for a final
newline does not. list_files and search map to the
source Glob/Grep Ym and qa branches: collapsed output is `Found N files|lines` plus the `(ctrl+o)`
hint only when N is positive; verbose shows the count and full text under a five-cell margin, and
the count header uses qa's NBSP gutter. qa's count pluralizes from the source. Failed calls use Jf:
`Error: ` or `Cancelled: ` preserved, ten lines collapsed plus `… +N lines (ctrl+o)`, all lines when
detailed, and the collapsed `InputValidationError:` reduction. `$e` supplies the five-cell gutter
`"  ⎿  "`; qa's verbose header uses `"  ⎿  "`. Host raw text results supply
count and content at the projection boundary.

## Adaptations and ownership

SessionConfig carries optional verbose as the owned live value. Fresh startup resolves it from the
merged settings and viewMode. Resume keeps the journal's stored value, falling back to viewMode for
a pre-verbose journal. Session metadata retains the accepted live value. Display changes use the
established successor-session path because the runtime fingerprints config; applyConfig calls the
terminal's `setVerbose` after the successor is accepted, so the Config row repaints existing rows
immediately. `/focus on|off` persists viewMode and then applies a successor session, preserving live
verbose and leaving the next turn usable; like the sibling config commands it refuses while a turn is
unfinished, because the successor would otherwise branch and trim that turn. A completed tool callback
carries its final post-hook
result to the terminal as a tool entry; the callback is a projection, not a journal write, and
never changes provider content. Tool rows are live only: the host does not replay historical
messages on resume, so a resumed transcript starts without old result rows. The transcript screen
forces detailed rows even while the switch is off; leaving it returns to the switch's summaries.
Tool entries bypass the transcript's collapsed-tail view, so a detailed result is not cut to twelve
rows; the source's own limits (ten error lines, count + full text) still bound it. Row caches key on
the effective detail flag, so toggling repaints in place. The host may leave a
blank five-cell spacer after a detailed tool entry; it carries no content.

## Throughput

Two sequential bounded readers acquired Config-to-thinking and the attachment frontier. The lead
closed the actual Read registry/F leaf and Glob/Grep qa leaf with static focused reads. One lead
writer owns all product changes. Existing expect/xterm drivers exercise the compiled application.

## Validation

- `npm run check` and `npm run build` pass.
- 89 affected tests pass across config-panel, focus-command, reload, tui-tool-result and tui.
- Full suite: 2978 tests, 2977 pass. The single failure, CLI effort flag overrides environment,
  fails identically at HEAD5717eb9 in a detached worktree; the wire-level `effortOverride` from
  W231 gives LLM_EFFORT precedence over the CLI flag. Recorded in question.md, not repaired here.
- Independent review confirmed the source gate and found five issues; all are closed: startup
  precedence now puts a present viewMode first, the Read count keeps blank lines and drops only the
  projection's trailing newline segment, `/focus` refuses an unfinished turn, reload resolves a
  removed key through viewMode, and detailed tool rows bypass the transcript's collapsed tail.
- Compiled acceptance `.audit/w235-verbose.mjs`: 20/20 checks at identity
  4011cf53db4ed5e148ecd1cc5f237d1f6d3b60c6ca91ab84d7ab7d66f056e525. It covers: Read summary
  without body; search summary with hint; Config row false; toggle persistence beside authored
  keys; journal config true; verbose search body; failed-call Error row; restart true; restored
  detail; live off repaint; summary-only next turn; transcript-screen detail; chat return; two
  `/reload` passes that apply an authored true value to existing rows and return an authored false
  value to summaries; `/focus` then a completed two-call turn with no runtime-owner failure;
  resume false with summary rows; every CLI exit 0 and no lock left. Fixture requests are counted
  per turn and bound to actual tool_result messages.
