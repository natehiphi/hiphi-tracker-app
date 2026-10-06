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
import { S, DEMO, app, esc, icon, toast, friendly, textSaved, followedIssues, HST,
  LOCAL_KEY, DONE_KEY, DONE_AT_KEY, LISTS_KEY, STANCE_KEY, ISSUES_KEY, CATS_KEY, SKIPS_KEY, CONSENT_KEY, recomputeWatch } from './core.js';
import { btn, notice, inlineErr } from './ui.js';
import { CHOICES, check, busy, unbusy, submitBtn, say, myDistricts, distHTML, addrField, wireAddr, rememberDistricts } from './more.js';
import { alertFields, alertButton, wireAlertForm, phoneDigits, codeStep } from './alerts.js';
import { hasProfile, signedIn, myName, myTitles, myStory, myStories, storyName, quoteLevel, QUOTE, storyAsk, STORY_HINT, myInterests, HELP_GROUPS, HELP_KEYS,
  myHelpNote, initials, saveProfile, loadMe, forgetProfileOnDevice } from './myprofile.js';
import { pickerHTML, wirePicker } from './titlepick.js';
import { codesOn, myEmail } from './phone.js';   // sign-in by text code (R-155)
import { titleLabel } from './titles.js';
import { logAct } from './visitlog.js';

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
  return `<div class="mr pf pf-invite">
    <header class="pagehead"><span class="pf-av pf-av-lg" aria-hidden="true">${icon('user')}</span><h1 class="hero">${codeStep('pf-alf') ? 'Check your texts' : 'Make your profile'}</h1>
      <p class="lede">${codeStep('pf-alf') ? 'Type the 6-digit code from the text to make your profile.' : 'Get a text or email when a bill on your issues has a hearing, in time to speak up. Your issues and letters stay saved. Free, and no password.'}</p></header>
    <form class="card mr-form mr-panel" id="pf-al" novalidate>${alertFields('pf-alf', { emailHref: '#/signin' })}
      <div class="mr-send">${submitBtn(b.label, b.icon, 'pf-al-send')}</div></form>
    <p class="small muted pf-back">${codesOn() ? 'Made one before? <a href="#/signin?by=number">Sign in</a>' : 'Added your email before? <a href="#/signin">Sign in on this device</a>'}</p>
  </div>`;
}
function wireInvite() {
  wireAlertForm($('#pf-al'), { pfx: 'pf-alf', source: 'more', onDone: r => {
    // Said on the page, under the header (the review: a toast covered the first section's Save and Cancel).
    P.made = r.kind === 'phone' && r.confirmed ? 'Your profile is made. Text alerts are on.'
      : r.kind === 'phone' ? `Your profile is made. Our first text to ${masked(phoneDigits(r.phone))} asks you to reply YES.` : '';
    app.render();
    if (r.kind !== 'phone') toast('Check your inbox: open the link to finish your profile.', { yay: true });
    requestAnimationFrame(() => $('#pf-h')?.focus());
  } });
}

// ---------------- the profile: edit in place (R-165) ----------------
// Nate 10/5, after his first look: "+Add" read wrong and didn't look like a button; the page looked editable before
// pressing it; "so many distinct grouped ways to update the profile provide hurdles ... First open this box, then close
// it, then open another box, then close it." His answer: edit in place. The page itself is the form: type, tap or tick,
// and each change saves by itself, with a small "Saved" beside it and Undo when something was taken away (B-5). Nothing
// opens or closes, and nothing on the page redraws while someone is typing (a phone's keyboard stays up).
const SAVE_WAIT = 900;   // a pause in typing saves a story or the note; leaving the box saves at once
// A small "Saved" (or what went wrong) beside what changed. undo: a function that puts it back.
function flash(id, text = 'Saved', undo = null) {
  const el = document.getElementById(id); if (!el) return;
  clearTimeout(el._t); el.classList.remove('bad');
  el.innerHTML = `${icon('circle-check')}<span>${esc(text)}</span>${undo ? btn('Undo', { kind: 'text', sm: true, icon: 'undo-2', attrs: { 'data-pf-undo': '' } }) : ''}`;
  const u = el.querySelector('[data-pf-undo]');
  if (u) u.onclick = async () => { if (u.getAttribute('aria-busy')) return; busy(u, 'Putting it back…');
    try { await undo(); } catch (e) { unbusy(u); oops(id, e); return; } flash(id, 'Put back'); };
  announce(undo ? `${text} Undo is next to it.` : `${text}.`);
  if (!undo) el._t = setTimeout(() => { el.innerHTML = ''; }, 4000);
}
function oops(id, e) {
  const el = document.getElementById(id); if (!el) return;
  clearTimeout(el._t); el.classList.add('bad');
  el.innerHTML = `${icon('triangle-alert')}<span>${esc(friendly(e))}</span>`; announce(friendly(e));
}
const status = id => `<p class="pf-st" id="${id}"></p>`;
// A tap (a title, a tick) is confirmed in the toast, which shows wherever the person has scrolled, with Undo when
// something was taken away (the review of R-165: a status line at the end of a long list was out of sight; A-16).
function tapSaved(text, undo) { toast(text, undo ? { undo } : {}); }
async function save(id, patch, undo) {
  try { await saveProfile(patch); flash(id, undo ? undo.label : 'Saved', undo?.fn); return true; } catch (e) { oops(id, e); return false; }
}

// About you: name, "I'm a...", where you live.
function aboutBody() {
  const d = myDistricts(), town = place();
  return `<div class="field pf-f"><label for="pf-name">Name</label>
      <input id="pf-name" type="text" value="${esc(myName())}" maxlength="120" autocomplete="name" autocapitalize="words" enterkeyhint="done" aria-describedby="pf-name-st">
      ${status('pf-name-st')}</div>
    <div class="pf-f" id="pf-tp-host">${pickerHTML('pf', P.tp, { hint: 'Tap any that fit. Your letters can begin “As a parent, I support…”.' })}</div>
    <div class="pf-f pf-where">
      ${d ? `<p class="mr-dist pf-curdist">${distHTML(d.senate, d.house)}</p>` : ''}
      <p class="pf-promise">${icon('shield-check')}<span>We use your address once to find your senator and representative, then forget it. We keep only their district numbers.</span></p>
      ${addrField('pf-ad', P.addr, { label: d ? 'Moved? Look up your new address' : 'Your home address', help: '' })}
      ${status('pf-ad-st')}</div>`;
}
function paintPicker() {
  const host = $('#pf-tp-host'); if (!host) return;
  host.innerHTML = pickerHTML('pf', P.tp); wirePicker(host, 'pf', P.tp, onTitles);
}
// Each tap saves; taking one off says so, with Undo; a save that fails puts the chips back as they were.
async function onTitles(chosen) {
  const was = P.saved.titles, gone = was.filter(t => !chosen.includes(t));
  P.saved.titles = [...chosen];
  try { await saveProfile({ titles: chosen }); }
  catch (e) { P.saved.titles = [...was]; P.tp.chosen = [...was]; paintPicker(); toast(e, true); return; }
  tapSaved(gone.length ? `Took off ${gone.map(titleLabel).join(', ')}` : 'Saved', gone.length ? async () => {
    await saveProfile({ titles: was }); P.saved.titles = [...was]; P.tp.chosen = [...was]; } : null);
}

// Your stories: one for any issue, and one for any issue they choose, the issues they follow first (R-165).
function storyField(k, text) {
  const id = k ? `pf-st-${k}` : 'pf-st-any', name = storyName(k);
  return `<div class="field pf-f pf-story-f" data-story="${esc(k)}"><label for="${id}">${k ? `Your story about “${esc(name)}”` : 'Your story'}</label>
      <textarea id="${id}" rows="3" maxlength="600" autocapitalize="sentences" aria-describedby="pf-story-h ${id}-st">${esc(text)}</textarea>
      ${status(`${id}-st`)}</div>`;
}
const storyKeys = () => { const st = myStories(); return [...new Set([...P.newStories, ...Object.keys(st)])]; };
function storyBody() {
  const st = myStories(), keys = storyKeys(), have = new Set(keys);
  const follow = followedIssues().filter(i => !have.has(i.id)), others = (S.issues || []).filter(i => !have.has(i.id) && !follow.includes(i));
  const any = !!(myStory() || keys.length), q = quoteLevel();
  return `<p class="pf-warm" id="pf-story-h">${esc(storyAsk(''))} ${esc(STORY_HINT)} We’ll put it in your letters, and you can change it in each one.</p>
    <p class="small muted">Testimony is public: a story you send is posted with your letter.</p>
    ${storyField('', myStory())}
    ${keys.map(k => storyField(k, st[k] || '')).join('')}
    ${keys.length < 20 && (follow.length || others.length) ? `<div class="field pf-f pf-addstory"><label for="pf-st-add">Add a story about one issue</label>
      <select id="pf-st-add"><option value="">Choose an issue</option>${follow.length ? `<optgroup label="Issues you follow">${follow.map(i => `<option value="${esc(i.id)}">${esc(i.name)}</option>`).join('')}</optgroup>` : ''}
        ${others.length ? `<option value="other">Another issue…</option>` : ''}</select>
      ${P.otherOpen ? `<label class="sr" for="pf-st-other">Another issue</label><select id="pf-st-other"><option value="">Choose another issue</option>${(S.cats || []).map(c => {
        const xs = others.filter(i => (i.categories || [i.category]).includes(c.key)); return xs.length ? `<optgroup label="${esc(c.name)}">${xs.map(i => `<option value="${esc(i.id)}">${esc(i.name)}</option>`).join('')}</optgroup>` : ''; }).join('')}</select>` : ''}</div>` : ''}
    ${any ? `<fieldset class="mr-set pf-f" id="pf-quote-f"><legend>Can HIPHI quote your stories?</legend>
      <p class="small muted">This applies to all of them. HIPHI asks you again before using one anywhere public.</p>
      ${[['', 'No'], ...QUOTE].map(([k, l]) => radio('pf-quote', k, l, q === k)).join('')}${status('pf-quote-st')}</fieldset>` : ''}`;
}
const radio = (name, v, title, on) => `<label class="check mr-check" for="${name}-${v || 'no'}"><input type="radio" name="${name}" id="${name}-${v || 'no'}" value="${v}"${on ? ' checked' : ''}><span class="mr-ctext"><span class="mr-ctitle">${esc(title)}</span></span></label>`;
// A story saves after a pause in typing and when the box is left; emptied, it is removed, with Undo.
function wireStory(ta) {
  const k = ta.closest('[data-story]').dataset.story, sid = `${ta.id}-st`;
  const commit = async () => {
    clearTimeout(ta._t);
    const text = ta.value.trim(), was = k ? myStories()[k] || '' : myStory();
    if (text === was) return;
    const patch = k ? { stories: { ...myStories(), [k]: text } } : { story: text };
    if (k && !text) delete patch.stories[k];
    await save(sid, patch, !text && was ? { label: 'Story removed', fn: async () => { await saveProfile(k ? { stories: { ...myStories(), [k]: was } } : { story: was }); ta.value = was; } } : null);
  };
  ta.oninput = () => { clearTimeout(ta._t); ta._t = setTimeout(commit, SAVE_WAIT); };
  ta.onblur = commit;
}

// How you'll help (R-165): warm, four groups and their own words.
function helpBody() {
  const ints = new Set(myInterests());
  return `<p class="pf-warm">Every bit helps, and there’s no wrong way to pitch in. Tick anything that sounds like you, and HIPHI will invite you to the things that fit.</p>
    ${HELP_GROUPS.map(([g, xs], n) => `<fieldset class="mr-set pf-f pf-helpg"><legend>${esc(g)}</legend>
      ${xs.map(([k, l]) => check(`pf-int-${k}`, esc(l), k === 'testify' ? 'We’ll show you how to sign up to speak when a hearing on your issues is set.' : '', ints.has(k), ` data-pf-int="${k}"`)).join('')}</fieldset>`).join('')}
    <div class="field pf-f"><label for="pf-note">Something else? Tell us</label>
      <input id="pf-note" type="text" maxlength="200" value="${esc(myHelpNote())}" autocapitalize="sentences" enterkeyhint="done" placeholder="Like cooking for a rally" aria-describedby="pf-help-st"></div>
    ${status('pf-help-st')}`;
}

// Alerts: the email choices save as they are ticked (R-165).
function alertsBody() {
  const t = textSaved(), p = S.user?.prefs || {};
  const texts = t ? `<p>${icon('message-square')} Texts to <span class="strong">${esc(masked(t.phone))}</span>: hearings on your issues and HIPHI’s asks, at most one a day.</p><p class="small"><a href="#/alerts">Change number or stop texts</a></p>`
    : `<p>${icon('message-square')} Texts: off. <a href="#/alerts">Get text alerts</a></p>`;
  // A profile made with a number (R-155) has no email until it adds one: no email choices to show or change.
  const email = signedIn() && myEmail() ? `<fieldset class="mr-set pf-f"><legend>Emails to <span class="mr-break">${esc(myEmail())}</span></legend>
      ${CHOICES.map(([k, key, t2, h]) => check(`pf-em-${k}`, t2, h, p[key] === true, ` data-pf-em="${key}"`)).join('')}
      <p class="small muted">Every email has a one-click unsubscribe.</p>${status('pf-em-st')}</fieldset>`
    : signedIn() ? `<p>${icon('mail')} Email: not added. <a href="#/signin">Add your email</a> to get alerts by email too.</p>`
    : `<p>${icon('mail')} Email: not added.</p>`;   // Your data says how to add one, and why (the review: said twice)
  return `${texts}${email}`;
}

// One line (the review: My issues is a tab and Your session is More's next row, so a second set of links said it twice).
function issuesBody() {
  const n = followedIssues().length, b = S.watch?.size || 0;
  return `<p>${n || b ? `You follow ${n ? `${n} ${n === 1 ? 'issue' : 'issues'}` : ''}${n && b ? ' and ' : ''}${b ? `${b} ${b === 1 ? 'bill' : 'bills'}` : ''}.` : 'You don’t follow any issues yet.'} <a href="#/bills">${n || b ? 'See them in My issues' : 'Find issues to follow'}</a></p>`;
}
function dataBody() {
  if (!signedIn()) return `<p>Your profile is saved on this phone. ${codesOn() ? '<a href="#/signin?by=number">Sign in with your number</a>' : '<a href="#/signin">Add your email</a>'} to keep it on any phone or computer. HIPHI staff never see your text-alert number. We never sell your information or give it to other groups. <a href="#/privacy">Read about privacy</a></p>`;
  // Signed in with a number only (R-155): the number signs them in and staff never see it; no email, so no emails opened.
  if (!myEmail()) return `<p>We keep your mobile number, which signs you in, the issues you picked, the bills and lists you follow, where you stand on each bill you follow (support, oppose or not sure), the actions you mark and what you add on this page, including your titles and your story. HIPHI staff can see all of it except your number, your testimony letters and your emails to lawmakers: we keep the last of each you sent on each bill, so they’re ready for the bill’s next step, and only you can see them. Your street address is never kept, only your districts. We never sell your information or give it to other groups. <a href="#/privacy">Read about privacy</a></p>
    ${accountButtons()}`;
  // R-151's and R-153's wording (10/4: the privacy page made accurate; kept emails), with the profile's titles and story named.
  return `<p>We keep your email, the issues you picked, the bills and lists you follow, where you stand on each bill you follow (support, oppose or not sure), the actions you mark, your email choices, which of our emails you open and what you add on this page, including your titles and your story. HIPHI staff can see all of it, except your testimony letters and emails to lawmakers: we keep the last of each you sent on each bill, so they’re ready for the bill’s next step, and only you can see them. Your street address is never kept, only your districts. We never sell your information or give it to other groups. <a href="#/privacy">Read about privacy</a></p>
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
  const name = myName(), s = since();
  // The email and the text number are in Alerts, and the number that signs them in under Your data (the review: said twice).
  return `<div class="mr pf">
    <header class="pagehead pf-head">${av('pf-av pf-av-lg')}<div class="pf-who"><h1 class="hero" id="pf-h" tabindex="-1">${name ? esc(name) : 'Your profile'}</h1>
      ${s ? `<p class="meta pf-since">Speaking up since ${esc(s)}</p>` : ''}</div></header>
    ${P.made ? `<p class="okmsg pf-made" role="status">${icon('circle-check')}<span>${esc(P.made)}</span></p>` : ''}
    ${DEMO ? notice('info', 'info', 'You’re in the sandbox: what you change here stays in this browser and is never sent.') : ''}
    <p class="sr" id="pf-live" aria-live="polite"></p>
    <p class="small muted pf-auto">${icon('circle-check')}<span>Change anything below. It saves as you go.</span></p>
    ${sec('about', 'About you', aboutBody())}
    ${sec('story', 'Your stories', storyBody())}
    ${sec('help', 'How you’ll help', helpBody())}
    ${sec('email', 'Alerts', alertsBody())}
    ${sec('issues', 'Your issues', issuesBody())}
    ${homeScreenNote()}
    ${sec('data', 'Your data', dataBody())}
  </div>`;
}
// The page's own state, kept across redraws of the same visit: the picker's, the address box's, stories just added.
function fresh() {
  Object.assign(P, { del: false, made: P.made || '', hsHow: false, otherOpen: false, newStories: [],
    tp: { chosen: myTitles(), q: '', more: false, active: -1 }, saved: { titles: myTitles() },
    addr: { q: '', sd: null, hd: null, picked: false, results: [] } });
}
// The name in the header follows the name field.
function paintWho() {
  const h = $('#pf-h'); if (h) h.textContent = myName() || 'Your profile';
  const a = $('.pf-head .pf-av'); if (a) { const i = initials(); a.innerHTML = i ? esc(i) : icon('user'); }
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
  document.querySelectorAll('.pf-story-f textarea').forEach(wireStory);
  const add = $('#pf-st-add'); if (add) add.onchange = () => { const v = add.value; if (!v) return;
    if (v === 'other') { P.otherOpen = true; repaintStories('#pf-st-other'); return; } addStory(v); };
  const oth = $('#pf-st-other'); if (oth) oth.onchange = () => { if (oth.value) addStory(oth.value); };
  document.querySelectorAll('input[name="pf-quote"]').forEach(r => r.onchange = () => { if (r.checked) save('pf-quote-st', { quote: r.value }); });
}

function wireProfile() {
  if (!hasProfile()) { wireInvite(); return; }
  const nm = $('#pf-name');
  if (nm) {
    nm.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); nm.blur(); } };
    nm.onchange = async () => {
      const v = nm.value.trim(), was = myName(); if (v === was) return;
      if (await save('pf-name-st', { name: v }, !v && was ? { label: 'Name removed', fn: async () => { await saveProfile({ name: was }); nm.value = was; paintWho(); } } : null)) paintWho();
    };
  }
  wirePicker($('#pf-tp-host'), 'pf', P.tp, onTitles);
  // Picking an address saves its districts at once; the address itself is never kept.
  wireAddr('pf-ad', P.addr, async () => {
    const a = P.addr, st = $('#pf-ad-st'); if (st && st.classList.contains('bad')) st.innerHTML = '';
    if (!a.picked || !a.sd) return;
    try { await saveProfile({ house: a.hd, senate: a.sd }); } catch (e) { oops('pf-ad-st', e); return; }
    rememberDistricts(a.sd, a.hd, a.q);
    // The box empties, so the page shows the address was not kept; the districts found stay under it.
    const box = $('#pf-ad-addr'); if (box) box.value = ''; a.q = '';
    const cur = $('.pf-curdist'); if (cur) cur.innerHTML = distHTML(a.sd, a.hd);
    flash('pf-ad-st', 'Saved your districts. Your address was not kept');
  });
  // Typed but not picked: nothing can be saved yet, and the page says so (it says changes save as you go).
  const adb = $('#pf-ad-addr');
  if (adb) adb.addEventListener('blur', () => setTimeout(() => {
    if (adb.value.trim() && !P.addr.picked && document.activeElement?.closest?.('#pf-ad-sugs') == null) {
      const st = $('#pf-ad-st'); if (st) { st.classList.add('bad'); st.innerHTML = `${icon('info')}<span>Pick your address from the list to find your senator and representative.</span>`; }
    } }, 250));
  wireStories();
  const help = $('#pf-help');
  if (help) {
    help.querySelectorAll('[data-pf-int]').forEach(c => c.onchange = async () => {
      const on = HELP_KEYS.filter(k => help.querySelector(`[data-pf-int="${k}"]`)?.checked);
      try { await saveProfile({ interests: [...myInterests().filter(k => !HELP_KEYS.includes(k)), ...on] }); }
      catch (e) { c.checked = !c.checked; toast(e, true); return; }
      tapSaved('Saved');
    });
    const note = $('#pf-note');
    const commit = () => { clearTimeout(note._t); if (note.value.trim() !== myHelpNote()) save('pf-help-st', { helpNote: note.value }); };
    note.oninput = () => { clearTimeout(note._t); note._t = setTimeout(commit, SAVE_WAIT); };
    note.onchange = commit;
    note.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); note.blur(); } };
  }
  document.querySelectorAll('[data-pf-em]').forEach(c => c.onchange = async () => {
    const prefs = { ...(S.user.prefs || {}), [c.dataset.pfEm]: c.checked, consent_at: new Date().toISOString() };
    if (DEMO) { S.user.prefs = prefs; flash('pf-em-st'); return; }
    const { error } = await S.supa.from('public_users').update({ prefs }).eq('id', S.user.id);
    if (error) { c.checked = !c.checked; oops('pf-em-st', error); return; }
    S.user.prefs = prefs; S.consentCard = false; flash('pf-em-st');
  });
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
    const { error } = await S.supa.rpc('delete_my_account');
    if (error) { unbusy(yes); say('mr-del-msg', inlineErr('mr-del-err', friendly(error))); return; }
    // The account is gone; its copies on this device go too (as Settings did), and the profile kept here with them.
    try { [LOCAL_KEY, ISSUES_KEY, CATS_KEY, SKIPS_KEY, STANCE_KEY, DONE_KEY, DONE_AT_KEY, LISTS_KEY, CONSENT_KEY, DISTRICTS_KEY, 'hiphi_ulist_follows'].forEach(k => localStorage.removeItem(k));
      const w = JSON.parse(localStorage.getItem('hiphi_wiz') || 'null'); if (w && w.issues?.length) { w.issues = []; localStorage.setItem('hiphi_wiz', JSON.stringify(w)); } } catch { /* private mode */ }
    S.direct = new Set(); S.issueFollows = new Set(); S.catFollows = new Set(); S.skips = new Set(); recomputeWatch();
    forgetProfileOnDevice();   // the name, titles, stories, drafts and districts kept here (R-156: the name and drafts stayed)
    S.stances = {}; S.done = new Set(); S.doneAt = {}; S.listFollows = new Set(); P.del = false; if (S.ul) { S.ul.mine = null; S.ul.shared = {}; }
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
    // A fresh arrival starts from what is saved; a redraw of the same page keeps the picker and address box as they are.
    if (!document.querySelector('#main .pf') || !P.tp) fresh();
    return profileView();
  },
  wire() { wireProfile(); },
};
