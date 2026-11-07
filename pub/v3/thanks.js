// Version 3's Mahalo (?v3=1, R-362 Part 6), ported from act.html's thanks screen (one/thanks.js): what just happened in one line,
// then the follow that sending did, with Undo (B-5), then the one ask (C-3): the alerts sign-up card (helper.js emailAsk), and only
// when core's nudgeOk() let markDone raise it. Version 3 makes no phone or profile ask before a first action (kernel nudgeOk), so this
// is where that ask lives now. Left out on purpose, so the screen has one thing to answer (C-5, A-14): the friend card, "What happens
// next", the next letter, the story and quote cards, going in person, milestones. The bar is Done, or, while the card waits, its
// Not now and its own button (one filled button either way, A-3).
//
// helper.js calls V3.done(x) for the body of every Mahalo of a letter opened under the flag (x.v3, pub/v2/letter.js build), both kinds,
// and pub/v2/letter.js hands this file the Mahalo's bar (V3.foot) and its taps (V3.click). Without this file (its import failed) the
// letter still works and ends on helper.js's own Mahalo.
import { S, DEMO, esc, icon, spaced, setFollows } from '../core.js';
import { btn } from '../ui.js';
import { andList } from '../hello.js';
import { alertButton } from '../alerts.js';
import { HP, V3 } from '../helper.js';

// What happened, in one line. The practice copy says plainly that nothing went anywhere.
function lede(x, n) {
  if (x.mode !== 'testimony') {
    const who = andList((x.to || []).map(HP.shortName)) || 'the chair';
    return DEMO ? `Practice: nothing was sent. For real, your email goes from your own account to ${esc(who)}.` : `You emailed ${esc(who)} about ${esc(n)}. They read it before they decide.`;
  }
  return DEMO ? 'Practice: nothing went to the Capitol. For real, the committee reads it before they vote.'
    : x.late ? `You sent testimony on ${esc(n)}. It’s on the record, marked late.` : `You sent testimony on ${esc(n)}. The committee reads it before they vote.`;
}
// The follow that sending did (helper.js confirmSent, confirmMail): said once, with Undo right beside it; after Undo, one line and the
// way back. A bill followed on its own, or one whose issue they already follow, gets the sentence without an Undo.
function followLine(x, n) {
  if (x.v3Unf) return `<div class="v3-follow" id="v3-follow">${icon('bell-off')}<div><p>You won’t follow “${esc(x.v3Unf.name)}”.</p>${btn('Follow it again', { kind: 'text', sm: true, icon: 'bell', attrs: { 'data-hp': 'v3-refollow', id: 'v3-refollow' } })}</div></div>`;
  const words = x.followedIssue ? HP.followWords(x, n) : x.followedNow ? `We added ${esc(n)} to the bills you follow, so you’ll see what they decide.` : 'You’ll see what they decide on Home.';
  const undo = x.followedIssue ? btn('Undo', { kind: 'text', sm: true, icon: 'undo-2', cls: 'hp-unf', attrs: { 'data-hp': 'unfollow', id: 'v3-undo', 'aria-label': `Undo: stop following ${esc(x.followedIssue.name)}` } }) : '';
  return `<div class="v3-follow" id="v3-follow">${icon('bell')}<div><p>${words}</p>${undo}</div></div>`;
}

V3.done = x => {
  const n = x.b ? spaced(x.b.bill_number) : '', first = HP.firstOf(x.name);
  x.askStory = null; x.quoteOpen = false;   // the story and the quote are not asked here: the alerts card is the one ask
  const ask = HP.emailAsk(x);
  x.v3Ask = ask.includes('id="hp-ng-form"') && !ask.includes('class="btnrow"');   // the card's answers are the bar's (V3.foot)
  return `<div class="hp-hero v3-hero">
      <div class="hp-badge" aria-hidden="true">${HP.doneArt(x)}</div>
      <h2 class="hp-mahalo" id="hp-done-t" tabindex="-1">${first ? `Mahalo, ${esc(first)}!` : 'Mahalo!'}</h2>
      <p class="hp-lede">${lede(x, n)}</p>
    </div>
    ${followLine(x, n)}
    ${ask}`;
};

// The bar: while the alerts card waits for an answer, its Not now and its own button (helper.js does the same for its Mahalo, R-205 C4);
// then Done.
V3.foot = (x, { row }) => {
  if (x.v3Ask && S.nudge && !S.session && !S.nudgeText && !S.nudgeSent) {
    const b = alertButton('hp-ng');
    return row(btn('Not now', { kind: 'text', cls: 'hp-back', attrs: { 'data-hp': 'ngno' } })
      + btn(b.label, { kind: 'primary', icon: b.icon, cls: 'hp-main', attrs: { type: 'submit', form: 'hp-ng-form' } }));
  }
  return row(btn('Done', { kind: 'primary', cls: 'hp-main', attrs: { 'data-hp': 'done' } }));
};

// Undo the follow, and follow again: the line changes in place and says so (A-16); the focus stays on the line's button.
V3.click = (a) => {
  const x = S.helper;
  if (a === 'unfollow' && x.followedIssue) {
    const i = x.followedIssue;
    setFollows({ issuesOff: [i.id] }).then(r => { if (S.helper !== x || r === false) return; x.followedIssue = null; x.v3Unf = i; HP.paint({ focus: 'v3-refollow' }); HP.announce(`You no longer follow ${i.name}.`); });
    return true;
  }
  if (a === 'v3-refollow' && x.v3Unf) {
    const i = x.v3Unf;
    setFollows({ issuesOn: [i.id] }).then(r => { if (S.helper !== x || r === false) return; x.followedIssue = i; x.v3Unf = null; HP.paint({ focus: 'v3-undo' }); HP.announce(`You follow ${i.name} again.`); });
    return true;
  }
  return false;
};

export default V3;
