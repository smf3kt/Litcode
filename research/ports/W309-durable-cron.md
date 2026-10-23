# W309 the durable cron store, its lock, and the restart catch-up

Status: verified locally on 2026-10-23. Local commit only; no push.

## Task card

- Entry: `cron_create` with `durable: true`, and a later session start over the same workspace.
- Outcome: a durable job is written to `<workspace>/.harness/scheduled_tasks.json` before the tool
  returns, survives a restart, and fires only while the session holds `scheduled_tasks.lock`; a
  one-shot job that came due while nothing was running is surfaced once at startup through the
  recovered catch-up prompt and removed, while a recurring job is kept and resumes from its last
  fire.
- Shape: one store module, one scheduler attach/detach pair, one runtime settle step.
- Target: `src/scheduler-store.ts` (new), `src/scheduler.ts`, `src/runtime.ts`,
  `src/interactive.ts`, `src/session.ts`, `src/cli.ts`, tests.

## Source preflight

Sample 2.1.296, SHA-256 `c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937`.
Coordinates are zero-based UTF-16 code units, half-open ranges.

| Module | SHA-256 | Sites |
| --- | --- | --- |
| chunk-atzjaveb.js | 71378d5821cac631dfe41fe2db138ed7853b6008545668f423b89cbf4d060a2a | `RCe` 5187, `D9t` 5276-6340, `w0n` 6340-6991, `Pot` 6991-7366, `s_e`/`bds`/`cre` 7366-7983, `wqe` 7779, `_9` 7983, `C` 8040, `L9t` 8126, `E0n` 8404, `wds` 8517 |
| chunk-jrz2zk22.js | da64f780f2b184a92cd87a21d03c8a02ca80ec4124edf791eccd988a67c980a3 | `U`/`Ne`/`Fe`/`Ie` 2400-3263, `de` 3263-4046, `N` 4046-4236, `He` 4469, `me(!0)`/`ne` 7080-9818, `Ke` 11476-11900, `ze`=1000 `We`=300 `qe`=5000 4446 |
| chunk-0vpbck7s.js | 988f0155a37f92868d7c0867c68822b460ccf916684212b0d265cdc1f3a752ed | `CronCreateTool` 5752-8401: the `durable` schema at 6100, `validateInput` codes 1-4, `call` 7000 |
| chunk-21k2kjg1.js | not captured | `CronDeleteTool` |
| chunk-bws04yaw.js | not captured | `CronListTool` |
| chunk-1h28m7y3.js | 5a3fa4c727e1683d3d018ab6172f841d972519ce2528a8a63d8c26249f246f04 | the durability prompts `aso`/`lso`/`cso`/`uso`/`fso`, `TCe`=7 days |
| chunk-1t033v1j.js | 07eb5f690bc8609b43708ba2a3d6b2f17bfee11bc493f965342ba8fe7e84cc6e | `rU`=".cc-writes" 3009, `vn` 8106, `Ope` 8169 |

```js
var S0n=300000, D=/^\*\/\d+ \* \* \* \*$/, A=S(".claude","scheduled_tasks.json");
function RCe(r){return S(r??cr(),A)}
async function D9t(r){…readFile(RCe(r))…if(!Array.isArray(i.tasks))return[];…if(!n6(o.cron))skip…}
async function w0n(r,s){…mkdir(S(n,".claude"))…sC(RCe(n),_(i,null,2)+"\n",{stagingDir:S(n,".claude",rU)})}
async function Pot(r,s,n,e,i){let a=F().slice(0,8),o={id:a,cron:r,prompt:s,createdAt:Date.now(),...n&&{recurring:!0}};
  if(!e)return Twe(o),a; let d=await D9t(); d.push(o); await w0n(d); return a}
function C(r){let s=parseInt(r.slice(0,8),16)/4294967296;return Number.isFinite(s)?s:0}
function L9t(r,s,n,e=_9){let i=wqe(r,s),a=wqe(r,i),o=a-i;
  if(D.test(r)&&…o>=S0n&&o-e.cacheLeadMs<S0n)return s+o-e.cacheLeadMs;
  return i+Math.min(C(n)*e.recurringFrac*o,e.recurringCapMs)}
function E0n(r,s,n,e=_9){let i=wqe(r,s); if(new Date(i).getMinutes()%e.oneShotMinuteMod!==0)return i;
  return Math.max(i-(e.oneShotFloorMs+C(n)*(e.oneShotMaxMs-e.oneShotFloorMs)),s)}
async function de(s,n){…if(await Ie(S,a))return!0; let l=await Fe(a);
  if(l?.sessionId===y){…return!0} if(l&&_a(l.pid)&&await Dw(l.pid,l.procStart))return!1;
  …await ve(U(a)); return Ie(S,a)}
async function N(s,n){let S=await Fe(a); if(!S||S.sessionId!==y)return; await ve(U(a))}
function He(s,n,a){if(a===0)return!1;return Boolean(s.recurring&&!s.permanent&&n-s.createdAt>=a)}
```

## Cause

Three gaps:

1. Every job was in memory only. `durable` was accepted and then forced to `false`, so the tool
   promised nothing and a restart lost every job. The recovered store (`D9t`/`w0n`/`Pot`) writes
   `<project>/.claude/scheduled_tasks.json` atomically and strips `durable` from the record.
2. There was no lock and no catch-up. The recovered driver (`de`/`ne`) fires nothing until the
   session owns `scheduled_tasks.lock`, and on start it surfaces one-shot tasks whose first
   occurrence passed while nothing was running (`Ke`), removing them after they are delivered.
3. The jitter arm did not match the source. It hashed `id:nominal` with SHA-256 and spread by up to
   10% of the interval capped at 15 minutes, where `L9t`/`E0n` read the id's first eight hex
   characters as a fraction, spread by up to half the interval capped at 30 minutes, fire a `*/N`
   schedule 15 s early inside a five-minute band, and fire a one-shot up to 90 s early only on
   :00/:30. The id itself was a full UUID where `Pot` uses eight hex characters.

## Implementation

- `src/scheduler-store.ts` ports the store: `RCe`→`scheduledTasksPath`, `D9t`→`readStoredTasks`,
  `w0n`→`writeStoredTasks` (through the shared atomic writer with `.writes` staging), `Pot`→
  `newTaskId`, `Fe`/`Ie`/`de`/`N`→`readSchedulerLock`/`acquireSchedulerLock`/
  `releaseSchedulerLock`, `He`→`agedOut`, `wds`→`missedTasks`, `Ke`→`missedTasksPrompt`, `s_e`/
  `bds`→`removeStoredTasks`/`stampStoredTasks`. The parent directory is this harness's `.harness`
  instead of `.claude`; the file and lock names are unchanged.
- `src/scheduler.ts` gains the recovered timing (`SCHEDULER_TIMING`, `jitterFraction`,
  `nextRecurringFire`, `nextOneShotFire`), the eight-hex id, and a `store` option. `attachStore`
  takes the lock and loads the store; `tick` refuses to fire without the lock and stamps or removes
  durable rows after a fire; `close` releases the lock after flushing pending writes.
- `src/runtime.ts` binds the store when `features.schedulerDurable` is true, with the process as
  the lock identity, queues the catch-up prompt as a `scheduled` event, and exposes
  `settleScheduler(owner)`, which awaits the first store read. `src/interactive.ts` calls it before
  the loop drains, so the catch-up lands in the queue for the first turn; the drain itself now runs
  before the input gate, so a closed stdin cannot strand an event.
- The setting is declared in `src/session.ts`, `src/runtime.ts`, `src/cli.ts` and flows through
  `src/reload.ts`'s existing `...settings.features` spread.

## Verification

- `npx tsc --noEmit` 0; `npm run build` clean.
- `test/scheduler.test.ts` 41/41, including seven new store tests: restart survival, a second
  identity refused while a live process holds the lock, dead-process lock recovery, the missed
  one-shot catch-up text and its removal, `lastFiredAt` stamping plus aged-out removal, a
  session-only job never reaching the store, and the same-identity adopt path.
- `test/runtime-resources.test.ts` includes the durable wiring: `cron_create durable:true` writes
  the store and the catch-up is queued. `scheduler` + `runtime-resources` + `runtime-events` +
  `interactive` + `interactive-loop` 94/94; `cli` + `cli-advanced` + `cli-gateway` +
  `background-session` 31/31.
- Compiled CLI, one `cron_create durable:true` turn: the store holds one task with an eight-hex id,
  the prompt, and `recurring:true`, and the lock is gone after exit.
- Compiled CLI, restart over a seeded store with one missed one-shot and one recurring task: the
  second turn's request body carries the recovered catch-up text and the missed prompt, the missed
  row is removed, the recurring row stays, and the lock is released.

## Limitations

- The lock is process-scoped here: one process holds one workspace's store, and a second scheduler
  in the same process adopts that identity (`de`'s `l.sessionId===y` arm). The source keys it to a
  session id, which this host does not need because it runs one interactive session per process.
- `b0n` (durable refused under `--project-config-root`) and `mso`/`Pfr` (restricted roots, teammate
  mode) have no counterpart: neither option exists here, so durable is available whenever the
  feature is on.
- The source also watches the store file and reloads on change (`oe`'s watcher, 300 ms stability,
  1000 ms poll, 5000 ms lock re-check). This port reads once per attach and writes on every
  mutation; a second process editing the file mid-session is not picked up.
- `lastFiredAt` is stamped after the fire, as `bds` does; the source additionally carries
  `permanent`, `createdBySessionId`/`createdByPid`/`createdByProcStart` and `createdInProject`
  through the store, which this port reads and preserves but never writes.
- `CronList`'s per-agent filtering (`dT()?.agentId`) has no counterpart; every stored job is listed.
