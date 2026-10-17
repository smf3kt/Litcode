// Host bindings for the diff dialog tab strip (W169).
//
// `markScrollActivity` stands in for `Qxr` (chunk-4bw62nzm.js [85882,85935) 53 units, body sha256
// dffbcd71bbaab0403179790e8cb25110ef453f8fff185b591627030fabed2234): the source records the
// interaction in the account presence channel. The product keeps local features only, so the binding
// does nothing.
//
// `analyticsReason` and `analyticsEvent` stand in for the telemetry helpers `S` (chunk-76anb6yt.js
// [638,664) 26 units, body sha256 65a65776e268960bd5cc11c861e76e3529375e2df46f70130ed18e27f72b5593)
// and `i` (chunk-4nygtnjw.js [1290,1407) 117 units, body sha256
// 7f2df95e7a21ebb980f33de170d716031fa6e71b459046f55a71def4a55e662f). The only copied caller is
// the tab button's stray-click predicate, which spends both values on an event record this runtime
// does not keep; the predicate's own result does not read them.
export function markScrollActivity(): void {}

export function analyticsReason(reason: string): string {
  return reason;
}

export function analyticsEvent(_eventName: string, _metadata?: unknown): void {}
