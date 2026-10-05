// The suggested bill's rules (pub/rank.js, R-094; backend docs/RECOMMENDATION-PLAN.md), checked on made-up bills so
// every number is exact. node tests/rank_test.mjs   (no server needed)
import { scoreOne, rankAll, shortList, markShown, sidePoints, WEIGHT, FIT, TIMING, PROOF, FATIGUE } from '../pub/rank.js';

let ok = 0, fail = 0;
const check = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); c ? ok++ : fail++; };
const NOW = Date.parse('2026-03-16T19:00:00Z'), DAY = 864e5;          // Mon 16 Mar 2026, 9:00 in Honolulu
const day = n => new Date(NOW - 10 * 3600e3 + n * DAY).toISOString().slice(0, 10);

// Issues: two in food, one in tobacco (top priority), one staff-recommended in care, one switched out of the first visit.
const I = {
  meals: { id: 'meals', categories: ['food'], bill_ids: ['m1', 'm2', 'm3'] },
  drinks: { id: 'drinks', categories: ['food'], bill_ids: ['d1', 'd2'] },
  vape: { id: 'vape', categories: ['tobacco'], bill_ids: ['v1', 'v2'], top_priority: true },
  clinic: { id: 'clinic', categories: ['care'], bill_ids: ['c1'], recommended: true },
  hidden: { id: 'hidden', categories: ['care'], bill_ids: ['x1'], first_visit: false },
  roads: { id: 'roads', categories: ['around'], bill_ids: ['r1', 'r2'] },
};
const issueOf = {}; for (const i of Object.values(I)) for (const id of i.bill_ids) issueOf[id] = i;
const bill = (id, pos = 'support', extra = {}) => ({ id, bill_number: 'HB' + id, hiphi_position: pos, coalitions: [], ...extra });
const cand = (b, days = 5, h = 'h-' + b.id) => ({ b, hearing: { id: h }, due: NOW + days * DAY });
const person = (o = {}) => ({ now: NOW, issuesOf: b => issueOf[b.id] ? [issueOf[b.id]] : [], catsOf: b => issueOf[b.id] ? issueOf[b.id].categories : [],
  catName: k => ({ food: 'Food & Nutrition', tobacco: 'Tobacco, Nicotine & Alcohol' })[k] || k,
  follows: new Set(), dismissed: new Set(), skips: new Set(), against: () => false,
  followCats: new Set(), pickedCats: new Set(), likedCoalitions: new Set(), actedCats: new Set(), seen: {}, people: () => null, ...o });
const P = person();

// 1. Hard rules.
check(scoreOne(cand(bill('m1', 'monitor')), P) === null, 'a monitored bill is never suggested');
check(scoreOne({ b: bill('m1'), hearing: null, due: null }, P) === null, 'a bill with no hearing is never suggested');
check(scoreOne(cand(bill('m1'), -0.1), P) === null, 'a bill whose testimony is past due is never suggested');
check(scoreOne(cand(bill('m1')), person({ follows: new Set(['m1']) })) === null, 'a followed bill is never suggested');
check(scoreOne(cand(bill('m1')), person({ dismissed: new Set(['m1']) })) === null, 'a dismissed bill is never suggested');
check(scoreOne(cand(bill('m1')), person({ skips: new Set(['m1']) })) === null, 'a bill marked Not for me is never suggested');
check(scoreOne(cand(bill('m1')), person({ against: b => b.id === 'm1' })) === null, 'a bill the person sides against HIPHI on is never suggested');
check(scoreOne(cand(bill('x1', 'strongly_support')), P) === null, 'a bill of an issue switched out of the first visit is never suggested (decision 5)');

// 2. HIPHI's priority.
const s = (b, p = P, days = 10) => scoreOne(cand(b, days), p);
check(s(bill('m1', 'strongly_support')).hiphi === 40, 'strongly supports: 40');
check(s(bill('m1', 'support')).hiphi === 20 && s(bill('m1', 'support_amend')).hiphi === 20, 'supports: 20');
check(s(bill('m1', 'oppose')).hiphi === 15, 'opposes: 15');
check(s(bill('m1', 'strongly_oppose')).hiphi === 40, 'strongly opposes, with a hearing: 40 (decision 6)');
check(s(bill('m1', 'neutral')).hiphi === 5, 'comments only: 5');
check(sidePoints([bill('m1', 'strongly_oppose')]) === 15 && sidePoints([bill('m1', 'strongly_oppose')], () => true) === 40,
  'an issue whose strongly opposed bill has no hearing stays at 15, with one it is 40');
check(s(bill('v1', 'support')).hiphi === 20 + WEIGHT.top, 'in a top-priority issue: +30');
check(s(bill('c1', 'support')).hiphi === 20 + WEIGHT.promoted, "staff's pre-tick on the issue: +25");
check(s(bill('m1', 'support', { hiphi_recommended: true })).hiphi === 20 + WEIGHT.promoted, "staff's pre-tick on the bill: +25");

// 3. Fit to the person.
check(s(bill('m1')).fit === 0, 'nothing known: no fit');
check(s(bill('m1'), person({ followCats: new Set(['food']) })).fit === FIT.interest, 'in a category they follow: +30');
check(s(bill('m1'), person({ pickedCats: new Set(['food']) })).fit === FIT.interest, 'in a category they picked: +30, the same (decision 3)');
check(s(bill('m1', 'support', { coalitions: ['Keiki'] }), person({ likedCoalitions: new Set(['Keiki']) })).fit === FIT.interest, 'a coalition of a bill they follow: +30');
check(s(bill('m1'), person({ followCats: new Set(['food']), actedCats: new Set(['food']) })).fit === FIT.interest + FIT.acted, 'has spoken up in the category before: +10 more');
check(s(bill('m1'), person({ skips: new Set(['m2']) })).fit === FIT.sibling, 'Not for me on another bill of the issue: -15');
check(s(bill('m1'), person({ skips: new Set(['m2']), dismissed: new Set(['m3']) })).fit === FIT.siblingFloor, 'two of them: -30');
check(s(bill('d1'), person({ skips: new Set(['m2', 'm3']) })).fit === 0, 'Not for me on bills of another issue changes nothing');
const near = person({ relatedTo: new Map([['drinks', 'School meals']]), followCats: new Set(['food']) });
check(s(bill('d1'), near).fit === FIT.related, 'in an issue related to one they follow: +60, not the +30 of the category (095)');
check(s(bill('d1'), near).why === 'Close to School meals, an issue you follow', 'reason: close to the issue they follow');
check(s(bill('m1'), near).fit === FIT.interest, 'a bill whose issue is not related gets only the category');

// 4. Timing, others acting, fatigue.
check(s(bill('m1'), P, 1.5).timing === TIMING.twoDays && s(bill('m1'), P, 5).timing === TIMING.week && s(bill('m1'), P, 10).timing === 0, 'due within 2 days +20, within 7 days +15, later 0');
check(s(bill('m1'), person({ people: () => 12 })).proof === PROOF && s(bill('m1'), person({ people: () => null })).proof === 0, 'ten or more people acted: +5');
const seen = n => ({ m1: { h: 'h-m1', days: Array.from({ length: n }, (_, k) => day(-1 - k)) } });
check(s(bill('m1'), person({ seen: seen(2) })).fatigue === 0, 'shown on 2 earlier days: no change');
check(s(bill('m1'), person({ seen: seen(3) })).fatigue === FATIGUE.points, 'shown on 3 earlier days with no response: -20 (decision 4)');
check(s(bill('m1'), person({ seen: seen(5) })) === null, 'shown on 5 earlier days: not suggested');
check(scoreOne(cand(bill('m1'), 10, 'h-new'), person({ seen: seen(5) })) !== null, 'a new hearing starts the count again');
check(s(bill('m1'), person({ seen: { m1: { h: 'h-m1', days: [day(0), day(0)] } } })).fatigue === 0, 'today does not count against it');

// 5. The reason line.
check(s(bill('m1'), person({ followCats: new Set(['food']) })).why === 'In Food & Nutrition, an area you follow', 'reason: an area they follow');
check(s(bill('v1', 'support'), person({ followCats: new Set(['tobacco']) })).why === 'One of HIPHI’s top priorities', 'reason: HIPHI when its part is bigger');
check(s(bill('c1', 'support')).why === '', "staff's pre-tick is never named");
check(!/recommend/i.test(JSON.stringify(rankAll(Object.keys(issueOf).map(id => cand(bill(id, 'strongly_support'))), P).map(r => r.why))), 'no reason says "recommended"');

// 6. The short list.
const pool = [cand(bill('m1', 'strongly_support'), 1), cand(bill('m2', 'strongly_support'), 1), cand(bill('m3', 'support'), 1),
  cand(bill('d1', 'strongly_support'), 2), cand(bill('d2', 'support'), 2), cand(bill('v1', 'support'), 6), cand(bill('r1', 'support'), 9), cand(bill('r2', 'neutral'), 9)];
const ids = l => l.map(r => r.b.id);
let L = shortList(rankAll(pool, P), 4);
check(new Set(L.map(r => r.issues[0].id)).size === L.length, `one bill per issue (${ids(L)})`);
check(L.filter(r => r.cats[0] === 'food').length <= 2, 'at most two per category');
check(L[0].b.id === rankAll(pool, P)[0].b.id && L[0].b.id === 'v1', `the best score leads: a supported bill in a top-priority issue, 20+30+15 = 65, beats a strongly supported one, 40+20 = 60 (${L[0].b.id})`);
const foodie = person({ followCats: new Set(['food']) });
L = shortList(rankAll(pool, foodie), 4, 1);
check(L.filter(r => r.cats[0] === 'food').length <= 3 && L.filter(r => r.cats[0] === 'food').length >= 2, `someone with one interest gets up to three from it (${ids(L)})`);
const roads = person({ followCats: new Set(['around']) });
const weak = [cand(bill('m1', 'strongly_support'), 1), cand(bill('d1', 'strongly_support'), 1), cand(bill('v1', 'strongly_support'), 1), cand(bill('c1', 'strongly_support'), 1), cand(bill('r2', 'neutral'), 12)];
L = shortList(rankAll(weak, roads), 4, 1);
check(L.some(r => r.b.id === 'r2') && L[2].b.id === 'r2', `a place kept for the person's own interests, third (${ids(L)})`);
const plain = [cand(bill('m1'), 1), cand(bill('d1'), 1), cand(bill('r1'), 1), cand(bill('r2'), 1), cand(bill('v2', 'oppose'), 12)];
L = shortList(rankAll(plain, person({ followCats: new Set(['food', 'around']) })), 4, 2);
check(L[3] && L[3].b.id === 'v2', `a place kept for HIPHI's top pick, fourth (${ids(L)})`);
check(shortList(rankAll(pool.slice(0, 2), P), 4).length === 1, 'two bills of one issue make a list of one');
check(shortList(rankAll(pool, P), 1)[0].b.id === shortList(rankAll(pool, P), 4)[0].b.id, "Home's one is Find's first");

// 7. Remembering what was shown.
const mem = markShown({}, [cand(bill('m1'))], NOW); markShown(mem, [cand(bill('m1'))], NOW + 3600e3);
check(mem.m1.days.length === 1, 'shown twice in a day counts once');
markShown(mem, [cand(bill('m1'))], NOW + DAY);
check(mem.m1.days.length === 2, 'the next day counts again');
markShown(mem, [cand(bill('m1'), 5, 'h-other')], NOW + 2 * DAY);
check(mem.m1.h === 'h-other' && mem.m1.days.length === 1, 'a new hearing starts afresh');

console.log(`${ok} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
