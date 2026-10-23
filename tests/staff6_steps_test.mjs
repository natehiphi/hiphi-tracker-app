// Staff v6's one word per fact (R-336, V6-SPEC section 5; staff6/steps.js), checked on the practice copy's own data, the
// way the app builds it (data.js demoInit, Mon 16 Mar 2026, 9:00 AM in Honolulu). No server or browser needed:
//   node tests/staff6_steps_test.mjs
// status(): nothing amber unless late but still accepted, nothing red unless overdue (D3); testimonyState(): one of five
// words and Missed for every draft state; actBy(): the W31 hand-on times; committeeName() for every committee code in
// demo/snapshot.json; versionWords(); the practice seeds (Patti, Julie, the chair asks); and the weekly memo carries no
// programmer's note (V35).
import { readFileSync } from 'fs';

// ---- a little browser: just what the data layer and the shared parts touch when they load ----
const ROOT = new URL('../', import.meta.url);
const noop = () => {};
const store = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), clear: () => m.clear() }; };
Object.assign(globalThis, {
  window: globalThis, location: { search: '?demo=1&as=NT', hash: '', origin: 'https://v6.test', pathname: '/staff6.html', href: 'https://v6.test/staff6.html?demo=1' },
  localStorage: store(), sessionStorage: store(), addEventListener: noop, removeEventListener: noop, matchMedia: () => ({ matches: true, addEventListener: noop }),
  document: { addEventListener: noop, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, body: null, createElement: () => ({ style: {} }) },
  history: { state: null, pushState: noop, replaceState: noop, back: noop }, requestAnimationFrame: f => setTimeout(f, 0), CSS: { escape: s => s },
  fetch: async url => { const f = new URL(String(url).split('?')[0], ROOT); return { ok: true, json: async () => JSON.parse(readFileSync(f)) }; },
});
if (!globalThis.navigator) globalThis.navigator = { userAgent: 'node' };

const D = await import('../staff6/data.js');
const { S } = D;
await D.DB.init?.().catch?.(() => {});
await D.demoInit();
const M = await import('../staff6/model.js');
const X = await import('../staff6/steps.js');

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); c ? pass++ : fail++; };
const RealDate = Object.getPrototypeOf(Date) === Function.prototype ? Date : Object.getPrototypeOf(Date);
// Pin the clock: every module reads the global Date when it runs, so this moves the whole app's "now".
const at = iso => { const T = new RealDate(iso).getTime(); globalThis.Date = class extends RealDate { constructor(...a) { a.length ? super(...a) : super(T); } static now() { return T; } }; M.FACTS.clear?.(); };
const MON9 = '2026-03-16T09:00:00-10:00';
at(MON9);
const hst = iso => new RealDate(iso).getTime();
const byIni = Object.fromEntries(S.advocates.map(a => [a.initials, a]));
const NT = byIni.NT, KV = byIni.KV, KR = byIni.KR, PH = byIni.PH, JMM = byIni.JMM, LR = byIni.LR, RK = byIni.RK;

// ---- 1. status(): by exception (D3) ----
{
  const n = X.status({ due: hst('2026-03-18T13:00:00-10:00') });
  ok(n.tone === 'neutral' && !n.soon && n.words === 'Due Wed 3/18, 1:00 PM', `a step due later in the week is neutral, no mark: "${n.words}"`);
  const t = X.status({ due: hst('2026-03-16T15:00:00-10:00') });
  ok(t.tone === 'neutral' && t.soon && t.icon === 'clock' && t.words === 'Due today 3:00 PM', `due today is neutral, first, with a clock and its time (no amber): "${t.words}"`);
  const t2 = X.status({ due: hst('2026-03-16T10:30:00-10:00') });
  ok(t2.tone === 'neutral' && t2.soon, 'due within 2 hours is still neutral (D3: amber only when truly late)');
  const late = X.status({ kind: 'file', due: hst('2026-03-16T08:00:00-10:00'), until: hst('2026-03-16T13:10:00-10:00') });
  ok(late.tone === 'late' && late.icon === 'clock' && late.words === 'Late, still accepted until 1:10 PM today', `late testimony the Capitol still takes is amber with a clock and its words: "${late.words}"`);
  const od = X.status({ kind: 'todo', due: hst('2026-03-15T17:00:00-10:00') });
  ok(od.tone === 'overdue' && od.icon === 'circle-alert' && /overdue$/.test(od.words), `a to-do past its date is red with an alert icon and the word: "${od.words}"`);
  const prep = X.status({ kind: 'prep', due: hst('2026-03-10T17:00:00-10:00') });
  ok(prep.tone === 'neutral' && prep.words === 'Still to finish', 'a 2027 prep date that passed is "Still to finish", never red');
  ok(X.status({ done: true }).tone === 'done' && X.status({ missed: true }).tone === 'neutral', 'done is leaf; missed is said, not coloured (V25, V30)');
  ok(X.status({}).tone === 'neutral' && X.status({}).words === '', 'no date: neutral and nothing said');
  // Every bill's step on the practice day: amber only where the written deadline passed and the hearing has not begun; red
  // only where the step's own deadline passed and no hearing still takes it.
  const now = Date.now(); let ambers = 0, reds = 0, badAmber = [], badRed = [];
  for (const b of S.bills) { const s = X.billStep(b, { viewer: NT }); if (!s) continue;
    if (s.status.tone === 'late') { ambers++; if (!(s.due <= now && s.until > now)) badAmber.push(b.bill_number); }
    if (s.status.tone === 'overdue') { reds++; if (!(s.due <= now && !(s.until > now))) badRed.push(b.bill_number); } }
  ok(!badAmber.length, `nothing amber unless late but still accepted (${ambers} late on the practice day${badAmber.length ? '; wrong: ' + badAmber.join(', ') : ''})`);
  ok(!badRed.length, `nothing red unless overdue (${reds} overdue${badRed.length ? '; wrong: ' + badRed.join(', ') : ''})`);
  // A quiet day (Wed 18 Mar, 7:00 AM, every draft of the week filed or written in time): no amber, no red on anyone's steps.
  const saved = JSON.stringify(S.drafts);
  for (const d of Object.values(S.drafts).flat()) if (d.status !== 'cancelled') d.status = 'filed';
  at('2026-03-18T07:00:00-10:00');
  const loud = S.bills.map(b => X.billStep(b, { viewer: NT })).filter(s => s && ['late', 'overdue'].includes(s.status.tone) && s.kind !== 'chair');
  ok(!loud.length, `a day when nothing is late shows 0 amber or red testimony marks${loud.length ? ': ' + loud.map(s => s.b.bill_number + ' ' + s.status.tone).join(', ') : ''}`);
  S.drafts = JSON.parse(saved); at(MON9);
}

// ---- 2. testimonyState(): exactly five words and Missed, for every draft state ----
{
  const WORDS = new Set(['Writing', 'With an approver', 'Second look', 'Ready to file', 'Filed', 'Missed']);
  const all = Object.values(S.drafts).flat(), seen = new Map(), wrong = [];
  for (const d of all) {
    const b = M.billById(d.bill_id); const st = X.testimonyState(d, b);
    if (d.status === 'cancelled') { if (st !== null) wrong.push(`${d.id} cancelled`); continue; }
    if (!st || !WORDS.has(st.word)) { wrong.push(`${d.id} ${d.status} -> ${st?.word}`); continue; }
    const h = M.draftHearing(d), started = h && h.status !== 'cancelled' && new Date(h.scheduled_at).getTime() <= Date.now();
    const want = d.status === 'filed' ? 'Filed' : started ? 'Missed' : { draft: 'Writing', review: 'With an approver', second_review: 'Second look', approved: 'Ready to file' }[d.status];
    if (st.word !== want) wrong.push(`${d.id} ${d.status} -> ${st.word}, want ${want}`);
    if (st.sentBack !== (d.status === 'draft' && !!d.review_note && !started)) wrong.push(`${d.id} sent back flag`);
    seen.set(d.status, (seen.get(d.status) || 0) + 1);
  }
  ok(!wrong.length, `every draft in the practice data (${all.length}: ${[...seen].map(([k, n]) => `${n} ${k}`).join(', ')}) has one of the five words or Missed${wrong.length ? '; wrong: ' + wrong.slice(0, 5).join('; ') : ''}`);
  ok(['draft', 'review', 'second_review', 'approved', 'filed'].every(k => seen.has(k)), 'the practice data holds every draft state (draft, review, second review, approved, filed)');
  const b = S.bills.find(x => x.position && x.position !== 'monitor'), h0 = { id: 'hx', bill_id: b.id, committee: 'HLT', status: 'scheduled', scheduled_at: '2026-03-20T09:00:00-10:00', testimony_deadline: '2026-03-19T09:00:00-10:00' };
  const mk = o => ({ id: 'x', bill_id: b.id, committee: 'HLT', ...o });
  const w = s => String(X.testimonyState(s, b, { h: h0 }));
  ok(w(mk({ status: 'draft' })) === 'Writing' && w(mk({ status: 'review' })) === 'With an approver' && w(mk({ status: 'second_review' })) === 'Second look' && w(mk({ status: 'approved' })) === 'Ready to file' && w(mk({ status: 'filed' })) === 'Filed', 'draft, review, second review, approved and filed read Writing · With an approver · Second look · Ready to file · Filed');
  const sb = X.testimonyState(mk({ status: 'draft', review_note: 'Shorter' }), b, { h: h0 });
  ok(sb.word === 'Writing' && sb.sentBack && sb.label === 'Writing · sent back', `"Sent back" is a flag on Writing: "${sb.label}"`);
  const nd = X.testimonyState(null, b, { h: h0 });
  ok(nd.word === 'Writing' && nd.noDraft && nd.label === 'Writing · no draft yet', `a hearing with no draft yet is Writing: "${nd.label}"`);
  const past = { ...h0, scheduled_at: '2026-03-16T08:00:00-10:00' };
  ok(String(X.testimonyState(mk({ status: 'approved' }), b, { h: past })) === 'Missed', 'testimony not filed when its sitting has started is Missed');
  ok(String(X.testimonyState(mk({ status: 'filed' }), b, { h: past })) === 'Filed', 'filed stays Filed after the sitting');
  ok(X.testimonyState(mk({ status: 'cancelled' }), b, { h: h0 }) === null, 'a cancelled draft has no testimony state (the hearing line says it)');
}

// ---- 3. whoseStep(): who acts next, shared approval said once ----
{
  const d = Object.values(S.drafts).flat().find(x => x.status === 'review'), b = M.billById(d.bill_id), h = M.draftHearing(d);
  const w = X.whoseStep(d, b, { viewer: KV, h });
  const can = S.advocates.filter(a => a.is_active !== false && M.canFirstApprove(a, d, h)).map(a => a.id);
  ok(w.role === 'approve' && w.ids.length === can.length && can.every(id => w.ids.includes(id)) && / or /.test(w.words), `a review waits on everyone who may give it, in one phrase: "${w.words}"`);
  ok(X.whoseStep(d, b, { viewer: NT, h }).you && /^you/.test(X.whoseStep(d, b, { viewer: NT, h }).words), 'the viewer is named "you", first');
  const ap = Object.values(S.drafts).flat().find(x => x.status === 'approved' && M.filerOf(x)), ab = M.billById(ap.bill_id);
  ok(X.whoseStep(ap, ab).ids.length === 1 && X.whoseStep(ap, ab).ids[0] === M.filerOf(ap), `ready to file is the filer's alone (model.js filerOf): ${X.whoseStep(ap, ab).words}`);
}

// ---- 4. actBy(): the W31 hand-on times ----
{
  const due = iso => hst(iso), h = until => ({ status: 'scheduled', scheduled_at: until });
  const w1 = X.actBy({ kind: 'write', due: due('2026-03-17T09:30:00-10:00'), h: h('2026-03-18T09:30:00-10:00') });
  ok(w1.kind === 'hand' && w1.at === due('2026-03-16T16:00:00-10:00') && w1.words === 'Send for approval by today 4:00 PM', `12 hours before 9:30 AM is 9:30 PM, overnight, so 4:00 PM the day before: "${w1.words}"`);
  const w2 = X.actBy({ kind: 'write', due: due('2026-03-17T20:00:00-10:00') });
  ok(w2.at === due('2026-03-17T08:00:00-10:00'), 'due 8:00 PM: 12 hours before is 8:00 AM, inside the day, so 8:00 AM');
  const w3 = X.actBy({ kind: 'submit', due: due('2026-03-17T04:00:00-10:00') });
  ok(w3.at === due('2026-03-16T16:00:00-10:00'), 'due 4:00 AM: 12 hours before is 4:00 PM exactly, kept');
  const w4 = X.actBy({ kind: 'write', due: due('2026-03-17T05:00:00-10:00') });
  ok(w4.at === due('2026-03-16T16:00:00-10:00'), 'due 5:00 AM: 12 hours before is 5:00 PM, overnight, so 4:00 PM the day before');
  const w5 = X.actBy({ kind: 'write', due: due('2026-03-17T18:30:00-10:00') });
  ok(w5.at === due('2026-03-16T16:00:00-10:00'), 'due 6:30 PM: 12 hours before is 6:30 AM, before 8:00 AM, so 4:00 PM the day before');
  const r = X.actBy({ kind: 'revise', due: due('2026-03-18T15:00:00-10:00') });
  ok(r.at === due('2026-03-17T16:00:00-10:00') && r.words === 'Resubmit by tomorrow 4:00 PM', `after a send-back the verb is Resubmit, same times: "${r.words}"`);
  const f = X.actBy({ kind: 'file', due: due('2026-03-16T13:10:00-10:00'), h: h('2026-03-17T13:10:00-10:00') });
  ok(f.kind === 'hand' && f.at === due('2026-03-16T11:10:00-10:00') && f.words === 'File by today 11:10 AM', `File by is 2 hours before: "${f.words}"`);
  const now = X.actBy({ kind: 'file', due: due('2026-03-16T10:00:00-10:00'), h: h('2026-03-17T10:00:00-10:00') });
  ok(now.kind === 'now' && now.words === 'File now · due today 10:00 AM', `the hand-on time gone and the deadline ahead, the row's and the card's one wording: "${now.words}"`);
  const late = X.actBy({ kind: 'file', due: due('2026-03-15T13:10:00-10:00'), h: h('2026-03-16T13:10:00-10:00') });
  ok(late.kind === 'late' && late.at === due('2026-03-16T13:10:00-10:00') && late.words === 'Late, still accepted until 1:10 PM today', `late: the time is the hearing's start, "until 1:10 PM": "${late.words}"`);
  const lt = X.actBy({ kind: 'file', due: due('2026-03-16T08:00:00-10:00'), h: h('2026-03-17T09:30:00-10:00') });
  ok(lt.words === 'Late, still accepted until 9:30 AM tomorrow', `late, a hearing tomorrow: "${lt.words}"`);
  // Approvals sit between the writer's time and the filer's, so an approver on time never makes the filing late.
  const ap = X.actBy({ kind: 'approve', due: due('2026-03-16T15:00:00-10:00'), h: h('2026-03-17T15:00:00-10:00') });
  const fb = X.actBy({ kind: 'file', due: due('2026-03-16T15:00:00-10:00'), h: h('2026-03-17T15:00:00-10:00') });
  ok(ap.kind === 'hand' && ap.words === 'Approve by today 11:00 AM' && ap.at < fb.at, `the first approval is 4 hours before the deadline, before File by (${fb.time}): "${ap.words}"`);
  const sl = X.actBy({ kind: 'second', due: due('2026-03-16T15:00:00-10:00') });
  ok(sl.at === due('2026-03-16T12:00:00-10:00') && sl.at > ap.at && sl.at < fb.at, `the second look is 3 hours before: "${sl.words}"`);
  ok(X.actBy({ kind: 'review', due: due('2026-03-16T15:00:00-10:00') }).at === ap.at, 'v5 Today\'s review task has the same time');
  const am = X.actBy({ kind: 'approve', due: due('2026-03-17T09:30:00-10:00') }), am2 = X.actBy({ kind: 'second', due: due('2026-03-17T09:30:00-10:00') }), amw = X.actBy({ kind: 'write', due: due('2026-03-17T09:30:00-10:00') });
  ok(am.at === due('2026-03-16T18:00:00-10:00') && am2.at === due('2026-03-16T19:00:00-10:00') && am.at > amw.at, `a 9:30 AM deadline: 4 hours before is 5:30 AM, so the evening before, after the writer's 4:00 PM: "${am.words}", second look "${am2.words}"`);
  let order = true; for (let m = 0; m < 24 * 60; m += 30) { const d0 = due('2026-03-17T00:00:00-10:00') + m * 6e4;
    const t = k => X.handTime(d0, { write: 12, approve: 4, second: 3, file: 2 }[k]);
    if (!(t('write') <= t('approve') && t('approve') < t('second') && t('second') < t('file'))) { order = false; console.log('  out of order at', new RealDate(d0).toISOString()); } }
  ok(order, 'for a deadline at any half hour of the day, the writer hands on, then the approver, the second look, and the filer, in that order');
  const od = X.actBy({ kind: 'todo', due: due('2026-03-14T17:00:00-10:00') });
  ok(od.kind === 'overdue', 'a to-do past its date is overdue');
  ok(X.handTime(due('2026-03-17T13:00:00-10:00'), 12) === due('2026-03-16T16:00:00-10:00'), 'due 1:00 PM: 1:00 AM is overnight, so 4:00 PM the day before');
}

// ---- 5. committeeName(): every committee code in demo/snapshot.json ----
{
  const snap = JSON.parse(readFileSync(new URL('demo/snapshot.json', ROOT)));
  const codes = new Set(), add = x => String(x || '').split(/[,\s]+/).filter(Boolean).forEach(c => { if (/^[A-Z]{2,4}(\/[A-Z]{2,4})*$/.test(c)) codes.add(c); });
  for (const c of snap.committees) add(c.code);
  for (const h of snap.hearings) add(h.committee);
  for (const b of snap.bills) { (b.referrals || []).forEach(add); add(b.committee); }
  for (const d of snap.drafts) add(d.committee);
  for (const m of snap.committeeMembers || []) add(m.committee);
  const bad = [...codes].filter(c => { const n = X.committeeName(c); return !n || /\b[A-Z]{2,4}\b/.test(n.replace(/\b(House|Senate)\b/g, '')) || !/^(House|Senate) /.test(n); });
  ok(!bad.length, `all ${codes.size} committee codes in the snapshot (joint ones too) have a short plain name with its chamber${bad.length ? '; missing: ' + bad.join(', ') : ''}`);
  ok(X.committeeName('TRN') === 'House Transportation' && X.committeeName('TRS') === 'Senate Transportation', 'TRN and TRS: House Transportation and Senate Transportation');
  ok(X.committeeName('HHS/CPN') === 'Senate Health and Human Services, and Commerce', `a joint referral: "${X.committeeName('HHS/CPN')}"`);
  ok(X.committeeName('HLT/HSH/CPC') === 'House Health, Human Services, and Consumer Protection', `three together: "${X.committeeName('HLT/HSH/CPC')}"`);
  ok(X.committeeName('HLT', { chamber: false }) === 'Health', 'without the chamber: "Health"');
  ok(X.committeeName('ZZQ') === 'ZZQ' && X.committeeName('') === '', 'an unknown code stays as it is (still searchable); none says nothing');
}

// ---- 6. versionWords() and deadlineWords() ----
{
  ok(X.versionWords('HD1') === 'House draft 1' && X.versionWords('SD2') === 'Senate draft 2' && X.versionWords('CD1') === 'Conference draft 1' && X.versionWords('FD1') === 'Floor draft 1', 'HD1, SD2, CD1, FD1 in words');
  ok(X.versionWords(null) === 'As introduced' && X.versionWords('') === 'As introduced', 'no version: As introduced');
  const vs = [...new Set(S.bills.map(b => b.current_version).filter(Boolean))], badv = vs.filter(v => /\b[HSCF]D\d/.test(X.versionWords(v)));
  ok(!badv.length, `every version in the practice data (${vs.join(', ')}) reads as words${badv.length ? '; not: ' + badv.join(', ') : ''}`);
  ok(X.deadlineWords('Second lateral', '2026-03-30') === 'must reach its last committee by Mon 3/30', `"${X.deadlineWords('Second lateral', '2026-03-30')}"`);
  ok(X.deadlineWords('Triple filing', '2026-03-19', { n: 3 }) === 'must clear their first committee by Thu 3/19', 'several bills: "their"');
  ok(X.deadlineWords('Sine die', '2026-05-07') === 'the session ends Thu 5/7', 'the last day says so');
}

// ---- 7. hearings and asks in one wording ----
{
  const quiet = x => S.hearings.filter(y => y.committee === x.committee && y.scheduled_at === x.scheduled_at).every(y => !(S.attend[y.id] || []).length);
  const h = S.hearings.find(x => x.status === 'scheduled' && new Date(x.scheduled_at) > Date.now() && quiet(x));
  ok(X.goingWords(h, { viewer: NT }) === 'Going: no one yet' || /^Going: /.test(X.goingWords(h, { viewer: NT })), `who is going, one phrase: "${X.goingWords(h, { viewer: NT })}"`);
  const rows = S.hearings.filter(x => x.committee === h.committee && x.scheduled_at === h.scheduled_at); (S.attend[rows[0].id] ??= []).push(KR.id);
  ok(X.goingWords(h, { viewer: NT }) === 'Going: Kris', `marked on one bill of the sitting, going to the sitting: "${X.goingWords(h, { viewer: NT })}"`);
  ok(X.goingWords(h, { viewer: KR }) === 'Going: you', 'the viewer says "you"');
  S.attend[rows[0].id] = S.attend[rows[0].id].filter(id => id !== KR.id);
}

// ---- 8. the practice seeds (V33): Patti, Julie, a partner approver, three chair asks ----
{
  ok(S.advocates.filter(a => a.initials === 'PH').length === 1 && S.advocates.filter(a => a.initials === 'JMM').length === 1, 'Patti and Julie are teammates once each');
  const heal = S.campaigns.find(c => c.name === 'HEAL').id, hiapa = S.campaigns.find(c => c.name === 'HIAPA').id;
  ok(PH.prefs.coalitions.includes(heal) && JMM.prefs.coalitions.includes(hiapa), 'Patti helps on HEAL, Julie on HIAPA');
  const lrHeal = Object.values(S.drafts).flat().filter(d => /^dd\d+$/.test(d.id) && (S.assignments[d.bill_id] || [])[0] === LR.id && (S.billCampaigns[d.bill_id] || []).includes(heal) && d.submitted_by);
  ok(lrHeal.length > 0 && lrHeal.every(d => d.submitted_by === PH.id), `Patti sent this week's testimony on Lauren's HEAL bills (${lrHeal.length})`);
  const sb = lrHeal.find(d => d.status === 'draft' && d.review_note);
  ok(!!sb && X.whoseStep(sb, M.billById(sb.bill_id), { viewer: PH }).you, 'a sent-back draft on a Lauren HEAL bill is Patti’s to revise');
  ok(S.issueHelpers.some(x => x.advocate_id === JMM.id && S.issues.find(i => i.id === x.issue_id)?.owner_id === RK.id), 'Julie helps on Rick’s issues');
  ok(S.advocates.some(a => a.approves_partners && !a.is_admin && a.is_active !== false), 'a non-admin partner approver (Jess, R-328)');
  const asks = S.bills.map(b => ({ b, a: X.askWords(b, { viewer: NT }) })).filter(x => x.a);
  const will = asks.find(x => x.a.key === 'waiting' && x.a.answer === 'will_schedule'), quiet = asks.find(x => x.a.key === 'waiting' && x.a.answer === 'asked' && x.a.followUp), give = asks.find(x => x.a.key === 'giving');
  ok(!!will && will.a.asker === LR.id, `one "will schedule": ${will ? will.b.bill_number + ' · ' + will.a.words : 'none'}`);
  ok(!!quiet && quiet.a.asker === KV.id, `one asked 4 working days ago with no reply, due a Follow up: ${quiet ? quiet.b.bill_number + ' · ' + quiet.a.words : 'none'}`);
  ok(!!give && give.a.who === KR.id, `one handed to Kris: ${give ? give.b.bill_number + ' · ' + give.a.words : 'none'}`);
  const kStep = give && X.billStep(give.b, { viewer: KR });
  ok(!!kStep && kStep.kind === 'chair' && kStep.you, 'the handed ask is Kris’s own step');
  const ask = asks.find(x => x.a.key === 'ask');
  ok(!!ask && /^Ask the chair by \w{3} \d+\/\d+$/.test(ask.a.words), `the ask's one wording: "${ask && ask.a.words}"`);
}

// ---- 9. rows say no codes (D15) and the card draws for everyone ----
{
  const codeRx = /\b(?:[HSCF]D\d|P1|[A-Z]{3}\/[A-Z]{3})\b|\b(?:HLT|HHS|CPN|CPC|FIN|WAM|JHA|JDC|TRN|TRS|EDU|EDN|HSH|PSM|EIG|LBT|AEN)\b/;
  const lines = [], codes = [];
  for (const who of [NT, KV, KR, PH, JMM, LR]) for (const b of S.bills.filter(x => x.position && x.position !== 'monitor')) { const s = X.billStep(b, { viewer: who }); lines.push(s.line); if (codeRx.test(s.line)) codes.push(`${b.bill_number}: ${s.line}`); }
  ok(!codes.length, `${lines.length} row lines (six people, every position bill) carry no Capitol code${codes.length ? '; e.g. ' + codes.slice(0, 3).join(' | ') : ''}`);
  let errs = 0; for (const who of [NT, KV, KR, PH, JMM]) for (const b of S.bills) { try { X.stepCard(b, { viewer: who }); X.billRow(b, { viewer: who }); } catch (e) { errs++; if (errs < 3) console.log(e); } }
  ok(!errs, 'stepCard and billRow draw for every bill as five people');
  const own = X.stepCard(M.billByNum('HB1523'), { viewer: NT }), other = X.stepCard(M.billByNum('HB1523'), { viewer: KV });
  ok(/Review and approve/.test(own) && /#\/review\//.test(own) && !/Review and approve|data-v6act="approve"/.test(other) && /approves the testimony/.test(other), 'own step: its button (Review mode first, P1); someone else’s: a status line and no button');
  ok((own.match(/btn primary/g) || []).length === 1, 'one filled button on a card');
  ok(!/btn primary/.test(X.stepCard(M.billByNum('HB1523'), { viewer: NT, primary: false })), 'primary: false leaves no filled button (the screen has its own)');
}

// ---- 9b. fresh-eyes fixes: nobody's step, the bill named, Follow up, filing order, amber only for one's own ----
{
  const strip = h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  // A draft nobody holds is nobody's own step: no filled button, "No one holds it yet", Take it.
  const nob = S.bills.map(b => ({ b, s: X.billStep(b, { viewer: JMM }) })).filter(x => x.s.nobody);
  ok(nob.length > 0 && nob.every(x => !x.s.you), `${nob.length} step(s) nobody holds are nobody's own step (Julie: ${nob.map(x => x.b.bill_number).join(', ')})`);
  const nb = nob.find(x => x.s.kind === 'file') || nob[0];
  if (nb) {
    const card = X.stepCard(nb.b, { viewer: JMM, where: 'today' }), t = strip(card);
    ok(!/btn primary/.test(card) && /No one holds it yet/.test(t) && /data-v6act="take"/.test(card) && !/Open to anyone|No owner yet/.test(t), `the card says it once, "No one holds it yet", with Take it and no filled button: ${nb.b.bill_number}`);
    ok(/no one holds it/.test(nb.s.line), `the row says so: "${nb.s.line}"`);
    ok(X.billStep(nb.b, { viewer: NT }).takeFor && !X.billStep(nb.b, { viewer: JMM }).takeFor, 'it reaches whoever may hand it (an admin, the issue’s owner), not everyone');
  }
  // The card names its bill where nothing else does, and not in the open item (its h2 does).
  const b1 = M.billByNum('HB1523'), today = X.stepCard(b1, { viewer: KR, where: 'today' }), pane = X.stepCard(b1, { viewer: KR, where: 'pane' });
  ok(/class="v6-step-bn">Let people cross/.test(today) && /<span class="sr">, Let people cross/.test(today) && !/v6-step-bn/.test(pane), 'Today’s card names the bill (and its heading says it to screen readers); the open item’s does not repeat its h2');
  // Follow up: the asker's own row and filled button after 3 working days with no reply.
  const fu = S.bills.map(b => ({ b, s: X.billStep(b, { viewer: KV }) })).find(x => x.s.kind === 'chair' && x.s.ask.followUp && x.s.you);
  ok(!!fu && /^Follow up with /.test(fu.s.line) && /no reply$/.test(fu.s.line), `the asker's row says to follow up: "${fu && fu.s.line}"`);
  if (fu) { const c = X.stepCard(fu.b, { viewer: KV, where: 'today' });
    ok(/btn primary[^"]*"[^>]*href="mailto:[^"]*Following%20up/.test(c) && /They replied/.test(c), 'its filled button emails the chair again (the subject says it follows up), They replied tonal');
    ok(X.rowButtonOK(fu.s) && /again/.test(X.billRow(fu.b, { viewer: KV })), 'the row carries the same Email the chair again'); }
  // Filing: File at the Capitol first and filled, Mark filed after it.
  const fl = S.bills.map(b => ({ b, s: X.billStep(b, { viewer: NT }) })).find(x => x.s.kind === 'file' && x.s.you);
  if (fl) { const c = X.stepCard(fl.b, { viewer: NT }), i = c.indexOf('File at the Capitol'), j = c.indexOf('Mark filed');
    ok(i > 0 && j > i && /btn primary[^>]*href="[^"]*capitol/i.test(c), `filing: File at the Capitol (filled) before Mark filed (${fl.b.bill_number})`); }
  // Amber and red only on one's own step or bill; anyone else reads the same words, neutral, with the clock.
  at('2026-03-17T08:00:00-10:00');
  let loud = 0, hushed = 0;
  for (const b of S.bills) { const s = X.billStep(b, { viewer: LR }); if (!['late', 'overdue'].includes(s.status.tone)) continue;
    const r = X.billRow(b, { viewer: LR }); if (s.mine) { if (/t-(late|overdue)/.test(r)) loud++; } else { if (/t-(late|overdue)/.test(r)) loud += 100; else hushed++; } }
  ok(loud < 100, `late rows coloured only for Lauren’s own steps or bills (${loud} coloured, ${hushed} neutral with a clock)`);
  at(MON9);
  // A time never parts from its AM/PM, a room from its number.
  ok(X.nw('due today 2:00 PM · Room 329') === 'due today <span class="v6-nw">2:00 PM</span> · <span class="v6-nw">Room 329</span>', 'times and rooms are kept on one line');
}

// ---- 10. V35: the weekly memo carries no programmer's note ----
{
  for (const audience of ['team', 'partners']) { S.memoView = { who: 'all', coalition: '', audience };
    const t = M.memoText(M.memoData()).replace(/https?:\/\/\S+/g, ''), hit = /\/\/|R-3\d\d|R-2\d\d/.exec(t);
    ok(!hit, `the ${audience} memo has no "//" or item number in it (links aside)${hit ? ': …' + t.slice(Math.max(0, hit.index - 60), hit.index + 40) : ''}`); }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
