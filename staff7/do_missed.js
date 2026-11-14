// The missed step's page: Did we file? A letter was approved, its hearing has started and nothing says it was filed; one question, answered in one tap, and nobody is blamed.
import { S, DB } from '../staff6/data.js';
import { noFileTitle } from '../staff6/steps.js';
import { roomName } from '../staff6/model.js';
import { band, dueStrip, btn } from './parts.js';
import { cmteWords } from './steps.js';
import { letterRow, bindLetterRow, approvedLine } from './do_file.js';

export function missedSheet(s, ctx) {
  const d = s.draft, ok = d?.status === 'approved';   // only approved testimony can be marked filed (the database refuses the rest)
  let h = '<div class="pn">' + band(s.issue, 'Did we file?', s.name, s.no);
  h += '<div class="pbody">' + dueStrip(s, { hearing: [cmteWords(s.hearing?.committee), roomName(s.hearing?.room)].filter(Boolean).join(' · ') });
  h += `<div class="stgrid"><div class="stmain">${d ? `<p class="lead tight">${ok ? 'The letter was approved. Nothing says it was filed.' : 'The letter was never approved, so it cannot be marked filed here.'}</p>` : '<p class="lead tight">Nothing says a letter was made for this hearing.</p>'}${approvedLine(s)}${letterRow(s, ctx)}</div></div>`;
  h += d ? `<div class="sfoot" id="msFoot">${ok ? btn('Yes, filed', { kind: 'filled', id: 'yesBtn' }) : ''}${btn('No, it was not filed', { kind: ok ? 'quiet' : 'filled', id: 'noBtn' })}`
      + `<span class="fnote">${ok ? 'Either answer is fine. It is noted for the team.' : 'It is noted for the team.'}</span></div>`
    : '<div class="sfoot plain"><a class="btn text" href="#/">Back to Home</a></div>';
  return h + '<p class="errt" id="msErr" role="alert" hidden></p></div></div>';
}

export function bindMissed(s, ctx) {
  bindLetterRow();
  const err = document.getElementById('msErr'), yes = document.getElementById('yesBtn'), no = document.getElementById('noBtn');
  const fail = e => { err.textContent = (e && e.message) || 'It did not go. Try again.'; err.hidden = false; };
  const busy = (b, words) => { [yes, no].forEach(x => x && (x.disabled = true)); b.classList.add('is-loading'); b.setAttribute('aria-busy', 'true'); b.textContent = words; };
  const idle = (b, words) => { [yes, no].forEach(x => x && (x.disabled = false)); b.classList.remove('is-loading'); b.removeAttribute('aria-busy'); b.textContent = words; b.focus(); };
  if (yes) yes.addEventListener('click', async () => { err.hidden = true; busy(yes, 'Saving'); try { await ctx.lateFiled(s); } catch (e) { idle(yes, 'Yes, filed'); fail(e); } });
  if (no) no.addEventListener('click', async () => { err.hidden = true; busy(no, 'Saving'); try { await ctx.notFiledIt(s); } catch (e) { idle(no, 'No, it was not filed'); fail(e); } });
}

// Yes is the same record as filing it: do_file.js's fileStep and undoFile.
// No is what the current app records (staff6/steps.js nofile): one line on the bill's timeline, "Testimony not filed for the ... hearing ...", which the app reads back to stop asking.
// The app has no way to take that line off the timeline again, so this page offers no reverse for No.
export async function notFiledStep(s) {
  const d = s.draft; if (!d) throw new Error('There is no letter to note.');
  await DB.addActivity(s.bill.id, 'testimony', noFileTitle(d));
  (S.v6NoFile ??= new Set()).add(String(d.id));
  return { billId: s.bill.id, draftId: d.id };
}
