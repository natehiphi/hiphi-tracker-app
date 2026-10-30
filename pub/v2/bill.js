// Version 2's bill page: the page opens like Home's slide (R-357 Part 1; Nate, 30 Oct 2026: "Make the bold changes but keep the my
// issues tab. Make this a version 2 for the public."), behind ?v2=1 (pub/app.js V2). The evidence is the review's two walks
// (backend docs/requests/R-357/notes-newcomer-walk.md and notes-returner-walk.md): today's page buries the ask under the tab bar,
// a newcomer cannot follow from it, and nothing on it says what a note does.
//
// The first screen, under the back row: a small line (the bill's number and HIPHI's side), the goal heading (Home's slide's, from
// calm/goals.js), one plain sentence on what happens next and why a note helps, one detail line (when, how long), the one filled
// button (today's main action, same handler), "Email the chair instead · 2 min" when a hearing is ahead, and Follow this issue as an
// outlined button (a pale "Following" once followed, never a dark state button). Then one row, "More about this bill", which opens
// today's sections inline: what it does and HIPHI's reasons, Where it is now with its steps, who decides, drafts, others following.
// From 1100px the frame is two columns, the slide on the left and More about this bill open on the right.
//
// Everything that is not the page's drawing is today's: pub/bill.js's screen() (loading, errors, the bars), its wire() (the main
// button, walkthroughs, folds, Follow, Share, the ⋯ menu), and the parts it exports. This file only draws the slide and its row.
import { S, app, esc, icon, nick, spaced, blurb, cleanDesc, posInfo, issuesOf, issueFollowed, didKind, plainStatus } from '../core.js';
import { btn } from '../ui.js';
import { mailLabel, letterOn, againLine } from '../letters.js';
import { levelLine, levelBox, wireLevelLine } from '../alerts.js';
import { onListsLine } from '../mylists.js';
import { screen, lookup, mainButton, railInfo, headChips, readLink, plainHead, recTop, recWhere, recCards, stanceInner, sponsorLine, partnerSide, welcomeLine,
  friendCard, storyLine, followIsMain, newbie, textIssue, TXT, wide, fold, doWords, stoppedWords, flipFollow, arrived, RMAIL } from '../bill.js';
import { goalFor, hearingSay, askSay, byWhen, dayLong, soon, cutoffAt, cutoffDay, testimonyTime } from './slide.js';

const warnWords = (t, warn) => warn ? `<b class="warn">${esc(t)}</b>` : esc(t);

// ---------------- what the slide says ----------------
// The one button is bill.js mainButton (a testimony walkthrough, the ask to the chair, Share, Follow the issue ...), so the page and its
// docked bar never disagree. Here: the words around it. say is plain text, detail is markup (an amber time), link and done are markup.
function wordsFor(b, x) {
  const h = x.act?.h || null, late = !!x.act?.late, st = x.st;
  const dl = st.deadline && !st.deadline.missed ? st.deadline : null, chairs = x.chairs.length > 1 ? 'chairs' : 'chair', mail = RMAIL.includes(x.kind);
  const out = { say: '', detail: '', link: '', done: '' };
  // A hearing ahead: testimony, the page's main ask whatever the person thinks of the bill (R-068).
  if (h) {
    const sent = didKind(b, h, 'testimony'), mailed = didKind(b, h, 'email'), k = `${b.id}|${h.id}|`;
    if (sent) {
      out.say = `The committee reads your testimony before it votes ${dayLong(h.scheduled_at)}.`;
      const mine = letterOn(b)?.h === h.id ? btn('Your letter', { kind: 'text', sm: true, icon: 'file-text', attrs: { 'data-myletter': h.id, 'data-bill': b.id } }) : '';
      out.done = `<p class="v2-done" role="status">${icon('circle-check')}<span>You sent testimony. Mahalo!</span>${mine}${btn('Undo', { kind: 'text', sm: true, attrs: { 'data-undo': k + 'testimony', 'aria-label': 'Undo: testimony sent' } })}</p>`;
    } else {
      out.say = hearingSay(b, h, late);
      const due = h.testimony_deadline ? (late ? h.scheduled_at : h.testimony_deadline) : h.scheduled_at;
      out.detail = `${warnWords(`${late ? 'Late until' : h.testimony_deadline ? 'By' : 'Hearing'} ${byWhen(due)}`, soon(due))} · ${testimonyTime()}`;
      // The email to the chair is the other way in: a person who will not make a Capitol account today. Not for someone who sees the
      // bill differently from HIPHI (its words are HIPHI's), and not once they have sent it.
      if (mailed) out.done = `<p class="v2-done v2-note">${icon('circle-check')}<span>You emailed the chair. Written testimony is different: the committee reads it before it votes.</span>${btn('Undo', { kind: 'text', sm: true, attrs: { 'data-undo': k + 'email', 'aria-label': 'Undo: emailed the chair' } })}</p>`;
      else if (!x.differs) out.link = btn(mailLabel(b, 'email|' + h.id, `Email the ${chairs} instead · 2 min`), { kind: 'text', attrs: { 'data-mailwalk': x.k } });
      const again = againLine(b, h); if (again) out.done = again + out.done;   // "You wrote testimony on this bill ..., for an older draft": next to "Send my letter again"
    }
    return out;
  }
  // Between hearings, the one thing to do (R-357: "Needs a hearing by Mon, Mar 30 · ask the chair"), or the bill's state in a phrase.
  switch (x.kind) {
    case 'ask': case 'hold': case 'remind': case 'capitol':
      out.say = x.kind === 'capitol' ? 'You see this one differently from HIPHI. You can still tell lawmakers what you think, in your own words.' : x.kind === 'remind' ? `You asked before, and it still has no hearing. A short follow-up to the ${chairs} can help.` : askSay(st, x.kind === 'hold');
      if (dl) {
        const day = cutoffDay(st), warn = cutoffAt(st) - Date.now() < 864e5;
        out.detail = x.kind === 'hold' ? `${warnWords(`Hearing deadline ${day}`, warn)} · ask the ${chairs} to hold it` : x.kind === 'remind' ? `${warnWords(`Needs a hearing by ${day}`, warn)} · follow up with the ${chairs}`
          : x.kind === 'capitol' ? warnWords(`Needs a hearing by ${day}`, warn) : `${warnWords(`Needs a hearing by ${day}`, warn)} · ask the ${chairs}`;
      } else out.detail = esc(plainStatus(b).short);
      return out;
    case 'floor': case 'conference': case 'governor':
      out.say = doWords(b, x)[1]; out.detail = `${esc(plainStatus(b).short)}${mail && x.to?.length ? ' · about 2 min' : ''}`; return out;
    case 'law': out.say = doWords(b, x)[1]; out.detail = esc(plainStatus(b).short); return out;
    case 'ballot': out.say = plainStatus(b).text; out.detail = esc(plainStatus(b).short); return out;
    case 'stopped': {
      // Between sessions: what can still happen, then the state in one phrase. In session: the bill did not advance, others still move.
      const sw = stoppedWords(b, x);
      out.say = sw ? sw.next : doWords(b, x)[1]; out.detail = esc(sw ? sw.was : plainStatus(b).short); return out;
    }
    default:   // a live bill with no ask of its own right now (heard and waiting for the decision, between steps): where it stands
      out.say = plainStatus(b).text; return out;
  }
}

// Follow this issue: outlined; Following: a pale chip, never a filled dark one (A-12). A bill with no issue is followed by itself.
// A newcomer's follow is the one a newcomer has always had (data-bl-newfollow: the profile ask, the moment, the visit's end).
// Not drawn when the main button already is the follow (a stopped bill whose issue is not followed yet).
function followHtml(b, x) {
  if (followIsMain(b, x)) return '';
  const iss = issuesOf(b), i = iss.length ? textIssue(b) || iss.find(issueFollowed) || iss[0] : null;
  const on = i ? issueFollowed(i) : S.watch.has(b.id), what = i ? 'issue' : 'bill';
  if (on) return `<button type="button" class="btn v2-following" aria-pressed="true" aria-label="Following${i ? ` ${esc(i.name)}` : ''}. Press to stop following." title="Following. Press to stop following." ${i ? `data-bl-unfollowissue="${esc(i.id)}"` : 'data-v2-star="1"'}>${icon('check')}<span>Following</span></button>`;
  const attr = newbie(b) ? { 'data-bl-newfollow': '1' } : i ? { 'data-bl-followissue': i.id } : { 'data-v2-star': '1' };
  return btn(`Follow this ${what}`, { kind: 'secondary', icon: 'star', full: true, attrs: { ...attr, 'aria-pressed': 'false', ...(i ? { 'aria-label': `Follow this issue: ${i.name}` } : {}) } });
}

// The slide: the small line, the goal, the sentence, the detail, the button, the link, Follow.
function slide(b, x) {
  const p = posInfo(b), label = [spaced(b.bill_number), p ? p.text : b.hiphi_position === 'monitor' && !partnerSide(b) ? 'HIPHI is watching' : ''].filter(Boolean).join(' · ');
  // The goal; else the bill's everyday name; else, for a bill with neither, what it does in a sentence (smaller: it is a sentence, as today's page sets it).
  const named = goalFor(b) || nick(b), goal = named || plainHead(b), w = wordsFor(b, x), main = mainButton(b, x);
  return `<div class="bl-head v2-slide" role="group" aria-labelledby="v2-goal">
    <p class="v2-k">${esc(label)}</p>
    <h1 class="v2-goal${named ? '' : ' v2-plain'}" id="v2-goal">${esc(goal)}</h1>
    ${w.say ? `<p class="v2-say">${esc(w.say)}</p>` : ''}${w.detail ? `<p class="v2-detail">${w.detail}</p>` : ''}
    ${w.done || ''}
    <div class="v2-go">${main}${w.link || ''}${followHtml(b, x)}</div></div>`;
}

// ---------------- More about this bill ----------------
// Its issue, in one line (it was the issue band): the name, a link to the issue's page. Someone who came by a text keeps the text's
// level line and its switch (R-299) under it.
function issueLine(b) {
  const iss = issuesOf(b); if (!iss.length) return '';
  const t = textIssue(b), i = t || iss.find(issueFollowed) || iss[0];
  return `<div class="v2-issue"><a class="v2-issuelink" href="#/issue/${esc(i.slug)}"><span>Its issue: <b>${esc(i.name)}</b></span>${icon('chevron-right')}</a>${t ? `<span class="bl-txt">${levelLine(t, TXT)}</span>${levelBox(t, TXT)}` : ''}</div>`;
}
// What the row says it holds. The step is told where there is one (a live bill); a finished bill's is its end.
function rowLine(b, x) {
  const r = x.live ? railInfo(b, x) : null;
  return `What it does, where ${x.law ? 'it ended up' : x.stopped ? 'it stopped' : `it is${r ? ` (step ${r.idx + 1} of ${r.names.length})` : ''}`}, who decides`;
}
// today's sections, in today's order: the bill's name and what it does, HIPHI's side and Read the bill, its issue, who introduced it,
// Where it is now with its steps, where the person stands (not on the first screen: the letter asks), then the closed cards.
function moreBody(b, x) {
  const name = nick(b), lede = name && (b.hiphi_summary || cleanDesc(b.description)) ? blurb(b, 320) : '';
  const note = b.sandbox_untracked ? `<div class="notice info bl-note">${icon('info')}<div>This bill is not on HIPHI’s list, so the sandbox has only its number and title. The live tracker shows every bill in full.</div></div>` : '';
  // The heading above says the goal, so the bill's own everyday name and number are said here, once (A-14).
  const title = name && goalFor(b) ? `<h2 class="v2-bn">${esc(name)}<span class="bl-hnum"> ${esc(spaced(b.bill_number))}</span></h2>` : '';
  const stance = x.live ? `<section class="card flat bl-stance bl-rstance" aria-labelledby="bl-stance-h">${stanceInner(b, x)}</section>` : '';
  return `${note}${title}${lede ? `<p class="lede bl-lede">${esc(lede)}</p>` : ''}<div class="bl-rhrow">${headChips(b, x)}${readLink(b)}</div>
    ${issueLine(b)}${partnerSide(b)}${sponsorLine(b)}${onListsLine(b)}
    ${recWhere(b, x)}${stance}<div class="bl-rfolds">${recCards(b, x)}</div>`;
}

// The page. A phone: the slide, then the row (a closed card this visit remembers, and a /changes link opens). A laptop: two columns,
// the slide on the left and More about this bill open on the right.
function page(num, b, x) {
  arrived(b);
  const top = `${recTop(b)}${welcomeLine(b)}`, side = `${friendCard(b, x)}${slide(b, x)}${storyLine(b)}`;
  if (wide()) return `<div class="bl-page bl-wide bl-rec bl-v2">${top}<div class="v2-cols"><div class="v2-left">${side}</div>
    <section class="v2-more v2-open" aria-labelledby="v2-more-h"><h2 class="v2-mh" id="v2-more-h">More about this bill</h2><p class="v2-ms">${esc(rowLine(b, x))}</p><div class="v2-body">${moreBody(b, x)}</div></section></div></div>`;
  const open = S.blOpen.has(`${b.id}|v2more`) || /\/changes$/i.test(location.hash);
  return `<div class="bl-page bl-rec bl-v2">${top}${side}
    <details class="v2-more" ${open ? 'data-bl-fold="v2more" open' : fold(b, 'v2more')}><summary><span><span class="v2-mt" id="v2-more-h">More about this bill</span><span class="v2-ms">${esc(rowLine(b, x))}</span></span>${icon('chevron-down', { cls: 'bl-chev' })}</summary>
      <div class="v2-body">${moreBody(b, x)}</div></details></div>`;
}

const base = screen(page);
export default {
  get tab() { return base.tab; }, get tabs() { return base.tabs; }, title: base.title, render: base.render, bar: base.bar,
  wire(route) {
    base.wire(route);   // the card's walkthroughs, Follow the issue, Share, the ⋯ menu, folds, stance chips: today's
    const root = document.querySelector('.bl-page.bl-v2'), b = root && lookup(String(route.num || '').replace(/\s/g, '').toUpperCase(), +route.year || 0); if (!root || !b) return;
    // A bill on no issue is followed by itself (the slide's Follow; the ⋯ menu has the same).
    root.querySelectorAll('[data-v2-star]').forEach(el => el.addEventListener('click', async () => { if (el.getAttribute('aria-busy') === 'true') return; el.setAttribute('aria-busy', 'true'); await flipFollow(b); app.render(); }));
    // The text's level switch sits in More about this bill, outside the slide, so today's wiring (which looks in the head) did not reach it.
    if (root.querySelector('.v2-issue [data-lvl-toggle]')) wireLevelLine(root.querySelector('.v2-issue'));
  },
};
