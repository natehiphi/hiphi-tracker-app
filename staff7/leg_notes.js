// The Notes section of a legislator's page (R-398 piece 14, part 1): the card (Follow up, Good to know, Cares about, Our contact, Where they stand) and the Log.
//   notesHTML(l, U, X) -> the section;   N = the pinned lines kept in memory (practice)
// Quiet actions carry data-act hooks that legislator.js wires: form-contact, form-cares (the forms open in their rows), add-line, pin-remove (part 2), log-talk, goto, all, lf.
// Live, the staff-entered extras (Good to know, Cares about, Our contact, the follow-up date, a note's kind) are hidden because their tables (migration 206 and a small new one) are not
// applied; the card is then Where they stand alone, and the Log lists the notes, asks and testimony that exist.
import { S, DEMO } from '../staff6/data.js';
import * as m from '../staff6/model.js';
import { esc } from './parts.js';
import { ic } from './icons7.js';
import { dateWords } from './words.js';
import * as D from './leg_data.js';
import { today } from './leg_talk.js';

const HST = { timeZone: 'Pacific/Honolulu' };
const extras = () => DEMO;
const firstName = n => String(n || '').split(' ')[0];
const dayMs = iso => new Date(iso + 'T12:00:00-10:00').getTime();
const shift = n => { const d = new Date(dayMs(today())); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA', HST); };
const longDay = iso => new Date(dayMs(iso)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: HST.timeZone });
const ago = iso => { const n = Math.round((dayMs(today()) - dayMs(iso)) / 864e5); return n <= 0 ? 'today' : n === 1 ? 'yesterday' : n + ' days ago'; };
const dayOf = n => n.met_on ? String(n.met_on).slice(0, 10) : new Date(n.created_at).toLocaleDateString('en-CA', HST);
const mineId = id => id === S.me?.id;
const whoName = id => mineId(id) ? 'You' : firstName(D.advName(id));

// ===== PRACTICE SAMPLE (practice copy only, in memory; Gregg Takayama, id 130): the content NOTES-BRIEF.md calls "sample content". Asks, testimony and stances are NOT here, they come from the practice data. =====
const SAMPLE_ID = 130;
const mates = () => (S.advocates || []).filter(a => a.id !== S.me?.id && a.is_active !== false);
const billNo = no => { try { const o = D.ourBills(S.legislators.find(x => x.id === SAMPLE_ID), S.me); return o.all.find(b => D.billLabel(b).no === no) || null; } catch { return null; } };
function sampleTalks(l) {
  if (!DEMO || l.id !== SAMPLE_ID) return [];
  const t1 = mates()[0]?.id, t2 = mates()[1]?.id || t1, a = billNo('SB 3202'), c = billNo('SB 3025'), me = S.me?.id;
  const mk = (n, who, kind, bill, body, fu) => ({ id: 'sample-' + n, who, kind, bill, body, day: shift(-n), at: dayMs(shift(-n)), fu: fu || '' });
  return [
    mk(2, me, 'call', a, 'Said he will schedule SB 3202 if Finance signals there is room for the tax credit. Asked how many students it would cover.', shift(4)),
    mk(14, t1, 'meeting', c, 'Met with him and his committee clerk. He supports the idea and wants the Department of Health’s view on the cost before the hearing.'),
    mk(16, t2, 'passing', null, 'Saw him at the Pearl City town hall. He asked how the clinics bill is doing.', shift(9)),
    mk(19, me, 'email', c, 'Sent the one-page summary he asked for. His office confirmed they have it.'),
    mk(21, t1, 'call', null, 'Introduced herself as the new contact for rural clinics.'),
  ];
}
export const N = { pins: {} };   // the pinned lines per legislator id: [{ id, text, who (advocate id), day }]
export function pinsOf(l) {
  if (!N.pins[l.id]) N.pins[l.id] = DEMO && l.id === SAMPLE_ID ? [
    { id: 'p1', text: 'Prefers a call to his office over email. Mornings before the floor session are best.', who: S.me?.id, day: shift(-11) },
    { id: 'p2', text: 'Asks for numbers from his own district before he takes a side.', who: mates()[0]?.id, day: shift(-7) }] : [];
  return N.pins[l.id];
}
// ===== end of the practice sample =====

const KINDS = { call: ['Call', 'phone'], meeting: ['Meeting', 'users'], email: ['Email', 'mail'], passing: ['In passing', 'footprints'] };
const talksOf = l => [...D.notesOf(l).filter(n => !m.isAskNote(n)).map(n => ({ id: n.id, who: n.advocate_id, kind: extras() ? n.kind || '' : '', bill: S.bills.find(b => b.id === n.bill_id) || null, body: n.body, day: dayOf(n), at: new Date(n.created_at).getTime(), fu: extras() && n.follow_up_on ? String(n.follow_up_on).slice(0, 10) : '' })), ...sampleTalks(l)];
// a follow-up clears by itself when its writer has logged a later talk with this legislator (S-10: no tick box)
const followUps = (l, talks) => talks.filter(t => t.fu && !talks.some(u => u.who === t.who && (u.day > t.day || (u.day === t.day && u.at > t.at))))
  .sort((a, b) => (mineId(b.who) - mineId(a.who)) || a.fu.localeCompare(b.fu));

const bLink = b => { const t = D.billLabel(b); return `<a class="lk" href="${esc(t.href)}">${esc(t.no)}</a>`; };
const Q = (t, act, extra = '') => `<button class="ln-q" type="button" data-act="${act}"${extra}>${t}</button>`;
export const contactOf = (l, X) => X.contact[l.id] ?? D.contactName(l, S.me);

// ------------------------------------------------------------------ the card
const DOT = '<span class="ln-dot" aria-hidden="true">·</span>';
const dots = parts => parts.map(x => `<span class="ln-it">${x}</span>`).join(DOT);
// at laptop width the action ends the value (end = true); on a phone CSS moves it to the right end of the label row
const R = (k, v, a, end) => `<div class="ln-row${end ? ' ln-end' : ''}"><div class="ln-lc"><p class="ln-k">${k}</p>${end ? '' : a || ''}</div><div class="ln-v">${v}${end ? ` <span class="ln-tail">${DOT} ${a}</span>` : ''}</div></div>`;
function contactForm(l, c) {
  return `<form class="lpin" data-form="contact"><label class="vh" for="lpCt">Our contact person</label><select id="lpCt"><option value="">No one yet</option>${(S.advocates || []).filter(a => a.is_active !== false).map(a => `<option value="${esc(a.full_name)}"${a.full_name === c ? ' selected' : ''}>${esc(a.full_name)}</option>`).join('')}</select> <button class="btn quiet" type="submit">Save</button> <button class="btn text" type="button" data-act="form-x">Cancel</button></form>`;
}
function lineForm() {
  return `<form class="lpin ln-line" data-form="line"><label for="lpLine"><b>Add a line</b></label><textarea id="lpLine" rows="2" maxlength="200" aria-describedby="lpLineH"></textarea><p class="hint" id="lpLineH">Others on staff can read this. Write only what helps the next talk.</p><div class="lpbtns"><button class="btn quiet" type="submit">Save</button><button class="btn text" type="button" data-act="form-x">Cancel</button></div></form>`;
}
function caresForm(cares) {
  return `<form class="lpin" data-form="cares"><label for="lpCareT"><b>Topics</b> <span class="lpmut">separate with commas</span></label><input id="lpCareT" type="text" value="${esc(cares.tags.join(', '))}"><label for="lpCareN"><b>In their words</b></label><textarea id="lpCareN" rows="3">${esc(cares.text)}</textarea><div class="lpbtns"><button class="btn filled" type="submit">Save</button><button class="btn text" type="button" data-act="form-x">Cancel</button></div></form>`;
}
function standRow(l) {
  const known = D.ourBills(l, S.me).all.filter(b => D.stanceValue(l, b) !== 'unknown');
  const set = Q('Set on a bill', 'goto', ' data-to="lpBillsH"');
  if (!known.length) return R('Where they stand', `<div class="ln-pl ln-sm14 ln-dots">${dots(['Not known on any bill yet', set])}</div>`);
  const part = known.slice(0, 4).map(b => `<b>${esc(D.stanceOf(l, b))}</b> on ${bLink(b)}`);
  if (known.length > 4) part.push(`and ${known.length - 4} more`);
  return R('Where they stand', `<div class="ln-pl ln-sm14 ln-dots">${dots([...part, set])}</div>`);
}

function cardHTML(l, U, X, talks, nLog) {
  const stand = standRow(l);
  if (!extras()) return `<div class="ln-pin">${stand}</div>`;
  const fus = followUps(l, talks), pins = pinsOf(l), cares = X.cares[l.id] || { tags: [], text: '' }, c = contactOf(l, X), f = U.form;
  const hasCares = cares.tags.length || cares.text;
  if (!fus.length && !pins.length && !hasCares && !c && !nLog && f !== 'contact' && f !== 'cares' && f !== 'line') {
    return `<div class="ln-pin"><div class="ln-row ln-one"><div class="ln-v"><p class="ln-pl">Nothing is on file for ${esc(D.surnameOf(l))} yet.</p><div class="ln-sm14 ln-dots">${dots([Q('Choose a contact', 'form-contact'), Q('Add what they care about', 'form-cares'), Q('Add a line', 'add-line')])}</div></div></div>${stand}</div>`;
  }
  const rows = [];
  if (fus.length) {
    const t0 = today();
    rows.push(R('Follow up', fus.map(t => {
      const when = t.fu < t0 ? `was due ${dateWords(t.fu)}` : `by ${dateWords(t.fu)}`, mine = mineId(t.who);
      return `<p class="ln-pl"><span class="ln-who">${esc(whoName(t.who))}</span> · Follow up${t.bill ? ' on ' + bLink(t.bill) : ''} ${when.replace(/(\w{3}, \w{3} \d+)/, '<span style="white-space:nowrap">$1</span>')}${mine ? `<span class="ln-dot" aria-hidden="true"> · </span>${Q('Log a talk', 'log-talk', ' style="font-size:var(--f16)"').replace('class="ln-q', 'class="ln-q ln-act ln-lt')}` : ''}</p>`;
    }).join('')));
  }
  const adding = f === 'line', lines = pins.length ? `<ul>${pins.map(p => `<li>${esc(D.eCig(p.text))} <span class="ln-sm14 ln-meta"><b>${esc(whoName(p.who))}</b> · ${esc(longDay(p.day))} · ${Q('Remove', 'pin-remove', ` data-id="${esc(p.id)}"`)}</span></li>`).join('')}</ul>` : `<p class="ln-sm14">Nothing pinned yet.</p>`;
  rows.push(R('Good to know', adding ? lines + lineForm() : lines, adding ? '' : Q('Add a line', 'add-line')));
  rows.push(R('Cares about', f === 'cares' ? caresForm(cares) : hasCares ? `${cares.tags.length ? `<ul class="ln-tags">${cares.tags.map(t => `<li>${esc(D.eCig(t))}</li>`).join('')}</ul>` : ''}${cares.text ? `<p class="ln-words">${esc(D.eCig(cares.text))}</p>` : ''}` : `<p class="ln-sm14">Nothing written yet.</p>`, f === 'cares' ? '' : Q('Edit', 'form-cares'), f !== 'cares'));
  const words = !c ? 'No one keeps in touch yet' : c === S.me?.full_name || c === firstName(S.me?.full_name) ? 'You keep in touch' : `${esc(firstName(c))} keeps in touch`;
  rows.push(R('Our contact', f === 'contact' ? contactForm(l, c) : `<p class="ln-pl">${words}</p>`, f === 'contact' ? '' : Q(c ? 'Change' : 'Choose', 'form-contact'), f !== 'contact'));
  rows.push(stand);
  return `<div class="ln-pin">${rows.join('')}</div>`;
}

// ------------------------------------------------------------------ the Log
function logEntries(l, talks) {
  const out = talks.map(t => ({ g: 'talks', day: t.day, at: t.at, t }));
  for (const a of D.asksOf(l)) out.push({ g: 'asks', day: dayOf(a.first), at: new Date(a.first.created_at).getTime(), b: a.b, ans: D.answerWords(a.last.answer) });
  for (const { b, d } of D.testimonyOf(l)) out.push({ g: 'testimony', day: new Date(d.filed_at).toLocaleDateString('en-CA', HST), at: new Date(d.filed_at).getTime(), b, to: D.plain(String(d.committee || '').split(/[\/ ]+/).filter(Boolean).map(D.cname).join(' with ')) });
  return out.sort((a, b) => b.day.localeCompare(a.day) || b.at - a.at);
}
function entryHTML(e) {
  const dcell = `<div class="ln-d"><b>${esc(longDay(e.day))}</b>${esc(ago(e.day))}</div>`;
  if (e.g !== 'talks') {
    const txt = e.g === 'asks' ? `Asked for a hearing · ${bLink(e.b)} · ${esc(e.ans)}` : `Testimony sent · ${bLink(e.b)}${e.to ? ' · to ' + esc(e.to) : ''}`;
    return `<li class="ln-e ln-sm" data-g="${e.g}">${dcell}<div class="ln-r"><span class="ln-disc">${ic(e.g === 'asks' ? 'gavel' : 'scroll-text')}</span></div><div class="ln-c"><p class="ln-sm-t">${txt}</p></div></li>`;
  }
  const t = e.t, [word, icon] = KINDS[t.kind] || ['Note', 'message-square'];
  return `<li class="ln-e" data-g="talks">${dcell}<div class="ln-r"><span class="ln-disc">${ic(icon)}</span></div><div class="ln-c"><p class="ln-hd"><b>${esc(word)}</b> · <b>${esc(whoName(t.who))}</b>${t.bill ? ' · About ' + bLink(t.bill) : ''}</p><p class="ln-bd">${esc(D.eCig(t.body))}</p></div></li>`;
}
const FILTERS = [['all', 'All'], ['talks', 'Talks'], ['asks', 'Asks'], ['testimony', 'Testimony']];
// the closed log: the newest 3; when none of them is a talk someone wrote and there is a talk, the newest 2, a gap line, then the newest talk
export function pickRows(entries, open, lf = 'all') {
  const shown = entries.filter(e => lf === 'all' || e.g === lf);
  if (open) return shown;
  const top = shown.slice(0, 3), ti = shown.findIndex(e => e.g === 'talks');
  if (top.some(e => e.g === 'talks') || ti < 0) return top;
  return [shown[0], shown[1], { gap: ti - 2 }, shown[ti]];
}
function logHTML(l, U, entries) {
  const n = entries.length;
  if (!n) return `<div class="ln-lh"><h3>Log</h3></div><p class="ln-none">Nothing logged yet.</p>`;
  const open = U.all, lf = open ? U.lf || 'all' : 'all', shown = entries.filter(e => lf === 'all' || e.g === lf), list = pickRows(entries, open, lf), cn = k => k === 'all' ? n : entries.filter(e => e.g === k).length;
  const filt = open ? `<div class="ln-f" role="group" aria-label="Show">${FILTERS.map(([k, w]) => `<button type="button" data-lf="${k}" aria-pressed="${lf === k}">${w} <span class="ln-n">${cn(k)}</span></button>`).join('')}</div>` : '';
  return `<div class="ln-lh"><h3>Log <span>· ${n}</span></h3>${filt}</div>`
    + (list.length ? `<ul class="ln-tl">${list.map(e => e.gap ? `<li class="ln-gap">${Q(e.gap + ' more asks and testimony', 'all', ' aria-expanded="false"')}</li>` : entryHTML(e)).join('')}</ul>` : `<p class="ln-none">Nothing of that kind yet.</p>`)
    + (n > 3 ? `<p class="ln-more">${Q(open ? 'Show the last 3' : 'Show all ' + n, 'all', ` aria-expanded="${open}"`)}</p>` : '');
}

export function notesHTML(l, U, X) {
  const talks = talksOf(l), entries = logEntries(l, talks);
  return `<section class="lpsec ln" aria-labelledby="lpNotesH"><h2 class="lph" id="lpNotesH">Notes</h2>${cardHTML(l, U, X, talks, entries.length)}${logHTML(l, U, entries)}</section>`;
}

// a separator dot never ends a line and never starts one: after drawing, hide any dot that is not on the same line as the item after it or that starts a line (phones hide them in CSS)
export function fixDots(root) {
  const ds = [...root.querySelectorAll('.ln-dot')]; ds.forEach(d => { d.style.display = ''; });
  for (const d of ds) {
    const r = d.getBoundingClientRect(), box = d.closest('.ln-v')?.getBoundingClientRect(), nx = d.nextElementSibling?.getBoundingClientRect();
    if (!r.width) continue;
    if ((nx && Math.abs(nx.top - r.top) > 3 && nx.top > r.top) || (box && r.left <= box.left + 2)) d.style.display = 'none';
  }
}
