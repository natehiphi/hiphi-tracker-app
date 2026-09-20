// Staff v2 · Pathway (plan 3.6), plus the legislator helpers the Legislators, Legislator and Search screens share.
// The bill page (M2) calls renderPathway(bill) inside its Pathway tab and wirePathway(root, bill) after it renders.
// Behaviour kept from the current app's pathwayHTML/wireLegDrawer: every committee stop in order (passed, now, next,
// likely), chairs and vice chairs first, a stance per member with a tally per stop, joint committees listed once
// with a role per committee, a note and a staff contact per member per bill, the Email link prefilled with the
// public ask, "Introduced by", and likely next stops from the companion bill (else the House/Senate counterpart map).
import { S, DB, esc, hooks, fmtDT, fmtDate, advocate, pathwayStops } from './data.js';
import { CHAMBER_NAME } from '../stops.js';
import { stopOf, legsOf, stanceOf, legTitle, legsForSponsors, codesOf, cmteName, STANCES, blurb, billNum, diedish, hearingAhead, whyDead, riskOf, legPhoto } from './model.js';
import { icon, btn, chip, pickerChip, openSheet, closeSheet, pickerSheet, toast } from './ui.js';
import { rerender } from './bill.js';   // used inside functions only (bill.js imports this file too)

// ---- small shared helpers (exported for legislators.js, legislator.js, search.js) ----
export const STANCE_WORD = Object.fromEntries(STANCES.map(([v, l]) => [v, l]));
// Words carry the meaning; the icon only helps the eye. Leaning and firm share an icon, so the word always shows.
export const STANCE_ICON = { yes: 'thumbs-up', leaning_yes: 'thumbs-up', unknown: 'circle-dashed', leaning_no: 'thumbs-down', no: 'thumbs-down' };
export const legName = l => `${legTitle(l)} ${l.name}`;
export const surname = l => String(l.sort_name || l.name || '').split(',')[0].trim() || l.name;
export const shortName = l => `${legTitle(l)} ${surname(l)}`;
// "D-HD 20" / "R-SD 5": party and district, the way staff say it
export const partyDist = l => `${l.party ? l.party + '-' : ''}${l.chamber === 'S' ? 'SD' : 'HD'} ${l.district}`;
export const photo = (l, size = 40) => legPhoto(l, `lg-ph s${size}`);
export const roleWord = r => r === 'chair' ? 'Chair' : r === 'vice_chair' ? 'Vice chair' : 'Member';
export const RANK = { chair: 0, vice_chair: 1, member: 2 };
// Every committee seat, leadership first: [{ committee, role }]
export const seatsOf = l => (S.committeeMembers || []).filter(m => m.legislator_id === l.id).sort((a, b) => RANK[a.role] - RANK[b.role] || a.committee.localeCompare(b.committee));
// "Chair, AEN · EEP · HLT": leadership named, plain seats as codes
export const seatsText = l => seatsOf(l).map(m => m.role === 'member' ? m.committee : `${roleWord(m.role)}, ${m.committee}`).join(' · ');
export const billHref = b => `#/bill/${encodeURIComponent(b.bill_number)}`;
export const legHref = (l, b) => `#/legislator/${l.id}${b ? '?from=' + encodeURIComponent(b.bill_number) : ''}`;

// The mail draft about one bill, prefilled with the public ask (same wording as the current app, but the greeting
// uses the surname from sort_name so "David Alcos III" is "Rep. Alcos", not "Rep. III").
export function legMail(l, b) {
  if (!b) return `mailto:${l.email || ''}`;
  const num = b.bill_number.replace(/^(\D+)/, '$1 '), ask = (b.public_action || '').trim();
  const subj = `${num}${ask ? ': ' + ask.slice(0, 60) : ''}`;
  const body = `Aloha ${legTitle(l)} ${surname(l)},\n\nI am writing about ${num}, ${blurb(b, 120)}\n\n${ask ? ask + '\n\n' : ''}Mahalo,\nHawaiʻi Public Health Institute`;
  return `mailto:${l.email || ''}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
}

// One short status line for a bill row: the hearing when there is one, else where it waits.
export function billSub(b) {
  if (diedish(b)) { const m = /^(.*?)\s+(\d+\/\d+)\/\d+$/.exec(b.died_deadline || ''); return m ? `Did not advance: missed ${m[1]} ${m[2]}` : `Did not advance: ${whyDead(b).replace(/<[^>]+>/g, '').replace(/\.$/, '').replace(/^./, c => c.toLowerCase())}`; }
  const h = hearingAhead(b);
  if (h) return `Hearing ${fmtDT(h.scheduled_at)} · ${h.committee}`;
  const st = stopOf(b);
  if (st.phase === 'committee') {
    if (st.hearingState === 'held') return `Heard in ${st.committee}, waiting for its report`;
    const r = riskOf(b);
    if (r) return `At risk: needs a hearing in ${st.committee || 'committee'} by ${fmtDate(r.deadline.date)}`;
    return st.committee ? `Waiting for a hearing in ${st.committee}` : `Waiting for a ${CHAMBER_NAME[st.chamber] || ''} committee referral`;
  }
  if (st.phase === 'floor') return `Through ${CHAMBER_NAME[st.chamber]} committees, waiting for a floor vote`;
  if (st.phase === 'conference') return 'In conference';
  if (st.phase === 'governor') return 'At the governor';
  if (st.phase === 'law') return 'Law';
  return st.says || '';
}

// ---- stances ----
// The stance chip is a button (44px) that opens the stance sheet: tap a stance and it saves and closes, with Undo.
// The note and the teammate who knows them save as they change, and on close, so nothing typed is lost.
export const stanceChip = (b, l, extra = {}) => {
  const x = stanceOf(b.id, l.id);
  return pickerChip(STANCE_WORD[x.stance] || 'Unknown', { 'data-lgst': `${b.id}|${l.id}`, 'aria-label': `${shortName(l)} on ${b.bill_number}: ${STANCE_WORD[x.stance] || 'Unknown'}. Change`, ...extra }, STANCE_ICON[x.stance] || 'circle-dashed');
};
export function openStance(b, l, { redraw = () => hooks.render() } = {}) {
  const x = stanceOf(b.id, l.id), before = { stance: x.stance, note: x.note ?? null, contact_id: x.contact_id ?? null };
  const by = x.updated_by && advocate(x.updated_by);
  const team = S.advocates.filter(a => a.is_active !== false);
  let done = false;
  const read = d => ({ note: d.querySelector('#lg-stnote').value.trim() || null, contact_id: d.querySelector('#lg-stwho').value || null });
  const dirty = v => (v.note || null) !== (before.note || null) || (v.contact_id || null) !== (before.contact_id || null);
  const save = async (patch, msg) => {
    try { await DB.setStance(b.id, l.id, patch); }
    catch (e) { toast(e, { err: true }); return; }
    redraw();
    toast(msg, { ok: true, undo: async () => { await DB.setStance(b.id, l.id, before); redraw(); toast('Undone.'); } });
  };
  openSheet({
    title: `${esc(shortName(l))} on ${esc(billNum(b))}`, size: 'auto',
    body: `<div class="lg-stsheet">
      ${by ? `<p class="small muted">Last set by ${esc(by.full_name.split(' ')[0])} ${esc(fmtDate(x.updated_at))}</p>` : ''}
      <div class="sv-pickl" role="radiogroup" aria-label="Where they stand">${STANCES.map(([v, label]) => `<button type="button" role="radio" aria-checked="${v === x.stance}" data-lgsv="${v}">${icon(STANCE_ICON[v])}<span class="body"><span class="title">${esc(label)}</span></span>${v === x.stance ? icon('check', { cls: 'on' }) : ''}</button>`).join('')}</div>
      <div class="field"><label for="lg-stnote">Note on ${esc(b.bill_number)}, team only</label><textarea id="lg-stnote" rows="2" maxlength="300" autocapitalize="sentences" placeholder="What they said, what they want">${esc(x.note || '')}</textarea></div>
      <div class="field"><label for="lg-stwho">Who on our team knows them</label><select id="lg-stwho"><option value="">No one yet</option>${team.map(a => `<option value="${esc(a.id)}"${a.id === x.contact_id ? ' selected' : ''}>${esc(a.full_name)}</option>`).join('')}</select></div>
    </div>`,
    foot: btn('Done', { attrs: { 'data-lgstdone': '1' } }),
    wire: d => {
      // Closing by ×, Back, Esc, the backdrop or another sheet keeps a note that was typed but not yet saved.
      const flush = () => { if (done) return; const v = read(d); if (dirty(v)) { done = true; save({ stance: before.stance, ...v }, 'Note saved.'); } };
      d.addEventListener('close', flush);
      d.querySelectorAll('[data-lgsv]').forEach(el => el.onclick = () => {
        const v = read(d), stance = el.dataset.lgsv; done = true; closeSheet({ silent: true });
        if (stance === before.stance && !dirty(v)) return;
        save({ stance, ...v }, `${shortName(l)}: ${STANCE_WORD[stance].toLowerCase()} on ${b.bill_number}.`);
      });
      d.querySelector('[data-lgstdone]').onclick = () => { flush(); done = true; closeSheet({ silent: true }); };
    },
  });
}
// Stance chips anywhere inside root open the sheet (delegated, so rows painted later work too).
export function wireStances(root) {
  if (!root || root.__lgst) return; root.__lgst = true;
  root.addEventListener('click', e => {
    const el = e.target.closest('[data-lgst]'); if (!el || !root.contains(el)) return;
    e.preventDefault(); e.stopPropagation();
    const [bid, lid] = el.dataset.lgst.split('|'), b = S.bills.find(x => String(x.id) === bid), l = (S.legislators || []).find(x => x.id === Number(lid));
    if (b && l) openStance(b, l);
  });
}
// In-app links painted after the frame wired the page still push history (so Back and the back link work).
export function wireLinks(root) {
  if (!root || root.__lglinks) return; root.__lglinks = true;
  root.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#/"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault(); S.go(a.getAttribute('href'));
  });
}
// "3 yes · 1 leaning · 5 unknown": only the parts that are not zero, in a fixed order
export function tally(b, members) {
  const c = { yes: 0, leaning_yes: 0, leaning_no: 0, no: 0, unknown: 0 };
  for (const m of members) c[stanceOf(b.id, m.l.id).stance]++;
  const words = [['yes', 'yes'], ['leaning_yes', 'leaning'], ['leaning_no', 'leaning no'], ['no', 'no'], ['unknown', 'unknown']];
  const text = words.filter(([k]) => c[k]).map(([k, w]) => `${c[k]} ${w}`).join(' · ');
  return { c, text, full: `Yes ${c.yes}, leaning yes ${c.leaning_yes}, leaning no ${c.leaning_no}, no ${c.no}, unknown ${c.unknown}, of ${members.length}` };
}

// ---- the pathway ----
const STATE = { passed: ['circle-check', 'Passed'], current: ['circle-dot', 'Now'], next: ['circle', 'Next'], predicted: ['circle-dashed', 'Likely'], ended: ['circle-minus', 'Outcome not recorded'] };
export function renderPathway(b) {
  if (!b) return '';
  const st = stopOf(b);
  const comp = (b.companions || []).map(n => S.bills.find(x => x.bill_number === String(n).replace(/\s/g, ''))).find(Boolean);
  const compRefs = comp && comp.chamber !== b.chamber ? (comp.referrals || []).slice(0, comp.origin_stops || undefined) : null;
  const stops = pathwayStops(b, st, S.counterparts || [], compRefs), desk = DESK();
  const intro = legsForSponsors(b), nSp = (b.sponsors || []).length;
  const introLine = intro.length ? `<p class="lg-pwintro">Introduced by ${intro.slice(0, 3).map(l => `<a href="${legHref(l, b)}">${esc(shortName(l))}</a>`).join(', ')}${nSp > 3 ? ` and ${nSp - 3} more` : ''}. The first name is the lead introducer.</p>` : '';
  if (!stops.length) return `<div class="lg-pw" data-lgpw="${esc(b.id)}">${introLine}<p class="lg-pwnone">No committee referral yet, so there is no one to work on until the Capitol posts one.</p></div>`;
  // Only the Now stop starts open (the first Next one when nothing is Now, e.g. waiting for a referral).
  const firstOpen = stops.findIndex(s => s.state === 'current') >= 0 ? stops.findIndex(s => s.state === 'current') : stops.findIndex(s => s.state === 'next');
  const predFrom = comp && stops.some(s => s.state === 'predicted' && s.from === 'companion') ? `Likely next (from ${esc(comp.bill_number)})` : 'Likely next (the usual path)';
  let shownPred = false;
  const blocks = stops.map((s, i) => {
    const members = legsOf(s.committee), joint = codesOf(s.committee).length > 1;
    const key = `${b.id}|${s.chamber}${s.stop}|${s.committee}`, open = (S.pwOpen || {})[key] ?? i === firstOpen;
    const [ic, word] = STATE[s.state] || STATE.next;
    const h0 = s.state === 'current' ? hearingAhead(b) : null, h = h0 && codesOf(h0.committee).some(c => codesOf(s.committee).includes(c)) ? h0 : null;
    const chairs = members.filter(m => m.role === 'chair');
    const chairText = chairs.length ? (joint ? `Chairs ${chairs.map(m => `${surname(m.l)} (${Object.entries(m.roles).filter(([, r]) => r === 'chair').map(([c]) => c).join('/')})`).join(', ')}` : `Chair ${shortName(chairs[0].l)}`) : '';
    const meta = [s.committee, `${CHAMBER_NAME[s.chamber]} stop ${s.stop} of ${s.of}`, joint ? 'joint hearing' : '', h ? `hearing ${fmtDT(h.scheduled_at)}` : '', !open ? chairText : ''].filter(Boolean).join(' · ');
    const t = members.length && s.state !== 'passed' ? tally(b, members) : null;
    const head = !shownPred && s.state === 'predicted' ? (shownPred = true, `<p class="lg-pwpred">${predFrom}</p>`) : '';
    return `${head}<section class="lg-stop is-${s.state}">
      <h3 class="lg-stoph"><button type="button" class="lg-stopbtn" data-lgfold="${esc(key)}" aria-expanded="${open}" aria-controls="lg-sb-${i}">
        <span class="lg-l1"><span class="lg-stopst">${icon(ic)}${word}</span><span class="lg-stopname">${esc(cmteName(s.committee))}</span></span>
        <span class="lg-l2"><span class="lg-stopmeta">${esc(meta)}</span>${t ? `<span class="lg-tally" title="${esc(t.full)}"><span class="sr">${esc(t.full)}</span><span aria-hidden="true">${esc(t.text)}</span></span>` : ''}</span>
        ${icon(open ? 'chevron-up' : 'chevron-down', { cls: 'lg-chev' })}
      </button></h3>
      <div class="lg-stopbody" id="lg-sb-${i}"${open ? '' : ' hidden'}>${!members.length ? '<p class="lg-pwnone">No member list for this committee yet.</p>' : desk ? memberTable(b, s, members, joint, i) : members.map(m => memberRow(b, m, joint)).join('')}</div>
    </section>`;
  }).join('');
  return `<div class="lg-pw" data-lgpw="${esc(b.id)}">
    <p class="lg-pwhelp">Chairs decide whether a bill is heard; members vote. Stances are for the team only.</p>
    ${introLine}${blocks}</div>`;
}
// One member (56px): name as a link to their page (with the way back to this bill), a Chair or Vice chip, the stance
// chip, and an email button prefilled with the public ask. On a joint stop a leadership role names its committee,
// and a member of only one of the two committees says which ("HSH only").
function memberRow(b, m, joint) {
  const l = m.l, x = stanceOf(b.id, l.id), who = x.contact_id && advocate(x.contact_id);
  const lead = Object.entries(m.roles).filter(([, r]) => r !== 'member');
  const roleChip = !joint ? (m.role === 'member' ? '' : chip(roleWord(m.role))) : lead.map(([c, r]) => chip(`${roleWord(r)}, ${c}`)).join('');
  const only = joint && !lead.length && Object.keys(m.roles).length === 1 ? `${Object.keys(m.roles)[0]} only` : '';
  const sub = [partyDist(l), only, who ? `${who.full_name.split(' ')[0]} knows them` : ''].filter(Boolean).join(' · ');
  // A stop sits in one chamber, so the name drops "Rep."/"Sen." here (the screen reader still hears it).
  return `<div class="lg-mem${m.role !== 'member' ? ' lead' : ''}">
    <a class="lg-membody" href="${legHref(l, b)}"><span class="lg-nm"><span class="sr">${esc(legTitle(l))} </span>${esc(l.name)}</span><span class="lg-memsub">${roleChip}<span>${esc(sub)}</span></span>${x.note ? `<span class="lg-memnote">${esc(x.note)}</span>` : ''}</a>
    ${stanceChip(b, l)}
    ${l.email ? `<a class="iconbtn lg-mail" href="${esc(legMail(l, b))}" aria-label="Email ${esc(shortName(l))} about ${esc(b.bill_number)}" title="Email ${esc(shortName(l))}">${icon('mail')}</a>` : '<span class="lg-mail" aria-hidden="true"></span>'}
  </div>`;
}
// ---- desktop: a stop's members as a table (build 3) ----
// Name, role, stance, and the team's note with who knows them. Leadership comes first, because chairs decide; the
// Name, Role and Stance headers sort (one order for every stop), so "who is still unknown?" is one click. The stance
// chip opens a small picker beside itself and saves on the click, with Undo; the note cell opens the note sheet.
// Where the column is narrow (bill.css asks the panel's width) the Role and Note columns fold into the name cell.
const DESK = () => { try { return matchMedia('(min-width: 900px)').matches; } catch { return false; } };
const ST_ORDER = { yes: 0, leaning_yes: 1, unknown: 2, leaning_no: 3, no: 4 };
const PW_COLS = [['name', 'Name'], ['role', 'Role'], ['stance', 'Stance']];
function sortedMembers(b, members) {
  const s = S.pwSort; if (!s) return members;                  // legsOf lists leadership first, then by name
  const val = m => s.key === 'name' ? String(m.l.sort_name || m.l.name) : s.key === 'stance' ? ST_ORDER[stanceOf(b.id, m.l.id).stance] : RANK[m.role];
  return members.map((m, i) => [m, i]).sort(([x, i], [y, j]) => { const a = val(x), c = val(y); return (a < c ? -1 : a > c ? 1 : 0) * s.dir || i - j; }).map(([m]) => m);
}
function memberTable(b, stop, members, joint, i) {
  const s = S.pwSort || { key: 'role', dir: 1 };
  const th = ([key, label]) => { const on = s.key === key;
    return `<th scope="col" class="bw-pwc-${key}" aria-sort="${on ? (s.dir > 0 ? 'ascending' : 'descending') : 'none'}"><button type="button" class="bw-sortb" data-pwsort="${key}" data-pwtab="${i}">${label}${on ? icon(s.dir > 0 ? 'chevron-up' : 'chevron-down') : ''}</button></th>`; };
  return `<table class="bw-pwt"><caption class="sr">${esc(cmteName(stop.committee))}: members and where they stand on ${esc(b.bill_number)}</caption>
    <thead><tr>${PW_COLS.map(th).join('')}<th scope="col" class="bw-pwc-note">Note and contact</th><th scope="col" class="bw-pwc-act"><span class="sr">Note and email</span></th></tr></thead>
    <tbody>${sortedMembers(b, members).map(m => memberTr(b, m, joint)).join('')}</tbody></table>`;
}
function memberTr(b, m, joint) {
  const l = m.l, x = stanceOf(b.id, l.id), who = x.contact_id && advocate(x.contact_id), by = x.updated_by && advocate(x.updated_by);
  const lead = Object.entries(m.roles).filter(([, r]) => r !== 'member');
  const role = !joint ? roleWord(m.role) : lead.length ? lead.map(([c, r]) => `${roleWord(r)}, ${c}`).join(' · ') : 'Member';
  const only = joint && !lead.length && Object.keys(m.roles).length === 1 ? `${Object.keys(m.roles)[0]} only` : '';
  const key = `${b.id}|${l.id}`, word = STANCE_WORD[x.stance] || 'Unknown';
  // When it was last touched and by whom stands in for "last contact": the note is where a contact gets written down.
  const meta = [who ? `${who.full_name.split(' ')[0]} knows them` : '', by && (x.note || who) ? `${by.id === S.me?.id ? 'You' : by.full_name.split(' ')[0]}, ${fmtDate(x.updated_at)}` : ''].filter(Boolean).join(' · ');
  const noteLabel = `${x.note || who ? 'Edit the note' : 'Add a note'} on ${shortName(l)} for ${b.bill_number}`;
  return `<tr class="${m.role !== 'member' ? 'lead' : ''}">
    <th scope="row" class="bw-pwc-name"><a class="bw-pwnm" href="${legHref(l, b)}"><span class="sr">${esc(legTitle(l))} </span>${esc(l.name)}</a>
      <span class="bw-pwsub">${m.role !== 'member' || (joint && lead.length) ? `<span class="bw-pwfold">${esc(role)} · </span>` : ''}${esc([partyDist(l), only].filter(Boolean).join(' · '))}</span>
      ${x.note || meta ? `<span class="bw-pwfold bw-pwinl">${esc([x.note, meta].filter(Boolean).join(' · '))}</span>` : ''}</th>
    <td class="bw-pwc-role">${esc(role)}</td>
    <td class="bw-pwc-stance">${pickerChip(word, { 'data-pwst': key, 'aria-haspopup': 'dialog', 'aria-label': `${shortName(l)} on ${b.bill_number}: ${word}. Change` }, STANCE_ICON[x.stance] || 'circle-dashed')}</td>
    <td class="bw-pwc-note"><button type="button" class="bw-pwnote${x.note || meta ? '' : ' none'}" data-pwnote="${key}" aria-label="${esc(noteLabel)}"${x.note ? ` title="${esc(x.note)}"` : ''}>
      ${x.note ? `<span class="bw-pwntx">${esc(x.note)}</span>` : ''}${meta ? `<span class="bw-pwmeta">${esc(meta)}</span>` : ''}${x.note || meta ? '' : `${icon('plus')}<span>Add a note</span>`}</button></td>
    <td class="bw-pwc-act"><button type="button" class="iconbtn bw-pwfold" data-pwnote="${key}" aria-label="${esc(noteLabel)}" title="${x.note || who ? 'Edit the note' : 'Add a note'}">${icon('notebook-pen')}</button>${l.email ? `<a class="iconbtn" href="${esc(legMail(l, b))}" aria-label="Email ${esc(shortName(l))} about ${esc(b.bill_number)}" title="Email ${esc(shortName(l))}">${icon('mail')}</a>` : ''}</td>
  </tr>`;
}
function pickStance(b, l) {
  const x = stanceOf(b.id, l.id), before = { stance: x.stance, note: x.note ?? null, contact_id: x.contact_id ?? null }, sel = `[data-pwst="${b.id}|${l.id}"]`;
  pickerSheet({ title: `${shortName(l)} on ${billNum(b)}`, value: x.stance, options: STANCES.map(([v, label]) => [v, label, STANCE_ICON[v]]),
    onPick: async v => {
      if (v === before.stance) return;
      try { await DB.setStance(b.id, l.id, { ...before, stance: v }); } catch (e) { toast(e, { err: true }); return; }
      rerender(sel);
      toast(`${shortName(l)}: ${STANCE_WORD[v].toLowerCase()} on ${b.bill_number}.`, { ok: true, undo: async () => { await DB.setStance(b.id, l.id, before); rerender(sel); toast('Undone.'); } });
    } });
}
function wireTable(pw, b) {
  const find = key => { const [bid, lid] = String(key).split('|'); return String(b.id) === bid ? (S.legislators || []).find(x => x.id === Number(lid)) : null; };
  pw.querySelectorAll('[data-pwst]').forEach(el => el.onclick = () => { const l = find(el.dataset.pwst); if (l) pickStance(b, l); });
  pw.querySelectorAll('[data-pwnote]').forEach(el => el.onclick = () => { const l = find(el.dataset.pwnote), k = el.dataset.pwnote;
    // Back to the control that opened it: the note cell when it shows, else the small note button (narrow columns).
    if (l) openStance(b, l, { redraw: () => rerender(el.classList.contains('iconbtn') ? `.iconbtn[data-pwnote="${k}"]` : `.bw-pwnote[data-pwnote="${k}"]`) }); });
  pw.querySelectorAll('[data-pwsort]').forEach(el => el.onclick = () => {
    const key = el.dataset.pwsort, cur = S.pwSort || { key: 'role', dir: 1 };
    S.pwSort = { key, dir: cur.key === key ? -cur.dir : 1 };
    rerender(`[data-pwsort="${key}"][data-pwtab="${el.dataset.pwtab}"]`);
  });
}
export function wirePathway(root, b) {
  const pw = root && (root.matches?.('.lg-pw') ? root : root.querySelector('.lg-pw'));
  if (!pw) return;
  wireStances(pw); wireLinks(pw); wireTable(pw, b);
  // Folding changes only this stop (no re-render), and is remembered for this visit.
  pw.querySelectorAll('[data-lgfold]').forEach(el => el.onclick = () => {
    const open = el.getAttribute('aria-expanded') !== 'true';
    (S.pwOpen ??= {})[el.dataset.lgfold] = open;
    el.setAttribute('aria-expanded', String(open));
    const body = document.getElementById(el.getAttribute('aria-controls')); if (body) body.hidden = !open;
    const chev = el.querySelector('.lg-chev'); if (chev) chev.outerHTML = icon(open ? 'chevron-up' : 'chevron-down', { cls: 'lg-chev' });
  });
}
