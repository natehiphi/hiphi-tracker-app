// Staff v6 · the picture vocabulary (R-344, the five picture rules of R-336's at-a-glance review; Nate's decisions of 26 Oct).
// One place for what each action and each state looks like, so a row, its button, a tab and a step picture never disagree.
// Pictures go beside words, never instead of them (Nate, 26 Oct). Rule 5: no icon stands for two things; ICON_MEANS below is
// the one list of what each icon means here, and tests/staff6_glance_shapes.py fails when one icon is given two meanings.
//
// ---- the API ----
//   ACTS[kind]                 -> { word, icon, btnIcon, hue, means }: one action. `kind` is a step kind of steps.js billStep
//                                 (write, submit, nodraft, revise, approve, review, review2, second, file, missed, filed, stale,
//                                 chair, ask, send, email, fix) or one of take, follow, partner, call, replied. `icon` is the
//                                 row's picture of the job; `btnIcon` the icon on that action's button (when it differs).
//   actOf(kind)                -> ACTS[kind] or a neutral fallback, never undefined.
//   actTile(kind, { size, label, cls }) -> the soft filled tile: the job's icon on a soft round tile of its hue (More's round
//                                 tiles, Nate's Decision 1 "soft filled"). Decorative unless `label` is given (then role=img).
//                                 size: 40 (a card), 32 (a row: rowLead's, the faces' size), 24 (inside a line).
//   rowLead(kind, opts)        -> actTile wrapped as a row's leading mark for steps.js billRow / itemRow `lead` (class
//                                 v6-row-lead v6-act-lead: the row's words move into a second column, names line up).
//   BTN_ICON[label]            -> the icon for a row button's words ("File", "Review", "Resubmit", "Email the chair"...).
//   iconizeButtons(html)       -> adds BTN_ICON's icon to every .btn in `html` that has none (steps.js rowButton draws its
//                                 buttons bare; a pale button with no picture is the blur test's failure, Rule 1).
//   STATES.testimony|chair|issue|stance[key] -> { word, icon, tone, means }: Rule 2's four sets, one shape, one colour and one
//                                 word per state. tone: '' (body ink), 'done' (leaf), 'late' (amber), 'overdue' (red): status
//                                 colours only, never an action hue.
//   stateMark(set, key, { word, cls, size }) -> the state's icon on its small round tile, with its word (word: false keeps
//                                 the word for screen readers only). The tile is the neutral wash; the icon carries the tone.
//   testimonyKey(state, status) -> the testimony set's key for steps.js testimonyState(...) (and the step's status, for late).
//   chairKey(ask)              -> the chair set's key for a model.js chairAskOf record (null: not asked).
//   issueKey(x)                -> the issue set's key for an issuestand.js standOf(i) record (ontrack, risk, stopped, won, none).
//   stanceKey(position)        -> the stance set's key for bills.position (support, oppose, comments, monitor, none).
//   testimonyTrack(s)          -> the Write -> Approve -> (Second look) -> File step picture for a steps.js billStep step,
//                                 20px dots, readable labels, one line; a sent-back draft's Write step is "Revise" with the
//                                 sent-back shape. Replaces steps.js trackHTML wherever it is used (Testimony's open item now).
//   ICON_MEANS                 -> { icon: [meanings] } over ACTS and STATES; conflicts() lists icons with two meanings.
//
// Later (another build holds them now): steps.js rowButton/trackHTML/stepCard and today.js rows import ACTS, rowLead,
// iconizeButtons and testimonyTrack from here; issuepage.js's "On track" box uses stateMark('issue', issueKey(x)).
//
// Colours (Decision 1): each action family has a hue, drawn as a soft wash with the icon in the hue (staff6/css/steps.css
// --v6-hue-*). The hues are never the amber, red or green of status (A-5 on v6): indigo for writing, violet for approving,
// steel blue for filing, the action blue for chair asks, rose for outreach and partners, slate for taking a step on.
import { esc, effStage } from './data.js';
import { icon } from './ui.js';

// ---- actions (Rule 1) ----
// The words are steps.js VERB's (the step's own verb, the same on the row and the card, V19); icons and hues added here.
const A = (word, ic, hue, means, btnIcon = ic) => ({ word, icon: ic, btnIcon, hue, means });
export const ACTS = {
  nodraft: A('Make the draft', 'pencil', 'write', 'write words'),
  write: A('Send for approval', 'pencil', 'write', 'write words', 'send'),
  submit: A('Send for approval', 'pencil', 'write', 'write words', 'send'),
  revise: A('Resubmit', 'undo-2', 'write', 'sent back for changes', 'send'),
  stale: A('Check it', 'refresh-cw', 'write', 'the bill changed'),
  // Review opens the approval, so it wears Approve's picture (the review: one picture for one job on a row)
  approve: A('Approve', 'user-check', 'approve', 'approve'),
  review: A('Approve', 'user-check', 'approve', 'approve'),
  review2: A('Approve', 'users-round', 'approve', 'second look', 'user-check'),
  second: A('Approve', 'users-round', 'approve', 'second look', 'user-check'),
  email: A('Approve', 'user-check', 'approve', 'approve'),
  file: A('File', 'clipboard-check', 'file', 'file at the Capitol'),
  missed: A('Did we file?', 'circle-x', 'file', 'missed', 'circle-help'),
  filed: A('Filed', 'circle-check', 'file', 'done'),
  chair: A('Ask the chair', 'mail', 'chair', 'email someone'),
  follow: A('Follow up', 'mail', 'chair', 'email someone'),
  call: A('Call the office', 'phone', 'chair', 'a phone call'),
  replied: A('They replied', 'reply', 'chair', 'record a reply'),
  ask: A('Write the public ask', 'megaphone', 'rally', 'rally the public'),
  send: A('Send', 'send', 'rally', 'send'),
  fix: A('Fix the email', 'pencil', 'rally', 'write words'),
  partner: A('Approve partner words', 'handshake', 'rally', 'partners'),
  take: A('Take it', 'user-round-plus', 'take', 'hand a step to a person'),
  none: A('Where it stands', 'scroll-text', 'take', 'a bill'),
  // Today's other jobs (today.js jobKind)
  todo: A('To-do', 'list-checks', 'take', 'a to-do'),
  talk: A('Follow up', 'message-circle', 'rally', 'talk with someone'),
  message: A('Reply', 'message-square', 'chair', 'a message or comment'),
  moved: A('Still going?', 'calendar-clock', 'take', 'a hearing moved'),
  prep: A('Get the issue ready', 'clipboard-list', 'take', '2027 prep'),
};
// One table, read by today.js: a Today item's kind to its job here.
export const JOB_OF = { followask: 'follow', rally: 'ask', askup: 'ask', followup: 'talk', reply: 'message', partner: 'partner', todo: 'todo', moved: 'moved', prep: 'prep',
  email: 'email', fix: 'fix', send: 'send', stale: 'stale', chair: 'chair' };
export const jobKind = (kind, step = null) => step?.kind && ACTS[step.kind] && step.kind !== 'none' ? step.kind : JOB_OF[kind] || (ACTS[kind] ? kind : 'none');
const NONE = A('', 'circle', 'take', 'nothing');
export const actOf = kind => ACTS[kind] || NONE;
export const actIcon = kind => actOf(kind).icon;

// The soft filled tile. The hue is a class (steps.css .v6-at.h-write ...), so a palette change re-colours every tile.
export function actTile(kind, { size = 40, label = '', cls = '' } = {}) {
  const a = actOf(kind);
  return `<span class="v6-at h-${a.hue} s${size}${cls ? ' ' + cls : ''}" data-act="${esc(kind)}"${label ? ` role="img" aria-label="${esc(label)}"` : ' aria-hidden="true"'}>${icon(a.icon)}</span>`;
}
// A row's leading mark (steps.js billRow / itemRow `lead`): the tile, with the job's word for screen readers.
export const rowLead = (kind, { size = 32, word = true } = {}) => { const a = actOf(kind);
  return `<span class="v6-row-lead v6-act-lead s${size}">${actTile(kind, { size })}${word && a.word ? `<span class="sr">${esc(a.word)}: </span>` : ''}</span>`; };

// ---- row buttons get their icons (Rule 1: every button carries its icon) ----
export const BTN_ICON = {
  'Make the draft': 'pencil', 'Send for approval': 'send', 'Resubmit': 'send', 'Review': 'user-check', 'Approve': 'user-check',
  'File': 'clipboard-check', 'Did we file?': 'circle-help', 'Take it': 'user-round-plus', 'Follow up': 'mail', 'Call the office': 'phone',
  'They replied': 'reply', 'Email the chair': 'mail', 'Email the chairs': 'mail', 'Email the chair again': 'mail',
  'Email the chairs again': 'mail', 'Ask for a change': 'message-square', 'Write the public ask': 'megaphone', 'Check it': 'refresh-cw',
  'Reply': 'message-square', 'Keep it up': 'megaphone', 'Yes, move me': 'calendar-clock', 'Done, I asked': 'hourglass', 'Undo filed': 'undo-2',
};
// Adds the icon to each .btn whose words BTN_ICON knows and that has no icon yet. The label is the button's <span>…</span>.
export function iconizeButtons(html) {
  return String(html || '').replace(/(<(?:a|button)\b[^>]*class="btn\b[^"]*"[^>]*>)(<span>([^<]*)<\/span>)/g, (m, open, span, label) => {
    const ic = BTN_ICON[label.replace(/&amp;/g, '&').trim()];
    return ic ? `${open}${icon(ic)}${span}` : m;
  });
}

// A-25: where a tile or a button already says the job, a line stops repeating its verb (steps.js actBy's words):
// "File now · due today 10:00 AM" -> "Due today 10:00 AM", "Send for approval by today 4:00 PM" -> "By today 4:00 PM",
// "File · late, still accepted until 1:10 PM" -> "Late, still accepted until 1:10 PM". Works on text or on HTML whose
// verb is plain text at its start. Anything else comes back as it was.
export function dropVerb(line, verb) {
  line = String(line ?? ''); if (!verb || !line.startsWith(verb)) return line;
  const rest = line.slice(verb.length);
  const m = /^ now · (due [\s\S]*)$/.exec(rest) || /^ (by [\s\S]*)$/.exec(rest) || /^ · ([\s\S]*)$/.exec(rest) || /^, (was due [\s\S]*)$/.exec(rest);
  return m ? m[1][0].toUpperCase() + m[1].slice(1) : line;
}

// ---- states (Rule 2): one shape, one colour, one word per state, in four sets ----
const St = (word, ic, tone, means) => ({ word, icon: ic, tone, means });
export const STATES = {
  // Where a testimony draft is: steps.js STATE_WORDS, "Sent back" its own state (a sent-back draft never looks new), and
  // late (still accepted) said with the clock, as status() says it.
  testimony: {
    notstarted: St('Not started', 'circle-dashed', '', 'nothing yet'),
    write: St('Writing', 'pencil', '', 'write words'),
    sent: St('Sent back', 'undo-2', '', 'sent back for changes'),
    approve: St('With an approver', 'user-check', '', 'approve'),
    second: St('Second look', 'users-round', '', 'second look'),
    file: St('Ready to file', 'clipboard-check', '', 'file at the Capitol'),
    filed: St('Filed', 'circle-check', 'done', 'done'),
    late: St('Late, still accepted', 'alarm-clock', 'late', 'late, still accepted'),   // the plain clock is due today's
    missed: St('Missed', 'circle-x', '', 'missed'),
  },
  // Where an ask to a chair is (model.js ASK_ANSWERS, plus not asked yet).
  chair: {
    notasked: St('Not asked yet', 'circle-dashed', '', 'nothing yet'),
    asked: St('Asked, no reply yet', 'hourglass', '', 'waiting for a reply'),
    left_message: St('Left a message', 'phone', '', 'a phone call'),
    will_schedule: St('Will schedule', 'calendar-check', 'done', 'a hearing is coming'),
    // thumbs-down: "against", as a legislator's no on Legislators and HIPHI's Oppose (the raised hand is My issues' Needs you)
    said_no: St('Said no', 'thumbs-down', '', 'against'),
  },
  // How an issue is doing (Decision 4: shapes only, no tint). Won is the trophy, and the bill bar's end at Law is the same
  // trophy: a flag already means a Capitol deadline on the stage tracker (tracker.js), so it cannot also mean "won".
  issue: {
    ontrack: St('On track', 'check', '', 'on track'),
    risk: St('At risk', 'triangle-alert', '', 'at risk'),
    stopped: St('Stopped', 'circle-minus', '', 'stopped'),
    won: St('Won', 'trophy', 'done', 'became law'),
    none: St('No bills yet', 'circle-dashed', '', 'nothing yet'),
  },
  // HIPHI's stance: one word each (the review: "Support" everywhere, not "Support" here and "Strong support" there).
  stance: {
    support: St('Support', 'thumbs-up', '', 'support'),
    oppose: St('Oppose', 'thumbs-down', '', 'against'),
    comments: St('Comments', 'message-square', '', 'a message or comment'),
    monitor: St('Monitor', 'eye', '', 'watch it'),
    none: St('No position', 'circle-dashed', '', 'nothing yet'),
  },
};

export function stateMark(set, key, { word = true, cls = '', size = 24 } = {}) {
  const st = STATES[set]?.[key]; if (!st) return '';
  return `<span class="v6-sm s${size}${st.tone ? ' t-' + st.tone : ''}${cls ? ' ' + cls : ''}" data-state="${esc(set)}:${esc(key)}"><span class="v6-sm-ic" aria-hidden="true">${icon(st.icon)}</span><span class="${word ? 'v6-sm-w' : 'sr'}">${esc(st.word)}</span></span>`;
}

// ---- which state ----
export function testimonyKey(st, status = null) {
  if (!st) return null;
  if (status?.tone === 'late' && !['filed', 'missed'].includes(st.key)) return 'late';
  if (st.key === 'write') return st.sentBack ? 'sent' : st.noDraft ? 'notstarted' : 'write';
  return STATES.testimony[st.key] ? st.key : null;
}
export const chairKey = a => !a ? 'notasked' : STATES.chair[a.answer] ? a.answer : 'asked';
// issuestand.js standOf's states, in Decision 4's four (and "no bills yet"): a bill that became law is a win; risk and a
// dying bill are at risk; nothing alive is stopped; safe and ahead are on track. An issue HIPHI opposes reads the other
// way: its bills stopping is the win, and a hearing set on one puts it at risk.
export function issueKey(x) {
  if (!x) return null;
  const against = x.i?.stance === 'oppose' || x.state === 'oppose', law = (x.bills || []).some(b => effStage(b) === 'enacted');
  if (law) return against ? 'stopped' : 'won';
  if (against && x.state === 'stopped' && (x.bills || []).length) return 'won';
  if (x.state === 'oppose') return x.hear ? 'risk' : 'ontrack';
  if (['risk', 'dying'].includes(x.state)) return 'risk';
  if (x.state === 'stopped') return 'stopped';
  if (['none', 'off'].includes(x.state) && !(x.going || []).length) return 'none';
  return 'ontrack';
}
export const stanceKey = p => ['strongly_support', 'support', 'support_amend'].includes(p) ? 'support' : ['oppose', 'strongly_oppose'].includes(p) ? 'oppose'
  : p === 'neutral' ? 'comments' : p === 'monitor' ? 'monitor' : 'none';

// The House and Senate dots (the review's "Keep these": My issues' filled and hollow dots): a filled dot for a chamber with
// a bill on HIPHI's side still alive that started there (HB or SB, HCR or SCR), a hollow ring when none is, each with its
// word (never the dot alone, A-5). `bills`: the live ones (issuestand.js standOf's `going`).
export function chamberDots(bills) {
  const on = { H: false, S: false };
  for (const b of bills || []) { const m = /^\s*(H|S)/i.exec(b.bill_number || ''); if (m) on[m[1].toUpperCase()] = true; }
  const dot = (k, w) => `<span class="v6-chd${on[k] ? ' on' : ''}"><span class="v6-chdot" aria-hidden="true"></span>${w}<span class="sr">${on[k] ? ': a bill alive' : ': none alive'}</span></span>`;
  return `<span class="v6-chdots">${dot('H', 'House')}${dot('S', 'Senate')}</span>`;
}

// ---- the testimony step picture (Rule 2, C5) ----
// steps.js trackHTML's steps and its second-look rule, drawn bigger: a 20px dot per step (done: the done shape on leaf; the
// step it is at: its state's shape on the action colour; still to come: a hollow ring) with its word beside it,
// 14px ink. One line at every width: when the steps would not fit (a container query: 400px with Second look, 280px without) the done steps keep their dot and give up their word
// (said to screen readers), so "Second look" never wraps. A sent-back draft's first step is "Revise" with the sent-back shape.
const TRACK = [['write', 'Write'], ['approve', 'Approve'], ['second', 'Second look'], ['file', 'File']];
export function testimonyTrack(s, { second: needSecond } = {}) {
  const d = s?.d, st = s?.state, key = st?.key; if (!key || key === 'missed') return '';
  const second = needSecond ?? (key === 'second' || !!d?.second_approved_by || !!d?.first_for_bill);
  const steps = TRACK.filter(([k]) => k !== 'second' || second), order = steps.map(x => x[0]);
  const cur = key === 'filed' ? steps.length : Math.max(0, order.indexOf(key));
  const sent = !!st.sentBack;
  const li = ([k, l], i) => {
    const state = i < cur ? 'done' : i === cur ? 'cur' : 'next';
    const word = k === 'write' && sent && state === 'cur' ? 'Revise' : l;
    const ic = state === 'done' ? icon('check') : state === 'cur' ? icon(k === 'write' ? (sent ? 'undo-2' : 'pencil') : STATES.testimony[k]?.icon || 'circle') : '';
    return `<li class="${state}${k === 'write' && sent ? ' sent' : ''}"${state === 'cur' ? ' aria-current="step"' : ''}><span class="v6-tt-dot" aria-hidden="true">${ic}</span><span class="v6-tt-w">${esc(word)}</span>${state === 'done' ? '<span class="sr"> (done)</span>' : ''}</li>`;
  };
  return `<div class="v6-tt-box"><ol class="v6-tt n${steps.length}${sent ? ' is-sent' : ''}" aria-label="Testimony steps">${steps.map(li).join('')}</ol></div>`;
}

// ---- Rule 5: one meaning per icon ----
export function iconMeans() {
  const m = {};
  const add = (ic, means) => { if (!ic || !means) return; (m[ic] ??= new Set()).add(means); };
  for (const a of Object.values(ACTS)) { add(a.icon, a.means); }
  for (const set of Object.values(STATES)) for (const s of Object.values(set)) add(s.icon, s.means);
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, [...v]]));
}
export const ICON_MEANS = iconMeans();
export const conflicts = () => Object.entries(iconMeans()).filter(([, v]) => v.length > 1).map(([k, v]) => `${k}: ${v.join(' / ')}`);
