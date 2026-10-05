// Your profile (R-147, Nate 10/4; the plan and mockups: https://claude.ai/artifact/FSzXqzhDcJggJtbhkoNX1d).
//   #/profile  (and #/settings, its old address) the person: who they are, their story, how they'd help, their alerts,
//              their issues and their data, one short section each, each changed on its own with Change (B-12).
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
import { CHOICES, INTERESTS, check, busy, unbusy, submitBtn, say, myDistricts, distHTML, addrField, wireAddr, rememberDistricts } from './more.js';
import { alertFields, alertButton, wireAlertForm, fmtPhone, codeStep } from './alerts.js';
import { hasProfile, signedIn, myName, myTitles, myStory, myStories, quoteLevel, QUOTE, storyAsk, myInterests, initials, saveProfile, loadMe, forgetProfileOnDevice } from './myprofile.js';
import { pickerHTML, wirePicker, titleChips, pendingTitle } from './titlepick.js';
import { codesOn, myEmail, myNumber } from './phone.js';   // sign-in by text code (R-155)
import { asWords, titleLabel } from './titles.js';
import { logAct } from './visitlog.js';

const $ = s => document.querySelector(s);
const DISTRICTS_KEY = 'hiphi_districts';
// "HIPHI may quote me" sits with the story; "I have a story to share" left with R-156 (Your story covers it, the review).
const HELP = INTERESTS.filter(([k]) => k !== 'quote' && k !== 'story');
// What each answer changes (R-156 C1; design rule C-13: every question changes what the person sees).
const HELP_DOES = { testify: 'We’ll show you how to sign up to speak when a hearing on your issues is set.',
  host: 'HIPHI’s team sees this and may ask you to help at an event near you.', volunteer: 'HIPHI’s team sees this and may get in touch about volunteering.' };
// "Topic", never "issue", for a story's subject (the review: "Your issues" on the same page means the issues followed).
const topicName = k => k ? (S.cats || []).find(c => c.key === k)?.name || k : 'Any topic';
// P: this visit's page. edit: the section being changed ('about' | 'story' | 'help' | 'email'), with its draft; del: the
// delete question showing; done: the section that just saved (its "Saved" line); undo: what the Saved line's Undo puts
// back ({ id, label, patch }, R-156: B-5, nothing removed without a way back).
const P = { edit: null, d: null, del: false, done: '', made: '', undo: null };
// Said aloud after a redraw: the region is drawn empty, then filled, so a screen reader reads it (R-156).
const announce = text => setTimeout(() => { const l = document.getElementById('pf-live'); if (l) l.textContent = text; }, 80);
const masked = d => `(${d.slice(0, 3)}) ••• ${d.slice(6)}`;
const place = () => { try { const d = JSON.parse(localStorage.getItem(DISTRICTS_KEY) || 'null'); return d?.label || ''; } catch { return ''; } };
const since = () => { const at = S.user?.created_at || textSaved()?.at; return at ? new Date(at).toLocaleDateString('en-US', { timeZone: HST, month: 'long', year: 'numeric' }) : ''; };
const av = (cls = 'pf-av') => { const i = initials(); return `<span class="${cls}" aria-hidden="true">${i ? esc(i) : icon('user')}</span>`; };
// change: false, or 'Change' | 'Add' (an empty section says Add, review 10/4); href: a Change that opens another page.
const sec = (id, title, body, { change = 'Change', href = '', extra = '' } = {}) => `<section class="card pf-sec" id="pf-${id}" aria-labelledby="pf-${id}-t">
    <div class="pf-sech"><h2 id="pf-${id}-t">${title}</h2>${change ? btn(change, { kind: 'text', sm: true, icon: change === 'Add' ? 'plus' : 'pencil', ...(href ? { href } : {}), attrs: { ...(href ? {} : { 'data-pf-edit': id }), 'aria-describedby': `pf-${id}-t` } }) : ''}</div>
    ${body}${P.done === id ? `<p class="okmsg pf-ok">${icon('circle-check')}<span>${esc(P.undo?.id === id ? P.undo.label : 'Saved.')}</span>${P.undo?.id === id ? btn('Undo', { kind: 'text', sm: true, icon: 'undo-2', attrs: { 'data-pf-undo': id } }) : ''}</p>` : ''}${extra}</section>`;
const empty = text => `<p class="pf-empty">${text}</p>`;
const kv = (k, v) => `<div class="pf-kv"><p class="pf-k">${k}</p>${v}</div>`;

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
      : r.kind === 'phone' ? `Your profile is made. Our first text to ${fmtPhone(r.phone)} asks you to reply YES.` : '';
    app.render();
    if (r.kind !== 'phone') toast('Check your inbox: open the link to finish your profile.', { yay: true });
    requestAnimationFrame(() => $('#pf-h')?.focus());
  } });
}

// ---------------- the profile ----------------
function aboutBody() {
  const name = myName(), titles = myTitles(), d = myDistricts(), town = place();
  return `${kv('Name on your letters', name ? `<p class="strong">${esc(name)}</p>` : empty('Not added yet.'))}
    ${kv('I’m a…', titles.length ? `${titleChips(titles)}<p class="small muted">Your letters start “${esc(asWords(titles.slice(0, 1)))}, I support…”, with the one or two that fit each bill best.</p>`
      : empty('Not added yet. Your titles start your letters, like “As a parent and teacher, I support…”.'))}
    ${kv('Where you live', d ? `${town ? `<p>${esc(town)}</p>` : ''}<p class="mr-dist">${distHTML(d.senate, d.house)}</p><p class="small muted">Your letters to your own lawmakers say you live in their district.</p>`
      : empty('Not added yet. We use it to point you to your own senator and representative.'))}`;
}
function aboutEdit() {
  const d = P.d;
  return `<form class="pf-form" id="pf-about-f" novalidate>
    <div class="field"><label for="pf-name">Name on your letters</label><input id="pf-name" type="text" value="${esc(d.name)}" maxlength="120" autocomplete="name" autocapitalize="words"></div>
    <div id="pf-tp-host">${pickerHTML('pf', d.tp)}</div>
    ${addrField('pf-ad', d.addr, { label: 'Home address', help: 'Used once to find your districts, then forgotten. Only the districts are saved.' })}
    <p class="small muted">Testimony is public: your name and letter are posted on the Capitol website. Share only what you’re comfortable with.</p>
    <div id="pf-about-msg"></div>
    <div class="btnrow">${submitBtn('Save', 'check', 'pf-about-save')}${btn('Cancel', { kind: 'text', attrs: { 'data-pf-cancel': '' } })}</div></form>`;
}
// Your stories (R-156 B3): one for any issue and one per issue topic. A letter on a bill starts with the story for the
// bill's topic, else the one for any issue; a story about another topic is offered there, never filled in.
const storyRows = () => [...(myStory() ? [['', myStory()]] : []), ...Object.entries(myStories())];
function storyBody() {
  const rows = storyRows(), q = quoteLevel(), left = (S.cats || []).filter(c => !myStories()[c.key]).length;
  return `${rows.length ? rows.map(([k, t]) => `<div class="pf-storyrow"><p class="pf-k">${k ? `About ${esc(topicName(k))}` : 'For any topic'}</p><blockquote class="pf-story">${esc(t)}</blockquote>
      ${btn('Change', { kind: 'text', sm: true, icon: 'pencil', attrs: { 'data-pf-story': k || '-', 'aria-label': `Change your story ${k ? `about ${topicName(k)}` : 'for any topic'}` } })}</div>`).join('')
      : empty('Not added yet. A sentence or two on why a topic matters to you. Your letters on that topic start with it, and you can change it each time.')}
    ${rows.length && left ? `<p>${btn('Add a story for another topic', { kind: 'text', sm: true, icon: 'plus', attrs: { 'data-pf-story': '+' } })}</p>` : ''}
    ${rows.length ? `<div class="pf-storyrow pf-quoterow"><p class="pf-k">Can HIPHI quote your stories?</p><p>${q ? esc(QUOTE.find(x => x[0] === q)[1]) : 'No'}</p>
      ${P.edit !== 'quote' ? btn('Change', { kind: 'text', sm: true, icon: 'pencil', attrs: { 'data-pf-edit': 'quote', 'aria-label': 'Change whether HIPHI may quote your stories' } }) : ''}</div>` : ''}`;
}
// "Quote me" is one answer for all the stories (the review: asked inside one story's form, it changed every story's).
function quoteEdit() {
  return `<form class="pf-form" id="pf-quote-f" novalidate><fieldset class="mr-set"><legend>Can HIPHI quote your stories?</legend>
      <p class="small muted" id="pf-quote-h">This applies to all of them. HIPHI asks you again before using one anywhere public.</p>
      ${[['', 'No'], ...QUOTE].map(([k, l]) => radio('pf-quote', k, l, P.d.quote === k)).join('')}</fieldset>
    <div id="pf-quote-msg"></div>
    <div class="btnrow">${submitBtn('Save', 'check', 'pf-quote-save')}${btn('Cancel', { kind: 'text', attrs: { 'data-pf-cancel': '' } })}</div></form>`;
}
const radio = (name, v, title, on) => `<label class="check mr-check" for="${name}-${v || 'no'}"><input type="radio" name="${name}" id="${name}-${v || 'no'}" value="${v}"${on ? ' checked' : ''}><span class="mr-ctext"><span class="mr-ctitle">${esc(title)}</span></span></label>`;
function storyEdit() {
  const d = P.d, st = myStories(), any = myStory();
  const taken = k => k !== d.orig && !!(k ? st[k] : any);
  return `<form class="pf-form" id="pf-story-f" novalidate>
    <div class="field"><label for="pf-topic">Topic</label>
      <select id="pf-topic" aria-describedby="pf-topic-h">${[['', 'Any topic'], ...(S.cats || []).map(c => [c.key, c.name])].map(([k, l]) => `<option value="${esc(k)}"${k === d.topic ? ' selected' : ''}>${esc(l)}${taken(k) ? ' (replaces that story)' : ''}</option>`).join('')}</select>
      <span class="help" id="pf-topic-h">Your letters on this topic start with it.</span></div>
    <div class="field"><label for="pf-storyt" id="pf-story-ask">${esc(storyAsk(d.topic))}</label>
      <textarea id="pf-storyt" rows="4" maxlength="600" aria-describedby="pf-story-h" autocapitalize="sentences">${esc(d.text)}</textarea>
      <span class="help" id="pf-story-h">One or two sentences, in your own words. A personal reason carries the most weight with lawmakers. You don’t have to share health details to be heard.</span></div>
    <div id="pf-story-msg"></div>
    <div class="btnrow">${submitBtn('Save', 'check', 'pf-story-save')}${btn('Cancel', { kind: 'text', attrs: { 'data-pf-cancel': '' } })}${d.orig !== null && d.text ? btn('Remove this story', { kind: 'text', icon: 'trash-2', attrs: { 'data-pf-storydel': '' } }) : ''}</div></form>`;
}
function helpBody() {
  const ints = myInterests().filter(k => HELP.some(([h]) => h === k)), acct = !!loadMe().capitolAcct;
  return `${ints.length ? `<ul class="pf-list pf-does" role="list">${HELP.filter(([k]) => ints.includes(k)).map(([k, l]) => `<li>${icon('check')}<span><span class="strong">${esc(l)}.</span> ${esc(HELP_DOES[k] || '')}</span></li>`).join('')}</ul>` : empty('Not added yet. Tell HIPHI if you’d testify in person, host an event or volunteer.')}
    <p class="small pf-acct">${icon(acct ? 'circle-check' : 'info')}<span>${acct ? 'Your Capitol website account is ready for testimony.' : 'The first time you send testimony, we’ll walk you through making your free Capitol website account.'}</span></p>`;
}
function helpEdit() {
  return `<form class="pf-form" id="pf-help-f" novalidate><fieldset class="mr-set"><legend>How would you like to help?</legend>
    ${HELP.map(([k, l]) => check(`pf-int-${k}`, l, esc(HELP_DOES[k] || ''), P.d.ints.has(k), ` data-pf-int="${k}"`)).join('')}</fieldset>
    <div id="pf-help-msg"></div>
    <div class="btnrow">${submitBtn('Save', 'check', 'pf-help-save')}${btn('Cancel', { kind: 'text', attrs: { 'data-pf-cancel': '' } })}</div></form>`;
}
function alertsBody() {
  const t = textSaved(), p = S.user?.prefs || {};
  const texts = t ? `<p>${icon('message-square')} Texts to <span class="strong">${esc(masked(t.phone))}</span>: hearings on your issues and HIPHI’s asks, at most one a day.</p>${signedIn() ? '<p class="small"><a href="#/alerts">Change number or stop texts</a></p>' : ''}`
    : `<p>${icon('message-square')} Texts: off.${signedIn() ? ' <a href="#/alerts">Get text alerts</a>' : ''}</p>`;
  // A profile made with a number (R-155) has no email until it adds one: no email choices to show or change.
  const email = signedIn() && myEmail() ? `<p>${icon('mail')} Emails to <span class="strong mr-break">${esc(myEmail())}</span>:</p>
      <ul class="pf-list" role="list">${CHOICES.map(([, key, t2]) => `<li>${icon(p[key] === true ? 'check' : 'x')}<span>${esc(t2)}: <span class="strong">${p[key] === true ? 'on' : 'off'}</span></span></li>`).join('')}</ul>`
    : signedIn() ? `<p>${icon('mail')} Email: not added. <a href="#/signin">Add your email</a> to get alerts by email too.</p>`
    : `<p>${icon('mail')} Email: not added. <a href="#/signin">Add your email</a> to keep your profile on any phone.</p>`;
  return `${texts}${email}`;
}
function emailEdit() {
  return `<form class="pf-form" id="pf-email-f" novalidate><fieldset class="mr-set"><legend>Emails from HIPHI</legend>
    ${CHOICES.map(([k, , t, h]) => check(`pf-em-${k}`, t, h, P.d.choices[k])).join('')}</fieldset>
    <p class="small muted">Every email has a one-click unsubscribe.</p>
    <div id="pf-email-msg"></div>
    <div class="btnrow">${submitBtn('Save', 'check', 'pf-email-save')}${btn('Cancel', { kind: 'text', attrs: { 'data-pf-cancel': '' } })}</div></form>`;
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

function profileView() {
  if (!hasProfile()) return inviteView();
  if (signedIn() && !S.user) return `<div class="mr pf"><header class="pagehead"><h1 class="hero">Your profile</h1></header><div class="skelpage" aria-busy="true" aria-label="Loading"><div class="skel" style="height:160px"></div><div class="skel" style="height:280px"></div></div></div>`;
  const name = myName(), t = textSaved(), s = since();
  // How they're reached and how they sign in: an email, a number that signs them in (R-155), the text-alert number.
  const num = signedIn() ? myNumber() : '';
  const contact = [signedIn() ? esc(myEmail()) : '', num ? `Signed in with ${esc(masked(num))}` : '', t && t.phone !== num ? `Texts to ${esc(masked(t.phone))}` : ''].filter(Boolean).join(' · ');
  const E = P.edit;
  return `<div class="mr pf">
    <header class="pagehead pf-head">${av('pf-av pf-av-lg')}<div class="pf-who"><h1 class="hero" id="pf-h" tabindex="-1">${name ? esc(name) : 'Your profile'}</h1>
      <p class="meta mr-break">${contact}${s ? `<span class="pf-since"> · Speaking up since ${esc(s)}</span>` : ''}</p></div></header>
    ${P.made ? `<p class="okmsg pf-made" role="status">${icon('circle-check')}<span>${esc(P.made)}</span></p>` : ''}
    ${DEMO ? notice('info', 'info', 'You’re in the sandbox: what you change here stays in this browser and is never sent.') : ''}
    <p class="sr" id="pf-live" aria-live="polite"></p>
    ${sec('about', 'About you', E === 'about' ? aboutEdit() : aboutBody(), { change: E !== 'about' && (myName() || myTitles().length || myDistricts() ? 'Change' : 'Add') })}
    ${sec('story', storyRows().length > 1 ? 'Your stories' : 'Your story', E === 'story' ? storyEdit() : E === 'quote' ? storyBody() + quoteEdit() : storyBody(), { change: E !== 'story' && E !== 'quote' && !storyRows().length && 'Add' })}
    ${sec('help', 'How you’ll help', E === 'help' ? helpEdit() : helpBody(), { change: E !== 'help' && (myInterests().some(k => HELP.some(([h]) => h === k)) ? 'Change' : 'Add') })}
    ${sec('email', 'Alerts', E === 'email' ? emailEdit() : alertsBody(), signedIn() && myEmail() ? { change: E !== 'email' && 'Change' } : { href: '#/alerts' })}
    ${sec('issues', 'Your issues', issuesBody(), { change: false })}
    ${homeScreenNote()}
    ${sec('data', 'Your data', dataBody(), { change: false })}
  </div>`;
}

function startEdit(id, topic) {
  P.done = ''; P.del = false; P.made = ''; P.undo = null;
  if (id === 'about') { const d = myDistricts();
    P.d = { name: myName(), tp: { chosen: myTitles(), q: '', more: false, student: false, active: -1 },
      addr: { q: '', sd: d?.senate || null, hd: d?.house || null, picked: false, results: [] } }; }
  else if (id === 'story') {
    // topic: '-' the story for any issue, a category key, '+' a new one (the first topic without a story), none: Add.
    const st = myStories(), fresh = topic === '+' || topic === undefined;
    const t = topic === '+' ? ((S.cats || []).find(c => !st[c.key])?.key || '') : topic === '-' || topic === undefined ? '' : topic;
    P.d = { topic: t, orig: fresh ? null : t, text: fresh ? '' : (t ? st[t] : myStory()) || '' };
  }
  else if (id === 'quote') P.d = { quote: quoteLevel() };
  else if (id === 'help') P.d = { ints: new Set(myInterests()) };
  else if (id === 'email') { const p = S.user?.prefs || {}; P.d = { choices: { alerts: p.hearing_alerts === true, action: p.action_alerts === true } }; }
  P.edit = id; app.render();
  requestAnimationFrame(() => { const f = $(id === 'story' ? '#pf-storyt' : id === 'quote' ? '#pf-quote-f input:checked' : `#pf-${id} input, #pf-${id} textarea`); f?.focus({ preventScroll: true }); $(`#pf-${secOf(id)}`)?.scrollIntoView({ block: id === 'quote' ? 'center' : 'start' }); });
}
// The quote answer is a row inside Your stories: its "Saved." and focus go to that section.
const secOf = id => id === 'quote' ? 'story' : id;
function endEdit(id, saved) {
  const sid = secOf(id);
  P.edit = null; P.d = null; P.done = saved ? sid : ''; if (!saved) P.undo = null; app.render();
  requestAnimationFrame(() => ($(`#pf-${sid} [data-pf-undo]`) || (id === 'quote' && $('#pf-story [data-pf-edit="quote"]')) || $(`#pf-${sid} [data-pf-edit]`) || $(`#pf-${sid} [data-pf-story]`) || $(`#pf-${sid}-t`))?.focus({ preventScroll: true }));
  if (saved) announce(P.undo?.id === sid ? `${P.undo.label} Undo is next.` : 'Saved.');
}
async function trySave(id, b, work) {
  if (b.getAttribute('aria-busy')) return;
  busy(b, 'Saving…'); say(`pf-${id}-msg`, '');
  try { await work(); } catch (e) { unbusy(b); say(`pf-${id}-msg`, inlineErr(`pf-${id}-err`, friendly(e))); return; }
  endEdit(id, true);
}

function wireProfile() {
  if (!hasProfile()) { wireInvite(); return; }
  document.querySelectorAll('[data-pf-edit]').forEach(b => b.onclick = () => startEdit(b.dataset.pfEdit));
  document.querySelectorAll('[data-pf-cancel]').forEach(b => b.onclick = () => { const id = P.edit; endEdit(id, false); });
  document.querySelectorAll('[data-pf-story]').forEach(b => b.onclick = () => startEdit('story', b.dataset.pfStory));
  // Escape closes the section being changed, unless a list of suggestions is open in it (that Escape closes the list).
  document.querySelectorAll('.pf-form').forEach(f => f.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || e.defaultPrevented || e.target.getAttribute('aria-expanded') === 'true' || !P.edit) return;
    e.preventDefault(); endEdit(P.edit, false); }));
  document.querySelectorAll('[data-pf-undo]').forEach(b => b.onclick = async () => {
    const u = P.undo; if (!u || b.getAttribute('aria-busy')) return; busy(b, 'Putting it back…');
    try { await saveProfile(u.patch); } catch (e) { unbusy(b); toast(friendly(e), true); return; }
    P.undo = null; P.done = u.id; app.render(); announce('Put back.');
    requestAnimationFrame(() => $(`#pf-${u.id}-t`)?.focus({ preventScroll: true })); });
  document.querySelectorAll('[data-pf-hs]').forEach(b => b.onclick = () => {
    if (b.dataset.pfHs === 'no') { try { localStorage.setItem(HS_NO, '1'); } catch { /* private mode */ } P.hsHow = false; app.render(); requestAnimationFrame(() => $('#pf-h')?.focus({ preventScroll: true })); return; }
    P.hsHow = true; logAct('home_how'); app.render(); requestAnimationFrame(() => $('.pf-steps')?.closest('section')?.querySelector('h2')?.focus?.()); });
  const about = $('#pf-about-f');
  if (about) {
    const d = P.d;
    $('#pf-name').oninput = e => { d.name = e.target.value; };
    wirePicker($('#pf-tp-host'), 'pf', d.tp);
    wireAddr('pf-ad', d.addr);
    about.onsubmit = e => { e.preventDefault(); const b = $('#pf-about-save'), a = d.addr;
      if (a.q.trim() && !a.picked) { say('pf-about-msg', inlineErr('pf-about-err', 'Pick your address from the list, so we can find your districts. Or clear the box to keep what you have.')); return; }
      trySave('about', b, async () => {
        // Words typed in the box but not added are kept (C-9; the review found them lost without a word).
        const typed = pendingTitle(d.tp), titles = typed && !d.tp.chosen.includes(typed) ? [...d.tp.chosen, typed] : d.tp.chosen, was = myTitles();
        await saveProfile({ name: d.name, titles, ...(a.picked && a.sd ? { house: a.hd, senate: a.sd } : {}) });
        if (a.picked && a.sd) rememberDistricts(a.sd, a.hd, a.q);
        const gone = was.filter(t => !titles.includes(t));
        P.undo = gone.length ? { id: 'about', label: `Saved. Took off ${gone.map(titleLabel).join(', ')}.`, patch: { titles: was } } : null;
      }); };
  }
  const story = $('#pf-story-f');
  if (story) {
    const d = P.d;
    $('#pf-storyt').oninput = e => { d.text = e.target.value; };
    $('#pf-topic').onchange = e => { d.topic = e.target.value; $('#pf-story-ask').textContent = storyAsk(d.topic); };
    const del = story.querySelector('[data-pf-storydel]'); if (del) del.onclick = () => { d.text = ''; story.requestSubmit(); };
    story.onsubmit = e => { e.preventDefault(); trySave('story', $('#pf-story-save'), async () => {
      const st = myStories(), was = { story: myStory(), stories: { ...st } }; let any = was.story;
      if (d.orig !== null && d.orig !== d.topic) { if (d.orig) delete st[d.orig]; else any = ''; }   // moved to another topic
      const text = d.text.trim();
      if (d.topic) { if (text) st[d.topic] = text; else delete st[d.topic]; } else any = text;
      await saveProfile({ story: any, stories: st });
      const gone = (was.story && !any) || Object.keys(was.stories).some(k => !st[k]);
      P.undo = gone ? { id: 'story', label: 'Story removed.', patch: was } : null;
    }); };
  }
  const qf = $('#pf-quote-f');
  if (qf) {
    qf.querySelectorAll('input[name="pf-quote"]').forEach(r => r.onchange = () => { if (r.checked) P.d.quote = r.value; });
    qf.onsubmit = e => { e.preventDefault(); trySave('quote', $('#pf-quote-save'), () => saveProfile({ quote: P.d.quote })); };
  }
  const help = $('#pf-help-f');
  if (help) {
    help.querySelectorAll('[data-pf-int]').forEach(c => c.onchange = () => { if (c.checked) P.d.ints.add(c.dataset.pfInt); else P.d.ints.delete(c.dataset.pfInt); });
    help.onsubmit = e => { e.preventDefault(); trySave('help', $('#pf-help-save'), () => saveProfile({ interests: [...P.d.ints] })); };
  }
  const email = $('#pf-email-f');
  if (email) {
    CHOICES.forEach(([k]) => { const c = $(`#pf-em-${k}`); if (c) c.onchange = () => { P.d.choices[k] = c.checked; }; });
    email.onsubmit = e => { e.preventDefault(); trySave('email', $('#pf-email-save'), async () => {
      const prefs = { ...(S.user.prefs || {}), hearing_alerts: P.d.choices.alerts, action_alerts: P.d.choices.action, consent_at: new Date().toISOString() };
      const { error } = await S.supa.from('public_users').update({ prefs }).eq('id', S.user.id); if (error) throw error;
      S.user.prefs = prefs; S.consentCard = false; }); };
  }
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
    // A fresh arrival starts with every section closed; a redraw of the same page keeps what is being typed.
    if (!document.querySelector('#main .pf')) Object.assign(P, { edit: null, d: null, del: false, done: '', made: '', undo: null, hsHow: false });
    return profileView();
  },
  wire() { wireProfile(); },
};
