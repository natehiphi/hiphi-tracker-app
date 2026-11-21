// Staff7's issue page (R-398): the band (the issue's own mark, the word "Issue", its name), HIPHI's position and who leads, where the issue stands (two plain lines, then the viewer's one move), the bills as a
// real table, the facts, and one list of team notes and history across all the issue's bills. Everything is worked out from data already in memory, and the words and cells come from the SAME helpers the
// Issues list uses (bill_cell.js, issues.js), so the list and this page never disagree. Looking never changes anything: the buttons for the lead, the goal and the talking points are the issue's lead's and an
// admin's; a step's button is the viewer's own. The pieces: issue_table.js (bills), issue_edit.js (edits), issue_notes.js (notes and history), issue_data.js (reads).
import { S, POSITIONS } from '../staff6/data.js';
import { stopOf, hearingAhead, roomName } from '../staff6/model.js';
import { ic } from './icons7.js';
import { esc, btn, toast } from './parts.js';
import { billNo, first } from './steps.js';
import { isAlive, billsOfIssue, deadlineOf } from './standing.js';
import { dateWords, daysTo } from './words.js';
import { testimonyDue, letterState, testimonyShort, cmtesLinks, ymdH } from './bill_words.js';
import { chairsHTML, talkingHTML, bindMore } from './bill_more.js';
import { eCig, iconOf, tint, issuesHref, stepOn, sessionOf, hearTxt, billHref } from './issues.js';
import { stoppedISO } from './bill.js';
import { pathOf } from './path.js';
import { billsHTML, bindTable, sortedAlive, deadOrder, tui } from './issue_table.js';
import { placeLineHTML } from './place.js';
import { leadButton, leadForm, goalCell, pointsCell, mayEditIssue, bindEdit, bindBills, eui } from './issue_edit.js';
import { notesHTML, bindNotes, nui } from './issue_notes.js';
import { shareUrl, onPublicSite } from './issue_data.js';

const enc = encodeURIComponent;
const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
const live = id => { if (!id) return false; const a = S.advocates.find(x => x.id === id); return !!a && a.is_active !== false; };   // an advocate we cannot find does not lead
let drawnId = null;   // the issue the edit state (the lead, goal and points forms, the note box, the stopped fold) belongs to
const line = (html, { muted = false } = {}) => `<p class="bln${muted ? ' m' : ''}"><span class="blt">${html}</span></p>`;
const dayWord = d => { const k = daysTo(d); return k === 0 ? 'today' : k === 1 ? '1 day' : `${k} days`; };
const short = d => dateWords(d).split(', ')[1] || dateWords(d);
const clock = t => new Date(t).toLocaleTimeString('en-US', { timeZone: 'Pacific/Honolulu', hour: 'numeric', minute: '2-digit' });
// "Wed, Mar 18, 1:00 PM"; "today 1:00 PM" and "tomorrow 1:00 PM" when it is
const whenAt = t => { const k = daysTo(ymdH(t)); return k === 0 || k === 1 ? hearTxt(t) : `${dateWords(ymdH(t))}, ${clock(t)}`; };
const TRI = () => ic('triangle-alert');

// ---------------------------------------------------------------------------------- the band and the position line
function bandHTML(issue, bills, who, back, backLabel) {
  const alive = bills.filter(isAlive), sub = !bills.length ? 'No bill on it this session' : !alive.length ? (bills.length === 1 ? 'Its bill stopped this year' : `None of its ${bills.length} bills is alive`) : alive.length === bills.length ? n(bills.length, 'bill', 'bills') : `${alive.length} of ${bills.length} bills alive`;
  return `<div class="hband bb" style="${tint(issue)}"><span class="imark big iss" aria-hidden="true">${ic(iconOf(issue))}</span><div class="ht"><p class="kindl">Issue</p><h1 tabindex="-1">${esc(eCig(issue.name))}</h1><p class="bsub"><span class="bno">${esc(sub)}</span></p></div></div>`;
}
function leadWords(issue, me) {
  if (!live(issue.owner_id)) return 'Nobody leads yet';
  if (me && issue.owner_id === me.id) return 'You lead';
  const a = S.advocates.find(x => x.id === issue.owner_id);
  return a?.initials ? `<a class="lk" href="#/issues?who=${enc(a.initials)}">${esc(first(a))}</a> leads` : `${esc(first(a))} leads`;
}
const stanceWords = issue => (POSITIONS.find(p => p[0] === issue.stance) || [])[1] || '';
function positionHTML(issue, me, can) {
  const w = stanceWords(issue);
  return `<p class="bposl" id="iPos">${w ? `<span class="bpos-k">HIPHI’s position</span> <b class="bpos">${esc(w)}</b>` : '<b class="bpos">No position yet</b>'}<span class="bsep" aria-hidden="true">·</span><span id="iLead">${leadWords(issue, me)}</span>${can && !eui.lead ? leadButton() : ''}</p>${can && eui.lead ? leadForm(issue, me) : ''}`;
}

// ---------------------------------------------------------------------------------- where the issue stands: at most two lines
// One line for one bill, from its deadline cell: the hearing and its testimony, what it needs, or where it stands
function lineFor({ b, c }, row, who, issue) {
  const lk = `<a class="lk" href="${esc(billHref(who, b, issue.id))}">${esc(billNo(b))}</a>`, st = stopOf(b), cm = st.committee ? cmtesLinks(st.committee, b) : '';
  const h = c.key === 'hearing' || c.key === 'late' ? hearingAhead(b) : null;
  if (h) {
    const room = roomName(h.room), due = testimonyDue(h), ts = letterState(h, b), late = c.key === 'late';
    const test = ` · testimony ${due <= Date.now() ? 'was due' : 'due'} ${esc(hearTxt(due))}, ${esc(testimonyShort(ts))}`;
    const dl = st.deadline && late ? ` · after the ${esc(short(String(st.deadline.date).slice(0, 10)))} deadline` : '';
    return line(`<b${late ? ' class="riskt"' : ''}>${late ? TRI() : ''}Hearing ${esc(whenAt(h.scheduled_at))}</b>${dl} · ${lk} · ${cmtesLinks(h.committee, b)}${room ? ` · ${esc(room)}` : ''}${test}`);
  }
  const dl = deadlineOf(b);
  if (c.key === 'risk' || c.key === 'need') {
    const risk = c.key === 'risk';
    return line(`<b${risk ? ' class="riskt"' : ''}>${risk ? TRI() : ''}Needs a hearing by ${esc(dateWords(dl.date))}</b> · ${esc(dayWord(dl.date))} · ${lk}${cm ? ` · ${cm}` : ''}`);
  }
  if (c.key === 'cleared') return line(`${lk} cleared the ${esc(short(row.date))} deadline${dl ? ` · next it needs a hearing in ${cm || 'its next committee'} by ${esc(dateWords(dl.date))}` : cm ? ` · now in ${cm}` : ''}`, { muted: true });
  if (c.key === 'until') return line(`${lk} · ${esc(c.text.charAt(0).toLowerCase() + c.text.slice(1))}${cm ? ` in ${cm}` : ''}`, { muted: true });
  if (c.key === 'unsure') return line(`${lk}${cm ? ` · in ${cm}` : ''} · not sure yet whether it has cleared the deadline`, { muted: true });
  if (c.key === 'noask') return line(`${lk} · not asking for a hearing${cm ? ` · in ${cm}` : ''}`, { muted: true });
  return line(`${lk} · ${esc(c.text.charAt(0).toLowerCase() + c.text.slice(1))}`, { muted: true });
}
function stoppedLines(issue, bills, who) {
  const dead = bills.slice(), last = deadOrder(dead)[0], iso = stoppedISO(last);   // the bill named is the one whose date and reason are said, and it is the first row of the folded list (issue_table.js deadOrder)
  const lk = b => `<a class="lk" href="${esc(billHref(who, b, issue.id))}">${esc(billNo(b))}</a>`;
  let h = line(`<b>Stopped for this year${iso ? ` on ${esc(dateWords(iso))}` : ''}</b> · ${dead.length === 1 ? 'its only bill' : 'its last bill'}, ${lk(last)} · ${placeLineHTML(last, null, { bare: true })}`);   // (a bill that is only "Stopped" is not told again: the line has said it)
  const filed = dead.find(b => (S.drafts?.[b.id] || []).some(d => d.status === 'filed'));
  h += line(`${filed ? `We filed testimony on ${lk(filed)} · to` : 'To'} try again in 2027, someone must introduce a new bill`, { muted: true });
  return h;
}
function statusHTML(issue, bills, row, who, open, own) {
  const alive = sortedAlive(bills, row);
  if (!bills.length) return '';
  if (!alive.length) return `<div class="bstat" id="iStat">${stoppedLines(issue, bills, who)}</div>`;
  let out = [], mine = '';
  const first1 = alive[0];
  out.push(lineFor(first1, row, who, issue));
  if (first1.c.key === 'risk' && alive.length === 1) {   // the only bill alive is at risk: say what that means, and whom to ask
    const cm = stopOf(first1.b).committee, ch = cm ? chairsHTML(cm) : '';
    out.push(line(`Without a hearing the issue stops for the year.${ch ? ` ${ch}` : ''}`, { muted: true }));
  } else if (alive[1]) out.push(lineFor(alive[1], row, who, issue));
  if (own) {
    const hit = alive.map(a => ({ a, s: stepOn(open, a.b) })).find(x => x.s);
    if (hit) mine = `<p class="bmv"><a class="btn quiet ymove" href="#/do/${enc(hit.s.id)}">Your move · ${esc(hit.s.verb)}${alive.length > 1 && !hit.s.members && /testimony/i.test(hit.s.verb) ? ` on ${esc(billNo(hit.a.b))}` : ''}</a></p>`;
  }
  return `<div class="bstat" id="iStat">${out.join('')}${mine}</div>`;
}

// ---------------------------------------------------------------------------------- the facts
const kv = rows => `<dl class="kv bfacts" id="iFacts">${rows.filter(Boolean).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
function factsHTML(issue, bills, row, who, can, me) {
  const desc = String(issue.description || '').replace(/\s+/g, ' ').trim(), cat = (S.categories || []).find(c => c.key === issue.category);
  const owner = live(issue.owner_id) ? S.advocates.find(a => a.id === issue.owner_id) : null;
  const src = sortedAlive(bills, row).map(x => x.b).concat(bills.filter(b => !isAlive(b))).find(b => (Array.isArray(b.talking_points) ? b.talking_points : []).length);
  const fb = src ? `From ${esc(billNo(src))} · ${talkingHTML(src)}` : '';
  return kv([
    ['What we want', `${desc ? esc(eCig(desc)) : '<span class="m">Not written</span>'}<span class="to">shown on the public site</span>`],
    ['Our goal', goalCell(issue, can)],
    cat ? ['Topic', `<a class="lk" href="#/issues/topic/${enc(cat.key)}${who.code ? `?who=${enc(who.code)}` : ''}">${esc(cat.name)}</a>`] : null,
    ['Lead', owner ? (me && owner.id === me.id ? 'You' : esc(first(owner))) : 'Nobody leads yet'],
    ['Talking points', pointsCell(issue, can, fb)],
    ['On the public site', onPublicSite(issue) ? `Shown · ${btn('Copy the link', { kind: 'text', id: 'iCopy' })}` : 'Not shown']]);
}

// ---------------------------------------------------------------------------------- the page
// Returns { html, bind }. `back`/`backLabel`: where the issue list's own back link goes (a topic's list, when it was opened from a topic)
export function issuePage({ issue, me, open, who, own, back, backLabel, row: listRow }) {
  // The deadline the table is read against is the one the Issues list beside it uses (its session row), so a bill the list calls "cleared" is never "needs a hearing" here (Nate 16 Nov: the two say the same thing). Alone, the issue's own next deadline.
  const bills = billsOfIssue(issue), row = listRow !== undefined ? (listRow || null) : (sessionOf([{ issue, bills }]).next?.row || null), can = mayEditIssue(issue, me);
  if (drawnId !== issue.id) { drawnId = issue.id; eui.id = nui.id = issue.id; eui.lead = eui.goal = eui.tp = eui.bills = null; Object.assign(nui, { open: false, text: '', busy: false, err: false }); tui.open.clear(); }   // what was typed on one issue never shows (or saves) on another
  if (!can) { eui.lead = null; eui.goal = null; eui.tp = null; }   // what was open belongs to someone who could edit
  let h = `<div class="pn">${bandHTML(issue, bills, who, back, backLabel)}<div class="pbody bill">`;
  h += positionHTML(issue, me, can);
  h += statusHTML(issue, bills, row, who, open, own);
  h += billsHTML(issue, bills, row, who);
  h += '<h2 class="sh" id="iAboutH">About this issue</h2>' + factsHTML(issue, bills, row, who, can, me);
  h += `<div class="bparts" id="iParts">${notesHTML(issue, bills, me, who)}</div>`;
  return {
    html: h + '</div></div>',
    bind: () => {
      bindTable(issue); bindEdit(issue, me); bindBills(issue, me); bindNotes(issue, me); bindMore();
      document.getElementById('iCopy')?.addEventListener('click', async () => {
        const url = shareUrl(issue);
        try { await navigator.clipboard.writeText(url); toast('Link copied'); }
        catch { try { const t = document.createElement('textarea'); t.value = url; t.setAttribute('readonly', ''); t.className = 'sr'; document.body.appendChild(t); t.select(); const ok = document.execCommand('copy'); t.remove(); toast(ok ? 'Link copied' : 'We could not copy the link.'); } catch { toast('We could not copy the link.'); } }
      });
    },
  };
}
