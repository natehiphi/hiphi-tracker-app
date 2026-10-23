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
// right (position, issue, coalition, owner, Track / Not for us / Later, recent decisions) instead of a
// bottom bar.
// R-022 (wave 3 #21): the decision is the whole decision. The review found a sorted bill could not be given an owner,
// P1 or a strong position, and bills tracked under General HIPHI arrived with nobody. The panel now sets the owner
// (the coalition's owner unless you pick someone; General HIPHI and HIPHI are Nate's), P1 or P2, and any of the seven
// positions. Coalition, owner and position are pickers (the bill page's own control for a position), so every choice
// is a Tab and an arrow key away; P1 and P2 are two buttons.
// Staff v6 (R-336 V30, V19, V35, F94-F99): a page tab of Bills (billshead.js), warm and roomy. It opens on the coalitions
// the person owns or helps on, with their own count, said once with its meaning ("12 new bills match CTFH's words"); v5
// opened on All coalitions with the team's 788 beside a 5,398 elsewhere. The issue picker narrows as you type (91 issues).
// A bill with a choice takes at most 5 clicks: the position (2), the issue (2, typing is not a click), Track (1).
import { S, DB, esc, advocate, SESSION_YEAR, hooks, fmtDate, priorityOf } from './data.js';
import { loadTriage, triageSeen, titleCaseHI, FACTS, plain } from './model.js';
import { icon, btn, pickerChip, toast, pickerSheet, openSheet, closeSheet, empty, skeleton, keysOn, POS_WORD, POS_ICON, POS_SUB } from './ui.js';
import { chip, keysUsed } from './ui.js';   // R-277 fix 4 (U-8); fix 13: key hints after a key
import { iconName } from './lists.js';   // R-277 fix 15: not from setup.js, which loads only when opened
import { billsHead, sortCoalitions, coalitionWords, sortCountChanged, loadSortCount, refreshTabs } from './billshead.js';
import { suggestIssue } from './suggest_issue.js';
import { billRoute, companionsOf } from './model.js';
import { offTag, teamName, teamFirst, newOwnerTag } from './model.js';   // R-316 W28: turned-off owners

// t.camp: 'mine' (the person's own coalitions, the first view), a coalition's id, or null (all coalitions).
const T = () => { if (!S.triage) S.triage = { camp: sortCoalitions().length ? 'mine' : null, matchedOnly: true, rows: null, counts: null, focus: 0, last: null, v6: true };
  // model.js loadTriage makes S.triage first when Today's opening card reads the queue: open on the person's own once.
  if (!S.triage.v6) { S.triage.v6 = true; if (S.triage.camp == null && sortCoalitions().length) { S.triage.camp = 'mine'; S.triage.rows = null; } }
  if (S.triage.camp === 'mine' && !sortCoalitions().length) { S.triage.camp = null; S.triage.rows = null; }
  return S.triage; };
const V = () => { const t = T(); t.pick ??= {}; t.pos ??= {}; t.own ??= {}; t.iss ??= {}; t.done ??= 0; t.hist ??= []; return t; };
const DESK = () => { try { return matchMedia('(min-width: 900px)').matches; } catch { return false; } };
// Keyboard hints and keys only where there is a mouse to hover with (never on touch screens, plan 3.5).
const HOVER = () => { try { return matchMedia('(hover: hover) and (pointer: fine)').matches; } catch { return false; } };
// Every position the team takes, in the order the team reads them (the bill page's words, POS_WORD).
const POS7 = ['strongly_support', 'support', 'support_amend', 'neutral', 'oppose', 'strongly_oppose', 'monitor'];
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
// What the card says, before anyone changes it: the coalition's owner, Monitor, P2 (what triage_track sets). An owner
// picked on the card stays put when the coalition changes; one that was not picked follows the coalition.
// R-316 W50: the issue's owner first, as the issue picker promises ("Its owner leads the bill"), then the coalition's;
// an owner picked on the card is never overridden.
// R-316 W28: someone turned off cannot sign in, so they are never handed a new bill: an issue or coalition owner who is
// off is passed over (the next in line, else No owner), and the card says why ("Lauren (turned off) owns HEAL").
const onId = id => id && !offTag(id) ? id : null;
const ownIdOf = (t, r) => { const o = t.own[r.id]; return o === undefined ? (onId(issOf(t, r)?.owner_id) || onId(campOf(t, r)?.owner_id) || null) : o === 'none' ? null : o; };
const ownWhy = (t, r) => { if (t.own[r.id] !== undefined) return ''; const i = issOf(t, r), c = campOf(t, r);
  return onId(i?.owner_id) ? `Owns ${i.name}` : onId(c?.owner_id) ? `Owns ${c.name}` : offOwner(t, r); };
const offOwner = (t, r) => { const i = issOf(t, r), c = campOf(t, r), x = offTag(i?.owner_id) ? i : offTag(c?.owner_id) ? c : null;
  return x ? `${teamFirst(x.owner_id)} owns ${x.name}` : ''; };
const posOf = (t, r) => t.pos[r.id] || 'monitor';
// R-088 part 2: the issue the bill goes on with Track. The suggestion (the earlier look-alike's issue, else the words,
// staff/suggest_issue.js) is preselected; staff pick another or "No issue". Worked out once per card.
const sugOf = r => r._sug === undefined ? (r._sug = suggestIssue(r, { issues: S.issues || [], billIssues: S.billIssues || [], lookalikeId: r.lookalike?.id || null })) : r._sug;
const issOf = (t, r) => { const v = t.iss[r.id]; return v === 'none' ? null : v ? (S.issues || []).find(i => i.id === v) || null : sugOf(r)?.issue || null; };
// A bill with a hearing still ahead goes first (Z1-6: in the opening weeks a new bill with a hearing is the one with a clock on it),
// then real suggestions, then look-alikes, then bills whose keyword only sat inside another word.
export const order = rows => { const soon = new Set((S.hearings || []).filter(h => h.status === 'scheduled' && new Date(h.scheduled_at) > Date.now()).map(h => h.bill_id));
  return rows.map((r, i) => [r, i]).sort(([a, i], [b, j]) => {
    const rank = r => soon.has(r.id) ? -1 : realMatches(r).real.length ? 0 : r.lookalike ? 1 : 2; return rank(a) - rank(b) || i - j; }).map(([r]) => r); };

function load() {
  if (S.st2TriageBusy) return; S.st2TriageBusy = true;
  const t = T(), followed = DB.triageFollowed().then(rows => { T().followed = rows; }, () => { T().followed = []; });
  // "Your coalitions": each one's queue (usually one), as one list; otherwise model.js loadTriage, the queue as v5 read it.
  const queue = t.camp === 'mine'
    ? Promise.all([Promise.all(sortCoalitions().map(id => DB.triageQueue(id, t.matchedOnly))), DB.triageCounts()]).then(([lists, counts]) => {
      const seen = new Set(), rows = []; for (const l of lists) for (const r of l || []) if (!seen.has(r.id)) { seen.add(r.id); rows.push(r); }
      rows.sort((a, b) => a.bill_number.localeCompare(b.bill_number, 'en', { numeric: true }));
      Object.assign(t, { rows, counts, capped: lists.some(l => (l || []).length >= 400) }); t.focus = Math.min(t.focus, Math.max(0, rows.length - 1)); })
      .catch(e => { t.rows = []; toast('Could not load the new bills: ' + e.message, { err: true }); })
    : loadTriage().then(() => { if (t.rows) t.capped = t.rows.length >= 400; });
  Promise.all([queue.then(() => { if (t.rows) t.rows = order(t.rows); }), followed])
    .finally(() => { S.st2TriageBusy = false; if (S.route?.name === 'triage') hooks.render(); });
}
// Bills people follow on the public tracker that the team does not track (R-059, 9/26: before this the team never
// heard of them). Most followed first. "Sort it" puts one on the card, where it is decided like any new bill; one the
// team set aside is listed again only when someone followed it after that decision (migration 074). A follow kept only
// in a browser, without an account, never reaches the database, so it cannot be counted.
const people = n => `${n} ${n === 1 ? 'person follows' : 'people follow'} it`;
function followedPanel(t) {
  const onCard = t.rows?.[t.focus]?.id;
  const list = (t.followed || []).filter(r => r.id !== onCard && !S.bills.some(b => b.id === r.id));
  if (!list.length) return '';
  return `<section class="st-recent st-follow" aria-labelledby="st-folh"><h2 class="st-rech" id="st-folh">Followed on the public tracker</h2>
    <ul class="st-reclist">${list.map(r => `<li><span class="st-recb"><span class="st-rect"><b>${esc(spaced(r.bill_number))}</b> ${esc(titleCaseHI(r.title || '').replace(/^Relating to /i, '').replace(/\.$/, ''))}</span><span>${people(r.followers)}${r.set_aside_at ? ` · set aside ${esc(fmtDate(r.set_aside_at))}` : ''}</span></span>${btn('Sort it', { kind: 'secondary', sm: true, attrs: { 'data-tfol': r.id, 'aria-label': `Sort ${r.bill_number}, which ${people(r.followers).replace(/ it$/, '')}` } })}</li>`).join('')}</ul></section>`;
}
const campName = t => t.camp === 'mine' ? coalitionWords(sortCoalitions()) : t.camp ? (S.campaigns.find(x => x.id === t.camp)?.name || 'this coalition') : 'all coalitions';
const campLabel = t => t.camp === 'mine' ? (sortCoalitions().length === 1 ? `${campName(t)} (yours)` : 'Your coalitions') : t.camp ? campName(t) : 'All coalitions';
// "HB 217": a bill number as staff and chairs say it (D15), as every other v6 screen writes it
const spaced = n => String(n || '').replace(/^([A-Z]+)\s*(\d)/, '$1 $2');

// The queue comes back capped at 400, so "400+ left" barely moved as bills were decided. When the list is the whole
// session's (no coalition picked), the server's own count says how many are really left.
const isSuggested = r => (r.matches || []).length > 0;
function leftOf(t) {
  const c = t.counts || {}, n = t.rows.length;
  const known = t.capped && !t.camp ? (t.matchedOnly ? c.suggested : c.undecided) : null;
  return known != null && known >= n ? { n: known, exact: true } : { n, exact: !t.capped };
}
// The one number and what it means (V19, V35): how many bills this list holds, in words, never a second count beside it.
function number(t) {
  const left = leftOf(t), n = `${left.n.toLocaleString()}${left.exact ? '' : '+'}`, one = left.n === 1, who = campName(t);
  const whose = t.camp === 'mine' ? (/^your /.test(who) ? `the words of ${who}` : `${who}’s words`) : t.camp ? `${who}’s words` : 'a coalition’s words';
  return `<p class="st-num"><b>${n}</b> ${t.matchedOnly ? `new bill${one ? '' : 's'} ${one ? 'matches' : 'match'} ${esc(whose)}` : `bill${one ? '' : 's'} nobody has decided on`}</p>`;
}
// The last ten decisions, newest first, each with its own Undo (U takes the newest).
const HIST_WORD = { track: h => `Tracked for ${h.camp || 'the tracker'}${h.pos && h.pos !== 'monitor' ? ` · ${POS_WORD[h.pos] || h.pos}` : ''}${h.pri === 1 ? ' · P1' : ''} · ${h.own || 'no owner'}${h.issue ? ` · on ${h.issue}` : ''}`,
  skip: () => 'Not for us', later: () => 'Moved to the back' };
function recent(t) {
  const rows = t.hist.slice(0, 10), more = t.hist.length - rows.length;
  return `<section class="st-recent" aria-labelledby="st-rech"><h2 class="st-rech" id="st-rech">Recent decisions</h2>
    ${rows.length ? `<ul class="st-reclist">${rows.map(h => `<li><span class="st-recb"><span class="st-rect"><b>${esc(spaced(h.row.bill_number))}</b> ${esc(titleCaseHI(h.row.title || '').replace(/^Relating to /i, '').replace(/\.$/, ''))}</span><span>${esc(HIST_WORD[h.kind](h))}</span></span>${btn('Undo', { kind: 'text', sm: true, icon: 'undo-2', attrs: { 'data-tundo': h.key, 'aria-label': `Undo ${h.row.bill_number}: ${HIST_WORD[h.kind](h)}` } })}</li>`).join('')}</ul>${more > 0 ? `<p class="st-recmore">and ${more} earlier. Undo works back through all of them.</p>` : ''}`
      : '<p class="st-recnone">Nothing decided yet. Each decision shows here with its own Undo.</p>'}</section>`;
}
function why(r) {
  const { real, loose } = realMatches(r), out = [];
  if (r.followers) out.push(`<p class="st-why">${icon('users-round')}<span>${people(r.followers)} on the public tracker${r.set_aside_at ? `, since it was set aside ${esc(fmtDate(r.set_aside_at))}` : ''}.</span></p>`);
  if (real.length) out.push(`<p class="st-why">${icon('sparkles')}<span>Why it's suggested: matches ${real.map(m => `${m.terms.map(k => `<b>${esc(k)}</b>`).join(', ')} for ${esc(m.name)}`).join('; ')}</span></p>`);
  else if (loose.length) out.push(`<p class="st-why">${icon('sparkles')}<span>Suggested for ${esc(loose[0].name)} because of "${esc(loose[0].terms[0])}", but only inside another word.</span></p>`);
  const l = r.lookalike;
  if (l) out.push(`<p class="st-why">${icon('history')}<span>Looks like <b>${esc(l.bill_number)}</b> (${esc(l.session_year)})${l.position ? `, which we ${esc(POS_PAST[l.position] || 'tracked')}` : ''}${l.coalition ? ` under ${esc(l.coalition)}` : ''}${l.priority ? `, P${esc(l.priority)}` : ''}</span></p>`);
  const sg = sugOf(r);
  if (sg) out.push(`<p class="st-why">${icon('tag')}<span>Track puts it on the issue <b>${esc(sg.issue.name)}</b> (${sg.how === 'lookalike' ? `because ${esc(r.lookalike.bill_number)} (${esc(r.lookalike.session_year)}) is on it` : `from the words ${sg.words.map(w => `<b>${esc(w)}</b>`).join(', ')}`}). Change it under Issue.</span></p>`);
  if (!out.length) out.push(`<p class="st-why muted">${icon('circle-dashed')}<span>No coalition keyword matches this bill.</span></p>`);
  return out.join('');
}
// The decision's four choices, the most used first: the position (Track as Monitor unless you pick one), the issue, the
// coalition and the owner (each says why it is preselected).
const pickers = (t, r) => { const c = campOf(t, r), own = advocate(ownIdOf(t, r)), pos = posOf(t, r);
  return `<div class="st-tpick">
      <div class="st-pickrow"><span class="st-lab" id="st-plab">Position</span>${pickerChip(POS_WORD[pos] || pos, { 'data-tposp': '1', 'aria-describedby': 'st-plab' }, POS_ICON[pos])}</div>
      <div class="st-pickrow"><span class="st-lab" id="st-ilab">Issue</span>${pickerChip(issOf(t, r)?.name || 'No issue', { 'data-tiss': '1', 'aria-describedby': 'st-ilab' }, issOf(t, r) ? 'tag' : 'circle-dashed')}</div>
      <div class="st-pickrow"><span class="st-lab" id="st-clab">Coalition</span>${pickerChip(c?.name || 'Choose', { 'data-tcoal': '1', 'aria-describedby': 'st-clab' }, iconName(c?.icon))}</div>
      <div class="st-pickrow"><span class="st-lab" id="st-olab">Owner</span>${pickerChip(own ? own.full_name : 'No owner', { 'data-town': '1', 'aria-describedby': 'st-olab' }, own ? 'user-round' : 'circle-dashed')}${ownWhy(t, r) ? `<span class="st-owhy">${esc(ownWhy(t, r))}</span>` : ''}</div>
    </div>`; };
const decideBtns = () => `${btn('Track', { kind: 'primary', icon: 'check', attrs: { 'data-ttrack': '1' } })}${btn('Not for us', { kind: 'secondary', attrs: { 'data-tskip': '1' } })}${btn('Later', { kind: 'text', attrs: { 'data-tlater': '1' } })}`;
const keysLine = () => HOVER() && keysOn() && keysUsed() ? `<p class="st-keys small muted"><kbd>T</kbd> track · <kbd>N</kbd> not for us · <kbd>L</kbd> later · <kbd>U</kbd> undo · arrow keys move between bills</p>` : '';
function card(t, r, desk) {
  const terms = realMatches(r).real.flatMap(m => m.terms);
  // Phones: long Capitol descriptions start folded at four lines, so the coalition and position stay on the first
  // screen. Desktop: the whole text shows (the decision sits beside it, not under it).
  const title = titleCaseHI(r.title || ''), long = !desk && (r.description || '').length > 200;
  return `<article class="st-tcard" aria-labelledby="st-tnum">
    <div class="st-tl1"><h2 id="st-tnum" tabindex="-1">${esc(spaced(r.bill_number))}</h2>${companionsOf(r).length ? chip(`Companion ${companionsOf(r).join(', ')}`) : ''}
      <a class="iconbtn st-cap" href="${esc(capitol(r))}" target="_blank" rel="noopener" aria-label="Read ${esc(r.bill_number)} at the Capitol (new tab)" title="Read it at the Capitol">${icon('external-link')}</a></div>
    ${title ? `<p class="st-ttitle">${mark(title, terms)}</p>` : ''}
    ${r.description ? `<p class="st-tdesc${long ? ' clamp' : ''}" id="st-tdesc">${mark(r.description, terms)}</p>${long ? btn('Read all', { kind: 'text', sm: true, iconEnd: 'chevron-down', attrs: { 'data-tmore': '1', 'aria-expanded': 'false', 'aria-controls': 'st-tdesc' } }) : ''}` : ''}
    <div class="st-whys">${why(r)}</div>
  </article>${desk ? '' : `<section class="st-decide st-decidep" aria-labelledby="st-dech"><h2 class="st-rech" id="st-dech">Your decision</h2>${pickers(t, r)}</section>`}`;
}

function issueSheet(t, r, back, rerender) {
  const sg = sugOf(r)?.issue || null, live = (S.issues || []).filter(i => !i.archived_at);
  const near = sg ? live.filter(i => i !== sg && i.category === sg.category) : [], rest = live.filter(i => i !== sg && !near.includes(i)).sort((a, b) => a.name.localeCompare(b.name));
  const opts = [...(sg ? [[sg.id, sg.name, 'Suggested']] : []), ...near.map(i => [i.id, i.name, 'Same topic']), ...rest.map(i => [i.id, i.name, '']), ['none', 'No issue', '']];
  const cur = issOf(t, r)?.id || 'none';
  const row = ([v, l, sub]) => `<button type="button" role="radio" aria-checked="${String(v) === String(cur)}" data-pv="${esc(v)}" data-pn="${esc(String(l).toLowerCase())}">${icon(v === 'none' ? 'circle-dashed' : 'tag')}<span class="body"><span class="title">${esc(l)}</span>${sub ? `<span class="sub">${esc(sub)}</span>` : ''}</span>${String(v) === String(cur) ? icon('check', { cls: 'on' }) : ''}</button>`;
  openSheet({ title: `Put ${r.bill_number} on an issue`, pop: true,
    body: `<p class="small muted sv-sh-help">Its owner leads the bill, and the bill starts with the issue’s talking points.</p>
      <div class="searchbox st-iqbox"><label class="sr" for="st-iq">Find an issue</label>${icon('search')}<input id="st-iq" class="input" type="search" placeholder="Type to find one of ${live.length} issues" autocomplete="off" enterkeyhint="go"></div>
      <div class="sv-pickl st-ipick" role="radiogroup" aria-label="Issue">${opts.map(row).join('')}</div><p class="small muted st-inone" hidden>No issue has those words. Clear the box to see them all.</p>`,
    wire: d => {
      const q = d.querySelector('#st-iq'), rows = [...d.querySelectorAll('[data-pv]')], none = d.querySelector('.st-inone');
      const pick = async v => { await closeSheet({ silent: true }); t.iss[r.id] = v; rerender(back); };
      rows.forEach(el => el.onclick = () => pick(el.dataset.pv));
      q.oninput = () => { const w = plain(q.value.trim()); let k = 0; rows.forEach(el => { const hit = !w || plain(el.dataset.pn).includes(w); el.hidden = !hit; if (hit) k++; }); none.hidden = k > 0; };
      // Enter takes the first issue that matches, so a typed name and Enter is the whole choice.
      q.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); const first = rows.find(el => !el.hidden); if (first) pick(first.dataset.pv); } };
      setTimeout(() => q.focus(), 30);
    } });
}

export default {
  tab: 'bills',
  // Between 900 and 1099px the frame's page is a 720px column, too narrow for the bill and the panel side by side;
  // `wide` frees the page and the CSS caps it again at the frame's usual width.
  wide: () => true,
  title: () => 'Sort new bills',
  render() {
    const t = V(), desk = DESK();
    // First visit: the explanation is open (same rule and key as app.js renderTriage), then it folds into a link.
    if (S.triageFirstVisit === undefined) { S.triageFirstVisit = !triageSeen(); try { localStorage.setItem('hiphi_triage_seen', '1'); } catch { /* private mode */ } }
    if (t.rows === null) load();
    loadSortCount(() => { if (S.route?.name === 'triage') refreshTabs('new'); });
    const how = S.triageFirstVisit || t.how;
    const head = billsHead('new');
    const campIc = t.camp && t.camp !== 'mine' ? iconName(S.campaigns.find(x => x.id === t.camp)?.icon) : t.camp === 'mine' ? 'users' : null;
    const filters = `<div class="st-tlead">${t.rows ? number(t) : '<p class="st-num">Reading the new bills…</p>'}<div class="st-tfilters">${pickerChip(campLabel(t), { 'data-tcamp': '1', 'aria-label': `Coalition: ${campLabel(t)}. Change` }, campIc)}${pickerChip(t.matchedOnly ? 'Suggested bills' : 'Every undecided bill', { 'data-tmatch': '1', 'aria-label': `Showing ${t.matchedOnly ? 'suggested bills' : 'every undecided bill'}. Change` })}</div></div>`;
    const howBox = how ? `<div class="notice info st-how">${icon('info')}<div><p><b>Track</b> puts the bill on the tracker with the position, issue, coalition and owner you pick: unless you change them, Monitor, the suggested issue, and the coalition's owner. Strong support makes it the team’s top tier. <b>Not for us</b> takes it off this list for good. <b>Later</b> moves it to the back. You can undo each one.</p>${btn('Hide this', { kind: 'text', sm: true, attrs: { 'data-thow': '0' } })}</div></div>` : '';
    const foot = `<div class="btnrow st-tfoot">${how ? '' : btn('How this works', { kind: 'text', sm: true, icon: 'circle-help', attrs: { 'data-thow': '1' } })}${btn('Search all introduced bills', { kind: 'text', sm: true, icon: 'search', href: '#/search' })}</div>`;
    const cls = `st-page st-triage${desk ? ' st-tdesk' : ''}`;
    if (t.rows === null) return `<div class="${cls}">${head}${filters}${skeleton(2)}</div>`;
    if (!t.rows.length) {
      const doneCard = `<div class="st-done">${empty({ title: 'All sorted for now.',
        text: `${t.done ? `You decided ${t.done} bill${t.done === 1 ? '' : 's'} this sitting. ` : ''}${t.matchedOnly ? `Nothing suggested is waiting${t.camp ? ` for ${esc(campName(t))}` : ''}. New bills show up here as they are introduced.` : 'No undecided bills are left.'}`,
        action: `<div class="btncol">${btn('Back to Bills', { kind: 'secondary', href: '#/bills' })}${t.matchedOnly ? btn('Look through every undecided bill', { kind: 'text', attrs: { 'data-tall': '1' } }) : ''}${t.camp ? btn('Look at every coalition', { kind: 'text', attrs: { 'data-tcampall': '1' } }) : ''}</div>` })}</div>`;
      // The decisions just made can still be undone from here.
      return desk ? `<div class="${cls}">${head}${filters}<div class="st-tcols"><div class="st-tmain">${doneCard}${followedPanel(t)}${foot}</div><aside class="st-tside" aria-label="Your decisions">${recent(t)}</aside></div></div>`
        : `<div class="${cls}">${head}${filters}${doneCard}${followedPanel(t)}${t.hist.length ? recent(t) : ''}${foot}</div>`;
    }
    t.focus = Math.min(Math.max(0, t.focus), t.rows.length - 1);
    const r = t.rows[t.focus];
    if (desk) return `<div class="${cls}">${head}${filters}<div class="st-tcols">
        <div class="st-tmain">${card(t, r, true)}${howBox}${followedPanel(t)}${foot}</div>
        <aside class="st-tside" aria-label="Decide on ${esc(r.bill_number)}">
          <section class="st-decide" aria-labelledby="st-dech"><h2 class="st-rech" id="st-dech">Your decision on ${esc(spaced(r.bill_number))}</h2>${pickers(t, r)}<div class="st-dbtns">${decideBtns()}</div>${keysLine()}</section>
          ${recent(t)}
        </aside></div></div>`;
    return `<div class="${cls}">${head}${filters}${card(t, r, false)}${keysLine()}${howBox}${t.hist.length ? recent(t) : ''}${followedPanel(t)}${foot}</div>`;
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
    const mine = sortCoalitions();
    $('[data-tcamp]') && ($('[data-tcamp]').onclick = () => pickerSheet({ title: 'New bills for', value: t.camp || '',
      options: [...(mine.length > 1 ? [['mine', 'Your coalitions', 'users', coalitionWords(mine).replace(/^your /, '')]] : []), ...S.campaigns.filter(x => (x.keywords || []).length).map(x => [mine.length === 1 && x.id === mine[0] ? 'mine' : x.id, x.name, iconName(x.icon), `${mine.includes(x.id) ? 'Yours · ' : ''}${advocate(x.owner_id) ? `${teamName(x.owner_id)} owns it${newOwnerTag(x.owner_id)}` : 'No owner'}`]), ['', 'All coalitions', 'users', 'Every new bill a coalition’s words match']],
      onPick: v => { t.camp = v || null; t.rows = null; t.focus = 0; rerender('[data-tcamp]'); } }));
    $('[data-tcampall]') && ($('[data-tcampall]').onclick = () => { t.camp = null; t.rows = null; t.focus = 0; rerender(); });
    $('[data-tmatch]') && ($('[data-tmatch]').onclick = () => pickerSheet({ title: 'Show', value: t.matchedOnly ? '1' : '0',
      options: [['1', 'Suggested bills', 'sparkles', 'A coalition keyword matches them'], ['0', 'Every undecided bill', 'list', 'Everything introduced that nobody has decided on']],
      onPick: v => { t.matchedOnly = v === '1'; t.rows = null; t.focus = 0; rerender('[data-tmatch]'); } }));
    $('[data-tall]') && ($('[data-tall]').onclick = () => { t.matchedOnly = false; t.rows = null; t.focus = 0; rerender(); });
    root.querySelectorAll('[data-thow]').forEach(b => b.onclick = () => { t.how = b.dataset.thow === '1'; if (!t.how) S.triageFirstVisit = false; rerender(t.how ? '.st-how' : '[data-thow]'); });
    root.querySelectorAll('[data-tundo]').forEach(b => b.onclick = () => undoEntry(t.hist.find(h => String(h.key) === b.dataset.tundo)));
    if (!r) return;
    $('[data-tcoal]').onclick = e => { const cur = campOf(t, r), real = realMatches(r).real, back = after(e, '[data-tcoal]');
      pickerSheet({ title: `Track ${r.bill_number} for`, value: cur?.id, help: t.own[r.id] === undefined ? 'The coalition\'s owner gets the bill, unless you pick an owner or they are turned off.' : '',
        options: S.campaigns.map(c => { const m = real.find(x => x.campaign_id === c.id), o = advocate(c.owner_id);
          return [c.id, c.name, iconName(c.icon), [m ? `Suggested: matches ${m.terms.join(', ')}` : '', o ? `${teamName(o)} owns it${newOwnerTag(o)}` : 'No owner'].filter(Boolean).join(' · ')]; }),
        onPick: v => { t.pick[r.id] = v; rerender(back); } }); };
    // Owner: you first, then everyone else; the coalition's owner says so. "No owner" is a choice too.
    $('[data-town]').onclick = e => { const back = after(e, '[data-town]'), c = campOf(t, r);
      const ads = S.advocates.filter(a => a.is_active !== false).sort((a, b) => (b.id === S.me?.id) - (a.id === S.me?.id) || a.full_name.localeCompare(b.full_name));
      pickerSheet({ title: `Who owns ${r.bill_number}`, value: ownIdOf(t, r) || 'none', help: !ownIdOf(t, r) && offOwner(t, r) ? esc(`${offOwner(t, r)}, so ${r.bill_number} has no owner unless you pick one.`) : '',   // pickerSheet's help is HTML
        options: [...ads.map(a => [a.id, a.id === S.me?.id ? `You (${a.full_name})` : a.full_name, 'user-round', c && a.id === c.owner_id ? `Owns ${c.name}` : '']), ['none', 'No owner', 'circle-dashed']],
        onPick: v => { t.own[r.id] = v; rerender(back); } }); };
    // Issue: the suggestion first, then the issues in its category, then the rest; "No issue" is a choice too. A box at the
    // top narrows the list as you type (V30: 91 issues, and v5 had no search).
    $('[data-tiss]').onclick = e => issueSheet(t, r, after(e, '[data-tiss]'), rerender);
    $('[data-tposp]').onclick = e => { const back = after(e, '[data-tposp]');
      pickerSheet({ title: `Our position on ${r.bill_number}`, value: posOf(t, r), options: POS7.map(k => [k, POS_WORD[k] || k, POS_ICON[k], POS_SUB[k] || '']),
        onPick: v => { t.pos[r.id] = v; rerender(back); } }); };
    const more = $('[data-tmore]');
    if (more) more.onclick = () => { const open = more.getAttribute('aria-expanded') !== 'true', d = $('#st-tdesc');
      d.classList.toggle('clamp', !open); more.setAttribute('aria-expanded', open); more.innerHTML = `<span>${open ? 'Show less' : 'Read all'}</span>${icon(open ? 'chevron-up' : 'chevron-down')}`; };
    root.querySelectorAll('[data-tfol]').forEach(b => b.onclick = () => {
      const f = (t.followed || []).find(x => x.id === b.dataset.tfol); if (!f) return;
      t.rows = [f, ...(t.rows || []).filter(x => x.id !== f.id)]; t.focus = 0; rerender('#st-tnum'); window.scrollTo(0, 0);
    });
    $('[data-ttrack]').onclick = () => decide('track');
    $('[data-tskip]').onclick = () => decide('skip');
    $('[data-tlater]').onclick = () => later();
  },
};

// ---- decisions: each one goes on t.hist (newest first), which is what U and "Recent decisions" undo ----
let busy = false, seq = 0;
const lock = on => document.querySelectorAll('[data-ttrack], [data-tskip], [data-tlater]').forEach(b => on ? b.setAttribute('aria-disabled', 'true') : b.removeAttribute('aria-disabled'));
const count = (t, r, d, tracked) => { const c = t.counts; if (!c) return;   // keep the server's counts true as we go
  c.undecided = Math.max(0, (c.undecided || 0) + d); if (isSuggested(r)) c.suggested = Math.max(0, (c.suggested || 0) + d); if (tracked) c.tracked = Math.max(0, (c.tracked || 0) - d);
  if (t.matchedOnly && (t.camp === 'mine' || (sortCoalitions().length === 1 && t.camp === sortCoalitions()[0]))) sortCountChanged(d); };   // Bills' tab says the same number
async function decide(kind) {
  const t = V(), r = t.rows?.[t.focus]; if (!r || busy) return;
  busy = true; lock(true);
  const idx = t.focus;
  try {
    if (kind === 'track') {
      const c = campOf(t, r), pos = posOf(t, r), pri = priorityOf(pos), own = ownIdOf(t, r), iss = issOf(t, r), sg = sugOf(r)?.issue || null;
      const b = await DB.triageTrack(r, c?.id);
      // triage_track tracks at Monitor with the coalition's owner (and keeps what a bill tracked before, then undone,
      // still has). What the card says is written straight after, so the bill leaves here fully decided. The priority
      // follows the position (R-175: strongly support is P1), in the database and in DB.updateBill.
      if (b) {
        if (b.position !== pos || b.priority !== pri) await DB.updateBill(b.id, { position: pos });
        // The issue, and whether it was the suggestion (kept for February's "how often was it right", migration 119).
        if (iss) await DB.setBillIssue(b.id, iss.id, true, { via: !sg ? 'staff' : sg.id === iss.id ? 'suggested' : 'changed' });
        // The owner last: putting a bill nobody leads on an issue hands it to the issue's owner (091), even one who is
        // turned off or one the card set to No owner, so what the card says is written after it (R-316 W28, fresh-eyes).
        await DB.setOwner(b.id, own);
      }
      const who = own ? (own === S.me?.id ? 'You' : advocate(own)?.full_name || 'Someone') : '';
      const h = { key: ++seq, kind, row: r, idx, camp: c?.name || '', pos, pri, own: who, issueId: iss?.id || null, issue: iss?.name || '' }; t.hist.unshift(h); t.last = { ...r, tracked: true };
      count(t, r, -1, true); done(t, idx);
      toast(`${r.bill_number} tracked for ${c?.name || 'the tracker'}. ${!own ? 'No owner yet.' : own === S.me?.id ? 'You own it.' : `${who} owns it.`}`, { ok: true, undo: () => undoEntry(h), action: { label: 'Open', run: () => S.go(billRoute(r)) } });
    } else {
      await DB.triageSkip(r);
      const h = { key: ++seq, kind: 'skip', row: r, idx }; t.hist.unshift(h); t.last = { ...r, tracked: false };
      if (t.followed) t.followed = t.followed.filter(x => x.id !== r.id);   // set aside now: not asked again until a new follow
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
      if (h.issueId) await DB.setBillIssue(h.row.id, h.issueId, false);   // the issue goes too (R-088)
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
  if (e.key === 'Escape') { if (onPage(document.activeElement)) { e.preventDefault(); S.go('#/bills'); } return; }   // back to the Bills tab
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
