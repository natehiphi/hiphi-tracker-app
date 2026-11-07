// The bill screen of act.html (R-360, Nate's pick C of 6 Nov 2026): the issue's drawing as the header, then the bill, then
// exactly one primary button (DESIGN A-3, P-2). Everything here is drawn from one/data.js's shape; nothing is fetched.
import { MARK, issueBand } from '../pub/art.js';
import { icon } from '../icons.js';
import { t } from './i18n.js';
import { DEMO } from './data.js';
import { isDone, sentAt } from './done.js';
import { HST } from './words.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// "Disposable e-cigarette ban": the word "e-cigarette" is not broken at its hyphen across two lines (the mockup's nowrap).
export const keepHyphens = s => esc(s).replace(/(\S+-\S+)/g, '<span class="nw">$1</span>');

// The header: the issue's own drawing (pub/issue-art, the map in pub/art.js) shows on this page whatever ISSUE_ART_LIVE says,
// Nate's yes for act.html (R-360). An issue with no drawing of its own gets a calm plain band, not the topic scenes: the
// header is a greeting, and a scene from another issue would say the wrong thing. The HIPHI mark sits on it either way.
// slim: the write and send screens keep the drawing's colours in a short band, so the letter has the room (one view at 390x844).
// own, brand: Home's own drawing (the rainbow and the people, pub/art.js HELLO) and its longer name on the pill (part 6).
// cls: one more class on the header (Home's 'hello', sized in one.css).
export function header(issue, { slim = false, own = '', brand = '', cls = '' } = {}) {
  const band = issue && !slim ? issueBand(issue, true) : '';
  const art = own || (band.startsWith('<img') ? band : '');
  return `<header class="hd${art ? '' : ' plain'}${slim ? ' slim' : ''}${cls ? ' ' + cls : ''}">${art}<div class="brand">${MARK}<span>${esc(brand || t('mark'))}</span></div>${DEMO ? `<span class="demo">${esc(t('practice'))}</span>` : ''}</header>`;
}

// "Part of Disposable e-cigarette ban" under a bill called "Disposable e-cigarette ban" says the name twice (A-14): left out.
const sameName = B => (B.nickname || '').trim().toLowerCase() === String(B.issue?.name || '').trim().toLowerCase();
const LINE_ICON = { capitol: 'landmark', calendar: 'calendar', flag: 'flag' };
// The one button picks itself (R-360): Send testimony while a hearing's testimony deadline is open, Email the chair while the
// bill waits in a committee with no hearing set, and none once the bill is over for the year (the plain line says why).
// It goes to #/HB2121/write (one/write.js), then #/HB2121/send (one/send.js).
// Once a sent letter has marked it (B-6, send.js), the screen says so and when, with a quiet Send again in place of the button.
function action(B) {
  if (!B.action) return '';
  const testimony = B.action === 'testimony';
  if (isDone(B)) {
    const at = sentAt(B), date = at ? new Date(at).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short', month: 'short', day: 'numeric' }) : '';
    return `<div class="cta sent"><p class="okline" role="status">${icon('circle-check')}<span>${esc(date ? t('bill.sent', { date }) : t('bill.sent.nodate'))}</span></p>
    <p class="more"><a href="#/${esc(B.number)}/write" data-go="write">${esc(t('bill.again'))}</a></p></div>`;
  }
  return `<div class="cta"><a class="primary" href="#/${esc(B.number)}/write" data-go="write">${icon(testimony ? 'send' : 'mail')}<span>${esc(t(testimony ? 'btn.testimony' : 'btn.email'))}</span></a>
    <p class="small">${esc(t(testimony ? 'btn.time' : 'btn.time.email'))}</p></div>`;
}

// back: the bill was opened from Bills (R-360 part 4), so a Back to Bills leads in place of the greeting.
// back: also marks the link data-hist, so app.js goes back in the history to the Bills the person left (B-4).
export function billScreen(B, { back = false } = {}) {
  // A bill with no nickname (HIPHI is only watching it) leads with its plain summary, said once (A-14).
  const head = B.nickname || B.summary || B.numberSpaced, sum = B.nickname ? B.summary : '';
  const lines = B.lines.map(l => `<div class="ln${l.soon ? ' soon' : ''}">${icon(LINE_ICON[l.icon] || 'landmark')}<p><b>${esc(l.lead)}</b>${l.rest ? ' ' + esc(l.rest) : ''}</p></div>`).join('');
  return `${header(B.issue)}
  <main class="sheet" id="main">
    <p class="kicker">${back ? `<a href="#/bills" class="back" data-back data-hist="#/bills">${icon('arrow-left', { size: '1em' })}${esc(t('bill.back'))}</a>` : esc(t('aloha'))}</p>
    <h1 tabindex="-1">${keepHyphens(head)}</h1>
    <div class="row"><span class="num">${esc(B.numberSpaced)}</span><span class="pos pos-${esc(B.position)}">${esc(t('pos.' + B.position))}</span></div>
    ${B.issue?.slug && !sameName(B) ? `<p class="partof"><a href="#/bills/${esc(B.issue.slug)}">${esc(t('bill.partof', { name: B.issue.name }))}</a></p>` : ''}
    ${sum ? `<p class="sum">${keepHyphens(sum)}</p>` : ''}
    <div class="stand${B.over ? ' over' : ''}">${lines}</div>
    ${action(B)}
    <p class="more"><a href="${esc(B.capitolUrl)}" target="_blank" rel="noopener">${esc(t('capitol'))}${icon('external-link', { size: '1em' })}</a></p>
  </main>`;
}

// While the bill loads: the header and grey lines where the words will be, so the page does not jump when they come (A-15).
export const loadingScreen = () => `${header(null)}<main class="sheet" id="main" aria-busy="true"><p class="sr">${esc(t('loading'))}</p>
  <div class="bar w60"></div><div class="bar h w80"></div><div class="bar w40"></div><div class="bar w100"></div><div class="bar w90"></div></main>`;

// We can't find that bill: the link's number is not one we know. One way out, to every bill HIPHI follows (B-3).
export const missingScreen = () => `${header(null)}<main class="sheet" id="main"><h1 tabindex="-1">${esc(t('missing.h'))}</h1>
  <p class="sum">${esc(t('missing.p'))}</p><div class="cta"><a class="primary" href="track.html${DEMO ? '?demo=1' : ''}">${esc(t('missing.go'))}</a></div></main>`;

// The bill could not load (DESIGN B-8, as pub/ui.js loadFail says it): what happened, that it is not them, and Try again in place.
// A failed load is never drawn as "not found".
// kind 'list': the Bills screen's list could not load (R-360 part 4).
export const failScreen = (kind = 'bill') => `${header(null)}<main class="sheet" id="main" role="alert"><h1 tabindex="-1">${esc(t(kind === 'list' ? 'fail.list.h' : 'fail.h'))}</h1>
  <p class="sum">${esc(t(navigator.onLine === false ? 'fail.offline' : 'fail.other'))}</p>
  <div class="cta"><button class="primary" type="button" data-retry>${icon('rotate-ccw')}<span>${esc(t('fail.again'))}</span></button></div></main>`;
