import { progressTime } from '../src/tui-progress-settings.js';
const at = Date.UTC(2026, 0, 2, 15, 45, 30);
for (const timeFormat of ['auto', '12-hour', '24-hour', '24-hour-utc', '%Y/%m/%d %H:%M']) {
  const t = progressTime({ timeFormat, timeZone: 'UTC' });
  console.log(JSON.stringify(timeFormat), 'short=', JSON.stringify(t.short(at)), 'stamp=', JSON.stringify(t.stamp(at)));
}
