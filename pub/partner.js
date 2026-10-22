// A partner group's corner on the public tracker (R-328 batch C, with batch F's own issues; Nate's yes 22 Oct 2026, the plan
// page's first two mockups). People from outside advocacy groups, signed in by email link, add bills and write their
// group's words, and HIPHI (Nate or Jess) approves every word before it goes public. The job (B-1): a partner comes here to
// put their group's words on the bills it works on, and to see where each stands with HIPHI. Under You:
//   #/partner             the group: its name and who writes, its bills with a plain status each (Live, Waiting for HIPHI,
//                         HIPHI asked for a change with the note, Draft, Hidden by you, Off when HIPHI took the other side),
//                         Add a bill, its own issues, its teammates (the lead invites and takes off), its link
//   #/partner/add         find a bill by its number or a few words
//   #/partner/bill/<id>   the one-screen editor: the side (set to HIPHI's on HIPHI's bills), a nickname, the summary in
//                         plain words with its reading grade, 3 to 5 talking points, the ask and its end date, draft notes
//                         and issues; Save draft, Send to HIPHI; and the changes that go live at once (hide, remove, end or
//                         move the ask)
//   #/partner/issue/<id>  one of the group's own issues (or "new"): name, what it is about, its side
// A person who has not agreed to the partner terms sees them first, once. A group waiting for approval or paused sees why in
// plain words and cannot write. The data and the practice copy's sample are pub/partners.js (?demo=1&partner=1).
// DESIGN.md: A-3 (one primary per screen: Add a bill on the corner, Send to HIPHI in the editor), A-5 (each status has words
// and an icon, never colour alone), A-6 (44px targets), A-8 (rows in one white box), A-12 (the side HIPHI's bill rules out
// is disabled and says why), A-14, A-16 (every change answers with a toast, the ones that go live at once with Undo, B-5),
// B-3 (every empty or refused state has a way on), B-4 (each page's back link names the page behind; typed words survive
// leaving and coming back), B-8 (the database's refusals shown as they come, next to the thing), B-12 (draft notes and
// issues folded), C-9 (an error keeps every value and focuses the field), C-10 (the reading grade as they type, grade 8;
// "e-cigarettes" and the ʻokina hinted).
import { S, app, esc, icon, toast, spaced, nick, blurb, titleCase, posInfo, billPath } from './core.js';
import { recBack } from './rec/kit.js';
import * as P from './partners.js';

const EMAIL = 'contact@hiphi.org';
const HST = 'Pacific/Honolulu';
const ST = { data: null, err: '', loading: null, lastHash: '', slug: '', q: '', res: null, qbusy: false, qerr: '', qseq: 0, invited: null, inv: { name: '', email: '', err: {} }, move: '' };
const here = () => document.body.dataset.screen === 'partner';
const $ = s => document.querySelector(s);

// ---------------- loading ----------------
// my_partner once per page load (and again after every change), then the tracker's rows for the group's bills.
function load(fresh = false) {
  if (ST.loading && !fresh) return ST.loading;
  ST.loading = P.myPartner({ fresh }).then(async d => {
    ST.data = d; ST.err = '';
    if (fresh) for (const k of Object.keys(FORMS)) if (!FORMS[k].dirty) delete FORMS[k];   // untouched forms start again from what the database has now
    try { await P.billsInfo(d.groups.flatMap(g => g.bills.map(b => b.bill_id))); } catch (e) { console.error(e); }
  }).catch(e => { console.error(e); ST.err = P.plainErr(e); }).finally(() => { ST.loading = null; if (here()) app.render(); });
  return ST.loading;
}
const groupOf = route => { const gs = ST.data.groups; const g = gs.find(x => x.slug === route.g) || gs.find(x => x.slug === ST.slug) || gs[0]; ST.slug = g.slug; return g; };
const many = () => (ST.data?.groups || []).length > 1;
const href = (path, g) => many() ? `${path}?g=${encodeURIComponent(g.slug)}` : path;
const canWrite = g => g.status === 'active' && !!g.me?.terms_at;

// ---------------- words ----------------
const dayOf = d => new Date(d).toLocaleDateString('en-CA', { timeZone: HST });
const asD = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d)) ? new Date(d + 'T12:00:00-10:00') : new Date(d);
const timeOf = d => asD(d).toLocaleTimeString('en-US', { timeZone: HST, hour: 'numeric', minute: '2-digit' });
const dateOf = d => asD(d).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short', month: 'numeric', day: 'numeric' }).replace(',', '');
// C-15's moments: "today 9:30 AM", "yesterday 3:12 PM", "Tue 3/10, 9:30 AM"; a day alone is "today" or "Tue 3/10".
function when(d, { time = true } = {}) {
  if (!d) return '';
  const dd = /^\d{4}-\d{2}-\d{2}$/.test(String(d)) ? String(d) : dayOf(d), now = P.today();
  if (dd === now) return time ? `today ${timeOf(d)}` : 'today';
  if (dd === P.plusDays(now, -1)) return time ? `yesterday ${timeOf(d)}` : 'yesterday';
  if (dd === P.plusDays(now, 1)) return 'tomorrow';
  return time ? `${dateOf(d)}, ${timeOf(d)}` : dateOf(d);
}
const keepLine = s => String(s).replace(/(\d) ([AP]M)\b/g, '$1\u00a0$2').replace(/\b([A-Z][a-z]{2}) (\d{1,2}\/)/g, '$1\u00a0$2').replace(/\b(today|yesterday) (\d)/g, '$1\u00a0$2');
// A bill's name here: the group's own nickname, else HIPHI's, else the plain summary, else the Legislature's title.
// (A resolution's title can run to 300 characters: cut at a word near 90.)
const cut = (s, n = 90) => s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, '') + '…';
const billName = (info, w) => (w?.nickname) || (info && (nick(info) || (info.hiphi_summary ? blurb(info, 90) : cut(titleCase(String(info.title || '').replace(/\.$/, '')))))) || '';
const hiphiWords = b => { const p = posInfo(b); if (p) return p.text; return b?.hiphi_position === 'monitor' ? 'HIPHI watches it, with no side' : 'HIPHI has no position on it'; };
const initialsOf = n => { const w = String(n || '').normalize('NFC').replace(/[ʻʼ‘’'`.-]/g, '').trim().split(/\s+/).filter(Boolean); return w.length ? (w[0][0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase() : ''; };

// The reading grade (C-10), by the same arithmetic as tests/checks.py fk_grade and tests/words_test.mjs: sentences of three
// words or more, a word is anything with a letter, syllables counted by vowel groups. Nothing until there is a sentence.
const syllables = word => { let w = word.toLowerCase().replace(/[^a-z]/g, ''); if (!w) return 0; if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, ''); return Math.max(1, (w.match(/[aeiouy]{1,2}/g) || []).length); };
function fkGrade(text) {
  const sents = String(text || '').split(/[.!?]+\s|\n+/).filter(s => s.split(/\s+/).filter(Boolean).length >= 3);
  const words = sents.flatMap(s => s.split(/\s+/).filter(Boolean)).filter(w => /[A-Za-z]/.test(w));
  if (!sents.length || !words.length) return null;
  const syl = words.reduce((n, w) => n + syllables(w), 0);
  return Math.max(1, Math.round(0.39 * (words.length / sents.length) + 11.8 * (syl / words.length) - 15.59));
}
const gradeWords = text => { const g = fkGrade(text); if (g === null) return '';
  return g <= 8 ? `Reads at grade ${g}. Grade 8 or below is easy for most people.` : `Reads at grade ${g}. Shorter sentences and shorter words bring it to grade 8.`; };

// House words, as they type (C-10, R-158): "e-cigarettes" for the other word, and the ʻokina in Hawaiʻi's place names. Each
// hint has one button that fixes the field (the database adds the ʻokina to the commonest names itself, migration 139).
// The patterns are regular expressions on purpose: the words test reads quoted text, and these name the words to avoid.
const ECIG = /\bvap(?:e|es|ed|er|ers|ing)\b/gi;
const OKINA = [[/\bHawai(?:i|['‘’`]i)\b/g, 'Hawaiʻi'], [/\bOahu\b/g, 'Oʻahu'], [/\bKauai\b/g, 'Kauaʻi'], [/\bMolokai\b/g, 'Molokaʻi'], [/\bLanai\b/g, 'Lānaʻi'], [/\bWaianae\b/g, 'Waiʻanae']];
// The word as a thing ("a ban on ..."), or as something people do ("kids who ...", "teens ..."), which becomes "use e-cigarettes".
const DOING = /\b(who|to|they|we|you|i|kids|teens|youth|people|students|keiki|don't|not|never|still|and)\s+$/i;
const ecigFix = (w, at, all) => /ing$/i.test(w) ? 'e-cigarette use' : /ers?$/i.test(w) ? 'people who use e-cigarettes' : /ed$/i.test(w) ? 'used e-cigarettes'
  : DOING.test(all.slice(Math.max(0, at - 12), at)) ? (/s$/i.test(w) ? 'uses e-cigarettes' : 'use e-cigarettes') : /s$/i.test(w) ? 'e-cigarettes' : 'e-cigarette';
const fixText = (s, kind) => kind === 'ecig' ? String(s).replace(ECIG, ecigFix) : OKINA.reduce((t, [re, to]) => t.replace(re, to), String(s));
function hintsHTML(field, text) {
  const out = [];
  if (new RegExp(ECIG.source, 'i').test(text)) out.push(['ecig', 'HIPHI says “e-cigarettes”.', 'Change it']);
  if (OKINA.some(([re]) => new RegExp(re.source).test(text))) out.push(['okina', 'Hawaiʻi’s place names take the ʻokina (ʻ).', 'Add it']);
  return out.map(([k, m, b]) => `<span class="pt-hint">${icon('lightbulb')}<span>${esc(m)}</span><button type="button" class="btn text sm" data-fix="${esc(field)}" data-kind="${k}">${esc(b)}</button></span>`).join('');
}

// ---------------- statuses ----------------
// One plain status per bill and per issue, in this order: what the public sees comes first.
const chip = (tone, ic, text) => `<span class="chip pt-chip${tone ? ' ' + tone : ''}">${icon(ic)}<span>${esc(text)}</span></span>`;
// While a group is paused (or not approved yet) nothing of it is public, so no row says Live (A-14: the page agrees with itself).
// The notice at the top says why; the row says only what it had (A-14).
const groupOff = (g, L) => g && g.status !== 'active' ? { chip: chip('off', 'circle-minus', g.status === 'paused' ? 'Off while your group is paused' : 'Not public yet'),
  line: L?.reviewed_at ? `Approved ${when(L.reviewed_at, { time: false })}.` : '' } : null;
function billStatus(pb, g) {
  const L = pb.live, O = pb.open;
  if (L && groupOff(g)) return groupOff(g, L);
  if (pb.side_clash) return { chip: chip('off', 'circle-minus', 'Off: HIPHI took the other side'), line: `HIPHI now ${pb.hiphi_side === 'oppose' ? 'opposes' : 'supports'} this bill, so your words are off the tracker. They come back if the sides match again.` };
  if (pb.hidden && L) return { chip: chip('', 'eye-off', 'Hidden by you'), line: 'Your words are off the tracker until you show them again.' };
  if (O?.state === 'changes') return { chip: chip('ask', 'message-square', 'HIPHI asked for a change'), line: `“${O.review_note || ''}”${L ? ' Your live words stay up meanwhile.' : ''}`, note: O.review_note };
  if (L) { const edit = O?.state === 'sent' ? ` Your edit from ${when(O.sent_at, { time: false })} waits for HIPHI.` : O?.state === 'draft' ? ' You have an edit you haven’t sent.' : '';
    return { chip: chip('live', 'circle-check', 'Live'), line: `Approved ${when(L.reviewed_at, { time: false })}.${edit}` }; }
  if (O?.state === 'sent') return { chip: chip('', 'clock', 'Waiting for HIPHI'), line: `Sent ${when(O.sent_at)}` };
  return { chip: chip('', 'pencil', 'Draft'), line: O ? `Saved ${when(O.written_at)}. Not sent to HIPHI yet.` : 'Not written yet.' };
}
function issueStatus(pi, g) {
  const L = pi.live, O = pi.open;
  if (L && groupOff(g)) return groupOff(g, L);
  if (pi.hidden && L) return { chip: chip('', 'eye-off', 'Hidden by you'), line: 'Off the tracker until you show it again.' };
  if (O?.state === 'changes') return { chip: chip('ask', 'message-square', 'HIPHI asked for a change'), line: `“${O.review_note || ''}”`, note: O.review_note };
  if (L) return { chip: chip('live', 'circle-check', 'Live'), line: `Approved ${when(L.reviewed_at, { time: false })}.${O?.state === 'sent' ? ` Your edit from ${when(O.sent_at, { time: false })} waits for HIPHI.` : ''}` };
  if (O?.state === 'sent') return { chip: chip('', 'clock', 'Waiting for HIPHI'), line: `Sent ${when(O.sent_at)}` };
  return { chip: chip('', 'pencil', 'Draft'), line: O ? `Saved ${when(O.written_at)}. Not sent to HIPHI yet.` : '' };
}

// ---------------- pieces ----------------
const back = (g, label) => recBack(href('#/partner', g), label || g.name);
const head = ({ eye = '', title, lede = '', extra = '' }) => `<header class="rc-head">${eye ? `<p class="rc-eye">${esc(eye)}</p>` : ''}<h1 class="rc-h1">${esc(title)}</h1>${lede ? `<p class="rc-lede">${lede}</p>` : ''}${extra ? `<div class="rc-hrow">${extra}</div>` : ''}</header>`;
const sec = (id, title, inner, note = '') => `<section class="rc-sec pt-sec" aria-labelledby="${id}"><h2 class="rc-h2" id="${id}">${esc(title)}</h2>${note ? `<p class="rc-note">${esc(note)}</p>` : ''}${inner}</section>`;
const notice = (tone, ic, html) => `<div class="notice ${tone} pt-notice">${icon(ic)}<div>${html}</div></div>`;
function statusNotice(g) {
  if (g.status === 'waiting') return notice('info', 'hourglass', `<p>${esc(P.teamLine(g))}</p>`);
  if (g.status === 'paused') return notice('info', 'circle-minus', `<p>${esc(P.teamLine(g))} You can’t write until HIPHI turns your group back on. Questions? <a href="mailto:${EMAIL}">${EMAIL}</a></p>`);
  return '';
}
const errLine = (id, msg) => msg ? `<span class="err" id="${id}">${icon('triangle-alert')}<span>${esc(msg)}</span></span>` : '';
const formErr = (id, msg) => `<div id="${id}" role="alert" class="pt-ferr">${msg ? notice('bad', 'circle-alert', `<p>${esc(msg)}</p>`) : ''}</div>`;
const plainView = (title, lede, action = '', g = null) => `<div class="rc pt pt-plain">${g ? back(g) : recBack('#/more', 'You')}${head({ title, lede: esc(lede) })}${action}</div>`;

// ---------------- the screens: signed out, no group, the terms ----------------
function signedOut() {
  return plainView('Your group', 'Partner groups write here about the bills they work on, and HIPHI looks over every word before it goes public. Sign in with the email HIPHI has for you.',
    `<p class="pt-act"><a class="btn primary" href="#/signin">${icon('log-in')}<span>Sign in with your email</span></a></p>`);
}
function noGroup() {
  return plainView('Your group', 'This sign-in is not on a partner group. If your group works with HIPHI, ask HIPHI to add the email you signed in with.',
    `<p class="pt-act"><a class="btn secondary" href="mailto:${EMAIL}">${icon('mail')}<span>Email ${EMAIL}</span></a></p>`);
}
// The partner terms (Nate 10/22). DRAFT WORDING: a lawyer should confirm these before the first partner publishes (backend
// R-149's lawyer list; migration 184's legal line). Kept short and plain on purpose; change them only with Nate.
const TERMS = g => [
  ['users-round', `You write as ${g.name}. Your group’s name shows with your words.`],
  ['shield-check', 'HIPHI looks over every word before it goes public.'],
  ['landmark', 'HIPHI’s own positions stay HIPHI’s. Your words never change them.'],
  ['circle-minus', 'No candidates, campaigns or parties.'],
  ['pencil', 'Your words are yours. You can change them or take them down any time.'],
];
function termsView(g) {
  return `<div class="rc pt pt-terms">${recBack('#/more', 'You')}
    ${head({ eye: g.name, title: 'Before you write', lede: 'Read this once. It takes a minute.' })}
    ${statusNotice(g)}
    <div class="rc-card"><ul class="pt-terms-list" role="list">${TERMS(g).map(([ic, s]) => `<li>${icon(ic)}<span>${esc(s)}</span></li>`).join('')}</ul></div>
    ${formErr('pt-terms-err', ST.termsErr)}
    <p class="pt-act"><button type="button" class="btn primary" data-pt-agree>${icon('check')}<span>I agree</span></button></p>
    <p class="small pt-q">Questions? Email <a href="mailto:${EMAIL}">${EMAIL}</a>.</p>
  </div>`;
}

// ---------------- the corner ----------------
function billRow(g, pb) {
  const info = P.billInfoNow(pb.bill_id), w = pb.open || pb.live, s = billStatus(pb, g);
  return `<li><a class="rc-row pt-row" href="${esc(href('#/partner/bill/' + pb.bill_id, g))}">
    <span class="rc-rtext"><span class="pt-num">${esc(spaced(pb.bill_number))}</span><span class="rc-rname">${esc(billName(info, w) || spaced(pb.bill_number))}</span>
      <span class="pt-st">${s.chip}${s.line ? `<span class="rc-rstat">${esc(keepLine(s.line))}</span>` : ''}</span></span>${icon('chevron-right', { cls: 'rc-chev' })}</a></li>`;
}
function issueRow(g, pi) {
  const w = pi.open || pi.live, s = issueStatus(pi, g);
  return `<li><a class="rc-row pt-row" href="${esc(href('#/partner/issue/' + pi.id, g))}">
    <span class="rc-rtext"><span class="rc-rname">${esc(w?.name || pi.slug)}</span><span class="pt-st">${s.chip}${s.line ? `<span class="rc-rstat">${esc(keepLine(s.line))}</span>` : ''}</span></span>${icon('chevron-right', { cls: 'rc-chev' })}</a></li>`;
}
// What waits on the partner first (A-13): HIPHI's asks for a change, words off for a clash, unsent drafts; then what waits
// on HIPHI, then what is live, then what they hid. Within each, the database's order (bill number).
const needRank = x => x.open?.state === 'changes' ? 0 : x.side_clash ? 1 : x.open?.state === 'draft' || (!x.open && !x.live) ? 2 : x.open?.state === 'sent' && !x.live ? 3 : x.hidden ? 5 : 4;
const byNeed = list => list.map((x, i) => [x, i]).sort((a, b) => needRank(a[0]) - needRank(b[0]) || a[1] - b[1]).map(([x]) => x);
function cornerView(g) {
  const write = canWrite(g), bills = byNeed(g.bills.filter(b => !b.removed)), gone = g.bills.filter(b => b.removed);
  const issues = byNeed(g.issues.filter(i => !i.removed)), goneIssues = g.issues.filter(i => i.removed);
  const others = many() ? `<p class="pt-also">Also yours: ${ST.data.groups.filter(x => x.slug !== g.slug).map(x => `<a href="#/partner?g=${encodeURIComponent(x.slug)}">${esc(x.name)}</a>`).join(', ')}</p>` : '';
  const putBack = (list, kind, word) => list.length ? `<div class="pt-gone"><p class="small">${esc(word)}</p><ul class="pt-gonelist" role="list">${list.map(x => {
    const name = kind === 'bill' ? `${spaced(x.bill_number)} · ${billName(P.billInfoNow(x.bill_id), x.open || x.live)}` : (x.open || x.live)?.name || x.slug;
    return `<li><span>${esc(name)}</span>${write ? `<button type="button" class="btn text sm" data-pt-restore="${kind}:${esc(kind === 'bill' ? x.bill_id : x.id)}">${icon('undo-2')}<span>Put it back</span></button>` : ''}</li>`; }).join('')}</ul></div>` : '';
  const billsSec = sec('pt-bills-h', 'Your bills', `${bills.length ? `<ul class="rc-rows rc-box" role="list">${bills.map(b => billRow(g, b)).join('')}</ul>`
      : `<p class="pt-empty">No bills yet. Add one your group works on, then write your group’s words for it.</p>`}
    ${write ? `<p class="pt-act"><a class="btn primary" href="${esc(href('#/partner/add', g))}">${icon('plus')}<span>Add a bill</span></a></p>` : ''}
    ${putBack(gone, 'bill', 'Taken off your list:')}`);
  const issuesSec = sec('pt-issues-h', 'Your group’s issues', `${issues.length ? `<ul class="rc-rows rc-box" role="list">${issues.map(i => issueRow(g, i)).join('')}</ul>`
      : `<p class="pt-empty">An issue gathers bills under one name your group cares about. HIPHI looks it over before it goes public.</p>`}
    ${write ? `<p class="pt-act"><a class="btn secondary" href="${esc(href('#/partner/issue/new', g))}">${icon('plus')}<span>Add an issue</span></a></p>` : ''}
    ${putBack(goneIssues, 'issue', 'Taken off:')}`);
  return `<div class="rc pt pt-corner">${recBack('#/more', 'You')}
    ${head({ eye: 'Your group', title: g.name, lede: g.status === 'active' ? esc(P.teamLine(g)) : '' })}
    ${statusNotice(g)}${others}
    <div class="pt-cols"><div class="pt-main">${billsSec}${issuesSec}</div>
      <div class="pt-side">${teamSec(g)}${linkSec(g)}</div></div>
  </div>`;
}
function teamSec(g) {
  const lead = g.me.role === 'lead', write = canWrite(g), people = g.people || [];
  const rows = people.map(p => { const me = p.id === g.me.id;
    const sub = [p.role === 'lead' ? 'Lead' : '', p.email || '', p.joined ? '' : 'Not signed in yet'].filter(Boolean).join(' · ');
    return `<li><div class="rc-row pt-prow"><span class="rc-lead pt-av" aria-hidden="true">${esc(initialsOf(p.name || p.email) || '?')}</span>
      <span class="rc-rtext"><span class="rc-rname">${esc(p.name || p.email || 'Teammate')}${me ? ' <span class="pt-me">(you)</span>' : ''}</span>${sub ? `<span class="rc-rstat">${esc(sub)}</span>` : ''}</span>
      ${lead && write && !me && p.role !== 'lead' ? `<button type="button" class="btn text sm pt-off" data-pt-off="${esc(p.id)}" aria-label="Take ${esc(p.name || p.email)} out of your group">${icon('x')}<span>Take off</span></button>` : ''}</div></li>`; }).join('');
  const leadName = people.find(p => p.role === 'lead')?.name;
  const inv = ST.inv, done = ST.invited;
  // One button until it is wanted (B-12): inviting is rare, so two empty boxes do not sit on every visit.
  const doneNote = done ? notice('ok', 'circle-check', `<p>${esc(done.name || done.email)} is in your group now. Ask them to sign in on the tracker with ${esc(done.email)}: they’ll find your group under You.</p>
        <p><button type="button" class="btn text sm" data-pt-copy="${esc(P.SITE + '#/signin')}">${icon('copy')}<span>Copy the sign-in link</span></button></p>`) : '';
  const form = lead && write ? !ST.invOpen ? `<div class="pt-invite">${doneNote}<p class="pt-act"><button type="button" class="btn secondary" data-pt-invopen aria-expanded="false">${icon('user-plus')}<span>Invite a teammate</span></button></p></div>`
    : `<form class="pt-invite rc-card" data-pt-invite novalidate>
      <h3 class="pt-h3">Invite a teammate</h3>
      <div class="field"><label for="pt-inv-name">Name</label><input id="pt-inv-name" data-inv="name" autocomplete="off" maxlength="80" value="${esc(inv.name)}"${inv.err.name ? ' aria-invalid="true" aria-describedby="pt-inv-name-err"' : ''}>${errLine('pt-inv-name-err', inv.err.name)}</div>
      <div class="field"><label for="pt-inv-email">Email</label><input id="pt-inv-email" data-inv="email" type="email" inputmode="email" autocomplete="off" maxlength="200" value="${esc(inv.email)}"${inv.err.email ? ' aria-invalid="true" aria-describedby="pt-inv-email-err"' : ' aria-describedby="pt-inv-help"'}>
        <span class="help" id="pt-inv-help">They sign in with this email. No email is sent from here.</span>${errLine('pt-inv-email-err', inv.err.email)}</div>
      ${formErr('pt-inv-err', inv.err.form)}
      <p class="pt-act"><button type="submit" class="btn secondary">${icon('user-plus')}<span>Add them to your group</span></button>
        <button type="button" class="btn text" data-pt-invclose>Cancel</button></p>
    </form>` : !lead ? `<p class="rc-note pt-leadnote">${esc(leadName ? `${leadName}, your group’s lead, invites teammates.` : 'Your group’s lead invites teammates.')}</p>` : '';
  return sec('pt-team-h', 'Teammates', `<ul class="rc-rows rc-box" role="list">${rows}</ul>${form}`);
}
function linkSec(g) {
  const url = P.groupLink(g.slug), n = typeof g.visits === 'number' ? g.visits : null;   // a number only from 10 (rule 3)
  const shown = esc(url).replace(/\//g, '/<wbr>').replace(/\?/, '<wbr>?');   // where a phone may break it: after a slash, before the ?
  return sec('pt-link-h', 'Your group’s link', `<div class="pt-linkbox"><span class="pt-url" id="pt-url">${shown}</span>
      <button type="button" class="btn secondary sm" data-pt-copy="${esc(url)}" aria-describedby="pt-url">${icon('copy')}<span>Copy</span></button></div>
    <p class="rc-note pt-linknote">Opens the tracker with your bills first.${n ? ` ${n.toLocaleString('en-US')} visits came this way so far.` : ''}</p>`);
}

// ---------------- Add a bill ----------------
function addView(g) {
  if (!canWrite(g)) return plainView('Add a bill', P.teamLine(g), '', g);
  return `<div class="rc pt pt-add">${back(g)}
    ${head({ title: 'Add a bill', lede: 'Find it by its number or a few words. Then write your group’s words for it.' })}
    <form class="pt-search" role="search" data-pt-search><div class="field"><label for="pt-q">Bill number or words</label>
      <div class="searchbox">${icon('search')}<input id="pt-q" type="search" autocomplete="off" enterkeyhint="search" placeholder="Like HB 1671 or school meals" value="${esc(ST.q)}" aria-describedby="pt-res-n"></div></div></form>
    <div id="pt-res" class="pt-res">${resultsHTML(g)}</div>
  </div>`;
}
function resultsHTML(g) {
  if (!ST.q.trim()) return '<p class="sr" id="pt-res-n" aria-live="polite"></p>';
  if (ST.qbusy && !ST.res) return `<p class="pt-empty" id="pt-res-n" aria-live="polite">${icon('loader-circle', { cls: 'pt-spin' })} Looking for bills…</p>`;
  if (ST.qerr) return `<div id="pt-res-n" aria-live="polite">${notice('bad', 'circle-alert', `<p>${esc(ST.qerr)}</p>`)}</div>`;
  const res = ST.res || [];
  if (!res.length) return `<p class="pt-empty" id="pt-res-n" aria-live="polite">No bill matches “${esc(ST.q)}”. Try its number, like HB 1671, or one word.</p>`;
  const mine = new Set(g.bills.filter(b => !b.removed).map(b => b.bill_id)), yr = Math.max(...res.map(b => +b.session_year || 0));
  return `<p class="sr" id="pt-res-n" aria-live="polite">${res.length} ${res.length === 1 ? 'bill' : 'bills'} found</p><ul class="rc-rows rc-box" role="list">${res.map(b => `<li><a class="rc-row pt-row" href="${esc(href('#/partner/bill/' + b.id, g))}">
    <span class="rc-rtext"><span class="pt-num">${esc(spaced(b.bill_number))}${b.session_year && +b.session_year !== yr ? ` · ${b.session_year}` : ''}</span><span class="rc-rname">${esc(billName(b))}</span>
      <span class="rc-rstat">${esc(hiphiWords(b))}${mine.has(b.id) ? ' · On your list' : ''}</span></span>${icon('chevron-right', { cls: 'rc-chev' })}</a></li>`).join('')}</ul>`;
}
let qTimer = 0;
function runSearch(g, v) {
  ST.q = v; clearTimeout(qTimer);
  const paint = () => { const box = $('#pt-res'); if (box) { box.innerHTML = resultsHTML(g); wireLinks(box); } };
  if (!v.trim()) { ST.res = null; ST.qbusy = false; ST.qerr = ''; paint(); return; }
  qTimer = setTimeout(() => {
    const my = ++ST.qseq; ST.qbusy = true; ST.qerr = ''; paint();
    P.findBills(v).then(r => { if (my !== ST.qseq) return; ST.res = r; }).catch(e => { if (my !== ST.qseq) return; console.error(e); ST.qerr = 'Search didn’t work just now. Check your connection and try again.'; })
      .finally(() => { if (my !== ST.qseq) return; ST.qbusy = false; paint(); });
  }, 250);
}
// Rows drawn into a region after the page's wiring: their in-app links go through the router like every other (app.go).
function wireLinks(root) {
  root.querySelectorAll('a[href^="#/"]').forEach(a => a.addEventListener('click', e => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); app.go(a.getAttribute('href')); }));
}

// ---------------- the forms' memory ----------------
// What is typed survives leaving the page and coming back (B-4, B-6), for this tab: kept until it is saved.
const FKEY = 'hiphi_partner_forms';
const FORMS = (() => { try { const all = JSON.parse(sessionStorage.getItem(FKEY) || '{}') || {}; return Object.fromEntries(Object.entries(all).filter(([, f]) => f && f.dirty).map(([k, f]) => [k, { ...f, errs: {}, formErr: '' }])); } catch { return {}; } })();
let fTimer = 0;
const keepForms = () => { clearTimeout(fTimer); fTimer = setTimeout(() => { try { sessionStorage.setItem(FKEY, JSON.stringify(FORMS, (k, v) => k === 'errs' || k === 'formErr' ? undefined : v)); } catch { /* storage blocked */ } }, 300); };

// ---------------- the editor ----------------
function billForm(g, pb, info, id, fresh) {
  const k = `bill:${g.slug}:${id}`;
  if (FORMS[k] && (FORMS[k].dirty || !fresh)) return FORMS[k];
  const src = pb?.open || pb?.live || null, hs = pb ? pb.hiphi_side : P.sideFamily(info?.hiphi_position);
  const askOver = !!src?.ask_until && src.ask_until < P.today();   // an ask that has ended is not carried into a new edit
  let side = src?.side || '';
  if (hs && P.sideFamily(side) !== hs) side = hs;   // on HIPHI's bills the side is HIPHI's (the database refuses the other)
  return (FORMS[k] = { k, dirty: false, side, fam: P.familyOf(side), nickname: src?.nickname || '', summary: src ? src.summary || '' : info?.hiphi_summary || '',
    fromTracker: !src && !!info?.hiphi_summary, points: src?.points?.length ? [...src.points] : ['', '', ''], ask: askOver ? '' : src?.ask || '', ask_until: askOver ? '' : src?.ask_until || '',
    draft_version: src?.draft_version || '', draft_note: src?.draft_note || '', issue_ids: [...(src?.issue_ids || [])], iq: '', openDraft: false, openIssues: false, errs: {}, formErr: '' });
}
const counter = (name, len, max) => `<span class="pt-count" data-count-for="${name}">${len} of ${max}</span>`;
const invalid = (f, name, help) => f.errs?.[name] ? ` aria-invalid="true" aria-describedby="pt-${name}-err${help ? ' ' + help : ''}"` : help ? ` aria-describedby="${help}"` : '';
function sideNote(hs, info) {
  if (hs) return `HIPHI ${hs === 'support' ? 'supports' : 'opposes'} this bill, so your side is ${hs === 'support' ? 'Support' : 'Oppose'}. On HIPHI’s bills, partners add their voice on the same side.`;
  if (info?.hiphi_position === 'monitor') return 'HIPHI watches this bill but hasn’t taken a side, so the side is yours to pick.';
  if (info?.hiphi_position === 'neutral') return 'HIPHI has comments on this bill but no side, so the side is yours to pick.';
  return 'HIPHI hasn’t taken a position on this bill, so the side is yours to pick.';
}
function sideField(f, hs, info) {
  const fams = ['support', 'oppose', 'neutral'];
  const strengths = f.fam && f.fam !== 'neutral' ? P.STRENGTHS[f.fam] : [];
  return `<fieldset class="pt-f pt-side" aria-describedby="pt-side-note${f.errs.side ? ' pt-side-err' : ''}">
    <legend class="pt-legend">Your side</legend>
    <div class="pt-seg">${fams.map(v => { const off = !!hs && v !== hs, on = f.fam === v;
      return `<label class="pt-opt${on ? ' on' : ''}${off ? ' off' : ''}" for="pt-fam-${v}"><input type="radio" name="pt-fam" id="pt-fam-${v}" value="${v}" data-f="fam"${on ? ' checked' : ''}${off ? ' disabled' : ''}><span>${P.FAMILY_WORDS[v]}</span></label>`; }).join('')}</div>
    <p class="pt-help" id="pt-side-note">${esc(sideNote(hs, info))}</p>
    ${errLine('pt-side-err', f.errs.side)}
    ${strengths.length ? `<fieldset class="pt-f pt-strength"><legend class="pt-legend sm">How strongly</legend><div class="pt-radios">${strengths.map(v =>
      `<label class="check pt-radio" for="pt-side-${v}"><input type="radio" name="pt-side" id="pt-side-${v}" value="${v}" data-f="side"${f.side === v ? ' checked' : ''}><span>${P.SIDE_WORDS[v]}</span></label>`).join('')}</div></fieldset>` : ''}
  </fieldset>`;
}
function textField(f, name, { label, help = '', max, rows = 0, extra = '', attrs = '' }) {
  const v = f[name] || '', helpId = help ? `pt-${name}-help` : '', ctl = rows
    ? `<textarea id="pt-${name}" data-f="${name}" rows="${rows}" maxlength="${max}"${invalid(f, name, [helpId, `pt-${name}-meta`].filter(Boolean).join(' '))}${attrs}>${esc(v)}</textarea>`
    : `<input id="pt-${name}" data-f="${name}" maxlength="${max}" value="${esc(v)}" autocomplete="off"${invalid(f, name, [helpId, `pt-${name}-meta`].filter(Boolean).join(' '))}${attrs}>`;
  return `<div class="field pt-field"><label for="pt-${name}">${esc(label)}</label>${help ? `<span class="help" id="${helpId}">${help}</span>` : ''}${ctl}
    <span class="pt-meta" id="pt-${name}-meta">${extra}${counter(name, v.length, max)}</span>
    <span class="pt-hints" data-hint-for="${name}">${hintsHTML(name, v)}</span>${errLine(`pt-${name}-err`, f.errs[name])}</div>`;
}
function pointsField(f) {
  const filled = f.points.filter(s => s.trim()).length;
  return `<fieldset class="pt-f pt-points" aria-describedby="pt-points-help pt-points-grade">
    <legend class="pt-legend">Talking points <span class="pt-pcount" data-pts-count>· ${filled} of 5</span></legend>
    <span class="help" id="pt-points-help">3 to 5 short reasons to back your side, one sentence each.</span>
    <ol class="pt-plist">${f.points.map((s, i) => `<li class="pt-point"><label class="sr" for="pt-point-${i}">Point ${i + 1}</label>
      <div class="pt-prow2"><span class="pt-pn" aria-hidden="true">${i + 1}</span><textarea id="pt-point-${i}" data-f="point" data-i="${i}" rows="2" maxlength="${P.LIMITS.point}">${esc(s)}</textarea>
      ${f.points.length > 1 ? `<button type="button" class="iconbtn pt-pdel" data-pt-delpoint="${i}" aria-label="Take out point ${i + 1}" title="Take out point ${i + 1}">${icon('x')}</button>` : ''}</div>
      <span class="pt-meta">${counter('point-' + i, s.length, P.LIMITS.point)}</span><span class="pt-hints" data-hint-for="point-${i}">${hintsHTML('point-' + i, s)}</span></li>`).join('')}</ol>
    ${f.points.length < P.LIMITS.points ? `<button type="button" class="btn text sm" data-pt-addpoint>${icon('plus')}<span>Add a point</span></button>` : ''}
    <span class="pt-grade" id="pt-points-grade" data-grade-for="points">${esc(gradeWords(f.points.join('. ')))}</span>
  </fieldset>`;
}
// Issues: the group's own first, then HIPHI's issues this bill is already on, then any of HIPHI's published issues found by
// a word. Up to five (the database's limit).
function issueChoices(g, f, info) {
  const own = g.issues.filter(i => !i.removed).map(i => ({ id: i.id, name: (i.live || i.open)?.name || i.slug, own: true, live: !!i.live }));
  const billIssues = (info?.hiphi_issues || []).map(id => S.issueById?.get(id)).filter(Boolean);
  const picked = f.issue_ids.map(id => own.find(x => x.id === id) || S.issueById?.get(id)).filter(Boolean);
  const seen = new Set(); const list = [...own, ...billIssues.map(i => ({ id: i.id, name: i.name })), ...picked.map(i => ({ id: i.id, name: i.name, own: i.own, live: i.live }))].filter(x => !seen.has(x.id) && seen.add(x.id));
  return { own, list };
}
const issueBox = (f, x) => `<label class="check pt-ibox" for="pt-iss-${esc(x.id)}"><input type="checkbox" id="pt-iss-${esc(x.id)}" value="${esc(x.id)}" data-f="issue"${f.issue_ids.includes(x.id) ? ' checked' : ''}>
  <span><span class="pt-iname">${esc(x.name)}</span>${x.own ? `<span class="pt-ikind">Your group’s issue${x.live ? '' : ', not approved yet'}</span>` : '<span class="pt-ikind">HIPHI’s issue</span>'}</span></label>`;
function issueMatchesHTML(f, shown) {
  const q = f.iq.trim().toLowerCase(); if (q.length < 2) return '';
  const words = q.split(/\s+/), hits = (S.issues || []).filter(i => !shown.has(i.id) && words.every(w => `${i.name} ${i.description || ''}`.toLowerCase().includes(w))).slice(0, 8);
  return hits.length ? hits.map(i => issueBox(f, { id: i.id, name: i.name })).join('') : `<p class="pt-empty small">No issue of HIPHI’s matches “${esc(f.iq)}”.</p>`;
}
const issuesPreview = (f, list) => { const n = f.issue_ids.length; if (!n) return 'Up to 5. None picked yet.';
  const names = f.issue_ids.map(id => list.find(x => x.id === id)?.name || S.issueById?.get(id)?.name).filter(Boolean); return `${n} of 5: ${names.join(', ')}`; };
function issuesFold(g, f, info) {
  const { list } = issueChoices(g, f, info), shown = new Set(list.map(x => x.id));
  return `<details class="pt-fold" data-pt-fold="openIssues"${f.openIssues ? ' open' : ''}><summary><span><span class="pt-ft">Issues</span><span class="pt-fp" data-issues-preview>${esc(issuesPreview(f, list))}</span></span>${icon('chevron-down', { cls: 'pt-fchev' })}</summary>
    <div class="pt-fin"><fieldset class="pt-f"><legend class="pt-legend sm">Put this bill under up to 5 issues</legend>
      <span class="help">Your group’s own, or HIPHI’s published ones.</span>
      <div class="pt-ilist">${list.map(x => issueBox(f, x)).join('')}</div>
      <div class="field pt-iq"><label for="pt-iq">Find another of HIPHI’s issues</label><input id="pt-iq" type="search" data-f="iq" autocomplete="off" value="${esc(f.iq)}"></div>
      <div class="pt-ilist" id="pt-iq-res">${issueMatchesHTML(f, shown)}</div>
      <span class="err" id="pt-issue-max" role="alert" hidden>${icon('triangle-alert')}<span>Up to 5 issues. Untick one first.</span></span>
    </fieldset></div></details>`;
}
function draftFold(f, info) {
  // "Draft" is the person's own unsent words on this screen (Save draft), so the bill's versions are called versions (C-15).
  const prev = [f.draft_version.trim().toUpperCase(), f.draft_note.trim() ? 'with a note' : ''].filter(Boolean).join(', ') || 'Optional: the version your words are about';
  return `<details class="pt-fold" data-pt-fold="openDraft"${f.openDraft || f.errs.draft_version || f.errs.draft_note ? ' open' : ''}><summary><span><span class="pt-ft">Which version of the bill</span><span class="pt-fp">${esc(prev)}</span></span>${icon('chevron-down', { cls: 'pt-fchev' })}</summary>
    <div class="pt-fin">
      <div class="field pt-field"><label for="pt-draft_version">Version</label><span class="help" id="pt-draft_version-help">Bills are rewritten as they move, and each version has a name, like HD1 or SD2.${info?.current_version ? ` This bill is at ${esc(info.current_version)} now.` : ''}</span>
        <input id="pt-draft_version" data-f="draft_version" maxlength="8" autocapitalize="characters" autocomplete="off" class="pt-short" value="${esc(f.draft_version)}"${invalid(f, 'draft_version', 'pt-draft_version-help')}>${errLine('pt-draft_version-err', f.errs.draft_version)}</div>
      ${textField(f, 'draft_note', { label: 'What changed in it', help: 'What this version changes, and what your group thinks of that.', max: P.LIMITS.draft_note, rows: 3 })}
    </div></details>`;
}
function editorStatus(pb, g) {
  if (!pb || pb.removed) return 'Not on your list yet. Write your group’s words, then send them to HIPHI.';
  if (pb.open?.state === 'changes') return `Change your words below, then send them again.${pb.live && !pb.hidden && !pb.side_clash && !groupOff(g) ? ' Your live words stay up meanwhile.' : ''}`;
  return billStatus(pb, g).line + (pb.open?.state === 'sent' && !groupOff(g) ? ' If you change it, send it again.' : '');
}
// HIPHI's note, where the words are changed (said once: the status line above it does not repeat it, A-14).
const askedNote = w => w?.state === 'changes' && w.review_note ? notice('info', 'message-square', `<p><b>HIPHI’s note:</b> “${esc(w.review_note)}”</p>`) : '';
function billView(g, id, fresh) {
  const pb = g.bills.find(b => b.bill_id === id) || null, info = P.billInfoNow(id);
  if (!info && !pb) {
    if (!ST.infoAsked?.has(id)) { (ST.infoAsked ??= new Set()).add(id); P.billsInfo([id]).then(() => here() && app.render()).catch(e => console.error(e)); return `<div class="rc pt">${back(g)}<div class="skel" style="height:120px"></div></div>`; }
    return plainView('That bill isn’t here', 'The tracker can’t find that bill. Find it again from Add a bill.', canWrite(g) ? `<p class="pt-act"><a class="btn primary" href="${esc(href('#/partner/add', g))}">${icon('search')}<span>Add a bill</span></a></p>` : '', g);
  }
  const num = pb?.bill_number || info.bill_number, yr = pb?.session_year || info?.session_year, hs = pb ? pb.hiphi_side : P.sideFamily(info?.hiphi_position);
  const f = billForm(g, pb, info, id, fresh), write = canWrite(g), st = pb && !pb.removed ? billStatus(pb, g) : null;
  // A live ask's end date has one place: the changes that go live now (moving it there moves the waiting edit's too). The
  // form shows it as words, so two boxes for one date can never disagree (A-14).
  const askOn = !!(pb && pb.live?.ask && pb.live.ask_until && pb.live.ask_until >= P.today()), until = pb?.live?.ask_until;
  const name = billName(info, pb?.open || pb?.live) || spaced(num);
  return `<div class="rc pt pt-ed">${back(g)}
    ${head({ eye: `${spaced(num)}${yr ? ` · ${yr}` : ''}`, title: name, lede: `${st ? `${st.chip} ` : ''}<span>${esc(keepLine(editorStatus(pb, g)))}</span>`,
      extra: info ? `<a class="rc-link" href="${esc(billPath(info))}">${icon('file-text')}<span>See the bill’s page</span></a>` : '' })}
    ${statusNotice(g)}
    ${askedNote(pb?.open)}
    <form class="pt-form" data-pt-form novalidate><fieldset class="pt-all"${write ? '' : ' disabled'}><legend class="sr">Your group’s words on ${esc(spaced(num))}</legend>
      ${sideField(f, hs, info)}
      ${textField(f, 'nickname', { label: 'Nickname', help: 'A short name people will remember. About 40 characters is best.', max: P.LIMITS.nickname, attrs: info && nick(info) ? ` placeholder="${esc('Like: ' + nick(info))}"` : '' })}
      ${textField(f, 'summary', { label: 'In plain words', help: `What the bill does, in a sentence or two.${f.fromTracker ? ' It starts from the tracker’s own summary; make it your own.' : ''}`, max: P.LIMITS.summary, rows: 4,
        extra: `<span class="pt-grade" data-grade-for="summary">${esc(gradeWords(f.summary))}</span>` })}
      ${pointsField(f)}
      ${textField(f, 'ask', { label: 'The ask', help: 'What should people do? For example: Send testimony to the Senate Health committee.', max: P.LIMITS.ask, rows: 2 })}
      ${askOn && write ? `<div class="field pt-field"><span class="label">The ask ends on</span><p class="pt-fixed">${esc(when(until, { time: false }).replace(/^./, c => c.toUpperCase()))}. To move it or end it, use the changes that go live now, below.</p></div>`
        : `<div class="field pt-field"><label for="pt-ask_until">The ask ends on</label><span class="help" id="pt-ask_until-help">Needed with an ask. The ask comes off the tracker after this day.</span>
        <input id="pt-ask_until" type="date" data-f="ask_until" class="pt-short" min="${P.today()}" max="${P.plusDays(P.today(), 400)}" value="${esc(f.ask_until)}"${invalid(f, 'ask_until', 'pt-ask_until-help')}>${errLine('pt-ask_until-err', f.errs.ask_until)}</div>`}
      ${draftFold(f, info)}
      ${issuesFold(g, f, info)}
      <div class="pt-actions">
        ${formErr('pt-form-err', f.formErr)}
        <div class="pt-btns"><button type="button" class="btn secondary" data-pt-save="draft">${icon('pencil')}<span>Save draft</span></button>
          <button type="submit" class="btn primary" data-pt-save="send">${icon('send')}<span>Send to HIPHI</span></button></div>
        <p class="small pt-after">${f.dirty ? 'You have changes you haven’t saved. ' : ''}HIPHI looks over your words before they go public.</p>
      </div>
    </fieldset></form>
    ${pb && !pb.removed && write ? nowSec(g, pb, askOn, until) : ''}
  </div>`;
}
// Changes that go live at once (Nate 10/22): they only take away or adjust what HIPHI approved, so they wait for no one.
function nowSec(g, pb, askOn, until) {
  const L = pb.live, rows = [];
  if (L && !pb.hidden) rows.push(`<div class="pt-now"><div><p class="pt-nt">Hide our words</p><p class="small">Takes your words off the tracker until you show them again.</p></div>
    <button type="button" class="btn secondary sm" data-pt-do="hide">${icon('eye-off')}<span>Hide our words</span></button></div>`);
  if (L && pb.hidden) rows.push(`<div class="pt-now"><div><p class="pt-nt">Your words are hidden</p><p class="small">Show them again as HIPHI approved them.</p></div>
    <button type="button" class="btn secondary sm" data-pt-do="show">${icon('eye')}<span>Show them again</span></button></div>`);
  if (askOn) rows.push(`<div class="pt-now"><div><p class="pt-nt">The ask ends ${esc(when(until, { time: false }))}</p><p class="small">End it today, or move its end date.</p></div>
    <div class="pt-nowbtns"><button type="button" class="btn secondary sm" data-pt-do="endask">${icon('circle-minus')}<span>End the ask</span></button>
    <button type="button" class="btn text sm" data-pt-moveopen aria-expanded="${ST.move === pb.bill_id}" aria-controls="pt-move">${icon('calendar')}<span>Move its end date</span></button></div>
    <div class="pt-move" id="pt-move"${ST.move === pb.bill_id ? '' : ' hidden'}><div class="field"><label for="pt-move-d">New end date</label>
      <input type="date" id="pt-move-d" class="pt-short" min="${P.today()}" max="${P.plusDays(P.today(), 400)}" value="${esc(until || '')}"></div>
      <button type="button" class="btn secondary sm" data-pt-do="move">${icon('check')}<span>Move it</span></button></div></div>`);
  rows.push(`<div class="pt-now"><div><p class="pt-nt">Remove this bill</p><p class="small">Takes it off your list and your words off the tracker.</p></div>
    <button type="button" class="btn text sm pt-danger" data-pt-do="remove">${icon('trash-2')}<span>Remove this bill</span></button></div>`);
  return sec('pt-now-h', 'Changes that go live now', `<div class="rc-card pt-nowcard">${rows.join('')}</div>${formErr('pt-now-err', ST.nowErr)}`, 'These don’t wait for HIPHI.');
}

// ---------------- one of the group's own issues ----------------
function issueForm(g, pi, id, fresh) {
  const k = `issue:${g.slug}:${id}`;
  if (FORMS[k] && (FORMS[k].dirty || !fresh)) return FORMS[k];
  const src = pi?.open || pi?.live || null;
  return (FORMS[k] = { k, dirty: false, name: src?.name || '', description: src?.description || '', stance: src?.stance || '', errs: {}, formErr: '' });
}
function issueView(g, id, fresh) {
  const pi = id === 'new' ? null : g.issues.find(i => i.id === id) || null;
  if (id !== 'new' && !pi) return plainView('That issue isn’t here', 'It may have been taken off. Your group’s issues are on its page.', '', g);
  const f = issueForm(g, pi, id, fresh), write = canWrite(g), st = pi && !pi.removed ? issueStatus(pi, g) : null;
  return `<div class="rc pt pt-ed pt-issue">${back(g)}
    ${head({ eye: 'Your group’s issue', title: (pi?.open || pi?.live)?.name || 'A new issue', lede: st ? `${st.chip} <span>${esc(keepLine(pi.open?.state === 'changes' ? 'Change your words below, then send them again.' : st.line + (pi.open?.state === 'sent' && !groupOff(g) ? ' If you change it, send it again.' : '')))}</span>` : esc('Name something your group works on. HIPHI looks it over before it goes public.') })}
    ${statusNotice(g)}${askedNote(pi?.open)}
    <form class="pt-form" data-pt-iform novalidate><fieldset class="pt-all"${write ? '' : ' disabled'}><legend class="sr">Your group’s issue</legend>
      ${textField(f, 'name', { label: 'Name', help: 'A short name, like Healthy keiki teeth.', max: P.LIMITS.issue_name })}
      ${textField(f, 'description', { label: 'What it’s about', help: 'One or two plain sentences.', max: P.LIMITS.issue_description, rows: 3, extra: `<span class="pt-grade" data-grade-for="description">${esc(gradeWords(f.description))}</span>` })}
      <fieldset class="pt-f pt-side"${f.errs.stance ? ' aria-describedby="pt-stance-err"' : ''}><legend class="pt-legend">Your side</legend>
        <div class="pt-seg">${['support', 'oppose', 'mixed'].map(v => `<label class="pt-opt${f.stance === v ? ' on' : ''}" for="pt-stance-${v}"><input type="radio" name="pt-stance" id="pt-stance-${v}" value="${v}" data-f="stance"${f.stance === v ? ' checked' : ''}><span>${P.STANCE_WORDS[v]}</span></label>`).join('')}</div>
        <p class="pt-help">Mixed: your group backs some of its bills and opposes others.</p>${errLine('pt-stance-err', f.errs.stance)}</fieldset>
      <div class="pt-actions">${formErr('pt-form-err', f.formErr)}
        <div class="pt-btns"><button type="button" class="btn secondary" data-pt-isave="draft">${icon('pencil')}<span>Save draft</span></button>
          <button type="submit" class="btn primary" data-pt-isave="send">${icon('send')}<span>Send to HIPHI</span></button></div>
        <p class="small pt-after">${f.dirty ? 'You have changes you haven’t saved. ' : ''}HIPHI looks over your words before they go public.</p></div>
    </fieldset></form>
    ${pi && !pi.removed && write ? sec('pt-now-h', 'Changes that go live now', `<div class="rc-card pt-nowcard">
      ${pi.live ? `<div class="pt-now"><div><p class="pt-nt">${pi.hidden ? 'This issue is hidden' : 'Hide this issue'}</p><p class="small">${pi.hidden ? 'Show it again as HIPHI approved it.' : 'Takes it off the tracker until you show it again.'}</p></div>
        <button type="button" class="btn secondary sm" data-pt-ido="${pi.hidden ? 'show' : 'hide'}">${icon(pi.hidden ? 'eye' : 'eye-off')}<span>${pi.hidden ? 'Show it again' : 'Hide it'}</span></button></div>` : ''}
      <div class="pt-now"><div><p class="pt-nt">Remove this issue</p><p class="small">Takes it off your group’s list and the tracker.</p></div>
        <button type="button" class="btn text sm pt-danger" data-pt-ido="remove">${icon('trash-2')}<span>Remove this issue</span></button></div></div>${formErr('pt-now-err', ST.nowErr)}`, 'These don’t wait for HIPHI.') : ''}
  </div>`;
}

// ---------------- the module ----------------
function view(route) {
  if (!P.canAsk()) { ST.data = null; ST.err = ''; return signedOut(); }   // signed out since: nothing of the group stays on the page
  if (!ST.data) { if (!ST.err) { load(); return `<div class="rc pt"><div class="skelpage" aria-busy="true" aria-label="Loading"><div class="skel" style="height:96px"></div><div class="skel" style="height:64px"></div><div class="skel" style="height:64px"></div></div></div>`; }
    return plainView('Your group', ST.err, `<p class="pt-act"><button type="button" class="btn secondary" data-pt-retry>${icon('rotate-ccw')}<span>Try again</span></button></p>`); }
  if (!ST.data.groups.length) return noGroup();
  // A first draw of this address (not a redraw of it): forms start from what the database has, unless something typed waits.
  const fresh = ST.lastHash !== location.hash; ST.lastHash = location.hash;
  if (fresh) { ST.nowErr = ''; ST.termsErr = ''; ST.move = ''; if (route.part !== '') ST.invited = null; }
  const g = groupOf(route);
  if (!g.me?.terms_at) return termsView(g);
  if (route.part === 'add') return addView(g);
  if (route.part === 'bill') return billView(g, route.id, fresh);
  if (route.part === 'issue') return issueView(g, route.id || 'new', fresh);
  return cornerView(g);
}
const TITLES = { add: 'Add a bill', bill: 'Your words on a bill', issue: 'Your group’s issue' };
export default {
  tab: 'more',
  title: route => TITLES[route.part] || 'Your group',
  render: view,
  wire,
};

// ---------------- wiring ----------------
function wire(route) {
  const root = document.querySelector('#main .pt'); if (!root) return;
  root.querySelector('[data-pt-retry]')?.addEventListener('click', () => { ST.err = ''; ST.data = null; app.render(); });
  if (!ST.data?.groups?.length) return;
  const g = groupOf(route);
  root.querySelectorAll('[data-pt-copy]').forEach(b => b.addEventListener('click', () => copy(b.dataset.ptCopy)));
  root.querySelector('[data-pt-agree]')?.addEventListener('click', async e => {
    const b = e.currentTarget; busy(b, 'Saving…');
    try { await P.agreeTerms(g.slug); await load(true); toast('Thank you. You can write for your group now.', { yay: true }); }
    catch (err) { ST.termsErr = P.plainErr(err); unbusy(b); app.render(); }
  });
  if (!route.part) wireCorner(root, g);
  if (route.part === 'add') wireAdd(root, g);
  if (route.part === 'bill') wireEditor(root, g, route.id);
  if (route.part === 'issue') wireIssue(root, g, route.id || 'new');
}
const was = new WeakMap();
const busy = (b, label) => { if (!b) return; was.set(b, b.innerHTML); b.setAttribute('aria-busy', 'true'); b.disabled = true; b.innerHTML = `${icon('loader-circle')}<span>${esc(label)}</span>`; };
const unbusy = b => { if (!b || !was.has(b)) return; b.removeAttribute('aria-busy'); b.disabled = false; b.innerHTML = was.get(b); };
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Copied.'); return; } catch { /* no permission: select it instead */ }
  const el = $('#pt-url'); if (el) { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  toast('Select the link and copy it.');
}
function wireCorner(root, g) {
  root.querySelectorAll('[data-pt-restore]').forEach(b => b.addEventListener('click', async () => {
    const [kind, id] = b.dataset.ptRestore.split(':'); busy(b, 'Putting it back…');
    try { await (kind === 'bill' ? P.billChange({ slug: g.slug, bill_id: id, do: 'restore' }) : P.issueChange({ slug: g.slug, issue_id: id, do: 'restore' })); await load(true); toast('It’s back on your list.'); }
    catch (e) { unbusy(b); toast(P.plainErr(e), { err: true }); }
  }));
  root.querySelectorAll('[data-pt-off]').forEach(b => b.addEventListener('click', async () => {
    const p = g.people.find(x => x.id === b.dataset.ptOff); if (!p) return; busy(b, 'Taking off…');
    try { await P.invite({ slug: g.slug, remove: p.id }); await load(true);
      toast(`${p.name || p.email} is out of your group.`, { undo: p.email ? () => P.invite({ slug: g.slug, email: p.email, name: p.name || '' }).then(() => load(true)) : null }); }
    catch (e) { unbusy(b); toast(P.plainErr(e), { err: true }); }
  }));
  root.querySelector('[data-pt-invopen]')?.addEventListener('click', () => { ST.invOpen = true; ST.invited = null; app.render(); document.getElementById('pt-inv-name')?.focus(); });
  root.querySelector('[data-pt-invclose]')?.addEventListener('click', () => { ST.invOpen = false; ST.inv = { name: '', email: '', err: {} }; app.render(); root.ownerDocument.querySelector('[data-pt-invopen]')?.focus(); });
  const form = root.querySelector('[data-pt-invite]');
  if (form) {
    form.querySelectorAll('[data-inv]').forEach(i => i.addEventListener('input', () => { ST.inv[i.dataset.inv] = i.value; }));
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const name = ST.inv.name.trim(), email = ST.inv.email.trim(), err = {};
      if (!name) err.name = 'Write their name, so your group knows who wrote what.';
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) err.email = 'That email doesn’t look right. Try one like name@example.org.';
      ST.inv.err = err;
      if (Object.keys(err).length) { app.render(); document.getElementById(err.name ? 'pt-inv-name' : 'pt-inv-email')?.focus(); return; }
      const b = form.querySelector('[type=submit]'); busy(b, 'Inviting…');
      try { await P.invite({ slug: g.slug, email, name }); ST.invited = { name, email }; ST.inv = { name: '', email: '', err: {} }; ST.invOpen = false; await load(true); }
      catch (x) { ST.inv.err = { form: P.plainErr(x) }; unbusy(b); app.render(); }
    });
  }
}
function wireAdd(root, g) {
  const inp = root.querySelector('#pt-q'); if (!inp) return;
  inp.addEventListener('input', () => runSearch(g, inp.value));
  root.querySelector('[data-pt-search]')?.addEventListener('submit', e => { e.preventDefault(); clearTimeout(qTimer); runSearch(g, inp.value); });
  if (!ST.q) inp.focus({ preventScroll: true });
  else if (!ST.res && !ST.qbusy) runSearch(g, ST.q);
}
// The fields update their own counters, grade and hints as they are typed in; nothing redraws the page while typing (a
// redraw would close a phone's keyboard). Choices that change what is shown (the side, a point added) redraw it, and the
// redraw puts focus back where it was (pub/app.js).
// A text box grows with what is in it, so nothing typed hides behind its own scroll bar (Safari has no field-sizing yet).
const fit = el => { if (el?.tagName !== 'TEXTAREA') return; el.style.height = 'auto'; el.style.height = `${el.scrollHeight + 2}px`; };
function wireFields(root, f, onChange) {
  root.querySelectorAll('textarea').forEach(fit);
  const meta = (name, v) => {
    const c = root.querySelector(`[data-count-for="${name}"]`); if (c) c.textContent = c.textContent.replace(/^\d+/, String(v.length));
    const h = root.querySelector(`[data-hint-for="${name}"]`); if (h) h.innerHTML = hintsHTML(name, v);
    const gr = root.querySelector(`[data-grade-for="${name}"]`); if (gr) gr.textContent = gradeWords(v);
  };
  const clearErr = name => { if (!f.errs?.[name]) return; delete f.errs[name]; const el = document.getElementById(`pt-${name}`); el?.removeAttribute('aria-invalid'); document.getElementById(`pt-${name}-err`)?.remove(); };
  root.addEventListener('input', e => {
    const el = e.target, name = el.dataset?.f; if (!name || el.type === 'radio' || el.type === 'checkbox') return;
    fit(el);
    if (name === 'point') { const i = +el.dataset.i; f.points[i] = el.value; meta('point-' + i, el.value);
      const n = root.querySelector('[data-pts-count]'); if (n) n.textContent = `· ${f.points.filter(s => s.trim()).length} of 5`;
      const gr = root.querySelector('[data-grade-for="points"]'); if (gr) gr.textContent = gradeWords(f.points.join('. ')); }
    else { f[name] = el.value; if (name !== 'iq') meta(name, el.value); clearErr(name); }
    if (name !== 'iq') { f.dirty = true; keepForms(); }
    onChange?.(name, el);
  });
  root.addEventListener('change', e => {
    const el = e.target, name = el.dataset?.f; if (!name || el.type !== 'radio') return;
    f.dirty = true; keepForms(); clearErr(name);
    if (name === 'fam') { f.fam = el.value; f.side = el.value; app.render(); }
    else if (name === 'stance') { f.stance = el.value; app.render(); }
    else f[name] = el.value;
  });
  // A hint's button (its hint is drawn again as the field changes, so the click is caught here, once for all of them).
  root.addEventListener('click', e => { const b = e.target.closest?.('.pt-hints [data-fix]'); if (b) fixField(b); });
  root.querySelectorAll('[data-pt-fold]').forEach(d => d.addEventListener('toggle', () => { f[d.dataset.ptFold] = d.open; keepForms(); }));
}
function fixField(b) {
  const name = b.dataset.fix, kind = b.dataset.kind, m = /^point-(\d+)$/.exec(name);
  const el = document.getElementById(m ? `pt-point-${m[1]}` : `pt-${name}`); if (!el) return;
  el.value = fixText(el.value, kind); el.dispatchEvent(new Event('input', { bubbles: true })); el.focus();
}
function firstInvalid(errs, order) { const k = order.find(n => errs[n]); if (!k) return;
  const el = k === 'side' ? document.querySelector('[data-f="fam"]:not(:disabled)') || document.querySelector('[data-f="side"]') : k === 'stance' ? document.querySelector('[data-f="stance"]') : document.getElementById(`pt-${k}`);
  el?.focus(); el?.closest('.field, fieldset')?.scrollIntoView({ block: 'center' }); }
function validateBill(f, send) {
  const e = {}, day = P.today(), ask = f.ask.trim(), dv = f.draft_version.trim().toUpperCase(), nk = f.nickname.trim();
  if (!f.side) e.side = 'Pick your side.';
  if (nk && nk.length < 2) e.nickname = 'Write at least 2 letters, or leave it empty.';
  if (send && !f.summary.trim()) e.summary = 'Write the plain summary before sending.';
  if (ask && !f.ask_until) e.ask_until = 'Pick the day the ask ends.';
  else if (ask && (f.ask_until < day || f.ask_until > P.plusDays(day, 400))) e.ask_until = 'The end date is from today to about a year ahead.';
  if (dv && !/^[A-Z0-9]{1,8}$/.test(dv)) e.draft_version = 'Write the draft like HD1, SD2 or CD1.';
  if (e.draft_version) f.openDraft = true;
  return e;
}
function wireEditor(root, g, id) {
  const f = FORMS[`bill:${g.slug}:${id}`]; if (!f) return;
  const info = P.billInfoNow(id);
  wireFields(root, f, name => {
    if (name === 'iq') { const { list } = issueChoices(g, f, info), box = root.querySelector('#pt-iq-res'); if (box) box.innerHTML = issueMatchesHTML(f, new Set(list.map(x => x.id))); }
  });
  root.addEventListener('change', e => {
    const el = e.target; if (el.dataset?.f !== 'issue') return;
    const on = el.checked, max = root.querySelector('#pt-issue-max');
    if (on && f.issue_ids.length >= P.LIMITS.issues) { el.checked = false; if (max) max.hidden = false; return; }
    if (max) max.hidden = true;
    f.issue_ids = on ? [...f.issue_ids, el.value] : f.issue_ids.filter(x => x !== el.value); f.dirty = true; keepForms();
    const { list } = issueChoices(g, f, info), pv = root.querySelector('[data-issues-preview]'); if (pv) pv.textContent = issuesPreview(f, list);
  });
  root.querySelector('[data-pt-addpoint]')?.addEventListener('click', () => { f.points.push(''); f.dirty = true; keepForms(); app.render(); document.getElementById(`pt-point-${f.points.length - 1}`)?.focus(); });
  root.querySelectorAll('[data-pt-delpoint]').forEach(b => b.addEventListener('click', () => { const i = +b.dataset.ptDelpoint; f.points.splice(i, 1); f.dirty = true; keepForms(); app.render();
    document.getElementById(`pt-point-${Math.min(i, f.points.length - 1)}`)?.focus(); }));
  const save = async send => {
    f.errs = validateBill(f, send); f.formErr = '';
    if (Object.keys(f.errs).length) { app.render(); firstInvalid(f.errs, ['side', 'nickname', 'summary', 'ask', 'ask_until', 'draft_version']); return; }
    const b = root.querySelector(`[data-pt-save="${send ? 'send' : 'draft'}"]`); busy(b, send ? 'Sending…' : 'Saving…');
    try {
      await P.saveBill({ slug: g.slug, bill_id: id, side: f.side, nickname: f.nickname.trim(), summary: f.summary.trim(), points: f.points.map(s => s.trim()).filter(Boolean),
        ask: f.ask.trim(), ask_until: f.ask.trim() ? f.ask_until : '', draft_version: f.draft_version.trim().toUpperCase(), draft_note: f.draft_note.trim(), issue_ids: f.issue_ids, send });
      delete FORMS[f.k]; keepForms();
      if (send) { await load(true); toast('Sent to HIPHI. Its status shows on your group’s page.', { yay: true }); app.go(href('#/partner', g)); }
      else { await load(true); toast('Draft saved. Send it to HIPHI when it’s ready.'); }
    } catch (e) {
      console.error(e); f.formErr = P.plainErr(e); if (/side/i.test(f.formErr)) f.errs.side = f.formErr;
      unbusy(b); app.render(); document.getElementById('pt-form-err')?.scrollIntoView({ block: 'center' });
    }
  };
  root.querySelector('[data-pt-form]')?.addEventListener('submit', e => { e.preventDefault(); save(true); });
  root.querySelector('[data-pt-save="draft"]')?.addEventListener('click', () => save(false));
  // The changes that go live at once, each with its Undo (B-5).
  const pb = g.bills.find(b => b.bill_id === id);
  root.querySelector('[data-pt-moveopen]')?.addEventListener('click', e => { ST.move = ST.move === id ? '' : id; const m = root.querySelector('#pt-move'); if (m) m.hidden = ST.move !== id;
    e.currentTarget.setAttribute('aria-expanded', String(ST.move === id)); if (ST.move === id) root.querySelector('#pt-move-d')?.focus(); });
  root.querySelectorAll('[data-pt-do]').forEach(b => b.addEventListener('click', async () => {
    const what = b.dataset.ptDo, ch = p => P.billChange({ slug: g.slug, bill_id: id, ...p }), num = spaced(pb?.bill_number || '');
    const oldUntil = (pb?.live?.ask ? pb.live : pb?.open)?.ask_until || '';
    let p, msg, undo;
    if (what === 'hide') { p = { do: 'hide' }; msg = 'Your words are off the tracker.'; undo = () => ch({ do: 'show' }); }
    else if (what === 'show') { p = { do: 'show' }; msg = 'Your words are back on the tracker.'; undo = () => ch({ do: 'hide' }); }
    else if (what === 'remove') { p = { do: 'remove' }; msg = `${num} is off your list.`; undo = () => ch({ do: 'restore' }); }
    else if (what === 'endask') { p = { do: 'ask_until', ask_until: '' }; msg = 'The ask has ended.'; undo = oldUntil >= P.today() ? () => ch({ do: 'ask_until', ask_until: oldUntil }) : null; }
    else if (what === 'move') { const d = root.querySelector('#pt-move-d')?.value || '';
      if (!d || d < P.today() || d > P.plusDays(P.today(), 400)) { ST.nowErr = 'Pick a day from today to about a year ahead.'; app.render(); return; }
      p = { do: 'ask_until', ask_until: d }; msg = `The ask now ends ${when(d, { time: false })}.`; undo = oldUntil >= P.today() ? () => ch({ do: 'ask_until', ask_until: oldUntil }) : null; }
    busy(b, 'Saving…'); ST.nowErr = '';
    try { await ch(p); ST.move = '';
      // Something typed and not saved keeps its words, with the ask's new end (or no ask, once it has ended).
      const fk = FORMS[`bill:${g.slug}:${id}`]; if (fk?.dirty && p.do === 'ask_until') { if (p.ask_until) fk.ask_until = p.ask_until; else { fk.ask = ''; fk.ask_until = ''; } keepForms(); }
      await load(true); if (what === 'remove') app.go(href('#/partner', g));
      toast(msg, { undo: undo ? () => undo().then(() => load(true)) : null }); }
    catch (e) { console.error(e); ST.nowErr = P.plainErr(e); unbusy(b); app.render(); }
  }));
}
function wireIssue(root, g, id) {
  const f = FORMS[`issue:${g.slug}:${id}`]; if (!f) return;
  wireFields(root, f);
  const save = async send => {
    const e = {}, name = f.name.trim();
    if (name.length < 2) e.name = 'Name the issue, in 2 to 60 characters.';
    if (send && !f.stance) e.stance = 'Pick your side.';
    f.errs = e; f.formErr = '';
    if (Object.keys(e).length) { app.render(); firstInvalid(e, ['name', 'description', 'stance']); return; }
    const b = root.querySelector(`[data-pt-isave="${send ? 'send' : 'draft'}"]`); busy(b, send ? 'Sending…' : 'Saving…');
    try {
      const r = await P.saveIssue({ slug: g.slug, issue_id: id === 'new' ? '' : id, name, description: f.description.trim(), stance: f.stance, send });
      delete FORMS[f.k]; keepForms(); await load(true);
      toast(send ? 'Sent to HIPHI. Its status shows on your group’s page.' : 'Draft saved. Send it to HIPHI when it’s ready.', send ? { yay: true } : {});
      app.go(send ? href('#/partner', g) : href('#/partner/issue/' + r.issue_id, g), { replace: !send && id === 'new' });
    } catch (x) { console.error(x); f.formErr = P.plainErr(x); unbusy(b); app.render(); }
  };
  root.querySelector('[data-pt-iform]')?.addEventListener('submit', e => { e.preventDefault(); save(true); });
  root.querySelector('[data-pt-isave="draft"]')?.addEventListener('click', () => save(false));
  root.querySelectorAll('[data-pt-ido]').forEach(b => b.addEventListener('click', async () => {
    const what = b.dataset.ptIdo, ch = d => P.issueChange({ slug: g.slug, issue_id: id, do: d });
    const back2 = { hide: 'show', show: 'hide', remove: 'restore' }[what];
    busy(b, 'Saving…'); ST.nowErr = '';
    try { await ch(what); await load(true); if (what === 'remove') app.go(href('#/partner', g));
      toast(what === 'hide' ? 'The issue is off the tracker.' : what === 'show' ? 'The issue is back on the tracker.' : 'The issue is off your list.', { undo: () => ch(back2).then(() => load(true)) }); }
    catch (e) { console.error(e); ST.nowErr = P.plainErr(e); unbusy(b); app.render(); }
  }));
}
