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
import { alertFields, alertButton, wireAlertForm, fmtPhone } from './alerts.js';
import { hasProfile, signedIn, myName, myTitles, myStory, quoteOk, myInterests, initials, saveProfile, loadMe } from './myprofile.js';
import { pickerHTML, wirePicker, titleChips } from './titlepick.js';
import { asWords } from './titles.js';

const $ = s => document.querySelector(s);
const DISTRICTS_KEY = 'hiphi_districts';
const HELP = INTERESTS.filter(([k]) => k !== 'quote');   // "HIPHI may quote me" sits with the story now
// P: this visit's page. edit: the section being changed ('about' | 'story' | 'help' | 'email'), with its draft; del: the
// delete question showing; done: the section that just saved (its "Saved" line).
const P = { edit: null, d: null, del: false, done: '', made: '' };
const masked = d => `(${d.slice(0, 3)}) ••• ${d.slice(6)}`;
const place = () => { try { const d = JSON.parse(localStorage.getItem(DISTRICTS_KEY) || 'null'); return d?.label || ''; } catch { return ''; } };
const since = () => { const at = S.user?.created_at || textSaved()?.at; return at ? new Date(at).toLocaleDateString('en-US', { timeZone: HST, month: 'long', year: 'numeric' }) : ''; };
const av = (cls = 'pf-av') => { const i = initials(); return `<span class="${cls}" aria-hidden="true">${i ? esc(i) : icon('user')}</span>`; };
// change: false, or 'Change' | 'Add' (an empty section says Add, review 10/4); href: a Change that opens another page.
const sec = (id, title, body, { change = 'Change', href = '', extra = '' } = {}) => `<section class="card pf-sec" id="pf-${id}" aria-labelledby="pf-${id}-t">
    <div class="pf-sech"><h2 id="pf-${id}-t">${title}</h2>${change ? btn(change, { kind: 'text', sm: true, icon: change === 'Add' ? 'plus' : 'pencil', ...(href ? { href } : {}), attrs: { ...(href ? {} : { 'data-pf-edit': id }), 'aria-describedby': `pf-${id}-t` } }) : ''}</div>
    ${body}${P.done === id ? `<p class="okmsg pf-ok" role="status">${icon('circle-check')}<span>Saved.</span></p>` : ''}${extra}</section>`;
const empty = text => `<p class="pf-empty">${text}</p>`;
const kv = (k, v) => `<div class="pf-kv"><p class="pf-k">${k}</p>${v}</div>`;

// ---------------- no profile yet: the invitation ----------------
function inviteView() {
  S.alertMode ??= 'phone';
  const b = alertButton();
  return `<div class="mr pf pf-invite">
    <header class="pagehead"><span class="pf-av pf-av-lg" aria-hidden="true">${icon('user')}</span><h1 class="hero">Make your profile</h1>
      <p class="lede">Get a text or email when a bill on your issues has a hearing, in time to speak up. Your issues and letters stay saved. Free, and no password.</p></header>
    <form class="card mr-form mr-panel" id="pf-al" novalidate>${alertFields('pf-alf', { emailHref: '#/signin' })}
      <div class="mr-send">${submitBtn(b.label, b.icon, 'pf-al-send')}</div></form>
    <p class="small muted pf-back">Added your email before? <a href="#/signin">Sign in on this device</a></p>
  </div>`;
}
function wireInvite() {
  wireAlertForm($('#pf-al'), { pfx: 'pf-alf', source: 'more', onDone: r => {
    // Said on the page, under the header (the review: a toast covered the first section's Save and Cancel).
    P.made = r.kind === 'phone' ? `Your profile is made. Our first text to ${fmtPhone(r.phone)} asks you to reply YES.` : '';
    app.render();
    if (r.kind !== 'phone') toast('Check your inbox: open the link to finish your profile.', { yay: true });
    requestAnimationFrame(() => $('#pf-h')?.focus());
  } });
}

// ---------------- the profile ----------------
function aboutBody() {
  const name = myName(), titles = myTitles(), d = myDistricts(), town = place();
  return `${kv('Name on your letters', name ? `<p class="strong">${esc(name)}</p>` : empty('Not added yet.'))}
    ${kv('I’m a…', titles.length ? `${titleChips(titles)}<p class="small muted">Your letters start “${esc(asWords(titles.slice(0, 2)))}, I support…”, with the two that fit each bill best.</p>`
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
function storyBody() {
  const s = myStory();
  return `${s ? `<blockquote class="pf-story">${esc(s)}</blockquote>` : empty('Not added yet. One or two sentences on why these issues matter to you. It starts the “why” of your letters, and you can change it each time.')}
    <p class="small muted">HIPHI may quote me: <span class="strong">${quoteOk() ? 'Yes' : 'No'}</span></p>`;
}
function storyEdit() {
  const d = P.d;
  return `<form class="pf-form" id="pf-story-f" novalidate>
    <div class="field"><label for="pf-storyt">Your story</label>
      <textarea id="pf-storyt" rows="4" maxlength="600" placeholder="As a parent of two teenagers…" aria-describedby="pf-story-h" autocapitalize="sentences">${esc(d.story)}</textarea>
      <span class="help" id="pf-story-h">One or two sentences, in your own words. A personal reason carries the most weight with lawmakers. You don’t have to share health details to be heard.</span></div>
    ${check('pf-quote', 'HIPHI may quote me', 'HIPHI may share your story, with your first name, to show lawmakers why a bill matters.', d.quote)}
    <div id="pf-story-msg"></div>
    <div class="btnrow">${submitBtn('Save', 'check', 'pf-story-save')}${btn('Cancel', { kind: 'text', attrs: { 'data-pf-cancel': '' } })}</div></form>`;
}
function helpBody() {
  const ints = myInterests(), acct = !!loadMe().capitolAcct;
  return `${ints.length ? `<div class="chips tp-show">${HELP.filter(([k]) => ints.includes(k)).map(([, l]) => `<span class="chip info">${esc(l)}</span>`).join('')}</div>` : empty('Not added yet. Tell HIPHI if you’d testify in person, host an event or volunteer.')}
    <p class="small pf-acct">${icon(acct ? 'circle-check' : 'info')}<span>${acct ? 'Your Capitol website account is ready for testimony.' : 'The first time you send testimony, the letter helper walks you through the Capitol website’s free account.'}</span></p>`;
}
function helpEdit() {
  return `<form class="pf-form" id="pf-help-f" novalidate><fieldset class="mr-set"><legend>How would you like to help?</legend>
    ${HELP.map(([k, l]) => check(`pf-int-${k}`, l, '', P.d.ints.has(k), ` data-pf-int="${k}"`)).join('')}</fieldset>
    <div id="pf-help-msg"></div>
    <div class="btnrow">${submitBtn('Save', 'check', 'pf-help-save')}${btn('Cancel', { kind: 'text', attrs: { 'data-pf-cancel': '' } })}</div></form>`;
}
function alertsBody() {
  const t = textSaved(), p = S.user?.prefs || {};
  const texts = t ? `<p>${icon('message-square')} Texts to <span class="strong">${esc(masked(t.phone))}</span>: hearings on your issues and HIPHI’s asks, at most one a day.</p>${signedIn() ? '<p class="small"><a href="#/alerts">Change number or stop texts</a></p>' : ''}`
    : `<p>${icon('message-square')} Texts: off.${signedIn() ? ' <a href="#/alerts">Get text alerts</a>' : ''}</p>`;
  const email = signedIn() ? `<p>${icon('mail')} Emails to <span class="strong mr-break">${esc(S.session.user.email || '')}</span>:</p>
      <ul class="pf-list" role="list">${CHOICES.map(([, key, t2]) => `<li>${icon(p[key] === true ? 'check' : 'x')}<span>${esc(t2)}: <span class="strong">${p[key] === true ? 'on' : 'off'}</span></span></li>`).join('')}</ul>`
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
  if (!signedIn()) return `<p>Your profile is saved on this phone. <a href="#/signin">Add your email</a> to keep it on any phone or computer. HIPHI staff never see your text-alert number. We never sell your information or give it to other groups. <a href="#/privacy">Read about privacy</a></p>`;
  // R-151's and R-153's wording (10/4: the privacy page made accurate; kept emails), with the profile's titles and story named.
  return `<p>We keep your email, the issues you picked, the bills and lists you follow, where you stand on each bill you follow (support, oppose or not sure), the actions you mark, your email choices, which of our emails you open and what you add on this page, including your titles and your story. HIPHI staff can see all of it, except your testimony letters and emails to lawmakers: we keep the last of each you sent on each bill, so they’re ready for the bill’s next step, and only you can see them. Your street address is never kept, only your districts. We never sell your information or give it to other groups. <a href="#/privacy">Read about privacy</a></p>
    <div class="btnrow">${btn('Sign out', { kind: 'secondary', sm: true, icon: 'log-out', attrs: { 'data-pf-signout': '' } })}</div>
    ${P.del ? `<div class="mr-confirm" role="group" aria-labelledby="mr-del-t">
        ${notice('bad', 'triangle-alert', `<p class="strong" id="mr-del-t" tabindex="-1">Delete your account for good?</p><p>This deletes your account and profile, the issues and bills you follow, where you stand on them, the actions you marked and your saved letters, here and on our side. It can’t be undone.</p>`)}
        <div id="mr-del-msg"></div>
        <div class="btnrow">${btn('Yes, delete my account', { kind: 'danger', icon: 'trash-2', attrs: { 'data-mr-del': 'yes' } })}${btn('Keep my account', { kind: 'text', attrs: { 'data-mr-del': 'no' } })}</div>
      </div>` : `<div class="mr-delrow">${btn('Delete my account', { kind: 'danger', icon: 'trash-2', attrs: { 'data-mr-del': 'ask' } })}</div>`}`;
}

function profileView() {
  if (!hasProfile()) return inviteView();
  if (signedIn() && !S.user) return `<div class="mr pf"><header class="pagehead"><h1 class="hero">Your profile</h1></header><div class="skelpage" aria-busy="true" aria-label="Loading"><div class="skel" style="height:160px"></div><div class="skel" style="height:280px"></div></div></div>`;
  const name = myName(), t = textSaved(), s = since();
  const contact = [signedIn() ? esc(S.session.user.email || '') : '', t ? `Texts to ${esc(masked(t.phone))}` : ''].filter(Boolean).join(' · ');
  const E = P.edit;
  return `<div class="mr pf">
    <header class="pagehead pf-head">${av('pf-av pf-av-lg')}<div class="pf-who"><h1 class="hero" id="pf-h" tabindex="-1">${name ? esc(name) : 'Your profile'}</h1>
      <p class="meta mr-break">${contact}${s ? `<span class="pf-since"> · Speaking up since ${esc(s)}</span>` : ''}</p></div></header>
    ${P.made ? `<p class="okmsg pf-made" role="status">${icon('circle-check')}<span>${esc(P.made)}</span></p>` : ''}
    ${DEMO ? notice('info', 'info', 'You’re in the sandbox: what you change here stays in this browser and is never sent.') : ''}
    ${sec('about', 'About you', E === 'about' ? aboutEdit() : aboutBody(), { change: E !== 'about' && (myName() || myTitles().length || myDistricts() ? 'Change' : 'Add') })}
    ${sec('story', 'Your story', E === 'story' ? storyEdit() : storyBody(), { change: E !== 'story' && (myStory() ? 'Change' : 'Add') })}
    ${sec('help', 'How you’ll help', E === 'help' ? helpEdit() : helpBody(), { change: E !== 'help' && (myInterests().length ? 'Change' : 'Add') })}
    ${sec('email', 'Alerts', E === 'email' ? emailEdit() : alertsBody(), signedIn() ? { change: E !== 'email' && 'Change' } : { href: '#/alerts' })}
    ${sec('issues', 'Your issues', issuesBody(), { change: false })}
    ${sec('data', 'Your data', dataBody(), { change: false })}
  </div>`;
}

function startEdit(id) {
  P.done = ''; P.del = false; P.made = '';
  if (id === 'about') { const d = myDistricts();
    P.d = { name: myName(), tp: { chosen: myTitles(), q: '', more: false, student: false, active: -1 },
      addr: { q: '', sd: d?.senate || null, hd: d?.house || null, picked: false, results: [] } }; }
  else if (id === 'story') P.d = { story: myStory(), quote: quoteOk() };
  else if (id === 'help') P.d = { ints: new Set(myInterests()) };
  else if (id === 'email') { const p = S.user?.prefs || {}; P.d = { choices: { alerts: p.hearing_alerts === true, action: p.action_alerts === true } }; }
  P.edit = id; app.render();
  requestAnimationFrame(() => { const f = $(`#pf-${id} input, #pf-${id} textarea`); f?.focus({ preventScroll: true }); $(`#pf-${id}`)?.scrollIntoView({ block: 'start' }); });
}
function endEdit(id, saved) {
  P.edit = null; P.d = null; P.done = saved ? id : ''; app.render();
  requestAnimationFrame(() => $(`#pf-${id} [data-pf-edit]`)?.focus({ preventScroll: true }));
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
  const about = $('#pf-about-f');
  if (about) {
    const d = P.d;
    $('#pf-name').oninput = e => { d.name = e.target.value; };
    wirePicker($('#pf-tp-host'), 'pf', d.tp);
    wireAddr('pf-ad', d.addr);
    about.onsubmit = e => { e.preventDefault(); const b = $('#pf-about-save'), a = d.addr;
      if (a.q.trim() && !a.picked) { say('pf-about-msg', inlineErr('pf-about-err', 'Pick your address from the list, so we can find your districts. Or clear the box to keep what you have.')); return; }
      trySave('about', b, async () => {
        await saveProfile({ name: d.name, titles: d.tp.chosen, ...(a.picked && a.sd ? { house: a.hd, senate: a.sd } : {}) });
        if (a.picked && a.sd) rememberDistricts(a.sd, a.hd, a.q);
      }); };
  }
  const story = $('#pf-story-f');
  if (story) {
    $('#pf-storyt').oninput = e => { P.d.story = e.target.value; };
    $('#pf-quote').onchange = e => { P.d.quote = e.target.checked; };
    story.onsubmit = e => { e.preventDefault(); trySave('story', $('#pf-story-save'), () => saveProfile({ story: P.d.story, quote: P.d.quote })); };
  }
  const help = $('#pf-help-f');
  if (help) {
    help.querySelectorAll('[data-pf-int]').forEach(c => c.onchange = () => { if (c.checked) P.d.ints.add(c.dataset.pfInt); else P.d.ints.delete(c.dataset.pfInt); });
    help.onsubmit = e => { e.preventDefault(); trySave('help', $('#pf-help-save'), () => saveProfile({ interests: [...P.d.ints], quote: quoteOk() })); };
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
    S.session = null; S.user = null; if (S.ul) { S.ul.mine = null; S.ul.shared = {}; } app.go('#/more', { replace: true });
    toast('You’re signed out. Your bills stay on this device.');
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
      const me = JSON.parse(localStorage.getItem('hiphi_me') || 'null');
      if (me) { ['email', 'letters', 'titles', 'story', 'quote', 'interests'].forEach(k => delete me[k]); localStorage.setItem('hiphi_me', JSON.stringify(me)); }
      const w = JSON.parse(localStorage.getItem('hiphi_wiz') || 'null'); if (w && w.issues?.length) { w.issues = []; localStorage.setItem('hiphi_wiz', JSON.stringify(w)); } } catch { /* private mode */ }
    S.direct = new Set(); S.issueFollows = new Set(); S.catFollows = new Set(); S.skips = new Set(); recomputeWatch();
    S.stances = {}; S.done = new Set(); S.doneAt = {}; S.listFollows = new Set(); S.profile = {}; P.del = false; if (S.ul) { S.ul.mine = null; S.ul.shared = {}; }
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
    if (!document.querySelector('#main .pf')) Object.assign(P, { edit: null, d: null, del: false, done: '', made: '' });
    return profileView();
  },
  wire() { wireProfile(); },
};
