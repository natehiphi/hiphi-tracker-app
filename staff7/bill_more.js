// The bill page's smaller parts (R-398), apart from bill.js so that file stays about the page itself: who the chair is and whether anyone asked, what comes after this committee, the public site's row,
// the talking points, and the closed "More from the Capitol’s page" section. Everything is read from data already in memory (the history only when it has landed); nothing here writes.
import { S, SESSION_YEAR, capitolUrl } from '../staff6/data.js';
import { stopOf, chairIdsOf, titleCaseTitle, sharePageUrl } from '../staff6/model.js';
import { ic } from './icons7.js';
import { esc, btn, toast } from './parts.js';
import { first } from './steps.js';
import { whenWords } from './words.js';
import { codesOf, cmtesLinks, http, dateY, ymdH, ext } from './bill_words.js';
import { cmteMarks } from './bill_tl.js';
import { known, followersOf } from './bill_data.js';
import { bui } from './bill.js';
import { eCig } from './issues.js';

const enc = encodeURIComponent;
const num = b => String(b.bill_number).replace(/\s/g, '');
const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
const chamberOf = b => /^S/i.test(num(b)) ? 'Senate' : 'House';

// ---------------------------------------------------------------------------------- after this committee
// The committees still ahead in the chamber the bill is in, after the one it is in: refs of those, or null when the data cannot place the bill in a committee
export function remainingCmtes(b) {
  const { refs, marks, hi } = cmteMarks(b), at = marks.map((m, i) => m === 'now' ? i : -1).filter(i => i >= 0);
  if (!at.length) return null;
  return refs.slice(at[at.length - 1] + 1, hi);
}
// "After this: <next committee>, which must hear it by <date>", or "After this: the House floor vote" when the committee it is in is the last one. '' when the data cannot say.
export function afterHTML(b) {
  const rest = remainingCmtes(b); if (!rest) return '';
  if (rest.length) { const st = stopOf(b), dl = st.deadline && !st.deadline.missed ? st.deadline : null; return `After this: ${cmtesLinks(rest[0], b)}${dl ? `, which must hear it by ${esc(whenWords(dl.date))}` : ''}`; }
  const st = stopOf(b), ch = st.leg === 'second' ? (chamberOf(b) === 'Senate' ? 'House' : 'Senate') : chamberOf(b);
  return `After this: the ${ch} floor vote`;
}
// "2 more committees after this one: House X, then House Y." ('' when none are left)
export function moreAfterHTML(b) {
  const rest = remainingCmtes(b); if (!rest || !rest.length) return '';
  return `${n(rest.length, 'more committee', 'more committees')} after this one: ${rest.map(r => cmtesLinks(r, b)).join(', then ')}.`;
}

// ---------------------------------------------------------------------------------- the chair, and whether anyone asked
const lastOf = l => String(l.sort_name || l.name).split(',')[0].trim();
const legById = id => (S.legislators || []).find(l => String(l.id) === String(id));
// "Chair: Rep. Hashem (Room 421, 808-586-6510)", "Chairs: A and B" for a joint committee; '' when the data names no chair
export function chairsHTML(code) {
  const ids = [...new Set(codesOf(code).flatMap(c => chairIdsOf(c)).map(String))], ls = ids.map(legById).filter(Boolean); if (!ls.length) return '';
  const one = l => {
    const nm = `<a class="lk" href="#/search/person/${enc(l.id)}">${esc(`${l.chamber === 'S' ? 'Sen.' : 'Rep.'} ${lastOf(l)}`)}</a>`;
    const tel = String(l.phone || '').trim(), how = [l.room ? `Room ${esc(l.room)}` : '', tel ? `<a class="lk" href="tel:${esc(tel.replace(/[^\d+]/g, ''))}">${esc(tel)}</a>` : ''].filter(Boolean).join(', ');
    return `${nm}${how ? ` (${how})` : ''}`;
  };
  const names = ls.map(one);
  return `${ls.length > 1 ? 'Chairs' : 'Chair'}: ${names.length < 3 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`}`;
}
// "Kris asked the chair’s office on Thu, Mar 12", from the legislator notes of this bill that are chair asks (the newest); '' until the history has come, or when nobody has asked
export function askedWords(b, code) {
  const cs = codesOf(code), rows = known(b).asks.filter(r => !r.committee || !cs.length || codesOf(r.committee).some(c => cs.includes(c)));
  const r = rows.slice().sort((p, q) => String(q.met_on || q.created_at).localeCompare(String(p.met_on || p.created_at)))[0]; if (!r) return '';
  const who = S.advocates.find(a => a.id === r.advocate_id), day = r.met_on ? dateY(String(r.met_on).slice(0, 10)) : dateY(ymdH(r.created_at));
  return `${who ? first(who) : 'Someone'} asked the ${cs.length > 1 ? 'chairs’ offices' : 'chair’s office'} on ${day}`;
}

// ---------------------------------------------------------------------------------- the facts
// Whether the bill is on the public site, and what shows there: read only
export function publicHTML(b) {
  if (!b.is_public) return 'No';
  const f = followersOf(b), act = String(b.public_action || '').replace(/\s+/g, ' ').trim(), until = String(b.public_action_until || '').slice(0, 10);
  const parts = [esc(b.public_summary && String(b.public_summary).trim() ? 'Yes, with this summary' : 'Yes')];
  if (f != null) parts.push(esc(`${n(f, 'person follows', 'people follow')} it`));
  parts.push(act ? `Ask: ${esc(eCig(act))}${until ? ` until ${esc(dateY(until))}` : ''}` : 'no ask is set');
  return parts.join(' · ') + ` · ${btn('Copy the share link', { kind: 'text', attrs: `data-bshare="${esc(b.id)}"` })}`;
}
export async function copyShare(b) {
  const url = sharePageUrl(b);
  try { await navigator.clipboard.writeText(url); toast('Link copied'); }
  catch {
    try { const t = document.createElement('textarea'); t.value = url; t.setAttribute('readonly', ''); t.className = 'sr'; document.body.appendChild(t); t.select(); const ok = document.execCommand('copy'); t.remove(); toast(ok ? 'Link copied' : 'We could not copy the link.'); }
    catch { toast('We could not copy the link.'); }
  }
}
// The talking points: "Show N" opens them in place, "Show fewer" closes them; open is kept in bui
export function talkingHTML(b) {
  const pts = (Array.isArray(b.talking_points) ? b.talking_points : []).map(x => String(x?.text ?? x ?? '').trim()).filter(Boolean); if (!pts.length) return '';
  const open = bui.talk.has(b.id);
  return `${btn(open ? 'Show fewer' : `Show ${pts.length}`, { kind: 'text', attrs: `data-btalk="${esc(b.id)}" data-n="${pts.length}" aria-expanded="${open}" aria-controls="bTalk" aria-label="${open ? 'Show fewer' : `Show ${pts.length}`} talking points"` })}<ul class="btalk" id="bTalk"${open ? '' : ' hidden'}>${pts.map(t => `<li>${esc(eCig(t))}</li>`).join('')}</ul>`;
}

// ---------------------------------------------------------------------------------- More from the Capitol’s page
// The Capitol keeps each draft as its own page: the current one, each earlier draft the history names (HD 1, SD 1), and the bill as introduced. v: undefined = the current one, '' = as introduced, 'HD1' = that draft.
export function billTextUrl(b, v) {
  const m = /^([A-Z]+)(\d+)$/.exec(String(b?.bill_number || '').toUpperCase().replace(/\s/g, '')); if (!m) return capitolUrl(b);
  const ver = v === undefined ? (/^(HD|SD|CD|FD)\d{1,2}$/.test(b.current_version || '') ? b.current_version : '') : v;
  return `https://www.capitol.hawaii.gov/sessions/session${b.session_year || SESSION_YEAR}/bills/${m[1]}${m[2]}_${ver ? `${ver}_` : ''}.HTM`;
}
const spaceVer = v => String(v || '').replace(/^(HD|SD|CD|FD)(\d+)$/, '$1 $2');
// the drafts the Capitol's lines in memory name, oldest first ("HD1"), less the current one
function earlierDrafts(b, tl) {
  const cur = String(b.current_version || ''), out = [];
  for (const r of tl || []) { if (r.advocate_id && r.source !== 'auto') continue; for (const m of String(r.title || '').matchAll(/\b(HD|SD|CD|FD)\s?(\d{1,2})\b/g)) { const v = `${m[1]}${m[2]}`; if (v !== cur && !out.includes(v)) out.push(v); } }
  return out;
}
export function capitolHTML(b, tl) {
  const open = bui.cap.has(b.id), cur = /^(HD|SD|CD|FD)\d{1,2}$/.test(b.current_version || '') ? b.current_version : '';
  const rows = [];
  if (b.title) rows.push(['Official title', esc(titleCaseTitle(String(b.title)))]);
  const desc = String(b.description || '').replace(/\s+/g, ' ').replace(/\s*\((?:HD|SD|CD|FD)\s?\d{1,2}\)\s*$/, '').trim();   // the draft tag the Capitol ends it with can disagree with the version shown beside it
  if (desc) rows.push(['The Capitol’s description', esc(eCig(desc))]);
  const links = [];
  if (cur) links.push(ext(billTextUrl(b), `${spaceVer(cur)}, the current one`));
  for (const v of earlierDrafts(b, tl).reverse()) links.push(ext(billTextUrl(b, v), spaceVer(v)));
  links.push(ext(billTextUrl(b, ''), 'As introduced'));
  rows.push(['Versions', http(billTextUrl(b, '')) ? links.join(' · ') : '']);
  const kv = `<dl class="kv bfacts" id="bCapKv"${open ? '' : ' hidden'}>${rows.filter(r => r[1]).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
  return `<section class="bcap" id="bCap2" aria-label="More from the Capitol’s page"><button class="bcapb" type="button" id="bCapBtn" aria-expanded="${open}" aria-controls="bCapKv"><span class="bchev" aria-hidden="true">${ic(open ? 'chevron-down' : 'chevron-right')}</span><span class="bcapn">More from the Capitol’s page</span><span class="bcaph"${open ? ' hidden' : ''}>official title, description, versions</span></button>${kv}</section>`;
}

export function bindMore() {
  document.querySelectorAll('button[data-btalk]').forEach(bt => bt.addEventListener('click', () => {
    const on = bt.getAttribute('aria-expanded') !== 'true', id = bt.dataset.btalk, k = bt.dataset.n, label = on ? 'Show fewer' : `Show ${k}`;
    if (on) bui.talk.add(id); else bui.talk.delete(id);
    bt.setAttribute('aria-expanded', String(on)); bt.textContent = label; bt.setAttribute('aria-label', `${label} talking points`);
    document.getElementById('bTalk')?.toggleAttribute('hidden', !on);
  }));
  document.querySelectorAll('button[data-bshare]').forEach(bt => bt.addEventListener('click', () => { const b = (S.bills || []).find(x => x.id === bt.dataset.bshare); if (b) copyShare(b); }));
  const cb = document.getElementById('bCapBtn');
  if (cb) cb.addEventListener('click', () => {
    const on = cb.getAttribute('aria-expanded') !== 'true', id = bui.ctx?.b.id;
    if (id) { if (on) bui.cap.add(id); else bui.cap.delete(id); }
    cb.setAttribute('aria-expanded', String(on)); document.getElementById('bCapKv')?.toggleAttribute('hidden', !on); cb.querySelector('.bcaph')?.toggleAttribute('hidden', on);
    const ch = cb.querySelector('.bchev'); if (ch) ch.innerHTML = ic(on ? 'chevron-down' : 'chevron-right');
  });
}
