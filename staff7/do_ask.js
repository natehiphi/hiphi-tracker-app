// The ask step's page: Ask for a hearing. The app writes the email to the chair; the person can change it, opens it in their own mail app, sends it from there, and says here that they did.
import { DB, DEMO } from '../staff6/data.js';
import { chairIdsOf, chairAskMail } from '../staff6/model.js';
import { askTodoOf } from '../staff6/chairask.js';
import { band, dueStrip, btn, esc, personMark, toast } from './parts.js';
import { cmteWords } from './steps.js';

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
const mailtoOf = (to, subject, body) => `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
// What the person has typed so far in this visit, else the app's own words.
const draftOf = (s, ctx) => ctx.mail[s.id] ??= (() => { const m = mailFor(s); return m ? { subject: m.subject, body: m.body } : { subject: '', body: '' }; })();

const initials = n => { const w = String(n || '').replace(/^(rep\.|sen\.)\s+/i, '').trim().split(/\s+/); return ((w[0]?.[0] || '') + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase() || '?'; };
const why = s => { const a = s.ask, day = dayOf(a.st?.deadline?.date);
  return `It needs ${a.decide ? 'a vote' : 'a hearing'} in ${cmteWords(a.code)}${day ? ` by ${day}` : ''}, or it stops for the year.`; };

const foot = (s, ctx, m) => !m ? `<div class="sfoot" id="akFoot">${btn('Open in my mail app', { kind: 'filled', id: 'mailBtn', disabled: true })}<span class="fnote">No chair is listed for this committee yet.</span></div>`
  : ctx.stage[s.id] === 2
    ? `<div class="sfoot" id="akFoot" role="group" aria-labelledby="fq"><p class="fq" id="fq">Did you send it?</p>${btn('Yes, sent', { kind: 'filled', id: 'yesBtn' })}${btn('Not yet', { kind: 'quiet', id: 'notYet' })}</div>`
    : `<div class="sfoot" id="akFoot">${btn('Open in my mail app', { kind: 'filled', id: 'mailBtn' })}<span class="fnote">It opens your own mail. You send it from there.</span></div>`;

export function askSheet(s, ctx) {
  const a = s.ask, m = mailFor(s), dr = draftOf(s, ctx), plural = (a.m?.n || 1) > 1;
  let h = '<div class="pn">' + band(s.issue, 'Ask for a hearing', s.name, s.no);
  h += '<div class="pbody">' + dueStrip(s, { hearing: why(s) });
  h += '<div class="stgrid"><div class="stmain">';
  if (s.forWhom) h += `<p class="lead tight">You are asking for ${esc(s.forWhom)}.</p>`;
  h += a.m ? `<div class="chair">${personMark(initials(a.m.name))}<div class="g"><b>${esc(a.m.who)}</b><span>${plural ? 'Chairs' : 'Chair'}, ${esc(cmteWords(a.code))}</span></div></div>`
    : `<p class="lead">No chair is listed for ${esc(cmteWords(a.code))} yet.</p>`;
  if (m) {
    h += `<h2 class="sh">Your email to the chair</h2>`
      + `<p class="mline"><span class="ml">To</span><b>${esc(m.to.split(',').join(', '))}</b></p>`
      + `<div class="mline"><label class="ml" for="subj">Subject</label><input class="field" id="subj" type="text" value="${esc(dr.subject)}" autocomplete="off" spellcheck="true"></div>`
      + `<label class="ml mlab" for="letter">Message</label><textarea class="letter" id="letter" spellcheck="true">${esc(dr.body)}</textarea>`
      + `<p class="hint">You can change the words before it opens.</p>`;
  }
  h += '</div></div>';
  return h + `<div id="akSlot" class="fslot">${foot(s, ctx, m)}</div><p class="errt" id="akErr" role="alert" hidden></p></div></div>`;
}

export function bindAsk(s, ctx) {
  const m = mailFor(s), dr = draftOf(s, ctx), slot = document.getElementById('akSlot'), err = document.getElementById('akErr');
  const ta = document.getElementById('letter'), sj = document.getElementById('subj');
  const fail = e => { err.textContent = (e && e.message) || 'It did not go. Try again.'; err.hidden = false; };
  // The message grows with its words, so the page scrolls and the field never holds a second scrollbar.
  const fit = () => { if (!ta) return; ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight + ta.offsetHeight - ta.clientHeight) + 'px'; };
  if (ta) { fit(); ta.addEventListener('input', () => { dr.body = ta.value; fit(); }); document.fonts?.ready?.then(fit); }
  if (sj) sj.addEventListener('input', () => { dr.subject = sj.value; });
  const wire = focus => {
    err.hidden = true;
    const mb = document.getElementById('mailBtn'), yes = document.getElementById('yesBtn'), no = document.getElementById('notYet');
    if (mb && !mb.disabled) mb.addEventListener('click', () => {
      // The practice copy opens nothing. Live, the person's own mail app opens with the words as they stand now.
      if (DEMO) toast('In the practice copy your mail app does not open.');
      else location.href = mailtoOf(m.to, dr.subject, dr.body);
      ctx.stage[s.id] = 2; slot.innerHTML = foot(s, ctx, m); wire('#yesBtn');
    });
    if (no) no.addEventListener('click', () => { ctx.stage[s.id] = 1; slot.innerHTML = foot(s, ctx, m); wire('#mailBtn'); });
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
