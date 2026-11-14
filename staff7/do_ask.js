// The ask step's page: Ask for a hearing. The app writes the email to the chair; the person can change it, opens it in their own mail app, sends it from there, and says here that they did.
import { S, DB, DEMO, advocate } from '../staff6/data.js';
import { chairIdsOf, chairAskMail } from '../staff6/model.js';
import { askTodoOf } from '../staff6/chairask.js';
import { band, dueStrip, btn, esc, personMark, toast } from './parts.js';
import { cmteWords, first } from './steps.js';

// "Fri, Mar 20" from the ask's deadline (a date, or a full time).
const dayOf = d => d ? new Date(String(d).length === 10 ? d + 'T12:00:00-10:00' : d).toLocaleDateString('en-US', { timeZone: 'Pacific/Honolulu', weekday: 'short', month: 'short', day: 'numeric' }) : '';

// The email, written the way the current app writes it (staff6/model.js chairAskMail; the options are staff6/steps.js askMailOf's): its To, Subject and words, taken out of the mailto it builds.
export function mailFor(s) {
  const a = s.ask; if (!a?.m) return null;
  const r = chairAskMail(a.code, [s.bill], { dl: a.st.deadline, ...(a.decide ? { heardAt: a.st.hearing?.scheduled_at || new Date().toISOString() } : {}),
    ...((a.partial || a.waitOn) && a.m.legId ? { to: { who: a.m.who, email: a.m.email, legId: a.m.legId, n: 1 } } : {}) });
  if (!r) return null;
  const q = r.href.indexOf('?'), p = new URLSearchParams(r.href.slice(q + 1));
  return { to: r.href.slice('mailto:'.length, q), subject: p.get('subject') || '', body: p.get('body') || '' };
}
// What the person has typed so far in this visit (kept only once they have typed), else the app's own words as they stand now.
const draftOf = (s, ctx) => ctx.mail[s.id] || (() => { const m = mailFor(s); return m ? { subject: m.subject, body: m.body } : { subject: '', body: '' }; })();
export const TOO_LONG = 1800;   // some mail apps cut a longer link
export const linkOf = (m, dr) => `mailto:${m.to.split(',').map(encodeURIComponent).join(',')}?subject=${encodeURIComponent(dr.subject)}&body=${encodeURIComponent(dr.body)}`;

const why = s => { const a = s.ask, day = dayOf(a.st?.deadline?.date);
  return `It needs ${a.decide ? 'a vote' : 'a hearing'} in ${cmteWords(a.code)}${day ? ` by ${day}` : ''}, or it stops for the year.`; };

const foot = (s, ctx, m, long) => !m ? `<div class="sfoot" id="akFoot">${btn('Open in my mail app', { kind: 'filled', id: 'mailBtn', disabled: true })}<span class="fnote">No chair is listed for this committee yet.</span></div>`
  : ctx.stage[s.id] === 2
    ? `<div class="sfoot" id="akFoot" role="group" aria-labelledby="fq"><p class="fq" id="fq">Did you send it?</p>${btn('Yes, sent', { kind: 'filled', id: 'yesBtn' })}${btn('Not yet', { kind: 'quiet', id: 'notYet' })}</div>`
    : `<div class="sfoot" id="akFoot">${btn(long ? 'Copy the message' : 'Open in my mail app', { kind: 'filled', id: 'mailBtn' })}<span class="fnote">${long ? 'It is too long for some mail apps. Paste it into your mail.' : 'It opens your own mail. You send it from there.'} ${btn('I already sent it', { kind: 'text', id: 'already' })}</span></div>`;

export function askSheet(s, ctx) {
  const a = s.ask, m = mailFor(s), dr = draftOf(s, ctx), plural = (a.m?.n || 1) > 1, cm = cmteWords(a.code);
  let h = '<div class="pn">' + band(s.issue, s.verb, s.name, s.no);
  h += '<div class="pbody">' + dueStrip(s, { hearing: why(s) });
  h += '<div class="stgrid"><div class="stmain">';
  if (s.forWhom) {
    const t = a.todo, by = advocate(t?.created_by), owner = (S.assignments?.[s.bill.id] || []).map(advocate).find(x => x && first(x) === s.forWhom);
    // the ask is one record for the whole team (every row reads "Asked by ..."), so the owner sees it as soon as it is recorded
    h += `<p class="lead tight">${by && owner && by.id !== owner.id ? `${esc(first(by))} handed you this one for ${esc(s.forWhom)}.` : `${esc(s.forWhom)} asked you to do this one.`} ${esc(s.forWhom)} sees it when you have asked.</p>`;
  }
  h += a.m ? `<p class="chair"><span class="muted">${plural ? 'The chairs' : 'The chair'}:</span> <b>${esc(a.m.who)}</b>, ${esc(cm)}</p>`
    : `<p class="lead">No chair is listed for ${esc(cm)} yet.</p>`;
  if (m) {
    h += `<h2 class="sh">Your email to the chair${plural ? 's' : ''}</h2>`
      + `<p class="mline"><span class="ml">To</span><b>${esc(m.to.split(',').join(', '))}</b></p>`
      + `<div class="mline"><label class="ml" for="subj">Subject</label><input class="field" id="subj" type="text" value="${esc(dr.subject)}" autocomplete="off" spellcheck="true"></div>`
      + `<label class="ml mlab" for="letter">Message</label><textarea class="field letter" id="letter" spellcheck="true">${esc(dr.body)}</textarea>`
      + `<p class="hint">You can change the words before it opens.</p>`;
  }
  h += '</div></div>';
  return h + `<div id="akSlot" class="fslot">${foot(s, ctx, m, m && linkOf(m, dr).length > TOO_LONG)}</div><p class="errt" id="akErr" role="alert" hidden></p></div></div>`;
}

export function bindAsk(s, ctx) {
  const m = mailFor(s), slot = document.getElementById('akSlot'), err = document.getElementById('akErr');
  const ta = document.getElementById('letter'), sj = document.getElementById('subj');
  const cur = () => ({ subject: sj ? sj.value : '', body: ta ? ta.value : '' });
  const isLong = () => !!m && linkOf(m, cur()).length > TOO_LONG;
  const fail = e => { err.textContent = (e && e.message) || 'It did not go. Try again.'; err.hidden = false; };
  // The message grows with its words, so the page scrolls and the field never holds a second scrollbar.
  const fit = () => { if (!ta) return; ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight + ta.offsetHeight - ta.clientHeight) + 'px'; };
  let long = isLong();
  const typed = () => {   // the email is kept from the first change on; until then it is written fresh each time
    ctx.setMail(s.id, cur()); fit();
    if (ctx.stage[s.id] !== 2 && isLong() !== long) { long = isLong(); slot.innerHTML = foot(s, ctx, m, long); wire(); }
  };
  if (ta) { fit(); ta.addEventListener('input', typed); document.fonts?.ready?.then(fit); }
  if (sj) sj.addEventListener('input', typed);
  const toYes = () => { ctx.setStage(s.id, 2); slot.innerHTML = foot(s, ctx, m, long); wire('#yesBtn'); };
  const wire = focus => {
    err.hidden = true;
    const mb = document.getElementById('mailBtn'), yes = document.getElementById('yesBtn'), no = document.getElementById('notYet'), already = document.getElementById('already');
    if (mb && !mb.disabled) mb.addEventListener('click', () => {
      const dr = cur();
      if (DEMO) { toYes(); toast(long ? 'In the practice copy nothing is copied.' : 'In the practice copy your mail app does not open.'); return; }
      if (long) {   // too long for some mail apps: the words go on the clipboard to paste into the person's own mail
        const done = () => toYes(), hand = () => fail(new Error('Copying is blocked in this browser. Select the message and copy it by hand.'));
        try { navigator.clipboard.writeText(dr.body).then(done, hand); } catch { hand(); }
        return;
      }
      const a = document.createElement('a'); a.href = linkOf(m, dr); a.target = '_blank'; a.rel = 'noopener'; a.click();   // a new tab or the mail app: this tab is never replaced
      toYes();
    });
    if (already) already.addEventListener('click', toYes);
    if (no) no.addEventListener('click', () => { ctx.setStage(s.id, 1); slot.innerHTML = foot(s, ctx, m, long); wire('#mailBtn'); });
    if (yes) yes.addEventListener('click', async () => {
      err.hidden = true; yes.disabled = true; yes.classList.add('is-loading'); yes.setAttribute('aria-busy', 'true'); yes.textContent = 'Saving';
      try { await ctx.askIt(s); }
      catch (e) { yes.disabled = false; yes.classList.remove('is-loading'); yes.removeAttribute('aria-busy'); yes.textContent = 'Yes, sent'; fail(e); yes.focus(); }
    });
    if (focus) document.querySelector(focus)?.focus();
  };
  wire();
}

// The data change, as staff6/chairask.js recordAsk makes it: one note to each chair of the committee saying the ask was made (the record every teammate's row reads), and the to-do that handed this ask to someone is closed.
// Live these are two kinds of write and nothing else: legislator_notes rows and a bill_todos update. No message goes out.
export async function askStep(s) {
  const a = s.ask, b = s.bill, all = chairIdsOf(a.code), legs = (a.partial || a.waitOn) && a.m?.legId ? [a.m.legId] : all;
  if (!legs.length) throw new Error('No chair is listed for this committee, so nothing was saved.');
  const made = [], closed = [], what = a.decide ? `a vote on ${b.bill_number}` : `a hearing on ${b.bill_number}`;
  try {
    for (const id of legs) made.push([await DB.addLegNote(id, b.id, `Asked for ${what} (${a.code}).`, { answer: 'asked', committee: a.code }), id]);   // "Asked for a hearing on" is the words the app's other screens look for
    const t = askTodoOf(b); if (t) { await DB.updateTodo(b.id, t.id, { done: true }); closed.push([b.id, t.id]); }
  } catch (e) { for (const [n, id] of made) await DB.delLegNote(n.id, id).catch(() => {}); throw e; }
  return { made, closed };
}
export async function undoAsk(u) {
  for (const [n, id] of u.made) await DB.delLegNote(n.id, id);
  for (const [bid, tid] of u.closed) await DB.updateTodo(bid, tid, { done: false });
}
