// One bill for act.html (R-360), in a small shape the screens draw from.
//
// Live: ONE plain GET of public_bill_page (backend migration 191), the same question track.html's inline script asks for a
// bill link, with the public key in the address so the browser sends no preflight. In parallel, the issues' slugs (for the
// drawing at the top). The public boundary (rule 3): only public_* views and RPCs, never `bills`.
// Practice copy (?demo=1): the bill out of demo/snapshot.json, the frozen 2026 session at 9:00 am HST on Mon 16 March 2026,
// as pub/demo.js shapes it, without the tracker's kernel. The snapshot is one file, so it is fetched whole, with
// the same ?v= key as pub/demo.js so a browser that opened the tracker's practice copy already has it, and only this bill's
// rows are kept.
import { standing, cleanDesc, spaced } from './words.js';
import { codesOf } from '../pub/capitol.js';

// pub/kernel.js SUPABASE_URL and SUPABASE_KEY (the publishable key: it can read only what anon can read).
const URL_ = 'https://eivzjbnygscguqqiiuvh.supabase.co/rest/v1/';
const KEY = 'sb_publishable_uvEtw8ru3zB9lDOxAjzrUA_JEFvKyul';
export const DEMO = new URLSearchParams(location.search).has('demo');
const DEMO_ASOF = '2026-03-16T09:00:00-10:00';   // pub/kernel.js DEMO_ASOF (the default clock)
const SNAP = new URL('../demo/snapshot.json?v=20261025b', import.meta.url);   // pub/demo.js: bump both together
const WAIT_MS = 10000;   // as track.html's own race: no answer in ten seconds is a failed load, with Try again

// A failed load (offline, an error, no answer) throws; a bill the database does not know returns null.
export class LoadError extends Error {}
async function get(q) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), WAIT_MS);
  try {
    const r = await fetch(URL_ + q + (q.includes('?') ? '&' : '?') + 'apikey=' + KEY, { signal: ctl.signal });
    if (!r.ok) { const e = new LoadError('status ' + r.status); e.status = r.status; throw e; }
    return await r.json();
  } catch (e) { throw e instanceof LoadError ? e : new LoadError(e.message); }
  finally { clearTimeout(timer); }
}

// The position as the public page says it (kernel.js posInfo), in three words and comments: a bill HIPHI is only
// monitoring is "watching" (R-360).
const POSITION = p => /support/.test(p || '') ? 'supports' : /oppose/.test(p || '') ? 'opposes' : p === 'neutral' ? 'comments' : 'watching';

// The bill's own page on the Capitol website. Not state_url: the live rows point at Open States, and the link says "at the Capitol".
const capitolUrl = b => { const m = /^([A-Z]+)(\d+)$/.exec(String(b.bill_number || '').toUpperCase());
  return m ? `https://capitol.hawaii.gov/session/measure_indiv.aspx?billtype=${m[1]}&billnumber=${m[2]}&year=${b.session_year}` : 'https://capitol.hawaii.gov/'; };

// core.js sameIdeaLaw, from the rows this page has (the RPC's companions and same_idea): a bill that did not advance whose
// companion, or another chamber's bill on one of its HIPHI issues, became law.
function sameIdeaLaw(b, others, issueName) {
  if (/^(HCR|SCR|HR|SR)\d/.test(b.bill_number)) return null;
  const lawOf = c => c && c.id !== b.id && +c.session_year === +b.session_year && c.stage === 'enacted' && !/^(HCR|SCR|HR|SR)\d/.test(c.bill_number);
  const said = (c, issue = '') => { const m = /\bAct\s+(\d+)\b/i.exec(`${c.last_action || ''} ${c.status_text || ''}`); return { num: c.bill_number, act: m ? m[1] : '', issue }; };
  const comp = (b.companions || []).flatMap(c => String(c).split(/[,\s]+/)).map(s => s.toUpperCase()).filter(Boolean);
  for (const num of comp) { const c = others.find(x => x.bill_number === num); if (lawOf(c)) return said(c); }
  for (const id of b.hiphi_issues || []) for (const c of others)
    if (lawOf(c) && (c.hiphi_issues || []).includes(id) && c.bill_number[0] !== b.bill_number[0]) return said(c, issueName(id) || 'the same issue');
  return null;
}

// The shape the screens draw (one/bill.js), and what part 2 (write and send) reads.
function shape(b, { hearings, outcomes, committees, deadlines, others, issues, now }) {
  const W = { now, committees: Object.fromEntries(committees.map(c => [c.code, c])), hearings: hearings.slice().sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at)),
    outcomes: Object.fromEntries(outcomes.map(o => [o.hearing_id, o])), deadlines: deadlines.slice().sort((x, y) => x.deadline_date.localeCompare(y.deadline_date)) };
  const byId = new Map(issues.map(i => [i.id, i])), issue = (b.hiphi_issues || []).map(id => byId.get(id)).find(Boolean) || null;
  const stand = standing(b, W, sameIdeaLaw(b, others, id => byId.get(id)?.name));
  const st = stand.st, summary = String(b.hiphi_summary || cleanDesc(b.description) || '').replace(/\s+/g, ' ').trim();
  const cmte = st.committee ? { code: st.committee, chairs: codesOf(st.committee).map(k => W.committees[k]).filter(c => c && c.chair)
    .map(c => ({ name: c.chair, chamber: c.chamber, committee: c.name })) } : null;
  return {
    id: b.id, number: b.bill_number, numberSpaced: spaced(b.bill_number), year: +b.session_year,
    nickname: b.hiphi_nickname || '', title: b.title || '', summary,
    position: POSITION(b.hiphi_position), positionRaw: b.hiphi_position || null,
    over: stand.over, action: stand.action, lines: stand.lines,
    hearing: st.hearingState === 'scheduled' ? { id: st.hearing.id, at: st.hearing.scheduled_at, deadline: st.hearing.testimony_deadline || null,
      committee: st.hearing.committee, room: st.hearing.room || '' } : null,
    committee: cmte,
    points: b.hiphi_points || [],   // HIPHI's talking points, for part 2's letter
    issue: issue ? { slug: issue.slug, category: issue.category, name: issue.name } : null,
    capitolUrl: capitolUrl(b),
  };
}

// The live page: one RPC, and the issues alongside it. Until public_bill_page answers (a 404 means it is not applied, as
// core.js pageAnswer expects), the same rows come from the public views the tracker reads.
async function live(num, year) {
  const issuesP = get('public_issues?select=id,slug,category,name').catch(() => []);   // decoration: a failure leaves the plain header
  let A;
  try { A = await get(`rpc/public_bill_page?p_bill=${encodeURIComponent(num)}${year ? '&p_year=' + year : ''}`); }
  catch (e) { if (e.status !== 404) throw e; A = await viaViews(num, year); }
  if (!A || !A.bill) return null;
  return shape(A.bill, { hearings: A.hearings || [], outcomes: A.outcomes || [], committees: A.committees || [], deadlines: A.deadlines || [],
    others: [...(A.companions || []), ...(A.same_idea || [])], issues: await issuesP, now: Date.now() });
}
async function viaViews(num, year) {
  const [bill] = await get(`public_all_bills?bill_number=eq.${encodeURIComponent(num)}${year ? '&session_year=eq.' + year : ''}&order=session_year.desc&limit=1`);
  if (!bill) return { bill: null };
  const [hearings, outcomes, committees, deadlines] = await Promise.all([get(`public_all_hearings?bill_id=eq.${bill.id}`), get(`public_hearing_outcomes?bill_id=eq.${bill.id}`),
    get('public_committees?select=*'), get(`public_deadlines?session_year=eq.${bill.session_year}`)]);
  return { bill, hearings, outcomes, committees, deadlines: deadlines.filter(d => !(d.bills || []).length || d.bills.includes(bill.bill_number)) };
}

// The practice copy: this bill's rows from the snapshot, shaped like public_all_bills as pub/demo.js does.
let snapP = null;
async function demo(num) {
  let snap;
  try { snap = await (snapP ??= fetch(SNAP, { cache: 'force-cache' }).then(r => { if (!r.ok) throw new Error('snapshot ' + r.status); return r.json(); })); }
  catch (e) { snapP = null; throw new LoadError(e.message); }
  const issueOf = {};
  for (const r of snap.billIssues || []) (issueOf[r.bill_id] ??= []).push(r.issue_id);
  const asPublic = b => ({ id: b.id, bill_number: b.bill_number, session_year: b.session_year, chamber: b.chamber, title: b.title, description: b.description,
    committee: b.committee, referrals: b.referrals, stage: b.stage, last_action: b.last_action, last_action_date: b.last_action_date, status_text: b.status_text,
    companions: b.companions, origin_stops: b.origin_stops, second_stops: b.second_stops, died_deadline: b.died_deadline, died_at_stage: b.died_at_stage,
    hiphi_position: b.position, hiphi_summary: b.public_summary, hiphi_nickname: b.is_public ? b.nickname || null : null,
    hiphi_points: b.is_public && b.talking_points?.length ? b.talking_points : null,
    hiphi_issues: b.position && b.position !== 'monitor' ? issueOf[b.id] || null : null });
  const raw = snap.bills.find(b => b.bill_number === num);
  if (!raw) return null;   // the snapshot's other bills (snap.index) are ones HIPHI does not follow: not this page's
  const b = asPublic(raw);
  return shape(b, { hearings: snap.hearings.filter(h => h.bill_id === b.id), outcomes: snap.outcomes.filter(o => o.bill_id === b.id),
    committees: snap.committees, deadlines: snap.deadlines.filter(d => +d.session_year === +b.session_year && (!(d.bills || []).length || d.bills.includes(b.bill_number))),
    others: snap.bills.filter(x => x.id !== b.id && x.stage === 'enacted').map(asPublic), issues: snap.issues || [], now: new Date(DEMO_ASOF).getTime() });
}

// loadBill('hb 2121') -> the shape above, or null for a bill we do not have; throws LoadError when it cannot load.
export function loadBill(num, year = null) {
  const n = String(num || '').replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2,3}\d{1,5}$/.test(n)) return Promise.resolve(null);
  return DEMO ? demo(n) : live(n, year);
}
