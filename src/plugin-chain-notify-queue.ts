// The notification queue owner (W45-39): the source's `vo` hook — the object every surface gets from
// the notification context, holding `addNotification`, `removeNotification` and `processQueue`.
//
// Source: chunk-356hrhz3.js `vo` [1735,5205), 3,470 units, and the bodies it closes over. What could be
// copied verbatim is copied (./plugin-chain-notify-queue-source.ts, 10 blocks, 773 units: the gate
// `vps`/`QD`/`i4n`, the holder `I`, the drop `XXe`, the exemption `hEe`, the key class `D` and the
// three priority helpers `Xmt`/`C`/`F`); the hook itself is transcribed here, because its three
// closures capture values that only exist inside a React render — `n = Mn()` (the store's setter),
// `i`/`h` (`Ae(R)`'s or the local `I()`'s clear timer and mount count), `s = on()` (the clock from the
// context), `k = Ae(KFt)` and `b = nt()` (the presentation context and the screen-reader flag).
// The seam keeps the hook's own local names and maps the host calls to parameters, so the transcribed
// bodies are the source's text: `o` = the store, `n` = its `setState`, `s` = the clock, `i`/`h` = the
// clear-timer and mount-count holders, `k`/`b` = the two context values, `T` = the suppression test,
// `l`/`H`/`A` = the drain, the push and the remove, and `S` = the default timeout
// (chunk-356hrhz3.js [1431,1453) `var S=8000,R=qt(null)` — the value is taken, the React context
// beside it is not, because this host has no context to create).
//
// The transcriptions, each verified against the module by .audit/w45-39-vo-identity.mjs after the
// documented renames:
//   · `T` [1607,1707) — `i4n() && !isScreenReaderEnabled && p4n(presentationContext) === "fullscreen"`,
//     with `p4n` the host's presentation normaliser (chunk-1r9zp6s1.js [2457,2600), whose own default
//     `xe()` asks the host capability `Rc` imported from chunk-d65c1ax2.js [3503,…) — a tmux/env
//     probe this host does not have, so the default presentation is the caller's).
//   · the drain `l` [1896,2895) — `processQueue`: filter the queue the projection suppresses, pick the
//     highest priority with `F`, arm its timeout, and put it in the slot, requeueing what `C` allows.
//   · the push `H` [2895,4791) — `addNotification`: pinned to the pinned list, an immediate
//     notification into the slot unless the bar is hidden, a fold merged into the current or the queue
//     entry, and anything else appended behind the `C` filter.
//   · the remove `A` [4791,4996) — `removeNotification` through the copied `XXe`.
//   · the mount effect [4997,5195) — `mount`: count the mounted surfaces, drain if the queue already
//     holds something, and on the last unmount cancel the timer.
//
// The one behaviour this seam adds is the host boundary React provided: the holders exist as objects
// instead of hook state, and `mount()` returns the source's cleanup rather than registering it.
import { Cj } from './plugin-chain-notify-clock-source.js';
import { C, D, F, I, XXe, i4n } from './plugin-chain-notify-queue-source.js';

/** A notification as the queue stores it — the fields the ported bodies read. */
export interface Notification {
  key: string;
  priority?: 'immediate' | 'high' | 'medium' | 'low';
  pinned?: boolean;
  requeueOnPreempt?: boolean;
  heldDuringDiffPanel?: boolean;
  exemptFromDiffPanelHold?: boolean;
  waitsItsTurn?: boolean;
  timeoutMs?: number;
  invalidates?: string[];
  fold?: (existing: Notification, incoming: Notification) => Notification;
  [field: string]: unknown;
}

/** The app state the queue reads and writes (`t()` in the source). */
export interface NotificationQueueState {
  notifications: {
    current: Notification | null;
    queue: Notification[];
    pinned: Notification[];
  };
  [field: string]: unknown;
}

/** The store the queue writes through (`kr()`), with `Mn()`'s setter. */
export interface NotificationQueueStore {
  getState: () => NotificationQueueState;
  setState: (update: (state: NotificationQueueState) => NotificationQueueState) => void;
}

/** What the hook took from the host: the store, the clock, the provider's holders and the two context
 *  values. `holders` is `Ae(R)`'s value — the `I()`-shaped pair the context provider hands down;
 *  `null` (or absent) uses a local `I()`, which is what the source does when no provider is above the
 *  caller (`p ?? d`). */
export interface NotificationQueueHost {
  store: NotificationQueueStore;
  clock: { setTimeout: (fn: () => void, ms: number) => () => void };
  holders?: { clearTimer: { current: (() => void) | null }; mountCount: { current: number } } | null;
  presentationContext?: unknown;
  isScreenReaderEnabled?: boolean;
  /** `p4n` — the host's presentation normaliser. Defaults to the source's own shape with the host
   *  default as its `xe()`: a string passes through, a record answers with its `latched` field, and
   *  anything else answers with `defaultPresentation`. */
  presentationOf?: (value: unknown) => string;
  /** `xe()`'s answer for this host, used where the source would ask its capability probe. */
  defaultPresentation?: string;
}

/** The toast timeout a notification that asked for none gets (`S`, 8000). */
export const NOTIFICATION_DEFAULT_TIMEOUT_MS = 8000;

/** The pair of holders the clear timer and the mount count live in (`I()`), as the transcription and
 *  the host both pass them around. */
interface QueueHolders {
  clearTimer: { current: any };
  mountCount: { current: any };
}

/** The notification context: the three verbs the source's `vo` returns, plus the mount pair and the
 *  holders a host without React drives them with. */
export interface NotificationQueue {
  addNotification: (notification: Notification) => void;
  removeNotification: (key: string) => void;
  processQueue: () => void;
  /** The effect the context provider mounts: count this surface, drain what is already queued, and
   *  hand back the cleanup that uncounts and cancels the timer on the last unmount. */
  mount: () => () => void;
  clearTimer: { current: (() => void) | null };
  mountCount: { current: number };
}

/** The default presentation normaliser: `p4n` [chunk-1r9zp6s1.js 2457,2600) with `xe()`'s capability
 *  answer supplied by the caller. */
function defaultPresentationOf(value: unknown, fallback: string): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value;
  const record = value as { latched?: string | null };
  if (record.latched === null || record.latched === undefined) record.latched = fallback;
  return record.latched;
}

/** The suppression test (`T`): the queue is suppressed only in a fullscreen projection, and only when
 *  the host reports the capability the gate reads (`i4n()`, false in this build — `vps` is `!1`). This
 *  is the same expression the instance's `T` carries; it stands alone for a caller that has no queue
 *  instance to ask, and .audit/w45-39-vo-identity.mjs checks the instance's copy against the module. */
export function notificationQueueSuppressed(
  input: { presentationContext?: unknown; isScreenReaderEnabled?: boolean },
  presentationOf: (value: unknown) => string = (value) => defaultPresentationOf(value, 'inline'),
): boolean {
  return (i4n() && !input.isScreenReaderEnabled
    && presentationOf(input.presentationContext) === 'fullscreen') as boolean;
}

/** The notification queue, over the host's store, clock and context values. */
export function createNotificationQueue(host: NotificationQueueHost): NotificationQueue {
  const o = host.store,
    n = o.setState,
    s = host.clock,
    p = host.holders ?? null,
    // The two holders are typed loosely on purpose: the source's own guards (`if (i.current)`,
    // `h.current++`) are what protect them, and a stricter type makes TypeScript reject the comma
    // expression those guards sit in. Loosening them keeps the three transcribed bodies byte-identical
    // to the module, which .audit/w45-39-vo-identity.mjs measures.
    d = I() as QueueHolders,
    { clearTimer: i, mountCount: h } = (p ?? d) as QueueHolders,
    k = host.presentationContext ?? null,
    b = host.isScreenReaderEnabled ?? false,
    S = NOTIFICATION_DEFAULT_TIMEOUT_MS,
    presentationOf = host.presentationOf ?? ((value: unknown) => defaultPresentationOf(value, host.defaultPresentation ?? 'inline')),
    T = ({ presentationContext: c, isScreenReaderEnabled: r }: { presentationContext: unknown; isScreenReaderEnabled: boolean }) => (i4n() && !r && presentationOf(c)==="fullscreen") as boolean;

  // `processQueue` (`l`) — transcribed from [1896,2895): the arrow body is the source's text, with the
  // hook wrapper `le(` … `,[n,i,s,k,b])` replaced by the plain arrow this host calls.
  const l = () => { let a=T({presentationContext:k,isScreenReaderEnabled:b});n((r)=>{let t=a?r.notifications.queue.filter((c)=>D(c.key)==="queue"):r.notifications.queue,u=t.length===r.notifications.queue.length?r:{...r,notifications:{...r.notifications,queue:t}},f=F(Cj(u)?u.notifications.queue.filter((c)=>c.exemptFromDiffPanelHold):u.notifications.queue);if(!f)return u;let m=u.notifications.current!==null&&f.priority==="immediate"&&f.heldDuringDiffPanel===!0&&u.notifications.current.priority!=="immediate"?u.notifications.current:null;if(u.notifications.current!==null&&m===null)return u;let x=f.key;return i.current?.(),i.current=s.setTimeout(()=>{i.current=null,n((c)=>{if(c.notifications.current?.key!==x)return c;return{...c,notifications:{...c.notifications,current:null}}}),l()},f.timeoutMs??S),{...u,notifications:{...u.notifications,queue:[...m!==null&&C(m,f)?[m]:[],...u.notifications.queue.filter((c)=>c!==f)],current:f.heldDuringDiffPanel?{...f,heldDuringDiffPanel:void 0}:f}}}) };

  // `addNotification` (`H`) — transcribed from [2895,4791), wrapper `le(` … `,[n,l,i,s,k,b])` removed.
  const H = (a: Notification) => { if(T({presentationContext:k,isScreenReaderEnabled:b})&&D(a.key)==="suppress")return;if(a.pinned){n((t)=>{if(t.notifications.pinned.some((u)=>u.key===a.key))return t;return{...t,notifications:{...t.notifications,pinned:[...t.notifications.pinned,a]}}});return}if(a.priority==="immediate"&&a.waitsItsTurn!==!0&&!Cj(o.getState())){if(i.current)i.current(),i.current=null;i.current=s.setTimeout(()=>{i.current=null,n((t)=>{if(t.notifications.current?.key!==a.key)return t;return{...t,notifications:{...t.notifications,queue:t.notifications.queue.filter((u)=>!a.invalidates?.includes(u.key)),current:null}}}),l()},a.timeoutMs??S),n((t)=>({...t,notifications:{...t.notifications,current:a,queue:[...t.notifications.current?[t.notifications.current]:[],...t.notifications.queue].filter((u)=>C(u,a))}}));return}let r=a.priority==="immediate"?{...a,heldDuringDiffPanel:!0}:a;n((t)=>{if(r.fold&&t.notifications.current?.key===r.key){let c=r.fold(t.notifications.current,r);if(i.current)i.current(),i.current=null;let q=c.key;return i.current=s.setTimeout(()=>{i.current=null,n((g)=>{if(g.notifications.current?.key!==q)return g;return{...g,notifications:{...g.notifications,current:null}}}),l()},c.timeoutMs??S),{...t,notifications:{...t.notifications,current:c}}}let u=r.fold?t.notifications.queue.findIndex((c)=>c.key===r.key):-1;if(r.fold&&u!==-1){let c=r.fold(t.notifications.queue[u],r),q=[...t.notifications.queue];return q[u]=c,{...t,notifications:{...t.notifications,queue:q}}}if(!(!new Set(t.notifications.queue.map((c)=>c.key)).has(r.key)&&t.notifications.current?.key!==r.key))return t;let x=t.notifications.current!==null&&r.invalidates?.includes(t.notifications.current.key);if(x&&i.current)i.current(),i.current=null;return{...t,notifications:{...t.notifications,current:x?null:t.notifications.current,queue:[...t.notifications.queue.filter((c)=>C(c,r)),r]}}}),l() };

  // `removeNotification` (`A`) — transcribed from [4791,4996), wrapper `le(` … `,[n,l,i])` removed.
  const A = (a: string) => { n((r)=>{let t=XXe(r.notifications,a);if(t===r.notifications)return r;if(r.notifications.current?.key===a&&i.current)i.current(),i.current=null;return{...r,notifications:t}}),l() };

  // The mount effect — transcribed from [4997,5195): `P(() => { … }, [])`, with the cleanup returned
  // instead of registered.
  const mount = () => { if(h.current++,o.getState().notifications.queue.length>0)l();return()=>{if(h.current--,h.current===0&&i.current)i.current(),i.current=null} };

  return { addNotification: H, removeNotification: A, processQueue: l, mount, clearTimer: i, mountCount: h };
}
