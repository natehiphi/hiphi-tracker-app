// The sandbox's data (R-122): demo/snapshot.json read into D, and the seeded actions. Loaded only with ?demo=1, so the
// live page never carries it (it was a fifth of core.js).
import { S, alive, SEASON_OFF, D, saveDoneAt, saveDone, doneKey } from './kernel.js';
import { icon } from '../icons.js';
export async function demoLoad() {
  const snap = await (await fetch('demo/snapshot.json?v=20261005d', { cache: 'force-cache' })).json();   // bump v when the snapshot is rebuilt, or browsers keep the old copy
  const campName = Object.fromEntries(snap.campaigns.map(c => [c.id, c]));
  const coalOf = {}; for (const r of snap.billCampaigns) { const c = campName[r.campaign_id]; if (c?.is_public) (coalOf[r.bill_id] ??= []).push(c.name); }
  const seed = id => [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  // Shape tracked bills like public_all_bills; every tracked bill is public.
  D.bills = snap.bills.map(b => ({ id: b.id, bill_number: b.bill_number, session_year: b.session_year, chamber: b.chamber, title: b.title, description: b.description,
    committee: b.committee, referrals: b.referrals, stage: b.stage, last_action: b.last_action, last_action_date: b.last_action_date, state_url: b.state_url,
    sponsors: b.sponsors, companions: b.companions, origin_stops: b.origin_stops, second_stops: b.second_stops, current_version: b.current_version,
    died_deadline: b.died_deadline, died_at_stage: b.died_at_stage, hiphi_position: b.position, hiphi_summary: b.public_summary, hiphi_action: b.public_action,
    hiphi_nickname: b.is_public ? b.nickname || null : null,   // as public_all_bills does
    hiphi_recommended: !!b.recommended, hiphi_points: b.is_public && b.talking_points?.length ? b.talking_points : null,   // 084, the testimony walkthrough's talking points (R-068)
    hiphi_follows: true, coalitions: coalOf[b.id] || [], watchers: b.priority === 1 ? 12 + seed(b.id) % 40 : seed(b.id) % 9 }));
  D.index = snap.index.map(b => ({ id: b.id, bill_number: b.bill_number, chamber: b.chamber, title: b.title, description: null, stage: 'introduced', referrals: [], sponsors: [], companions: [], coalitions: [], watchers: 0, hiphi_follows: false, sandbox_untracked: true }));
  D.hearings = snap.hearings.map(h => ({ ...h, bill_number: snap.bills.find(b => b.id === h.bill_id)?.bill_number }));
  D.activity = snap.activity.map(a => ({ bill_id: a.bill_id, title: a.title, details: a.details, occurred_at: a.occurred_at }));
  D.outcomes = snap.outcomes;
  if (SEASON_OFF) {
    // The real end of the 2026 session, from the snapshot's b.final (R-067: an imagined ending showed SB 2175, which became
    // law, as stopped, so the between-sessions sandbox disagreed with the live page). A snapshot built before 9/28 has
    // no final: then the old imagined ending stands in.
    const fin = new Map(snap.bills.filter(b => b.final).map(b => [b.id, b.final]));
    for (const b of D.bills) {
      const f = fin.get(b.id);
      if (f) Object.assign(b, { stage: f.stage, last_action: f.last_action, last_action_date: f.last_action_date, died_at_stage: f.died_at_stage, died_deadline: f.died_deadline });
      else if (!['dead', 'enacted', 'vetoed'].includes(b.stage)) {
        b.stage = b.hiphi_position === 'strongly_support' && ['conference', 'second_decking', 'second_crossover', 'governor'].includes(b.stage) ? 'enacted' : 'dead';
        if (b.stage === 'dead' && !b.died_deadline) b.died_deadline = 'Sine die'; }
    }
  }
  D.lists = (snap.lists || []).map(l => ({ ...l, is_published: true })); D.listBills = snap.listBills || [];
  // Categories and issues, shaped like public_categories / public_issues: an issue lists the position bills that carry
  // it, with each one's session, and every bill knows its issues (public_all_bills.hiphi_issues).
  D.cats = (snap.categories || []).slice().sort((x, y) => x.sort_order - y.sort_order);
  { const extra = {}; for (const r of snap.issueCategories || []) (extra[r.issue_id] ??= []).push(r.category);
    const byId = new Map(D.bills.map(b => [b.id, b])), byIssue = {}, ofBill = {};
    for (const r of snap.billIssues || []) { const b = byId.get(r.bill_id); if (!b || !b.hiphi_position || b.hiphi_position === 'monitor') continue;
      (byIssue[r.issue_id] ??= []).push(b); (ofBill[b.id] ??= []).push(r.issue_id); }
    // As public_issues does (R-023): top_priority is true when one of the issue's position bills in the latest session is the
    // team's priority 1 (only that flag is public, never a bill's priority); first_visit is the staff switch "Show in the
    // first visit" (true unless staff turned it off).
    const prio = new Map(snap.bills.map(x => [x.id, x.priority])), latest = Math.max(...snap.bills.map(x => +x.session_year || 0));
    D.issues = (snap.issues || []).map(i => { const bs = (byIssue[i.id] || []).sort((a, b) => a.bill_number.localeCompare(b.bill_number));
      return { ...i, categories: [i.category, ...(extra[i.id] || []).filter(c => c !== i.category)], bill_ids: bs.map(b => b.id), bill_years: bs.map(b => b.session_year), followers: 0,
        first_visit: i.first_visit !== false, top_priority: bs.some(b => +b.session_year === latest && prio.get(b.id) === 1) }; });
    for (const b of D.bills) b.hiphi_issues = ofBill[b.id] || null;
    D.issueLinks = snap.issueLinks || []; }   // public_issue_links: pairs of related issues (095, R-094)
  S.legislators = snap.legislators || []; S.committeeMembers = snap.committeeMembers || []; S.counterparts = snap.counterparts || [];
  S.deadlines = snap.deadlines.slice().sort((x, y) => x.deadline_date.localeCompare(y.deadline_date));
  S.committees = Object.fromEntries(snap.committees.map(c => [c.code, c]));
  S.slots = snap.slots;
  const counts = {}, live = {}; for (const b of D.bills) for (const n of b.coalitions) { counts[n] = (counts[n] || 0) + 1; if (alive(b)) live[n] = (live[n] || 0) + 1; }
  S.coalitions = snap.campaigns.filter(c => c.is_public && counts[c.name]).map(c => ({ name: c.name, public_name: c.public_name || c.name, slug: c.slug, description: c.description, icon: c.icon, bills: counts[c.name], live: live[c.name] || 0, sort_order: c.sort_order }));
}
export function seedDemoActions() {
  try { if (S.done.size || localStorage.getItem('hiphi_demo_seeded')) { S.demoSeeded = localStorage.getItem('hiphi_demo_seeded') === '1' && S.done.size > 0; return; } } catch { return; }
  const now = Date.now(), hs = D.hearings.filter(h => new Date(h.scheduled_at) < now && new Date(h.scheduled_at) > now - 20 * 864e5 && D.outcomes.some(o => o.hearing_id === h.id && /passed/.test(o.outcome || '')))
    .filter(h => D.bills.some(b => b.id === h.bill_id && b.hiphi_position && b.hiphi_position !== 'monitor')).slice(-3);
  hs.forEach((h, i) => { const k = doneKey(h.bill_id, h.id, i === 1 ? 'email' : 'testimony'); S.done.add(k); S.doneAt[k] = new Date(new Date(h.scheduled_at).getTime() - 864e5).toISOString(); });
  if (hs.length) { saveDone(); saveDoneAt(); S.demoSeeded = true; try { localStorage.setItem('hiphi_demo_seeded', '1'); } catch { /* ignore */ } }
}
// ?letter (R-148): a letter "sent" on HB 2121 for its House Health hearing of 18 Feb, when the bill was House draft 1, so
// the practice copy shows it offered again for the Senate hearing of 20 Mar (House draft 2, which demo/drafts.json marks
// as changing what people should say). Planted once a visit; a letter sent in the practice copy since is left alone.
export function seedDemoLetter() {
  const b = D.bills.find(x => x.bill_number === 'HB2121'), h = b && D.hearings.find(x => x.bill_id === b.id && x.committee === 'HLT');
  if (!b || !h) return;
  try {
    const me = JSON.parse(localStorage.getItem('hiphi_me') || '{}') || {}, had = (me.letters || {})[b.id];
    if (had && !had.demo) return;
    const pts = (b.hiphi_points || []).slice(0, 2);
    me.letters = { ...(me.letters || {}), [b.id]: { v: 1, demo: true, bill: b.id, num: b.bill_number, nick: b.hiphi_nickname || '', yr: b.session_year, h: h.id, code: h.committee,
      at: h.scheduled_at, sent: new Date(new Date(h.scheduled_at).getTime() - 864e5).toISOString(), draft: 'HD1', stance: 'support', ours: true, pos: b.hiphi_position || '',
      name: me.name || 'Kalani Practice', why: 'As a parent of two teenagers, I see how easy these e-cigarettes are for kids to get.', points: pts, pointsText: pts.join(' '),
      closing: 'Mahalo', letter: '', edited: false } };
    localStorage.setItem('hiphi_me', JSON.stringify(me));
    // and the testimony it stands for, marked sent on that hearing, as a real send would have
    const k = doneKey(b.id, h.id, 'testimony'); if (!S.done.has(k)) { S.done.add(k); (S.doneAt ??= {})[k] = me.letters[b.id].sent; saveDone(); saveDoneAt(); }
  } catch { /* private mode: no letter to show */ }
}
// ?email (R-153): an email "sent" on HB 1563 to the House Finance chair on 25 Feb, when the bill was House draft 1, so the
// practice copy offers it again ("Send my email again") for the Senate committee it now waits in. With &remind as well,
// the email went to that Senate committee's chairs on 9 Mar instead, and its deadline is moved to Fri 20 Mar for this bill
// only, so the one reminder to the same chairs is offered (it is offered a week before a deadline).
export function seedDemoMail(remind = false) {
  const b = D.bills.find(x => x.bill_number === 'HB1563'); if (!b) return;
  const code = remind ? 'HHS/EIG' : 'FIN';
  try {
    const me = JSON.parse(localStorage.getItem('hiphi_me') || '{}') || {}, k = 'email:' + b.id, had = (me.letters || {})[k];
    if (!had || had.demo) {
      const pts = (b.hiphi_points || []).slice(0, 2);
      me.letters = { ...(me.letters || {}), [k]: { v: 1, kind: 'email', demo: true, mode: 'email', bill: b.id, num: b.bill_number, nick: b.hiphi_nickname || '', yr: b.session_year,
        key: 'email|' + code, code, h: '', at: '', sent: remind ? '2026-03-09T20:00:00.000Z' : '2026-02-25T20:00:00.000Z', draft: remind ? 'HD2' : 'HD1', stance: 'support', ours: true,
        pos: b.hiphi_position || '', name: me.name || 'Kalani Practice', why: 'Our county should be able to protect kids from tobacco where they live.', points: pts,
        pointsText: pts.join(' '), closing: 'Mahalo', letter: '', edited: false, subject: '', parts: null } };
      localStorage.setItem('hiphi_me', JSON.stringify(me));
    }
    // and the ask it stands for, marked sent for that committee, as a real send would have
    for (const m of [doneKey(b.id, '', 'email'), `${b.id}|${code}|ask`]) S.done.add(m);
    saveDone();
    if (remind && !S.deadlines.some(d => d.key === 'second_lateral_r153')) {
      const lat = S.deadlines.find(d => d.key === 'second_lateral');
      if (lat) S.deadlines.push({ ...lat, key: 'second_lateral_r153', deadline_date: '2026-03-20', bills: [b.bill_number], replaces: 'second_lateral' });
    }
  } catch { /* private mode: no email to show */ }
}
// HIPHI's picks for a coalition: strongly supported/opposed first, then bills
// with a position and a hearing coming up, then the rest with a position. Dead
// bills stay out. Capped so a first-timer sees a handful, not hundreds.
