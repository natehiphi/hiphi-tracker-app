// The action card: one hearing on one bill, and the ways to help with it. Used by the guided start (step 3),
// Home ("Do this now"), Find (suggestions) and the bill page, so it looks and behaves the same everywhere.
// One primary button (write testimony, or email the chair once the written deadline has passed), one secondary
// ("More ways to help") that opens inside the card, never a sheet. Every action counts (Nate, 9/18).
import { S, DEMO, app, esc, icon, blurb, asSentence, spaced, billPath, issueOf, posInfo, cmteLabel, dueInfo, hearingText, dateLong, dayWord, timeWord,
  roomLabel, countOk, chairContacts, actedOn, didKind, doneKey, markDone, toggleWatch, dismiss, toast, friendly, KINDS, onb, onbSet,
  nick, myActions, agrees, sendEmailLink, validEmail, anyBill, ensureBill, companionsOf } from './core.js';
import { btn, chip, posChip, iconBtn, issueLine } from './ui.js';

const key = (b, h) => `${b.id}|${h.id}`;
S.moreOpen ??= new Set(); S.compose ??= null; S.sentq ??= {}; S.goOpen ??= new Set(); S.chips ??= {};
const me = () => { try { return JSON.parse(localStorage.getItem('hiphi_me') || '{}') || {}; } catch { return {}; } };

// Done lines, one per kind, in the words a person would use.
function doneLabel(b, h, k) {
  const held = new Date(h.scheduled_at) < Date.now();
  return { testimony: 'Testimony sent', email: 'Emailed the chair', share: 'Shared', attend: held ? 'You went' : 'You plan to go' }[k];
}

// suggest: show the Follow / Not for me bar; why: the reason line (defaults to suggest when that is a sentence);
// compact: the bill page already shows the headline, chips and its own main button.
// The ladder (Nate, 9/19): a first visit never pushes an action. After that the easiest real step leads: until
// someone has taken any action the main button is the two-minute email to the chair, and testimony (the strongest
// step, but it needs a letter and a one-time Capitol account) is the first row under "More ways to help". Once they
// have acted, testimony leads. HIPHI's scripted email and letter are offered only when the person's own stance
// matches HIPHI's or they have not said; someone who disagrees is pointed to the Capitol's own form instead.
export const newToActing = () => myActions().length === 0;
export function actionCard(b, h, { focus = false, suggest = null, why, heading = 'h3', compact = false } = {}) {
  if (why === undefined && typeof suggest === 'string') why = suggest;
  const k = key(b, h), iss = issueOf(b), due = dueInfo(h), late = !!due?.late, done = actedOn(b, h), more = S.moreOpen.has(k);
  if (due && done) due.tone = '';   // acted: the deadline is no longer a warning
  const voices = countOk((S.voices || {})[h.id]);
  const chairs = chairContacts(h.committee), chairName = chairs.length ? chairs.map(c => `${c.title} ${c.last}`).join(' and ') : 'the chair';
  const doneKinds = KINDS.filter(x => didKind(b, h, x)), lastDone = doneKinds.slice().sort((x, y) => String((S.doneAt || {})[doneKey(b.id, h.id, y)] || '').localeCompare(String((S.doneAt || {})[doneKey(b.id, h.id, x)] || '')))[0];
  const differs = agrees(b) === false, emailFirst = late || (newToActing() && !didKind(b, h, 'email')), composing = S.compose === k;
  const testimonyBtn = btn('Write my testimony · 5 min', { kind: 'primary', icon: 'notebook-pen', full: true, attrs: { 'data-helper': h.id, 'data-bill': b.id } });
  const emailBtn = btn('Send a quick email · 2 min', { kind: 'primary', icon: 'mail', full: true, attrs: { 'data-compose': k } });
  const followBtn = btn('Follow this bill', { kind: 'primary', icon: 'star', full: true, attrs: { 'data-follow': b.id, 'aria-pressed': 'false' } });
  // A suggested bill they have not followed yet: the ask is step 2 of the ladder (follow), not
  // step 4 (email a committee chair about a bill they met four seconds ago).
  const asking = !!suggest && !S.watch.has(b.id);
  const primary = differs ? (b.state_url ? btn('Testify at the Capitol site', { kind: 'secondary', iconEnd: 'external-link', full: true, href: b.state_url, attrs: { target: '_blank', rel: 'noopener' } }) : '')
    : asking ? followBtn
    : composing ? '' : emailFirst ? (didKind(b, h, 'email') ? '' : emailBtn) : (didKind(b, h, 'testimony') ? '' : testimonyBtn);
  const rows = [
    differs ? '' : emailFirst
      ? moreRow('notebook-pen', late ? 'Send late testimony' : 'Write testimony · 5 min', late ? 'It will be marked late and may not be read before the vote.' : 'The strongest way to be heard. First time, the Capitol site asks for a free account.', { 'data-helper': h.id, 'data-bill': b.id }, didKind(b, h, 'testimony') && 'Sent')
      : moreRow('mail', 'Send a quick email · 2 min', `A short note to ${esc(chairName)}, who runs this hearing.`, { 'data-compose': k }, didKind(b, h, 'email') && 'Emailed'),
    moreRow('share-2', 'Share with a friend · 1 min', 'More voices carry more weight.', { 'data-share': k }, didKind(b, h, 'share') && 'Shared'),
    moreRow('map-pin', 'Go to the hearing', `${esc(roomLabel(h.room))}, State Capitol. Anyone can attend.`, { 'data-go': k, 'aria-expanded': S.goOpen.has(k) }, didKind(b, h, 'attend') && doneLabel(b, h, 'attend')),
    S.goOpen.has(k) ? goPanel(b, h, k) : '',
    moreRow('calendar-plus', 'Add to my calendar', late ? 'The hearing time and place.' : 'A reminder before testimony is due.', { 'data-ics': k }, S.chips[k + 'ics'] && 'Calendar file ready'),
  ].join('');
  const name = nick(b);
  return `<article class="card acard${done ? ' done' : ''}${focus ? ' focus' : ''}${S.justDone === b.id + '|' + h.id ? ' justdone' : ''}" data-card="${esc(k)}" aria-labelledby="t-${esc(h.id)}">
    ${compact ? '' : `<div class="acrow">${issueLine(iss)}${posChip(b)}${suggest && !S.watch.has(b.id) ? `<button type="button" class="acdismiss" data-notforme="${esc(b.id)}" aria-label="Not for me: stop suggesting ${esc(spaced(b.bill_number))}">Not for me</button>` : ''}</div>
    <${heading} class="achead" id="t-${esc(h.id)}"><a href="${billPath(b)}">${esc(name || blurb(b, 120))}</a></${heading}>
    ${name ? `<p class="acwhat">${esc(blurb(b, 160))}</p>` : ''}`}
    <p class="meta"${compact ? ` id="t-${esc(h.id)}"` : ''}>${esc(spaced(b.bill_number))} · ${esc(cmteLabel(h.committee))}</p>
    ${b.hiphi_action && !differs ? `<p class="ask">${esc(b.hiphi_action)}</p>` : ''}
    ${why ? `<p class="why">${icon('sparkles')}${esc(why)}</p>` : ''}
    ${due ? `<p class="due ${due.tone}">${icon('clock')}<span>${esc(due.text)}</span></p>` : ''}
    <p class="meta hearing">${esc(hearingText(h))}</p>
    ${differs ? `<p class="note">${icon('info')}<span>You see this one differently from HIPHI. You can still tell the committee what you think, in your own words.</span></p>` : ''}
    ${done ? `<div class="donebox" role="status">${icon('circle-check')}<span>${doneKinds.includes('testimony') ? 'You sent testimony. Mahalo!' : doneKinds.map(x => doneLabel(b, h, x)).join(' · ') + '. Mahalo!'}</span>${lastDone ? `<button type="button" class="btn text sm" data-undo="${esc(k)}|${lastDone}" aria-label="Undo: ${esc(doneLabel(b, h, lastDone))}">Undo</button>` : ''}</div>` : ''}
    ${voices ? `<p class="proof">${icon('users')}${voices} people have acted on this hearing through HIPHI</p>` : ''}
    ${composing ? composer(b, h, k) : ''}
    <div class="btncol">${compact ? '' : primary}
      ${btn(more ? 'Fewer ways to help' : 'More ways to help', { kind: 'secondary', iconEnd: more ? 'chevron-up' : 'chevron-down', full: true, attrs: { 'data-moreways': k, 'aria-expanded': more ? 'true' : 'false', 'aria-controls': 'mw-' + h.id } })}</div>
    ${more ? `<div class="moreways" id="mw-${esc(h.id)}">${rows}</div>` : ''}
    ${suggest && S.watch.has(b.id) ? `<div class="suggestbar">${btn('Following', { kind: 'text', icon: 'star', attrs: { 'data-follow': b.id, 'aria-pressed': 'true' }, cls: 'on' })}</div>` : ''}
  </article>`;
}
const moreRow = (ic, title, sub, a, doneText) => `<button type="button" class="mwrow"${Object.entries(a).map(([k, v]) => ` ${k}="${esc(v)}"`).join('')}><span class="lead">${icon(ic)}</span><span class="body"><span class="title">${title}</span><span class="sub">${sub}</span></span>${doneText ? chip(doneText, 'ok', 'check') : icon('chevron-right', { cls: 'chev' })}</button>`;

function goPanel(b, h, k) {
  const going = didKind(b, h, 'attend'), held = new Date(h.scheduled_at) < Date.now();
  const map = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Hawaii State Capitol, 415 S Beretania St, Honolulu, HI 96813');
  return `<div class="gopanel">
    <p>Hawaiʻi State Capitol, 415 S Beretania St, ${esc(roomLabel(h.room))}. ${esc(dateLong(h.scheduled_at))} at ${esc(timeWord(h.scheduled_at))}. Arrive 15 minutes early. Anyone can sit in. To speak, choose <b>In person</b> on the Capitol testimony form.</p>
    <div class="btnrow"><button type="button" class="chip" data-attend="${esc(k)}" aria-pressed="${going}">${icon(going ? 'check' : 'map-pin')}${going ? (held ? 'You went' : 'You plan to go') : 'I plan to go'}</button>
      <a class="btn text sm" href="${map}" target="_blank" rel="noopener">${icon('map')}Map</a></div></div>`;
}

// ---- email the chair: an inline composer, the person's own words first ----
export function chairMessage(b, h) {
  const p = posInfo(b), m = me(), chairs = chairContacts(h.committee);
  const dear = chairs.length ? chairs.map(c => `Chair ${c.last}`).join(' and ') : 'Chair';
  const who = m.name ? `My name is ${m.name}${m.town ? ` and I live in ${m.town}` : ''}. ` : '';
  const why = (m.why || '').trim();
  const ask = b.hiphi_action ? b.hiphi_action.trim().replace(/([^.!?])$/, '$1.') + ' ' : '';
  const body = `Dear ${dear},\n\n${who}I am writing to ${p?.verb || 'comment on'} ${spaced(b.bill_number)}. ${asSentence(blurb(b, 400).replace(/[.…\s]+$/, '') + '.')}\n\n${why ? why.replace(/([^.!?])$/, '$1.') + '\n\n' : ''}${ask}Please ${p?.verb || 'consider'} this bill at the hearing on ${dateLong(h.scheduled_at)}.\n\nMahalo,\n${m.name || '[your name]'}${m.town ? '\n' + m.town : ''}`;
  const subject = `${spaced(b.bill_number)}: please ${p?.verb || 'consider'} (hearing ${dateLong(h.scheduled_at)})`;
  return { to: chairs.map(c => c.email).join(','), chairs, subject, body };
}
function composer(b, h, k) {
  const m = chairMessage(b, h), asked = S.sentq[k];
  const to = m.chairs.length ? m.chairs.map(c => `${c.title} ${esc(c.last)}, Chair, ${esc(c.committee)}`).join('<br>') : 'the committee chair';
  const mail = `mailto:${m.to}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(S.composeText?.[k] ?? m.body)}`;
  return `<div class="composer" id="cmp-${esc(h.id)}">
    <p class="small"><span class="strong">To:</span> ${to}</p>
    <div class="field"><label for="msg-${esc(h.id)}">Your message</label><textarea id="msg-${esc(h.id)}" data-msg="${esc(k)}" rows="9">${esc(S.composeText?.[k] ?? m.body)}</textarea>
      <span class="help">Change anything you like. A sentence in your own words carries the most weight.</span></div>
    ${asked ? `<div class="sentq" role="group" aria-label="Did you send it?"><span class="strong">Did you send it?</span><div class="btnrow">${btn('Yes, I sent it', { kind: 'primary', sm: true, attrs: { 'data-sentyes': k } })}${btn('Not yet', { kind: 'text', sm: true, attrs: { 'data-sentno': k } })}</div></div>`
      : `<div class="btncol">${btn('Open in my mail app', { kind: 'primary', icon: 'send', full: true, href: mail, attrs: { 'data-mailto': k } })}
      <div class="btnrow">${btn('Copy message', { kind: 'text', sm: true, icon: 'copy', attrs: { 'data-copymsg': k } })}${m.to ? btn('Copy address', { kind: 'text', sm: true, icon: 'at-sign', attrs: { 'data-copyto': m.to } }) : ''}${S.chips[k + 'copied'] ? chip('Copied', 'ok', 'check') : ''}</div></div>`}
  </div>`;
}

// ---- calendar: a real .ics file (a Blob), two events: the testimony deadline (2-hour alarm) and the hearing ----
function icsFor(b, h) {
  const stamp = d => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc2 = t => String(t).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  const url = `${location.origin}${location.pathname}#/bill/${b.bill_number}`, short = nick(b) || blurb(b, 60);
  const ev = (uid, start, mins, title, desc, alarm) => ['BEGIN:VEVENT', `UID:${uid}@bills.hiphi.org`, `DTSTAMP:${stamp(Date.now())}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(new Date(start).getTime() + mins * 6e4)}`,
    `SUMMARY:${esc2(title)}`, `DESCRIPTION:${esc2(desc)}`, `LOCATION:${esc2('Hawaiʻi State Capitol, 415 S Beretania St, Honolulu, HI 96813, ' + roomLabel(h.room))}`, `URL:${url}`,
    ...(alarm ? ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc2(title)}`, 'TRIGGER:-PT2H', 'END:VALARM'] : []), 'END:VEVENT'];
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//HIPHI//Bill Tracker//EN', 'CALSCALE:GREGORIAN',
    ...(h.testimony_deadline && new Date(h.testimony_deadline) > Date.now() ? ev(h.id + '-due', h.testimony_deadline, 15, `Testimony due: ${spaced(b.bill_number)} (${short})`, `Send testimony in 5 minutes: ${url}`, true) : []),
    ...ev(h.id + '-hearing', h.scheduled_at, 60, `Hearing: ${spaced(b.bill_number)} (${short})`, `${cmteLabel(h.committee)}. Anyone can attend. ${url}`, false), 'END:VCALENDAR'];
  return new Blob([lines.join('\r\n')], { type: 'text/calendar' });
}
export function shareText(b, h) {
  const url = `${location.origin}${location.pathname}#/bill/${b.bill_number}`;
  const what = nick(b) ? `${nick(b)} (${spaced(b.bill_number)}). ${blurb(b, 110)}` : `${spaced(b.bill_number)}: ${blurb(b, 110)}`;
  return { url, text: `${what.replace(/([^.!?…])$/, '$1.')} ${h ? `Hearing ${dayWord(h.scheduled_at)}. ` : ''}You can add your voice in a few minutes: ${url}` };
}
const findBH = k => { const [bid, hid] = k.split('|'); const b = [...S.bills, ...Object.values(S.extra), ...((S.featured || {}).bills || []), ...((S.pool || {}).bills || [])].find(x => x.id === bid);
  const h = [...S.hearings, ...((S.featured || {}).hearings || []), ...((S.pool || {}).hearings || []), ...Object.values(S.xh || {}).flat()].find(x => x.id === hid); return { b, h }; };
// Follow or unfollow with feedback, and Undo on unfollow. Following a bill with one companion (its
// twin filed in the other chamber) offers to follow that too, right here rather than silently -
// "never auto-follow silently" (HANDOFF 3.5 plan, wave 5c). Only ever offered, never done for them.
export async function followToggle(id, label) {
  const was = S.watch.has(id);
  await toggleWatch(id);
  if (was) { toast(`Unfollowed ${label || ''}`.trim(), { undo: async () => { await toggleWatch(id); } }); return; }
  const b = anyBill(id), cnums = b ? companionsOf(b) : [];
  if (cnums.length === 1) {
    try {
      const comp = await ensureBill(cnums[0]);
      if (comp && !S.watch.has(comp.id)) {
        toast(`Following ${label || 'this bill'}`.trim(), { yay: true, also: { label: `Follow ${spaced(cnums[0])} too?`,
          action: async () => { await toggleWatch(comp.id); toast(`Following ${spaced(cnums[0])} too`, { yay: true }); } } });
        return;
      }
    } catch { /* decoration only; fall through to the plain toast */ }
  }
  toast(`Following ${label || 'this bill'}`.trim(), { yay: true });
}

// ---- wiring (called by every screen that shows action cards) ----
export function wireActions(root = document) {
  const $$ = s => root.querySelectorAll(s);
  $$('[data-helper]').forEach(el => el.onclick = () => app.openHelper(el.dataset.bill, el.dataset.helper));
  $$('[data-moreways]').forEach(el => el.onclick = () => { const k = el.dataset.moreways; S.moreOpen.has(k) ? S.moreOpen.delete(k) : S.moreOpen.add(k); app.render(); });
  $$('[data-compose]').forEach(el => el.onclick = () => { const k = el.dataset.compose; S.compose = S.compose === k ? null : k; app.render(); if (S.compose) setTimeout(() => document.getElementById('cmp-' + k.split('|')[1])?.scrollIntoView({ block: 'nearest' }), 20); });
  $$('[data-msg]').forEach(el => el.oninput = () => { (S.composeText ??= {})[el.dataset.msg] = el.value; });
  $$('[data-mailto]').forEach(el => el.addEventListener('click', () => { const k = el.dataset.mailto; const ta = document.querySelector(`[data-msg="${k}"]`);
    const { b, h } = findBH(k); if (b && h) { const m = chairMessage(b, h); el.href = `mailto:${m.to}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(ta ? ta.value : m.body)}`; }
    setTimeout(() => { S.sentq[k] = true; app.render(); }, 800); }));
  $$('[data-sentyes]').forEach(el => el.onclick = async () => { const k = el.dataset.sentyes, [bid, hid] = k.split('|'); delete S.sentq[k]; S.compose = null; await markDone(bid, hid, 'email'); app.render(); });
  $$('[data-sentno]').forEach(el => el.onclick = () => { delete S.sentq[el.dataset.sentno]; app.render(); });
  $$('[data-copymsg]').forEach(el => el.onclick = async () => { const k = el.dataset.copymsg, ta = document.querySelector(`[data-msg="${k}"]`);
    try { await navigator.clipboard.writeText(ta ? ta.value : ''); S.chips[k + 'copied'] = true; app.render(); setTimeout(() => { delete S.chips[k + 'copied']; app.render(); }, 2000); } catch (e) { toast(e, true); } });
  $$('[data-copyto]').forEach(el => el.onclick = async () => { try { await navigator.clipboard.writeText(el.dataset.copyto); toast('Address copied'); } catch (e) { toast(e, true); } });
  $$('[data-share]').forEach(el => el.onclick = async () => { const k = el.dataset.share, [bid, hid] = k.split('|'), { b, h } = findBH(k); if (!b) return;
    const t = shareText(b, h); let ok = false;
    try { if (navigator.share) { await navigator.share({ title: spaced(b.bill_number), text: t.text, url: t.url }); ok = true; } else { await navigator.clipboard.writeText(t.text); ok = true; S.chips[k + 'share'] = true; } } catch { /* cancelled */ }
    if (ok && !didKind(b, h, 'share')) await markDone(bid, hid, 'share'); app.render(); });
  $$('[data-go]').forEach(el => el.onclick = () => { const k = el.dataset.go; S.goOpen.has(k) ? S.goOpen.delete(k) : S.goOpen.add(k); app.render(); });
  $$('[data-attend]').forEach(el => el.onclick = async () => { const [bid, hid] = el.dataset.attend.split('|'); await markDone(bid, hid, 'attend', !S.done.has(doneKey(bid, hid, 'attend'))); app.render(); });
  $$('[data-ics]').forEach(el => el.onclick = () => { const k = el.dataset.ics, { b, h } = findBH(k); if (!b || !h) return;
    const url = URL.createObjectURL(icsFor(b, h)), a = document.createElement('a'); a.href = url; a.download = `${b.bill_number}-hearing.ics`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
    S.chips[k + 'ics'] = true; app.render(); });
  $$('[data-undo]').forEach(el => el.onclick = async () => { const [bid, hid, kind] = el.dataset.undo.split('|'); await markDone(bid, hid, kind, false); app.render(); });
  $$('[data-follow]').forEach(el => el.onclick = async e => { e.stopPropagation(); const id = el.dataset.follow, b = [...S.bills, ...Object.values(S.extra), ...((S.featured || {}).bills || []), ...((S.pool || {}).bills || [])].find(x => x.id === id);
    await followToggle(id, b ? spaced(b.bill_number) : ''); });
  $$('[data-notforme]').forEach(el => el.onclick = () => { dismiss(el.dataset.notforme); toast('Okay, we won’t suggest that one again'); app.render(); });
}

// ---- the email ask (one component everywhere): after follows, after an action, welcome back.
// Nate, 9/19: the process should ask for an email naturally and warmly, and the ask is about the person (their
// alerts, their record on any device), never about making their actions "count". The card says exactly what the
// email is for, so giving it IS the consent for hearing alerts (HIPHI's own action alerts stay a separate, unticked
// choice in Settings). One ask per visit; "Not now" quiets it for 14 days, then 60 (nudgeOk in core).
export function nudgeCard(kind = S.nudge) {
  if (!kind || S.session) return '';
  if (S.nudgeSent) return `<div class="card tint nudgecard" role="status">${icon('mail-check')}<div><p class="strong">Check your inbox at ${esc(S.nudgeSent)}</p><p class="small">Open the link on this device and your bills come with you. Hearing alerts start once you do.</p></div></div>`;
  const nb = S.watch.size, na = myActions().length;
  const text = kind === 'action' ? 'Mahalo for speaking up. Add your email and we’ll tell you when your bills get a hearing. It also keeps your record on any device.'
    : kind === 'back' ? `Welcome back. Your ${nb} bill${nb === 1 ? '' : 's'}${na ? ` and ${na} action${na === 1 ? '' : 's'}` : ''} live in this browser only. Add your email to keep them, and to hear when a hearing is set.`
    : 'Hearings are posted about two days ahead. Add your email and we’ll tell you in time. It also keeps your bills on any device.';
  return `<section class="card tint nudgecard" aria-labelledby="ng-t">${icon('mail-check')}<div class="ngbody">
    <p class="strong" id="ng-t">Get an email when your bills have a hearing</p><p class="small">${text}</p>
    ${DEMO ? '<p class="small muted">Sign-in is off in the sandbox.</p>' : `<form class="ngform" novalidate><div class="field"><label for="ng-email">Your email</label><input id="ng-email" type="email" inputmode="email" autocomplete="email" placeholder="name@example.com" required></div>
      <div class="btnrow">${btn('Send me alerts', { kind: 'primary', sm: true, attrs: { type: 'submit' } })}${btn('Not now', { kind: 'text', sm: true, attrs: { 'data-nudgeno': '1' } })}</div>
      <p class="meta">No password. We email you a link to confirm. Unsubscribe any time.</p></form>`}
    ${DEMO ? `<div class="btnrow">${btn('Not now', { kind: 'text', sm: true, attrs: { 'data-nudgeno': '1' } })}</div>` : ''}</div></section>`;
}
export function wireNudge(root = document) {
  root.querySelectorAll('[data-nudgeno]').forEach(el => el.onclick = e => { e.preventDefault(); const n = (onb().nudgeNo || 0) + 1; onbSet({ nudgeNo: n, nudgeNoAt: new Date().toISOString() }); S.nudge = false; app.render(); });
  const f = root.querySelector('.ngform'); if (!f) return;
  f.onsubmit = async e => { e.preventDefault(); const inp = f.querySelector('input[type=email]'), email = inp.value.trim();
    const bad = !validEmail(email);
    inp.setAttribute('aria-invalid', bad ? 'true' : 'false'); f.querySelector('.err')?.remove();
    if (bad) { inp.insertAdjacentHTML('afterend', `<span class="err" id="ng-err">${icon('circle-alert')}Enter an email like name@example.com</span>`); inp.setAttribute('aria-describedby', 'ng-err'); inp.focus(); return; }
    const b = f.querySelector('button[type=submit]'); b.setAttribute('aria-busy', 'true'); b.innerHTML = `${icon('loader-circle')}<span>Sending…</span>`;
    try { await sendEmailLink(email, { hearing_alerts: true }); }
    catch (error) { b.removeAttribute('aria-busy'); b.innerHTML = '<span>Send me alerts</span>'; toast(error, true); return; }
    S.nudgeSent = email; app.render(); };
}
