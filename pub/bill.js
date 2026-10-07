// The bill page (redesign 9/19): one bill in plain words, and the one thing worth doing about it right now.
// Route {name:'bill', num:'HB1563'}. A full page with its own address, not a sheet: the content is long, shared links
// land here, and phone Back has to work.
// Follow-ups after Nate's review (9/19): the page leads with the bill's everyday name when it has one, asks "Where do
// you stand?" near the top, keeps community numbers to this one bill, follows the same easiest-first ladder as the
// action card, and has a real desktop layout (the actions in a side panel that stays in view, no bottom bar).
import { S, DEMO, SUPABASE_URL, SUPABASE_KEY, app, esc, icon, toast, yay, blurb, asSentence, cleanDesc, nick, spaced, alive, stopOf, plainStatus, stopDetail, cmteLabel, roomLabel,
  dueInfo, dayWord, timeWord, dateLong, fmtDate, posInfo, issueOf, countOk, openActions, actedOn, didKind, doneKey, markDone, saveDone, ensureBill,
  pickBill, billRef, billPath, yearPrefix, billShareUrl, dueWords, toggleWatch, supa, hearingsOf, outcomeOf, OUTCOME_PLAIN, chairContacts, legsOf, legTitle, legPhoto, streamOf, sessionInfo,
  firstVisit, myStance, setStance, agrees, titleCase, reduceMotion, hstDay, CHAMBER_NAME, askMark, askedChair, companionsOf,
  issuesOf, issueFollowed, setFollows, catOf, wizSet, HST, ensureHistory, followsAnything, myActions, wiz, testimonyDraft, isResolution, isOneChamber, billTourHeld, billTourSeen, sameIdeaLaw, sameIdeaWords } from './core.js';
import { draftName, draftRank, draftNotes, testifyLabel, mailLabel, letterOn } from './letters.js';
// "Send my email to the Senate chairs" (R-153): who it goes to now, so "again" never reads as "my email failed".
const sendTo = x => { const ch = CHAMBER_NAME[S.committees[(x.code || '').split('/')[0]]?.chamber] || ''; return `Send my email to the ${ch ? ch + ' ' : ''}${x.chairs.length > 1 ? 'chairs' : 'chair'}`; };
import { pickTitle, aWords, needsSelf } from './titles.js';   // who is writing (R-147; one title by default, R-165)
import { myName, myTitles, signedIn } from './myprofile.js';   // one name and the profile's titles (R-156)
import { btn, iconBtn, chip, skeleton, posChip } from './ui.js';
import { stoppedAt } from '../stops.js';
import { actionCard, wireActions, nudgeCard, wireNudge, followToggle, newToActing, shareFor, doShare } from './actions.js';
import { flower } from './art.js';
import { followAsk, profileSaved } from './alerts.js';   // the profile ask after a follow (R-184)
import { celebrate as moment } from './fx.js';
import { logVisit, visitVia, partnerWelcome } from './visitlog.js';
import { abEvent } from './variant.js';
import { legMoments } from './speakup.js';   // the floor vote's email to their own legislator (R-169)
import { openAddTo, onListsLine } from './mylists.js';
import { aboutBill, capitolUrl } from './billtext.js';   // "Read more about the bill" and the Capitol's links (R-178)
import { GO_HELP } from './topics.js';   // the first visit's last button (R-190)

const N = CHAMBER_NAME;
const normNum = n => String(n || '').replace(/\s/g, '').toUpperCase();
// The address names a number, and for a bill from an earlier session its year too (#/bill/2026/HB2121, R-110). The
// loading sets below are keyed by "2026/HB2121" or "HB2121" (keyOf): one key per address.
const keyOf = (num, year) => (year ? `${year}/` : '') + num;
const refFromHash = () => { const m = /bill[=/](?:(\d{4})\/)?([A-Za-z]+\s?\d+)/i.exec(decodeURIComponent(location.hash)); return { num: normNum(m ? m[2] : ''), year: +(m ? m[1] : 0) || 0 }; };
const numFromHash = () => refFromHash().num;
const keyFromHash = () => { const r = refFromHash(); return keyOf(r.num, r.year); };
const originOf = b => b.chamber || (/^S/.test(b.bill_number) ? 'S' : 'H');
const me = () => { try { return JSON.parse(localStorage.getItem('hiphi_me') || '{}') || {}; } catch { return {}; } };
// The districts the people screen saves ("Remember on this device"): {senate, house, label}.
function myDistricts() {
  try { const d = JSON.parse(localStorage.getItem('hiphi_districts') || 'null'); return d && (d.senate || d.house) ? d : null; } catch { return null; }
}
const mineLabel = (l, d) => !l || !d ? '' : l.chamber === 'S' && +l.district === +d.senate ? 'Your senator'
  : l.chamber === 'H' && +l.district === +d.house ? 'Your representative' : '';
// A bill HIPHI has a position on has its own share page (b/HB2121, built daily by tools/share_pages.mjs), so a link
// pasted into a text previews with the bill's name, not the tracker's general card (R-067); 404.html catches one built
// tomorrow. Other bills, and the sandbox, share the tracker's own address.
// The address to share (core.js billShareUrl, R-110, R-113 and R-169): a bill from an earlier session shares
// b/2026/HB2121; with an ask, that ask's page (b/HB2121-testify).
const shareUrl = billShareUrl;
const tel = p => { const d = String(p || '').replace(/\D/g, ''); return d.length === 10 ? `+1${d}` : d; };

// Two layouts from the same parts. A phone reads top to bottom: what the bill is, where you stand, where it is, what
// you can do, who decides, its hearings, the official record. From 1100px the things a person does (the main action,
// their stance, follow and share) move into a side panel that stays in view. The ORDER differs between the two, so the
// page is drawn for the layout in use, and drawn again when the window crosses the line, instead of being reordered
// with CSS: that would leave keyboard and screen-reader order out of step with what is on screen.
const WIDE = window.matchMedia('(min-width: 1100px)');
const wide = () => WIDE.matches;
const onBill = () => document.body.dataset.screen === 'bill';
WIDE.addEventListener?.('change', () => { if (onBill()) app.render(); });

// ---------------- loading ----------------
// A bill opened from a shared link or search is not in the followed set; ensureBill fetches it with its hearings.
S.blLoading ??= new Set(); S.blMissing ??= new Set(); S.blErr ??= new Set(); S.blTried ??= new Set(); S.blSocial ??= new Set();
S.blOpen ??= new Set();   // which folds are open ("<bill id>|steps"), so a redraw never closes what the person opened
const lookup = (num, year) => pickBill([...S.bills, ...Object.values(S.extra || {})].filter(x => x.bill_number === num), year);
const ready = b => S.bills.some(x => x.id === b.id) || !!(S.xh || {})[b.id];
// The bill, once its page can be drawn: it is known and its hearings are in. (A bill that is known but whose hearings
// never arrived is still drawn after one try, rather than never.)
function drawn(num, year) {
  const b = lookup(num, year); if (!b) return null;
  const key = keyOf(num, year);
  // An address with no year means the current session's bill: one on hand only from an earlier session is drawn once
  // the database has been asked for a newer one (ensureBill, R-110).
  if (!year && +b.session_year !== sessionInfo().yr && !S.blTried.has(key)) return null;
  return ready(b) || (S.blTried.has(key) && !S.blLoading.has(key) && !S.blErr.has(key)) ? b : null;
}
// "We couldn't find it" is said only when the lookup really came back empty. The Supabase client reports a dropped
// connection as an error VALUE, it does not throw, so ensureBill answers null both for "no such bill" and for "could
// not ask" (9/19: a bill that became law read "We couldn't find SB 2175. Check the number" on a weak signal). When it
// answers null the question is asked once more here, as one plain request: the client has by then retried for about
// seven seconds, and a plain request fails at once instead of doubling that wait.
async function reallyMissing(num, year) {
  if (DEMO) return true;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/public_all_bills?select=id&bill_number=eq.${encodeURIComponent(num)}${year ? `&session_year=eq.${year}` : ''}&limit=1`, { headers: { apikey: SUPABASE_KEY } });
  if (!r.ok) throw new Error('lookup failed: ' + r.status);
  return !(await r.json()).length;
}
async function fetchBill(num, year) {
  if (!DEMO && navigator.onLine === false) throw new Error('offline');   // no signal at all: say so now, not after the retries
  const b = await ensureBill(num, year); if (b) return b;
  if (await reallyMissing(num, year)) return null;
  const again = await ensureBill(num, year); if (again) return again;   // it exists: the first ask failed quietly
  throw new Error('The bill did not load');
}
function load(num, year) {
  const key = keyOf(num, year);
  if (S.blLoading.has(key)) return;
  S.blLoading.add(key); S.blErr.delete(key); S.blMissing.delete(key); S.blTried.add(key);
  // A connection that hangs ends in "Try again", not in a skeleton that never goes away.
  let timer; const slow = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('timeout')), 12000); });
  Promise.race([fetchBill(num, year), slow]).then(b => { if (!b) S.blMissing.add(key); })
    .catch(e => { console.error(e); S.blErr.add(key); })
    .finally(() => { clearTimeout(timer); S.blLoading.delete(key); if (keyFromHash() === key) app.render(); });
}
const retry = key => { S.blErr.delete(key); S.blMissing.delete(key); S.blTried.delete(key); app.render(); };
// Back on a signal: the bill that failed loads by itself.
window.addEventListener('online', () => { const key = keyFromHash(); if (onBill() && S.blErr.has(key)) retry(key); });
// The numbers for one bill (its followers' stances, actions taken on it) load with the followed set. A bill opened by
// link needs its own two small reads. They are decoration: a failure is silent.
function loadSocial(b) {
  if (DEMO || S.blSocial.has(b.id) || S.bills.some(y => y.id === b.id)) return;
  S.blSocial.add(b.id);
  (async () => {
    const sb = await supa();
    const [st, ac] = await Promise.all([sb.from('public_bill_stances').select('*').eq('bill_id', b.id), sb.from('public_action_counts').select('*').eq('bill_id', b.id)]);
    let got = false;
    if (st.data?.[0]) { (S.billStances ??= {})[b.id] = st.data[0]; got = true; }
    if (ac.data?.[0] && !S.actionCounts[b.id]) { S.actionCounts[b.id] = ac.data[0]; got = true; }
    if (got && onBill() && numFromHash() === b.bill_number) app.render();
  })().catch(() => { /* decoration */ });
}
// ---- what each draft changed (R-060, backend migration 120) ----
// The Legislature renames a bill each time a committee amends it (HD1, SD2, CD1). HIPHI's notes say in plain words what
// each draft changed: drafted from the committee reports (backend tools/apply_draft_notes.js), edited by staff in Staff
// v2. Asked for once per bill (public_bill_drafts); the practice copy reads demo/drafts.json. Only drafts up to the
// bill's current one show, so the practice copy, frozen at 16 March, never shows April's.
// The names, the order and the loader live in letters.js (R-148), which also checks a saved letter against them.
export { draftName, draftRank };
function loadDrafts(b) {
  if ((S.blDrafts ??= new Map()).has(b.id)) return;
  S.blDrafts.set(b.id, []);
  draftNotes(b).then(rows => {
    S.blDrafts.set(b.id, rows);
    if (rows.length && onBill() && numFromHash() === b.bill_number) app.render();
  }).catch(() => { /* decoration: the page stands without it */ });
}
function draftsSection(b) {
  const cur = b.current_version ? draftRank(b, b.current_version) : Infinity;
  const list = (S.blDrafts?.get(b.id) || []).filter(d => draftRank(b, d.version) <= cur).sort((x, y) => draftRank(b, y.version) - draftRank(b, x.version));
  if (!list.length) return '';
  const [last, ...rest] = list;
  return `<section class="bl-sec bl-drafts" aria-labelledby="bl-dr-h"><div class="sechead"><h2 id="bl-dr-h">How it has changed</h2></div>
    <p class="meta bl-drwhy">Each time a committee changes a bill, it gets a new draft. What changed, from the committees’ reports:</p>
    <p class="bl-drlast"><b>${esc(draftName(last.version))}${last.version === b.current_version ? ', the latest' : ''}:</b> ${esc(last.summary)}</p>
    ${rest.length ? `<details class="bl-drmore"><summary>${icon('chevron-down', { cls: 'bl-chev' })}<span>Earlier drafts (${rest.length})</span></summary>
      <ul class="bl-drlist" role="list">${rest.map(d => `<li><b>${esc(draftName(d.version))}:</b> ${esc(d.summary)}</li>`).join('')}</ul></details>` : ''}
  </section>`;
}
// Following another bill reloads the followed set and drops this one's committee reports; keep them so where the bill
// stands does not change under the reader.
const OUT = {};
function keepOutcomes(b, hs) {
  const have = hs.map(h => S.outcomes[h.id]).filter(Boolean);
  if (have.length >= (OUT[b.id]?.length || 0)) OUT[b.id] = have;
  else OUT[b.id].forEach(o => { if (!S.outcomes[o.hearing_id]) S.outcomes[o.hearing_id] = o; });
}

// ---------------- Back ----------------
// Back goes to the previous screen when this visit has one, and Home when the bill is the first page opened (a
// shared link), so Back never leaves the app. A first visit that arrived on a link has the guided start behind it
// (history.state.arrived, set by app.js). The entry the page loaded on is marked once, the first time it renders.
const LOAD_LEN = history.length;
function stampRoot() {
  if (history.length !== LOAD_LEN || history.state?.arrived || history.state?.blRoot) return;
  try { history.replaceState({ ...(history.state || {}), blRoot: true }, ''); } catch { /* ignore */ }
}
const goBack = () => { if (history.state?.arrived || !history.state?.blRoot) history.back(); else app.go('#/'); };

// ---------------- the bill's situation, and the one main action it calls for ----------------
// kind, with a hearing ahead (the same easiest-first ladder as the action card, so the page and the card never
// disagree): email (nobody's first step should need a letter and a Capitol account, so until a person has taken any
// action the main step is the two-minute email; it is also the step left once the written deadline has passed) ·
// testify (they have acted before: testimony leads) · capitol (their stance differs from HIPHI's: HIPHI's scripted
// letter and email are not offered; the Capitol's own page is) · share (done here).
// Without one: ask (waiting for a hearing: the chair decides, so ask the chair) · hold (waiting, and HIPHI opposes it)
// · stopped · law · share (floor votes, conference, the Governor).
// Nothing is offered on a bill that is not alive: no action, no upcoming hearing, no deadline (assessment 9/19: a
// stopped bill said "Testimony due today" because of a stray hearing row).
// "I emailed the chair about this waiting bill" is remembered per committee, so a bill asked about in the House is
// offered again when it later waits in the Senate (Home builder, 9/19). The email itself is still the person's action
// under the usual key, <bill id>||email: that is what is counted and what reaches their account. The committee mark,
// <bill id>|<committee code as referred, e.g. HHS/EIG>|ask, lives in this browser only: 'ask' is not an action kind,
// so core neither counts nor uploads it. A mark from before this change (the usual key, with no committee mark on
// the bill at all) still counts, for every committee.
const asked = askedChair;   // the rule lives in core, shared with Home

// After the committees (R-056, Nate 9/24-9/26): a bill on the floor, in conference or on the Governor's desk offered
// only Share. Each of those stages has someone to reach: the floor vote -> the person's own legislator in that chamber
// (members listen closest to the people they represent); conference -> the conference chairs, named in the Capitol's
// appointment notice; the Governor -> the Governor's own "Comments on Legislation" page (the office takes comments
// there; checked 9/26). A stopped bill already offers its issue to follow, and a bill waiting for its next committee
// already asks that committee's chair.
const GOV_URL = 'https://governor.hawaii.gov/comments-on-legislation/';
const plainName = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f\u02bb\u2018\u2019']/g, '').toLowerCase().trim();
const surname = l => String(l.sort_name || l.name || '').split(',')[0].trim();
const myLeg = ch => { const d = myDistricts(), n = d && (ch === 'S' ? d.senate : d.house); return n ? (S.legislators || []).find(l => l.chamber === ch && +l.district === +n) || null : null; };
const billActs = b => [...(S.activity || []), ...((S.xa || {})[b.id] || [])].filter(a => a.bill_id === b.id).sort((x, y) => String(y.occurred_at).localeCompare(String(x.occurred_at)));
// "House Conferees Appointed: Belatti, Garrett, Morikawa Co-Chairs; Iwamoto, Souza." and "Senate Conferees Appointed:
// Fukunaga Chair; Kim, Lee, C. Co-Chairs." -> each chamber's latest list, matched to legislators by surname (and the
// first initial where the Capitol gives one, as for the two Lees). Chairs first.
export function conferees(b) {
  const rows = billActs(b).filter(a => /conferees appointed:/i.test(a.title || '')), out = [];
  for (const ch of ['H', 'S']) {
    const row = rows.find(a => (ch === 'H' ? /^\s*House/i : /^\s*Senate/i).test(a.title)); if (!row) continue;
    for (const grp of row.title.replace(/^.*?appointed:\s*/i, '').replace(/\.\s*$/, '').split(';')) {
      const chair = /\bco-?chairs?\b|\bchair\b/i.test(grp), names = [];
      for (const t of grp.replace(/\b(co-?chairs?|chair)\b/ig, '').split(',').map(v => v.trim()).filter(Boolean)) {
        if (/^[A-Z]\.?$/.test(t) && names.length) names[names.length - 1] += ' ' + t; else names.push(t); }
      for (const nm of names) {
        const m = /^(.*?)\s+([A-Z])\.?$/.exec(nm), last = plainName(m ? m[1] : nm), ini = m ? m[2] : '';
        const l = (S.legislators || []).find(x => x.chamber === ch && plainName(surname(x)) === last && (!ini || String(x.sort_name || '').split(',')[1]?.trim()[0] === ini));
        if (l && !out.some(o => o.l.id === l.id)) out.push({ l, chair });
      }
    }
  }
  return out.sort((x, y) => (y.chair ? 1 : 0) - (x.chair ? 1 : 0));
}
const vetoNotice = b => billActs(b).some(a => /intent to veto/i.test(a.title || ''));
// A legislator as someone to email: "Dear Representative Iwamoto", or "Dear Chair Matayoshi" for a conference chair.
const contactOf = (l, chair) => ({ last: surname(l), email: l.email, greet: `${chair ? 'Chair' : l.chamber === 'S' ? 'Senator' : 'Representative'} ${surname(l)}` });
// Exported so the onboarding wizard's "Reading a bill" miniature (pub/start.js) can reuse the real
// stage rail instead of re-deriving it - the miniature and the real page must never disagree.
export function situation(b) {
  const st = stopOf(b), hs = hearingsOf(b), pos = posInfo(b), law = b.stage === 'enacted' || st.phase === 'law';
  // A constitutional amendment the Legislature passed: finished here, the voters decide (R-072). Not law, not stopped.
  const ballot = b.stage === 'ballot' || st.phase === 'ballot';
  const stopped = !law && !ballot && (b.stage === 'dead' || b.stage === 'vetoed' || (!alive(b) && b.stage !== 'governor'));
  const live = !law && !ballot && !stopped, differs = agrees(b) === false;
  const act = live ? openActions([b], hs)[0] || null : null;
  // Who decides next: the committee holding the bill now (the hearing's committee when one is set).
  const code = !live ? null : act ? act.h.committee : st.phase === 'committee' ? (st.hearing?.committee || st.committee) : null;
  const chairs = code ? chairContacts(code) : [];
  const waiting = live && !act && st.phase === 'committee' && st.hearingState === 'none' && !!st.committee && !st.deadline?.missed;
  let kind = 'share';
  if (law) kind = 'law';
  else if (ballot) kind = 'ballot';
  else if (stopped) kind = 'stopped';
  // Testimony is the main action wherever there is a hearing, for everyone, whatever they think of the bill: the
  // walkthrough writes the letter from their own stance (Nate 9/27, R-068). The quick email is under More ways to help.
  else if (act) kind = didKind(b, act.h, 'testimony') ? 'share' : 'testify';
  else if (waiting && pos && chairs.length && !asked(b, code)) kind = differs ? 'capitol' : /oppose/.test(b.hiphi_position) ? 'hold' : 'ask';
  // R-153: they asked this committee's chair already and it still has no hearing a week before its deadline: one short
  // reminder to the same chair (Nate 10/4: "Yes for now, but needs to be reconsidered"). Once sent, never again here.
  // Only after their own email to this committee is at least five days old (never when we don't know when they wrote):
  // otherwise someone who emails six days before the deadline would be offered a follow-up the next morning (P-5).
  else if (waiting && pos && chairs.length && !differs && st.deadline && !st.deadline.missed && st.deadline.days <= 7 && !S.done.has(askMark(b, 'remind:' + code))
    && (L => L && L.key === 'email|' + code && Date.now() - Date.parse(L.sent) >= 5 * 864e5)(letterOn(b, 'email'))) kind = 'remind';
  // After the committees (see GOV_URL above). Only where HIPHI supports or opposes it, so there is a clear ask; once the
  // person says they sent it, this stage is not offered again (askMark with the stage as its key).
  const stepKey = !live || act || !/support|oppose/.test(b.hiphi_position || '') ? ''
    : b.stage === 'governor' || st.phase === 'governor' ? 'governor' : st.phase === 'conference' ? 'conference' : st.phase === 'floor' ? 'floor-' + st.chamber : '';
  let to = [], conf = false;
  if (kind === 'share' && stepKey && !S.done.has(askMark(b, stepKey))) {
    if (stepKey === 'governor') kind = 'governor';
    else if (stepKey === 'conference') { const cs = conferees(b).filter(c => c.chair); conf = cs.length > 0;
      to = conf ? cs.map(c => c.l) : ['H', 'S'].map(myLeg).filter(Boolean); kind = 'conference'; }
    else { to = [myLeg(st.chamber)].filter(Boolean); kind = 'floor'; }
    to = to.filter(l => l.email);
  }
  return { st, hs, pos, law, ballot, stopped, live, differs, act, code, chairs, waiting, kind, stepKey, to, conf, k: act ? `${b.id}|${act.h.id}` : '', qKey: `${b.id}|sentq` };
}

// A ready-to-send email to one or more chairs. Greeting by surname ("Dear Chair San Buenaventura"), the person's
// name and town from the testimony helper when they have given them, the plain summary, and one clear ask.
// mode 'own' is for someone who sees the bill differently from HIPHI: what the bill does, and room for their words.
function mailFor(b, x, chairs, mode) {
  const m = me(), p = posInfo(b), sp = spaced(b.bill_number);
  const dear = chairs.length ? chairs.map(c => c.greet || `Chair ${c.last}`).join(' and ') : 'Chair';
  // Who is writing (R-147): their two titles that fit this bill, and where they live only when one of these lawmakers is
  // their own (Nate 10/4: most emails go to chairs who aren't theirs, so the town an older device kept is left out).
  // A joint hearing's email goes to two chairs: "your district" only when both are theirs, else the one chair by name
  // (R-156, the review). One name and the titles from the profile (pub/myprofile.js).
  const d = myDistricts(), mine = chairs.filter(c => mineLabel(c.leg || c.l, d)), name = myName();
  const where = !mine.length ? '' : mine.length === chairs.length ? 'your district' : `${mine.map(c => c.greet || `Chair ${c.last}`).join(' and ')}’s district`;
  const two = pickTitle(myTitles(), { cats: (issuesOf(b) || []).map(i => i.category), text: [nick(b), b.hiphi_summary, b.title].filter(Boolean).join(' ') });
  const who = name ? `My name is ${name}${two.length ? `, ${aWords(two)}${needsSelf(two) ? ' writing for myself' : ''}` : ''}${where ? `${two.length ? ',' : ''} and I live in ${where}` : ''}. ` : '';
  const about = asSentence(blurb(b, 300).replace(/[.…\s]+$/, '') + '.');
  const ask = b.hiphi_action ? '\n\n' + b.hiphi_action.trim().replace(/([^.!?])$/, '$1.') : '';
  const dl = x.st.deadline && !x.st.deadline.missed ? dateLong(x.st.deadline.date + 'T12:00:00-10:00') : '';
  const h = x.act?.h || x.st.hearing, ahead = h && new Date(h.scheduled_at) > Date.now();
  let subject, body;
  if (mode === 'own' || !p) {
    subject = sp;
    body = `${who}I am writing about ${sp}. ${about}\n\n[Say whether you support or oppose it, and why.]`;
  } else if (mode === 'ask') {
    subject = `${sp}: please give it a hearing`;
    body = `${who}I am writing to ask you to schedule a hearing for ${sp}. ${about}${ask}\n\n${dl ? `It needs a hearing by ${dl} to stay alive this session. ` : ''}Please give it a hearing so the public can weigh in.`;
  } else if (mode === 'floor') {
    const yes = p.verb === 'oppose' ? 'no' : 'yes', ch = N[x.st.chamber] || 'full chamber';
    subject = `${sp}: please vote ${yes}`;
    body = `${who}I am writing to ${p.verb} ${sp}. ${about}${ask}\n\nIt comes to a vote of the full ${ch} soon. Please vote ${yes}.`;
  } else if (mode === 'conference') {
    const want = p.verb === 'oppose' ? 'let it go' : 'agree on one version and pass it';
    subject = `${sp}: please ${p.verb === 'oppose' ? 'let it go' : 'pass it'} in conference`;
    body = `${who}I am writing to ${p.verb} ${sp}. ${about}${ask}\n\nThe House and Senate are working out one version in conference. ${x.conf ? 'Please' : 'Please urge the conference committee to'} ${want}.`;
  } else if (mode === 'hold') {
    subject = `${sp}: please hold this bill`;
    body = `${who}I am writing to oppose ${sp}. ${about}${ask}\n\nPlease do not schedule it for a hearing.`;
  } else {
    const want = p.verb === 'oppose' ? 'hold' : p.verb === 'comment on' ? 'consider' : 'pass';
    subject = `${sp}: please ${want} it`;
    body = `${who}I am writing to ${p.verb} ${sp}. ${about}${ask}\n\nPlease ${want} this bill${ahead ? ` at the hearing on ${dateLong(h.scheduled_at)}` : ''}.`;
  }
  // The town signs off only to their own lawmakers (R-147; the review found it still went to every chair here).
  const text = `Dear ${dear},\n\n${body}\n\nMahalo,\n${name || '[your name]'}${mine.length && m.town ? '\n' + m.town : ''}`;
  return `mailto:${chairs.map(c => c.email).filter(Boolean).join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
}
const mailMode = x => x.differs ? 'own' : x.kind === 'hold' ? 'hold' : x.kind === 'ask' || (x.waiting && x.pos && !/oppose/.test(x.pos.verb)) ? 'ask' : x.waiting && x.pos ? 'hold' : 'about';

// A newcomer from a link whose card is showing (newcomer() below draws it on the same terms).
const newbie = b => firstVisit() && !S.blLooking?.has(b.id);
// The stopped bill's main button is "Follow the issue" (mainButton), so no other Follow is drawn beside it (B3-3, A-14).
const followIsMain = (b, x) => x.kind === 'stopped' && (i => !!i && !issueFollowed(i))(issuesOf(b)[0]);
// Between sessions, what happens next to a stopped bill (B3-1, R-199): which year it stopped, whether it can come back and
// when its idea can. Hawaiʻi's two-year term: a bill alive at the end of an odd year's session carries over to the next
// year, but every bill still not passed at the end of the even year is gone, and its idea needs a new bill. The words
// follow whatever R-144 settles for "stopped". With the follow as the main button, "Find your legislators" is the second
// choice, here, for someone whose legislators the page doesn't know yet.
function stoppedNext(b, x) {
  const si = sessionInfo(); if (!x.stopped || si.phase === 'in') return '';
  const yr = +b.session_year || si.recapYear, when = si.nextOpen ? new Date(si.nextOpen + 'T12:00:00-10:00').toLocaleDateString('en-US', { timeZone: HST, month: 'long', day: 'numeric' }) : '';
  const meets = when ? `when the Legislature meets on ${when}` : 'when the Legislature meets in January';
  const text = yr % 2 === 0 || b.stage === 'vetoed' ? `Stopped in ${yr}. This bill can’t come back, but its idea can, as a new bill ${meets}.`
    : `Stopped in ${yr}. It may be taken up again ${meets}.`;
  const second = followIsMain(b, x) && !myDistricts() ? btn('Find your legislators', { kind: 'text', sm: true, icon: 'map-pin', href: `#/legislators?from=${encodeURIComponent(billRef(b))}` }) : '';
  return `<div class="bl-after"><p>${esc(text)}</p>${second}</div>`;
}

// The page's one main button. On a phone it sits in the sticky bottom bar; on a wide screen it sits in the side panel,
// inside the action card when there is one. While the email composer is open its own "Open in my mail app" is the
// main button, so this one steps aside (two blue buttons competed before).
function mainButton(b, x) {
  // After the mail app opened: one question, so a sent email counts.
  const sentWord = x.kind === 'governor' ? 'message' : 'email';
  if (S.sentq?.[x.qKey]) return `<div class="bl-barq" role="group" aria-label="Did you send your ${sentWord}?"><p class="bl-barq-t">Did you send your ${sentWord}?</p>
    ${btn('Yes, I sent it', { kind: 'primary', sm: true, attrs: { 'data-bl-sent': 'yes' } })}${btn('Not yet', { kind: 'text', sm: true, attrs: { 'data-bl-sent': 'no' } })}</div>`;
  if (x.act && S.compose === x.k) return '';
  switch (x.kind) {
    case 'email': return btn('Send a quick email · 2 min', { kind: 'primary', icon: 'mail', full: true, attrs: { 'data-bl-go': 'compose' } });
    case 'testify': return btn(testifyLabel(b, x.act?.h, x.act?.late), { kind: 'primary', icon: 'notebook-pen', full: true, attrs: { 'data-bl-go': 'testify' } });
    case 'capitol': return btn(x.act ? 'Testify at the Capitol site' : 'See the Capitol bill page', { kind: 'primary', icon: 'landmark', iconEnd: 'external-link', full: true, href: capitolUrl(b), attrs: { 'data-bl-go': 'capitol', target: '_blank', rel: 'noopener' } });
    // "Send my email again" when their email on this bill from its last step is ready (R-153).
    case 'ask': return btn(mailLabel(b, 'email|' + x.code, x.chairs.length > 1 ? 'Ask the chairs for a hearing' : 'Ask the chair for a hearing', sendTo(x)), { kind: 'primary', icon: 'mail', full: true, href: mailFor(b, x, x.chairs, 'ask'), attrs: { 'data-bl-main': 'ask', 'data-bl-mail': '-' } });
    case 'hold': return btn(mailLabel(b, 'email|' + x.code, 'Email the chair · 2 min', sendTo(x)), { kind: 'primary', icon: 'mail', full: true, href: mailFor(b, x, x.chairs, 'hold'), attrs: { 'data-bl-main': 'hold', 'data-bl-mail': '-' } });
    case 'remind': return btn(x.chairs.length > 1 ? 'Follow up with the chairs · 1 min' : 'Follow up with the chair · 1 min', { kind: 'primary', icon: 'mail', full: true, href: mailFor(b, x, x.chairs, /oppose/.test(b.hiphi_position || '') ? 'hold' : 'ask'), attrs: { 'data-bl-main': 'remind', 'data-bl-mail': '-' } });
    case 'floor': case 'conference': {
      if (!x.to.length) return btn('Find your legislators', { kind: 'primary', icon: 'map-pin', full: true, href: `#/legislators?from=${encodeURIComponent(billRef(b))}` });
      const one = x.to.length === 1 ? x.to[0] : null, yes = /oppose/.test(b.hiphi_position || '') ? 'no' : 'yes';
      const label = x.differs ? (x.conf ? `Email the conference ${one ? 'chair' : 'chairs'}` : one ? `Email ${legTitle(one)} ${surname(one)}` : 'Email your legislators')
        : x.kind === 'floor' ? `Ask ${legTitle(one)} ${surname(one)} to vote ${yes}` : x.conf ? `Email the conference ${one ? 'chair' : 'chairs'}` : 'Email your legislators';
      return btn(esc(label), { kind: 'primary', icon: 'mail', full: true, href: mailFor(b, x, x.to.map(l => contactOf(l, x.conf)), x.differs ? 'own' : x.kind), attrs: { 'data-bl-main': x.kind, 'data-bl-mail': '-' } });
    }
    case 'governor': return btn(x.differs ? 'Tell the Governor what you think' : /oppose/.test(b.hiphi_position || '') ? 'Ask the Governor to veto it' : 'Ask the Governor to sign it',
      { kind: 'primary', icon: 'landmark', iconEnd: 'external-link', full: true, href: GOV_URL, attrs: { 'data-bl-main': 'governor', 'data-bl-mail': '-', target: '_blank', rel: 'noopener' } });
    case 'law': return btn(x.differs ? 'Share this bill' : 'Share the good news', { kind: 'primary', icon: 'share-2', full: true, attrs: { 'data-bl-go': 'share' } });
    case 'stopped': {
      // A stopped bill is not the end of its issue: follow the issue and its next bills come to you (R-018). Between
      // sessions too (B3-1, R-199): following the issue is what brings its new bills in January, so it leads, and "Find
      // your legislators" is the second choice beside the line that says what happens next (stoppedNext). A newcomer from
      // a link gets their card's own follow here (its moment, then the rest of the first visit), so the page asks once.
      const off = sessionInfo().phase !== 'in', bi = issuesOf(b)[0];
      if (bi && !issueFollowed(bi)) return btn('Follow the issue', { kind: 'primary', icon: 'star', full: true, attrs: { [newbie(b) ? 'data-bl-newfollow' : 'data-bl-followissue']: newbie(b) ? '1' : bi.id, 'aria-label': `Follow the issue: ${bi.name}` }, cls: 'bl-barbtn' });
      if (off && !myDistricts()) return btn('Find your legislators', { kind: 'primary', icon: 'map-pin', full: true, href: `#/legislators?from=${encodeURIComponent(billRef(b))}` });
      if (bi) return btn(`See ${esc(bi.name)}`, { kind: 'primary', icon: 'arrow-right', full: true, href: `#/issue/${encodeURIComponent(bi.slug)}`, cls: 'bl-barbtn' });
      return btn(off ? 'Find bills' : 'Find bills still moving', { kind: 'primary', icon: 'search', full: true, href: '#/find' });
    }
    default: return btn('Share this bill', { kind: 'primary', icon: 'share-2', full: true, attrs: { 'data-bl-go': 'share' } });
  }
}

// ---------------- the stops, in plain words ----------------
// A bill starts in one chamber, goes through its committees and a vote, crosses to the other chamber and does the same,
// then goes to the Governor. No Triple, Lateral or Decking. Each committee is its own step, named (R-081, Nate 9/29: "see
// real progress" and "understand the process"); two committees that hear it together are one step, since it is one
// hearing and one vote. A chamber that has not picked its committees yet is one step, "Senate committees", until it does.
const ORD = ['1st', '2nd', '3rd'];
// The committee's full name, as the Capitol gives it ("Water, Land, Culture and the Arts"; Nate 9/29: not "Senate Water").
// Heard together: "Health and Commerce" (or "Health, Commerce and Judiciary"); when a name has its own "and", "&" or comma,
// the first is named "with" the rest: "Labor and Technology with Health and Human Services" (HB1782 read "Labor and
// Technology and Health", three committees at a glance), "Water, Land, Culture and the Arts with Housing and Hawaiian
// Affairs" (HB2049). Three or four whose names run together are "... with 3 other committees"; See all steps names each.
// A code no longer in the committee list (a 2025 committee on a carried-over bill: WTL, HRE, TCA) stays as its code
// rather than dropping out of the name.
const andList = ns => ns.length > 1 ? `${ns.slice(0, -1).join(', ')} and ${ns[ns.length - 1]}` : ns[0];
const mixed = n => /\s(?:and|&)\s|,/.test(n);
const cmteBrief = code => { const ns = String(code).split('/').map(c => c.trim()).filter(Boolean).map(c => S.committees[c]?.name || c);
  if (ns.length < 2 || !ns.some(mixed)) return andList(ns);
  const rest = ns.slice(1);
  return rest.length > 1 && rest.some(mixed) ? `${ns[0]} with ${rest.length} other committees` : `${ns[0]} with ${andList(rest)}`; };
// One committee step's name in the list, linked to the committee's page (members, chair, what it has now).
const cmteLink = code => String(code).split('/').map(k => k.trim()).filter(Boolean)
  .map(k => S.committees[k] ? `<a href="#/committee/${esc(k)}">${esc(cmteLabel(k))}</a>` : esc(cmteLabel(k))).join(' and ');
const sameCmte = (a, b) => String(a).split('/').some(k => String(b).split('/').includes(k));
function railInfo(b, x) {
  const st = x.st, o = originOf(b), t = o === 'H' ? 'S' : 'H', res = isResolution(b), one = res && isOneChamber(b);
  // A constitutional amendment goes from the Legislature to the voters, not the Governor ("PROPOSING AMENDMENTS TO ...").
  const conAm = !res && (b.stage === 'ballot' || /proposing (?:an )?amendments? to/i.test(b.title || ''));
  const word = res ? 'resolution' : 'bill';
  // Where one chamber's committees end and the other's begin (the same split billStop makes).
  const refs = b.referrals || [], n = Math.min(b.origin_stops || refs.length, refs.length), lists = { [o]: refs.slice(0, n), [t]: refs.slice(n) };
  // The coarse path, one step per stage; committee stages are expanded below.
  const coarse = one ? ['intro', 'cm' + o, 'vote' + o, 'adopted'] : res ? ['intro', 'cm' + o, 'vote' + o, 'cm' + t, 'vote' + t, 'adopted']
    : ['intro', 'cm' + o, 'vote' + o, 'cm' + t, 'vote' + t, 'gov', 'law'];
  const last = coarse.length - 1, d = b.died_at_stage || '';
  // Which coarse step it is at.
  let ci;
  if (x.law) ci = last;
  else if (res) {
    if (st.phase === 'dead' || x.stopped) ci = one ? (/_floor$/.test(d) ? 2 : 1) : /^second_floor|^second_crossover|^conference/.test(d) ? 4 : /^second|^first_crossover/.test(d) ? 3 : d === 'first_floor' ? 2 : 1;
    else if (st.phase === 'floor') ci = st.leg === 'first' ? 2 : 4;
    else if (st.phase === 'conference') ci = one ? 2 : 4;
    else ci = st.leg === 'first' ? 1 : (one ? 1 : 3);
  } else if (x.ballot || /governor|vetoed/.test(b.stage) || /governor|vetoed/.test(st.phase)) ci = 5;
  else if (st.phase === 'dead') {
    // No record of where it stopped: a hearing already held in the other chamber shows it had crossed over (a page
    // said "Stopped in House committees" above a Senate hearing marked Heard).
    const crossed = !d && x.hs.some(h => S.committees[String(h.committee).split('/')[0]]?.chamber === t && new Date(h.scheduled_at) < Date.now());
    // Through its committees, then no floor vote: stopped at the vote step (first_floor / second_floor, R-072).
    ci = /^second_crossover|^conference|^second_floor/.test(d) ? 4 : /^second|^first_crossover/.test(d) || crossed ? 3 : d === 'first_floor' ? 2 : 1;
  } else if (st.phase === 'conference') ci = 4;
  else if (st.phase === 'floor') ci = st.leg === 'first' ? 2 : 4;
  else ci = st.leg === 'first' ? 1 : 3;
  // Where in that chamber's committees: the one holding it now, or the one it stopped in (stoppedAt reads the stage it
  // stopped at, R-077). Without either, where the stage puts it: Triple = the first, Decking = the last, Lateral between.
  const offIn = list => {
    if (!list.length) return 0;
    if (!x.stopped || !d) return Math.max(0, Math.min(list.length - 1, (st.stop || 1) - 1));
    const at = stoppedAt(b), i = at ? list.findIndex(c => sameCmte(c, at.committee)) : -1;
    if (i >= 0) return i;
    return d === 'first_crossover' || /triple|introduced/.test(d) ? 0 : /decking/.test(d) ? list.length - 1 : list.length <= 2 ? 0 : list.length - 2;
  };
  const steps = []; let idx = 0;
  coarse.forEach((k, i) => {
    if (i === ci) idx = steps.length;
    const ch = k.slice(-1), C = N[ch];
    if (k.startsWith('cm')) {
      const list = lists[ch];
      if (i === ci) idx += offIn(list);
      if (!list.length) {
        // Not sent to a committee yet (the other chamber picks its own after the bill crosses over).
        const first = ch === o;
        steps.push({ kind: 'wait', ch, name: `${C} committees`, html: esc(`${C} committees`),
          desc: `${first ? `The ${C} sends the ${word}` : `After the ${word} crosses over, the ${C} sends it`} to one to three committees. Each holds a hearing and votes, one after another. It needs a yes from each.${x.stopped || x.law ? '' : ' Not chosen yet.'}` });
        return;
      }
      list.forEach((c, j) => {
        const two = String(c).includes('/');
        steps.push({ kind: 'cmte', ch, code: c, j, of: list.length, name: `${C} ${cmteBrief(c)}`, html: cmteLink(c) + (two ? ', together' : ''),
          desc: `${list.length > 1 ? `The ${ORD[j] || j + 1 + 'th'} of ${list.length} ${C} committees. ` : `The only ${C} committee on its path. `}${two ? `The ${['two', 'three', 'four', 'five'][String(c).split('/').length - 2] || 'committees'} hold one hearing and vote together.` : 'It holds a hearing and votes.'} The ${word} needs a yes here to go on${j === 0 && ch === o ? '; the chair decides if it gets a hearing' : ''}.` });
      });
      return;
    }
    if (k === 'intro') steps.push({ name: 'Introduced', desc: res ? 'A lawmaker offers the resolution and it gets a number.' : 'A lawmaker files the bill and it gets a number.' });
    else if (k.startsWith('vote')) {
      const first = ch === o;
      // In conference, or stopped there, the other chamber has already voted: a dot saying "Senate vote" marked "Stopped
      // here" read as if the Senate had voted it down (HB 1782; Nate 9/26). That step is the final version.
      const fin = !res && !first && (st.phase === 'conference' || (x.stopped && /^(second_crossover|conference)$/.test(d)));
      steps.push({ name: fin ? 'Final version' : `${C} vote`,
        desc: one ? `The full ${C} votes on it.` : res ? (first ? `The full ${C} votes. If it passes, it goes to the ${N[t]}.` : `The full ${C} votes on it.`)
          : first ? `The full ${C} votes. If it passes, it crosses over to the ${N[t]}.` : `The full ${C} votes. If the House and Senate passed different versions, they work out one.` });
    }
    else if (k === 'adopted') steps.push({ name: 'Adopted', desc: `${one ? `The ${N[o]} has` : 'Both chambers have'} adopted it. A resolution states a position or makes a request; it is not a law.` });
    else if (k === 'gov') steps.push({ name: conAm ? 'The voters' : 'Governor', desc: conAm ? 'A change to the constitution goes on the November ballot, and the voters decide.' : 'The Governor signs it, lets it become law without signing, or vetoes it.' });
    else steps.push({ name: conAm ? 'Constitution' : 'Law', desc: conAm ? 'If the voters say yes, it becomes part of the Hawaiʻi constitution.' : 'It becomes a Hawaiʻi law.' });
  });
  if (x.law) idx = steps.length - 1;
  // The words under the dots: "Now: House Health, 1st of 3 House committees". `pic` is the same place for a small
  // picture, the committee by its chamber and number only ("In the 1st of 2 Senate committees"), as these words were before
  // each committee was named (R-081): a full name ran off both edges of the session lesson's drawing (R-179).
  const s = steps[idx], C = N[s.ch] || N[ci <= 2 ? o : t], ord = s.kind === 'cmte' ? ORD[s.j] || `${s.j + 1}th` : '';
  let lead = 'Now: ', rest, pic;
  if (x.law) { lead = res ? 'Adopted' : 'Became law'; rest = ''; }
  else if (x.stopped) {
    lead = '';
    rest = res ? 'Not adopted this session' : b.stage === 'vetoed' ? 'Vetoed by the Governor'
      : s.kind === 'cmte' ? `Stopped in ${s.name}` : s.kind === 'wait' ? `Stopped in ${C} committees`
      : ci === 4 && /conference|second_crossover/.test(d) ? 'Stopped before the final vote' : `Stopped before the ${C} vote`;
    if (rest === `Stopped in ${s.name}`) pic = `Stopped in ${C} committees`;
  }
  else if (x.ballot) rest = 'The voters decide in November';
  else if (st.phase === 'conference') rest = res ? `Waiting for the ${C} vote` : 'Working out one version';
  else if (!res && ci === 5) rest = 'On the Governor’s desk';
  else if (st.phase === 'floor') rest = `Waiting for the ${C} vote`;
  else if (s.kind === 'cmte') {
    rest = s.of > 1 ? `${s.name}, ${ord} of ${s.of} ${C} committees` : `${s.name}, its only ${C} committee`;
    pic = s.of > 1 ? `In the ${ord} of ${s.of} ${C} committees` : `In its only ${C} committee`;
  }
  else { rest = `Waiting for the ${C} to choose its committees`; pic = `${C} committees not chosen yet`; }
  return { names: steps.map(s => s.name), desc: steps.map(s => s.desc), html: steps.map(s => s.html || esc(s.name)), idx, lead, rest, pic: pic || rest };
}
// The rail's words for where the bill is, short enough for a small picture (the session lesson's label, R-179): "In the
// 1st of 2 Senate committees" where the rail says "Now: Senate Health and Human Services with Commerce and Consumer
// Protection, 1st of 2 Senate committees". Everything that names no committee is word for word the same.
export function railBrief(b, x) { const r = railInfo(b, x); return `${r.lead === 'Now: ' ? '' : r.lead}${r.pic}`.trim(); }
// After a stop, the later steps were never reached; "still ahead" told a screen reader the bill could still get there (B3-3, WCAG 1.3.1).
const STEP_WORD = { done: 'done', now: 'now', stop: 'stopped here', next: 'still ahead', unreached: 'not reached' };
const fold = (b, name) => `data-bl-fold="${name}"${S.blOpen.has(`${b.id}|${name}`) ? ' open' : ''}`;
// A stopped bill: under "Stopped in Senate committees", exactly why (Nate 9/29: "These notes need to be in the steps
// section"; R-085). The committee, what happened there, and the rule it missed with its date.
export function railHTML(b, x) {
  const r = railInfo(b, x), n = r.names.length, at = s => x.law || s < r.idx ? 'done' : s === r.idx ? (x.stopped ? 'stop' : 'now') : 'next';
  // The words under the dots start under the current dot, end under it at the right-hand end, or centre on it between;
  // they span about three quarters of the row so they wrap as little as they can (up to 11 dots, R-081).
  const span = Math.min(n, Math.max(5, Math.round(n * 0.72))), i1 = r.idx + 1;
  const [align, from] = r.idx + span <= n ? ['l', i1] : i1 - span >= 0 ? ['r', i1 - span + 1] : ['c', Math.min(Math.max(1, i1 - Math.floor(span / 2)), n - span + 1)];
  // Where there is room (a tablet, a laptop) every dot carries its name; on a phone only the current one does.
  const dots = r.names.map((nm, i) => { const s = at(i), tag = s === 'now' ? 'Now' : s === 'stop' ? 'Stopped here' : '';
    return `<li class="bl-${s}"><span class="bl-dw"><span class="bl-dot">${s === 'done' ? icon('check') : s === 'stop' ? icon('x') : ''}</span></span><span class="bl-dlbl" aria-hidden="true">${tag ? `<b>${tag}</b>` : ''}${esc(nm)}</span><span class="sr">Step ${i + 1} of ${n}, ${esc(nm)}: ${STEP_WORD[s === 'next' && x.stopped ? 'unreached' : s]}.</span></li>`; }).join('');
  const steps = r.names.map((nm, i) => { const s = at(i), tag = { done: 'Done', now: 'Now', stop: 'Stopped here', next: '' }[s];
    return `<li class="bl-s-${s}"><span class="bl-sdot">${s === 'done' ? icon('check') : s === 'stop' ? icon('x') : ''}</span><div><p class="bl-sname">${r.html[i]}${tag ? ` <span class="bl-stag">${tag}</span>` : ''}</p><p class="bl-sdesc">${esc(r.desc[i])}</p></div></li>`; }).join('');
  return `<div class="bl-rail${x.stopped ? ' bl-railstop' : x.law ? ' bl-raillaw' : ''}${n > 8 ? ' bl-many' : ''}${n >= 7 ? ' bl-alt' : ''}" style="--n:${n}">
      <ol class="bl-dots bl-n${n}" aria-label="The ${n} steps ${isResolution(b) ? 'to adoption' : 'from bill to law'}">${dots}</ol>
      <p class="bl-nowlbl bl-${align}" style="grid-column:${from} / span ${span}" aria-hidden="true">${r.lead ? `<b>${esc(r.lead)}</b>` : ''}${esc(r.rest)}</p>
    </div>
    ${x.stopped ? `<p class="bl-why">${esc(stopDetail(b))}</p>${sameLine(b)}` : ''}
    <details class="bl-steps" ${fold(b, 'steps')}><summary><span>See all steps</span>${icon('chevron-down', { cls: 'bl-chev' })}</summary><ol class="bl-steplist">${steps}</ol>
      <p class="bl-learn"><a href="#/learn/session/${esc(b.id)}">${icon('play')}<span>Watch this bill’s trip through the Capitol, about a minute</span></a></p></details>`;   // the lesson, in the moment (R-067 #11)
}

// ---------------- the page ----------------
// Phones: Back, the number, the follow star and a small menu, in a bar that stays at the top. Wide screens: Back and
// the number in a plain row (follow, share and copy link sit in the side panel, which stays in view).
function topbar(num, b) {
  const on = !!b && S.watch.has(b.id), sp = spaced(num) || 'Bill', w = wide();
  const tools = b && !w ? `${issuesOf(b).length ? '' : iconBtn('star', `Follow ${sp}`, { 'data-bl-star': '1', 'aria-pressed': on ? 'true' : 'false' }, on ? 'on' : '')}
      <div class="bl-menuwrap">${iconBtn('ellipsis', 'More options', { 'data-bl-menu': '1', 'aria-expanded': 'false', 'aria-controls': 'bl-menu' })}
        <div class="bl-menu" id="bl-menu" hidden>
          <button type="button" class="bl-mi" data-bl-addto="1">${icon('list-plus')}<span>Add to a list</span></button>
          <button type="button" class="bl-mi" data-bl-copy="1">${icon('link')}<span>Copy link</span></button>
          <button type="button" class="bl-mi" data-bl-share="1">${icon('share-2')}<span>Share</span></button>
          <a class="bl-mi" href="${esc(capitolUrl(b))}" target="_blank" rel="noopener" data-bl-close="1" data-ab-go="capitol">${icon('landmark')}<span>Capitol bill page</span>${icon('external-link', { cls: 'bl-ext' })}</a>
        </div></div>` : '';
  return `<div class="bl-top${w ? ' bl-topw' : ''}"><button type="button" class="btn text bl-back" data-bl-back="1">${icon('arrow-left')}<span>Back</span></button>
    <p class="bl-num">${esc(sp)}</p>${w ? '' : `<div class="bl-tools">${tools}</div>`}</div>`;
}
// ---------------- shared links that name an ask (R-124, R-169) ----------------
// The ask a share of this bill carries: the friend's ask, whatever this person has already done (Nate 10/5: the card
// leads with the ask and the link opens it). A hearing ahead is testimony, for everyone; a bill waiting for one is the
// chair's email; then the floor vote, the final version and the Governor; a bill that is over, or has no ask right now,
// is following its issue. tools/share_cards.mjs makes the same choice for the bill's own page (b/HB2121).
export function shareAsk(b, x = situation(b)) {
  if (x.law || x.ballot || x.stopped) return 'follow';
  if (x.act) return 'testify';
  if (x.waiting && x.pos && x.chairs.length) return 'ask';
  if (x.stepKey === 'governor') return 'governor';
  if (x.stepKey === 'conference') return 'conference';
  if (/^floor/.test(x.stepKey)) return 'floor';
  return 'follow';
}
// A link that names an ask opens it: testimony and the hearing's email open their walkthroughs, as the page's own buttons
// do; asking a chair for a hearing and the floor vote open the email walkthrough (the plans speakup.js gives those
// buttons), or "Find your legislators" first for someone whose legislators are not known yet. The final version's email
// and the Governor's form open in another app, which a page may only do on a tap, so there the main button is put in
// front of them. When the ask has closed by the time the link is opened, the page shows what can be done now and says
// so. The legislators and committees load a moment after the bill, so the chairs are waited for (up to 8 seconds).
const refReady = () => S.deadlines.length > 0 && (S.legislators || []).length > 0;
function openAsk(b, want, tries = 0) {
  if (!refReady() && tries < 20) return setTimeout(() => openAsk(b, want, tries + 1), 400);
  const here = new RegExp(`^#/bill/(\\d{4}/)?${String(b.bill_number).replace(/\s/g, '')}(/|$)`, 'i');
  if (S.helper || !here.test(location.hash)) return;   // they moved on while it waited, or a walkthrough is open
  const x = situation(b), h = x.act?.h || null;
  const front = sel => { const el = [...document.querySelectorAll(sel)].find(e => e.offsetParent !== null); if (el) { el.scrollIntoView({ block: 'nearest' }); el.focus({ preventScroll: true }); } return !!el; };
  if (want === 'testify' && h && !x.differs) return app.openHelper?.(b.id, h.id);
  if (want === 'email' && h) return app.openMail?.({ mode: 'email', bill: b.id, hearing: h.id });
  if (want === 'ask' && ['ask', 'hold', 'remind'].includes(x.kind)) return app.openMail?.({ mode: 'email', bill: b.id, code: x.code, ...(x.kind === 'remind' ? { remind: true } : {}) });
  if (want === 'floor' && x.kind === 'floor') {
    const m = legMoments(b, { all: true }).find(y => y.kind === 'floor');
    if (m) return app.openMail?.({ mode: 'legislators', bill: b.id, legs: m.legs.map(l => l.id), moment: { kind: 'floor', key: m.key, chamber: m.chamber } });
    return app.go(`#/legislators?from=${encodeURIComponent(billRef(b))}`);
  }
  if ((want === 'conference' || want === 'governor') && x.kind === want && front(`[data-bl-main="${want}"], a[href^="#/legislators?from="]`)) return;
  // Done already in this browser (the chair asked, the step's email sent): the page's next ask is in front of them.
  if (want !== 'testify' && shareAsk(b, x) === want) return;
  toast(want === 'testify' ? 'Testimony on this bill has closed. Here’s what you can do now.'
    : want === 'ask' ? 'This bill isn’t waiting for a hearing any more. Here’s what you can do now.'
    : 'That step has passed. Here’s what you can do now.');
}

// ---------------- a newcomer on a shared bill (R-023, decision 7): the easiest action first, following second ----------------
// Someone whose first visit starts on a bill someone sent them sees what the bill is, then this card: help right now (the
// page's own main button, "Send a quick email · 2 min" when there is a hearing), "Follow this issue" (no "instead", Nate
// 9/21), or "Not now". Whatever they choose, the rest of the first visit follows on THIS bill (start.js, wiz().via):
// follow it next time?, the lessons on this bill, who speaks for you, coming up, and the finale. On a phone the card sits
// under the bill's name with the main button in the bottom bar; on a laptop it tops the side panel, right above the
// main button (Nate 9/21: "Send a quick email" was hidden at the bottom of the page).
S.blNew ??= new Set();
const whenWord = iso => { const days = (new Date(iso) - Date.now()) / 864e5, d = dayWord(iso);
  return /^(today|tomorrow)/.test(d) ? d.replace(/\s*\(.*\)$/, '') : days < 7 ? `on ${new Date(iso).toLocaleDateString('en-US', { timeZone: HST, weekday: 'long' })}` : `on ${d}`; };
S.blLooking ??= new Set();   // bills where the newcomer said "Just looking" this visit
function newcomer(b, x) {
  if (!firstVisit()) return '';
  if (S.blLooking.has(b.id)) return `<p class="bl-tourline">${icon('sparkles')}<span>New to this? ${btn('Take the 2-minute tour', { kind: 'text', sm: true, attrs: { 'data-bl-tour': '1' } })}</span></p>`;
  if (!S.blNew.has(b.id)) logVisit('arrive', 'view', { path: 'link' });   // counted privately (R-023 decision 8)
  S.blNew.add(b.id);
  const h = x.act?.h, i = issuesOf(b)[0];
  // The deadline is the thing a newcomer from a link most needs to know (R-114): said here, and in the head's chip.
  const due = h && h.testimony_deadline && new Date(h.testimony_deadline) > Date.now() ? ` Testimony is due ${dueWords(h.testimony_deadline)}.` : '';
  // Every ask a shared link can open has its words here (R-169), so the card says what the main button does.
  const no = /oppose/.test(b.hiphi_position || ''), one = x.chairs.length > 1 ? 'the chairs' : 'the chair';
  const text = h ? `This bill has a hearing ${whenWord(h.scheduled_at)}.${due} You can tell the committee what you think, in a few minutes, or follow it and we’ll tell you what happens.`
    : x.kind === 'ask' ? `This bill is waiting for a hearing. You can ask ${one} for one, in about 2 minutes, or follow it and we’ll tell you when.`
    : x.kind === 'hold' ? `This bill is waiting for a hearing. You can ask ${one} not to hear it, in about 2 minutes, or follow it and we’ll tell you what happens.`
    : x.kind === 'floor' ? `This bill goes to a vote of the full ${CHAMBER_NAME[x.st.chamber] || 'House or Senate'} soon. You can ask your ${x.st.chamber === 'S' ? 'senator' : 'representative'} to vote ${no ? 'no' : 'yes'}, in about 2 minutes, or follow it and we’ll tell you how it goes.`
    : x.kind === 'conference' ? `The House and Senate are working out one final version. You can ${no ? 'ask lawmakers to let it go' : 'email lawmakers about it'}, in about 2 minutes, or follow it and we’ll tell you what happens.`
    : x.kind === 'governor' ? `This bill passed the Legislature and is on the Governor’s desk. You can ask the Governor to ${no ? 'veto' : 'sign'} it, in about 2 minutes, or follow it and we’ll tell you what happens.`
    : x.stopped && i ? 'This bill stopped. Follow its issue, and we’ll tell you when a new bill on it comes up.'
    : `Follow ${i ? 'its issue' : 'it'}, and we’ll tell you when there’s a hearing or a way to help.`;
  // A partner's link can open on a bill now (Make a link, R-067): their welcome line leads the card, as it does on the
  // first visit's first screen.
  // ?via=share is a friend's shared link, not a partner (R-114, B4): no welcome line is looked up for it.
  const via = visitVia();
  if (via && via !== 'share' && S.blWelcome === undefined) { S.blWelcome = null; partnerWelcome(via).then(w => { if (w) { S.blWelcome = w; app.render(); } }).catch(() => {}); }
  return `<section class="card bl-newbie" aria-labelledby="bl-nb-h">${S.blWelcome ? `<p class="st-partner">${icon('sparkles')}<span>${esc(S.blWelcome)}</span></p>` : ''}
    <p class="bl-nbtext" id="bl-nb-h">${icon('sparkles')}<span><b>New here?</b> ${esc(text)}</span></p>
    <p class="small muted">A free tool from the Hawaiʻi Public Health Institute, a nonprofit. Emails open in your own mail app; nothing is sent for you.</p>
    <div class="bl-nbbtns">${followIsMain(b, x) ? '' : btn(i ? 'Follow this issue' : 'Follow this bill', { kind: 'secondary', icon: 'star', attrs: { 'data-bl-newfollow': '1' } })}${asking(x) ? '' : notNow()}</div>
  </section>`;
}
// The tips about this page, offered in one quiet line to someone they no longer start for by themselves (X10-4, R-180;
// core.js billTourHeld): they came here to act, or the first visit already told them a bill's story. It goes once the
// tips are seen (tour.js), so a person who never wants them sees one line, not a tour over the button they came for.
function tourOffer() {
  if (firstVisit() || !billTourHeld() || billTourSeen()) return '';
  return `<p class="bl-tourline">${icon('sparkles')}<span>New to this? ${btn('Take the tour', { kind: 'text', sm: true, attrs: { 'data-bl-billtour': '1' } })}</span></p>`;
}
// "Just looking" (was "Not now") sits beside the main button (the phone bar; the side panel on a laptop). It used to
// start the whole first visit, 13 taps, for someone who only wanted to read the bill (R-067). Now it closes the card
// and stays on the bill; one quiet line offers the tour, which is what "Not now" used to start.
const notNow = () => btn('Just looking', { kind: 'text', attrs: { 'data-bl-newlater': '1' } });
// The page's main button is an ask (not following or sharing): "Just looking" sits beside it in the bar instead.
const asking = x => !!x.act || ['ask', 'hold', 'remind', 'floor', 'conference', 'governor'].includes(x.kind);
// On to the rest of the first visit, on this bill.
const viaStart = (b, extra = {}) => { wizSet({ via: b.bill_number, viaId: b.id, viaName: nick(b) || spaced(b.bill_number), step: 1, ...extra }); app.go('#/start/1'); };
// After a first action from a shared link, the visit ends on that success, at Home (X10-2, R-180; the confirmation-page
// pattern, C-6). It used to go on into the rest of the first visit: the story of the bill, whose last page promised
// "We'll show you how" of the thing they had just done, then six more taps before Home, which never said they had acted.
// Home now leads with what they did and when the committee hears it (home.js loopCard), with the story one quiet line
// there. The first visit is finished (as R-114's "Go to my home page", now "See How I Can Help" (R-190), after acting already was), and counted so. Home
// keeps its calm first-visit shape for the rest of this visit (hiphi_welcome, start.js welcome()): nothing else is
// pushed on someone who has just done their first thing (Nate's rule 1, 9/19): the things to do this week are shown open
// but calm, no button singled out (R-190: nothing on Home is folded any more).
const homeAfterAct = b => {
  wizSet({ via: b.bill_number, viaId: b.id, viaName: nick(b) || spaced(b.bill_number), viaActed: true, viaHome: true, done: true, step: 1 });
  try { sessionStorage.setItem('hiphi_welcome', '1'); } catch { /* private mode: Home's everyday shape */ }
  logVisit('act', 'done', { path: 'link' }); logVisit('done', 'done', { path: 'link' }); abEvent('finished');
  app.go('#/');
};
// A first visit that began on this bill: the first action gets its moment (C-7), is counted, then Home. Called by the
// bar's "Yes, I sent it" (it once gave only a toast, so the quick email from a link was never counted or celebrated,
// R-067). Since R-167 the page's email buttons open the walkthrough instead (speakup.js), which has its own Mahalo and
// calls newcomerNext, so this is reached only where no walkthrough opens (the Governor's form, for one).
// Resolves true when it took over.
// Acting also follows the bill's issue, quietly, with "Stop following <issue>" in the moment (it said "Don't follow it",
// which read as skipping something; X10-4): someone who emailed and followed nothing was forgotten the moment they left,
// and the next visit started them over (R-067). The issue is named because the issue is what is followed (R-018).
// The words celebrate the act and never say that few people do it (R-171): a "most people never do it" line tells
// people that not acting is normal, and research on such messages finds it makes them act less (R-164's research).
app.newcomerActed = async b => {
  // Asked after markDone, so firstVisit() is already false (an action counts as having been here): this is the first
  // action of a first visit that began on this bill's card.
  if (!b || !S.blNew.has(b.id) || followsAnything() || myActions().length > 1 || wiz().done || wiz().skipped) return false;
  const i = issuesOf(b)[0], follow = !!i && !issueFollowed(i) && await setFollows({ issuesOn: [i.id] }) !== false;
  moment({ title: 'Mahalo!', sub: `You spoke up on ${nick(b) || spaced(b.bill_number)}.`,
    small: follow ? `We’ll follow ${i.name === (nick(b) || '') ? 'this issue' : i.name} for you, so you can see what happens next.` : 'That’s how bills move: committees hear from the people who write.',
    go: GO_HELP, alt: follow ? { label: `Stop following ${i.name}`, act: () => setFollows({ issuesOff: [i.id] }) } : null },
    () => homeAfterAct(b));
  return true;
};
// After testimony or an email sent from the walkthrough (helper.js), its Done: a first visit that began on this bill ends
// at Home. The walkthrough had its own celebration, so no second moment.
app.newcomerNext = b => {
  if (!b || !S.blNew.has(b.id) || wiz().done || wiz().skipped) return false;
  homeAfterAct(b); return true;
};
// Without an everyday name the headline is what the bill does: HIPHI's plain summary; without one, the first sentence
// of the official description (the whole of it sits under More details, so nothing is lost to "..."). With neither,
// what the official title is about.
function plainHead(b) {
  if (b.hiphi_summary) return blurb(b, 200);
  const d = cleanDesc(b.description);
  if (d) { const m = /^(.{20,220}?[.!?])(\s|$)/.exec(d); return m ? m[1] : blurb(b, 170); }
  return `A bill about ${titleCase(b.title || 'a Hawaiʻi issue').replace(/^relating to\s+/i, '').replace(/[.\s]+$/, '')}`;
}
// The name leads when the bill has one ("Disposable e-cigarette ban"), with what it does right under it. The number stays in
// the top bar. The official "Relating to…" title never shows up here, so the lede is only ever a summary.
function head(b, x) {
  const p = posInfo(b), name = nick(b), mine = myStance(b.id);
  const lede = name && (b.hiphi_summary || cleanDesc(b.description)) ? blurb(b, 320) : '';
  const chips = [x.law ? chip(isResolution(b) ? 'Adopted' : 'Became law', 'ok', 'circle-check') : x.ballot ? chip('Goes to the voters', 'ok', 'circle-check') : x.stopped ? chip(isResolution(b) ? 'Not adopted this session' : 'Stopped this session', '', 'archive') : '',
    p ? posChip(b) : b.hiphi_position === 'monitor' ? chip('HIPHI is watching it', '', 'eye') : '',
    // The testimony deadline on the first phone screen (R-114): a newcomer from a link should not have to scroll to it.
    x.act?.h?.testimony_deadline && new Date(x.act.h.testimony_deadline) > Date.now() && !dueInfo(x.act.h)?.late ? chip(`Testimony due ${dueWords(x.act.h.testimony_deadline)}`, 'info', 'calendar-clock') : '',
    // A bill that can no longer move does not ask where you stand; it remembers what you said.
    !x.live && (mine === 'support' || mine === 'oppose') ? chip(mine === 'support' ? 'You supported it' : 'You opposed it', '', 'user-check') : ''].filter(Boolean).join('');
  return `<div class="bl-head"><h1 class="${name ? 'hero bl-nick' : 'bl-what'}">${esc(name || plainHead(b))}</h1>
    ${lede ? `<p class="lede bl-lede">${esc(lede)}</p>` : ''}${chips ? `<div class="chips">${chips}</div>` : ''}${issueLine(b, x)}${onListsLine(b)}
    ${aboutFold(b, name ? lede : plainHead(b))}</div>`;
}
// One sentence is not enough to decide on (R-178, Nate 10/5): right under it, "Read more about the bill" opens the
// Legislature's own summary, HIPHI's reasons and the whole bill on the Capitol website (pub/billtext.js). Folded, so the
// page reads as before for anyone who doesn't want it; it stays open through redraws like the page's other folds.
const aboutFold = (b, shown) => `<details class="bl-about" ${fold(b, 'about')} data-ab-more="${esc(b.id)}"><summary>${icon('book-open')}<span>Read more about the bill</span>${icon('chevron-down', { cls: 'bl-chev' })}</summary>
    ${aboutBill(b, { shown, pfx: 'bl-ab' })}</details>`;
// The issue a bill belongs to (R-018: people follow issues, and a bill is one way an issue moves). Its name is the way
// to its page; beside it, whether the person follows it, or one tap to start. Bills HIPHI only watches have no issue.
function issueLine(b, x) {
  const iss = issuesOf(b); if (!iss.length) return '';
  // A stopped bill's main button is already "Follow the issue": the line keeps the issue's name and drops its own button.
  if (x && followIsMain(b, x)) return `<p class="bl-issue">${icon(catOf(iss[0].category)?.icon || 'heart-pulse')}<span>Part of <a href="#/issue/${esc(iss[0].slug)}">${esc(iss[0].name)}</a></span></p>`;
  const i = iss[0], on = issueFollowed(i), cat = catOf(i.category);
  // One follow button per bill page, and it is the issue's (R-067; R-061: "Following" must look followed, not like the
  // Follow button with another word). Pressing Following stops following the issue, with Undo.
  return `<p class="bl-issue">${icon(cat?.icon || 'heart-pulse')}<span>Part of <a href="#/issue/${esc(i.slug)}">${esc(i.name)}</a></span>
    ${firstVisit() ? '' : on ? btn('Following the issue', { kind: 'secondary', sm: true, icon: 'check', cls: 'on', attrs: { 'data-bl-unfollowissue': i.id, 'aria-pressed': 'true', title: 'Following. Press to stop following.' } })
      : btn('Follow the issue', { kind: 'secondary', sm: true, icon: 'star', attrs: { 'data-bl-followissue': i.id, 'aria-pressed': 'false' } })}</p>`;   // a newcomer has it on their own card (A-14)
}
// Where do you stand? Three toggles, private to the person (it rides on their follow once they sign in; others only
// ever see totals, from 10 people). Choosing the selected one again clears it. Only for a bill that can still move.
// The line under them says who sees the answer (X4-5, R-180): once signed in, HIPHI staff do, as Help and the privacy page
// say; before that it stays on this device. Never only "private", which was untrue for anyone with a profile.
const stanceWho = () => signedIn() ? 'Only you and HIPHI staff see your answer. Others see totals.' : 'Your answer stays on this device. Others see only totals.';
const STANCES = [['support', 'Support'], ['oppose', 'Oppose'], ['unsure', 'Not sure yet']];
function stanceInner(b, x) {
  const mine = myStance(b.id);
  // Someone who sees it differently from HIPHI is never handed HIPHI's letter; where no action card says so, say it here.
  const own = x.differs && !x.act && !wide() ? `<p class="note">${icon('info')}<span>You see this one differently from HIPHI. You can still tell lawmakers what you think, in your own words.</span></p>` : '';
  return `<h2 id="bl-stance-h">Where do you stand?</h2>
    <div class="chips" role="group" aria-labelledby="bl-stance-h">${STANCES.map(([v, label]) => `<button type="button" class="chip" data-bl-stance="${v}" aria-pressed="${mine === v}">${mine === v ? icon('check') : ''}${label}</button>`).join('')}</div>
    <p class="bl-stnote">${mine ? 'Saved. ' : ''}${stanceWho()}</p>${own}`;
}
// Follow, share, copy link and "Add to a list" (R-013) on a wide screen (a phone has them in the top bar).
function sideTools(b) {
  const on = S.watch.has(b.id), own = !issuesOf(b).length;   // a bill with an issue is followed by its issue (above)
  return `<div class="bl-stools" role="group" aria-label="${own ? 'Follow and share' : 'Share'}">
    ${own ? btn(on ? 'Following' : 'Follow', { kind: 'secondary', sm: true, icon: on ? 'check' : 'star', cls: on ? 'on' : '', attrs: { 'data-bl-star': '1', 'aria-pressed': on ? 'true' : 'false', title: on ? 'Following. Press to stop following.' : null } }) : ''}
    ${btn('Share', { kind: 'text', sm: true, icon: 'share-2', attrs: { 'data-bl-share': '1' } })}${btn('Copy link', { kind: 'text', sm: true, icon: 'link', attrs: { 'data-bl-copy': '1' } })}
    ${btn('Add to a list', { kind: 'text', sm: true, icon: 'list-plus', attrs: { 'data-bl-addto': '1' } })}</div>`;
}
// Community numbers live here, inside one bill, and nowhere wider (Nate, 9/19): how its followers lean, and what has
// been done about it through HIPHI. Every number is shown only from 10 people; with none, the block is not drawn.
function othersBlock(b) {
  const s = (S.billStances || {})[b.id], split = s && countOk(s.people) && (s.support || s.oppose) ? s : null;
  const ac = S.actionCounts[b.id] || {}, fol = countOk(b.watchers), t = countOk(ac.testimonies), e = countOk(ac.emails), a = countOk(ac.attending);
  if (!split && !fol && !t && !e && !a) return '';
  const say = (k, w) => `${k} ${k === 1 ? w + 's' : w} it`;
  let stand = '';
  if (split) {
    const [big, bw, small, sw] = split.support >= split.oppose ? [split.support, 'support', split.oppose, 'oppose'] : [split.oppose, 'oppose', split.support, 'support'];
    stand = `<p class="bl-osay">Of ${split.people} followers who took a stand, ${small ? `${say(big, bw)} and ${say(small, sw)}` : `all ${big} ${bw} it`}.</p>
      <div class="bl-split" aria-hidden="true"><i class="bl-sup" style="flex-grow:${+split.support || 0}"></i><i class="bl-opp" style="flex-grow:${+split.oppose || 0}"></i></div>
      <p class="bl-keys" aria-hidden="true"><span class="bl-key bl-sup">Support</span><span class="bl-key bl-opp">Oppose</span></p>`;
  }
  const sent = [t ? `${t} testimonies` : '', e ? `${e} emails to chairs` : ''].filter(Boolean).join(' and ');
  const lines = [fol ? `${fol} people follow this bill.` : '', sent ? `People have sent ${sent} through HIPHI.` : '', a ? `${a} said they would go to a hearing.` : ''].filter(Boolean);
  return `<section class="card flat bl-others" aria-labelledby="bl-oth-h"><h2 id="bl-oth-h">${icon('users')}<span>Others following this bill</span></h2>
    ${stand}${lines.length ? `<p class="bl-ocount">${lines.map(esc).join(' ')}</p>` : ''}</section>`;
}
// X4-4: under the stopped label, "The same idea became law as SB 2175, Act 189", linked to that bill. The companion may not be
// loaded yet (a shared link to the stopped bill), so ask for it once and draw again; a failed ask just leaves the line out.
S.sameTried ??= new Set();
function sameLine(b) {
  if (isResolution(b)) return '';
  const L = sameIdeaLaw(b);
  if (!L) {
    const key = `${b.id}`;
    if (!S.sameTried.has(key)) { S.sameTried.add(key);
      // not loaded yet: the companions by number, and the other chamber's bills on its issues by id
      const ids = issuesOf(b).flatMap(i => (i.bill_ids || []).filter((id, k) => +(i.bill_years || [])[k] === +b.session_year && id !== b.id));
      const byId = ids.length && !DEMO ? S.supa.from('public_all_bills').select('*').in('id', [...new Set(ids)].slice(0, 40)).eq('stage', 'enacted').then(r => { (r.data || []).forEach(c => { if (!S.bills.some(x => x.id === c.id)) S.extra[c.id] = c; }); }) : Promise.resolve();
      Promise.all([byId, ...companionsOf(b).slice(0, 3).map(n => ensureBill(n, b.session_year).catch(() => null))]).then(() => { if (sameIdeaLaw(b)) app.render(); }).catch(() => {});
    }
    return '';
  }
  return `<p class="bl-sameidea">${icon('circle-check')}<span>${esc(sameIdeaWords(L))} <a href="#/bill/${esc(yearPrefix(b) + L.num)}">See ${esc(spaced(L.num))}</a></span></p>`;
}
function statusCard(b, x) {
  const extra = x.law ? 'Mahalo to everyone who spoke up.' : '';
  // A stopped bill has no sentence here: why it stopped is said once, under the step bar (Nate 9/29, R-085: "It should
  // not be at the top, only directly under that label ... Just remove the wording at the top").
  return `<section class="card bl-status" aria-labelledby="bl-st-h"><h2 class="sr" id="bl-st-h">Where it is now</h2>
    ${x.stopped ? '' : `<p class="bl-say">${x.law ? flower(22) : ''}<span>${esc(plainStatus(b).text)}${extra ? ` ${esc(extra)}` : ''}</span></p>`}
    ${b.hiphi_action && !x.act && x.live && !x.differs ? `<p class="bl-ask">${icon('megaphone')}<span><b>HIPHI asks:</b> ${esc(b.hiphi_action)}</span></p>` : ''}
    ${!wide() && stepCard(b, x) ? `<p class="bl-next"><b>${esc(stepCard(b, x)[0])}.</b> ${esc(stepCard(b, x)[1])}</p>` : ''}
    ${railHTML(b, x)}${stoppedNext(b, x)}
  </section>`;
}
// A hearing ahead: the action card (the hearing, the deadline, every way to help) under a heading that says what to
// do. The section holds its action: on a wide screen the main button sits in the card, above "More ways to help"; on
// a phone it is in the bottom bar and the card carries the next step. For someone new to acting that next step is
// testimony, shown as the bigger step right under the quick email rather than folded away.
function actionSection(b, x) {
  if (!x.act) return '';
  const h = x.act.h, done = actedOn(b, h);
  const title = done ? 'Mahalo for speaking up' : x.act.late ? 'You can still be heard' : 'Speak up before the hearing';
  const ask = S.nudge && done ? nudgeCard('action') : '';
  // (A "Write testimony" row used to sit under the quick email here; testimony leads now, R-068.)
  const big = '';
  const main = wide() ? mainButton(b, x) + (S.blNew.has(b.id) && firstVisit() && !S.blLooking.has(b.id) ? `<div class="bl-notnow">${notNow()}</div>` : '') : '';
  return `<section class="bl-sec bl-act${big ? ' bl-hasbig' : ''}" aria-labelledby="bl-act-h"><div class="sechead"><h2 id="bl-act-h">${title}</h2></div>
    ${actionCard(b, h, { heading: 'h3', compact: true })}${main || big ? `<div class="bl-slot">${main}${big}</div>` : ''}
    ${done ? '' : `<p class="bl-learn"><a href="#/learn/hearing/${esc(b.id)}">${icon('circle-help')}<span>New to hearings? What happens at one, about a minute</span></a></p>`}${ask ? `<div class="bl-nudge">${ask}</div>` : ''}</section>`;
}
// The floor, conference and the Governor: what the step is and why, in one line (the side card on a wide screen, the
// status card on a phone, where the button sits in the bottom bar).
function stepCard(b, x) {
  const opp = /oppose/.test(b.hiphi_position || ''), ch = N[x.st.chamber] || '', rep = x.st.chamber === 'S' ? 'senator' : 'representative';
  if (x.kind === 'floor') return x.to.length
    ? [`Ask for a ${opp ? 'no' : 'yes'} vote`, `The full ${ch} votes on it next. Lawmakers listen closest to the people they represent, so a short email from you counts.`]
    : [`Ask for a ${opp ? 'no' : 'yes'} vote`, `The full ${ch} votes on it next. Find your own ${rep}, then send a short email: lawmakers listen closest to the people they represent.`];
  // An opposed bill asks them to let it go, as its email does (B3-3, R-199); the same words for both sides said nothing.
  if (x.kind === 'conference') return x.conf
    ? ['Write to the conference chairs', `The House and Senate passed different versions. A few members of each are working out one version, led by these chairs. ${opp ? 'HIPHI opposes it. A short, polite email asking them to let it go helps.' : 'A short, polite email helps.'}`]
    : ['Ask your legislators to speak up', `The House and Senate passed different versions and are working out one. Your own legislators can ${opp ? 'ask them to let it go' : 'speak up for it'}.`];
  if (x.kind === 'governor') return vetoNotice(b) && !opp
    ? ['The Governor may veto it', 'The Governor has given notice of a possible veto. Tell the Governor’s office why it should become law, on its Comments on Legislation page.']
    : ['On the Governor’s desk', `It passed the House and Senate. The Governor decides whether it becomes law. Tell the Governor’s office ${x.differs ? 'what you think' : opp ? 'why it should be vetoed' : 'why it should be signed'}, on its Comments on Legislation page.`];
  return null;
}
// Wide screens, no hearing ahead: the side panel still leads with the one thing worth doing, and says why.
function doCard(b, x) {
  const main = mainButton(b, x); if (!main) return '';
  const off = sessionInfo().phase !== 'in', many = x.chairs.length > 1;
  const [title, text] = stepCard(b, x) || {
    ask: ['Ask for a hearing', `The committee ${many ? 'chairs decide' : 'chair decides'} if this bill gets a hearing. A short, polite email helps.`],
    hold: ['Ask the chair to hold it', 'HIPHI opposes this bill. A short, polite note asking the chair not to hear it helps.'],
    remind: [`Follow up with the ${x.chairs.length > 1 ? 'chairs' : 'chair'}`, `You asked before, and it still has no hearing. Its deadline is ${x.st.deadline ? dateLong(x.st.deadline.date + 'T12:00:00-10:00') : 'near'}: a short follow-up can help.`],
    capitol: ['Have your say', 'You see this one differently from HIPHI. You can still tell lawmakers what you think, in your own words.'],
    law: ['It became law', x.differs ? 'This bill is now a Hawaiʻi law.' : 'Mahalo to everyone who spoke up. Pass on the good news.'],
    stopped: ['What you can do now', off ? (followIsMain(b, x) ? 'Follow the issue, and its new bills come to you when the Legislature meets.' : 'The Legislature is between sessions. A good next step is to get ready for the next one.') : 'This bill stopped, but others are still moving and need voices.'],
  }[x.kind] || ['Spread the word', 'More voices carry more weight. Send this bill to someone who cares about it.'];
  return `<section class="card bl-do" aria-labelledby="bl-do-h"><h2 id="bl-do-h">${title}</h2><p class="small">${esc(text)}</p>${main}</section>`;
}
function whoDecides(b, x) {
  if (!x.code || !x.chairs.length) return '';
  const d = myDistricts(), plural = x.chairs.length > 1, chairIds = new Set(x.chairs.map(c => c.leg?.id).filter(Boolean));
  const others = legsOf(x.code).filter(m => m.role !== 'chair' && !chairIds.has(m.l.id)), joint = x.chairs.length > 1;
  const c1 = plural ? 'chairs' : 'chair', from = `?from=${encodeURIComponent(billRef(b))}`;
  const hold = (x.kind === 'hold' || (x.waiting && x.pos && /oppose/.test(x.pos.verb))) && !x.differs;
  const intro = x.act ? (didKind(b, x.act.h, 'testimony') ? `Mahalo for your testimony. A short email to the ${c1} adds even more weight.`
      : x.act.late ? 'The deadline for written testimony has passed. You can still send it; it will be marked late.'   // late testimony stays testimony (R-167)
      : x.kind === 'email' ? `The hearing is set. A short email to the ${c1} is a quick way to be heard. Testimony carries the most weight.`
      : 'The hearing is set. The best thing you can do now is send testimony.')
    : x.st.hearingState === 'held' ? `The committee heard it. The ${c1} will share what happens next.`
    : x.st.hearingState === 'scheduled' ? (dueInfo(x.st.hearing)?.late ? 'The hearing is set. The deadline for written testimony has passed. Anyone can still send it on the Capitol website; it will be marked late.'
      : 'The hearing is set. Anyone can send testimony on the Capitol website.')   // anyone, not only people in Hawaiʻi (B3-3)
    : hold ? `The committee ${plural ? 'chairs decide' : 'chair decides'} if this bill gets a hearing. HIPHI opposes it, so a short, polite note asking ${plural ? 'them' : 'the chair'} to hold it helps.`
    : `The committee ${plural ? 'chairs decide' : 'chair decides'} if this bill gets a hearing. A short, polite email helps, most of all from someone in their district.`;
  const hid = x.act?.h.id || x.st.hearing?.id || '';
  // With a hearing ahead, Email opens the card's composer (HIPHI's draft, theirs to change). Someone who sees the bill
  // differently gets a plain draft instead. data-bl-chair comes first: it is the hook focus returns to after a redraw.
  const emailBtn = c => x.act && !x.differs ? btn('Email', { kind: 'secondary', sm: true, icon: 'mail', attrs: { 'data-bl-chair': c.code, 'data-bl-compose': x.k, 'aria-label': `Email ${c.title} ${c.last}` } })
    : btn('Email', { kind: 'secondary', sm: true, icon: 'mail', href: mailFor(b, x, [c], mailMode(x)), attrs: { 'data-bl-chair': c.code, 'data-bl-mail': hid || '-', 'aria-label': `Email ${c.title} ${c.last}` } });
  const chairs = x.chairs.map(c => { const l = c.leg || { name: c.name }, mine = mineLabel(c.leg, d), name = `${c.title} ${c.leg?.name || c.name}`;
    const who = `${legPhoto(l, 'bl-photo')}<span class="bl-whot"><span class="bl-name">${esc(name)}</span><span class="bl-role">Chair, ${esc(cmteLabel(c.code))}</span>${mine ? `<span class="bl-mine">${chip(mine, 'info', 'user-check')}</span>` : ''}</span>`;
    return `<li class="bl-chair">${c.leg ? `<a class="bl-who" href="#/legislator/${c.leg.id}${from}">${who}${icon('chevron-right', { cls: 'bl-chevr' })}</a>` : `<div class="bl-who">${who}</div>`}
      <div class="btnrow">${emailBtn(c)}${c.phone ? btn('Call', { kind: 'secondary', sm: true, icon: 'phone', href: `tel:${tel(c.phone)}`, attrs: { 'aria-label': `Call ${c.title} ${c.last}` } }) : ''}</div></li>`; }).join('');
  const role = m => `${m.role === 'vice_chair' ? 'Vice chair' : 'Member'}${joint ? `, ${S.committees[m.committee]?.name || ''}` : ''}`;
  const mineOther = others.map(m => mineLabel(m.l, d)).find(Boolean);
  const members = others.length ? `<details class="bl-members" ${fold(b, 'members')}><summary><span>Show all members (${others.length})${mineOther ? ` <span class="bl-inc">· includes ${mineOther.toLowerCase()}</span>` : ''}</span>${icon('chevron-down', { cls: 'bl-chev' })}</summary>
      <ul class="bl-memlist">${others.map(m => { const mine = mineLabel(m.l, d);
        return `<li><a class="bl-mem" href="#/legislator/${m.l.id}${from}">${legPhoto(m.l, 'bl-photo sm')}<span class="bl-whot"><span class="bl-name">${esc(legTitle(m.l))} ${esc(m.l.name)}</span><span class="bl-role">${esc(role(m))}</span>${mine ? `<span class="bl-mine">${chip(mine, 'info', 'user-check')}</span>` : ''}</span>${icon('chevron-right', { cls: 'bl-chevr' })}</a></li>`; }).join('')}</ul></details>` : '';
  const findMe = !d ? `<p class="bl-findme">${btn('Find your own senator and representative', { kind: 'text', sm: true, icon: 'map-pin', href: `#/legislators${from}` })}</p>` : '';
  return `<section class="bl-sec" aria-labelledby="bl-who-h"><div class="sechead"><h2 id="bl-who-h">Who decides next</h2></div>
    <div class="card bl-whocard"><p class="bl-intro">${esc(intro)}</p><ul class="bl-chairs${plural ? ' bl-two' : ''}">${chairs}</ul>${members}</div>${findMe}</section>`;
}
function hearingRow(b, h, now) {
  const t = new Date(h.scheduled_at).getTime(), past = t <= now, off = h.status === 'cancelled', o = past && !off ? outcomeOf(h) : null;
  const k = `${b.id}|${h.id}`, v = off ? null : streamOf(h), due = !past && !off ? dueInfo(h) : null;
  // No report yet: the committee is still deciding, unless the bill has had news since (then it simply was heard).
  const pending = past && now - t < 12 * 864e5 && !(b.last_action_date && b.last_action_date > hstDay(h.scheduled_at));
  const tag = off ? chip('Cancelled', '', 'circle-x')
    : o?.outcome && deferredTo(h, o) ? chip(`Deferred to ${fmtDate(deferredTo(h, o), { month: 'short', day: 'numeric' })}`, '', 'calendar-clock')
    : o?.outcome ? chip(OUTCOME_PLAIN[o.outcome] || 'Decided', /passed/.test(o.outcome) ? 'ok' : '', /passed/.test(o.outcome) ? 'circle-check' : o.outcome === 'deferred' ? 'hourglass' : 'undo-2')
    : past ? chip(pending ? 'Waiting for the decision' : 'Heard', '', pending ? 'hourglass' : 'check') : '';
  // What this person did for this hearing stays with it after the hearing (R-067: the page forgot it the day after).
  const DID = { email: 'You emailed the chair', legislators: 'You wrote to your legislators', testimony: 'You testified', attend: 'You went', share: 'You shared it' };
  const mine = Object.keys(DID).filter(kd => didKind(b, h, kd)).map(kd => chip(DID[kd], 'yay', 'user-check')).join('');
  const acts = [
    !past && !off && posInfo(b) && alive(b) && agrees(b) !== false && due && !due.late ? btn('Write testimony', { kind: 'text', sm: true, icon: 'notebook-pen', attrs: { 'data-helper': h.id, 'data-bill': b.id } }) : '',
    !past && !off ? (S.chips?.[k + 'ics'] ? chip('Calendar file ready', 'ok', 'check') : btn('Add to calendar', { kind: 'text', sm: true, icon: 'calendar-plus', attrs: { 'data-ics': k } })) : '',
    v ? btn(v.state === 'live' ? 'Watch live' : past ? (!v.exact ? 'Find the recording on YouTube' : /[?&]t=\d/.test(v.url) ? 'Watch this bill’s part' : 'Watch the recording') : v.label, { kind: 'text', sm: true, icon: 'play', href: v.url, attrs: { target: '_blank', rel: 'noopener' } }) : '',
  ].filter(Boolean).join('');
  return `<li class="bl-hr${past ? ' bl-past' : ''}"><span class="bl-hico">${icon(past ? 'calendar-days' : 'calendar')}</span><div class="bl-hbody">
    <p class="bl-htitle">${esc(cmteLabel(h.committee))}</p>
    <p class="bl-hwhen">${esc(dateLong(h.scheduled_at))} at ${esc(timeWord(h.scheduled_at))} · ${esc(roomLabel(h.room))}</p>
    ${due ? `<p class="bl-hdue ${due.tone}">${icon('clock')}<span>${due.html}</span></p>` : ''}
    ${tag || mine ? `<div class="chips">${tag}${mine}</div>` : ''}${acts ? `<div class="btnrow bl-hacts">${acts}</div>` : ''}</div></li>`;
}
function hearingsSection(b, x) {
  const now = Date.now(), hs = x.hs.filter(h => !x.act || h.id !== x.act.h.id);
  // A bill that has stopped, become law or gone to the Governor has no hearing ahead, whatever a stray row says.
  const up = x.live ? hs.filter(h => new Date(h.scheduled_at) > now) : [], past = hs.filter(h => new Date(h.scheduled_at) <= now).reverse();
  if (!up.length && !past.length) return '';
  return `<section class="bl-sec" aria-labelledby="bl-h-h"><div class="sechead"><h2 id="bl-h-h">${!up.length && x.act ? 'Earlier hearings' : 'Hearings'}</h2></div>
    <ul class="bl-hlist">${[...up, ...past].map(h => hearingRow(b, h, now)).join('')}</ul></section>`;
}

// ---------------- More details: the official record, folded ----------------
// The committee path with check marks (passed stops struck through read as "cancelled" to newcomers, walk 9/18).
function sponsorText(b) {
  const o = originOf(b);
  const names = (b.sponsors || []).map(s => typeof s === 'string' ? s : s?.n || s?.name || '').filter(Boolean).map(n => {
    const l = (S.legislators || []).find(l => l.chamber === o && (l.sort_name || '').split(',')[0].trim().toUpperCase() === n.trim().toUpperCase());
    return l ? `${legTitle(l)} ${l.name}` : titleCase(n); });
  if (names.length > 6) return `${names.slice(0, 6).join(', ')} and ${names.length - 6} more`;
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] || '';
}
function details(b, x) {
  const comp = companionsOf(b);
  const spons = sponsorText(b);
  const rows = [
    b.title ? ['Official title', esc(titleCase(b.title))] : null,
    // The official summary in full is under "Read more about the bill", by the bill's name (R-178).
    // The committees, in order, are the pathway's own steps since R-081 (See all steps), so they are not repeated here.
    spons ? ['Introduced by', esc(spons)] : null,
    b.last_action ? ['Last official action', `${esc(b.last_action)}${b.last_action_date ? `<span class="bl-date">${esc(fmtDate(b.last_action_date, { month: 'short', day: 'numeric', year: 'numeric' }))}</span>` : ''}`] : null,
    comp.length ? [`Companion bill${comp.length > 1 ? 's' : ''}`, `${comp.map(c => `<a href="#/bill/${esc(yearPrefix(b) + c)}">${esc(spaced(c))}</a>`).join(', ')}<span class="bl-date">The same idea, filed in the ${N[/^S/.test(comp[0]) ? 'S' : 'H']} too. Either one can become law.</span>`] : null,
    // The draft ("House draft 3") is named once, under "Read more about the bill" (R-178, A-14).
  ].filter(Boolean);
  return `<details class="bl-more" ${fold(b, 'more')}><summary><span>More details</span>${icon('chevron-down', { cls: 'bl-chev' })}</summary>
    <dl>${rows.map(([k, v]) => `<div class="bl-kv"><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl></details>`;
}
// A hearing whose decision was reported only after the same committee's later sitting was deferred to that sitting (076
// gives the earlier row the later decision, so both read "Passed"): the earlier one says "Deferred to Apr 7" (R-120).
function deferredTo(h, o) {
  if (!o?.reported_at) return null;
  const b = lookup(h.bill_number || '', 0) || Object.values(S.extra || {}).find(x => x.id === h.bill_id) || S.bills.find(x => x.id === h.bill_id); if (!b) return null;
  const later = hearingsOf(b).find(x => x.id !== h.id && x.committee === h.committee && x.scheduled_at > h.scheduled_at && x.status !== 'cancelled' && o.reported_at >= x.scheduled_at);
  return later ? later.scheduled_at : null;
}
function page(num, b) {
  // Every hearing of the bill, with its recording (R-033): the lists load only 30 days, so the rest comes once, here.
  if (!S.hist?.[b.id]) ensureHistory(b).then(more => { if (more && normNum(numFromHash()) === normNum(b.bill_number)) app.render(); });
  const x = situation(b);
  const note = b.sandbox_untracked ? `<div class="notice info bl-note">${icon('info')}<div>This bill is not on HIPHI’s list, so the sandbox has only its number and title. The live tracker shows every bill in full.</div></div>` : '';
  if (!wide()) return `<div class="bl-page">${topbar(num, b)}${head(b, x)}${newcomer(b, x)}${tourOffer()}
    ${x.live ? `<section class="card bl-stance" aria-labelledby="bl-stance-h">${stanceInner(b, x)}</section>` : ''}${note}
    ${statusCard(b, x)}${actionSection(b, x)}${othersBlock(b)}${draftsSection(b)}${whoDecides(b, x)}${hearingsSection(b, x)}${details(b, x)}</div>`;
  // Reading and keyboard order (R-067: the main action was the 11th Tab stop on a laptop): the bill's name and what it
  // does, then the side panel with the action, then the rest. The grid puts the side panel on the right for the whole
  // height (bill.css .bl-cols), so the page looks as before.
  return `<div class="bl-page bl-wide">${topbar(num, b)}<div class="cols bl-cols">
    <div class="bl-main">${head(b, x)}${tourOffer()}</div>
    <aside class="side bl-side" aria-label="Take part">
      <p class="bl-sidenum">${esc(spaced(b.bill_number))}</p>
      ${newcomer(b, x)}${actionSection(b, x) || doCard(b, x)}
      <section class="card bl-you" ${x.live ? 'aria-labelledby="bl-stance-h"' : 'aria-label="Follow and share"'}>${x.live ? stanceInner(b, x) : ''}${sideTools(b)}</section>
    </aside>
    <div class="bl-main bl-main2">${note}${statusCard(b, x)}${othersBlock(b)}${draftsSection(b)}${whoDecides(b, x)}${hearingsSection(b, x)}${details(b, x)}</div></div></div>`;
}
const loading = () => `<div class="bl-skel">${skeleton(4)}</div>`;
const shell = (num, inner) => `<div class="bl-page${wide() ? ' bl-wide' : ''}">${topbar(num, null)}${inner}</div>`;
const missing = (num, year) => `<div class="empty bl-empty">${icon('search', { size: 40 })}<h1>We couldn’t find ${esc(spaced(num) || 'that bill')}${year ? ` from the ${year} session` : ''}</h1><p>Check the number, or search for the bill by a word like e-cigarettes.</p>${btn('Search bills', { kind: 'primary', icon: 'search', href: `#/find?q=${encodeURIComponent(num)}` })}</div>`;
const failed = () => `<div class="empty bl-empty" role="alert">${icon('circle-alert', { size: 40 })}<h1>We couldn’t load this bill</h1><p>Check your connection and try again.</p>${btn('Try again', { kind: 'primary', icon: 'rotate-ccw', attrs: { 'data-bl-retry': '1' } })}</div>`;

// ---------------- actions ----------------
// Scroll something into view under the bars that stay on screen. Nothing moves when it is already in view (on a wide
// screen the composer opens in the side panel, which is).
function scrollToEl(el) {
  if (!el) return;
  const hdr = document.querySelector('.hdr'), top = document.querySelector('.bl-top');
  const stuck = n => n && getComputedStyle(n).position === 'sticky' ? n.offsetHeight : 0;
  const off = stuck(hdr) + stuck(top) + 12, r = el.getBoundingClientRect();
  if (r.top >= off && r.bottom <= window.innerHeight - 96) return;
  window.scrollTo({ top: r.top + window.scrollY - off, behavior: reduceMotion() ? 'auto' : 'smooth' });
}
function openComposer(k) {
  S.compose = k; app.render();
  setTimeout(() => scrollToEl(document.getElementById('cmp-' + k.split('|')[1])), 30);
}
// Follow or unfollow from this page. Unfollowing drops the bill from the followed set; keep it (and its hearings and
// committee reports) here so nothing jumps. Following brings its hearings with the followed set, so the copy loaded
// by link goes. quiet: no toast (the caller gives its own feedback).
async function flipFollow(b, { quiet = false } = {}) {
  const hs = hearingsOf(b), was = S.watch.has(b.id), keep = hs.map(h => S.outcomes[h.id]).filter(Boolean);
  if (was) { S.extra[b.id] = b; if (!S.xh[b.id]) S.xh[b.id] = hs; }
  if (quiet) await toggleWatch(b.id); else await followToggle(b.id, spaced(b.bill_number));
  if (was) keep.forEach(o => { if (!S.outcomes[o.hearing_id]) S.outcomes[o.hearing_id] = o; });
  else if (S.bills.some(y => y.id === b.id)) delete S.xh[b.id];
}
// Share counts as an action once the share sheet finishes, or the text is copied (Nate, 9/18: every action counts).
// One share everywhere (R-113): the words, the deadline and the bill's own share page come from shareFor (actions.js).
async function shareBill(b, x) {
  const h = x.act?.h || null;
  const how = await doShare(shareFor(b, h, { law: !!x.law, differs: !!x.differs, ask: shareAsk(b, x), chamber: x.st?.chamber }));
  if (!how) { if (!navigator.share) toast('Sharing is not available here. Use Copy link instead.'); return; }
  const copied = how === 'copied';
  if (!didKind(b, h, 'share')) await markDone(b.id, h?.id || '', 'share', true, { quiet: copied });
  if (copied) yay('Copied. Paste it into a text or email. Mahalo for spreading the word.');
  app.render();
}
async function copyLink(b) {
  try { await navigator.clipboard.writeText(shareUrl(b, shareAsk(b))); yay('Link copied'); }
  catch { toast('We could not copy the link. Try Share instead.'); }
}
// The overflow menu is a small popover. It opens and closes without a re-render so focus stays put; Escape and a
// click outside close it. These listeners are added once for the life of the page.
function setMenu(open, focusToggle) {
  const menu = document.getElementById('bl-menu'), tog = document.querySelector('[data-bl-menu]'); if (!menu || !tog) return;
  menu.hidden = !open; tog.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) menu.querySelector('button, a')?.focus(); else if (focusToggle) tog.focus();
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('bl-menu')?.hidden === false) { e.preventDefault(); setMenu(false, true); } });
document.addEventListener('click', e => { const m = document.getElementById('bl-menu'); if (m && !m.hidden && !e.target.closest('.bl-menuwrap')) setMenu(false); });
// The side panel stays in view while the page scrolls. When it is taller than the window (the composer open, a small
// laptop) it holds by its bottom edge instead of its top, so every part of it can still be reached by scrolling.
function fitSide() {
  const el = document.querySelector('.bl-page .bl-side'); if (!el) return;
  const top = (document.querySelector('.hdr')?.offsetHeight || 64) + 24;
  el.style.top = Math.min(top, window.innerHeight - el.offsetHeight - 16) + 'px';
}
const sideWatch = window.ResizeObserver ? new ResizeObserver(fitSide) : null;
window.addEventListener('resize', fitSide);
let stanceBusy = false;

// ---------------- the screen ----------------
export default {
  // No tab bar here (the page has its own bars); on wide screens the header nav marks where bills live.
  get tab() { const r = refFromHash(), b = lookup(r.num, r.year); return b && S.watch.has(b.id) ? 'bills' : 'find'; },
  tabs: false,
  title: route => { const num = normNum(route.num), b = lookup(num, +route.year || 0), sp = spaced(num) || 'Bill'; return b && nick(b) ? `${nick(b)} · ${sp}` : sp; },
  render(route) {
    const num = normNum(route.num), year = +route.year || 0, key = keyOf(num, year);
    if (!/^[A-Z]{1,4}\d{1,5}$/.test(num)) return shell(num, missing(num, year));
    const b = lookup(num, year);
    if (!drawn(num, year)) {
      if (S.blLoading.has(key)) return shell(num, loading());
      if (S.blErr.has(key)) return shell(num, failed());
      if (!b && S.blMissing.has(key)) return shell(num, missing(num, year));
      load(num, year); return shell(num, loading());
    }
    keepOutcomes(b, hearingsOf(b));
    loadSocial(b);
    loadDrafts(b);
    return page(num, b);
  },
  // Phones and tablets: the main button in the sticky bottom bar. Wide screens have it in the side panel instead.
  bar(route) {
    if (wide()) return '';
    const b = drawn(normNum(route.num), +route.year || 0); if (!b) return '';
    const x = situation(b), main = mainButton(b, x);
    // A newcomer on a shared bill can turn the action down right beside it (R-023).
    return main && firstVisit() && !S.blLooking.has(b.id) && asking(x) ? `<div class="bl-barnew">${notNow()}${main}</div>` : main;
  },
  wire(route) {
    const root = document.querySelector('.bl-page'); if (!root) return;
    const num = normNum(route.num), year = +route.year || 0, key = keyOf(num, year), b = lookup(num, year);
    // #/bill/HB1780/testify, /email (R-124), /ask, /floor, /conference or /governor (R-169): the ask opens once the page
    // is drawn, once per address.
    if (b && route.open && drawn(num, year) && !(S.blOpened ??= new Set()).has(key + route.open)) {
      S.blOpened.add(key + route.open); setTimeout(() => openAsk(b, route.open), 50);
    }
    root.querySelector('[data-bl-back]')?.addEventListener('click', goBack);
    root.querySelector('[data-bl-retry]')?.addEventListener('click', () => retry(key));
    if (!b || !root.querySelector('.bl-head')) return;
    stampRoot();
    const x = situation(b), bar = document.querySelector('.actionbar'), both = [root, bar].filter(Boolean);
    const each = (sel, fn) => both.forEach(scope => scope.querySelectorAll(sel).forEach(fn));
    // The page's own buttons belong with the card's, above "More ways to help". The card is drawn by actions.js, so they
    // are drawn next to it and moved in; if the card ever changes shape they simply stay right under it.
    const slot = root.querySelector('.bl-slot'), col = root.querySelector('.bl-act .acard > .btncol');
    if (slot && col) col.prepend(slot);
    wireActions(root); wireNudge(root);
    root.querySelectorAll('details[data-bl-fold]').forEach(d => d.addEventListener('toggle', () => { const k = `${b.id}|${d.dataset.blFold}`; if (d.open) S.blOpen.add(k); else S.blOpen.delete(k); }));
    root.querySelector('[data-bl-star]')?.addEventListener('click', async e => {
      e.currentTarget.setAttribute('aria-busy', 'true');
      await flipFollow(b);
      app.render();
    });
    each('[data-bl-unfollowissue]', el => el.addEventListener('click', async () => {
      const i = S.issueById.get(el.dataset.blUnfollowissue); if (!i || el.getAttribute('aria-busy') === 'true') return;
      el.setAttribute('aria-busy', 'true');
      if (await setFollows({ issuesOff: [i.id] })) toast(`You no longer follow ${i.name}.`, { undo: async () => { await setFollows({ issuesOn: [i.id] }); app.render(); } });
      app.render();
    }));
    each('[data-bl-followissue]', el => el.addEventListener('click', async () => {
      const i = S.issueById.get(el.dataset.blFollowissue); if (!i || el.getAttribute('aria-busy') === 'true') return;
      el.setAttribute('aria-busy', 'true');
      if (await setFollows({ issuesOn: [i.id] })) {
        const say = r => r ? toast(profileSaved(r), { yay: true }) : toast(`Following ${i.name}. Its bills come to you, next session’s too.`, { yay: true, undo: async () => { await setFollows({ issuesOff: [i.id] }); app.render(); } });   // no Undo beside a yes (as find.js)
        app.render();
        if (!followAsk(i.name, say)) say(null);   // the profile ask after a follow (R-184; a stopped bill's main button is this)
        return;
      }
      app.render();
    }));
    // Where do you stand? The answer rides on the follow (that is how it reaches an account, and the bill's totals),
    // so taking a stand on a bill you do not follow yet also follows it, says so, and offers Undo.
    root.querySelectorAll('[data-bl-stance]').forEach(el => el.addEventListener('click', async () => {
      if (stanceBusy) return; stanceBusy = true;
      try {
        const had = myStance(b.id), next = had === el.dataset.blStance ? null : el.dataset.blStance;
        await setStance(b.id, next);
        // Only a first answer follows the bill: someone who undid that follow and then changes their answer is left alone.
        if (next && !had && !S.watch.has(b.id)) {
          await flipFollow(b, { quiet: true });
          if (S.watch.has(b.id)) toast(`Saved. You now follow ${spaced(b.bill_number)}.`, { yay: true, undo: () => flipFollow(lookup(num, year) || b, { quiet: true }) });
        }
      } finally { stanceBusy = false; }
      app.render();
    }));
    root.querySelector('[data-bl-menu]')?.addEventListener('click', e => { e.stopPropagation(); setMenu(document.getElementById('bl-menu').hidden); });
    root.querySelector('[data-bl-copy]')?.addEventListener('click', () => { setMenu(false, true); copyLink(b); });
    root.querySelectorAll('[data-bl-addto]').forEach(el => el.addEventListener('click', () => { setMenu(false); openAddTo(b); }));
    root.querySelector('[data-bl-share]')?.addEventListener('click', () => { setMenu(false, true); shareBill(b, x); });
    root.querySelector('[data-bl-close]')?.addEventListener('click', () => setMenu(false));
    root.querySelectorAll('[data-bl-compose]').forEach(el => el.addEventListener('click', () => openComposer(el.dataset.blCompose)));
    // A mailto opens the mail app and leaves this page as it was; a moment later, ask whether it went.
    each('[data-bl-mail]', el => el.addEventListener('click', () => setTimeout(() => { S.sentq[x.qKey] = el.dataset.blMail; app.render(); }, 800)));
    each('[data-bl-go="testify"]', el => el.addEventListener('click', () => app.openHelper(b.id, x.act.h.id)));
    each('[data-bl-go="compose"]', el => el.addEventListener('click', () => openComposer(x.k)));
    each('[data-bl-go="share"]', el => el.addEventListener('click', () => shareBill(b, x)));
    each('[data-bl-sent]', el => el.addEventListener('click', async () => {
      const hid = S.sentq[x.qKey]; delete S.sentq[x.qKey];
      if (el.dataset.blSent === 'yes') {
        await markDone(b.id, hid && hid !== '-' ? hid : '', 'email');
        if (x.waiting && x.code) { S.done.add(askMark(b, x.code)); saveDone(); }   // asked THIS committee (see askMark)
        if (x.stepKey && ['floor', 'conference', 'governor'].includes(x.kind)) { S.done.add(askMark(b, x.stepKey)); saveDone(); }   // this stage, done
        if (await app.newcomerActed(b)) return;
      }
      app.render();
    }));
    each('[data-bl-newlater]', el => el.addEventListener('click', () => { logVisit('arrive', 'skip', { path: 'link' }); S.blLooking.add(b.id); app.render(); }));
    each('[data-bl-tour]', el => el.addEventListener('click', () => viaStart(b, { viaSkipAsk: true })));
    each('[data-bl-billtour]', el => el.addEventListener('click', () => app.billTour?.()));
    each('[data-bl-newfollow]', el => el.addEventListener('click', async () => {
      if (el.getAttribute('aria-busy') === 'true') return;
      el.setAttribute('aria-busy', 'true');
      const i = issuesOf(b)[0];
      const ok = i ? await setFollows({ issuesOn: [i.id] }) : (S.watch.has(b.id) || await toggleWatch(b.id) !== false);
      if (!ok) { el.removeAttribute('aria-busy'); return; }
      logVisit('arrive', 'next', { path: 'link' });
      const moving = i ? (i.bill_ids || []).filter(id => S.watch.has(id)).map(id => S.bills.find(y => y.id === id)).filter(y => y && alive(y)).length : 1;
      moment({ title: 'Mahalo!', sub: `You’re following ${i ? i.name : nick(b) || spaced(b.bill_number)}.`,
        small: moving > 1 ? `That’s ${moving} bills this session. We’ll watch every one.` : 'We’ll tell you when there’s a hearing or a way to help.' }, () => viaStart(b));
    }));
    sideWatch?.disconnect();
    const side = root.querySelector('.bl-side');
    if (side) { fitSide(); sideWatch?.observe(side); }
  },
};
