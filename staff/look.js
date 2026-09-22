// HIPHI Staff v2: quick look — a bill's facts and its next step, without leaving the screen you are on.
// Nate, 9/19: "what if instead, it becomes a modal?" It is one, but sized like a desktop panel (900px, two
// columns) rather than the 560px sheet, because the current app's 780px bill modal is the thing that made that
// app feel like a widened phone. Read-and-act only: no forms live in here, so it never fights the unsaved-work
// guards, and "Open full page" is always one click away — the page stays the truth, this is the shortcut.
// j / k walk the list you came from without closing, which is what makes it faster than opening the page.
import { S, esc, capitolUrl, fmtDT, fmtDate } from './data.js';
import { openSheet, closeSheet, btn, iconBtn, stageRibbon, avatar, ownerOf, countdown, POS_WORD, keysOn } from './ui.js';
import { stopOf, blurb, billNum, cmteName, chairMail, draftFor, hearingAhead, sponsorName } from './model.js';

const dash = v => v || '—';

// The chair of the committee holding the bill, as a name and a mailto when we have one. Both chairs of a joint
// stop are named: either of them can decide not to hear it.
function chairLine(code) {
  const m = chairMail(code);
  if (!m) return '';
  return `${esc(m.who)}${m.email ? ` · <a href="mailto:${esc(m.email)}">${esc(m.email)}</a>` : ''}`;
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

function body(b, { list, index }) {
  const st = stopOf(b), h = hearingAhead(b), d = h ? draftFor(b.id, h.committee) : null;
  // Filing is offered only at the filing step, once the testimony is approved (R-022): never beside "waiting for a second
  // approval", where it invited someone to file testimony nobody had signed off.
  const fileOk = d?.status === 'approved';
  const pos = POS_WORD[b.position || ''] || b.position || 'No position';
  const own = ownerOf(b);
  const next = h
    ? `<div class="lk-card next sv-stick"><h3>${esc(cmteName(h.committee) || h.committee)} hearing</h3>
        <p>${esc(fmtDT(h.scheduled_at))}${h.room ? ` · ${esc(h.room)}` : ''}</p>
        ${h.testimony_deadline ? `<p>Testimony due ${esc(fmtDT(h.testimony_deadline))} ${countdown(h.testimony_deadline)}</p>` : ''}
        <p class="small muted">Testimony: ${d ? esc(d.status === 'filed' ? 'filed' : d.status === 'approved' ? 'approved, not filed yet' : d.status === 'second_review' ? 'waiting for a second approval' : d.status === 'review' ? 'in review' : 'being written') : 'no draft yet'}</p>
        ${fileOk || d?.doc_url ? `<div class="lk-acts">${fileOk ? btn('File at the Capitol', { kind: 'secondary', sm: true, href: capitolUrl(b), target: '_blank', iconEnd: 'external-link' }) : ''}${d?.doc_url ? btn('Open Doc', { kind: 'text', sm: true, href: d.doc_url, target: '_blank', iconEnd: 'external-link' }) : ''}</div>` : ''}</div>`
    : `<div class="lk-card next sv-stick"><h3>No hearing on the books</h3><p class="small">${esc(st.says || '')}</p>
        ${st.deadline && !st.deadline.missed ? `<p class="small muted">Needs one by ${esc(st.deadline.label)}, ${esc(fmtDate(st.deadline.date))}.</p>` : ''}
        ${st.committee && chairMail(st.committee) ? `<div class="lk-acts">${btn('Email the chair', { kind: 'secondary', sm: true, href: `mailto:${chairMail(st.committee).email}?subject=${encodeURIComponent('Request for a hearing on ' + b.bill_number)}`, target: '_blank', iconEnd: 'external-link' })}</div>` : ''}</div>`;

  return `<div class="lk-head">
      <div class="num">${esc(billNum(b))}</div>
      ${b.nickname ? `<div class="nick">${esc(b.nickname)}</div>` : ''}
      <p class="sum">${esc(blurb(b, 220))}</p>
    </div>
    ${stageRibbon(b)}
    <p class="lk-says">${esc(st.says || '')}</p>
    <div class="lk-cols">
      <div>
        <div class="lk-card"><h3>Details</h3>
          <dl class="lk-kv">
            <dt>Committee</dt><dd>${dash(esc(cmteName(st.committee) || st.committee || ''))}${st.stops ? ` <span class="muted">· stop ${st.stop} of ${st.stops}</span>` : ''}</dd>
            ${st.committee && chairLine(st.committee) ? `<dt>Chair</dt><dd>${chairLine(st.committee)}</dd>` : ''}
            <dt>Deadline</dt><dd>${st.deadline ? `${esc(st.deadline.label)}, ${esc(fmtDate(st.deadline.date))}${st.deadline.missed ? ' <span class="muted">(missed)</span>' : ` <span class="muted">· ${st.deadline.days <= 0 ? 'today' : st.deadline.days + ' days'}</span>`}` : '—'}</dd>
            <dt>Last action</dt><dd>${b.last_action ? `${esc(fmtDate(b.last_action_date))} ${esc(lastActionLine(b))}` : '—'}</dd>
            ${sponsorLine(b) ? `<dt>Sponsors</dt><dd>${sponsorLine(b)}</dd>` : ''}
            <dt>Official title</dt><dd>${dash(esc(b.title || ''))}</dd>
          </dl>
        </div>
      </div>
      <div>
        ${next}
        <div class="lk-card"><h3>Team</h3>
          <dl class="lk-kv">
            <dt>Position</dt><dd>${esc(pos)}</dd>
            <dt>Priority</dt><dd>${b.priority ? 'P' + b.priority : '—'}</dd>
            <dt>Owner</dt><dd>${own ? `${avatar(own, 20)} ${esc(own.id === S.me?.id ? 'You' : own.full_name)}` : 'Nobody yet'}</dd>
          </dl>
        </div>
      </div>
    </div>
    ${list && list.length > 1 ? `<p class="lk-keys"><kbd>J</kbd> <kbd>K</kbd> next and previous bill · <kbd>Enter</kbd> opens the full page · <kbd>Esc</kbd> closes</p>` : ''}`;
}

// openLook(bill, { list, index }) — list is the bills of the screen you came from, so j/k can walk it.
export function openLook(b, { list = null, index = 0 } = {}) {
  if (!b) return null;
  const n = list ? list.length : 0, i = list ? Math.max(0, Math.min(n - 1, index)) : 0;
  const foot = `<div class="lk-nav">${n > 1 ? `<span class="pos">${i + 1} of ${n}</span>` : '<span class="pos"></span>'}
      ${n > 1 ? `${iconBtn('chevron-left', 'Previous bill', { 'data-lk': 'prev', ...(i === 0 ? { 'aria-disabled': 'true' } : {}) })}${iconBtn('chevron-right', 'Next bill', { 'data-lk': 'next', ...(i >= n - 1 ? { 'aria-disabled': 'true' } : {}) })}` : ''}
      ${btn('Open full page', { kind: 'primary', attrs: { 'data-lk': 'open' }, iconEnd: 'arrow-right' })}</div>`;
  return openSheet({
    title: esc(billNum(b)), size: 'look', body: body(b, { list, index: i }), foot,
    wire: d => {
      const move = k => { const to = list?.[i + k]; if (to) openLook(to, { list, index: i + k }); };
      const open = async () => { const href = `#/bill/${b.bill_number}`; await closeSheet({ silent: true }); S.go ? S.go(href) : (location.hash = href); };
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

// For a screen that only has a bill number to hand.
export const lookAt = (num, opts) => { const b = S.bills.find(x => x.bill_number === String(num).toUpperCase()); return b ? openLook(b, opts) : null; };

export default openLook;
