// Your lawmakers and one lawmaker's page in the calm redesign (R-303, behind ?rec=1; people-committees.md is the spec).
// pub/people.js draws these when REC() is on and today's pages otherwise; the finder's search, suggestions, address lookup,
// the email composer and the remembered districts ('hiphi_districts', read by the bill page, More, Home and the asks) are
// people.js's own and unchanged, so this file only lays them out:
//   not known yet: "Who represents you?", one sentence, one field, the privacy line, and one quiet link to the directory;
//   known: their two lawmakers as quiet rows, then ONE card with the one thing to do (a followed bill in, or next going to,
//   a committee their lawmaker sits on, or a floor vote; else the hello), then "Change address" and "Saved on this device";
//   a lawmaker: who they are in one line, ONE card, "On your issues", then three closed cards (their committees, every
//   HIPHI bill in them, office and contact: the phone said once).
// Street addresses never reach a web address and are never kept (people.js): only the districts and the town are.
import { S, app, esc, icon, spaced, nick, billPath, filedBy, legById, legTitle, legPhoto, posInfo, cmteLabel, codesOf, stopOf, alive, agrees, didKind, hearingWhen, CHAMBER_NAME, sessionInfo, HST } from '../core.js';
import { btn, chip, notice } from '../ui.js';
import { recHead, recBack, recSec, recRows, recMore, recFold, recFolds, recWay, recEmpty, wireKit, BOX } from './kit.js';
import { recAct, dueOf, byDue, billRow, billWords, pillFor, daysLeft, backRow, atWords } from './act.js';
import { slotsOf, slotLine } from '../committees.js';
import { P, seated, saved, savedPick, forget, remember, mine, yoursWord, legHref, billNum, fromBill, numOnly, rolesOf, billAt, billsIn, composer,
  searchHTML, findingHTML, browseHTML, cover, surname, townOf, PARTY, ISLAND_NAME, islandOf, bySeat, roleWord, finderPage } from '../people.js';

const who = l => `${legTitle(l)} ${surname(l)}`;
const full = l => `${legTitle(l)} ${l.name}`;
const short = code => cmteLabel(code, { short: true });
// ---------------- where a followed bill meets a lawmaker ----------------
// In (or heard soon by) a committee they sit on, next in one, or the floor vote of their chamber (people.js billAt reads the
// referral path). t: how pressing (the hearing, else the deadline it races); chairs first on a tie.
const ROLE_N = { chair: 0, vice_chair: 1, member: 2 };
function meetOf(l, b, roles = rolesOf(l)) {
  if (!alive(b)) return null;
  const at = billAt(b, roles), st = stopOf(b);
  if (at) {
    // In their committee now: its hearing there, else the cut-off it races. Coming to them next: after every bill that is
    // in their hands now or before their chamber (a month's weight), since nothing is theirs to decide yet.
    const due = dueOf(b, at.when === 'now' ? at.r.committee : '');
    return { l, b, r: at.r, when: at.when, h: at.when === 'now' ? due.h || null : null, due, t: due.t + (at.when === 'next' ? 30 * 864e5 : 0) };
  }
  if (st.phase === 'floor' && st.chamber === l.chamber) { const due = dueOf(b); return { l, b, when: 'floor', h: null, due, t: due.t }; }
  return null;
}
const followed = () => (S.bills || []).filter(b => S.watch?.has(b.id) && alive(b));
// The most pressing followed bill for these lawmakers: one HIPHI takes a side on, that the person does not see otherwise
// (agrees false), and that they have not emailed about yet.
function bestFor(legs) {
  const all = [];
  for (const l of legs) { const roles = rolesOf(l); for (const b of followed()) {
    if (!posInfo(b) || agrees(b) === false || didKind(b, null, 'email')) continue;
    const m = meetOf(l, b, roles); if (m) all.push(m);
  } }
  return all.sort((x, y) => x.t - y.t || (ROLE_N[x.r?.role] ?? 3) - (ROLE_N[y.r?.role] ?? 3) || x.b.bill_number.localeCompare(y.b.bill_number, 'en', { numeric: true }))[0] || null;
}

// ---------------- the card ----------------
const roleIt = r => r.role === 'chair' ? 'chairs it' : r.role === 'vice_chair' ? 'is its vice chair' : 'sits on it';
const roleOf = r => r.role === 'chair' ? 'chairs' : r.role === 'vice_chair' ? 'is vice chair of' : 'sits on';
const verbOf = b => { const v = posInfo(b)?.verb; return v === 'support' || v === 'oppose' ? v : ''; };
// x: meetOf(), or { l, b, when: 'about' } for a bill they came from that is in none of this lawmaker's committees.
function billCard(x, { own, ways = '' } = {}) {
  // The heading names the bill by its everyday name; the sentence says its number, once (C-10, A-14; the fresh-eyes review).
  const { l, b } = x, k = 'a' + l.id, open = P.mail === k, v = verbOf(b), W = who(l), num = spaced(b.bill_number), name = nick(b) || num;
  const why = x.when === 'floor' ? `${num} goes to the full ${CHAMBER_NAME[l.chamber]} for a vote, and ${W} has a vote.`
    : x.when === 'now' && x.h ? `${W} ${roleOf(x.r)} the ${cmteLabel(x.r.committee)}, which hears ${num} ${atWords(x.h.scheduled_at)}.`
    : x.when === 'now' ? `${num} waits for a hearing in the ${cmteLabel(x.r.committee)}, and ${W} ${roleIt(x.r)}.`
    : x.when === 'next' ? `${num} goes next to the ${cmteLabel(x.r.committee)}, and ${W} ${roleIt(x.r)}.`
    : own ? `Lawmakers listen most to the people they represent, so a note from you about ${num} counts.` : `A short note tells ${W} that people care about ${num}.`;
  // The card's moment is the lawmaker's: their committee's hearing, the cut-off for one there, or their chamber's vote;
  // nothing for a bill only coming to them next (its dates belong to another committee). A testimony deadline belongs to the
  // testimony row, so the email never reads as due then (the fresh-eyes review, A-13).
  const due = x.due || dueOf(b), dl = x.h && due.kind === 'testify' ? due.h.testimony_deadline : '';
  const when = x.h ? `Hearing ${hearingWhen(x.h.scheduled_at)}` : x.when === 'next' ? '' : due.kind === 'needs' || due.kind === 'floor' ? due.text : '';
  const at = x.h?.scheduled_at || '', left = at ? pillFor(at) : when ? daysLeft(due.t) : '';
  // With testimony open, the walkthrough is the one more way (A-20), unless the card already offers the other lawmaker.
  const more = ways || (dl && !open ? recWay('notebook-pen', 'Help me write testimony', `Due ${hearingWhen(dl)} · your own words to the committee, about 15 minutes`, { href: billPath(b) + '/testify' }) : '');
  return recAct({ id: 'pp-act-h', when, left, warn: at ? Date.parse(at) - Date.now() < 864e5 : due.warn,
    title: v ? `Ask ${W} to ${v} ${name}` : `Write to ${W} about ${name}`, text: why,
    button: mailBtn(l, k, open), more: open ? '' : 'About 2 minutes', after: open ? composer(l, b, k, own ? townOf(saved()) : '') : '', ways: more });
}
// The hello: to their own lawmakers on the finder (two), or to the one on their page.
function helloCard(legs, { own } = {}) {
  const l = legs[0], k = 'a' + l.id, open = P.mail === k, other = legs[1];
  const title = legs.length > 1 ? 'Say aloha to your lawmakers' : own ? `Say aloha to ${who(l)}` : `Write to ${who(l)}`;
  const text = own ? 'A short, friendly note from someone in their district gets read. Tell them which health issues matter to you.'
    : 'A short, friendly note gets read. Tell them which health issues matter to you.';
  const ok = other?.email ? (P.mail === 'a' + other.id ? composer(other, null, 'a' + other.id, townOf(saved())) : '') : '';
  const ways = other?.email && !open && P.mail !== 'a' + other.id ? recWay('mail', `Email ${who(other)} too`, yoursWord(other), { 'data-pp-mail': 'a' + other.id, 'aria-expanded': 'false', 'aria-controls': 'pp-cmp-a' + other.id }) : '';
  return recAct({ id: 'pp-act-h', title, text, button: l.email ? mailBtn(l, k, open) : '', more: open ? '' : 'About 2 minutes',
    after: (open ? composer(l, null, k, own ? townOf(saved()) : '') : '') + ok, ways });
}
// The one filled button; while its email is open it steps back to "Hide email", so the mail app's button is the one filled.
const mailBtn = (l, k, open) => l.email ? btn(open ? 'Hide email' : `Email ${esc(who(l))}`, { kind: open ? 'secondary' : 'primary', icon: open ? 'x' : 'mail', full: true,
  attrs: { 'data-pp-mail': k, 'aria-expanded': open ? 'true' : 'false', 'aria-controls': 'pp-cmp-' + k } }) : '';

// ---------------- your lawmakers ----------------
const personRow = (l, from, text) => ({ name: full(l), text, href: legHref(l.id, from), leadHtml: legPhoto(l, 'pp-photo sm') });
const dirLink = () => `<p class="pp-rdir"><button type="button" class="rc-link" data-pp-dir aria-expanded="${P.dir}" aria-controls="pp-dir">${icon(P.dir ? 'chevron-up' : 'book-open')}<span>${P.dir ? 'Hide the list of lawmakers' : 'Look up any lawmaker or committee'}</span></button></p>`;
const dirHTML = (from, pick) => P.dir ? `<div class="pp-dir" id="pp-dir">${recRows([{ name: 'Committees', text: 'Who decides which bills get a hearing', href: '#/committees', lead: 'landmark' }])}
  ${browseHTML(from, pick, { title: 'Every lawmaker' })}</div>` : '<div id="pp-dir" hidden></div>';

export function recFinder(route) {
  if (!seated().length) return finderPage(route);
  const from = billNum(route), b = fromBill(from), sv = saved();
  const pick = P.pick || (!P.changing && sv ? savedPick(sv) : null);
  const back = from ? backRow('#/bill/' + from, spaced(numOnly(from)), true) : backRow('#/more');
  const ask = recHead({ title: 'Who represents you?', lede: 'One senator and one representative speak for your home in the Legislature. Find yours.' });
  if (P.finding) return `<div class="pp rc pp-rec">${back}${ask}${findingHTML()}</div>`;
  if (!pick) return `<div class="pp rc pp-rec">${back}${ask}${searchHTML(sv, { label: 'Your street address, town, district or a lawmaker’s name' })}${dirLink()}${dirHTML(from, null)}</div>`;
  const legs = pick.ids.map(legById).filter(l => l && seated().includes(l));
  const sen = legs.filter(l => l.chamber === 'S').sort(bySeat), rep = legs.filter(l => l.chamber === 'H').sort(bySeat);
  if (sen.length !== 1 || rep.length !== 1) return `<div class="pp rc pp-rec">${back}${ask}${splitHTML(pick, sen, rep, from)}${dirLink()}${dirHTML(from, pick)}</div>`;
  const two = [sen[0], rep[0]], own = true;
  // The card: the bill they came from (with the lawmaker it meets, else the one in the chamber that has it), else the most
  // pressing followed bill either of them can move, else the hello.
  let card;
  if (b && alive(b)) {
    const m = two.map(l => meetOf(l, b)).filter(Boolean).sort((x, y) => x.t - y.t)[0];
    const st = stopOf(b), l = m?.l || two.find(x => x.chamber === st.chamber) || two[0], other = two.find(x => x !== l);
    const okOther = other.email && P.mail !== 'a' + l.id && P.mail !== 'a' + other.id;
    card = billCard(m || { l, b, when: 'about' }, { own, ways: okOther ? recWay('mail', `Email ${who(other)} too`, yoursWord(other), { 'data-pp-mail': 'a' + other.id, 'aria-expanded': 'false', 'aria-controls': 'pp-cmp-a' + other.id }) : '' })
      + (P.mail === 'a' + other.id ? `<div class="rc-card pp-rcmp">${composer(other, b, 'a' + other.id, townOf(sv))}</div>` : '');
  } else { const m = bestFor(two); card = m ? billCard(m, { own }) : helloCard(two, { own }); }
  // Only the districts and the town are kept, never the street (the field said "It is not saved" of the address).
  const saveLine = P.remember && sv ? `Your districts are saved on this device · <button type="button" class="rc-tlink" data-pp-forget>Forget</button>`
    : `Your districts are not saved · <button type="button" class="rc-tlink" data-pp-save>Save them on this device</button>`;
  const place = pick.display || pick.label || sv?.label || '';
  // On a laptop the card sits at the side, as on a lawmaker's page and the bill page (rc-cols; the fresh-eyes review).
  return `<div class="pp rc rc-wide pp-rec pp-rknown">${back}<div class="rc-cols"><div class="pp-rmain">${recHead({ title: 'Your lawmakers' })}
    <h2 class="sr" id="pp-for" tabindex="-1">Your senator and representative${place ? ` for ${esc(place)}` : ''}</h2>
    ${recRows(two.map(l => personRow(l, from, `${yoursWord(l)} · District ${l.district}`)), 'pp-rppl ' + BOX)}</div>
    <aside class="rc-side pp-ract" aria-label="Take part">${card}</aside>
    <div class="pp-rmain pp-rmain2"><div class="pp-rfoot"><p>${place ? `${icon('map-pin')}<span>${esc(place)}</span> · ` : ''}<button type="button" class="rc-tlink" data-pp-change>Change address</button></p>
      <p><span>${saveLine}</span></p></div>
    ${dirLink()}${dirHTML(from, pick)}</div></div></div>`;
}
// A town split between districts, or one that names only some: say so, offer the street address, and show who it could be.
function splitHTML(pick, sen, rep, from) {
  const split = [sen, rep].some(x => x.length > 1), none = [sen, rep].filter(x => !x.length).map(x => x === sen ? 'senator' : 'representative');
  const why = split ? `${pick.label} is split between districts, so it depends on your street.` : `The town alone doesn’t tell us your ${none.join(' or ')}. Your street address will.`;
  const group = (list, ch) => {
    const isl = !list.length && pick.island ? seated().filter(l => l.chamber === ch && islandOf(l) === pick.island).sort(bySeat) : [];
    const ls = list.length ? list : isl.length <= 4 ? isl : [];
    if (!ls.length) return '';
    const head = `${ch === 'S' ? 'Senators' : 'Representatives'} for ${list.length ? pick.label : ISLAND_NAME[pick.island]}`;
    return recSec('pp-sp-' + ch, ls.length === 1 ? (ch === 'S' ? 'Senator' : 'Representative') + ` for ${pick.label}` : head,
      recRows(ls.map(l => personRow(l, from, `District ${l.district}${l.places ? ' · ' + cover(l) : ''}`))));
  };
  return `<section class="pp-rsplit" aria-labelledby="pp-for"><div class="pp-for">${icon(pick.kind === 'place' ? 'house' : 'map-pin')}<h2 id="pp-for" tabindex="-1">${esc(pick.display || pick.label)}</h2>
      ${btn('Change', { kind: 'text', sm: true, icon: 'pencil', attrs: { 'data-pp-change': '' } })}</div>
    <p class="pp-rwhy">${esc(why)}</p>${btn('Use your street address', { kind: 'primary', icon: 'map-pin', full: true, attrs: { 'data-pp-street': '' } })}
    ${group(sen, 'S')}${group(rep, 'H')}</section>`;
}

// ---------------- one lawmaker ----------------
// "Senate District 14 · Kapālama, ʻĀlewa and nearby": the first places, and "nearby" for the rest (all of them in Office).
function districtLine(l) {
  const ps = cover(l).split(/,\s*/).filter(Boolean), list = ps.length <= 3 ? ps : [...ps.slice(0, 2), 'nearby'];
  const words = list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
  return `${CHAMBER_NAME[l.chamber]} District ${l.district}${words ? ' · ' + words : ''}`;
}
const andList = xs => xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
// Why a page is quiet, said once under the name in the old page's words (people.js personPage, R-212 #25): between sessions
// their committees have no bills yet; the Speaker and the Senate President sit on none; someone else has none listed. The
// day the session opens is said as Home says it ("Wednesday, January 20"); people.js keeps its own copy unexported.
const opensWord = () => { const n = sessionInfo().nextOpen; return n ? new Date(n + 'T12:00:00-10:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: HST }) : ''; };
function quietLine(l, roles) {
  const si = sessionInfo(), W = who(l), quiet = (ic, t) => `<p class="pp-rquiet">${icon(ic)}<span>${esc(t)}</span></p>`;
  if (si.phase !== 'in') { const opens = opensWord();
    return quiet('calendar-days', `The Legislature is on break${opens ? ` until ${opens}` : ''}. ${roles.length ? `These are their ${si.recapYear} committees. New ones are set when the session opens.` : 'Committees are set when the session opens.'}`); }
  if (roles.length) return '';
  const t = l.title || '';
  return quiet('info', /speaker/i.test(t) && !/vice/i.test(t) ? `As Speaker, ${W} leads the House and does not sit on its committees.`
    : /president/i.test(t) && !/vice/i.test(t) ? `As Senate President, ${W} leads the Senate and does not sit on its committees.` : `No committees are listed for ${W} this year.`);
}
// No email listed: no "Write to" card without a button (19 Oct, Sen. Kidani). Their phone when there is one, else the old
// page's line and the Capitol link it pointed to (people.js pp-nocontact).
function reachCard(l) {
  const W = who(l);
  if (l.phone) return recAct({ id: 'pp-act-h', title: `Call ${W}`, text: `No email address is listed for ${W} yet. Their office at the Capitol takes calls.`,
    button: btn(`Call ${l.phone}`, { kind: 'primary', icon: 'phone', full: true, href: `tel:${l.phone.replace(/[^\d+]/g, '')}`, attrs: { 'aria-label': `Call ${W} at ${l.phone}` } }) });
  return recAct({ id: 'pp-act-h', title: `Get in touch with ${W}`, text: 'No email or phone is listed yet.',
    button: l.capitol_url ? btn('Find their phone on the Capitol site', { kind: 'secondary', icon: 'external-link', full: true, cls: 'pp-rreach', href: l.capitol_url, attrs: { target: '_blank', rel: 'noopener' } }) : '' });
}

export function recPerson(route) {
  const l = legById(route.id), from = billNum(route), b = fromBill(from);
  // Opened from a committee's "Email the chair" (R-212 #42), the email is about the bill (?from=) but back goes to the committee.
  const viaCmt = /^#\/committee\//.test(history.state?.prev || '');
  const back = from ? backRow('#/bill/' + from, spaced(numOnly(from)), !viaCmt) : backRow('#/legislators');
  if (!l) return `<div class="pp rc pp-rec">${back}${recHead({ title: 'We couldn’t find that lawmaker' })}${recEmpty('The link may be old. Every senator and representative is on Your lawmakers.', btn('Your lawmakers', { kind: 'secondary', href: '#/legislators' }))}</div>`;
  const sv = saved(), own = mine(l, sv), roles = rolesOf(l), k = 'a' + l.id;
  // The card: the bill they came from, else the most pressing followed bill in their committees, else the hello.
  const m = b ? meetOf(l, b, roles) || { l, b, when: 'about' } : bestFor([l]);
  const card = !l.email ? reachCard(l) : m ? billCard(m, { own }) : helloCard([l], { own });
  // On your issues: the followed bills in their committees or before their chamber, the card's own bill left out (A-14).
  // The ones they chair first, then in their hands now by what is due, then what comes to them next; four, and the rest in
  // place (B-14). A bill in a committee they chair comes first, in both lists (Nate 18 Oct, card 18: whether these are only the
  // committees they chair or every one they sit on is "a big distinction"; the chair decides which bills get a hearing). Every
  // committee they sit on counts (people.js billsIn). Here a row says "They chair its committee": the fresh-eyes review found
  // "They chair it" beside a bill's name read as chairing the bill.
  const chaired = x => x.r?.role === 'chair', tag = x => chaired(x) ? 'They chair its committee' : '';
  const mine2 = followed().filter(x => x.id !== m?.b?.id).map(x => meetOf(l, x, roles)).filter(Boolean).sort((x, y) => chaired(y) - chaired(x) || x.t - y.t || byDue(x, y));
  const yours = mine2.length ? recSec('pp-yi', 'On your issues', recMore(mine2.map(x => billRow(x.b, x.due, { href: billPath(x.b), tag: tag(x),
    note: x.when === 'next' ? `Comes to ${short(x.r.committee)} next` : x.when === 'floor' ? x.due.text : '' })), 4, 'pp-yi', BOX)) : '';
  // Their committees, every HIPHI bill in them, office and contact: closed, a one-line preview each, remembered open (B-6).
  const cm = roles.length ? recFold('pp-cmtes', 'Their committees', `${roleWord(roles[0].role)} of ${short(roles[0].committee)}${roles.length > 1 ? `, and ${roles.length - 1} more` : ''}`,
    `<p class="rc-note pp-rnote">Committees look at bills before the full ${CHAMBER_NAME[l.chamber]} votes. The chair decides which bills get a hearing.</p>`
    + recRows(roles.map(r => ({ name: short(r.committee), text: [roleWord(r.role), slotsOf(r.committee).length ? `Meets ${slotLine(slotsOf(r.committee))}` : ''].filter(Boolean).join(' · '), href: `#/committee/${r.committee}`, lead: r.role === 'member' ? 'users' : 'landmark' })))) : '';
  const allB = billsIn(roles).map(x => ({ ...x, due: dueOf(x.b) })).sort((x, y) => chaired(y) - chaired(x) || (x.when === 'now' ? 0 : 1) - (y.when === 'now' ? 0 : 1) || byDue(x, y));
  // Every HIPHI bill in their committees: one quiet label over each committee they chair ("Education, which they chair"), then
  // "Their other committees", so the distinction is said once a group and names the committee (A-14; on Sen. Kim's page every
  // row said "They chair it"). No labels when they chair none.
  const allRow = x => billRow(x.b, x.due, { href: billPath(x.b), note: x.when === 'next' ? `Comes to ${short(x.r.committee)} next` : '' });
  const led = [...new Set(allB.filter(chaired).map(x => x.r.committee))];
  const groups = led.length ? [...led.map(c => [`${short(c)}, which they chair`, allB.filter(x => chaired(x) && x.r.committee === c)]),
    ['Their other committees', allB.filter(x => !chaired(x))]].filter(([, xs]) => xs.length) : [['', allB]];
  const pv = allB.find(x => x.b.id !== m?.b?.id) || allB[0];   // the preview names a bill the card does not (A-14)
  const bills = allB.length ? recFold('pp-allbills', 'All HIPHI bills in their committees', billWords(pv.b) + (allB.length > 1 ? ', and more' : ''),
    `<p class="rc-note pp-rnote">Bills in every committee they sit on.</p>`
    + groups.map(([h, xs], n) => `${h ? `<p class="pp-rgh">${esc(h)}</p>` : ''}${recMore(xs.map(allRow), groups.length > 1 ? 6 : 8, `pp-allbills-${n}`)}`).join('')) : '';
  // The phone is said once on the page, inside this card (A-14; the old page said it twice), so the preview only names it.
  const office = recFold('pp-office', 'Office and contact', andList([l.room ? `Room ${l.room} at the Capitol` : 'Their Capitol office', l.phone && l.email ? 'their phone' : '', l.capitol_url && (l.email || l.phone) ? 'their Capitol page' : ''].filter(Boolean)),
    `${l.phone && l.email ? recWay('phone', `Call ${l.phone}`, 'Their office at the Capitol', { href: `tel:${l.phone.replace(/[^\d+]/g, '')}`, 'aria-label': `Call ${who(l)} at ${l.phone}` }) : ''}
     ${l.capitol_url && (l.email || l.phone) ? recWay('external-link', 'Their page on the Capitol website', 'Bills they introduced and their votes', { href: l.capitol_url, target: '_blank', rel: 'noopener' }) : ''}
     <p class="pp-roffice">${icon('landmark')}<span>${l.room ? `Room ${esc(l.room)}, ` : ''}Hawaiʻi State Capitol, 415 S Beretania St, Honolulu${l.email ? `<br>${esc(l.email)}` : ''}</span></p>
     ${l.places ? `<p class="pp-roffice">${icon('map')}<span>${PARTY[l.party] ? esc(PARTY[l.party]) + '. ' : ''}${CHAMBER_NAME[l.chamber]} District ${l.district} covers ${esc(cover(l))}.</span></p>` : ''}`);
  const filed = filedCard(l);
  const head = `<header class="rc-head pp-rhead">${legPhoto(l, 'pp-photo xl')}<div class="pp-rhtext">${own ? `<span class="pp-ryours">${chip(yoursWord(l), 'info', 'user-check')}</span>` : ''}
    <h1 class="rc-h1">${esc(full(l))}</h1><p class="pp-rdist">${esc(districtLine(l))}</p></div></header>${quietLine(l, roles)}`;
  const rest = `${yours}${recFolds([cm, bills, filed, office])}`;
  return `<div class="pp rc rc-wide pp-rec pp-rperson">${back}<div class="rc-cols"><div class="pp-rmain">${head}</div>
    <aside class="rc-side pp-ract" aria-label="Take part">${card}</aside><div class="pp-rmain pp-rmain2">${rest}</div></div></div>`;
}

// "Bills they filed" (R-212 #41, the District Watcher: "no list of bills a legislator filed"): the bills with their name first,
// HIPHI's first, then HIPHI's bills they signed on to, and how many more carry their name. Closed like the cards beside it (B-6);
// asked of the public view once a visit (core.js filedBy), the page drawn again when it answers.
const nBills = (n, w = 'bill') => `${n.toLocaleString('en-US')} ${w}${n === 1 ? '' : 's'}`;
function filedCard(l) {
  const f = S.filed?.[l.id];
  if (f === undefined) filedBy(l).then(() => { if (new RegExp(`^#/legislator/${l.id}(\\?|$)`).test(location.hash)) app.render(); });
  if (!f || f === 'loading') return recFold('pp-filed', 'Bills they introduced', 'Looking them up…', `<p class="rc-note pp-rnote">Looking up the bills they introduced…</p>`);
  if (f === 'error') return recFold('pp-filed', 'Bills they introduced', 'Could not load just now',
    `<p class="rc-note pp-rnote">The list could not load just now. Try again in a minute${l.capitol_url ? ', or see them on the Capitol website' : ''}.</p>`
    + (l.capitol_url ? recWay('external-link', 'Their page on the Capitol website', 'Bills they introduced and their votes', { href: l.capitol_url, target: '_blank', rel: 'noopener' }) : ''));
  const { lead, also, alsoN, year } = f, ours = lead.filter(b => posInfo(b)).length;
  const row = b => billRow(b, dueOf(b), { href: billPath(b) });
  if (!lead.length && !alsoN) return recFold('pp-filed', 'Bills they introduced', `None in ${year}`, `<p class="rc-note pp-rnote">No bills carry their name in ${year} yet.</p>`);
  const prev = lead.length ? `Introduced ${nBills(lead.length)}${ours ? `, ${ours} of them HIPHI’s` : ''}` : `Signed ${nBills(alsoN)} another lawmaker introduced`;
  const others = alsoN - also.length;
  return recFold('pp-filed', 'Bills they introduced', prev,
    (lead.length ? `${ours && ours < lead.length ? `<p class="rc-note pp-rnote">In ${year}, HIPHI’s first.</p>` : ''}${recMore(lead.map(row), 6, 'pp-filed')}` : '')
    + (also.length ? `<p class="pp-rgh pp-rgh2">HIPHI bills they also signed</p>${recMore(also.map(row), 4, 'pp-filed-also')}` : '')
    + (others > 0 ? `<p class="rc-note pp-rnote pp-rfiled">They also signed ${also.length ? `${others.toLocaleString('en-US')} more ${others === 1 ? 'bill' : 'bills'}` : nBills(others)} that another lawmaker introduced.</p>` : ''));
}

// ---------------- wiring (people.js wire() does the field, the suggestions and the email) ----------------
export function wireRec() {
  const root = document.querySelector('.pp-rec'); if (!root) return;
  wireKit(root);
  root.querySelectorAll('[data-pp-dir]').forEach(el => el.onclick = () => { P.dir = !P.dir; app.render();
    requestAnimationFrame(() => { document.querySelector('[data-pp-dir]')?.focus({ preventScroll: true }); if (P.dir) document.getElementById('pp-dir')?.scrollIntoView({ block: 'nearest' }); }); });
  root.querySelectorAll('[data-pp-forget]').forEach(el => el.onclick = () => { const sv = saved(); if (!P.pick && sv) P.pick = savedPick(sv); P.remember = false; forget(); app.render();
    requestAnimationFrame(() => document.querySelector('[data-pp-save]')?.focus()); });
  root.querySelectorAll('[data-pp-save]').forEach(el => el.onclick = () => { P.remember = true; if (P.pick) remember(P.pick); app.render();
    requestAnimationFrame(() => document.querySelector('[data-pp-forget]')?.focus()); });
}
