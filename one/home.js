// Home (R-360 part 6, #/): the front door. One job: show a newcomer what HIPHI does and the one thing worth doing now.
// From the top: the rainbow-and-people drawing (pub/art.js HELLO, already loaded for the bill screens) with what HIPHI
// does; "Needs voices this week", one card with the same one thing This week offers (week.js weekData: the soonest open
// deadline, a followed issue's bills first) and the one primary button; "Or start with what you care about", four issues,
// each opening Bills at that issue; then a quiet footer to the tracker's Help, Privacy, For advocacy groups and the tracker.
// Nothing is asked before a person's first action (Nate, 6 Nov): no sign-up, no follow prompt, no questions.
import { HELLO, issueBand } from '../pub/art.js';
import { icon } from '../icons.js';
import { t } from './i18n.js';
import { DEMO } from './data.js';
import { esc, header, keepHyphens } from './bill.js';
import { dateLong, sendBy } from './words.js';
import { followed } from './bills.js';
import { shortCmte } from './week.js';
import { tabs } from './tabs.js';

const ISSUES = 4;
// The drawing spans the header's width at its own shape (one.css .hd.hello: about 140px tall on a phone, A-1, so the card
// starts higher), its foot under the sheet and the sky cut above the people, so no head meets the sheet's edge at any
// width. The speech bubble moves from the top right of the sky to beside the middle person's head: there it stays in the
// cut, and clear of the practice copy's chip in the top right (R-360 fix pass); under 360 wide it is left out (one.css).
const ART = HELLO.replace('<rect x="256" y="30"', '<g class="bubble" transform="translate(-56 56)"><rect x="256" y="30"')
  .replace(/(<path d="M279 49\.1C[^>]*\/>)/, '$1</g>');
const COUNT = ['', 'One', 'Two', 'Three', 'Four'];
// The summary's first sentence: the card says what the bill does in one line; the bill screen has the rest.
const firstSentence = s => (String(s || '').match(/^.*?[.!?](?=\s|$)/) || [String(s || '')])[0].trim();

// The when line: the deadline in words.js sendBy's words, as the bill, Bills and This week say it ("Send testimony by
// today 9:30 AM."), then who meets on it and when, and that no one has to go: "The House Transportation Committee meets on
// it Tue, Mar 17. You don't need to go." (C-15: names with "Committee" in a sentence, no codes).
function whenLine(B, L) {
  if (B.action === 'testimony' && B.hearing) {
    const by = sendBy(B.hearing.deadline || B.hearing.at, L.now);
    const date = dateLong(B.hearing.at, { now: L.now }), one = shortCmte(B.hearing.committee, L.committees);
    const who = B.hearing.joint ? t('home.hear.many', { count: COUNT[B.hearing.count] || String(B.hearing.count), chamber: B.hearing.chamber, date })
      : one ? t('home.hear.one', { name: one, date }) : t('home.hear.any', { date });
    return { soon: by.soon, html: `<b>${esc(by.text)}.</b> ${esc(who)}` };
  }
  // The chair's email: the bill waits for a hearing (This week's words).
  return { soon: false, html: esc(B.waitUntil ? t('week.wait', { date: dateLong(B.waitUntil + 'T12:00:00-10:00', { now: L.now }) }) : t('week.wait.none')) };
}

function card(D, L) {
  const B = D.pick;
  if (!B) return `<section class="card pick" aria-labelledby="hm-h"><h3 class="sr" id="hm-h">${esc(t('home.voices'))}</h3>
    <p class="calm">${esc(t(D.sent.length ? 'week.none.after' : 'week.none'))}</p>
    <a class="primary" href="#/bills">${icon('list')}<span>${esc(t('home.go'))}</span></a></section>`;
  const testimony = B.action === 'testimony' && B.hearing, w = whenLine(B, L), sum = B.nickname ? firstSentence(B.summary) : '';
  return `<section class="card pick" aria-labelledby="hm-h">
    <div class="meta"><span class="num">${esc(B.numberSpaced)}</span>${B.position && t('pos.' + B.position) !== 'pos.' + B.position ? `<span class="pos pos-${esc(B.position)}">${esc(t('pos.' + B.position))}</span>` : ''}</div>
    <h3 id="hm-h">${keepHyphens(B.nickname || B.summary || B.numberSpaced)}</h3>
    ${sum ? `<p class="psum">${keepHyphens(sum)}</p>` : ''}
    <p class="ln${w.soon ? ' soon' : ''}">${icon('clock')}<span>${w.html}</span></p>
    <a class="primary" href="#/${esc(B.number)}/write" data-one="${esc(B.number)}">${icon(testimony ? 'send' : 'mail')}<span>${esc(t(testimony ? 'btn.testimony' : 'btn.email'))}</span></a>
    <p class="small">${esc(t(testimony ? 'btn.time' : 'btn.time.email'))}</p></section>`;
}

// The four issues: the ones the person follows first, then the ones with the most bills needing voices this week, then by
// name. Only issues with bills, so Bills always has the section to open at.
export function fourIssues(D, L) {
  const n = new Map();
  for (const b of L.bills) if (D.soon(b)) for (const id of b.issues) n.set(id, (n.get(id) || 0) + 1);
  const has = new Set(L.bills.flatMap(b => b.issues));
  return L.issues.filter(i => has.has(i.id))
    .map(i => ({ i, f: followed(i) ? 1 : 0, n: n.get(i.id) || 0 }))
    .sort((x, y) => y.f - x.f || y.n - x.n || x.i.name.localeCompare(y.i.name))
    .slice(0, ISSUES).map(x => x.i);
}

function issues(D, L) {
  const chev = icon('chevron-right', { size: '18px', cls: 'chev' });
  return `<div class="rows">${fourIssues(D, L).map(i => {
    const band = issueBand(i, true), th = band.startsWith('<img') ? `<span class="th">${band}</span>` : '';
    const cat = L.cats.find(c => c.key === i.category)?.name || '';
    return `<a class="r ri" href="#/bills/${esc(i.slug)}" data-issue="${esc(i.slug)}">${th}<span class="t"><b>${keepHyphens(i.name)}</b>${cat ? `<span class="lab">${esc(cat)}</span>` : ''}</span>${chev}</a>`;
  }).join('')}</div>
  <p class="allis"><a href="#/bills">${esc(t('home.all'))}${icon('arrow-right', { size: '1em' })}</a></p>`;
}

// The tracker's own pages (pub/app.js routes); the practice copy stays the practice copy.
const TRACK = `track.html${DEMO ? '?demo=1' : ''}`;
const foot = () => `<nav class="foot" aria-label="${esc(t('home.more'))}"><a href="${TRACK}#/help">${esc(t('home.help'))}</a><a href="${TRACK}#/privacy">${esc(t('home.privacy'))}</a>`
  + `<a href="${TRACK}#/groups">${esc(t('home.groups'))}</a><a href="${TRACK}">${esc(t('home.tracker'))}</a></nav>`;

const top = () => `${header(null, { own: ART, brand: t('home.mark'), cls: 'hello' })}<main class="sheet home" id="main"%BUSY%>
    <h1 tabindex="-1">${esc(t('home.h'))}</h1>
    <p class="lede">${esc(t('home.lede'))}</p>
    <h2 class="sec">${esc(t('home.voices'))}</h2>`;

export const homeScreen = (D, L) => `${top().replace('%BUSY%', '')}
    ${card(D, L)}
    <h2 class="sec">${esc(t('home.care'))}</h2>
    ${issues(D, L)}
    ${foot()}
  </main>${tabs('home')}`;
// While the list loads: the words that never change, and grey lines where the card will be (A-15).
export const homeLoading = () => `${top().replace('%BUSY%', ' aria-busy="true"')}<p class="sr">${esc(t('home.loading'))}</p>
  <div class="bar h w100"></div><div class="bar w80"></div><div class="bar w100"></div><div class="bar w60"></div></main>${tabs('home')}`;
