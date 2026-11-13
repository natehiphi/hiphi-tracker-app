// R-391 (Nate 13 Nov 2026): the training's challenge list inside the trial, under Challenges on the band, so staff can walk
// through it where they practise. Nate picked the items (picker artifact, 13 Nov: t6, t10, t15 and t21 left out) and the
// words follow R-392: "Leader", never "owner", and no Writer (the leader writes testimony and can hand it on).
// Where the app itself still shows an owner label until R-392 ships, the answers name the place without naming the label.
// Each person's ticks are kept in this browser only (per trial and per person acted as): nothing new in the database.

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// [id, for, the challenge, done when, where it is]
export const SECTIONS = [
  ['Before the clock moves', 'Everyone, first 10 minutes', [
    ['t1', 'All', 'Choose how the tracker reaches you, and save it', 'your choice (Slack, email or only in the app) is saved.', 'You (bottom left), then My settings, then Save.'],
    ['t2', 'All', 'Send yourself a test message', 'a PRACTICE DM from HIPHI Tracker (practice) is in your Slack.', 'My settings, then Send me a test DM. It can take up to 30 seconds. Email does not send yet in the trial.'],
    ['t3', 'All', 'Find the flowchart of a bill’s path and mark your role on it', 'the steps that are yours are marked as yours.', 'Help (the ? at the top), then How do I…, then pick your role under I’m the….'],
    ['t4', 'All', 'Find the issues you lead and the bills under them', 'you can say how many bills you lead.', 'My issues (yours show first), then Bills. A column shows who leads each bill.'],
  ]],
  ['Week 1 · Opening weeks', 'Wed 21 to Fri 30 Jan · new bills pour in', [
    ['t5', 'Leaders', 'Sort today’s new bills: track one under the right issue and leave one', 'the bill you tracked shows under its issue.', 'My issues, then Bills, then Sort new bills. Track, Not for us or Later.'],
    ['t7', 'Leaders', 'Find the bill in your issue that was given to the wrong teammate, and make it yours', 'you show as its leader.', 'My issues, your issue, its bills, then the bill’s page and Give to…, picking yourself.'],
    ['t7b', 'Leaders', 'Hand a bill to a teammate to cover, then take it back', 'the bill showed under their name, then yours again. Practise with Jaylen, Jess or Saya.', 'The bill’s page, then Give to…. On a bill with no leader, Take it.'],
    ['t8', 'Leaders', 'Set HIPHI’s position on one of your bills', 'the position shows in the Bills list.', 'The bill’s page, the position control near the top.'],
    ['t9', 'All', 'Follow the issue picked for you (under Yours, above)', 'it says you follow it and you get its alerts.', 'My issues, then All issues, the issue, then Follow.'],
  ]],
  ['Week 2 · Committee deadline', 'Tue 17 to Fri 20 Feb · bills must clear their committees', [
    ['t11', 'Leaders', 'Find which of your bills still need a hearing before the deadline', 'you can name one and its notice-by date.', 'Calendar, then Bills That Need Hearings. On a bill’s page, What’s next for you says the date.'],
    ['t12', 'Leaders', 'Ask a committee chair for a hearing, and record that you asked', 'the bill shows the ask was sent.', 'Calendar, then Bills That Need Hearings, Email the chair, then Did you send it? Send it only to yourself today.'],
    ['t13', 'All', 'Log a call or meeting with a legislator', 'the talk shows on the legislator’s page.', 'More, then Legislators, the legislator, then Log a talk.'],
    ['t14', 'All', 'Look up a Capitol word you don’t know (try “lateral” or “decking”)', 'you found the meaning in the tracker.', 'Help, then Capitol words. Stages and deadlines explains the calendar.'],
  ]],
  ['Week 3 · Hearing week', 'Mon 16 to Fri 20 Mar · testimony to write and send', [
    ['t16', 'Leaders', 'Write testimony for a bill with a hearing, and send it for approval', 'it shows under To approve.', 'Testimony, then To write. Write in the draft, then Send for approval.'],
    ['t17', 'Approvers', 'Approve one testimony, and send another back with a note', 'one is ready to file and one is under Sent back.', 'Testimony, then To approve: Approve, or Send back with a note.'],
    ['t18', 'Leaders', 'Fix testimony that was sent back and resubmit it', 'it is back under To approve.', 'Testimony, then Sent back, then Resubmit.'],
    ['t19', 'Leaders', 'Get approved testimony to the filing step and mark it filed', 'it shows as filed. Do not submit on the Capitol’s site.', 'Testimony, then Ready to file. The filing card has the PDF and the form’s answers; press Mark filed.'],
    ['t20', 'Outreach', 'Publish a public ask for a bill with a hearing, and copy this week’s asks for the newsletter', 'the ask is live in the trial and copied.', 'More, then Outreach, then This week’s asks.'],
  ]],
  ['Week 4 · End of session', 'Mon 13 to Fri 17 Apr · bills cross back', [
    ['t22', 'Leaders', 'Find out what happens next for a bill that passed both chambers in different forms', 'you can say what step comes next and who does it.', 'The bill’s page, What’s next for you. Help, then What to do at each moment.'],
    ['t23', 'All', 'Cover for a teammate who is out: see their list for today', 'you can see what they owe today.', 'More, then See a teammate’s list.'],
    ['t24', 'All', 'Hand one of your to-dos to someone else', 'it shows on their list.', 'The bill’s page, then Give to….'],
  ]],
  ['All through the trial', 'Any day, any page', [
    ['t25', 'All', 'Each morning, start from Today and do what it says first', 'you did one day’s top step without being told where to go.', 'Today, the first item in the menu.'],
    ['t26', 'All', 'Send at least three suggestions about anything that was hard to find or unclear', 'three are sent. You will see Nate’s answer to each.', 'Suggest, on this band, on any page.'],
  ]],
];

// The personal lists (R-385, practice project 13 Nov): the bills the trial holds back, the bill given to the wrong teammate in
// each leader's issue, and one issue to follow. By first name, as the team list names everyone.
const FIND = {
  Kevin: [[1, 'counties and tobacco sales', 'HB1563 · Let counties regulate tobacco sales'], [1, 'disposable e-cigarettes (House bill)', 'HB2121 · Disposable e-cigarette ban'], [3, 'disposable e-cigarettes (Senate bill)', 'SB2175 · Disposable e-cigarette ban']],
  Rick: [[1, 'liquor tax by alcohol content', 'HB1991 · Higher liquor taxes'], [1, 'DUI blood alcohol limit', 'SB2463 · Lower the DUI limit to .05']],
  Lauren: [[1, 'transit fares for youth', 'HB1879 · Free bus rides for kids'], [3, 'stopping at crosswalks', 'SB2695 · Drivers stop for people in crosswalks']],
  Patrick: [[2, 'dental hygienists, temporary fillings', 'HB1671 · Hygienists can place temporary fillings']],
  Kris: [[2, 'gender-affirming care', 'HB1875 · Protect gender-affirming care'], [2, 'pesticides near schools', 'SB2103 · Pesticide-free buffer zones'], [3, 'child and dependent care tax credit', 'HB2007 · Bigger child and dependent care credit']],
};
const YOURS = {
  Nate: ['Pilot to keep homes for local residents', 'HB1732, with Kris'], James: ['Plan for a changing climate', 'SB657 · UH climate resilience center, with Nate'],
  Kevin: ['Seizure of untaxed tobacco products', 'SB3076, with Rick'], Kris: ['Graduated tax on property sales', 'HB2049, with Nate'],
  Lauren: ['More red-light and school speed cameras', 'SB1667, with Patti'], 'May Rose': ['Protect preventive care and vaccines', 'HB1898, with Kris'],
  Patrick: ['Licenses for Canadian dental grads', 'SB481, with May Rose'], Patti: ['Let people cross during the countdown', 'HB1523, with Lauren'],
  Rick: ['Looser alcohol sales rules', 'HB108 · Beer and spirits shipped to homes, with Kevin'],
};
const FOLLOW = {
  Nate: ['Flavored tobacco sales ban', 'Kevin'], James: ['Pesticide-free buffer zones', 'Kris'], Jaylen: ['Free school meals for every student', 'Nate'],
  Jess: ['Paid family and medical leave', 'Kris'], Kevin: ['Higher liquor taxes', 'Rick'], Kris: ['Funding for Maui wildfire health study', 'James'],
  Lauren: ['More local food in school meals', 'Nate'], 'May Rose': ['Protect gender-affirming care', 'Kris'], Patrick: ['End non-medical vaccine exemptions', 'May Rose'],
  Patti: ['Protect students from extreme heat', 'James'], Rick: ['Higher tobacco and e-cigarette taxes', 'Kevin'], Saya: ['A higher minimum wage', 'Nate'],
};
// The team list's names are the people's own short names ("May Rose" is two words), so match the whole name first.
const keyOf = (name, table) => { const n = String(name || '').trim(); return table[n] ? n : Object.keys(table).find(k => n.split(' ')[0] === k) || null; };

// The person's own rows: [id, for, challenge, done when, where it is]
export function personalRows(name) {
  const rows = [], f = FIND[keyOf(name, FIND)], y = YOURS[keyOf(name, YOURS)], fo = FOLLOW[keyOf(name, FOLLOW)];
  (f || []).forEach(([wk, words, bill], i) => rows.push([`pf${i}`, 'Yours', `Find a hidden bill in week ${wk}: search “${words}”`, 'it is tracked under its issue, with HIPHI’s position, and you lead it.', bill + '. Search (Cmd or Ctrl and K), then Track on the bill’s page.']));
  if (y) rows.push(['py', 'Yours', `In your issue “${y[0]}”, find the bill a teammate was given by mistake, and make it yours`, 'you show as its leader.', y[1] + '. On the bill’s page, Give to…, then pick yourself.']);
  if (fo) rows.push(['pfo', 'Yours', `Follow the issue “${fo[0]}” (led by ${fo[1]})`, 'it says you follow it.', 'My issues, then All issues, the issue, then Follow.']);
  return rows;
}

const tickKey = (trialId, who) => `tr-ch-${trialId}-${who}`;
export function readTicks(trialId, who) { try { return JSON.parse(localStorage.getItem(tickKey(trialId, who)) || '{}') || {}; } catch { return {}; } }
export function saveTicks(trialId, who, t) { try { localStorage.setItem(tickKey(trialId, who), JSON.stringify(t)); } catch { /* private window: ticks last this visit */ } }

const row = ([id, who, title, done, where], ticks) => `<li class="tr-ch${ticks[id] ? ' done' : ''}">
  <input type="checkbox" id="trc-${id}" data-trch="${id}"${ticks[id] ? ' checked' : ''}>
  <div class="tr-cht"><label for="trc-${id}"><span class="tr-chwho">${esc(who)}</span>${esc(title)}</label>
    <span class="tr-quiet">Done when: ${esc(done)}</span>
    <details class="tr-chans"><summary>Show me</summary><p>${esc(where)}</p></details></div></li>`;

// The whole panel for one person (their name decides the Yours rows).
export function challengesHTML(name, ticks) {
  const mine = personalRows(name), all = [...mine, ...SECTIONS.flatMap(s => s[2])];
  const n = all.filter(r => ticks[r[0]]).length;
  const first = String(name || '').split(' ')[0];
  return `<h2 tabindex="-1">Challenges${first ? ` for ${esc(first)}` : ''}</h2>
    <p>Real jobs you will do in session. Try each one before you tap Show me. Stuck? Press Suggest and say what was hard to find.</p>
    <p class="tr-quiet" id="tr-chcount">${n} of ${all.length} done · ticks are kept in this browser</p>
    ${mine.length ? `<h3>Yours</h3><ul class="tr-chlist">${mine.map(r => row(r, ticks)).join('')}</ul>` : ''}
    ${SECTIONS.map(([h, sub, rows]) => `<h3>${esc(h)} <span class="tr-quiet">${esc(sub)}</span></h3><ul class="tr-chlist">${rows.map(r => row(r, ticks)).join('')}</ul>`).join('')}
    <p class="tr-quiet">One rule: do not file anything on the Capitol’s website. At the filing step, stop at the filing card and press Mark filed.</p>
    <div class="tr-dacts"><button class="btn secondary" type="button" data-tr="close">Close</button></div>`;
}
export const countOf = (name, ticks) => { const all = [...personalRows(name), ...SECTIONS.flatMap(s => s[2])]; return [all.filter(r => ticks[r[0]]).length, all.length]; };
