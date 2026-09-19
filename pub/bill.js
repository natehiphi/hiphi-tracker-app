// The bill page (redesign 9/19): one bill in plain words, and the one thing worth doing about it right now.
// Route {name:'bill', num:'HB1563'}. A full page with its own address, not a sheet: the content is long, shared links
// land here, and phone Back has to work. Order, top to bottom: what the bill does, where it is, what you can do,
// who decides, its hearings, then the official record folded away under "More details".
// The main action lives in the sticky bottom bar (one per state, see situation()); the tab bar is hidden here.
import { S, DEMO, app, esc, icon, toast, yay, blurb, spaced, alive, stopOf, plainStatus, cmteLabel, roomLabel, dueInfo,
  dayWord, timeWord, dateLong, fmtDate, posInfo, issueOf, countOk, openActions, actedOn, didKind, markDone, ensureBill,
  hearingsOf, outcomeOf, OUTCOME_PLAIN, chairContacts, legsOf, legById, legTitle, legPhoto, streamOf, sessionInfo, firstVisit,
  titleCase, reduceMotion, hstDay, CHAMBER_NAME } from './core.js';
import { btn, iconBtn, chip, skeleton } from './ui.js';
import { actionCard, wireActions, nudgeCard, wireNudge, followToggle } from './actions.js';
import { flower } from './art.js';

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

// The chairs of a committee stop, found through the committee roster first. chairContacts matches on the last word of
// the chair's name, which misses two-word surnames (San Buenaventura, Dela Cruz): the email bounced and the photo and
// "Your senator" badge went missing. The roster names the person directly.
function chairsFor(code) {
  return chairContacts(code).map(c => {
    const m = (S.committeeMembers || []).find(x => x.committee === c.code && x.role === 'chair'), l = m && legById(m.legislator_id);
    return l ? { ...c, leg: l, last: (l.sort_name || l.name).split(',')[0].trim(), email: l.email || c.email, phone: l.phone || c.phone } : c;
  });
}

// ---------------- loading ----------------
// A bill opened from a shared link or search is not in the followed set; ensureBill fetches it with its hearings.
S.blLoading ??= new Set(); S.blMissing ??= new Set(); S.blErr ??= new Set(); S.blTried ??= new Set();
const lookup = num => S.bills.find(x => x.bill_number === num) || Object.values(S.extra || {}).find(x => x.bill_number === num) || null;
const ready = b => S.bills.some(x => x.id === b.id) || !!(S.xh || {})[b.id];
function load(num) {
  if (S.blLoading.has(num)) return;
  S.blLoading.add(num); S.blErr.delete(num); S.blTried.add(num);
  ensureBill(num).then(b => { if (!b) S.blMissing.add(num); })
    .catch(e => { console.error(e); S.blErr.add(num); })
    .finally(() => { S.blLoading.delete(num); if (numFromHash() === num) app.render(); });
}
// A bill that is both followed and was opened by link has its hearings twice (S.hearings and S.xh); count each once.
const hearingsFor = b => { const seen = new Set(); return hearingsOf(b).filter(h => !seen.has(h.id) && seen.add(h.id)); };
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
// kind: testify (testimony window open) · late (written deadline passed, hearing still ahead) · ask (waiting for a
// hearing: the chair decides, so ask the chair) · hold (waiting, and HIPHI opposes it: ask the chair not to hear it)
// · stopped · law · share (floor votes, conference, the Governor, or after you have acted).
function situation(b) {
  const st = stopOf(b), hs = hearingsFor(b), pos = posInfo(b), law = b.stage === 'enacted' || st.phase === 'law';
  const stopped = !law && (b.stage === 'dead' || b.stage === 'vetoed' || (!alive(b) && b.stage !== 'governor'));
  const act = !law && !stopped ? openActions([b], hs)[0] || null : null;
  // Who decides next: the committee holding the bill now (the hearing's committee when one is set).
  const code = stopped || law ? null : act ? act.h.committee : st.phase === 'committee' ? (st.hearing?.committee || st.committee) : null;
  const chairs = code ? chairsFor(code) : [];
  const waiting = !stopped && !law && !act && st.phase === 'committee' && st.hearingState === 'none' && !!st.committee && !st.deadline?.missed;
  let kind = 'share';
  if (law) kind = 'law';
  else if (stopped) kind = 'stopped';
  else if (act && !act.late) kind = didKind(b, act.h, 'testimony') ? 'share' : 'testify';
  else if (act) kind = didKind(b, act.h, 'email') || didKind(b, act.h, 'testimony') ? 'share' : 'late';
  else if (waiting && pos && chairs.length && !didKind(b, null, 'email')) kind = /oppose/.test(b.hiphi_position) ? 'hold' : 'ask';
  return { st, hs, pos, law, stopped, act, code, chairs, waiting, kind, k: act ? `${b.id}|${act.h.id}` : '', askKey: `${b.id}|ask` };
}

// A ready-to-send email to one or more chairs. Greeting by surname ("Dear Chair San Buenaventura"), the person's
// name and town from the testimony helper when they have given them, HIPHI's plain summary, and one clear ask.
function mailFor(b, x, chairs, mode) {
  const m = me(), p = posInfo(b), sp = spaced(b.bill_number);
  const dear = chairs.length ? chairs.map(c => `Chair ${c.last}`).join(' and ') : 'Chair';
  const who = m.name ? `My name is ${m.name}${m.town ? ` and I live in ${m.town}` : ''}. ` : '';
  const about = blurb(b, 300).replace(/[.…\s]+$/, '') + '.';
  const ask = b.hiphi_action ? '\n\n' + b.hiphi_action.trim().replace(/([^.!?])$/, '$1.') : '';
  const dl = x.st.deadline && !x.st.deadline.missed ? dateLong(x.st.deadline.date + 'T12:00:00-10:00') : '';
  const h = x.act?.h || x.st.hearing, ahead = h && new Date(h.scheduled_at) > Date.now();
  let subject, body;
  if (mode === 'ask') {
    subject = `${sp}: please give it a hearing`;
    body = `${who}I am writing to ask you to schedule a hearing for ${sp}. ${about}${ask}\n\n${dl ? `It needs a hearing by ${dl} to stay alive this session. ` : ''}Please give it a hearing so the public can weigh in.`;
  } else if (mode === 'hold') {
    subject = `${sp}: please hold this bill`;
    body = `${who}I am writing to oppose ${sp}. ${about}${ask}\n\nPlease do not schedule it for a hearing.`;
  } else if (p) {
    const want = p.verb === 'oppose' ? 'hold' : p.verb === 'comment on' ? 'consider' : 'pass';
    subject = `${sp}: please ${want} it`;
    body = `${who}I am writing to ${p.verb} ${sp}. ${about}${ask}\n\nPlease ${want} this bill${ahead ? ` at the hearing on ${dateLong(h.scheduled_at)}` : ''}.`;
  } else {
    subject = sp;
    body = `${who}I am writing about ${sp}. ${about}\n\n[Say whether you support or oppose it, and why.]`;
  }
  const text = `Dear ${dear},\n\n${body}\n\nMahalo,\n${m.name || '[your name]'}${m.town ? '\n' + m.town : ''}`;
  return `mailto:${chairs.map(c => c.email).filter(Boolean).join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
}
const mailMode = x => x.kind === 'hold' ? 'hold' : x.kind === 'ask' || (x.waiting && x.pos && !/oppose/.test(x.pos.verb)) ? 'ask' : x.waiting && x.pos ? 'hold' : 'about';

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
  else if (st.phase === 'dead') { const d = b.died_at_stage || ''; idx = /^second_crossover|^conference/.test(d) ? 4 : /^second|^first_crossover/.test(d) ? 3 : 1; }
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
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const STEP_WORD = { done: 'done', now: 'now', stop: 'stopped here', next: 'still ahead' };
function railHTML(b, x) {
  const r = railInfo(b, x), at = s => x.law || s < r.idx ? 'done' : s === r.idx ? (x.stopped ? 'stop' : 'now') : 'next';
  const align = r.idx <= 1 ? 'l' : r.idx >= 5 ? 'r' : 'c';
  const dots = r.names.map((n, i) => { const s = at(i);
    return `<li class="bl-${s}"><span class="bl-dot">${s === 'done' ? icon('check') : s === 'stop' ? icon('x') : ''}</span><span class="sr">Step ${i + 1} of 7, ${esc(n)}: ${STEP_WORD[s]}.</span></li>`; }).join('');
  const steps = r.names.map((n, i) => { const s = at(i), tag = { done: 'Done', now: 'Now', stop: 'Stopped here', next: '' }[s];
    return `<li class="bl-s-${s}"><span class="bl-sdot">${s === 'done' ? icon('check') : s === 'stop' ? icon('x') : ''}</span><div><p class="bl-sname">${esc(n)}${tag ? ` <span class="bl-stag">${tag}</span>` : ''}</p><p class="bl-sdesc">${esc(r.desc[i])}</p></div></li>`; }).join('');
  return `<div class="bl-rail${x.stopped ? ' bl-railstop' : x.law ? ' bl-raillaw' : ''}">
      <ol class="bl-dots" aria-label="The 7 steps from bill to law">${dots}</ol>
      <p class="bl-nowlbl bl-at${r.idx} bl-${align}" aria-hidden="true">${r.lead ? `<b>${esc(r.lead)}</b>` : ''}${esc(r.rest)}</p>
    </div>
    <details class="bl-steps"><summary><span>See all steps</span>${icon('chevron-down', { cls: 'bl-chev' })}</summary><ol class="bl-steplist">${steps}</ol></details>`;
}

// ---------------- the page ----------------
function topbar(num, b) {
  const on = !!b && S.watch.has(b.id), sp = spaced(num) || 'Bill';
  const tools = b ? `${iconBtn('star', `Follow ${sp}`, { 'aria-pressed': on ? 'true' : 'false', 'data-bl-star': '1' }, on ? 'on' : '')}
      <div class="bl-menuwrap">${iconBtn('ellipsis', 'More options', { 'aria-expanded': 'false', 'aria-controls': 'bl-menu', 'data-bl-menu': '1' })}
        <div class="bl-menu" id="bl-menu" hidden>
          <button type="button" class="bl-mi" data-bl-copy>${icon('link')}<span>Copy link</span></button>
          <button type="button" class="bl-mi" data-bl-share>${icon('share-2')}<span>Share</span></button>
          <a class="bl-mi" href="${esc(capitolUrl(b))}" target="_blank" rel="noopener" data-bl-close>${icon('landmark')}<span>Capitol bill page</span>${icon('external-link', { cls: 'bl-ext' })}</a>
        </div></div>` : '';
  return `<div class="bl-top"><button type="button" class="btn text bl-back" data-bl-back>${icon('arrow-left')}<span>Back</span></button>
    <p class="bl-num">${esc(sp)}</p><div class="bl-tools">${tools}</div></div>`;
}
function newHere() {
  if (!history.state?.arrived && !firstVisit()) return '';
  return `<div class="bl-new"><p>New here? We help you speak up on Hawaiʻi health bills.</p>${btn('Start', { kind: 'text', sm: true, href: '#/start/1' })}</div>`;
}
// The headline: HIPHI's plain summary; without one, the first sentence of the official description (the whole of it
// sits under More details, so nothing is cut off with "..."). With neither, what the official title is about.
function headline(b) {
  if (b.hiphi_summary) return { text: blurb(b, 200), cut: false };
  const d = String(b.description || '').replace(/\s+/g, ' ').trim();
  if (d) { const m = /^(.{20,220}?[.!?])(\s|$)/.exec(d), first = m ? m[1] : blurb(b, 170); return { text: first, cut: first !== d }; }
  return { text: `A bill about ${titleCase(b.title || 'a Hawaiʻi issue').replace(/^relating to\s+/i, '').replace(/[.\s]+$/, '')}`, cut: false };
}
function head(b, x) {
  const iss = issueOf(b), p = posInfo(b), fol = countOk(b.watchers);
  const chips = [x.law ? chip('Became law', 'ok', 'circle-check') : x.stopped ? chip('Stopped this session', '', 'archive') : '',
    p ? chip(p.text, 'info', p.icon) : b.hiphi_position === 'monitor' ? chip('HIPHI is watching it', '', 'eye') : '',
    iss ? chip(iss.key, '', iss.icon) : ''].filter(Boolean).join('');
  return `<div class="bl-head"><h1>${esc(headline(b).text)}</h1>${chips ? `<div class="chips">${chips}</div>` : ''}${fol ? `<p class="bl-fol">${icon('users')}<span>${fol} people follow this</span></p>` : ''}</div>`;
}
function statusCard(b, x) {
  // core words a joint hearing as "... Committees hears it"; the plural needs "hear".
  const text = plainStatus(b).text.replace(/Committees hears /, 'Committees hear ')
    .replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/, (m, mo, d) => `${MONTHS[+mo - 1] || mo} ${+d}`);   // "3/6/26" -> "March 6"
  const si = sessionInfo(), next = si.nextOpen ? new Date(si.nextOpen + 'T12:00:00-10:00').toLocaleDateString('en-US', { timeZone: 'Pacific/Honolulu', weekday: 'long', month: 'long', day: 'numeric' }) : '';
  const extra = x.law ? 'Mahalo to everyone who spoke up.'
    : x.stopped ? (si.phase === 'in' || !next ? 'Ideas like this often come back next session.' : `Ideas like this often come back. The ${si.nextOpen.slice(0, 4)} session opens ${next}.`) : '';
  return `<section class="card bl-status" aria-labelledby="bl-st-h"><h2 class="sr" id="bl-st-h">Where it is now</h2>
    <p class="bl-say">${x.law ? flower(22) : ''}<span>${esc(text)}${extra ? ` ${esc(extra)}` : ''}</span></p>
    ${b.hiphi_action && !x.act && !x.stopped && !x.law ? `<p class="bl-ask">${icon('megaphone')}<span><b>HIPHI asks:</b> ${esc(b.hiphi_action)}</span></p>` : ''}
    ${railHTML(b, x)}
  </section>`;
}
function actionSection(b, x) {
  if (!x.act) return '';
  const done = actedOn(b, x.act.h);
  const title = done ? 'Mahalo for speaking up' : x.act.late ? 'You can still be heard' : 'Speak up before the hearing';
  const ask = S.nudge === 'action' && done ? nudgeCard('action') : '';
  return `<section class="bl-sec bl-act" aria-labelledby="bl-act-h"><div class="sechead"><h2 id="bl-act-h">${title}</h2></div>
    ${actionCard(b, x.act.h, { heading: 'h3' })}${ask ? `<div class="bl-nudge">${ask}</div>` : ''}</section>`;
}
function whoDecides(b, x) {
  if (!x.code || !x.chairs.length) return '';
  const d = myDistricts(), plural = x.chairs.length > 1, chairIds = new Set(x.chairs.map(c => c.leg?.id).filter(Boolean));
  const others = legsOf(x.code).filter(m => m.role !== 'chair' && !chairIds.has(m.l.id)), joint = x.chairs.length > 1;
  const c1 = plural ? 'chairs' : 'chair', from = `?from=${encodeURIComponent(b.bill_number)}`;
  const intro = x.act ? (didKind(b, x.act.h, 'testimony') ? `Mahalo for your testimony. A short email to the ${c1} adds even more weight.`
      : x.act.late ? `The deadline for written testimony has passed. A short email to the ${c1} is the quickest way to be heard now.`
      : 'The hearing is set. The best thing you can do now is send testimony.')
    : x.st.hearingState === 'held' ? `The committee heard it. The ${c1} will share what happens next.`
    : x.st.hearingState === 'scheduled' ? 'The hearing is set. Anyone in Hawaiʻi can send testimony on the Capitol website.'
    : x.kind === 'hold' || (x.waiting && x.pos && /oppose/.test(x.pos.verb)) ? `The committee ${plural ? 'chairs decide' : 'chair decides'} if this bill gets a hearing. HIPHI opposes it, so a short, polite note asking ${plural ? 'them' : 'the chair'} to hold it helps.`
    : `The committee ${plural ? 'chairs decide' : 'chair decides'} if this bill gets a hearing. A short, polite email helps, most of all from someone in their district.`;
  const hid = x.act?.h.id || x.st.hearing?.id || '';
  const emailBtn = c => x.act ? btn('Email', { kind: 'secondary', sm: true, icon: 'mail', attrs: { 'data-bl-compose': x.k, 'aria-label': `Email ${c.title} ${c.last}` } })
    : btn('Email', { kind: 'secondary', sm: true, icon: 'mail', href: mailFor(b, x, [c], mailMode(x)), attrs: { 'data-bl-mail': hid || '-', 'aria-label': `Email ${c.title} ${c.last}` } });
  const chairs = x.chairs.map(c => { const l = c.leg || { name: c.name }, mine = mineLabel(c.leg, d), name = `${c.title} ${c.leg?.name || c.name}`;
    const who = `${legPhoto(l, 'bl-photo')}<span class="bl-whot"><span class="bl-name">${esc(name)}</span><span class="bl-role">Chair, ${esc(cmteLabel(c.code))}</span>${mine ? `<span class="bl-mine">${chip(mine, 'info', 'user-check')}</span>` : ''}</span>`;
    return `<li class="bl-chair">${c.leg ? `<a class="bl-who" href="#/legislator/${c.leg.id}${from}">${who}${icon('chevron-right', { cls: 'bl-chevr' })}</a>` : `<div class="bl-who">${who}</div>`}
      <div class="btnrow">${emailBtn(c)}${c.phone ? btn('Call', { kind: 'secondary', sm: true, icon: 'phone', href: `tel:${tel(c.phone)}`, attrs: { 'aria-label': `Call ${c.title} ${c.last}` } }) : ''}</div></li>`; }).join('');
  const role = m => `${m.role === 'vice_chair' ? 'Vice chair' : 'Member'}${joint ? `, ${S.committees[m.committee]?.name || ''}` : ''}`;
  const mineOther = others.map(m => mineLabel(m.l, d)).find(Boolean);
  const members = others.length ? `<details class="bl-members"><summary><span>Show all members (${others.length})${mineOther ? ` <span class="bl-inc">· includes ${mineOther.toLowerCase()}</span>` : ''}</span>${icon('chevron-down', { cls: 'bl-chev' })}</summary>
      <ul class="bl-memlist">${others.map(m => { const mine = mineLabel(m.l, d);
        return `<li><a class="bl-mem" href="#/legislator/${m.l.id}${from}">${legPhoto(m.l, 'bl-photo sm')}<span class="bl-whot"><span class="bl-name">${esc(legTitle(m.l))} ${esc(m.l.name)}</span><span class="bl-role">${esc(role(m))}</span>${mine ? `<span class="bl-mine">${chip(mine, 'info', 'user-check')}</span>` : ''}</span>${icon('chevron-right', { cls: 'bl-chevr' })}</a></li>`; }).join('')}</ul></details>` : '';
  const findMe = !d ? `<p class="bl-findme">${btn('Find your own senator and representative', { kind: 'text', sm: true, icon: 'map-pin', href: `#/legislators${from}` })}</p>` : '';
  return `<section class="bl-sec" aria-labelledby="bl-who-h"><div class="sechead"><h2 id="bl-who-h">Who decides next</h2></div>
    <div class="card bl-whocard"><p class="bl-intro">${esc(intro)}</p><ul class="bl-chairs">${chairs}</ul>${members}</div>${findMe}</section>`;
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
    !past && !off && posInfo(b) && alive(b) && due && !due.late ? btn('Write testimony', { kind: 'text', sm: true, icon: 'notebook-pen', attrs: { 'data-helper': h.id, 'data-bill': b.id } }) : '',
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
  const up = hs.filter(h => new Date(h.scheduled_at) > now), past = hs.filter(h => new Date(h.scheduled_at) <= now).reverse();
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
  const comp = (b.companions || []).flatMap(c => String(c).split(/[,\s]+/)).map(normNum).filter(c => /^[A-Z]+\d+$/.test(c) && c !== b.bill_number);
  const path = pathHTML(b, x), spons = sponsorText(b);
  const rows = [
    b.title ? ['Official title', esc(titleCase(b.title))] : null,
    b.description && (b.hiphi_summary || headline(b).cut) ? ['Official summary', esc(b.description)] : null,
    path ? ['Committees', path] : null,
    spons ? ['Introduced by', esc(spons)] : null,
    b.last_action ? ['Last official action', `${esc(b.last_action)}${b.last_action_date ? `<span class="bl-date">${esc(fmtDate(b.last_action_date, { month: 'short', day: 'numeric', year: 'numeric' }))}</span>` : ''}`] : null,
    comp.length ? [`Companion bill${comp.length > 1 ? 's' : ''}`, `${comp.map(c => `<a href="#/bill/${esc(c)}">${esc(spaced(c))}</a>`).join(', ')}<span class="bl-date">The same idea, filed in the ${N[/^S/.test(comp[0]) ? 'S' : 'H']} too. Either one can become law.</span>`] : null,
    b.current_version ? ['Version', esc(versionText(b.current_version))] : null,
  ].filter(Boolean);
  return `<details class="bl-more"><summary><span>More details</span>${icon('chevron-down', { cls: 'bl-chev' })}</summary>
    <dl>${rows.map(([k, v]) => `<div class="bl-kv"><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
    <p class="bl-cap">${btn('Capitol bill page', { kind: 'text', sm: true, icon: 'landmark', iconEnd: 'external-link', href: capitolUrl(b), attrs: { target: '_blank', rel: 'noopener' } })}</p></details>`;
}
function page(num, b) {
  const x = situation(b);
  return `<div class="bl-page">${topbar(num, b)}${newHere()}${head(b, x)}
    ${b.sandbox_untracked ? `<div class="notice info bl-note">${icon('info')}<div>This bill is not on HIPHI’s list, so the sandbox has only its number and title. The live tracker shows every bill in full.</div></div>` : ''}
    ${statusCard(b, x)}${actionSection(b, x)}${whoDecides(b, x)}${hearingsSection(b, x)}${details(b, x)}</div>`;
}
const shell = (num, inner) => `<div class="bl-page">${topbar(num, null)}${inner}</div>`;
const missing = num => `<div class="empty bl-empty">${icon('search', { size: 40 })}<h1>We couldn’t find ${esc(spaced(num) || 'that bill')}</h1><p>Check the number, or search for the bill by a word like vaping.</p>${btn('Search bills', { kind: 'primary', icon: 'search', href: `#/find?q=${encodeURIComponent(num)}` })}</div>`;
const failed = () => `<div class="empty bl-empty">${icon('circle-alert', { size: 40 })}<h1>We couldn’t load this bill</h1><p>Check your connection and try again.</p>${btn('Try again', { kind: 'primary', icon: 'rotate-ccw', attrs: { 'data-bl-retry': '1' } })}</div>`;

// ---------------- actions ----------------
function scrollToEl(el) {
  if (!el) return;
  const off = (document.querySelector('.hdr')?.offsetHeight || 56) + (document.querySelector('.bl-top')?.offsetHeight || 0) + 12;
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - off, behavior: reduceMotion() ? 'auto' : 'smooth' });
}
function openComposer(k) {
  S.compose = k; app.render();
  setTimeout(() => scrollToEl(document.getElementById('cmp-' + k.split('|')[1])), 30);
}
// Share counts as an action once the phone's share sheet finishes, or the text is copied (Nate, 9/18: every action counts).
async function shareBill(b, x) {
  const sp = spaced(b.bill_number), url = shareUrl(b), h = x.act?.h || null;
  const text = x.law ? `Good news: ${sp} is now law in Hawaiʻi. ${blurb(b, 110)}`
    : h ? `${sp}: ${blurb(b, 110)} Hearing ${dayWord(h.scheduled_at)}. You can add your voice in 5 minutes.`
    : `${sp}: ${blurb(b, 110)} Follow it on HIPHI’s Bill Tracker.`;
  let ok = false, copied = false;
  const copy = async () => { await navigator.clipboard.writeText(`${text} ${url}`); ok = copied = true; };
  try { if (navigator.share) { await navigator.share({ title: sp, text, url }); ok = true; } else await copy(); }
  catch (e) { if (e?.name !== 'AbortError') { try { await copy(); } catch { toast('Sharing is not available here. Use Copy link in the menu at the top.'); } } }
  if (!ok) return;
  if (!didKind(b, h, 'share')) await markDone(b.id, h?.id || '', 'share', true, { quiet: copied });
  if (copied) yay('Copied. Paste it into a text or email. Mahalo for spreading the word.');
  app.render();
}
async function copyLink(b) {
  try { await navigator.clipboard.writeText(shareUrl(b)); yay('Link copied'); }
  catch { toast('We could not copy the link. Try Share instead.'); }
}
// The overflow menu is a small popover. It opens and closes without a re-render so focus stays put; Escape and a tap
// outside close it. These listeners are added once for the life of the page.
function setMenu(open, focusToggle) {
  const menu = document.getElementById('bl-menu'), tog = document.querySelector('[data-bl-menu]'); if (!menu || !tog) return;
  menu.hidden = !open; tog.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) menu.querySelector('button, a')?.focus(); else if (focusToggle) tog.focus();
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('bl-menu')?.hidden === false) { e.preventDefault(); setMenu(false, true); } });
document.addEventListener('click', e => { const m = document.getElementById('bl-menu'); if (m && !m.hidden && !e.target.closest('.bl-menuwrap')) setMenu(false); });

// ---------------- the screen ----------------
export default {
  // No tab bar here (the page has its own bars); on wide screens the header nav marks where bills live.
  get tab() { const b = lookup(numFromHash()); return b && S.watch.has(b.id) ? 'bills' : 'find'; },
  tabs: false,
  title: route => spaced(normNum(route.num)) || 'Bill',
  render(route) {
    const num = normNum(route.num);
    if (!/^[A-Z]{1,4}\d{1,5}$/.test(num)) return shell(num, missing(num));
    const b = lookup(num);
    if (!b || (!ready(b) && !S.blTried.has(num))) {
      if (S.blErr.has(num)) return shell(num, failed());
      if (!b && S.blMissing.has(num)) return shell(num, missing(num));
      load(num); return shell(num, `<div class="bl-skel">${skeleton(4)}</div>`);
    }
    keepOutcomes(b, hearingsFor(b));
    return page(num, b);
  },
  bar(route) {
    const b = lookup(normNum(route.num)); if (!b || !ready(b)) return '';
    const x = situation(b);
    // After the mail app opened: one question, so a sent email counts.
    if (S.sentq?.[x.askKey]) return `<div class="bl-barq" role="group" aria-label="Did you send your email?"><p class="bl-barq-t">Did you send your email?</p>
      ${btn('Yes, I sent it', { kind: 'primary', sm: true, attrs: { 'data-bl-sent': 'yes' } })}${btn('Not yet', { kind: 'text', sm: true, attrs: { 'data-bl-sent': 'no' } })}</div>`;
    const iss = issueOf(b), coal = iss && (S.coalitions || []).find(c => iss.names.includes(c.name) && c.slug);
    switch (x.kind) {
      case 'testify': return btn('Write my testimony · 5 min', { kind: 'primary', icon: 'notebook-pen', full: true, attrs: { 'data-bl-go': 'testify' } });
      case 'late': return btn('Email the chair · 2 min', { kind: 'primary', icon: 'mail', full: true, attrs: { 'data-bl-go': 'compose' } });
      case 'ask': return btn(x.chairs.length > 1 ? 'Ask the chairs for a hearing' : 'Ask the chair for a hearing', { kind: 'primary', icon: 'mail', full: true, href: mailFor(b, x, x.chairs, 'ask'), attrs: { 'data-bl-mail': '-' } });
      case 'hold': return btn('Email the chair · 2 min', { kind: 'primary', icon: 'mail', full: true, href: mailFor(b, x, x.chairs, 'hold'), attrs: { 'data-bl-mail': '-' } });
      case 'law': return btn('Share the good news', { kind: 'primary', icon: 'share-2', full: true, attrs: { 'data-bl-go': 'share' } });
      case 'stopped': {
        // Between sessions nothing is moving: the useful step is getting ready for January.
        const off = sessionInfo().phase !== 'in';
        if (off && !myDistricts()) return btn('Find your legislators', { kind: 'primary', icon: 'map-pin', full: true, href: `#/legislators?from=${encodeURIComponent(b.bill_number)}` });
        if (!coal) return btn(off ? 'Find bills' : 'Find bills still moving', { kind: 'primary', icon: 'search', full: true, href: '#/find' });
        return btn(`${off ? 'See' : 'See live'} bills on ${esc(iss.key.split(',')[0])}`, { kind: 'primary', icon: iss.icon, full: true, href: `#/find/issue/${encodeURIComponent(coal.slug)}`, cls: 'bl-barbtn' });
      }
      default: return btn('Share this bill', { kind: 'primary', icon: 'share-2', full: true, attrs: { 'data-bl-go': 'share' } });
    }
  },
  wire(route) {
    const root = document.querySelector('.bl-page'); if (!root) return;
    const num = normNum(route.num), b = lookup(num);
    root.querySelector('[data-bl-back]')?.addEventListener('click', goBack);
    root.querySelector('[data-bl-retry]')?.addEventListener('click', () => { S.blErr.delete(num); S.blTried.delete(num); app.render(); });
    if (!b || !root.querySelector('.bl-head')) return;
    stampRoot();
    const x = situation(b), bar = document.querySelector('.actionbar');
    wireActions(root); wireNudge(root);
    // Follow star. Unfollowing drops the bill from the followed set; keep it (and its hearings and reports) on this
    // page so nothing jumps. Following brings its hearings with the followed set, so the copy loaded by link goes.
    root.querySelector('[data-bl-star]')?.addEventListener('click', async e => {
      const was = S.watch.has(b.id), keep = x.hs.map(h => S.outcomes[h.id]).filter(Boolean);
      e.currentTarget.setAttribute('aria-busy', 'true');
      if (was) { S.extra[b.id] = b; if (!S.xh[b.id]) S.xh[b.id] = x.hs; }
      await followToggle(b.id, spaced(b.bill_number));
      if (was) keep.forEach(o => { if (!S.outcomes[o.hearing_id]) S.outcomes[o.hearing_id] = o; });
      else if (S.bills.some(y => y.id === b.id)) delete S.xh[b.id];
      app.render();
    });
    root.querySelector('[data-bl-menu]')?.addEventListener('click', e => { e.stopPropagation(); setMenu(document.getElementById('bl-menu').hidden); });
    root.querySelector('[data-bl-copy]')?.addEventListener('click', () => { setMenu(false, true); copyLink(b); });
    root.querySelector('[data-bl-share]')?.addEventListener('click', () => { setMenu(false, true); shareBill(b, x); });
    root.querySelector('[data-bl-close]')?.addEventListener('click', () => setMenu(false));
    root.querySelectorAll('[data-bl-compose]').forEach(el => el.addEventListener('click', () => openComposer(el.dataset.blCompose)));
    // A mailto opens the mail app and leaves this page as it was; a moment later, ask whether it went.
    const mailed = el => el.addEventListener('click', () => setTimeout(() => { S.sentq[x.askKey] = el.dataset.blMail; app.render(); }, 800));
    root.querySelectorAll('[data-bl-mail]').forEach(mailed);
    if (!bar) return;
    bar.querySelectorAll('[data-bl-mail]').forEach(mailed);
    bar.querySelector('[data-bl-go="testify"]')?.addEventListener('click', () => app.openHelper(b.id, x.act.h.id));
    bar.querySelector('[data-bl-go="compose"]')?.addEventListener('click', () => openComposer(x.k));
    bar.querySelector('[data-bl-go="share"]')?.addEventListener('click', () => shareBill(b, x));
    bar.querySelectorAll('[data-bl-sent]').forEach(el => el.addEventListener('click', async () => {
      const hid = S.sentq[x.askKey]; delete S.sentq[x.askKey];
      if (el.dataset.blSent === 'yes') await markDone(b.id, hid && hid !== '-' ? hid : '', 'email');
      app.render();
    }));
  },
};
