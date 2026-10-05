// Version A's bill page (R-071; Nate 9/28 picked Layout B's tracking page from backend R-070). It is today's bill page
// (../bill.js: loading, Back, the stance, who decides, hearings, the official record all stay as they are), with a
// tracking top in place of its status card, in the order the review recommended (R-070 recommendation 6): where the
// bill is ("In the Senate · step 3 of 6", a labelled bar, one plain sentence), then what's next with the deadline and
// the button on the first screen, then "Where do you stand?".
// On a phone with a hearing ahead, the testimony button sits in the "what's next" card instead of the bottom bar, so
// the tab bar can stay (R-070 problem 8: the bill page had no tabs). Other bills keep today's bottom bar.
import { S, esc, nick, plainStatus, hearingsOf } from '../core.js';
import bill, { situation } from '../bill.js';
import { btn } from '../ui.js';
import { stepsOf, stepBar } from './home.js';
const s0 = stepsOf;

const WIDE = window.matchMedia('(min-width: 1100px)');
const numOf = route => String(route.num || '').replace(/\s/g, '').toUpperCase();
const lookup = num => S.bills.find(x => x.bill_number === num) || Object.values(S.extra || {}).find(x => x.bill_number === num) || null;
// The bill is drawn (not loading or missing) when today's page drew its heading.
const drawnBill = (route, html) => html.includes('class="bl-head"') ? lookup(numOf(route)) : null;

function tracker(b, x) {
  const s = stepsOf(b), sub = s.law ? 'all 6 steps' : s.stopped ? `at step ${s.idx + 1} of 6` : `step ${s.idx + 1} of 6`;
  return `<section class="card a-track" aria-labelledby="a-trk-h"><h2 class="a-trkbig" id="a-trk-h">${esc(s.where)} <small>${esc(sub)}</small></h2>
    ${stepBar(b, { big: true, labels: true })}
    ${x.act && !WIDE.matches ? '' : `<p class="a-trksay">${esc(plainStatus(b).text)}</p>`}</section>`;   // with a hearing ahead, the Next card right below says it
}
export default {
  get tab() { return bill.tab; },
  // The tab bar stays unless the page needs today's bottom bar (no hearing ahead, or a wide screen's side panel).
  tabs: true,
  noTabs(route) { return !!this.bar(route) || WIDE.matches; },
  title: route => bill.title(route),
  render(route) {
    const html = bill.render(route), b = drawnBill(route, html);
    if (!b) return html;
    const x = situation(b), t = document.createElement('template');
    t.innerHTML = html;
    const root = t.content, status = root.querySelector('.bl-status'), stance = root.querySelector('.bl-stance'), act = root.querySelector('.bl-act');
    if (!status) return html;
    const box = document.createElement('template'); box.innerHTML = tracker(b, x);
    status.replaceWith(box.content);
    const trk = root.querySelector('.a-track');
    // Said once (A-14): the tracker says "Stopped this session", so the chip above it goes; and "Part of Disposable e-cigarette
    // ban" under a bill called Disposable e-cigarette ban keeps only its follow toggle.
    root.querySelectorAll('.bl-head .chip').forEach(c => { if (s0(b).stopped && /Stopped this session/.test(c.textContent)) c.remove(); });
    const iss = root.querySelector('.bl-issue a'); if (iss && nick(b) && iss.textContent.trim() === nick(b).trim()) iss.closest('.bl-issue').classList.add('a-same');
    if (!WIDE.matches && act && x.act) {
      // What's next, right under where it is: the hearing, the deadline and the button, then More ways to help.
      act.classList.add('a-next');
      const col = act.querySelector('.acard > .btncol');
      if (col && !x.differs && !S.done.has(`${b.id}|${x.act.h.id}|testimony`)) {
        const main = document.createElement('template');
        main.innerHTML = btn(x.act.late ? 'Send late testimony' : 'Write my testimony', { kind: 'primary', icon: 'notebook-pen', full: true, attrs: { 'data-helper': x.act.h.id, 'data-bill': b.id } });
        col.prepend(main.content);
      }
      trk.after(act);
      if (stance) act.after(stance);
    } else if (stance && !WIDE.matches) trk.after(stance);
    const out = document.createElement('div'); out.append(root);
    return out.innerHTML;
  },
  bar(route) {
    if (WIDE.matches) return bill.bar(route);
    const b = lookup(numOf(route)); if (!b || !hearingsOf(b)) return bill.bar(route);
    const x = situation(b);
    return x.act ? '' : bill.bar(route);
  },
  wire(route) { bill.wire(route); },
};
