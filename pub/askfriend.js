// A person comes here to ask one friend to do a specific thing about a bill, by text or email (B-1).
// Ask a friend to speak up (R-205, Nate 10/7: sharing a specific ask "needs to be a KEY feature of this app"). One sheet,
// opened from every place that offers to share an action: the Mahalo after a letter or an email, the bill page's Share and
// its main button once someone has acted, the action cards' "Ask a friend to speak up", Home's line on a bill they acted
// on, and "Just looking". What it does, by the recommendation that asked for it (backend REQUESTS.md R-205, and the page
// https://claude.ai/artifact/SyXVbiBrnvo9QCDm2u8DS2):
//   C1  which ask: a hearing ahead has three (testimony, the committee email, going in person), the one the person did
//       first; with one ask there is no choice to make, and the sheet still says what the friend is asked to do.
//   C3  what the friend sees: the share page's own title and picture, read from the page itself (tools/share_pages.mjs).
//   S1  a phone: one button, then the phone's own share menu (Messages and Mail are at the front of it). A phone with one
//       ask goes straight to that menu, which shows the link's card itself.
//   S2  a laptop: the message, which they can change, then Email it (my mail app, Gmail, Outlook.com, the chair email's
//       three, R-079), Copy message and Copy link, and the computer's own share menu where it has one. "Copied" stays on
//       screen and is read out (WCAG 4.1.3); when copying is refused the message is selected to copy by hand.
//   K2  each way out tags the link (sp=sheet | email | copy) and the share act, so the counts say which way works.
// A share is marked done once (an action, as every share has been since 9/18), and after it nothing asks again: Nate 10/7,
// "Do not ask them to keep sharing after they've done it". The person's words never leave this browser except in the
// message they send themselves.
import { esc, icon, nick, spaced, didKind, markDone, dueWords, dayWord, dateLong, timeWord, roomLabel, issueShareUrl, HEARING_ASKS } from './core.js';   // dueWords: the email's subject, read later
import { btn } from './ui.js';
import { shareFor, shareIssueText } from './actions.js';
import { abSeen } from './variant.js';
import { picSeen } from './sharepic.js';

// What each ask is called where a person picks it, and the line under it.
const no = b => /oppose/.test(b?.hiphi_position || '');
const LABEL = {
  testify: () => 'Send testimony', email: () => 'Email the committee', attend: () => 'Go to the hearing',
  ask: b => no(b) ? 'Ask the chair not to hear it' : 'Ask the chair for a hearing',
  floor: b => `Ask their legislator to vote ${no(b) ? 'no' : 'yes'}`,
  conference: b => no(b) ? 'Ask lawmakers not to pass it' : 'Ask lawmakers to pass it',
  governor: b => no(b) ? 'Ask the Governor to veto it' : 'Ask the Governor to sign it',
  follow: () => 'Follow the issue',
};
const DID = { testify: 'testimony', email: 'email', attend: 'attend' };   // an ask, by the action kind that does it
const ahead = h => !!h && h.status !== 'cancelled' && new Date(h.scheduled_at) > Date.now();
const when = iso => `${dayWord(iso).replace(/\s*\(.*\)$/, '')} at ${timeWord(iso)}`;   // "today at 3:00 PM", "Thu at 9:30 AM"

// The asks a friend can be given (C1). A hearing ahead: testimony while it is open, the committee email, the hearing itself;
// the one this person did first (did: the action kind, or the ask). Otherwise the one ask the caller names.
export function choicesFor(b, h, { did = '', ask = '' } = {}) {
  if (b && ahead(h) && (!ask || HEARING_ASKS.includes(ask))) {
    const open = !h.testimony_deadline || new Date(h.testimony_deadline) > Date.now();
    const list = [
      // The person sharing reads "today" and "tomorrow" (the review: a deadline hours away read as a calendar date); the
      // friend's own message, read later, keeps the date (shareFor). Each says how long it takes and what it is (C-10).
      open ? { ask: 'testify', sub: `A few minutes · on the public record · ${h.testimony_deadline ? `due ${when(h.testimony_deadline)}` : 'before the hearing'}` } : null,
      { ask: 'email', sub: `About 2 minutes · a short note to the committee before ${when(h.scheduled_at).replace(/ at .*$/, '')}` },
      { ask: 'attend', sub: `Anyone can come · ${when(h.scheduled_at)}, ${roomLabel(h.room)}` },
    ].filter(Boolean);
    const first = { testimony: 'testify', email: 'email', attend: 'attend' }[did] || (HEARING_ASKS.includes(did) ? did : '') || ask;
    list.sort((x, y) => (y.ask === first) - (x.ask === first));
    return list.map(c => ({ ...c, h, label: LABEL[c.ask](b), done: didKind(b, h, DID[c.ask]) }));
  }
  const a = ask || 'follow';
  return [{ ask: a, h: ahead(h) ? h : null, label: LABEL[a] ? LABEL[a](b) : LABEL.follow(), sub: a === 'follow' ? 'We’ll tell them when their voice can count.' : 'A short email, about 2 minutes.', done: false }];
}

// The tag a link carries for the way it was sent (K2), before the address's #/ part.
const tagged = (u, way) => { const i = u.indexOf('#'), base = i < 0 ? u : u.slice(0, i); return `${base}${base.includes('?') ? '&' : '?'}sp=${way}${i < 0 ? '' : u.slice(i)}`; };
// The share page's own card (C3): its title and picture, read once per page. null when there is no page (the tracker's own
// address) or it could not be read.
const cards = new Map();
function cardOf(url) {
  const page = url.replace(/[?#].*$/, ''), root = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}`;
  if (!page.startsWith(root) || !/\/(b|i|p)\//.test(page.slice(root.length - 1))) return Promise.resolve(null);
  // GitHub Pages serves b/HB2121-testify from b/HB2121-testify.html; a plain server (the tests) needs the .html.
  const get = u => fetch(u, { cache: 'force-cache' }).then(r => r.ok ? r.text() : '');
  if (!cards.has(page)) cards.set(page, get(page).then(t => t || (/\.html$/.test(page) ? '' : get(page + '.html'))).then(t => {
    const meta = p => { const m = new RegExp(`<meta property="og:${p}" content="([^"]*)"`).exec(t); return m ? m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, '’').replace(/&lt;/g, '<').replace(/&gt;/g, '>') : ''; };
    return meta('title') ? { title: meta('title'), image: meta('image') } : null;
  }).catch(() => null));
  return cards.get(page);
}
// A touch screen with its own share menu gets the phone's way; everything else the laptop's box.
const phoneWay = () => { try { return !!navigator.share && matchMedia('(pointer: coarse)').matches; } catch { return false; } };
// The three filled-in new emails (the chair email's own, pub/helper.js sendLinks), to nobody yet: the person picks who.
function mailLinks(subject, body) {
  const e = encodeURIComponent, b = body.replace(/\r?\n/g, '\r\n'), cut = (u, max, bare) => u.length <= max ? u : bare;
  return {
    app: cut(`mailto:?subject=${e(subject)}&body=${e(b)}`, 1900, `mailto:?subject=${e(subject)}`),
    gmail: cut(`https://mail.google.com/mail/?view=cm&fs=1&su=${e(subject)}&body=${e(b)}`, 7500, `https://mail.google.com/mail/?view=cm&fs=1&su=${e(subject)}`),
    outlook: cut(`https://outlook.live.com/mail/0/deeplink/compose?subject=${e(subject)}&body=${e(b)}`, 7500, `https://outlook.live.com/mail/0/deeplink/compose?subject=${e(subject)}`),
  };
}
// The email's subject: what the friend is asked to do, then the bill (the card's title says the same, C-10).
function subjectFor(b, c) {
  if (!b) return c.title || 'Follow this issue with me';
  const sp = spaced(b.bill_number), n = nick(b), named = n ? `${n} (${sp})` : sp, h = c.h;
  if (c.ask === 'testify' && h) return `Speak up by ${(h.testimony_deadline ? dueWords(h.testimony_deadline) : dateLong(h.scheduled_at)).replace(/ at .*$/, '')}: ${named}`;
  if (c.ask === 'email' && h) return `Email the committee before ${dateLong(h.scheduled_at)}: ${named}`;
  if (c.ask === 'attend' && h) return `Come to the hearing on ${dateLong(h.scheduled_at)}: ${named}`;
  return `${c.label}: ${named}`;
}

// The laptop's email choices, the likeliest first for the device (the chair email's order, pub/helper.js mailScreen).
const MAIL = { app: ['My mail app', 'mail', ''], gmail: ['Gmail', 'at-sign', 'Opens in a new tab'], outlook: ['Outlook.com', 'at-sign', 'For Outlook.com and Hotmail'] };
const MAIL_ORDER = () => { try { return matchMedia('(pointer: coarse)').matches || innerWidth < 720 ? ['app', 'gmail', 'outlook'] : ['gmail', 'outlook', 'app']; } catch { return ['gmail', 'outlook', 'app']; } };
let dlg = null;
// Open the sheet. b: the bill (or null with issue); h: the hearing of the moment, if any; did: what they just did (an action
// kind or an ask); ask: the one ask when there is no hearing ahead; acted: the message starts from what they did; chamber,
// law, differs: as shareFor; issue: share an issue instead of a bill. Resolves to 'shared' | 'email' | 'copied' | '' once the
// sheet is closed, after the share was marked done.
export function askFriend({ b = null, h = null, did = '', ask = '', acted = false, chamber = '', law = false, differs = false, issue = null } = {}) {
  const choices = issue ? [{ ask: 'follow', h: null, label: 'Follow the issue', sub: 'We’ll tell them when their voice can count.', done: false }] : choicesFor(b, h, { did, ask });
  let pick = choices[0], result = '', edited = null, status = '', marked = false;
  const msgFor = c => {
    if (issue) { const t = shareIssueText(issue); return { title: issue.name, text: t, url: issueShareUrl(issue), ab: '', pic: null }; }
    return shareFor(b, c.h || h, { acted, ask: c.ask, chamber, law, differs });
  };
  // Marked once, whatever the way (copies count too, as since 9/18; only the words say "Copied" rather than "Sent").
  const mark = async (way, t) => {
    result = way === 'sheet' ? 'shared' : way === 'email' ? 'email' : 'copied';
    if (marked) return; marked = true;
    try { if (t.ab) abSeen('share', { bill: t.ab }); picSeen(t.pic); } catch { /* counting never gets in the way */ }
    if (issue) { (await import('./visitlog.js')).logAct('share', { sp: way }); return; }
    if (!didKind(b, pick.h || h, 'share')) await markDone(b.id, (pick.h || h)?.id || '', 'share', true, { quiet: true, sp: way });
  };
  const share = async (t, way = 'sheet') => {
    try { await navigator.share({ title: t.title, text: t.text, url: tagged(t.url, way) }); await mark(way, t); return true; }
    catch (e) { return e?.name === 'AbortError' ? false : null; }   // null: the menu could not open
  };

  // A phone with one ask: straight to the phone's own menu (S1). Its card shows the link's picture and title.
  if (phoneWay() && choices.length === 1) return (async () => {
    const t = msgFor(pick), ok = await share(t);
    if (ok !== null) return ok ? result : '';
    return open();   // the menu was refused: the box instead
  })();
  return open();

  function open() {
    return new Promise(resolve => {
      if (!dlg) { dlg = document.createElement('dialog'); dlg.className = 'sheet af-sheet'; dlg.setAttribute('aria-labelledby', 'af-h'); document.body.appendChild(dlg); }
      const phone = phoneWay();
      const paint = (focus) => {
        const t = msgFor(pick), shown = edited ?? `${t.text}\n\n${t.url}`;
        // Each way out carries its own tag (K2), swapped into the link wherever it is in their words.
        // read at the moment of sending, so their edits since this was drawn go out too
        const out = way => (edited ?? shown).split(t.url).join(tagged(t.url, way)), subj = subjectFor(b, { ...pick, title: issue ? issue.name : '' });
        const L = mailLinks(subj, out('email'));
        const action = !issue && pick.ask !== 'follow';
        dlg.innerHTML = `<div class="af-in">
          <div class="af-top"><h2 id="af-h" tabindex="-1">${action ? 'Ask a friend to speak up' : 'Share with a friend'}</h2>
            <button type="button" class="iconbtn af-x" data-af="close" aria-label="Close">${icon('x')}</button></div>
          ${choices.length > 1 ? `<fieldset class="af-asks"><legend>What should your friend do?</legend>
            ${choices.map((c, i) => `<label class="af-ask${c.ask === pick.ask ? ' on' : ''}"><input type="radio" name="af-ask" value="${c.ask}"${c.ask === pick.ask ? ' checked' : ''} id="af-ask-${i}">
              <span class="af-asktx"><b>${esc(c.label)}</b><span>${esc(c.sub)}${c.done ? ` · <span class="af-did">${icon('check')}you did this</span>` : ''}</span></span></label>`).join('')}</fieldset>`
            : `<p class="af-one">You’re asking them to: <b>${esc(pick.label)}</b>${pick.sub && pick.ask !== 'follow' ? `<span> · ${esc(pick.sub)}</span>` : ''}</p>`}
          <div class="af-sees" id="af-sees" aria-live="polite"><p class="af-k">${phone ? 'Your friend sees' : 'The link’s card, in a text or a post'}</p>
            ${phone ? '' : '<!-- the message box below says the words -->'}<p class="af-first"${phone ? '' : ' hidden'}>“${esc(t.text.length > 110 ? t.text.slice(0, 108).replace(/\s+\S*$/, '') + '…' : t.text)}”</p><div class="af-card" data-af-card>${skeleton()}</div></div>
          ${phone ? '' : `<div class="af-mail"><p class="af-k">Email it</p><ul role="list">
              ${MAIL_ORDER().map((k, i) => { const [l, ic, sub] = MAIL[k];
                return `<li><a class="btn ${i === 0 && !result ? 'primary' : 'secondary'} full" href="${esc(L[k])}" data-af-mail="${k}"${k === 'app' ? '' : ' target="_blank" rel="noopener"'}>${icon(ic)}<span>${l}</span>${k === 'app' ? '' : icon('external-link', { cls: 'af-ext' })}</a>${sub ? `<span class="af-sub">${sub}</span>` : ''}</li>`; }).join('')}</ul></div>
            <div class="field af-msgf"><label for="af-msg">Or copy your message</label>
            <textarea id="af-msg" rows="${matchMedia('(min-width: 720px)').matches ? 4 : 6}" spellcheck="true" autocapitalize="sentences">${esc(shown)}</textarea>
            <span class="help">Change anything you like; the email gets your words too. The link at the end opens the ${action ? 'steps' : 'page'} for them.</span></div>
            <div class="af-more">${btn('Copy message', { kind: 'secondary', sm: true, icon: 'copy', attrs: { 'data-af': 'copy' } })}${btn('Copy link', { kind: 'text', sm: true, icon: 'link', attrs: { 'data-af': 'link' } })}${navigator.share ? btn('Other ways to send', { kind: 'text', sm: true, icon: 'share-2', attrs: { 'data-af': 'sheet' } }) : ''}</div>`}
          <p class="af-status${status ? '' : ' empty'}" role="status">${status ? `${icon('circle-check')}<span>${esc(status)}</span>` : ''}</p>
          <div class="af-btns">${phone ? btn('Send to a friend', { kind: 'primary', icon: 'share-2', full: true, attrs: { 'data-af': 'sheet' } }) : ''}
            ${btn(result ? 'Done' : 'Close', { kind: result && !phone ? 'primary' : 'text', attrs: { 'data-af': 'close' } })}</div></div>`;
        const card = dlg.querySelector('[data-af-card]');
        cardOf(t.url).then(c => { if (!card.isConnected) return;
          card.innerHTML = c ? `${c.image ? `<img src="${esc(c.image)}" alt="" width="120" height="63" loading="lazy">` : ''}<p>${esc(c.title)}</p>`
            : `<p>${esc(t.title)}</p><span class="af-sub">A link to the tracker, with your message.</span>`; });
        dlg.querySelectorAll('input[name="af-ask"]').forEach(r => r.addEventListener('change', () => { pick = choices.find(c => c.ask === r.value) || pick; edited = null; status = ''; paint(r.id); }));
        dlg.querySelector('#af-msg')?.addEventListener('input', e => { edited = e.target.value; });
        dlg.querySelectorAll('[data-af="close"]').forEach(x => x.onclick = () => dlg.close());
        dlg.querySelectorAll('[data-af-mail]').forEach(a => a.addEventListener('click', () => {
          // Their edits go in the email too: the link is rebuilt from the box at the moment they choose.
          if (edited != null) a.href = mailLinks(subj, edited.split(t.url).join(tagged(t.url, 'email')))[a.dataset.afMail];
          setTimeout(async () => { await mark('email', t); status = 'Your email is ready to send. Pick your friend, then send it.'; paint('af-status'); }, 300);
        }));
        dlg.querySelector('[data-af="copy"]')?.addEventListener('click', async () => {
          if (await copy(out('copy'))) { await mark('copy', t); status = 'Copied. Paste it into a text or an email to your friend.'; paint('af-status'); }
          else { const ta = dlg.querySelector('#af-msg'); ta.focus(); ta.select(); status = 'Your message is selected. Copy it with Ctrl+C, or ⌘C on a Mac.'; const s = dlg.querySelector('.af-status'); s.classList.remove('empty'); s.innerHTML = `${icon('info')}<span>${esc(status)}</span>`; }
        });
        dlg.querySelector('[data-af="link"]')?.addEventListener('click', async () => {
          const u = tagged(t.url, 'copy');
          if (await copy(u)) { await mark('copy', t); status = 'Link copied.'; paint('af-status'); }
          else { status = `Copy this link: ${u}`; const s = dlg.querySelector('.af-status'); s.classList.remove('empty'); s.innerHTML = `${icon('info')}<span>${esc(status)}</span>`; }
        });
        dlg.querySelectorAll('[data-af="sheet"]').forEach(x => x.onclick = async () => {
          const ok = await share(edited != null ? { ...t, text: edited.split(t.url).join('').trim() } : t);
          if (ok) { if (phone) return dlg.close(); status = 'Sent. Mahalo for bringing a friend.'; paint('af-status'); }
          else if (ok === null) { status = 'That didn’t open. Try Email it or Copy message.'; paint('af-status'); }
        });
        if (focus) requestAnimationFrame(() => (focus === 'af-status' ? dlg.querySelector('[data-af="close"]') : dlg.querySelector('#' + focus))?.focus({ preventScroll: true }));
      };
      dlg.onclose = () => resolve(result);
      paint();
      try { dlg.showModal(); } catch { dlg.setAttribute('open', ''); }
      requestAnimationFrame(() => dlg.querySelector('#af-h')?.focus({ preventScroll: true }));
    });
  }
}
const skeleton = () => '<span class="af-skel" aria-hidden="true"></span><span class="sr">Loading what your friend sees</span>';
async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* no permission: the old way */ }
  try { const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.className = 'af-off'; (dlg || document.body).appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok; }
  catch { return false; }
}
export const _test = { choicesFor, subjectFor, tagged, mailLinks };
