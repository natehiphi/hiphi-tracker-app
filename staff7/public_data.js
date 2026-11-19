// Public mode's words and a bill's public state (R-398, design sections 3 and 5 to 9): the ONE source of every wording the public-mode pages show, and of
// what the public site shows for a bill as a page reads it. One file, so the same bill reads the same on its page, on Home, on the admin's page and on the
// lists (design 3.7). The rules themselves (who may change what, the bar, what the public sees) live in staff6/data.js, where the database-side behaviour is
// kept; this file only words them. It imports from the data layer and draws nothing. Times are Pacific/Honolulu, as the rest of the app's.
import { S, POSITIONS, advocate, isLiveBill, needsWords, barDone, barMet, isPublicSide, PUBLIC_SIDES, BAR_POINTS, soleAdmin, hstToday } from '../staff6/data.js';
export { NOT_TRACKED, CHANGED_SINCE, WAIT_ON_BILL, DECIDED_BY, WORDS_HELD, TAKE_BACK_POSITION, publicStateOf, publicPositionPending, needsWords, barMet, barDone, draftWords,
  saveDraftWords, discardDraftWords, sendPublicWords, decidePublicChangeV7, takeBackChange, takeDownWords, takeDownAsk, publishPosition, seedPublicV7, publicV7On } from '../staff6/data.js';

// ---------------------------------------------------------------------------------- sides and who may publish
export const SIDES = PUBLIC_SIDES;   // Strongly support, Support, Support with amendments, Oppose, Strongly oppose, Comments (neutral); Monitor and no position are not sides
export const isSide = pos => isPublicSide(pos);
const plural = (n, one, many) => n === 1 ? one : many;
const join = a => a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
const hst = t => new Date(t).toLocaleString('en-US', { timeZone: 'Pacific/Honolulu', weekday: 'short', hour: 'numeric', minute: '2-digit' }).replace(/,/g, '');
const first = id => { const a = id ? advocate(id) : null; return a ? (a.full_name || '').split(' ')[0] || null : null; };
// The admin's first name while there is exactly one admin; null otherwise (design 3.5).
export const adminFirst = () => { const a = soleAdmin(); return a ? first(a.id) : null; };
const adminOr = () => adminFirst() || 'an admin';
export const PUBLISH_BUTTON = 'Publish to the public site';
export const sendLabel = me => me?.is_admin ? PUBLISH_BUTTON : adminFirst() ? `Send to ${adminFirst()} to publish` : 'Send to an admin to publish';

// ---------------------------------------------------------------------------------- the bar (design 3, 5)
// For a side bill: the three things in field order, each done or not. For a bill with no side: met, and no list.
export function bar(b) {
  if (!needsWords(b)) return { met: true, list: [] };
  const d = barDone(b);
  const list = [
    { key: 'nickname', label: 'A nickname', done: d.nickname },
    { key: 'public_summary', label: 'A summary', done: d.public_summary },
    { key: 'talking_points', label: `3 talking points${d.points < BAR_POINTS ? ` (${d.points} so far)` : ''}`, done: d.points >= BAR_POINTS },
  ];
  return { met: list.every(x => x.done), list };
}
// "Needs a nickname and 2 more talking points"; '' when the bar is met.
export function missingLine(b) {
  const d = barDone(b), parts = [];
  if (!d.nickname) parts.push('a nickname');
  if (!d.public_summary) parts.push('a summary');
  if (d.points < BAR_POINTS) { const k = BAR_POINTS - d.points; parts.push(k === 1 ? '1 more talking point' : `${k} more talking points`); }
  return needsWords(b) && parts.length ? `Needs ${join(parts)}` : '';
}
// "2 things still needed"; '' when none is.
export function stillNeeded(b) {
  const n = bar(b).list.filter(x => !x.done).length;
  return n ? `${n} ${plural(n, 'thing', 'things')} still needed` : '';
}
export const BAR_LABEL = "Before the public site shows HIPHI's words:";
export const MONITOR_LINE = 'Monitor bills need nothing here. A nickname and a summary help people find it.';

// ---------------------------------------------------------------------------------- what the public has (design 5, 9)
export const NOW_LEGISLATURE = "Now on the public site: the Legislature's title only";
// "Now on the public site: HIPHI's words · published Mon 9:40 AM by Nate"; the "published" part is dropped when its time or name is unknown.
export function nowLine(b) {
  if (!isLiveBill(b)) return NOW_LEGISLATURE;
  const by = first(b.public_published_by), at = b.public_published_at ? hst(b.public_published_at) : '';
  return `Now on the public site: HIPHI's words${by && at ? ` · published ${at} by ${by}` : ''}`;
}
export const waitingLine = pc => `Waiting on ${adminOr()} to publish · sent ${hst(pc.proposed_at)}`;
export const TAKEN_BACK = 'Taken back';
export const TAKEN_BACK_HELP = 'Taken back. Your words are kept here. The public site is unchanged.';
export function sentBackLine(pc) {
  const who = first(pc.decided_by) || adminOr(), note = (pc.note || '').trim();
  return note ? `Sent back by ${who}: ${note}` : `Sent back by ${who}`;
}
export const readyLine = me => me?.is_admin ? 'Ready to publish' : `Ready to send to ${adminOr()}`;
// The position, as the bill page and the admin's page say it: "HIPHI's position: Support", or with the two differing (design 5, 7).
const posName = v => v ? (POSITIONS.find(p => p[0] === v) || [, v])[1] : 'No position yet';
export function publicPositionLine(b) {
  const team = posName(b.position);
  return isLiveBill(b) && (b.position ?? null) !== (b.public_position ?? null)
    ? `HIPHI's position: ${team} for the team · ${posName(b.public_position)} on the public site`
    : `HIPHI's position: ${team}`;
}

// ---------------------------------------------------------------------------------- the dock (design 5)
// What the words in the dock are about, named in the order the fields come: "the nickname and 3 talking points", "the ask", "the ask's last day", "our position".
const listWhat = (keys, b) => {
  const parts = [];
  if (keys.includes('nickname')) parts.push('the nickname');
  if (keys.includes('public_summary')) parts.push('the summary');
  if (keys.includes('talking_points')) { const n = barDone(b).points; parts.push(`${n} talking ${plural(n, 'point', 'points')}`); }
  if (keys.includes('public_action')) parts.push('the ask');
  else if (keys.includes('public_action_until')) parts.push("the ask's last day");
  if (keys.includes('position')) parts.push('our position');
  return join(parts);
};
export const ON_SITE_NOTHING_NEW = 'These words are on the public site. Nothing new to publish.';
// One line that always says what the press will do. changedKeys: the fields that differ from what the public has; sent: a words change of this person's waits.
export function dockLine({ me, b, changedKeys = [], sent = false }) {
  if (!barMet(b)) return stillNeeded(b);
  const admin = !!me?.is_admin, what = changedKeys.length ? listWhat(changedKeys, b) : '';
  if (admin) return what ? `Publishing: ${what}. On the public site in 10 seconds.` : isLiveBill(b) ? ON_SITE_NOTHING_NEW : '';
  if (!changedKeys.length) return sent ? `Sent to ${adminOr()}. Change anything and it joins your change.` : '';
  return isLiveBill(b)
    ? `Sending: ${what}. The public keeps the earlier words until ${adminOr()} approves.`
    : `Sending: ${what}. ${adminOr()} approves before the public sees them.`;
}

// ---------------------------------------------------------------------------------- the page's fixed words (design 3, 5 to 9)
export const BAND = 'You are changing the public site';
export const LEAVE_PUBLIC = 'Leave public mode';
export const PREVIEW_HEAD = 'How the public site will show it';
export const PREVIEW_TAG = 'Preview · a picture, not the real page';
export const NOT_ON_SITE_YET = 'Not on the public site yet';
export const AFTER_APPROVE = 'After you approve';
export const SAVE_LATER = 'Save for later';
export const SAVED_FOR_TEAM = 'Saved for the team. The public site has not changed.';
export const DISCARD = 'Discard changes';
export const TAKE_WORDS_DOWN = "Take HIPHI's words down";
export const TAKE_WORDS_DOWN_HELP = 'Off the public site at once. Nobody needs to approve this.';
export const WORDS_DOWN_TOAST = "HIPHI's words are off the public site. Undo";
export const TAKE_ASK_DOWN = 'Take the ask down';
export const SHOW_ASK_THROUGH = 'Show the ask through';
export const ASK_THROUGH_HELP = 'The ask comes down by itself after this day. The rest stays.';
export const ASK_LABEL = 'HIPHI asks:';
export const ASK_HELP = "One or two sentences on what to do before the hearing, e.g. Tell the committee why this matters to you. It shows as 'HIPHI asks:' and goes into the messages people write. Leave dates out. Blank is fine: the public sees the hearing.";
export const NICKNAME_LABEL = 'Nickname';
export const NICKNAME_HELP = 'A few plain words, e.g. Disposable e-cigarette ban';
export const SUMMARY_LABEL = 'Summary';
export const SUMMARY_HELP = 'One sentence a neighbor would understand. No jargon, no bill numbers.';
export const POINTS_LABEL = 'Talking points';
export const POINTS_HELP = 'People tap these into testimony sent in their own name, so keep them true.';
export const ADD_POINT = 'Add a point';
export const POSITION_HEAD = "HIPHI's position";
export const CHANGE_ON_BILL = "Change it on the bill's page";
export const DOOR_TEXT = 'Change what the public sees';
export const ON_SITE_ROW = 'On the public site';
export const WORDS_ON_SITE_TOAST = 'On the public site now.';
export const APPROVED_TOAST = 'Approved. On the public site in 10 seconds.';
export const SENT_BACK_TOAST = 'Sent back.';
export const ON_SITE_AFTER_APPROVE = 'On the public site 10 seconds after you approve.';
export const sentToast = name => `Sent to ${name}. The public site has not changed.`;
export const HEAD_APPROVE = 'Approve a public change';
export const HEAD_PUBLISH = 'Publish a public change';
export const APPROVE_BUTTON = 'Approve';
export const SEND_BACK_BUTTON = 'Send back';
export const SEND_BACK_NOTE_LABEL = 'Note (optional)';
export const SEND_BACK_NOTE_HELP = 'Say what to change in one sentence';
export const sendBackHears = who => `${who} hears it with your note. The public keeps the earlier words.`;
export const ownSaved = t => `You saved this ${hst(t)}`;
export const hearingLine = (hearingAt, dueAt) => `Hearing ${hst(hearingAt)} · testimony due ${hst(dueAt)}`;
export const ASK_EXPIRED = "The ask's last day has passed, so it is not published.";
export const NOTHING_WAITS = 'Nothing waits here.';
export const LIST_WAITING = 'Waiting for you';
export const LIST_TO_WRITE = 'Bills to write';
export const LIST_YOURS = 'Your changes';
export const HOME_APPROVE = 'Approve a public change';
export const HOME_PUBLISH = 'Publish a public change';
export const HOME_FIX = 'Fix public words';
export const homeWrite = n => `Write public words · ${n} of your bills`;

// The position's words on the bill page and the admin's page (design 7, 8).
export const positionSaveNote = label => `The team sees this at once. The public site keeps ${label} until it is published in public mode.`;
export const positionStillSays = label => `The public site still says ${label}`;
export const teamAlreadySees = label => `The team already sees ${label}.`;
export const positionCheck = label => `The talking points and the ask were written for ${label}. Check them.`;
export const positionSavedToast = (label, who) => `Saved. The public site keeps ${label} until ${who} publishes it. Undo`;
// The tail after "The public site still says Support" on the bill page, for this person and this bill (design 7).
export function positionTail(me, b) {
  if (me?.is_admin) return '· Publish the change';
  if (barMet(b)) return `· Waiting on ${adminOr()} to publish · See it`;
  return `· ${missingLine(b).replace(/^Needs /, 'needs ')} · Write them`;
}
// The reason an approval is refused for the bar, in plain words (design 8): "HB 123 now has 2 talking points. It needs 3."
export function barRefusal(b) {
  const d = barDone(b), num = b.bill_number || 'This bill';
  if (!d.nickname) return `${num} has no nickname. It needs one.`;
  if (!d.public_summary) return `${num} has no summary. It needs one.`;
  return `${num} now has ${d.points} ${plural(d.points, 'talking point', 'talking points')}. It needs ${BAR_POINTS}.`;
}

// ---------------------------------------------------------------------------------- the one-bill page's own words (R-398 part 1b, added with it)
export const LEAVE_SHORT = 'Leave';
export const BACK_HOME = 'Back to Home';
export const NO_BILL = 'No bill by that number is in the tracker.';
export const NICK_SHORT = 'A nickname needs at least 3 characters.';
export const ASK_HEARING_LATE = 'The hearing is after this day, so the ask would come down before the hearing.';
export const ASK_DOWN_TOAST = 'The ask is off the public site. Undo';
export const DISCARD_TOAST = 'Changes discarded. Undo';
export const ASK_FIELD = 'The ask';
export const TAKE_BACK_BUTTON = 'Take back';
export const REMOVE_POINT = 'Remove';
export const SEE_PREVIEW = 'See the preview';
export const FOLD_BUTTON = 'Change them';
// "Nickname, summary and 3 talking points" for a side bill; "Nickname and summary" for a Monitor bill (design 5, arriving from the ask)
export const foldLead = b => needsWords(b) ? 'Nickname, summary and 3 talking points' : 'Nickname and summary';
export const pointLabel = n => `Talking point ${n}`;
// "12 characters left": a count appears only near its limit (P-4)
export const charsLeft = n => `${n} ${n === 1 ? 'character' : 'characters'} left`;
// The position as the public site's bill chip words it (pub/kernel.js posInfo), with "this bill" as the approved preview shows it; '' when the bill has no side
export const pubPositionWords = p => ({ strongly_support: 'HIPHI strongly supports this bill', support: 'HIPHI supports this bill', support_amend: 'HIPHI supports this bill with changes',
  strongly_oppose: 'HIPHI strongly opposes this bill', oppose: 'HIPHI opposes this bill', neutral: 'HIPHI has comments on this bill' })[p] || '';
export const SENT_ON_SITE = 'These words are on the public site. Change anything to send it to Nate.';
export const NOTHING_TO_SEND = 'Nothing to send yet. Write a nickname, a summary or a talking point first.';

// ---------------------------------------------------------------------------------- part 2 (R-398): the admin's page for a waiting change, and Public words
export const sentThis = (who, t) => `${who} sent this ${hst(t)}`;
export const changedOurs = (who, t) => `${who} changed our position ${hst(t)}`;
export const sentAt = t => `sent ${hst(t)}`;
export const hearingDay = t => `Hearing ${new Date(t).toLocaleDateString('en-US', { timeZone: 'Pacific/Honolulu', weekday: 'short' })}`;
export const YOU_CHANGED_POS = 'You changed our position';
export const changeHead = (who, own) => own ? 'Your change' : `${who}’s change`;
export const partName = (who, what, own) => own ? `Your change to ${what}` : `${who}’s change to ${what}`;
export const CHANGE_NOW_HEAD = 'On the public site now';
export const LEG_TITLE_ONLY = "The Legislature's title only";
export const NOTHING_THERE = 'Nothing there yet';
export const TAKEN_OUT = 'Taken out';
export const NO_LAST_DAY = 'No last day';
export const NO_WORD_CHANGE = 'The words are the same as the public site.';
export const POINTS_NOW = 'Talking points now on the public site';
export const POSITION_LABEL = 'Position';
export const AFTER_PUBLISH = 'After you publish';
export const PUBLISH_IN_10 = 'On the public site 10 seconds after you publish.';
export const SEND_BACK_IN_10 = 'Sent back 10 seconds after you press it.';
export const CANCEL = 'Cancel';
export const CHANGED_HELP = 'This changed since you opened it. The page shows it as it is now; check it, then decide.';
export const ASK_EXPIRED_CHANGE = "The ask's last day has passed, so the ask will not be published. The rest will.";
export const ONLY_ADMIN = 'Only an admin decides a public change.';
export const BILL_WORDS_LINK = "See the bill's public words";
export const BACK_PUBLIC = 'Back to Public words';
export const PUBLIC_WORDS_HEAD = 'Public words';
export const GONE_CHANGE = 'That change is no longer here.';
export const YES_WORD = 'Yes', NO_WORD = 'No';
export const CHANGE_NAMES = { nickname: 'Nickname', public_summary: 'Summary', talking_points: 'Talking points', public_action: 'The ask', public_action_until: "The ask's last day" };
export const OTHER_LABELS = { name: 'Name', title: 'Title', description: 'Description', category: 'Category', recommended: 'Recommended', outlook: 'Outlook', stance: 'Stance',
  first_visit: 'First visit', icon: 'Icon', is_published: 'On the public site', slug: 'Web address' };
export const whatChanged = names => join(names);   // "Summary and nickname", "Nickname, summary and the ask"
export const posWord = v => posName(v);
export const positionChange = (from, to) => `Position, ${posName(from)} to ${posName(to)}`;
export const waitingState = () => `Waiting on ${adminOr()} to publish`;
export const APPROVED_STATE = 'Approved';
export const WITHDRAWN_POSITION = 'Taken back: the position was changed back';
export const LIST_WAITING_HELP = 'Approving puts a change on the public site.';
export const LIST_TO_WRITE_HELP = "Bills we take a side on that the public site does not show HIPHI's words for.";
export const LIST_YOURS_HELP = 'The last 30 days';
