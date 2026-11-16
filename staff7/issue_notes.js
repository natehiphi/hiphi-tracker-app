// The issue page's "Team notes and history" (R-398): ONE list, newest first, across all the issue's bills. Each line says whose it is (a bill's number as a link, or "This issue"), who wrote it (a note) and when.
// Notes about one bill live on that bill's page (they are the bill's team conversation); notes about the issue itself are the issue's own (issue_data.js). Anything here that writes is addNote/deleteNote only.
import { S, DEMO, SESSION_YEAR } from '../staff6/data.js';
import { esc, btn, toast } from './parts.js';
import { first, billNo } from './steps.js';
import { dateY, ymdH } from './bill_words.js';
import { capitolItems, ourItems } from './bill_history.js';
import { feedOf, retryFeed, addNote, deleteNote } from './issue_data.js';
import { redrawKeep } from './find.js';
import { eCig, billHref } from './issues.js';

export const nui = { id: null, open: false, text: '', busy: false, err: false, all: new Set() };   // the note box, and the issues whose whole list is open
const $ = id => document.getElementById(id);
const FIRST = 6;
const nameOf = (id, me) => id && me && id === me.id ? 'You' : first(S.advocates.find(a => a.id === id));
const day = t => dateY(ymdH(t));

// plainAction says "Wed 3/18"; here every date reads "Wed, Mar 18" (the bill page keeps the Capitol's own short form)
const slashDate = t => t.replace(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) (\d{1,2})\/(\d{1,2})\b/g, (_, m, d) => dateY(`${SESSION_YEAR}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`));

// Everything, newest first: [{ t, tag (html), who (html or ''), body (html), extra }]. The Capitol's lines and ours are worded by bill_history.js, the SAME functions the bill page uses.
// What makes two lines one: a note by its own id, a team message by its id (or, with none, its author, words and day), a Capitol line by bill, words and day. A note never merges with a Capitol line.
function lines(issue, bills, feed, me, who) {
  const by = new Map(bills.map(b => [b.id, b])), out = [], seen = new Set();
  const tag = b => b ? `<a class="lk" href="${esc(billHref(who, b, issue.id))}">${esc(billNo(b))}</a>` : 'This issue';
  const add = (key, t, b, w, body, extra = '') => { if (!t || !body || seen.has(key)) return; seen.add(key); out.push({ t, tag: tag(b), who: w, body, extra }); };
  const nb = t => esc(eCig(t)).replace(/\n/g, '<br>');
  for (const n of feed.notes || []) add(`note|${n.id ?? `${n.advocate_id}|${n.body}|${n.created_at}`}`, n.created_at, null, nameOf(n.advocate_id, me), nb(n.body), '');
  for (const m of feed.msgs || []) add(`msg|${m.bill_id}|${m.id ?? `${m.advocate_id}|${m.body}`}|${ymdH(m.created_at)}`, m.created_at, by.get(m.bill_id), nameOf(m.advocate_id, me), nb(m.body));
  for (const b of bills) {
    const x = { timeline: (feed.rows || []).filter(r => r.bill_id === b.id), drafts: S.drafts?.[b.id] || [] };
    for (const c0 of capitolItems(x, b)) { const c = { ...c0, text: slashDate(c0.text) }; add(`cap|${b.id}|${c.text}|${ymdH(c.t)}`, c.t, b, '', esc(eCig(c.text)), ' · the Capitol'); }
    ourItems(b, x).forEach((o, i) => add(`our|${b.id}|${o.html}|${o.small}|${o.t}|${i}`, o.t, b, '', o.html, o.small ? ` · ${esc(o.small)}` : ''));
  }
  return out.sort((p, q) => String(q.t).localeCompare(String(p.t)));
}
const itemHTML = (l, hide) => `<li${hide ? ' class="nx" hidden' : ''}><small>${l.tag}${l.who ? ` · <b>${esc(l.who)}</b>` : ''} · ${esc(day(l.t))}${l.extra || ''}</small><p>${l.body}</p></li>`;

function boxHTML() {
  if (!nui.open && !nui.text.trim()) return `<div class="bnadd closed" id="iNoteBox">${btn('Add a note', { kind: 'quiet', id: 'iNoteOpen', attrs: 'aria-expanded="false" aria-controls="iNoteBox"' })}</div>`;
  return `<div class="bnadd" id="iNoteBox"><label class="fl" for="iNoteIn">A note about this issue. Only the team sees it.</label><textarea class="field" id="iNoteIn" rows="3" maxlength="4000">${esc(nui.text)}</textarea>`
    + `<div class="bnact">${btn('Add the note', { kind: 'quiet', id: 'iNoteGo', disabled: !nui.text.trim() || nui.busy, loading: nui.busy })}${btn('Cancel', { kind: 'text', id: 'iNoteCancel' })}<span class="hint">For a note about one bill, add it on that bill’s page.</span></div>`
    + `${DEMO ? '<p class="hint">Practice copy: this note is not saved.</p>' : ''}<p class="hint berr" id="iNoteErr" role="alert"${nui.err ? '' : ' hidden'}>We could not save that. Try again.</p></div>`;
}

export function notesHTML(issue, bills, me, who) {
  const feed = feedOf(issue, bills);
  let h = '<h2 class="sh" id="nH">Team notes and history</h2>';
  if (feed === 'loading') return `${h}<p class="hint" id="nWait">Loading the notes and history.</p>`;
  if (feed === 'failed') return `${h}<p class="hint" id="nFail">We could not load the notes and history. ${btn('Try again', { kind: 'text', id: 'nRetry' })}</p>`;
  const ls = lines(issue, bills, feed, me, who), open = nui.all.has(issue.id), extra = ls.length - FIRST;
  h += feed.notesOK ? boxHTML() : '';
  h += ls.length ? `<ul class="nl" id="nList">${ls.map((l, i) => itemHTML(l, i >= FIRST && !open)).join('')}</ul>` : '<p class="hint" id="nNone">Nothing yet.</p>';
  if (extra > 0) h += `<p class="bmore">${btn(open ? 'Show fewer' : `Show all ${ls.length}`, { kind: 'text', id: 'nMore', attrs: `aria-expanded="${open}" aria-controls="nList" data-all="Show all ${ls.length}"` })}</p>`;
  if (DEMO && (feed.notes || []).length && !nui.open) h += '<p class="hint">Practice copy: your note is not saved.</p>';
  return h;
}

export function bindNotes(issue, me) {
  const later = id => setTimeout(() => $(id)?.focus(), 0);
  $('nRetry')?.addEventListener('click', () => retryFeed(issue));
  $('iNoteOpen')?.addEventListener('click', () => { nui.open = true; redrawKeep(); later('iNoteIn'); });
  const t = $('iNoteIn');
  if (t) {
    t.addEventListener('input', () => { nui.text = t.value; if (nui.err) { nui.err = false; const er = $('iNoteErr'); if (er) er.hidden = true; } const g = $('iNoteGo'); if (g && !nui.busy) g.disabled = !t.value.trim(); });
    t.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !t.value.trim() && !nui.busy) { ev.preventDefault(); ev.stopPropagation(); nui.open = false; redrawKeep(); later('iNoteOpen'); } });
    $('iNoteCancel')?.addEventListener('click', () => { nui.open = false; nui.text = ''; nui.err = false; redrawKeep(); later('iNoteOpen'); });
    $('iNoteGo')?.addEventListener('click', async () => {
      const body = nui.text.trim(); if (!body || nui.busy) return;
      nui.busy = true; nui.err = false; redrawKeep();
      try {
        const n = await addNote(issue, body);
        if (nui.id !== issue.id) return;   // the person went to another issue while it saved: that page's box is not ours to change
        nui.busy = false; nui.open = false; nui.text = ''; redrawKeep(); later('iNoteOpen');
        toast(DEMO ? 'Note added (practice copy: not saved)' : 'Note added', { undo: async () => { try { await deleteNote(issue, n); redrawKeep(); toast('Put back'); } catch { toast('We could not put that back.'); } } });
      } catch { if (nui.id !== issue.id) return; nui.busy = false; nui.err = true; redrawKeep(); later('iNoteGo'); }   // the words stay in the box
    });
  }
  const m = $('nMore');
  if (m) m.addEventListener('click', () => {
    const on = m.getAttribute('aria-expanded') !== 'true';
    if (on) nui.all.add(issue.id); else nui.all.delete(issue.id);
    m.setAttribute('aria-expanded', String(on)); m.textContent = on ? 'Show fewer' : m.dataset.all;
    document.querySelectorAll('#nList li.nx').forEach(li => { li.hidden = !on; });
  });
}
