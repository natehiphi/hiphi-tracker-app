// HIPHI Staff v2: shared building blocks. Every screen builds from these so a row, a chip, a sheet or a countdown
// looks and behaves the same everywhere (plan section 4). Styles in staff/staff.css, on top of pub/base.css.
// Staff v6 (R-336): the same functions and signatures; staff6/staff.css restyles them on staff6/css/tokens.css. btn() kinds:
// 'primary' is the FILLED button (one per screen or region, V11), 'secondary' the TONAL one (action wash, no outline), 'text'
// a text button, 'danger' only inside a confirm. Countdowns and urgency tiles follow A-5 on v6 as Nate decided it on 26 Oct
// (R-344): amber for due today and while late testimony is still accepted, red only once the deadline has passed, anything
// further out neutral with its distance in words. sectionNav() knows every v6 place's page tabs (spec 3.3, D12).
import { S, STAGES, effStage, esc, advocate } from './data.js';
import { stopOf, STAGE_GLOSS, clockDay, spanOf, timeLeft, lateLine, hstDayOf, whenAt } from './model.js';
export { clockDay, lateLine };   // R-277 fix 3: it lives with the other time words in model.js; callers still import it from here
import { icon } from '../icons.js';
export { icon };

const attrs = a => Object.entries(a || {}).filter(([, v]) => v !== undefined && v !== null && v !== false)
  .map(([k, v]) => v === true ? ` ${k}` : ` ${k}="${esc(v)}"`).join('');

// ---- buttons and chips ----
export function btn(label, { kind = 'primary', icon: ic, iconEnd, full, sm, href, attrs: a, cls = '', target } = {}) {
  const c = `btn ${kind}${full ? ' full' : ''}${sm ? ' sm' : ''}${cls ? ' ' + cls : ''}`;
  const inner = `${ic ? icon(ic) : ''}<span>${label}</span>${iconEnd ? icon(iconEnd) : ''}`;
  const { type = 'button', ...rest } = a || {};
  return href ? `<a class="${c}" href="${esc(href)}"${target ? ` target="${target}" rel="noopener"` : ''}${attrs(rest)}>${inner}</a>`
    : `<button type="${esc(type)}" class="${c}"${attrs(rest)}>${inner}</button>`;
}
export const iconBtn = (ic, label, a = {}, cls = '') => `<button type="button" class="iconbtn${cls ? ' ' + cls : ''}" aria-label="${esc(label)}" title="${esc(label)}"${attrs(a)}>${icon(ic)}</button>`;
// Status chip: not a button, never drawn with a border. tone: '' | info | warn | danger | ok | yay
// R-277 fix 20 (U-8): two sizes only, drawn here: the usual one and `sm` for a chip inside a dense line (the week's grid, a
// committee member's role, a chat line's issue), which were three local size overrides of .sv-chip.
export const chip = (text, tone = '', ic, { sm = false } = {}) => `<span class="chip sv-chip${sm ? ' sm' : ''}${tone ? ' ' + tone : ''}">${ic ? icon(ic) : ''}${esc(text)}</span>`;
// Picker chip: a button that opens a picker sheet ("Strong support ▾").
export const pickerChip = (label, a = {}, ic) => `<button type="button" class="sv-pick"${attrs(a)}>${ic ? icon(ic) : ''}<span>${esc(label)}</span>${icon('chevron-down', { cls: 'chev' })}</button>`;
// Position: an icon and a word, never colour alone.
export const POS_ICON = { strongly_support: 'thumbs-up', support: 'thumbs-up', support_amend: 'thumbs-up', strongly_oppose: 'thumbs-down', oppose: 'thumbs-down', neutral: 'message-square', monitor: 'eye', '': 'circle-dashed' };
// A strong position shows its icon twice (Nate, 9/20): two thumbs up reads as "strongly" at a
// glance down a list of 113 bills, where the word alone does not. The picker still takes a plain
// icon name, so this is only for rendered rows.
export const posIcons = pos => { const ic = POS_ICON[pos] || 'circle-dashed';
  return /^strongly_/.test(pos || '') ? icon(ic) + icon(ic) : icon(ic); };
export const POS_WORD = { strongly_support: 'Strong support', support: 'Support', support_amend: 'Support with changes', strongly_oppose: 'Strongly oppose', oppose: 'Oppose', neutral: 'Comments', monitor: 'Monitor', '': 'No position' };
// What a position does beyond its name, under it in every position picker. The priority follows the position
// (R-175, Nate 10/5), so the one place it can be seen being set is here.
export const POS_SUB = { strongly_support: 'Makes it P1, the team’s top tier', monitor: 'Watch it; no testimony drafts' };
export const posChip = p => chip(POS_WORD[p || ''] || p, '', POS_ICON[p || ''] || 'circle-dashed');

// ---- R-277 fix 4 (U-4, U-8): one look per action. "I'm going" had 3 looks (a link, a chip, a text button) and 3 names
// for being on ("Take me off", "You’re going", "I’m not going after all"); the Doc button 3 names ("Open the Google
// Doc", "Open Doc", "Open") and 3 looks; "Mark filed" and "Show all" 2 to 4 each. Every screen draws them from here, so a
// person who has learned one has learned them all. Only the weight may differ, and only when the action IS the step (the
// one filled button, A-3) or a sheet's own confirm. ----
export const ACT = { going: 'I’m going', goingOn: 'You’re going', doc: 'Open Doc', filed: 'Mark filed', all: n => `Show all ${n}`, fewer: 'Show fewer' };
// A toggle: pressed, it says what is true; pressing again takes you off (A-12).
export const goingBtn = (on, a = {}, { kind = 'text', label, cls = '' } = {}) => btn(label || (on ? ACT.goingOn : ACT.going), { kind, icon: on ? 'user-check' : 'user-plus', cls: `sv-going${cls ? ' ' + cls : ''}`,
  attrs: { 'aria-pressed': on ? 'true' : 'false', title: on ? 'You’re on the list. Press to take yourself off.' : undefined, ...a } });
export const docBtn = (url, { kind = 'text', attrs: a, sm } = {}) => url ? btn(ACT.doc, { kind, sm, icon: 'file-text', iconEnd: 'external-link', href: url, target: '_blank', cls: 'sv-doc', attrs: a }) : '';
export const filedBtn = (a = {}, kind = 'secondary') => btn(ACT.filed, { kind, icon: 'clipboard-check', cls: 'sv-filed', attrs: a });
// "Show all 12 members" under a folded list; "Show fewer" once open (aria-expanded says which).
export const showAllBtn = (n, a = {}, { what = '', open = null, cls = '' } = {}) => btn(open ? ACT.fewer : `${ACT.all(n)}${what ? ' ' + what : ''}`, { kind: 'text', icon: open ? 'chevron-up' : 'chevron-down', cls: `sv-showall${cls ? ' ' + cls : ''}`,
  attrs: { ...(open !== null ? { 'aria-expanded': open ? 'true' : 'false' } : {}), ...a } });

// ---- people ----
// R-344 rule 4, faces (Nate 26 Oct, decision 3): every staff member has a soft colour of their own, so a row of faces says
// "whose" before a word is read and twelve circles no longer all look alike. Six tints (staff.css .sv-av.p0 ... .p5), none
// of them the amber, red or green that status uses, each with its initials at WCAG AA (A-7). A person's tint is their
// place among everyone's ids (S.advocates, sorted), so it is the same on every screen, device and visit, and the team's
// 13 spread evenly over the six (a hash of the id left two tints unused and gave Nate and Kevin one colour). Adding a
// person can move the people after them to the next tint; nothing stores it.
export const PERSON_TINTS = 6;
let tintIds = null, tintFrom = null;
export function tintOf(id) {
  if (id == null) return -1;
  if (tintFrom !== S.advocates) { tintFrom = S.advocates; tintIds = (S.advocates || []).map(a => String(a.id)).sort(); }
  const i = tintIds.indexOf(String(id));
  if (i >= 0) return i % PERSON_TINTS;
  let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;   // someone not on the team list (a removed author)
  return h % PERSON_TINTS;
}
// The viewer keeps their own tint everywhere (the colour others see them by) plus an action-coloured ring, so "you" is
// found at a glance without being a different colour on your screen than on a teammate's.
// `deco`: a face beside words that already name the person (faceLead, a hearing card's owner): no name of its own for a
// screen reader, and the initials drawn by CSS (staff.css .sv-av[data-ini]) so they are not text either; the row's words,
// counted and read by every test and reader, stay exactly what they were.
export function avatar(adv, size = 24, { deco = false } = {}) {
  if (!adv) return deco ? `<span class="sv-av none" style="--av:${size}px"></span>` : `<span class="sv-av none" style="--av:${size}px" role="img" aria-label="No owner" title="No owner"></span>`;
  const me = S.me && adv.id === S.me.id, t = tintOf(adv.id);
  // At most two letters (the review: Julie's "JMM" spilt out of her circle): the first and the last ("JM"); the full name is
  // in the title and, where the face is not decoration, read aloud.
  const raw = String(adv.initials || adv.full_name?.[0] || '?'), ini = raw.length > 2 ? raw[0] + raw[raw.length - 1] : raw;
  const cls = `sv-av${t >= 0 ? ` p${t}` : ''}${me ? ' me' : ''}`;
  if (deco) return `<span class="${cls}" style="--av:${size}px" data-ini="${esc(ini)}"></span>`;
  return `<span class="${cls}" style="--av:${size}px" title="${esc(me ? 'You' : adv.full_name)}" role="img" aria-label="${esc(me ? 'You' : adv.full_name)}">${esc(ini)}</span>`;
}
// A face for a list row's lead (steps.js itemRow's `lead`): the person's circle, hidden from reading because the row's own
// words name them (a picture beside words, never instead of them). Two people share the square; more than two show the first and "+N".
export function faceLead(ids, size = 32) {
  const list = (Array.isArray(ids) ? ids : [ids]).filter(x => x != null);
  const ppl = list.map(x => typeof x === 'object' ? x : advocate(x)).filter(Boolean);
  const shown = ppl.slice(0, ppl.length > 2 ? 1 : 2), more = ppl.length - shown.length;
  const inner = !ppl.length ? avatar(null, size, { deco: true }) : shown.map(a => avatar(a, size, { deco: true })).join('') + (more > 0 ? `<span class="sv-av sv-avmore" style="--av:${size}px" data-ini="+${more}"></span>` : '');
  return `<span class="v6-row-lead sv-face${ppl.length > 1 ? ' many' : ''}" aria-hidden="true">${inner}</span>`;
}
// A soft round tile with an icon (Nate's decision 1, 26 Oct: "soft filled", like More's rows): for a row whose lead is a
// kind of thing rather than a person (a note from the tracker), so faces and tiles line up down one edge.
export const tileLead = (ic, tone = '') => `<span class="v6-row-lead sv-face sv-tile${tone ? ' ' + tone : ''}" aria-hidden="true">${icon(ic)}</span>`;
export const ownerOf = b => advocate((S.assignments[b.id] || [])[0]);
// R-277 ui-critic: "Undo filed" is a quiet text link beside Filed (it was a button, and on the hearing page the only one),
// offered to whoever marked it filed, the bill's owner and admins; where nobody is recorded as filing it, to everyone.
export const mayUnfile = (d, b) => !!d && (!d.filed_by || d.filed_by === S.me?.id || !!S.me?.is_admin || (S.assignments?.[b?.id] || []).includes(S.me?.id));
export const undoFiledLink = (a = {}) => `<button type="button" class="linkbtn sv-unfile"${attrs(a)}>Undo filed</button>`;

// ---- countdown: always an icon and words (plan 4) ----
// v3 (R-264, A-5 as amended by R-250): a testimony deadline that has passed while the Capitol still takes late testimony
// (before the hearing starts) is amber "late testimony until 1:10 PM", not red "overdue". Pass the hearing's start as \`until\`.
const lateUntil = (iso, until) => { const now = Date.now(); return !!until && new Date(iso) <= now && new Date(until) > now; };
// The colour of time (R-352, Nate 27 Oct, amending R-344's Decision 2; A-5 on v6): amber only when late. A deadline that
// falls today (the same calendar day in Hawaiʻi, not yet passed) is 'today', drawn plain: a neutral clock, its time in
// bold, the time left in words. Late testimony still accepted, and a step past its deadline still to do, are amber with
// the alarm clock. Anything further out neutral, with the distance in words. One function, so every countdown agrees
// (v6's rows and tiles take the same rule from steps.js status()).
//   'late' (passed, still to do) · 'lateok' (late but accepted) · 'today' (due today, plain) · '' (neutral, later)
export function timeTone(iso, { until = null } = {}) {
  if (!iso) return '';
  if (lateUntil(iso, until)) return 'lateok';
  const t = new Date(iso).getTime();
  if (t <= Date.now()) return 'late';
  return hstDayOf(t) === hstDayOf(Date.now()) ? 'today' : '';
}
// The moment with its day after the clock, the way the late line says it ("3:00 PM today", "9:30 AM tomorrow"); a later day
// as the date ("Fri 3/27, 9:30 AM").
export const dayAt = iso => { const w = whenAt(iso), m = /^(today|tomorrow|yesterday) (.+)$/.exec(w); return m ? `${m[2]} ${m[1]}` : w; };
// v4 (R-269): "late testimony until 9:30 AM" said on Thursday about Friday's 9:30 read as half an hour away; the day goes in
// whenever the hearing is not today ("until tomorrow 9:30 AM", "until Fri 3/20, 9:30 AM"): clockDay, model.js.
// `at`: the moment goes first and the distance beside it ("3:00 PM today · in 1 hour", "Fri 3/27, 9:30 AM · in 3 days"), so
// nobody has to work out the distance from a date (rule 3); without it, the distance alone, as before.
export function countdown(iso, { prefix = '', until = null, at = false } = {}) {
  if (!iso) return '';
  const tone = timeTone(iso, { until });
  if (tone === 'lateok') return `<span class="sv-count lateok">${icon('alarm-clock')}${esc(prefix ? `${prefix}${lateLine(until, { lower: true })}` : lateLine(until))}</span>`;
  // Never round a deadline up: 2 days 6 hours is "2 days", not 3 (R-022). R-277 fix 3 (W-6): the words come from model.js
  // timeLeft, the same on every screen: "in 28 min", "in 4 hours", "4 hours overdue" (no more "under an hour", "7h left").
  const left = tone === 'late' ? timeLeft(iso) : `in ${spanOf(iso)}`;
  const text = `${prefix}${at ? `${dayAt(iso)} · ` : ''}${left}`;
  return `<span class="sv-count${tone ? ' ' + tone : ''}">${icon(tone === 'late' ? 'alarm-clock' : 'clock')}${esc(text)}</span>`;
}

// ---- rows and groups ----
// A two-line row: row({ lead, title, sub, end, href | attrs, chevron })
export function row({ lead, leadHtml, title, sub, end = '', chevron = true, href, attrs: a, cls = '' }) {
  const inner = `${leadHtml || (lead ? `<span class="lead">${icon(lead)}</span>` : '')}<span class="body"><span class="title">${title}</span>${sub ? `<span class="sub">${sub}</span>` : ''}</span><span class="end">${end}${chevron ? icon('chevron-right', { cls: 'chev' }) : ''}</span>`;
  return href ? `<a class="row${cls ? ' ' + cls : ''}" href="${esc(href)}"${attrs(a)}>${inner}</a>` : `<button type="button" class="row${cls ? ' ' + cls : ''}"${attrs(a)}>${inner}</button>`;
}
// A bill row: the name (the nickname, else the plain summary) with the bill number small after it, one line under it, and
// the position and owner at the right. v6 (D15, R-271): no version code (HD1) and no P1 in a row; they live in the bill.
// steps.js billRow() is v6's own row for rebuilt screens; this one keeps the screens not yet rebuilt in the same words.
export function billRow(b, { sub = '', href, attrs: a, selectable = false, selected = false, cls = '' } = {}) {
  const num = (b.bill_number || '').replace(/^([A-Z]+)\s*(\d)/, '$1 $2');
  const name = b.nickname || b.public_summary || b.description || b.title || num;
  const pos = b.position || '';
  const end = `<span class="sv-posic" title="${esc(POS_WORD[pos] || pos)}" aria-label="${esc(POS_WORD[pos] || pos)}">${icon(POS_ICON[pos] || 'circle-dashed')}</span>${avatar(ownerOf(b))}`;
  const box = selectable ? `<span class="sv-check" aria-hidden="true">${icon(selected ? 'square-check-big' : 'square')}</span>` : '';
  const inner = `${box}<span class="body"><span class="title"><span class="sv-nk">${esc(name)}</span>${name !== num ? ` <span class="bn-num">${esc(num)}</span>` : ''}</span>${sub ? `<span class="sub">${sub}</span>` : ''}</span><span class="end">${end}</span>`;
  const extra = { 'data-bill': b.id, ...(selectable ? { 'aria-pressed': selected ? 'true' : 'false' } : {}), ...(a || {}) };
  return href && !selectable ? `<a class="row sv-billrow${cls ? ' ' + cls : ''}" href="${esc(href)}"${attrs(extra)}>${inner}</a>`
    : `<button type="button" class="row sv-billrow${selected ? ' sel' : ''}${cls ? ' ' + cls : ''}"${attrs(extra)}>${inner}</button>`;
}
// A group header (44px): title and a right-aligned count; foldable when given a key.
export const groupHead = (title, count, { fold, open = true, id } = {}) => fold
  ? `<button type="button" class="sv-group" data-fold="${esc(fold)}" aria-expanded="${open}"${id ? ` id="${esc(id)}"` : ''}><span>${title}</span><span class="n">${count ?? ''}</span>${icon(open ? 'chevron-up' : 'chevron-down', { cls: 'chev' })}</button>`
  : `<div class="sv-group"${id ? ` id="${esc(id)}"` : ''}><span>${title}</span><span class="n">${count ?? ''}</span></div>`;

// ---- controls ----
// segmented('scope', [['mine','Mine'],['team','Team']], 'mine')  -> buttons with data-seg="scope" data-val
export const segmented = (name, opts, value, label = '') => `<div class="sv-seg" role="group"${label ? ` aria-label="${esc(label)}"` : ''}>${opts.map(([v, l]) => `<button type="button" data-seg="${esc(name)}" data-val="${esc(v)}" aria-pressed="${v === value}">${esc(l)}</button>`).join('')}</div>`;
// R-277 fix 14 (U-9): "whose work" is one switch with one set of words, in one order, on every list that has it: Mine |
// My coalitions | Team, and Team always means everybody's. It read Mine | Team on Today, Mine | My coalitions | Team on
// Bills, "Every coalition" on Outreach and Mine | The team's on the partner update (where Team also named an audience).
// `opts` names the ones a list offers (My coalitions only for someone who helps on one), each [key, value]; the words and the
// order come from here.
export const WHOSE = { mine: 'Mine', coal: 'My coalitions', team: 'Team' };
export const whoseSeg = (name, opts, value, { label = 'Whose work', cls = '' } = {}) => {
  const list = ['mine', 'coal', 'team'].filter(k => opts[k] !== undefined && opts[k] !== null);
  return `<div class="sv-seg sv-whose${cls ? ' ' + cls : ''}" role="group" aria-label="${esc(label)}">${list.map(k => `<button type="button" data-seg="${esc(name)}" data-val="${esc(opts[k])}" data-whose="${k}" aria-pressed="${String(opts[k]) === String(value)}">${WHOSE[k]}</button>`).join('')}</div>`;
};
export const switchRow = (id, label, on, help = '', a = {}) => `<label class="sv-switchrow" for="${esc(id)}"><span class="body"><span class="title">${label}</span>${help ? `<span class="sub">${help}</span>` : ''}</span><input type="checkbox" role="switch" id="${esc(id)}" ${on ? 'checked' : ''}${attrs(a)}><span class="sv-switch" aria-hidden="true"></span></label>`;
export const field = (id, label, input, help = '') => `<div class="field"><label for="${esc(id)}">${label}</label>${input}${help ? `<span class="help" id="${esc(id)}-help">${help}</span>` : ''}</div>`;
// The testimony steps with the true state: Write · Review · (Second approval) · File (v4: one name for the step, C-15)
export function stepBar(status, { second = false } = {}) {
  const steps = [['draft', 'Write'], ['review', 'Approve'],   // R-277 W-2: the step is named by what is done in it
    ...(second || status === 'second_review' ? [['second_review', 'Second approval']] : []), ['approved', 'File']];
  const order = steps.map(s => s[0]), cur = status === 'filed' ? steps.length : Math.max(0, order.indexOf(status));
  return `<ol class="sv-steps" aria-label="Testimony steps">${steps.map(([k, l], i) => `<li class="${i < cur ? 'done' : i === cur ? 'cur' : ''}"${i === cur ? ' aria-current="step"' : ''}>${i < cur ? icon('check') : ''}<span>${l}</span></li>`).join('')}</ol>`;
}
// ---- stage ribbon: how far a bill has walked towards becoming law (the one graphic worth keeping from the
// current app; assessment 9/19). Twelve steps: 'vetoed' and 'dead' are outcomes, not steps, so they colour the
// ribbon rather than adding a segment to it. A stopped bill still shows how far it got. ----
const RIBBON = STAGES.filter(([k]) => !['vetoed', 'dead', 'first_floor', 'second_floor', 'ballot'].includes(k));
// Waiting for the floor vote races Crossover (or the Cross back); an amendment for the ballot sits on the last steps (R-072).
const ON_RIBBON = { first_floor: 'first_crossover', second_floor: 'second_crossover', ballot: 'governor' };
// Which step is dark. Each committee step is a deadline (Triple filing, Lateral, Decking) and the dark one is the
// deadline the bill is racing. The sync's 'first_crossover' is the exception: it means the bill has ALREADY passed
// its first chamber and has no committee activity in the second yet (session_deadlines ends it at the second
// Lateral, not at Crossover). Drawn on Crossover, a bill waiting for its first House hearing read as not yet crossed
// over (SB2175, Nate 9/21), so it goes on the deadline the sentence under the ribbon names, with Crossover behind it.
// A stopped bill is marked where it stopped. Its stage is only 'dead'; died_at_stage says where, and died_deadline,
// quoted under the ribbon, names the deadline that ended it: 'introduced' at the first Lateral, 'first_crossover' at
// the second. Reading b.stage here drew every stopped bill as "Stopped after Introduced", the 45 of 2026 that died in
// conference included.
function ribbonKey(b, st) {
  if (st === 'vetoed') return 'governor';
  if (st === 'dead') {
    const at = b.died_at_stage || (b.stage !== 'dead' ? b.stage : null);   // the team set it dead: the sync's stage
    return at === 'introduced' ? 'first_lateral' : at === 'first_crossover' ? 'second_lateral' : ON_RIBBON[at] || at;
  }
  if (ON_RIBBON[st]) return ON_RIBBON[st];
  if (st !== 'first_crossover') return st;
  const k = stopOf(b).deadlineKey;   // second_triple | second_lateral | second_decking, or second_crossover once through
  return k === 'second_crossover' ? 'second_decking' : /^second_(triple|lateral|decking)$/.test(k || '') ? k : 'second_lateral';
}
export function stageRibbon(b, { labels = true } = {}) {
  const st = effStage(b), dead = st === 'dead', vetoed = st === 'vetoed';
  // No record of where it stopped (2 bills in 2026): no step is marked, rather than claiming Introduced.
  const key = ribbonKey(b, st), last = RIBBON.length - 1;
  const i = key ? Math.max(0, RIBBON.findIndex(([k]) => k === key)) : -1;
  const now = RIBBON[i]?.[1] || '';
  const said = dead ? (now ? `Stopped at ${now}` : 'Stopped') : vetoed ? 'Vetoed by the Governor' : st === 'ballot' ? 'Passed · the voters decide'
    : st === 'first_floor' || st === 'second_floor' ? 'Waiting for the floor vote' : i === last ? (/^(HCR|SCR|HR|SR)\d/.test(b.bill_number || '') ? 'Adopted' : 'Signed into law') : now;
  const tone = dead || vetoed ? ' stopped' : i === last ? ' done' : '';
  const set = b.stage_override ? ' · set by the team' : '';
  const gl = !dead && !vetoed && key ? STAGE_GLOSS[key] || '' : '';
  return `<div class="sv-rib${tone}" role="img" aria-label="${esc(`Stage: ${said}${set}.${i >= 0 ? ` Step ${i + 1} of ${RIBBON.length}.` : ''}${gl ? ' ' + gl : ''}`)}">${
    RIBBON.map(([, l], n) => `<i class="${n < i ? 'done' : n === i ? 'now' : ''}" title="${esc(l)}"></i>`).join('')
  }</div>${labels ? `<p class="sv-riblab" data-at="${i}"><span>${esc(RIBBON[0][1])}</span><b${gl ? ` title="${esc(gl)}"` : ''}>${esc(said)}${set ? `<span class="set">${esc(set)}</span>` : ''}</b><span>${esc(RIBBON[last][1])}</span></p>` : ''}`;
}

// The caption names the current step right under its own bar (R-005, option A, Nate 9/26). It used to sit halfway
// between "Introduced" and "Law" wherever the step was, up to two whole bars away, so it read as a mistake. Placing it
// needs the drawn bars, so it is measured after each redraw; until then (or with no step marked) the caption stays
// centred between the ends. An end label that the caption would touch is hidden, and so is the end the bill is at
// ("Introduced" under "Introduced"); the ribbon's own label still says it.
function anchorRibbons() {
  for (const p of document.querySelectorAll('.sv-riblab[data-at]')) {
    const at = +p.dataset.at, bars = p.previousElementSibling, seg = bars?.children?.[at], b = p.querySelector('b');
    const [first, last] = [p.firstElementChild, p.lastElementChild];
    p.classList.remove('anch'); first.classList.remove('hid'); last.classList.remove('hid'); b.style.left = '';
    if (!(at >= 0) || !seg || !b || !p.offsetWidth) continue;
    p.classList.add('anch');
    const W = p.clientWidth, w = b.offsetWidth, box = p.getBoundingClientRect(), r = seg.getBoundingClientRect();
    if (w > W) { p.classList.remove('anch'); continue; }
    const x = Math.min(Math.max(0, r.left + r.width / 2 - box.left - w / 2), W - w);
    b.style.left = Math.round(x) + 'px';
    const gap = 8, n = bars.children.length;
    if (at === 0 || first.offsetWidth + gap > x) first.classList.add('hid');
    if (at === n - 1 || W - last.offsetWidth - gap < x + w) last.classList.add('hid');
  }
}
// Desktop: a page's own back link ("Bills", "Legislators", "Emails", "Help"...) sits at the top of the page and scrolled
// away with it, so going back from far down meant scrolling up first (R-005; plan wave 6a: the person, legislator,
// composer, list, Bills filter and Help pages, then the hearing and coalition pages). Once it has gone under the
// header, the same link comes back in the header's own row, at its left before the search box; pressing it presses the
// page's own link, so real Back, the leave guards and the label all stay the page's. (v6: the bill page's Back too.)
// v6: it sat on the page, fixed under the header with a shadow, and covered the left edge of whatever scrolled under it
// (the bill's File at the Capitol button, its Message tab): a sticker over the work, and a click aimed there went Back
// (A-8, A-13, A-17). In the header it covers nothing and has no shadow of its own.
const DESKBACK = '.co-deskback, .hr-deskback, .bl-deskback, .lg-deskback, .le-deskback, .sp-deskback, .st-crumb, .bw-back';   // v6: the bill page no longer pins its own bar (BILL)
function floatBack() {
  const head = document.querySelector('.sv-hdr'), main = document.getElementById('main');
  let fb = head?.querySelector('.sv-hback');
  const src = head && main && matchMedia('(min-width: 900px)').matches ? [...main.querySelectorAll(DESKBACK)].find(a => a.offsetParent) : null;
  const hdr = head?.getBoundingClientRect().bottom || 56;
  if (!src || src.getBoundingClientRect().bottom > hdr || document.querySelector('dialog[open]')) { if (fb && !fb.hidden) fb.hidden = true; return; }
  if (!fb) { fb = document.createElement('button'); fb.type = 'button'; fb.className = 'sv-hback'; fb.hidden = true;
    const box = head.querySelector('.sv-search'); box ? box.before(fb) : head.prepend(fb);
    fb.onclick = () => fb.src?.isConnected && fb.src.click(); }
  const label = src.textContent.trim();
  if (fb.src !== src) { fb.src = src; fb.innerHTML = `${icon('chevron-left')}<span>${esc(label)}</span>`; fb.setAttribute('aria-label', src.getAttribute('aria-label') || `Back to ${label}`); }
  if (fb.hidden) fb.hidden = false;
}
let ribRaf = 0;
const ribSoon = () => { if (!ribRaf) ribRaf = requestAnimationFrame(() => { ribRaf = 0; anchorRibbons(); floatBack(); }); };
if (typeof MutationObserver === 'function' && document.body) new MutationObserver(recs => { if (recs.some(r => r.addedNodes.length)) ribSoon(); }).observe(document.body, { childList: true, subtree: true });
addEventListener('resize', ribSoon);
let fbRaf = 0;
addEventListener('scroll', () => { if (!fbRaf) fbRaf = requestAnimationFrame(() => { fbRaf = 0; floatBack(); }); }, { passive: true });

// ---- urgency mark: the current app's left-rail block, kept because it is the fastest thing to scan down a long
// list (assessment 9/19). Never colour alone: the number, the word and, when late, an icon all say the same thing. ----
// v4 (R-269): \`act\` names what the hours are for. A late-testimony mark on an approval says "to approve" (Jess does not
// file; "4h to file" on her approval read as a filing task), on everything else "to file".
// R-271 (Nate 10/13): before it is late the block says the same verb ("5h to approve", "27h to file"), not "5h left",
// which said a bill was due but not what was asked; a caller with no verb keeps "left".
export function urgentMark(iso, { done = false, until = null, act = null } = {}) {
  if (done) return `<span class="sv-urg done" role="img" aria-label="Done">${icon('check')}</span>`;
  if (!iso) return '<span class="sv-urg none" aria-hidden="true"></span>';
  const tone = timeTone(iso, { until });
  if (tone === 'lateok') { return `<span class="sv-urg lateok" role="img" aria-label="${esc(lateLine(until))}">${icon('alarm-clock')}<b>${esc(spanOf(until, { short: true }))}</b><span>${esc(act || 'to file')}</span></span>`; }   // the hours left to file late ("late" read as "4 hours late")
  const big = spanOf(iso, { short: true });   // "28m", "4h", "3d", rounded down (R-022); R-277 fix 3: one rounding with the words
  const word = tone === 'late' ? 'overdue' : act || 'left';   // one word for time still to run, hours or days (R-152 C: it said "to go" past 48 hours)
  // R-352: a plain clock when due today, the alarm clock once passed, neutral further out; the words say which (WCAG 1.4.1).
  return `<span class="sv-urg${tone ? ' ' + tone : ''}" role="img" aria-label="${esc(`${big} ${word}${tone === 'today' ? ', due today' : ''}`)}">${tone === 'late' ? icon('alarm-clock') : tone === 'today' ? icon('clock') : ''}<b>${esc(big)}</b><span>${word}</span></span>`;
}

export const empty = ({ title, text = '', action = '', h = 'h2', art = '' }) => `<div class="empty">${art}${title ? `<${h}>${title}</${h}>` : ''}${text ? `<p>${text}</p>` : ''}${action}</div>`;
export const skeleton = (n = 5) => `<div class="skelpage" aria-busy="true" aria-label="Loading"><div class="skel" style="height:56px"></div>${Array.from({ length: n }, () => '<div class="skel" style="height:72px"></div>').join('')}</div>`;
export const notice = (tone, ic, html, action = '') => `<div class="notice ${tone} sv-notice">${icon(ic)}<div>${html}</div>${action}</div>`;
export const inlineErr = (id, text) => `<div class="inlinemsg" id="${esc(id)}" role="alert">${icon('circle-alert')}<span>${esc(text)}</span></div>`;

// ---- toast: one at a time, in #toast; Undo keeps it 10 seconds ----
export function toast(msg, opt = {}) {
  if (opt === true) opt = { err: true };
  // R-316 W43: a step refused because a teammate already took it is news, not a failure ("Nate approved it at 9:42 AM.").
  if (opt.err && msg?.raced) { opt = { ...opt, err: false }; msg = msg.message; }
  const box = document.getElementById('toast'); if (!box) return;
  // A toast raised while a sheet is open has to live inside that sheet. #toast sits in the ordinary page, and the
  // browser puts an open <dialog> in the top layer above everything there, so an Undo button left outside could be
  // seen but never clicked (found on Bills' saved views, 9/19). Anywhere else it goes to #toast as before.
  const dlg = document.querySelector('dialog[open]');
  const host = dlg || box;
  // R-277 fix 8 (E-9): an error stays until it is closed. It vanished after 4 s, so a "Mark filed" that did not save
  // went by unread and the step quietly came back. A new message replaces the last one, but never an error still open
  // (a newer error replaces the older one, so they never pile up).
  const clear = () => { document.querySelectorAll(opt.err ? '.toastmsg' : '.toastmsg:not(.err)').forEach(t => t.remove()); placeToast(); };
  document.querySelectorAll(opt.err ? '.toastmsg' : '.toastmsg:not(.err)').forEach(t => t.remove());
  // v6 (spec 4, A-15, A-16): one warm card for every message, its icon by tone: a leaf check for done, a neutral "i" for
  // anything else (Send back, Pulled back to draft, Saved: said no), an alert for a save that failed. The dark slab is gone
  // (it was the only cold surface in the app). The icon never shrinks beside a long sentence (staff.css: flex none, 20px).
  const el = document.createElement('div'); el.className = 'toastmsg' + (opt.err ? ' err' : opt.ok ? ' yay' : ' note');
  const mark = opt.ok ? `<svg class="v6-tic" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="9.5" fill="currentColor"/><path class="ck" d="M5.5 10.4l3 3 6-6.6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : icon(opt.err ? 'circle-alert' : 'info', { size: 20, cls: 'v6-tic' });
  el.innerHTML = mark + `<span>${esc(opt.err ? friendly(msg) : msg)}</span>` + (opt.undo ? '<button type="button" class="toastundo">Undo</button>' : '') + (opt.action ? `<button type="button" class="toastundo toastact">${esc(opt.action.label)}</button>` : '');
  // An Undo belongs to the page it was raised on (A-16, B-5): app.js closes it when the person moves to another page, so it
  // can never quietly take back something from a page they have left. `at` lets the step's own move (Review's next item, a
  // save that opens the bill) take it along.
  if (opt.undo || opt.action) { el.dataset.undo = '1'; el.dataset.at = String(Math.round(performance.now())); }
  if (opt.undo) el.querySelector('.toastundo').onclick = async () => { clear(); try { await opt.undo(); } catch (e) { toast(e, true); } };
  if (opt.action) el.querySelector('.toastact').onclick = () => { clear(); opt.action.run(); };
  // One with a button can be closed (it could sit on top of the bill tabs for ten seconds), and any toast someone is
  // reading or reaching for stays put: its clock starts again when they leave it.
  if (opt.undo || opt.action || opt.err) { el.insertAdjacentHTML('beforeend', `<button type="button" class="toastx" aria-label="Dismiss">${icon('x')}</button>`); el.querySelector('.toastx').onclick = () => { el.remove(); placeToast(); }; }
  if (opt.err) { el.setAttribute('role', 'alert'); host.appendChild(el); stack(el); placeToast(); return; }   // no clock: it waits for its X
  const arm = () => { clearTimeout(toast.t); toast.t = setTimeout(() => { if (el.isConnected) { el.remove(); placeToast(); } }, opt.undo || opt.action ? 10000 : 4000); }, hold = () => clearTimeout(toast.t);
  el.addEventListener('mouseenter', hold); el.addEventListener('mouseleave', arm); el.addEventListener('focusin', hold); el.addEventListener('focusout', arm);
  if (dlg) el.classList.add('insheet');
  host.appendChild(el); stack(el); arm(); placeToast();
}
// A long message on a narrow phone ran six lines beside its Undo (192px tall at 320px): past three lines, Undo moves under the
// words and the words take the card's width (staff.css .stack), which is shorter from there on.
function stack(el) { const t = el.querySelector(':scope > span'); if (t && el.querySelector('.toastundo') && t.offsetHeight > 76) el.classList.add('stack'); }
// Below 768px the messages sit above the bottom tab bar AND any action bar showing over it (Review's Send back | Approve, or
// a screen's own bar marked data-v6-bar), 8px clear, so a toast never covers the next step's buttons (spec 3.2, B-5, A-16).
// The page also gets the messages' height again at its foot (staff.css reads --v6-toast-h), so whatever a toast does cover
// can be scrolled out from under it. app.js calls this after every draw too: a bar can come or go under a toast.
export function placeToast() {
  const box = document.getElementById('toast'); if (!box) return;
  const shown = [...box.children].some(t => t.getClientRects().length);
  document.body.style.setProperty('--v6-toast-h', shown ? `${Math.ceil(box.getBoundingClientRect().height) + 8}px` : '0px');
  if (innerWidth >= 768) { box.style.removeProperty('bottom'); return; }
  let top = innerHeight;
  document.querySelectorAll('.sv-tabs, main .actionbar, [data-v6-bar]').forEach(b => {
    if (!b.getClientRects().length) return; const r = b.getBoundingClientRect();
    if (r.height > 0 && r.top < top && r.top > innerHeight / 3 && r.bottom > innerHeight - 240) top = r.top;   // bars at the window's foot only
  });
  box.style.bottom = `${Math.round(innerHeight - top + 8)}px`;
}
// Leaving a page closes a message that carries an Undo (or a step's button): it would act on the page left behind, and it
// sat over the next page's own messages (A-16, B-5). One raised in the last moment goes along (the step's own move to the
// next item or page). A new message always replaces the last one (toast above); an error still waits for its X (R-277 fix 8).
export function leavePageToasts() {
  const now = performance.now();
  let gone = false;
  document.querySelectorAll('#toast .toastmsg[data-undo]').forEach(t => { if (now - (+t.dataset.at || 0) > 700) { t.remove(); gone = true; } });
  if (gone) placeToast();
}
// Keyboard shortcuts can be switched off in My settings (a stray letter should never do anything for someone who does
// not use them). Every keydown handler in v2 checks this first.
export const keysOn = () => { try { return localStorage.getItem('sv_keys') !== 'off'; } catch { return true; } };
// R-277 fix 13 (E-11): the lines that list a page's keys ("J K next and previous bill …") show only to someone who has used
// a shortcut key: for everyone else they were one more line to read on Bills, Review and the Inbox (and on phones). The
// first shortcut key pressed outside a text box marks this device; the hints show from the next redraw on.
const KEYS_SEEN = 'sv_keysused';
export const keysUsed = () => { try { return localStorage.getItem(KEYS_SEEN) === '1'; } catch { return false; } };
const SHORTCUT = /^(j|k|x|e|r|o|t|n|l|u|J|K|X|E|R|O|T|N|L|U|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|\/)$/;
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey || !SHORTCUT.test(e.key) && !(e.shiftKey && e.key === 'A')) return;
  const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
  if (!keysOn() || keysUsed()) return;
  try { localStorage.setItem(KEYS_SEEN, '1'); } catch { /* private mode: the hints stay hidden */ }
}, true);
export const setKeys = on => { try { if (on) localStorage.removeItem('sv_keys'); else localStorage.setItem('sv_keys', 'off'); } catch { /* private mode */ } };
const DESK = () => { try { return matchMedia('(min-width: 900px) and (hover: hover) and (pointer: fine)').matches; } catch { return false; } };
// A refusal the database raised on purpose (RAISE EXCEPTION, SQLSTATE P0001) is a sentence written for people: "Someone else has to
// approve testimony you sent for review". It is shown as it is, tidied (no "(status is filed)" or "(Jess or Jaylen)", a capital, a full
// stop), instead of "Check your connection" (X4-7, B-8). Everything else keeps the old rules.
const tidy = m => { const t = m.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim().replace(/^./, c => c.toUpperCase()); return /[.!?]$/.test(t) ? t : t + '.'; };
export function friendly(e) {
  const m = String(e?.message || e || '');
  if (e && e.code === 'P0001' && m.length >= 8 && m.length <= 240 && !/(sqlstate|violates|relation |column |function public|jwt)/i.test(m)) return tidy(m);
  if (/rate limit|too many/i.test(m)) return 'Too many tries in a row. Wait a minute and try again.';
  if (/refus|hearing ahead|has a .* hearing/i.test(m)) return m;          // the server's own sentence (e.g. mute refused)
  if (/^[A-Z][^{}<>]{3,160}[.!]$/.test(m) && !/(error|exception|fetch|null|undefined|column|relation|violates|jwt|token|permission)/i.test(m)) return m;
  return 'That did not save. Check your connection and try again.';
}

// ---- sheets: one at a time (never stacked), bottom sheet on phones, 560px dialog on desktop. Back closes it (it
// pushes a history entry), Esc closes it, focus moves into it and returns to where it was. ----
let cur = null;
export const sheetOpen = () => !!cur;
// What was just clicked or activated: on a desktop a menu or picker opens beside it, not in the middle of the window
// 900px away (assessment, 9/19). Captured before any handler runs, and only trusted for a moment.
let trigger = null, triggerAt = 0;
document.addEventListener('click', e => { trigger = e.target?.closest?.('button, a, [role="button"]') || null; triggerAt = performance.now(); }, true);
const anchorNow = () => trigger && trigger.isConnected && performance.now() - triggerAt < 400 && !trigger.closest('dialog') ? trigger : null;
function place(d, anchor) {
  const r = anchor.getBoundingClientRect(), w = d.offsetWidth, h = d.offsetHeight, m = 8;
  let left = r.left; if (left + w > innerWidth - m) left = Math.max(m, r.right - w);
  let top = r.bottom + 6; if (top + h > innerHeight - m) top = r.top - h - 6 >= m ? r.top - h - 6 : Math.max(m, innerHeight - h - m);
  d.style.left = Math.round(left) + 'px'; d.style.top = Math.round(top) + 'px';
}
export function openSheet({ title, body, foot = '', size = 'half', onClose, wire, pop = false } = {}) {
  // A sheet opened from another sheet takes over its Back entry instead of undoing it and pushing a new one
  // (a Back that lands late would otherwise undo the new sheet's entry).
  let reuse = false, back = document.activeElement;
  if (cur) { reuse = cur.pushed; back = cur.back; cur.d.close(); cur.d.remove(); cur = null; }
  const anchor = pop && DESK() ? anchorNow() : null;
  const d = document.createElement('dialog'); d.className = `sv-sheet ${size}${anchor ? ' sv-pop' : ''}`; d.setAttribute('aria-labelledby', 'sv-sh-t');
  d.innerHTML = `<div class="sv-sh-grab" aria-hidden="true"></div><div class="sv-sh-head"><h2 id="sv-sh-t" tabindex="-1">${title}</h2>${iconBtn('x', 'Close', { 'data-shclose': '1' })}</div><div class="sv-sh-body">${body}</div>${foot ? `<div class="sv-sh-foot">${foot}</div>` : ''}`;
  document.body.appendChild(d);
  cur = { d, back, onClose, pushed: true };
  if (!reuse) history.pushState({ ...(history.state || {}), sheet: true }, '');
  d.addEventListener('cancel', e => { e.preventDefault(); closeSheet(); });
  d.addEventListener('click', e => { if (e.target === d) closeSheet(); });
  d.querySelector('[data-shclose]').onclick = () => closeSheet();
  // Opening a sheet never moves the page under it (B-4, B-6): an anchored popover is fixed, and with no top or left yet its
  // place would be the page's foot, which showModal's focus scrolled the page to (the You menu moved Today down 376px).
  // It is put at the corner first, then by its button; any scroll the browser makes anyway is put back.
  const y0 = window.scrollY;
  if (anchor) { d.style.left = '0px'; d.style.top = '0px'; }
  d.showModal();
  if (anchor) place(d, anchor);
  // Focus: a field marked autofocus; else, with a keyboard and mouse, the thing Enter should do (the chosen option,
  // the first menu item, the main button), so "open, Enter" works; else the heading, which a screen reader reads first.
  // (one selector per try: a comma list answers with whichever comes first in the page, not the first in the list)
  const pick = (...sels) => { for (const q of sels) { const el = d.querySelector(q); if (el) return el; } return null; };
  const first = d.querySelector('[autofocus]') || (DESK() ? pick('[role="radio"][aria-checked="true"]', '.sv-menu button:not([aria-disabled="true"])', '.sv-pickl button', '.sv-sh-foot .btn.primary', '.sv-sh-foot .btn.danger') : null) || d.querySelector('#sv-sh-t');
  first?.focus?.({ preventScroll: true });
  if (window.scrollY !== y0) window.scrollTo(0, y0);
  // Arrow keys move through a menu or a picker; Home and End jump.
  d.addEventListener('keydown', e => {
    const list = e.target?.closest?.('.sv-menu, .sv-pickl'); if (!list || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const items = [...list.querySelectorAll('button')], i = items.indexOf(e.target.closest('button')); if (!items.length) return;
    e.preventDefault(); (e.key === 'Home' ? items[0] : e.key === 'End' ? items[items.length - 1] : items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]).focus();
  });
  if (wire) wire(d);
  sheetFade(d);
  return d;
}
// A sheet taller than the window scrolls inside itself, under its head (staff.css caps it at the window), and its foot fades
// while more is below, so the last choice ("No owner" in Give HB 2458 to...) is always in reach and something says so (A-1, B-4).
function sheetFade(d) {
  const body = d.querySelector('.sv-sh-body'); if (!body) return;
  const ends = () => body.classList.toggle('v6-more-below', body.scrollHeight - body.clientHeight - body.scrollTop > 2);
  ends(); body.addEventListener('scroll', ends, { passive: true });
  try { const ro = new ResizeObserver(ends); ro.observe(body); [...body.children].forEach(c => ro.observe(c)); } catch { /* old browsers: the open and scroll checks still run */ }
}
// closeSheet(): from a button (steps history back once) or from Back (fromPop: the entry is already gone). It returns
// a promise that settles once that Back has landed, so whatever comes next (a page, another sheet) is not undone by it.
let ignorePop = false, waiting = [];
export function closeSheet({ fromPop = false, silent = false } = {}) {
  if (!cur) return Promise.resolve(false);
  const { d, back, onClose, pushed } = cur; cur = null;
  d.close(); d.remove();
  const done = new Promise(res => {
    if (pushed && !fromPop) { ignorePop = true; waiting.push(res); setTimeout(() => res(true), 450); history.back(); } else res(true);
  });
  if (!silent && onClose) onClose();
  if (back && back.isConnected) back.focus?.({ preventScroll: true });
  return done;
}
// app.js calls this first on popstate; true means "that Back only closed a sheet".
export function popSheet() {
  if (ignorePop) { ignorePop = false; const w = waiting; waiting = []; w.forEach(f => setTimeout(() => f(true), 0)); return true; }
  if (!cur) return false;
  closeSheet({ fromPop: true }); return true;
}
// For app.js: a page change while a sheet is open reuses the sheet's history entry (replace instead of push).
export function takeSheetEntry() { if (!cur) return false; closeSheet({ fromPop: true, silent: true }); return true; }
// A picker: one choice from a list, saves on tap. options: [[value, label, icon?, sub?]]
export function pickerSheet({ title, options, value, onPick, help = '' }) {
  return openSheet({ title, pop: true, body: `${help ? `<p class="small muted sv-sh-help">${help}</p>` : ''}<div class="sv-pickl" role="radiogroup" aria-label="${esc(title)}">${options.map(([v, l, ic, sub]) => `<button type="button" role="radio" aria-checked="${String(v) === String(value)}" data-pv="${esc(v)}">${ic ? icon(ic) : ''}<span class="body"><span class="title">${esc(l)}</span>${sub ? `<span class="sub">${esc(sub)}</span>` : ''}</span>${String(v) === String(value) ? icon('check', { cls: 'on' }) : ''}</button>`).join('')}</div>`,
    wire: d => d.querySelectorAll('[data-pv]').forEach(el => el.onclick = async () => { await closeSheet({ silent: true }); await onPick(el.dataset.pv); }) });
}
// A menu of actions (the ⋯ menus). items: [{ label, icon, danger, disabled, reason, run }]
export function menuSheet({ title = 'More', items }) {
  return openSheet({ title, pop: true, body: `<div class="sv-menu">${items.filter(Boolean).map((it, i) => `<button type="button" data-mi="${i}" class="${it.danger ? 'danger' : ''}" ${it.disabled ? 'aria-disabled="true"' : ''}>${icon(it.icon || 'chevron-right')}<span class="body"><span class="title">${esc(it.label)}</span>${it.disabled && it.reason ? `<span class="sub">${esc(it.reason)}</span>` : it.sub ? `<span class="sub">${esc(it.sub)}</span>` : ''}</span></button>`).join('')}</div>`,
    wire: d => { const list = items.filter(Boolean); d.querySelectorAll('[data-mi]').forEach(el => el.onclick = async () => { const it = list[+el.dataset.mi]; if (it.disabled) { if (it.reason) toast(it.reason); return; } await closeSheet({ silent: true }); await it.run(); }); } });
}
// Confirm in the app (never window.confirm): confirmSheet({ title, text, ok: 'Delete', danger: true }) -> Promise<boolean>
export function confirmSheet({ title, text = '', ok = 'OK', danger = false }) {
  return new Promise(res => {
    let done = false;
    openSheet({ title, size: 'auto', body: text ? `<p>${text}</p>` : '', foot: `${btn('Cancel', { kind: 'text', attrs: { 'data-no': '1' } })}${btn(ok, { kind: danger ? 'danger' : 'primary', attrs: { 'data-yes': '1' } })}`,
      onClose: () => { if (!done) res(false); },
      wire: d => { d.querySelector('[data-yes]').onclick = async () => { done = true; await closeSheet({ silent: true }); res(true); }; d.querySelector('[data-no]').onclick = async () => { done = true; await closeSheet({ silent: true }); res(false); }; } });
  });
}

// v3 (R-264): one row of tabs at the top of a section with sub-pages, the same at every width (B-13: the sidebar holds the
// places only). v6 (R-336, spec 3.3, D12): every place with sub-pages has its row here, in the spec's order and words, so
// placeHead (steps.js) and the screens draw the same tabs. Each tab: [key, address, label]. Addresses are the v6 ones; the
// old ones (#/outreach/issues, #/coalition) still open the same pages (app.js parseRoute redirects them).
// The Hearings tab that lists the bills still waiting for a hearing, in Nate's words and his title case (Nate 25 Oct walk 1:
// "Bills That Need Hearings", was "Get hearings"). One constant, so the tab, This week's line, Today's line, search and Help
// say the same name (C-15: one name per place). Its address stays #/hearings/ask.
export const ASK_TAB = 'Bills That Need Hearings';
// A list of names said as a list: "Sen. Lee, Sen. Chang and Sen. Richards", "and" only before the last (Nate 25 Oct walk 1:
// a chair card read "Sen. Lee and Sen. Chang and Sen. Richards"). Two names stay "A and B"; when a name holds its own "and"
// (a committee, "Health and Human Services") the last join takes a comma, as steps.js committeeName does, so it reads as two.
export const andWords = xs => { xs = (xs || []).filter(Boolean); if (xs.length < 2) return xs[0] || '';
  const inner = xs.some(x => / and /.test(x)) ? ', and ' : ' and ';
  return `${xs.slice(0, -1).join(', ')}${inner}${xs[xs.length - 1]}`; };
const SECTIONS = {
  // This week names its view (#/hearings/week): the bare #/hearings applies the opening rule (Get hearings when bills wait and
  // no hearing is this week, spec 3.3), so a tab to it could not always reach This week.
  hearings: ['Hearings', [['week', '#/hearings/week', 'This week'], ['ask', '#/hearings/ask', ASK_TAB]]],
  testimony: ['Testimony', [['write', '#/testimony?view=write', 'To write'], ['approve', '#/testimony?view=approve', 'To approve'], ['sent', '#/testimony?view=sent', 'Sent back'],
    ['file', '#/testimony?view=file', 'Ready to file'], ['filed', '#/testimony?view=filed', 'Filed'], ['missed', '#/testimony?view=missed', 'Missed']]],
  // v4 (R-269): Outreach is for rallying, so it opens on this week's asks; v6 adds Lists as its last tab (spec 3.3).
  outreach: ['Outreach', [['asks', '#/outreach', 'This week\u2019s asks'], ['partners', '#/outreach/partners', 'Partner update'], ['emails', '#/outreach/emails', 'Emails'],
    ['supporters', '#/outreach/supporters', 'Supporters'], ['lists', '#/outreach/lists', 'Lists']]],
  bills: ['Bills', [['bills', '#/bills', 'Bills'], ['new', '#/bills/new', 'Sort new bills'], ['muted', '#/bills/muted', 'Muted']]],
  // Who to ask names its view too: between sessions the bare #/legislators opens Everyone (spec 3.3).
  legislators: ['Legislators', [['ask', '#/legislators?view=ask', 'Who to ask'], ['everyone', '#/legislators?view=everyone', 'Everyone'], ['holding', '#/legislators?view=holding', 'Holding our bills']]],
  // My issues (R-263): the person's own first, then the coalitions, then every issue (spec 3.3's order).
  issues: ['My issues', [['mine', '#/my-issues', 'My issues'], ['coalitions', '#/my-issues/coalitions', 'Coalitions'], ['all', '#/my-issues/all?view=list', 'All issues'], ['cal', '#/my-issues/all?view=cal', 'Calendar']]],   // Calendar: R-342 (hearings.js CAL_WAYS)
  inbox: ['Inbox', [['messages', '#/inbox', 'Messages'], ['updates', '#/inbox?view=updates', 'Updates']]],
};
export const SECTION_TABS = kind => (SECTIONS[kind] || ['', []])[1].map(([k, href, label]) => ({ key: k, href, label }));
// sectionNav(kind, cur, { only, hide, counts }): `only` / `hide` list tab keys to show or leave out (Testimony's Missed only
// when any; Bills' Sort new bills only in the opening weeks or when there are new bills); `counts` puts a quiet number after
// a tab's word ({ approve: 3 }); a count is a fact, not an alarm, so it is never coloured (D3).
export function sectionNav(kind, cur, { only = null, hide = [], counts = {} } = {}) {
  const [label, items] = SECTIONS[kind] || ['', []];
  const shown = items.filter(([k]) => (!only || only.includes(k)) && !hide.includes(k));
  // Each label keeps room for its bold self (staff.css .sv-tl), so picking a tab never widens it and the row never reflows:
  // the next tab stays where the thumb left it on a phone (OUTREACH's critic finding).
  return `<nav class="sv-tabrow sv-secnav" aria-label="${esc(label)}">${shown.map(([k, href, l]) => `<a href="${href}"${k === cur ? ' aria-current="page"' : ''}><span class="sv-tl" data-label="${esc(l)}">${l}</span>${counts[k] ? ` <span class="sv-tn">${esc(counts[k])}</span>` : ''}</a>`).join('')}</nav>`;
}
// R-277 fix 20 (U-3): one switch did six jobs. Now a section's own pages are a row of tabs (sectionNav above, underlined, as
// the bill page's); a pill switch (segmented, whoseSeg) only shows the same list another way (Today | This week, Mine | Team);
// and a list that filters has one Filter button, this one, at the end of its heading row before the "…" (Bills, Legislators,
// Supporters, the prep board). `n`: how many filters are on.
export const filterBtn = (n = 0, a = {}, { popup = true } = {}) => `<button type="button" class="btn secondary sm sv-filter"${popup ? ' aria-haspopup="dialog"' : ''}${attrs(a)}>${icon('sliders-horizontal')}<span>Filter</span>${n ? `<span class="sv-fn" aria-label="${n} on">${n}</span>` : ''}</button>`;
