// The Mahalo screen of act.html (R-360 part 3): #/HB2121/thanks, straight after HIPHI takes the letter (send.js, part 8: no
// "Did it go through?" step any more). One line on what happened, exactly one primary button (Share with a friend: the share
// sheet, or a copy of this page's link to the bill, without /thanks), one quiet link to Bills (part 6: the app's own list),
// and Back to the bill.
// The line follows the send's answer (setOutcome): queued, "Your letter went to the committee. A copy is in your inbox." (the
// chair, for an email); held, "Saved, not sent yet. Sending from the app is not switched on, so this letter has not reached
// anyone." (R-360 fix 3, P-5: no promise of when). The
// answer is kept for this tab (sessionStorage), so a reload of Mahalo says the same; without one, a bill marked done says sent.
import { header, esc } from './bill.js';
import { icon } from '../icons.js';
import { t } from './i18n.js';
import { DEMO } from './data.js';
import { isMail, isDone } from './done.js';
import { later } from './later.js';

const OUT = 'hiphi_act_sent';
const outcomes = () => { try { return JSON.parse(sessionStorage.getItem(OUT) || '{}') || {}; } catch { return {}; } };
export const setOutcome = (B, status) => { try { sessionStorage.setItem(OUT, JSON.stringify({ ...outcomes(), [B.id]: status })); } catch { /* the line falls back to the done mark */ } };

// The copy that also works on an older phone (helper.js copyText): the clipboard, else the old way with a hidden box.
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* no permission or an older phone */ }
  const was = document.activeElement;
  try {
    const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.className = 'offscreen';
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); was?.focus?.({ preventScroll: true }); return ok;
  } catch { return false; }
}

const sh = new Map();   // per bill, for this visit: { copied, fail }
const st = B => { if (!sh.has(B.id)) sh.set(B.id, {}); return sh.get(B.id); };
export const freshThanks = B => { const s = st(B); s.copied = false; };
// The address a friend opens: this page's own, with the bill's number. Not the /thanks step, and not the practice copy's ?demo=1.
const shareLink = B => location.origin + location.pathname + '#/' + B.number;

export function thanksScreen(B) {
  const s = st(B);
  const how = outcomes()[B.id] || (isDone(B) ? 'queued' : ''), mail = isMail(B);
  const line = how === 'held' ? t('thanks.held') : how !== 'queued' ? t('thanks.p.none')
    : mail ? t((B.committee?.chairs || []).length > 1 ? 'thanks.p.chairs' : 'thanks.p.email') : t(B.hearing?.joint ? 'thanks.p.many' : 'thanks.p');
  return `${header(B.issue)}
  <main class="sheet" id="main">
    <p class="kicker">${esc(B.nickname || B.numberSpaced)} · ${esc(B.numberSpaced)}</p>
    <h1 tabindex="-1">${esc(t('thanks.h'))}</h1>
    <p class="sum">${esc(line)}</p>
    ${DEMO && how ? `<p class="info">${icon('info', { size: '1em' })}${esc(t('thanks.practice'))}</p>` : ''}
    <div class="cta"><button type="button" class="primary" data-share>${icon(s.copied ? 'check' : 'share-2')}<span>${esc(s.copied ? t('thanks.copied') : t('thanks.share'))}</span></button></div>
    ${s.fail ? `<p class="err" role="alert">${icon('circle-alert', { size: '1em' })}${esc(t('thanks.copyfail'))}</p><input class="sel" readonly value="${esc(shareLink(B))}" aria-label="${esc(t('thanks.share'))}">` : ''}
    <div class="after"><a href="#/bills">${esc(t('thanks.other'))}</a>
      <a class="back" href="#/${esc(B.number)}">${icon('arrow-left', { size: '1em' })}${esc(t('thanks.back'))}</a></div>
  </main>`;
}

// Share: on a phone (and wherever the browser has it) the system's own share sheet, with the bill's name and link. Else the
// link is copied, inside the tap; "Copied" for two seconds, then the label comes back. If the clipboard refuses, the link
// is shown selected, so it can be copied by hand. The timer is later()'s: it never redraws
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
