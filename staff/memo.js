// Staff v2 · Weekly memo (#/bills/memo), plan 3.10. The current app's memo, unchanged in substance (memoData,
// memoHTML and memoText in model.js write it from the data): whose bills, which coalition, a live preview, and two ways
// to copy. "Copy for email" keeps the headings and bold bill numbers when pasted into Gmail or Outlook.
import { S, esc, hooks } from './data.js';
import { memoData, memoHTML, memoText } from './model.js';
import { CHAMBER_NAME } from '../stops.js';
import { btn, segmented, field, toast, empty } from './ui.js';

// memoData's at-risk section names the chamber through CHAMBER_NAME, which model.js does not import (app.js gets it
// from stops.js). Until model.js imports it, give it the same table so the memo does not stop with an error.
if (typeof globalThis.CHAMBER_NAME === 'undefined') globalThis.CHAMBER_NAME = CHAMBER_NAME;

const view = () => S.memoView ??= { who: 'me', coalition: '' };
function data() { try { return memoData(); } catch (e) { console.error(e); return null; } }

export default {
  tab: 'bills', tabs: false,
  title: () => 'Weekly memo',
  back: () => ({ href: '#/bills', label: 'Bills' }),
  render() {
    const v = view(), m = data();
    const coal = `<select id="bl-mcoal" class="input">${[['', 'Every coalition'], ...S.campaigns.map(c => [c.id, c.name])].map(([id, l]) => `<option value="${esc(id)}" ${v.coalition === id ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    return `<div class="bl-memopage">
      <h1 class="bl-ptitle">Weekly memo</h1>
      <p class="bl-lede">This week for ${v.who === 'me' ? 'the bills you own or follow' : 'every bill with a position'}, written from the tracker. Copy it into an email.</p>
      <div class="bl-mctl">
        <div class="bl-mwho"><span class="bl-mlabel" id="bl-mwho-l">Whose bills</span>${segmented('memowho', [['me', 'Your bills'], ['all', 'Everyone’s']], v.who === 'me' ? 'me' : 'all', 'Whose bills')}</div>
        ${field('bl-mcoal', 'Coalition', coal)}
      </div>
      <article class="card bl-memo" aria-label="Memo preview">${m ? memoHTML(m) + (m.empty ? '<p class="bl-quiet">A quiet week for these bills: no hearings, no floor votes and nothing at risk in the next two weeks.</p>' : '')
        : empty({ title: 'The memo could not be written', text: 'Something in the data stopped it. Try the other choices, or tell Nate.', h: 'h2' })}</article>
    </div>`;
  },
  bar: () => `${btn('Copy as text', { kind: 'secondary', icon: 'copy', attrs: { 'data-mcopy': 'text' } })}${btn('Copy for email', { icon: 'mail', attrs: { 'data-mcopy': 'rich' } })}`,
  wire(route, root) {
    const v = view();
    root.querySelectorAll('[data-seg="memowho"]').forEach(el => el.onclick = () => { if (v.who === el.dataset.val) return; v.who = el.dataset.val; hooks.render(); root.querySelector(`[data-seg="memowho"][data-val="${v.who}"]`)?.focus(); });
    const sel = root.querySelector('#bl-mcoal'); if (sel) sel.onchange = () => { v.coalition = sel.value; hooks.render(); root.querySelector('#bl-mcoal')?.focus(); };
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
