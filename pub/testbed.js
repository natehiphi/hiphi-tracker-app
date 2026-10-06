// The sandbox's day picker, for comparing today's tracker with version A in front of testers (R-071, Nate 9/28).
// ?demo=1&day=tue moves the sandbox clock from Mon 16 March 2026, 9:00, to the same hour on a later day of that week,
// and adds the committee decisions the Legislature really made by then (demo/days.json, read from the database 9/28;
// the snapshot itself stops at Monday morning). Loaded by track.html and track-a.html before the app, so both
// versions see the same day. It does nothing outside the sandbox, or with no day (Monday stays exactly as it was).
// The scenario itself (who is visiting, when they were last here) is set by compare.html.
import { DEMO, SEASON_OFF, DEMO_ASOF } from './core.js';

const DAYS = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4 };
const want = new URLSearchParams(location.search).get('day');
export const DAY = DEMO && !SEASON_OFF && want in DAYS ? want : 'mon';
export const SHIFT = DAYS[DAY] * 864e5;
// "Mon, Mar 16, 2026": the day the sandbox is showing, for its band.
export const dayLabel = () => new Date().toLocaleDateString('en-US', { timeZone: 'Pacific/Honolulu', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

if (SHIFT) {
  // core.js has already moved the clock to Monday 9:00 (it ticks on from there); this moves that clock on by whole days.
  const Mon = window.Date;
  window.Date = class extends Mon {
    constructor(...a) { if (a.length) super(...a); else super(Mon.now() + SHIFT); }
    static now() { return Mon.now() + SHIFT; }
  };
  // The decisions announced by 9:00 on the chosen day join the snapshot as it loads.
  const asof = new Mon(DEMO_ASOF).getTime() + SHIFT, realFetch = window.fetch.bind(window);
  window.fetch = async (url, opts) => {
    const res = await realFetch(url, opts);
    if (!String(url).includes('demo/snapshot.json')) return res;
    const [snap, days] = await Promise.all([res.json(), realFetch('demo/days.json?v=20260928a').then(r => r.json()).catch(() => ({ outcomes: [] }))]);
    const have = new Set(snap.outcomes.map(o => o.hearing_id));
    for (const o of days.outcomes || []) if (!have.has(o.hearing_id) && Date.parse(o.reported_at) <= asof) snap.outcomes.push(o);
    return new Response(JSON.stringify(snap), { headers: { 'Content-Type': 'application/json' } });
  };
  // Today's page writes "Mon, Mar 16, 2026" in its sandbox band; say the day it is really showing.
  // Only the date's own text (track.html's band has a "Next day" link after it, R-187).
  const fixBand = () => document.querySelectorAll('.band').forEach(b => { const el = b.querySelector('[data-band-day]') || b; if (el.textContent.includes('Mon, Mar 16, 2026')) el.textContent = el.textContent.replace('Mon, Mar 16, 2026', dayLabel()); });
  new MutationObserver(fixBand).observe(document.documentElement, { childList: true, subtree: true });
}
