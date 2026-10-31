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
// v4 (R-269): the memo for partners is "Partner update" (C-15), Outreach's second tab at #/outreach/partners: it opens on
// Partners and the viewer's coalition, under Outreach's tabs, and is no longer in Bills' "…" menu (Lauren: 4 or 5 clicks
// to it, now 2). #/bills/memo keeps working (the coalition page's "Write a partner update", the team's memo).
// v6 (R-336): #/bills/memo redirects to #/outreach/partners (spec 3.4); the update is a document in the warm look
// (supporters.css .ot-part), its bills named by number with no draft codes (D15); the team's memo is its Staff choice.
import { S, DB, esc, isMine, hooks } from './data.js';
import { memoData, billByRef, billNum } from './model.js';
import { btn, segmented, field, toast, empty, keysOn, sectionNav, whoseSeg } from './ui.js';
import { deskBack, wideNow, typingIn, myCoalitions } from './filters.js';
import { billRoute } from './model.js';

// R-277 fix 14 (U-9): the audience is "Staff", so "Team" means only everybody's work, as on every list.
const AUDIENCES = [['partners', 'Partners'], ['team', 'Staff']];   // one order wherever the memo is
// v4: Outreach's Partner update tab, as against the memo under Bills (#/bills/memo).
const onTab = route => route?.name === 'partners';
const nameOf = v => v.audience === 'partners' ? 'Partner update' : 'Weekly memo';
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
// The Partner update tab opens on Partners and on a coalition: the one chosen before, else the viewer's own: the one they
// own (Lauren, HEAL), else the one they support (Saya, CTFH). Someone who supports every coalition (Kris) gets them all.
function viewerCoalition() {
  const owned = (S.campaigns || []).find(c => S.me && c.owner_id === S.me.id), mc = [...myCoalitions()];
  return owned ? owned.id : mc.length && mc.length < (S.campaigns || []).length ? mc[0] : '';
}
function applyRoute(route) {
  const q = route?.q || {}, key = location.hash; if (key === fromRoute) return;
  fromRoute = key; const v = view(), tab = onTab(route);
  if (q.audience === 'partners' || q.audience === 'team') v.audience = q.audience;
  else if (tab) v.audience = 'partners';
  if ('coalition' in q) v.coalition = coalOf(q.coalition)?.id || '';
  else if (tab && !v.coalition) v.coalition = viewerCoalition();
}
// ?from=<coalition id> (the coalition page's "Write a partner update") or ?from=HB1780: the way back names where the
// person came from, as hearing.js's does, and is real Back when they came from inside the app (app.js). Anything else,
// or nothing, and it is Bills, as it always was.
function backOf(route) {
  const from = String(route?.q?.from || '');
  const b = from && billByRef(from);
  if (b) return { href: `${billRoute(b)}`, label: b.bill_number };
  const co = from && (S.campaigns || []).find(x => String(x.id) === from || x.slug === from);
  if (co) return { href: `#/coalition/${encodeURIComponent(co.id)}`, label: co.name };
  return null;
}
// Remember the choice, and keep the address saying what is on screen (a link someone copies opens this same memo),
// including where it was opened from, so changing the audience or the coalition never loses the way back.
// On the Partner update tab the address is #/outreach/partners, and only the team's memo says its audience.
function choose(patch) {
  const v = Object.assign(view(), patch), from = S.route?.q?.from, tab = onTab(S.route);
  const qs = new URLSearchParams(); if (v.coalition) qs.set('coalition', v.coalition); if (v.audience !== (tab ? 'partners' : 'team')) qs.set('audience', v.audience); if (from) qs.set('from', from);
  try { history.replaceState(history.state, '', (tab ? '#/outreach/partners' : '#/bills/memo') + (qs.toString() ? '?' + qs : '')); fromRoute = location.hash; } catch { /* the view still changes */ }
  DB.patchPrefs({ memo: { audience: v.audience, coalition: v.coalition } }).catch(e => toast(e, { err: true }));
  hooks.render();
}
function data() { try { return tidy(memoData()); } catch (e) { console.error(e); return null; } }

// ---- v3 (R-264): each bill once, and the position said only where it is not Support ----
// memoData (model.js) writes a line for every section a bill is in, so HB 2049 HD3 and HB 2296 HD1 were under both
// "Moving" and "Needs a hearing by Mon 3/30", and "HIPHI supports." opened some 20 lines. A bill that moved and is also
// in a section that asks for something (a hearing this week, at risk, needs a hearing, did not advance) keeps one
// line, there, with the move first: "Arrived from the House (3/12). Waiting in AEN." Any other repeat is dropped.
// "How you can help" is the public ask, a different list, and keeps its lines. The intro says once that HIPHI supports
// every bill unless its line says otherwise; a bill with no position yet says so on its line. Words from the word list
// (C-15): "did not advance", never "finished for the year"; testimony "ready to file", not "approved, not filed yet".
const ASK = /^How you can help/, PRE = /^HIPHI [^.]*\. /, SUPPORTS = 'HIPHI supports. ';
const words = t => t.replace(/approved, not filed yet/g, 'ready to file');
// v6 (R-336, D15, C-15): a bill is its number, never its draft code ("SB 3234", not "SB 3234 SD2"), in both audiences.
const noCode = n => String(n || '').replace(/\s+[HSC]D\d+\b/g, '');
function tidy(m) {
  if (!m) return m;
  const num = i => typeof i === 'string' ? '' : i.num;
  const sections = m.sections.map(([h, items]) => [h, items.map(i => typeof i === 'string' ? i : { ...i, num: noCode(i.num), text: words(i.text) })]);
  const home = new Map();   // a bill's line in a section that asks for something
  sections.forEach(([h, items]) => { if (h !== 'Moving' && !ASK.test(h)) for (const i of items) if (num(i) && !home.has(num(i))) home.set(num(i), i); });
  const mv = sections.find(([h]) => h === 'Moving');
  if (mv) mv[1] = mv[1].filter(i => { const at = home.get(num(i)); if (!at) return true;
    const p = (PRE.exec(at.text) || [''])[0]; at.text = `${p}${i.text.replace(PRE, '')} ${at.text.slice(p.length)}`; return false; });
  const seen = new Set();
  for (const sec of sections) if (!ASK.test(sec[0])) sec[1] = sec[1].filter(i => !num(i) || (seen.has(num(i)) ? false : (seen.add(num(i)), true)));
  const kept = sections.filter(([, items]) => items.some(i => typeof i !== 'string'));
  const bill = new Map(S.bills.map(b => [noCode(billNum(b).replace(/^(\D+)/, '$1 ')), b]));
  let said = 0;
  for (const [h, items] of kept) if (!ASK.test(h)) for (const i of items) { if (typeof i === 'string') continue;
    if (i.text.startsWith(SUPPORTS)) { i.text = i.text.slice(SUPPORTS.length); said++; }
    else if (!PRE.test(i.text) && !bill.get(i.num)?.position) i.text = `No position yet. ${i.text}`; }
  const intro = m.intro.replace(/finished for the year/g, 'did not advance') + (said ? ' HIPHI supports each bill below unless its line says otherwise.' : '');
  return { ...m, intro, sections: kept, empty: !kept.length };
}

// Each bill by its name first, its number after (R-271, D15), as Partners and every other v6 list says it: "Seizure of
// untaxed tobacco products (SB 3076): Heard by ...". model.js's memoHTML/memoText put the number first; the memo's own
// copies are drawn here so the preview and both copies read the same. In plain text a link goes on its own line under the
// bill; for email the bill's name is the link. A line is an object; "…and 3 more" is a plain string.
const billHead = i => i.name && i.name !== i.num ? [i.name, i.num] : [i.num, ''];
const lineText = i => { if (typeof i === 'string') return '• ' + i; const [a, b] = billHead(i); return `• ${a}${b ? ` (${b})` : ''}: ${i.text}${i.href ? `\n  ${i.href}` : ''}`; };
const lineHTML = i => { if (typeof i === 'string') return `<li>${esc(i)}</li>`; const [a, b] = billHead(i), nm = `<b>${esc(a)}</b>`;
  return `<li>${i.href ? `<a href="${esc(i.href)}" target="_blank" rel="noopener">${nm}</a>` : nm}${b ? ` (${esc(b)})` : ''}: ${esc(i.text)}</li>`; };
const memoText = m => [m.title.toUpperCase(), '', m.intro, ...m.sections.flatMap(([h, items]) => ['', h.toUpperCase(), ...items.map(lineText)]), '', `${m.foot.text} ${m.foot.href}`].join('\n');
const memoHTML = m => `<h2>${esc(m.title)}</h2><p>${esc(m.intro)}</p>${m.sections.map(([h, items]) => `<h3>${esc(h)}</h3><ul>${items.map(lineHTML).join('')}</ul>`).join('')}<p>${esc(m.foot.text)} <a href="${esc(m.foot.href)}" target="_blank" rel="noopener">${esc(m.foot.href)}</a></p>`;

const copyBtns = sm => `${btn('Copy as text', { kind: 'secondary', sm, icon: 'copy', attrs: { 'data-mcopy': 'text' } })}${btn('Copy for email', { sm, icon: 'mail', attrs: { 'data-mcopy': 'rich' } })}`;
const LEDE = {
  team: v => `This week for ${v.who === 'me' ? 'the bills you own or follow' : 'every bill with a position'}, with where our testimony stands.`,
  partners: () => 'For a coalition’s partners: HIPHI’s position on each bill, in plain words, with public links. Nothing internal.',
};

const memo = {
  tab: 'bills', tabs: false,
  narrow: true,
  title: () => nameOf(view()),
  back: route => backOf(route) || { href: '#/issues/bills', label: 'Bills' },
  render(route) {
    applyRoute(route);
    const v = view(), m = data(), wide = wideNow(), partners = v.audience === 'partners', tab = onTab(route);
    // R-277 fix 14: For: Partners / Staff, in that order wherever the memo is (it was Team / Partners under Bills).
    const auds = AUDIENCES;
    // The coalition list names each one the way the team does, with the public name partners will read beside it.
    const coal = `<select id="bl-mcoal" class="input">${[['', 'Every coalition'], ...S.campaigns.map(c => [c.id, c.public_name && c.public_name !== c.name ? `${c.name} · ${c.public_name}` : c.name])].map(([id, l]) => `<option value="${esc(id)}" ${v.coalition === id ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    return `<div class="bl-memopage${tab ? ' ot-part' : ''}">
      ${tab ? '' : deskBack('memo', backOf(route))}
      <div class="bl-mhead${tab ? ' sv-phead' : ''}"><h1 class="bl-ptitle${tab ? ' sv-h1' : ''}">${nameOf(v)}</h1>${tab ? `<span class="sv-phr">${sectionNav('outreach', 'partners')}</span>`   /* R-277 fix 10: Outreach's tabs in the heading row; the copy buttons end the row of choices below */
        : wide ? `<div class="bl-mcopy" role="group" aria-label="Copy the memo">${copyBtns(true)}</div>` : ''}</div>
      <p class="bl-lede">${esc(LEDE[partners ? 'partners' : 'team'](v))}</p>
      <div class="bl-mctl">
        <div class="bl-maud"><span class="bl-mlabel" id="bl-maud-l">For</span>${segmented('memoaud', auds, partners ? 'partners' : 'team', 'Who the memo is for')}</div>
        ${partners ? '' : `<div class="bl-mwho"><span class="bl-mlabel" id="bl-mwho-l">Whose bills</span>${whoseSeg('memowho', { mine: 'me', team: 'all' }, v.who === 'me' ? 'me' : 'all', { label: 'Whose bills' })}</div>`}
        ${field('bl-mcoal', 'Coalition', coal)}
        ${tab && wide ? `<div class="bl-mcopy ot-mcopy" role="group" aria-label="Copy the memo">${copyBtns(true)}</div>` : ''}
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
    // R-277 fix 14: Mine | Team, the words of every list (the audience beside it is now "Staff", so Team says only whose).
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
export default memo;
// v4 (R-269): Outreach > Partner update. The same page under Outreach's tabs: the sidebar and the tab bar light Outreach,
// there is no way back to name (it is a tab), and it is as wide as its sibling tabs so their tab row never moves; the
// memo keeps its reading width inside (supporters.css .ot-part).
export const partners = { ...memo, tab: 'outreach', tabs: true, narrow: false, wide: () => true, back: undefined };

// Esc goes back to Bills on a desktop, as it does on a bill's page (a shortcut, so it waits for keysOn()).
if (typeof document !== 'undefined') document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || S.route?.name !== 'memo' || !keysOn() || typingIn(e.target) || document.querySelector('dialog[open]')) return;
  const a = document.querySelector('.bl-memopage .bl-deskback'); if (a && a.offsetParent) { e.preventDefault(); a.click(); }
});
