// The Mahalo screen of act.html (R-360 part 3): #/HB2121/thanks, after "Yes, I sent it" (send.js). One line on what happened,
// exactly one primary button (Share with a friend, which copies this page's link to the bill, without /thanks), one quiet
// link to the tracker, and Back to the bill. The email case says the email is on its way to the chair.
import { header, esc } from './bill.js';
import { icon } from '../icons.js';
import { t } from './i18n.js';
import { DEMO } from './data.js';
import { HST } from './words.js';
import { copyText } from './send.js';

const sh = new Map();   // per bill, for this visit: { copied, fail }
const st = B => { if (!sh.has(B.id)) sh.set(B.id, {}); return sh.get(B.id); };
// The address a friend opens: this page's own, with the bill's number. Not the /thanks step, and not the practice copy's ?demo=1.
const shareLink = B => location.origin + location.pathname + '#/' + B.number;

export function thanksScreen(B) {
  const s = st(B);
  let line;
  if (B.action === 'email') line = t('thanks.p.email');
  else if (B.hearing?.at) {
    const date = new Date(B.hearing.at).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short', month: 'short', day: 'numeric' });
    line = t('thanks.p', { number: B.numberSpaced, date });
  } else line = t('thanks.p.none');
  return `${header(B.issue)}
  <main class="sheet" id="main">
    <p class="kicker">${esc(B.nickname || B.numberSpaced)} · ${esc(B.numberSpaced)}</p>
    <h1 tabindex="-1">${esc(t('thanks.h'))}</h1>
    <p class="sum">${esc(line)}</p>
    <div class="cta"><button type="button" class="primary" data-share>${icon(s.copied ? 'check' : 'share-2')}<span>${esc(s.copied ? t('send.copied') : t('thanks.share'))}</span></button></div>
    ${s.fail ? `<p class="err" role="alert">${icon('circle-alert', { size: '1em' })}${esc(t('thanks.copyfail'))}</p><input class="sel" readonly value="${esc(shareLink(B))}" aria-label="${esc(t('thanks.share'))}">` : ''}
    <p class="more"><a href="track.html${DEMO ? '?demo=1' : ''}">${esc(t('thanks.other'))}</a></p>
    <p class="more"><a class="back" href="#/${esc(B.number)}">${icon('arrow-left', { size: '1em' })}${esc(t('thanks.back'))}</a></p>
  </main>`;
}

// Share: the copy is started inside the tap; "Copied" for two seconds, then the label comes back. If the clipboard refuses,
// the link is shown selected, so it can be copied by hand (as send.js does with the letter).
export function wireThanks(root, B, redraw) {
  const s = st(B);
  root.querySelector('[data-share]')?.addEventListener('click', async () => {
    const ok = await copyText(shareLink(B));
    s.copied = ok; s.fail = !ok; redraw({ keepFocus: '[data-share]' });
    if (!ok) { const box = root.querySelector('input.sel'); box?.focus(); box?.select(); return; }
    setTimeout(() => { if (s.copied) { s.copied = false; redraw({ keepFocus: '[data-share]' }); } }, 2000);
  });
}
