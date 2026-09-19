// HIPHI Staff v2 · Bill > Public (plan 3.3). What the public page says about this bill: the plain summary, the ask and
// the date it stops showing, and whether the bill is on the public page at all. These fields save together with ONE
// button, the same four fields the current app saves. Lists and the email to supporters act on their own, since each
// is its own thing (a list is a page the public follows; an email goes through approval).
import { S, DB, DEMO, esc } from './data.js';
import { FACTS, pubStateText, pubStateCls, hiToday, PUBLIC_APP } from './model.js';
import { icon, btn, toast, notice, switchRow } from './ui.js';
import { rerender, drafts, dayOf } from './bill.js';

const FIELDS = ['is_public', 'public_summary', 'public_action', 'public_action_until'];
const saved = (b, k) => k === 'is_public' ? !!b.is_public : (b[k] || '');
// Typed but unsaved values survive the re-render a list change causes; they live here until Save.
const draftOf = b => drafts.get(b.id + ':pub') || {};
const valOf = (b, k) => { const d = draftOf(b); return k in d ? d[k] : saved(b, k); };
const dirty = b => FIELDS.some(k => valOf(b, k) !== saved(b, k));
const count = (n, id) => `<span class="help bw-count" id="${id}" aria-live="polite">${n} of 280 characters</span>`;

export function renderPublic(b) {
  const cls = pubStateCls(b), live = cls.includes('live'), warn = cls.includes('warn');
  const listed = b.is_public && b.tracked !== false, sum = valOf(b, 'public_summary'), ask = valOf(b, 'public_action');
  const pubLink = live ? ` <a class="bw-inline" href="${esc(PUBLIC_APP() + (DEMO ? '?demo=1' : '') + '#/bill/' + b.bill_number)}" target="_blank" rel="noopener">See it${icon('external-link')}</a>` : '';
  const lists = S.lists || [];
  const emailOk = b.is_public && b.position !== 'monitor';
  return `<section class="bw-sec bw-pub" aria-labelledby="bw-pub-h">
    <h2 id="bw-pub-h" class="sr">Public page</h2>
    ${notice(live ? 'ok' : warn ? 'warn' : 'info', live ? 'globe' : warn ? 'triangle-alert' : 'eye-off', `<b>Now:</b> ${esc(pubStateText(b))}${pubLink}`)}
    <form class="bw-pubform" data-pubform novalidate>
      ${switchRow('bw-ispub', 'Show on the public page', valOf(b, 'is_public'), 'Anyone can find it, follow it and get its hearing alerts.')}
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
  </section>
  <section class="bw-sec" aria-labelledby="bw-lists-h">
    <h2 id="bw-lists-h">Lists</h2>
    ${!lists.length ? '<p class="small muted">No lists yet. Make one under Outreach, Lists.</p>'
      : `<p class="small muted">${listed ? 'Tap a list to add or remove this bill. It changes right away.' : 'Make it public to add it to a list: switch it on above and save.'}</p>
      <div class="chips bw-lists">${lists.map(l => { const on = (S.listBills || []).some(x => x.list_id === l.id && x.bill_id === b.id), off = !on && !listed;
        return `<button type="button" class="chip" data-list="${esc(l.id)}" aria-pressed="${on}"${off ? ' aria-disabled="true"' : ''}>${icon(on ? 'check' : 'plus')}${esc(l.title)}${l.is_published ? '' : '<span class="bw-draft">draft</span>'}</button>`; }).join('')}</div>`}
  </section>
  <section class="bw-sec" aria-labelledby="bw-mail-h">
    <h2 id="bw-mail-h">Email supporters</h2>
    <p class="small muted">${emailOk ? 'It goes to the people following this bill who asked for action alerts. Another admin approves it before it sends.' : b.position === 'monitor' ? 'Monitor bills get no action alerts. Take a position first.' : 'Make it public first. Only people following a public bill can get its email.'}</p>
    <div class="bw-acts">${btn('Email supporters about this bill', { kind: 'secondary', icon: 'mail', attrs: { 'data-email': '1', ...(emailOk ? {} : { 'aria-disabled': 'true' }) } })}</div>
  </section>`;
}

export function wirePublic(pnl, b) {
  const form = pnl.querySelector('[data-pubform]'), key = b.id + ':pub';
  const f = { is_public: form.querySelector('#bw-ispub'), public_summary: form.querySelector('#bw-psum'), public_action: form.querySelector('#bw-pact'), public_action_until: form.querySelector('#bw-puntil') };
  const errBox = form.querySelector('#bw-perr');
  const note = () => { const d = {}; for (const k of FIELDS) { const v = k === 'is_public' ? f[k].checked : f[k].value; if (v !== saved(b, k)) d[k] = v; }
    if (Object.keys(d).length) drafts.set(key, d); else drafts.delete(key);
    const s = form.querySelector('.bw-pubsave'), hint = s.querySelector('.small');
    if (Object.keys(d).length && !hint) s.insertAdjacentHTML('beforeend', '<span class="small muted">Not saved yet</span>'); else if (!Object.keys(d).length && hint) hint.remove(); };
  for (const [k, el] of Object.entries(f)) el.addEventListener(k === 'is_public' ? 'change' : 'input', () => {
    note(); errBox.innerHTML = ''; f.public_action_until.removeAttribute('aria-invalid');
    if (k === 'public_summary' || k === 'public_action') form.querySelector(`#${el.id}-n`).textContent = `${el.value.length} of 280 characters`;
  });
  form.onsubmit = async e => {
    e.preventDefault();
    const action = f.public_action.value.trim(), until = f.public_action_until.value;
    // An ask without a date, or with one already past, never shows (public_bills requires public_action_until >= today).
    // Refuse rather than save something that looks published and is not.
    const bad = action && !until ? 'An ask needs a date, or it never shows. Pick the last day it should show.'
      : action && until < hiToday() ? `That date has passed (${dayOf(until)}), so the ask would not show. Pick a later one.` : '';
    if (bad) { errBox.innerHTML = `<p class="inlinemsg">${icon('circle-alert')}${esc(bad)}</p>`; f.public_action_until.setAttribute('aria-invalid', 'true'); f.public_action_until.focus(); return; }
    const sub = form.querySelector('[type="submit"]'); sub.setAttribute('aria-busy', 'true');
    try {
      await DB.updateBill(b.id, { public_summary: f.public_summary.value.trim() || null, public_action: action || null, public_action_until: until || null, is_public: f.is_public.checked });
      drafts.delete(key); FACTS.clear(); rerender('.bw-pubsave .btn');
      toast('Public page saved.', { ok: true });
    } catch (x) { sub.removeAttribute('aria-busy'); toast(x, { err: true }); }
  };
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
  pnl.querySelector('[data-email]').onclick = e => {
    if (e.currentTarget.getAttribute('aria-disabled') === 'true') { toast(b.position === 'monitor' ? 'Monitor bills get no action alerts. Take a position first.' : 'Make it public first, then save.'); return; }
    S.go(`#/email/new?bill=${encodeURIComponent(b.id)}`);
  };
}
