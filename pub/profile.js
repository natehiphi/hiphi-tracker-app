// Your profile (R-147, Nate 10/4; the plan and mockups: https://claude.ai/artifact/FSzXqzhDcJggJtbhkoNX1d).
//   #/profile  (and #/settings, its old address) the person: who they are, their stories, how they'd help, their alerts,
//              their issues and their data. Since R-165 (Nate 10/5) the page itself is the form: each change saves by itself.
// Nate's decisions: it sits in More, where apps put the person (More's first row; initials on the More tab and at the top
// right of a laptop's header, pub/app.js); only someone who gave a mobile number or an email has one ("No, only work with
// an email or phone number"), so without either this page is the invitation to add one (the R-146 box); "I'm a..." titles
// from the researched list or their own words (pub/titles.js, pub/titlepick.js); a saved story; no "speaking for a group".
// It replaces Settings, which it absorbs: the email choices, name, address and "How would you like to help?", your data,
// signing out and deleting the account. It no longer asks for a phone number for staff: the only number is the text-alert
// one, which staff never see (R-146); a number saved in Settings before stays on the account and is not shown here.
import { S, DEMO, app, esc, icon, toast, friendly, textSaved, followedIssues, HST, LEVELS, levelOf, setIssueLevel,
  LOCAL_KEY, DONE_KEY, DONE_AT_KEY, LISTS_KEY, STANCE_KEY, ISSUES_KEY, CATS_KEY, SKIPS_KEY, CONSENT_KEY, recomputeWatch } from './core.js';
import { btn, notice, inlineErr } from './ui.js';
import { CHOICES, check, busy, unbusy, submitBtn, say, myDistricts, distHTML, addrField, wireAddr, rememberDistricts } from './more.js';
import { alertFields, alertButton, wireAlertForm, phoneDigits, codeStep, confirmWords, LEVEL_WORDS, getsAlerts, levelSwitch, EMAIL_ALERTS, EMAIL_SAME, EMAIL_EVERY } from './alerts.js';
import { hasProfile, signedIn, myName, myTitles, myStory, myStories, storyName, quoteLevel, QUOTE, storyAsk, STORY_HINT, myInterests, HELP_GROUPS, HELP_KEYS,
  myHelpNote, initials, saveProfile, loadMe, forgetProfileOnDevice } from './myprofile.js';
import { pickerHTML, wirePicker } from './titlepick.js';
import { codesOn, myEmail, myNumber } from './phone.js';   // sign-in by text code (R-155)
import { titleLabel } from './titles.js';
import { logAct } from './visitlog.js';
import { lettersList, wireKept, wireDelete, LETTERS_LEDE } from './myletters.js';   // R-212 #27, #28
import { stopText } from './alerts.js';
// The calm redesign (R-303), only with ?rec=1: Profile keeps one page (R-165) but its alerts get their own page, "Your
// alerts" (#/alerts, pub/rec/alerts.js), and its first row leads there; "Your issues" goes (My issues is a tab, and its count
// was wrong: every bill an issue carries, mine-profile-alerts.md section 3).
import { REC } from './rec/kit.js';
import { youCss, youWait, backFrom, profileAlertsRow } from './rec/you.js';

const $ = s => document.querySelector(s);
const DISTRICTS_KEY = 'hiphi_districts';
// P: this visit's page (R-165: no section is ever "open"): the picker's and address box's state, stories added but not yet
// written, the delete question, "Your profile is made".
const P = { del: false, made: '' };
// Said aloud after a redraw: the region is drawn empty, then filled, so a screen reader reads it (R-156).
const announce = text => setTimeout(() => { const l = document.getElementById('pf-live'); if (l) l.textContent = text; }, 80);
const masked = d => `(${d.slice(0, 3)}) ••• ${d.slice(6)}`;
const place = () => { try { const d = JSON.parse(localStorage.getItem(DISTRICTS_KEY) || 'null'); return d?.label || ''; } catch { return ''; } };
const since = () => { const at = S.user?.created_at || textSaved()?.at; return at ? new Date(at).toLocaleDateString('en-US', { timeZone: HST, month: 'long', year: 'numeric' }) : ''; };
const av = (cls = 'pf-av') => { const i = initials(); return `<span class="${cls}" aria-hidden="true">${i ? esc(i) : icon('user')}</span>`; };
// ---------------- no profile yet: the invitation ----------------
function inviteView() {
  S.alertMode ??= 'phone';
  const b = alertButton('pf-alf');
  return `<div class="mr pf pf-invite${REC() ? ' yu' : ''}">${REC() ? backFrom('#/more', 'You') : ''}
    <header class="pagehead"><span class="pf-av pf-av-lg" aria-hidden="true">${icon('user')}</span><h1 class="hero">${codeStep('pf-alf') ? 'Check your texts' : 'Make your profile'}</h1>
      <p class="lede">${codeStep('pf-alf') ? 'Type the 6-digit code from the text to make your profile.' : 'Get a text or email when a bill on your issues has a hearing, in time to speak up. Your issues and letters stay saved. Free, and no password.'}</p></header>
    <form class="card mr-form mr-panel" id="pf-al" novalidate>${alertFields('pf-alf')}
      <div class="mr-send">${submitBtn(b.label, b.icon, 'pf-al-send')}</div></form>
    <p class="small muted pf-back">${codesOn() ? 'Made one before? <a href="#/signin?by=number">Sign in</a>' : 'Added your email before? <a href="#/signin">Sign in on this device</a>'}</p>
  </div>`;
}
function wireInvite() {
  wireAlertForm($('#pf-al'), { pfx: 'pf-alf', source: 'more', onDone: r => {
    // Said on the page, under the header (the review: a toast covered the first section's Save and Cancel).
    P.made = r.kind === 'phone' && r.confirmed ? 'Your profile is made. Text alerts are on.'
      : r.kind === 'phone' ? `Your profile is made. ${confirmWords(masked(phoneDigits(r.phone)))}` : '';
    app.render();
    if (r.kind !== 'phone') toast('Check your inbox: open the link to finish your profile.', { yay: true });
    requestAnimationFrame(() => $('#pf-h')?.focus());
  } });
}

// ---------------- the profile: edit on the page, then Save or Cancel (R-165) ----------------
// Nate 10/5, after his first look: "+Add" read wrong and didn't look like a button; the page looked editable before
// pressing it; "First open this box, then close it, then open another box, then close it." So the page itself is the
// form, with nothing to open or close. Then, the same day: "I think the lack of save button or undo button might hurt.
// People should be able to cancel their changes." His choice: a save bar. A change is kept as a draft (P.draft), and a
// bar at the bottom says "You have unsaved changes" with Cancel (everything back as saved) and Save. A draft survives
// leaving the page for another tab and a redraw; closing the browser tab with one asks first (the browser's own question).
const status = id => `<p class="pf-st" id="${id}"></p>`;
function flash(id, text, bad = false) {
  const el = document.getElementById(id); if (!el) return;
  el.classList.toggle('bad', bad); el.innerHTML = text ? `${icon(bad ? 'info' : 'circle-check')}<span>${esc(text)}</span>` : '';
}
// What is saved now, in the draft's shape.
function savedNow() {
  const d = myDistricts(), p = S.user?.prefs || {};
  return { name: myName(), titles: myTitles(), story: myStory(), stories: myStories(), quote: quoteLevel(),
    help: myInterests().filter(k => HELP_KEYS.includes(k)), helpNote: myHelpNote(),
    sd: d?.senate || null, hd: d?.house || null, addrQ: '',
    emails: { hearing_alerts: p.hearing_alerts === true, action_alerts: p.action_alerts === true },
    // How much each followed issue sends (R-299), and whether email follows those levels ('same') or brings every hearing.
    levels: Object.fromEntries(followedIssues().map(i => [i.id, levelOf(i.id)])), emailLevel: p.email_level === 'every' ? 'every' : 'same' };
}
const clone = o => JSON.parse(JSON.stringify(o));
// Compared as saved: words trimmed, empty stories dropped, choices in a set order.
const norm = d => JSON.stringify({ ...d, addrQ: '', name: d.name.trim(), story: d.story.trim(), helpNote: d.helpNote.trim(),
  stories: Object.fromEntries(Object.entries(d.stories).map(([k, v]) => [k, String(v).trim()]).filter(([, v]) => v).sort()),
  help: [...d.help].sort() });
const dirty = () => !!(P.base && P.draft) && norm(P.draft) !== norm(P.base);
const barHTML = () => `<p class="pf-barmsg" id="pf-barmsg" role="status">You have unsaved changes</p>
  ${btn('Cancel', { kind: 'secondary', attrs: { 'data-pf-cancel': '' } })}${btn('Save', { kind: 'primary', icon: 'check', attrs: { 'data-pf-save': '' } })}`;
// The bar comes and goes as the draft changes, without redrawing the page (a phone's keyboard stays up).
function paintBar() {
  const on = dirty(), main = $('#main'); if (!main) return;
  const bar = main.querySelector('.actionbar');
  if (on && !bar) {
    main.insertAdjacentHTML('beforeend', `<div class="actionbar pf-bar"><div class="inner">${barHTML()}</div></div>`);
    document.body.classList.add('hasbar'); wireBar(); announce('You have unsaved changes. Save is at the bottom.');
  } else if (!on && bar) { bar.remove(); document.body.classList.remove('hasbar'); }
  window.onbeforeunload = on ? e => { e.preventDefault(); e.returnValue = ''; return ''; } : null;
}
function wireBar() {
  const c = $('[data-pf-cancel]'), s = $('[data-pf-save]');
  if (c) c.onclick = () => { fresh(); window.onbeforeunload = null; app.render(); announce('Your changes are undone.');
    requestAnimationFrame(() => $('#pf-h')?.focus({ preventScroll: true })); };
  if (s) s.onclick = saveAll;
}
async function saveAll() {
  const b = $('[data-pf-save]'); if (!b || b.getAttribute('aria-busy')) return;
  const d = P.draft, base = P.base, patch = {};
  if (d.name.trim() !== base.name) patch.name = d.name;
  if (JSON.stringify(d.titles) !== JSON.stringify(base.titles)) patch.titles = d.titles;
  if (d.story.trim() !== base.story) patch.story = d.story;
  const st = Object.fromEntries(Object.entries(d.stories).map(([k, v]) => [k, String(v).trim()]).filter(([, v]) => v));
  if (JSON.stringify(st) !== JSON.stringify(base.stories)) patch.stories = st;
  if (d.quote !== base.quote) patch.quote = d.quote;
  if ([...d.help].sort().join() !== [...base.help].sort().join()) patch.interests = [...myInterests().filter(k => !HELP_KEYS.includes(k)), ...d.help];
  if (d.helpNote.trim() !== base.helpNote) patch.helpNote = d.helpNote;
  if (d.sd !== base.sd || d.hd !== base.hd) { patch.house = d.hd; patch.senate = d.sd; }
  const emails = JSON.stringify(d.emails) !== JSON.stringify(base.emails), elevel = d.emailLevel !== base.emailLevel;
  const levels = Object.entries(d.levels || {}).filter(([id, lv]) => lv !== (base.levels || {})[id]);
  busy(b, 'Saving…'); const m0 = $('#pf-barmsg'); if (m0) { m0.classList.remove('bad'); m0.setAttribute('role', 'status'); m0.textContent = 'Saving your changes…'; }
  try {
    if (Object.keys(patch).length) await saveProfile(patch);
    for (const [id, lv] of levels) if (!(await setIssueLevel(id, lv, 'profile', { quiet: true })))
      throw Object.assign(new Error(`We couldn’t save the alerts for ${S.issueById.get(id)?.name || 'an issue'}. Try Save again.`), { plain: true });
    // The email choices are consent, stamped as given here (C-4); how many hearing emails is a setting inside it (R-299).
    if ((emails || elevel) && S.user) {
      const prefs = { ...(S.user.prefs || {}), ...(emails ? { ...d.emails, consent_at: new Date().toISOString(), consent_source: 'profile', consent_version: null } : {}), ...(elevel ? { email_level: d.emailLevel } : {}) };
      if (!DEMO) { const { error } = await S.supa.from('public_users').update({ prefs }).eq('id', S.user.id); if (error) throw error; }
      S.user.prefs = prefs; if (emails) S.consentCard = false;
    }
  } catch (e) { unbusy(b); const m = $('#pf-barmsg'); if (m) { m.classList.add('bad'); m.setAttribute('role', 'alert'); m.textContent = e?.plain ? e.message : friendly(e); } return; }
  if ('house' in patch && d.sd) rememberDistricts(d.sd, d.hd, d.addrQ);
  fresh(); window.onbeforeunload = null; app.render();
  toast('Your profile is saved.', { yay: true }); announce('Your profile is saved.');
  requestAnimationFrame(() => $('#pf-h')?.focus({ preventScroll: true }));
}

// About you: name, "I'm a...", where you live.
function aboutBody() {
  const d = P.draft, dist = d.sd && d.hd;
  return `<div class="field pf-f"><label for="pf-name">Name</label>
      <input id="pf-name" type="text" value="${esc(d.name)}" maxlength="120" autocomplete="name" autocapitalize="words" enterkeyhint="done"></div>
    <div class="pf-f" id="pf-tp-host">${pickerHTML('pf', P.tp, { hint: 'Tap any that fit. Your letters can begin “As a parent, I support…”.' })}</div>
    <div class="pf-f pf-where">
      ${dist ? `<p class="mr-dist pf-curdist">${distHTML(d.sd, d.hd)}</p>` : ''}
      <p class="pf-promise">${icon('shield-check')}<span>We use your address once to find your senator and representative, then forget it. We keep only their district numbers.</span></p>
      ${addrField('pf-ad', P.addr, { label: dist ? 'Moved? Look up your new address' : 'Your home address', help: '' })}
      ${status('pf-ad-st')}</div>`;
}

// Your stories: one for any issue, and one for any issue they choose, the issues they follow first (R-165).
// A saved story has its own Delete (R-212 #28): emptying the box and pressing Save was the only way, and nothing said so.
function storyField(k, text) {
  const id = k ? `pf-st-${k}` : 'pf-st-any', name = storyName(k), saved = k ? P.base.stories[k] : P.base.story;
  return `<div class="field pf-f pf-story-f" data-story="${esc(k)}"><label for="${id}">${k ? `Your story about “${esc(name)}”` : 'Your story'}</label>
      <textarea id="${id}" rows="3" maxlength="600" autocapitalize="sentences" aria-describedby="pf-story-h">${esc(text)}</textarea>
      ${saved ? `<div class="pf-stdel">${btn('Delete this story', { kind: 'text', sm: true, icon: 'trash-2', attrs: { 'data-pf-stdel': k, 'aria-label': `Delete ${storyWhat(k)}` } })}</div>` : ''}</div>`;
}
const storyWhat = k => k ? `your story about “${storyName(k)}”` : 'your story';
const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
// Deleted at once, on this device and with the account, with Undo in its place until they leave the page (B-5).
// P.storyGone: every story deleted on this visit, each with its own Undo (the critic: a second delete took the first's away).
const storyGone = () => (P.storyGone || []).map(g => `<div class="notice ok pf-stgone">${icon('circle-check')}<div><p>${esc(cap(storyWhat(g.k)))} is deleted.</p>${btn('Undo', { kind: 'text', sm: true, icon: 'undo-2', attrs: { 'data-pf-stundo': g.k, 'aria-label': `Undo: bring back ${storyWhat(g.k)}` } })}</div></div>`).join('');
async function deleteStory(k) {
  const text = k ? P.base.stories[k] : P.base.story; if (!text) return;
  const rest = Object.fromEntries(Object.entries(P.base.stories).filter(([x]) => x !== k));
  try { await saveProfile(k ? { stories: rest } : { story: '' }); } catch (e) { toast(e, true); return; }
  if (k) { P.base.stories = rest; delete P.draft.stories[k]; P.newStories = P.newStories.filter(x => x !== k); } else { P.base.story = ''; P.draft.story = ''; }
  P.storyGone = [{ k, text }, ...(P.storyGone || []).filter(g => g.k !== k)]; paintBar();
  repaintStories(`[data-pf-stundo="${CSS.escape(k)}"]`); announce(`${cap(storyWhat(k))} is deleted.`);
}
async function undoStory(k) {
  const g = (P.storyGone || []).find(x => x.k === k); if (!g) return;
  try { await saveProfile(g.k ? { stories: { ...P.base.stories, [g.k]: g.text } } : { story: g.text }); } catch (e) { toast(e, true); return; }
  if (g.k) { P.base.stories = { ...P.base.stories, [g.k]: g.text }; P.draft.stories[g.k] = g.text; } else { P.base.story = g.text; P.draft.story = g.text; }
  P.storyGone = P.storyGone.filter(x => x !== g); paintBar();
  repaintStories(`[data-pf-stdel="${CSS.escape(g.k)}"]`);   // its Delete, not the box: a phone's keyboard stays down announce(`${cap(storyWhat(g.k))} is kept.`);
}
const storyKeys = () => [...new Set([...Object.keys(P.base.stories), ...P.newStories, ...Object.keys(P.draft.stories)])];
function storyBody() {
  const d = P.draft, keys = storyKeys(), have = new Set(keys);
  const follow = followedIssues().filter(i => !have.has(i.id)), others = (S.issues || []).filter(i => !have.has(i.id) && !follow.includes(i));
  return `<p class="pf-warm" id="pf-story-h">${esc(storyAsk(''))} ${esc(STORY_HINT)} We’ll put it in your letters, and you can change it in each one.</p>
    <p class="small muted">Testimony is public: a story you send is posted with your letter.</p>
    ${storyGone()}
    ${storyField('', d.story)}
    ${keys.map(k => storyField(k, d.stories[k] || '')).join('')}
    ${keys.length < 20 && (follow.length || others.length) ? `<div class="field pf-f pf-addstory"><label for="pf-st-add">Add a story about one issue</label>
      <select id="pf-st-add"><option value="">Choose an issue</option>${follow.length ? `<optgroup label="Issues you follow">${follow.map(i => `<option value="${esc(i.id)}">${esc(i.name)}</option>`).join('')}</optgroup>` : ''}
        ${others.length ? `<option value="other">Another issue…</option>` : ''}</select>
      ${P.otherOpen ? `<label class="sr" for="pf-st-other">Another issue</label><select id="pf-st-other"><option value="">Choose another issue</option>${(S.cats || []).map(c => {
        const xs = others.filter(i => (i.categories || [i.category]).includes(c.key)); return xs.length ? `<optgroup label="${esc(c.name)}">${xs.map(i => `<option value="${esc(i.id)}">${esc(i.name)}</option>`).join('')}</optgroup>` : ''; }).join('')}</select>` : ''}</div>` : ''}
    <fieldset class="mr-set pf-f" id="pf-quote-f"><legend>Can HIPHI quote your stories?</legend>
      <p class="small muted">This applies to all of them. HIPHI asks you again before using one anywhere public.</p>
      ${[['', 'No'], ...QUOTE].map(([k, l]) => radio('pf-quote', k, l, d.quote === k)).join('')}</fieldset>`;
}
const radio = (name, v, title, on) => `<label class="check mr-check" for="${name}-${v || 'no'}"><input type="radio" name="${name}" id="${name}-${v || 'no'}" value="${v}"${on ? ' checked' : ''}><span class="mr-ctext"><span class="mr-ctitle">${esc(title)}</span></span></label>`;

// How you'll help (R-165): warm, four groups and their own words.
// The line under a tick that needs one. "Connect HIPHI with my organization" was a dead end (R-212 #24): ticked, with no
// place to say which one; it now points to the box at the end.
const HELP_HINT = { testify: 'We’ll show you how to sign up to speak when a hearing on your issues is set.',
  org: 'Type its name in the box below, and HIPHI’s team will be in touch.' };
function helpBody() {
  const ints = new Set(P.draft.help);
  return `<p class="pf-warm">Every bit helps, and there’s no wrong way to pitch in. Tick anything that sounds like you, and HIPHI will invite you to the things that fit.</p>
    ${HELP_GROUPS.map(([g, xs]) => `<fieldset class="mr-set pf-f pf-helpg"><legend>${esc(g)}</legend>
      ${xs.map(([k, l]) => check(`pf-int-${k}`, esc(l), HELP_HINT[k] || '', ints.has(k), ` data-pf-int="${k}"`)).join('')}</fieldset>`).join('')}
    <div class="field pf-f"><label for="pf-note">Something else? Tell us</label>
      <input id="pf-note" type="text" maxlength="200" value="${esc(P.draft.helpNote)}" autocapitalize="sentences" enterkeyhint="done" placeholder="Like cooking for a rally"></div>`;
}

// Alerts: the email choices are part of the same draft (R-165), and so is how much each issue sends (R-299).
// How much each followed issue sends (R-299): one row per issue, its name and the issue page's sliding switch under it (Nate
// 17 Oct, of three pictures: "A switch for each issue"), so a person meets one control for this everywhere. Kept with the
// rest at Save, like every choice in Profile. The line over them says what each name sends, in the switch's order (the
// critic, 17 Oct: it said nothing of App only), once for all the issues rather than under each switch.
function levelsBody() {
  const iss = followedIssues(); if (!iss.length || !getsAlerts()) return '';
  const d = P.draft.levels || {};
  return `<fieldset class="mr-set pf-f pf-lvls"><legend>Alerts for each issue</legend>
      <p class="small muted" id="pf-lv-h">${esc(LEVEL_WORDS.every)}: never more than one a day. ${esc(LEVEL_WORDS.big)}: usually a few a month. ${esc(LEVEL_WORDS.app)}: no texts or emails.</p>
      <ul class="pf-lvlist">${iss.map(i => `<li class="pf-lvrow"><p class="pf-lvn" id="pf-lv-${esc(i.id)}-n">${esc(i.name)}</p>
        ${levelSwitch(LEVELS.includes(d[i.id]) ? d[i.id] : 'big', { name: `pf-lv-${esc(i.id)}`, a: `aria-labelledby="pf-lv-${esc(i.id)}-n" aria-describedby="pf-lv-h"`, data: ` data-pf-lv="${esc(i.id)}"` })}</li>`).join('')}</ul></fieldset>`;
}
// The words for the email boxes (EMAIL_ALERTS, EMAIL_SAME, EMAIL_EVERY) live in alerts.js, shared with "Your alerts" (R-303).
const emailLevelSet = (e, lv) => followedIssues().length ? `<fieldset class="mr-set pf-f pf-elv" id="pf-elv"${e.hearing_alerts ? '' : ' hidden'}><legend>Hearing emails</legend>
    ${radio('pf-elv', 'same', EMAIL_SAME, lv !== 'every')}${radio('pf-elv', 'every', EMAIL_EVERY, lv === 'every')}</fieldset>` : '';
function alertsBody() {
  const t = textSaved(), e = P.draft.emails;
  // The texts' state by the one rule (alerts.js alertStatus, D1-4): on only once the number is confirmed; before that
  // "Almost set" with the alerts step's own words. It read as on for any number. Since R-299 what they bring is each
  // issue's level (below), so the line says what texts are for, in the sign-up's own words (t5), not "at most one a day".
  const num = t ? `<span class="strong">${esc(masked(t.phone))}</span>` : '';
  const texts = t ? `<p>${icon('message-square')} ${t.confirmed ? `<b>Text alerts are on</b> for ${num}, when your voice matters most.` : `<b>Almost set.</b> ${confirmWords(num)}`}</p><p class="small"><a href="#/alerts">Change number or stop texts</a></p>`
    : `<p>${icon('message-square')} Texts: off. <a href="#/alerts">Get text alerts</a></p>`;
  // A profile made with a number (R-155) has no email until it adds one: no email choices to show or change.
  const email = signedIn() && myEmail() ? `<fieldset class="mr-set pf-f"><legend>Emails to <span class="mr-break">${esc(myEmail())}</span></legend>
      ${CHOICES.map(([k, key, t2, h]) => check(`pf-em-${k}`, key === 'hearing_alerts' && followedIssues().length ? EMAIL_ALERTS : t2, h, e[key] === true, ` data-pf-em="${key}"`)).join('')}
      ${emailLevelSet(e, P.draft.emailLevel)}
      <p class="small muted">Every email has a one-click unsubscribe.</p></fieldset>`
    : signedIn() ? `<p>${icon('mail')} Email: not added. <a href="#/signin">Add your email</a> to get alerts by email too.</p>`
    : `<p>${icon('mail')} Email: not added. <a href="#/signin">Add your email</a> to get alerts by email and keep your profile on any phone.</p>`;
  return `${texts}${levelsBody()}${email}`;
}

// One line (the review: My issues is a tab and Your session is More's next row, so a second set of links said it twice).
function issuesBody() {
  const n = followedIssues().length, b = S.watch?.size || 0;
  return `<p>${n || b ? `You follow ${n ? `${n} ${n === 1 ? 'issue' : 'issues'}` : ''}${n && b ? ' and ' : ''}${b ? `${b} ${b === 1 ? 'bill' : 'bills'}` : ''}.` : 'You don’t follow any issues yet.'} <a href="#/bills">${n || b ? 'See them in My issues' : 'Find issues to follow'}</a></p>`;
}
function dataBody() {
  if (!signedIn()) return `<p>Your profile is saved on this phone. ${codesOn() ? '<a href="#/signin?by=number">Sign in with your number</a> to keep it on any phone or computer.' : 'Adding your email (under Alerts) keeps it on any phone or computer.'} HIPHI staff never see your text-alert number. We never sell your information or give it to other groups. <a href="#/privacy">Read about privacy</a></p>
    ${deviceDelete()}`;
  // What we keep and who sees it, as a short list (X4-5, R-180: it was one 90-word paragraph, well above grade 8). The same
  // facts as R-151's and R-153's wording (10/4, the privacy page made accurate; kept emails); the privacy page has the long
  // form. Signed in with a number only (R-155): the number signs them in and staff never see it; no email, so none opened.
  const num = !myEmail();
  const rows = [num ? 'Your mobile number, which signs you in' : 'Your email and your email choices',
    'The issues you picked, and the bills and lists you follow',
    'Where you stand on each bill you follow: support, oppose or not sure',
    num ? 'The actions you mark' : 'The actions you mark, and which of our emails you open',
    'What you add on this page, like your titles and your story',
    'The last letter and email to lawmakers you sent on each bill, so they’re ready for its next step'];
  return `<p>We keep:</p><ul class="pf-list pf-keep">${rows.map(r => `<li>${icon('check')}<span>${r}</span></li>`).join('')}</ul>
    <p>HIPHI staff can see all of it except ${num ? 'your number, ' : ''}your letters and your emails to lawmakers. Only you can see those.</p>
    <p>We never keep your street address, only your districts. We never sell your information or give it to other groups. <a href="#/privacy">Read about privacy</a></p>
    ${accountButtons()}`;
}
// Sign out and delete, for every signed-in profile (an email or a number).
function accountButtons() {
  return `<div class="btnrow">${btn('Sign out', { kind: 'secondary', sm: true, icon: 'log-out', attrs: { 'data-pf-signout': '' } })}</div>
    ${P.del ? `<div class="mr-confirm" role="group" aria-labelledby="mr-del-t">
        ${notice('bad', 'triangle-alert', `<p class="strong" id="mr-del-t" tabindex="-1">Delete your account for good?</p><p>This deletes your account and profile, the issues and bills you follow, where you stand on them, the actions you marked and your saved letters, here and on our side. It can’t be undone.</p>`)}
        <div id="mr-del-msg"></div>
        <div class="btnrow">${btn('Yes, delete my account', { kind: 'danger', icon: 'trash-2', attrs: { 'data-mr-del': 'yes' } })}${btn('Keep my account', { kind: 'text', attrs: { 'data-mr-del': 'no' } })}</div>
      </div>` : `<div class="mr-delrow">${btn('Delete my account', { kind: 'danger', icon: 'trash-2', attrs: { 'data-mr-del': 'ask' } })}</div>`}`;
}

// A profile kept only on this phone (a text number, no sign-in) gets the same real Delete as an account (R-212 #28): it had
// none, so the only way out was clearing the browser. It stops the texts (text_stop, as "Stop texts" does: the row is kept
// marked stopped, so the number is never texted again) and clears this phone, as deleting an account does.
function deviceDelete() {
  return P.del ? `<div class="mr-confirm" role="group" aria-labelledby="mr-del-t">
      ${notice('bad', 'triangle-alert', `<p class="strong" id="mr-del-t" tabindex="-1">Delete your profile for good?</p><p>This stops your text alerts and deletes your profile from this phone: your stories, your saved letters, the issues and bills you follow, where you stand on them and the actions you marked. It can’t be undone.</p><p>Letters you already sent stay with the Capitol and the people you wrote to. We keep a note that your number stopped texts, so we don’t text it again unless you sign up again.</p>`)}
      <div id="mr-del-msg"></div>
      <div class="btnrow">${btn('Yes, delete my profile', { kind: 'danger', icon: 'trash-2', attrs: { 'data-mr-del': 'yes' } })}${btn('Keep my profile', { kind: 'text', attrs: { 'data-mr-del': 'no' } })}</div>
    </div>` : `<div class="mr-delrow">${btn('Delete my profile', { kind: 'danger', icon: 'trash-2', attrs: { 'data-mr-del': 'ask' } })}</div>`;
}
// Everything this phone keeps for the person, after their account or their phone-only profile is deleted.
function forgetEverythingHere() {
  try { [LOCAL_KEY, ISSUES_KEY, CATS_KEY, SKIPS_KEY, STANCE_KEY, DONE_KEY, DONE_AT_KEY, LISTS_KEY, CONSENT_KEY, DISTRICTS_KEY, 'hiphi_ulist_follows'].forEach(k => localStorage.removeItem(k));
    const w = JSON.parse(localStorage.getItem('hiphi_wiz') || 'null'); if (w && w.issues?.length) { w.issues = []; localStorage.setItem('hiphi_wiz', JSON.stringify(w)); } } catch { /* private mode */ }
  S.direct = new Set(); S.issueFollows = new Set(); S.catFollows = new Set(); S.skips = new Set(); recomputeWatch();
  forgetProfileOnDevice();   // the name, titles, stories, letters, drafts and districts kept here (R-156: the name and drafts stayed)
  S.stances = {}; S.done = new Set(); S.doneAt = {}; S.listFollows = new Set(); P.del = false; if (S.ul) { S.ul.mine = null; S.ul.shared = {}; }
}

// Add to Home Screen on an iPhone (R-156 D3): Safari clears a website's saved data after seven days without a visit, which
// is a whole profile for someone with only a text number; the Home Screen app is exempt (WebKit, 2020). Once, until "No
// thanks"; never inside the Home Screen app itself. Home's own card (R-067) comes after a first action; this one is here.
// Only for someone signed in (the review): the Home Screen app keeps its own storage, so a profile kept only on this phone
// would not come with it, while an account's does once they sign in there.
const HS_NO = 'hiphi_pf_hs_no';
function homeScreenNote() {
  let no = false; try { no = localStorage.getItem(HS_NO) === '1'; } catch { /* private mode */ }
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent || '') || (/Macintosh/.test(navigator.userAgent || '') && navigator.maxTouchPoints > 1);
  const standalone = (() => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch { return false; } })();
  if (no || !ios || standalone || !signedIn()) return '';
  return `<section class="card pf-hs" aria-labelledby="pf-hs-t"><h2 id="pf-hs-t">${icon('smartphone')}Add the tracker to your Home Screen</h2>
    <p class="small">An iPhone signs you out of a website after a week away. On your Home Screen, the tracker keeps you signed in.</p>
    ${P.hsHow ? `<ol class="pf-steps"><li>In Safari, tap ${icon('share')}<b>Share</b>.</li><li>Tap <b>Add to Home Screen</b>, then <b>Add</b>.</li><li>Open the tracker from its new icon and sign in there once with your ${myEmail() ? 'email' : 'number'}. Your profile comes with it.</li></ol>`
      : btn('Show me how', { kind: 'secondary', sm: true, icon: 'smartphone', attrs: { 'data-pf-hs': 'how', 'aria-expanded': 'false' } })}
    <div class="btnrow">${btn('No thanks', { kind: 'text', sm: true, attrs: { 'data-pf-hs': 'no' } })}</div></section>`;
}


const sec = (id, title, body) => `<section class="card pf-sec" id="pf-${id}" aria-labelledby="pf-${id}-t"><h2 id="pf-${id}-t">${title}</h2>${body}</section>`;
function profileView() {
  if (!hasProfile()) return inviteView();
  if (signedIn() && !S.user) return `<div class="mr pf"><header class="pagehead"><h1 class="hero">Your profile</h1></header><div class="skelpage" aria-busy="true" aria-label="Loading"><div class="skel" style="height:160px"></div><div class="skel" style="height:280px"></div></div></div>`;
  const name = myName(), s = since(), num = signedIn() ? myNumber() : '';
  // The email and the text number are in Alerts (the review: said twice); the number that signs them in (R-155) stays here.
  const rec = REC();
  return `<div class="mr pf${rec ? ' yu' : ''}">${rec ? backFrom('#/more', 'You') : ''}
    <header class="pagehead pf-head">${av('pf-av pf-av-lg')}<div class="pf-who"><h1 class="hero" id="pf-h" tabindex="-1">${name ? esc(name) : 'Your profile'}</h1>
      ${num || s ? `<p class="meta pf-since">${[num ? `Signed in with ${esc(masked(num))}` : '', s ? `Speaking up since ${esc(s)}` : ''].filter(Boolean).join(' · ')}</p>` : ''}</div></header>
    ${P.made ? `<p class="okmsg pf-made" role="status">${icon('circle-check')}<span>${esc(P.made)}</span></p>` : ''}
    ${DEMO ? notice('info', 'info', 'You’re in the sandbox: what you change here stays in this browser and is never sent.') : ''}
    <p class="sr" id="pf-live" aria-live="polite"></p>
    ${rec ? profileAlertsRow() : ''}
    <p class="small muted pf-auto">${icon('pencil')}<span>Change anything below, then Save.</span></p>
    ${sec('about', 'About you', aboutBody())}
    ${sec('story', 'Your stories', storyBody())}
    ${(l => l ? sec('letters', 'Your letters', `<p class="small muted">${esc(LETTERS_LEDE)}</p>${l}`) : '')(lettersList())}
    ${sec('help', 'How you’ll help', helpBody())}
    ${rec ? '' : sec('email', 'Alerts', alertsBody())}
    ${rec ? '' : sec('issues', 'Your issues', issuesBody())}
    ${homeScreenNote()}
    ${sec('data', 'Your data', dataBody())}
  </div>`;
}
// The page's own state: what is saved (P.base), the draft being changed (P.draft), the picker's and address box's state,
// story boxes added but not yet written. A draft is kept until Save or Cancel, across redraws and other pages.
function fresh() {
  const base = savedNow();
  Object.assign(P, { del: false, storyGone: [], made: P.made || '', hsHow: false, otherOpen: false, newStories: [], base, draft: clone(base),
    tp: { chosen: [...base.titles], q: '', more: false, active: -1 },
    addr: { q: '', sd: null, hd: null, picked: false, results: [] } });
}
function addStory(id) {
  P.newStories = [...new Set([...P.newStories, id])]; P.otherOpen = false;
  repaintStories(`#pf-st-${CSS.escape(id)}`);
}
function repaintStories(focusSel) {
  const s = $('#pf-story'); if (!s) return;
  s.innerHTML = `<h2 id="pf-story-t">Your stories</h2>${storyBody()}`; wireStories();
  const f = focusSel && $(focusSel); if (f) { f.focus({ preventScroll: true }); f.scrollIntoView({ block: 'center' }); }
}
function wireStories() {
  document.querySelectorAll('.pf-story-f textarea').forEach(ta => { const k = ta.closest('[data-story]').dataset.story;
    ta.oninput = () => { if (k) P.draft.stories[k] = ta.value; else P.draft.story = ta.value; paintBar(); }; });
  const add = $('#pf-st-add'); if (add) add.onchange = () => { const v = add.value; if (!v) return;
    if (v === 'other') { P.otherOpen = true; repaintStories('#pf-st-other'); return; } addStory(v); };
  const oth = $('#pf-st-other'); if (oth) oth.onchange = () => { if (oth.value) addStory(oth.value); };
  document.querySelectorAll('input[name="pf-quote"]').forEach(r => r.onchange = () => { if (r.checked) { P.draft.quote = r.value; paintBar(); } });
  document.querySelectorAll('[data-pf-stdel]').forEach(b => b.onclick = () => deleteStory(b.dataset.pfStdel));
  document.querySelectorAll('[data-pf-stundo]').forEach(b => b.onclick = () => undoStory(b.dataset.pfStundo));
}
// Your letters, drawn again after a Delete or an Undo (R-212 #28), without redrawing the page (a draft and the keyboard stay).
function repaintLetters(focusSel, said) {
  const s = $('#pf-letters'); if (!s) return;
  s.innerHTML = `<h2 id="pf-letters-t" tabindex="-1">Your letters</h2><p class="small muted">${esc(LETTERS_LEDE)}</p>${lettersList()}`;
  wireKept(s); wireDelete(s, repaintLetters);
  const f = focusSel && s.querySelector(focusSel); (f || s.querySelector('h2'))?.focus?.({ preventScroll: true });
  if (said) announce(said);
}

// #/profile?to=alerts, from the Alerts page's "Alerts in your profile" (R-303): open at the switch for each issue, once per arrival.
let landed = false; addEventListener('hashchange', () => { landed = false; });
function wireProfile() {
  if (!hasProfile()) { wireInvite(); return; }
  if (!landed && /[?&]to=alerts\b/.test(location.hash)) { landed = true; requestAnimationFrame(() => { const l = $('.pf-lvls') || $('#pf-email'); if (l) { l.scrollIntoView({ block: 'start' }); l.querySelector('input')?.focus({ preventScroll: true }); } }); }
  const nm = $('#pf-name');
  if (nm) { nm.oninput = () => { P.draft.name = nm.value; paintBar(); }; nm.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); nm.blur(); } }; }
  wirePicker($('#pf-tp-host'), 'pf', P.tp, chosen => { P.draft.titles = [...chosen]; paintBar(); });
  // A picked address finds the districts; they are kept with the rest at Save. The address itself is never kept.
  wireAddr('pf-ad', P.addr, () => {
    const a = P.addr; flash('pf-ad-st', '');
    if (!a.picked || !a.sd) return;
    Object.assign(P.draft, { sd: a.sd, hd: a.hd, addrQ: a.q }); paintBar();
    flash('pf-ad-st', 'Found your districts. Save to keep them. Your address won’t be kept.');
  });
  // Typed but not picked: nothing to keep yet, and the page says so.
  const adb = $('#pf-ad-addr');
  if (adb) adb.addEventListener('blur', () => setTimeout(() => {
    if (adb.value.trim() && !P.addr.picked && document.activeElement?.closest?.('#pf-ad-sugs') == null) flash('pf-ad-st', 'Pick your address from the list to find your senator and representative.', true);
  }, 250));
  wireStories();
  const ls = $('#pf-letters'); if (ls) { wireKept(ls); wireDelete(ls, repaintLetters); }
  document.querySelectorAll('[data-pf-int]').forEach(c => c.onchange = () => {
    const k = c.dataset.pfInt; P.draft.help = c.checked ? [...new Set([...P.draft.help, k])] : P.draft.help.filter(x => x !== k); paintBar(); });
  const note = $('#pf-note');
  if (note) { note.oninput = () => { P.draft.helpNote = note.value; paintBar(); }; note.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); note.blur(); } }; }
  document.querySelectorAll('[data-pf-em]').forEach(c => c.onchange = () => { P.draft.emails[c.dataset.pfEm] = c.checked;
    if (c.dataset.pfEm === 'hearing_alerts') { const f = $('#pf-elv'); if (f) f.hidden = !c.checked; }   // which hearings, only while hearing emails are on (B-12)
    paintBar(); });
  document.querySelectorAll('[data-pf-lv]').forEach(r => r.onchange = () => {
    if (!r.checked) return;
    P.draft.levels = { ...(P.draft.levels || {}), [r.dataset.pfLv]: r.value }; r.closest('.lvl-sw').dataset.on = r.value; paintBar();
  });
  document.querySelectorAll('input[name="pf-elv"]').forEach(r => r.onchange = () => { if (r.checked) { P.draft.emailLevel = r.value; paintBar(); } });
  if (document.querySelector('#main .actionbar [data-pf-save]')) wireBar();
  window.onbeforeunload = dirty() ? e => { e.preventDefault(); e.returnValue = ''; return ''; } : null;
  document.querySelectorAll('[data-pf-hs]').forEach(b => b.onclick = () => {
    if (b.dataset.pfHs === 'no') { try { localStorage.setItem(HS_NO, '1'); } catch { /* private mode */ } P.hsHow = false; app.render(); requestAnimationFrame(() => $('#pf-h')?.focus({ preventScroll: true })); return; }
    P.hsHow = true; logAct('home_how'); app.render(); requestAnimationFrame(() => $('.pf-steps')?.closest('section')?.querySelector('h2')?.focus?.()); });
  const out = $('[data-pf-signout]');
  if (out) out.onclick = async () => {
    if (out.getAttribute('aria-busy')) return; busy(out, 'Signing out…');
    try { const { error } = await S.supa.auth.signOut(); if (error) throw error; } catch (e) { unbusy(out); toast(e, true); return; }
    // The profile leaves this device (R-156): the next person on a shared phone starts fresh. It stays in the account.
    forgetProfileOnDevice();
    S.session = null; S.user = null; if (S.ul) { S.ul.mine = null; S.ul.shared = {}; } app.go('#/more', { replace: true });
    toast('You’re signed out. Your bills stay on this device, and your profile in your account.');
  };
  // Deleting the account (moved from Settings): asked on the page, never a browser pop-up; the device's copies go too.
  const ask = $('[data-mr-del="ask"]'); if (ask) ask.onclick = () => { P.del = true; app.render();
    requestAnimationFrame(() => { $('#mr-del-t')?.focus({ preventScroll: true }); $('.mr-confirm')?.scrollIntoView({ block: 'center' }); }); };
  const no = $('[data-mr-del="no"]'); if (no) no.onclick = () => { P.del = false; app.render(); requestAnimationFrame(() => $('[data-mr-del="ask"]')?.focus()); };
  const yes = $('[data-mr-del="yes"]');
  if (yes) yes.onclick = async () => {
    busy(yes, 'Deleting…');
    if (!signedIn()) {   // a profile kept only on this phone: its texts stop, then the phone forgets it all
      try { await stopText(); } catch (e) { unbusy(yes); say('mr-del-msg', inlineErr('mr-del-err', friendly(e))); return; }
      forgetEverythingHere(); fresh();
      app.go('#/', { replace: true });
      toast('Your profile is deleted. Mahalo.');
      return;
    }
    const { error } = await S.supa.rpc('delete_my_account');
    if (error) { unbusy(yes); say('mr-del-msg', inlineErr('mr-del-err', friendly(error))); return; }
    // The account is gone; its copies on this device go too (as Settings did), and the profile kept here with them.
    forgetEverythingHere();
    try { await S.supa.auth.signOut(); } catch { /* the account is already deleted */ }
    S.session = null; S.user = null;
    app.go('#/', { replace: true });
    toast('Your account is deleted. Mahalo for speaking up.');
  };
}

export default {
  tab: 'more',
  title: () => hasProfile() ? 'Your profile' : 'Make your profile',
  render() {
    if (REC() && !youCss()) return youWait();   // R-303: this page group's stylesheet first
    // A fresh arrival starts from what is saved, unless a draft is waiting (Save or Cancel ends it); a redraw of the same
    // page keeps the picker and address box as they are.
    if (!P.base || (!document.querySelector('#main .pf') && !dirty())) fresh();
    return profileView();
  },
  // The save bar, when a draft is waiting (also drawn by paintBar as soon as something changes).
  bar: () => hasProfile() && dirty() ? barHTML() : '',
  wire() { if (REC() && !youCss()) return; wireProfile(); },
};
