// Partners on the tracker (R-328, Nate's yes 22 Oct 2026; backend migration 184): the data layer. Outside advocacy groups
// sign in on the PUBLIC tracker by email link, add bills and write their group's words, and HIPHI (Nate or Jess) approves
// every word before the public sees it. This module is the one place the public page talks to the partner tables:
//   * the signed-in partner's own group (my_partner) and the calls that change it (partner_save_bill, partner_bill_change,
//     partner_save_issue, partner_issue_change, partner_invite, partner_agree_terms), each refusing in plain English;
//   * the public views every visitor may read (public_partner_bills, public_partner_issues, public_partners), which a later
//     batch uses to show partner words on bill pages, lists and the testimony walkthrough;
//   * the practice copy's branch: with ?demo=1 nothing here reaches the database (rule 3, the sandbox's own rule). The
//     sample group below stands in for my_partner, and the RPCs are played here by the same rules the database keeps, so a
//     practice run meets the same refusals. ?demo=1&partner=1 is the switch that shows the partner corner with no real
//     sign-in (there was no "signed in" switch in the practice copy): partner=member, new (terms not agreed yet), waiting
//     and paused show the other states.
// Rule 1: partner words live in their own tables and never touch HIPHI's columns on bills; nothing here writes a bill.
import { S, D, DEMO, app, esc, icon, supa, friendly, hstDay } from './core.js';

// ---------------- words shared by the screens ----------------
export const SITE = 'https://natehiphi.github.io/hiphi-tracker-app/track.html';
// The group's link (the ?via= links staff already make): opens the tracker with the group's bills first (a later batch).
export const groupLink = slug => `${SITE}?via=${encodeURIComponent(slug)}`;
// position_t without 'monitor' (a partner always says something). 'neutral' reads "Comments" on the public site.
export const STRENGTHS = { support: ['strongly_support', 'support', 'support_amend'], oppose: ['strongly_oppose', 'oppose'], neutral: ['neutral'] };
export const SIDE_WORDS = { strongly_support: 'Strongly support', support: 'Support', support_amend: 'Support with amendments',
  strongly_oppose: 'Strongly oppose', oppose: 'Oppose', neutral: 'Comments' };
export const FAMILY_WORDS = { support: 'Support', oppose: 'Oppose', neutral: 'Comments' };
// The side a position belongs to, as the database's partner_side_family: any support (with amendments too) is support,
// any oppose is oppose; Monitor and Neutral are no side, so they bind nobody.
export const sideFamily = p => /support/.test(p || '') ? 'support' : /oppose/.test(p || '') ? 'oppose' : null;
// The family a partner's own side is in, Comments included (for the editor's first choice).
export const familyOf = p => sideFamily(p) || (p === 'neutral' ? 'neutral' : '');
export const STANCE_WORDS = { support: 'Support', oppose: 'Oppose', mixed: 'Mixed' };   // a group's own issue
export const LIMITS = { nickname: 60, summary: 600, point: 200, points: 5, ask: 300, draft_note: 600, issues: 5, issue_name: 60, issue_description: 240 };
export const today = () => hstDay(Date.now());
export const plusDays = (day, n) => { const d = new Date(day + 'T12:00:00-10:00'); d.setDate(d.getDate() + n); return hstDay(d); };

// A refusal from the database is already a plain sentence (migration 184 raises them for people to read: "Agree to the
// partner terms first", "HIPHI supports this bill, so a partner can only support it"); it gets its full stop and is shown
// as it comes (B-8). Anything else (a dropped connection, a check the screen should have caught) is the house sentence.
export function plainErr(e) {
  const m = String(e?.message || e || '').trim();
  const isRaise = e?.code === 'P0001' || e?.sandbox;
  if (isRaise && m && !/(violates|constraint|relation|column|syntax|uuid|jwt|function )/i.test(m)) return /[.!?]$/.test(m) ? m : m + '.';
  return friendly(e);
}
const refuse = m => Object.assign(new Error(m), { sandbox: true });

// ---------------- the practice copy's sample group ----------------
// "Keiki Smiles Alliance" (the plan page's made-up partner), on three of the practice copy's real bills: HB 1671 (HIPHI
// strongly supports: live words with an edit waiting), HB 1431 (HIPHI only monitors, so no side: waiting for HIPHI) and
// HB 1779 (HIPHI strongly supports: HIPHI asked for a change), and one issue of its own. Names and addresses are made up
// (example.org); the dates follow the practice copy's clock, so "today" is its Monday.
export const SANDBOX_MODE = DEMO ? (new URLSearchParams(location.search).get('partner') || '') : '';
const ON = !!SANDBOX_MODE && SANDBOX_MODE !== '0';
// This visit's ?via= slug (a partner's link). The practice copy's public screens show the sample group's approved words with
// ?partner (any value but 0) or ?via=keiki-smiles; without either nothing changes, so other tests' recorded screens hold.
const VIA = (() => { try { return (new URLSearchParams(location.search).get('via') || '').toLowerCase(); } catch { return ''; } })();
const SB_PUBLIC = ON || (DEMO && VIA === 'keiki-smiles');
const KEY = 'hiphi_partner_sandbox';   // the sandbox's own copy (the storage shim adds _demo); one tab, so a new tab starts fresh
const BILLS = { HB1671: '8e8609a7-0259-424e-a50c-235e15a4543c', HB1431: '1b935416-9fe1-4c22-957b-cc0ddb3d9705', HB1779: '3c6cf04d-1409-4a9b-baef-911952f124e1', HB1349: '7d6caa6e-9e33-4cda-a45b-43b94e2c6dc4' };
const ISSUES = { fillings: '0ab445fa-fa83-46ef-8ed8-5f213a2ee216', meals: '05e0d6a9-4ea7-456c-b219-e3632ade358b' };
const OWN_ISSUE = 'b7f1c2a0-0000-4000-8000-00000000a001';
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'x' + Math.random().toString(16).slice(2));
function sample() {
  const day = today(), at = (n, hm) => new Date(`${plusDays(day, -n)}T${hm}:00-10:00`).toISOString();
  const words = (o) => ({ id: uid(), state: 'draft', side: null, nickname: null, summary: null, points: [], ask: null, ask_until: null,
    draft_version: null, draft_note: null, issue_ids: [], written_at: null, sent_at: null, reviewed_at: null, review_note: null, ...o });
  const fillingsLive = words({ state: 'live', side: 'strongly_support', nickname: 'Hygienists can fill keiki cavities',
    summary: 'Lets dental hygienists place temporary fillings at schools and community clinics, with a dentist in charge. More keiki get care before a small cavity turns into pain.',
    points: ['Tooth decay is one of the most common childhood illnesses in Hawaiʻi.', 'A temporary filling stops the pain until the child can see a dentist.', 'Hygienists already work in the places families go.'],
    ask: 'Send testimony to the Senate Health committee before its hearing.', ask_until: plusDays(day, 15), draft_version: 'HD2',
    draft_note: 'HD2 keeps a dentist in charge of the hygienist. We support it as it is.', issue_ids: [ISSUES.fillings, OWN_ISSUE],
    written_at: at(8, '10:20'), sent_at: at(8, '10:24'), reviewed_at: at(6, '14:05') });
  return { groups: [{
    slug: 'keiki-smiles', name: 'Keiki Smiles Alliance', website: 'https://example.org', about: 'Healthy teeth for every child in Hawaiʻi.',
    welcome: 'Keiki Smiles Alliance asks you to speak up for healthy keiki teeth.',
    status: SANDBOX_MODE === 'waiting' ? 'waiting' : SANDBOX_MODE === 'paused' ? 'paused' : 'active',
    me: SANDBOX_MODE === 'member' ? { id: 'pp-2', name: 'Malia P.', role: 'member', terms_at: at(4, '09:00') }
      : { id: 'pp-1', name: 'Leilani K.', role: 'lead', terms_at: SANDBOX_MODE === 'new' ? null : at(9, '16:30') },
    people: [
      { id: 'pp-1', name: 'Leilani K.', role: 'lead', joined: true, email: 'leilani@example.org' },
      { id: 'pp-2', name: 'Malia P.', role: 'member', joined: true, email: 'malia@example.org' },
      { id: 'pp-3', name: 'Kawika A.', role: 'member', joined: false, email: 'kawika@example.org' }],
    bills: [
      { id: 'pb-1', bill_id: BILLS.HB1671, bill_number: 'HB1671', session_year: 2026, hidden: false, removed: false, side_clash: false, hiphi_side: 'support',
        live: fillingsLive,
        open: { ...fillingsLive, id: uid(), state: 'sent', reviewed_at: null, written_at: at(0, '08:05'), sent_at: at(0, '08:12'),
          summary: 'Lets dental hygienists place temporary fillings at schools and community clinics, with a dentist in charge. More keiki get care before a small cavity turns into an emergency.' } },
      { id: 'pb-2', bill_id: BILLS.HB1431, bill_number: 'HB1431', session_year: 2026, hidden: false, removed: false, side_clash: false, hiphi_side: null,
        live: null,
        open: words({ state: 'sent', side: 'support', nickname: 'A task force for keiki teeth',
          summary: 'Starts a state task force on oral health. It would find ways to help more people in Hawaiʻi see a dentist.',
          points: ['One in three keiki on Medicaid saw a dentist last year.', 'A task force puts dentists, schools and families at one table.', 'It costs little and reports back in one year.'],
          written_at: at(0, '08:31'), sent_at: at(0, '08:40') }) },
      { id: 'pb-3', bill_id: BILLS.HB1779, bill_number: 'HB1779', session_year: 2026, hidden: false, removed: false, side_clash: false, hiphi_side: 'support',
        live: null,
        open: words({ state: 'changes', side: 'support', nickname: 'Free school meals, healthy teeth',
          summary: 'Gives free school meals to every public and charter school student. Healthy meals at school mean fewer sugary snacks and fewer cavities.',
          points: ['About 40% of keiki eat a sugary snack instead of lunch when lunch costs money.', 'Free meals for all take the shame out of the lunch line.', 'Healthy food at school protects teeth as well as grades.'],
          ask: 'Ask your representative to support free school meals.', ask_until: plusDays(day, 30), issue_ids: [ISSUES.meals],
          written_at: at(2, '15:10'), sent_at: at(2, '15:12'), reviewed_at: at(1, '10:30'), review_note: 'Please say where the 40% figure comes from.' }) },
      // HB 1349, a bill HIPHI only monitors (no side): live words, so the public screens show a bill only a partner works on.
      { id: 'pb-4', bill_id: BILLS.HB1349, bill_number: 'HB1349', session_year: 2026, hidden: false, removed: false, side_clash: false, hiphi_side: null,
        live: words({ state: 'live', side: 'support', nickname: 'Health coverage for every keiki',
          summary: 'Pays for Medicaid and CHIP coverage for pregnant people and children with low incomes, whatever their immigration status. Covered keiki get dental checkups too.',
          points: ['A child with coverage sees a dentist before a cavity becomes an emergency.', 'Care in pregnancy means healthier babies and fewer costly hospital stays.', 'Families should not have to choose between rent and a checkup.'],
          ask: 'Ask your representative to move this bill forward.', ask_until: plusDays(day, 20), issue_ids: [OWN_ISSUE],
          written_at: at(12, '09:15'), sent_at: at(12, '09:20'), reviewed_at: at(11, '13:00') }),
        open: null }],
    issues: [{ id: OWN_ISSUE, slug: 'healthy-keiki-teeth', hidden: false, removed: false,
      live: { id: uid(), state: 'live', name: 'Healthy keiki teeth', description: 'Dental care every child in Hawaiʻi can reach: at school, at checkups and close to home.', stance: 'support',
        written_at: at(9, '17:00'), sent_at: at(9, '17:02'), reviewed_at: at(7, '11:40'), review_note: null }, open: null }],
    visits: 140 }] };
}
let SB = null;
function sb() {
  if (SB) return SB;
  try { const kept = JSON.parse(sessionStorage.getItem(KEY) || 'null'); if (kept && kept.mode === SANDBOX_MODE && kept.day === today()) SB = kept.data; } catch { /* storage blocked */ }
  return (SB ??= sample());
}
const keepSB = () => { try { sessionStorage.setItem(KEY, JSON.stringify({ mode: SANDBOX_MODE, day: today(), data: SB })); } catch { /* storage blocked: kept for this page only */ } };
const clone = x => JSON.parse(JSON.stringify(x));

// The practice copy's database: the same checks, in the same words, as migration 184's functions.
function sbMe(slug, write = true) {
  const g = sb().groups.find(x => x.slug === slug);
  if (!g) throw refuse('You are not on this group');
  if (write && g.status !== 'active') throw refuse(g.status === 'paused' ? 'HIPHI has paused your group for now' : 'Your group is waiting for HIPHI to approve it');
  if (write && !g.me.terms_at) throw refuse('Agree to the partner terms first');
  return g;
}
const sbBill = id => [...D.bills, ...D.index].find(b => b.id === id) || null;
const SANDBOX_RPC = {
  my_partner: () => clone({ groups: sb().groups.map(g => ({ ...g, people: g.people.filter(p => !p.removed).map(p => ({ ...p, email: g.me.role === 'lead' || p.id === g.me.id ? p.email : null })) })) }),
  partner_agree_terms: ({ p_slug }) => { const g = sbMe(p_slug, false); g.me.terms_at ??= new Date().toISOString(); keepSB(); return null; },
  partner_save_bill: ({ p }) => {
    const g = sbMe(p.slug), b = sbBill(p.bill_id), day = today();
    if (!b) throw refuse('That bill is not on the tracker');
    const ask = (p.ask || '').trim() || null; let until = p.ask_until || null;
    if (ask && !until) throw refuse('An ask needs an end date');
    if (!ask) until = null;
    if (until && (until < day || until > plusDays(day, 400))) throw refuse('The end date is from today to about a year ahead');
    if (!p.side) throw refuse('Pick your side');
    const hs = sideFamily(b.hiphi_position);
    if (hs && sideFamily(p.side) !== hs) throw refuse(`HIPHI ${hs === 'support' ? 'supports' : 'opposes'} this bill, so a partner can only ${hs} it`);
    let pb = g.bills.find(x => x.bill_id === p.bill_id);
    if (!pb) { pb = { id: uid(), bill_id: b.id, bill_number: b.bill_number, session_year: b.session_year || 2026, hidden: false, removed: false, side_clash: false, hiphi_side: hs, live: null, open: null }; g.bills.push(pb); }
    pb.removed = false;
    const ownIssues = new Set(g.issues.filter(i => !i.removed).map(i => i.id)), hiphiIssues = new Set((S.issues || []).map(i => i.id));
    const w = { ...(pb.open || {}), id: pb.open?.id || uid(), state: 'draft', side: p.side, nickname: (p.nickname || '').trim() || null, summary: (p.summary || '').trim() || null,
      points: (p.points || []).map(x => String(x).trim()).filter(Boolean), ask, ask_until: until, draft_version: (p.draft_version || '').trim().toUpperCase() || null,
      draft_note: (p.draft_note || '').trim() || null, issue_ids: [...new Set(p.issue_ids || [])].filter(id => ownIssues.has(id) || hiphiIssues.has(id)),
      written_at: new Date().toISOString(), sent_at: null, reviewed_at: null, review_note: null };
    if (p.send) { if (!w.summary) throw refuse('Write the plain summary before sending'); w.state = 'sent'; w.sent_at = new Date().toISOString(); }
    pb.open = w; keepSB(); return clone(w);
  },
  partner_bill_change: ({ p }) => {
    const g = sbMe(p.slug), pb = g.bills.find(x => x.bill_id === p.bill_id), day = today();
    if (!pb) throw refuse('That bill is not on your list');
    if (p.do === 'hide') pb.hidden = true; else if (p.do === 'show') pb.hidden = false;
    else if (p.do === 'remove') pb.removed = true; else if (p.do === 'restore') pb.removed = false;
    else if (p.do === 'ask_until') {
      const until = p.ask_until || null;
      if (until && (until < day || until > plusDays(day, 400))) throw refuse('The end date is from today to about a year ahead');
      const ws = [pb.live, pb.open].filter(w => w && w.ask);
      if (!ws.length) throw refuse('There is no ask on this bill');
      for (const w of ws) w.ask_until = until || plusDays(day, -1);
    } else throw refuse('Unknown change');
    keepSB(); return { ok: true };
  },
  partner_save_issue: ({ p }) => {
    const g = sbMe(p.slug); let pi;
    if (p.issue_id) { pi = g.issues.find(i => i.id === p.issue_id); if (!pi) throw refuse('That issue is not your group’s'); pi.removed = false; }
    else {
      const base = (p.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[ʻ']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
      if (!base) throw refuse('Name the issue');
      let n = 1; while (g.issues.some(i => i.slug === (n === 1 ? base : `${base}-${n}`))) n++;
      pi = { id: uid(), slug: n === 1 ? base : `${base}-${n}`, hidden: false, removed: false, live: null, open: null }; g.issues.push(pi);
    }
    const w = { ...(pi.open || {}), id: pi.open?.id || uid(), state: 'draft', name: (p.name || '').trim(), description: (p.description || '').trim() || null, stance: p.stance || null,
      written_at: new Date().toISOString(), sent_at: null, reviewed_at: null, review_note: null };
    if (p.send) { w.state = 'sent'; w.sent_at = new Date().toISOString(); }
    pi.open = w; keepSB(); return clone({ issue_id: pi.id, slug: pi.slug, words: w });
  },
  partner_issue_change: ({ p }) => {
    const g = sbMe(p.slug), pi = g.issues.find(i => i.id === p.issue_id);
    if (!pi) throw refuse('That issue is not your group’s');
    if (p.do === 'hide') pi.hidden = true; else if (p.do === 'show') pi.hidden = false;
    else if (p.do === 'remove') pi.removed = true; else if (p.do === 'restore') pi.removed = false; else throw refuse('Unknown change');
    keepSB(); return { ok: true };
  },
  partner_invite: ({ p }) => {
    const g = sbMe(p.slug);
    if (g.me.role !== 'lead') throw refuse('Only your group’s lead invites teammates');
    if (p.remove) { const r = g.people.find(x => x.id === p.remove && x.role === 'member' && !x.removed); if (!r) throw refuse('That teammate is not on your group'); r.removed = true; keepSB(); return { ok: true }; }
    const em = String(p.email || '').trim().toLowerCase();
    if (/@hiphi\.org$/.test(em)) throw refuse('That is a HIPHI team address');
    let r = g.people.find(x => x.email.toLowerCase() === em);
    if (r) { r.removed = false; r.name = (p.name || '').trim() || r.name; } else { r = { id: uid(), name: (p.name || '').trim() || null, role: 'member', joined: false, email: em }; g.people.push(r); }
    keepSB(); return clone({ id: r.id, email: r.email, name: r.name, role: r.role });
  },
};

// ---------------- the calls ----------------
async function rpc(name, args = {}) {
  if (DEMO) { await new Promise(r => setTimeout(r, 120)); return SANDBOX_RPC[name](args); }   // a moment, as the database takes one (B-7)
  const c = await supa(), { data, error } = await c.rpc(name, args);
  if (error) throw error;
  return data;
}
// Who may see the partner corner without asking the database: a signed-in person on the live page, or the practice copy's
// switch. Everyone else (signed out, or the practice copy without ?partner) has no group, and nothing is asked.
export const canAsk = () => DEMO ? ON : !!S.session;
let mineP = null, mine = null;
// The signed-in person's groups ({groups: [...]}), asked once per page load; fresh: true asks again (after a change).
export function myPartner({ fresh = false } = {}) {
  if (!canAsk()) return Promise.resolve({ groups: [] });
  if (fresh || !mineP) mineP = rpc('my_partner').then(d => (mine = { groups: (d && d.groups) || [] })).catch(e => { mineP = null; throw e; });
  return mineP;
}
export const myPartnerNow = () => mine;   // what the last answer was, or null while it is coming
export const forget = () => { mineP = null; mine = null; };
const changed = r => { mineP = null; forgetPublic(); return r; };   // every change is followed by a fresh my_partner (and public copy)
export const agreeTerms = slug => rpc('partner_agree_terms', { p_slug: slug }).then(changed);
export const saveBill = p => rpc('partner_save_bill', { p }).then(changed);
export const billChange = p => rpc('partner_bill_change', { p }).then(changed);
export const saveIssue = p => rpc('partner_save_issue', { p }).then(changed);
export const issueChange = p => rpc('partner_issue_change', { p }).then(changed);
export const invite = p => rpc('partner_invite', { p }).then(changed);

// ---------------- what the public sees (approved words only) ----------------
// For the next batches (the partner's name on bill rows, its points on the bill page and in the testimony walkthrough).
// The practice copy builds the same rows from the sample: live words of an active group, not hidden, removed or on the
// other side, the ask only until its end date.
function sandboxPublicBills() {
  const day = today(), out = [];
  for (const g of SB_PUBLIC ? sb().groups : []) {
    if (g.status !== 'active') continue;
    for (const pb of g.bills) {
      const w = pb.live; if (!w || pb.hidden || pb.removed || pb.side_clash) continue;
      const hs = sideFamily(sbBill(pb.bill_id)?.hiphi_position);
      if (hs && sideFamily(w.side) !== hs) continue;
      const askOn = w.ask_until && w.ask_until >= day;
      out.push({ id: pb.id, partner_slug: g.slug, partner_name: g.name, bill_id: pb.bill_id, bill_number: pb.bill_number, session_year: pb.session_year, side: w.side,
        nickname: w.nickname, summary: w.summary, points: w.points, ask: askOn ? w.ask : null, ask_until: askOn ? w.ask_until : null,
        draft_version: w.draft_version, draft_note: w.draft_note, issue_ids: w.issue_ids, approved_at: w.reviewed_at });
    }
  }
  return out;
}
// Approved partner words on these bills (or every one when no ids are given), from public_partner_bills.
export async function partnerBills({ billIds = null, slug = null } = {}) {
  if (DEMO) return sandboxPublicBills().filter(r => (!billIds || billIds.includes(r.bill_id)) && (!slug || r.partner_slug === slug));
  const c = await supa(); let q = c.from('public_partner_bills').select('*');
  if (billIds) q = q.in('bill_id', billIds);
  if (slug) q = q.eq('partner_slug', slug);
  const { data, error } = await q.limit(1000); if (error) throw error; return data || [];
}
// Approved issues of partner groups, from public_partner_issues.
export async function partnerIssues({ slug = null } = {}) {
  if (DEMO) {
    const pub = sandboxPublicBills();
    return (SB_PUBLIC ? sb().groups : []).filter(g => g.status === 'active' && (!slug || g.slug === slug)).flatMap(g => g.issues.filter(i => i.live && !i.hidden && !i.removed)
      .map(i => ({ id: i.id, partner_slug: g.slug, partner_name: g.name, slug: i.slug, name: i.live.name, description: i.live.description, stance: i.live.stance,
        approved_at: i.live.reviewed_at, bill_ids: pub.filter(r => r.partner_slug === g.slug && (r.issue_ids || []).includes(i.id)).map(r => r.bill_id) })));
  }
  const c = await supa(); let q = c.from('public_partner_issues').select('*'); if (slug) q = q.eq('partner_slug', slug);
  const { data, error } = await q; if (error) throw error; return data || [];
}
// The groups the public may name (public_partners: slug, welcome, name, website, about, writes).
export async function partnersPublic() {
  if (DEMO) return (SB_PUBLIC ? sb().groups : []).filter(g => g.status !== 'waiting').map(g => ({ slug: g.slug, welcome: g.welcome, name: g.name, website: g.website, about: g.about, writes: g.status === 'active' }));
  const c = await supa(), { data, error } = await c.from('public_partners').select('*'); if (error) throw error; return data || [];
}

// ---------------- partner words on the public screens (batch D) ----------------
// The bill page, Find, the issue pages, the rows and the testimony walkthrough all read one copy of what partners may say,
// asked once per page load (three small reads of public views) and only by a screen that shows it. A screen draws
// synchronously: pubNow() answers null the first time, starts the reads, and redraws the page when they arrive with
// anything to show, so the partner lines appear a moment after the screen; a failed read shows no partner words, never a
// broken page.
let PUB = null, PUBP = null, redrawAsked = false;
export function loadPublic() {
  if (PUBP) return PUBP;
  const soft = p => p.catch(e => { console.error(e); return []; });
  PUBP = Promise.all([soft(partnerBills()), soft(partnerIssues()), soft(partnersPublic())]).then(([rows, issues, partners]) => {
    const byBill = new Map();
    for (const r of rows) { if (!byBill.has(r.bill_id)) byBill.set(r.bill_id, []); byBill.get(r.bill_id).push(r); }
    S.pwNames = new Map(partners.map(p => [p.slug, p.name]));   // app.js placeName: a Back link names the partner's page
    return (PUB = { rows, issues, partners, byBill });
  });
  return PUBP;
}
export function pubNow() {
  if (PUB) return PUB;
  if (!redrawAsked) { redrawAsked = true; loadPublic().then(d => { if (d.rows.length || d.issues.length || d.partners.length) app.render(); }).catch(e => console.error(e)); }
  return null;
}
// After a partner's own change in the corner, the public copy is asked again on the next draw.
export const forgetPublic = () => { PUB = null; PUBP = null; redrawAsked = false; };
// This visit's partner (?via=<slug>) when it names a group that writes on the tracker; null otherwise (a link-only
// partner's ?via= keeps its welcome line on the first visit, as before).
export const viaSlug = () => VIA;
export function viaPartner() { const d = pubNow(); return (d && VIA && d.partners.find(p => p.slug === VIA && p.writes)) || null; }
export const partnerOf = slug => (pubNow()?.partners || []).find(p => p.slug === slug) || null;
const bid = b => (typeof b === 'string' ? b : b?.id) || '';
// Approved partner words on one bill: this visit's partner first, then the earliest approved.
export function onBill(b) {
  const rows = pubNow()?.byBill.get(bid(b)) || [];
  return rows.slice().sort((x, y) => (y.partner_slug === VIA) - (x.partner_slug === VIA) || String(x.approved_at).localeCompare(String(y.approved_at)));
}
// HIPHI's side on a bill as partners are bound by it: support or oppose of any strength; Monitor and Neutral are no side.
export const hiphiSide = b => sideFamily(b?.hiphi_position);
// "supports", "strongly supports", "opposes", "has comments on": a partner's side in a sentence about it.
export function sideVerb(side, { strong = false } = {}) {
  const f = familyOf(side), s = f === 'support' ? 'supports' : f === 'oppose' ? 'opposes' : 'has comments on';
  return strong && /^strongly_/.test(side || '') ? 'strongly ' + s : s;
}
const many = v => ({ supports: 'support', opposes: 'oppose', 'has comments on': 'have comments on' }[v] || v);
// One line for a bill's row in a list or search (the plan of 10/21): beside HIPHI's own side, "Keiki Smiles Alliance
// supports it too"; on a bill HIPHI has no side on, "From a partner: Keiki Smiles Alliance supports it", so the row never
// reads as HIPHI's. '' when no partner has approved words on it.
export function rowLine(b) {
  const rows = onBill(b); if (!rows.length) return '';
  const names = rows.map(r => r.partner_name), more = names.length - 1;
  const who = more ? `${names[0]} and ${more === 1 ? names[1] : `${more} other partners`}` : names[0];
  const verb = more ? many(sideVerb(rows[0].side)) : sideVerb(rows[0].side);
  if (hiphiSide(b)) return `${who} ${verb} it too`;
  if (new Set(rows.map(r => familyOf(r.side))).size > 1) return `From ${names.length} partners, who differ on it`;
  return `From a partner: ${who} ${verb} it`;
}
// A partner's own side as a plain grey chip, never HIPHI's blue one: "Keiki Smiles Alliance supports".
export function sideChip(r) {
  const f = familyOf(r.side), ic = f === 'support' ? 'thumbs-up' : f === 'oppose' ? 'thumbs-down' : 'message-square';
  return `<span class="chip pw-chip">${icon(ic)}${esc(`${r.partner_name} ${sideVerb(r.side, { strong: true })}`)}</span>`;
}
// On a bill HIPHI has taken no side on, the line under the partner's chip. Where HIPHI is neutral its own "HIPHI has
// comments" chip is on the page, so the line says HIPHI has taken no side rather than no position.
export function noSideLine(rows, b = null) {
  const fams = new Set(rows.map(r => familyOf(r.side))), one = rows.length === 1, f = [...fams][0];
  const ask = fams.size > 1 ? 'HIPHI’s partners differ on it.' : f === 'neutral' ? `${one ? 'A partner has' : 'Partners have'} comments on it.`
    : `${one ? 'A partner asks' : 'Partners ask'} you to ${f} it.`;
  return `${b?.hiphi_position === 'neutral' ? 'HIPHI hasn’t taken a side on this bill.' : 'HIPHI hasn’t taken a position on this bill.'} ${ask}`;
}
// A partner's day as people say it: "Thu, Apr 2".
export const dayWords = day => day ? new Date(`${String(day).slice(0, 10)}T12:00:00-10:00`).toLocaleDateString('en-US', { timeZone: 'Pacific/Honolulu', weekday: 'short', month: 'short', day: 'numeric' }) : '';
// A partner's public page (its bills and issues) and one of its issues.
export const fromPath = slug => `#/from/${encodeURIComponent(slug)}`;
export const pIssuePath = (slug, issueSlug) => `#/from/${encodeURIComponent(slug)}/${encodeURIComponent(issueSlug)}`;
// The partners' words under "About the bill", after HIPHI's own (unchanged): the reasons under the partner's name, its
// plain summary, its ask while it lasts, its note on a draft, and whose words these are; one .ab-part each, for
// billtext.js aboutBill's partners option. h is the heading tag the section's own parts use.
export function aboutHtml(b, { h = 'h3' } = {}) {
  return onBill(b).map(r => {
    const pts = (r.points || []).filter(Boolean), verb = sideVerb(r.side) === 'has comments on' ? 'comments on' : sideVerb(r.side);
    return `<div class="ab-part pw-about"><${h} class="ab-h">Why ${esc(r.partner_name)} ${verb} it</${h}>
      ${r.summary ? `<p class="pw-sum">${esc(r.summary)}</p>` : ''}${pts.length ? `<ul class="ab-pts" role="list">${pts.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
      ${r.ask ? `<p class="pw-ask">${icon('megaphone')}<span><b>Their ask:</b> ${esc(r.ask)}${r.ask_until ? ` Until ${esc(dayWords(r.ask_until))}.` : ''}</span></p>` : ''}
      ${r.draft_note ? `<p class="pw-draft"><b>${r.draft_version ? `On ${esc(r.draft_version)}:` : 'On the latest draft:'}</b> ${esc(r.draft_note)}</p>` : ''}
      <p class="pw-whose">${icon('handshake')}<span>A HIPHI partner. These are its own words. <a href="${fromPath(r.partner_slug)}">More from ${esc(r.partner_name)}</a></span></p></div>`;
  }).join('');
}
// The walkthrough's "Points you can make": each partner's points on this bill, offered only to someone on that partner's
// side (stance 'support' | 'oppose'), as HIPHI's are offered only to people who agree with HIPHI.
export function pointsFor(b, stance) {
  if (!stance) return [];
  return onBill(b).filter(r => familyOf(r.side) === stance && (r.points || []).some(Boolean))
    .map(r => ({ slug: r.partner_slug, name: r.partner_name, points: r.points.filter(Boolean) }));
}
// The partner's welcome line for this visit (?via=), on the page of one of its bills or its own page (the first visit's
// screens say it already): the line staff or the partner wrote, or nothing.
export function viaWelcome(b = null) {
  const p = viaPartner(); if (!p || !p.welcome) return '';
  if (b && !onBill(b).some(r => r.partner_slug === p.slug)) return '';
  return `<p class="pw-welcome">${icon('sparkles')}<span>${esc(p.welcome)}</span></p>`;
}
// Find's "From our partners": each group that writes and has approved bills or issues, this visit's partner first.
export function fromGroups() {
  const d = pubNow(); if (!d) return [];
  return d.partners.filter(p => p.writes).map(p => ({ ...p,
    bills: [...new Set(d.rows.filter(r => r.partner_slug === p.slug).map(r => r.bill_id))],
    issues: d.issues.filter(i => i.partner_slug === p.slug) }))
    .filter(g => g.bills.length || g.issues.length)
    .sort((x, y) => (y.slug === VIA) - (x.slug === VIA) || x.name.localeCompare(y.name));
}
// One partner issue, by the partner's slug and the issue's.
export const pIssue = (slug, issueSlug) => (pubNow()?.issues || []).find(i => i.partner_slug === slug && i.slug === issueSlug) || null;
// An issue's stance as the partner's plain grey chip: "Keiki Smiles Alliance supports" (mixed: "has mixed views").
export function issueChip(i) {
  const s = i.stance === 'support' ? ['thumbs-up', 'supports'] : i.stance === 'oppose' ? ['thumbs-down', 'opposes'] : ['scale', 'has mixed views'];
  return `<span class="chip pw-chip">${icon(s[0])}${esc(`${i.partner_name} ${s[1]}`)}</span>`;
}

// ---------------- the group's own words, shared by You and the corner ----------------
// The line under the group's name (Nate 10/22, the plan's first mockup), or what a group that cannot write yet should know.
export function teamLine(g) {
  if (g.status === 'waiting') return 'HIPHI is still looking over your group. You can write here once HIPHI approves it.';
  if (g.status === 'paused') return 'HIPHI has paused your group for now, so its words are off the tracker.';
  const n = Math.max(0, (g.people || []).length - 1);
  return `${n ? `You and ${n} ${n === 1 ? 'other' : 'others'} from your group can write here.` : 'You can write here for your group.'} HIPHI looks over each bill’s words before they go public.`;
}
// What waits on the person, for the You card (B-14: things to do are never folded away): HIPHI's asks for a change first.
export function needsYou(g) {
  if (!g.me?.terms_at) return 'Agree to the partner terms to start writing.';
  const asked = [...(g.bills || []).filter(b => !b.removed), ...(g.issues || []).filter(i => !i.removed)].filter(x => x.open?.state === 'changes').length;
  return asked ? `HIPHI asked for a change on ${asked === 1 ? 'one of your bills' : `${asked} of your bills and issues`}.` : '';
}
// The card on You (R-328): "Your group", its name and line, and what waits on them, for a signed-in person on a group. The
// first draw asks the database once (my_partner) and draws again with the card and its stylesheet; everyone else (most
// people) costs nothing: no group, no card, no stylesheet.
export function youCard() {
  if (!canAsk()) return '';
  const d = myPartnerNow();
  if (!d) {
    myPartner().then(r => { if (r.groups.length && document.body.dataset.screen === 'more') (app.ensureCss ? app.ensureCss(['partner']) : Promise.resolve()).then(() => app.render()); }).catch(e => console.error(e));
    return '';
  }
  return d.groups.map(g => { const need = needsYou(g);
    return `<a class="pt-you" href="#/partner${d.groups.length > 1 ? `?g=${encodeURIComponent(g.slug)}` : ''}"><span class="pt-you-ic" aria-hidden="true">${icon('handshake')}</span>
      <span class="pt-you-t"><span class="pt-you-k">Your group</span><span class="pt-you-n">${esc(g.name)}</span><span class="pt-you-s">${esc(teamLine(g))}</span>${need ? `<span class="pt-you-need">${icon('message-square')}<span>${esc(need)}</span></span>` : ''}</span>${icon('chevron-right', { cls: 'pt-you-chev' })}</a>`; }).join('');
}

// ---------------- bills, for the editor and Add a bill ----------------
// The tracker's own row for a bill (public_all_bills): its number, title, HIPHI's nickname, plain summary and position.
const INFO = new Map();
export async function billsInfo(ids) {
  const need = [...new Set(ids)].filter(id => id && !INFO.has(id));
  if (need.length) {
    if (DEMO) for (const id of need) { const b = sbBill(id); if (b) INFO.set(id, b); }
    else {
      for (const b of S.bills || []) if (need.includes(b.id)) INFO.set(b.id, b);
      const rest = need.filter(id => !INFO.has(id));
      if (rest.length) { const c = await supa(), { data, error } = await c.from('public_all_bills').select('*').in('id', rest); if (error) throw error; for (const b of data || []) INFO.set(b.id, b); }
    }
  }
  return new Map(ids.map(id => [id, INFO.get(id) || null]));
}
export const billInfoNow = id => INFO.get(id) || null;
// A bill number as people type it: "HB 1671", "hb1671", "SB0012".
export const asNumber = q => { const m = /^\s*(HB|SB|HR|SR|HCR|SCR|GM)\s*0*(\d{1,4})\s*$/i.exec(q || ''); return m ? m[1].toUpperCase() + m[2] : ''; };
// Add a bill: a bill number finds that bill; words find bills whose name, plain summary or title has every word (the
// practice copy uses Find's own matcher, pub/find.js matchAll, over its every bill). HIPHI's bills first, then the newest.
export async function findBills(q) {
  const num = asNumber(q), words = String(q || '').toLowerCase().split(/\s+/).map(w => w.replace(/[^a-z0-9ʻāēīōū-]/g, '')).filter(w => w.length > 1);
  if (!num && !words.length) return [];
  let rows;
  if (DEMO) {
    const all = [...D.bills, ...D.index];
    if (num) rows = all.filter(b => b.bill_number === num);
    else { const { matchAll } = await import('./find.js'); rows = matchAll(all, q); }
  } else {
    const c = await supa(); let qq = c.from('public_all_bills').select('*');
    if (num) qq = qq.eq('bill_number', num);
    else for (const w of words.slice(0, 4)) qq = qq.or(['hiphi_nickname', 'hiphi_summary', 'title', 'description'].map(col => `${col}.ilike.*${w}*`).join(','));
    const { data, error } = await qq.order('session_year', { ascending: false }).limit(60); if (error) throw error; rows = data || [];
  }
  for (const b of rows) INFO.set(b.id, b);
  const rank = b => (b.hiphi_position && b.hiphi_position !== 'monitor' ? 0 : b.hiphi_position ? 1 : 2);
  return rows.slice().sort((a, b) => (+b.session_year || 0) - (+a.session_year || 0) || rank(a) - rank(b) || a.bill_number.localeCompare(b.bill_number, 'en', { numeric: true })).slice(0, 25);
}
