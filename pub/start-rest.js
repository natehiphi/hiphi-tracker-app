// HIPHI public tracker: the first visit after the topics screen (R-122, the split of 2 Oct): the issues, the lesson,
// why your voice counts, your legislators, the email ask, the finale, and the lessons' own pages. start.js draws the
// frame and the topics screen with the kernel alone and loads this module right after that first paint; every helper
// shared with it is imported from start.js (a read-only view of its state: the lessons through lessons()).
import { askAlerts, plural, isOff, pickedIssues, ranker, issueInfo, byScore, catScore, TOP_PICKS, PER_CAT, andList, skel, loadErr, total, shell, topRow, shown, hasPos, poolBills, viaFollowed, lessonsAsk, LZ, artFor, learnName, mailSent, shortDay, viaIssueOf, sureWide, sayRow, welcome, clearFlash, flash, busy, track, goStep, finish, barRetry, barBusy, bar2, bar1, barSkip, lessons } from './start.js';
import { S, DEMO, app, esc, icon, blurb, nick, spaced, alive, sessionInfo, wiz, wizSet, HST, hstDay, anyBill, legTitle, legPhoto, ensureRecapPool, issuesIn, issueBills, issueFollowed, followedIssues, followsAnything, viaIssue, setFollows, issuesOf, toggleWatch, timeWord, ensureBill, supa, hearingsOf, didKind, textSaved } from './core.js';
import { btn, chip, posChip } from './ui.js';
import { CAPITOL, flower } from './art.js';
import { createAddressPicker } from './addresspicker.js';
import { burst, celebrate, later, reduced, petals } from './fx.js';
import { shareLine, keepLine } from './keep.js';
import { endHome, armOf } from './variant.js';
import { alertFields, alertButton, wireAlertForm, alertDoneHTML, changeBtn, fmtPhone, codeStep, alertStatus, almostLine, alertRowHTML, wireAlertRow } from './alerts.js';
const followLabel = n => n ? `Follow ${plural(n, 'issue')}` : 'Follow issues';

// ================= Importance (Nate, 9/21): what HIPHI backs hardest and the team's top priority lead =================
// An issue's importance, used only for order (FIRST-VISIT-PLAN "Importance"): HIPHI's strongest position on a moving
// bill in it (strongly support 40, support 20, only opposes 15, neutral 5); the team's priority 1 on one of its bills
// (public_issues.top_priority: only this flag is public, never a bill's priority) +30; recommended by staff (the issue
// or one of its bills) +25; a hearing in the next 7 days +15; 3 for each moving bill, up to 3. Between sessions
// "moving" means any of last session's bills, there is no hearing term, and an issue already won loses 25 so the open
// fights lead. A category's importance is the sum of its top four. Staff can leave an issue out of the first visit
// altogether (issues.first_visit, the switch in Staff v2 Outreach > Issues).
const sigOf = (off, sel) => `${off ? 'off' : 'in'}|${sel.map(i => i.topicKey || i.key).join('|')}`;
function model2() {
  const off = isOff(), sel = pickedIssues(), sig = sigOf(off, sel), yr = sessionInfo().recapYear;
  if (!sel.length) return { none: true };
  if (!S.issues.length) return { err: true, sig, sel };
  if (off && !(S.recapPool && S.recapPool.yr === yr)) {
    if (S.recapFailed === yr) return { err: true, sig, sel };
    ensureRecapPool(yr); return { loading: true, sig, sel };
  }
  const R = ranker(), w = wiz();
  const per = sel.map(c => ({ c, rows: c.rows && c.rows.length ? c.rows : (c.issues || []).map(i => issueInfo(i, R)).sort(byScore) }))
    .sort((a, b) => catScore(b.rows) - catScore(a.rows));
  // An issue in two picked categories (the DUI limit is alcohol policy and road safety) is shown once, in the more
  // important one, so it is never ticked in one place and hidden in another (the review, 9/21).
  const once = new Set();
  per.forEach(p => { p.rows = p.rows.filter(x => !once.has(x.i.id) && once.add(x.i.id)); });
  // full: every issue of the category in play (what "Follow all" counts and follows); rows: the three shown under it.
  per.forEach(p => { p.full = p.rows; });
  const top = per.flatMap(p => p.full).sort(byScore).slice(0, TOP_PICKS), topIds = new Set(top.map(x => x.i.id));
  per.forEach(p => { p.rows = p.full.filter(x => !topIds.has(x.i.id)).slice(0, PER_CAT); p.open = S.stOpen[p.c.topicKey] ?? true; });
  const all = [...top, ...per.flatMap(p => p.rows)];
  // What is ticked: what the person chose on this screen once they have touched it, else HIPHI's defaults.
  let picks = w.picksFor === sig && w.picks && !Array.isArray(w.picks) ? w.picks : null;
  if (!picks) {
    // Ticked for you only where the person can see it, and only at the top (B-12): the staff-recommended and strongly
    // supported among the four most important, else the first of them.
    const pro = top.filter(x => x.promoted);
    picks = { issues: (pro.length ? pro : top.slice(0, 1)).map(x => x.i.id), cats: [] };
  }
  const catOn = new Set(picks.cats), issueOn = new Set(picks.issues);
  const ticked = x => issueOn.has(x.i.id) || x.i.categories.some(c => catOn.has(c));
  const count = new Set(all.filter(ticked).map(x => x.i.id)).size;
  return { off, sig, sel, per, top, all, picks, catOn, issueOn, ticked, count, R };
}
// One issue to follow. The whole card is the toggle (a real button). Where its description is cut, a small "What it
// does" button opens it in place, on the card's bottom edge beside the toggle rather than inside it.
S.stWhat ??= new Set();
function issueCard(x, m, secKey, extra) {
  const i = x.i, on = m.ticked(x), tid = `st-w-${secKey}-${i.slug}`, open = S.stWhat.has(tid);
  const h = x.inf && x.inf.h, within8 = h && new Date(h.scheduled_at) - Date.now() < 8 * 864e5;
  const day = within8 ? (hstDay(h.scheduled_at) === hstDay(Date.now()) ? 'today' : new Date(h.scheduled_at).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short' })) : '';
  const top = day ? chip(`Hearing ${day}`, 'info', 'calendar') : m.off && x.law ? chip(`Became law in ${sessionInfo().recapYear}`, 'ok', 'circle-check') : '';
  const n = m.off ? x.bills.length : x.live.length, b = x.lead, billsText = n > 1 ? `${n} bills${b ? `, including ${spaced(b.bill_number)}` : ''}` : b ? spaced(b.bill_number) : '';
  return `<li class="st-pcard${on ? ' on' : ''}${open ? ' st-open' : ''}${extra ? ' st-extra' : ''}"${extra && !S.stMore[secKey] ? ' hidden' : ''}>
    <button type="button" class="st-pick" data-stpick="${esc(i.id)}" data-stcat="${esc(secKey)}" aria-pressed="${on}">
      <span class="st-tick" aria-hidden="true">${icon('check')}</span>
      <span class="st-pbody">
        ${top ? `<span class="st-ptop">${top}</span>` : ''}
        <span class="st-phead">${esc(i.name)}</span>
        ${i.description ? `<span class="st-pwhat st-clamp" id="${tid}">${esc(i.description)}</span>` : ''}
        <span class="st-pmeta"><span>${esc(billsText)}</span>${x.pos ? posChip({ hiphi_position: x.pos }) : ''}</span>
      </span></button>
    ${i.description ? `<button type="button" class="st-what" data-stwhat="${esc(tid)}" aria-expanded="${open}" aria-controls="${tid}" hidden><span>What it does<span class="sr">: ${esc(i.name)}</span></span>${icon('chevron-down')}</button>` : ''}</li>`;
}
// Show "What it does" only on cards whose text is really cut off at this width (or is open, so it can be closed).
function fitWhat() {
  document.querySelectorAll('.st-pcard:not([hidden])').forEach(card => {
    const t = card.querySelector('.st-clamp'), w = card.querySelector('.st-what'); if (!t || !w) return;
    const need = card.classList.contains('st-open') || t.scrollHeight > t.clientHeight + 1;
    w.hidden = !need; card.classList.toggle('st-haswhat', need);
  });
}
let fitT = 0;
window.addEventListener('resize', () => { cancelAnimationFrame(fitT); fitT = requestAnimationFrame(fitWhat); });
const catAll = (c, n, all) => `${btn(`${all ? 'Following all' : 'Follow all'}<span class="sr"> of ${esc(c.key)}</span>`, { kind: 'text', sm: true, icon: all ? 'check' : 'star', cls: all ? 'on' : '', attrs: { 'data-stfollowcat': c.topicKey, 'aria-pressed': String(all) } })}
  <p class="st-catnote">${all ? 'New issues HIPHI takes up too.' : n > 1 ? `All ${n}, plus new ones.` : 'Plus any new ones.'}</p>`;
// One <details> per category. The first always starts open; a small one (four issues or fewer) also starts open; a busy
// one past the first starts folded, and then says what is ticked inside it (A-14). Its heading has no count: it said
// "16 issues" over the three listed (Nate 10/4, R-136); the whole topic is counted once, beside "Follow all", which
// follows all of them.
S.stOpen ??= {};
S.stMore ??= {};
function pickedLine(p, m) {
  if (m.catOn.has(p.c.topicKey)) return 'Following all';
  const on = p.full.filter(m.ticked).map(x => x.i.name);
  return !on.length ? '' : `${on.length} ticked: ${andList(on)}`;
}
function catSection(p, m) {
  const c = p.c, n = p.full.length, open = p.open, said = pickedLine(p, m);
  return `<details class="st-tsec"${open ? ' open' : ''} data-stsec="${esc(c.topicKey)}">
    <summary><span class="st-tsum">${icon(c.icon)}<span class="st-tnamebox"><span class="st-tname">${esc(c.key)}</span><span class="st-tpicked" data-stpicked="${esc(c.topicKey)}"${said ? '' : ' hidden'}>${esc(said)}</span></span></span>${icon('chevron-down', { cls: 'st-tchev' })}</summary>
    <div class="st-tbody2"><div class="st-catall" data-stcatall="${esc(c.topicKey)}">${catAll(c, n, m.catOn.has(c.topicKey))}</div>
      ${p.rows.length ? `<ul class="st-picks" role="list">${p.rows.map(x => issueCard(x, m, c.topicKey, false)).join('')}</ul>`
        : `<p class="st-catnote">${n === 1 ? 'Its issue is' : 'Its issues are'} in the list above.</p>`}
    </div></details>`;
}
// A category with nothing in play right now can still be followed whole: its issues and bills come as they start.
const quietCat = (c, m) => `<li class="card st-quiet"><span class="st-ilead">${icon(c.icon)}</span>
    <span class="st-ibody"><span class="st-iname">${esc(c.key)}</span><span class="st-idesc">Nothing is moving on it right now.</span></span>
    <div class="st-catall" data-stcatall="${esc(c.topicKey)}">${catAll(c, 0, m.catOn.has(c.topicKey))}</div></li>`;
function stepIssues(step) {
  const off = isOff(), m = model2();
  if (m.none || m.loading) return skel(step);
  if (m.err) return loadErr(step);
  const si = sessionInfo(), yr = off ? si.recapYear : si.yr, next = si.nextOpen ? +si.nextOpen.slice(0, 4) : yr + 1;
  const groups = m.per.filter(p => p.full.length), quiet = m.per.filter(p => !p.full.length).map(p => p.c);
  const total = new Set(m.all.map(x => x.i.id)).size, ticked = m.count;
  // R-138 (Nate 10/4): "Most important first" left visitors asking important to whom, and nothing asked them to pick
  // more than one. The lede now asks for every issue they care about; the top heading says whose top issues they are.
  const lede = !total ? `Nothing is moving on ${andList(quiet.map(c => c.key))} right now. Follow ${quiet.length === 1 ? 'it' : 'them'} anyway, and new issues and bills come to you as they start.`
    : off ? `Tick every issue you care about, as many as you like, and their ${next} bills come to you.`
    : ticked ? `Tick every issue you care about. We ticked ${ticked === 1 ? 'one' : ticked} to start.` : 'Tick every issue you care about, as many as you like.';
  return shell('st2', `${topRow('issues', step)}
    <h1 class="hero" id="st-h">Your issues</h1><p class="lede">${lede}</p>`,
    `<div class="st-say"><p class="st-alert" id="st-alert" role="alert"></p></div>
    ${m.top.length ? `<section class="st-topsec" aria-labelledby="st-toph"><h2 class="st-toph" id="st-toph">${off ? `HIPHI’s top issues in ${yr}` : 'HIPHI’s top issues right now'}</h2>
      <ul class="st-picks" role="list">${m.top.map(x => issueCard(x, m, 'top', false)).join('')}</ul></section>` : ''}
    ${groups.length ? `${m.top.length ? `<h2 class="st-toph st-moreh">More in your topics</h2>` : ''}<div class="st-tsecs" role="group" aria-label="More in your topics">${groups.map(p => catSection(p, m)).join('')}</div>` : ''}
    ${quiet.length ? `<ul class="st-quiets" role="list">${quiet.map(c => quietCat(c, m)).join('')}</ul>` : ''}`);
}

// ================= What was followed, still moving =================
// The issues just followed, most urgent first, each with its bills still moving (then bills followed on their own).
// "Coming up" and the finale read it. (It also fed a "Where do you stand?" screen here, removed 9/26, R-053: the
// answer changed nothing the person saw next (C-13), and the bill page asks it where it matters.)
function standIdeas() {
  const R = ranker(), w = wiz(), seen = new Set(), out = [];
  for (const id of [...(w.followedIssues || []), ...followedIssues().map(i => i.id)]) {
    if (seen.has(id)) continue; seen.add(id);
    const i = S.issueById.get(id); if (!i || !issueFollowed(i)) continue;
    const bills = issueBills(i).filter(bid => S.watch.has(bid)).map(bid => S.bills.find(b => b.id === bid) || anyBill(bid)).filter(b => b && alive(b)).sort(R.cmp);
    if (bills.length) out.push({ key: 'i:' + i.id, name: i.name, desc: i.description || '', bills });
  }
  for (const b of S.bills) if (S.direct.has(b.id) && !viaIssue(b) && alive(b)) out.push({ key: 'b:' + b.id, name: nick(b) || null, desc: blurb(b, 140), bills: [b] });
  return out;
}
const followedBills = () => standIdeas().flatMap(x => x.bills);

// ================= How it works: the story of the person's own bill (pub/lessons.js) =================
// The example (decision 6, which answers R-020). In session: the first followed issue, in the order the person picked
// categories and then screen 2's order, with a bill that has a scheduled hearing in the next 7 days; else a followed
// bill alive in its second chamber; else the most advanced followed bill. Between sessions: a 2026 law with a HIPHI
// position in the first picked category; else the next category's; else SB 2175. From a shared bill: that bill. Never
// a bill in an issue staff left out of the first visit.
let exCache = null, exKey = '';
export function exampleBill() {
  const off = isOff(), w = wiz();
  if (S.learnBill && location.hash.startsWith('#/learn/')) { const lb = anyBill(S.learnBill); if (lb) return lb; }   // a lesson opened from a bill page teaches on that bill
  if (w.via) return anyBill(w.viaId) || S.bills.find(b => b.bill_number === w.via) || null;
  const left = b => issuesOf(b).length && issuesOf(b).every(i => !shown(i));
  if (off) {
    // Last session's bills load once per visit (a person who skipped the first screens has not loaded them yet); the
    // lesson waits for them rather than drawing nothing.
    const yr = sessionInfo().recapYear; if (!(S.recapPool && S.recapPool.yr === yr)) { ensureRecapPool(yr); return null; }
    const R = ranker(), cats = [...new Set([...(w.followedCats || []), ...pickedIssues().map(c => c.topicKey), ...followedIssues().map(i => i.category)])];
    for (const k of cats) for (const i of issuesIn(k).filter(i => shown(i) && issueFollowed(i))) {
      const law = issueInfo(i, R).bills.find(b => b.stage === 'enacted' && hasPos(b)); if (law) return law; }
    const recap = (S.recapPool && S.recapPool.bills) || [];
    return recap.find(b => b.bill_number === 'SB2175') || anyBill((recap.find(b => b.stage === 'enacted' && hasPos(b)) || {}).id) || recap.find(b => b.stage === 'enacted') || null;
  }
  const R = ranker(), bills = followedBills().filter(b => !left(b));
  const soon = b => { const h = R.soon.get(b.id); return h && new Date(h.scheduled_at) - Date.now() < 7 * 864e5; };
  const second = b => /^second|conference/.test(b.stage || '');
  const pick = bills.find(soon) || bills.find(second) || bills[0];
  if (pick) return pick;
  // Nothing followed (Skip on the first screen): one HIPHI is working on, with a hearing ahead if there is one.
  const pool = poolBills().filter(b => hasPos(b) && !left(b)).sort(R.cmp);
  return pool.find(b => b.hiphi_position === 'strongly_support' && soon(b)) || pool.find(soon) || pool[0] || null;
}
// An example the page has not loaded in full (a law between sessions, a bill HIPHI works on that nobody here follows) is
// fetched once with its hearings, then the lessons redraw with its real hearing instead of a made-up one.
S.exLoading ??= new Set();
// Between sessions the example is a law whose hearings are months old, older than the public hearings view keeps (30
// days), so its whole history comes from public_bill_hearings (migration 070), once, merged into what is loaded.
S.histLoading ??= new Set();
async function fullHistory(b) {
  if (DEMO || !b || S.histLoading.has(b.id)) return;
  S.histLoading.add(b.id);
  try {
    const { data, error } = await (await supa()).rpc('public_bill_hearings', { bill: b.id }); if (error) throw error;
    const have = new Map(((S.xh || {})[b.id] || []).map(h => [h.id, h]));
    for (const r of data || []) {
      have.set(r.id, { ...have.get(r.id), id: r.id, bill_id: r.bill_id, bill_number: b.bill_number, committee: r.committee, scheduled_at: r.scheduled_at,
        room: r.room, status: r.status, testimony_deadline: r.testimony_deadline, notice_posted_at: r.notice_posted_at });
      if (r.outcome) S.outcomes[r.id] = { hearing_id: r.id, bill_id: r.bill_id, committee: r.committee, scheduled_at: r.scheduled_at, outcome: r.outcome };
    }
    S.xh[b.id] = [...have.values()];
    exKey = ''; app.render();
  } catch (e) { console.error(e); }   // the lesson keeps its labelled example hearing
}
function example() {
  const w = wiz(), b = exampleBill(), full = !!b && (S.bills.some(x => x.id === b.id) || !!(S.xh || {})[b.id]);
  // Between sessions the example is already on the page (last session's bills) and only its hearings are missing:
  // one load, the full history. Two loads raced, and the 30-day one emptied what the full one had filled.
  if (b && isOff()) fullHistory(b);
  else if (b && !full && !S.exLoading.has(b.id)) { S.exLoading.add(b.id); ensureBill(b.bill_number, b.session_year).then(() => { exKey = ''; app.render(); }).catch(() => {}); }
  // A lesson opened from a bill page says it is that bill's story.
  const via = S.learnBill && location.hash.startsWith('#/learn/') && b && b.id === S.learnBill ? 'bill' : w.via ? (viaFollowed() ? 'followed' : 'link') : '';
  const key = `${isOff()}|${via}|${b ? b.id : ''}|${full}|${[...S.watch].length}|${S.bills.length}|${(S.recapPool || {}).yr || ''}`;
  if (!lessonsAsk()) return null;   // the lessons are still on their way: the step draws a skeleton and comes back
  if (key !== exKey) { exKey = key; exCache = lessons().exampleFrom(b, { off: isOff(), via }); }
  return exCache;
}
// ================= The short version's one page: why your voice matters (R-067 #11) =================
// Nate's words, 9/28 (option B of three: written for someone who has never written to a lawmaker, so it answers "I
// don't know enough" rather than explaining the Capitol; the lessons below do that). Three short points, the person's
// own bill when there is one, and the drawn story one tap away for anyone who wants it (R-062). The lede says others
// write in and theirs joins them, not that lawmakers hear from "far fewer people than you'd think": telling people few
// others act makes not acting sound normal, and messages saying many take part do better (R-171, R-164's research).
function stepVoice(step) {
  const E = example(), off = isOff(), b = exampleBill();
  const pts = [
    ['mail', 'They read what you send', 'Before a committee votes on a bill, its members read the notes people send.'],
    ['message-circle', 'You don’t need to be an expert', 'Say who you are and why it matters to you. That’s enough.'],
    // R-099: the version that ends on Home says how, not only when.
    endHome() ? ['notebook-pen', 'We help you do it', `When ${off ? 'the session opens and ' : ''}a bill on your issues has a hearing, your home page shows what to do by when, and we walk you through it.`]
      : ['bell', 'We tell you when', off ? 'When the session opens and a bill on your issues has a hearing, we tell you what to do and by when.' : 'When a bill on your issues has a hearing, we tell you what to do and by when.'],
  ];
  const story = `<a href="#/learn/story${b ? '/' + esc(b.id) : ''}">See how a bill becomes law</a>`;
  return shell('st1 st-voicepage', `${topRow('voice', step)}${artFor('voice')}
    <h1 class="hero" id="st-h">Your voice counts here</h1>
    <p class="lede">People all over Hawaiʻi write to lawmakers every session. Your note joins theirs.</p>`,
    `<ol class="st-voice" role="list">${pts.map(([ic, h, p]) => `<li><span class="st-vic">${icon(ic)}</span><div><b>${esc(h)}</b><span>${esc(p)}</span></div></li>`).join('')}</ol>
    ${E && E.name ? `<p class="st-voiceex">${icon('file-text')}<span>${off ? `Like <b>${esc(E.name)}</b>, one of the bills on your issues.` : `Your first one to watch: <b>${esc(E.name)}</b>.`}</span></p>` : ''}
    <p class="small muted st-voicelearn">Want the details? ${story}, about a minute.</p>`);
}

// ================= A lesson on its own, in the moment (#/learn/<lesson>[/<bill id>]; R-067 #11) =================
// A lesson opened from where it helps: "What a hearing is" beside a hearing, "The session" under a bill's steps, the
// three older lessons from Help, and the full first visit's story (#/learn/story, R-062) from the short version's page.
// Next walks the lesson; at the end, Done goes back where the person came from.
export function stepLearn(route) {
  S.learnBill = route.bill || '';
  const name = learnName(route), E = example();
  if (!E) return skel(1, 'Finding a bill to show you');
  const L = lessons().lessonHTML(name, E);
  return shell('st-lesson st-learn', `<div class="steps st-steps">${btn('Back', { kind: 'text', icon: 'arrow-left', cls: 'st-back', attrs: { 'data-stlearnback': '1' } })}</div>${L.intro}`, L.main);
}

// The first visit's one lesson: the flow calls the screen 'bill' (the recorded step name), the lesson is the story.
function stepLesson(step) {
  const E = example();
  if (!E) return skel(step, 'Finding a bill to show you');   // last session's bills are still on their way
  const L = lessons().lessonHTML('story', E);
  return shell('st-lesson', `${topRow('bill', step)}${L.intro}`, L.main);
}

// ================= Stay connected, 1: who speaks for you, by street address =================
// A street address only (Nate, 9/21: a town is not enough to find a legislator). The debounced address search is its
// own module (addresspicker.js) so this screen runs an independent instance. The address is used to find the districts
// and is never saved, and staff never see it (CLAUDE.md rule 3).
const APstart = createAddressPicker();
S.stAddr ??= { q: '', pick: null, finding: false, err: '' };
const roleWord = r => r === 'chair' ? 'chairs' : r === 'vice_chair' ? 'is vice chair of' : 'sits on';
// Why these two people matter to the example bill: their committee seats against its referrals.
function connection(E, legs) {
  if (!E || !(E.path || []).length) return 'They vote on your bills when they reach the House and Senate floors, and they listen closest to the people they represent.';
  const hearing = new Set((E.hear && !E.hear.example && !E.hear.past ? E.hear.codes : []) || []);
  // The note names the bill (Nate 9/29: with one legislator it said "hears it" and nobody knew which bill). With two, the
  // bill is named once up front ("Both have a hand in ..."), so each clause can say "it".
  const label = E.hasNick ? `${E.name} (${E.num})` : E.num;
  const parts = legs.map(l => {
    const seats = S.committeeMembers.filter(m => m.legislator_id === l.id && E.path.includes(m.committee))
      .sort((a, b) => ({ chair: 0, vice_chair: 1, member: 2 }[a.role] ?? 3) - ({ chair: 0, vice_chair: 1, member: 2 }[b.role] ?? 3));
    const s = seats[0]; if (!s) return null;
    const ch = l.chamber === 'S' ? 'Senate' : 'House', now = hearing.has(s.committee);
    const crossed = E.now >= 3 && ch === E.start;   // the first side's committees are behind it once it has crossed
    const it = '\u0000';   // filled in below: the bill's name for one legislator, "it" after "Both have a hand in"
    const what = now ? `one of the committees hearing ${it}${E.hear?.day ? ` on ${E.hear.day}` : ''}` : crossed || E.off ? `a ${ch} committee that ${E.off ? 'passed' : 'already passed'} ${it}` : `a ${ch} committee that hears ${it}`;
    return `${legTitle(l)} ${l.last || l.name.split(' ').slice(-1)[0]} ${roleWord(s.role)} ${what}`;
  });
  const said = parts.filter(Boolean);
  if (!said.length) return 'They vote on your bills when they reach the House and Senate floors, and they listen closest to the people they represent.';
  return said.length === 2 ? `Both have a hand in ${label}: ${said[0].replace('\u0000', 'it')}, and ${said[1].replace('\u0000', 'it')}.` : `${said[0].replace('\u0000', label)}.`;
}
// An address that looks complete can be looked up as typed, as in the full legislator finder: the suggestions come from
// our own address list, which a new street or a slow connection can leave empty (Enter does the same).
const typed = (q, results) => q.length >= 5 && /^\d/.test(q) && !results.some(r => r.exact);
const lastName = l => { const s = String(l.sort_name || '').split(',')[0].trim(); return s || String(l.name || '').split(' ').slice(-1)[0]; };
// The error and the address suggestions under the box. Typing repaints only this (R-040): redrawing the whole screen
// on every letter replaced the box itself, which on a phone threw the cursor to the end and broke the keyboard's own
// word suggestions mid-word.
function addrSugsHTML() {
  const A = S.stAddr, q = A.q.trim(), results = APstart.results(q);
  return `${A.err ? `<p class="st-info-small">${icon('info')}<span>${esc(A.err)}</span></p>` : ''}
    ${results.length || typed(q, results) ? `<div class="st-sugs" role="group" aria-label="Addresses">${results.map((r, i) => `<button type="button" class="st-sug" data-staddrpick="${i}">${icon('map-pin')}<span>${esc(r.label)}</span></button>`).join('')}
      ${typed(q, results) ? `<button type="button" class="st-sug" data-staddrtyped="1">${icon('search')}<span>Look up “${esc(q)}” as typed</span></button>` : ''}</div>` : ''}`;
}
function stepYou(step) {
  const A = S.stAddr, E = example();
  let body;
  if (A.pick) {
    const legs = A.pick.ids.map(id => S.legislators.find(l => l.id === id)).filter(Boolean).map(l => ({ ...l, last: lastName(l) }))
      .sort((a, b) => (a.chamber === 'H' ? 0 : 1) - (b.chamber === 'H' ? 0 : 1));
    const legCard = l => `<li class="st-leg">${legPhoto(l, 'st-legpic')}<span class="st-tbody"><b>${esc(legTitle(l))} ${esc(l.name)}</b><span>Your ${l.chamber === 'S' ? 'senator' : 'representative'} · District ${esc(String(l.district))}</span></span></li>`;
    body = `<p class="st-addrline">${icon('map-pin')}<span>${esc(A.pick.label || A.q)}</span></p>
      <ul class="st-legs" id="st-legs" role="list">${legs.map(legCard).join('')}</ul>
      <p class="st-connect">${icon('sparkles')}<span>${E ? esc(connection(E, legs)) : ''}</span></p>
      ${btn('Use a different address', { kind: 'text', attrs: { 'data-staddrclear': '1' } })}`;
  } else if (A.finding) {
    body = `<p class="st-info-small" role="status">${icon('loader-circle', { cls: 'pp-spin' })}<span>Finding your districts…</span></p>`;
  } else {
    body = `<div class="field"><label for="st-addr">Your street address</label>
        <input id="st-addr" type="text" autocomplete="street-address" placeholder="Start typing, like 45-600 Keaahala Rd" value="${esc(A.q)}" data-staddr="1">
        <span class="help">We use it only to find your districts. It isn’t saved.</span></div>
      <div id="st-addrsugs">${addrSugsHTML()}</div>`;
  }
  return shell('st1 st-you', `${topRow('you', step)}${artFor('you')}
    <h1 class="hero" id="st-h">Who speaks for you</h1>
    <p class="lede">One senator and one representative speak for where you live, and they listen closest to you.</p>`,
    `<div class="st-legwrap" id="st-youstage">${body}</div>`);
}

// ================= Your issues, 3: alerts on them (R-146) =================
// Nate 10/4: "Let's move the "sign up for alerts" option to right after selecting issues, also include a phone number
// option which should be more prominent." The visit's one ask is here now, right after the issues are followed and
// before the "Mahalo!" that celebrates them (his pick), so the moment celebrates both: a mobile number first, email as a
// link under it (pub/alerts.js, the same box as Home's and More's). Skip, or either kind given, plays the "Mahalo!" and
// goes on. Back from the next screen shows what was given, with a way to change it. It used to sit on "Coming up on your
// issues", after the story and the address, where most people never reached it.
function stepAlerts(step) {
  const off = isOff(), n = followedIssues().length, t = textSaved(), sent = mailSent();
  // "your 2&nbsp;issues": the heading never breaks with "issues" alone on its line (the review, A-19).
  const what = n ? (n === 1 ? 'your issue' : `your ${n}&nbsp;issues`) : 'your bills';
  const done = !S.alertEdit && (t || sent);
  const body = done
    ? `<section class="card st-sent st-alertdone" aria-labelledby="st-al-t"><span class="st-ilead">${icon(t ? 'message-square' : 'mail-check')}</span>
        <div class="st-sentbody" id="st-al-t" tabindex="-1">${alertDoneHTML(t ? { kind: 'phone', phone: t.phone, confirmed: !!t.confirmed, demo: DEMO } : { kind: 'email', email: sent, demo: DEMO, later: true },
          { change: `<div class="st-formbtns st-alchange">${changeBtn('data-stalchange', t ? 'Use a different number' : 'Use a different email')}</div>` })}</div></section>`
    : `<form class="card st-form st-askcard st-alertform" id="st-aform" novalidate>${alertFields('st-a')}</form>`;
  // The lede says what a hearing is: the story that teaches it comes after this screen, so the promise of hearing alerts
  // has to make sense on its own (the review, 10/4).
  return shell('st4 st-alertspage', `${topRow('alerts', step)}${artFor('alerts')}
    <h1 class="hero" id="st-h">${done ? (t?.confirmed ? 'You’re all set' : 'You’re almost set') : codeStep('st-a') ? 'Check your texts' : `Get alerts on ${what}`}</h1>
    <p class="lede">${!done && codeStep('st-a') ? 'Type the 6-digit code from the text to turn on alerts.' : `${off ? 'Their new bills start in January. ' : ''}At a hearing, lawmakers hear from the public. Hearings are set only about two days ahead.`}</p>`,
    body);
}
// The first success: a moment that fills the screen and waits for Continue (C-7). It celebrates the issues just
// followed and, when one was given, how we'll reach them. Once a visit; a shared bill's visit has no "Mahalo!" (its
// follow got a small burst on "Follow this issue?").
function mahalo(then, r = null) {
  const off = isOff(), n = followedIssues().length, bills = [...S.watch].map(anyBill).filter(b => b && (off || alive(b))).length;
  if (wiz().via || S.mahaloShown) { then(); return; }
  S.mahaloShown = true;
  // A number proven by its code (R-155) is done: alerts are on, and the person is signed in with it.
  const told = r?.kind === 'phone' && r.confirmed ? `Text alerts are on for ${fmtPhone(r.phone)}${r.demo ? '.' : ', and you’re signed in with it.'}`
    // Not confirmed yet: "Almost set", the words every screen uses for it (alerts.js alertStatus, D1-4). It said "Then alerts
    // start.", which read as done.
    : r?.kind === 'phone' ? almostLine(fmtPhone(r.phone))
    : r?.kind === 'email' ? `We sent a link to ${r.email}. Tap it when you finish here to turn on alerts.` : '';
  // Its button names what comes next (C-6, C-7): right after a sign-up, a plain "Continue" read as the end of the visit.
  celebrate({ title: 'Mahalo!', sub: `You’re following ${n ? plural(n, 'issue') : 'your picks'}.`,
    small: told || (off ? 'Their bills come to you as soon as the session starts.' : `That’s ${plural(bills, 'bill')} this session. We’ll watch every one.`),
    go: armOf('fv') === 'short' ? 'Next: why your voice matters' : 'Next: how a bill becomes law' }, then);
}
export function leaveAlerts(step, r = null) {
  S.alertEdit = false;
  mahalo(() => goStep(step, step + 1), r);
}

// ================= Stay connected, 2: coming up on your issues =================
// What is happening this week on the issues they follow (hearings in date order, with the day testimony is due). The
// alerts ask that followed the list (Nate 9/21: ask after the value) moved to right after the issues on 10/4 (R-146,
// stepAlerts); someone who skipped it gets one quiet line here. S.stMail is the email given in this visit (mailSent).
S.stMail ??= { email: '', name: '', sent: '', demo: false };
const WEEKDAY = d => new Date(d).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short' });
// A committee named briefly enough for one line on a phone: "Senate Health and Commerce committees". A long name keeps
// its first part ("Health and Human Services" -> "Health"); a short one stays whole ("Ways and Means").
function briefCmte(code) {
  const cs = String(code || '').split('/').map(c => S.committees[c.trim()]).filter(Boolean);
  if (!cs.length) return 'A committee';
  const ch = cs[0].chamber === 'S' ? 'Senate' : 'House';
  const short = n => { const words = n.split(/\s+/); return words.length <= 3 ? n : n.split(/\s+(?:and|&)\s+|,\s*/)[0]; };
  return `${ch} ${andList(cs.map(c => short(c.name)))} ${cs.length > 1 ? 'committees' : 'Committee'}`;
}
const WEEKDAY_LONG = d => new Date(d).toLocaleDateString('en-US', { timeZone: HST, weekday: 'long' });
function upcoming() {
  const off = isOff(), R = ranker(), out = [];
  if (off) {
    const si = sessionInfo(), yr = si.recapYear, next = si.nextOpen;
    // What happened on each issue they follow (R-067: the screen promised "What happened in 2026" and showed only laws):
    // laws first, then the staff-edited outlook, three at most.
    const fol = followedIssues().filter(shown).map(i => ({ i, x: issueInfo(i, R) })).sort((p, q) => (q.x.law - p.x.law));
    for (const { i, x } of fol.slice(0, 3)) out.push({ when: String(yr), title: i.name, line: i.outlook || (x.law ? `Became law in ${yr}` : 'Stopped this session'), kind: x.law ? 'ok' : 'soon' });
    if (next) out.push({ when: new Date(next + 'T12:00:00-10:00').toLocaleDateString('en-US', { timeZone: HST, month: 'short', day: 'numeric' }), title: `The ${+next.slice(0, 4)} session opens`,
      line: `New bills on ${followedIssues().length ? 'the issues you follow' : 'HIPHI’s issues'} can start that week.`, kind: 'soon' });
    return out;
  }
  // One row per followed issue: its soonest hearing in the next 7 days.
  const seen = new Set(), E = example();
  const rows = [];
  for (const i of followedIssues().filter(shown)) {
    const x = issueInfo(i, R), bs = x.live.map(b => ({ b, h: R.soon.get(b.id) })).filter(y => y.h && new Date(y.h.scheduled_at) - Date.now() < 7 * 864e5)
      .sort((p, q) => p.h.scheduled_at.localeCompare(q.h.scheduled_at));
    if (!bs.length || seen.has(i.id)) continue; seen.add(i.id);
    const { b, h } = bs[0], due = h.testimony_deadline ? `Testimony due ${WEEKDAY_LONG(h.testimony_deadline)} at ${timeWord(h.testimony_deadline)}.` : '';
    rows.push({ at: h.scheduled_at, when: WEEKDAY(h.scheduled_at), title: `${i.name}`, line: `${spaced(b.bill_number)}: ${briefCmte(h.committee)} hearing, ${timeWord(h.scheduled_at)}. ${due}`.trim(), kind: 'hear', b, h });
  }
  rows.sort((p, q) => p.at.localeCompare(q.at)).slice(0, 3).forEach(r => out.push(r));
  if (!out.length) {
    // Someone who came from a link and follows nothing yet was told "No hearing on your issues this week" right
    // after being shown this bill's hearing (R-067). The bill they came for leads when it has one.
    const vb = wiz().via ? exampleBill() : null;
    const vh = vb && hearingsOf(vb).find(h => h.status === 'scheduled' && new Date(h.scheduled_at) > Date.now() && new Date(h.scheduled_at) - Date.now() < 7 * 864e5);
    if (vh) {
      const due = vh.testimony_deadline ? `Testimony due ${WEEKDAY_LONG(vh.testimony_deadline)} at ${timeWord(vh.testimony_deadline)}.` : '';
      out.push({ when: WEEKDAY(vh.scheduled_at), title: nick(vb) || spaced(vb.bill_number), line: `${spaced(vb.bill_number)}: ${briefCmte(vh.committee)} hearing, ${timeWord(vh.scheduled_at)}. ${due}`.trim(), kind: 'hear', b: vb, h: vh });
    } else if (E) out.push({ when: 'Soon', title: E.name, line: followedIssues().length ? (endHome() ? 'No hearing on your issues this week yet. When one is set, your home page shows what to do.' : 'No hearing on your issues this week yet. We’ll tell you when one is set.') : 'No hearing set on it this week yet.', kind: 'soon' });
  }
  return out;
}
// One action inside the first visit, and only when it cannot wait (R-067 #12, Nate 9/27: "if there is a hearing, the
// action should be testimony"): the first row whose testimony is due within 48 hours offers the walkthrough. Everything
// else still waits for Home.
const dueSoon = it => { const d = it.h?.testimony_deadline; if (!d || !it.b) return false; const ms = new Date(d) - Date.now(); return ms > 0 && ms < 48 * 36e5 && !didKind(it.b, it.h, 'testimony'); };
function stepSoon(step) {
  const off = isOff(), all = upcoming(), now = off ? null : all.find(dueSoon);
  // No way to reach them yet (they skipped the alerts screen, or the email-ask test's second version, R-135): one quiet
  // line under the list, never a second ask (C-3: once a visit).
  const quiet = !S.session && !mailSent() && !textSaved();
  // Each item is one compact row (day, bill, "Testimony due Thu"), three at most, the rest under "More coming up"; the one
  // due soonest always first (R-078, when the reminder box shared this screen).
  const fit = 3;
  const lead = now ? [now, ...all.filter(x => x !== now)] : all, items = lead.slice(0, fit), more = lead.slice(fit);
  const short = it => it.h?.testimony_deadline ? `Testimony due ${WEEKDAY(it.h.testimony_deadline)}` : it.kind === 'hear' ? 'Hearing' : it.line;
  const row = (it, k) => `<li class="st-srow" style="--k:${k}"><span class="st-when st-when-${it.kind}">${esc(it.when)}</span><div><b>${esc(it.title)}</b><span>${esc(short(it))}</span>
    ${it === now ? `<span class="st-now">${btn('Write it now', { kind: 'text', sm: true, icon: 'notebook-pen', attrs: { 'data-helper': it.h.id, 'data-bill': it.b.id, 'aria-label': `Write my testimony on ${it.title}, due soon` } })}</span>` : ''}</div></li>`;
  const list = `<ol class="st-soon" role="list">${items.map(row).join('')}</ol>${more.length ? `<details class="st-soonmore"><summary>${icon('chevron-down')}<span>More coming up (${more.length})</span></summary><ol class="st-soon" role="list">${more.map((it, k) => row(it, k + fit)).join('')}</ol></details>` : ''}`;
  return shell('st4 st-soonpage', `${topRow('soon', step)}
    <h1 class="hero" id="st-h">${off ? 'Your issues, this year and next' : 'Coming up on your issues'}</h1>
    ${off || !items.length ? `<p class="lede">${off ? `What happened in ${sessionInfo().recapYear}, and what comes next.` : 'Nothing is set yet this week.'}</p>` : ''}`,
    `${list}${quiet ? quietAsk() : nameCard()}`);
}
// The first name, optional, once there is a way to reach them (R-078 asked it after the email; since R-146 the ask is
// earlier and leaves straight for the "Mahalo!", so it waits here): the finale and Home greet them by it, and it joins
// the account like the issues do (core loadUser). Signed in, the account has its own.
function nameCard() {
  const M = S.stMail, given = mailSent() || textSaved();
  if (S.session || !given) return '';
  if (M.named) return `<p class="small st-named">${icon('check')}<span>We’ll greet you as ${esc(M.named)}.</span></p>`;
  if ((wiz().name || '').trim()) return '';
  // No Save button of its own (the review: a typed name was half-kept): Next, or Enter, keeps what is typed.
  return `<section class="card st-namecard"><div class="field st-namefld"><label for="st-name">First name <span class="st-opt">(optional, so we can greet you)</span></label>
    <input id="st-name" name="name" type="text" autocomplete="given-name" enterkeyhint="next" placeholder="Leilani" value="${esc(M.name || '')}"></div></section>`;
}
// The email-ask test's second version (R-135, variant.js 'email'): the first visit does not ask (askAlerts passes the
// alerts screen over); the first ask comes after the person's first action (pub/actions.js nudgeCard) or another day.
const quietAsk = () => `<p class="small muted st-quietask">${icon('bell')}<span>Want alerts by text or email? Add them any time from More.</span></p>`;

// ================= Stay connected, 3: you're all set (the peak; Nate 9/21: end on a high) =================
// Everything they did, each line ticking in, while petals fall once and flowers bloom under the Capitol as the sun
// comes up (the bookend to the first screen's drawing). Then what happens next. Nothing here asks for anything.
// The words come first and the celebration plays around them (X11-2, R-180): every line is in by 0.8 s and nothing moves
// after 2 s (the timings are in start.css and fx.js petals()).
function recapRows() {
  const f = followedIssues(), off = isOff(), stances = S.stances || {}, n = [...S.watch].map(anyBill).filter(b => b && (off || alive(b))).length;
  const stood = new Set(followedBills().filter(b => ['support', 'oppose'].includes(stances[b.id])).map(b => viaIssue(b)?.id || b.id)).size;
  const acted = wiz().via && wiz().viaActed;
  const legs = S.stAddr.pick ? S.stAddr.pick.ids.map(id => S.legislators.find(l => l.id === id)).filter(Boolean)
    .sort((a, b) => (a.chamber === 'H' ? 0 : 1) - (b.chamber === 'H' ? 0 : 1)) : [];
  return [
    f.length || n ? ['star', f.length ? `You follow ${plural(f.length, 'issue')}` : `You follow ${plural(n, 'bill')}`, off ? 'Their new bills come to you as they start' : `${plural(n, 'bill')} we’ll watch for you`, 'ok'] : null,
    acted ? ['send', `You spoke up on ${wiz().viaName || spaced(wiz().via)}`, 'You told the committee what you think', 'ok'] : null,
    stood ? ['thumbs-up', `You took a stand on ${plural(stood, 'issue')}`, 'Never shown publicly', 'ok'] : null,
    S.stLearned ? ['landmark', 'You know how a bill becomes law', 'And when your voice counts most', 'ok'] : null,
    legs.length ? ['users', 'You know who speaks for you', legs.map(l => `${legTitle(l)} ${lastName(l)}`).join(' and '), 'ok'] : null,
    // The alerts row comes last, drawn by alerts.js alertRowHTML: one status rule for every screen (D1-4), and its own
    // "Turn on alerts" when they are off (X10-4).
  ].filter(Boolean);
}
function stepDone(step) {
  const name = (S.stMail.name || wiz().name || '').trim(), off = isOff();
  const rows = recapRows(), al = alertStatus();
  // In proportion to what was done (C-7): someone who skipped everything was thanked for "speaking up" and promised
  // "we tell you" with no way to be told (R-067). The words follow what really happened: "we tell you" only once alerts
  // are on or almost set by the one rule (D1-4), never for a signed-in account with both email choices off.
  const spoke = !!(wiz().via && wiz().viaActed), did = rows.some(r => r[3] === 'ok') || al.key === 'on', follows = followsAnything();
  const told = al.key === 'on' || al.key === 'almost';
  const lede = spoke ? 'Mahalo for speaking up for a healthier Hawaiʻi. Here’s what you did today.'
    : did ? 'Mahalo for joining in. Here’s what you did today.' : 'Here’s where things stand.';
  const art = CAPITOL.replace(/<circle ([^>]*fill="var\(--o400\)"[^>]*)\/>/, '<circle class="st-sun" $1/>');
  return shell(`st-done${S.stCalm ? ' st-calm' : ''}`, `${topRow('done', step)}
    <div class="st-fx" aria-hidden="true"><div class="st-finart">${art}</div><div class="st-petals">${petals()}</div>
      <div class="st-blooms">${[0, 1, 2, 3, 4].map(i => `<span style="--k:${i}">${flower(22 + (i % 2) * 8)}</span>`).join('')}</div></div>
    <h1 class="hero" id="st-h">You’re all set${name ? `, ${esc(name)}` : ''}!</h1>
    <p class="lede">${lede}</p>`,
    `<ul class="st-did" role="list">${rows.map(([ic, b, s, kind], k) => `<li style="--k:${k}"><span class="st-rc st-rc-${kind}">${icon(kind === 'ok' ? 'check' : ic)}</span><div><b>${esc(b)}</b><span>${esc(s)}</span></div></li>`).join('')}${alertRowHTML(rows.length)}</ul>
    ${S.session || textSaved() ? `<p class="st-prof">${icon('user')}<span>Your profile is saved, ready for your first letter. <a href="#/profile">See your profile</a> any time in More.</span></p>` : ''}
    <h2 class="st-nexth">What happens next</h2>
    <ol class="st-next3" role="list">
      <li style="--k:0"><span class="st-nic">${icon('eye')}</span><div><b>We keep watch.</b><span>${!follows ? 'Follow an issue any time, and we watch it for you.' : off ? `Every day from ${esc(shortDay(sessionInfo().nextOpen))}, so you don’t have to.` : 'Every day, so you don’t have to.'}</span></div></li>
      <li style="--k:1"><span class="st-nic">${icon('calendar-clock')}</span><div>${told ? '<b>When it’s your moment, we tell you.</b><span>Most ways to help take about 2 minutes.</span>'
        : '<b>When it’s your moment, it’s on your home page.</b><span>Most ways to help take about 2 minutes.</span>'}</div></li>
      <li style="--k:2"><span class="st-nic">${icon('circle-check')}</span><div><b>You see what happened.</b><span>Every result is on your home page.</span></div></li>
    </ol>${shareLine()}${keepLine()}`);
}


// ================= From a shared bill: follow this issue? =================
// The easiest action came first, on the bill page (pub/bill.js); following is offered next (C-3), then the story of
// that bill. "Not now" goes to the story.
// Through the facade: until the rest of the first visit is in, a link newcomer's bill is simply not known yet (R-122).
function stepFollowAsk(step) {
  const b = exampleBill(), i = viaIssueOf(), what = i ? i.name : b ? (nick(b) || spaced(b.bill_number)) : 'this issue';
  return shell('st1 st-followask', `${topRow('followask', step)}${artFor('followask')}
    <h1 class="hero" id="st-h">Want us to tell you next time?</h1>
    <p class="lede">Follow ${esc(what)}, and we’ll tell you when there’s another hearing or a way to help.</p>${sureWide('info', 'No account needed. You can stop any time.')}`,
    `${sayRow('info', 'No account needed. You can stop any time.')}`);
}
async function followVia() {
  const b = exampleBill(), i = viaIssueOf(); if (!b) return;
  if (i) await setFollows({ issuesOn: [i.id] }); else if (!S.watch.has(b.id)) await toggleWatch(b.id);
  wizSet({ done: true, followedIssues: i ? [i.id] : [] }); welcome();
}

// ================= wiring =================
async function commitIssues(m) {
  const w = wiz(), catsOn = [...m.picks.cats];
  const issuesOn = m.picks.issues.filter(id => !(S.issueById.get(id)?.categories || []).some(c => catsOn.includes(c)));
  const issuesOff = (w.followedIssues || []).filter(id => !issuesOn.includes(id)), catsOff = (w.followedCats || []).filter(k => !catsOn.includes(k));
  await setFollows({ issuesOn, catsOn, issuesOff, catsOff });
  // done: Home stops sending them back here even if they later unfollow everything. ready: the off-season promise is kept.
  wizSet({ done: true, ready: null, followedIssues: issuesOn, followedCats: catsOn });
  welcome();
}
let learnWired = '';
export function wireLearn(route) {
  const name = learnName(route), E = example(); if (!E) return;
  document.body.classList.add('st-lessonpage');
  const key = `${location.hash}|${E.id}`, redraw = name === 'story' && key === learnWired; learnWired = key;
  lessons().lessonStart(name, E, { redraw });
  const leave = () => { lessons()?.lessonStop?.(); learnWired = ''; S.learnBill = ''; document.body.classList.remove('st-lessonpage'); if (history.length > 1) history.back(); else app.go('#/'); };
  const nb = document.querySelector('[data-stlearnnext]');
  const label = () => { if (!nb || name !== 'story') return; const last = lessons().lessonStep(name) >= 3;
    nb.innerHTML = `<span>${last ? 'Done' : 'Next'}</span>${icon(last ? 'check' : 'arrow-right')}`; };
  label();
  document.querySelector('[data-stlearnback]')?.addEventListener('click', () => { if (lessons().lessonPrev(name)) label(); else leave(); });
  if (nb) nb.onclick = () => { if (lessons().lessonNext(name, E)) label(); else leave(); };   // past its last step the lesson is done
}
export function wireStep(name, { step, off, back, fresh, next, $, $$ }) {
  if (name === 'issues') {
    const save = picks => { const m = model2(); if (m.sig) wizSet({ picksFor: m.sig, picks }); };
    // The ticks, the "Follow all" blocks and the button are redrawn in place, so focus and open sections stay put.
    const paint = () => {
      const m = model2(); if (!m.all) return;
      $$('[data-stpick]').forEach(t => { const x = m.all.find(r => r.i.id === t.dataset.stpick), on = !!x && m.ticked(x);
        t.setAttribute('aria-pressed', String(on)); t.closest('.st-pcard')?.classList.toggle('on', on); });
      $$('[data-stcatall]').forEach(box => { const k = box.dataset.stcatall, p = m.per.find(q => q.c.topicKey === k);
        if (p) box.innerHTML = catAll(p.c, p.full.length, m.catOn.has(k)); });
      $$('[data-stpicked]').forEach(el => { const p = m.per.find(q => q.c.topicKey === el.dataset.stpicked); if (!p) return;
        const said = pickedLine(p, m); el.textContent = said; el.hidden = !said; });
      wireCatAll();
      const lb = $('[data-stnext] span'); if (lb) lb.textContent = followLabel(m.count);
      clearFlash();
    };
    const wireCatAll = () => $$('[data-stfollowcat]').forEach(el => el.onclick = () => {
      const m = model2(); if (!m.picks) return;
      const k = el.dataset.stfollowcat, picks = { issues: [...m.picks.issues], cats: [...m.picks.cats] };
      if (picks.cats.includes(k)) picks.cats = picks.cats.filter(c => c !== k);
      else { picks.cats.push(k); const inCat = new Set(issuesIn(k).map(i => i.id)); picks.issues = picks.issues.filter(id => !inCat.has(id)); }
      save(picks); paint();
      document.querySelector(`[data-stfollowcat="${k}"]`)?.focus({ preventScroll: true });
    });
    $$('[data-stpick]').forEach(el => el.onclick = () => {
      const m = model2(); if (!m.picks) return;
      const id = el.dataset.stpick, x = m.all.find(r => r.i.id === id); if (!x) return;
      const picks = { issues: [...m.picks.issues], cats: [...m.picks.cats] };
      if (!m.ticked(x)) picks.issues.push(id);
      else {
        picks.issues = picks.issues.filter(v => v !== id);
        // Taking one issue out of a category followed whole: the category becomes its other issues, one by one.
        for (const c of x.i.categories.filter(k => picks.cats.includes(k))) {
          picks.cats = picks.cats.filter(k => k !== c);
          for (const r of m.per.find(p => p.c.topicKey === c)?.full || []) if (r.i.id !== id && !picks.issues.includes(r.i.id)) picks.issues.push(r.i.id);
        }
      }
      save(picks); paint();
      const t = el.querySelector('.st-tick'); if (t && el.getAttribute('aria-pressed') === 'true' && !reduced()) { t.classList.remove('st-draw'); void t.offsetWidth; t.classList.add('st-draw'); }
    });
    wireCatAll();
    // "Show N more issues": the rest of a category, in place; only the newly shown ones slide in.
    $$('[data-stmore]').forEach(el => el.onclick = () => {
      const k = el.dataset.stmore, open = !S.stMore[k]; S.stMore[k] = open;
      const sec = el.closest('.st-tsec'), extra = sec.querySelectorAll('.st-extra');
      extra.forEach((li, j) => { li.hidden = !open; li.classList.remove('st-in'); if (open && !reduced()) { li.style.animationDelay = `${Math.min(j, 8) * 40}ms`; void li.offsetWidth; li.classList.add('st-in'); } });
      el.setAttribute('aria-expanded', String(open));
      el.querySelector('span').textContent = open ? 'Show fewer' : `Show ${plural(extra.length, 'more issue')}`;
      fitWhat();
    });
    // "What it does" opens the text in place (no redraw), so focus and the ticks stay exactly where they were.
    $$('[data-stwhat]').forEach(el => el.onclick = () => {
      const open = el.getAttribute('aria-expanded') !== 'true', id = el.dataset.stwhat;
      el.setAttribute('aria-expanded', String(open)); el.closest('.st-pcard').classList.toggle('st-open', open);
      if (open) S.stWhat.add(id); else { S.stWhat.delete(id); fitWhat(); }
    });
    $$('[data-stsec]').forEach(d => d.addEventListener('toggle', () => { S.stOpen[d.dataset.stsec] = d.open; fitWhat(); }));
    fitWhat();
    document.fonts?.ready?.then(fitWhat);
    const nb = $('[data-stnext]');
    if (nb) nb.onclick = async () => {
      const m = model2();
      if (m.loading || m.err || m.none) { flash(m.err ? 'The issues did not load. Try again.' : 'Still finding issues — one moment.'); return; }
      if (!m.count && !m.catOn.size) { flash('Tick at least one issue, or select Skip.'); return; }
      if (nb.getAttribute('aria-busy') === 'true') return;
      busy(nb, 'Following…');
      const ids = m.all.filter(m.ticked).map(x => x.i.id);
      await commitIssues(m);
      track(name, 'next', { counts: { cats: m.sel.length, issues: new Set(ids).size }, issue_ids: [...new Set(ids)] });
      // The alerts ask comes next, and the "Mahalo!" after it (R-146). With nothing to ask (signed in, already told us how
      // to reach them), the "Mahalo!" plays now and the alerts screen is passed over.
      if (askAlerts()) { goStep(step, step + 1); return; }
      mahalo(() => goStep(step, step + 2));
    };
  }

  if (name === 'bill') {
    const E = example();
    // A redraw of the same screen (data landing) shows the still picture, without replaying the road.
    if (!E) return;   // the lessons are still on their way: the step is drawn again when they land
    lessons().lessonStart('story', E, { back, redraw: !fresh });
    const nb = $('[data-stnext]');
    // On the story's last stage the button names the next screen (C-6), so finishing it reads as a step on, not the end.
    const label = () => { if (!nb) return; const last = lessons().lessonStep('story') >= 3;
      nb.querySelector('span').textContent = last ? GO_YOU : 'Next'; };
    label();
    // A stage can change without Next: Back, or a tap on the story's own stage dots.
    $('.st')?.addEventListener('click', () => requestAnimationFrame(label));
    if (nb) nb.onclick = () => {
      if (lessons().lessonNext('story', E)) { label(); return; }
      // Finishing "How a bill becomes law" is a part of the first visit finished: its name ticks green at the top of the
      // next screen with a small burst (tickChapter, C-7), as the short version's page does. Until 10/4 this was a moment
      // that filled the screen with three ticks over the Capitol, which read as the end with Stay connected still to
      // come (Nate: "makes it feel like everything is done", R-140).
      S.stLearned = true; next();
    };
  }


  if (name === 'you') {
    const abox = $('[data-staddr]');
    // Only the list under the box is redrawn while typing; the box itself stays, with the cursor where the person put it.
    const paintSugs = () => { const box = document.getElementById('st-addrsugs'); if (!box) return; box.innerHTML = addrSugsHTML(); wireSugs(); };
    if (abox) abox.oninput = () => {
      S.stAddr.q = abox.value; S.stAddr.err = '';
      APstart.search(abox.value.trim(), paintSugs);
      paintSugs();
    };
    const look = async r => {
      S.stAddr.finding = true; app.render();
      try {
        const res = await APstart.resolve(r.label, r.pt);
        if (!res || res.none || !res.ids?.length) { S.stAddr.finding = false; S.stAddr.err = 'We couldn’t find that address. Check the street and number, or pick a suggestion.'; app.render(); return; }
        S.stAddr.pick = { ids: res.ids, label: res.matched || r.label }; S.stAddr.finding = false;
        // The districts (never the address) stay on this device, so bill pages can say "your senator" (people.js does the same).
        const found = res.ids.map(id => S.legislators.find(l => l.id === id)).filter(Boolean);
        try { localStorage.setItem('hiphi_districts', JSON.stringify({ senate: found.find(l => l.chamber === 'S')?.district || null, house: found.find(l => l.chamber === 'H')?.district || null })); } catch { /* ignore */ }
        app.render();
        later(() => burst(document.getElementById('st-legs'), 14, 70), 300);   // found: a small celebration (C-7)
      } catch { S.stAddr.finding = false; S.stAddr.err = 'We couldn’t look that up just now. Check your connection and try again.'; app.render(); }
    };
    function wireSugs() {
      $$('[data-staddrpick]').forEach(el => el.onclick = () => { const r = APstart.results(S.stAddr.q.trim())[+el.dataset.staddrpick]; if (r) look({ label: r.label, pt: r }); });
      $$('[data-staddrtyped]').forEach(el => el.onclick = () => look({ label: S.stAddr.q.trim(), pt: null }));
    }
    wireSugs();
    if (abox) abox.onkeydown = e => { if (e.key !== 'Enter') return; e.preventDefault();
      const q = abox.value.trim(), r = APstart.results(q)[0];
      if (r) look({ label: r.label, pt: r }); else if (typed(q, [])) look({ label: q, pt: null }); };
    const aclear = $('[data-staddrclear]'); if (aclear) aclear.onclick = () => { S.stAddr = { q: '', pick: null, finding: false, err: '' }; app.render(); requestAnimationFrame(() => document.getElementById('st-addr')?.focus()); };
    const nb = $('[data-stnext]'); if (nb) nb.onclick = () => { track(name, 'next', { counts: { address: !!S.stAddr.pick } }); goStep(step, step + 1); };
  }

  if (name === 'soon') document.querySelectorAll('.st-soon [data-helper]').forEach(el => el.onclick = () => app.openHelper(el.dataset.bill, el.dataset.helper));
  if (name === 'voice') {
    const nb = $('[data-stnext]'); if (nb) nb.onclick = next;
  }
  if (name === 'soon') {
    // A first name typed here is kept when they move on: the finale and Home both read wiz().name.
    const keepName = () => { const first = ($('#st-name')?.value || '').trim().slice(0, 40); if (first) { wizSet({ name: first }); S.stMail.name = first; S.stMail.named = first; } };
    const nb = $('[data-stnext]'); if (nb) nb.onclick = () => { keepName(); next(); };
    const nf = $('#st-name'); if (nf) { nf.oninput = () => { S.stMail.name = nf.value; }; nf.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); keepName(); next(); } }; }
  }

  if (name === 'alerts') {
    // The visit's one alerts ask, so Home will not ask again (C-3); once drawn it stays in the flow (redirectFor).
    S.nudge = null; S.nudgedThisVisit = true; S.alertsShown = true;
    wireAlertForm($('#st-aform'), { pfx: 'st-a', source: 'first_visit', onDone: r => {
      if (r.kind === 'email') S.stMail = { email: r.email, name: S.stMail.name || '', sent: r.email, demo: !!r.demo };
      track(name, 'next', { counts: { phone: r.kind === 'phone', email: r.kind === 'email' } });
      leaveAlerts(step, r);
    } });
    $$('[data-stalchange]').forEach(el => el.onclick = () => {
      S.alertEdit = true;
      if (!textSaved()) { S.alertMode = 'email'; S.alertDraft.email = mailSent(); S.stMail.sent = ''; try { sessionStorage.removeItem('hiphi_link_sent'); } catch { /* ignore */ } }
      else { S.alertMode = 'phone'; S.alertDraft.phone = fmtPhone(textSaved().phone); }
      app.render(); requestAnimationFrame(() => { const i = document.getElementById(`st-a-${S.alertMode}`); if (i) { i.focus(); i.select(); } });
    });
    const nb = $('[data-stnext]'); if (nb && !$('#st-aform')) nb.onclick = () => { track(name, 'next'); leaveAlerts(step); };
  }

  if (name === 'done') {
    wizSet({ finale: true });
    if (fresh) later(() => burst(document.getElementById('st-h'), 16, 90), 500);
    wireAlertRow(document, { source: 'first_visit' });   // "Turn on alerts" on the alerts row (X10-4)
    const nb = $('[data-stdone]'); if (nb) nb.onclick = () => finish();
  }

  if (name === 'followask') {
    const nb = $('[data-stnext]');
    if (nb) nb.onclick = async () => {
      if (nb.getAttribute('aria-busy') === 'true') return;
      busy(nb, 'Following…'); await followVia(); track(name, 'next');
      burst(document.querySelector('.actionbar .btn.primary') || nb, 12, 48);
      later(() => goStep(step, step + 1), 420);
    };
  }
}

// The teaching part always hands on to "Who speaks for you", and its last button says so (R-140, C-6).
// "Next:" keeps it the button that moves on: under "What would you do?", "Find my legislators" read as a fifth answer.
const GO_YOU = 'Next: your legislators';
// The action bar of the steps after the topics (start-rest.js).
export function barStep(name, step, off) {
  switch (name) {
    case 'issues': {
      const m = model2();
      if (m.err) return barRetry();
      if (m.loading || m.none) return barBusy();
      return bar2(followLabel(m.count), { icon: 'star' });
    }
    case 'bill': return bar2('Next', { iconEnd: 'arrow-right' });   // its last stage says GO_YOU (wireStep)
    // Someone who just acted from a shared link chooses: the rest of the first visit, or straight to Home (R-114).
    case 'voice': return wiz().via && wiz().viaActed
      ? `<div class="st-bar"><div class="st-btns">${btn('Go to my home page', { kind: 'text', attrs: { 'data-sthome': '1' } })}${btn('Show me how it works (2 min)', { kind: 'primary', iconEnd: 'arrow-right', attrs: { 'data-stnext': '1' } })}</div></div>`
      : bar2(GO_YOU, { iconEnd: 'arrow-right' });
    case 'you': return S.stAddr.pick ? bar1('Next') : barSkip();
    // The version that ends on Home (R-098): this is the last step, and its button says where it goes.
    // The button follows what the page shows: no email box there (already asked this visit, R-114; or the email-ask test's
    // second version, R-135) means Next, never a "Remind me" that submits a form that is not on the page.
    case 'soon': return endHome() ? bar1('See my home page', 'house') : bar1('Next');
    // The alerts screen: its button sends the box showing (Text me, or Email me), Skip goes on; once given, Next.
    case 'alerts': { if (!S.alertEdit && (textSaved() || mailSent())) return bar1('Next');
      const b = alertButton('st-a'); return bar2(b.label, { icon: b.icon }, { type: 'submit', form: 'st-aform', id: 'st-send' }); }
    case 'done': return bar1('Go to my home page', 'house', { 'data-stdone': '1' });
    case 'followask': return bar2('Follow this issue', { icon: 'star' }, { 'data-stnext': '1' }, 'Not now');
    default: return '';
  }
}

// The steps after the topics (start-rest.js).
export function renderStep(name, step) {
  switch (name) {
    case 'issues': return stepIssues(step);
    case 'bill': return stepLesson(step);
    case 'voice': return stepVoice(step);
    case 'you': return stepYou(step);
    case 'soon': return stepSoon(step);
    case 'alerts': return stepAlerts(step);
    case 'done': return stepDone(step);
    case 'followask': return stepFollowAsk(step);
    default: return '';
  }
}


