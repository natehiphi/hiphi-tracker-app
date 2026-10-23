// Outreach > This week's asks (#/outreach; R-269, Nate 12 Oct). v4 (R-269): Outreach is for rallying people, so it opens
// on the week's asks: each bill's public ask, its testimony deadline and its share page, ready to paste into the
// newsletter or a post. It starts on the viewer's coalitions (Saya: 16 bills, 13 of them not CTFH's, came down to 3);
// a quiet switch shows them all, and the address says which (#/outreach?all=1), so a link opens the same list (B-10).
// R-277 fix 14 (U-9): the switch is the one "whose work" switch of every list: My coalitions | Team (Mine | Team for someone
// who helps on no coalition, whose asks are their own bills'); it was a toggle called "Every coalition". The supporters table, which Outreach used to open on (5.7 screens for Saya), is the last tab.
// today.js draws the card and its two copy buttons (weekAsksHTML, wireWeekAsks), as it did on Emails, which no longer
// shows it (A-14: said once). A namespace import, not a named one: the { mine, open } options land on another branch,
// and a named import of an export that is not there would stop the whole app loading.
import { S, esc } from './data.js';
import { btn, empty, sectionNav, whoseSeg } from './ui.js';
import * as TODAY from './today.js';
import { pageHead } from './lists.js';
import { myCoalitions } from './filters.js';

const everyOn = route => route?.q?.all === '1';
function cardHTML(all) {
  if (typeof TODAY.weekAsksHTML !== 'function') return '';
  try {
    const h = TODAY.weekAsksHTML({ mine: !all, open: true }) || '';
    // Until today.js reads { open }, its card comes folded; on a page that is only this list, it opens.
    return h.replace(/^(\s*<details\b)(?![^>]*\sopen\b)/, '$1 open');
  } catch (e) { console.error(e); return ''; }
}
// Whose bills "mine" means: the one coalition by name, else "your coalitions'", else (no coalition) the viewer's own.
function whose() {
  const mc = [...myCoalitions()], one = mc.length === 1 ? (S.campaigns || []).find(c => c.id === mc[0]) : null;
  return one ? `${one.name}’s bills` : mc.length ? 'your coalitions’ bills' : 'your bills';
}
// B-3: an empty list says why and offers the way on. Nothing on the viewer's coalitions: the switch's job, as a button.
// Nothing anywhere: the week, where hearings (and so new asks) appear.
const emptyHTML = all => `<div class="le-empty">${all
  ? empty({ title: 'No asks this week', text: 'A bill on the public page with a position and testimony due this week shows here, with its ask and its share page.', action: btn('See this week', { kind: 'secondary', href: '#/?view=week' }) })
  : empty({ title: `No asks this week on ${esc(whose())}`, action: btn('Show the team’s asks', { kind: 'secondary', attrs: { 'data-otall': '1' } }) })}</div>`;

// The switch redraws in place: the address changes (replace, so Back still leaves Outreach) and focus stays on the switch.
function setAll(on) {
  S.go(on ? '#/outreach?all=1' : '#/outreach', { replace: true, keepScroll: true });
  document.querySelector(`[data-seg="otwho"][data-val="${on ? 'all' : 'mine'}"]`)?.focus();
}

export default {
  tab: 'outreach',
  title: () => 'This week’s asks',
  // Wide like Emails and Supporters, so Outreach's tab row stays in one place from tab to tab; the page itself keeps a
  // reading width (supporters.css .ot-asks).
  wide: () => true,
  render(route) {
    const all = everyOn(route), card = cardHTML(all);
    const sw = whoseSeg('otwho', myCoalitions().size ? { coal: 'mine', team: 'all' } : { mine: 'mine', team: 'all' }, all ? 'all' : 'mine', { label: 'Whose asks' });
    return `<div class="le-page ot-asks">
      ${pageHead(sectionNav('outreach', 'asks'), 'This week’s asks', '', sw)}
      ${card ? `<div class="ot-card">${card}</div>` : emptyHTML(all)}
    </div>`;
  },
  wire(route, root) {
    root.querySelectorAll('[data-seg="otwho"]').forEach(b => b.onclick = () => setAll(b.dataset.val === 'all'));
    root.querySelector('[data-otall]')?.addEventListener('click', () => setAll(true));
    if (typeof TODAY.wireWeekAsks === 'function') { const box = root.querySelector('.ot-card'); if (box) TODAY.wireWeekAsks(box); }
  },
};
