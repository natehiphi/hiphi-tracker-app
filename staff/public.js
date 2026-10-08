// HIPHI Staff v2 · Bill > Public (plan 3.3). What the public page says about this bill: the nickname, the plain summary, the ask
// and the date it stops showing, and whether the bill is on the public page at all. These fields save together with ONE
// button, the same fields the current app saves. Issues, lists and the email to supporters act on their own, since each
// is its own thing (an issue is what the public follows, R-018; a list is a page the public follows; an email goes
// through approval).
// Desktop (build 3): the form stays a readable column, and where the column has room a small card beside it shows,
// as you type, how the public page will name the bill (nickname, summary, the ask).
// The staff "recommended" flag lives here now, as "Pre-tick for new visitors" (R-022 #13). Nate: "the language shouldn't
// be so transparent to the public at the moment. It should be a silent recommendation." So it is labelled for staff by
// what it does, and the preview never shows it: nothing on the public page says a bill was recommended.
// Saving has Undo (B-5): the whole form goes back to what it was before the save.
// Talking points (084, R-068, 9/28): one box, one point per line. The public testimony walkthrough offers them to people on
// HIPHI's side, who tap them into a letter sent under their own name. Claude drafted the first 248; a save here marks them
// as the team's (talking_points_edited_at), so a later draft run never overwrites them.
import { S, DB, DEMO, esc } from './data.js';
import { FACTS, pubStateText, pubStateCls, hiToday, PUBLIC_APP, publicWords, shareKit, hearingAhead, askReach } from './model.js';
import { icon, btn, iconBtn, toast, notice, switchRow, openSheet, closeSheet } from './ui.js';
import { rerender, drafts, dayOf, plainTitle, underTabs } from './bill.js';
import { issuesOfBill, openIssuePicker, whyNot, stanceChip, pickStance } from './issues.js';
import { billRoute } from './model.js';
import { askConflict } from './conflict.js';

const FIELDS = ['is_public', 'recommended', 'nickname', 'public_summary', 'public_action', 'public_action_until', 'talking_points'];
const BOOL = new Set(['is_public', 'recommended']);
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
const count = (n, id, max = 280) => `<span class="help bw-count" id="${id}" aria-live="polite">${n} of ${max} characters</span>`;

// ---- the preview (desktop, where there is room beside the form): how the public page will name this bill ----
// The public page leads with the nickname, then the summary; with no nickname the summary is the headline; with
// neither, the first sentence of the Capitol's description. "HIPHI asks" shows only while the ask has a date that
// has not passed. v holds the form's values as typed, so the card changes with every key.
const spaced = n => String(n || '').replace(/^([A-Z]+)\s*(\d)/, '$1 $2');
// X10-3: where the ask will reach people, under the ask's date, in words (and, once the hearing alert has gone, the way to send it now).
function reachNote(b) {
  const r = askReach(b);
  return `<div class="bw-reach" role="note"><p class="small"><b>Where this ask reaches people:</b> ${r.lines.map(esc).join(' ')}</p>${r.again ? `<div class="btnrow">${btn('Send it as a supporter email', { kind: 'secondary', sm: true, icon: 'mail', href: `#/email/new?bill=${encodeURIComponent(b.id)}` })}</div>` : ''}</div>`;
}
function previewInner(b, v) {
  const nick = v.nickname.trim().replace(/\s+/g, ' '), sum = v.public_summary.trim(), ask = v.public_action.trim(), until = v.public_action_until;
  const first = (/^(.{20,220}?[.!?])(\s|$)/.exec(String(b.description || '').trim()) || [])[1];
  const name = nick || sum || first || `A bill about ${plainTitle(b).replace(/^./, c => c.toLowerCase())}`;
  const askOn = ask && until && until >= hiToday();
  const note = !v.is_public ? [ 'eye-off', 'Hidden. Nobody sees this until it is switched on and saved.' ]
    : !ask ? ['info', 'No ask: the next hearing is what people are asked to act on.']
    : !until ? ['triangle-alert', 'The ask needs a date, or it never shows.']
    : until < hiToday() ? ['triangle-alert', 'That date has passed, so the ask does not show.']
    : ['calendar-days', `The ask shows through ${dayOf(until)}.`];
  return `<div class="card bw-prevcard${v.is_public ? '' : ' off'}">
      <p class="bw-pnum">${esc(spaced(b.bill_number))}</p>
      <p class="bw-pname${nick ? '' : ' bw-long'}">${esc(name)}</p>
      ${nick && sum ? `<p class="bw-plede">${esc(sum)}</p>` : ''}
      ${ask ? `<p class="bw-pask${askOn ? '' : ' off'}">${icon('megaphone')}<span><b>HIPHI asks:</b> ${esc(ask)}</span></p>` : ''}
    </div>
    <p class="bw-pnote">${icon(note[0])}<span>${esc(note[1])}</span></p>`;
}
const valuesOf = b => Object.fromEntries(FIELDS.map(k => [k, valOf(b, k)]));

// Issues (063, R-018): the public follows issues, and a bill reaches everyone following an issue it is on. One row per
// issue it is on: its name (to the issue's page), HIPHI's stance on the issue (094, R-093: Nate wanted to change it from
// the bill page too; the same chip as on the issue's page) and × to take the bill off it, with Undo. Choose opens every
// issue, by category.
function issuesSection(b) {
  if (!(S.categories || []).length) return '';
  const iss = issuesOfBill(b.id), why = whyNot(b);
  const say = !iss.length ? 'Put it on an issue, and everyone who follows that issue gets it.'
    : why ? `${why.replace('its followers do not', 'the people following these issues do not')}.` : 'Everyone who follows one of these issues gets this bill.';
  // Said once, here: the chip with each issue is HIPHI's stance on the issue, not this bill's position (its Position chip).
  const also = iss.length ? ' Each shows HIPHI’s stance on the issue as a whole.' : '';
  return `<section class="bw-sec" aria-labelledby="bw-iss-h">
    <h2 id="bw-iss-h">Issues</h2>
    <p class="small muted">${esc(say + also)}</p>
    ${iss.length ? `<ul class="bw-isslist">${iss.map(i => `<li class="bw-issrow"><a class="bw-issname" href="#/issue/${encodeURIComponent(i.id)}">${esc(i.name)}</a>
      ${stanceChip(i, { 'data-isstance': i.id })}${iconBtn('x', `Take it off ${i.name}`, { 'data-issoff': i.id })}</li>`).join('')}</ul>` : ''}
    <div class="chips bw-issues">${btn(iss.length ? 'Change issues' : 'Choose issues', { kind: 'secondary', sm: true, icon: iss.length ? 'pencil' : 'plus', attrs: { 'data-ispick': '1', 'aria-haspopup': 'dialog' } })}</div>
  </section>`;
}

// ---- what each draft changed (R-060, migration 120): the notes the public page shows under "How it has changed" ----
// Claude drafts them from the committee reports (backend tools/apply_draft_notes.js); a note still in Claude's words says
// so, so someone checks it. Edit opens the note in a sheet; Save has Undo. The current draft with no note gets "Add".
// R-148 (migration 124): staff tick a draft that changes what people should say. People who testified on an earlier draft
// then get an amber "Read this before you send" when they send their letter again, with the line written here for them.
// Claude may suggest the tick when it drafts the note; only staff's tick reaches the public.
const DRAFT_WORD = { HD: 'House draft', SD: 'Senate draft', CD: 'Conference committee draft', FD: 'Floor draft' };
const draftName = v => { const m = /^(HD|SD|CD|FD)(\d+)$/.exec(v || ''); return m ? `${DRAFT_WORD[m[1]]} ${m[2]} (${v})` : v; };
const draftRank = (b, v) => { const m = /^(HD|SD|CD|FD)(\d+)$/.exec(v || '') || []; const own = (b.bill_number || '')[0] === 'S' ? ['SD', 'HD'] : ['HD', 'SD'];
  return ({ [own[0]]: 0, [own[1]]: 1, FD: 2, CD: 3 }[m[1]] ?? 4) * 100 + (+m[2] || 0); };
function loadDrafts(b) {
  if ((S.billDrafts ??= {})[b.id] !== undefined) return;
  S.billDrafts[b.id] = null;
  DB.billDrafts(b.id).then(rows => { S.billDrafts[b.id] = rows; rerender(); }).catch(() => { S.billDrafts[b.id] = []; });
}
function draftsSection(b) {
  loadDrafts(b);
  // Up to the bill's current draft, as on the public page (the practice copy is frozen in March).
  const cur = b.current_version, upto = cur ? draftRank(b, cur) : Infinity;
  const rows = (S.billDrafts[b.id] || []).filter(d => draftRank(b, d.version) <= upto).sort((x, y) => draftRank(b, y.version) - draftRank(b, x.version));
  const missing = cur && /^(HD|SD|CD|FD)\d+$/.test(cur) && !rows.some(d => d.version === cur);
  if (!rows.length && !missing) return '';
  return `<section class="bw-sec" aria-labelledby="bw-dr-h">
    <h2 id="bw-dr-h">What each draft changed</h2>
    <p class="small muted">The public page shows these under “How it has changed”, newest first, one or two plain sentences each.</p>
    ${rows.length ? `<ul class="bw-drlist" role="list">${rows.map(d => `<li class="bw-drrow"><div class="bw-drbody"><b>${esc(draftName(d.version))}</b>
      <span>${esc(d.summary)}</span>${d.written_by === 'staff' ? '' : '<span class="small muted">Drafted by Claude from the committee report: please check it.</span>'}
      ${d.changes_letters ? `<span class="bw-drbig">${icon('triangle-alert')}<span><b>People who wrote on an earlier draft are warned</b>${d.letter_note ? `, with HIPHI’s advice: “${esc(d.letter_note)}”` : '.'}</span></span>`
        : d.changes_suggested ? `<span class="bw-drsug">${icon('sparkles')}<span>Claude suggests warning people who wrote on an earlier draft${d.letter_note ? `: “${esc(d.letter_note)}”` : '.'}</span></span>` : ''}
      ${d.source_url ? `<a class="small bw-inline" href="${esc(d.source_url)}" target="_blank" rel="noopener">Committee report${icon('external-link')}</a>` : ''}</div>
      <div class="bw-dracts">${d.changes_suggested && !d.changes_letters ? btn('Warn letter writers', { kind: 'text', sm: true, icon: 'triangle-alert', attrs: { 'data-drtick': d.version, 'aria-label': `Warn people who wrote on a draft before ${draftName(d.version)}` } }) : ''}
      ${d.written_by === 'staff' ? '' : btn('Note is right', { kind: 'text', sm: true, icon: 'check', attrs: { 'data-drok': d.version, 'aria-label': `The note on ${draftName(d.version)} is right` } })}
      ${btn('Edit', { kind: 'text', sm: true, icon: 'pencil', attrs: { 'data-dredit': d.version, 'aria-label': `Edit the note on ${draftName(d.version)}`, 'aria-haspopup': 'dialog' } })}</div></li>`).join('')}</ul>` : ''}
    ${missing ? `<div class="bw-acts">${btn(`Add a note on ${draftName(cur)}`, { kind: 'secondary', sm: true, icon: 'plus', attrs: { 'data-dredit': cur, 'aria-haspopup': 'dialog' } })}</div>` : ''}
  </section>`;
}
function editDraft(b, version) {
  const d = (S.billDrafts[b.id] || []).find(x => x.version === version), before = d ? d.summary : '';
  const was = { changes_letters: !!d?.changes_letters, letter_note: d?.letter_note || '' };
  openSheet({ title: `What ${draftName(version)} changed`, size: 'auto',
    body: `${d?.source_url ? `<p class="small"><a class="bw-inline" href="${esc(d.source_url)}" target="_blank" rel="noopener">Read the committee report${icon('external-link')}</a></p>` : ''}<div class="field"><label for="bw-drtxt">In plain words</label><textarea id="bw-drtxt" rows="4" maxlength="600" aria-describedby="bw-drtxt-h">${esc(before)}</textarea>
      <span class="help" id="bw-drtxt-h">One or two sentences a neighbour would understand, from the committee’s report: what this draft added, took out or changed.</span><div id="bw-drerr" role="alert"></div></div>
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
export function renderPublic(b) {
  const cls = pubStateCls(b), live = cls.includes('live'), warn = cls.includes('warn');
  const listed = b.is_public && b.tracked !== false, sum = valOf(b, 'public_summary'), ask = valOf(b, 'public_action'), nickname = valOf(b, 'nickname');
  const pubLink = live ? ` <a class="bw-inline" href="${esc(PUBLIC_APP() + (DEMO ? '?demo=1' : '') + billRoute(b))}" target="_blank" rel="noopener">See it${icon('external-link')}</a>` : '';
  const lists = S.lists || [];
  const emailOk = b.is_public && b.position !== 'monitor';
  // On a phone the public's response and the share kit come first: they were 4,277px down a 4,718px page, and a hearing day's
  // job is to share, not to edit (R-152 C). A laptop keeps them where they were, beside the form's neighbours.
  const wide = matchMedia('(min-width: 900px)').matches;
  const respSec = `  <section class="bw-sec" aria-labelledby="bw-resp-h">
    <h2 id="bw-resp-h">The public's response</h2>
    <p class="small">${publicWords(b) ? `${icon('users')} ${esc(publicWords(b))}.` : 'No one from the public has followed or acted on this bill yet.'} ${DEMO ? '<span class="muted">(sample numbers in the sandbox)</span>' : '<span class="muted">Counts only, from people with accounts; never who.</span>'}</p>
    ${listed ? `<p class="small muted">The share kit: the link previews with the bill's name in a text or a post; the message carries the ask and the next deadline.</p>
    <div class="bw-acts">${btn('Copy share link', { kind: 'secondary', icon: 'link', attrs: { 'data-kit': 'link' } })}${btn('Copy a ready message', { kind: 'secondary', icon: 'message-square', attrs: { 'data-kit': 'msg' } })}</div>` : '<p class="small muted">Make it public to get its share link.</p>'}
  </section>`;
  return `${wide ? '' : respSec}<section class="bw-sec bw-pub" aria-labelledby="bw-pub-h">
    <h2 id="bw-pub-h" class="sr">Public page</h2>
    ${notice(live ? 'ok' : warn ? 'warn' : 'info', live ? 'globe' : warn ? 'triangle-alert' : 'eye-off', `<b>Now:</b> ${esc(pubStateText(b))}${pubLink}`)}
    <div class="bw-pubcols">
    <form class="bw-pubform" data-pubform novalidate>
      ${switchRow('bw-ispub', 'Show on the public page', valOf(b, 'is_public'), 'Anyone can find it, follow it and get its hearing alerts.')}
      ${switchRow('bw-prec', 'Pre-tick for new visitors', valOf(b, 'recommended'), 'Silent: new visitors find it already ticked on their first visit. Nothing on the public page says it was recommended.')}
      <div class="field"><label for="bw-nick">Nickname</label>
        <input id="bw-nick" type="text" maxlength="40" autocomplete="off" value="${esc(nickname)}" aria-describedby="bw-nick-h bw-nick-n" placeholder="Disposable e-cigarette ban">
        <span class="help" id="bw-nick-h">A short everyday name people can say. It names the bill everywhere on the public page.</span>${count(nickname.length, 'bw-nick-n', 40)}</div>
      <div class="field"><label for="bw-psum">Public summary</label>
        <textarea id="bw-psum" maxlength="280" rows="3" aria-describedby="bw-psum-n" placeholder="One sentence a neighbour would understand. No jargon, no bill numbers.">${esc(sum)}</textarea>${count(sum.length, 'bw-psum-n')}</div>
      <div class="field"><label for="bw-pact">The ask</label>
        <textarea id="bw-pact" maxlength="280" rows="3" aria-describedby="bw-pact-n" placeholder="What should someone do today? Leave it blank and the hearing itself is the ask.">${esc(ask)}</textarea>${count(ask.length, 'bw-pact-n')}</div>
      <div class="field"><label for="bw-puntil">Show the ask through</label>
        <input id="bw-puntil" type="date" value="${esc(valOf(b, 'public_action_until'))}" aria-describedby="bw-puntil-h bw-puntil-w">
        <span class="help" id="bw-puntil-h">An ask shows through this date, then stops. An ask with no date never shows.</span>
        <span class="help bw-untilwarn" id="bw-puntil-w" role="status">${esc(untilWarn(b, ask, valOf(b, 'public_action_until')))}</span></div>
      ${reachNote(b)}
      <div class="field"><label for="bw-ptp">Talking points for testimony</label>
        <textarea id="bw-ptp" rows="5" aria-describedby="bw-ptp-h bw-ptp-n" placeholder="One point per line, up to five.">${esc(valOf(b, 'talking_points'))}</textarea>
        <span class="help" id="bw-ptp-h">One plain sentence per line. People writing testimony tap these into a letter sent in their own name, so keep them true.${b.talking_points?.length && !b.talking_points_edited_at ? ' <b>Drafted by Claude from the bill’s record: please check them.</b>' : ''}</span>
        <span class="help bw-count" id="bw-ptp-n" aria-live="polite">${pointsCount(valOf(b, 'talking_points'))}</span></div>
      <div id="bw-perr" role="alert"></div>
      <div class="bw-acts bw-pubsave">${btn('Save public page', { kind: 'primary', icon: 'check', attrs: { type: 'submit' } })}${dirty(b) ? '<span class="small muted">Not saved yet</span>' : ''}</div>
    </form>
    <div class="bw-prev" role="group" aria-labelledby="bw-prev-h">
      <p class="bw-eyebrow" id="bw-prev-h">Preview of the public page</p>
      <div data-prev>${previewInner(b, valuesOf(b))}</div>
    </div>
    </div>
  </section>
  ${issuesSection(b)}
  ${draftsSection(b)}
  <section class="bw-sec" aria-labelledby="bw-lists-h">
    <h2 id="bw-lists-h">Lists</h2>
    ${!lists.length ? '<p class="small muted">No lists yet. Make one under Outreach, Lists.</p>'
      : `<p class="small muted">${listed ? 'Choose a list to add or remove this bill. It changes right away.' : 'Make it public to add it to a list: switch it on above and save.'}</p>
      <div class="chips bw-lists">${lists.map(l => { const on = (S.listBills || []).some(x => x.list_id === l.id && x.bill_id === b.id), off = !on && !listed;
        return `<button type="button" class="chip" data-list="${esc(l.id)}" aria-pressed="${on}"${off ? ' aria-disabled="true"' : ''}>${icon(on ? 'check' : 'plus')}${esc(l.title)}${l.is_published ? '' : '<span class="bw-draft">draft</span>'}</button>`; }).join('')}</div>`}
  </section>
  ${wide ? respSec : ''}
  <section class="bw-sec" aria-labelledby="bw-mail-h">
    <h2 id="bw-mail-h">Email supporters</h2>
    <p class="small muted">${emailOk ? 'It goes to the people following this bill who asked for action alerts. Someone else who approves emails checks it before it sends.' : b.position === 'monitor' ? 'Monitor bills get no action alerts. Take a position first.' : 'Make it public first. Only people following a public bill can get its email.'}</p>
    <div class="bw-acts">${btn('Email supporters about this bill', { kind: 'secondary', icon: 'mail', attrs: { 'data-email': '1', ...(emailOk ? {} : { 'aria-disabled': 'true' }) } })}</div>
  </section>`;
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
  const f = { is_public: form.querySelector('#bw-ispub'), recommended: form.querySelector('#bw-prec'), nickname: form.querySelector('#bw-nick'), public_summary: form.querySelector('#bw-psum'), public_action: form.querySelector('#bw-pact'), public_action_until: form.querySelector('#bw-puntil'), talking_points: form.querySelector('#bw-ptp') };
  const errBox = form.querySelector('#bw-perr');
  const note = () => { const d = {}; for (const k of FIELDS) { const v = BOOL.has(k) ? f[k].checked : f[k].value; if (v !== saved(b, k)) d[k] = v; }
    if (Object.keys(d).length) { if (!bases.has(key)) bases.set(key, rawOf(b)); drafts.set(key, d); } else { drafts.delete(key); bases.delete(key); }
    const s = form.querySelector('.bw-pubsave'), hint = s.querySelector('.small');
    if (Object.keys(d).length && !hint) s.insertAdjacentHTML('beforeend', '<span class="small muted">Not saved yet</span>'); else if (!Object.keys(d).length && hint) hint.remove(); };
  const prev = pnl.querySelector('[data-prev]');
  const paint = () => { if (prev) prev.innerHTML = previewInner(b, { is_public: f.is_public.checked, nickname: f.nickname.value, public_summary: f.public_summary.value, public_action: f.public_action.value, public_action_until: f.public_action_until.value }); };
  for (const [k, el] of Object.entries(f)) el.addEventListener(BOOL.has(k) ? 'change' : 'input', () => {
    note(); paint(); errBox.innerHTML = ''; f.public_action_until.removeAttribute('aria-invalid'); f.nickname.removeAttribute('aria-invalid');
    if (k === 'public_summary' || k === 'public_action') form.querySelector(`#${el.id}-n`).textContent = `${el.value.length} of 280 characters`;
    form.querySelector('#bw-puntil-w').textContent = untilWarn(b, f.public_action.value, f.public_action_until.value);
    if (k === 'nickname') form.querySelector('#bw-nick-n').textContent = `${el.value.length} of 40 characters`;
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
    const want = { nickname: nickname || null, public_summary: f.public_summary.value.trim() || null, public_action: action || null, public_action_until: until || null, is_public: f.is_public.checked, recommended: f.recommended.checked,
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
  pnl.querySelectorAll('[data-isstance]').forEach(el => el.onclick = () => {
    const i = (S.issues || []).find(x => x.id === el.dataset.isstance);
    if (i) pickStance(i, { bill: b, after: () => rerender(`[data-isstance="${CSS.escape(i.id)}"]`) });
  });
  pnl.querySelectorAll('[data-issoff]').forEach(el => el.onclick = async () => {
    const id = el.dataset.issoff, i = (S.issues || []).find(x => x.id === id); if (!i) return;
    el.disabled = true;
    try {
      await DB.setBillIssue(b.id, id, false); rerender('[data-ispick]');
      toast(`Took it off ${i.name}.`, { undo: async () => { await DB.setBillIssue(b.id, id, true); rerender('[data-ispick]'); } });
    } catch (x) { el.disabled = false; toast(x, { err: true }); }
  });
  pnl.querySelector('[data-email]').onclick = e => {
    if (e.currentTarget.getAttribute('aria-disabled') === 'true') { toast(b.position === 'monitor' ? 'Monitor bills get no action alerts. Take a position first.' : 'Make it public first, then save.'); return; }
    S.go(`#/email/new?bill=${encodeURIComponent(b.id)}`);
  };
}
