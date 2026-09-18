// ============================================================
// HIPHI Bill Tracker — public watch page (track.html)
// Anyone can search every bill and watch it. A free account (magic link)
// keeps the watchlist across devices and turns on email alerts. Reads only
// the public_* views; the account's own rows are the only thing it writes.
// Layout mirrors the staff home: summary line, Last 72 hours + Recent
// hearings, This week calendar, the three-column board, then the watchlist.
// ============================================================
import { billStop, COLUMNS, BOARD_EXPLAINER, CHAMBER_NAME, hearingStream, pathwayStops } from './stops.js';
const SUPABASE_URL = 'https://eivzjbnygscguqqiiuvh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_uvEtw8ru3zB9lDOxAjzrUA_JEFvKyul';
const DEMO = new URLSearchParams(location.search).has('demo');
const LOCAL_KEY = DEMO ? 'hiphi_watch_ids_demo' : 'hiphi_watch_ids';
// Sandbox (?demo=1): the real 2026 session frozen at Monday March 16, 2026,
// 9:00 HST, from demo/snapshot.json. Same file the staff sandbox uses; no
// account, no network writes, the watchlist lives in this browser only.
const DEMO_ASOF = '2026-03-16T09:00:00-10:00';
if (DEMO) {
  const RD = Date, off = RD.now() - new RD(DEMO_ASOF).getTime();
  window.Date = class extends RD { constructor(...a) { a.length ? super(...a) : super(RD.now() - off); } static now() { return RD.now() - off; } };
}
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const HST = 'Pacific/Honolulu';
const asDate = d => new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(d)) ? d + 'T12:00:00-10:00' : d);   // a date-only value is a Hawaiʻi day
const fmtDate = (d, o) => d ? asDate(d).toLocaleString('en-US', { timeZone: HST, month: 'numeric', day: 'numeric', ...o }) : '';
const fmtDT = d => fmtDate(d, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
const hstDay = d => new Date(d).toLocaleDateString('en-CA', { timeZone: HST });
const toast = (m, err) => { const el = document.createElement('div'); el.className = 'toastmsg' + (err ? ' err' : ''); el.textContent = m; $('#toast').appendChild(el); setTimeout(() => el.remove(), 3600); };
const blurb = (b, n = 110) => { const t = (b.hiphi_summary || b.description || b.title || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).replace(/\s\S*$/, '') + '…' : t; };
const inWhen = iso => { const ms = new Date(iso) - Date.now(); if (ms <= 0) return 'passed'; const h = Math.round(ms / 36e5); return h < 48 ? `in ${h}h` : `in ${Math.ceil(ms / 864e5)}d`; };
const clean = r => (r || 'room TBD').replace(/\s*via videoconference/i, '').replace(/^Conference Room\s+/i, 'Rm ').replace(/^CR\s+/i, 'Rm ');
const STAGE_LABEL = { introduced: 'Introduced', first_triple: '1st Triple', first_lateral: '1st Lateral', first_decking: '1st Decking',
  first_crossover: 'Crossed over', second_triple: '2nd Triple', second_lateral: '2nd Lateral', second_decking: '2nd Decking',
  second_crossover: 'Passed both', conference: 'Conference', governor: 'Governor', enacted: 'Law', vetoed: 'Vetoed', dead: 'Dead' };
// The same stages in plain language, for people who do not live at the Capitol.
const STAGE_PLAIN = { introduced: 'Introduced and waiting for its first committee hearing',
  first_triple: 'In its first committee; a triple-referred bill that must be heard before the Triple Filing deadline',
  first_lateral: 'In a committee of its first chamber; it must be heard before the Lateral deadline',
  first_decking: 'In the money committee of its first chamber; it must be heard before the Decking deadline',
  first_crossover: 'Passed its first chamber; now in the other chamber',
  second_triple: 'In its first committee of the second chamber; it must be heard before the Triple Filing deadline',
  second_lateral: 'In a committee of the second chamber; it must be heard before the Lateral deadline',
  second_decking: 'In the money committee of the second chamber; it must be heard before the Decking deadline',
  second_crossover: 'Passed both chambers; the two versions may need to be reconciled',
  conference: 'House and Senate negotiators are reconciling their versions',
  governor: 'On the Governor’s desk, waiting for signature or veto',
  enacted: 'Signed into law', vetoed: 'Vetoed by the Governor', dead: 'Did not advance this session' };
const RAIL = [['introduced', 'Intro'], ['first_lateral', '1st Lat'], ['first_decking', '1st Deck'], ['first_crossover', 'Cross'],
  ['second_lateral', '2nd Lat'], ['second_decking', '2nd Deck'], ['conference', 'Conf'], ['governor', 'Gov'], ['enacted', 'Law']];
const RAIL_IDX = { introduced: 0, first_triple: 1, first_lateral: 1, first_decking: 2, first_crossover: 3, second_triple: 4, second_lateral: 4,
  second_decking: 5, second_crossover: 5, conference: 6, governor: 7, enacted: 8, vetoed: 7, dead: null };
const COMMITTEE_STAGES = ['introduced', 'first_triple', 'first_lateral', 'first_decking', 'second_triple', 'second_lateral', 'second_decking'];
const SMALL = new Set(['a','an','and','as','at','but','by','for','in','of','on','or','the','to','via','with','nor','per','from']);
const titleCase = t => String(t || '').toLowerCase().split(/\s+/).map((w, i, a) => (i && i < a.length - 1 && SMALL.has(w.replace(/[^a-z]/g, ''))) ? w : w.replace(/(^|[-("'/])([a-z])/g, (m, p, c) => p + c.toUpperCase())).join(' ');
const POS = { strongly_support: 'Strongly supports', support: 'Supports', support_amend: 'Supports with amendments', strongly_oppose: 'Strongly opposes', oppose: 'Opposes', neutral: 'Comments', monitor: 'Monitoring' };
const OUTCOME_LABEL = { passed: 'Passed', passed_amended: 'Passed with amendments', deferred: 'Deferred', recommitted: 'Recommitted' };
const OUTCOME_CLS = { passed: 'c-green', passed_amended: 'c-gold', deferred: 'c-red', recommitted: 'c-gray' };
const billNum = b => b.bill_number + (b.current_version ? ' ' + b.current_version : '');
// Coalitions keep their internal name as the key; the public sees public_name.
const cname = n => (S.coalitions || []).find(c => c.name === n)?.public_name || n;
// Tiles are grouped by public name: two internal coalitions can share one tile.
function groups() {
  const g = {};
  for (const c of S.coalitions || []) { const k = c.public_name || c.name; const x = g[k] ??= { key: k, names: [], icon: c.icon, description: c.description, bills: 0, live: 0, sort_order: c.sort_order || 99 };
    x.names.push(c.name); x.bills += c.bills || 0; x.live += c.live || 0; x.icon = x.icon || c.icon; x.description = x.description || c.description; x.sort_order = Math.min(x.sort_order, c.sort_order || 99); }
  return Object.values(g);
}
const groupNames = k => (groups().find(g => g.key === k || g.names.includes(k)) || { names: [k] }).names;
const SHORTCUTS = [
  ['/', 'Jump to search'], ['j / k', 'Next / previous bill on the page'], ['Enter', 'Open the highlighted bill'],
  ['Esc', 'Close the bill, or clear the search'], ['w', 'Watch / unwatch the open or highlighted bill'],
  ['c', 'Copy a link to the open bill'], ['n / p', 'Next / previous week on the calendar'],
  ['g then h', 'Go home'], ['?', 'This help page'],
];

const S = { supa: null, session: null, user: null, watch: new Set(), bills: [], hearings: [], activity: [], deadlines: [],
  committees: {}, coalitions: [], outcomes: {}, view: 'home', q: '', results: null, browse: null, open: null, weekOffset: 0,
  extra: {}, xh: {}, slots: [], done: new Set(), actionCounts: {}, helper: null, lists: [], listFollows: new Set(), listBills: {}, listSlug: null, consentCard: false, legislators: [], committeeMembers: [], counterparts: [], legQ: '', legPick: null, legOpen: null, mailOpen: null };
const LISTS_KEY = DEMO ? 'hiphi_list_follows_demo' : 'hiphi_list_follows';
const CONSENT_KEY = 'hiphi_consent_pending';

// ---------------- data ----------------
async function init() {
  if (DEMO) { await demoLoad(); return; }
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  S.supa = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data } = await S.supa.auth.getSession(); S.session = data.session;
  S.supa.auth.onAuthStateChange((_e, sess) => { const had = !!S.session; S.session = sess; if (!!sess !== had) boot(); });
}
// ---------------- sandbox data ----------------
const D = { bills: [], index: [], hearings: [], activity: [], outcomes: [], lists: [], listBills: [] };
async function demoLoad() {
  const snap = await (await fetch('demo/snapshot.json', { cache: 'force-cache' })).json();
  const campName = Object.fromEntries(snap.campaigns.map(c => [c.id, c]));
  const coalOf = {}; for (const r of snap.billCampaigns) { const c = campName[r.campaign_id]; if (c?.is_public) (coalOf[r.bill_id] ??= []).push(c.name); }
  const seed = id => [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  // Shape tracked bills like public_all_bills; every tracked bill is public.
  D.bills = snap.bills.map(b => ({ id: b.id, bill_number: b.bill_number, session_year: b.session_year, chamber: b.chamber, title: b.title, description: b.description,
    committee: b.committee, referrals: b.referrals, stage: b.stage, last_action: b.last_action, last_action_date: b.last_action_date, state_url: b.state_url,
    sponsors: b.sponsors, companions: b.companions, origin_stops: b.origin_stops, second_stops: b.second_stops, current_version: b.current_version,
    died_deadline: b.died_deadline, died_at_stage: b.died_at_stage, hiphi_position: b.position, hiphi_summary: b.public_summary, hiphi_action: b.public_action,
    hiphi_follows: true, coalitions: coalOf[b.id] || [], watchers: b.priority === 1 ? 12 + seed(b.id) % 40 : seed(b.id) % 9 }));
  D.index = snap.index.map(b => ({ id: b.id, bill_number: b.bill_number, chamber: b.chamber, title: b.title, description: null, stage: 'introduced', referrals: [], sponsors: [], companions: [], coalitions: [], watchers: 0, hiphi_follows: false, sandbox_untracked: true }));
  D.hearings = snap.hearings.map(h => ({ ...h, bill_number: snap.bills.find(b => b.id === h.bill_id)?.bill_number }));
  D.activity = snap.activity.map(a => ({ bill_id: a.bill_id, title: a.title, details: a.details, occurred_at: a.occurred_at }));
  D.outcomes = snap.outcomes;
  D.lists = (snap.lists || []).map(l => ({ ...l, is_published: true })); D.listBills = snap.listBills || [];
  S.legislators = snap.legislators || []; S.committeeMembers = snap.committeeMembers || []; S.counterparts = snap.counterparts || [];
  S.deadlines = snap.deadlines.slice().sort((x, y) => x.deadline_date.localeCompare(y.deadline_date));
  S.committees = Object.fromEntries(snap.committees.map(c => [c.code, c]));
  S.slots = snap.slots;
  const counts = {}, live = {}; for (const b of D.bills) for (const n of b.coalitions) { counts[n] = (counts[n] || 0) + 1; if (alive(b)) live[n] = (live[n] || 0) + 1; }
  S.coalitions = snap.campaigns.filter(c => c.is_public && counts[c.name]).map(c => ({ name: c.name, public_name: c.public_name || c.name, slug: c.slug, description: c.description, icon: c.icon, bills: counts[c.name], live: live[c.name] || 0, sort_order: c.sort_order }));
}
const dmatch = (b, q) => { const ql = q.toLowerCase(), qn = ql.replace(/\s/g, ''); return b.bill_number.toLowerCase().includes(qn) || (b.title || '').toLowerCase().includes(ql) || (b.description || '').toLowerCase().includes(ql); };
// "I did it" marks: in this browser until sign-in, then in public_actions.
const DONE_KEY = DEMO ? 'hiphi_done_demo' : 'hiphi_done';
function localDone() { try { return new Set(JSON.parse(localStorage.getItem(DONE_KEY) || '[]')); } catch { return new Set(); } }
function saveDone() { try { localStorage.setItem(DONE_KEY, JSON.stringify([...S.done])); } catch { /* ignore */ } }
const doneKey = (billId, hearingId, kind) => `${billId}|${hearingId || ''}|${kind}`;
async function loadActions(ids) {
  S.done = localDone();
  if (DEMO) { for (const id of ids) if (!S.actionCounts[id]) { const n = [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 3) % 60; S.actionCounts[id] = { testimonies: n, emails: n >> 2, attending: n >> 3 }; } return; }
  if (S.session && S.user) {
    const { data } = await S.supa.from('public_actions').select('bill_id,hearing_id,kind');
    (data || []).forEach(a => S.done.add(doneKey(a.bill_id, a.hearing_id, a.kind)));
  }
  if (ids.length) { const { data } = await S.supa.from('public_action_counts').select('*').in('bill_id', ids); (data || []).forEach(r => { S.actionCounts[r.bill_id] = r; }); }
}
async function markDone(billId, hearingId, kind, on = true) {
  const k = doneKey(billId, hearingId, kind);
  if (on) S.done.add(k); else S.done.delete(k); saveDone();
  const c = S.actionCounts[billId] ??= { testimonies: 0, emails: 0, attending: 0 };
  const col = { testimony: 'testimonies', email: 'emails', attend: 'attending' }[kind]; if (col) c[col] = Math.max(0, (c[col] || 0) + (on ? 1 : -1));
  if (!DEMO && S.session && S.user) {
    const r = on ? await S.supa.from('public_actions').insert({ user_id: S.session.user.id, bill_id: billId, hearing_id: hearingId || null, kind })
                 : await S.supa.from('public_actions').delete().eq('user_id', S.session.user.id).eq('bill_id', billId).eq('kind', kind).is('hearing_id', hearingId || null);
    if (r.error && !/duplicate/.test(r.error.message)) toast(r.error.message, true);
  }
}
function localWatch() { try { return new Set(JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]')); } catch { return new Set(); } }
function saveLocal() { try { localStorage.setItem(LOCAL_KEY, JSON.stringify([...S.watch])); } catch { /* private mode */ } }
async function loadUser() {
  S.user = null;
  if (DEMO || !S.session) { S.watch = localWatch(); return; }
  const { data, error } = await S.supa.rpc('ensure_public_user');
  if (error) { if (/staff/.test(error.message)) { toast('Staff accounts use the main app', true); await S.supa.auth.signOut(); return; } throw error; }
  S.user = data;
  // Choices made on the sign-in page, before the account existed.
  let pending = null; try { pending = JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null'); } catch {}
  if (pending) { const prefs = { ...(S.user.prefs || {}), hearing_alerts: !!pending.hearing_alerts, share_follows: !!pending.share_follows, consent_at: new Date().toISOString() };
    const r = await S.supa.from('public_users').update({ prefs }).eq('id', S.user.id); if (!r.error) S.user.prefs = prefs; try { localStorage.removeItem(CONSENT_KEY); } catch {} }
  S.consentCard = !(S.user.prefs || {}).consent_at;
  // Lists followed on this device join the account (and stay in sync from here on).
  const lf = await S.supa.from('list_follows').select('list_id'); S.listFollows = new Set((lf.data || []).map(r => r.list_id));
  for (const id of localListFollows()) if (!S.listFollows.has(id)) { const r = await S.supa.rpc('follow_list', { p_list: id }); if (!r.error) S.listFollows.add(id); }
  try { localStorage.removeItem(LISTS_KEY); } catch {}
  const wl = await S.supa.from('watchlist').select('bill_id');
  const server = new Set((wl.data || []).map(r => r.bill_id));
  // First sign-in: what was starred on this device joins the account.
  const local = localWatch(); const missing = [...local].filter(id => !server.has(id));
  if (missing.length) { await S.supa.from('watchlist').insert(missing.map(bill_id => ({ user_id: S.user.id, bill_id }))); missing.forEach(id => server.add(id)); }
  S.watch = server; saveLocal();
}
// ---------------- curated lists ----------------
// HIPHI staff curate lists of public bills. Following a list follows every
// bill on it now and every bill added later (the database does that for
// signed-in members; signed-out follows live in this browser and join the
// account at sign-in).
function localListFollows() { try { return new Set(JSON.parse(localStorage.getItem(LISTS_KEY) || '[]')); } catch { return new Set(); } }
function saveListFollows() { try { localStorage.setItem(LISTS_KEY, JSON.stringify([...S.listFollows])); } catch {} }
async function loadLists() {
  if (DEMO) { S.lists = D.lists.map(l => ({ ...l, bills: D.listBills.filter(x => x.list_id === l.id).length, followers: l.followers || 0, curated_by: 'HIPHI' })); }
  else { const { data } = await S.supa.from('public_lists_v').select('*').order('featured', { ascending: false }).order('sort_order'); S.lists = data || []; }
  if (!S.user) S.listFollows = localListFollows();
}
async function listBillsFor(slug) {
  if (S.listBills[slug]) return S.listBills[slug];
  const l = S.lists.find(x => x.slug === slug); if (!l) return null;
  let rows, bills;
  if (DEMO) { rows = D.listBills.filter(x => x.list_id === l.id); bills = D.bills.filter(b => rows.some(r => r.bill_id === b.id)); }
  else { const r = await S.supa.from('public_list_bills_v').select('*').eq('slug', slug); rows = r.data || [];
    const ids = rows.map(x => x.bill_id); bills = ids.length ? (await S.supa.from('public_all_bills').select('*').in('id', ids)).data || [] : []; }
  const out = rows.sort((a, b) => a.sort_order - b.sort_order || String(a.added_at).localeCompare(String(b.added_at))).map(x => ({ note: x.note, b: bills.find(b => b.id === x.bill_id) })).filter(x => x.b);
  out.forEach(({ b }) => { S.extra[b.id] = b; });
  S.listBills[slug] = out; return out;
}
async function followList(slug, on) {
  const l = S.lists.find(x => x.slug === slug); if (!l) return;
  const rows = await listBillsFor(slug) || [];
  if (on) S.listFollows.add(l.id); else S.listFollows.delete(l.id);
  if (S.user && !DEMO) {
    const r = on ? await S.supa.rpc('follow_list', { p_list: l.id }) : await S.supa.rpc('unfollow_list', { p_list: l.id });
    if (r.error) { toast(r.error.message, true); if (on) S.listFollows.delete(l.id); else S.listFollows.add(l.id); return; }
  } else saveListFollows();
  if (on) { rows.forEach(({ b }) => S.watch.add(b.id)); saveLocal(); }
  l.followers = Math.max(0, (Number(l.followers) || 0) + (on ? 1 : -1));
  await loadBills();
  if (on && !S.session && (onb().nudges || 0) < 2) { S.nudge = true; onbSet({ nudges: (onb().nudges || 0) + 1 }); }
  render();
  toast(on ? `Following ${rows.length} bill${rows.length === 1 ? '' : 's'} on “${l.title}” — new ones HIPHI adds will follow too` : `You no longer follow “${l.title}”; the bills stay in Your bills`);
}
const listTile = l => { const on = S.listFollows.has(l.id); return `<div class="ltile ${on ? 'on' : ''}"><button class="lopen" data-list="${esc(l.slug)}"><span class="ticon">${esc(l.icon || '☰')}</span><span class="tname">${esc(l.title)}</span><span class="tdesc">${esc(l.description || '')}</span><span class="tcount"><b>${l.bills}</b> bill${Number(l.bills) === 1 ? '' : 's'}${Number(l.followers) ? ` · ${l.followers} following` : ''}</span></button><button class="btn sm ${on ? 'ghost' : ''}" data-followlist="${esc(l.slug)}" data-on="${on ? 0 : 1}">${on ? '✓ Following' : 'Follow this list'}</button></div>`; };
function listsStrip(title = 'Lists from HIPHI') {
  if (!S.lists.length) return '';
  return `<section class="lists"><div class="sec">${esc(title)}</div><p class="desc">Follow a list and you follow every bill on it — including the ones HIPHI adds later.</p><div class="ltiles">${S.lists.map(listTile).join('')}</div></section>`;
}
function listPage() {
  const l = S.lists.find(x => x.slug === S.listSlug); if (!l) return `<div class="pubhead"><h1>List not found</h1><span class="sub"><button class="linkbtn" data-nav="find">← all lists</button></span></div>`;
  const rows = S.listBills[l.slug], on = S.listFollows.has(l.id);
  return `<div class="pubhead"><h1>${esc(l.icon ? l.icon + ' ' : '')}${esc(l.title)}</h1><span class="sub">${esc(l.description || '')} · curated by ${esc(l.curated_by || 'HIPHI')} · ${l.bills} bill${Number(l.bills) === 1 ? '' : 's'}${Number(l.followers) ? ` · ${l.followers} following` : ''}</span></div>
    <div class="listcta ${on ? 'on' : ''}"><button class="btn ${on ? 'ghost' : ''}" data-followlist="${esc(l.slug)}" data-on="${on ? 0 : 1}">${on ? '✓ Following this list' : 'Follow this list'}</button><span class="tok">${on ? 'Every bill here is in Your bills. When HIPHI adds a bill to this list, it follows too.' : 'One tap follows every bill here, and any bill HIPHI adds later.'}</span></div>
    ${rows ? (rows.length ? `<div class="rows">${rows.map(({ b, note }) => `<div class="row prow listrow" data-open="${b.id}"><span class="bno">${esc(billNum(b))}</span>
        <span class="t">${esc(blurb(b, 140))}${note ? `<em class="lnote">${esc(note)}</em>` : ''}<small>${b.hiphi_position ? esc(POS_SAYS[b.hiphi_position] || b.hiphi_position) + ' · ' : ''}${esc(stopOf(b).says.split('.')[0])}</small></span>${watchBtn(b)}</div>`).join('')}</div>` : '<p class="desc"><i>Nothing on this list yet.</i></p>') : '<p class="desc">Loading…</p>'}
    <p class="tok" style="margin-top:14px"><button class="linkbtn" data-nav="find">← all lists and issues</button></p>`;
}
const POS_SAYS = { strongly_support: 'HIPHI strongly supports', support: 'HIPHI supports', support_amend: 'HIPHI supports with changes', strongly_oppose: 'HIPHI strongly opposes', oppose: 'HIPHI opposes', neutral: 'HIPHI is commenting', monitor: 'HIPHI is watching' };
async function openList(slug) {
  S.view = 'list'; S.listSlug = slug; S.open = null; history.replaceState(null, '', '#list=' + slug); render(); window.scrollTo(0, 0);
  await listBillsFor(slug); render();
}
// ---------------- legislators ----------------
// Official profiles from the Capitol's pages. "Find my legislators" takes a
// street address (sent to the U.S. Census geocoder through our proxy, not
// stored), a district, a town, or a name; the box suggests as you type.
const plain = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[ʻ‘’`]/g, '').toLowerCase();
const legById = id => S.legislators.find(l => l.id === Number(id));
const legTitle = l => l.chamber === 'S' ? 'Sen.' : 'Rep.';
const legsOf = code => { const c = String(code || '').split('/')[0], rank = { chair: 0, vice_chair: 1, member: 2 };
  return S.committeeMembers.filter(m => m.committee === c).map(m => ({ ...m, l: legById(m.legislator_id) })).filter(m => m.l).sort((a, b) => rank[a.role] - rank[b.role] || a.l.sort_name.localeCompare(b.l.sort_name)); };
const legPhoto = (l, cls = 'lphoto') => l.photo_url ? `<img class="${cls}" src="${esc(l.photo_url)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'${cls} none',textContent:'${esc((l.name || '?')[0])}'}))">` : `<span class="${cls} none">${esc((l.name || '?')[0])}</span>`;
const legChips = l => S.committeeMembers.filter(m => m.legislator_id === l.id).sort((a, b) => ({ chair: 0, vice_chair: 1, member: 2 }[a.role]) - ({ chair: 0, vice_chair: 1, member: 2 }[b.role])).map(m => `<span class="chipx ${m.role === 'chair' ? 'c-teal' : m.role === 'vice_chair' ? 'c-navy' : 'c-gray'}" title="${esc(S.committees[m.committee]?.name || m.committee)}">${esc(S.committees[m.committee]?.name || m.committee)}${m.role === 'chair' ? ' · Chair' : m.role === 'vice_chair' ? ' · Vice Chair' : ''}</span>`).join('');
// the places a legislator's district covers, one name each
const placesOf = l => (l.places || '').split(/,\s*/).map(x => x.replace(/^(a )?portions? of\s+/i, '').trim()).filter(Boolean);
// what the box suggests
const looksLikeAddress = q => q.trim().length >= 3 && !/^(senate|house|sd|hd)?\s*(district)?\s*\d{1,2}$/i.test(q.trim());
// Suggestions come from our own table of every Hawaiʻi street address (with districts), one fast query.
async function supa() { if (!S.supa) { const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'); S.supa = createClient(SUPABASE_URL, SUPABASE_KEY); } return S.supa; }
async function fetchAddrSuggest(q) {
  const { data, error } = await (await supa()).rpc('address_suggest', { q, n: 8 }); if (error) throw error;
  return (data || []).map(x => ({ label: x.label, lat: x.lat, lon: x.lon, sd: x.sd, hd: x.hd, exact: x.exact }));
}
function legSuggest(q) {
  const k = plain(q.trim()); if (k.length < 2) return [];
  const out = [];
  if (S.addrSug && S.addrSug.q === q.trim()) out.push(...S.addrSug.results.map(x => ({ kind: 'addr', ...x })));
  if (/^\d/.test(k) && k.length >= 5 && !out.some(x => x.exact)) out.push({ kind: 'address', label: `Look up “${q.trim()}” as typed`, q: q.trim() });
  const dm = /^(senate|house|sd|hd)?\s*(district)?\s*(\d{1,2})$/.exec(k);
  if (dm) { const n = +dm[3]; if (!dm[1] || /^s/.test(dm[1])) out.push({ kind: 'district', label: `Senate District ${n}`, chamber: 'S', district: n }); if (!dm[1] || /^h/.test(dm[1])) out.push({ kind: 'district', label: `House District ${n}`, chamber: 'H', district: n }); }
  const places = new Map();
  for (const l of S.legislators) for (const pl of placesOf(l)) if (plain(pl).includes(k)) { const key = plain(pl); if (!places.has(key)) places.set(key, { kind: 'place', label: pl, ids: [] }); if (!places.get(key).ids.includes(l.id)) places.get(key).ids.push(l.id); }
  out.push(...[...places.values()].sort((a, b) => a.label.localeCompare(b.label)).slice(0, 8));
  out.push(...S.legislators.filter(l => plain(l.name).includes(k) || plain(l.sort_name).includes(k)).slice(0, 6).map(l => ({ kind: 'person', label: `${legTitle(l)} ${l.name}`, ids: [l.id] })));
  return out.slice(0, 12);
}
async function legLookupAddress(q, pt) {
  const byDistrict = (sd, hd) => S.legislators.filter(l => (l.chamber === 'S' && l.district === sd) || (l.chamber === 'H' && l.district === hd)).map(l => l.id);
  if (pt && pt.sd && pt.hd) return { matched: pt.label, ids: byDistrict(pt.sd, pt.hd) };
  if (pt) { const { data } = await (await supa()).rpc('districts_at', { lat: pt.lat, lon: pt.lon }); const d = data?.[0]; if (d?.sd || d?.hd) return { matched: pt.label, ids: byDistrict(d.sd, d.hd) }; }
  const r = await fetch(`${SUPABASE_URL}/functions/v1/geo-lookup?address=${encodeURIComponent(q)}`, { headers: { apikey: SUPABASE_KEY } });
  const j = await r.json(); if (!j.found) return { none: true };
  return { matched: j.matched || q, ids: byDistrict(j.senate, j.house) };
}
// mail draft for a legislator about a bill (or a general note)
function legDraft(l, b) {
  const ask = b && (b.hiphi_action || '').trim();
  const subject = b ? `${b.bill_number.replace(/^(\D+)/, '$1 ')}${b.hiphi_position ? ' — ' + ({ strongly_support: 'please support', support: 'please support', support_amend: 'please support with amendments', strongly_oppose: 'please oppose', oppose: 'please oppose', neutral: 'comments' }[b.hiphi_position] || '') : ''}` : `A constituent from ${S.legTown || 'your district'}`;
  const surname = (l.sort_name || l.name).split(',')[0].trim();
  const body = `Aloha ${legTitle(l)} ${surname},\n\nMy name is [your name] and I live in [your town].${b ? `\n\nI am writing about ${b.bill_number.replace(/^(\D+)/, '$1 ')}, ${blurb(b, 140)}${ask ? `\n\n${ask}` : ''}` : ''}\n\n[Why this matters to you, in a sentence or two.]\n\nMahalo,\n[your name]`;
  return { subject, body, mailto: `mailto:${l.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` };
}
// the contact panel under a person: mail app, or copy the address and the draft, or call
function mailBoxHTML(l, b) {
  const d = legDraft(l, b), key = `${l.id}|${b ? b.id : ''}`;
  if (S.mailOpen !== key) return `<button class="btn sm" data-mailopen="${esc(key)}">✉ Email</button>${l.phone ? `<a class="btn sm ghost" href="tel:${esc(l.phone)}">☎ Call</a>` : ''}`;
  return `<div class="mailbox">
      <div class="mbrow"><a class="btn sm" href="${d.mailto}">Open in my mail app</a><span class="tok">no mail app? use the buttons below</span></div>
      <div class="mbrow"><code>${esc(l.email || '')}</code><button class="btn sm ghost" data-copy="${esc(l.email || '')}">Copy address</button>${l.phone ? `<a class="btn sm ghost" href="tel:${esc(l.phone)}">☎ ${esc(l.phone)}</a>` : ''}</div>
      <div class="mbrow"><b>Subject:</b> ${esc(d.subject)} <button class="btn sm ghost" data-copy="${esc(d.subject)}">Copy</button></div>
      <textarea class="mbdraft" readonly rows="8">${esc(d.body)}</textarea>
      <div class="mbrow"><button class="btn sm ghost" data-copy="${esc(d.body)}">Copy the message</button><button class="linkbtn" data-mailclose>Close</button></div>
    </div>`;
}
const legCard = (l, b, big = false) => `<div class="legcard ${big ? 'big' : ''}" data-legcard="${l.id}">
    ${legPhoto(l, big ? 'lphoto big' : 'lphoto')}
    <div class="lm"><a class="lname" data-legopen="${l.id}"><b>${esc(legTitle(l))} ${esc(l.name)}</b>${l.party ? ` <small>(${esc(l.party)})</small>` : ''}</a>
      <span class="ld">${l.chamber === 'S' ? 'Senate' : 'House'} District ${l.district}${l.title ? ` · ${esc(l.title)}` : ''}</span>
      <span class="lp">${esc(l.places || '')}</span>
      <span class="lc">${legChips(l)}</span>
      <div class="lacts">${mailBoxHTML(l, b)}</div>
    </div></div>`;
function legislatorsPage() {
  const sug = S.legPick ? [] : legSuggest(S.legQ), pick = S.legPick;
  const picked = pick ? (pick.ids || []).map(legById).filter(Boolean).sort((a, b) => a.chamber.localeCompare(b.chamber) || a.district - b.district) : [];
  return `<div class="pubhead"><h1>Your legislators</h1><span class="sub">Every Hawaiʻi senator and representative. Type your street address, town, district or a name.</span></div>
    <div class="legfind">
      <input type="search" id="leg-q" placeholder="e.g. 415 S Beretania St, Honolulu · Kīhei · Senate District 9 · Amato" value="${esc(S.legQ)}" autocomplete="off">
      ${sug.length ? `<div class="legsug">${sug.map((x, i) => `<button data-legsug="${i}"><span class="sk">${x.kind === 'addr' || x.kind === 'address' ? '📍' : x.kind === 'district' ? '#' : x.kind === 'place' ? '🏘' : '👤'}</span>${esc(x.label)}${x.kind === 'addr' && !x.exact ? ' <small>area</small>' : ''}${x.ids && x.ids.length > 1 ? ` <small>${x.ids.length} legislators</small>` : ''}</button>`).join('')}</div>` : (looksLikeAddress(S.legQ) && S.addrLoading ? '<div class="legsug"><button disabled><span class="sk">…</span>Looking up addresses</button></div>' : '')}
    </div>
    ${pick ? `<div class="legresult"><div class="sec">${pick.none ? 'No match for that address' : esc(pick.label)}${pick.matched ? ` <span class="tok">· ${esc(pick.matched)}</span>` : ''}${picked.length > 2 ? ' <span class="tok">· this area crosses district lines, so more than one legislator serves it</span>' : ''}</div>
      ${pick.none ? '<p class="desc">Try the street number and name with the town, or pick a town or district from the suggestions.</p>' : picked.map(l => legCard(l, null, true)).join('')}</div>` : ''}
    ${!pick ? `<div class="sec">Browse</div><div class="leggrid">${S.legislators.slice().sort((a, b) => a.chamber.localeCompare(b.chamber) || a.district - b.district).map(l => legCard(l, null)).join('')}</div>` : ''}`;
}
function legislatorPage(l) {
  const b = S.legFromBill && findBill(S.legFromBill);
  return `<div class="pubhead"><h1>${esc(legTitle(l))} ${esc(l.name)}</h1><span class="sub"><button class="linkbtn" data-nav="legislators">← all legislators</button></span></div>
    ${legCard(l, b || null, true)}
    ${b ? `<p class="tok">You came from ${esc(b.bill_number.replace(/^(\D+)/, '$1 '))}; the email draft is about that bill.</p>` : ''}`;
}
// Who decides: the committees a bill still has to get through, with the people on them.
function whoDecidesHTML(b) {
  if (!S.legislators.length) return '';
  const st = stopOf(b);
  const stops = pathwayStops(b, st, S.counterparts, null).filter(s => s.state !== 'passed');
  if (!stops.length || !alive(b)) return '';
  const person = (l, role) => `<div class="wd ${role}">${legPhoto(l, 'lphoto sm')}<div class="wdm"><a data-legopen="${l.id}" data-frombill="${b.id}"><b>${esc(legTitle(l))} ${esc(l.name)}</b></a> <span class="muted">${role === 'chair' ? 'Chair' : role === 'vice_chair' ? 'Vice Chair' : ''} · ${l.chamber === 'S' ? 'SD' : 'HD'} ${l.district}</span><div class="lacts">${mailBoxHTML(l, b)}</div></div></div>`;
  return `<div class="sec">Who decides next</div>
    <p class="desc">The chair decides whether a bill gets a hearing; members vote. A short, polite email from a constituent counts.</p>
    ${stops.slice(0, 4).map((s, i) => { const members = legsOf(s.committee), cm = S.committees[String(s.committee).split('/')[0]];
      const chairs = members.filter(m => m.role === 'chair'), vices = members.filter(m => m.role === 'vice_chair'), rest = members.filter(m => m.role === 'member');
      const label = { current: 'now', next: 'next', predicted: 'likely, once it crosses over' }[s.state];
      return `<div class="wdstop pws-${s.state}"><div class="wdh"><b>${esc(cm?.name || s.committee)}</b> <span class="muted">· ${CHAMBER_NAME[s.chamber]} · ${label}</span></div>
        ${i === 0 || s.state === 'current' ? `${chairs.map(m => person(m.l, 'chair')).join('')}${vices.map(m => person(m.l, 'vice_chair')).join('')}${rest.length ? `<div class="wdmembers">${rest.map(m => `<a data-legopen="${m.l.id}" data-frombill="${b.id}">${esc(legTitle(m.l))} ${esc(m.l.name.split(' ').pop())}</a>`).join(' · ')}</div>` : ''}` : `<div class="wdmembers">${chairs.map(m => `<a data-legopen="${m.l.id}" data-frombill="${b.id}"><b>${esc(legTitle(m.l))} ${esc(m.l.name)}</b>, chair</a>`).join(' · ') || '<span class="muted">roster not loaded</span>'}</div>`}
      </div>`; }).join('')}`;
}
async function loadBills() {
  const ids = [...S.watch];
  if (!S.featured) { try { await loadFeatured(); } catch { S.featured = { hearings: [], bills: [] }; } }
  if (!S.pool) { try { await loadPool(); } catch { S.pool = { bills: [], hearings: [] }; } }
  if (DEMO) {
    const w = new Set(ids);
    S.bills = D.bills.filter(b => w.has(b.id)); S.hearings = D.hearings.filter(h => w.has(h.bill_id));
    S.activity = D.activity.filter(a => w.has(a.bill_id)).sort((x, y) => y.occurred_at.localeCompare(x.occurred_at));
    S.outcomes = Object.fromEntries(D.outcomes.filter(o => w.has(o.bill_id)).map(o => [o.hearing_id, o]));
    await loadActions([...ids, ...((S.featured || {}).bills || []).map(b => b.id)]);
    return;
  }
  if (!ids.length) { S.bills = []; S.hearings = []; S.activity = []; S.outcomes = {}; }
  else {
    const [b, h, a, o] = await Promise.all([
      S.supa.from('public_all_bills').select('*').in('id', ids),
      S.supa.from('public_all_hearings').select('*').in('bill_id', ids),
      S.supa.from('public_activity').select('*').in('bill_id', ids).order('occurred_at', { ascending: false }).limit(300),
      S.supa.from('public_hearing_outcomes').select('*').in('bill_id', ids),
    ]);
    S.bills = b.data || []; S.hearings = h.data || []; S.activity = a.data || [];
    S.outcomes = Object.fromEntries((o.data || []).map(x => [x.hearing_id, x]));
  }
  try { await loadActions([...ids, ...((S.featured || {}).bills || []).map(b => b.id)]); } catch { /* counts are decoration */ }
  if (!S.deadlines.length) {
    const [d, c, sl, co, lg, cm, cp] = await Promise.all([S.supa.from('public_deadlines').select('*'), S.supa.from('public_committees').select('*'),
      S.supa.from('public_committee_slots').select('*'), S.supa.from('public_coalitions').select('*'),
      S.supa.from('public_legislators').select('*').order('chamber').order('district'), S.supa.from('public_committee_members').select('*'), S.supa.from('public_committee_counterparts').select('*')]);
    S.legislators = lg.data || []; S.committeeMembers = cm.data || []; S.counterparts = cp.data || [];
    S.slots = sl.data || [];
    S.deadlines = (d.data || []).sort((x, y) => x.deadline_date.localeCompare(y.deadline_date));
    S.committees = Object.fromEntries((c.data || []).map(x => [x.code, x]));
    S.coalitions = (co.data || []).filter(x => x.bills > 0);
  }
}
// This week at the Capitol: upcoming hearings on bills HIPHI has a position on,
// so a first visit has something to watch in one tap.
// The pool suggestions come from: every live bill HIPHI has a position on, with
// hearings in the next two weeks. Loaded once per visit.
async function loadPool() {
  const now = Date.now(), until = new Date(now + 15 * 864e5).toISOString();
  if (DEMO) {
    const bills = D.bills.filter(b => alive(b) && b.hiphi_position && b.hiphi_position !== 'monitor');
    const ids = new Set(bills.map(b => b.id));
    S.pool = { bills, hearings: D.hearings.filter(h => ids.has(h.bill_id) && h.status === 'scheduled' && h.scheduled_at < until) }; return;
  }
  const { data: bills } = await S.supa.from('public_all_bills').select('*').not('hiphi_position', 'is', null).neq('hiphi_position', 'monitor').not('stage', 'in', '("dead","vetoed","enacted","governor")').limit(500);
  const ids = (bills || []).map(b => b.id);
  const { data: hs } = ids.length ? await S.supa.from('public_all_hearings').select('*').in('bill_id', ids).eq('status', 'scheduled').gt('scheduled_at', new Date(now - 864e5).toISOString()).lt('scheduled_at', until) : { data: [] };
  S.pool = { bills: (bills || []).filter(alive), hearings: hs || [] };
}
function dismissed() { try { return new Set(JSON.parse(localStorage.getItem('hiphi_dismiss') || '[]')); } catch { return new Set(); } }
function dismiss(id) { const d = dismissed(); d.add(id); try { localStorage.setItem('hiphi_dismiss', JSON.stringify([...d])); } catch { /* ignore */ } }
// What this person seems to care about: coalitions of the bills they follow,
// plus the issues they picked at the start.
function interests() {
  const w = {}; const add = (n, k) => { if (n) w[n] = (w[n] || 0) + k; };
  for (const b of S.bills) for (const n of (b.coalitions || [])) add(n, 2);
  for (const n of (wiz().issues || [])) for (const m of groupNames(n)) add(m, 3);
  return w;
}
// Ranked suggestions: something to do this week on a bill they do not follow yet.
function recommendations(limit) {
  const pool = S.pool; if (!pool) return [];
  const now = Date.now(), skip = dismissed(), likes = interests(), anyLikes = Object.keys(likes).length > 0;
  const out = [];
  for (const b of pool.bills) {
    if (S.watch.has(b.id) || skip.has(b.id)) continue;
    const st = billStop(b, { hearings: pool.hearings.filter(h => h.bill_id === b.id), outcomes: {}, deadlineFor: k => { const d = S.deadlines.filter(x => x.key === k).slice(-1)[0]; return d ? { label: d.label, date: d.deadline_date } : null; } });
    let kind = null, when = null, score = 0, why = [];
    if (st.hearingState === 'scheduled' && st.hearing) {
      const due = st.hearing.testimony_deadline ? new Date(st.hearing.testimony_deadline).getTime() : new Date(st.hearing.scheduled_at).getTime();
      if (due > now) { kind = 'testify'; when = due; score += 6 + Math.max(0, 5 - (due - now) / 864e5); }
    } else if (st.column === 'a' && st.deadline && !st.deadline.missed && st.committee && st.deadline.days <= 21) {
      kind = 'hearing'; when = new Date(st.deadline.date + 'T23:59:59-10:00').getTime(); score += 3 + Math.max(0, 3 - st.deadline.days / 7); why.push('stuck in committee — the chair needs to hear from people');
    }
    if (!kind) continue;
    const mine = (b.coalitions || []).filter(n => likes[n]);
    if (mine.length) { score += Math.min(6, mine.reduce((t, n) => t + likes[n], 0)); why.push(`you follow ${cname(mine[0])}`); }
    else if (anyLikes) score -= 1;
    if (/strongly/.test(b.hiphi_position)) { score += 3; why.push('a HIPHI top priority'); }
    if (!why.length) why.push(kind === 'testify' ? 'testimony window is open' : 'needs a push');
    if ((S.actionCounts[b.id] || {}).testimonies) score += 0.5;
    out.push({ b, st, kind, when, score, why });
  }
  out.sort((x, y) => y.score - x.score || x.when - y.when);
  return out.slice(0, limit);
}
function recoCard({ b, st, kind, why }) {
  const h = st.hearing, c = S.committees[String(st.committee || h?.committee || '').split('/')[0]];
  const chairMail = c && c.chair ? `${c.chamber === 'S' ? 'sen' : 'rep'}${c.chair.replace(/^(rep\.|sen\.|representative|senator)\s+/i, '').replace(/\s*(jr\.?|sr\.?|ii|iii|iv)$/i, '').trim().split(/\s+/).pop().toLowerCase().replace(/[^a-z]/g, '')}@capitol.hawaii.gov` : null;
  const ask = kind === 'hearing' && chairMail ? `mailto:${chairMail}?subject=${encodeURIComponent(`Please schedule a hearing for ${b.bill_number}`)}&body=${encodeURIComponent(`Dear Chair ${c.chair},\n\nI am writing to ask that ${st.committee} schedule a hearing for ${b.bill_number}, ${titleCase(b.title)}, before the ${st.deadline?.label || ''} deadline${st.deadline ? ' on ' + fmtDate(st.deadline.date + 'T12:00:00-10:00', { month: 'long' }) : ''}.\n\n${b.hiphi_action || b.hiphi_summary || ''}\n\n[One sentence on why this matters to you.]\n\nMahalo,\n`)}` : null;
  return `<div class="acard reco ${posCls(b)}" data-acard="${b.id}">
    <div class="ahead"><span class="apos">HIPHI ${esc(POS[b.hiphi_position] || '')}</span><b data-open="${b.id}">${esc(billNum(b))}</b> <span class="atitle">${esc(b.hiphi_summary || titleCase(b.title))}</span></div>
    <div class="awhy">${why.map(esc).join(' · ')}</div>
    <div class="awhen">${kind === 'testify' ? `${esc(h.committee)} hearing ${fmtDT(h.scheduled_at)}${h.testimony_deadline ? ` · testimony due ${inWhen(h.testimony_deadline)}` : ''}` : `Waiting in ${esc(st.committee)} · needs a hearing by ${fmtDate(st.deadline.date + 'T12:00:00-10:00', { month: 'short' })}${c?.chair ? ` · Chair ${esc(c.chair)}` : ''}`}</div>
    <div class="abtns">
      ${kind === 'testify' ? `<button class="btn" data-helper="${h.id}">Submit testimony</button>` : ask ? `<a class="btn" href="${ask}" data-did="${b.id}||email">Ask the chair for a hearing</a>` : ''}
      ${watchBtn(b)}
      <button class="btn sm ghost" data-dismiss="${b.id}" title="Do not suggest this bill again">Not for me</button>
    </div></div>`;
}
function recoHTML(quiet) {
  if (!S.pool) return '';
  const n = S.recoN || 3, list = recommendations(n + 1), shown = list.slice(0, n);
  if (!shown.length) return '';
  const likes = Object.keys(interests());
  return `<div class="panel donow reco" id="pf-reco"><div class="ph"><span>🌺 ${quiet ? 'Your bills are quiet this week — here is where you can help' : 'More ways to help this week'}</span><span class="psub">${likes.length ? `HIPHI’s priorities and the issues you picked (${likes.slice(0, 3).map(cname).join(', ')})` : 'HIPHI’s priorities'} · three at a time</span></div>
    ${shown.map(recoCard).join('')}
    ${list.length > n ? `<button class="pempty boardmore" data-recomore>Show three more</button>` : ''}
    ${(hid => hid.length ? `<div class="hiddenline">${hid.length} bill${hid.length === 1 ? '' : 's'} hidden · <button class="linkbtn" data-showhidden>${S.showHidden ? 'hide' : 'show'}</button>${S.showHidden ? `<div class="hiddenlist">${hid.map(b => `<span>${esc(b.bill_number)} <button class="linkbtn" data-unhide="${b.id}">bring back</button></span>`).join('')}</div>` : ''}</div>` : '')(S.pool.bills.filter(b => dismissed().has(b.id)))}
  </div>`;
}
async function loadFeatured() {
  const now = Date.now(), until = new Date(now + 8 * 864e5).toISOString();
  if (DEMO) {
    const hs = D.hearings.filter(h => h.status === 'scheduled' && new Date(h.scheduled_at) > now && h.scheduled_at < until);
    const ids = new Set(hs.map(h => h.bill_id));
    const bills = D.bills.filter(b => ids.has(b.id) && b.hiphi_position && b.hiphi_position !== 'monitor');
    S.featured = { hearings: hs.filter(h => bills.some(b => b.id === h.bill_id)), bills }; return;
  }
  const { data: hs } = await S.supa.from('public_all_hearings').select('*').eq('status', 'scheduled').gt('scheduled_at', new Date(now).toISOString()).lt('scheduled_at', until).order('scheduled_at').limit(60);
  const ids = [...new Set((hs || []).map(h => h.bill_id))];
  const { data: bills } = ids.length ? await S.supa.from('public_all_bills').select('*').in('id', ids).not('hiphi_position', 'is', null).neq('hiphi_position', 'monitor') : { data: [] };
  S.featured = { hearings: (hs || []).filter(h => (bills || []).some(b => b.id === h.bill_id)), bills: bills || [] };
}
// Onboarding state lives in this browser: which steps are done, nudges shown, tour seen.
function onb() { try { return JSON.parse(localStorage.getItem('hiphi_onb') || '{}'); } catch { return {}; } }
function onbSet(patch) { const o = { ...onb(), ...patch }; try { localStorage.setItem('hiphi_onb', JSON.stringify(o)); } catch { /* ignore */ } return o; }
async function toggleWatch(id) {
  const on = S.watch.has(id);
  if (on) S.watch.delete(id); else S.watch.add(id);
  saveLocal();
  if (S.user && !DEMO) {
    const r = on ? await S.supa.from('watchlist').delete().eq('user_id', S.user.id).eq('bill_id', id)
                 : await S.supa.from('watchlist').insert({ user_id: S.user.id, bill_id: id });
    if (r.error) { toast(r.error.message, true); if (on) S.watch.add(id); else S.watch.delete(id); saveLocal(); return; }
  }
  await loadBills();
  // Sign-in nudge after the first and third Watch, never a modal, never before a Watch.
  if (!on && !S.session && S.watch.size && [1, 3].includes(S.watch.size) && (onb().nudges || 0) < 2) { S.nudge = true; onbSet({ nudges: (onb().nudges || 0) + 1 }); }
  render();
}
async function search(q) {
  if (DEMO) return [...D.bills.filter(b => dmatch(b, q)), ...D.index.filter(b => dmatch(b, q))].slice(0, 25);
  const safe = q.replace(/[%,()]/g, ' ').trim();
  const { data, error } = await S.supa.from('public_all_bills').select('*')
    .or(`bill_number.ilike.%${safe.replace(/\s/g, '')}%,title.ilike.%${safe}%,description.ilike.%${safe}%`)
    .order('bill_number').limit(25);
  if (error) throw error; return data;
}
// Every public bill HIPHI has tagged with a coalition (public_all_bills.coalitions).
async function browseCoalition(name) {
  const names = groupNames(name);
  if (DEMO) { S.browse = { name: names[0], rows: D.bills.filter(b => b.coalitions.some(n => names.includes(n))) }; S.results = null; S.q = ''; return; }
  const { data, error } = await S.supa.from('public_all_bills').select('*').overlaps('coalitions', names).order('bill_number').limit(300);
  if (error) throw error;
  S.browse = { name: names[0], rows: data || [] }; S.results = null; S.q = '';
}
// A bill opened from search, browse, or a #bill= link is not in S.bills, so
// its hearings and outcomes are fetched on demand and kept in S.xh.
async function openBill(id, known) {
  S.open = id;
  if (known && !S.bills.some(b => b.id === id)) S.extra[id] = known;
  if (DEMO && !S.bills.some(b => b.id === id) && !S.xh[id]) { S.xh[id] = D.hearings.filter(h => h.bill_id === id); D.outcomes.filter(o => o.bill_id === id).forEach(o => { S.outcomes[o.hearing_id] = o; }); }
  if (!DEMO && !S.bills.some(b => b.id === id) && !S.xh[id]) {
    const [h, o] = await Promise.all([S.supa.from('public_all_hearings').select('*').eq('bill_id', id), S.supa.from('public_hearing_outcomes').select('*').eq('bill_id', id)]);
    S.xh[id] = h.data || []; (o.data || []).forEach(x => { S.outcomes[x.hearing_id] = x; });
  }
  const b = findBill(id); if (b) history.replaceState(null, '', '#bill=' + b.bill_number.replace(/\s/g, ''));
  render();
}
function closeBill() { S.open = null; history.replaceState(null, '', location.pathname + location.search); render(); }
async function openFromHash() {
  const lm = /list=([a-z0-9-]+)/.exec(decodeURIComponent(location.hash));
  if (lm) { await openList(lm[1]); return; }
  const gm = /legislator=(\d+)/.exec(location.hash);
  if (gm) { S.legOpen = Number(gm[1]); S.view = 'legislator'; S.open = null; render(); window.scrollTo(0, 0); return; }
  if (/#legislators$/.test(location.hash)) { S.view = 'legislators'; S.open = null; render(); return; }
  const m = /bill=([A-Za-z]+\s?\d+)/.exec(decodeURIComponent(location.hash));
  if (!m) return;
  const num = m[1].replace(/\s/g, '').toUpperCase();
  const local = S.bills.find(b => b.bill_number === num);
  if (local) { await openBill(local.id); return; }
  if (DEMO) { const b = D.bills.find(x => x.bill_number === num) || D.index.find(x => x.bill_number === num); if (b) await openBill(b.id, b); else toast(`No bill ${num} this session`, true); return; }
  const { data } = await S.supa.from('public_all_bills').select('*').eq('bill_number', num).limit(1);
  if (data?.[0]) await openBill(data[0].id, data[0]); else toast(`No bill ${num} this session`, true);
}

// ---------------- helpers ----------------
const bill = id => S.bills.find(b => b.id === id);
const findBill = id => bill(id) || (S.results || []).find(x => x.id === id) || (S.browse?.rows || []).find(x => x.id === id) || ((S.featured || {}).bills || []).find(x => x.id === id) || ((S.pool || {}).bills || []).find(x => x.id === id) || S.extra[id] || null;
const hearingsOf = b => [...S.hearings.filter(h => h.bill_id === b.id), ...(S.xh[b.id] || [])].sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at));
const isTriple = b => (b.origin_stops || 0) >= 3 || (b.second_stops || 0) >= 3;
function stopOf(b) {
  return billStop(b, { hearings: hearingsOf(b), outcomes: S.outcomes || {},
    deadlineFor: key => { const d = S.deadlines.filter(x => x.key === key).slice(-1)[0]; return d ? { label: d.label, date: d.deadline_date } : null; } });
}
// The referral path, one line per chamber, current stop marked (same as the staff app).
function referralPath(b) {
  const refs = b.referrals || []; if (!refs.length) return esc(b.committee || '—');
  const n = Math.min(b.origin_stops || refs.length, refs.length);
  const st = stopOf(b), origin = b.chamber || (b.bill_number?.startsWith('S') ? 'S' : 'H'), otherCh = origin === 'H' ? 'S' : 'H';
  // A dead bill stopped at the stop its death stage names: triple = first, decking = last, lateral = in between.
  const ds = st.phase === 'dead' ? (b.died_at_stage || '') : '';
  const deadLeg = /^first|^introduced/.test(ds) ? 'first' : /^second/.test(ds) ? 'second' : null;
  const deadIdx = list => /triple|introduced/.test(ds) ? 0 : /decking/.test(ds) ? list.length - 1 : list.length <= 2 ? 0 : 1;
  const line = (ch, list, leg) => list.length ? `<span class="refline"><span class="refch">${CHAMBER_NAME[ch]}</span>${list.map((c, i) => {
      if (ds) { const di = deadLeg === leg ? deadIdx(list) : -1; const cls = deadLeg === leg ? (i === di ? 'dead' : i < di ? 'past' : '') : (leg === 'first' && deadLeg === 'second' ? 'past' : ''); return `<span class="refstop ${cls}">${esc(c)}</span>`; }
      const here = st.leg === leg && st.phase === 'committee' && st.stop === i + 1;
      const past = st.leg !== leg ? (leg === 'first') : (st.phase !== 'committee' || st.stop > i + 1);
      return `<span class="refstop ${here ? 'here' : past ? 'past' : ''}">${esc(c)}</span>`; }).join('<span class="refarrow">→</span>')}</span>` : '';
  const second = refs.slice(n);
  return line(origin, refs.slice(0, n), 'first') + (second.length ? line(otherCh, second, 'second') : (st.leg === 'second' && st.phase === 'committee' ? `<span class="refline"><span class="refch">${CHAMBER_NAME[otherCh]}</span><span class="refstop muted">awaiting referral</span></span>` : ''));
}
function nextDeadline(b) { const st = stopOf(b); return st.phase === 'committee' && st.deadline && !st.deadline.missed ? st.deadline : null; }
const alive = b => !['dead', 'vetoed', 'enacted', 'governor'].includes(b.stage || '') && !/deferred|failed to pass/i.test(b.last_action || '');
const posCls = b => ({ strongly_support: 'pos-support', support: 'pos-support', support_amend: 'pos-support', strongly_oppose: 'pos-oppose', oppose: 'pos-oppose', neutral: 'pos-neutral' }[b.hiphi_position] || 'pos-none');
const watchBtn = b => `<button class="watchbtn ${S.watch.has(b.id) ? 'on' : ''}" data-watch="${b.id}">${S.watch.has(b.id) ? '★ Following' : '☆ Follow'}</button>`;
// "First Lateral 2/20/26" -> a sentence a neighbour would understand.
function whyDead(b) {
  if (b.stage !== 'dead' && alive(b)) return '';
  const m = /^(.*?)\s+(\d+\/\d+\/\d+)$/.exec(b.died_deadline || '');
  if (m) return `Missed the ${m[1]} deadline on ${m[2]}${b.committee ? ` while waiting in ${esc(b.committee)}` : ''}.`;
  if (b.died_deadline) return `Missed the ${esc(b.died_deadline)} deadline.`;
  if (/deferred/i.test(b.last_action || '')) return 'Deferred by the committee, which ends it for the year.';
  if (/failed to pass/i.test(b.last_action || '')) return 'Failed a floor vote.';
  return b.stage === 'vetoed' ? 'Vetoed by the Governor.' : 'Did not advance.';
}
// Last regular meeting slot of a committee on or before a date (from the
// Capitol's published schedules, committee_slots), and the 48-hour notice
// cutoff for it. Joint committees use the first code. Null without a schedule.
function lastSlotBefore(code, dateStr, slots) {
  const c = String(code || '').split('/')[0];
  const mine = (slots || []).filter(s => s.code === c);
  if (!mine.length || !dateStr) return null;
  for (let i = 0; i <= 6; i++) {
    const d = new Date(dateStr + 'T12:00:00-10:00'); d.setUTCDate(d.getUTCDate() - i);
    const day = d.toISOString().slice(0, 10);
    const dow = new Date(day + 'T12:00:00-10:00').getUTCDay();
    const s = mine.filter(x => x.weekday === dow).sort((a, b) => b.start_time.localeCompare(a.start_time))[0];
    if (s) { const at = new Date(`${day}T${s.start_time.slice(0, 8)}-10:00`); return { at, noticeBy: new Date(at - 48 * 3600e3), room: s.room }; }
  }
  return null;
}
const streamOf = h => hearingStream(h, S.committees[String(h.committee || '').split('/')[0]]?.chamber);
const chairOf = code => { const c = S.committees[String(code || '').split('/')[0]]; if (!c?.chair) return '';
  const last = c.chair.replace(/^(rep\.|sen\.|representative|senator)\s+/i, '').replace(/\s*(jr\.?|sr\.?|ii|iii|iv)$/i, '').trim().split(/\s+/).pop();
  const title = c.chamber === 'S' ? 'Sen.' : 'Rep.';
  return ` · Chair <a class="chairmail" href="mailto:${c.chamber === 'S' ? 'sen' : 'rep'}${esc(last.toLowerCase().replace(/[^a-z]/g, ''))}@capitol.hawaii.gov" onclick="event.stopPropagation()" title="Email the chair">${title} ${esc(last)}</a>`; };
const RAIL_SHORT = { introduced: 'Intro', first_triple: '1st Triple', first_lateral: '1st Lat', first_decking: '1st Deck', first_crossover: 'Cross',
  second_triple: '2nd Triple', second_lateral: '2nd Lat', second_decking: '2nd Deck', conference: 'Conf', governor: 'Gov', enacted: 'Law' };
// A triple-referred bill gets its Triple stop in that chamber, before Lateral.
const railFor = b => { const r = ['introduced']; if ((b.origin_stops || 0) >= 3) r.push('first_triple');
  r.push('first_lateral', 'first_decking', 'first_crossover'); if ((b.second_stops || 0) >= 3) r.push('second_triple');
  r.push('second_lateral', 'second_decking', 'conference', 'governor', 'enacted'); return r; };
// The public rail: seven plain stops instead of committee jargon.
function railPublic(b) {
  const st = stopOf(b), origin = b.chamber || (String(b.bill_number).startsWith('S') ? 'S' : 'H'), other = origin === 'H' ? 'S' : 'H';
  const N = { H: 'House', S: 'Senate' };
  const stops = ['Introduced', `${N[origin]} committees`, `${N[origin]} vote`, `${N[other]} committees`, `${N[other]} vote`, 'Governor', 'Law'];
  let idx = 0;
  if (st.phase === 'law') idx = 6; else if (st.phase === 'governor' || st.phase === 'vetoed') idx = 5; else if (st.phase === 'conference') idx = 4;
  else if (st.phase === 'floor') idx = st.leg === 'first' ? 2 : 4; else if (st.phase === 'committee') idx = st.leg === 'first' ? 1 : 3;
  else if (st.phase === 'dead') { const d = b.died_at_stage || ''; idx = /^second/.test(d) ? 3 : /crossover/.test(d) ? 2 : 1; }
  const dead = !alive(b) && st.phase !== 'law';
  return `<div class="pv-rail plain">${stops.map((l, i) => `<div class="pv-stop ${i < idx ? 'done' : ''} ${i === idx ? (dead ? 'dead' : 'now') : ''}"><span class="sq"></span><span class="sl">${esc(l)}</span></div>`).join('')}</div>`;
}
function rail(b) {
  const r = railFor(b);
  let st = b.stage || 'introduced'; if (st === 'dead' && b.died_at_stage) st = b.died_at_stage;
  if (!alive(b) && st === 'introduced') st = r.includes('first_triple') ? 'first_triple' : 'first_lateral';   // died before its first hearing
  const alias = { second_crossover: 'conference', vetoed: 'governor', dead: 'introduced', first_triple: 'first_lateral', second_triple: 'second_lateral' };
  if (!r.includes(st)) st = alias[st] || 'introduced';
  const idx = Math.max(0, r.indexOf(st));
  const dead = !alive(b) && !['enacted', 'governor'].includes(b.stage || '');
  return `<div class="pv-rail">${r.map((s, i) => `<div class="pv-stop ${i < idx ? 'done' : ''} ${i === idx && !dead ? 'now' : (i === idx ? 'done' : '')}"><span class="sq"></span><span class="sl">${RAIL_SHORT[s]}</span></div>`).join('')}</div>`;
}
// Add-to-calendar: an .ics the phone opens in its own calendar, plus a Google
// Calendar link. One hour, room only, bill title in the description.
function calLinks(b, h) {
  const stamp = d => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const start = new Date(h.scheduled_at), end = new Date(start.getTime() + 3600e3);
  const title = `${billNum(b)} · ${h.committee} hearing`;
  const details = `${titleCase(b.title)}\nWritten testimony due ${h.testimony_deadline ? fmtDT(h.testimony_deadline) : '24 hours before'}.\n${b.state_url || ''}`;
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//HIPHI Bill Tracker//EN', 'BEGIN:VEVENT', `UID:${h.id}@hiphi-tracker`,
    `DTSTAMP:${stamp(Date.now())}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`, `SUMMARY:${title}`, `LOCATION:${clean(h.room)}`,
    `DESCRIPTION:${details.replace(/\n/g, '\\n')}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const g = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${stamp(start)}/${stamp(end)}&location=${encodeURIComponent(clean(h.room))}&details=${encodeURIComponent(details)}`;
  return `<span class="callinks"><a class="btn sm ghost" href="data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}" download="${esc(b.bill_number)}-${esc(h.committee)}.ics" onclick="event.stopPropagation()">＋ Calendar</a><a class="gcal" href="${g}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Google</a></span>`;
}
const outcomeChip = h => { const o = S.outcomes[h.id]; return o?.outcome ? `<span class="chipx ${OUTCOME_CLS[o.outcome] || 'c-gray'}">${OUTCOME_LABEL[o.outcome] || o.outcome}</span>` : (new Date(h.scheduled_at) < Date.now() ? '<span class="chipx c-gray">no report yet</span>' : ''); };

// ---------------- render ----------------
function chrome(inner) {
  const who = DEMO ? `<span title="The real 2026 session, frozen at March 16. Nothing here is saved.">sandbox · March 16, 2026</span>`
    : S.session ? `<span>${esc(S.session.user.email)}</span><button data-nav="settings">Settings</button><button id="signout">Sign out</button>`
    : `<button data-nav="signin">Sign in</button>`;
  const chips = groups().sort((a, b) => (/general/i.test(a.key) ? 1 : 0) - (/general/i.test(b.key) ? 1 : 0) || (b.live || 0) - (a.live || 0) || a.sort_order - b.sort_order).map(c => `<button class="fchip ${S.view === 'find' && S.browse && c.names.includes(S.browse.name) ? 'on' : ''}" data-browse="${esc(c.names[0])}">${esc(c.icon || '')} ${esc(c.key)}</button>`).join('');
  return `<div class="top pub"><span class="logo" data-nav="home" style="cursor:pointer"><span class="mark">☀</span>HIPHI Bill Tracker</span><a class="brand" href="https://www.hiphi.org" target="_blank" rel="noopener" title="Hawaiʻi Public Health Institute">by the Hawaiʻi Public Health Institute ↗</a>
      <span class="who"><button data-nav="legislators" title="Find your senator and representative">Your legislators</button><button data-nav="help" title="Help and keyboard shortcuts (?)">Help</button>${who}</span></div>
    <div class="pubnav"><input type="search" id="q" class="topq" placeholder="Search any bill: HB1563, vaping, school meals…" value="${esc(S.q)}" aria-label="Search bills"><div class="issuerow"><span class="issuelbl">Browse</span>${chips}<button class="fchip more" data-nav="find">＋ more</button></div></div>
    <div class="pubwrap">${inner}</div>`;
}
const resultRow = b => `
      <div class="row prow" data-open="${b.id}"><span class="bno">${esc(billNum(b))}</span>
        <span class="t">${esc(titleCase(b.title))}<small>${b.description || b.hiphi_summary ? esc(blurb(b, 120)) : ''}${b.hiphi_follows ? ' · HIPHI follows this bill' : ''}${(b.coalitions || []).length ? ' · ' + esc(b.coalitions.map(cname).join(', ')) : ''}${b.watchers ? ` · ${b.watchers} following` : ''}${!alive(b) ? ' · <span class="hot">did not advance</span>' : ''}</small></span>
        ${watchBtn(b)}</div>`;
function searchBox() {
  const chips = S.coalitions.length ? `<div class="browse">Browse HIPHI’s coalitions: ${groups().sort((a, b) => a.sort_order - b.sort_order).map(c => `<button class="fchip ${S.browse && c.names.includes(S.browse.name) ? 'on' : ''}" data-browse="${esc(c.names[0])}">${esc(c.key)} <span class="cnt">${c.bills}</span></button>`).join('')}${S.browse ? '<button class="fchip" data-browse="">✕ clear</button>' : ''}</div>` : '';
  return `${S.results ? `<div class="results">${S.results.length ? S.results.map(resultRow).join('') : '<div class="row" style="color:var(--muted)">No bill matches. Try the number, like HB1563, or a word from the title.</div>'}</div>` : ''}
    ${S.browse ? (({ picks, rest }) => `<div class="panel"><div class="ph"><span>${esc(cname(S.browse.name))} <span class="chipx c-gray">${S.browse.rows.length}</span></span><span class="psub">${(S.coalitions.find(c => c.name === S.browse.name) || {}).description ? esc(S.coalitions.find(c => c.name === S.browse.name).description) : ''}</span></div>
      ${picks.length ? `<div class="pickhead">HIPHI’s picks <span class="tok">· the bills we are pushing hardest</span> <button class="btn sm" data-watchpicks="${esc(S.browse.name)}">Follow these ${picks.length}</button></div><div class="results" style="border:0;margin:0">${picks.map(resultRow).join('')}</div>` : ''}
      <details class="fold" style="margin:6px 12px 10px"><summary class="tok" style="cursor:pointer">${rest.length} other bill${rest.length === 1 ? '' : 's'} in ${esc(cname(S.browse.name))} (${rest.filter(alive).length} live)</summary><div class="results" style="border:0;margin:0">${rest.map(resultRow).join('') || '<div class="row" style="color:var(--muted)">Nothing else.</div>'}</div></details></div>`)(curate(S.browse.rows, 8)) : ''}`;
}
// ---------------- Do this now: one card per open opportunity ----------------
const POS_VERB = { strongly_support: 'support', support: 'support', support_amend: 'support with amendments', strongly_oppose: 'oppose', oppose: 'oppose', neutral: 'comment on' };
const POS_WORD = { strongly_support: 'SUPPORT', support: 'SUPPORT', support_amend: 'SUPPORT WITH AMENDMENTS', strongly_oppose: 'OPPOSITION', oppose: 'OPPOSITION', neutral: 'COMMENTS' };
function actionsList(bills, hearings) {
  const now = Date.now();
  return hearings.filter(h => h.status === 'scheduled' && new Date(h.scheduled_at) > now)
    .map(h => ({ h, b: bills.find(b => b.id === h.bill_id) }))
    .filter(x => x.b && x.b.hiphi_position && x.b.hiphi_position !== 'monitor' && alive(x.b))
    .sort((x, y) => (x.h.testimony_deadline || x.h.scheduled_at).localeCompare(y.h.testimony_deadline || y.h.scheduled_at));
}
function actionCard(b, h) {
  const now = Date.now(), due = h.testimony_deadline, duePast = due && new Date(due) < now, dueSoon = due && !duePast && new Date(due) - now < 48 * 3600e3;
  const did = k => S.done.has(doneKey(b.id, h.id, k));
  const c = S.committees[String(h.committee).split('/')[0]], m = c ? { email: `${c.chamber === 'S' ? 'sen' : 'rep'}${(c.chair || '').replace(/^(rep\.|sen\.|representative|senator)\s+/i, '').replace(/\s*(jr\.?|sr\.?|ii|iii|iv)$/i, '').trim().split(/\s+/).pop().toLowerCase().replace(/[^a-z]/g, '')}@capitol.hawaii.gov` } : null;
  const cnt = S.actionCounts[b.id] || {};
  const proof = cnt.testimonies ? `<span class="proof">${cnt.testimonies} ${cnt.testimonies === 1 ? 'person has' : 'people have'} submitted testimony through HIPHI</span>` : '';
  const mail = m ? `mailto:${m.email}?subject=${encodeURIComponent(`${b.bill_number} — please ${POS_VERB[b.hiphi_position] || 'consider'} (hearing ${fmtDT(h.scheduled_at)})`)}&body=${encodeURIComponent(`Dear Chair ${c.chair || ''},\n\nI am writing in ${POS_WORD[b.hiphi_position] || 'regard'} of ${b.bill_number}, ${titleCase(b.title)}.\n\n${b.hiphi_action || b.hiphi_summary || ''}\n\n[Add a sentence about why this matters to you.]\n\nMahalo,\n`)}` : null;
  const doneAll = did('testimony');
  return `<div class="acard ${posCls(b)} ${doneAll ? 'done' : ''}" data-acard="${b.id}">
    <div class="ahead"><span class="apos">HIPHI ${esc(POS[b.hiphi_position] || '')}</span><b data-open="${b.id}">${esc(billNum(b))}</b> <span class="atitle">${esc(titleCase(b.title))}</span></div>
    <div class="aask">${esc(b.hiphi_action || blurb(b, 140))}</div>
    <div class="awhen">${esc(h.committee)} hearing ${fmtDT(h.scheduled_at)} · ${esc(clean(h.room))}${due ? ` · <span class="${dueSoon ? 'hot' : ''}">testimony ${duePast ? 'deadline passed' : 'due ' + inWhen(due)}</span>` : ''}</div>
    <div class="abtns">
      ${doneAll ? `<span class="adone">✓ You submitted testimony</span><button class="linkbtn" data-undo="${b.id}|${h.id}|testimony">undo</button>` : `<button class="btn" data-helper="${h.id}" ${duePast ? 'title="The written deadline has passed; late testimony is still posted"' : ''}>Submit testimony</button>`}
      ${mail ? `<a class="btn sm ghost" href="${mail}" data-did="${b.id}|${h.id}|email">${did('email') ? '✓ Emailed the chair' : 'Email the chair'}</a>` : ''}
      ${calLinks(b, h)}
      <button class="btn sm ghost" data-share="${esc(b.bill_number)}">${did('share') ? '✓ Shared' : 'Share'}</button>
    </div>
    ${proof}
  </div>`;
}
function doNowHTML(bills, hearings, title, waiting = 0) {
  const list = actionsList(bills, hearings);
  if (!list.length) return waiting ? `<div class="panel donow" id="pf-actions"><div class="ph"><span>✊ ${title}</span></div><div class="pempty">${waiting} of your bills ${waiting === 1 ? 'is' : 'are'} waiting for a hearing. The moment one is scheduled, a five-minute action appears here${S.session ? ' and in your email' : ' — sign in to get it by email'}.</div></div>` : '';
  const open = list.filter(x => !S.done.has(doneKey(x.b.id, x.h.id, 'testimony'))), done = list.filter(x => S.done.has(doneKey(x.b.id, x.h.id, 'testimony')));
  return `<div class="panel donow" id="pf-actions"><div class="ph"><span>✊ ${title} <span class="chipx c-gold">${open.length}</span></span><span class="psub">soonest deadline first · five minutes each</span></div>
    ${open.map(x => actionCard(x.b, x.h)).join('') || '<div class="pempty">Nothing open right now. 🤙</div>'}
    ${waiting ? `<div class="awaiting">${waiting} more of your bills ${waiting === 1 ? 'is' : 'are'} waiting for a hearing; an action appears here the moment one is scheduled.</div>` : ''}
    ${done.length ? `<details class="adonefold"><summary>${done.length} done this week</summary>${done.map(x => actionCard(x.b, x.h)).join('')}</details>` : ''}
  </div>`;
}
// ---------------- the testimony helper ----------------
function helperHTML() {
  const { b, h } = S.helper; let me = {}; try { me = JSON.parse(localStorage.getItem('hiphi_me') || '{}'); } catch { /* ignore */ }
  const c = S.committees[String(h.committee).split('/')[0]];
  const word = POS_WORD[b.hiphi_position] || 'COMMENTS', verb = POS_VERB[b.hiphi_position] || 'comment on';
  const text = (name, town, why, speak) => [
    `Testimony in ${word} of ${b.bill_number}${b.current_version ? ' ' + b.current_version : ''}`,
    titleCase(b.title),
    `${c ? c.name + ' (' + h.committee + ')' : 'Committee on ' + h.committee} · Hearing ${fmtDT(h.scheduled_at)} · ${clean(h.room)}`,
    '',
    `Dear Chair ${c?.chair || ''}${c?.vice_chair ? ', Vice Chair ' + c.vice_chair : ''}, and members of the committee,`,
    '',
    `My name is ${name || '[your name]'} and I live in ${town || '[your town]'}. I ${verb} ${b.bill_number}${b.hiphi_summary ? ', which ' + b.hiphi_summary.replace(/^[A-Z]/, m => m.toLowerCase()).replace(/\.?$/, '.') : '.'}`,
    b.hiphi_action ? `\n${b.hiphi_action}` : '',
    why && why.trim() ? `\n${why.trim()}` : '',
    '',
    /OPPOS/.test(word) ? `I respectfully ask the committee to hold ${b.bill_number}.` : `I respectfully ask the committee to pass ${b.bill_number}.`,
    speak ? `I would like to testify ${speak === 'remote' ? 'remotely by video' : 'in person'} at the hearing.` : '',
    '',
    'Mahalo for the opportunity to testify,',
    name || '[your name]',
  ].filter(l => l !== null).join('\n').replace(/\n{3,}/g, '\n\n');
  S.helperText = text;
  return `<div class="scrim" id="hscrim"></div><div class="drawer helper">
    <div class="dhead"><button class="close" id="hclose">✕</button><h2>Submit testimony on ${esc(b.bill_number)}</h2><div class="sub">${esc(POS[b.hiphi_position] || '')} · ${esc(h.committee)} hearing ${fmtDT(h.scheduled_at)}${h.testimony_deadline ? ` · written testimony due ${fmtDT(h.testimony_deadline)}` : ''}</div></div>
    <div class="dbody">
      <ol class="hsteps" id="h-steps"><li data-step="1"><b>Fill in your name and town.</b> We write the rest from HIPHI’s position; add a sentence of your own if you like.</li><li data-step="2"><b>Copy your testimony.</b></li><li data-step="3"><b>Paste it at the Capitol.</b> The button opens the bill’s page: press Submit Testimony, sign in (free account), pick this hearing, paste.</li><li data-step="4"><b>Come back and press “I submitted it”.</b></li></ol>
      <div class="hform">
        <label>Your name<input id="h-name" value="${esc(me.name || '')}" placeholder="Jane Doe"></label>
        <label>Where you live<input id="h-town" value="${esc(me.town || '')}" placeholder="Hilo, Hawaiʻi Island"></label>
        <label>Why this matters to you <span class="tok">one or two sentences, optional</span><textarea id="h-why" rows="3" placeholder="As a parent of two teenagers…">${esc(me.why || '')}</textarea></label>
        <label class="row"><span>Speak at the hearing?</span><select id="h-speak"><option value="">No, written only</option><option value="remote">Yes, remotely by video</option><option value="person">Yes, in person</option></select></label>
      </div>
      <div class="sec">Your testimony</div>
      <textarea id="h-text" class="htext" rows="14">${esc(text(me.name, me.town, me.why, ''))}</textarea>
      <div class="hnext" id="h-next"></div>
      <div class="hbtns">
        <button class="btn" id="h-copy">Copy testimony</button>
        <a class="btn ghost" id="h-dl" download="${esc(b.bill_number)}-testimony.txt">Download instead</a>
        ${b.state_url ? `<a class="btn ghost" id="h-capitol" href="${esc(b.state_url)}" target="_blank" rel="noopener">Open the Capitol page ↗</a>` : ''}
      </div>
      <div class="hdone"><button class="btn sm ghost" id="h-did">✓ I submitted it</button><span class="tok">Marks it done here${S.session ? '' : ' on this device'}; HIPHI only ever sees a count.</span></div>
    </div></div>`;
}
function wireHelper() {
  if (!S.helper) return;
  const { b, h } = S.helper;
  const close = () => { S.helper = null; render(); };
  $('#hscrim').onclick = close; $('#hclose').onclick = close;
  const regen = () => { const name = $('#h-name').value.trim(), town = $('#h-town').value.trim(), why = $('#h-why').value, speak = $('#h-speak').value;
    try { localStorage.setItem('hiphi_me', JSON.stringify({ name, town, why })); } catch { /* ignore */ }
    S.helper = { ...S.helper, name, town, why, speak }; $('#h-text').value = S.helperText(name, town, why, speak); refreshDl(); };
  // Which step is next: blanks -> 1, ready -> 2, copied -> 3.
  const ready = () => $('#h-name').value.trim() && $('#h-town').value.trim();
  const showStep = () => { const step = S.helper.copied ? 3 : ready() ? 2 : 1;
    document.querySelectorAll('#h-steps li').forEach(li => li.classList.toggle('now', Number(li.dataset.step) === step));
    document.querySelectorAll('#h-steps li').forEach(li => li.classList.toggle('done', Number(li.dataset.step) < step));
    const copy = $('#h-copy'), cap = $('#h-capitol'), did = $('#h-did'), nx = $('#h-next');
    copy.disabled = !ready(); copy.textContent = ready() ? (S.helper.copied ? 'Copied ✓ · copy again' : 'Copy your testimony') : 'Fill in your name and town first';
    copy.classList.toggle('ghost', S.helper.copied); if (cap) cap.classList.toggle('ghost', !S.helper.copied); did.classList.toggle('ghost', !S.helper.copied);
    nx.innerHTML = step === 1 ? '<b>Next:</b> your name and where you live go in above — the testimony fills itself in.'
      : step === 2 ? '<b>Next:</b> press Copy. Then the Capitol button opens the bill’s page in a new tab.'
      : `<b>Copied.</b> Now open the Capitol page, press <b>Submit Testimony</b>, sign in, choose the ${esc(h.committee)} hearing on ${fmtDate(h.scheduled_at)}, and paste. Then come back and press <b>I submitted it</b>.`;
    ['#h-name', '#h-town'].forEach(id => $(id).classList.toggle('missing', !$(id).value.trim())); };
  const refreshDl = () => { $('#h-dl').href = 'data:text/plain;charset=utf-8,' + encodeURIComponent($('#h-text').value); showStep(); };
  ['#h-name', '#h-town', '#h-why', '#h-speak'].forEach(id => { $(id).oninput = () => { S.helper.copied = false; regen(); }; $(id).onchange = () => { S.helper.copied = false; regen(); }; });
  $('#h-text').oninput = () => { S.helper.copied = false; refreshDl(); }; refreshDl();
  $('#h-copy').onclick = async () => { if (!ready()) { $('#h-name').focus(); return; } try { await navigator.clipboard.writeText($('#h-text').value); S.helper.copied = true; showStep(); toast('Copied — now open the Capitol page and paste'); $('#h-capitol')?.focus(); } catch { $('#h-text').select(); toast('Select all and copy', true); } };
  $('#h-did').onclick = async () => { await markDone(b.id, h.id, 'testimony'); toast('Marked done. Mahalo for testifying!'); close(); };
}
// HIPHI's picks for a coalition: strongly supported/opposed first, then bills
// with a position and a hearing coming up, then the rest with a position. Dead
// bills stay out. Capped so a first-timer sees a handful, not hundreds.
const POS_RANK = { strongly_support: 0, strongly_oppose: 0, support: 1, oppose: 1, support_amend: 2, neutral: 3 };
function curate(rows, cap = 6) {
  const now = Date.now(), up = new Set([...S.hearings, ...((S.featured || {}).hearings || [])].filter(h => new Date(h.scheduled_at) > now).map(h => h.bill_id));
  const live = rows.filter(b => alive(b) && b.hiphi_position && b.hiphi_position !== 'monitor');
  live.sort((a, b) => (POS_RANK[a.hiphi_position] ?? 9) - (POS_RANK[b.hiphi_position] ?? 9) || (up.has(b.id) - up.has(a.id)) || a.bill_number.localeCompare(b.bill_number));
  return { picks: live.slice(0, cap), rest: rows.filter(b => !live.slice(0, cap).includes(b)) };
}
async function billsForCoalitions(names) {
  if (DEMO) return D.bills.filter(b => b.coalitions.some(n => names.includes(n)));
  const { data, error } = await S.supa.from('public_all_bills').select('*').overlaps('coalitions', names).not('hiphi_position', 'is', null).neq('hiphi_position', 'monitor').limit(400);
  if (error) throw error; return data || [];
}
// ---------- the guided start: pick issues -> pick bills -> done ----------
function wiz() { try { return JSON.parse(localStorage.getItem('hiphi_wiz') || '{"step":1,"issues":[]}'); } catch { return { step: 1, issues: [] }; } }
function wizSet(patch) { const w = { ...wiz(), ...patch }; try { localStorage.setItem('hiphi_wiz', JSON.stringify(w)); } catch { /* ignore */ } return w; }
function wizardHTML() {
  const w = wiz(); const sel = new Set(w.issues || []);
  if (w.step === 2) {
    const rows = S.wizRows;
    if (!rows) { billsForCoalitions([...sel].flatMap(groupNames)).then(r => { S.wizRows = r; render(); }).catch(e => toast(e.message, true)); return `<div class="wiz"><div class="pempty">Finding HIPHI’s picks…</div></div>`; }
    const picked = new Set(S.wizPick || []);
    const groups = [...sel].map(name => { const names = groupNames(name); const mine = rows.filter(b => (b.coalitions || []).some(n => names.includes(n))); const { picks, rest } = curate(mine, S.wizMore?.[name] ? 40 : 6); return { name, picks, more: mine.filter(b => alive(b) && b.hiphi_position && b.hiphi_position !== 'monitor').length - picks.length }; });
    const card = b => { const c = S.coalitions.find(x => x.name === (b.coalitions || [])[0]); const h = [...((S.featured || {}).hearings || [])].find(x => x.bill_id === b.id); return `
      <label class="pick ${picked.has(b.id) ? 'on' : ''}"><input type="checkbox" data-wizpick="${b.id}" ${picked.has(b.id) ? 'checked' : ''}>
        <span class="pickb"><span class="pickl1"><b>${esc(billNum(b))}</b> <span class="chipx ${/oppose/.test(b.hiphi_position) ? 'c-red' : 'c-green'}">HIPHI ${esc(POS[b.hiphi_position] || '')}</span>${h ? ` <span class="chipx c-gold">hearing ${fmtDate(h.scheduled_at)}</span>` : ''}</span>
        <span class="pickt">${esc(b.hiphi_summary || titleCase(b.title))}</span></span></label>`; };
    return `<div class="wiz">
      <div class="wizhead"><span class="wizk">Step 2 of 2</span><h1>Pick the bills you want to follow</h1><p>These are HIPHI’s picks for ${[...sel].map(n => esc(cname(n))).join(', ')}. Tap the ones you care about, or take all the picks. You can change this any time.</p></div>
      ${groups.map(g => `<div class="wizgroup"><div class="wizg"><span>${esc((S.coalitions.find(c => c.name === g.name) || {}).icon || '')} ${esc(cname(g.name))}</span><button class="linkbtn" data-wizall="${esc(g.name)}">${g.picks.every(b => picked.has(b.id)) ? 'Clear these' : `Take all ${g.picks.length}`}</button></div>
        ${g.picks.map(card).join('') || '<div class="pempty">No live bills with a HIPHI position here right now.</div>'}
        ${g.more > 0 ? `<button class="morelink" data-wizmore="${esc(g.name)}">${g.more} more in ${esc(cname(g.name))}</button>` : ''}</div>`).join('')}
      <div class="wizfoot"><button class="btn ghost" data-wizback>← Issues</button><button class="btn ghost" data-wizsearch>Skip for now</button><span class="wizn">${picked.size} selected</span><button class="btn" data-wizdone ${picked.size ? '' : 'disabled'}>Follow ${picked.size || ''} bill${picked.size === 1 ? '' : 's'} →</button></div>
    </div>`;
  }
  const gen = c => /general/i.test(c.key) ? 1 : 0;
  const tiles = groups().sort((a, b) => gen(a) - gen(b) || (b.live || 0) - (a.live || 0)).map(c => `
    <label class="tile ${sel.has(c.names[0]) ? 'sel' : ''}"><input type="checkbox" data-wizissue="${esc(c.names[0])}" ${sel.has(c.names[0]) ? 'checked' : ''}><span class="ticon">${esc(c.icon || '📋')}</span><span class="tname">${esc(c.key)}</span><span class="tdesc">${esc(c.description || '')}</span><span class="tcount">${c.live ? `<b>${c.live}</b> live bill${c.live === 1 ? '' : 's'}` : 'no live bills right now'}</span><span class="tick">✓</span></label>`).join('');
  return `<div class="wiz">
    <div class="wizhead"><span class="wizk">Step 1 of 2 · <button class="linkbtn" data-wizsearch>skip</button></span><h1>What do you care about?</h1><p>Pick one or more. Next you choose a few bills, and this page becomes your week at the Capitol with a five-minute way to testify. Or skip and just search.</p></div>
    <div class="tiles">${tiles}</div>
    <div class="wizfoot"><button class="btn ghost" data-wizsearch>Skip for now</button><span class="wizn">${sel.size ? `${sel.size} issue${sel.size === 1 ? '' : 's'} picked` : 'pick at least one, or skip'}</span><button class="btn" data-wiznext ${sel.size ? '' : 'disabled'}>Continue →</button></div>
  </div>`;
}
// The three steps a new person walks: pick issues, watch bills, get alerts.
function stripHTML() {
  const o = onb(); if (o.dismissed) return '';
  const done = [!!(o.issues || S.browse || S.watch.size), S.watch.size > 0, [...S.done].some(k => k.endsWith('|testimony'))];
  if (done.every(Boolean)) return '';
  const cur = done.findIndex(d => !d);
  const steps = [['Pick your issues', 'one or more'], ['Follow bills', 'HIPHI’s picks, or your own'], ['Take action', 'testimony, or a note to a chair, in five minutes']];
  return `<div class="onbstrip">${steps.map(([t, h], i) => `<div class="onbstep ${done[i] ? 'done' : i === cur ? 'now' : ''}"><span class="onbn">${done[i] ? '✓' : i + 1}</span><span class="onbt">${t}<small>${h}</small></span></div>`).join('<span class="onbsep"></span>')}<button class="onbx" data-onbdismiss title="Hide">✕</button></div>`;
}
function nudgeHTML() {
  if (!S.nudge || S.session) return '';
  return `<div class="nudge"><div><b>Saved on this device.</b> Enter your email to keep your list on every device and get an email when one of your bills gets a hearing.</div>
    ${DEMO ? '<span class="tok">Sign-in is off in the sandbox.</span>' : `<form class="nudgeform" id="nudge-form"><input type="email" id="nudge-email" placeholder="you@example.com" autocomplete="email" required><button class="btn sm">Send me a link</button></form>`}
    <button class="nudgex" data-nudgex>Later</button></div>`;
}
function landing() {
  const now = Date.now();
  const gen = c => /general/i.test(c.key) ? 1 : 0;   // the catch-all tile goes last
  const tiles = groups().sort((a, b) => gen(a) - gen(b) || (b.live || 0) - (a.live || 0) || (a.sort_order || 0) - (b.sort_order || 0)).map(c => `
    <button class="tile" data-tile="${esc(c.names[0])}"><span class="ticon">${esc(c.icon || '📋')}</span><span class="tname">${esc(c.key)}</span><span class="tdesc">${esc(c.description || '')}</span><span class="tcount">${c.live ? `<b>${c.live}</b> live bill${c.live === 1 ? '' : 's'} · ` : ''}${c.bills} this session</span></button>`).join('');
  const f = S.featured || { hearings: [], bills: [] };
  const featured = f.hearings.slice(0, 8).map(h => { const b = f.bills.find(x => x.id === h.bill_id); if (!b) return ''; return `
    <div class="prow calrow ${posCls(b)}" data-open="${b.id}"><span class="caltime">${fmtDT(h.scheduled_at)}</span>
      <div class="pmain"><b>${esc(billNum(b))}</b> <span class="cm">${esc(h.committee)}</span>${b.hiphi_position ? ` <span class="chipx c-teal">HIPHI ${POS[b.hiphi_position] || ''}</span>` : ''}<div class="pdesc">${esc(blurb(b, 110))}</div></div>${watchBtn(b)}</div>`; }).join('');
  const guided = !wiz().skipped || S.view === 'wizard';
  if (guided) return `${stripHTML()}${wizardHTML()}${recoHTML(false).replace('More ways to help this week', 'Or act on one bill right now')}`;
  return `
    ${stripHTML()}
    <div class="pubhead"><h1>Follow the bills that matter to Hawaiʻi’s health</h1><span class="sub">Search above, pick an issue below, or take the <button class="linkbtn" data-wizrestart>guided start</button>. Follow a few bills and this page becomes your week at the Capitol: hearings, deadlines, and how to testify.</span></div>
    <div class="tiles">${tiles}</div>
    ${!S.browse ? doNowHTML(f.bills, f.hearings, 'This week’s actions') : ''}
    ${!S.browse && featured ? `<div class="panel sec-cal"><div class="ph"><span>◷ Also this week at the Capitol</span><span class="psub">hearings on bills HIPHI is working on · Follow any of them</span></div>${featured}</div>` : ''}
    ${nudgeHTML()}`;
}
// Add bills: search, browse by issue, or run the guided picks again.
function find() {
  const gen = c => /general/i.test(c.key) ? 1 : 0;
  const tiles = groups().sort((a, b) => gen(a) - gen(b) || (b.live || 0) - (a.live || 0)).map(c => `
    <button class="tile" data-tile="${esc(c.names[0])}"><span class="ticon">${esc(c.icon || '📋')}</span><span class="tname">${esc(c.key)}</span><span class="tdesc">${esc(c.description || '')}</span><span class="tcount">${c.live ? `<b>${c.live}</b> live bill${c.live === 1 ? '' : 's'}` : 'no live bills right now'}</span></button>`).join('');
  return `<div class="pubhead"><h1>${S.browse ? esc(cname(S.browse.name)) : S.results ? `Search: “${esc(S.q)}”` : 'Add bills'}</h1><span class="sub">${S.browse || S.results ? `<button class="linkbtn" data-browse="">← all issues</button> · ` : ''}search above, pick an issue, or <button class="linkbtn" data-wizrestart>start over with the guided picks</button>. You follow ${S.watch.size} bill${S.watch.size === 1 ? '' : 's'}.</span></div>
    ${searchBox()}
    ${S.browse || S.results ? '' : listsStrip()}
    ${S.browse || S.results ? '' : `<div class="sec">Issues</div><div class="tiles">${tiles}</div>`}
    ${S.browse || S.results ? '' : recoHTML(false).replace('More ways to help this week', 'Bills that need someone this week')}`;
}
const consentCardHTML = () => S.consentCard && S.user && !DEMO ? `<section class="ccard"><div class="sec">Two quick choices</div>
    <label class="row"><input type="checkbox" id="cc-alerts"><span><b>Email me when a hearing is scheduled on a bill I follow.</b> <small>Off unless you tick it.</small></span></label>
    <label class="row"><input type="checkbox" id="cc-share"><span><b>Let HIPHI see which bills I follow</b> <small>so staff can reach out about them. Otherwise they only see counts.</small></span></label>
    <div class="btns"><button class="btn sm" id="cc-save">Save</button><button class="btn sm ghost" id="cc-later">Not now</button></div></section>` : '';
function home() {
  const now = Date.now();
  if (!S.watch.size || S.view === 'wizard') return landing();
  const hUp = S.hearings.filter(h => h.status === 'scheduled' && new Date(h.scheduled_at) > now).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const wk = now + 7 * 864e5;
  const mondayOf = t => { const d = new Date(hstDay(t) + 'T12:00:00-10:00'); return t - ((d.getUTCDay() + 6) % 7) * 864e5; };
  const off = S.weekOffset, wkStart = mondayOf(now + off * 7 * 864e5), wkEnd = wkStart + 7 * 864e5;   // always a Mon–Sun week, so paging never skips a day
  const week = S.hearings.filter(h => h.status !== 'cancelled' && new Date(h.scheduled_at) >= new Date(hstDay(wkStart) + 'T00:00:00-10:00') && new Date(h.scheduled_at) < new Date(hstDay(wkEnd) + 'T00:00:00-10:00'))
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const all7 = [...Array(7)].map((_, i) => hstDay(wkStart + i * 864e5));
  const isWeekend = d => [0, 6].includes(new Date(d + 'T12:00:00-10:00').getDay());
  const days = all7.filter(d => !isWeekend(d) || week.some(h => hstDay(h.scheduled_at) === d));
  const wkLabel = off === 0 ? 'This week' : off === 1 ? 'Next week' : off === -1 ? 'Last week' : 'Week of ' + fmtDate(hstDay(wkStart) + 'T12:00:00-10:00', { month: 'short' });
  const calRow = h => { const b = bill(h.bill_id); if (!b) return ''; const dueSoon = h.testimony_deadline && (new Date(h.testimony_deadline) - now) < 48 * 3600e3 && new Date(h.testimony_deadline) > now; const past = new Date(h.scheduled_at) < now; return `
    <div class="prow calrow ${posCls(b)}" data-open="${b.id}">
      <span class="caltime">${new Date(h.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: HST })}</span>
      <div class="pmain"><b>${esc(billNum(b))}</b> <span class="cm">${esc(h.committee)} · ${esc(clean(h.room))}</span>${past ? `<div class="tagline">${outcomeChip(h)}</div>` : ''}
        <div class="pdesc">${esc(blurb(b, 96))}</div>
        <div class="psmall">${h.testimony_deadline && !past ? (inWhen(h.testimony_deadline) === 'passed' ? 'testimony deadline passed' : `written testimony due <b${dueSoon ? ' class="hot"' : ''}>${inWhen(h.testimony_deadline)}</b>`) : ''}</div></div>
      <div class="calbtns">${!past && alive(b) && b.hiphi_position && b.hiphi_position !== 'monitor' ? `<button class="btn sm" data-helper="${h.id}" onclick="event.stopPropagation()">Submit testimony</button>` : b.state_url && alive(b) && !past ? `<a class="btn sm ghost" href="${esc(b.state_url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Submit testimony ↗</a>` : ''}${!past ? calLinks(b, h) : ''}</div>
    </div>`; };
  const calHtml = `<div class="calweek" style="--ndays:${days.length}">${days.map(d => { const hs = week.filter(h => hstDay(h.scheduled_at) === d); const dt = new Date(d + 'T12:00:00-10:00'); const isToday = d === hstDay(now), isPast = d < hstDay(now); return `
    <div class="calday${hs.length ? '' : ' nohear'}${isToday ? ' today' : ''}${isPast ? ' past' : ''}"><div class="calrail"><span class="dow">${dt.toLocaleDateString('en-US', { weekday: 'short', timeZone: HST })}</span><span class="dom">${dt.getDate()}</span>${isToday ? '<span class="tod">today</span>' : ''}${hs.length ? `<span class="cnt">${hs.length}</span>` : ''}</div>
      <div class="calbody">${hs.length ? hs.map(calRow).join('') : '<div class="calnone">no hearings</div>'}</div></div>`; }).join('')}</div>`;
  const calNav = `<span class="calnav"><button data-week="-1" title="Previous week (p)">‹</button>${off ? '<button data-week="0">Today</button>' : ''}<button data-week="1" title="Next week (n)">›</button></span>`;

  // board
  const cur = S.deadlines.find(d => new Date(d.deadline_date + 'T23:59:59-10:00') > now) || null;
  const cols = { a: [], b: [], c: [] };
  for (const b of S.bills.filter(alive)) { const st = stopOf(b); if (st.column) cols[st.column].push({ b, st, h: st.hearing, dl: st.deadline }); }
  const { a, b: bcol, c } = cols;
  a.sort((x, y) => (x.dl ? x.dl.days : 999) - (y.dl ? y.dl.days : 999)); bcol.sort((x, y) => x.h.scheduled_at.localeCompare(y.h.scheduled_at));
  const stopn = st => `<span class="stopn">in the ${CHAMBER_NAME[st.chamber]}${st.stops ? ` · committee ${st.stop} of ${st.stops}` : ''}</span>`;
  const phaseLabel = st => st.phase === 'conference' ? 'Conference' : `${CHAMBER_NAME[st.chamber]} floor`;
  const ORD = ['first', 'second', 'third', 'fourth', 'fifth'];
  const chip = (b, sentence, hot) => `<div class="chip3 ${posCls(b)}" data-open="${b.id}"><span class="l1"><b>${esc(billNum(b))}</b></span><span class="ldesc">${esc(b.hiphi_summary || blurb(b, 120))}</span><span class="l2 ${hot ? 'hot' : ''}">${sentence}</span></div>`;
  const where = st => st.committee ? `${esc(st.committee)}${st.stops ? `, the ${CHAMBER_NAME[st.chamber]}’s ${ORD[st.stop - 1] || st.stop + 'th'} of ${st.stops} committee${st.stops === 1 ? '' : 's'} for this bill` : ''}` : `waiting to be assigned a committee in the ${CHAMBER_NAME[st.chamber]}`;
  const PUB_COLUMNS = { a: { icon: '📡', title: 'Waiting for a hearing', sub: 'nothing scheduled yet' }, b: { icon: '◷', title: 'Hearing scheduled', sub: 'or held, waiting for the committee’s decision' }, c: { icon: '✅', title: 'Through committee', sub: 'waiting for a vote of the full chamber' } };
  const col = (key, rows, empty) => { const C = PUB_COLUMNS[key]; return `<div class="panel bcol bcol-${key}" id="pf-board-${key}"><div class="ph"><span>${C.icon} ${C.title} <span class="cnt">${rows.length}</span></span><span class="psub">${C.sub}</span></div>${rows.length ? `<div class="chips">${rows.join('')}</div>` : `<div class="pempty">${empty}</div>`}</div>`; };
  const dlDays = cur ? Math.ceil((new Date(cur.deadline_date + 'T23:59:59-10:00') - now) / 864e5) : null;
  const board = cur ? `
    <div class="dashhead boardhead"><h1>Where your bills stand</h1><span class="sub">Left to right in each chamber: needs a hearing → hearing scheduled → through committee, then a vote. A bill that misses its deadline (next: <b>${fmtDate(cur.deadline_date + 'T12:00:00-10:00', { month: 'short' })}</b>) stops for the year.</span></div>
    <div class="board3">
      ${col('a', a.map(({ b, st, dl }) => chip(b, `Waiting in ${where(st)}. ${dl ? `Needs a hearing by ${fmtDate(dl.date + 'T12:00:00-10:00', { month: 'short' })}${dl.days <= 5 ? ` — ${dl.days} day${dl.days === 1 ? '' : 's'} left` : ''}.` : 'Needs a hearing.'}${st.committee && chairOf(st.committee) ? ` Chair: ${chairOf(st.committee).replace(/^ · Chair /, '')}` : ''}`, dl && dl.days <= 5)), 'Every bill you follow has a hearing or is through committee.')}
      ${col('b', bcol.map(({ b, st, h }) => chip(b, st.hearingState === 'held' ? `Heard by ${esc(h.committee)} on ${fmtDate(h.scheduled_at)}; waiting for the committee’s decision.` : `${esc(h.committee)} hearing ${fmtDT(h.scheduled_at)}${h.testimony_deadline && new Date(h.testimony_deadline) > now ? ` · testimony due ${inWhen(h.testimony_deadline)}` : ''}.`, h.testimony_deadline && new Date(h.testimony_deadline) > now && new Date(h.testimony_deadline) - now < 48 * 3600e3)), 'No hearings on the books.')}
      ${col('c', c.map(({ b, st }) => chip(b, st.phase === 'conference' ? 'Passed both chambers in different forms; House and Senate are working out one version.' : `Through the ${CHAMBER_NAME[st.chamber]} committees; waiting for the full ${CHAMBER_NAME[st.chamber]} to vote.`, false)), 'Nothing is through committee yet.')}
    </div>` : '';

  // feed + recent hearings (top dash, like the staff page)
  const recent = S.activity.filter(ev => now - new Date(ev.occurred_at) < 72 * 3600e3);
  const feed = `<div class="panel sec-feed" id="pf-recent"><div class="ph"><span>⚡ Last 72 hours <span class="chipx c-gray">${recent.length}</span></span><span class="psub">newest first</span></div>
    ${recent.length ? `<div class="tl72">${recent.slice(0, 20).map(ev => { const b = bill(ev.bill_id); return `<div class="tlrow ${/hearing/i.test(ev.title) ? 'notice' : /reading|passed|failed|vetoed|signed|act \d+/i.test(ev.title) ? 'vote' : 'ref'}" data-open="${b.id}"><span class="tldot"></span><span class="tlts">${esc(fmtDT(ev.occurred_at))}</span><div class="tltext"><b>${esc(billNum(b))}</b> ${esc(ev.title.slice(0, 100))}<span class="tltitle">${esc(blurb(b, 100))}</span></div></div>`; }).join('')}</div>` : '<div class="pempty">Nothing happened on your bills in the last three days.</div>'}</div>`;
  const recentH = S.hearings.filter(h => h.status !== 'cancelled' && new Date(h.scheduled_at) <= now && new Date(h.scheduled_at) > now - 7 * 864e5).sort((x, y) => y.scheduled_at.localeCompare(x.scheduled_at));
  const recentHearings = `<div class="panel" id="pf-outcomes"><div class="ph"><span>🏛 Recent hearings <span class="chipx c-gray">${recentH.length}</span></span><span class="psub">what the committee did</span></div>
    ${recentH.length ? recentH.slice(0, 10).map(h => { const b = bill(h.bill_id); if (!b) return ''; const o = S.outcomes[h.id]; return `<div class="prow ${posCls(b)}" data-open="${b.id}"><div class="pmain"><b>${esc(billNum(b))}</b> · ${esc(h.committee)} · ${fmtDT(h.scheduled_at)} ${outcomeChip(h)}<div class="pdesc">${o?.report ? esc(o.report.slice(0, 110)) : esc(blurb(b, 110))}</div></div></div>`; }).join('') : '<div class="pempty">No hearings on your bills in the last week.</div>'}</div>`;

  const due48 = hUp.filter(h => h.testimony_deadline && new Date(h.testimony_deadline) > now && new Date(h.testimony_deadline) - now < 48 * 3600e3).length;
  const liveBills = S.bills.filter(alive).sort((x, y) => x.bill_number.localeCompare(y.bill_number));
  const deadBills = S.bills.filter(b => !alive(b)).sort((x, y) => x.bill_number.localeCompare(y.bill_number));
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: HST });
  const strip = [`${S.watch.size} bill${S.watch.size === 1 ? '' : 's'}`, due48 ? `<a data-jump="pf-actions" class="hot">${due48} testimony deadline${due48 === 1 ? '' : 's'} in 48h</a>` : null,
    week.length ? `<a data-jump="pf-week">${week.length} hearing${week.length === 1 ? '' : 's'} this week</a>` : null, a.length ? `<a data-jump="pf-board-a">${a.length} waiting for a hearing</a>` : null,
    recent.length ? `<a data-jump="pf-recent">${recent.length} update${recent.length === 1 ? '' : 's'} in 72h</a>` : null,
    cur ? `next deadline for bills in committee: ${fmtDate(cur.deadline_date + 'T12:00:00-10:00', { month: 'short' })}` : null, S.user || DEMO ? null : '<a data-nav="signin">sign in</a> to keep this list everywhere'].filter(Boolean).join(' · ');
  const waitingN = a.length;
  const watchRow = b => `<div class="prow ${posCls(b)}" data-open="${b.id}"><div class="pmain"><b>${esc(billNum(b))}</b> <span class="chipx c-gray explain" data-explain="${esc(STAGE_PLAIN[b.stage] || '')}" title="tap for what this means">${STAGE_LABEL[b.stage] || 'Introduced'}</span>${b.hiphi_position ? ` <span class="chipx c-teal">HIPHI ${POS[b.hiphi_position] || ''}</span>` : ''}<div class="pdesc">${esc(blurb(b, 120))}</div>${!alive(b) ? `<div class="psmall">${whyDead(b)}</div>` : ''}</div>${watchBtn(b)}</div>`;
  const dashPanels = [recent.length ? feed : '', recentH.length ? recentHearings : ''].filter(Boolean);
  const phone = window.innerWidth < 760;
  const browse = '';
  return `
    ${stripHTML()}${nudgeHTML()}
    <div class="pubhead"><h1>Your bills and actions</h1><span class="sub">${today} · ${strip}</span></div>
    ${(open => `${open ? doNowHTML(S.bills, S.hearings, 'Do this now', waitingN) : ''}${recoHTML(!open)}${open ? '' : doNowHTML(S.bills, S.hearings, 'Do this now', waitingN)}`)(actionsList(S.bills, S.hearings).some(x => !S.done.has(doneKey(x.b.id, x.h.id, 'testimony'))))}
    ${browse}
    ${dashPanels.length ? `<div class="dash${dashPanels.length === 1 ? ' one' : ''}">${dashPanels.map(p => `<div>${p}</div>`).join('')}</div>` : ''}
    ${(fold => fold ? `<details class="panel sec-cal foldp" id="pf-week"><summary class="ph"><span>◷ ${wkLabel}</span><span class="psub">no hearings on your bills this week · tap to page through weeks</span></summary>${calNav}${calHtml}</details>`
        : `<div class="panel sec-cal" id="pf-week"><div class="ph"><span>◷ ${wkLabel} ${calNav}</span><span class="psub">hearings on your bills · add any to your calendar</span></div>${(week.length || off) ? calHtml : '<div class="pempty">No hearings on your bills in the next 7 days.</div>'}</div>`)(phone && !week.length && !off)}
    ${(fold => fold ? `<details class="foldp boardfold"><summary class="ph"><span>🗂 Where your bills stand</span><span class="psub">${a.length} waiting for a hearing · ${bcol.length} scheduled · ${c.length} through committee · tap to open</span></summary>${board}</details>` : board)(phone && !bcol.length && !a.some(x => x.dl && x.dl.days <= 7))}
    <div class="panel" id="pf-list"><div class="ph"><span>★ Your bills</span><span class="psub">${liveBills.length} live · tap a bill for details</span></div>
      ${liveBills.map(watchRow).join('') || '<div class="pempty">None of your bills are still moving.</div>'}</div>
    ${deadBills.length ? `<details class="panel dead fold" id="pf-dead"><summary class="ph"><span>🪦 Did not advance <span class="chipx c-gray">${deadBills.length}</span></span><span class="psub">why each one stopped</span></summary>${deadBills.map(watchRow).join('')}</details>` : ''}`;
}
function testifyBox() {
  let seen = false; try { seen = localStorage.getItem('hiphi_testify_seen') === '1'; localStorage.setItem('hiphi_testify_seen', '1'); } catch { /* ignore */ }
  return `<details class="testify" ${seen ? '' : 'open'}><summary><b>How to testify</b> <span class="muted">— takes about five minutes</span></summary>
    <ol><li>Written testimony is due <b>24 hours before the hearing</b>. Late testimony is still posted but committees may not read it.</li>
    <li>Open the bill on the Capitol site and press <b>Submit Testimony</b>. You need a free capitol.hawaii.gov account (email and password).</li>
    <li>Choose the hearing, then upload a file or type into the box. Say who you are, the bill number, whether you <b>support</b> or <b>oppose</b>, and why in a few sentences. Personal stories carry weight.</li>
    <li>Tick “testify in person” or “remotely” if you want to speak; two minutes is typical.</li></ol></details>`;
}
function panelFor(b) {
  const hs = hearingsOf(b);
  const now = Date.now();
  const dl = alive(b) ? nextDeadline(b) : null;
  return `<div class="scrim" id="scrim"></div><div class="drawer"><div class="dhead"><button class="close" id="dclose" title="Close (Esc)">✕</button>
      <h2>${esc(b.bill_number.replace(/^(\D+)/, '$1 '))}${b.current_version ? ` <span class="chipx c-navy" title="The draft the bill is currently on">${esc(b.current_version)}</span>` : ''}</h2>
      <div class="headline">${esc(b.hiphi_summary || blurb({ description: b.description, title: b.title }, 160))}</div><div class="sub">${esc(titleCase(b.title))}</div>
      <div class="hchips">${b.hiphi_position ? `<span class="chipx c-teal">HIPHI ${POS[b.hiphi_position] || ''}</span>` : ''}${(b.coalitions || []).map(c => `<span class="chipx c-gray">${esc(cname(c))}</span>`).join('')}<span class="chipx c-gray">${b.watchers || 0} following</span>${watchBtn(b)}<button class="chipx tool" data-copylink="${b.id}" title="Copy a link to this bill (c)">🔗 Copy link</button></div></div>
    <div class="dbody">
      ${!S.watch.size ? `<div class="arrive"><b>You are not following any bills yet.</b> Press Follow on this one to get its hearing alerts${(b.coalitions || [])[0] ? `, or see everything HIPHI is doing on <button class="linkbtn" data-browse="${esc(b.coalitions[0])}">${esc(cname(b.coalitions[0]))}</button>` : ''}.</div>` : ''}
      <div class="status"><p class="plain lead">${esc(alive(b) ? stopOf(b).says.replace(/stop (\d+) of (\d+)/, 'committee $1 of $2').replace(/ · (Triple filing|Lateral|Decking|Crossover|Cross back|Final decking) (\d+\/\d+)( \(\d+d\))?\./, (m, l, d, left) => ` · needs a hearing by ${d}${left || ''}.`) : whyDead(b))}</p>${railPublic(b)}</div>
      ${b.hiphi_action ? `<div class="next"><span class="nk">ASK</span><div>${esc(b.hiphi_action)}</div></div>` : ''}
      ${whoDecidesHTML(b)}
      ${b.sandbox_untracked ? '<p class="desc"><i>Sandbox: this bill is not on HIPHI’s list, so its history and hearings are not loaded here. In the live app every bill is complete.</i></p>' : ''}
      <div class="sec">Summary</div><p class="desc">${esc(b.hiphi_summary || b.description || 'No summary available yet.')}</p>
      <div class="sec">Details</div>
      <div class="kv"><span class="k">Stage</span><span><span class="chipx c-gray explain" data-explain="${esc(STAGE_PLAIN[b.stage] || '')}">${STAGE_LABEL[b.stage] || 'Introduced'}</span></span></div>
      <div class="kv"><span class="k">Last action</span><span>${esc(b.last_action || '—')} <span class="when">${fmtDate(b.last_action_date, { year: '2-digit' })}</span></span></div>
      <div class="kv"><span class="k">Committees</span><span>${referralPath(b)}</span></div>
      ${b.sponsors?.length ? `<div class="kv"><span class="k">Sponsors</span><span>${esc(b.sponsors.slice(0, 8).map(x => typeof x === 'string' ? x : x.n || x.name || '').filter(Boolean).join(', '))}</span></div>` : ''}
      ${b.companions?.length ? `<div class="kv"><span class="k">Companion</span><span>${esc(b.companions.join(', '))}</span></div>` : ''}
      ${b.current_version ? `<div class="kv"><span class="k">Version</span><span>${esc(b.current_version)} — the bill has been amended ${b.current_version.replace(/\D/g, '')} time${b.current_version.replace(/\D/g, '') === '1' ? '' : 's'} in the ${/^H/.test(b.current_version) ? 'House' : /^S/.test(b.current_version) ? 'Senate' : 'conference committee'}</span></div>` : ''}
      <div class="sec">Hearings</div>
      ${!alive(b) ? `<p class="desc"><i>This bill did not advance. Hearings listed below are historical.</i></p>` : ''}
      ${hs.length ? hs.map(h => { const past = new Date(h.scheduled_at) < now; return `<div class="prow"><div class="pmain"><b>${esc(h.committee)}</b> · ${fmtDT(h.scheduled_at)} · ${esc(clean(h.room))}${h.status !== 'scheduled' ? ` · ${esc(h.status)}` : ''} ${past ? outcomeChip(h) : ''}${chairOf(h.committee)}
        <div class="psmall">${h.testimony_deadline && !past ? 'written testimony due ' + fmtDT(h.testimony_deadline) : ''}${S.outcomes[h.id]?.report ? esc(S.outcomes[h.id].report.slice(0, 140)) : ''}${h.notice_url ? ` · <a href="${esc(h.notice_url)}" target="_blank" rel="noopener">notice ↗</a>` : ''}${(v => v && v.state === 'after' ? ` · <a href="${esc(v.url)}" target="_blank" rel="noopener" title="${esc(v.hint)}">▶ watch the recording</a>` : '')(streamOf(h))}</div>
        ${!past && h.status === 'scheduled' ? `<div class="calbtns">${alive(b) && b.hiphi_position && b.hiphi_position !== 'monitor' ? `<button class="btn sm" data-helper="${h.id}">Submit testimony</button>` : b.state_url && alive(b) ? `<a class="btn sm ghost" href="${esc(b.state_url)}" target="_blank" rel="noopener">Submit testimony ↗</a>` : ''}${calLinks(b, h)}${(v => v ? `<a class="btn sm ghost${v.state === 'live' ? ' livebtn' : ''}" href="${esc(v.url)}" target="_blank" rel="noopener" title="${esc(v.hint)}">▶ ${v.label}</a>` : '')(streamOf(h))}</div>${(v => v && !v.exact ? `<div class="psmall streamhint">${esc(v.hint)}</div>` : '')(streamOf(h))}` : ''}</div></div>`; }).join('') : '<p class="desc"><i>No hearings on record.</i></p>'}
      ${alive(b) ? testifyBox() : ''}
      <p style="margin-top:12px">${b.state_url ? `<a class="btn sm ghost" href="${esc(b.state_url)}" target="_blank" rel="noopener">Capitol bill page ↗</a>` : ''}</p>
    </div></div>`;
}
function signin() {
  return `<div class="pubhead"><h1>Sign in</h1></div>
    <div class="signin">
      <p>Enter your email and we send a sign-in link. No password. Your bills follow you to any device, and you can turn on email alerts for hearings on your bills.</p>
      <input type="email" id="si-email" placeholder="you@example.com" autocomplete="email">
      <div class="consent">
        <label class="row"><input type="checkbox" id="si-alerts"><span><b>Email me when a hearing is scheduled on a bill I follow.</b><br><small>The Capitol posts hearings about two days ahead; this is how you hear in time to testify. Off unless you tick it.</small></span></label>
        <label class="row"><input type="checkbox" id="si-share"><span><b>Let HIPHI see which bills I follow.</b><br><small>So HIPHI staff can reach out to you about those bills. Otherwise staff only ever see how many people follow each bill, never who.</small></span></label>
      </div>
      <button class="btn" id="si-send">Send me a sign-in link</button>
      <p class="tok" style="margin-top:12px"><b>Privacy.</b> We keep your email, the bills and lists you follow, and the two choices above. Both can be changed any time in Settings. You can delete your account and everything with it at any time.</p>
    </div>`;
}
function settings() {
  const p = S.user?.prefs || {};
  return `<div class="pubhead"><h1>Settings</h1><span class="sub">${esc(S.session.user.email)}</span></div>
    <div class="settings pub"><section>
      <h3>Email</h3>
      <label class="row"><span style="min-width:120px">Digest</span><select id="st-digest" style="width:auto">
        <option value="weekly" ${(p.digest || 'weekly') === 'weekly' ? 'selected' : ''}>Weekly, Monday morning</option>
        <option value="daily" ${p.digest === 'daily' ? 'selected' : ''}>Every morning</option>
        <option value="off" ${p.digest === 'off' ? 'selected' : ''}>Off</option></select></label>
      <label class="row"><input type="checkbox" id="st-alerts" ${p.hearing_alerts === true ? 'checked' : ''}><span>Email me when a hearing is scheduled on a bill I follow</span></label>
      <h3>Sharing with HIPHI</h3>
      <label class="row"><input type="checkbox" id="st-share" ${p.share_follows === true ? 'checked' : ''}><span>Let HIPHI staff see which bills I follow, so they can reach out about them</span></label>
      <label class="row"><span style="min-width:120px">Your name</span><input id="st-name" value="${esc(p.name || '')}" maxlength="80" placeholder="optional · shown to HIPHI staff only if you share"></label>
      <p class="tok">${p.consent_at ? `Choices saved ${fmtDate(p.consent_at)}.` : 'You have not saved these choices yet.'} Without sharing, HIPHI only ever sees how many people follow each bill.</p>
      <div class="btns"><button class="btn" id="st-save">Save</button></div>
      <h3>Your data</h3>
      <p class="tok">We keep your email and your watchlist. Deleting your account removes both immediately and cannot be undone.</p>
      <div class="btns"><button class="btn ghost danger" id="st-delete">Delete my account</button></div>
    </section></div>`;
}
function help() {
  const row = (k, v) => `<div class="krow"><kbd>${esc(k)}</kbd><span>${esc(v)}</span></div>`;
  const dls = S.deadlines.filter(d => new Date(d.deadline_date + 'T23:59:59-10:00') > Date.now());
  return `<div class="pubhead"><h1>Help</h1></div><div class="settings help pub">
    <section><h2>What this page does</h2>
      <p>Search any bill in the Hawaiʻi Legislature and press <b>Follow</b>. Your page then shows the week’s hearings on those bills (with an add-to-calendar button), where each bill stands against the session’s deadlines, what happened in the last 72 hours, and what each committee decided. Sign in with your email to keep the list on every device and get an email when a hearing is scheduled.</p>
      <p>Share a bill with a link like <code>${esc(location.origin + location.pathname)}#bill=HB1563</code>. It opens straight to that bill.</p></section>
    <section><h2>Stages, in plain language</h2>${Object.entries(STAGE_PLAIN).map(([k, v]) => `<div class="krow"><b>${esc(STAGE_LABEL[k])}</b><span>${esc(v)}</span></div>`).join('')}</section>
    <section><h2>Deadlines this session</h2>
      <p>Bills must clear each stage by the session calendar’s dates or they die. The board shows the deadline each bill has to meet and the last regular committee meeting before it. Committees must post a hearing notice 48 hours ahead, so a bill without a notice two days before that last meeting is very likely done.</p>
      ${dls.length ? dls.map(d => `<div class="krow"><b>${esc(d.label)}</b><span>${fmtDate(d.deadline_date + 'T12:00:00-10:00', { weekday: 'short', month: 'short' })}</span></div>`).join('') : '<p class="muted">The session has ended; dates for the next session appear when the Legislature publishes them.</p>'}</section>
    <section><h2>How to testify</h2>${testifyBox().replace('<details class="testify"', '<details class="testify" open')}</section>
    <section><h2>Getting around</h2><p>The home page has four parts: things to do now, this week’s hearings on your bills, where every bill stands against the session deadlines, and your bills.</p></section>
    <section><h2>Keyboard shortcuts</h2>${SHORTCUTS.map(([k, v]) => row(k, v)).join('')}<p class="muted" style="font-size:12px">Shortcuts are off while you are typing in a field.</p></section>
    <section><h2>Privacy</h2><p>Without an account, your watchlist lives only in this browser. With one, we keep your email address and the list of bills you watch, nothing else. HIPHI staff see how many people watch each bill, never who. Delete your account from Settings at any time; it removes everything immediately.</p></section>
    <section><h2>About</h2><p>Built by the Hawaiʻi Public Health Institute. Bill data comes from the Legislature’s public records and refreshes several times a day. Positions marked HIPHI are ours; everything else is the public record. Questions: <a href="mailto:info@hiphi.org">info@hiphi.org</a>.</p></section>
  </div>`;
}
function render() {
  const inner = S.view === 'signin' ? signin() : S.view === 'settings' && S.session ? settings() : S.view === 'help' ? help() : S.view === 'find' ? find() : S.view === 'list' ? listPage() : S.view === 'legislators' ? legislatorsPage() : S.view === 'legislator' && legById(S.legOpen) ? legislatorPage(legById(S.legOpen)) : consentCardHTML() + home();
  const b = S.open && findBill(S.open);
  $('#app').innerHTML = chrome(inner) + (b ? panelFor(b) : '') + (S.helper ? helperHTML() : '');
  wire(); wireHelper();
}
function wire() {
  document.querySelectorAll('[data-nav]').forEach(el => el.onclick = () => { S.view = el.dataset.nav; S.open = null; render(); window.scrollTo(0, 0); });
  $('#signout') && ($('#signout').onclick = async () => { await S.supa.auth.signOut(); S.view = 'home'; });
  if (DEMO && S.view === 'signin') { S.view = 'home'; toast('Sign-in is off in the sandbox'); render(); return; }
  const q = $('#q');
  if (q) { let t; q.oninput = () => { S.q = q.value; clearTimeout(t); t = setTimeout(async () => {
      if (S.q.trim().length < 2) { S.results = null; render(); return; }
      try { S.browse = null; S.results = await search(S.q.trim()); S.view = 'find'; render(); const el = $('#q'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }
      catch (e) { toast(e.message, true); } }, 300); }; }
  document.querySelectorAll('[data-watch]').forEach(el => el.onclick = e => { e.stopPropagation(); toggleWatch(el.dataset.watch); });
  document.querySelectorAll('[data-open]').forEach(el => el.onclick = () => openBill(el.dataset.open));
  document.querySelectorAll('[data-browse], [data-tile]').forEach(el => el.onclick = async () => { const name = el.dataset.browse ?? el.dataset.tile; if (!name) { S.browse = null; render(); return; } onbSet({ issues: true }); try { S.open = null; await browseCoalition(name); S.view = 'find'; render(); window.scrollTo(0, 0); } catch (e) { toast(e.message, true); } });
  document.querySelectorAll('[data-watchall]').forEach(el => el.onclick = async () => { const rows = (S.browse?.rows || []).filter(b => alive(b) && !S.watch.has(b.id)); el.disabled = true;
    for (const b of rows) { S.watch.add(b.id); } saveLocal();
    if (S.user && !DEMO && rows.length) { const r = await S.supa.from('watchlist').insert(rows.map(b => ({ user_id: S.user.id, bill_id: b.id }))); if (r.error) toast(r.error.message, true); }
    await loadBills(); S.browse = null; if (!S.session && (onb().nudges || 0) < 2) { S.nudge = true; onbSet({ nudges: (onb().nudges || 0) + 1 }); } render(); toast(`Following ${rows.length} more bill${rows.length === 1 ? '' : 's'}`); window.scrollTo(0, 0); });
  document.querySelectorAll('[data-dismiss]').forEach(el => el.onclick = () => { dismiss(el.dataset.dismiss); render(); toast('Okay, not that one'); });
  $('[data-showhidden]') && ($('[data-showhidden]').onclick = () => { S.showHidden = !S.showHidden; const y = window.scrollY; render(); window.scrollTo(0, y); });
  document.querySelectorAll('[data-unhide]').forEach(el => el.onclick = () => { const d = dismissed(); d.delete(el.dataset.unhide); try { localStorage.setItem('hiphi_dismiss', JSON.stringify([...d])); } catch { /* ignore */ } const y = window.scrollY; render(); window.scrollTo(0, y); });
  $('[data-recomore]') && ($('[data-recomore]').onclick = () => { S.recoN = (S.recoN || 3) + 3; const y = window.scrollY; render(); window.scrollTo(0, y); });
  document.querySelectorAll('[data-helper]').forEach(el => el.onclick = () => { const h = [...S.hearings, ...((S.featured || {}).hearings || []), ...((S.pool || {}).hearings || []), ...Object.values(S.xh).flat()].find(x => x.id === el.dataset.helper); const b = h && findBill(h.bill_id); if (b) { S.helper = { b, h }; render(); } });
  document.querySelectorAll('[data-did]').forEach(el => el.addEventListener('click', () => { const [bid, hid, kind] = el.dataset.did.split('|'); setTimeout(() => markDone(bid, hid, kind).then(() => render()), 400); }));
  document.querySelectorAll('[data-undo]').forEach(el => el.onclick = async () => { const [bid, hid, kind] = el.dataset.undo.split('|'); await markDone(bid, hid, kind, false); render(); });
  document.querySelectorAll('[data-share]').forEach(el => el.onclick = async () => { const num = el.dataset.share, url = `${location.origin}${location.pathname}#bill=${num}`; const b = S.bills.find(x => x.bill_number === num) || ((S.featured || {}).bills || []).find(x => x.bill_number === num) || ((S.pool || {}).bills || []).find(x => x.bill_number === num);
    const text = b ? `${num}: ${titleCase(b.title)} — HIPHI ${POS[b.hiphi_position] || 'is following it'}. Hearing coming up; testimony takes five minutes: ${url}` : url;
    try { if (navigator.share) await navigator.share({ title: num, text, url }); else { await navigator.clipboard.writeText(text); toast('Copied a ready-to-post line'); } } catch { /* cancelled */ } });
  // guided start
  document.querySelectorAll('[data-wizissue]').forEach(el => el.onchange = () => { const w = wiz(); const set = new Set(w.issues || []); if (el.checked) set.add(el.dataset.wizissue); else set.delete(el.dataset.wizissue); wizSet({ issues: [...set] }); onbSet({ issues: set.size > 0 }); S.wizRows = null; render(); });
  $('[data-wiznext]') && ($('[data-wiznext]').onclick = () => { wizSet({ step: 2 }); S.wizRows = null; S.wizPick = []; render(); window.scrollTo(0, 0); });
  $('[data-wizback]') && ($('[data-wizback]').onclick = () => { wizSet({ step: 1 }); render(); window.scrollTo(0, 0); });
  document.querySelectorAll('[data-wizsearch]').forEach(el => el.onclick = () => { wizSet({ skipped: true, step: 1 }); S.view = 'home'; render(); window.scrollTo(0, 0); $('#q')?.focus(); });
  $('[data-wizrestart]') && ($('[data-wizrestart]').onclick = () => { wizSet({ skipped: false, step: 1, done: false }); S.browse = null; S.results = null; S.q = ''; S.view = 'wizard'; render(); window.scrollTo(0, 0); });
  document.querySelectorAll('[data-wizpick]').forEach(el => el.onchange = () => { const set = new Set(S.wizPick || []); if (el.checked) set.add(el.dataset.wizpick); else set.delete(el.dataset.wizpick); S.wizPick = [...set]; const y = window.scrollY; render(); window.scrollTo(0, y); });
  document.querySelectorAll('[data-wizall]').forEach(el => el.onclick = () => { const name = el.dataset.wizall, names = groupNames(name); const { picks } = curate((S.wizRows || []).filter(b => (b.coalitions || []).some(n => names.includes(n))), S.wizMore?.[name] ? 40 : 6); const set = new Set(S.wizPick || []); const all = picks.every(b => set.has(b.id)); picks.forEach(b => all ? set.delete(b.id) : set.add(b.id)); S.wizPick = [...set]; const y = window.scrollY; render(); window.scrollTo(0, y); });
  document.querySelectorAll('[data-wizmore]').forEach(el => el.onclick = () => { S.wizMore = { ...(S.wizMore || {}), [el.dataset.wizmore]: true }; const y = window.scrollY; render(); window.scrollTo(0, y); });
  $('[data-wizdone]') && ($('[data-wizdone]').onclick = async () => { const ids = S.wizPick || []; if (!ids.length) return; $('[data-wizdone]').disabled = true;
    ids.forEach(id => S.watch.add(id)); saveLocal();
    if (S.user && !DEMO) { const r = await S.supa.from('watchlist').insert(ids.map(bill_id => ({ user_id: S.user.id, bill_id }))); if (r.error) toast(r.error.message, true); }
    wizSet({ step: 1, done: true, skipped: true }); onbSet({ issues: true }); S.view = 'home'; await loadBills(); if (!S.session && (onb().nudges || 0) < 2) { S.nudge = true; onbSet({ nudges: (onb().nudges || 0) + 1 }); }
    render(); window.scrollTo(0, 0); toast(`You’re following ${ids.length} bill${ids.length === 1 ? '' : 's'}`); });
  document.querySelectorAll('[data-watchpicks]').forEach(el => el.onclick = async () => { const { picks } = curate(S.browse?.rows || [], 8); const rows = picks.filter(b => !S.watch.has(b.id)); el.disabled = true; rows.forEach(b => S.watch.add(b.id)); saveLocal();
    if (S.user && !DEMO && rows.length) { const r = await S.supa.from('watchlist').insert(rows.map(b => ({ user_id: S.user.id, bill_id: b.id }))); if (r.error) toast(r.error.message, true); }
    await loadBills(); S.browse = null; if (!S.session && (onb().nudges || 0) < 2) { S.nudge = true; onbSet({ nudges: (onb().nudges || 0) + 1 }); } render(); toast(`Following ${rows.length} more bill${rows.length === 1 ? '' : 's'}`); window.scrollTo(0, 0); });
  document.querySelectorAll('[data-onbdismiss]').forEach(el => el.onclick = () => { onbSet({ dismissed: true }); render(); });
  document.querySelectorAll('[data-nudgex]').forEach(el => el.onclick = () => { S.nudge = false; render(); });
  $('#nudge-form') && ($('#nudge-form').onsubmit = async e => { e.preventDefault(); const email = $('#nudge-email').value.trim(); if (!email) return;
    const { error } = await S.supa.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
    if (error) toast(error.message, true); else { toast('Check your email for the link'); S.nudge = false; render(); } });
  document.querySelectorAll('[data-explain]').forEach(el => el.onclick = e => { e.stopPropagation(); const old = document.querySelector('.expl'); const was = old && old.previousElementSibling === el; old?.remove(); if (was) return; const p = document.createElement('span'); p.className = 'expl'; p.textContent = el.dataset.explain; el.after(p); });


  document.querySelectorAll('[data-jump]').forEach(el => el.onclick = () => document.getElementById(el.dataset.jump)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  document.querySelectorAll('[data-copylink]').forEach(el => el.onclick = async e => { e.stopPropagation(); const b = findBill(el.dataset.copylink); if (!b) return;
    const url = `${location.origin}${location.pathname}#bill=${b.bill_number}`;
    try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch { prompt('Copy this link', url); } });
  document.querySelectorAll('[data-week]').forEach(el => el.onclick = e => { e.stopPropagation(); const v = Number(el.dataset.week); S.weekOffset = v === 0 ? 0 : S.weekOffset + v; const y = window.scrollY; render(); window.scrollTo(0, y); });
  $('#scrim') && ($('#scrim').onclick = closeBill); $('#dclose') && ($('#dclose').onclick = closeBill);
  $('#si-send') && ($('#si-send').onclick = async () => {
    const email = $('#si-email').value.trim(); if (!email) return;
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify({ hearing_alerts: $('#si-alerts').checked, share_follows: $('#si-share').checked })); } catch {}
    const { error } = await S.supa.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
    if (error) toast(error.message, true); else { toast('Check your email for the link'); $('#si-send').disabled = true; }
  });
  $('#st-save') && ($('#st-save').onclick = async () => {
    const prefs = { ...(S.user.prefs || {}), digest: $('#st-digest').value, hearing_alerts: $('#st-alerts').checked, share_follows: $('#st-share').checked, name: $('#st-name').value.trim() || null, consent_at: new Date().toISOString() };
    const { error } = await S.supa.from('public_users').update({ prefs }).eq('id', S.user.id);
    if (error) toast(error.message, true); else { S.user.prefs = prefs; S.consentCard = false; toast('Saved'); }
  });
  $('#cc-save') && ($('#cc-save').onclick = async () => {
    const prefs = { ...(S.user.prefs || {}), hearing_alerts: $('#cc-alerts').checked, share_follows: $('#cc-share').checked, consent_at: new Date().toISOString() };
    const { error } = await S.supa.from('public_users').update({ prefs }).eq('id', S.user.id);
    if (error) toast(error.message, true); else { S.user.prefs = prefs; S.consentCard = false; render(); toast('Saved — change it any time in Settings'); }
  });
  $('#cc-later') && ($('#cc-later').onclick = () => { S.consentCard = false; render(); });
  const legRender = () => { const y = scrollY; render(); scrollTo(0, y); };
  const refocus = () => { const n = $('#leg-q'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } };
  $('#leg-q') && ($('#leg-q').oninput = () => { S.legQ = $('#leg-q').value; S.legPick = null; clearTimeout(S.legT); S.legT = setTimeout(async () => { legRender(); refocus();
    const q = S.legQ.trim(); if (looksLikeAddress(q) && !(S.addrSug && S.addrSug.q === q)) { S.addrLoading = true; try { const results = await fetchAddrSuggest(q); if (S.legQ.trim() === q) { S.addrSug = { q, results }; } } catch {} S.addrLoading = false; if (S.legQ.trim() === q) { legRender(); refocus(); } } }, 120); });
  document.querySelectorAll('[data-legsug]').forEach(el => el.onclick = async () => { const x = legSuggest(S.legQ)[Number(el.dataset.legsug)]; if (!x) return;
    if (x.kind === 'address' || x.kind === 'addr') { toast('Finding the districts…'); try { const r = await legLookupAddress(x.q || x.label, x.kind === 'addr' ? x : null); if (r) { S.legPick = { label: 'Your legislators', ...r, matched: x.kind === 'addr' ? x.label : r.matched }; S.legQ = x.label || x.q; } } catch { toast('Could not look that up. Try a town or district.', true); } }
    else if (x.kind === 'district') S.legPick = { label: x.label, ids: S.legislators.filter(l => l.chamber === x.chamber && l.district === x.district).map(l => l.id) };
    else { S.legPick = { label: x.kind === 'place' ? `Legislators for ${x.label}` : x.label, ids: x.ids }; S.legTown = x.kind === 'place' ? x.label : null; }
    legRender(); });
  document.querySelectorAll('[data-legopen]').forEach(el => el.onclick = e => { e.stopPropagation(); S.legOpen = Number(el.dataset.legopen); S.legFromBill = el.dataset.frombill || null; S.view = 'legislator'; S.open = null; history.replaceState(null, '', '#legislator=' + S.legOpen); render(); window.scrollTo(0, 0); });
  document.querySelectorAll('[data-mailopen]').forEach(el => el.onclick = e => { e.stopPropagation(); S.mailOpen = el.dataset.mailopen; legRender(); });
  document.querySelectorAll('[data-mailclose]').forEach(el => el.onclick = e => { e.stopPropagation(); S.mailOpen = null; legRender(); });
  document.querySelectorAll('[data-copy]').forEach(el => el.onclick = async e => { e.stopPropagation(); try { await navigator.clipboard.writeText(el.dataset.copy); toast('Copied'); } catch { prompt('Copy this', el.dataset.copy); } });
  document.querySelectorAll('[data-followlist]').forEach(el => el.onclick = e => { e.stopPropagation(); followList(el.dataset.followlist, el.dataset.on === '1'); });
  document.querySelectorAll('[data-list]').forEach(el => el.onclick = e => { e.stopPropagation(); openList(el.dataset.list); });
  $('#st-delete') && ($('#st-delete').onclick = async () => {
    if (!confirm('Delete your account and your watchlist? This cannot be undone.')) return;
    const { error } = await S.supa.rpc('delete_my_account');
    if (error) { toast(error.message, true); return; }
    try { localStorage.removeItem(LOCAL_KEY); } catch { /* ignore */ }
    await S.supa.auth.signOut(); S.watch = new Set(); S.view = 'home'; toast('Account deleted'); render();
  });
}
// ---------------- keyboard ----------------
let pendingG = 0;
document.addEventListener('keydown', e => {
  const tag = (e.target.tagName || '').toLowerCase();
  const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
  if (e.key === 'Escape') {
    if (typing) { e.target.blur(); if (S.q) { S.q = ''; S.results = null; if (S.view === 'find' && !S.browse) S.view = S.watch.size ? 'home' : 'home'; render(); } return; }
    if (S.open) { closeBill(); return; }
    if (S.results || S.browse) { S.q = ''; S.results = null; S.browse = null; render(); }
    return;
  }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key;
  if (k === '/') { e.preventDefault(); const q = $('#q'); if (q) { q.focus(); q.select(); } else { S.view = 'home'; render(); $('#q')?.focus(); } return; }
  if (k === '?') { e.preventDefault(); S.view = S.view === 'help' ? 'home' : 'help'; S.open = null; render(); return; }
  if (k === 'g') { pendingG = Date.now(); return; }
  if (pendingG && Date.now() - pendingG < 1200) { pendingG = 0; if (k === 'h') { S.view = 'home'; S.open = null; render(); } return; }
  if (k === 'n' || k === 'p') { const btn = document.querySelector(`[data-week="${k === 'n' ? 1 : -1}"]`); if (btn) btn.click(); return; }
  if (k === 'w') { const id = S.open || document.querySelector('.kfocus[data-open]')?.dataset.open; if (id) toggleWatch(id); return; }
  if (k === 'c' && S.open) { document.querySelector('[data-copylink]')?.click(); return; }
  if (k === 'j' || k === 'k') {
    const rows = [...document.querySelectorAll('.pubwrap [data-open]')]; if (!rows.length) return;
    e.preventDefault();
    const cur = rows.findIndex(r => r.classList.contains('kfocus'));
    const next = cur < 0 ? 0 : Math.min(rows.length - 1, Math.max(0, cur + (k === 'j' ? 1 : -1)));
    rows.forEach(r => r.classList.remove('kfocus')); rows[next].classList.add('kfocus');
    rows[next].scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return;
  }
  if (k === 'Enter' || k === 'o') { const r = document.querySelector('.kfocus[data-open]'); if (r) { e.preventDefault(); openBill(r.dataset.open); } }
});
async function boot() {
  try { await loadUser(); await loadLists(); await loadBills(); render(); await openFromHash(); }
  catch (e) { $('#app').innerHTML = `<div class="boot">Something went wrong: ${esc(e.message)}<br><br><button class="btn" onclick="location.reload()">Retry</button></div>`; }
}
window.addEventListener('hashchange', openFromHash);
init().then(boot);
