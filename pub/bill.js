// The bill page (redesign 9/19): one bill in plain words, and the one thing worth doing about it right now.
// Route {name:'bill', num:'HB1563'}. A full page with its own address, not a sheet: the content is long, shared links
// land here, and phone Back has to work.
// Follow-ups after Nate's review (9/19): the page leads with the bill's everyday name when it has one, asks "Where do
// you stand?" near the top, keeps community numbers to this one bill, follows the same easiest-first ladder as the
// action card, and has a real desktop layout (the actions in a side panel that stays in view, no bottom bar).
import { S, DEMO, SUPABASE_URL, SUPABASE_KEY, app, esc, icon, toast, yay, blurb, asSentence, cleanDesc, nick, spaced, alive, stopOf, plainStatus, cmteLabel, roomLabel,
  dueInfo, dayWord, timeWord, dateLong, fmtDate, posInfo, issueOf, countOk, openActions, actedOn, didKind, doneKey, markDone, saveDone, ensureBill,
  toggleWatch, supa, hearingsOf, outcomeOf, OUTCOME_PLAIN, chairContacts, legsOf, legTitle, legPhoto, streamOf, sessionInfo,
  firstVisit, myStance, setStance, agrees, titleCase, reduceMotion, hstDay, CHAMBER_NAME, askMark, askedChair, companionsOf,
  issuesOf, issueFollowed, setFollows, catOf, wizSet, HST } from './core.js';
import { btn, iconBtn, chip, skeleton, posChip } from './ui.js';
import { actionCard, wireActions, nudgeCard, wireNudge, followToggle, newToActing, RANKED, nextStep } from './actions.js';
import { flower } from './art.js';
import { celebrate as moment } from './fx.js';
import { logVisit } from './visitlog.js';

const N = CHAMBER_NAME;
const normNum = n => String(n || '').replace(/\s/g, '').toUpperCase();
const numFromHash = () => normNum((/bill[=/]([A-Za-z]+\s?\d+)/i.exec(decodeURIComponent(location.hash)) || [])[1]);
const originOf = b => b.chamber || (/^S/.test(b.bill_number) ? 'S' : 'H');
const me = () => { try { return JSON.parse(localStorage.getItem('hiphi_me') || '{}') || {}; } catch { return {}; } };
// The districts the people screen saves ("Remember on this device"): {senate, house, label}.
function myDistricts() {
  try { const d = JSON.parse(localStorage.getItem('hiphi_districts') || 'null'); return d && (d.senate || d.house) ? d : null; } catch { return null; }
}
const mineLabel = (l, d) => !l || !d ? '' : l.chamber === 'S' && +l.district === +d.senate ? 'Your senator'
  : l.chamber === 'H' && +l.district === +d.house ? 'Your representative' : '';
// The Capitol's page for the bill; built from the number when the row has no link.
const capitolUrl = b => b.state_url || (m => m ? `https://capitol.hawaii.gov/session/measure_indiv.aspx?billtype=${m[1]}&billnumber=${m[2]}&year=${b.session_year || sessionInfo().yr}` : 'https://capitol.hawaii.gov')(/^([A-Z]+)(\d+)$/.exec(b.bill_number));
const shareUrl = b => `${location.origin}${location.pathname}#/bill/${b.bill_number}`;
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
const lookup = num => S.bills.find(x => x.bill_number === num) || Object.values(S.extra || {}).find(x => x.bill_number === num) || null;
const ready = b => S.bills.some(x => x.id === b.id) || !!(S.xh || {})[b.id];
// The bill, once its page can be drawn: it is known and its hearings are in. (A bill that is known but whose hearings
// never arrived is still drawn after one try, rather than never.)
function drawn(num) {
  const b = lookup(num); if (!b) return null;
  return ready(b) || (S.blTried.has(num) && !S.blLoading.has(num) && !S.blErr.has(num)) ? b : null;
}
// "We couldn't find it" is said only when the lookup really came back empty. The Supabase client reports a dropped
// connection as an error VALUE, it does not throw, so ensureBill answers null both for "no such bill" and for "could
// not ask" (9/19: a bill that became law read "We couldn't find SB 2175. Check the number" on a weak signal). When it
// answers null the question is asked once more here, as one plain request: the client has by then retried for about
// seven seconds, and a plain request fails at once instead of doubling that wait.
async function reallyMissing(num) {
  if (DEMO) return true;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/public_all_bills?select=id&bill_number=eq.${encodeURIComponent(num)}&limit=1`, { headers: { apikey: SUPABASE_KEY } });
  if (!r.ok) throw new Error('lookup failed: ' + r.status);
  return !(await r.json()).length;
}
async function fetchBill(num) {
  if (!DEMO && navigator.onLine === false) throw new Error('offline');   // no signal at all: say so now, not after the retries
  const b = await ensureBill(num); if (b) return b;
  if (await reallyMissing(num)) return null;
  const again = await ensureBill(num); if (again) return again;   // it exists: the first ask failed quietly
  throw new Error('The bill did not load');
}
function load(num) {
  if (S.blLoading.has(num)) return;
  S.blLoading.add(num); S.blErr.delete(num); S.blMissing.delete(num); S.blTried.add(num);
  // A connection that hangs ends in "Try again", not in a skeleton that never goes away.
  let timer; const slow = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('timeout')), 12000); });
  Promise.race([fetchBill(num), slow]).then(b => { if (!b) S.blMissing.add(num); })
    .catch(e => { console.error(e); S.blErr.add(num); })
    .finally(() => { clearTimeout(timer); S.blLoading.delete(num); if (numFromHash() === num) app.render(); });
}
const retry = num => { S.blErr.delete(num); S.blMissing.delete(num); S.blTried.delete(num); app.render(); };
// Back on a signal: the bill that failed loads by itself.
window.addEventListener('online', () => { const num = numFromHash(); if (onBill() && S.blErr.has(num)) retry(num); });
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
  const stopped = !law && (b.stage === 'dead' || b.stage === 'vetoed' || (!alive(b) && b.stage !== 'governor'));
  const live = !law && !stopped, differs = agrees(b) === false;
  const act = live ? openActions([b], hs)[0] || null : null;
  // Who decides next: the committee holding the bill now (the hearing's committee when one is set).
  const code = !live ? null : act ? act.h.committee : st.phase === 'committee' ? (st.hearing?.committee || st.committee) : null;
  const chairs = code ? chairContacts(code) : [];
  const waiting = live && !act && st.phase === 'committee' && st.hearingState === 'none' && !!st.committee && !st.deadline?.missed;
  let kind = 'share';
  if (law) kind = 'law';
  else if (stopped) kind = 'stopped';
  else if (act && differs) kind = 'capitol';
  else if (act && RANKED) { const n = nextStep(b, act.h); kind = n === 'testimony' ? 'testify' : n === 'email' ? 'email' : 'share'; }   // R-005, ?rank=1 only
  else if (act && (act.late || newToActing())) kind = didKind(b, act.h, 'email') ? 'share' : 'email';
  else if (act) kind = didKind(b, act.h, 'testimony') ? 'share' : 'testify';
  else if (waiting && pos && chairs.length && !asked(b, code)) kind = differs ? 'capitol' : /oppose/.test(b.hiphi_position) ? 'hold' : 'ask';
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
  return { st, hs, pos, law, stopped, live, differs, act, code, chairs, waiting, kind, stepKey, to, conf, k: act ? `${b.id}|${act.h.id}` : '', qKey: `${b.id}|sentq` };
}

// A ready-to-send email to one or more chairs. Greeting by surname ("Dear Chair San Buenaventura"), the person's
// name and town from the testimony helper when they have given them, the plain summary, and one clear ask.
// mode 'own' is for someone who sees the bill differently from HIPHI: what the bill does, and room for their words.
function mailFor(b, x, chairs, mode) {
  const m = me(), p = posInfo(b), sp = spaced(b.bill_number);
  const dear = chairs.length ? chairs.map(c => c.greet || `Chair ${c.last}`).join(' and ') : 'Chair';
  const who = m.name ? `My name is ${m.name}${m.town ? ` and I live in ${m.town}` : ''}. ` : '';
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
  const text = `Dear ${dear},\n\n${body}\n\nMahalo,\n${m.name || '[your name]'}${m.town ? '\n' + m.town : ''}`;
  return `mailto:${chairs.map(c => c.email).filter(Boolean).join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
}
const mailMode = x => x.differs ? 'own' : x.kind === 'hold' ? 'hold' : x.kind === 'ask' || (x.waiting && x.pos && !/oppose/.test(x.pos.verb)) ? 'ask' : x.waiting && x.pos ? 'hold' : 'about';

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
    case 'testify': return btn('Write my testimony · 5 min', { kind: 'primary', icon: 'notebook-pen', full: true, attrs: { 'data-bl-go': 'testify' } });
    case 'capitol': return btn(x.act ? 'Testify at the Capitol site' : 'See the Capitol bill page', { kind: 'primary', icon: 'landmark', iconEnd: 'external-link', full: true, href: capitolUrl(b), attrs: { 'data-bl-go': 'capitol', target: '_blank', rel: 'noopener' } });
    case 'ask': return btn(x.chairs.length > 1 ? 'Ask the chairs for a hearing' : 'Ask the chair for a hearing', { kind: 'primary', icon: 'mail', full: true, href: mailFor(b, x, x.chairs, 'ask'), attrs: { 'data-bl-main': 'ask', 'data-bl-mail': '-' } });
    case 'hold': return btn('Email the chair · 2 min', { kind: 'primary', icon: 'mail', full: true, href: mailFor(b, x, x.chairs, 'hold'), attrs: { 'data-bl-main': 'hold', 'data-bl-mail': '-' } });
    case 'floor': case 'conference': {
      if (!x.to.length) return btn('Find your legislators', { kind: 'primary', icon: 'map-pin', full: true, href: `#/legislators?from=${encodeURIComponent(b.bill_number)}` });
      const one = x.to.length === 1 ? x.to[0] : null, yes = /oppose/.test(b.hiphi_position || '') ? 'no' : 'yes';
      const label = x.differs ? (x.conf ? `Email the conference ${one ? 'chair' : 'chairs'}` : one ? `Email ${legTitle(one)} ${surname(one)}` : 'Email your legislators')
        : x.kind === 'floor' ? `Ask ${legTitle(one)} ${surname(one)} to vote ${yes}` : x.conf ? `Email the conference ${one ? 'chair' : 'chairs'}` : 'Email your legislators';
      return btn(label, { kind: 'primary', icon: 'mail', full: true, href: mailFor(b, x, x.to.map(l => contactOf(l, x.conf)), x.differs ? 'own' : x.kind), attrs: { 'data-bl-main': x.kind, 'data-bl-mail': '-' } });
    }
    case 'governor': return btn(x.differs ? 'Tell the Governor what you think' : /oppose/.test(b.hiphi_position || '') ? 'Ask the Governor to veto it' : 'Ask the Governor to sign it',
      { kind: 'primary', icon: 'landmark', iconEnd: 'external-link', full: true, href: GOV_URL, attrs: { 'data-bl-main': 'governor', 'data-bl-mail': '-', target: '_blank', rel: 'noopener' } });
    case 'law': return btn(x.differs ? 'Share this bill' : 'Share the good news', { kind: 'primary', icon: 'share-2', full: true, attrs: { 'data-bl-go': 'share' } });
    case 'stopped': {
      // Between sessions nothing is moving: the useful step is getting ready for January.
      const off = sessionInfo().phase !== 'in';
      if (off && !myDistricts()) return btn('Find your legislators', { kind: 'primary', icon: 'map-pin', full: true, href: `#/legislators?from=${encodeURIComponent(b.bill_number)}` });
      // A stopped bill is not the end of its issue: follow the issue and its next bills come to you (R-018).
      const bi = issuesOf(b)[0];
      if (bi) return issueFollowed(bi) ? btn(`See ${esc(bi.name)}`, { kind: 'primary', icon: 'arrow-right', full: true, href: `#/issue/${encodeURIComponent(bi.slug)}`, cls: 'bl-barbtn' })
        : btn(`Follow the issue: ${esc(bi.name)}`, { kind: 'primary', icon: 'star', full: true, attrs: { 'data-bl-followissue': bi.id }, cls: 'bl-barbtn' });
      return btn(off ? 'Find bills' : 'Find bills still moving', { kind: 'primary', icon: 'search', full: true, href: '#/find' });
    }
    default: return btn('Share this bill', { kind: 'primary', icon: 'share-2', full: true, attrs: { 'data-bl-go': 'share' } });
  }
}

// ---------------- the stops, in plain words ----------------
// Seven stops instead of Capitol stage names (no Triple, Lateral or Decking): a bill starts in one chamber, goes
// through its committees and a vote, crosses to the other chamber and does the same, then goes to the Governor.
function railInfo(b, x) {
  const st = x.st, o = originOf(b), t = o === 'H' ? 'S' : 'H';
  const names = ['Introduced', `${N[o]} committees`, `${N[o]} vote`, `${N[t]} committees`, `${N[t]} vote`, 'Governor', 'Law'];
  const desc = ['A lawmaker files the bill and it gets a number.',
    `One to three ${N[o]} committees hold hearings and vote on it. Each chair decides if it gets a hearing.`,
    `The full ${N[o]} votes. If it passes, it crosses over to the ${N[t]}.`,
    `${N[t]} committees hold their own hearings and votes.`,
    `The full ${N[t]} votes. If the House and Senate passed different versions, they work out one.`,
    'The Governor signs it, lets it become law without signing, or vetoes it.',
    'It becomes a Hawaiʻi law.'];
  let idx;
  if (x.law) idx = 6;
  else if (/governor|vetoed/.test(b.stage) || /governor|vetoed/.test(st.phase)) idx = 5;
  else if (st.phase === 'dead') { const d = b.died_at_stage || '';
    // No record of where it stopped: a hearing already held in the other chamber shows it had crossed over (a page
    // said "Stopped in House committees" above a Senate hearing marked Heard).
    const crossed = !d && x.hs.some(h => S.committees[String(h.committee).split('/')[0]]?.chamber === t && new Date(h.scheduled_at) < Date.now());
    idx = /^second_crossover|^conference/.test(d) ? 4 : /^second|^first_crossover/.test(d) || crossed ? 3 : 1; }
  else if (st.phase === 'conference') idx = 4;
  else if (st.phase === 'floor') idx = st.leg === 'first' ? 2 : 4;
  else idx = st.leg === 'first' ? 1 : 3;
  const ch = idx <= 2 ? N[o] : N[t];
  let lead = 'Now: ', rest;
  if (x.law) { lead = 'Became law'; rest = ''; }
  else if (x.stopped) { lead = ''; rest = b.stage === 'vetoed' ? 'Vetoed by the Governor' : idx === 1 || idx === 3 ? `Stopped in ${ch} committees` : idx === 4 && /conference/.test(b.died_at_stage || '') ? 'Stopped before the final vote' : `Stopped before the ${ch} vote`; }
  else if (st.phase === 'conference') rest = 'Working out one version';
  else if (idx === 5) rest = 'On the Governor’s desk';
  else if (st.phase === 'floor') rest = `Waiting for the ${ch} vote`;
  else rest = `In ${ch} committees`;
  return { names, desc, idx, lead, rest };
}
const STEP_WORD = { done: 'done', now: 'now', stop: 'stopped here', next: 'still ahead' };
const fold = (b, name) => `data-bl-fold="${name}"${S.blOpen.has(`${b.id}|${name}`) ? ' open' : ''}`;
export function railHTML(b, x) {
  const r = railInfo(b, x), at = s => x.law || s < r.idx ? 'done' : s === r.idx ? (x.stopped ? 'stop' : 'now') : 'next';
  const align = r.idx <= 1 ? 'l' : r.idx >= 5 ? 'r' : 'c';
  // Where there is room (a tablet, a laptop) every dot carries its name; on a phone only the current one does.
  const dots = r.names.map((n, i) => { const s = at(i), tag = s === 'now' ? 'Now' : s === 'stop' ? 'Stopped here' : '';
    return `<li class="bl-${s}"><span class="bl-dw"><span class="bl-dot">${s === 'done' ? icon('check') : s === 'stop' ? icon('x') : ''}</span></span><span class="bl-dlbl" aria-hidden="true">${tag ? `<b>${tag}</b>` : ''}${esc(n)}</span><span class="sr">Step ${i + 1} of 7, ${esc(n)}: ${STEP_WORD[s]}.</span></li>`; }).join('');
  const steps = r.names.map((n, i) => { const s = at(i), tag = { done: 'Done', now: 'Now', stop: 'Stopped here', next: '' }[s];
    return `<li class="bl-s-${s}"><span class="bl-sdot">${s === 'done' ? icon('check') : s === 'stop' ? icon('x') : ''}</span><div><p class="bl-sname">${esc(n)}${tag ? ` <span class="bl-stag">${tag}</span>` : ''}</p><p class="bl-sdesc">${esc(r.desc[i])}</p></div></li>`; }).join('');
  return `<div class="bl-rail${x.stopped ? ' bl-railstop' : x.law ? ' bl-raillaw' : ''}">
      <ol class="bl-dots" aria-label="The 7 steps from bill to law">${dots}</ol>
      <p class="bl-nowlbl bl-at${r.idx} bl-${align}" aria-hidden="true">${r.lead ? `<b>${esc(r.lead)}</b>` : ''}${esc(r.rest)}</p>
    </div>
    <details class="bl-steps" ${fold(b, 'steps')}><summary><span>See all steps</span>${icon('chevron-down', { cls: 'bl-chev' })}</summary><ol class="bl-steplist">${steps}</ol></details>`;
}

// ---------------- the page ----------------
// Phones: Back, the number, the follow star and a small menu, in a bar that stays at the top. Wide screens: Back and
// the number in a plain row (follow, share and copy link sit in the side panel, which stays in view).
function topbar(num, b) {
  const on = !!b && S.watch.has(b.id), sp = spaced(num) || 'Bill', w = wide();
  const tools = b && !w ? `${iconBtn('star', `Follow ${sp}`, { 'data-bl-star': '1', 'aria-pressed': on ? 'true' : 'false' }, on ? 'on' : '')}
      <div class="bl-menuwrap">${iconBtn('ellipsis', 'More options', { 'data-bl-menu': '1', 'aria-expanded': 'false', 'aria-controls': 'bl-menu' })}
        <div class="bl-menu" id="bl-menu" hidden>
          <button type="button" class="bl-mi" data-bl-copy="1">${icon('link')}<span>Copy link</span></button>
          <button type="button" class="bl-mi" data-bl-share="1">${icon('share-2')}<span>Share</span></button>
          <a class="bl-mi" href="${esc(capitolUrl(b))}" target="_blank" rel="noopener" data-bl-close="1">${icon('landmark')}<span>Capitol bill page</span>${icon('external-link', { cls: 'bl-ext' })}</a>
        </div></div>` : '';
  return `<div class="bl-top${w ? ' bl-topw' : ''}"><button type="button" class="btn text bl-back" data-bl-back="1">${icon('arrow-left')}<span>Back</span></button>
    <p class="bl-num">${esc(sp)}</p>${w ? '' : `<div class="bl-tools">${tools}</div>`}</div>`;
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
function newcomer(b, x) {
  if (!firstVisit()) return '';
  if (!S.blNew.has(b.id)) logVisit('arrive', 'view', { path: 'link' });   // counted privately (R-023 decision 8)
  S.blNew.add(b.id);
  const h = x.act?.h, i = issuesOf(b)[0];
  const text = h ? `This bill has a hearing ${whenWord(h.scheduled_at)}. You can help right now, in about 2 minutes, or follow it and we’ll tell you when.`
    : x.kind === 'ask' ? 'This bill is waiting for a hearing. You can ask the chair for one, in about 2 minutes, or follow it and we’ll tell you when.'
    : `Follow ${i ? 'its issue' : 'it'}, and we’ll tell you when there’s a hearing or a way to help.`;
  return `<section class="card bl-newbie" aria-labelledby="bl-nb-h">
    <p class="bl-nbtext" id="bl-nb-h">${icon('sparkles')}<span><b>New here?</b> ${esc(text)}</span></p>
    <div class="bl-nbbtns">${btn(i ? 'Follow this issue' : 'Follow this bill', { kind: 'secondary', icon: 'star', attrs: { 'data-bl-newfollow': '1' } })}${x.act || x.kind === 'ask' ? '' : notNow()}</div>
  </section>`;
}
// "Not now" turns down acting, so it sits beside the main button (the phone bar; the side panel on a laptop) and goes
// straight on to the lessons, without asking about following again (the review, 9/21).
const notNow = () => btn('Not now', { kind: 'text', attrs: { 'data-bl-newlater': '1' } });
// On to the rest of the first visit, on this bill.
const viaStart = (b, extra = {}) => { wizSet({ via: b.bill_number, viaId: b.id, viaName: nick(b) || spaced(b.bill_number), step: 1, ...extra }); app.go('#/start/1'); };
// Without an everyday name the headline is what the bill does: HIPHI's plain summary; without one, the first sentence
// of the official description (the whole of it sits under More details, so nothing is lost to "..."). With neither,
// what the official title is about.
function plainHead(b) {
  if (b.hiphi_summary) return blurb(b, 200);
  const d = cleanDesc(b.description);
  if (d) { const m = /^(.{20,220}?[.!?])(\s|$)/.exec(d); return m ? m[1] : blurb(b, 170); }
  return `A bill about ${titleCase(b.title || 'a Hawaiʻi issue').replace(/^relating to\s+/i, '').replace(/[.\s]+$/, '')}`;
}
// The name leads when the bill has one ("Disposable vape ban"), with what it does right under it. The number stays in
// the top bar. The official "Relating to…" title never shows up here, so the lede is only ever a summary.
function head(b, x) {
  const p = posInfo(b), name = nick(b), mine = myStance(b.id);
  const lede = name && (b.hiphi_summary || cleanDesc(b.description)) ? blurb(b, 320) : '';
  const chips = [x.law ? chip('Became law', 'ok', 'circle-check') : x.stopped ? chip('Stopped this session', '', 'archive') : '',
    p ? posChip(b) : b.hiphi_position === 'monitor' ? chip('HIPHI is watching it', '', 'eye') : '',
    // A bill that can no longer move does not ask where you stand; it remembers what you said.
    !x.live && (mine === 'support' || mine === 'oppose') ? chip(mine === 'support' ? 'You supported it' : 'You opposed it', '', 'user-check') : ''].filter(Boolean).join('');
  return `<div class="bl-head"><h1 class="${name ? 'hero bl-nick' : 'bl-what'}">${esc(name || plainHead(b))}</h1>
    ${lede ? `<p class="lede bl-lede">${esc(lede)}</p>` : ''}${chips ? `<div class="chips">${chips}</div>` : ''}${issueLine(b)}</div>`;
}
// The issue a bill belongs to (R-018: people follow issues, and a bill is one way an issue moves). Its name is the way
// to its page; beside it, whether the person follows it, or one tap to start. Bills HIPHI only watches have no issue.
function issueLine(b) {
  const iss = issuesOf(b); if (!iss.length) return '';
  const i = iss[0], on = issueFollowed(i), cat = catOf(i.category);
  return `<p class="bl-issue">${icon(cat?.icon || 'heart-pulse')}<span>Part of <a href="#/issue/${esc(i.slug)}">${esc(i.name)}</a>${on ? ' · you follow this issue' : ''}</span>
    ${on || firstVisit() ? '' : btn('Follow the issue', { kind: 'secondary', sm: true, icon: 'star', attrs: { 'data-bl-followissue': i.id } })}</p>`;   // a newcomer has it on their own card (A-14)
}
// Where do you stand? Three toggles, private to the person (it rides on their follow once they sign in; others only
// ever see totals, from 10 people). Choosing the selected one again clears it. Only for a bill that can still move.
const STANCES = [['support', 'Support'], ['oppose', 'Oppose'], ['unsure', 'Not sure yet']];
function stanceInner(b, x) {
  const mine = myStance(b.id);
  // Someone who sees it differently from HIPHI is never handed HIPHI's letter; where no action card says so, say it here.
  const own = x.differs && !x.act && !wide() ? `<p class="note">${icon('info')}<span>You see this one differently from HIPHI. You can still tell lawmakers what you think, in your own words.</span></p>` : '';
  return `<h2 id="bl-stance-h">Where do you stand?</h2>
    <div class="chips" role="group" aria-labelledby="bl-stance-h">${STANCES.map(([v, label]) => `<button type="button" class="chip" data-bl-stance="${v}" aria-pressed="${mine === v}">${mine === v ? icon('check') : ''}${label}</button>`).join('')}</div>
    <p class="bl-stnote">${mine ? 'Saved. ' : ''}Your answer is private. We only show totals.</p>${own}`;
}
// Follow, share and copy link on a wide screen (a phone has them in the top bar).
function sideTools(b) {
  const on = S.watch.has(b.id);
  return `<div class="bl-stools" role="group" aria-label="Follow and share">
    ${btn(on ? 'Following' : 'Follow', { kind: 'secondary', sm: true, icon: 'star', cls: on ? 'on' : '', attrs: { 'data-bl-star': '1', 'aria-pressed': on ? 'true' : 'false' } })}
    ${btn('Share', { kind: 'text', sm: true, icon: 'share-2', attrs: { 'data-bl-share': '1' } })}${btn('Copy link', { kind: 'text', sm: true, icon: 'link', attrs: { 'data-bl-copy': '1' } })}</div>`;
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
function statusCard(b, x) {
  const si = sessionInfo(), next = si.nextOpen ? new Date(si.nextOpen + 'T12:00:00-10:00').toLocaleDateString('en-US', { timeZone: 'Pacific/Honolulu', weekday: 'long', month: 'long', day: 'numeric' }) : '';
  const extra = x.law ? 'Mahalo to everyone who spoke up.'
    : x.stopped ? (si.phase === 'in' || !next ? 'Ideas like this often come back next session.' : `Ideas like this often come back. The ${si.nextOpen.slice(0, 4)} session opens ${next}.`) : '';
  return `<section class="card bl-status" aria-labelledby="bl-st-h"><h2 class="sr" id="bl-st-h">Where it is now</h2>
    <p class="bl-say">${x.law ? flower(22) : ''}<span>${esc(plainStatus(b).text)}${extra ? ` ${esc(extra)}` : ''}</span></p>
    ${b.hiphi_action && !x.act && x.live && !x.differs ? `<p class="bl-ask">${icon('megaphone')}<span><b>HIPHI asks:</b> ${esc(b.hiphi_action)}</span></p>` : ''}
    ${!wide() && stepCard(b, x) ? `<p class="bl-next"><b>${esc(stepCard(b, x)[0])}.</b> ${esc(stepCard(b, x)[1])}</p>` : ''}
    ${railHTML(b, x)}
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
  const big = x.kind === 'email' && !x.act.late ? `<button type="button" class="mwrow bl-bigstep" data-helper="${esc(h.id)}" data-bill="${esc(b.id)}"><span class="lead">${icon('notebook-pen')}</span><span class="body"><span class="title">Write testimony · 5 min</span><span class="sub">The bigger step, and the strongest way to be heard. First time, the Capitol site asks for a free account.</span></span>${icon('chevron-right', { cls: 'chev' })}</button>` : '';
  const main = wide() ? mainButton(b, x) + (S.blNew.has(b.id) && firstVisit() ? `<div class="bl-notnow">${notNow()}</div>` : '') : '';
  return `<section class="bl-sec bl-act${big ? ' bl-hasbig' : ''}" aria-labelledby="bl-act-h"><div class="sechead"><h2 id="bl-act-h">${title}</h2></div>
    ${actionCard(b, h, { heading: 'h3', compact: true })}${main || big ? `<div class="bl-slot">${main}${big}</div>` : ''}${ask ? `<div class="bl-nudge">${ask}</div>` : ''}</section>`;
}
// The floor, conference and the Governor: what the step is and why, in one line (the side card on a wide screen, the
// status card on a phone, where the button sits in the bottom bar).
function stepCard(b, x) {
  const opp = /oppose/.test(b.hiphi_position || ''), ch = N[x.st.chamber] || '', rep = x.st.chamber === 'S' ? 'senator' : 'representative';
  if (x.kind === 'floor') return x.to.length
    ? [`Ask for a ${opp ? 'no' : 'yes'} vote`, `The full ${ch} votes on it next. Lawmakers listen closest to the people they represent, so a short email from you counts.`]
    : [`Ask for a ${opp ? 'no' : 'yes'} vote`, `The full ${ch} votes on it next. Find your own ${rep}, then send a short email: lawmakers listen closest to the people they represent.`];
  if (x.kind === 'conference') return x.conf
    ? ['Write to the conference chairs', 'The House and Senate passed different versions. A few members of each are working out one version, led by these chairs. A short, polite email helps.']
    : ['Ask your legislators to speak up', 'The House and Senate passed different versions and are working out one. Your own legislators can speak up for it.'];
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
    capitol: ['Have your say', 'You see this one differently from HIPHI. You can still tell lawmakers what you think, in your own words.'],
    law: ['It became law', x.differs ? 'This bill is now a Hawaiʻi law.' : 'Mahalo to everyone who spoke up. Pass on the good news.'],
    stopped: ['What you can do now', off ? 'The Legislature is between sessions. A good next step is to get ready for the next one.' : 'This bill stopped, but others are still moving and need voices.'],
  }[x.kind] || ['Spread the word', 'More voices carry more weight. Send this bill to someone who cares about it.'];
  return `<section class="card bl-do" aria-labelledby="bl-do-h"><h2 id="bl-do-h">${title}</h2><p class="small">${esc(text)}</p>${main}</section>`;
}
function whoDecides(b, x) {
  if (!x.code || !x.chairs.length) return '';
  const d = myDistricts(), plural = x.chairs.length > 1, chairIds = new Set(x.chairs.map(c => c.leg?.id).filter(Boolean));
  const others = legsOf(x.code).filter(m => m.role !== 'chair' && !chairIds.has(m.l.id)), joint = x.chairs.length > 1;
  const c1 = plural ? 'chairs' : 'chair', from = `?from=${encodeURIComponent(b.bill_number)}`;
  const hold = (x.kind === 'hold' || (x.waiting && x.pos && /oppose/.test(x.pos.verb))) && !x.differs;
  const intro = x.act ? (didKind(b, x.act.h, 'testimony') ? `Mahalo for your testimony. A short email to the ${c1} adds even more weight.`
      : x.act.late ? `The deadline for written testimony has passed. A short email to the ${c1} is the quickest way to be heard now.`
      : x.kind === 'email' ? `The hearing is set. A short email to the ${c1} is a quick way to be heard. Testimony carries the most weight.`
      : 'The hearing is set. The best thing you can do now is send testimony.')
    : x.st.hearingState === 'held' ? `The committee heard it. The ${c1} will share what happens next.`
    : x.st.hearingState === 'scheduled' ? 'The hearing is set. Anyone in Hawaiʻi can send testimony on the Capitol website.'
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
    : o?.outcome ? chip(OUTCOME_PLAIN[o.outcome] || 'Decided', /passed/.test(o.outcome) ? 'ok' : '', /passed/.test(o.outcome) ? 'circle-check' : o.outcome === 'deferred' ? 'hourglass' : 'undo-2')
    : past ? chip(pending ? 'Waiting for the decision' : 'Heard', '', pending ? 'hourglass' : 'check') : '';
  const acts = [
    !past && !off && posInfo(b) && alive(b) && agrees(b) !== false && due && !due.late ? btn('Write testimony', { kind: 'text', sm: true, icon: 'notebook-pen', attrs: { 'data-helper': h.id, 'data-bill': b.id } }) : '',
    !past && !off ? (S.chips?.[k + 'ics'] ? chip('Calendar file ready', 'ok', 'check') : btn('Add to calendar', { kind: 'text', sm: true, icon: 'calendar-plus', attrs: { 'data-ics': k } })) : '',
    v ? btn(v.state === 'live' ? 'Watch live' : past ? 'Watch the recording' : v.label, { kind: 'text', sm: true, icon: 'play', href: v.url, attrs: { target: '_blank', rel: 'noopener' } }) : '',
  ].filter(Boolean).join('');
  return `<li class="bl-hr${past ? ' bl-past' : ''}"><span class="bl-hico">${icon(past ? 'calendar-days' : 'calendar')}</span><div class="bl-hbody">
    <p class="bl-htitle">${esc(cmteLabel(h.committee))}</p>
    <p class="bl-hwhen">${esc(dateLong(h.scheduled_at))} at ${esc(timeWord(h.scheduled_at))} · ${esc(roomLabel(h.room))}</p>
    ${due ? `<p class="bl-hdue ${due.tone}">${icon('clock')}<span>${esc(due.text)}</span></p>` : ''}
    ${tag ? `<div class="chips">${tag}</div>` : ''}${acts ? `<div class="btnrow bl-hacts">${acts}</div>` : ''}</div></li>`;
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
function pathHTML(b, x) {
  const refs = b.referrals || []; if (!refs.length) return '';
  const st = x.st, o = originOf(b), t = o === 'H' ? 'S' : 'H', n = Math.min(b.origin_stops || refs.length, refs.length);
  const lists = { first: refs.slice(0, n), second: refs.slice(n) };
  // A stopped bill stopped at the stop its last stage names: Triple = the first, Decking = the last, Lateral = between.
  const ds = x.stopped ? (b.died_at_stage || '') : '';
  const deadLeg = ds ? (/^second|^first_crossover/.test(ds) ? 'second' : 'first') : null;
  const deadIdx = list => ds === 'first_crossover' || /triple|introduced/.test(ds) ? 0 : /decking/.test(ds) ? list.length - 1 : list.length <= 2 ? 0 : 1;
  const allPast = x.law || /governor|vetoed|conference|second_crossover/.test(b.stage) || /governor|vetoed|conference/.test(st.phase);
  const state = (leg, list, i) => {
    if (allPast) return 'past';
    if (deadLeg) { if (leg !== deadLeg) return leg === 'first' ? 'past' : 'next'; const di = deadIdx(list); return i < di ? 'past' : i === di ? 'dead' : 'next'; }
    if (b.stage === 'dead') return 'plain';
    const here = st.leg === leg && st.phase === 'committee' && st.stop === i + 1;
    const s = here ? 'here' : (st.leg !== leg ? leg === 'first' : (st.phase !== 'committee' || st.stop > i + 1)) ? 'past' : 'next';
    return x.stopped && s === 'here' ? 'dead' : s;
  };
  const IC = { past: 'circle-check', here: 'circle-dot', dead: 'circle-x', next: 'circle', plain: 'circle' };
  const line = (leg, ch) => lists[leg].length ? `<div class="bl-pch"><p class="bl-pchn">${N[ch]}</p><ol class="bl-path">${lists[leg].map((c, i) => { const s = state(leg, lists[leg], i);
      const name = String(c).split('/').map(k => cmteLabel(k, { short: true })).join(', together with ');
      return `<li class="bl-p-${s}">${icon(IC[s])}<span>${esc(name)}${s === 'past' ? '<span class="sr"> (passed)</span>' : ''}</span>${s === 'here' ? chip('Now', 'info') : s === 'dead' ? chip('Stopped here') : ''}</li>`; }).join('')}</ol></div>` : '';
  const waitingRef = !x.stopped && st.leg === 'second' && st.phase === 'committee' && !lists.second.length;
  return line('first', o) + (lists.second.length ? line('second', t) : waitingRef ? `<div class="bl-pch"><p class="bl-pchn">${N[t]}</p><p class="bl-pnone">Not sent to a committee yet</p></div>` : '');
}
function sponsorText(b) {
  const o = originOf(b);
  const names = (b.sponsors || []).map(s => typeof s === 'string' ? s : s?.n || s?.name || '').filter(Boolean).map(n => {
    const l = (S.legislators || []).find(l => l.chamber === o && (l.sort_name || '').split(',')[0].trim().toUpperCase() === n.trim().toUpperCase());
    return l ? `${legTitle(l)} ${l.name}` : titleCase(n); });
  if (names.length > 6) return `${names.slice(0, 6).join(', ')} and ${names.length - 6} more`;
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] || '';
}
// "SD1": each time a chamber changes a bill it gets a new draft number (HD = House, SD = Senate, CD = conference).
function versionText(v) {
  const m = /^([HSC])D(\d+)$/i.exec(v || ''); if (!m) return v;
  const who = { H: 'The House has', S: 'The Senate has', C: 'House and Senate negotiators have' }[m[1].toUpperCase()], n = +m[2];
  return `${v.toUpperCase()}: ${who} changed the bill ${n === 1 ? 'once' : n === 2 ? 'twice' : n + ' times'}. Each change gets a new draft number.`;
}
function details(b, x) {
  const comp = companionsOf(b);
  const path = pathHTML(b, x), spons = sponsorText(b);
  const rows = [
    b.title ? ['Official title', esc(titleCase(b.title))] : null,
    // Always here in full: the headline above may be a name, a summary, or only the first sentence of this.
    b.description ? ['Official summary', esc(b.description)] : null,
    path ? ['Committees', path] : null,
    spons ? ['Introduced by', esc(spons)] : null,
    b.last_action ? ['Last official action', `${esc(b.last_action)}${b.last_action_date ? `<span class="bl-date">${esc(fmtDate(b.last_action_date, { month: 'short', day: 'numeric', year: 'numeric' }))}</span>` : ''}`] : null,
    comp.length ? [`Companion bill${comp.length > 1 ? 's' : ''}`, `${comp.map(c => `<a href="#/bill/${esc(c)}">${esc(spaced(c))}</a>`).join(', ')}<span class="bl-date">The same idea, filed in the ${N[/^S/.test(comp[0]) ? 'S' : 'H']} too. Either one can become law.</span>`] : null,
    b.current_version ? ['Version', esc(versionText(b.current_version))] : null,
  ].filter(Boolean);
  return `<details class="bl-more" ${fold(b, 'more')}><summary><span>More details</span>${icon('chevron-down', { cls: 'bl-chev' })}</summary>
    <dl>${rows.map(([k, v]) => `<div class="bl-kv"><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
    <p class="bl-cap">${btn('Capitol bill page', { kind: 'text', sm: true, icon: 'landmark', iconEnd: 'external-link', href: capitolUrl(b), attrs: { target: '_blank', rel: 'noopener' } })}</p></details>`;
}
function page(num, b) {
  const x = situation(b);
  const note = b.sandbox_untracked ? `<div class="notice info bl-note">${icon('info')}<div>This bill is not on HIPHI’s list, so the sandbox has only its number and title. The live tracker shows every bill in full.</div></div>` : '';
  if (!wide()) return `<div class="bl-page">${topbar(num, b)}${head(b, x)}${newcomer(b, x)}
    ${x.live ? `<section class="card bl-stance" aria-labelledby="bl-stance-h">${stanceInner(b, x)}</section>` : ''}${note}
    ${statusCard(b, x)}${actionSection(b, x)}${othersBlock(b)}${whoDecides(b, x)}${hearingsSection(b, x)}${details(b, x)}</div>`;
  return `<div class="bl-page bl-wide">${topbar(num, b)}<div class="cols bl-cols">
    <div class="bl-main">${head(b, x)}${note}${statusCard(b, x)}${othersBlock(b)}${whoDecides(b, x)}${hearingsSection(b, x)}${details(b, x)}</div>
    <aside class="side bl-side" aria-label="Take part">
      <p class="bl-sidenum">${esc(spaced(b.bill_number))}</p>
      ${newcomer(b, x)}${actionSection(b, x) || doCard(b, x)}
      <section class="card bl-you" ${x.live ? 'aria-labelledby="bl-stance-h"' : 'aria-label="Follow and share"'}>${x.live ? stanceInner(b, x) : ''}${sideTools(b)}</section>
    </aside></div></div>`;
}
const loading = () => `<div class="bl-skel">${skeleton(4)}</div>`;
const shell = (num, inner) => `<div class="bl-page${wide() ? ' bl-wide' : ''}">${topbar(num, null)}${inner}</div>`;
const missing = num => `<div class="empty bl-empty">${icon('search', { size: 40 })}<h1>We couldn’t find ${esc(spaced(num) || 'that bill')}</h1><p>Check the number, or search for the bill by a word like vaping.</p>${btn('Search bills', { kind: 'primary', icon: 'search', href: `#/find?q=${encodeURIComponent(num)}` })}</div>`;
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
async function shareBill(b, x) {
  const sp = spaced(b.bill_number), url = shareUrl(b), h = x.act?.h || null, name = nick(b);
  const what = name ? `${name} (${sp}). ${blurb(b, 110)}` : `${sp}: ${blurb(b, 110)}`;
  const text = x.law ? `${x.differs ? '' : 'Good news: '}${name ? `${name} (${sp})` : sp} is now law in Hawaiʻi. ${blurb(b, 110)}`
    : h ? `${what} Hearing ${dayWord(h.scheduled_at)}. You can add your voice in a few minutes.`
    : `${what} Follow it on HIPHI’s Bill Tracker.`;
  let ok = false, copied = false;
  const copy = async () => { await navigator.clipboard.writeText(`${text} ${url}`); ok = copied = true; };
  try { if (navigator.share) { await navigator.share({ title: name || sp, text, url }); ok = true; } else await copy(); }
  catch (e) { if (e?.name !== 'AbortError') { try { await copy(); } catch { toast('Sharing is not available here. Use Copy link instead.'); } } }
  if (!ok) return;
  if (!didKind(b, h, 'share')) await markDone(b.id, h?.id || '', 'share', true, { quiet: copied });
  if (copied) yay('Copied. Paste it into a text or email. Mahalo for spreading the word.');
  app.render();
}
async function copyLink(b) {
  try { await navigator.clipboard.writeText(shareUrl(b)); yay('Link copied'); }
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
  get tab() { const b = lookup(numFromHash()); return b && S.watch.has(b.id) ? 'bills' : 'find'; },
  tabs: false,
  title: route => { const num = normNum(route.num), b = lookup(num), sp = spaced(num) || 'Bill'; return b && nick(b) ? `${nick(b)} · ${sp}` : sp; },
  render(route) {
    const num = normNum(route.num);
    if (!/^[A-Z]{1,4}\d{1,5}$/.test(num)) return shell(num, missing(num));
    const b = lookup(num);
    if (!drawn(num)) {
      if (S.blLoading.has(num)) return shell(num, loading());
      if (S.blErr.has(num)) return shell(num, failed());
      if (!b && S.blMissing.has(num)) return shell(num, missing(num));
      load(num); return shell(num, loading());
    }
    keepOutcomes(b, hearingsOf(b));
    loadSocial(b);
    return page(num, b);
  },
  // Phones and tablets: the main button in the sticky bottom bar. Wide screens have it in the side panel instead.
  bar(route) {
    if (wide()) return '';
    const b = drawn(normNum(route.num)); if (!b) return '';
    const x = situation(b), main = mainButton(b, x);
    // A newcomer on a shared bill can turn the action down right beside it (R-023).
    return main && firstVisit() && (x.act || x.kind === 'ask') ? `<div class="bl-barnew">${notNow()}${main}</div>` : main;
  },
  wire(route) {
    const root = document.querySelector('.bl-page'); if (!root) return;
    const num = normNum(route.num), b = lookup(num);
    root.querySelector('[data-bl-back]')?.addEventListener('click', goBack);
    root.querySelector('[data-bl-retry]')?.addEventListener('click', () => retry(num));
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
    each('[data-bl-followissue]', el => el.addEventListener('click', async () => {
      const i = S.issueById.get(el.dataset.blFollowissue); if (!i || el.getAttribute('aria-busy') === 'true') return;
      el.setAttribute('aria-busy', 'true');
      if (await setFollows({ issuesOn: [i.id] })) { toast(`Following ${i.name}. Its bills come to you, next session’s too.`, { yay: true, undo: async () => { await setFollows({ issuesOff: [i.id] }); app.render(); } }); }
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
          if (S.watch.has(b.id)) toast(`Saved. You now follow ${spaced(b.bill_number)}.`, { yay: true, undo: () => flipFollow(lookup(num) || b, { quiet: true }) });
        }
      } finally { stanceBusy = false; }
      app.render();
    }));
    root.querySelector('[data-bl-menu]')?.addEventListener('click', e => { e.stopPropagation(); setMenu(document.getElementById('bl-menu').hidden); });
    root.querySelector('[data-bl-copy]')?.addEventListener('click', () => { setMenu(false, true); copyLink(b); });
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
        // A first visit that began on this bill: the first action gets its moment (C-7), then the rest of the visit.
        if (S.blNew.has(b.id) && firstVisit()) {
          logVisit('act', 'next', { path: 'link' });
          moment({ title: 'Mahalo!', sub: `You spoke up on ${nick(b) || spaced(b.bill_number)}.`, small: 'That’s how bills move. Most people never do it.' },
            () => viaStart(b, { viaActed: true }));
          return;
        }
      }
      app.render();
    }));
    each('[data-bl-newlater]', el => el.addEventListener('click', () => { logVisit('arrive', 'skip', { path: 'link' }); viaStart(b, { viaSkipAsk: true }); }));
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
