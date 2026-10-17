// A person comes here to see the one thing to do next and where each of their issues stands (B-1).
// The calm Home (R-222 Direction 1, "one thing, then your issues"; Nate 10/10: "accept all"). Since 11 Oct it is everyone's
// Home: the layout test's first version, 'calm', and its fallback (Nate 10/11: "This becomes the default home, while the
// other home screens become other testable home pages"; backend 169). Today's bill page and tabs stay (app.js). One shape
// for every moment, phone first:
//   1. The greeting: their name and one line, the one result worth saying or that nothing is new. Between sessions: the
//      break, what HIPHI backed that became law, and one link to their session.
//   2. The slide (R-295, Nate 10/17, version A "The slide"): the soonest thing to do, drawn like an onboarding screen and
//      not as a card: the issue's drawing, a heading that says the goal, one sentence, one detail line, the time it takes,
//      one full-width button in the page and "More ways to help" as text. "Show the next one" brings up the next in place;
//      a row below with something to do this week brings that one up (decision 5a). The hearing ask when that is sooner;
//      late testimony when nothing is due on time (R-250); a plan to go on its day. Right after sending, "Mahalo" and the
//      flower, then the next slide or "That's all for this week". Nothing to do: the Capitol, "Nothing needs you this
//      week" and no filled button. Between sessions, the one thing to do then, as a slide. Home reads at onboarding's
//      type size (R-174's step, pub/base.css; C-14).
//   3. Your issues: one row each, the issue's name, one phrase for where it stands and its next date, soonest first. Amber
//      only inside 24 hours (A-5). "New" when it changed since the last visit (Nate's answer 2: the one thing, then where
//      the issues stand, with what changed as a word on the row). Over 8 issues: grouped by where they stand, the first 8,
//      then "Show all N" (GROUPS below; Nate 10/11). A bill followed on its own gets a row of its own (R-250).
//   4. At most two quiet lines: their session, and the profile ask (home.js profileLine).
// The budget it keeps (A-23, tests/home_calm.py): at most four blocks of at most two shapes, one filled button, each bill
// named once, under two phone screens for 3 issues and three for 16. What left Home and where it went: the review
// (backend docs/requests/R-222-assessment.md, section 6).
// Still today's Home: Your session (#/recap) and following nothing. The first visit's ending is the calm Home too (R-248,
// Nate 10/11: "Yes, queue it"): on the page load that finished it the greeting says "Mahalo, <name>!" with the row of what
// they did today and the petals once (R-098's celebration, home.js finDid and finFx); a reload says Aloha. It used to hand
// the whole tab to today's Home, so every new person's first Home was the old one, its wins card included.
import { S, app, esc, icon, toast, nick, headline, billPath, alive, openActions, dayWord, timeWord, dateLong, hstDay, hiT, HST,
  followedIssues, issueBills, outcomeOf, didKind, sessionInfo, followsAnything, wiz, settledOn, plainStatus, testimonyDraft,
  followSummary, winsIn, ensureRecapPool, isResolution, nudge, catOf, issueOf, DEMO, issuesOf, codesOf, agrees, asSentence, chairContacts } from '../core.js';
import { btn, chip, skeleton } from '../ui.js';
import { actionCard, wireActions, wireNudge, goingPlans, goingCard } from '../actions.js';
import { celebrate, bloom, swap, reduced } from '../fx.js';
import { CAPITOL, issueBand, flower } from '../art.js';
import { GOAL } from './goals.js';
import today, { calmParts as P, wireExtras } from '../home.js';

S.aSkip ??= new Set();   // things passed over with "Show the next one", for this visit
S.cmPick ??= null;       // the thing a row brought up onto the slide (decision 5a), for this visit
const plural = (k, one, many = one + 's') => `${k} ${k === 1 ? one : many}`;
const nameOf = b => nick(b) || headline(b, 70);
const time = iso => timeWord(iso);   // as the card writes it ("1:00 PM"), so a row and the card read the same
// "today", "tomorrow", "Wed" within the week; "Mar 30" further out, where a weekday alone would be ambiguous.
function dayShort(iso) {
  const d = dayWord(iso);
  if (/^today/.test(d)) return 'today';
  if (/^tomorrow/.test(d)) return 'tomorrow';
  return Date.parse(iso) - Date.now() < 6 * 864e5 ? new Date(iso).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short' })
    : new Date(iso).toLocaleDateString('en-US', { timeZone: HST, month: 'short', day: 'numeric' });
}
const when = iso => `${dayShort(iso)} ${time(iso)}`;
const prevVisit = () => S.prevVisit ? Date.parse(S.prevVisit) : 0;
const isNew = t => { const p = prevVisit(); return !!p && !!t && t > p && t <= Date.now(); };
const skipKey = x => x.h.id + '|' + x.b.id;
const byDeadline = (x, y) => x.h.testimony_deadline.localeCompare(y.h.testimony_deadline);

// ---------------- what there is to do ----------------
// Every testimony deadline still open in the next 7 days, soonest first, twins as one (home.js twinCards, R-131).
function dueAll() {
  const week = Date.now() + 7 * 864e5;
  return P.twinCards(openActions(S.bills, S.hearings).filter(x => !x.late && !settledOn(x.b, x.h) && x.h.testimony_deadline
    && Date.parse(x.h.testimony_deadline) < week).sort(byDeadline));
}
// Late testimony (R-250, Nate 10/11): a hearing still ahead whose written deadline has passed still takes testimony, marked
// late. Today's Home led with it ("Send late testimony"); the calm Home first left it out, so on a hearing day a follower read
// "Nothing needs you this week" (the C1 assessment's C1-1 again). Soonest hearing first. Not twinned: twinCards keeps one map
// for the page, and companions heard late on the same day are rare.
function lateAll() {
  return openActions(S.bills, S.hearings).filter(x => x.late && !settledOn(x.b, x.h)).sort((x, y) => x.h.scheduled_at.localeCompare(y.h.scheduled_at));
}

// ---------------- 2. the slide ----------------
// The issue a bill is followed through (the row below names it), else its first issue.
const issueFor = b => followedIssues().find(i => issueBills(i).includes(b.id)) || issuesOf(b)[0] || null;
// The heading says the goal (decision 4, goals.js). Someone who sees it differently from HIPHI, an issue with no line yet
// and a bill on no issue get the name instead, so the heading never speaks for them.
const goalOf = b => { const i = issueFor(b); return (agrees(b) !== false && i && GOAL[i.slug]) || (i ? i.name : nameOf(b)); };
// A drawing on every slide (decision 3): the issue's own, else its topic's scene (art.js issueBand), else the Capitol.
const artOf = b => `<div class="cm-art">${(b && issueBand(issueFor(b), DEMO)) || CAPITOL}</div>`;
const NUM = ['', 'One', 'Two', 'Three', 'Four', 'Five'];
const CH = { S: 'Senate', H: 'House' };
function whoHears(code) {
  const cs = codesOf(code), ch = CH[S.committees?.[cs[0]]?.chamber] || '';
  return cs.length > 1 ? `${NUM[cs.length] || cs.length} ${ch ? ch + ' ' : ''}committees` : `The ${ch ? ch + ' ' : ''}committee`;
}
// "today", "tomorrow", "Friday" within the week, "on Mar 30" further out.
function dayLong(iso) {
  const d = dayShort(iso);
  if (d === 'today' || d === 'tomorrow') return d;
  return Date.parse(iso) - Date.now() < 6 * 864e5 ? new Date(iso).toLocaleDateString('en-US', { timeZone: HST, weekday: 'long' }) : 'on ' + d;
}
// "Send it by Wed 9:30 AM", "Send it by 1:00 PM today" (the words table, section 6).
const byWhen = iso => { const d = dayShort(iso); return d === 'today' ? `${time(iso)} today` : `${d} ${time(iso)}`; };
// The card's own pieces (actions.js actionCard): its main button, its done line and its More ways to help are written once,
// there, and the slide takes them from the card's HTML rather than a second copy (one write surface). What the slide says
// itself (the goal, the sentence, the detail line) it leaves out.
const SAID = '.acband, .acrow, .achead, .acwhat, p.meta, p.ask, p.why, p.due, p.proof, p.note, .suggestbar';
function cardParts(html) {
  const t = document.createElement('template'); t.innerHTML = html;
  const a = t.content.querySelector('.acard'), col = a.querySelector('.btncol');
  col.querySelector('[data-moreways]')?.remove();
  const before = [], after = []; let past = false;
  for (const el of a.children) { if (el === col) { past = true; continue; } if (!el.matches(SAID)) (past ? after : before).push(el.outerHTML); }
  return { go: col.innerHTML.trim(), before: before.join(''), after: after.join('') };
}
const timeLine = t => `<p class="cm-time">${icon('clock')}<span>${t}</span></p>`;
// One slide. h: the heading's level (h1, or h2 under the first visit's "Mahalo"). art: the drawing. say: the sentence.
// when: the detail line. go: the button(s). more: the text links under them.
const slideHtml = ({ hl, id, art, title, say, when: w = '', warn = false, mins = '', before = '', go = '', more = '', after = '', label }) =>
  `<section class="cm-slide" aria-labelledby="${id}"${label ? ` aria-label="${esc(label)}"` : ''}>${art}
    <div class="cm-words"><${hl} class="cm-goal" id="${id}" tabindex="-1">${esc(title)}</${hl}>
    ${say ? `<p class="cm-say">${say}</p>` : ''}
    ${w ? `<p class="cm-when${warn ? ' warn' : ''}">${w}</p>` : ''}
    ${mins ? timeLine(mins) : ''}${before}
    ${go ? `<div class="cm-go">${go}</div>` : ''}
    ${more ? `<p class="cm-more">${more}</p>` : ''}${after}</div></section>`;
const nextLink = (key, name) => btn('Show the next one', { kind: 'text', sm: true, iconEnd: 'arrow-right', attrs: { 'data-cm-skip': key, 'data-cm-name': name } });

function dueSlide(c, hl) {
  const k = c.card, x = k.items[0], b = x.b, h = x.h, late = k.kind === 'late', ck = `${b.id}|${h.id}`;
  // Right after a first action from a shared link, nothing is singled out: a bigger ask straight after the one just done
  // backfires (R-150's research; R-190 kept it on today's Home).
  const focus = !(c.welcome && !c.fin);
  const p = cardParts(actionCard(b, h, { focus, why: c.why, twin: S.hmTwins?.get(b.id) || null, heading: 'h2' }));
  const differs = agrees(b) === false, opp = b.position === 'oppose', open = S.moreOpen.has(ck);
  const hears = `${whoHears(h.committee)} ${codesOf(h.committee).length > 1 ? 'hear' : 'hears'} it ${dayLong(h.scheduled_at)}${late ? ` at ${time(h.scheduled_at)}` : ''}.`;
  const why = c.why ? asSentence(c.why).replace(/([^.!?])$/, '$1.') + ' ' : '';
  const ask = late ? 'Late testimony is still taken, marked late.'
    : differs ? 'You see this one differently from HIPHI, and you can still tell them what you think.'
    : b.hiphi_action ? esc(b.hiphi_action) : `A short note from you can help ${opp ? 'stop it' : 'it pass'}.`;
  const dl = late ? h.scheduled_at : h.testimony_deadline, warn = Date.parse(dl) - Date.now() < 864e5;
  const w = `<b>${late ? `Late testimony until ${esc(byWhen(dl))}` : `Send it by ${esc(byWhen(dl))}`}</b> · ${esc(spaced(b))}`;
  const writes = /data-helper|data-mailwalk/.test(p.go);
  const more = [btn(open ? 'Fewer ways to help' : 'More ways to help', { kind: 'text', sm: true, iconEnd: open ? 'chevron-up' : 'chevron-down', attrs: { 'data-moreways': ck, 'aria-expanded': open ? 'true' : 'false', 'aria-controls': 'mw-' + h.id } }),
    k.items.length > 1 || k.picked ? nextLink(skipKey(x), nameOf(b)) : ''].join('');
  return slideHtml({ hl, id: 't-' + h.id, art: artOf(b), title: goalOf(b), say: `${why}${esc(hears)} ${ask}`, when: w, warn, mins: writes ? 'About 2 minutes' : '',
    before: p.before, go: p.go, more, after: p.after });
}
// The hearing ask (home.js askCard's facts, as a slide): a bill waiting for a hearing before its committee's cut-off.
function askSlide(c, hl) {
  const { b, st } = c.card.ask, dl = st.deadline, n = codesOf(st.committee).length, chairs = chairContacts(st.committee).length > 1 ? 'chairs' : 'chair';
  const cs = whoHears(st.committee).replace(/^The /, n > 1 ? '' : 'A ');
  const say = `${cs} ${n > 1 ? 'haven’t' : 'hasn’t'} heard it yet. When people ask, the ${chairs} can give it one.`;
  const at = hiT(dl.date) + 12 * 36e5, warn = at - Date.now() < 864e5;
  return slideHtml({ hl, id: 'cm-ask-' + b.id, art: artOf(b), title: goalOf(b), say: esc(say), warn,
    when: `<b>Needs a hearing by ${esc(dateLong(dl.date + 'T12:00:00-10:00'))}</b> · ${esc(spaced(b))}`, mins: 'About 2 minutes',
    go: btn(`Ask the ${chairs} for a hearing`, { kind: 'primary', icon: 'mail', full: true, href: billPath(b), attrs: { 'data-hm-ask': b.bill_number, 'data-hm-act': '1' } }),
    more: c.card.picked || c.n > 1 ? nextLink('ask|' + b.id, nameOf(b)) : '' });
}
// Nothing to do: the page is allowed to just be calm (no filled button), and "we" keep watch (gap 6).
function quietSlide(c, hl) {
  const k = c.card, nIss = followedIssues().length;
  if (k.kind === 'seen') return slideHtml({ hl, id: 'cm-quiet', art: artOf(null), title: 'You’ve seen everything due this week',
    say: 'It’s all still on your list below.', more: btn(`Show the ${k.n === 1 ? 'one' : k.n} you skipped`, { kind: 'text', sm: true, attrs: { 'data-cm-unskip': '1' } }) });
  if (c.thanks) return slideHtml({ hl, id: 'cm-quiet', art: artOf(null), title: 'That’s all for this week', say: 'We’ll keep watch. When your next issue has a hearing, it will be right here.' });
  return slideHtml({ hl, id: 'cm-quiet', art: artOf(null), title: 'Nothing needs you this week',
    say: `We’re watching your ${nIss ? plural(nIss, 'issue') : c.noun} every day. When one has a hearing, a simple way to help shows up here.` });
}
function theSlide(c) {
  const hl = c.welcome ? 'h2' : 'h1', k = c.card.kind;
  if (k === 'due' || k === 'late') return dueSlide(c, hl);
  if (k === 'ask') return askSlide(c, hl);
  if (k === 'go') return `<section class="cm-card" aria-label="Your plan">${goingCard(c.card.plans)}</section>`;
  return quietSlide(c, hl);
}
// "Mahalo" right after they sent something from the slide (the mockup's "Right after sending"): the flower opens once
// (today's small burst, A-10; orange stays the colour of a real step done, C-7), then the next slide.
function thanksHtml(t, name) {
  const words = didKind(t.b, t.h, 'testimony') ? `Your testimony is in. The committee reads it before it votes ${dayLong(t.h.scheduled_at)}.`
    : didKind(t.b, t.h, 'email') ? 'Your email to the chair is sent. Mahalo for speaking up.' : 'Mahalo for speaking up.';
  const pic = t.fresh ? bloom() : flower(40); t.fresh = false;
  return `<div class="cm-thanks" role="status">${pic}<p><b>${name ? `Mahalo, ${esc(name)}!` : 'Mahalo!'}</b><span>${esc(words)}</span></p></div>`;
}
// The slide, in order: the one they picked from the list (decision 5a); testimony due (unless the soonest hearing ask runs
// out first); when nothing is due on time, late testimony (unless the hearing ask runs out before its hearing; R-250); the
// hearing ask; everything due passed over; a plan to go today or tomorrow. A hearing ask runs out at the end of its cut-off
// day. What was passed over or picked lasts this visit only, so a "not now" is never kept as a "no".
function pickCard(due, late, asks, plans) {
  const items = due.filter(x => !S.aSkip.has(skipKey(x))), ask = asks.find(x => !S.aSkip.has('ask|' + x.b.id)), pk = S.cmPick;
  if (pk) {
    const i = items.findIndex(x => skipKey(x) === pk);
    if (i >= 0) { items.unshift(...items.splice(i, 1)); return { kind: 'due', items, bill: items[0].b, picked: true }; }
    const lt = late.filter(x => !S.aSkip.has(skipKey(x))), j = lt.findIndex(x => skipKey(x) === pk);
    if (j >= 0) { lt.unshift(...lt.splice(j, 1)); return { kind: 'late', items: lt, bill: lt[0].b, picked: true }; }
    const a = asks.find(x => 'ask|' + x.b.id === pk);
    if (a) return { kind: 'ask', ask: a, bill: a.b, picked: true };
    S.cmPick = null;
  }
  const askFirst = ask && (!items.length || hiT(ask.st.deadline.date) < Date.parse(items[0].h.testimony_deadline));
  if (items.length && !askFirst) return { kind: 'due', items, bill: items[0].b };
  const lt = due.length ? [] : late.filter(x => !S.aSkip.has(skipKey(x)));
  if (lt.length && !(ask && hiT(ask.st.deadline.date) < Date.parse(lt[0].h.scheduled_at))) return { kind: 'late', items: lt, bill: lt[0].b };
  if (ask) return { kind: 'ask', ask, bill: ask.b };
  if (due.length || late.length) return { kind: 'seen', n: due.length || late.length };
  const soon = plans.filter(p => p.soon);
  if (soon.length) return { kind: 'go', plans: soon, bill: soon[0].b };
  return { kind: '' };
}

// ---------------- 3. your issues ----------------
// Bills followed on their own (R-250, Nate 10/11): an issue page's "Follow these 3", a stance, a list, or a bill on no issue
// at all. They had no row, so apart from the one card nothing about them was on Home, and an "Ask the chair" on one was
// nowhere. One row each, after the issues' rules (the same phrases, the same order); the card's own bill has none, since the
// card names it (A-14), and "Show the next one" brings its row back.
// A bill row names the bill once: its nickname (or its whole summary, not cut at 70) as the heading, its number in the status
// line, since a bill followed on its own was often followed by its number (C-10; the fresh-eyes review of R-250).
const spaced = b => (b.bill_number || '').replace(/^([A-Z]+)(\d+)$/, '$1 $2');
const looseBills = () => S.bills.filter(b => S.direct?.has(b.id) && !S.viaIssues?.has(b.id) && S.watch?.has(b.id));
// One phrase for where an issue stands, from the first of these that is true of any of its bills: testimony open; a
// hearing ahead (with what they did about it); a cut-off for a hearing; a decision in the last two weeks, or one coming;
// became law; where its furthest bill is; did not advance. t: the date that orders the rows (soonest first). g: the group
// the row goes under (GROUPS), when the list is long.
const RESULT = { passed: 'Passed a committee', passed_amended: 'Passed a committee with changes', deferred: 'Put on hold', recommitted: 'Sent back for more work' };
// ids: the issue's bills, or one bill followed on its own (R-250), which gets the same phrases.
function stateOf(ids, c) {
  const bs = S.bills.filter(b => ids.has(b.id)), has = b => ids.has(b.id), now = Date.now();
  // A letter they started, for a hearing still ahead, is said on its issue's row unless the card is that hearing (whose
  // button then says "Finish sending your testimony"), so a saved letter is never left unmentioned (R-189).
  const dr = c.open.find(x => has(x.b) && testimonyDraft(x.h) && Date.parse(x.h.scheduled_at) > now && x.h.id !== c.card.items?.[0]?.h.id);
  if (dr) { const dl = dr.h.testimony_deadline && Date.parse(dr.h.testimony_deadline) > now ? dr.h.testimony_deadline : '', t = Date.parse(dl || dr.h.scheduled_at);
    return { g: t - now < 7 * 864e5 ? 'due' : 'hearing', t, warn: !!dl && t - now < 864e5, text: `Your letter is started · ${dl ? `due ${when(dl)}` : `hearing ${when(dr.h.scheduled_at)}`}` }; }
  const ds = c.due.filter(x => has(x.b)), d = ds[0];
  // A second bill due this week on the same issue is said on the row, so nothing to do is left off the page (B-14).
  if (d) { const t = Date.parse(d.h.testimony_deadline), more = ds.length > 1 ? `, and ${ds.length - 1} more this week` : '';
    return { g: 'due', t, warn: t - now < 864e5, pick: skipKey(d), fresh: ds.some(x => isNew(Date.parse(x.h.notice_posted_at || 0))), text: `${testimonyDraft(d.h) ? 'Your letter is started · due' : 'Testimony due'} ${when(d.h.testimony_deadline)}${more}` }; }
  // Late testimony is still something to do, so its row says so rather than only "Hearing today" (R-250, B-14).
  const lt = c.late.find(x => has(x.b));
  if (lt) { const t = Date.parse(lt.h.scheduled_at); return { g: 'due', t, warn: t - now < 864e5, pick: skipKey(lt), text: `Late testimony until ${when(lt.h.scheduled_at)}` }; }
  const h = S.hearings.filter(x => ids.has(x.bill_id) && x.status !== 'cancelled' && Date.parse(x.scheduled_at) > now && alive(S.bills.find(b => b.id === x.bill_id) || {}))
    .sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at))[0];
  if (h) { const b = bs.find(x => x.id === h.bill_id), plan = c.plans.some(p => p.h.id === h.id);
    const did = didKind(b, h, 'testimony') ? 'You testified' : didKind(b, h, 'email') ? 'You emailed the chair' : plan ? 'You plan to go' : '';
    return { g: 'hearing', t: Date.parse(h.scheduled_at), fresh: isNew(Date.parse(h.notice_posted_at || 0)), text: `${did ? `${did} · hearing` : 'Hearing'} ${when(h.scheduled_at)}` }; }
  const a = c.asksAll.find(x => has(x.b));
  if (a) { const t = hiT(a.st.deadline.date) + 12 * 36e5;   // the end of the cut-off day
    return { g: 'needs', t, warn: t - now < 864e5, pick: 'ask|' + a.b.id, text: `Needs a hearing by ${dateLong(a.st.deadline.date + 'T12:00:00-10:00')}` }; }
  // The latest decision in the last 14 days, or a hearing in the last 3 days still waiting for one.
  const past = S.hearings.filter(x => ids.has(x.bill_id) && x.status !== 'cancelled' && Date.parse(x.scheduled_at) <= now && Date.parse(x.scheduled_at) > now - 14 * 864e5)
    .sort((x, y) => y.scheduled_at.localeCompare(x.scheduled_at));
  for (const x of past) {
    const o = outcomeOf(x), at = o && Date.parse(o.reported_at || x.scheduled_at);
    if (o?.outcome && RESULT[o.outcome]) return { g: /^passed/.test(o.outcome) ? 'passed' : 'waiting', rank: 1, fresh: isNew(at), text: `${RESULT[o.outcome]} ${dayShort(new Date(at).toISOString())}` };
    if (!o?.outcome && Date.parse(x.scheduled_at) > now - 3 * 864e5) return { g: 'waiting', rank: 1, text: `Heard ${dayShort(x.scheduled_at)} · decision coming` };
  }
  const law = bs.find(b => b.stage === 'enacted' || b.stage === 'governor');
  if (law) return { g: 'law', rank: 2, fresh: isNew(hiT(law.last_action_date || '1970-01-01')), text: plainStatus(law).short };
  const live = bs.filter(alive);
  if (live.length) return { g: 'waiting', rank: 3, text: plainStatus(live[0]).short };
  return { g: bs.length ? 'dead' : 'waiting', rank: 4, text: bs.length ? 'Did not advance this year' : 'No bills on it yet' };
}
// The issue on the slide says so in its row, so nothing is said twice (A-14); a row with something to do this week brings it
// up onto the slide (decision 5a, data-cm-pick), and a row with nothing to do opens the issue's page as before.
const rowHtml = r => `<li><a class="cm-row${r.on ? ' on' : ''}" href="${esc(r.href)}"${r.pick && !r.on ? ` data-cm-pick="${esc(r.pick)}"` : ''}><span class="cm-rtext"><span class="cm-rname">${esc(r.name)}${r.fresh ? ' <span class="cm-new">New<span class="sr"> since your last visit</span></span>' : ''}</span>
    <span class="cm-rstat${r.warn ? ' warn' : ''}">${esc(r.text)}</span></span>${icon('chevron-right', { cls: 'cm-chev' })}</a></li>`;
// A long list (Nate 10/11, for a follower of dozens like Leilani: "Option number 2, but still grouped by status"): the
// issues ranked by importance, which is the group order below, then the soonest date, then HIPHI's own order of issues;
// under a heading per group; the first FOLD show and "Show all N" opens the rest in place, still grouped. Up to FOLD rows
// there are no headings: each row already says where it stands, and three headings over three rows is the clutter R-222
// took away. Something to do is folded away only when more than FOLD issues have something due (B-14).
const GROUPS = [['due', 'Due this week'], ['hearing', 'Hearing coming up'], ['needs', 'Needs a hearing'], ['passed', 'Passed recently'],
  ['waiting', 'Waiting'], ['law', 'Became law'], ['dead', 'Did not advance']];
const GORDER = Object.fromEntries(GROUPS.map(([k], n) => [k, n]));
const FOLD = 8;
export const byImportance = (x, y) => (GORDER[x.g] ?? 9) - (GORDER[y.g] ?? 9) || (x.t ?? Infinity) - (y.t ?? Infinity) || (x.rank ?? 0) - (y.rank ?? 0)
  || (x.i?.sort_order ?? 99) - (y.i?.sort_order ?? 99) || x.name.localeCompare(y.name);
function groupedRows(rows) {
  const out = [];
  rows.forEach((r, n) => { const last = out[out.length - 1]; if (last && last.k === r.g) last.rows.push([r, n]); else out.push({ k: r.g, rows: [[r, n]] }); });
  const label = Object.fromEntries(GROUPS);
  return out.map(({ k, rows: rs }) => { const shut = rs.every(([, n]) => n >= FOLD);
    return `<div class="cm-group"${shut ? ' data-cm-more hidden' : ''}><h3 class="cm-gh">${esc(label[k] || 'Waiting')} <span class="muted">${rs.length}</span></h3>
      <ul class="cm-rows" role="list">${rs.map(([r, n]) => n >= FOLD && !shut ? rowHtml(r).replace('<li>', '<li data-cm-more hidden>') : rowHtml(r)).join('')}</ul></div>`; }).join('');
}
// The fold never hides a deadline without saying so (B-14; the fresh-eyes review, 10/11): the button counts what is due behind it.
const dueAfter = rows => { const k = rows.slice(FOLD).filter(r => r.g === 'due').length; return k ? ` · ${k} more due this week` : ''; };
// Bills followed on their own have rows too (R-250), so the heading and the fold name what the list holds.
function issuesBlock(rows, n) {
  if (!rows.length) return '';
  const long = rows.length > FOLD && rows.every(r => r.g), nIss = rows.filter(r => !r.b).length, nB = rows.length - nIss;
  const head = nB && nIss ? 'Your issues and bills' : nB ? 'Your bills' : 'Your issues', noun = nB && nIss ? '' : nB ? ' bills' : ' issues';
  return `<section class="cm-issues" aria-labelledby="cm-iss-h"><h2 id="cm-iss-h" class="cm-h">${head}</h2>
    ${long ? `${groupedRows(rows)}${btn(`Show all ${rows.length}${noun}${dueAfter(rows)}`, { kind: 'text', icon: 'chevron-down', cls: 'hm-link cm-showall', attrs: { 'data-cm-showall': '' } })}`
      : `<ul class="cm-rows" role="list">${rows.map(rowHtml).join('')}</ul>`}
    ${btn(n > rows.length ? `See all ${n} in My issues` : nIss ? 'See the bills on my issues' : 'See them in My issues', { kind: 'text', iconEnd: 'chevron-right', href: '#/bills', cls: 'hm-link cm-all' })}</section>`;
}

// ---------------- 1. the greeting ----------------
function sinceWhen() {
  const d = new Date(prevVisit()), days = Math.round((hiT(hstDay(Date.now())) - hiT(hstDay(d))) / 864e5);
  return days <= 1 ? 'yesterday' : days < 7 ? d.toLocaleDateString('en-US', { timeZone: HST, weekday: 'long' }) : 'your last visit';
}
// Their own good news first (a law they spoke up for, a committee's yes after they acted), then the newest result on their
// issues, then what is new. A result about the slide's own bill goes on the slide as its sentence's start, so the bill is
// named once (A-14). c.moments: the good news said here, seen once in wire(). '' when there is no result.
function resultLine(c) {
  const gn = P.goodNews();
  const onCard = gn.find(x => c.card.bill && x.b.id === c.card.bill.id);
  if (onCard) { c.why = P.momentText(onCard); c.moments.push(onCard); }
  const g = gn.find(x => x !== onCard);
  if (g) { c.moments.push(g); return `<b>${esc(nameOf(g.b))}:</b> ${esc(P.momentText(g))}`; }
  const rs = (P.sinceItems() || []).filter(x => x.lead !== 'calendar' && !(c.card.bill && x.b.id === c.card.bill.id));
  if (rs.length) { const x = rs[0], first = x.text.replace(/^([^.]*\.).*$/, '$1');
    return `<b>${esc(nameOf(x.b))}:</b> ${esc(first)}${rs.length > 1 ? ` ${esc(plural(rs.length - 1, 'more result'))} on your ${c.noun} below.` : ''}`; }
  // New hearings are not results: the rows mark them New, and the greeting counts them rather than saying "nothing new".
  if (c.freshN) return `News on ${c.freshN === 1 ? `one of your ${c.noun}` : `${c.freshN} of your ${c.noun}`} since ${esc(sinceWhen())}.`;
  return '';
}
// The count is said once, here ("10 things you can do this week"), not as "1 of 4" on the slide: a big count on the slide
// reads like homework (C-7), the opposite of "this is easy" (decision 1, section 7; it replaces R-222's answer 4).
// After a result the greeting is already two sentences, so "Here's the soonest." goes (the slide shows it anyway).
function countLine(c, res) {
  if (!['due', 'late', 'ask'].includes(c.card.kind)) return '';
  return c.n === 1 ? 'One thing this week.' : `${c.n} things you can do this week.${c.card.picked || res ? '' : ' Here’s the soonest.'}`;
}
// The heading on the page load that finished the first visit (R-248): Mahalo and their name, as the ending on Home said it.
const mahalo = name => name ? `Mahalo, ${esc(name)}!` : 'Mahalo for joining in!';
// One line, as onboarding's screens start (the mockup's "Aloha, Kai. One thing this week."): the slide's heading is the page's.
function greeting(c) {
  const name = P.myName(), hi = `Aloha${name ? `, ${esc(name)}` : ''}`;
  if (c.welcome) {
    const said = followSummary() || plural(S.bills.length, 'bill'), fin = P.finNow();
    if (fin) return `<header class="cm-head"><h1 class="hero" id="hm-finh">${mahalo(name)}</h1><p class="lede">This is your home page. ${c.card.kind ? 'Here’s the first thing you can do.' : 'We keep watch, and when one has a hearing, a simple way to help shows up here.'}</p>${P.finDid()}</header>`;
    return `<header class="cm-head"><p class="cm-hi"><b>${hi}.</b> <span>You follow ${esc(said)}. ${c.card.kind ? 'Here’s the first thing you can do.' : 'We keep watch.'}</span></p></header>`;
  }
  if (c.thanks) return `<header class="cm-head">${thanksHtml(c.thanks, name)}</header>`;
  const res = resultLine(c), cnt = countLine(c, res);
  const line = [res, cnt].filter(Boolean).join(' ') || (prevVisit() ? `Nothing new since ${esc(sinceWhen())}. We’re keeping watch.` : '');
  return `<header class="cm-head"><p class="cm-hi"><b>${hi}.</b>${line ? ` <span>${line}</span>` : ''}</p></header>`;
}

// ---------------- the page, in session ----------------
// The slide last drawn, once it is settled (testimony sent, or the rest done; core settledOn), becomes the Mahalo for this
// visit. Found on the next draw, so it follows every way of sending (the letter's walkthrough, the email, an Undo-free mark).
function thanksNow() {
  const was = S.cmShown;
  if (was && settledOn(was.b, was.h)) { S.cmThanks = { ...was, fresh: true }; S.cmShown = null; }
  if (S.cmThanks && !settledOn(S.cmThanks.b, S.cmThanks.h)) S.cmThanks = null;   // an Undo takes it back
  return S.cmThanks;
}
function inSession(si, { welcome, fin }) {
  const due = dueAll(), asksAll = P.oneIdeaAsks(due), plans = goingPlans();
  const late = lateAll(), card = pickCard(due, late, asksAll, plans);
  const c = { si, welcome, fin, due, late, asksAll, plans, card, why: undefined, moments: [], open: openActions(S.bills, S.hearings).filter(x => !settledOn(x.b, x.h)),
    n: due.length + late.length + asksAll.length, thanks: thanksNow() };
  const iss = followedIssues(), own = looseBills().filter(b => b.id !== card.bill?.id);
  // The slide's own issue: its row says "On the slide above" (and what else on it is due), and stays where it ranks.
  const onSlide = ['due', 'late', 'ask'].includes(card.kind) ? card.bill.id : null;
  const slideRow = (i, st) => { const ids = issueBills(i); if (!onSlide || !ids.includes(onSlide)) return st;
    const more = due.filter(x => ids.includes(x.b.id) && x.b.id !== onSlide).length;
    return { ...st, on: true, warn: false, text: `On the slide above${more ? `, and ${more} more this week` : ''}` }; };
  const rows = [...iss.map(i => ({ i, ...slideRow(i, stateOf(new Set(issueBills(i)), c)), name: i.name, href: `#/issue/${i.slug}` })),
    ...own.map(b => { const st = stateOf(new Set([b.id]), c); return { b, ...st, name: headline(b), text: `${spaced(b)} · ${st.text}`, href: billPath(b) }; })].sort(byImportance)
    // Nothing is new seconds after the first visit: everything on the page was just seen there.
    .map(r => ({ ...r, fresh: !welcome && r.fresh }));
  c.freshN = rows.filter(r => r.fresh).length; c.noun = !iss.length && looseBills().length ? 'bills' : 'issues';   // someone who follows only bills has no issues

  const head = greeting(c);   // before the slide: it decides the slide's reason (c.why)
  S.cmMoments = c.moments;
  S.cmShown = card.kind === 'due' || card.kind === 'late' ? { b: card.items[0].b, h: card.items[0].h } : null;
  const lines = [welcome ? '' : P.sessionLink(si.yr), P.profileLine()].filter(Boolean).join('');
  return `<div class="hm cm${welcome ? '' : ' cm-met'}${finCls(welcome)}">
    ${head}
    ${theSlide(c)}
    ${issuesBlock(rows, iss.length + own.length)}
    ${lines ? `<div class="cm-lines">${lines}</div>` : ''}
  </div>`;
}

// ---------------- the page, between sessions ----------------
// The break, the wins and their session in the greeting; the one thing to do now (a hello to their legislators); their
// issues as rows, each with what became of it.
function offSession(si, { welcome }) {
  const yr = si.recapYear, next = si.nextOpen, nextYr = next ? +next.slice(0, 4) : yr + 1, name = P.myName();
  const opens = next ? new Date(next + 'T12:00:00-10:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: HST }) : '';
  ensureRecapPool(yr); const wins = winsIn(yr);
  const lede = `The Legislature is on break${opens ? ` until ${esc(opens)}` : ''}.${wins && wins.length ? ` In ${yr}, ${esc(plural(wins.length, 'bill'))} HIPHI backed became law.` : ''}`;
  const known = P.districtsKnown();
  const ready = known ? [`Say aloha before ${nextYr}`, `Lawmakers are writing their ${nextYr} bills now. A short hello from someone in their district tells them what you care about. It takes about 2 minutes.`]
    : ['Get ready for January', 'Know who represents you before the first hearing. It takes 30 seconds.'];
  const fin = welcome && P.finNow();
  const card = slideHtml({ hl: fin ? 'h2' : 'h1', id: 'cm-rd', art: `<div class="cm-art">${CAPITOL}</div>`, title: ready[0], say: esc(ready[1].replace(/ It takes (about 2 minutes|30 seconds)\.$/, '')),
    mins: known ? 'About 2 minutes' : 'About 30 seconds', go: btn(known ? 'Write to my legislators' : 'Find my legislators', { kind: 'primary', icon: known ? 'mail' : 'landmark', full: true, href: '#/legislators' }) });
  // Each issue's outlook (staff write it in Staff v2) to its first sentence: one phrase a row, as in session; the whole
  // outlook is on the issue's page (Leilani's sixteen ran to 2,600px whole).
  const first = t => (String(t || '').match(/^.*?[.!?](?=\s|$)/) || [String(t || '')])[0];
  // "Disposable e-cigarette ban (SB 2175) became law in 2026." under the heading "Disposable e-cigarette ban" says the name
  // twice (the review of R-222): "Became law in 2026 (SB 2175)."
  const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
  const unname = (name, t) => { if (!t.startsWith(name + ' ')) return t; const rest = t.slice(name.length + 1), m = /^\(([A-Z]+ ?\d+)\) (.*?)\.?$/.exec(rest);
    return m ? `${cap(m[2])} (${m[1]}).` : cap(rest); };
  const own = looseBills();
  const rows = [...P.myIssues(yr).map(r => ({ name: r.title, text: unname(r.title, first(r.sub)), href: r.href })),
    ...own.map(b => ({ b, name: headline(b), text: `${spaced(b)} · ${plainStatus(b).short}`, href: billPath(b) }))];
  // The Mahalo says where they are, as in session (the fresh-eyes review of R-248); the ticks below say what they did, so the
  // lede does not count their issues again (A-14).
  const hello = fin ? `<h1 class="hero" id="hm-finh">${mahalo(name)}</h1><p class="lede">This is your home page. ${lede}</p>${P.finDid()}`
    : `<p class="cm-hi"><b>Aloha${name ? `, ${esc(name)}` : ''}.</b> <span>${lede}</span></p>${welcome ? '' : P.sessionLink(yr)}`;
  return `<div class="hm cm cm-off${finCls(welcome)}">
    <header class="cm-head">${hello}</header>
    ${card}
    ${issuesBlock(rows, followedIssues().length + own.length)}
    ${P.meetLine() || P.profileLine() ? `<div class="cm-lines">${P.meetLine()}${P.profileLine()}</div>` : ''}
  </div>`;
}

// The page that finished the first visit: .cm-fin (home.js finFx plays the petals once), and .hm-anim on its first draw only,
// so the ticks rise once and a redraw as data lands does not replay them (home.css).
const afterSwap = (moved, fn) => moved && typeof moved.then === 'function' ? moved.then(fn, fn) : requestAnimationFrame(fn);
const finCls = welcome => welcome && P.finNow() ? ` cm-fin${S.hmFinDrawn ? '' : ' hm-anim'}` : '';
let delegated = false;
export default {
  tab: 'home',
  title: route => today.title(route),
  render(route) {
    if (!S.featured || !S.pool) return skeleton(4);
    const welcome = P.welcomed(), fin = !!wiz().finale;
    delegated = route?.name === 'recap' || !followsAnything();
    if (delegated) return today.render(route);
    const si = sessionInfo();
    // A fresh arrival on the first visit's own Home, the email step skipped: one ask, as a line (core's nudge rules).
    if (!document.querySelector('#main .cm') && welcome && !S.nudge && !S.session && !P.alertsGiven()) nudge('follow');
    return si.phase === 'in' ? inSession(si, { welcome, fin }) : offSession(si, { welcome });
  },
  wire(route) {
    if (delegated) { today.wire && today.wire(route); return; }
    const root = document.querySelector('#main .cm'); if (!root) return;
    wireActions(root); wireNudge(root); wireExtras(root); P.finFx();
    // "Show the next one" says what it did, with Undo (B-5, A-16): the card it moved is still on its issue's row.
    // The slide changes in place with onboarding's short slide (fx.js swap, A-10), and its heading takes the focus.
    const toSlide = () => { const h = document.querySelector('#main .cm-goal'); h?.focus({ preventScroll: true }); };
    root.querySelectorAll('[data-cm-skip]').forEach(el => el.onclick = () => { const k = el.dataset.cmSkip; S.aSkip.add(k); S.cmPick = null; S.cmThanks = null;
      afterSwap(swap(() => app.render()), toSlide);
      toast(`${el.dataset.cmName} moved out of the way. It’s still on your list below.`, { undo: () => { S.aSkip.delete(k); app.render(); } }); });
    root.querySelectorAll('[data-cm-unskip]').forEach(el => el.onclick = () => { S.aSkip.clear(); app.render(); });
    // A row with something to do this week brings it up onto the slide (decision 5a): the top of Home, the slide in place.
    // wire() runs before app.js wireFrame, so this handler is first on the row and stops wireFrame's, which opens every "#/"
    // link whether or not the click was cancelled (the href stays, for a new tab).
    root.querySelectorAll('[data-cm-pick]').forEach(el => el.onclick = e => { if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault(); e.stopImmediatePropagation(); const k = el.dataset.cmPick;
      S.aSkip.delete(k); S.cmPick = k; S.cmThanks = null;
      window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
      afterSwap(swap(() => app.render()), toSlide); });
    // "Show all N" opens the rest of a long list where it is, and the first row it opened takes the focus (A-16).
    const all = root.querySelector('[data-cm-showall]');
    if (all) all.onclick = () => { const more = [...root.querySelectorAll('[data-cm-more]')]; more.forEach(el => el.hidden = false); all.remove();
      const first = more.map(el => el.matches('li') ? el : el.querySelector('li')).find(Boolean)?.querySelector('a'); first?.focus(); };
    // The greeting's good news is seen once, as a good news card was (home.js seeMoment); a law they spoke up for gets its
    // full-screen moment the first time it is said (C-7, the biggest there is).
    const ms = S.cmMoments || []; S.cmMoments = null;
    const m = ms.filter(x => P.seeMoment(x)).find(x => x.kind === 'law');
    if (m) setTimeout(() => celebrate({ title: `A bill you spoke up for ${isResolution(m.b) ? 'was adopted' : 'became law'}`, sub: `${nameOf(m.b)}. Mahalo for speaking up.`, go: 'Continue' }), 400);
  },
};
