// HIPHI Staff v2: Sort new bills (#/bills/new, plan 3.5). The current app lists 25 triage rows at once, 213px each,
// with the first one 741px down a phone. Here it is one card at a time: the bill, why it was suggested, what it looks
// like from past sessions, a coalition and a position, then Track, Not for us or Later. Every decision shows a toast
// with Undo (and Open after Track). Same calls as app.js renderTriage/wireTriage: loadTriage fills S.triage from
// DB.triageQueue/triageCounts; DB.triageTrack/triageSkip/triageUndo decide. v2 also sets the position chosen on the
// card (DB.updateBill), so a tracked bill is not left half-decided.
import { S, DB, esc, advocate, SESSION_YEAR, hooks } from './data.js';
import { loadTriage, triageSeen, titleCaseHI, FACTS } from './model.js';
import { icon, btn, pickerChip, segmented, toast, pickerSheet, empty, skeleton } from './ui.js';
import { iconName } from './setup.js';

const T = () => S.triage ??= { camp: null, matchedOnly: true, rows: null, counts: null, focus: 0, last: null };
const V = () => { const t = T(); t.pick ??= {}; t.pos ??= {}; t.done ??= 0; return t; };
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

function progress(t) {
  const left = t.rows.length, capped = !!t.capped, total = left + t.done, c = t.counts || {};
  const pct = total && !capped ? Math.round(t.done / total * 100) : 0;
  const undo = t.last ? ` · <button type="button" class="linkbtn" data-tundolast>Undo ${esc(t.last.bill_number)}</button>` : '';
  return `<div class="st-prog">${capped ? '' : `<span class="st-meter" aria-hidden="true"><i style="width:${pct}%"></i></span>`}
    <p class="st-progt"><b>${capped ? `${left}+ left` : `${left} of ${total} left`}</b>${c.tracked != null ? ` · ${c.tracked} tracked` : ''}${undo}</p></div>`;
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
function card(t, r) {
  const terms = realMatches(r).real.flatMap(m => m.terms), c = campOf(t, r), own = advocate(c?.owner_id), pos = t.pos[r.id] || 'monitor';
  // Long Capitol descriptions start folded at four lines, so the coalition and position stay on a phone's first screen.
  const title = titleCaseHI(r.title || ''), long = (r.description || '').length > 200;
  return `<article class="card st-tcard" aria-labelledby="st-tnum">
    <div class="st-tl1"><h2 id="st-tnum" tabindex="-1">${esc(r.bill_number)}</h2>${(r.companions || []).length ? `<span class="chip sv-chip">Companion ${esc(r.companions.join(', '))}</span>` : ''}
      <a class="iconbtn st-cap" href="${esc(capitol(r))}" target="_blank" rel="noopener" aria-label="Read ${esc(r.bill_number)} at the Capitol (new tab)" title="Read it at the Capitol">${icon('external-link')}</a></div>
    ${title ? `<p class="st-ttitle">${mark(title, terms)}</p>` : ''}
    ${r.description ? `<p class="st-tdesc${long ? ' clamp' : ''}" id="st-tdesc">${mark(r.description, terms)}</p>${long ? btn('Read all', { kind: 'text', sm: true, iconEnd: 'chevron-down', attrs: { 'data-tmore': '1', 'aria-expanded': 'false', 'aria-controls': 'st-tdesc' } }) : ''}` : ''}
    <div class="st-whys">${why(r)}</div>
    <div class="st-tpick">
      <div class="st-pickrow"><span class="st-lab" id="st-clab">Coalition</span>${pickerChip(c?.name || 'Choose', { 'data-tcoal': '1', 'aria-describedby': 'st-clab st-cown' }, iconName(c?.icon))}<span class="small muted" id="st-cown">${own ? `${esc(own.full_name)} will own it` : 'No owner yet'}</span></div>
      <div class="st-pickrow"><span class="st-lab" id="st-plab">Our position</span>${segmented('tpos', POS, pos, 'Our position')}</div>
    </div>
  </article>`;
}

export default {
  tab: 'bills',
  tabs: false,
  title: () => 'Sort new bills',
  back: () => ({ href: '#/bills', label: 'Bills' }),
  render() {
    const t = V();
    // First visit: the explanation is open (same rule and key as app.js renderTriage), then it folds into a link.
    if (S.triageFirstVisit === undefined) { S.triageFirstVisit = !triageSeen(); try { localStorage.setItem('hiphi_triage_seen', '1'); } catch { /* private mode */ } }
    if (t.rows === null) load();
    const how = S.triageFirstVisit || t.how;
    const head = `<div class="st-head st-thead"><h1>Sort new bills</h1>${t.rows ? progress(t) : ''}</div>`;
    const filters = `<div class="st-tfilters">${pickerChip(t.camp ? campName(t) : 'All coalitions', { 'data-tcamp': '1', 'aria-label': `Coalition: ${campName(t)}. Change` }, t.camp ? iconName(S.campaigns.find(x => x.id === t.camp)?.icon) : null)}${pickerChip(t.matchedOnly ? 'Suggested bills' : 'Every undecided bill', { 'data-tmatch': '1', 'aria-label': `Showing ${t.matchedOnly ? 'suggested bills' : 'every undecided bill'}. Change` })}</div>`;
    const howBox = how ? `<div class="notice info st-how">${icon('info')}<div><p><b>Track</b> puts the bill on the tracker under the coalition you pick, with that coalition's owner, at P2, with the position you pick. <b>Not for us</b> takes it off this list for good. <b>Later</b> moves it to the back. You can undo each one.</p>${btn('Hide this', { kind: 'text', sm: true, attrs: { 'data-thow': '0' } })}</div></div>` : '';
    const foot = `<div class="btnrow st-tfoot">${how ? '' : btn('How this works', { kind: 'text', sm: true, icon: 'circle-help', attrs: { 'data-thow': '1' } })}${btn('Search all introduced bills', { kind: 'text', sm: true, icon: 'search', href: '#/search' })}</div>`;
    if (t.rows === null) return `<div class="st-page st-triage">${head}${filters}${skeleton(2)}</div>`;
    if (!t.rows.length) {
      return `<div class="st-page st-triage">${head}${filters}<div class="card st-done">${empty({ art: `<span class="st-yay" aria-hidden="true">${icon('party-popper')}</span>`, title: 'All sorted for now.',
        text: `${t.done ? `You decided ${t.done} bill${t.done === 1 ? '' : 's'} this sitting. ` : ''}${t.matchedOnly ? `Nothing suggested is waiting${t.camp ? ` for ${esc(campName(t))}` : ''}. New bills show up here as they are introduced.` : 'No undecided bills are left.'}`,
        action: `<div class="btncol">${btn('Back to bills', { href: '#/bills' })}${t.matchedOnly ? btn('Look through every undecided bill', { kind: 'text', attrs: { 'data-tall': '1' } }) : ''}</div>` })}</div>${foot}</div>`;
    }
    t.focus = Math.min(Math.max(0, t.focus), t.rows.length - 1);
    const keys = HOVER() ? `<p class="st-keys small muted">Keys: <kbd>T</kbd> track · <kbd>N</kbd> not for us · <kbd>L</kbd> later · <kbd>U</kbd> undo · arrow keys move between bills</p>` : '';
    return `<div class="st-page st-triage">${head}${filters}${card(t, t.rows[t.focus])}${keys}${howBox}${foot}</div>`;
  },
  bar() {
    const t = T(); if (!t.rows || !t.rows.length) return '';
    return `<div class="st-bar st-tbar">${btn('Later', { kind: 'text', attrs: { 'data-tlater': '1' } })}${btn('Not for us', { kind: 'secondary', attrs: { 'data-tskip': '1' } })}${btn('Track', { kind: 'primary', icon: 'check', attrs: { 'data-ttrack': '1' } })}</div>`;
  },
  wire(route, root) {
    const t = V(), r = t.rows?.[t.focus];
    const $ = s => root.querySelector(s);
    const rerender = (focusSel) => { hooks.render(); if (focusSel) document.querySelector(focusSel)?.focus({ preventScroll: true }); };
    $('[data-tcamp]') && ($('[data-tcamp]').onclick = () => pickerSheet({ title: 'Suggestions for', value: t.camp || '',
      options: [['', 'All coalitions', 'users'], ...S.campaigns.filter(x => (x.keywords || []).length).map(x => [x.id, x.name, iconName(x.icon), advocate(x.owner_id) ? `${advocate(x.owner_id).full_name} owns it` : 'No owner'])],
      onPick: v => { t.camp = v || null; t.rows = null; t.focus = 0; rerender('[data-tcamp]'); } }));
    $('[data-tmatch]') && ($('[data-tmatch]').onclick = () => pickerSheet({ title: 'Show', value: t.matchedOnly ? '1' : '0',
      options: [['1', 'Suggested bills', 'sparkles', 'A coalition keyword matches them'], ['0', 'Every undecided bill', 'list', 'Everything introduced that nobody has decided on']],
      onPick: v => { t.matchedOnly = v === '1'; t.rows = null; t.focus = 0; rerender('[data-tmatch]'); } }));
    $('[data-tall]') && ($('[data-tall]').onclick = () => { t.matchedOnly = false; t.rows = null; t.focus = 0; rerender(); });
    root.querySelectorAll('[data-thow]').forEach(b => b.onclick = () => { t.how = b.dataset.thow === '1'; if (!t.how) S.triageFirstVisit = false; rerender(t.how ? '.st-how' : '[data-thow]'); });
    $('[data-tundolast]') && ($('[data-tundolast]').onclick = () => undo(t.last));
    if (!r) return;
    $('[data-tcoal]').onclick = () => { const cur = campOf(t, r), real = realMatches(r).real;
      pickerSheet({ title: `Track ${r.bill_number} for`, value: cur?.id, help: 'The coalition\'s owner gets the bill.',
        options: S.campaigns.map(c => { const m = real.find(x => x.campaign_id === c.id), o = advocate(c.owner_id);
          return [c.id, c.name, iconName(c.icon), [m ? `Suggested: matches ${m.terms.join(', ')}` : '', o ? `${o.full_name} owns it` : 'No owner'].filter(Boolean).join(' · ')]; }),
        onPick: v => { t.pick[r.id] = v; rerender('[data-tcoal]'); } }); };
    const more = $('[data-tmore]');
    if (more) more.onclick = () => { const open = more.getAttribute('aria-expanded') !== 'true', d = $('#st-tdesc');
      d.classList.toggle('clamp', !open); more.setAttribute('aria-expanded', open); more.innerHTML = `<span>${open ? 'Show less' : 'Read all'}</span>${icon(open ? 'chevron-up' : 'chevron-down')}`; };
    root.querySelectorAll('[data-seg="tpos"]').forEach(b => b.onclick = () => { t.pos[r.id] = b.dataset.val;
      root.querySelectorAll('[data-seg="tpos"]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
    $('[data-ttrack]').onclick = () => decide('track');
    $('[data-tskip]').onclick = () => decide('skip');
    $('[data-tlater]').onclick = () => later();
  },
};

// ---- decisions ----
let busy = false;
async function decide(kind) {
  const t = V(), r = t.rows?.[t.focus]; if (!r || busy) return;
  busy = true; document.querySelectorAll('.st-tbar .btn').forEach(b => b.setAttribute('aria-disabled', 'true'));
  const idx = t.focus;
  try {
    if (kind === 'track') {
      const c = campOf(t, r), pos = t.pos[r.id] || 'monitor';
      const b = await DB.triageTrack(r, c?.id);
      // triage_track tracks at Monitor; a position picked on the card is saved straight after.
      if (b && pos !== 'monitor') await DB.updateBill(b.id, { position: pos });
      t.last = { ...r, tracked: true };
      if (t.counts) t.counts.tracked = (t.counts.tracked || 0) + 1;
      done(t, idx);
      toast(`${r.bill_number} tracked for ${c?.name || 'the tracker'}.`, { ok: true, undo: () => undo(t.last && t.last.id === r.id ? t.last : { ...r, tracked: true }, idx), action: { label: 'Open', run: () => S.go('#/bill/' + r.bill_number) } });
    } else {
      await DB.triageSkip(r);
      t.last = { ...r, tracked: false };
      done(t, idx);
      toast(`${r.bill_number} is off the list.`, { undo: () => undo(t.last && t.last.id === r.id ? t.last : { ...r, tracked: false }, idx) });
    }
  } catch (e) { toast(e, { err: true }); }
  finally { busy = false; document.querySelectorAll('.st-tbar .btn').forEach(b => b.removeAttribute('aria-disabled')); }
}
function done(t, idx) {
  t.rows.splice(idx, 1); t.done++;
  if (t.counts && t.counts.undecided) t.counts.undecided--;
  t.focus = Math.min(idx, Math.max(0, t.rows.length - 1));
  FACTS.clear();   // a tracked (or untracked) bill changes the Bills counts
  hooks.render(); window.scrollTo(0, 0);
  document.getElementById('st-tnum')?.focus({ preventScroll: true });
}
async function undo(last, idx) {
  const t = V(); if (!last) return;
  try {
    await DB.triageUndo(last);
    const { tracked, ...row } = last;
    if (t.rows && !t.rows.some(x => x.id === row.id)) { const at = Math.min(idx ?? t.focus, t.rows.length); t.rows.splice(at, 0, row); t.focus = at; t.done = Math.max(0, t.done - 1); if (t.counts) { t.counts.undecided = (t.counts.undecided || 0) + 1; if (tracked) t.counts.tracked = Math.max(0, (t.counts.tracked || 1) - 1); } }
    if (t.last?.id === row.id) t.last = null;
    FACTS.clear(); hooks.render();
    toast(`${row.bill_number} is back in the list.`);
  } catch (e) { toast(e, { err: true }); }
}
function later() {
  const t = V(); if (!t.rows || t.rows.length < 2) { toast('This is the last bill on the list.'); return; }
  const [r] = t.rows.splice(t.focus, 1); t.rows.push(r);
  if (t.focus >= t.rows.length) t.focus = 0;
  hooks.render(); window.scrollTo(0, 0);
  toast(`${r.bill_number} moved to the back.`);
}
function move(step) {
  const t = V(); if (!t.rows || t.rows.length < 2) return;
  t.focus = (t.focus + step + t.rows.length) % t.rows.length; hooks.render(); window.scrollTo(0, 0);
}

// Keys (desktop, hover-capable pointers only): T track, N not for us, L later, U undo, arrows move. The frame's
// "g then a letter" shortcuts win: a letter within 1.2s of g is theirs.
let lastG = 0;
document.addEventListener('keydown', e => {
  if (S.route?.name !== 'triage' || !HOVER()) return;
  const el = e.target, typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
  if (typing || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')) return;
  if (e.key === 'g') { lastG = Date.now(); return; }
  if (Date.now() - lastG < 1200) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k === 't') { e.preventDefault(); decide('track'); }
  else if (k === 'n') { e.preventDefault(); decide('skip'); }
  else if (k === 'l') { e.preventDefault(); later(); }
  else if (k === 'u') { e.preventDefault(); const t = V(); if (t.last) undo(t.last); }
  else if (k === 'ArrowRight' || k === 'ArrowLeft') { if (el?.closest?.('.sv-seg')) return; e.preventDefault(); move(k === 'ArrowRight' ? 1 : -1); }
});
