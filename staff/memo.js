// Staff v2 · Weekly memo (#/bills/memo), plan 3.10. The current app's memo (memoData, memoHTML and memoText in model.js
// write it from the data): whose bills, which coalition, a live preview, and two ways to copy. "Copy for email" keeps
// the headings, bold bill numbers and links when pasted into Gmail or Outlook.
// Build 3: the bottom bar needed 383px, so "Copy for email" was cut off on 320 to 375px phones: the two buttons now
// share the bar and shrink (no icons on the narrowest screens). On a desktop the memo is a document: a reading column
// (the frame's `narrow`), a link back to Bills, and the copy buttons beside the title at the top of the page (that row
// stays under the header while the memo scrolls, so they are always in reach), not a bar detached at the bottom.
// R-022 (wave 3 #19): an Audience choice. "Team" is the memo as it was, with our testimony in plain words; "Partners"
// can be sent to a coalition as it is (see model.js). Audience and coalition follow the person between laptop and
// phone (advocates.prefs.memo, B-6), and a link can set both: #/bills/memo?coalition=<id or slug>&audience=partners.
import { S, DB, esc, isMine, hooks } from './data.js';
import { memoData, memoHTML, memoText } from './model.js';
import { btn, segmented, field, toast, empty, keysOn } from './ui.js';
import { deskBack, wideNow, typingIn, myCoalitions } from './filters.js';

const AUDIENCES = [['team', 'Team'], ['partners', 'Partners']];
const coalOf = x => x ? S.campaigns.find(c => c.id === x || c.slug === x) : null;
// Where the memo starts: what the person chose last time; else their own bills (or everyone's, for someone with none
// of their own, like Kris and Saya), for the team, and the one coalition they support if there is exactly one.
function initial() {
  const p = S.me?.prefs?.memo || {}, mc = [...myCoalitions()];
  const coalition = 'coalition' in p ? (coalOf(p.coalition)?.id || '') : mc.length === 1 ? mc[0] : '';
  return { who: S.bills.some(isMine) ? 'me' : 'all', audience: p.audience === 'partners' ? 'partners' : 'team', coalition };
}
const view = () => S.memoView ??= initial();
// A link's choices hold for the visit they open; the person's own choice is what is remembered.
let fromRoute = '';
function applyRoute(route) {
  const q = route?.q || {}, key = location.hash; if (key === fromRoute) return;
  fromRoute = key; const v = view();
  if (q.audience === 'partners' || q.audience === 'team') v.audience = q.audience;
  if ('coalition' in q) v.coalition = coalOf(q.coalition)?.id || '';
}
// ?from=<coalition id> (the coalition page's "Write a partner update") or ?from=HB1780: the way back names where the
// person came from, as hearing.js's does, and is real Back when they came from inside the app (app.js). Anything else,
// or nothing, and it is Bills, as it always was.
function backOf(route) {
  const from = String(route?.q?.from || '');
  const b = from && S.bills.find(x => x.bill_number === from.replace(/\s/g, '').toUpperCase());
  if (b) return { href: `#/bill/${encodeURIComponent(b.bill_number)}`, label: b.bill_number };
  const co = from && (S.campaigns || []).find(x => String(x.id) === from || x.slug === from);
  if (co) return { href: `#/coalition/${encodeURIComponent(co.id)}`, label: co.name };
  return null;
}
// Remember the choice, and keep the address saying what is on screen (a link someone copies opens this same memo),
// including where it was opened from, so changing the audience or the coalition never loses the way back.
function choose(patch) {
  const v = Object.assign(view(), patch), from = S.route?.q?.from;
  const qs = new URLSearchParams(); if (v.coalition) qs.set('coalition', v.coalition); if (v.audience === 'partners') qs.set('audience', 'partners'); if (from) qs.set('from', from);
  try { history.replaceState(history.state, '', '#/bills/memo' + (qs.toString() ? '?' + qs : '')); fromRoute = location.hash; } catch { /* the view still changes */ }
  DB.patchPrefs({ memo: { audience: v.audience, coalition: v.coalition } }).catch(e => toast(e, { err: true }));
  hooks.render();
}
function data() { try { return memoData(); } catch (e) { console.error(e); return null; } }

const copyBtns = sm => `${btn('Copy as text', { kind: 'secondary', sm, icon: 'copy', attrs: { 'data-mcopy': 'text' } })}${btn('Copy for email', { sm, icon: 'mail', attrs: { 'data-mcopy': 'rich' } })}`;
const LEDE = {
  team: v => `This week for ${v.who === 'me' ? 'the bills you own or follow' : 'every bill with a position'}, with where our testimony stands.`,
  partners: () => 'For a coalition’s partners: HIPHI’s position on each bill, in plain words, with public links. Nothing internal.',
};

export default {
  tab: 'bills', tabs: false,
  narrow: true,
  title: () => 'Weekly memo',
  back: route => backOf(route) || { href: '#/bills', label: 'Bills' },
  render(route) {
    applyRoute(route);
    const v = view(), m = data(), wide = wideNow(), partners = v.audience === 'partners';
    // The coalition list names each one the way the team does, with the public name partners will read beside it.
    const coal = `<select id="bl-mcoal" class="input">${[['', 'Every coalition'], ...S.campaigns.map(c => [c.id, c.public_name && c.public_name !== c.name ? `${c.name} · ${c.public_name}` : c.name])].map(([id, l]) => `<option value="${esc(id)}" ${v.coalition === id ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    return `<div class="bl-memopage">
      ${deskBack('memo', backOf(route))}
      <div class="bl-mhead"><h1 class="bl-ptitle">Weekly memo</h1>${wide ? `<div class="bl-mcopy" role="group" aria-label="Copy the memo">${copyBtns(true)}</div>` : ''}</div>
      <p class="bl-lede">${esc(LEDE[partners ? 'partners' : 'team'](v))}</p>
      <div class="bl-mctl">
        <div class="bl-maud"><span class="bl-mlabel" id="bl-maud-l">For</span>${segmented('memoaud', AUDIENCES, partners ? 'partners' : 'team', 'Who the memo is for')}</div>
        ${partners ? '' : `<div class="bl-mwho"><span class="bl-mlabel" id="bl-mwho-l">Whose bills</span>${segmented('memowho', [['me', 'Your bills'], ['all', 'Everyone’s']], v.who === 'me' ? 'me' : 'all', 'Whose bills')}</div>`}
        ${field('bl-mcoal', 'Coalition', coal)}
      </div>
      <article class="card bl-memo${partners ? ' bl-mpart' : ''}" aria-label="Memo preview">${m ? memoHTML(m) + (m.empty ? '<p class="bl-quiet">A quiet week for these bills: no hearings, no floor votes and no deadline in sight.</p>' : '')
        : empty({ title: 'The memo could not be written', text: 'Something in the data stopped it. Try the other choices, or tell Nate.', h: 'h2' })}</article>
    </div>`;
  },
  // Phones: the two buttons are the page's bottom bar, sharing its width. Desktop: they are in the page (above).
  bar: () => wideNow() ? '' : `<div class="bl-mbar">${copyBtns(false)}</div>`,
  wire(route, root) {
    const v = view();
    const seg = (name, key) => root.querySelectorAll(`[data-seg="${name}"]`).forEach(el => el.onclick = () => {
      if (v[key] === el.dataset.val) return;
      choose({ [key]: el.dataset.val });
      document.querySelector(`[data-seg="${name}"][data-val="${el.dataset.val}"]`)?.focus();
    });
    seg('memoaud', 'audience');
    // "Whose bills" is the team's choice for this visit (a partner memo is always the coalition's); it is not remembered.
    root.querySelectorAll('[data-seg="memowho"]').forEach(el => el.onclick = () => { if (v.who === el.dataset.val) return; v.who = el.dataset.val; hooks.render(); root.querySelector(`[data-seg="memowho"][data-val="${v.who}"]`)?.focus(); });
    const sel = root.querySelector('#bl-mcoal'); if (sel) sel.onchange = () => { choose({ coalition: sel.value }); document.querySelector('#bl-mcoal')?.focus(); };
    root.querySelectorAll('[data-mcopy]').forEach(el => el.onclick = async () => {
      const m = data(); if (!m) return toast('The memo could not be written, so there is nothing to copy.', { err: true });
      const text = memoText(m);
      if (el.dataset.mcopy === 'rich' && window.ClipboardItem && navigator.clipboard?.write) {
        try { await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([memoHTML(m)], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })]); return toast('Copied with formatting. Paste it into an email.', { ok: true }); }
        catch { /* some browsers refuse rich copy: fall through to plain text */ }
      }
      try { await navigator.clipboard.writeText(text); toast(el.dataset.mcopy === 'rich' ? 'Copied as plain text. This browser would not copy the formatting.' : 'Copied as plain text.', { ok: true }); }
      catch { toast('This browser would not copy. Select the memo and copy it by hand.', { err: true }); }
    });
  },
};

// Esc goes back to Bills on a desktop, as it does on a bill's page (a shortcut, so it waits for keysOn()).
if (typeof document !== 'undefined') document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || S.route?.name !== 'memo' || !keysOn() || typingIn(e.target) || document.querySelector('dialog[open]')) return;
  const a = document.querySelector('.bl-memopage .bl-deskback'); if (a && a.offsetParent) { e.preventDefault(); a.click(); }
});
