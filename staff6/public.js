// HIPHI Staff v6 · Bill › Public (#/bill/X/public; R-336 V22, plan 3.3, R-264). v6: the same three blocks in the warm
// look, the version notes named in words ("House draft 1", V05), the share kit's buttons tonal, so the page's one filled
// button is "Save public page" (spec 4, rule 1). F125: "Copy share link" stays here for every public bill, including those
// with no ask card on Outreach.
// v3's notes follow. A person comes here to decide what the public page says about this bill
// and to get it in front of people (B-1). v3 gives the tab three labelled blocks:
// "On the public page": whether the bill is on it, the nickname, the plain summary, the ask and the date it stops
// showing, the talking points, with ONE Save for those fields (the same fields the current app saves), the preview
// beside them, and the notes on what each draft changed. "Share kit" (v3's "Spread the word"): the share link, a ready
// message and the email to supporters. "Where it shows", folded: its issues, the lists it is on and the pre-tick for new
// visitors, which each act at once, since each is its own thing (an issue is what the public follows, R-018; a list is a
// page the public follows). v4 (R-269): the share kit comes first at every width (on a phone since R-152 C), under the
// name the hearing page gives it (C-15: four names for one toolkit). Three explaining sentences at most (P-4); the rest
// of what the tab says is status.
// Desktop (build 3): the form stays a readable column, and where the column has room a small card beside it shows,
// as you type, how the public page will name the bill (nickname, summary, the ask).
// The staff "recommended" flag lives here now, as "Pre-tick for new visitors" (R-022 #13). Nate: "the language shouldn't
// be so transparent to the public at the moment. It should be a silent recommendation." So it is labelled for staff by
// what it does, and the preview never shows it: nothing on the public page says a bill was recommended. v3: it sits
// with the issues and lists under "Where it shows" and saves on the switch, with Undo, as they do.
// Saving has Undo (B-5): the whole form goes back to what it was before the save.
// Talking points (084, R-068, 9/28): one box, one point per line. The public testimony walkthrough offers them to people on
// HIPHI's side, who tap them into a letter sent under their own name. Claude drafted the first 248; a save here marks them
// as the team's (talking_points_edited_at), so a later draft run never overwrites them.
import { S, DB, DEMO, esc } from './data.js';
import { FACTS, pubStateText, pubStateCls, hiToday, PUBLIC_APP, publicWords, publicResponse, shareKit, hearingAhead, askReach } from './model.js';
import { icon, btn, iconBtn, toast, switchRow, openSheet, closeSheet } from './ui.js';
import { rerender, drafts, dayOf, plainTitle, underTabs } from './bill.js';
import { versionWords, numWords } from './steps.js';
import { issuesOfBill, openIssuePicker, whyNot, issueLinkHref } from './issues.js';
// The public page's address names the session even for this session's bills (R-212 #18), so a link copied from here
// still opens this bill after 20 Jan 2027, when numbers start again.
const pubRoute = b => `#/bill/${b.session_year ? b.session_year + '/' : ''}${String(b.bill_number).replace(/\s/g, '')}`;
import { askConflict } from './conflict.js';
// OUTREACH (V20, X23): a bill with a card on This week's asks links to it in place of its own kit; the one email rule.
import { askCardHref } from './asks.js';
import { emailDoor } from './composer.js';

const FIELDS = ['is_public', 'nickname', 'public_summary', 'public_action', 'public_action_until', 'talking_points'];
const BOOL = new Set(['is_public']);
const saved = (b, k) => BOOL.has(k) ? !!b[k] : k === 'talking_points' ? (b.talking_points || []).join('\n') : (b[k] || '');
// The box's lines as the database wants them: trimmed, no blank lines. 084 allows five, each 1-200 characters.
const pointsIn = v => String(v || '').split(/\n+/).map(s => s.trim().replace(/\s+/g, ' ')).filter(Boolean);
const pointsCount = v => { const n = pointsIn(v).length; return `${n} of 5 points`; };
// Typed but unsaved values survive the re-render a list change causes; they live here until Save.
const draftOf = b => drafts.get(b.id + ':pub') || {};
// What the form's fields held when the person began editing (R-152 B): the base a save is compared with, so only what they
// changed is written and a teammate's newer save is noticed (DB.saveBillFields). Dropped when the draft is.
const bases = new Map();
const rawOf = b => ({ nickname: b.nickname || null, public_summary: b.public_summary || null, public_action: b.public_action || null, public_action_until: b.public_action_until || null,
  is_public: !!b.is_public, recommended: !!b.recommended, talking_points: b.talking_points || null, talking_points_edited_at: b.talking_points_edited_at || null });
// The ask shows through a date; if that is before the next hearing the ask stops while people can still act on it (R-152 C).
// A hint, not a block: some asks are meant to end early. Hawaiʻi dates, as everywhere else in the app.
const untilWarn = (b, ask, until) => {
  if (!String(ask || '').trim() || !until) return '';
  const h = hearingAhead(b); if (!h) return '';
  const day = new Date(h.scheduled_at).toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });
  return until < day ? `This stops showing on ${dayOf(until)}, before the ${h.committee} hearing on ${dayOf(day)}. Pick a later day to keep it up until then.` : '';
};
const LABEL = { nickname: 'Nickname', public_summary: 'Public summary', public_action: 'The ask', public_action_until: 'Show the ask until', is_public: 'On the public page', recommended: 'Recommended', talking_points: 'Talking points' };
const asText = v => Array.isArray(v) ? v.join('\n') : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : v;
const valOf = (b, k) => { const d = draftOf(b); return k in d ? d[k] : saved(b, k); };
const dirty = b => FIELDS.some(k => valOf(b, k) !== saved(b, k));
// A character count shows once the words near the limit (three quarters of it): before that it is a number that asks
// nothing of anyone (v3, R-264 rule 4).
const countText = (n, max = 280) => n >= max * .75 ? `${n} of ${max} characters` : '';
const count = (n, id, max = 280) => `<span class="help bw-count" id="${id}" aria-live="polite">${countText(n, max)}</span>`;

// ---- the preview (desktop, where there is room beside the form): how the public page will name this bill ----
// The public page leads with the nickname, then the summary; with no nickname the summary is the headline; with
// neither, the first sentence of the Capitol's description. "HIPHI asks" shows only while the ask has a date that
// has not passed. v holds the form's values as typed, so the card changes with every key.
const spaced = n => String(n || '').replace(/^([A-Z]+)\s*(\d)/, '$1 $2');
// X10-3: where the ask will reach people, under the ask's date, in words. v3: the way to send it now is "Email supporters"
// under "Share kit", said once (A-14).
function reachNote(b) {
  const r = askReach(b);
  return `<div class="bw-reach" role="note"><p class="small"><b>Where this ask reaches people:</b> ${r.lines.map(esc).join(' ')}</p></div>`;
}
function previewInner(b, v) {
  const nick = v.nickname.trim().replace(/\s+/g, ' '), sum = v.public_summary.trim(), ask = v.public_action.trim(), until = v.public_action_until;
  const first = (/^(.{20,220}?[.!?])(\s|$)/.exec(String(b.description || '').trim()) || [])[1];
  const name = nick || sum || first || `A bill about ${plainTitle(b).replace(/^./, c => c.toLowerCase())}`;
  const askOn = ask && until && until >= hiToday();
  // No ask is the usual state and the line above the form says it already (v3, A-14): the note speaks only when there is
  // something to know about the ask being typed, or the page is hidden.
  const note = !v.is_public ? [ 'eye-off', 'Hidden. Nobody sees this until it is switched on and saved.' ]
    : !ask ? null
    : !until ? ['triangle-alert', 'The ask needs a date, or it never shows.']
    : until < hiToday() ? ['triangle-alert', 'That date has passed, so the ask does not show.']
    : ['calendar-days', `The ask shows through ${dayOf(until)}.`];
  return `<div class="card bw-prevcard${v.is_public ? '' : ' off'}">
      <p class="bw-pnum">${esc(numWords(b))}</p>
      <p class="bw-pname${nick ? '' : ' bw-long'}">${esc(name)}</p>
      ${nick && sum ? `<p class="bw-plede">${esc(sum)}</p>` : ''}
      ${ask ? `<p class="bw-pask${askOn ? '' : ' off'}">${icon('megaphone')}<span><b>HIPHI asks:</b> ${esc(ask)}</span></p>` : ''}
    </div>
    ${note ? `<p class="bw-pnote">${icon(note[0])}<span>${esc(note[1])}</span></p>` : ''}`;
}
const valuesOf = b => Object.fromEntries(FIELDS.map(k => [k, valOf(b, k)]));

// ---- "Where it shows" (v3), folded: its issues, the lists it is on, and the pre-tick for new visitors ----
// Issues (063, R-018): the public follows issues, and a bill reaches everyone following an issue it is on. One row per
// issue: its name (to the issue's page), HIPHI's stance on the issue in words, and × to take the bill off it, with Undo.
// Choose opens every issue, by category. v3: one stance picker per bill, its Position; the issue's own stance is changed
// on the issue's page (094, R-093), so here it is said, not picked.
const ISSUE_SAYS = { support: 'HIPHI supports this issue', oppose: 'HIPHI opposes this issue', mixed: 'HIPHI’s stance on this issue is mixed' };
function whereBlock(b, listed) {
  const iss = issuesOfBill(b.id), why = whyNot(b), lists = S.lists || [], open = !!S.bwWhereOpen;
  // The fold's line says where it shows already, so a closed fold still answers the question.
  const sum = iss.length ? iss.slice(0, 2).map(i => i.name).join(', ') + (iss.length > 2 ? ` and ${iss.length - 2} more` : '') : 'No issue yet';
  const issues = !(S.categories || []).length ? '' : `<div class="bw-wpart"><h3>Issues</h3>
    ${why && iss.length ? `<p class="bw-whynot">${icon('info')}<span>${esc(why.replace('its followers do not', 'the people following these issues do not'))}.</span></p>` : ''}
    ${iss.length ? `<ul class="bw-isslist">${iss.map(i => `<li class="bw-issrow"><span class="bw-issb"><a class="bw-issname" href="${esc(issueLinkHref(i, b))}">${esc(i.name)}</a><span class="bw-isst">${esc(ISSUE_SAYS[i.stance] || 'No stance on this issue yet')}</span></span>
      ${iconBtn('x', `Take it off ${i.name}`, { 'data-issoff': i.id })}</li>`).join('')}</ul>` : ''}
    <div class="bw-ispick">${btn(iss.length ? 'Change issues' : 'Choose issues', { kind: 'secondary', sm: true, icon: iss.length ? 'pencil' : 'plus', attrs: { 'data-ispick': '1', 'aria-haspopup': 'dialog' } })}</div></div>`;
  const listsPart = `<div class="bw-wpart"><h3>Lists</h3>
    ${!lists.length ? '<p class="bw-quiet">No lists yet.</p>'
      : `${listed ? '' : '<p class="small muted">Make it public first to add it to a list.</p>'}
      <div class="bw-lists">${lists.map(l => { const on = (S.listBills || []).some(x => x.list_id === l.id && x.bill_id === b.id), off = !on && !listed;
        return `<button type="button" class="bw-toggle" data-list="${esc(l.id)}" aria-pressed="${on}"${off ? ' aria-disabled="true"' : ''}>${icon(on ? 'check' : 'plus')}<span>${esc(l.title)}${l.is_published ? '' : ' <span class="bw-draft">(draft)</span>'}</span></button>`; }).join('')}</div>`}</div>`;
  return `<details class="bw-sec bw-pblk bw-where" id="bw-where"${open ? ' open' : ''}>
    <summary><h2 class="bw-h2" id="bw-where-h">Where it shows</h2><span class="bw-wsum">${esc(sum)}</span>${icon('chevron-down', { cls: 'bw-chev' })}</summary>
    <div class="bw-wbody">${issues}${listsPart}
      <div class="bw-wpart">${switchRow('bw-prec', 'Pre-tick for new visitors', !!b.recommended, 'New visitors find it already ticked. Nothing on the public page says so.')}</div></div>
  </details>`;
}

// ---- what each draft changed (R-060, migration 120): the notes the public page shows under "How it has changed" ----
// Claude drafts them from the committee reports (backend tools/apply_draft_notes.js); a note still in Claude's words says
// so, so someone checks it. Edit opens the note in a sheet; Save has Undo. The current draft with no note gets "Add".
// R-148 (migration 124): staff tick a draft that changes what people should say. People who testified on an earlier draft
// then get an amber "Read this before you send" when they send their letter again, with the line written here for them.
// Claude may suggest the tick when it drafts the note; only staff's tick reaches the public.
// "House draft 1": the version in words (steps.js versionWords, V05); the code stays searchable on Today's notes.
const draftName = v => versionWords(v);
const draftRank = (b, v) => { const m = /^(HD|SD|CD|FD)(\d+)$/.exec(v || '') || []; const own = (b.bill_number || '')[0] === 'S' ? ['SD', 'HD'] : ['HD', 'SD'];
  return ({ [own[0]]: 0, [own[1]]: 1, FD: 2, CD: 3 }[m[1]] ?? 4) * 100 + (+m[2] || 0); };
function loadDrafts(b) {
  if ((S.billDrafts ??= {})[b.id] !== undefined) return;
  S.billDrafts[b.id] = null;
  DB.billDrafts(b.id).then(rows => { S.billDrafts[b.id] = rows; rerender(); }).catch(() => { S.billDrafts[b.id] = []; });
}
// Part of "On the public page" (v3), under its own small heading, named as the public page names it.
function draftsSection(b) {
  loadDrafts(b);
  // Up to the bill's current draft, as on the public page (the practice copy is frozen in March).
  const cur = b.current_version, upto = cur ? draftRank(b, cur) : Infinity;
  const rows = (S.billDrafts[b.id] || []).filter(d => draftRank(b, d.version) <= upto).sort((x, y) => draftRank(b, y.version) - draftRank(b, x.version));
  const missing = cur && /^(HD|SD|CD|FD)\d+$/.test(cur) && !rows.some(d => d.version === cur);
  if (!rows.length && !missing) return '';
  return `<div class="bw-drpart" aria-labelledby="bw-dr-h">
    <h3 id="bw-dr-h">How it has changed</h3>
    ${rows.length ? `<ul class="bw-drlist" role="list">${rows.map(d => `<li class="bw-drrow"><div class="bw-drbody"><b>${esc(draftName(d.version))}</b>
      <span>${esc(d.summary)}</span>${d.written_by === 'staff' ? '' : '<span class="bw-quiet">Drafted by Claude from the committee report: please check it.</span>'}
      ${d.changes_letters ? `<span class="bw-drbig">${icon('triangle-alert')}<span><b>People who wrote on an earlier draft are warned</b>${d.letter_note ? `, with HIPHI’s advice: “${esc(d.letter_note)}”` : '.'}</span></span>`
        : d.changes_suggested ? `<span class="bw-drsug">${icon('sparkles')}<span>Claude suggests warning people who wrote on an earlier draft${d.letter_note ? `: “${esc(d.letter_note)}”` : '.'}</span></span>` : ''}
      ${d.source_url ? `<a class="bw-inline" href="${esc(d.source_url)}" target="_blank" rel="noopener">Committee report${icon('external-link')}</a>` : ''}</div>
      <div class="bw-dracts">${d.changes_suggested && !d.changes_letters ? btn('Warn letter writers', { kind: 'text', sm: true, icon: 'triangle-alert', attrs: { 'data-drtick': d.version, 'aria-label': `Warn people who wrote on a draft before ${draftName(d.version)}` } }) : ''}
      ${d.written_by === 'staff' ? '' : btn('Note is right', { kind: 'text', sm: true, icon: 'check', attrs: { 'data-drok': d.version, 'aria-label': `The note on ${draftName(d.version)} is right` } })}
      ${btn('Edit', { kind: 'text', sm: true, icon: 'pencil', attrs: { 'data-dredit': d.version, 'aria-label': `Edit the note on ${draftName(d.version)}`, 'aria-haspopup': 'dialog' } })}</div></li>`).join('')}</ul>` : ''}
    ${missing ? `<div class="bw-acts">${btn(`Add a note on ${draftName(cur)}`, { kind: 'secondary', sm: true, icon: 'plus', attrs: { 'data-dredit': cur, 'aria-haspopup': 'dialog' } })}</div>` : ''}
  </div>`;
}
function editDraft(b, version) {
  const d = (S.billDrafts[b.id] || []).find(x => x.version === version), before = d ? d.summary : '';
  const was = { changes_letters: !!d?.changes_letters, letter_note: d?.letter_note || '' };
  openSheet({ title: `What ${draftName(version)} changed`, size: 'auto',
    body: `${d?.source_url ? `<p class="small"><a class="bw-inline" href="${esc(d.source_url)}" target="_blank" rel="noopener">Read the committee report${icon('external-link')}</a></p>` : ''}<div class="field"><label for="bw-drtxt">In plain words</label><textarea id="bw-drtxt" rows="4" maxlength="600" aria-describedby="bw-drtxt-h">${esc(before)}</textarea>
      <span class="help" id="bw-drtxt-h">One or two sentences a neighbor would understand, from the committee’s report: what this draft added, took out or changed.</span><div id="bw-drerr" role="alert"></div></div>
      <div class="field bw-drbigf"><label class="check"><input type="checkbox" id="bw-drbig"${was.changes_letters ? ' checked' : ''} aria-describedby="bw-drbig-h"><span>Warn people who wrote on an earlier draft</span></label>
        <span class="help" id="bw-drbig-h">When a letter written for an earlier draft could now be wrong: money taken out, what it does moved to another law, the bill replaced. Sending their letter again, they see “Your letter needs a check”.${d?.changes_suggested && !was.changes_letters ? ' Claude suggests it.' : ''}</span></div>
      <div class="field" id="bw-drlnf"${was.changes_letters ? '' : ' hidden'}><label for="bw-drln">HIPHI’s advice to them <span class="small muted">(optional)</span></label><textarea id="bw-drln" rows="2" maxlength="300" placeholder="If your letter said …, change it to …" aria-describedby="bw-drln-h">${esc(was.letter_note)}</textarea>
        <span class="help" id="bw-drln-h">Shown with the warning. One sentence.</span></div>`,
    foot: `${btn('Cancel', { kind: 'text', attrs: { 'data-drno': '1' } })}${btn('Save', { kind: 'primary', icon: 'check', attrs: { 'data-drsave': '1' } })}`,
    wire: dlg => {
      dlg.querySelector('[data-drno]').onclick = () => closeSheet();
      // The advice is asked for only when they are warned (B-12).
      const big = dlg.querySelector('#bw-drbig'); big.onchange = () => { dlg.querySelector('#bw-drlnf').hidden = !big.checked; if (big.checked) dlg.querySelector('#bw-drln').focus(); };
      dlg.querySelector('[data-drsave]').onclick = async () => {
        const txt = dlg.querySelector('#bw-drtxt').value.trim();
        if (!txt) { dlg.querySelector('#bw-drerr').innerHTML = '<span class="err">Write a sentence, or Cancel.</span>'; return; }
        const extra = { changes_letters: dlg.querySelector('#bw-drbig').checked, letter_note: dlg.querySelector('#bw-drln').value };
        try { const row = await DB.saveBillDraft(b.id, version, txt, extra); put(b, row); await closeSheet({ silent: true }); rerender('[data-dredit]');
          toast(`Saved. The public page shows it under “How it has changed”${extra.changes_letters ? ', and people who wrote on an earlier draft are warned' : ''}.`, { ok: true, undo: before ? async () => { put(b, await DB.saveBillDraft(b.id, version, before, was)); rerender(); } : null }); }
        catch (e) { toast(e, { err: true }); } };
    } });
}
const put = (b, row) => { const list = S.billDrafts[b.id] ||= []; const i = list.findIndex(x => x.version === row.version); if (i >= 0) list[i] = row; else list.push(row);
  if (S.allDrafts) S.allDrafts[b.id] = list; };   // Today and the testimony cards read the same notes (R-148)

// ?focus=drafts (Today's "Say what HD2 changed", R-148): once the notes are on the page, scroll to them and put focus there.
export function wireDraftsFocus(pnl, b) {
  if (S.focusDrafts !== b.id) return;
  const hd = pnl?.querySelector('#bw-dr-h'); if (!hd) return;
  S.focusDrafts = null;
  // Looked up again when it runs: the page may have been drawn again meanwhile (the notes for Today arrive too), and once
  // more a moment later if that redraw left focus on the page itself.
  const land = () => { const el = document.getElementById('bw-dr-h'); if (!el) return; el.setAttribute('tabindex', '-1'); el.scrollIntoView({ block: 'start' }); el.focus({ preventScroll: true }); };
  requestAnimationFrame(land);
  setTimeout(() => { const a = document.activeElement; if (!a || a === document.body || a.id === 'main') land(); }, 450);
}
// The public's response in Outreach's words and order ("43 followers · 5 testified · 4 emailed · 2 plan to attend"; model.js
// publicWords says "43 follow"): one word per fact on the Public tab, the hearing page and This week's asks (C-15).
function respWords(b) {
  const c = publicResponse(b); if (!c) return '';
  const n = x => Number(x).toLocaleString();
  const parts = [c.followers ? `${n(c.followers)} ${c.followers === 1 ? 'follower' : 'followers'}` : '', c.testimonies ? `${n(c.testimonies)} testified` : '', c.emails ? `${n(c.emails)} emailed` : '',
    c.attending ? `${n(c.attending)} ${c.attending === 1 ? 'plans' : 'plan'} to attend` : '', c.shares ? `${n(c.shares)} shared` : ''].filter(Boolean);
  return parts.length ? `Public: ${parts.join(' · ')}` : '';
}
export function renderPublic(b) {
  const cls = pubStateCls(b), live = cls.includes('live'), warn = cls.includes('warn');
  const listed = b.is_public && b.tracked !== false, sum = valOf(b, 'public_summary'), ask = valOf(b, 'public_action'), nickname = valOf(b, 'nickname');
  const pubLink = live ? ` <a class="bw-inline" href="${esc(PUBLIC_APP() + (DEMO ? '?demo=1' : '') + pubRoute(b))}" target="_blank" rel="noopener">See it${icon('external-link')}</a>` : '';
  const emailOk = b.is_public && b.position !== 'monitor';
  // With a card on This week's asks (a hearing in the next 7 days), the ask, its link and its message are copied there, the
  // share tools' one home (V20, F132); otherwise this tab keeps Copy share link (F125). Email: the composer's one door, so
  // someone who may not send sees "Ask Kevin to email followers" rather than a door that refuses them (X23).
  const card = askCardHref(b);
  // The public's response and the share kit come first: on a phone they were 4,277px down a 4,718px page, and a hearing
  // day's job is to share, not to edit (R-152 C). v4 (R-269): on a laptop too (Saya: Copy share link was 2.3 screens down,
  // under the editor); "Write it" on Today still lands on the ask below it (?focus=ask, wirePublic).
  const spread = `<section class="bw-sec bw-pblk bw-kit" aria-labelledby="bw-spread-h">
    <h2 class="bw-h2" id="bw-spread-h">Share kit</h2>
    <p class="bw-resp">${respWords(b) ? `${icon('users')}<span>${esc(respWords(b))}.${DEMO ? ' <span class="bw-quiet">(sample numbers)</span>' : ''}${!((publicResponse(b) || {}).people >= 10) ? ' <span class="bw-quiet">Actions show from 10 people.</span>' : ''}</span>` : `${icon('users')}<span class="bw-quiet">No public counts yet: actions are counted from 10 people.</span>`}</p>
    <div class="bw-acts bw-spreadacts">${card ? btn('This week’s ask card', { kind: 'secondary', sm: true, icon: 'megaphone', href: card })
      : listed ? `${btn('Copy link', { kind: 'secondary', sm: true, icon: 'link', attrs: { 'data-kit': 'link' } })}${btn('Copy a ready message', { kind: 'secondary', sm: true, icon: 'message-square', attrs: { 'data-kit': 'msg' } })}` : ''}${emailOk ? emailDoor({ bill: b }, { kind: 'secondary', sm: true })
      : btn('Email followers', { kind: 'secondary', sm: true, icon: 'mail', attrs: { 'data-email': '1', 'aria-disabled': 'true' } })}</div>
    <p class="bw-quiet">${[listed ? '' : 'Make it public to get its share link.', emailOk ? 'Someone who approves emails checks it before it sends.' : b.position === 'monitor' ? 'Monitor bills get no supporter emails. Take a position first.' : ''].filter(Boolean).join(' ')}</p>
  </section>`;
  return `${spread}<section class="bw-sec bw-pub bw-pblk" aria-labelledby="bw-pub-h">
    <h2 class="bw-h2" id="bw-pub-h">On the public page</h2>
    <p class="bw-pubnow${warn ? ' warn' : ''}">${icon(live ? 'globe' : warn ? 'triangle-alert' : 'eye-off')}<span><b>Now:</b> ${esc(pubStateText(b))}${pubLink}</span></p>
    <div class="bw-pubcols">
    <form class="bw-pubform" data-pubform novalidate>
      ${switchRow('bw-ispub', 'Show on the public page', valOf(b, 'is_public'))}
      <div class="field"><label for="bw-nick">Nickname</label>
        <input id="bw-nick" type="text" maxlength="40" autocomplete="off" value="${esc(nickname)}" aria-describedby="bw-nick-n" placeholder="Disposable e-cigarette ban">${count(nickname.length, 'bw-nick-n', 40)}</div>
      <div class="field"><label for="bw-psum">Public summary</label>
        <textarea id="bw-psum" maxlength="280" rows="3" aria-describedby="bw-psum-n" placeholder="One sentence a neighbor would understand. No jargon, no bill numbers.">${esc(sum)}</textarea>${count(sum.length, 'bw-psum-n')}</div>
      ${card ? `<div class="field bw-askro"><p class="bw-asklabel">The ask</p>
        <p class="bw-asktext">${ask ? esc(ask) : '<span class="bw-quiet">Not written yet.</span>'}</p>
        <p class="bw-askgo">${icon('megaphone')}<a href="${esc(card)}">Change it on This week’s asks</a></p>
        <input id="bw-pact" type="hidden" value="${esc(ask)}"><input id="bw-puntil" type="hidden" value="${esc(valOf(b, 'public_action_until'))}"><span id="bw-pact-n" hidden></span><span id="bw-puntil-w" hidden></span></div>`
      : `<div class="field"><label for="bw-pact">The ask</label>
        <textarea id="bw-pact" maxlength="280" rows="3" aria-describedby="bw-pact-n" placeholder="What should someone do today? Leave it blank and the hearing itself is the ask.">${esc(ask)}</textarea>${count(ask.length, 'bw-pact-n')}</div>
      <div class="field"><label for="bw-puntil">Show the ask through</label>
        <input id="bw-puntil" type="date" value="${esc(valOf(b, 'public_action_until'))}" aria-describedby="bw-puntil-w">
        <span class="help bw-untilwarn" id="bw-puntil-w" role="status">${esc(untilWarn(b, ask, valOf(b, 'public_action_until')))}</span></div>`}
      ${reachNote(b)}
      <div class="field"><label for="bw-ptp">Talking points for testimony</label>
        <textarea id="bw-ptp" rows="5" aria-describedby="bw-ptp-h bw-ptp-n" placeholder="One point per line, up to five.">${esc(valOf(b, 'talking_points'))}</textarea>
        <span class="help" id="bw-ptp-h">People writing testimony tap these into a letter sent in their own name, so keep them true.${b.talking_points?.length && !b.talking_points_edited_at ? ' <b>Drafted by Claude from the bill’s record: please check them.</b>' : ''}</span>
        <span class="help bw-count" id="bw-ptp-n" aria-live="polite">${pointsCount(valOf(b, 'talking_points'))}</span></div>
      <div id="bw-perr" role="alert"></div>
      <div class="bw-acts bw-pubsave">${btn('Save public page', { kind: 'primary', icon: 'check', attrs: { type: 'submit' } })}${dirty(b) ? '<span class="small muted">Not saved yet</span>' : ''}</div>
    </form>
    <div class="bw-prev" role="group" aria-labelledby="bw-prev-h">
      <p class="bw-prevh" id="bw-prev-h">How the public page shows it</p>
      <div data-prev>${previewInner(b, valuesOf(b))}</div>
    </div>
    </div>
    ${draftsSection(b)}
  </section>
  ${whereBlock(b, listed)}`;
}

export function wirePublic(pnl, b, { focusAsk = false } = {}) {
  wireDraftsFocus(pnl, b);
  // The share kit (R-117): the bill's share page, or the ask with the next deadline and the link.
  pnl.querySelectorAll('[data-kit]').forEach(el => el.onclick = async () => {
    const kit = shareKit(b, hearingAhead(b)), text = el.dataset.kit === 'link' ? kit.link : kit.message;
    try { await navigator.clipboard.writeText(text); toast(el.dataset.kit === 'link' ? 'Share link copied. Paste it into a text, an email or a post.' : 'Message copied. Paste it into a text, an email or a post, and change anything you like.', { ok: true }); }
    catch { toast('Could not copy. Select the text and copy it yourself: ' + text); }
  });
  const form = pnl.querySelector('[data-pubform]'), key = b.id + ':pub';
  const f = { is_public: form.querySelector('#bw-ispub'), nickname: form.querySelector('#bw-nick'), public_summary: form.querySelector('#bw-psum'), public_action: form.querySelector('#bw-pact'), public_action_until: form.querySelector('#bw-puntil'), talking_points: form.querySelector('#bw-ptp') };
  const errBox = form.querySelector('#bw-perr');
  const note = () => { const d = {}; for (const k of FIELDS) { const v = BOOL.has(k) ? f[k].checked : f[k].value; if (v !== saved(b, k)) d[k] = v; }
    if (Object.keys(d).length) { if (!bases.has(key)) bases.set(key, rawOf(b)); drafts.set(key, d); } else { drafts.delete(key); bases.delete(key); }
    const s = form.querySelector('.bw-pubsave'), hint = s.querySelector('.small');
    if (Object.keys(d).length && !hint) s.insertAdjacentHTML('beforeend', '<span class="small muted">Not saved yet</span>'); else if (!Object.keys(d).length && hint) hint.remove(); };
  const prev = pnl.querySelector('[data-prev]');
  const paint = () => { if (prev) prev.innerHTML = previewInner(b, { is_public: f.is_public.checked, nickname: f.nickname.value, public_summary: f.public_summary.value, public_action: f.public_action.value, public_action_until: f.public_action_until.value }); };
  for (const [k, el] of Object.entries(f)) el.addEventListener(BOOL.has(k) ? 'change' : 'input', () => {
    note(); paint(); errBox.innerHTML = ''; f.public_action_until.removeAttribute('aria-invalid'); f.nickname.removeAttribute('aria-invalid');
    if (k === 'public_summary' || k === 'public_action') form.querySelector(`#${el.id}-n`).textContent = countText(el.value.length);
    form.querySelector('#bw-puntil-w').textContent = untilWarn(b, f.public_action.value, f.public_action_until.value);
    if (k === 'nickname') form.querySelector('#bw-nick-n').textContent = countText(el.value.length, 40);
    if (k === 'talking_points') { form.querySelector('#bw-ptp-n').textContent = pointsCount(el.value); el.removeAttribute('aria-invalid'); }
  });
  form.onsubmit = async e => {
    e.preventDefault();
    const action = f.public_action.value.trim(), until = f.public_action_until.value;
    // An ask without a date, or with one already past, never shows (public_bills requires public_action_until >= today).
    // Refuse rather than save something that looks published and is not.
    const bad = action && !until ? 'An ask needs a date, or it never shows. Pick the last day it should show.'
      : action && until < hiToday() ? `That date has passed (${dayOf(until)}), so the ask would not show. Pick a later one.` : '';
    // The database wants a nickname of 3 to 60 characters; the field stops at 40 so it fits one line on a phone.
    const nickname = f.nickname.value.trim().replace(/\s+/g, ' ');
    if (nickname && nickname.length < 3) { errBox.innerHTML = `<p class="inlinemsg">${icon('circle-alert')}A nickname needs at least 3 characters.</p>`; f.nickname.setAttribute('aria-invalid', 'true'); f.nickname.focus(); return; }
    const pts = pointsIn(f.talking_points.value), long = pts.findIndex(p => p.length > 200);
    const ptBad = pts.length > 5 ? `Up to five talking points. There are ${pts.length}: take some out.` : long >= 0 ? `Point ${long + 1} is ${pts[long].length} characters. Keep each one under 200.` : '';
    if (ptBad) { errBox.innerHTML = `<p class="inlinemsg">${icon('circle-alert')}${esc(ptBad)}</p>`; f.talking_points.setAttribute('aria-invalid', 'true'); f.talking_points.focus(); return; }
    if (bad) { errBox.innerHTML = `<p class="inlinemsg">${icon('circle-alert')}${esc(bad)}</p>`; f.public_action_until.setAttribute('aria-invalid', 'true'); f.public_action_until.focus(); return; }
    const sub = form.querySelector('[type="submit"]'); sub.setAttribute('aria-busy', 'true');
    // Only what changed is written, compared with what the form held when editing began, and a teammate's newer save of the
    // same field is shown to the person before anything is written (R-152 B; DB.saveBillFields).
    const base = bases.get(key) || rawOf(b);
    const ptsChanged = JSON.stringify(pts) !== JSON.stringify(base.talking_points || []);
    const want = { nickname: nickname || null, public_summary: f.public_summary.value.trim() || null, public_action: action || null, public_action_until: until || null, is_public: f.is_public.checked,
      ...(ptsChanged ? { talking_points: pts.length ? pts : null, talking_points_edited_at: new Date().toISOString() } : {}) };
    const finish = res => {
      drafts.delete(key); bases.delete(key); FACTS.clear(); rerender('.bw-pubsave .btn');
      if (!res.changed.length) { toast('Nothing to save: this already matches what is saved.'); return; }
      toast('Public page saved.', { ok: true, undo: async () => { await DB.updateBill(b.id, res.prev); drafts.delete(key); bases.delete(key); FACTS.clear(); rerender('.bw-pubsave .btn'); toast('Put back as it was.'); } });
    };
    try {
      const res = await DB.saveBillFields(b.id, want, base);
      if (!res.conflicts.length) { finish(res); return; }
      sub.removeAttribute('aria-busy');
      const bad = new Set(res.conflicts.map(c => c.key));
      askConflict({ fields: res.conflicts.map(c => ({ label: LABEL[c.key] || c.key, theirs: asText(c.theirs), mine: asText(c.mine) })),
        keepTheirs: async () => { try { finish(await DB.saveBillFields(b.id, Object.fromEntries(Object.entries(want).filter(([k]) => !bad.has(k) && !(k === 'talking_points_edited_at' && bad.has('talking_points')))), base, { force: true })); } catch (x) { toast(x, { err: true }); } },
        replace: async () => { try { finish(await DB.saveBillFields(b.id, want, base, { force: true })); } catch (x) { toast(x, { err: true }); } } });
    } catch (x) { sub.removeAttribute('aria-busy'); toast(x, { err: true }); }
  };
  // "Write it" on Today lands here: the ask is in view, right under the pinned tabs, with the cursor in it (the way
  // ?reply=1 opens Activity at the message box). Focus now, inside the tap, so a phone raises its keyboard; scroll on
  // the next paint, after the frame has put the new page at its top.
  if (focusAsk) {
    const ta = f.public_action, fld = ta.closest('.field');
    ta.focus({ preventScroll: true }); try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch { /* ignore */ }
    S.scrollClaimed = true;   // app.js's popstate restore would otherwise scroll back to the top after this (X10-3)
    // The page draws again once its data is in (the drafts, the counts), so the box measured here may be gone by the next paint:
    // look it up again each time, and place it three times in the first half second (X10-3: it was left at the top of the page).
    const place = () => {
      const el = document.getElementById('bw-pact'), box = el && el.closest('.field'); if (!box || !el.isConnected) return;
      const top = box.getBoundingClientRect().top + window.scrollY, desk = matchMedia('(min-width: 900px)').matches;
      // Desktop keeps the summary above it in view (the ask is written from it); a phone gives the room to the keyboard.
      window.scrollTo(0, Math.max(0, Math.round(top - underTabs() - (desk ? 176 : 12))));
      if (document.activeElement !== el) { try { el.focus({ preventScroll: true }); } catch { /* ignore */ } }
    };
    requestAnimationFrame(place); setTimeout(place, 150); setTimeout(place, 450);
  }
  pnl.querySelectorAll('[data-list]').forEach(el => el.onclick = async () => {
    const l = (S.lists || []).find(x => String(x.id) === el.dataset.list); if (!l) return;
    if (el.getAttribute('aria-disabled') === 'true') { toast('Make it public and save first. Only public bills go on lists.'); return; }
    const on = el.getAttribute('aria-pressed') !== 'true', sel = `[data-list="${CSS.escape(String(l.id))}"]`;
    const add = async () => { const n = await DB.addListBills(l.id, [b.id]); FACTS.clear(); return n; };
    const remove = async () => { await DB.removeListBill(l.id, b.id); FACTS.clear(); };
    el.disabled = true;
    try {
      if (on) { const n = await add(); rerender(sel); if (!n) { toast('Only public bills go on lists. Make it public and save first.'); return; } }
      else { await remove(); rerender(sel); }
      toast(on ? `Added to ${l.title}.` : `Removed from ${l.title}.`, { undo: async () => { if (on) await remove(); else await add(); rerender(sel); } });
    } catch (x) { el.disabled = false; toast(x, { err: true }); }
  });
  pnl.querySelector('[data-ispick]')?.addEventListener('click', () => openIssuePicker(b, { onClose: () => rerender('[data-ispick]') }));
  pnl.querySelectorAll('[data-dredit]').forEach(el => el.onclick = () => editDraft(b, el.dataset.dredit));
  // Claude's suggestion, taken as it is (R-148): "Warn letter writers", with Undo.
  pnl.querySelectorAll('[data-drtick]').forEach(el => el.onclick = async () => { const d = (S.billDrafts[b.id] || []).find(x => x.version === el.dataset.drtick); if (!d) return;
    el.setAttribute('aria-busy', 'true');
    try { put(b, await DB.saveBillDraft(b.id, d.version, d.summary, { changes_letters: true })); rerender('[data-dredit]');
      toast('Done. People who wrote on an earlier draft are warned.', { ok: true, undo: async () => { put(b, await DB.saveBillDraft(b.id, d.version, d.summary, { changes_letters: false })); rerender(); } }); }
    catch (e) { el.removeAttribute('aria-busy'); toast(e, { err: true }); } });
  // "Looks right": a checked note becomes the team's as it stands (saved unchanged, so the drafting tool leaves it alone).
  pnl.querySelectorAll('[data-drok]').forEach(el => el.onclick = async () => { const d = (S.billDrafts[b.id] || []).find(x => x.version === el.dataset.drok); if (!d) return;
    el.setAttribute('aria-busy', 'true');
    try { put(b, await DB.saveBillDraft(b.id, d.version, d.summary)); rerender('[data-dredit]'); toast('Checked. The note is the team’s now.', { ok: true }); }
    catch (e) { el.removeAttribute('aria-busy'); toast(e, { err: true }); } });
  // "Where it shows" stays open or closed for the visit (B-6), so a list or issue change that redraws the page keeps it open.
  pnl.querySelector('#bw-where')?.addEventListener('toggle', e => { S.bwWhereOpen = e.currentTarget.open; });
  // The pre-tick saves on the switch, with Undo (v3: it left the form's one Save when it moved down here).
  const prec = pnl.querySelector('#bw-prec');
  prec?.addEventListener('change', async () => {
    const on = prec.checked, was = !!b.recommended;
    try {
      await DB.updateBill(b.id, { recommended: on }); FACTS.clear(); rerender('#bw-prec');
      toast(on ? 'Saved. New visitors find it already ticked.' : 'Saved. It is no longer pre-ticked.', { undo: async () => { await DB.updateBill(b.id, { recommended: was }); FACTS.clear(); rerender('#bw-prec'); toast('Put back as it was.'); } });
    } catch (x) { prec.checked = was; toast(x, { err: true }); }
  });
  pnl.querySelectorAll('[data-issoff]').forEach(el => el.onclick = async () => {
    const id = el.dataset.issoff, i = (S.issues || []).find(x => x.id === id); if (!i) return;
    el.disabled = true;
    try {
      await DB.setBillIssue(b.id, id, false); rerender('[data-ispick]');
      toast(`Took it off ${i.name}.`, { undo: async () => { await DB.setBillIssue(b.id, id, true); rerender('[data-ispick]'); } });
    } catch (x) { el.disabled = false; toast(x, { err: true }); }
  });
  const em = pnl.querySelector('[data-email]'); if (em) em.onclick = e => {
    if (e.currentTarget.getAttribute('aria-disabled') === 'true') { toast(b.position === 'monitor' ? 'Monitor bills get no supporter emails. Take a position first.' : 'Make it public first, then save. Only people following a public bill can get its email.'); return; }
    S.go(`#/email/new?bill=${encodeURIComponent(b.id)}`);
  };
}
