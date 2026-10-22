// HIPHI Staff v2: quick look — a bill's facts and its next step, without leaving the screen you are on.
// Nate, 9/19: "what if instead, it becomes a modal?" It is one, but sized like a desktop panel (900px, two
// columns) rather than the 560px sheet, because the current app's 780px bill modal is the thing that made that
// app feel like a widened phone. Read-and-act only: no forms live in here, so it never fights the unsaved-work
// guards, and "Open the bill" (v2: "Open full page") is always one click away — the page stays the truth, this is the shortcut.
// j / k walk the list you came from without closing, which is what makes it faster than opening the page.
// v3 (R-264, Nate: "too much going on at one time"): on Bills from 1100px the look is docked beside the list instead
// of over it: one thing open at a time, the list and the bill you picked in full beside it.
// openLook is unchanged for Today and every other screen. Since R-277 fix 17 the docked bill is Today's open item
// (billpane.js); this file gives it its facts (lookFacts).
import { S, esc, capitolUrl, fmtDT, fmtDate, myIssuesOf } from './data.js';
import { openSheet, closeSheet, btn, iconBtn, stageRibbon, avatar, ownerOf, countdown, POS_WORD, keysOn } from './ui.js';
import { docBtn, keysUsed } from './ui.js';   // R-277 fix 4: one look for the Doc button; fix 13: key hints after a key
import { stopOf, blurb, billNum, billSay, cmteName, chairMail, draftFor, hearingAhead, sponsorName, gateNeed, deadlineName, billByRef } from './model.js';
import { CHAMBER_NAME } from '../stops.js';
import { billRoute, whenAt, hearingWhen, roomName } from './model.js';

const dash = v => v || '—';

// The chair of the committee holding the bill, as a name and a mailto when we have one. Both chairs of a joint
// stop are named: either of them can decide not to hear it.
function chairLine(code) {
  const m = chairMail(code);
  if (!m) return '';
  // R-316 W54 (S-11): an address breaks only at its "@" ("capitol.hawaii.go / v" was cut mid-word); two chairs', a space between.
  const mail = e => e.split(/,\s*/).map(x => x.split('@').map(p => `<span class="nobr">${esc(p)}</span>`).join('@<wbr>')).join(', ');
  return `${esc(m.who)}${m.email ? ` · <a href="mailto:${esc(m.email)}">${mail(m.email)}</a>` : ''}`;
}

// The Capitol writes sponsors in capitals and splits "LEE, M." into two; put the initial back on its name and
// give it ordinary capitals, as the bill page does. The lead introducer comes first and is bold.
function sponsorLine(b) {
  const out = [];
  for (const sp of b.sponsors || []) { const n = String(sp.n || sp.name || sp).trim();
    if (/^[A-Z]\.$/.test(n) && out.length) out[out.length - 1] += ', ' + n; else if (n) out.push(n); }
  if (!out.length) return '';
  const names = out.slice(0, 5).map((n, i) => i === 0 ? `<b>${esc(sponsorName(n))}</b>` : esc(sponsorName(n)));
  return names.join(', ') + (out.length > 5 ? ` and ${out.length - 5} more` : '');
}

// The Capitol's last action runs to several sentences and a roll call. One sentence is what a glance needs.
const lastActionLine = b => {
  const t = String(b.last_action || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  const cut = t.replace(/\.\s+The votes.*$/i, '.');
  return cut.length <= 150 ? cut : cut.slice(0, 150).replace(/[\s,.;:]+\S*$/, '') + '…';
};

// Where the testimony for a hearing stands. "Ready to file" is the word list's name for approved and not filed (C-15).
const testimonyWord = d => d ? (d.status === 'filed' ? 'filed' : d.status === 'approved' ? 'ready to file' : d.status === 'second_review' ? 'waiting for second approval' : d.status === 'review' ? 'waiting for approval' : 'being written')
  : S.failed?.('testimony drafts') ? 'not loaded' : 'no draft yet';
// The hearing ahead, with the testimony's step and the buttons for it.
function hearingCard(b, h, d) {
  // Filing is offered only at the filing step, once the testimony is approved (R-022): never beside "waiting for a second
  // approval", where it invited someone to file testimony nobody had signed off.
  const fileOk = d?.status === 'approved';
  return `<div class="lk-card next sv-stick"><h3>${esc(cmteName(h.committee) || h.committee)} hearing</h3>
        <p>${esc(hearingWhen(h))}</p>
        ${h.testimony_deadline ? `<p>Testimony due ${esc(whenAt(h.testimony_deadline))} ${countdown(h.testimony_deadline, { until: h.scheduled_at })}</p>` : ''}
        <p class="small muted">Testimony: ${esc(testimonyWord(d))}</p>
        ${fileOk || d?.doc_url ? `<div class="lk-acts">${fileOk ? btn('File at the Capitol', { kind: 'secondary', sm: true, href: capitolUrl(b), target: '_blank', iconEnd: 'external-link' }) : ''}${docBtn(d?.doc_url, { sm: true })}</div>` : ''}</div>`;
}
const chairBtn = (b, st) => st.committee && chairMail(st.committee) ? `<div class="lk-acts">${btn('Email the chair', { kind: 'secondary', sm: true, href: `mailto:${chairMail(st.committee).email}?subject=${encodeURIComponent('Request for a hearing on ' + b.bill_number)}`, target: '_blank', iconEnd: 'external-link' })}</div>` : '';

function body(b, { list, index }) {
  const st = stopOf(b), h = hearingAhead(b), d = h ? draftFor(b.id, h.committee) : null;
  const pos = POS_WORD[b.position || ''] || b.position || 'No position';
  const own = ownerOf(b);
  const next = h ? hearingCard(b, h, d)
    : `<div class="lk-card next sv-stick"><h3>No hearing on the books</h3><p class="small">${esc(st.says || '')}</p>
        ${st.deadline && !st.deadline.missed ? `<p class="small muted">Needs one by ${esc(fmtDate(st.deadline.date))}, the ${esc(deadlineName(st.deadline).toLowerCase())}: it must ${esc(gateNeed(st.deadline.label))}.</p>` : ''}
        ${chairBtn(b, st)}</div>`;

  // R-271: nickname first, the number small after it.
  return `<div class="lk-head">
      ${b.nickname ? `<div class="nick">${esc(b.nickname)}</div><div class="num bn-num">${esc(billNum(b))}</div>` : `<div class="num">${esc(billNum(b))}</div>`}
      <p class="sum">${esc(blurb(b, 220))}</p>
    </div>
    ${stageRibbon(b)}
    <p class="lk-says">${esc(st.says || '')}</p>
    <div class="lk-cols">
      <div>
        <div class="lk-card"><h3>Details</h3>
          ${details(b, st)}
        </div>
      </div>
      <div>
        ${next}
        <div class="lk-card"><h3>Team</h3>
          <dl class="lk-kv">
            <dt>Position</dt><dd>${esc(pos)}</dd>
            <dt>Owner</dt><dd>${own ? `${avatar(own, 20)} ${esc(own.id === S.me?.id ? 'You' : own.full_name)}` : 'Nobody yet'}</dd>
          </dl>
        </div>
      </div>
    </div>
    ${list && list.length > 1 && keysUsed() ? `<p class="lk-keys"><kbd>J</kbd> <kbd>K</kbd> next and previous bill · <kbd>Enter</kbd> opens the bill · <kbd>Esc</kbd> closes</p>` : ''}`;
}

// The facts, as a list of terms. `deadline: false` leaves the deadline out where the card above has just said it;
// `pos` and `own` put the position and the owner first (the docked look, when the table beside it does not say them in
// words); `last: false` leaves out a last action that is only the notice of the hearing the card above shows; `issue`
// names the issues of yours it is on (the tag on its row in Bills, R-263), which is why it can be yours with no owner.
function details(b, st, { deadline = true, pos = false, own: withOwn = false, last = true, issue = false } = {}) {
  const own = withOwn ? ownerOf(b) : null, iss = issue ? myIssuesOf(b) : [];
  return `<dl class="lk-kv">
            ${iss.length ? `<dt>Your issue${iss.length > 1 ? 's' : ''}</dt><dd>${iss.map(i => esc(i.name)).join(', ')}</dd>` : ''}
            ${pos ? `<dt>Position</dt><dd>${esc(POS_WORD[b.position || ''] || b.position || 'No position')}</dd>` : ''}
            ${withOwn ? `<dt>Owner</dt><dd>${own ? `${avatar(own, 20)} ${esc(own.id === S.me?.id ? 'You' : own.full_name)}` : 'Nobody yet'}</dd>` : ''}
            <dt>Committee</dt><dd>${dash(esc(cmteName(st.committee) || st.committee || ''))}${st.stops ? ` <span class="muted">· ${st.stops > 1 ? `${st.stop} of ${st.stops}` : 'the only one'} in the ${esc(CHAMBER_NAME[st.chamber] || '')}${st.stops > 1 ? ', in order' : ''}</span>` : ''}</dd>
            ${st.committee && chairLine(st.committee) ? `<dt>Chair</dt><dd>${chairLine(st.committee)}</dd>` : ''}
            ${deadline ? `<dt>Deadline</dt><dd>${st.deadline ? `${esc(deadlineName(st.deadline))}, ${esc(fmtDate(st.deadline.date))}${st.deadline.missed ? ' <span class="muted">(missed)</span>' : ` <span class="muted">· ${st.deadline.days <= 0 ? 'today' : st.deadline.days + ' days'}</span>`}<span class="lk-gl">It must ${esc(gateNeed(st.deadline.label))}.</span>` : '—'}</dd>` : ''}
            ${last ? `<dt>Last action</dt><dd>${b.last_action ? `${esc(fmtDate(b.last_action_date))} ${esc(lastActionLine(b))}` : '—'}</dd>` : ''}
            ${sponsorLine(b) ? `<dt>Sponsors</dt><dd>${sponsorLine(b)}</dd>` : ''}
            <dt>Official title</dt><dd>${dash(esc(b.title || ''))}</dd>
          </dl>`;
}

// openLook(bill, { list, index }) — list is the bills of the screen you came from, so j/k can walk it.
export function openLook(b, { list = null, index = 0 } = {}) {
  if (!b) return null;
  const n = list ? list.length : 0, i = list ? Math.max(0, Math.min(n - 1, index)) : 0;
  const foot = `<div class="lk-nav">${n > 1 ? `<span class="pos">${i + 1} of ${n}</span>` : '<span class="pos"></span>'}
      ${n > 1 ? `${iconBtn('chevron-left', 'Previous bill', { 'data-lk': 'prev', ...(i === 0 ? { 'aria-disabled': 'true' } : {}) })}${iconBtn('chevron-right', 'Next bill', { 'data-lk': 'next', ...(i >= n - 1 ? { 'aria-disabled': 'true' } : {}) })}` : ''}
      ${btn('Open the bill', { kind: 'primary', attrs: { 'data-lk': 'open' }, iconEnd: 'arrow-right' })}</div>`;   // v3: the docked look's words too (C-15)
  return openSheet({
    title: esc(billSay(b)), size: 'look', body: body(b, { list, index: i }), foot,
    wire: d => {
      const move = k => { const to = list?.[i + k]; if (to) openLook(to, { list, index: i + k }); };
      const open = async () => { const href = `${billRoute(b)}`; await closeSheet({ silent: true }); S.go ? S.go(href) : (location.hash = href); };
      d.querySelector('[data-lk="open"]')?.addEventListener('click', open);
      d.querySelector('[data-lk="prev"]')?.addEventListener('click', () => move(-1));
      d.querySelector('[data-lk="next"]')?.addEventListener('click', () => move(1));
      d.addEventListener('keydown', e => {
        if (e.metaKey || e.ctrlKey || e.altKey || !keysOn()) return;
        if (/^(input|textarea|select)$/i.test(e.target?.tagName || '') || e.target?.isContentEditable) return;
        if (e.key === 'j') { e.preventDefault(); move(1); }
        else if (e.key === 'k') { e.preventDefault(); move(-1); }
        else if (e.key === 'Enter' && !e.target?.closest?.('button, a')) { e.preventDefault(); open(); }
      });
    },
  });
}

// ---- the facts of the one open-bill panel (R-277 fix 17, billpane.js) ----
// Bills' docked bill and Today's open item are one panel now (today.js dockPane, billPaneOf); under its step it shows the
// stage ribbon and these facts. `pos` and `own` put the position and the owner first (Bills says which, when the table
// beside it does not say them in words); the last action is left out when it is only the notice of the hearing above.
export function lookFacts(b, { pos = true, own = true, issue = true } = {}) {
  if (!b) return '';
  const st = stopOf(b), h = hearingAhead(b);
  return `${stageRibbon(b)}${details(b, st, { deadline: !h, pos, own, issue, last: !(h && /scheduled a public hearing/i.test(b.last_action || '')) })}`;
}

// For a screen that only has a bill number to hand.
export const lookAt = (num, opts) => { const b = billByRef(num); return b ? openLook(b, opts) : null; };

export default openLook;
