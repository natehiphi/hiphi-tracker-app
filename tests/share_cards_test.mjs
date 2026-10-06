// The share cards' words and links (R-169, tools/share_cards.mjs), on made-up bills at fixed moments of a session: every
// title starts with the ask and names the bill with its number, the link opens that ask, dates are Hawaiʻi time, and a
// bill that is over asks people to follow its issue. No network.
//   node tests/share_cards_test.mjs
import { billState, asksFor, cardFor, committeeWords } from '../tools/share_cards.mjs';

let bad = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) bad++; };
const NOW = Date.parse('2026-03-16T19:00:00Z');   // Mon 16 Mar 2026, 9 am in Honolulu
const committees = { HLT: { name: 'Health', chamber: 'H' }, HHS: { name: 'Health and Human Services', chamber: 'S' }, JDC: { name: 'Judiciary', chamber: 'S' }, WAM: { name: 'Ways and Means', chamber: 'S' } };
const issue = { slug: 'fda-proof-to-sell-e-cigarettes', name: 'FDA proof to sell e-cigarettes' };
const deadlines = { second_lateral: { label: 'Second lateral', date: '2026-03-27T10:00:00Z' }, second_crossover: { label: 'Second crossover', date: '2026-04-09T10:00:00Z' } };
const base = { session_year: 2026, chamber: 'H', referrals: ['HLT', 'CPC', 'HHS', 'JDC/WAM'], origin_stops: 2, last_action: '', hiphi_position: 'support', hiphi_nickname: 'FDA proof required to sell e-cigarettes', hiphi_summary: 'Requires e-cigarette makers to show FDA approval.' };
const run = (b, hearings = []) => { const st = billState(b, { hearings, outcomes: {}, deadlineFor: k => deadlines[k] || null, now: NOW }); return { st, asks: asksFor(b, st), card: a => cardFor(b, a, st, { committees, issue }) }; };

// 1. A hearing ahead: testimony, with the committee, the hearing day and the deadline, in Hawaiʻi time.
const heard = { ...base, id: 'b1', bill_number: 'HB1573', stage: 'second_lateral', last_action: 'Referred to HHS, JDC/WAM.' };
let r = run(heard, [{ id: 'h1', bill_id: 'b1', committee: 'HHS', status: 'scheduled', scheduled_at: '2026-03-20T19:00:00Z', testimony_deadline: '2026-03-18T19:30:00Z' }]);
let c = r.card(r.st.ask);
ok(r.st.ask === 'testify', `a bill with a hearing ahead asks for testimony (${r.st.ask})`);
ok(c.title === 'Speak up by Wed, Mar 18: FDA proof required to sell e-cigarettes (HB 1573)', `the title leads with the ask and the deadline: ${c.title}`);
ok(/Tell the Senate Health and Human Services committee what you think before its hearing on Fri, Mar 20\. Testimony is due Wed, Mar 18 at 9:30 AM\. About 10 minutes; we help you write it\. HIPHI supports it\.$/.test(c.desc), `the words say who, when and how long: ${c.desc}`);
ok(c.hash === '#/bill/2026/HB1573/testify', `the link opens the testimony walkthrough on the exact bill: ${c.hash}`);
ok(r.asks.includes('testify') && r.asks.includes('ask') && r.asks.includes('follow'), `a live bill in committee gets testify, ask and follow pages: ${r.asks}`);

// 2. Waiting for its hearing in a committee: the chair's email, with the committee and its deadline.
const waiting = { ...heard, id: 'b2', bill_number: 'HB1518', hiphi_nickname: 'SNAP sign-up before prison release' };
r = run(waiting); c = r.card(r.st.ask);
ok(r.st.ask === 'ask', `a bill waiting for a hearing asks the chair (${r.st.ask})`);
ok(c.title === 'Ask for a hearing: SNAP sign-up before prison release (HB 1518)', c.title);
ok(/It needs a hearing in the Senate Health and Human Services committee by Fri, Mar 27 or it stops for this year\./.test(c.desc), c.desc);
ok(c.hash === '#/bill/2026/HB1518/ask', c.hash);
const held = { ...waiting, id: 'b3', hiphi_position: 'oppose' };
r = run(held); c = r.card('ask');
ok(c.title.startsWith('Ask the chair to hold: ') && /not to hear it/.test(c.desc) && /HIPHI opposes it\.$/.test(c.desc), `where HIPHI opposes, the chair is asked not to hear it: ${c.title} / ${c.desc}`);

// 3. The floor vote, the final version, the Governor.
r = run({ ...base, id: 'b4', bill_number: 'HB1', stage: 'second_floor' }); c = r.card(r.st.ask);
ok(r.st.ask === 'floor' && c.title === 'Ask your senator to vote yes: FDA proof required to sell e-cigarettes (HB 1)' && c.hash.endsWith('/floor'), `the floor vote: ${c.title}`);
ok(/full Senate by Thu, Apr 9/.test(c.desc), c.desc);
r = run({ ...base, id: 'b5', bill_number: 'HB2', stage: 'conference' }); c = r.card(r.st.ask);
ok(r.st.ask === 'conference' && c.title.startsWith('Ask lawmakers to pass it: ') && c.hash.endsWith('/conference'), `the final version: ${c.title}`);
r = run({ ...base, id: 'b6', bill_number: 'HB3', stage: 'governor', hiphi_position: 'strongly_oppose' }); c = r.card(r.st.ask);
ok(r.st.ask === 'governor' && c.title.startsWith('Ask the Governor to veto: ') && c.hash.endsWith('/governor') && r.asks.includes('governor'), `the Governor, where HIPHI opposes: ${c.title}`);

// 4. Over: law and stopped bills ask people to follow the issue, with the bill's news.
r = run({ ...base, id: 'b7', bill_number: 'HB1573', stage: 'enacted' }); c = r.card(r.st.ask);
ok(r.st.ask === 'follow' && c.title === 'Follow the issue: FDA proof to sell e-cigarettes' && /became law in 2026\./.test(c.desc) && c.hash === '#/issue/fda-proof-to-sell-e-cigarettes', `a law: ${c.title} / ${c.desc}`);
ok(r.asks.join() === 'follow', `a bill that is over has only its follow page: ${r.asks}`);
r = run({ ...base, id: 'b8', bill_number: 'HB1523', stage: 'dead' }); c = r.card(r.st.ask);
ok(/stopped in 2026\. Ideas like this often come back\./.test(c.desc) && !/speak up/i.test(c.title + c.desc), `a stopped bill never says speak up: ${c.desc}`);

// 5. A bill HIPHI only watches, with no everyday name: what it does comes first; no chair's email (no side).
r = run({ ...heard, id: 'b9', bill_number: 'SB2', hiphi_position: 'monitor', hiphi_nickname: null, hiphi_summary: 'Lets counties deny some liquor licence renewals' }, []);
c = r.card('testify');
ok(c.title === 'Speak up: SB 2' && c.desc.startsWith('Lets counties deny some liquor licence renewals.') && !r.asks.includes('ask'), `a watched bill: ${c.title} / ${c.desc} / ${r.asks}`);

// 6. A hearing whose testimony deadline has passed but the hearing is still ahead: by the hearing's day.
r = run(heard, [{ id: 'h2', bill_id: 'b1', committee: 'JDC/WAM', status: 'scheduled', scheduled_at: '2026-03-17T21:30:00Z', testimony_deadline: '2026-03-15T21:30:00Z' }]);
c = r.card('testify');
ok(c.title.startsWith('Speak up by Tue, Mar 17: ') && /the Senate Judiciary and Ways and Means committees/.test(c.desc) && !/Testimony is due/.test(c.desc), `late testimony: ${c.title} / ${c.desc}`);
ok(committeeWords('XYZ', committees) === 'the XYZ committee' && committeeWords('', committees) === 'the committee', 'an unknown committee still reads');

// 7. Each card's picture says its ask (Nate 10/5: "the share card is not specific about the action"); a law's says so.
const pic = (b, a, hs = []) => { const r = run(b, hs); return r.card(a).image; };
ok(pic(heard, 'testify') === 'testify' && pic(waiting, 'ask') === 'ask' && pic(held, 'ask') === 'hold', 'testimony, a hearing and a hold each have their picture');
ok(pic({ ...base, id: 'p1', bill_number: 'HB1', stage: 'second_floor' }, 'floor') === 'floor-yes' && pic({ ...base, id: 'p2', bill_number: 'HB3', stage: 'governor', hiphi_position: 'oppose' }, 'governor') === 'governor-veto', 'the floor and the Governor pictures follow HIPHI\'s side');
ok(pic({ ...base, id: 'p3', bill_number: 'HB1573', stage: 'enacted' }, 'follow') === 'law' && pic({ ...base, id: 'p4', bill_number: 'HB1523', stage: 'dead' }, 'follow') === 'follow', 'a law has the good-news picture, a stopped bill the follow one');

console.log(bad ? `\n${bad} FAILED` : '\nAll passed');
process.exit(bad ? 1 : 0);
