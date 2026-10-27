// How an issue is doing, in one badge and one plain sentence, for the issue band on a bill page (R-340, Nate 26 Oct: "the
// issue's name and whether it's on track" at a glance, picked from mockups). The rule is the staff issue page's health
// check (staff6/issuepage.js health), said in the public page's words:
//   Became law     a bill on it became law this year
//   Did not advance  no bill on it is still moving this year (the public words, never "stopped": R-158's check)
//   Still moving   bills that started in the House and in the Senate are both alive, or one is in its final steps
//                  (conference, the Governor, the voters)
//   At risk        every bill still moving started in one chamber: if they stop there, the issue ends this year
// Between sessions there is no badge, only what happened and when it can come back.
// An issue's bills that are not on the page yet (a shared link straight to one bill) are asked for once; until they come,
// the band says the issue's name and nothing about how it is doing, rather than guess "At risk" from half the bills.
import { S, D, DEMO, app, spaced, stopOf, sessionInfo, findBill, supa, issueBills } from './core.js';
import { moving, becameLaw } from './mybills.js';

const originOf = b => b.chamber || (/^S/.test(b.bill_number) ? 'S' : 'H');
const CH = { H: 'House', S: 'Senate' };
const FINAL = new Set(['conference', 'governor', 'ballot']);
const asked = S.ihAsked ??= new Set();

function billsOf(i) {
  const ids = issueBills(i), have = ids.map(id => findBill(id) || (DEMO ? D.bills.find(b => b.id === id) : null));
  const missing = ids.filter((id, k) => !have[k]);
  if (missing.length && !DEMO && !asked.has(i.id)) {
    asked.add(i.id);
    supa().then(c => c.from('public_all_bills').select('*').in('id', missing.slice(0, 40)))
      .then(({ data }) => { (data || []).forEach(b => { S.extra[b.id] ??= b; }); if (data?.length) app.render(); }).catch(() => {});
  }
  return missing.length ? null : have;
}

// { tone: 'ok' | 'warn' | 'stop' | '', word, text }, or null while its bills are still coming.
export function issueHealth(i, b = null) {
  const si = sessionInfo();
  if (si.phase !== 'in') return { tone: '', word: '', text: 'New bills on it can come up when the Legislature meets in January.' };
  const bills = billsOf(i); if (!bills) return null;
  if (!bills.length) return { tone: '', word: '', text: 'No bills on it yet this year.' };
  const law = bills.filter(becameLaw);
  if (law.length) return { tone: 'ok', word: 'Became law', text: `${law.map(b => spaced(b.bill_number)).join(' and ')} became law.` };
  const live = bills.filter(moving);
  if (!live.length) return { tone: 'stop', word: 'Did not advance', text: bills.length === 1 ? 'Its only bill did not advance this year.' : 'No bill on it advanced this year.' };
  const fin = live.find(b => FINAL.has(stopOf(b).phase));
  if (fin) return { tone: 'ok', word: 'Still moving', text: `${spaced(fin.bill_number)} has passed the House and the Senate.` };
  const from = new Set(live.map(originOf));
  if (from.size > 1) return { tone: 'ok', word: 'Still moving', text: 'A bill in each chamber is still alive.' };
  const one = CH[[...from][0]];
  // Said from the page's bill when it is the last one (the fresh-eyes review: "only one bill ... started in the Senate" read
  // as another bill on SB 2695's own page).
  const last = live.length === 1 && b && live[0].id === b.id;
  return { tone: 'warn', word: 'At risk', text: last ? 'This is the only bill on it still moving. If it stops, the issue ends this year.'
    : live.length === 1 ? `Only ${spaced(live[0].bill_number)} is still moving on it. If it stops, the issue ends this year.`
    : `Its bills still moving all started in the ${one}. If they stop, the issue ends this year.` };
}
