import type { ParsedCron } from './scheduler.js';

export type CronCalendar = (parsed: ParsedCron, from: Date) => Date | null;

// MCt, chunk-atzjaveb.js [1988,2662), zero-based UTF-16; SHA-256
// 71378d5821cac631dfe41fe2db138ed7853b6008545668f423b89cbf4d060a2a.
export function sourceNextOccurrence(r: ParsedCron, s: Date): Date | null {
  let n = new Set(r.minute), e = new Set(r.hour), i = new Set(r.dayOfMonth), a = new Set(r.month), o = new Set(r.dayOfWeek),
    d = r.dayOfMonth.length === 31, p = r.dayOfWeek.length === 7, u = new Date(s.getTime());
  u.setSeconds(0, 0), u.setMinutes(u.getMinutes() + 1);
  let f = 527040;
  for (let g = 0; g < f; g++) {
    let y = u.getMonth() + 1;
    if (!a.has(y)) {
      u.setMonth(u.getMonth() + 1, 1), u.setHours(0, 0, 0, 0);
      continue;
    }
    let l = u.getDate(), m = u.getDay();
    if (!(d && p ? true : d ? o.has(m) : p ? i.has(l) : i.has(l) || o.has(m))) {
      u.setDate(u.getDate() + 1), u.setHours(0, 0, 0, 0);
      continue;
    }
    if (!e.has(u.getHours())) {
      u.setHours(u.getHours() + 1, 0, 0, 0);
      continue;
    }
    if (!n.has(u.getMinutes())) {
      u.setMinutes(u.getMinutes() + 1);
      continue;
    }
    return u;
  }
  return null;
}
