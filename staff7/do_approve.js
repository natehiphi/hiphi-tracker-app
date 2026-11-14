// The approve step's page: Approve testimony, or Second look. Read the letter in its Google Doc, then Approve, or Send back with a note.
import { DB, advocate } from '../staff6/data.js';
import { filerOf } from '../staff6/model.js';
import { band, dueStrip, btn, esc, personMark } from './parts.js';
import { hearingLine, dayTime, first } from './steps.js';
import { letterBlock, bindLetter } from './do_write.js';
import { ic } from './icons7.js';

export const writerOf = s => advocate(s.draft?.submitted_by) || advocate(filerOf(s.draft));

export function approveSheet(s, ctx) {
  const second = s.kind === 'second', w = writerOf(s), d = s.draft, sent = d?.submitted_at, a1 = second ? advocate(d?.approved_by) : null;
  const who = w ? `<b>${esc(first(w))}</b> wrote this${sent ? ` and sent it ${esc(dayTime(sent))}` : ''}.${a1 ? ` <b>${esc(first(a1))}</b> approved it${d.approved_at ? ` ${esc(dayTime(d.approved_at))}` : ''}.` : ''}` : '';
  let h = '<div class="pn">' + band(s.issue, second ? 'Second look' : 'Approve testimony', s.name, s.no);
  h += '<div class="pbody">' + dueStrip(s, { hearing: hearingLine(s.hearing) });
  h += `<div class="stgrid"><div class="stmain">${who ? `<p class="who2">${personMark(w.initials, { small: true })}<span>${who}</span></p>` : ''}${letterBlock(s, ctx, { label: 'The letter', sub: false, hint: 'It opens in Google Docs. Come back here to approve it or send it back.' })}`
    + `<div class="sbnote" id="sbBox" hidden><label class="lab" for="sbNote">What should change?</label><textarea class="field" id="sbNote" aria-describedby="sbErr" aria-required="true" rows="4"></textarea>`
    + `<p class="errt" id="sbErr" hidden>${ic('circle-alert')}<span>Write what should change, so ${esc(w ? first(w) : 'the writer')} knows.</span></p></div></div></div>`;
  h += `<div class="sfoot" id="apFoot"></div><p class="errt" id="apErr" role="alert" hidden></p></div></div>`;
  return h;
}

export function bindApprove(s, ctx) {
  bindLetter(s, ctx);
  const foot = document.getElementById('apFoot'), box = document.getElementById('sbBox'), nt = document.getElementById('sbNote'), err = document.getElementById('apErr'), bad = document.getElementById('sbErr');
  const w = writerOf(s), fail = e => { err.textContent = (e && e.message) || 'It did not go. Try again.'; err.hidden = false; };
  const busy = (b, words) => { b.disabled = true; b.classList.add('is-loading'); b.setAttribute('aria-busy', 'true'); b.textContent = words; };
  const first_ = focus => {
    box.hidden = true; err.hidden = true;
    foot.innerHTML = `${btn('Approve', { kind: 'filled', id: 'apBtn' })}${btn('Send back', { kind: 'quiet', id: 'sbBtn' })}<span class="fnote">${esc(w ? first(w) : 'The writer')} files it once it is approved.</span>`;
    const ap = document.getElementById('apBtn');
    ap.addEventListener('click', async () => { err.hidden = true; busy(ap, 'Approving'); try { await ctx.approve(s); } catch (e) { first_('#apBtn'); fail(e); } });
    document.getElementById('sbBtn').addEventListener('click', () => second_());
    if (focus) document.querySelector(focus)?.focus();
  };
  const second_ = () => {
    box.hidden = false; err.hidden = true;
    foot.innerHTML = `${btn('Send back with this note', { kind: 'filled', id: 'sbGo' })}${btn('Cancel', { kind: 'quiet', id: 'sbCancel' })}`;
    box.scrollIntoView({ block: 'nearest' }); nt.focus({ preventScroll: true });
    document.getElementById('sbGo').addEventListener('click', () => {
      const text = nt.value.trim();
      if (!text) { nt.setAttribute('aria-invalid', 'true'); nt.classList.add('err'); bad.hidden = false; box.scrollIntoView({ block: 'nearest' }); nt.focus({ preventScroll: true }); return; }
      busy(document.getElementById('sbGo'), 'Sending back');
      try { ctx.sendBack(s, text); } catch (e) { second_(); fail(e); }
    });
    document.getElementById('sbCancel').addEventListener('click', () => { ctx.notes[s.id] = nt.value; first_('#sbBtn'); });
  };
  nt.addEventListener('input', () => { nt.classList.remove('err'); nt.removeAttribute('aria-invalid'); bad.hidden = true; ctx.notes[s.id] = nt.value; });
  if (ctx.notes[s.id]) { nt.value = ctx.notes[s.id]; second_(); } else first_();   // Undo of a send back, or a failed one, returns here with the words typed
}

// The data changes. Approve goes through at once (Undo takes it back). Send back is held for the 10 seconds, as Staff v6 holds it, so Undo cancels it before anything is sent.
export async function approveStep(s) {
  const d = s.draft; await DB.transition(s.bill.id, d.id, 'approve');
  return { action: 'unapprove', billId: s.bill.id, draftId: d.id };
}
export const undoApprove = u => DB.transition(u.billId, u.draftId, u.action);
export const sendBackNow = (s, text) => DB.transition(s.bill.id, s.draft.id, 'request_changes', text);
