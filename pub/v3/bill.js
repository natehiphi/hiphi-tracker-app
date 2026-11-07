// Version 3's bill page (?v3=1, R-362 Part 5): the first screenful of act.html's bill screen (one/bill.js) on track.html's data.
// Top to bottom on a phone: Back, Share and the ⋯ menu; the bill's everyday name with its number; one status line (the chamber and
// where it stands); the deadline in Home's words ("Send testimony by Thu 9:30 AM"); the one filled button (bill.js mainButton, so the
// page and its docked bar never disagree, A-3); then "Where do you stand?" (the stance card), the issue's quiet Follow, "Where it is now"
// and the closed cards. From 1100px the frame is today's two columns (bill.js recPage's .cols), with the button, the deadline and the
// stance card in the sticky side panel (A-13). Each fact is said once (A-14): the status line leaves out the moment the deadline line says.
// Everything that is not drawing is bill.js's: screen() (loading, errors, the bars), wire() (the main button, walkthroughs, folds, stance,
// Follow, Share, the ⋯ menu), and the parts it exports. This file only draws the page, as pub/v2/bill.js does.
import { esc, icon, nick, spaced, issuesOf, issueFollowed, issueLead } from '../core.js';
import { btn } from '../ui.js';
import { screen, recTop, recLine, mainButton, stanceInner, recWhere, recCards, plainHead, welcomeLine, friendCard, storyLine, arrived,
  textIssue, newbie, followIsMain, doWords, RMAIL, wide } from '../bill.js';
import { sendBy } from './pick.js';
import { HELP_WORDS } from '../letters.js';

// The moment the bill is waiting on, in a line of its own, and the status line without it. bill.js recLine({when:true}) is the moment
// alone ("Testimony due Sun 3:00 PM", "Needs a hearing by Mon, Mar 30", "Hearing Tue 9:30 AM"); an open testimony deadline is said in
// pick.js's words so Home, This week and this page agree. Amber only inside 24 hours (A-5).
function lines(b, x) {
  const full = recLine(b, x), moment = recLine(b, x, { when: true }), h = x.act?.h;
  let when = null;
  if (h && !x.act.late && h.testimony_deadline) { const by = sendBy(h.testimony_deadline); when = { text: by.text, soon: by.soon }; }
  else if (moment) when = { text: moment, soon: false };
  let status = full;
  if (moment && full.endsWith(moment)) status = full.slice(0, full.length - moment.length).replace(/\s*·\s*$/, '');
  // "In the House" alone is the chamber the bill is in; the step bar under the stance card says the rest, so "Now in the House".
  if (/^In the \w+$/.test(status)) status = status.replace(/^In/, 'Now in');
  return { status, when };
}

// The issue's quiet Follow: a text button under the stance card, not a second big button. A newcomer's follow is the one a newcomer has
// always had (data-bl-newfollow: the profile ask, the moment). A bill on no issue is followed by itself (the ⋯ menu has the same).
function issueRow(b, x) {
  const iss = issuesOf(b); if (!iss.length) return '';
  const t = textIssue(b), i = t || iss.find(issueFollowed) || iss[0], on = issueFollowed(i), same = (nick(b) || '').trim().toLowerCase() === i.name.trim().toLowerCase();
  const go = on ? btn('Following', { kind: 'text', sm: true, icon: 'check', cls: 'v3-following', attrs: { 'data-bl-unfollowissue': i.id, 'aria-pressed': 'true', 'aria-label': `Following ${i.name}. Press to stop following.` } })
    : followIsMain(b, x) ? ''
    : btn('Follow this issue', { kind: 'text', sm: true, icon: 'star', attrs: { ...(newbie(b) ? { 'data-bl-newfollow': '1' } : { 'data-bl-followissue': i.id }), 'aria-pressed': 'false', 'aria-label': `Follow this issue: ${i.name}` } });
  return `<div class="v3-issue">${icon(issueLead(i), { size: '1em' })}<p class="v3-it">${same ? `<a href="#/issue/${esc(i.slug)}">See the issue</a>` : `Part of <a href="#/issue/${esc(i.slug)}">${esc(i.name)}</a>`}</p>${go}</div>`;
}

function head(b, x) {
  const name = nick(b), { status, when } = lines(b, x);
  return `<div class="bl-head v3-head"><h1 class="${name ? 'hero bl-nick' : 'bl-what'}">${esc(name || plainHead(b))}<span class="bl-hnum"> ${esc(spaced(b.bill_number))}</span></h1>
    ${status ? `<p class="v3-status">${esc(status)}</p>` : ''}
    ${when ? `<p class="v3-when${when.soon ? ' soon' : ''}">${icon('clock')}<span>${esc(when.text)}</span></p>` : ''}</div>`;
}

// The button's block. bill.js's dock looks for .bl-ract and docks the button above the tab bar once it scrolls off a phone's top.
function go(b, x, main) {
  if (!main) return '';
  const mail = RMAIL.includes(x.kind), time = x.act?.h ? '' : mail ? 'About 2 minutes.' : '';
  return `<div class="bl-ract v3-go">${main}${time ? `<p class="v3-time small">${esc(time)}</p>` : ''}</div>`;
}

function page(num, b, x) {
  arrived(b);
  const note = b.sandbox_untracked ? `<div class="notice info bl-note">${icon('info')}<div>This bill is not on HIPHI’s list, so the sandbox has only its number and title. The live tracker shows every bill in full.</div></div>` : '';
  // One label across version 3 (Home's and This week's card say "Send testimony"): only the words change, the button is bill.js's.
  // A saved draft, a kept letter and a late letter keep their own words; a bill with no hearing keeps its own button.
  const main = x.kind === 'testify' ? mainButton(b, x).replace(`<span>${HELP_WORDS}</span>`, '<span>Send testimony</span>') : mainButton(b, x), stance = x.live ? `<section class="card flat bl-stance bl-rstance v3-stance" aria-labelledby="bl-stance-h">${stanceInner(b, x)}</section>` : '';
  const doCard = !x.act && !!main, folds = recCards(b, x, { noEmails: doCard && RMAIL.includes(x.kind) });
  const rest = `${note}${recWhere(b, x)}<div class="bl-rfolds">${folds}</div>`;
  // The Share pill stands aside when the one button is itself Share (A-14), as version 2 does.
  const top = recTop(b, { share: !/data-bl-go="share"/.test(main) });
  if (!wide()) return `<div class="bl-page bl-rec bl-v3">${top}${welcomeLine(b)}${head(b, x)}${friendCard(b, x)}${go(b, x, main)}${stance}${issueRow(b, x)}${storyLine(b)}${rest}</div>`;
  return `<div class="bl-page bl-wide bl-rec bl-v3">${top}<div class="cols bl-cols">
    <div class="bl-main">${welcomeLine(b)}${head(b, x)}${issueRow(b, x)}</div>
    <aside class="side bl-side v3-side" aria-label="Take part">${friendCard(b, x)}${go(b, x, main)}${stance}${storyLine(b)}</aside>
    <div class="bl-main bl-main2">${rest}</div></div></div>`;
}

export default screen((num, b, x) => page(num, b, x));
