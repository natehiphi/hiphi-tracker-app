// A bill the team does not track, read-only, with a Track button (R-058, Nate 10/5: "Go as recommended": a read-only staff page for any
// bill, instead of tracking every bill). The staff app holds only the tracked bills, so #/bill/HB2121 for any other bill used to say "is
// not on our list". Now the page reads that one bill (and its hearings: the sync records them for every bill, R-059) and shows what the
// Capitol has: where it stands, its last action, its committees, who introduced it, its hearings, and the links. Nothing on it can be
// edited; the one primary button, "Track this bill", makes it the team's (then the full page opens, to set a position and an owner).
import { S, DB, DEMO, SESSION_YEAR, STAGE_LABEL, esc, fmtDate, fmtDT, capitolUrl, sponsorText, hooks } from './data.js';
import { cmteName, billRoute, titleCaseTitle } from './model.js';
import { icon, btn, empty, toast, skeleton } from './ui.js';

const keyOf = r => `${r.year || ''}/${String(r.num || '').replace(/\s/g, '').toUpperCase()}`;
S.untr ??= new Map();   // key -> 'loading' | 'none' | 'error' | { b, hearings }
const PUBLIC_APP = () => `${location.origin}${location.pathname.replace(/(staff|index)\.html$/, '')}track.html`;

// Starts the read once; the screen draws again when it lands.
function load(route) {
  const k = keyOf(route);
  if (S.untr.has(k)) return S.untr.get(k);
  S.untr.set(k, 'loading');
  DB.untrackedBill(String(route.num).replace(/\s/g, '').toUpperCase(), route.year).then(async b => {
    if (!b) { S.untr.set(k, 'none'); return; }
    let hearings = []; try { hearings = (await DB.billHearings(b.id)).hearings || []; } catch { /* the page still shows the bill */ }
    S.untr.set(k, { b, hearings });
  }).catch(e => { console.warn('untracked bill', e); S.untr.set(k, 'error'); }).finally(() => { if (S.route?.name === 'bill') hooks.render(); });
  return 'loading';
}
export const untrackedOf = route => { const x = S.untr.get(keyOf(route)); return x && typeof x === 'object' ? x.b : null; };

const row = (dt, dd) => dd ? `<div class="bw-dt"><dt>${esc(dt)}</dt><dd>${dd}</dd></div>` : '';
export function untrackedHTML(route, notFound) {
  const got = load(route);
  if (got === 'loading') return `<div class="bw-page ut-page">${skeleton(3)}</div>`;
  if (got === 'none' || got === 'error') return notFound(route, got === 'error');
  const { b, hearings } = got, now = Date.now();
  const num = esc(b.bill_number), title = titleCaseTitle(b.title || '');
  const old = b.session_year && +b.session_year !== +SESSION_YEAR ? ` (${b.session_year} session)` : '';
  const upcoming = hearings.filter(h => h.status !== 'cancelled' && new Date(h.scheduled_at) > now).sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at));
  const past = hearings.filter(h => h.status !== 'cancelled' && new Date(h.scheduled_at) <= now).sort((x, y) => y.scheduled_at.localeCompare(x.scheduled_at)).slice(0, 5);
  const hrow = h => `<li class="bw-ah"><div><p><b>${esc(cmteName(h.committee))}</b></p><p class="small muted">${esc(fmtDT(h.scheduled_at))}${h.room ? ` · ${esc(h.room)}` : ''}</p></div></li>`;
  const refs = (b.referrals || []).length ? esc((b.referrals || []).map(c => cmteName(c)).join(', ')) : '';
  const stage = b.stage ? esc(STAGE_LABEL[b.stage] || b.stage) : '';
  const last = b.last_action ? `${esc(b.last_action)}${b.last_action_date ? ` <span class="muted">· ${esc(fmtDate(b.last_action_date))}</span>` : ''}` : '';
  return `<div class="bw-page ut-page" data-ut="${esc(b.id)}">
    <div class="bw-top"><a class="bw-back" href="#/search?q=${encodeURIComponent(b.bill_number)}" data-back>${icon('chevron-left')}<span>Back</span></a></div>
    <header class="bw-head"><h1 class="bw-num">${num}${esc(old)}</h1><p class="bw-title bw-long">${esc(title)}</p></header>
    <div class="notice info sv-notice ut-note">${icon('eye')}<div><b>The team is not tracking this bill.</b> This is a read-only look at what the Capitol has. Track it to give it a position, an owner and a place on Today.</div>${btn('Track this bill', { icon: 'plus', attrs: { 'data-uttrack': '1' } })}</div>
    <section class="bw-sec" aria-labelledby="ut-h"><h2 id="ut-h">Where it stands</h2>
      <dl class="bw-dl">${row('Stage', stage)}${row('Last action', last)}${row('Committees', refs)}${row('Introduced by', (b.sponsors || []).length ? sponsorText(b) : '')}${row('Companion', (b.companions || []).length ? esc(b.companions.join(', ')) : '')}
      ${row('Links', `<span class="bw-linkrow"><a class="bw-inline" href="${esc(capitolUrl(b))}" target="_blank" rel="noopener">Capitol page${icon('external-link')}</a> <a class="bw-inline" href="${esc(PUBLIC_APP() + (DEMO ? '?demo=1' : '') + '#/bill/' + (old ? b.session_year + '/' : '') + b.bill_number)}" target="_blank" rel="noopener">Public page${icon('external-link')}</a></span>`)}</dl>
    </section>
    ${b.description ? `<section class="bw-sec" aria-labelledby="ut-d"><h2 id="ut-d">What the Capitol says it does</h2><p>${esc(b.description)}</p></section>` : ''}
    <section class="bw-sec" aria-labelledby="ut-hh"><h2 id="ut-hh">Hearings${hearings.length ? ` <span class="bw-n">${upcoming.length + past.length}</span>` : ''}</h2>
      ${upcoming.length ? `<p class="small muted">Coming up</p><ul class="rows bw-allh">${upcoming.map(hrow).join('')}</ul>` : ''}
      ${past.length ? `<p class="small muted">Held</p><ul class="rows bw-allh">${past.map(hrow).join('')}</ul>` : ''}
      ${!upcoming.length && !past.length ? `<p class="small muted">No hearing has been posted for it${DEMO ? ' (the practice copy keeps hearings for tracked bills only)' : ''}.</p>` : ''}
    </section>
  </div>`;
}

export function wireUntracked(route, root) {
  const x = S.untr.get(keyOf(route)); if (!x || typeof x !== 'object') return;
  const h1 = root.querySelector('.sv-hdr .sv-title'); if (h1) h1.textContent = x.b.bill_number;
  const go = root.querySelector('[data-uttrack]'); if (!go) return;
  go.onclick = async () => {
    go.setAttribute('aria-busy', 'true'); go.disabled = true;
    const bill = Object.assign({ ...x.b }, { referrals: x.b.referrals || [], sponsors: x.b.sponsors || [], companions: x.b.companions || [], session_year: x.b.session_year || SESSION_YEAR, position: x.b.position ?? null, priority: x.b.priority ?? null });
    try {
      await DB.track(bill);
      // The hearings the page read join the team's: sign-in reads the tracked bills' only, and DB.track did the same for live.
      S.hearings = S.hearings.filter(h => h.bill_id !== bill.id).concat(x.hearings);
      S.untr.delete(keyOf(route));
      toast(`${bill.bill_number} is now tracked. Set its position and owner.`, { ok: true, undo: async () => { await DB.untrack(bill.id); S.go(`#/search?q=${encodeURIComponent(bill.bill_number)}`, { replace: true }); toast('Not tracked again.'); } });
      S.go(billRoute(bill), { replace: true });
    } catch (e) { go.removeAttribute('aria-busy'); go.disabled = false; toast(e, { err: true }); }
  };
}
