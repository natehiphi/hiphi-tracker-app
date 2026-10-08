// HIPHI public tracker: state, data and the plain-language layer (no screens here).
// Screens live in pub/*.js and import from this module; pub/app.js owns routing and the page frame.
// Moved out of track.js on 9/19 for the mobile-first redesign; the data code is unchanged unless a comment says so.
import { billStop, COLUMNS, BOARD_EXPLAINER, CHAMBER_NAME, hearingStream, pathwayStops, isResolution, isOneChamber, HELD_RE, stoppedAt } from '../stops.js';
import { topicOf } from './topics.js';
import { rankAll, shortList, markShown, actedKind } from './rank.js';
import { abEvent, abStep } from './variant.js';
import { logSuggest } from './visitlog.js';
// Filled in by app.js: the screens call app.render() / app.go() without importing app.js (no import cycle).
// The kernel (R-122): what the first screen needs lives in kernel.js and is re-exported here, so every screen keeps
// importing from this module; the modules on the first load import from kernel.js and never from here.
import { app, SUPABASE_URL, SUPABASE_KEY, DEMO, LOCAL_KEY, SEASON_OFF, DEMO_ASOF, $, esc, HST, hstDay, toast, friendly, cleanDesc, nick, blurb, groups, S, LISTS_KEY, ISSUES_KEY, CATS_KEY, SKIPS_KEY, CONSENT_KEY, SUPABASE_JS, init, D, DONE_KEY, localDone, saveDone, doneKey, DONE_AT_KEY, localDoneAt, saveDoneAt, KINDS, STANCE_KEY, localStances, saveStances, localWatch, saveLocal, followYear, issueFollowed, issuesOf, viaIssue, issueBills, issuesIn, followedIssues, issuesLink, calendarUrl, restoreFollows, followsAnything, issuePos, recomputeWatch, loadCatalog, applyCachedCatalog, setFollows, loadUser, localListFollows, supa, onb, onbSet, bill, alive, nudgeOk, nudge, thirdWed, hiT, sessionInfo, myActions, wiz, wizSet, EMOJI_TO_ICON, issueIcon, issues, posInfo, firstVisit, readyForSession, yearPrefix, billRef, billPath, spaced, syncText } from './kernel.js';
export * from './kernel.js';
export { billStop, COLUMNS, BOARD_EXPLAINER, CHAMBER_NAME, hearingStream, pathwayStops, isResolution, isOneChamber, HELD_RE };
export const asDate = d => new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(d)) ? d + 'T12:00:00-10:00' : d);   // a date-only value is a Hawaiʻi day
export const fmtDate = (d, o) => d ? asDate(d).toLocaleString('en-US', { timeZone: HST, month: 'numeric', day: 'numeric', ...o }) : '';
export const fmtDT = d => fmtDate(d, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
export const companionsOf = b => (b?.companions || []).flatMap(c => String(c).split(/[,\s]+/))
  .map(c => c.trim().toUpperCase()).filter(c => /^[A-Z]+\d+$/.test(c) && c !== b.bill_number);
// What the bill does, in a sentence or two: HIPHI's plain summary, else the cleaned official description. Cut at the
// end of a sentence when one fits, never mid-word.
export const headline = (b, n = 110) => nick(b) || blurb(b, n);
// "Bans the sale of…" reads as a fragment inside a letter; "It bans the sale of…" is a sentence. Only when the text
// clearly starts with a verb (a summary that starts with a noun, "Counties may…", is left alone).
export const asSentence = t => /^[A-Z][a-z]+s,? (?!(?:may|must|shall|will|can|are|is|who|that|and|or|of|with|in|on|under|for|from|at|by) )/.test(t) ? 'It ' + t[0].toLowerCase() + t.slice(1) : t;
export const clean = r => (r || 'room TBD').replace(/\s*via videoconference/i, '').replace(/^Conference Room\s+/i, 'Rm ').replace(/^CR\s+/i, 'Rm ');
// The same stages in plain language, for people who do not live at the Capitol.
export const STAGE_PLAIN = { introduced: 'Introduced and waiting to be sent to a committee',
  first_triple: 'In its first committee; a triple-referred bill that must be heard before the Triple Filing deadline',
  first_lateral: 'In a committee of its first chamber; it must be heard before the Lateral deadline',
  first_decking: 'In the last committee of its first chamber; it must pass before the Decking deadline',
  first_floor: 'Through its committees; waiting for a vote of the full chamber before the Crossover deadline',
  first_crossover: 'Passed its first chamber; now in the other chamber',
  second_triple: 'In its first committee of the second chamber; it must be heard before the Triple Filing deadline',
  second_lateral: 'In a committee of the second chamber; it must be heard before the Lateral deadline',
  second_decking: 'In the last committee of the second chamber; it must pass before the Decking deadline',
  second_floor: 'Through the second chamber’s committees; waiting for a vote of the full chamber',
  second_crossover: 'Passed both chambers in different versions; the first chamber decides whether to agree',
  conference: 'House and Senate negotiators are reconciling their versions',
  governor: 'On the Governor’s desk, waiting for signature or veto',
  enacted: 'Signed into law', vetoed: 'Vetoed by the Governor', ballot: 'Passed the Legislature; the voters decide in November',
  dead: 'Did not advance this session' };
export const SMALL = new Set(['a','an','and','as','at','but','by','for','in','of','on','or','the','to','via','with','nor','per','from']);
export const titleCase = t => String(t || '').toLowerCase().split(/\s+/).map((w, i, a) => (i && i < a.length - 1 && SMALL.has(w.replace(/[^a-z]/g, ''))) ? w : w.replace(/(^|[-("'/])([a-z])/g, (m, p, c) => p + c.toUpperCase())).join(' ');
export const POS = { strongly_support: 'Strongly supports', support: 'Supports', support_amend: 'Supports with amendments', strongly_oppose: 'Strongly opposes', oppose: 'Opposes', neutral: 'Comments', monitor: 'Monitoring' };
export const billNum = b => b.bill_number + (b.current_version ? ' ' + b.current_version : '');
// Coalitions keep their internal name as the key; the public sees public_name.
export const cname = n => (S.coalitions || []).find(c => c.name === n)?.public_name || n;
// Tiles are grouped by public name: two internal coalitions can share one tile.
export const groupNames = k => (groups().find(g => g.key === k || g.names.includes(k)) || { names: [k] }).names;
export const dmatch = (b, q) => { const ql = q.toLowerCase(), qn = ql.replace(/\s/g, ''); return b.bill_number.toLowerCase().includes(qn) || (b.title || '').toLowerCase().includes(ql) || (b.description || '').toLowerCase().includes(ql); };
// "I did it" marks: in this browser until sign-in, then in public_actions.
export async function loadActions(ids) {
  S.done = localDone(); S.doneAt = localDoneAt();
  if (DEMO) { if (new URLSearchParams(location.search).has('seed')) (await import('./demo.js')).seedDemoActions();
    if (new URLSearchParams(location.search).has('letter')) (await import('./demo.js')).seedDemoLetter();   // R-148
    if (new URLSearchParams(location.search).has('email')) (await import('./demo.js')).seedDemoMail(new URLSearchParams(location.search).has('remind'));   // R-153
    for (const id of ids) if (!S.actionCounts[id]) { const n = [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 3) % 60; S.actionCounts[id] = { testimonies: n, emails: n >> 2, attending: n >> 3 }; }
    // sandbox numbers for one hearing and one bill, so those lines have something to show
    S.voices = Object.fromEntries(D.hearings.map(h => [h.id, [...h.id].reduce((a, ch) => (a * 33 + ch.charCodeAt(0)) >>> 0, 7) % 50]).filter(([, n]) => n >= 10));
    S.billStances = Object.fromEntries(ids.map(id => { const n = [...id].reduce((a, ch) => (a * 29 + ch.charCodeAt(0)) >>> 0, 5) % 90; return [id, { bill_id: id, people: n, support: Math.round(n * 0.86), oppose: n - Math.round(n * 0.86) }]; }).filter(([, r]) => r.people >= 10));
    S.totals = {}; return; }
  if (S.session && S.user) {
    const { data } = await S.supa.from('public_actions').select('bill_id,hearing_id,kind,created_at');
    const server = new Set();
    (data || []).forEach(a => { const k = doneKey(a.bill_id, a.hearing_id, a.kind); server.add(k); S.doneAt[k] = a.created_at; });
    // Marks made on this device before signing in join the account, so they count in the totals and follow the person.
    const up = [...S.done].filter(k => !server.has(k)).map(k => { const [bill_id, hearing_id, kind] = k.split('|');
      return { user_id: S.session.user.id, bill_id, hearing_id: hearing_id || null, kind, ...(S.doneAt[k] ? { created_at: S.doneAt[k] } : {}) }; }).filter(r => KINDS.includes(r.kind));
    if (up.length) { const r = await S.supa.from('public_actions').upsert(up, { onConflict: 'user_id,bill_id,hearing_id,kind', ignoreDuplicates: true });
      if (r.error) for (const row of up) await S.supa.from('public_actions').upsert(row, { onConflict: 'user_id,bill_id,hearing_id,kind', ignoreDuplicates: true }); }
    server.forEach(k => S.done.add(k)); saveDone(); saveDoneAt();
  }
  const hids = [...new Set([...S.hearings, ...((S.featured || {}).hearings || [])].map(h => h.id))];
  const [c, v, st] = await Promise.all([
    inChunks(ids, ch => S.supa.from('public_action_counts').select('*').in('bill_id', ch)),
    inChunks(hids.slice(0, 300), ch => S.supa.from('public_hearing_voices').select('hearing_id,people').in('hearing_id', ch)),
    inChunks(ids, ch => S.supa.from('public_bill_stances').select('*').in('bill_id', ch))]);
  c.forEach(r => { S.actionCounts[r.bill_id] = r; });
  S.voices = Object.fromEntries(v.map(r => [r.hearing_id, r.people]));
  S.billStances = { ...(S.billStances || {}), ...Object.fromEntries(st.map(r => [r.bill_id, r])) };
  S.totals = {};   // community-wide totals are no longer shown (9/19); numbers live inside one bill or one hearing
}
export async function markDone(billId, hearingId, kind, on = true, { quiet = false, sp = '' } = {}) {   // sp: a share's way out (R-205 K2)
  const k = doneKey(billId, hearingId, kind);
  const firstTestimony = on && kind === 'testimony' && ![...S.done].some(x => x.endsWith('|testimony'));   // across devices once signed in
  if (on) { S.done.add(k); S.doneAt[k] = new Date().toISOString(); S.justDone = billId + '|' + (hearingId || ''); setTimeout(() => { S.justDone = null; }, 1200); }
  else { S.done.delete(k); delete S.doneAt[k]; }
  saveDone(); saveDoneAt();
  if (on && !quiet) { celebrate(kind, firstTestimony); }
  if (on) app.onAct?.(kind, sp ? { sp } : undefined);   // counted privately, its kind only (visitlog.js logAct, migration 078)
  if (on && hearingId) abStep(hearingId, kind);   // another step where the rank test was met (R-135)
  if (on) suggestEvent(billId, 'acted');   // acted on a bill it had suggested (R-094)
  if (on && !S.session) nudge('action');
  const c = S.actionCounts[billId] ??= { testimonies: 0, emails: 0, attending: 0 };
  const col = { testimony: 'testimonies', email: 'emails', legislators: 'emails', attend: 'attending' }[kind]; if (col) c[col] = Math.max(0, (c[col] || 0) + (on ? 1 : -1));
  if (!DEMO && S.session && S.user) {
    const r = on ? await S.supa.from('public_actions').insert({ user_id: S.session.user.id, bill_id: billId, hearing_id: hearingId || null, kind })
                 : await S.supa.from('public_actions').delete().eq('user_id', S.session.user.id).eq('bill_id', billId).eq('kind', kind).is('hearing_id', hearingId || null);
    if (r.error && !/duplicate/.test(r.error.message)) toast(r.error, true);
  }
  return { firstTestimony };
}
// Where the person stands on a bill: 'support' | 'oppose' | 'unsure'. Kept in this browser; for a signed-in person it
// also rides on their follow (watchlist.stance, migration 056). A first visit is "follow a few bills and say where
// you stand" (Nate, 9/19); the asks to act come on later visits.
export const myStance = id => (S.stances || {})[id] || null;
export async function setStance(id, stance) {
  S.stances ??= {};
  if (stance) S.stances[id] = stance; else delete S.stances[id];
  saveStances();
  if (!DEMO && S.session && S.user && S.watch.has(id)) {
    // A stance lives on the bill's own follow row. A bill followed through an issue has none, so taking a stand on it
    // gives it one (and keeps it followed if the issue is later unfollowed: you took a stand on it). Clearing a stance
    // never adds a row.
    const r = stance
      ? await S.supa.from('watchlist').upsert({ user_id: S.user.id, bill_id: id, stance }, { onConflict: 'user_id,bill_id' })
      : await S.supa.from('watchlist').update({ stance: null }).eq('user_id', S.user.id).eq('bill_id', id);
    if (r.error) toast(r.error, true);
    else if (stance && !S.direct.has(id)) { S.direct.add(id); saveLocal(); }
  }
}
// Does the person's stance match HIPHI's? null when either side has none. HIPHI's scripted letters and emails are
// offered only when it matches or the person has not said; someone who disagrees is pointed to the Capitol's own form.
export function agrees(b) {
  const mine = myStance(b.id), p = b.hiphi_position || '';
  if (!mine || mine === 'unsure' || !/support|oppose/.test(p)) return null;
  return (mine === 'support') === /support/.test(p);
}
// ---------------- following: issues, whole categories, single bills (063, R-018) ----------------
// Nate, 9/21: people follow issues, not bills; the bills come to them because of the issue. What a person chose is kept
// as four sets - issues, whole categories ("Follow all": Nate, it also brings issues HIPHI takes up there later), bills
// followed on their own, and bills marked "Not for me" - and S.watch, the followed bills every screen reads, is worked
// out from them here, the same way the database's follow_set decides who gets a hearing alert.
export const catOf = key => S.cats.find(c => c.key === key) || null;
export function nextWords(b) {
  if (!b || !alive(b)) return '';
  const st = stopOf(b);
  if (st.phase === 'committee') {
    if (st.hearingState === 'scheduled' && st.hearing) { const d = dueInfo(st.hearing); return `Next: ${cmteLabel(st.committee)} hearing ${dayWord(st.hearing.scheduled_at)}${d && !d.late && st.hearing.testimony_deadline ? `, testimony by ${dayWord(st.hearing.testimony_deadline)}` : ''}.`; }
    if (st.hearingState === 'held' || st.hearingState === 'decided') {
      // After a committee's yes: the next committee on the bill's referral path in this chamber, else the full chamber's vote
      // (the referrals list both chambers' paths in order; a code's chamber tells where this one ends).
      const refs = Array.isArray(b.referrals) ? b.referrals : [], at = refs.indexOf(st.committee || b.committee), nx = at >= 0 ? refs[at + 1] : null;
      const same = nx && (S.committees[codesOf(nx)[0]]?.chamber || st.chamber) === st.chamber;
      const then = same ? `a hearing in the ${cmteLabel(nx)}` : `a vote of the full ${CHAMBER_NAME[st.chamber] || 'chamber'}`;
      return st.hearingState === 'decided' && /passed/.test(st.decided || '') ? `Next: ${then}.` : `Next: ${st.committee ? `the ${cmteLabel(st.committee)}'s` : 'the committee’s'} report, then ${then}.`;
    }
    return st.committee ? `Next: a hearing in the ${cmteLabel(st.committee)}.` : `Next: a ${CHAMBER_NAME[st.chamber] || ''} committee.`;
  }
  if (st.phase === 'floor') return `Next: a vote of the full ${CHAMBER_NAME[st.chamber] || 'chamber'}.`;
  if (st.phase === 'conference') return 'Next: the House and Senate agree on one version.';
  if (st.phase === 'governor') return 'Next: the Governor signs it, lets it become law, or vetoes it.';
  return '';
}
export const likedCats = () => new Set([...(wiz().issues || []), ...S.catFollows, ...followedIssues().flatMap(i => i.categories)]);
// HIPHI's position on an issue. Staff set its stance (094, R-093): support, oppose or mixed, and the bills only say how
// strongly ("HIPHI strongly supports" when one of them is strongly supported). Not set, it comes from the bills that carry
// it: what it is for, when it is for any of them (an issue can hold a bill HIPHI opposes because it would push the other
// way), else what it opposes, else comments.
export function followSummary() {
  const cats = S.cats.filter(c => S.catFollows.has(c.key));
  const rest = S.issues.filter(i => S.issueFollows.has(i.id) && !(i.categories || [i.category]).some(c => S.catFollows.has(c))).length;
  const parts = [...cats.map(c => `all of ${c.name}`), ...(rest ? [`${rest}${cats.length ? ' more' : ''} ${rest === 1 ? 'issue' : 'issues'}`] : [])];
  return parts.length <= 1 ? (parts[0] || '') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}
export function unfollowIssue(i) {
  const cats = (i.categories || [i.category]).filter(c => S.catFollows.has(c));
  const others = [...new Set(cats.flatMap(issuesIn).map(x => x.id))].filter(id => id !== i.id);
  return setFollows({ issuesOff: [i.id], catsOff: cats, issuesOn: others });
}
export function saveListFollows() { try { localStorage.setItem(LISTS_KEY, JSON.stringify([...S.listFollows])); } catch {} }
export async function loadLists() {
  if (DEMO) { S.lists = D.lists.map(l => ({ ...l, bills: D.listBills.filter(x => x.list_id === l.id).length, followers: l.followers || 0, curated_by: 'HIPHI' })); }
  else { const { data } = await S.supa.from('public_lists_v').select('*').order('featured', { ascending: false }).order('sort_order'); S.lists = data || []; }
  if (!S.user) S.listFollows = localListFollows();
}
export async function listBillsFor(slug) {
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
// { quiet: true }: no toast, for a screen that states the result itself (the guided start's list rows).
export async function followList(slug, on, { quiet = false } = {}) {
  const l = S.lists.find(x => x.slug === slug); if (!l) return;
  const rows = await listBillsFor(slug) || [];
  if (on) S.listFollows.add(l.id); else S.listFollows.delete(l.id);
  if (S.user && !DEMO) {
    const r = on ? await S.supa.rpc('follow_list', { p_list: l.id }) : await S.supa.rpc('unfollow_list', { p_list: l.id });
    if (r.error) { toast(r.error, true); if (on) S.listFollows.delete(l.id); else S.listFollows.add(l.id); return; }
  } else saveListFollows();
  const live = rows.filter(({ b }) => alive(b) || b.stage === 'governor');
  if (on) { live.forEach(({ b }) => S.direct.add(b.id)); recomputeWatch(); saveLocal(); }
  l.followers = Math.max(0, (Number(l.followers) || 0) + (on ? 1 : -1));
  await loadBills();
  if (on) nudge('follow');
  app.render();
  if (quiet) return;
  // Between sessions a list has no bills still moving: never cheer "Following 0 bills" (assessment, 9/19).
  toast(!on ? `You no longer follow ${l.title}. Its bills stay in My issues.`
    : live.length ? `Following ${live.length} bill${live.length === 1 ? '' : 's'} on ${l.title}. Any HIPHI adds later will follow too.`
    : `You follow ${l.title}. HIPHI’s bills will show up in My issues when the next session opens.`, on ? { yay: true } : {});
}
// ---------------- legislators ----------------
// Official profiles from the Capitol's pages. "Find my legislators" takes a
// street address (sent to the U.S. Census geocoder through our proxy, not
// stored), a district, a town, or a name; the box suggests as you type.
export const plain = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[ʻ‘’`]/g, '').toLowerCase();
export const legById = id => S.legislators.find(l => l.id === Number(id));
export const legTitle = l => l.chamber === 'S' ? 'Sen.' : 'Rep.';
// A joint referral ("HLT/HSH") is one hearing held by two committees together: both chairs decide, both
// committees vote, and testimony is addressed to both. Every lookup by code goes through codesOf.
export const codesOf = code => String(code || '').split('/').map(c => c.trim()).filter(Boolean);
export const cmtesOf = code => codesOf(code).map(c => S.committees[c]).filter(Boolean);
// "Health / Human Services & Homelessness" (not "and": the Senate has a Health and Human Services committee)
export const cmteName = code => codesOf(code).map(c => S.committees[c]?.name || c).join(' / ');
export const chairLast = c => (c.chair || '').replace(/^(rep\.|sen\.|representative|senator)\s+/i, '').replace(/\s*(jr\.?|sr\.?|ii|iii|iv)$/i, '').trim().split(/\s+/).pop();
export const chairEmail = c => `${c.chamber === 'S' ? 'sen' : 'rep'}${chairLast(c).toLowerCase().replace(/[^a-z]/g, '')}@capitol.hawaii.gov`;
// every chair of a stop: emails comma-joined for one mailto, "Chair Takayama and Chair Marten" for the greeting
export const chairsOf = code => { const cs = cmtesOf(code).filter(c => c.chair);
  return cs.length ? { emails: cs.map(chairEmail).join(','), dear: cs.map(c => `Chair ${c.chair}`).join(' and '), names: cs.map(c => c.chair).join(' and '), n: cs.length } : null; };
export const legsOf = code => { const cs = codesOf(code), rank = { chair: 0, vice_chair: 1, member: 2 }, by = new Map();
  for (const m of S.committeeMembers) { if (!cs.includes(m.committee)) continue; const l = legById(m.legislator_id); if (!l) continue;
    const x = by.get(l.id); if (!x) { by.set(l.id, { ...m, l, roles: { [m.committee]: m.role } }); continue; }
    x.roles[m.committee] = m.role; if (rank[m.role] < rank[x.role]) { x.role = m.role; x.committee = m.committee; } }
  return [...by.values()].sort((a, b) => rank[a.role] - rank[b.role] || cs.indexOf(a.committee) - cs.indexOf(b.committee) || a.l.sort_name.localeCompare(b.l.sort_name)); };
export const legPhoto = (l, cls = 'lphoto') => l.photo_url ? `<img class="${cls}" src="${esc(l.photo_url)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'${cls} none',textContent:'${esc((l.name || '?')[0])}'}))">` : `<span class="${cls} none">${esc((l.name || '?')[0])}</span>`;
// the places a legislator's district covers, one name each
export const placesOf = l => (l.places || '').split(/,\s*/).map(x => x.replace(/^(a )?portions? of\s+/i, '').trim()).filter(Boolean);
// what the box suggests
export const looksLikeAddress = q => q.trim().length >= 3 && !/^(senate|house|sd|hd)?\s*(district)?\s*\d{1,2}$/i.test(q.trim());
// Suggestions come from our own table of every Hawaiʻi street address (with districts), one fast query.
export async function fetchAddrSuggest(q) {
  const { data, error } = await (await supa()).rpc('address_suggest', { q, n: 8 }); if (error) throw error;
  return (data || []).map(x => ({ label: x.label, lat: x.lat, lon: x.lon, sd: x.sd, hd: x.hd, exact: x.exact }));
}
export async function legLookupAddress(q, pt) {
  const byDistrict = (sd, hd) => S.legislators.filter(l => (l.chamber === 'S' && l.district === sd) || (l.chamber === 'H' && l.district === hd)).map(l => l.id);
  if (pt && pt.sd && pt.hd) return { matched: pt.label, ids: byDistrict(pt.sd, pt.hd) };
  if (pt) { const { data } = await (await supa()).rpc('districts_at', { lat: pt.lat, lon: pt.lon }); const d = data?.[0]; if (d?.sd || d?.hd) return { matched: pt.label, ids: byDistrict(d.sd, d.hd) }; }
  const r = await fetch(`${SUPABASE_URL}/functions/v1/geo-lookup?address=${encodeURIComponent(q)}`, { headers: { apikey: SUPABASE_KEY } });
  const j = await r.json(); if (!j.found) return { none: true };
  return { matched: j.matched || q, ids: byDistrict(j.senate, j.house) };
}
// mail draft for a legislator about a bill (or a general note)
export function legDraft(l, b) {
  const ask = b && (b.hiphi_action || '').trim();
  const subject = b ? `${b.bill_number.replace(/^(\D+)/, '$1 ')}${b.hiphi_position ? ' — ' + ({ strongly_support: 'please support', support: 'please support', support_amend: 'please support with amendments', strongly_oppose: 'please oppose', oppose: 'please oppose', neutral: 'comments' }[b.hiphi_position] || '') : ''}` : `A constituent from ${S.legTown || 'your district'}`;
  const surname = (l.sort_name || l.name).split(',')[0].trim();
  const body = `Aloha ${legTitle(l)} ${surname},\n\nMy name is [your name] and I live in [your town].${b ? `\n\nI am writing about ${b.bill_number.replace(/^(\D+)/, '$1 ')}, ${blurb(b, 140)}${ask ? `\n\n${ask}` : ''}` : ''}\n\n[Why this matters to you, in a sentence or two.]\n\nMahalo,\n[your name]`;
  return { subject, body, mailto: `mailto:${l.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` };
}
export async function loadBills() {
  const ids = [...S.watch];
  if (!S.pool) { try { await loadPool(); } catch { S.pool = { bills: [], hearings: [] }; } }
  if (!S.featured) { try { await loadFeatured(); } catch { S.featured = { hearings: [], bills: [] }; } }
  if (DEMO) {
    const w = new Set(ids);
    S.bills = D.bills.filter(b => w.has(b.id)); S.hearings = D.hearings.filter(h => w.has(h.bill_id));
    S.activity = D.activity.filter(a => w.has(a.bill_id)).sort((x, y) => y.occurred_at.localeCompare(x.occurred_at));
    Object.assign(S.outcomes, Object.fromEntries(D.outcomes.filter(o => w.has(o.bill_id)).map(o => [o.hearing_id, o])));
    await loadActions([...ids, ...((S.featured || {}).bills || []).map(b => b.id)]);
    return;
  }
  if (!ids.length) { S.bills = []; S.hearings = []; S.activity = []; }
  else {
    // Following a whole category can mean 60 or more bills: asked for in slices (inChunks).
    const [b, h, a, o] = await Promise.all([
      inChunks(ids, ch => S.supa.from('public_all_bills').select('*').in('id', ch)),
      inChunks(ids, ch => S.supa.from('public_all_hearings').select('*').in('bill_id', ch)),
      inChunks(ids, ch => S.supa.from('public_activity').select('*').in('bill_id', ch).order('occurred_at', { ascending: false }).limit(300)),
      inChunks(ids, ch => S.supa.from('public_hearing_outcomes').select('*').in('bill_id', ch)),
    ]);
    S.bills = b; S.hearings = h; S.activity = a.sort((x, y) => y.occurred_at.localeCompare(x.occurred_at)).slice(0, 300);
    Object.assign(S.outcomes, Object.fromEntries(o.map(x => [x.hearing_id, x])));
  }
  try { await loadActions([...ids, ...((S.featured || {}).bills || []).map(b => b.id)]); } catch { /* counts are decoration */ }
  if (!S.deadlines.length) {
    const [d, c, sl, co, lg, cm, cp] = await loadReference();
    S.legislators = lg.data || []; S.committeeMembers = cm.data || []; S.counterparts = cp.data || [];
    S.slots = sl.data || [];
    S.deadlines = (d.data || []).sort((x, y) => x.deadline_date.localeCompare(y.deadline_date));
    S.committees = Object.fromEntries((c.data || []).map(x => [x.code, x]));
    S.coalitions = (co.data || []).filter(x => x.bills > 0);
    // The session dates are known now; if they change which session's bills an issue brings, load those instead.
    const had = [...S.watch].sort().join(); recomputeWatch();
    if ([...S.watch].sort().join() !== had) return loadBills();
  }
}
// Supabase takes an id list in the URL, so a long list is asked for in slices and put back together.
async function inChunks(ids, make, size = 80) {
  const parts = []; for (let k = 0; k < ids.length; k += size) parts.push(ids.slice(k, k + size));
  const rs = await Promise.all(parts.map(make));
  return rs.flatMap(r => { if (r?.error) throw r.error; return r?.data || []; });
}
// This week at the Capitol: upcoming hearings on bills HIPHI has a position on,
// so a first visit has something to watch in one tap.
// The pool suggestions come from: every live bill HIPHI has a position on, with
// hearings in the next two weeks. Loaded once per visit.
// The session's reference data (deadlines, committees, legislators, ...): nothing in it depends on what the person
// follows, so app.js starts it with the other first requests instead of after them (R-067 speed: it was the last of
// five waves). Asked once; loadBills waits for it.
export function loadReference() {
  return S.refP ??= Promise.all([S.supa.from('public_deadlines').select('*'), S.supa.from('public_committees').select('*'),
    S.supa.from('public_committee_slots').select('*'), S.supa.from('public_coalitions').select('*'),
    S.supa.from('public_legislators').select('*').order('chamber').order('district'), S.supa.from('public_committee_members').select('*'), S.supa.from('public_committee_counterparts').select('*')])
    .catch(e => { S.refP = null; throw e; });
}
export async function loadPool() {
  if (!DEMO) { S.poolP ??= loadPool0().finally(() => { S.poolP = null; }); return S.poolP; }
  return loadPool0();
}
async function loadPool0() {
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
// Every bill HIPHI took a position on in one session, whatever became of it. The pool above holds only bills still
// moving, so between sessions it is empty - which is how every topic came to say "0 bills in 2026" and the recap
// "HIPHI worked on 0 bills" (9/21, REQUESTS R-019). Loaded once per visit, for the start's counts and recap and
// for Home's "Your issues".
export async function loadRecapPool(yr) {
  if (S.recapPool && S.recapPool.yr === yr) return S.recapPool.bills;
  let bills;
  if (DEMO) bills = D.bills.filter(b => b.hiphi_position && b.hiphi_position !== 'monitor' && (!b.session_year || +b.session_year === yr));
  else {
    // supa(), not S.supa: the topics screen asks for this before the library is in (the early first screen, R-122).
    const { data, error } = await (await supa()).from('public_all_bills').select('*').eq('session_year', yr).not('hiphi_position', 'is', null).neq('hiphi_position', 'monitor').limit(1000);
    if (error) throw error; bills = data || [];
  }
  S.recapPool = { yr, bills };
  return bills;
}
// For a screen that only shows counts from it: start the load once and redraw when it lands. A failure is not retried
// (a redraw would call this again and spin); the counts are simply left out for the rest of the visit.
// HIPHI's wins from before this tracker's records begin (it holds the 2025-2026 bills as 2026 records; a bill that
// became law in 2025 is not in it). Nate gave these on 9/27 (R-067); add a line here for any other win to name.
export const EARLIER_WINS = [
  { year: 2025, text: 'More students can get free school meals', bill: 'SB 1300' },
  { year: 2025, text: 'Dedicated funding for Safe Routes to School' },
];
// The bills HIPHI backed that became law in a session, from the recap pool (null until it has loaded).
export const winsIn = yr => S.recapPool && S.recapPool.yr === yr ? S.recapPool.bills.filter(b => b.stage === 'enacted' && /support/.test(b.hiphi_position || '')) : null;
export function ensureRecapPool(yr) {
  if ((S.recapPool && S.recapPool.yr === yr) || S.recapLoading || S.recapFailed === yr) return;
  S.recapLoading = true;
  loadRecapPool(yr).catch(e => { console.error(e); S.recapFailed = yr; }).finally(() => { S.recapLoading = false; app.render(); });
}
// The topic keys picked in the guided start ('food', 'tobacco'...). Since 9/20 the start stores topics, not
// coalition names, so anything matching picks against b.coalitions has to ask topicOf() as well (R-019).
// A bill in a category this person cares about (likedCats). A bill with no issue yet falls back to the old word
// patterns of topics.js.
export const pickedTopic = b => { const liked = likedCats(), iss = issuesOf(b);
  if (iss.length) return iss.some(i => (i.categories || [i.category]).some(c => liked.has(c)));
  const k = topicOf(b)?.key; return !!k && liked.has(k); };
export function dismissed() { try { return new Set(JSON.parse(localStorage.getItem('hiphi_dismiss') || '[]')); } catch { return new Set(); } }
export function dismiss(id) { const d = dismissed(); d.add(id); try { localStorage.setItem('hiphi_dismiss', JSON.stringify([...d])); } catch { /* ignore */ } }
// ---------------- the suggested bill (R-094) ----------------
// The scoring lives in pub/rank.js (pure, so the 2026 replay runs the same code); this builds the person it needs from
// what the page already holds. Everything is worked out here in the browser: nothing about the person is sent anywhere.
// What is sent (R-094 step 5, migration 118) is a count with no bill or person: a suggestion shown, followed, dismissed or
// acted on, where (Home or Find) and in which place of the short list (HIPHI's top pick, the person's own interests,
// or the rest), so January can say whether suggestions help.
export { WEIGHT, SOON_DAYS, sidePoints } from './rank.js';
const SEEN_KEY = DEMO ? 'hiphi_sugg_seen_demo' : 'hiphi_sugg_seen';
const readSeen = () => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') || {}; } catch { return {}; } };
const catsOfBill = b => { const iss = issuesOf(b); if (iss.length) return [...new Set(iss.flatMap(i => i.categories || [i.category]))];
  const k = topicOf(b)?.key; return k ? [k] : []; };
function person() {
  const followCats = new Set([...S.catFollows, ...followedIssues().flatMap(i => i.categories || [i.category])]);
  const picks = wiz().issues || [], pickedCats = new Set(picks);
  const likedCoalitions = new Set([...S.bills.flatMap(b => b.coalitions || []), ...picks.flatMap(groupNames)]);
  const actedCats = new Set(myActions().filter(a => actedKind(a.kind)).flatMap(a => issuesOf(a.bill_id).flatMap(i => i.categories || [i.category])));
  // Issues related to one the person follows (and not followed themselves), each with the followed issue's name.
  const relatedTo = new Map(), mine = followedIssues();
  for (const f of mine) for (const id of (S.issueLinks || new Map()).get(f.id) || []) if (!relatedTo.has(id) && !mine.some(m => m.id === id)) relatedTo.set(id, f.name);
  return { now: Date.now(), issuesOf, catsOf: catsOfBill, relatedTo, catName: k => catOf(k)?.name || k,
    follows: S.watch, dismissed: dismissed(), skips: S.skips, against: b => agrees(b) === false,
    followCats, pickedCats, likedCoalitions, actedCats, seen: readSeen(),
    people: b => { const c = S.actionCounts[b.id]; return c ? (c.actions ?? ((c.testimonies || 0) + (c.emails || 0) + (c.attending || 0))) : null; },
    likedCount: new Set([...followCats, ...pickedCats]).size };
}
// Every live HIPHI bill with its hearing, as rank.js takes them.
function candidates() {
  const pool = S.pool; if (!pool) return [];
  return pool.bills.map(b => {
    const st = billStop(b, { hearings: pool.hearings.filter(h => h.bill_id === b.id), outcomes: {}, deadlineFor: k => deadlineOf(b, k) });
    const h = st.hearingState === 'scheduled' ? st.hearing : null;
    return { b, st, hearing: h, due: h ? new Date(h.testimony_deadline || h.scheduled_at).getTime() : null, kind: 'testify' };
  });
}
// Every bill that may be suggested, scored and in order. Each item: { b, st, hearing, when, score, why, ... }.
export function recommendations(limit = 50) { return rankAll(candidates(), person()).slice(0, limit); }
// The short list: Find shows n = 4, Home the first. Its reason lines are kept for the cards (reasonOf).
export function suggestionList(n = 4) {
  const p = person(), list = shortList(rankAll(candidates(), p), n, p.likedCount);
  for (const r of list) S.sugWhy.set(r.b.id, r.why);
  return list;
}
export const reasonOf = b => S.sugWhy.get(b.id) || '';
// Called when suggestions are put on screen: a bill shown on three separate days and never followed, acted on or
// dismissed drops; after five it is not suggested again until it has a new hearing (FATIGUE in rank.js). surface: 'home'
// or 'find'. The first showing of a bill each day is counted (R-094 step 5), and the entry keeps where and in which
// place it was shown, so following, dismissing or acting on it later is counted the same way.
const slotOf = r => r.fit > 0 ? 'yours' : r.topPick ? 'pick' : 'other';
export function noteShown(list, surface = 'find') {
  if (!list.length) return;
  try {
    const before = readSeen(), today = hstDay(Date.now());
    const fresh = list.filter(r => r.hearing?.id && !(before[r.b.id]?.h === r.hearing.id && (before[r.b.id].days || []).includes(today)));
    const seen = markShown(before, list, Date.now());
    for (const r of list) if (seen[r.b.id]) Object.assign(seen[r.b.id], { s: surface, l: slotOf(r) });
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    for (const r of fresh) logSuggest({ s: surface, l: slotOf(r), k: 'shown' });
  } catch { /* ignore */ }
}
// A suggested bill followed, dismissed or acted on: counted once per bill and hearing, and only when it was shown as a
// suggestion in the last 14 days (the record noteShown keeps).
const SUGC_KEY = 'hiphi_sugc';
export function suggestEvent(billId, k) {
  try {
    const e = readSeen()[billId], last = e && (e.days || []).slice(-1)[0];
    if (!e || !last || (Date.parse(hstDay(Date.now())) - Date.parse(last)) / 864e5 > 14) return;
    const id = `${billId}|${e.h}|${k}`, sent = JSON.parse(localStorage.getItem(SUGC_KEY) || '[]');
    if (sent.includes(id)) return;
    localStorage.setItem(SUGC_KEY, JSON.stringify([...sent, id].slice(-300)));
    logSuggest({ s: e.s === 'home' ? 'home' : 'find', l: ['pick', 'yours'].includes(e.l) ? e.l : 'other', k });
  } catch { /* ignore */ }
}
export async function loadFeatured() {
  const now = Date.now(), until = new Date(now + 8 * 864e5).toISOString();
  if (DEMO) {
    const hs = D.hearings.filter(h => h.status === 'scheduled' && new Date(h.scheduled_at) > now && h.scheduled_at < until);
    const ids = new Set(hs.map(h => h.bill_id));
    const bills = D.bills.filter(b => ids.has(b.id) && b.hiphi_position && b.hiphi_position !== 'monitor');
    S.featured = { hearings: hs.filter(h => bills.some(b => b.id === h.bill_id)), bills }; return;
  }
  // HIPHI's own bills first, then their hearings. It used to take the first 60 hearings of every bill and keep
  // HIPHI's afterwards: replayed on 2026, the busiest week had 52 HIPHI hearings and 4 would have shown (R-067).
  // The pool already holds exactly HIPHI's live bills and their hearings for the next two weeks.
  if (!S.pool) await loadPool();
  const hs = S.pool.hearings.filter(h => h.status === 'scheduled' && new Date(h.scheduled_at) > now && new Date(h.scheduled_at) < new Date(until))
    .sort((x, y) => new Date(x.scheduled_at) - new Date(y.scheduled_at));
  const ids = new Set(hs.map(h => h.bill_id));
  S.featured = { hearings: hs, bills: S.pool.bills.filter(b => ids.has(b.id)) };
}
// Onboarding state lives in this browser: which steps are done, nudges shown, tour seen.
export async function toggleWatch(id) {
  const on = S.watch.has(id), covered = S.viaIssues.has(id), wasDirect = S.direct.has(id), wasSkip = S.skips.has(id);
  if (on) { S.direct.delete(id); if (covered) S.skips.add(id); }
  else { S.skips.delete(id); if (!covered) S.direct.add(id); }
  recomputeWatch(); saveLocal(); syncText();
  if (S.user && !DEMO) {
    const uid = S.user.id, calls = [];
    if (wasDirect && !S.direct.has(id)) calls.push(S.supa.from('watchlist').delete().eq('user_id', uid).eq('bill_id', id));
    if (!wasDirect && S.direct.has(id)) calls.push(S.supa.from('watchlist').insert({ user_id: uid, bill_id: id, stance: (S.stances || {})[id] || null }));
    if (!wasSkip && S.skips.has(id)) calls.push(S.supa.from('bill_skips').insert({ user_id: uid, bill_id: id }));
    if (wasSkip && !S.skips.has(id)) calls.push(S.supa.from('bill_skips').delete().eq('user_id', uid).eq('bill_id', id));
    const err = (await Promise.all(calls)).find(r => r.error)?.error;
    if (err) { toast(err, true);
      if (wasDirect) S.direct.add(id); else S.direct.delete(id); if (wasSkip) S.skips.add(id); else S.skips.delete(id);
      recomputeWatch(); saveLocal(); return; }
  }
  await loadBills();
  // Signed in, first bill followed, no districts yet: ask for a home address once (it is the field HIPHI needs most).
  if (!on && S.user && !DEMO && S.watch.size >= 1 && !(S.profile || {}).senate_district && !onb().addrAsked) { S.addrCard = true; onbSet({ addrAsked: true }); }
  // Sign-in nudge after the first and third Watch, never a modal, never before a Watch.
  if (!on && S.watch.size && [1, 3].includes(S.watch.size)) nudge('follow');
  app.render();
}
export async function search(q) {
  if (DEMO) return [...D.bills.filter(b => dmatch(b, q)), ...D.index.filter(b => dmatch(b, q))].slice(0, 25);
  const safe = q.replace(/[%,()]/g, ' ').trim();
  const { data, error } = await S.supa.from('public_all_bills').select('*')
    .or(`bill_number.ilike.%${safe.replace(/\s/g, '')}%,title.ilike.%${safe}%,description.ilike.%${safe}%`)
    .order('bill_number').limit(25);
  if (error) throw error; return data;
}
// Every public bill HIPHI has tagged with a coalition (public_all_bills.coalitions).
export async function browseCoalition(name) {
  const names = groupNames(name);
  if (DEMO) { S.browse = { name: names[0], rows: D.bills.filter(b => b.coalitions.some(n => names.includes(n))) }; S.results = null; S.q = ''; return; }
  const { data, error } = await S.supa.from('public_all_bills').select('*').overlaps('coalitions', names).order('bill_number').limit(300);
  if (error) throw error;
  S.browse = { name: names[0], rows: data || [] }; S.results = null; S.q = '';
}
// ---------------- helpers ----------------
export const findBill = id => bill(id) || (S.results || []).find(x => x.id === id) || (S.browse?.rows || []).find(x => x.id === id) || ((S.featured || {}).bills || []).find(x => x.id === id) || ((S.pool || {}).bills || []).find(x => x.id === id) || ((S.recapPool || {}).bills || []).find(x => x.id === id) || S.extra[id] || null;
// A bill page shows every hearing of the bill, not only the 30 days the lists load (R-033, 9/26): its whole history,
// each with its recording, which since 9/26 opens at the bill's own minute where the video's description has one
// (public_bill_hearing_history, migration 075). Asked for once per bill and merged in; a failure leaves the 30 days.
S.hist ??= {};
export async function ensureHistory(b) {
  if (DEMO || !b || S.hist[b.id]) return false;
  S.hist[b.id] = 'loading';
  try {
    const { data, error } = await (await supa()).rpc('public_bill_hearing_history', { bill: b.id });
    if (error) throw error;
    const have = new Map(hearingsOf(b).map(h => [h.id, h]));
    // A row already loaded keeps its place; it only gains a recording found since the lists loaded.
    for (const h of data || []) { const o = have.get(h.id); if (o && !o.stream_url && h.stream_url) o.stream_url = h.stream_url; }
    S.xh[b.id] = [...(S.xh[b.id] || []), ...(data || []).filter(h => !have.has(h.id)).map(({ outcome, ...h }) => h)];
    for (const h of data || []) if (h.outcome && !S.outcomes[h.id]) S.outcomes[h.id] = { hearing_id: h.id, bill_id: h.bill_id, outcome: h.outcome };
    S.hist[b.id] = true; return true;
  } catch (e) { delete S.hist[b.id]; console.warn('hearing history', e); return false; }
}
// Every hearing the page has loaded for this bill: the followed set's, the week's pool and the featured bills' (the
// legislator and committee pages list bills nobody follows, and read "waiting for a hearing" for one heard tomorrow:
// R-120, Bug 2), and a bill opened on its own (S.xh).
export const hearingsOf = b => [...new Map([...S.hearings, ...((S.pool || {}).hearings || []), ...((S.featured || {}).hearings || [])].filter(h => h.bill_id === b.id).concat(S.xh[b.id] || []).map(h => [h.id, h])).values()].sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at));
export function stopOf(b) {
  return billStop(b, { hearings: hearingsOf(b), outcomes: S.outcomes || {},
    deadlineFor: key => deadlineOf(b, key) });
}
// A deadline row by its key, or the budget bills' own row that replaces it (Budget Decking 3/16 for HB1800 and HB2095,
// migration 087; R-072). A row that lists bills never applies to any other bill.
export function deadlineOf(b, key) {
  const alt = S.deadlines.find(x => x.replaces === key && (x.bills || []).includes(b.bill_number));
  const d = alt || S.deadlines.filter(x => x.key === key && !(x.bills || []).length).slice(-1)[0];
  return d ? { label: d.label, date: d.deadline_date } : null;
}
export const streamOf = h => hearingStream(h, S.committees[codesOf(h.committee)[0]]?.chamber);
export const POS_WORD = { strongly_support: 'SUPPORT', support: 'SUPPORT', support_amend: 'SUPPORT WITH AMENDMENTS', strongly_oppose: 'OPPOSITION', oppose: 'OPPOSITION', neutral: 'COMMENTS' };
// ---------------- progress: what you did, what it led to, the community ----------------
// Nate, 9/18: a game-like page that stays positive. Best practice for civic tools: show what an action led to,
// show the group's progress, never rank people, never guilt. So: no points, no leaderboard, no daily streak (the
// legislature meets January to May, in bursts); every kind of action counts (testimony, a sent email, going to a
// hearing, sharing); group totals appear only from 10 people; a small Hawaiʻi-flavoured celebration for real acts
// only, and none at all for people who ask their device to reduce motion; between sessions, a recap.
// No account is needed. Signing in is what makes an action count in the community totals.
export const reduceMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
export const MAHALO = { testimony: 'Mahalo for testifying! Your voice is on the record.', email: 'Mahalo! Your email helps the chair see people care.',
  attend: 'Mahalo! See you at the Capitol.', share: 'Mahalo for spreading the word.' };
export function yay(msg) { toast(msg, { yay: true }); }
// five-petal hibiscus, in the page's warm colours
export const flowerSVG = (c, n = 24) => `<svg viewBox="-12 -12 24 24" width="${n}" height="${n}" aria-hidden="true"><g fill="${c}">${[0, 72, 144, 216, 288].map(r => `<ellipse cx="0" cy="-5.6" rx="4.1" ry="5.6" transform="rotate(${r})"/>`).join('')}</g><circle r="2.2" fill="#F9D56E"/></svg>`;
// The one bigger moment: someone's first testimony ever. Twelve hibiscus drift out and fade in about 0.7 s, once.
export function hibiscus() {
  if (reduceMotion()) return;
  const C = ['#E8505B', '#F28CA0', '#F4B942', '#E8505B', '#D9465F', '#F28CA0'];
  const box = document.createElement('div'); box.className = 'burst'; box.setAttribute('aria-hidden', 'true');
  box.innerHTML = [...Array(12)].map((_, i) => { const a = i / 12 * Math.PI * 2 + (i % 2) * 0.22, d = 80 + (i % 3) * 36;
    return `<span class="fl" style="--x:${Math.round(Math.cos(a) * d)}px;--y:${Math.round(Math.sin(a) * d)}px;--r:${(i % 2 ? 1 : -1) * (80 + i * 14)}deg;animation-delay:${(i % 4) * 35}ms">${flowerSVG(C[i % C.length])}</span>`; }).join('');
  document.body.appendChild(box); setTimeout(() => box.remove(), 1200);
}
export function celebrate(kind, firstTestimony) {
  if (firstTestimony) { hibiscus(); yay('Your first testimony! Imua: this is how laws get made in Hawaiʻi. Mahalo nui loa.'); return; }
  yay(MAHALO[kind] || 'Mahalo!');
}
// ---- asking for an email, gently (research 9/18: ask after something worthwhile is done, name the benefit,
// inline and never a pop-up, one ask per visit, and after "Not now" wait 14 days, then 60) ----
export const anyBill = id => findBill(id) || (DEMO ? D.bills.find(b => b.id === id) : null);
export const anyHearing = id => id ? ([...S.hearings, ...((S.featured || {}).hearings || []), ...((S.pool || {}).hearings || []), ...Object.values(S.xh || {}).flat(), ...(DEMO ? D.hearings : [])].find(h => h.id === id) || null) : null;
export const outcomeOf = h => S.outcomes[h.id] || (DEMO ? D.outcomes.find(o => o.hearing_id === h.id) : null);
// Which way the person is on a bill: their own stance, else HIPHI's position when they have none; null when neither
// says. Good news has to go their way (the review 9/30: someone who testified against a bill was told "Good news" when
// a committee passed it).
export function sideOf(b) {
  const st = (S.stances || {})[b?.id];
  if (st === 'support') return 'for';
  if (st === 'oppose') return 'against';
  const p = b?.hiphi_position || '';
  return /support/.test(p) ? 'for' : /oppose/.test(p) ? 'against' : null;
}
// What came after the person acted, when it went their way (R-046, Nate 9/30: "You helped a bill get a hearing. You
// helped a bill pass a hearing."). Each is a fact said plainly, what they did and then what happened, never a claim that
// they caused it:
//   heard   for the bill: they asked for a hearing (an email to the chair, or to their own legislators, while the bill
//           waited) and a hearing notice for it was posted after
//   passed  for the bill: they acted on a hearing (testimony, an email to the chair, went, shared it) and the committee
//           passed it
//   held    against the bill: they acted on a hearing and the committee put it on hold
//   law     for the bill: they acted on it and it became law (or, for a resolution, was adopted)
// Where the side is unknown there is no moment, only the plain fact in "What happened after you acted".
// { key, kind, b, h, at, did } newest first; key names the moment once (Home shows each one once, R-046).
const billHearings = id => { const seen = new Set();
  return [...S.hearings, ...((S.featured || {}).hearings || []), ...((S.pool || {}).hearings || []), ...Object.values(S.xh || {}).flat(), ...(DEMO ? D.hearings : [])]
    .filter(h => h.bill_id === id && !seen.has(h.id) && seen.add(h.id)); };
const DID = { testimony: 'You testified', email: 'You emailed the chair', legislators: 'You wrote to your legislators', attend: 'You went', share: 'You shared it' };
export function results() {
  const acts = myActions(), by = new Map(), out = [];
  for (const a of acts) { if (!by.has(a.bill_id)) by.set(a.bill_id, []); by.get(a.bill_id).push(a); }
  for (const [id, as] of by) {
    const b = anyBill(id); if (!b) continue;
    const side = sideOf(b); if (!side) continue;
    const asks = as.filter(a => !a.hearing_id && (a.kind === 'email' || a.kind === 'legislators') && a.at).sort((x, y) => x.at.localeCompare(y.at));
    if (asks.length && side === 'for') {
      const t0 = +new Date(asks[0].at);
      const h = billHearings(id).filter(x => x.notice_posted_at && +new Date(x.notice_posted_at) > t0 && x.status !== 'cancelled').sort((x, y) => x.notice_posted_at.localeCompare(y.notice_posted_at))[0];
      if (h) out.push({ key: 'heard:' + h.id, kind: 'heard', b, h, at: h.notice_posted_at, did: asks[0].kind === 'legislators' ? 'You wrote to your legislators' : 'You asked for a hearing' });
    }
    for (const hid of new Set(as.filter(a => a.hearing_id).map(a => a.hearing_id))) {
      const h = anyHearing(hid), o = h && outcomeOf(h), k = KINDS.find(x => as.some(a => a.hearing_id === hid && a.kind === x));
      if (o && side === 'for' && /passed/.test(o.outcome || '')) out.push({ key: 'passed:' + hid, kind: 'passed', b, h, at: o.reported_at || h.scheduled_at, did: DID[k] || 'You spoke up', amended: o.outcome === 'passed_amended' });
      if (o && side === 'against' && o.outcome === 'deferred') out.push({ key: 'held:' + hid, kind: 'held', b, h, at: o.reported_at || h.scheduled_at, did: DID[k] || 'You spoke up' });
    }
    if (b.stage === 'enacted' && side === 'for') out.push({ key: 'law:' + id, kind: 'law', b, h: null, at: b.last_action_date || '', did: 'You spoke up for it' });
  }
  return out.sort((x, y) => String(y.at).localeCompare(String(x.at)));
}
// Milestones mark real acts, are shown only to the person, and never expire.
export const MILESTONES = [
  ['follow', 'Following along', 'follow your first issue', () => followsAnything()],
  ['stance', 'Took a stand', 'say where you stand on a bill', () => Object.values(S.stances || {}).some(v => v === 'support' || v === 'oppose')],
  ['first', 'First action', 'your first action on a bill', a => a.length >= 1],
  ['testimony', 'First testimony', 'testimony to a committee', a => a.some(x => x.kind === 'testimony')],
  ['share', 'Spread the word', 'share a bill with someone', a => a.some(x => x.kind === 'share')],
  ['attend', 'Showed up', 'go to a hearing in person', a => a.some(x => x.kind === 'attend')],
  ['three', 'Three hearings', 'act on three different hearings', a => new Set(a.filter(x => x.hearing_id).map(x => x.hearing_id)).size >= 3],
  ['ten', 'Ten actions', 'ten actions in all', a => a.length >= 10],
  ['both', 'Both chambers', 'act on one bill in the House and in the Senate', a => { const m = {};
    for (const x of a) { const h = anyHearing(x.hearing_id), ch = h && S.committees[codesOf(h.committee)[0]]?.chamber; if (ch) (m[x.bill_id] ??= new Set()).add(ch); }
    return Object.values(m).some(v => v.size > 1); }],
  // A result, so never offered as a goal (nobody earns it by trying harder); named for what the person did, not as if they
  // made the law (the review 9/30), and only for a bill they were for.
  ['law', 'Spoke up for a new law', 'speak up for a bill that becomes law', a => a.some(x => { const b = anyBill(x.bill_id); return b?.stage === 'enacted' && sideOf(b) === 'for'; })],
];
export const RESULT_MILESTONES = new Set(['law']);
// Sandbox: three real March hearings the committee passed, marked as if you had acted, so the panel shows.
export const POS_RANK = { strongly_support: 0, strongly_oppose: 0, support: 1, oppose: 1, support_amend: 2, neutral: 3 };
export function curate(rows, cap = 6) {
  const now = Date.now(), up = new Set([...S.hearings, ...((S.featured || {}).hearings || [])].filter(h => new Date(h.scheduled_at) > now).map(h => h.bill_id));
  const live = rows.filter(b => alive(b) && b.hiphi_position && b.hiphi_position !== 'monitor');
  live.sort((a, b) => (POS_RANK[a.hiphi_position] ?? 9) - (POS_RANK[b.hiphi_position] ?? 9) || (up.has(b.id) - up.has(a.id)) || a.bill_number.localeCompare(b.bill_number));
  return { picks: live.slice(0, cap), rest: rows.filter(b => !live.slice(0, cap).includes(b)) };
}
// ---------- the guided start: pick issues -> pick bills -> done ----------
export const countOk = n => (Number(n) >= 10 ? Number(n) : 0);   // a group number is shown only from 10 people
export function issueOf(b) {
  const iss = issuesOf(b)[0], cat = iss && catOf(iss.category);
  if (cat) return { key: cat.name, names: [cat.key], icon: cat.icon };
  const n = (b.coalitions || [])[0]; if (!n) return null;
  const g = issues().find(x => x.names.includes(n));
  return g || { key: cname(n), names: [n], icon: 'heart-pulse' };
}
// "HIPHI supports" with its icon; position is a chip with an icon, never a colour stripe.
const DOW = { timeZone: HST, weekday: 'short' };
export const dayWord = iso => {   // "today", "tomorrow (Tue)", "Thu", "Mon, Mar 30"
  const d = hstDay(iso), today = hstDay(Date.now()), tmr = hstDay(Date.now() + 864e5), days = (new Date(d + 'T12:00:00-10:00') - new Date(today + 'T12:00:00-10:00')) / 864e5;
  const wd = new Date(iso).toLocaleDateString('en-US', DOW);
  return d === today ? 'today' : d === tmr ? `tomorrow (${wd})` : days > 0 && days < 7 ? wd : new Date(iso).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short', month: 'short', day: 'numeric' });
};
export const timeWord = iso => new Date(iso).toLocaleTimeString('en-US', { timeZone: HST, hour: 'numeric', minute: '2-digit' });
// A date from another year says its year: a bill carried over from 2025 read "heard on Tue, Feb 11" and looked like
// last February (R-067).
export const dateLong = iso => { const d = new Date(iso), other = hstDay(d).slice(0, 4) !== hstDay(Date.now()).slice(0, 4);
  return d.toLocaleDateString('en-US', { timeZone: HST, weekday: 'short', month: 'short', day: 'numeric', ...(other ? { year: 'numeric' } : {}) }); };
// "Senate Health and Human Services Committee"; joint committees joined with "and" and "Committees".
export function cmteLabel(code, { short = false } = {}) {
  const cs = codesOf(code).map(c => S.committees[c]).filter(Boolean);
  if (!cs.length) return code ? `the ${code} committee` : 'a committee';
  const ch = CHAMBER_NAME[cs[0].chamber] || '';
  const names = cs.map(c => c.name);
  // Committee names often contain "and" themselves, so a joint pair repeats "Committee" to keep the two apart:
  // "Senate Health and Human Services Committee and Commerce and Consumer Protection Committee".
  if (names.length > 1) return short ? names.join(' / ') : `${ch} ${names.map(n => n + ' Committee').join(' and ')}`.trim();
  return short ? names[0] : `${ch} ${names[0]} Committee`.trim();
}
export const roomLabel = r => { const x = clean(r); return /^Rm /.test(x) ? 'Room ' + x.slice(3) : x === 'room TBD' ? 'room to be announced' : x; };
// Testimony deadline wording and urgency (A-5): amber within 24 hours, red once overdue.
// html: the same line for a page; within a day an honest countdown leads it (R-046, Nate 9/30: only a real deadline, in
// words, never seconds): "Testimony due in under 5 hours · today at 1:00 PM". Rounded up and said as "under", so it never
// disagrees with the time beside it (the review 9/30 caught "in 3 hours · today at 1:00 PM" at 9:01). The countdown is a
// span the page's minute timer rewrites (below), so a page left open stays true.
export const inHours = ms => { const h = Math.ceil(ms / 36e5); return h <= 1 ? 'in under an hour' : `in under ${h} hours`; };
export function dueInfo(h) {
  if (!h?.testimony_deadline) return null;
  const iso = h.testimony_deadline, t = new Date(iso).getTime(), left = t - Date.now();
  if (left <= 0) { const text = `Testimony deadline passed ${dateLong(iso)} at ${timeWord(iso)}`; return { text, html: esc(text), tone: 'danger', late: true }; }
  const text = `Testimony due ${dayWord(iso)} at ${timeWord(iso)}`;
  const html = left < 864e5 ? `<span data-due="${esc(iso)}">Testimony due ${inHours(left)}</span> · ${esc(dayWord(iso))} at ${esc(timeWord(iso))}` : esc(text);
  return { text, html, tone: left < 864e5 ? 'warn' : '', late: false };
}
// The countdowns' minute timer. When one runs out, the page is drawn again: the card changes to its late state.
if (typeof window !== 'undefined') setInterval(() => {
  if (document.hidden) return;
  let over = false;
  document.querySelectorAll('[data-due]').forEach(el => { const left = new Date(el.dataset.due) - Date.now(); if (left <= 0) over = true; else { const t = `Testimony due ${inHours(left)}`; if (el.textContent !== t) el.textContent = t; } });
  if (over) app.render?.();
}, 60000);
export const hearingText = h => h ? `Hearing ${dateLong(h.scheduled_at)} at ${timeWord(h.scheduled_at)} · ${roomLabel(h.room)}` : '';
// A stopped bill whose companion (the same idea, filed in the other chamber) became law (X4-4, R-180 wave 2): HB 2121 stopped,
// but the same disposable e-cigarette ban became law as SB 2175, Act 189. Only from bills already loaded; the bill page asks for
// the companion when it is not (bill.js). Resolutions are not "law". Returns { num, act } or null.
export function sameIdeaLaw(b) {
  if (!b || isResolution(b)) return null;
  const have = [...S.bills, ...Object.values(S.extra || {}), ...(S.results || []), ...(DEMO ? [...D.bills, ...D.index] : [])];
  const lawOf = c => c && !isResolution(c) && c.id !== b.id && +c.session_year === +b.session_year && (c.stage === 'enacted' || stopOf(c).phase === 'law');
  const said = (c, issue = '') => { const m = /\bAct\s+(\d+)\b/i.exec(`${c.last_action || ''} ${c.status_text || ''}`); return { num: c.bill_number, act: m ? m[1] : '', issue }; };
  // 1. its companion, the same idea filed in the other chamber, when the Legislature's data names one
  for (const num of companionsOf(b)) { const c = have.find(x => x.bill_number === num && +x.session_year === +b.session_year); if (lawOf(c)) return said(c); }
  // 2. the other chamber's bill on one of its published issues (HIPHI's issue is "the idea behind it"): the companion field is empty for
  //    HB 2121 and SB 2175, which are the same ban. A bill in the same chamber is never taken for the same idea.
  for (const i of issuesOf(b)) for (const [k, id] of (i.bill_ids || []).entries()) {
    if (+(i.bill_years || [])[k] !== +b.session_year) continue;
    const c = have.find(x => x.id === id);
    if (lawOf(c) && (c.bill_number || '')[0] !== (b.bill_number || '')[0]) return said(c, i.name || 'the same issue');
  }
  return null;
}
// A companion is the same idea word for word; a bill found only through an issue is "on the same issue", which is what HIPHI knows
// (an issue's bills can differ in how far they go), so it is named by the issue and not called the same idea.
export const sameIdeaWords = L => L.issue ? `On “${L.issue}”, ${spaced(L.num)} became law${L.act ? ` (Act ${L.act})` : ''}.` : `The same idea became law as ${spaced(L.num)}${L.act ? `, Act ${L.act}` : ''}.`;
// One plain sentence for where a bill is and what happens next.
export function plainStatus(b) {
  const st = stopOf(b);
  if (b.stage === 'enacted' || st.phase === 'law') return isResolution(b) ? { text: 'Adopted.', short: 'Adopted', tone: 'ok' } : { text: 'Became law.', short: 'Became law', tone: 'ok' };
  // A constitutional amendment the Legislature passed goes on the November ballot, not to the Governor (R-072).
  if (b.stage === 'ballot' || st.phase === 'ballot') return { text: 'Passed the House and Senate. The voters decide on it in the November election.', short: 'Goes to the voters', tone: 'ok' };
  if (b.stage === 'vetoed' || st.phase === 'vetoed') return { text: 'Vetoed by the Governor.', short: 'Vetoed', tone: '' };
  if (b.stage === 'governor' || st.phase === 'governor') return { text: 'Passed the House and Senate. It is on the Governor’s desk.', short: 'On the Governor’s desk', tone: 'info' };
  if (!alive(b) || st.phase === 'dead') { const L = sameIdeaLaw(b);
    return { text: whyStopped(b) + (L ? ' ' + sameIdeaWords(L) : ''), short: isResolution(b) ? 'Not adopted' : L ? (L.issue ? `Did not advance · ${spaced(L.num)} on the same issue became law` : `Did not advance · the same idea became law as ${spaced(L.num)}`) : 'Did not advance', tone: '', sameLaw: L }; }
  const ch = CHAMBER_NAME[st.chamber] || '';
  if (st.phase === 'conference') return { text: 'The House and Senate passed different versions. They are working out one version now.', short: 'House and Senate working out one version', tone: 'info' };
  if (st.phase === 'floor') return { text: `Through its ${ch} committees. Next is a vote of the full ${ch}.`, short: `Waiting for a ${ch} vote`, tone: 'info' };
  const where = st.committee ? `the ${cmteLabel(st.committee)}` : `a ${ch} committee`;
  const other = st.chamber === 'H' ? 'Senate' : 'House';
  const passed = st.leg === 'second' ? `Passed the ${other}. ` : '';
  if (st.hearingState === 'scheduled') {
    const d = dueInfo(st.hearing);
    return { text: `${passed}${cap(where)} ${codesOf(st.committee).length > 1 ? 'hear' : 'hears'} it ${dateLong(st.hearing.scheduled_at)} at ${timeWord(st.hearing.scheduled_at)}.`, short: d && !d.late ? `Hearing ${dayWord(st.hearing.scheduled_at)} · ${d.text.replace('Testimony ', 'testimony ')}` : `Hearing ${dayWord(st.hearing.scheduled_at)}`, tone: d && !d.late ? d.tone || 'info' : 'info' };
  }
  if (st.hearingState === 'held') return { text: `${passed}${cap(where)} heard it ${dateLong(st.hearing.scheduled_at)}. Waiting for ${codesOf(st.committee).length > 1 ? 'their' : 'its'} decision.`, short: 'Heard, waiting for the decision', tone: 'info' };
  // The committee decided and the bill has not moved on yet (R-115): say the decision, never "waiting for a hearing".
  if (st.hearingState === 'decided') {
    const o = st.decided, ok = /passed/.test(o), verb = o === 'passed_amended' ? 'passed it with changes' : ok ? 'passed it' : o === 'deferred' ? 'put it on hold' : 'sent it back';
    return { text: `${passed}${cap(where)} ${verb} ${dateLong(st.hearing.scheduled_at)}.${ok ? ' ' + (nextWords(b) || 'Next it moves on to its next step.') : ''}`, short: ok ? 'Passed · on to the next step' : o === 'deferred' ? 'Put on hold' : 'Sent back', tone: ok ? 'ok' : o === 'deferred' ? 'warn' : '' };
  }
  if (!st.committee) return { text: `${passed}Waiting to be sent to a ${ch} committee.`, short: `Waiting for a ${ch} committee`, tone: '' };
  const dl = st.deadline && !st.deadline.missed ? st.deadline : null;
  return { text: `${passed}Waiting for a hearing in ${where}.${dl ? ` If it is not heard by ${dateLong(dl.date + 'T12:00:00-10:00')}, it can’t pass this year.` : ''}`,
    short: dl ? `Waiting for a hearing · ${dl.days} day${dl.days === 1 ? '' : 's'} left` : 'Waiting for a hearing', tone: dl && dl.days <= 7 ? 'warn' : '' };
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
// Why a bill stopped, exactly (R-083, Nate 9/29: "when a bill dies it doesn't say exactly why"). Three facts: where it got
// to, what happened there, and the rule it missed with its date, in plain words and without Capitol shorthand (no
// "Lateral" or "Decking"; DESIGN C-10). stopDetail is shown under the step bar's "Stopped in ..." (Nate 9/29: "These
// notes need to be in the steps section"; the sentence at the top went back to whyStopped); whyStoppedShort is the
// lists' few words.
// The rule each committee deadline sets, from the Legislature's deadline guide (the same rules stops.js follows, R-072).
const RULE_OF = { triple: 'bills sent to three or more committees had to be through all but their last two', lateral: 'bills had to be through all but their last committee', decking: 'bills had to be through all their committees' };
const theCmte = code => { const l = cmteLabel(code); return /^(the|a) /.test(l) ? l : `the ${l}`; };
const shortCmte = code => { const c = S.committees[codesOf(code)[0]]; return c ? `${CHAMBER_NAME[c.chamber] || ''} ${cmteLabel(code, { short: true })}`.trim() : code; };
const sameCmte = (h, code) => codesOf(h.committee).some(k => codesOf(code).includes(k));
export function stopFacts(b) {
  const origin = b.chamber || (String(b.bill_number || '').startsWith('S') ? 'S' : 'H'), other = origin === 'H' ? 'S' : 'H';
  const d = b.died_at_stage || '', m = /^(.*?)\s+(\d+\/\d+\/\d+)$/.exec(b.died_deadline || '');
  const f = { res: isResolution(b), when: m ? shortDate(m[2]) : '', label: m ? m[1] : (b.died_deadline || ''), d, dead: b.stage === 'dead',
    ch: CHAMBER_NAME[/^second/.test(d) ? other : origin] };
  // Only this session's hearings: a hearing a year earlier is not why it stopped (HB1278 was heard by WTL in 2025 and
  // stopped in WLA in 2026 without a hearing there; R-077).
  const yr = m ? '20' + m[2].slice(-2) : null;
  const past = hearingsOf(b).filter(h => h.status !== 'cancelled' && new Date(h.scheduled_at) < Date.now() && (!yr || String(h.scheduled_at).startsWith(yr)));
  const passed = h => /passed/.test(outcomeOf(h)?.outcome || '');
  if (b.stage === 'vetoed') return { ...f, kind: 'vetoed' };
  // A failed floor vote: the sync marks it (status_text) and records where it stood (died_at_stage), since a later line,
  // such as a recommittal, can follow the vote (HB1516; R-072's every-bill test).
  if (b.status_text === 'Failed a vote' || /failed to pass/i.test(b.last_action || '')) return { ...f, kind: 'failed' };
  // Held ("deferred"): the committee is in the Capitol's own line ("The committee(s) on CPN recommend(s) that the measure
  // be deferred"), the day is its hearing there.
  // "recommend(s) that the measure be HELD" is a hold too (SB2383, PSM; its outcome row reads Passed).
  if (HELD_RE.test(b.last_action || '') || /measure be HELD/i.test(b.last_action || '')) {
    const c = (/committee(?:\(s\))? on\s+([A-Z][A-Z\/]*)/.exec(b.last_action) || [])[1] || null;
    return { ...f, kind: 'held', cmte: c, heard: c ? past.filter(h => sameCmte(h, c)).pop() || null : null };
  }
  if (/^(first|second)_floor$/.test(d)) return { ...f, kind: 'floor' };
  // Stopped after both chambers passed it: in different versions, and no one final version (HB 1782; Nate 9/26).
  if (/^(second_crossover|conference)$/.test(d)) return { ...f, kind: 'final' };
  const at = stoppedAt(b);
  if (at) {
    // The committee it stopped in, what that committee did, and the one before it in the same chamber that passed it.
    const heard = past.filter(h => sameCmte(h, at.committee)).pop() || null;
    const before = past.filter(h => !sameCmte(h, at.committee) && S.committees[codesOf(h.committee)[0]]?.chamber === at.chamber && passed(h)).pop() || null;
    // Not heard there this year, but heard a year earlier (about 300 bills were put on hold in 2025 by the committee they
    // stopped in, carried over, and never taken up again), or a hearing it cancelled (SB654's in 2025): "never scheduled"
    // would be false.
    const all = hearingsOf(b).filter(h => sameCmte(h, at.committee) && new Date(h.scheduled_at) < Date.now());
    const prior = !heard && all.filter(h => h.status !== 'cancelled').pop() || null;
    const cancelled = !heard && !prior && all.filter(h => h.status === 'cancelled').pop() || null;
    return { ...f, kind: heard ? 'heard' : 'noHearing', cmte: at.committee, chamber: at.chamber, rule: /_(triple|lateral|decking)$/.exec(d)[1], heard, before,
      cancelled, prior, yr, outcome: heard ? outcomeOf(heard)?.outcome || null : null };
  }
  // A resolution with no stage to go on: say what hearings there were.
  const last = past.pop() || null;
  return { ...f, kind: last ? 'heard' : 'noHearing', cmte: last ? last.committee : null, heard: last, outcome: last ? outcomeOf(last)?.outcome || null : null };
}
export function stopDetail(b) {
  const f = stopFacts(b), end = f.res ? 'so it was not adopted this year.' : 'so it can’t pass this year.';
  if (f.kind === 'vetoed') return 'Vetoed by the Governor.';
  if (f.kind === 'failed') {
    const o = b.chamber || (String(b.bill_number || '').startsWith('S') ? 'S' : 'H');
    return /^(conference|second_crossover)$/.test(f.d) ? 'It did not pass its final vote, so it can’t pass this year.'
      : /^second/.test(f.d) ? `It did not pass the vote of the full ${CHAMBER_NAME[o === 'H' ? 'S' : 'H']}, so it can’t pass this year.`
      : /^first/.test(f.d) ? `It did not pass the vote of the full ${CHAMBER_NAME[o]}, so it can’t pass this year.` : 'Did not pass a vote.';
  }
  // The rule it missed, as its own sentence: "In the Senate, bills had to be through all but their last committee by Mar 30,
  // so it can’t pass this year." Resolutions and bills that stopped when the session ended have no other deadline.
  const ended = f.res || /sine die/i.test(f.label);
  const rule = ended ? (f.when ? ` The session ended on ${f.when}, ${end}` : ` The session ended, ${end}`)
    : f.kind === 'floor' ? ` Bills had to pass the full ${f.ch} by ${f.when}, ${end}`
    : f.kind === 'final' ? (/fiscal/i.test(f.label) ? ` Bills that spend money needed a final version by ${f.when}, ${end}` : ` The final version had to be ready for its last vote by ${f.when}, ${end}`)
    : f.rule && f.when ? ` In the ${CHAMBER_NAME[f.chamber]}, ${RULE_OF[f.rule]} by ${f.when}, ${end}`
    : f.when ? ` Its deadline was ${f.when}, ${end}` : ` ${cap(end)}`;
  if (f.kind === 'held') {
    const who = f.cmte ? cap(theCmte(f.cmte)) : 'A committee', on = f.heard ? ` on ${dateLong(f.heard.scheduled_at)}` : '';
    // Held during the session: it could in theory come back, and almost never does.
    if (!f.dead && !f.res) return `${who} put it on hold${on} instead of passing it, which usually means it won’t pass this year.`;
    return `${who} ${f.heard ? 'heard it' + on + ' and ' : ''}put it on hold instead of passing it, ${end}`;
  }
  if (f.kind === 'floor') return `Its ${f.ch} committees passed it, but the full ${f.ch} did not vote on it.${rule}`;
  if (f.kind === 'final') return `The House and the Senate each passed it, but in different versions, and they did not agree on one final version.${rule}`;
  if (f.kind === 'noHearing') {
    if (!f.cmte) return `No committee held a hearing on it.${rule}`;
    // The chair decides which bills a committee hears: "never scheduled a hearing" is the reason, not a missing step.
    const did = f.cancelled ? `scheduled a hearing for ${dateLong(f.cancelled.scheduled_at)}, then cancelled it and did not hold another`
      : f.prior ? `heard it on ${dateLong(f.prior.scheduled_at)}${outcomeOf(f.prior)?.outcome === 'deferred' ? ' and put it on hold' : ''}, and did not take it up again${f.yr ? ` in ${f.yr}` : ''}`
      : 'never scheduled a hearing on it';
    return f.before ? `${cap(theCmte(f.before.committee))} passed it on ${dateLong(f.before.scheduled_at)}, but the next committee, ${theCmte(f.cmte)}, ${did}.${rule}`
      : `${cap(theCmte(f.cmte))} ${did}.${rule}`;
  }
  if (f.kind === 'heard') {
    const who = cap(theCmte(f.heard.committee)), on = dateLong(f.heard.scheduled_at);
    // A committee that passed it where it stopped. Usually the full chamber turned down the committee's report ("The
    // recommendation was not adopted", HB1880); otherwise it did not reach its next step in time (HB 1779, R-067).
    const hc = CHAMBER_NAME[S.committees[codesOf(f.heard.committee)[0]]?.chamber];
    if (/passed/.test(f.outcome || '') && /recommendation was not adopted/i.test(b.last_action || '') && hc) return `${who} passed it on ${on}, but the full ${hc} voted not to accept the committee’s report.${rule}`;
    // The committee's vote is the Capitol's last line: its written report never reached the floor (HB1985, SB2243).
    if (/passed/.test(f.outcome || '') && /measure be PASSED/i.test(b.last_action || '') && hc) return `${who} passed it on ${on}, but its report did not reach the full ${hc} in time.${rule}`;
    if (/passed/.test(f.outcome || '')) return `${who} passed it on ${on}, but it did not reach its next step in time.${rule}`;
    // Taken off a decision-making agenda: the Capitol's line says so (HB2114, WAM, 4/9).
    if (/deleted the measure from decision making/i.test(b.last_action || '')) return `${who} was due to decide on it on ${on}, then took it off the list.${rule}`;
    if (f.outcome === 'deferred') return `${who} heard it on ${on} and put it on hold instead of passing it.${rule}`;
    return `${who} heard it on ${on} but did not vote to pass it.${rule}`;
  }
  return rule.trim();
}
// The lists' "What happened" column: the same facts in a few words ("No hearing in Senate Health by Mar 30").
export function whyStoppedShort(b) {
  const f = stopFacts(b), by = f.when ? ` by ${f.when}` : '';
  if (f.kind === 'vetoed') return 'Vetoed by the Governor';
  if (f.kind === 'failed') return 'Did not pass a vote';
  if (f.kind === 'held') return f.cmte ? `Put on hold by ${shortCmte(f.cmte)}` : 'Put on hold by a committee';
  if (f.kind === 'floor') return `No vote of the full ${f.ch}${by}`;
  if (f.kind === 'final') return `House and Senate did not agree${by}`;
  if (f.kind === 'noHearing') return f.cmte ? (f.prior && outcomeOf(f.prior)?.outcome === 'deferred' ? `Put on hold by ${shortCmte(f.cmte)} in ${f.prior.scheduled_at.slice(0, 4)}`
    : f.cancelled ? `Hearing cancelled in ${shortCmte(f.cmte)}` : `No hearing in ${shortCmte(f.cmte)}${by}`) : f.res ? 'Not heard before the session ended' : `No hearing${by}`;
  if (f.kind === 'heard' && /recommendation was not adopted/i.test(b.last_action || '')) return `Committee report turned down by the full ${CHAMBER_NAME[S.committees[codesOf(f.heard.committee)[0]]?.chamber] || 'chamber'}`;
  if (f.kind === 'heard' && /deleted the measure from decision making/i.test(b.last_action || '')) return `Taken off the decision list in ${shortCmte(f.heard.committee)}`;
  if (f.kind === 'heard') return f.outcome === 'deferred' ? `Put on hold by ${shortCmte(f.heard.committee)}` : /passed/.test(f.outcome || '') ? `Passed ${shortCmte(f.heard.committee)}, then stalled` : `Heard, not passed, in ${shortCmte(f.heard.committee)}`;
  return f.res ? 'Not adopted' : 'Did not advance';
}
// Why a bill stopped, in words: "Put on hold by the Senate Education Committee, which usually stops it this year."
export function whyStopped(b) {
  if (b.stage === 'vetoed') return 'Vetoed by the Governor.';
  // The committee it stopped in, and only a hearing there: a hearing in another committee, or a year earlier, is not why it
  // stopped (HB1278 stopped in WLA in 2026, never heard there; it was heard by WTL in 2025; R-077).
  const at = stoppedAt(b), same = h => !at || codesOf(h.committee).some(k => codesOf(at.committee).includes(k));
  const heard = hearingsOf(b).filter(h => h.status !== 'cancelled' && new Date(h.scheduled_at) < Date.now() && same(h)).pop();
  // A failed floor vote: the sync marks it (status_text) and records where it stood (died_at_stage), since a later line,
  // such as a recommittal, can follow the vote (HB1516; R-072's every-bill test).
  if (b.status_text === 'Failed a vote' || /failed to pass/i.test(b.last_action || '')) {
    const o = b.chamber || (String(b.bill_number || '').startsWith('S') ? 'S' : 'H'), d = b.died_at_stage || '';
    return /^(conference|second_crossover)$/.test(d) ? 'It did not pass its final vote, so it can’t pass this year.'
      : /^second/.test(d) ? `It did not pass the vote of the full ${CHAMBER_NAME[o === 'H' ? 'S' : 'H']}, so it can’t pass this year.`
      : /^first/.test(d) ? `It did not pass the vote of the full ${CHAMBER_NAME[o]}, so it can’t pass this year.` : 'Did not pass a vote.';
  }
  if (HELD_RE.test(b.last_action || '')) return 'Put on hold by a committee, which usually means it won’t pass this year.';
  const m = /^(.*?)\s+(\d+\/\d+\/\d+)$/.exec(b.died_deadline || '');
  if (isResolution(b)) return 'It was not adopted this session.';
  // Through its committees, then no floor vote before Crossover (R-072: the backend now says so instead of Decking).
  const fl = /^(first|second)_floor$/.exec(b.died_at_stage || '');
  if (fl) { const o = b.chamber || (String(b.bill_number || '').startsWith('S') ? 'S' : 'H'), ch = CHAMBER_NAME[fl[1] === 'first' ? o : (o === 'H' ? 'S' : 'H')];
    return `It got through its ${ch} committees, but the full ${ch} did not vote on it before the deadline${m ? ` on ${shortDate(m[2])}` : ''}, so it can’t pass this year.`; }
  // Stopped after both chambers passed it. Its last hearing was weeks earlier, so "heard on ... but did not move
  // forward" read as if a committee had stopped it (HB 1782, which died in conference; Nate 9/26).
  if (/^(second_crossover|conference)$/.test(b.died_at_stage || '')) return `It passed the House and the Senate, but the two did not agree on one final version before the deadline${m ? ` on ${shortDate(m[2])}` : ''}, so it can’t pass this year.`;
  // A bill that passed its last hearing and then stalled was told it "did not move forward" there, right above that
  // hearing marked Passed (HB 1779, R-067). Say what the committee did when we know it, and nothing false when we don't.
  if ((m || b.died_deadline) && heard) {
    const o = outcomeOf(heard), who = S.committees[codesOf(heard.committee)[0]] ? `The ${cmteLabel(heard.committee)}` : 'A committee';
    if (o && /passed/.test(o.outcome || '')) return `${who} passed it on ${dateLong(heard.scheduled_at)}, but the next step did not happen before the deadline${m ? ` on ${shortDate(m[2])}` : ''}, so it can’t pass this year.`;
    return `It was heard on ${dateLong(heard.scheduled_at)}, but it did not get through every step before the deadline${m ? ` on ${shortDate(m[2])}` : ''}, so it can’t pass this year.`;
  }
  if (m || b.died_deadline) return `It did not get a hearing${at ? ` in the ${cmteLabel(at.committee)}` : ''} before the deadline${m ? ` on ${shortDate(m[2])}` : ''}, so it can’t pass this year.`;
  return 'It did not advance this year.';
}
// A Capitol deadline date, "4/29/26", as "Apr 29".
const shortDate = mdy => new Date(mdy.replace(/(\d+)\/(\d+)\/(\d+)/, (x, mo, d, y) => `20${y.slice(-2)}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`) + 'T12:00:00-10:00').toLocaleDateString('en-US', { timeZone: HST, month: 'short', day: 'numeric' });
export const OUTCOME_PLAIN = { passed: 'Passed', passed_amended: 'Passed with changes', deferred: 'Put on hold (usually means it won’t pass this year)', recommitted: 'Sent back to the committee' };
// The chair's real address when the directory has it, else the Capitol pattern.
export function chairContacts(code) {
  return cmtesOf(code).filter(c => c.chair).map(c => {
    const m = (S.committeeMembers || []).find(x => x.committee === c.code && x.role === 'chair');
    const last = chairLast(c), leg = (m && legById(m.legislator_id)) || (S.legislators || []).find(l => l.chamber === c.chamber && (l.sort_name || '').split(',')[0].toLowerCase() === last.toLowerCase());
    return { name: c.chair, last: leg ? (leg.sort_name || '').split(',')[0] : last, title: c.chamber === 'S' ? 'Sen.' : 'Rep.', email: leg?.email || chairEmail(c), phone: leg?.phone || '', committee: c.name, code: c.code, leg };
  });
}
// Actions a person can take now: open testimony windows first (soonest deadline), then hearings whose written
// deadline passed but which have not been held yet ("late": emailing the chair is the quick way to be heard).
export function openActions(bills, hearings) {
  const now = Date.now();
  return hearings.filter(h => h.status === 'scheduled' && new Date(h.scheduled_at) > now)
    .map(h => ({ h, b: bills.find(b => b.id === h.bill_id) }))
    .filter(x => x.b && posInfo(x.b) && alive(x.b))
    .map(x => ({ ...x, late: !!(x.h.testimony_deadline && new Date(x.h.testimony_deadline) < now) }))
    .sort((x, y) => x.late - y.late || (x.h.testimony_deadline || x.h.scheduled_at).localeCompare(y.h.testimony_deadline || y.h.scheduled_at));
}
// Every action counts: any kind done on a hearing means the card is done for "Do this now".
export const actedOn = (b, h) => KINDS.some(k => S.done.has(doneKey(b.id, h?.id, k)));
export const didKind = (b, h, k) => S.done.has(doneKey(b.id, h?.id, k));
// The bill page's tour (pub/tour.js) starts by itself only for someone nobody has shown around yet (X10-4, R-180): not
// after a finished first visit (its story is told on one of their own bills), not for anyone whose first visit began on
// a shared bill, and not on a bill opened from Home to act (S.toAct, "See how to help"), where it covered the very button
// they came for. They get one quiet line on the bill page instead (bill.js tourOffer), until they have seen the tips.
export const billTourHeld = () => { const w = wiz(); return !!(w.via || (w.done && !w.skipped) || S.toAct); };
export const billTourSeen = () => { if (S.billTourDone) return true; try { return !!localStorage.getItem('hiphi_tour_bill'); } catch { return false; } };
// A testimony letter saved in the walkthrough for this hearing and not sent yet (helper.js, hiphi_me.drafts; R-068).
export const testimonyDraft = h => { try { return !!h && !!JSON.parse(localStorage.getItem('hiphi_me') || '{}')?.drafts?.[h.id]; } catch { return false; } };
// Settled: the person has taken a real step for this hearing - testimony, or an email to the chair.
// A two-second Share alone settles it only once testimony can no longer be sent (late, or HIPHI's letter is not theirs
// to send). It used to count as done, which folded the card into "Done this week" with testimony still open (R-005,
// Nate 9/26). Going in person follows the same rule since R-142 (10/5): "I plan to go" put the card away and Home said
// "You're all caught up" with testimony due that day, and testimony is how they get to speak there; it settles once
// testimony is closed. actedOn still says "they did something" (the card's Mahalo line); settledOn decides what folds.
export const settledOn = (b, h) => ['testimony', 'email'].some(k => didKind(b, h, k))
  || (didKind(b, h, 'attend') && !!dueInfo(h)?.late)
  || (didKind(b, h, 'share') && (!!dueInfo(h)?.late || agrees(b) === false || !posInfo(b)));
// Still going: a hearing they plan to go to keeps its directions until the end of its day in Hawaiʻi, since hearings run
// late and someone in the lobby at 3:05 still needs the room (R-142, the review); after that it is "You went".
export const goingOn = h => !!h && hstDay(Date.now()) <= hstDay(h.scheduled_at);
// A bill by number ("HB1563"), loaded with its hearings and outcomes even when nobody follows it (shared links, search).
// year: the session a link named (#/bill/2026/HB2121). Without one, the current session's bill of that number, else the
// newest (R-110): a number on hand only as an earlier session's bill may have a newer one in the database, so ask.
export async function ensureBill(num, year) {
  const n = String(num || '').replace(/\s/g, '').toUpperCase(), y = +year || 0;
  const have = [...S.bills, ...Object.values(S.extra), ...(S.results || []), ...(DEMO ? [...D.bills, ...D.index] : [])].filter(x => x.bill_number === n);
  let b = pickBill(have, y);
  // The Supabase client hands back a dropped connection as an error value, not a throw. Throw it, so a caller can tell
  // "no such bill" (null) from "could not ask" (an error) and never blames the person for a weak signal.
  if (!DEMO && (!b || (!y && +b.session_year !== sessionInfo().yr))) {
    let q = S.supa.from('public_all_bills').select('*').eq('bill_number', n);
    q = y ? q.eq('session_year', y) : q.order('session_year', { ascending: false });
    const { data, error } = await q.limit(1); if (error) throw error;
    if (data?.[0] && (!b || +data[0].session_year > +b.session_year)) b = data[0];
  }
  if (!b) return null;
  if (!S.bills.some(x => x.id === b.id)) S.extra[b.id] = b;
  if (DEMO && !S.bills.some(x => x.id === b.id) && !S.xh[b.id]) { S.xh[b.id] = D.hearings.filter(h => h.bill_id === b.id); D.outcomes.filter(o => o.bill_id === b.id).forEach(o => { S.outcomes[o.hearing_id] = o; }); }
  if (!DEMO && !S.bills.some(x => x.id === b.id) && !S.xh[b.id]) {
    const [h, o] = await Promise.all([S.supa.from('public_all_hearings').select('*').eq('bill_id', b.id), S.supa.from('public_hearing_outcomes').select('*').eq('bill_id', b.id)]);
    if (h.error || o.error) throw (h.error || o.error);   // a bill drawn with no hearings because the fetch failed would read as "no hearing yet"
    S.xh[b.id] = h.data || []; (o.data || []).forEach(x => { S.outcomes[x.hearing_id] = x; });
  }
  // The bill page's conference and Governor steps read the bill's recent Capitol actions (who chairs the conference, a
  // veto notice); a bill opened without being followed has none loaded yet (R-056). Decoration: a failure leaves the
  // step with its fallback (your own legislators), never an error.
  if (!S.bills.some(x => x.id === b.id) && !(S.xa ??= {})[b.id] && ['conference', 'governor'].includes(b.stage)) {
    if (DEMO) S.xa[b.id] = (D.activity || []).filter(a => a.bill_id === b.id);
    else { const { data, error } = await S.supa.from('public_activity').select('*').eq('bill_id', b.id).order('occurred_at', { ascending: false }).limit(100); if (!error) S.xa[b.id] = data || []; }
  }
  return b;
}
// Where a person is in the guided start: a first visit is someone who has not finished or skipped it, follows nothing
// and has done nothing. Someone who sent the quick email from a link, then said "Don't follow it", came back to the
// start as if new (R-067): an action they marked counts as having been here.
const siteRoot = () => `${location.origin}${location.pathname.replace(/[^/]*$/, '')}`;
// The address to share a bill at, for one ask (R-169: the friend's card leads with the ask and the link opens it):
// 'testify' | 'email' | 'attend' | 'ask' | 'floor' | 'conference' | 'governor' | 'follow', or '' for the bill's ask of the
// moment. A bill HIPHI has a stance on has a page per ask (b/HB2121-testify, tools/share_pages.mjs); since R-205 (C5) any
// other bill has its hearing asks' pages while a hearing is ahead (testify, email: the committee email, attend: going in
// person); anything else, and the sandbox, share the tracker's own address, opening the same thing (#/bill/HB2121/testify;
// following opens the bill's issue).
export const SHARE_ASKS = ['testify', 'email', 'attend', 'ask', 'floor', 'conference', 'governor', 'follow'];
export const HEARING_ASKS = ['testify', 'email', 'attend'];
// The practice copy (in session) has share pages of its own, b/demo/ and i/demo/, built from its data at its day in March,
// so a share made there previews the real card for the ask (Nate 10/5: "the share card is not specific about the action").
const DEMO_PAGES = DEMO && !SEASON_OFF;
// The year is in every shared link (C5-2, R-199): b/2026/HB2121-testify, never b/HB2121-testify, even for this session's
// bills, so a 2027 bill that reuses the number never takes over a link shared now (R-110's promise, for shares too). The
// share pages job builds every ask's page under its year and never deletes one. The practice copy's pages (b/demo/) are
// one frozen session and keep the short form.
const yearRef = b => `${b.session_year ? `${b.session_year}/` : ''}${String(b.bill_number).replace(/\s/g, '')}`;
export const billShareUrl = (b, ask = '') => {
  const a = SHARE_ASKS.includes(ask) ? ask : '';
  if ((b.hiphi_position || (!DEMO && HEARING_ASKS.includes(a))) && (!DEMO || DEMO_PAGES)) return `${siteRoot()}b/${DEMO ? `demo/${billRef(b)}` : yearRef(b)}${a ? `-${a}` : ''}`;
  const i = a === 'follow' ? issuesOf(b)[0] : null;
  return `${location.origin}${location.pathname}${DEMO ? location.search : ''}${i ? `#/issue/${i.slug}` : `#/bill/${yearRef(b)}` + (a && a !== 'follow' ? `/${a}` : '')}`;
};
export const issueShareUrl = i => !DEMO || DEMO_PAGES ? `${siteRoot()}i/${DEMO ? 'demo/' : ''}${i.slug}` : `${location.origin}${location.pathname}${location.search}#/issue/${i.slug}`;
// "Wed, Mar 18 at 9:30 AM": a deadline in a text to a friend (R-113).
export const dueWords = iso => `${fmtDate(iso, { weekday: 'short', month: 'short', day: 'numeric' })} at ${timeWord(iso)}`;
// Of several bills with one number (one per session), the one a link means: the named year, else the current
// session's, else the newest.
export const pickBill = (cands, year) => { const c = (cands || []).filter(Boolean); if (!c.length) return null;
  if (+year) return c.find(x => +x.session_year === +year) || null;
  return c.find(x => +x.session_year === sessionInfo().yr) || c.slice().sort((a, b) => (+b.session_year || 0) - (+a.session_year || 0))[0]; };
export const askMark = (b, code) => `${b.id}|${code}|ask`;
export const askedChair = (b, code) => S.done.has(askMark(b, code))
  || (S.done.has(doneKey(b.id, '', 'email')) && ![...S.done].some(k => k.startsWith(b.id + '|') && k.endsWith('|ask')));
// Bills waiting for a hearing, soonest deadline first: on Home these become a lighter "ask the chair" card, so a
// follower is never told "all caught up" while a bill of theirs is running out of time (assessment, 9/19).
export function waitingBills(bills) {
  return bills.filter(b => alive(b) && posInfo(b)).map(b => ({ b, st: stopOf(b) }))
    .filter(x => x.st.phase === 'committee' && x.st.hearingState === 'none' && x.st.committee && x.st.deadline && !x.st.deadline.missed)
    .sort((x, y) => x.st.deadline.days - y.st.deadline.days);
}
// The email step (Nate, 9/19; bundled into one "keep me updated" ask per HANDOFF 3.5, 9/20): asking for an email
// is part of the flow, and saying yes IS the consent for both hearing alerts and HIPHI's own advocacy alerts -
// one opt-in, not two. The choices wait in this browser until the link is opened (loadUser applies them), exactly
// like the sign-in page.
// Both choices are off unless the ask names them (C-4): the hearing-alert asks on Home and in the testimony walkthrough
// pass only hearing_alerts, and until 10/1 the default here quietly turned HIPHI's action alerts on for them too.
// source and version say where and under which words the consent was given (D1-5, backend 157): the database records them with its own
// clock. version is a key of email_consent_words ('e1' = the alerts box's words); a path with no registered words sends none.
export async function sendEmailLink(email, { hearing_alerts = false, action_alerts = false, source = '', version = '' } = {}) {
  // The sandbox sends nothing, but it remembers the email was given, as the live page does: otherwise Home asked a tester
  // for their email again a minute after they gave it (R-098). Its storage is the sandbox's own (every hiphi_ name is
  // hiphi_*_demo there, see the top of this file), so no consent reaches the live page in this browser.
  if (DEMO) { try { sessionStorage.setItem('hiphi_link_sent', email); localStorage.setItem(CONSENT_KEY, JSON.stringify({ hearing_alerts, action_alerts, source, version })); } catch { /* ignore */ } return { demo: true }; }
  try { localStorage.setItem(CONSENT_KEY, JSON.stringify({ hearing_alerts, action_alerts, source, version })); } catch { /* ignore */ }
  const sb = await supa();
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
  if (error) throw error;
  try { sessionStorage.setItem('hiphi_link_sent', email); } catch { /* ignore */ }
  abEvent('email');   // gave an email: the email-ask test's measure (R-135)
  return { sent: true };
}
export const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim());

