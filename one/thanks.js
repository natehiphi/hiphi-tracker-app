// The Mahalo screen of act.html (R-360 part 3): #/HB2121/thanks, after "Yes, I sent it" (send.js). One line on what happened,
// exactly one primary button (Share with a friend: the share sheet, or a copy of this page's link to the bill, without /thanks), one quiet
// link to the tracker, and Back to the bill. The email case says the email is on its way to the chair.
import { header, esc } from './bill.js';
import { icon } from '../icons.js';
import { t } from './i18n.js';
import { DEMO } from './data.js';
import { HST } from './words.js';
import { copyText } from './send.js';
import { later } from './later.js';

const sh = new Map();   // per bill, for this visit: { copied, fail }
const st = B => { if (!sh.has(B.id)) sh.set(B.id, {}); return sh.get(B.id); };
export const freshThanks = B => { const s = st(B); s.copied = false; };
// The address a friend opens: this page's own, with the bill's number. Not the /thanks step, and not the practice copy's ?demo=1.
const shareLink = B => location.origin + location.pathname + '#/' + B.number;

export function thanksScreen(B) {
  const s = st(B);
  let line;
  if (B.action === 'email') line = t('thanks.p.email');
  else if (B.hearing?.at) {
    const date = new Date(B.hearing.at).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short', month: 'short', day: 'numeric' });
    line = t(B.hearing.joint ? 'thanks.p.many' : 'thanks.p', { date });   // the number is in the line above (A-14)
  } else line = t('thanks.p.none');
  return `${header(B.issue)}
  <main class="sheet" id="main">
    <p class="kicker">${esc(B.nickname || B.numberSpaced)} · ${esc(B.numberSpaced)}</p>
    <h1 tabindex="-1">${esc(t('thanks.h'))}</h1>
    <p class="sum">${esc(line)}</p>
    <div class="cta"><button type="button" class="primary" data-share>${icon(s.copied ? 'check' : 'share-2')}<span>${esc(s.copied ? t('send.copied') : t('thanks.share'))}</span></button></div>
    ${s.fail ? `<p class="err" role="alert">${icon('circle-alert', { size: '1em' })}${esc(t('thanks.copyfail'))}</p><input class="sel" readonly value="${esc(shareLink(B))}" aria-label="${esc(t('thanks.share'))}">` : ''}
    <div class="after"><a href="track.html${DEMO ? '?demo=1' : ''}">${esc(t('thanks.other'))}</a>
      <a class="back" href="#/${esc(B.number)}">${icon('arrow-left', { size: '1em' })}${esc(t('thanks.back'))}</a></div>
  </main>`;
}

// Share: on a phone (and wherever the browser has it) the system's own share sheet, with the bill's name and link. Else the
// link is copied, inside the tap; "Copied" for two seconds, then the label comes back. If the clipboard refuses, the link
// is shown selected, so it can be copied by hand (as send.js does with the letter). The timer is later()'s: it never redraws
// once the person has gone to another screen (B-4, B-7).
export function wireThanks(root, B, redraw) {
  const s = st(B);
  root.querySelector('[data-share]')?.addEventListener('click', async () => {
    const at = location.hash, url = shareLink(B);
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ title: B.nickname ? `${B.nickname} (${B.numberSpaced})` : B.numberSpaced, url }); return; }
      catch (e) { if (e?.name === 'AbortError') return; /* the sheet could not open: copy instead */ }
    }
    const ok = await copyText(url);
    if (location.hash !== at) return;
    s.copied = ok; s.fail = !ok; redraw({ keepFocus: '[data-share]' });
    if (!ok) { const box = root.querySelector('input.sel'); box?.focus(); box?.select(); return; }
    later(() => { if (s.copied) { s.copied = false; redraw({ keepFocus: '[data-share]' }); } }, 2000);
  });
}
