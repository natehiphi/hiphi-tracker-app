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
import { S, DB, DEMO, esc } from './data.js';
import { FACTS, pubStateText, pubStateCls, hiToday, PUBLIC_APP } from './model.js';
import { icon, btn, toast, notice, switchRow } from './ui.js';
import { rerender, drafts, dayOf, plainTitle, underTabs } from './bill.js';
import { issuesOfBill, openIssuePicker, whyNot } from './issues.js';

const FIELDS = ['is_public', 'recommended', 'nickname', 'public_summary', 'public_action', 'public_action_until'];
const BOOL = new Set(['is_public', 'recommended']);
const saved = (b, k) => BOOL.has(k) ? !!b[k] : (b[k] || '');
// Typed but unsaved values survive the re-render a list change causes; they live here until Save.
const draftOf = b => drafts.get(b.id + ':pub') || {};
const valOf = (b, k) => { const d = draftOf(b); return k in d ? d[k] : saved(b, k); };
const dirty = b => FIELDS.some(k => valOf(b, k) !== saved(b, k));
const count = (n, id, max = 280) => `<span class="help bw-count" id="${id}" aria-live="polite">${n} of ${max} characters</span>`;

// ---- the preview (desktop, where there is room beside the form): how the public page will name this bill ----
// The public page leads with the nickname, then the summary; with no nickname the summary is the headline; with
// neither, the first sentence of the Capitol's description. "HIPHI asks" shows only while the ask has a date that
// has not passed. v holds the form's values as typed, so the card changes with every key.
const spaced = n => String(n || '').replace(/^([A-Z]+)\s*(\d)/, '$1 $2');
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

// Issues (063, R-018): the public follows issues, and a bill reaches everyone following an issue it is on. The chips are
// the issues it is on (press one to take the bill off it, with Undo); Choose opens every issue, by category.
function issuesSection(b) {
  if (!(S.categories || []).length) return '';
  const iss = issuesOfBill(b.id), why = whyNot(b);
  const say = !iss.length ? 'Put it on an issue, and everyone who follows that issue gets it.'
    : why ? `${why.replace('its followers do not', 'the people following these issues do not')}.` : 'Everyone who follows one of these issues gets this bill.';
  return `<section class="bw-sec" aria-labelledby="bw-iss-h">
    <h2 id="bw-iss-h">Issues</h2>
    <p class="small muted">${esc(say)}</p>
    <div class="chips bw-issues">${iss.map(i => `<button type="button" class="chip" data-issoff="${esc(i.id)}" aria-pressed="true" aria-label="${esc(i.name)}: on this bill. Press to take it off.">${icon('check')}${esc(i.name)}</button>`).join('')}
      ${btn(iss.length ? 'Change' : 'Choose issues', { kind: 'secondary', sm: true, icon: iss.length ? 'pencil' : 'plus', attrs: { 'data-ispick': '1', 'aria-haspopup': 'dialog' } })}</div>
  </section>`;
}

export function renderPublic(b) {
  const cls = pubStateCls(b), live = cls.includes('live'), warn = cls.includes('warn');
  const listed = b.is_public && b.tracked !== false, sum = valOf(b, 'public_summary'), ask = valOf(b, 'public_action'), nickname = valOf(b, 'nickname');
  const pubLink = live ? ` <a class="bw-inline" href="${esc(PUBLIC_APP() + (DEMO ? '?demo=1' : '') + '#/bill/' + b.bill_number)}" target="_blank" rel="noopener">See it${icon('external-link')}</a>` : '';
  const lists = S.lists || [];
  const emailOk = b.is_public && b.position !== 'monitor';
  return `<section class="bw-sec bw-pub" aria-labelledby="bw-pub-h">
    <h2 id="bw-pub-h" class="sr">Public page</h2>
    ${notice(live ? 'ok' : warn ? 'warn' : 'info', live ? 'globe' : warn ? 'triangle-alert' : 'eye-off', `<b>Now:</b> ${esc(pubStateText(b))}${pubLink}`)}
    <div class="bw-pubcols">
    <form class="bw-pubform" data-pubform novalidate>
      ${switchRow('bw-ispub', 'Show on the public page', valOf(b, 'is_public'), 'Anyone can find it, follow it and get its hearing alerts.')}
      ${switchRow('bw-prec', 'Pre-tick for new visitors', valOf(b, 'recommended'), 'Silent: new visitors find it already ticked on their first visit. Nothing on the public page says it was recommended.')}
      <div class="field"><label for="bw-nick">Nickname</label>
        <input id="bw-nick" type="text" maxlength="40" autocomplete="off" value="${esc(nickname)}" aria-describedby="bw-nick-h bw-nick-n" placeholder="Disposable vape ban">
        <span class="help" id="bw-nick-h">A short everyday name people can say. It names the bill everywhere on the public page.</span>${count(nickname.length, 'bw-nick-n', 40)}</div>
      <div class="field"><label for="bw-psum">Public summary</label>
        <textarea id="bw-psum" maxlength="280" rows="3" aria-describedby="bw-psum-n" placeholder="One sentence a neighbour would understand. No jargon, no bill numbers.">${esc(sum)}</textarea>${count(sum.length, 'bw-psum-n')}</div>
      <div class="field"><label for="bw-pact">The ask</label>
        <textarea id="bw-pact" maxlength="280" rows="3" aria-describedby="bw-pact-n" placeholder="What should someone do today? Leave it blank and the hearing itself is the ask.">${esc(ask)}</textarea>${count(ask.length, 'bw-pact-n')}</div>
      <div class="field"><label for="bw-puntil">Show the ask through</label>
        <input id="bw-puntil" type="date" value="${esc(valOf(b, 'public_action_until'))}" aria-describedby="bw-puntil-h">
        <span class="help" id="bw-puntil-h">An ask shows through this date, then stops. An ask with no date never shows.</span></div>
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
  <section class="bw-sec" aria-labelledby="bw-lists-h">
    <h2 id="bw-lists-h">Lists</h2>
    ${!lists.length ? '<p class="small muted">No lists yet. Make one under Outreach, Lists.</p>'
      : `<p class="small muted">${listed ? 'Choose a list to add or remove this bill. It changes right away.' : 'Make it public to add it to a list: switch it on above and save.'}</p>
      <div class="chips bw-lists">${lists.map(l => { const on = (S.listBills || []).some(x => x.list_id === l.id && x.bill_id === b.id), off = !on && !listed;
        return `<button type="button" class="chip" data-list="${esc(l.id)}" aria-pressed="${on}"${off ? ' aria-disabled="true"' : ''}>${icon(on ? 'check' : 'plus')}${esc(l.title)}${l.is_published ? '' : '<span class="bw-draft">draft</span>'}</button>`; }).join('')}</div>`}
  </section>
  <section class="bw-sec" aria-labelledby="bw-mail-h">
    <h2 id="bw-mail-h">Email supporters</h2>
    <p class="small muted">${emailOk ? 'It goes to the people following this bill who asked for action alerts. Another admin approves it before it sends.' : b.position === 'monitor' ? 'Monitor bills get no action alerts. Take a position first.' : 'Make it public first. Only people following a public bill can get its email.'}</p>
    <div class="bw-acts">${btn('Email supporters about this bill', { kind: 'secondary', icon: 'mail', attrs: { 'data-email': '1', ...(emailOk ? {} : { 'aria-disabled': 'true' }) } })}</div>
  </section>`;
}

export function wirePublic(pnl, b, { focusAsk = false } = {}) {
  const form = pnl.querySelector('[data-pubform]'), key = b.id + ':pub';
  const f = { is_public: form.querySelector('#bw-ispub'), recommended: form.querySelector('#bw-prec'), nickname: form.querySelector('#bw-nick'), public_summary: form.querySelector('#bw-psum'), public_action: form.querySelector('#bw-pact'), public_action_until: form.querySelector('#bw-puntil') };
  const errBox = form.querySelector('#bw-perr');
  const note = () => { const d = {}; for (const k of FIELDS) { const v = BOOL.has(k) ? f[k].checked : f[k].value; if (v !== saved(b, k)) d[k] = v; }
    if (Object.keys(d).length) drafts.set(key, d); else drafts.delete(key);
    const s = form.querySelector('.bw-pubsave'), hint = s.querySelector('.small');
    if (Object.keys(d).length && !hint) s.insertAdjacentHTML('beforeend', '<span class="small muted">Not saved yet</span>'); else if (!Object.keys(d).length && hint) hint.remove(); };
  const prev = pnl.querySelector('[data-prev]');
  const paint = () => { if (prev) prev.innerHTML = previewInner(b, { is_public: f.is_public.checked, nickname: f.nickname.value, public_summary: f.public_summary.value, public_action: f.public_action.value, public_action_until: f.public_action_until.value }); };
  for (const [k, el] of Object.entries(f)) el.addEventListener(BOOL.has(k) ? 'change' : 'input', () => {
    note(); paint(); errBox.innerHTML = ''; f.public_action_until.removeAttribute('aria-invalid'); f.nickname.removeAttribute('aria-invalid');
    if (k === 'public_summary' || k === 'public_action') form.querySelector(`#${el.id}-n`).textContent = `${el.value.length} of 280 characters`;
    if (k === 'nickname') form.querySelector('#bw-nick-n').textContent = `${el.value.length} of 40 characters`;
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
    if (bad) { errBox.innerHTML = `<p class="inlinemsg">${icon('circle-alert')}${esc(bad)}</p>`; f.public_action_until.setAttribute('aria-invalid', 'true'); f.public_action_until.focus(); return; }
    const sub = form.querySelector('[type="submit"]'); sub.setAttribute('aria-busy', 'true');
    const before = { nickname: b.nickname || null, public_summary: b.public_summary || null, public_action: b.public_action || null,
      public_action_until: b.public_action_until || null, is_public: !!b.is_public, recommended: !!b.recommended };
    try {
      await DB.updateBill(b.id, { nickname: nickname || null, public_summary: f.public_summary.value.trim() || null, public_action: action || null, public_action_until: until || null, is_public: f.is_public.checked, recommended: f.recommended.checked });
      drafts.delete(key); FACTS.clear(); rerender('.bw-pubsave .btn');
      toast('Public page saved.', { ok: true, undo: async () => { await DB.updateBill(b.id, before); drafts.delete(key); FACTS.clear(); rerender('.bw-pubsave .btn'); toast('Put back as it was.'); } });
    } catch (x) { sub.removeAttribute('aria-busy'); toast(x, { err: true }); }
  };
  // "Write it" on Today lands here: the ask is in view, right under the pinned tabs, with the cursor in it (the way
  // ?reply=1 opens Activity at the message box). Focus now, inside the tap, so a phone raises its keyboard; scroll on
  // the next paint, after the frame has put the new page at its top.
  if (focusAsk) {
    const ta = f.public_action, fld = ta.closest('.field');
    ta.focus({ preventScroll: true }); try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch { /* ignore */ }
    requestAnimationFrame(() => {
      const top = fld.getBoundingClientRect().top + window.scrollY, desk = matchMedia('(min-width: 900px)').matches;
      // Desktop keeps the summary above it in view (the ask is written from it); a phone gives the room to the keyboard.
      window.scrollTo(0, Math.max(0, Math.round(top - underTabs() - (desk ? 176 : 12))));
    });
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
