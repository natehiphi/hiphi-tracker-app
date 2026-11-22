// "Issues for <bill>" (R-398 piece 9, gap C): the page a bill on no issue opens from "Put it on an issue". The bill's name under the heading, a field to search the issues, and the issues as choice chips;
// a picked one shows a check. Every pick saves at once (DB.setBillIssue through issue_edit.js moveBill, with Undo); a picked chip taken again takes the bill off. Done only goes back to the bill.
// A bill may be on more than one issue, so picking adds. Without a search the chips are the picked issues, then the ones related to the bill, then the person's own, then the rest by name, ten in all.
import { S, myIssueIds } from '../staff6/data.js';
import { billByRef, billRef } from '../staff6/model.js';
import { ic } from './icons7.js';
import { esc, btn } from './parts.js';
import { billName, billNo } from './steps.js';
import { redrawKeep, norm, matchWords } from './find.js';
import { eCig } from './issues.js';
import { moveBill } from './issue_edit.js';

const LIMIT = 10, $ = id => document.getElementById(id);
const bq = { id: null, q: '' };   // the words typed: kept across a redraw, dropped when another bill's page is drawn
const live = () => (S.issues || []).filter(i => !i.archived_at);
const pickedOf = b => new Set((S.billIssues || []).filter(x => x.bill_id === b.id).map(x => x.issue_id));
// The issues in the order offered (shared with "Set position and issue", do_place.js): already picked first, then those that share words with the bill (its title, description and nickname against the issue's
// name and description; short and common words do not count), then the person's own, then A to Z. Otherwise a fireworks bill is offered ten tobacco issues just because they are the person's own.
const COMMON = new Set('relating that this with from have will shall their there which under such than into other bill bills state hawaii hawaiʻi issue issues act acts public provides requires establishes allows amends makes appropriates department program programs section sections each also these those more only when where'.split(' '));
const stem = w => (w.length > 4 ? w.replace(/(ing|es|s)$/, '') : w);
const wordsOf = t => new Set(norm(eCig(String(t ?? ''))).split(' ').filter(w => w.length >= 4 && !COMMON.has(w)).map(stem));
export function rankIssues(b, issues, picked) {
  const mine = new Set([...myIssueIds()].map(String)), head = wordsOf(`${b.nickname || ''} ${b.title || ''}`), body = wordsOf(b.description);   // a word in the bill's name counts three times a word in its long description
  const rel = new Map(issues.map(i => { let n = 0; for (const w of wordsOf(`${i.name} ${i.description || ''}`)) n += head.has(w) ? 3 : body.has(w) ? 1 : 0; return [i.id, n]; }));
  return issues.slice().sort((x, y) => (picked.has(y.id) - picked.has(x.id)) || (rel.get(y.id) - rel.get(x.id)) || (mine.has(String(y.id)) - mine.has(String(x.id))) || eCig(x.name).localeCompare(eCig(y.name), 'en'));
}
function listOf(b, q) {
  const picked = pickedOf(b), ws = matchWords(q);
  let all = live(); if (q.trim()) all = ws.length ? all.filter(i => { const h = ' ' + norm(eCig(i.name)); return ws.every(alts => alts.some(a => h.includes(' ' + a))); }) : [];
  all = rankIssues(b, all, picked);
  return { shown: all.slice(0, LIMIT), total: all.length, picked };
}
function chipsHTML(b) {
  const { shown, total, picked } = listOf(b, bq.q), searching = !!bq.q.trim();
  const chips = shown.map(i => `<li><button type="button" class="bchip" id="bc-${esc(i.id)}" data-issue="${esc(i.id)}" aria-pressed="${picked.has(i.id)}">${picked.has(i.id) ? ic('check') : ''}<span>${esc(eCig(i.name))}</span></button></li>`).join('');
  const more = total > LIMIT ? `<p class="hint" id="biMore">Showing ${LIMIT} of ${total} ${searching ? 'issues that match' : 'issues'}. Search to find ${searching ? 'it' : 'another'}.</p>` : '';
  return (shown.length ? `<ul class="bchips" aria-label="Issues">${chips}</ul>` : '<p class="hint">No issue matches that. Try other words.</p>') + more
    + `<p class="hint bnote" id="biNote" role="status">${esc(moveBill.note || '')}</p>`;
}
export function billIssuesPage({ ref }) {
  const b = ref && ref.length < 40 ? billByRef(ref) : null;
  if (!b || b.tracked === false) return { html: '<div class="pn"><div class="hband neutral"><div class="ht"><h1 tabindex="-1">That bill is not here.</h1></div></div><div class="pbody"></div></div>', bind: () => {}, bill: null };
  if (bq.id !== b.id) { bq.id = b.id; bq.q = ''; moveBill.note = ''; }
  const html = `<div class="pn"><div class="hband neutral"><div class="ht"><h1 tabindex="-1">Issues for ${esc(billNo(b))}</h1><p class="bsub">${esc(billName(b))}</p></div></div>`
    + `<div class="pbody bill bpick"><label class="fl" for="biIn">Search the issues</label><input class="field" id="biIn" type="text" autocomplete="off" spellcheck="false" placeholder="Issue name or words" value="${esc(bq.q)}">`
    + `<p class="hint" id="biHint">Pick an issue. Each pick saves at once.</p><div id="biChips">${chipsHTML(b)}</div>`
    + `<div class="sfoot">${btn('Done', { kind: 'filled', id: 'biDone' })}</div></div></div>`;
  return {
    html, bill: b,
    bind: () => {
      $('biIn')?.addEventListener('input', ev => { bq.q = ev.target.value; $('biChips').innerHTML = chipsHTML(b); });
      $('biDone')?.addEventListener('click', () => $('tbBack')?.click());   // Done only goes back to the bill: every pick has been saved already
      $('biChips')?.addEventListener('click', async ev => {
        const c = ev.target.closest('[data-issue]'); if (!c || c.disabled) return;
        const issue = (S.issues || []).find(i => i.id === c.dataset.issue); if (!issue) return;
        c.disabled = true;
        const on = c.getAttribute('aria-pressed') !== 'true';
        const done = await moveBill(issue, b, on, { style: 'bill', after: () => { redrawKeep(); } });
        if (!done) c.disabled = false;
      });
    },
  };
}
export const billIssuesHref = b => '#/bill-issues/' + encodeURIComponent(billRef(b));
