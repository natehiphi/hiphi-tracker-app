// Staff v2 · one legislator (#/legislator/:id?from=HB1562, plan 3.6), a routed page instead of the current app's
// drawer. On a phone: a compact header (under 120px), then Email · Call · Log a conversation, then the sections the
// drawer had, in the order staff use them: where they stand on our bills (with the stance picker and the hearing
// date), our bills in their committees (the true count: the drawer counted after slicing to 12), bills they
// introduced, team notes, their committees and contact details. On a desktop (900px and wider, build 3) it is two
// columns: the bills they decide for us, the team notes and what they introduced on the left; a side panel that stays
// in view with the photo, role, district, office, phone, email, the Capitol page and Log a conversation. With a mouse
// the phone number is text with a Copy button (a Call link hides the number, and a laptop cannot dial); on a touch
// screen it is a Call button. Opened from a bill's Pathway, the back link reads "‹ HB1562" and returns to that
// Pathway, and that bill comes first.
import { S, DB, esc, hooks, fmtDate, advocate } from './data.js';
import { stopOf, stanceOf, legById, legsForSponsors, codesOf, diedish, hearingAhead, billNum, blurb, cmteName, STANCES } from './model.js';
import { icon, btn, iconBtn, chip, pickerChip, pickerSheet, empty, notice, toast, openSheet, closeSheet } from './ui.js';
import { photo, legName, shortName, partyDist, seatsOf, roleWord, legMail, billSub, billHref, stanceChip, openStance, wireStances, wireLinks, STANCE_WORD, STANCE_ICON } from './pathway.js';
import { ourBill, islandFor } from './legislators.js';

const PARTY = { D: 'Democrat', R: 'Republican', I: 'Independent' };
const DESK = () => { try { return matchMedia('(min-width: 900px)').matches; } catch { return false; } };
const HOVER = () => { try { return matchMedia('(hover: hover) and (pointer: fine)').matches; } catch { return false; } };
const fromBill = route => route.from ? S.bills.find(b => b.bill_number === String(route.from).replace(/\s/g, '').toUpperCase()) : null;
const FOLD = 8;   // long lists show 8 rows, the rest behind one tap (the count in the heading is always the full count)

// Sponsors are matched to legislators by surname on every bill, so the index is built once per load, not per page.
let sponsorIdx = null, sponsorKey = '';
function introducedBy(l) {
  const key = S.bills.length + '|' + (S.legislators || []).length;
  if (!sponsorIdx || sponsorKey !== key) {
    sponsorIdx = new Map(); sponsorKey = key;
    for (const b of S.bills) { if (b.tracked === false) continue; for (const x of legsForSponsors(b)) (sponsorIdx.get(x.id) || sponsorIdx.set(x.id, []).get(x.id)).push(b); }
  }
  return sponsorIdx.get(l.id) || [];
}
// Our live bills sitting in one of their committees right now, soonest hearing first.
function inTheirCommittees(l) {
  const mine = seatsOf(l).map(m => m.committee);
  return S.bills.filter(b => ourBill(b) && !diedish(b)).map(b => ({ b, st: stopOf(b) }))
    .filter(({ st }) => st.phase === 'committee' && st.committee && codesOf(st.committee).some(c => mine.includes(c)));
}
const hearingT = b => { const h = hearingAhead(b); return h ? new Date(h.scheduled_at).getTime() : Infinity; };
const byUrgency = (x, y) => hearingT(x) - hearingT(y) || (x.priority || 9) - (y.priority || 9) || x.bill_number.localeCompare(y.bill_number, 'en', { numeric: true });

// How a bill is named: the nickname leads when it has one (bold), the number always shows, and the plain summary is
// the second line. A bill we only monitor has no nickname, so its number leads and the summary follows it.
const billName = b => b.nickname
  ? `<span class="title"><b>${esc(b.nickname)}</b> <span class="lg-bnum">${esc(billNum(b))}</span></span><span class="lg-bsum">${esc(blurb(b, 140))}</span>`
  : `<span class="title"><b>${esc(billNum(b))}</b> <span class="lg-bt">${esc(blurb(b, 120))}</span></span>`;
// A bill row with the stance chip: the bill part links to the bill. On a phone the chip opens the stance sheet; on a
// desktop it opens a small picker beside itself (saved on the click, with Undo) and the note has its own button, the
// same pair the bill's Pathway table uses.
function standRow(b, l, { from = false, desk = false } = {}) {
  const x = stanceOf(b.id, l.id), who = x.contact_id && advocate(x.contact_id), key = `${b.id}|${l.id}`, word = STANCE_WORD[x.stance] || 'Unknown';
  const sub = [billSub(b), who ? `${who.full_name.split(' ')[0]} knows them` : ''].filter(Boolean).join(' · ');
  const noteLabel = `${x.note || who ? 'Edit the note' : 'Add a note'} on ${shortName(l)} for ${b.bill_number}`;
  return `<div class="row lg-brow${from ? ' from' : ''}">
    <a class="lg-bbody" href="${billHref(b)}">${billName(b)}<span class="sub">${esc(sub)}</span>${x.note ? `<span class="lg-note">${esc(x.note)}</span>` : ''}</a>
    ${desk ? `${iconBtn('notebook-pen', noteLabel, { 'data-lgnote': key }, 'lg-noteb')}${pickerChip(word, { 'data-lgpick': key, 'aria-haspopup': 'dialog', 'aria-label': `${shortName(l)} on ${b.bill_number}: ${word}. Change` }, STANCE_ICON[x.stance] || 'circle-dashed')}` : stanceChip(b, l)}
  </div>`;
}
const billLink = b => `<a class="row lg-brow lg-plain" href="${billHref(b)}"><span class="lg-bbody">${billName(b)}<span class="sub">${esc(billSub(b))}</span></span>${icon('chevron-right', { cls: 'chev' })}</a>`;
// Show the first rows; "Show all N" opens the rest in place (remembered for this visit).
function folded(key, rows) {
  const open = S.lgMore?.has(key);
  if (rows.length <= FOLD + 2 || open) return rows.join('');
  return rows.slice(0, FOLD).join('') + `<button type="button" class="row lg-more" data-lgmore="${esc(key)}">${icon('chevron-down')}<span>Show all ${rows.length}</span></button>`;
}
const section = (id, title, n, inner, extra = '') => `<section class="lg-sec" aria-labelledby="${id}"><div class="lg-sech"><h2 id="${id}">${title}${n != null ? ` <span class="lg-n">${n}</span>` : ''}</h2>${extra}</div>${inner}</section>`;

function notesHTML(l) {
  const notes = S.legNotes?.[l.id];
  if (!notes) return `<div class="skel lg-skel"></div>`;
  const hidden = S.lgHidden || new Set(), list = notes.filter(n => !hidden.has(n.id));
  if (!list.length) return `<p class="lg-empty">No notes yet. After a meeting or a call, use Log a conversation.</p>`;
  return `<div class="rows">${list.map(n => {
    const a = advocate(n.advocate_id), b = n.bill_id && S.bills.find(x => x.id === n.bill_id), mine = a?.id === S.me?.id || S.me?.is_admin;
    return `<div class="row lg-noterow"><div class="body"><p class="lg-nhead"><b>${esc(a?.full_name || 'Someone')}</b> · ${esc(fmtDate(n.created_at, { month: 'short' }))}${b ? ` · <a href="${billHref(b)}">${esc(b.nickname || b.bill_number)}${b.nickname ? ` ${esc(b.bill_number)}` : ''}</a>` : ''}</p><p class="lg-nbody">${esc(n.body)}</p></div>${mine ? iconBtn('trash-2', 'Delete this note', { 'data-lgdelnote': n.id }) : ''}</div>`;
  }).join('')}</div>`;
}
// Hawaiʻi-specific: the Speaker and the Senate President hold no committee seats. They preside over their chamber
// and refer each bill to its committees, so "no bills in their committees" is how the job works, not a gap in our
// data; the page says so instead of showing two empty lists. Anyone else without seats (a member appointed
// mid-session, a seat being handed over) gets the plain sentence.
function noSeats(l) {
  const t = String(l.title || ''), chamber = l.chamber === 'S' ? 'Senate' : 'House';
  const why = /^(speaker|president)$/i.test(t) ? `The ${esc(t)} presides over the ${chamber} and refers each bill to its committees, so none of our bills waits on a committee of theirs. A word with this office can matter on any bill.`
    : `${esc(shortName(l))} has no committee seats this session, so none of our bills waits on their committee vote. Floor votes still count.`;
  return notice('info', 'info', `<b>No committee seats.</b> ${why} You can still set a stance from a bill's Pathway, and log every conversation here.`);
}
// The phone number, by pointer: text and Copy with a mouse, a Call button on a touch screen. Nothing at all when the
// directory has no number (no senator has one), so there is never an empty row or a button that cannot work.
const copyBtn = (what, value) => btn('Copy', { kind: 'text', sm: true, icon: 'copy', attrs: { 'data-lgcopy': value, 'data-lgwhat': what, 'aria-label': `Copy the ${what}` } });

function parts(route, l, desk) {
  const from = fromBill(route);
  // Where they stand: the bill you came from first (even when unknown), then every stance someone recorded.
  const known = (S.stances || []).filter(x => x.legislator_id === l.id && x.stance !== 'unknown').map(x => S.bills.find(b => b.id === x.bill_id)).filter(b => b && (!from || b.id !== from.id)).sort(byUrgency);
  const stand = [...(from ? [standRow(from, l, { from: true, desk })] : []), ...known.map(b => standRow(b, l, { desk }))];
  const inCm = inTheirCommittees(l).map(x => x.b).sort(byUrgency), intro = introducedBy(l).slice().sort((a, b) => diedish(a) - diedish(b) || byUrgency(a, b));
  const seats = seatsOf(l);
  return { from, stand, inCm, intro, seats,
    standSec: empties => stand.length || empties ? section('lg-s1', 'Where they stand on our bills', null, stand.length ? `<div class="rows">${stand.join('')}</div>` : `<p class="lg-empty">No stances yet. Set one on any bill below.</p>`) : '',
    cmSec: () => !seats.length ? `<div class="lg-sec">${noSeats(l)}</div>` : section('lg-s2', 'Our bills in their committees', inCm.length, inCm.length ? `<div class="rows">${folded(`${l.id}|cm`, inCm.map(b => standRow(b, l, { desk })))}</div>` : `<p class="lg-empty">None of our live bills is in their committees right now.</p>`),
    introSec: () => section('lg-s3', 'Bills they introduced', intro.length, intro.length ? `<div class="rows">${folded(`${l.id}|in`, intro.map(billLink))}</div>` : `<p class="lg-empty">None of the bills on the tracker.</p>`),
    notesSec: () => section('lg-s4', 'Team notes', null, notesHTML(l), btn(desk ? 'Log a conversation' : 'Add', { kind: 'text', icon: 'notebook-pen', sm: true, attrs: { 'data-lglog': '1', 'aria-label': 'Log a conversation' } })),
  };
}

function phoneHTML(route, l, back) {
  const p = parts(route, l, false), { from, seats } = p, cm = seats.map(m => m.role === 'member' ? m.committee : `${roleWord(m.role)}, ${m.committee}`).join(' · ');
  const hasCall = !!l.phone, hasMail = !!l.email, hover = HOVER();
  return `<div class="lg-page">
      <a class="lg-deskback" href="${esc(back.href)}" data-back>${icon('chevron-left')}<span>${esc(back.label)}</span></a>
      <header class="lg-head">
        ${photo(l, 48)}
        <div class="lg-hbody">
          <h1>${esc(legName(l))}</h1>
          <p class="lg-hsub">${esc([PARTY[l.party] || l.party, `${l.chamber === 'S' ? 'Senate' : 'House'} District ${l.district}`, l.title, l.places].filter(Boolean).join(' · '))}</p>
          ${cm ? `<p class="lg-hcm">${esc(cm)}</p>` : ''}
        </div>
      </header>
      <div class="lg-acts">
        ${hasMail ? btn('Email', { kind: 'secondary', icon: 'mail', href: legMail(l, from), sm: true }) : ''}
        ${!hasCall ? '' : hover ? `<span class="lg-tel">${icon('phone')}<span>${esc(l.phone)}</span>${copyBtn('phone number', l.phone)}</span>` : btn('Call', { kind: 'secondary', icon: 'phone', href: `tel:${l.phone}`, sm: true })}
        ${btn('Log a conversation', { sm: true, attrs: { 'data-lglog': '1' } })}
      </div>
      ${p.standSec(seats.length > 0)}${p.cmSec()}${p.introSec()}${p.notesSec()}
      ${seats.length ? section('lg-s5', 'Committees', seats.length, `<div class="rows">${seats.map(m => `<div class="row lg-crow"><span class="body"><span class="title">${esc(cmteName(m.committee))}</span><span class="sub">${esc(m.committee)} · ${S.committees?.[m.committee]?.chamber === 'S' ? 'Senate' : 'House'}</span></span>${m.role !== 'member' ? chip(roleWord(m.role)) : ''}</div>`).join('')}</div>`) : ''}
      ${section('lg-s6', 'Contact', null, `<div class="rows">
        ${hasMail ? `<a class="row" href="mailto:${esc(l.email)}"><span class="lead">${icon('mail')}</span><span class="body"><span class="title">${esc(l.email)}</span><span class="sub">Email</span></span></a>` : ''}
        ${hasCall ? `<a class="row" href="tel:${esc(l.phone)}"><span class="lead">${icon('phone')}</span><span class="body"><span class="title">${esc(l.phone)}</span><span class="sub">Office phone</span></span></a>` : ''}
        ${l.room ? `<div class="row"><span class="lead">${icon('map-pin')}</span><span class="body"><span class="title">Room ${esc(l.room)}</span><span class="sub">State Capitol</span></span></div>` : ''}
        ${l.capitol_url ? `<a class="row" href="${esc(l.capitol_url)}" target="_blank" rel="noopener"><span class="lead">${icon('landmark')}</span><span class="body"><span class="title">Capitol page</span><span class="sub">Opens capitol.hawaii.gov</span></span>${icon('external-link', { cls: 'chev' })}</a>` : ''}
      </div>`)}
    </div>`;
}

// Desktop: the work on the left (the order follows the week: the bills they decide, what the team knows, what they
// introduced), who they are and how to reach them on the right, in a panel that stays in view while the lists scroll.
function deskHTML(route, l, back) {
  const p = parts(route, l, true), { from, seats } = p, hover = HOVER(), hasCall = !!l.phone, hasMail = !!l.email, island = islandFor(l);
  const line = (ic, label, value, end = '') => `<div class="lg-ci"><span class="lg-cic">${icon(ic)}</span><div class="lg-cib"><span class="lg-cil">${label}</span><span class="lg-civ">${value}</span></div>${end}</div>`;
  return `<div class="lg-page lg-desk">
    <div class="sv-cols lg-cols">
      <div class="lg-main">
        <a class="lg-deskback" href="${esc(back.href)}" data-back>${icon('chevron-left')}<span>${esc(back.label)}</span></a>
        <header class="lg-head"><div class="lg-hbody">
          <h1>${esc(legName(l))}</h1>
          <p class="lg-hsub">${esc([PARTY[l.party] || l.party, `${l.chamber === 'S' ? 'Senate' : 'House'} District ${l.district}`, island].filter(Boolean).join(' · '))}</p>
        </div></header>
        ${p.standSec(false)}${p.cmSec()}${p.notesSec()}${p.introSec()}
      </div>
      <aside class="sv-aside lg-side" aria-label="${esc(shortName(l))}: contact details and committees">
        <div class="card lg-card">
          <div class="lg-who2">${photo(l, 72)}<div class="lg-who2b"><p class="strong">${esc(shortName(l))}</p><p class="lg-who2s">${esc(partyDist(l))}${island ? ` · ${esc(island)}` : ''}</p>${l.title ? chip(l.title) : ''}</div></div>
          ${l.places ? `<p class="lg-places" title="${esc(l.places)}">${esc(l.places)}</p>` : ''}
          <div class="lg-cis">
            ${hasCall ? line('phone', 'Office phone', `<span data-lgphone>${esc(l.phone)}</span>`, hover ? copyBtn('phone number', l.phone) : btn('Call', { kind: 'secondary', icon: 'phone', href: `tel:${l.phone}`, sm: true })) : ''}
            ${hasMail ? line('mail', 'Email', `<a href="${esc(legMail(l, from))}">${esc(l.email).replace('@', '@<wbr>')}</a>`, hover ? copyBtn('email address', l.email) : '') : ''}
            ${l.room ? line('map-pin', 'Office', `Room ${esc(l.room)}, State Capitol`) : ''}
            ${l.capitol_url ? line('landmark', 'Capitol page', `<a href="${esc(l.capitol_url)}" target="_blank" rel="noopener">capitol.hawaii.gov${icon('external-link')}<span class="sr"> (opens in a new tab)</span></a>`) : ''}
          </div>
          <div class="lg-cacts">${btn('Log a conversation', { icon: 'notebook-pen', attrs: { 'data-lglog': '1' } })}${hasMail ? btn(from ? `Email about ${esc(from.bill_number)}` : 'Email', { kind: 'secondary', icon: 'mail', href: legMail(l, from) }) : ''}</div>
        </div>
        <div class="card lg-card"><h2 class="lg-cardh" id="lg-s5">Committees${seats.length ? ` <span class="lg-n">${seats.length}</span>` : ''}</h2>
          ${seats.length ? `<ul class="lg-seats" aria-labelledby="lg-s5">${seats.map(m => `<li><span class="lg-seatn"><b>${esc(m.committee)}</b> ${esc(cmteName(m.committee))}</span>${m.role !== 'member' ? chip(roleWord(m.role)) : ''}</li>`).join('')}</ul>` : `<p class="lg-empty">No committee seats this session.</p>`}</div>
      </aside>
    </div>
  </div>`;
}

export default {
  tab: 'legislators',
  // The two columns need more than the 720px column the frame gives a plain page between 900 and 1099px.
  wide: () => DESK(),
  title: route => { const l = legById(route.id); return l ? shortName(l) : 'Legislator'; },
  back: route => { const b = fromBill(route); return b ? { href: `#/bill/${encodeURIComponent(b.bill_number)}/pathway`, label: b.bill_number } : { href: '#/legislators', label: 'Legislators' }; },
  render(route) {
    const l = legById(route.id);
    if (!l) return empty({ title: 'We could not find that legislator', text: 'The link may be from an earlier session.', action: btn('See all legislators', { href: '#/legislators' }), h: 'h1' });
    // Team notes load once per legislator; the page shows a placeholder until they arrive.
    if (!S.legNotes?.[l.id] && !(S.lgNotesLoading ??= new Set()).has(l.id)) {
      S.lgNotesLoading.add(l.id);
      DB.legNotes(l.id).then(() => hooks.render()).catch(() => { S.legNotes[l.id] = []; toast('Could not load the team notes.', { err: true }); hooks.render(); }).finally(() => S.lgNotesLoading.delete(l.id));
    }
    return DESK() ? deskHTML(route, l, this.back(route)) : phoneHTML(route, l, this.back(route));
  },
  wire(route, app) {
    const root = app.querySelector('.lg-page'), l = legById(route.id); if (!root || !l) return;
    wireStances(root); wireLinks(root);
    const pair = key => { const [bid] = String(key).split('|'); return S.bills.find(x => String(x.id) === bid); };
    // Desktop: the chip is a picker beside itself; it saves on the click and the toast offers Undo.
    root.querySelectorAll('[data-lgpick]').forEach(el => el.onclick = () => { const b = pair(el.dataset.lgpick); if (b) pickStance(b, l); });
    root.querySelectorAll('[data-lgnote]').forEach(el => el.onclick = () => { const b = pair(el.dataset.lgnote), k = el.dataset.lgnote;
      if (b) openStance(b, l, { redraw: () => { hooks.render(); document.querySelector(`[data-lgnote="${k}"]`)?.focus(); } }); });
    root.querySelectorAll('[data-lgcopy]').forEach(el => el.onclick = async () => {
      const what = el.dataset.lgwhat || 'text';
      try { await navigator.clipboard.writeText(el.dataset.lgcopy); toast(`${what[0].toUpperCase()}${what.slice(1)} copied.`, { ok: true }); }
      catch { toast(`Could not copy. Select the ${what} and copy it.`); }
    });
    root.querySelectorAll('[data-lglog]').forEach(el => el.onclick = () => logSheet(l, fromBill(route)));
    root.querySelectorAll('[data-lgmore]').forEach(el => el.onclick = () => { (S.lgMore ??= new Set()).add(el.dataset.lgmore); hooks.render(); });
    // Delete acts at once and offers Undo; the note is only removed for good when the Undo has gone (10 seconds).
    root.querySelectorAll('[data-lgdelnote]').forEach(el => el.onclick = () => {
      const id = el.dataset.lgdelnote, real = (S.legNotes[l.id] || []).find(n => String(n.id) === id)?.id; if (real == null) return;
      (S.lgHidden ??= new Set()).add(real); hooks.render();
      const t = setTimeout(async () => {
        try { await DB.delLegNote(real, l.id); } catch (e) { toast('Could not delete the note. It is back.', { err: true }); }
        S.lgHidden.delete(real); hooks.render();
      }, 10000);
      toast('Note deleted.', { undo: () => { clearTimeout(t); S.lgHidden.delete(real); hooks.render(); } });
    });
  },
};

// The desktop stance picker: five choices in a small panel by the chip. A failed save puts the old stance back.
function pickStance(b, l) {
  const x = stanceOf(b.id, l.id), before = { stance: x.stance, note: x.note ?? null, contact_id: x.contact_id ?? null }, sel = `[data-lgpick="${b.id}|${l.id}"]`;
  const redraw = () => { hooks.render(); document.querySelector(sel)?.focus(); };
  pickerSheet({ title: esc(`${shortName(l)} on ${billNum(b)}`), value: x.stance, options: STANCES.map(([v, label]) => [v, label, STANCE_ICON[v]]),
    onPick: async v => {
      if (v === before.stance) return;
      try { await DB.setStance(b.id, l.id, { ...before, stance: v }); }
      catch (e) { Object.assign(stanceOf(b.id, l.id), before); redraw(); toast(e, { err: true }); return; }
      redraw();
      toast(`${shortName(l)}: ${STANCE_WORD[v].toLowerCase()} on ${b.bill_number}.`, { ok: true, undo: async () => { await DB.setStance(b.id, l.id, before); redraw(); toast('Undone.'); } });
    } });
}

// Log a conversation: what happened (one tap), the bill (optional), and a note written or dictated. Saved as a team
// note (DB.addLegNote), prefixed with what happened so the notes list reads "Phone call: …".
const KINDS = ['Met in person', 'Phone call', 'Email', 'At a hearing', 'Other'];
function logSheet(l, from) {
  const inCm = inTheirCommittees(l).map(x => x.b), known = (S.stances || []).filter(x => x.legislator_id === l.id).map(x => S.bills.find(b => b.id === x.bill_id)).filter(Boolean);
  const near = [...new Map([from, ...inCm, ...known, ...introducedBy(l)].filter(Boolean).map(b => [b.id, b])).values()];
  const rest = S.bills.filter(b => b.tracked !== false && !near.some(x => x.id === b.id)).sort((a, b) => a.bill_number.localeCompare(b.bill_number, 'en', { numeric: true }));
  const opt = b => `<option value="${esc(b.id)}"${from && b.id === from.id ? ' selected' : ''}>${esc(b.bill_number)} · ${esc(b.nickname || blurb(b, 50))}</option>`;
  let kind = '';
  openSheet({
    title: `Log a conversation with ${esc(shortName(l))}`, size: 'auto',
    body: `<div class="lg-logsheet">
      <fieldset class="lg-kinds"><legend>What happened</legend><div class="chips">${KINDS.map(k => `<button type="button" class="chip" data-lgkind="${esc(k)}" aria-pressed="false">${esc(k)}</button>`).join('')}</div></fieldset>
      <div class="field"><label for="lg-lbill">Bill (optional)</label><select id="lg-lbill"><option value="">No particular bill</option>${near.length ? `<optgroup label="On their desk or theirs">${near.map(opt).join('')}</optgroup>` : ''}<optgroup label="All our bills">${rest.map(opt).join('')}</optgroup></select></div>
      <div class="field"><label for="lg-lnote">Note</label><textarea id="lg-lnote" rows="5" maxlength="4000" autocapitalize="sentences" spellcheck="true" placeholder="What they said, what they want, what we promised" aria-describedby="lg-lerr"></textarea><span class="err" id="lg-lerr" hidden>${icon('circle-alert')}Write what happened first.</span></div>
      <p class="small muted">Team only. Dictation works in the note: tap the microphone on your keyboard.</p>
    </div>`,
    foot: btn('Save', { attrs: { 'data-lglsave': '1' } }),
    wire: d => {
      d.querySelectorAll('[data-lgkind]').forEach(el => el.onclick = () => { kind = kind === el.dataset.lgkind ? '' : el.dataset.lgkind; d.querySelectorAll('[data-lgkind]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.lgkind === kind))); });
      const note = d.querySelector('#lg-lnote'), err = d.querySelector('#lg-lerr');
      note.oninput = () => { err.hidden = true; note.removeAttribute('aria-invalid'); };
      d.querySelector('[data-lglsave]').onclick = async e => {
        const text = note.value.trim();
        if (!text) { err.hidden = false; note.setAttribute('aria-invalid', 'true'); note.focus(); return; }
        const billId = d.querySelector('#lg-lbill').value || null, body = kind && kind !== 'Other' ? `${kind}: ${text}` : text;
        e.currentTarget.setAttribute('aria-busy', 'true');
        try {
          const row = await DB.addLegNote(l.id, billId, body);
          closeSheet({ silent: true }); hooks.render();
          toast('Conversation logged.', { ok: true, undo: async () => { await DB.delLegNote(row.id, l.id); hooks.render(); toast('Removed.'); } });
        } catch (x) { e.currentTarget?.removeAttribute('aria-busy'); toast(x, { err: true }); }
      };
    },
  });
}
