// You (R-303, Nate's "make best choices" of 10/17), behind ?rec=1: the fourth tab's page and the pages under it, in the calm
// shapes of Home (R-300) and the bill page in layout 3 (R-302). Today's More, Profile, Privacy and Help are drawn without it.
//   #/more     "You": the person first (their profile card, or the invitation to get alerts), then four quiet rows (your
//              lawmakers, your alerts, your session, Help; and the event staff posted, when there is one) and three quiet footer links (About HIPHI, Privacy and
//              accessibility, My issues link: Nate's 10/10 decision keeps it here). It was a 16-destination drawer
//              (more-help-frame-firstvisit.md section 1); "Every bill HIPHI tracks" and "Committees" moved to Find's foot.
//   #/privacy  "In short" open, every other section a closed card with its first sentence as the preview, Accessibility its
//              own card near the top. The words are the page's own, unchanged (a lawyer should confirm any change to them).
// It also holds what the other pages under You share: the back row that names the page behind (B-4), the "Your alerts" row
// Profile starts with, and this page group's stylesheet (pub/rec/you.css), which comes with the first page drawn under
// ?rec=1 and holds a skeleton until it is in, so nothing draws unstyled.
import { S, app, esc, icon, toast, issuesLink } from '../core.js';
import { skeleton } from '../ui.js';
import { MARK } from '../art.js';
import { t } from '../i18n.js';
import { langPicker, wireLangPicker } from '../langpick.js';
import { hasProfile, myName, myTitles, initials } from '../myprofile.js';
import { titleLabel } from '../titles.js';
import { codesOn } from '../phone.js';
import { alertStatus } from '../alerts.js';
import { myDistricts, seat, legName, meetEvent, HIPHI } from '../more.js';
import { REC, recHead, recBack, recRow, recRows, recFold, recFolds, wireKit, BOX, keep } from './kit.js';

// ---------------- the stylesheet ----------------
// pub/app.js brings rec/rec.css to every page under ?rec=1; this group's own rules come with the first of its pages. Until
// they are in, the page draws its loading shape and draws again when they land (R-184's lesson: no unstyled rows).
const HREF = 'pub/rec/you.css';
let cssOk = false;
export function youCss() {
  if (cssOk) return true;
  let l = document.querySelector(`link[rel="stylesheet"][href="${HREF}"]`);
  if (l?.sheet) return (cssOk = true);
  if (!l) {
    l = document.createElement('link'); l.rel = 'stylesheet'; l.href = HREF;
    l.onload = l.onerror = () => { cssOk = true; app.render(); };
    document.head.appendChild(l);
  }
  return false;
}
export const youWait = () => `<div class="mr">${skeleton(4)}</div>`;
if (REC()) youCss();   // asked for as soon as this module loads, so it is usually in before the first draw

// ---------------- the back row ----------------
// "← <the page behind>" (B-4; the frame's decision 2): the page this one was opened from, by its name, when it has one;
// otherwise the page above it. Real Back when it is the page behind (pub/app.js data-back), so nothing stacks.
const NAMES = { more: 'You', alerts: 'Your alerts', signin: 'Sign in', privacy: 'Privacy', profile: 'Your profile', settings: 'Your profile', help: 'Help' };
export function backFrom(href, label) {
  const prev = String(history.state?.prev || ''), here = location.hash.split('?')[0];
  const name = prev === '#/' || prev === '' ? 'home' : (/^#\/([a-z]+)/.exec(prev) || [])[1] || '';
  if (prev && prev.split('?')[0] !== here && !['start', 'learn', 'next', 'follow'].includes(name)) {
    const words = NAMES[name] || app.placeName?.(prev);
    if (words) return recBack(prev, words);
  }
  return recBack(href, label);
}

// ---------------- You ----------------
// The person first (R-147): their initials, name and what their profile says; without one, the invitation named for what
// people come here for (X10-4), worded as the alerts page's own heading, so the row and the page it opens agree (A-14).
function meCard() {
  if (!hasProfile()) return `<a class="yu-me yu-me-new" href="#/alerts"><span class="yu-av" aria-hidden="true">${icon('bell')}</span>
      <span class="yu-met"><span class="yu-men">${t('Get alerts on your issues')}</span><span class="yu-mes">${t('A text or email when your voice matters most on your issues. Free.')}</span></span>${icon('chevron-right', { cls: 'rc-chev' })}</a>
    <p class="yu-in">${t('Made one before? {a}Sign in{b}', { a: `<a href="${codesOn() ? '#/signin?by=number' : '#/signin'}">`, b: '</a>' })}</p>`;   // the profile page's words (one name per thing, C-15)
  const name = myName(), ini = initials(name), d = myDistricts(), ts = myTitles();
  const about = [ts.slice(0, 2).map(titleLabel).join(', '), d ? `Senate ${d.senate}, House ${d.house}` : ''].filter(Boolean).join(' · ');
  return `<a class="yu-me" href="#/profile"><span class="yu-av" aria-hidden="true">${ini ? esc(ini) : icon('user')}</span>
    <span class="yu-met"><span class="yu-men">${name ? esc(name) : t('Your profile')}</span><span class="yu-mes">${esc(about || (name ? t('Your profile') : t('Add your name and titles')))}</span></span>${icon('chevron-right', { cls: 'rc-chev' })}</a>`;
}
// Your two lawmakers by name once the districts are known (this device's, or the account's); the directory may not be in
// yet, so the districts stand in for the names until it is.
function lawmakersLine() {
  const d = myDistricts(); if (!d) return t('Find who represents you');
  const s = seat('S', d.senate), h = seat('H', d.house);
  return s && h ? `${legName(s)} and ${legName(h)}` : `Senate District ${d.senate} and House District ${d.house}`;
}
// The event staff posted (R-067), its own row on You when there is one (Nate 18 Oct, card 11: on More it was a full row, and
// the redesign had put it one tap down inside About HIPHI). It opens the event's page in a new tab, so it ends with that
// mark, not a chevron; without a link it is the words alone.
function eventRow() {
  const c = meetEvent(); if (!c) return '';
  const inner = `<span class="rc-lead">${icon('calendar-days')}</span><span class="rc-rtext"><span class="rc-rname">${esc(c.title)}</span>${c.body ? `<span class="rc-rstat">${esc(keep(c.body))}</span>` : ''}</span>`;
  return `<li class="yu-event">${c.link_url ? `<a class="rc-row" href="${esc(c.link_url)}" target="_blank" rel="noopener">${inner}${icon('external-link', { cls: 'rc-chev' })}<span class="sr">(opens in a new tab)</span></a>`
    : `<div class="rc-row">${inner}</div>`}</li>`;
}
// The rest of hiphi.org, behind one quiet "About HIPHI" (it was seven cards on a laptop, more-help... section 1 con 5).
// Donate stays last (R-067's order).
const ext = (lead, title, sub, href, leadHtml = '') => `<a class="rc-way yu-ext" href="${esc(href)}" target="_blank" rel="noopener"><span class="rc-wic">${leadHtml || icon(lead)}</span><span><span class="rc-wt">${title}</span>${sub ? `<span class="rc-ws">${sub}</span>` : ''}</span>${icon('external-link', { cls: 'rc-chev' })}<span class="sr">(opens in a new tab)</span></a>`;
function aboutHiphi() {
  return `${ext('', t('About HIPHI'), t('Hawaiʻi Public Health Institute'), HIPHI.about, `<span class="yu-mark">${MARK}</span>`)}
    ${ext('megaphone', t('Action Center'), t('More ways to speak up for health'), HIPHI.act)}
    ${ext('newspaper', t('Newsletter'), t('HIPHI news and events by email'), HIPHI.news)}
    ${ext('scroll-text', t('Legislative Recap'), t('What passed for health each year'), HIPHI.recap)}
    ${ext('hand-heart', t('Donate'), t('Support HIPHI’s work'), HIPHI.donate)}`;
}
export function youView() {
  const rows = [
    { name: t('Your lawmakers'), text: lawmakersLine(), href: '#/legislators', lead: 'users' },
    hasProfile() && { name: t('Your alerts'), text: alertStatus().title, href: '#/alerts', lead: 'bell' },
    { name: t('Your session'), text: t('What you did and what came of it'), href: '#/recap', lead: 'sparkles' },
    { name: t('Help'), text: t('Plain answers on hearings, testimony and deadlines'), href: '#/help', lead: 'circle-help' },
  ].filter(Boolean);
  const open = !!S.yuAbout;
  return `<div class="mr mr-more rc yu yu-you">
    ${recHead({ title: t('You') })}
    ${meCard()}
    ${langPicker('mr-lang')}
    <nav class="yu-rows" aria-label="${esc(t('You'))}"><ul class="rc-rows ${BOX}" role="list">${rows.map(recRow).join('')}${eventRow()}</ul></nav>
    <nav class="yu-foot" aria-label="${esc(t('About this tracker'))}">
      <button type="button" class="yu-fl" data-yu-about aria-expanded="${open}" aria-controls="yu-about"><span>${t('About HIPHI')}</span>${icon('chevron-down', { cls: 'yu-flc' })}</button>
      <a class="yu-fl" href="#/privacy">${t('Privacy and accessibility')}</a>
      ${issuesLink() ? `<button type="button" class="yu-fl" data-mr-keep aria-describedby="yu-keep-h">${icon('copy', { cls: 'yu-flc' })}<span>${t('Copy My issues link')}</span></button><span class="sr" id="yu-keep-h">${t('A link that opens your issues on any phone or browser. No account needed.')}</span>` : ''}
    </nav>
    <div class="rc-card yu-about" id="yu-about"${open ? '' : ' hidden'}>${aboutHiphi()}</div>
    <p class="yu-src">${t('Bill details come from the Hawaiʻi State Legislature and update several times a day. Positions marked HIPHI are HIPHI’s own.')}</p>
  </div>`;
}
export function wireYou() {
  const root = document.querySelector('#main .yu-you'); if (!root) return;
  wireLangPicker();
  const b = root.querySelector('[data-yu-about]'), box = root.querySelector('#yu-about');
  if (b && box) b.onclick = () => { S.yuAbout = !S.yuAbout; b.setAttribute('aria-expanded', String(S.yuAbout)); box.hidden = !S.yuAbout;
    if (S.yuAbout) box.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); };
  // My issues link (R-123): copied, or, where copying is refused, a text to oneself with it.
  root.querySelector('[data-mr-keep]')?.addEventListener('click', async () => { const link = issuesLink();
    try { await navigator.clipboard.writeText(link); toast('Your issues link is copied. Paste it into a text or a note, and open it on any phone.', { yay: true }); }
    catch { location.href = `sms:?&body=${encodeURIComponent('My issues on HIPHI’s Bill Tracker: ' + link)}`; } });
}

// ---------------- Profile's first row ----------------
// Profile keeps one page (R-165: no box after box) and gives its alerts their own page; this row is the way there, with the
// alerts' state in the one rule's words (alerts.js alertStatus, D1-4).
export const profileAlertsRow = () => `<nav class="rc-card yu-pfal" aria-label="Your alerts">${recRows([{ name: 'Your alerts', text: alertStatus().title, href: '#/alerts', lead: 'bell' }])}</nav>`;

// ---------------- Privacy ----------------
// rows: the sections as the page has them ([icon, title, body] with the sign-in-by-number words already swapped in); a11y:
// the accessibility statement's own paragraphs (more.js ACCESS);
// the first ("What we have on you, in short") stays open, the rest are closed cards whose preview is their own first
// sentence, so no new words are written for them. Accessibility is a card of its own, second.
const plain = s => String(s).replace(/<\/(p|li)>/g, ' ').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const firstLine = p => { const s = plain(Array.isArray(p) ? p[0] : String(p).split('\n\n')[0]); const m = /^(.+?[.!?])(\s|$)/.exec(s); return m ? m[1] : s; };
const body = p => Array.isArray(p) ? `<ul class="mr-factlist">${p.map(x => `<li>${x}</li>`).join('')}</ul>` : String(p).split('\n\n').map(x => `<p>${x}</p>`).join('');
export function privacyRec({ rows, updated, policy, a11y }) {
  const [[, t0, p0], ...rest] = rows;
  return `<div class="mr mr-privacy rc yu yu-pv">
    ${backFrom('#/more', 'You')}
    ${recHead({ title: 'Privacy', lede: 'What we keep, who sees it, and how to remove it.' })}
    <section class="rc-card yu-short" aria-labelledby="mr-pv-0"><h2 class="rc-h2" id="mr-pv-0">${t0}</h2>${body(p0)}</section>
    ${recFolds([`<div id="mr-access">${recFold('privacy-access', 'Accessibility', firstLine(plain(a11y)), a11y)}</div>`,
      ...rest.map(([ic, ti, p]) => recFold(`privacy-${ic}`, plain(ti), firstLine(p), body(p)))])}
    <p class="small muted yu-upd">Updated ${esc(updated)}.</p>
    <p class="mr-ext"><a class="btn text" href="${esc(policy)}" target="_blank" rel="noopener">${icon('external-link')}<span>HIPHI’s website privacy policy</span></a></p>
  </div>`;
}
// "Privacy and accessibility" and the old #/privacy?part=access open the page; the second opens the Accessibility card.
export function wirePrivacyRec() {
  const root = document.querySelector('#main .yu-pv'); if (!root) return;
  wireKit(root);
  if (!/[?&]part=access\b/.test(location.hash)) return;
  const d = root.querySelector('[data-rc-fold="privacy-access"]'); if (!d) return;
  d.open = true;
  requestAnimationFrame(() => { const s = d.querySelector('summary'); s.focus({ preventScroll: true }); d.scrollIntoView({ block: 'start' }); });
}
