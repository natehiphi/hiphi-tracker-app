// HIPHI Staff v2: Sort new bills (#/bills/new, plan 3.5). The current app lists 25 triage rows at once, 213px each,
// with the first one 741px down a phone. Here it is one card at a time: the bill, why it was suggested, what it looks
// like from past sessions, a coalition and a position, then Track, Not for us or Later. Every decision shows a toast
// with Undo (and Open after Track). Same calls as app.js renderTriage/wireTriage: loadTriage fills S.triage from
// DB.triageQueue/triageCounts; DB.triageTrack/triageSkip/triageUndo decide. v2 also sets the position chosen on the
// card (DB.updateBill), so a tracked bill is not left half-decided.
// Build 3 (the assessment, 9/19): a typed sentence tracked five bills and Undo reached only the last one. The fast keys
// stay, and now (a) every decision goes on a stack: U undoes them one after another, newest first, and "Recent
// decisions" lists the last ten with an Undo each; (b) the keys wait for keysOn() (My settings can switch shortcuts
// off); (c) they act only from the page itself, never while a button, a link, a field or a toast's button has the focus.
// On a desktop the page is two columns: the bill with its full text on the left, and a panel that stays in view on the
// right (coalition, position, Track / Not for us / Later, progress, recent decisions) instead of a bottom bar.
import { S, DB, esc, advocate, SESSION_YEAR, hooks } from './data.js';
import { loadTriage, triageSeen, titleCaseHI, FACTS } from './model.js';
import { icon, btn, pickerChip, segmented, toast, pickerSheet, empty, skeleton, keysOn, POS_WORD } from './ui.js';
import { iconName } from './setup.js';
import { deskBack } from './filters.js';

const T = () => S.triage ??= { camp: null, matchedOnly: true, rows: null, counts: null, focus: 0, last: null };
const V = () => { const t = T(); t.pick ??= {}; t.pos ??= {}; t.done ??= 0; t.hist ??= []; return t; };
const DESK = () => { try { return matchMedia('(min-width: 900px)').matches; } catch { return false; } };
// Keyboard hints and keys only where there is a mouse to hover with (never on touch screens, plan 3.5).
const HOVER = () => { try { return matchMedia('(hover: hover) and (pointer: fine)').matches; } catch { return false; } };
const POS = [['support', 'Support'], ['oppose', 'Oppose'], ['monitor', 'Monitor']];
const POS_PAST = { strongly_support: 'strongly supported', support: 'supported', support_amend: 'supported with amendments', strongly_oppose: 'strongly opposed', oppose: 'opposed', neutral: 'commented on', monitor: 'monitored' };
const capitol = r => `https://www.capitol.hawaii.gov/session/measure_indiv.aspx?billtype=${encodeURIComponent(r.bill_number.replace(/\d+/, ''))}&billnumber=${encodeURIComponent(r.bill_number.replace(/\D+/, ''))}&year=${SESSION_YEAR}`;

// ---- keyword matches on word boundaries (plan 5: "aina" must not light up inside "Sustainable"). A keyword may be a
// fragment that starts a word ("fluorid" finds "fluoridation"), so the match runs on to the end of that word.
// The ʻokina is a letter to Unicode, so it is left out of "the character before" to let "ʻaina" match "aina". ----
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const LEAD = '(?<![\\p{Ll}\\p{Lu}\\p{Lt}\\p{Lo}\\p{N}])';
const wordRe = (terms, flags = 'iu') => new RegExp(`${LEAD}(?:${terms.map(reEsc).sort((a, b) => b.length - a.length).join('|')})[\\p{L}\\p{N}]*`, flags);
const textOf = r => `${r.title || ''} ${r.description || ''}`;
const MEMO = new WeakMap();
// Matches whose keywords really appear as words; the server's (substring) matches that do not are kept apart.
function realMatches(r) {
  if (MEMO.has(r)) return MEMO.get(r);
  const txt = textOf(r), real = [], loose = [];
  for (const m of r.matches || []) { const terms = (m.terms || []).filter(k => k && wordRe([k]).test(txt)); if (terms.length) real.push({ ...m, terms }); else loose.push(m); }
  const out = { real, loose }; MEMO.set(r, out); return out;
}
function mark(text, terms) {
  if (!terms.length || !text) return esc(text || '');
  const re = wordRe(terms, 'giu'); let out = '', i = 0;
  for (const m of text.matchAll(re)) { out += esc(text.slice(i, m.index)) + `<mark>${esc(m[0])}</mark>`; i = m.index + m[0].length; }
  return out + esc(text.slice(i));
}
// The coalition to preselect: the one last session's look-alike was tracked under, else the first real keyword match.
function suggested(r) {
  if (r.lookalike?.coalition) { const c = S.campaigns.find(x => x.name === r.lookalike.coalition); if (c) return c; }
  const m = realMatches(r).real[0]; if (m) { const c = S.campaigns.find(x => x.id === m.campaign_id); if (c) return c; }
  return S.campaigns.find(c => c.name === 'General HIPHI') || S.campaigns[0];
}
const campOf = (t, r) => S.campaigns.find(c => c.id === t.pick[r.id]) || suggested(r);
// Real suggestions first, then look-alikes, then bills whose keyword only sat inside another word.
const order = rows => rows.map((r, i) => [r, i]).sort(([a, i], [b, j]) => {
  const rank = r => realMatches(r).real.length ? 0 : r.lookalike ? 1 : 2; return rank(a) - rank(b) || i - j; }).map(([r]) => r);

function load() {
  if (S.st2TriageBusy) return; S.st2TriageBusy = true;
  // The queue comes back capped at 400 (app.js asks for p_limit 400); remember that, so the count says "400+".
  loadTriage().then(() => { const t = T(); if (t.rows) { t.capped = t.rows.length >= 400; t.rows = order(t.rows); } })
    .finally(() => { S.st2TriageBusy = false; if (S.route?.name === 'triage') hooks.render(); });
}
const campName = t => t.camp ? (S.campaigns.find(x => x.id === t.camp)?.name || 'this coalition') : 'all coalitions';

// The queue comes back capped at 400, so "400+ left" barely moved as bills were decided. When the list is the whole
// session's (no coalition picked), the server's own count says how many are really left.
const isSuggested = r => (r.matches || []).length > 0;
function leftOf(t) {
  const c = t.counts || {}, n = t.rows.length;
  const known = t.capped && !t.camp ? (t.matchedOnly ? c.suggested : c.undecided) : null;
  return known != null && known >= n ? { n: known, exact: true } : { n, exact: !t.capped };
}
function progress(t) {
  const left = leftOf(t), total = left.n + t.done, c = t.counts || {};
  const pct = total && left.exact ? Math.round(t.done / total * 100) : 0;
  // The meter shows only where a decision moves it (a 788-bill queue would sit at 0% all morning; the count says more).
  return `<div class="st-prog">${left.exact && total <= 200 ? `<span class="st-meter" role="img" aria-label="${pct}% of this list decided"><i style="width:${pct}%"></i></span>` : ''}
    <p class="st-progt"><b>${left.exact ? left.n.toLocaleString() : left.n + '+'} left</b>${t.done ? ` · ${t.done} decided this sitting` : ''}${c.tracked != null ? ` · ${c.tracked.toLocaleString()} tracked` : ''}</p></div>`;
}
// The last ten decisions, newest first, each with its own Undo (U takes the newest).
const HIST_WORD = { track: h => `Tracked for ${h.camp || 'the tracker'}${h.pos && h.pos !== 'monitor' ? ` · ${POS_WORD[h.pos] || h.pos}` : ''}`, skip: () => 'Not for us', later: () => 'Moved to the back' };
function recent(t) {
  const rows = t.hist.slice(0, 10), more = t.hist.length - rows.length;
  return `<section class="st-recent" aria-labelledby="st-rech"><h2 class="st-rech" id="st-rech">Recent decisions</h2>
    ${rows.length ? `<ul class="st-reclist">${rows.map(h => `<li><span class="st-recb"><span class="st-rect"><b>${esc(h.row.bill_number)}</b> ${esc(titleCaseHI(h.row.title || '').replace(/^Relating to /i, '').replace(/\.$/, ''))}</span><span>${esc(HIST_WORD[h.kind](h))}</span></span>${btn('Undo', { kind: 'text', sm: true, icon: 'undo-2', attrs: { 'data-tundo': h.key, 'aria-label': `Undo ${h.row.bill_number}: ${HIST_WORD[h.kind](h)}` } })}</li>`).join('')}</ul>${more > 0 ? `<p class="st-recmore">and ${more} earlier. Undo works back through all of them.</p>` : ''}`
      : '<p class="st-recnone">Nothing decided yet. Each decision shows here with its own Undo.</p>'}</section>`;
}
function why(r) {
  const { real, loose } = realMatches(r), out = [];
  if (real.length) out.push(`<p class="st-why">${icon('sparkles')}<span>Why it's suggested: matches ${real.map(m => `${m.terms.map(k => `<b>${esc(k)}</b>`).join(', ')} for ${esc(m.name)}`).join('; ')}</span></p>`);
  else if (loose.length) out.push(`<p class="st-why">${icon('sparkles')}<span>Suggested for ${esc(loose[0].name)} because of "${esc(loose[0].terms[0])}", but only inside another word.</span></p>`);
  const l = r.lookalike;
  if (l) out.push(`<p class="st-why">${icon('history')}<span>Looks like <b>${esc(l.bill_number)}</b> (${esc(l.session_year)})${l.position ? `, which we ${esc(POS_PAST[l.position] || 'tracked')}` : ''}${l.coalition ? ` under ${esc(l.coalition)}` : ''}${l.priority ? `, P${esc(l.priority)}` : ''}</span></p>`);
  if (!out.length) out.push(`<p class="st-why muted">${icon('circle-dashed')}<span>No coalition keyword matches this bill.</span></p>`);
  return out.join('');
}
const pickers = (t, r) => { const c = campOf(t, r), own = advocate(c?.owner_id), pos = t.pos[r.id] || 'monitor';
  return `<div class="st-tpick">
      <div class="st-pickrow"><span class="st-lab" id="st-clab">Coalition</span>${pickerChip(c?.name || 'Choose', { 'data-tcoal': '1', 'aria-describedby': 'st-clab st-cown' }, iconName(c?.icon))}<span class="small muted" id="st-cown">${own ? `${esc(own.full_name)} will own it` : 'No owner yet'}</span></div>
      <div class="st-pickrow"><span class="st-lab" id="st-plab">Our position</span>${segmented('tpos', POS, pos, 'Our position')}</div>
    </div>`; };
const decideBtns = () => `${btn('Track', { kind: 'primary', sm: true, icon: 'check', attrs: { 'data-ttrack': '1' } })}${btn('Not for us', { kind: 'secondary', sm: true, attrs: { 'data-tskip': '1' } })}${btn('Later', { kind: 'text', sm: true, attrs: { 'data-tlater': '1' } })}`;
const keysLine = () => HOVER() && keysOn() ? `<p class="st-keys small muted"><kbd>T</kbd> track · <kbd>N</kbd> not for us · <kbd>L</kbd> later · <kbd>U</kbd> undo · arrow keys move between bills</p>` : '';
function card(t, r, desk) {
  const terms = realMatches(r).real.flatMap(m => m.terms);
  // Phones: long Capitol descriptions start folded at four lines, so the coalition and position stay on the first
  // screen. Desktop: the whole text shows (the decision sits beside it, not under it).
  const title = titleCaseHI(r.title || ''), long = !desk && (r.description || '').length > 200;
  return `<article class="card st-tcard" aria-labelledby="st-tnum">
    <div class="st-tl1"><h2 id="st-tnum" tabindex="-1">${esc(r.bill_number)}</h2>${(r.companions || []).length ? `<span class="chip sv-chip">Companion ${esc(r.companions.join(', '))}</span>` : ''}
      <a class="iconbtn st-cap" href="${esc(capitol(r))}" target="_blank" rel="noopener" aria-label="Read ${esc(r.bill_number)} at the Capitol (new tab)" title="Read it at the Capitol">${icon('external-link')}</a></div>
    ${title ? `<p class="st-ttitle">${mark(title, terms)}</p>` : ''}
    ${r.description ? `<p class="st-tdesc${long ? ' clamp' : ''}" id="st-tdesc">${mark(r.description, terms)}</p>${long ? btn('Read all', { kind: 'text', sm: true, iconEnd: 'chevron-down', attrs: { 'data-tmore': '1', 'aria-expanded': 'false', 'aria-controls': 'st-tdesc' } }) : ''}` : ''}
    <div class="st-whys">${why(r)}</div>
    ${desk ? '' : pickers(t, r)}
  </article>`;
}

export default {
  tab: 'bills',
  tabs: false,
  // Between 900 and 1099px the frame's page is a 720px column, too narrow for the bill and the panel side by side;
  // `wide` frees the page and the CSS caps it again at the frame's usual 1120px.
  wide: () => true,
  title: () => 'Sort new bills',
  back: () => ({ href: '#/bills', label: 'Bills' }),
  render() {
    const t = V(), desk = DESK();
    // First visit: the explanation is open (same rule and key as app.js renderTriage), then it folds into a link.
    if (S.triageFirstVisit === undefined) { S.triageFirstVisit = !triageSeen(); try { localStorage.setItem('hiphi_triage_seen', '1'); } catch { /* private mode */ } }
    if (t.rows === null) load();
    const how = S.triageFirstVisit || t.how;
    const head = `${deskBack('triage')}<div class="st-head st-thead"><h1>Sort new bills</h1>${t.rows && !desk ? progress(t) : ''}</div>`;
    const filters = `<div class="st-tfilters">${pickerChip(t.camp ? campName(t) : 'All coalitions', { 'data-tcamp': '1', 'aria-label': `Coalition: ${campName(t)}. Change` }, t.camp ? iconName(S.campaigns.find(x => x.id === t.camp)?.icon) : null)}${pickerChip(t.matchedOnly ? 'Suggested bills' : 'Every undecided bill', { 'data-tmatch': '1', 'aria-label': `Showing ${t.matchedOnly ? 'suggested bills' : 'every undecided bill'}. Change` })}</div>`;
    const howBox = how ? `<div class="notice info st-how">${icon('info')}<div><p><b>Track</b> puts the bill on the tracker under the coalition you pick, with that coalition's owner, at P2, with the position you pick. <b>Not for us</b> takes it off this list for good. <b>Later</b> moves it to the back. You can undo each one.</p>${btn('Hide this', { kind: 'text', sm: true, attrs: { 'data-thow': '0' } })}</div></div>` : '';
    const foot = `<div class="btnrow st-tfoot">${how ? '' : btn('How this works', { kind: 'text', sm: true, icon: 'circle-help', attrs: { 'data-thow': '1' } })}${btn('Search all introduced bills', { kind: 'text', sm: true, icon: 'search', href: '#/search' })}</div>`;
    const cls = `st-page st-triage${desk ? ' st-tdesk' : ''}`;
    if (t.rows === null) return `<div class="${cls}">${head}${filters}${skeleton(2)}</div>`;
    if (!t.rows.length) {
      const doneCard = `<div class="card st-done">${empty({ art: `<span class="st-yay" aria-hidden="true">${icon('party-popper')}</span>`, title: 'All sorted for now.',
        text: `${t.done ? `You decided ${t.done} bill${t.done === 1 ? '' : 's'} this sitting. ` : ''}${t.matchedOnly ? `Nothing suggested is waiting${t.camp ? ` for ${esc(campName(t))}` : ''}. New bills show up here as they are introduced.` : 'No undecided bills are left.'}`,
        action: `<div class="btncol">${btn('Back to bills', { href: '#/bills' })}${t.matchedOnly ? btn('Look through every undecided bill', { kind: 'text', attrs: { 'data-tall': '1' } }) : ''}</div>` })}</div>`;
      // The decisions just made can still be undone from here.
      return desk ? `<div class="${cls}">${head}${filters}<div class="sv-cols st-tcols"><div class="st-tmain">${doneCard}${foot}</div><aside class="sv-aside st-tside" aria-label="Your decisions">${recent(t)}</aside></div></div>`
        : `<div class="${cls}">${head}${filters}${doneCard}${t.hist.length ? recent(t) : ''}${foot}</div>`;
    }
    t.focus = Math.min(Math.max(0, t.focus), t.rows.length - 1);
    const r = t.rows[t.focus];
    if (desk) return `<div class="${cls}">${head}${filters}<div class="sv-cols st-tcols">
        <div class="st-tmain">${card(t, r, true)}${howBox}${foot}</div>
        <aside class="sv-aside st-tside" aria-label="Decide on ${esc(r.bill_number)}">
          <section class="card st-decide" aria-labelledby="st-dech"><h2 class="st-rech" id="st-dech">Decide on ${esc(r.bill_number)}</h2>${pickers(t, r)}<div class="st-dbtns">${decideBtns()}</div>${keysLine()}</section>
          <section class="st-progbox" aria-label="Progress">${progress(t)}</section>
          ${recent(t)}
        </aside></div></div>`;
    return `<div class="${cls}">${head}${filters}${card(t, r, false)}${keysLine()}${t.hist.length ? recent(t) : ''}${howBox}${foot}</div>`;
  },
  // Phones decide from a bar at the bottom; a desktop has the buttons in the side panel, next to what they decide.
  bar() {
    const t = T(); if (!t.rows || !t.rows.length || DESK()) return '';
    return `<div class="st-bar st-tbar">${btn('Later', { kind: 'text', attrs: { 'data-tlater': '1' } })}${btn('Not for us', { kind: 'secondary', attrs: { 'data-tskip': '1' } })}${btn('Track', { kind: 'primary', icon: 'check', attrs: { 'data-ttrack': '1' } })}</div>`;
  },
  wire(route, root) {
    const t = V(), r = t.rows?.[t.focus];
    const $ = s => root.querySelector(s);
    const rerender = (focusSel) => { hooks.render(); if (focusSel) document.querySelector(focusSel)?.focus({ preventScroll: true }); };
    // A mouse click leaves the focus on the page (the bill's heading), so T, N and L go on working; a keyboard
    // user's focus stays on the control they used (the keys are off while it is on a control).
    const after = (e, sel) => e && e.detail > 0 ? '#st-tnum' : sel;
    $('[data-tcamp]') && ($('[data-tcamp]').onclick = () => pickerSheet({ title: 'Suggestions for', value: t.camp || '',
      options: [['', 'All coalitions', 'users'], ...S.campaigns.filter(x => (x.keywords || []).length).map(x => [x.id, x.name, iconName(x.icon), advocate(x.owner_id) ? `${advocate(x.owner_id).full_name} owns it` : 'No owner'])],
      onPick: v => { t.camp = v || null; t.rows = null; t.focus = 0; rerender('[data-tcamp]'); } }));
    $('[data-tmatch]') && ($('[data-tmatch]').onclick = () => pickerSheet({ title: 'Show', value: t.matchedOnly ? '1' : '0',
      options: [['1', 'Suggested bills', 'sparkles', 'A coalition keyword matches them'], ['0', 'Every undecided bill', 'list', 'Everything introduced that nobody has decided on']],
      onPick: v => { t.matchedOnly = v === '1'; t.rows = null; t.focus = 0; rerender('[data-tmatch]'); } }));
    $('[data-tall]') && ($('[data-tall]').onclick = () => { t.matchedOnly = false; t.rows = null; t.focus = 0; rerender(); });
    root.querySelectorAll('[data-thow]').forEach(b => b.onclick = () => { t.how = b.dataset.thow === '1'; if (!t.how) S.triageFirstVisit = false; rerender(t.how ? '.st-how' : '[data-thow]'); });
    root.querySelectorAll('[data-tundo]').forEach(b => b.onclick = () => undoEntry(t.hist.find(h => String(h.key) === b.dataset.tundo)));
    if (!r) return;
    $('[data-tcoal]').onclick = e => { const cur = campOf(t, r), real = realMatches(r).real, back = after(e, '[data-tcoal]');
      pickerSheet({ title: `Track ${r.bill_number} for`, value: cur?.id, help: 'The coalition\'s owner gets the bill.',
        options: S.campaigns.map(c => { const m = real.find(x => x.campaign_id === c.id), o = advocate(c.owner_id);
          return [c.id, c.name, iconName(c.icon), [m ? `Suggested: matches ${m.terms.join(', ')}` : '', o ? `${o.full_name} owns it` : 'No owner'].filter(Boolean).join(' · ')]; }),
        onPick: v => { t.pick[r.id] = v; rerender(back); } }); };
    const more = $('[data-tmore]');
    if (more) more.onclick = () => { const open = more.getAttribute('aria-expanded') !== 'true', d = $('#st-tdesc');
      d.classList.toggle('clamp', !open); more.setAttribute('aria-expanded', open); more.innerHTML = `<span>${open ? 'Show less' : 'Read all'}</span>${icon(open ? 'chevron-up' : 'chevron-down')}`; };
    root.querySelectorAll('[data-seg="tpos"]').forEach(b => b.onclick = e => { t.pos[r.id] = b.dataset.val;
      root.querySelectorAll('[data-seg="tpos"]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      if (e.detail > 0) $('#st-tnum')?.focus({ preventScroll: true }); });
    $('[data-ttrack]').onclick = () => decide('track');
    $('[data-tskip]').onclick = () => decide('skip');
    $('[data-tlater]').onclick = () => later();
  },
};

// ---- decisions: each one goes on t.hist (newest first), which is what U and "Recent decisions" undo ----
let busy = false, seq = 0;
const lock = on => document.querySelectorAll('[data-ttrack], [data-tskip], [data-tlater]').forEach(b => on ? b.setAttribute('aria-disabled', 'true') : b.removeAttribute('aria-disabled'));
const count = (t, r, d, tracked) => { const c = t.counts; if (!c) return;   // keep the server's counts true as we go
  c.undecided = Math.max(0, (c.undecided || 0) + d); if (isSuggested(r)) c.suggested = Math.max(0, (c.suggested || 0) + d); if (tracked) c.tracked = Math.max(0, (c.tracked || 0) - d); };
async function decide(kind) {
  const t = V(), r = t.rows?.[t.focus]; if (!r || busy) return;
  busy = true; lock(true);
  const idx = t.focus;
  try {
    if (kind === 'track') {
      const c = campOf(t, r), pos = t.pos[r.id] || 'monitor';
      const b = await DB.triageTrack(r, c?.id);
      // triage_track tracks at Monitor; a position picked on the card is saved straight after.
      if (b && pos !== 'monitor') await DB.updateBill(b.id, { position: pos });
      const h = { key: ++seq, kind, row: r, idx, camp: c?.name || '', pos }; t.hist.unshift(h); t.last = { ...r, tracked: true };
      count(t, r, -1, true); done(t, idx);
      toast(`${r.bill_number} tracked for ${c?.name || 'the tracker'}.`, { ok: true, undo: () => undoEntry(h), action: { label: 'Open', run: () => S.go('#/bill/' + r.bill_number) } });
    } else {
      await DB.triageSkip(r);
      const h = { key: ++seq, kind: 'skip', row: r, idx }; t.hist.unshift(h); t.last = { ...r, tracked: false };
      count(t, r, -1, false); done(t, idx);
      toast(`${r.bill_number} is off the list.`, { undo: () => undoEntry(h) });
    }
  } catch (e) { toast(e, { err: true }); }
  finally { busy = false; lock(false); }
}
function done(t, idx) {
  t.rows.splice(idx, 1); t.done++;
  t.focus = Math.min(idx, Math.max(0, t.rows.length - 1));
  FACTS.clear();   // a tracked (or untracked) bill changes the Bills counts
  hooks.render(); window.scrollTo(0, 0);
  document.getElementById('st-tnum')?.focus({ preventScroll: true });
}
// Undo one decision, whichever it is in the list: the bill comes back as the card on screen, ready to decide again.
// Undos wait their turn, so pressing U quickly takes the decisions back one by one and never the same one twice.
let chain = Promise.resolve();
function undoEntry(h) { if (!h || h.queued) return chain; h.queued = true; return chain = chain.then(() => undoNow(h)).catch(() => {}); }
const undoNewest = () => undoEntry(V().hist.find(h => !h.queued));
async function undoNow(h) {
  const t = V(); if (!t.hist.includes(h)) return;
  try {
    if (h.kind === 'later') {
      const i = t.rows ? t.rows.findIndex(x => x.id === h.row.id) : -1;
      if (i >= 0) { const [row] = t.rows.splice(i, 1), at = Math.min(h.idx, t.rows.length); t.rows.splice(at, 0, row); t.focus = at; }
    } else {
      await DB.triageUndo({ ...h.row, tracked: h.kind === 'track' });
      if (t.rows && !t.rows.some(x => x.id === h.row.id)) { const at = Math.min(h.idx ?? t.focus, t.rows.length); t.rows.splice(at, 0, h.row); t.focus = at; t.done = Math.max(0, t.done - 1); count(t, h.row, 1, h.kind === 'track'); }
    }
    t.hist = t.hist.filter(x => x !== h); t.last = null;
    FACTS.clear();
    if (S.route?.name === 'triage') { hooks.render(); window.scrollTo(0, 0); document.getElementById('st-tnum')?.focus({ preventScroll: true }); }
    toast(`${h.row.bill_number} is back${h.kind === 'later' ? ' where it was' : ' in the list'}.${t.hist.length ? ` ${t.hist.length} more to undo.` : ''}`);
  } catch (e) { h.queued = false; toast(e, { err: true }); }
}
function later() {
  const t = V(); if (busy) return; if (!t.rows || t.rows.length < 2) { toast('This is the last bill on the list.'); return; }
  const idx = t.focus, [r] = t.rows.splice(idx, 1); t.rows.push(r);
  if (t.focus >= t.rows.length) t.focus = 0;
  const h = { key: ++seq, kind: 'later', row: r, idx }; t.hist.unshift(h);
  hooks.render(); window.scrollTo(0, 0);
  document.getElementById('st-tnum')?.focus({ preventScroll: true });
  toast(`${r.bill_number} moved to the back.`, { undo: () => undoEntry(h) });
}
function move(step) {
  const t = V(); if (!t.rows || t.rows.length < 2) return;
  t.focus = (t.focus + step + t.rows.length) % t.rows.length; hooks.render(); window.scrollTo(0, 0);
  document.getElementById('st-tnum')?.focus({ preventScroll: true });
}

// Keys (a keyboard and a mouse only): T track, N not for us, L later, U undo, arrows move, Esc goes back to Bills.
// They wait for keysOn(), and they act only from the page itself: when the focus is on a button, a link, a field or a
// toast's button, a letter is left alone (the assessment typed a sentence here and tracked five bills). A held key
// does not repeat a decision. The frame's "g then a letter" shortcuts win: a letter within 1.2s of g is theirs.
let lastG = 0;
const onPage = el => !el || el === document.body || el.id === 'main' || el.id === 'st-tnum';
document.addEventListener('keydown', e => {
  if (S.route?.name !== 'triage' || !keysOn() || !HOVER()) return;
  if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')) return;
  if (e.key === 'Escape') { const a = document.querySelector('.st-triage .bl-deskback'); if (a && a.offsetParent) { e.preventDefault(); a.click(); } return; }
  if (!onPage(document.activeElement) || !onPage(e.target)) return;
  if (e.key === 'g') { lastG = Date.now(); return; }
  if (Date.now() - lastG < 1200) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (e.repeat && !k.startsWith('Arrow')) return;
  if (k === 't') { e.preventDefault(); decide('track'); }
  else if (k === 'n') { e.preventDefault(); decide('skip'); }
  else if (k === 'l') { e.preventDefault(); later(); }
  else if (k === 'u') { e.preventDefault(); undoNewest(); }
  else if (k === 'ArrowRight' || k === 'ArrowLeft') { e.preventDefault(); move(k === 'ArrowRight' ? 1 : -1); }
});
