# W308 the idle-prompt notification and the Notification hook's delivery order

Status: verified locally on 2026-10-23. Local commit only; no push.

## Task card

- Entry: a completed turn with the composer left alone. After `messageIdleNotifThresholdMs` of no
  input, the source raises `{message:"Claude is waiting for your input", notification_type:"idle_prompt"}`.
- Outcome: that notification fires once per completed turn, never while the turn runs, a dialog is up,
  a loop wakeup is armed, a quota auto-resume is armed, a background agent is live, or the person has
  touched the input since the turn ended; every OS notification raises the Notification hook before it
  reaches a delivery channel, and the hook payload carries `message`, `title` and `notification_type`.
- Shape: one state machine (`IdleNotifier`) plus one delivery helper.
- Target: `src/idle-notification.ts` (new), `src/tui.ts`, `src/interactive.ts`, `src/hooks.ts`,
  `src/terminal.ts`, `src/session.ts`, `src/runtime.ts`, `src/cli.ts`, `src/reload.ts`, tests.

## Source preflight

Sample 2.1.296, SHA-256 `c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937`.
Coordinates are zero-based UTF-16 code units, half-open ranges.

| Module | SHA-256 | Sites |
| --- | --- | --- |
| chunk-24k7d6mw.js | 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 | `tAe` 76028, `class _$` 76055-78797, `#m` 76776, `#g` 77041, `setLocalOverlayShowing` 76239, `yEo` 1679528, the instance `new _$({...})` 1690980-1691770, `setLocalOverlayShowing` call 1691776 |
| chunk-m18zhdb2.js | 19f22e29de44ef3ac5aec7129f1d7d96ef03de977a4f13c06a390e6251f844f4 | `YD` 2366, `ZMr` 2411 (hook first, channel second) |
| chunk-sfn1dbxq.js | 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da | `S0` 2941895 (builds the Notification payload and dispatches it) |
| chunk-fyhzvvp0.js | 1392b254e378432c7206e82a258512a740c26ce57263941ba3be4eb279675d19 | `O9n` 4925 (`permission_prompt` at `aVt`=6000, hook only) |
| chunk-bk5ct2gw.js | efbc2d987608904a4a3ad7221f39f6e6afe34c13076d2ce3e4be2d49f43e6dd1 | `messageIdleNotifThresholdMs:60000` 558979, the key list 559770 |
| chunk-68g5e6vr.js | 744653993cecb30c1252f18cb7d92c8955e901c6ba5172cec97fdd90bd8a6dc9 | `BG` 4875 (a loop wakeup is pending) |
| chunk-9sq8whr4.js | not captured | `tz` 3981 (quota auto-resume is armed) |
| chunk-6p4kvraw.js | not captured | `exn` 946 (a live background agent) |

```js
class _${#e;#t;#o=!1;#r=null;#s=null;#n=0;#l=null;#a=0;#c=!1;#i=!1;#d;#u=!1;
  #m=()=>{let h=this.#e.turn.getSnapshot(),T=this.#t;this.#t=h;
    let M=h.isLoading!==T.isLoading||h.lastQueryCompletionTime!==T.lastQueryCompletionTime;
    if(M||h.submitCount!==T.submitCount)this.#g();if(M)this.#h()}
  #g(){this.#f();let{isLoading:h,submitCount:T,lastQueryCompletionTime:M}=this.#t;
    if(h)return;if(T===0&&!this.#e.hasSeededRemotePrompt)return;if(M===0)return;
    this.#r=this.#e.clock.setTimeout(()=>{this.#r=null;
      if(this.#e.getLastInteractionTime()>M)return;
      if(this.#e.backgroundAgents.getSnapshot()){this.#s=BD([...],(ee)=>{if(!ee)this.#g()});return}
      let L=this.#e.now()-M;
      if(!this.#t.isLoading&&!this.#o&&!this.#e.isDialogOnScreen()&&!this.#e.hasPendingLoopWakeup()
        &&!this.#e.hasArmedQuotaAutoResume()&&L>=this.#e.getIdleNotifThresholdMs()&&M!==this.#n)
        this.#n=M,this.#e.sendIdleNotification()},Math.min(2147483647,this.#e.getIdleNotifThresholdMs()))}
sendIdleNotification:()=>{YD({message:"Claude is waiting for your input",notificationType:"idle_prompt"},…)}   // 1691362
async function YD(e,n,o={}){await ZMr(e,n,o)}                                              // m18zhdb2 2366
async function ZMr(e,n,{…}={}){…await S0(r2(),e,{…});let c=await A(l,e,n);…}                // m18zhdb2 2411
async function S0(e,n,{timeoutMs:r=lu,…}={}){let{message:b,title:w,notificationType:M}=n;
  …hook_event_name:"Notification",message:b,title:w,notification_type:M…}                    // sfn1dbxq 2941895
```

## Cause

Three gaps:

1. No idle-prompt notification existed at all, and no `messageIdleNotifThresholdMs` setting. The
   recovered default is 60000 ms, so a session that finished a turn and sat untouched never told the
   person it was waiting.
2. The Notification hook payload had no `message` or `title`. `S0` sends both, and `uK`
   (chunk-r2vtj1kh.js 194097) declares them, so a hook could not read what the notification said.
3. The idle arm's local delivery reached the channel without the hook, because this host had no
   single delivery path. `ZMr` always runs `S0` first and only then selects a channel.

The `permission_prompt` arm already matched `O9n`: it calls `S0` alone and never reaches a channel.
That stayed as it was.

## Implementation

- `src/idle-notification.ts` ports `_$` as `IdleNotifier` over an injected host: the turn snapshot,
  the interaction clock, the dialog flag, the loop and quota guards, the background-agent registry,
  the threshold and the send path. `#m`, `#g`, `setLocalOverlayShowing`, `dispose` and `#f` are
  transcribed; the `/clear` context hint (`#h`, `tAe`) is not, because it needs a keyed notification
  store this renderer does not have.
- `src/tui.ts` owns the machine. `setRunning` bumps the source's `submitCount` on a start and stamps
  `lastQueryCompletionTime` on a finish, which is what re-arms the timer; `render` reports the overlay
  flag the way the source's frame does; `bindIdleNotification` installs the owner side and
  `composerOverlayShowing` answers the dialog question. `messageIdleNotifThresholdMs` is a new
  `TuiTerminal` option.
- `src/interactive.ts` adds `deliverNotification`: the Notification hook first, the local channel
  second, both skipped once the signal aborts (`ZMr`). The idle send, the six-second permission arm
  and any later site use it; the legacy `O9n` arm keeps its hook-only call.
- `src/hooks.ts` adds `message` and `title` to `HookPayload`.
- The setting is declared in `src/session.ts`, `src/runtime.ts` (`ParsedRuntimeSettings`,
  `parseSettings`, both display-only digests), `src/cli.ts` and `src/reload.ts`. It is a positive
  integer in milliseconds and an invalid value is absent, so the 60000 default applies.
- `src/runtime.ts` adds `pendingLoopWakeup(owner)` for `BG`. This host's dynamic scheduler wakeup is
  the loop's heartbeat, so an armed wakeup is a pending loop wakeup.

## Verification

- `npx tsc --noEmit` 0.
- `test/idle-notification.test.ts` 6/6: arm-on-completion, one per completion, input cancels, dialog
  and loop and quota suppress, a live agent defers then re-arms, the configured threshold and the
  composer overlay, disposal.
- `test/terminal-notifications.test.ts` 4/4, including the new end-to-end arm: a real session turn
  through `interactiveLoop` raises exactly one `idle_prompt` hook with the recovered message, and a
  later tick raises nothing. The settings assertions cover the accepted and rejected values through
  `parseSettings`, `configSchema` and `reloadConfig`.
- `test/hooks`, `async-hooks`, `runtime`, `runtime-resources`, `interactive*` 144/144.
- `test/tui` + `test/tui-stash` 104/104.
- `npm run build` succeeded.
- Compiled CLI, piped stdin, one prompt: the turn completes and the process exits 0. The piped path
  has no terminal surface, so no idle machine exists there and no idle notification is raised, which
  is the expected shape. The end-to-end idle arm is covered by the `interactiveLoop` test above,
  which drives the same `TuiTerminal` the interactive CLI builds.

## Limitations

- The `tz` quota auto-resume guard has no counterpart here because this host arms no quota
  auto-resume; the machine reads it as a constant `false`.
- `hasSeededRemotePrompt` is absent, so a submit count of 0 is the only early return.
- `BD`'s batched subscription is reduced to one listener per registry change; the source's
  microtask coalescing does not change what the guard observes.
- `exn` counts every non-paused task; this host's agent registry spells the live states `queued` and
  `running`, and those two are what the guard reads.
- The `/clear` context hint (`#h`) and its `tAe` notification key stay unported with the rest of the
  keyed notification store.
