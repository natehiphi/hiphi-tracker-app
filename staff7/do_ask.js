// The ask step's page: Ask for a hearing. The app writes the email to the chair; the person can change it, opens it in their own mail app, sends it from there, and says here that they did.
import { S, DB, DEMO, advocate } from '../staff6/data.js';
import { chairIdsOf, chairAskMail, chairAskOf } from '../staff6/model.js';
import { askTodoOf } from '../staff6/chairask.js';
import { band, dueStrip, btn, esc, personMark, toast } from './parts.js';
import { cmteWords, first, billName, memoKey } from './steps.js';

// "Fri, Mar 20" from the ask's deadline (a date, or a full time).
const dayOf = d => d ? new Date(String(d).length === 10 ? d + 'T12:00:00-10:00' : d).toLocaleDateString('en-US', { timeZone: 'Pacific/Honolulu', weekday: 'short', month: 'short', day: 'numeric' }) : '';

// The email, written the way the current app writes it (staff6/model.js chairAskMail; the options are staff6/steps.js askMailOf's): its To, Subject and words, taken out of the mailto it builds.
export function mailFor(s) {
  const a = s.ask; if (!a?.m) return null;
  if (s.bills?.length > 1) {   // one email to the chair for every bill of the committee (R-398, Nate 14 Nov): the same words, the bills listed by number and short name
    const bl = s.bills.map(x => x.bill), r = chairAskMail(a.code, bl, { dl: a.st.deadline }); if (!r) return null;
    const q = r.href.indexOf('?'), p = new URLSearchParams(r.href.slice(q + 1));
    return { to: r.href.slice('mailto:'.length, q), ...plainGroup(bl, p.get('subject') || '', p.get('body') || '') };
  }
  const r = chairAskMail(a.code, [s.bill], { dl: a.st.deadline, ...(a.decide ? { heardAt: a.st.hearing?.scheduled_at || new Date().toISOString() } : {}),
    ...((a.partial || a.waitOn) && a.m.legId ? { to: { who: a.m.who, email: a.m.email, legId: a.m.legId, n: 1 } } : {}) });
  if (!r) return null;
  const q = r.href.indexOf('?'), p = new URLSearchParams(r.href.slice(q + 1));
  return { to: r.href.slice('mailto:'.length, q), ...plainWords(s.bill, p.get('subject') || '', p.get('body') || '') };
}
// Nate, 14 Nov ("Yes, short name"): in the new app the email names the bill by its number and short name, never the description
// cut at 100 characters mid-sentence, and says "the committee deadline", not the Capitol's own word for it (Lateral, Decking).
// The current app's text (chairAskMail) is left as it is; only these two phrases are swapped here.
export function plainWords(b, subject, body) {
  const num = String(b.bill_number || ''), nice = num.replace(/^([A-Za-z]+)\s*(\d+)/, '$1 $2'), name = String(b.nickname || '').trim();
  const end = body.indexOf('\n\nMahalo,'), para = end < 0 ? body : body.slice(0, end), tail = end < 0 ? '' : body.slice(end);
  const at = para.indexOf(num);
  let out = para;
  if (num && at >= 0) {
    let after = para.slice(at + num.length);
    if (after.startsWith(' (')) { const close = after.lastIndexOf(')'); if (close > 0) after = after.slice(close + 1); }
    const stop = /^[.:]/.test(after);
    out = para.slice(0, at) + nice + (name ? `, ${name}${stop ? '' : ','}` : '') + after;
  }
  out = out.replace(/ before the [^.\n]*? deadline on /, ' before the committee deadline on ');
  return { subject: num ? subject.split(num).join(nice) : subject, body: out + tail };
}
// The one email for several bills: the subject lists the numbers, each bill is a line "HB 1563, Smoke-free beaches" (the short name the app uses everywhere), and the deadline is "the committee deadline".
const niceNo = b => String(b.bill_number || '').replace(/^([A-Za-z]+)\s*(\d+)/, '$1 $2');
// A body line "- HB42 (title)" belongs to the bill whose number is followed by a space, a comma or a bracket (or ends the line): HB42 never takes HB424's line.
const lineBill = (bills, l) => { if (!l.startsWith('- ')) return null; const rest = l.slice(2); return bills.find(x => rest.startsWith(x.bill_number) && (rest.length === x.bill_number.length || /[\s,(]/.test(rest[x.bill_number.length]))) || null; };
export function plainGroup(bills, subject, body) {
  const lines = body.split('\n').map(l => { const b = lineBill(bills, l); return b ? `- ${niceNo(b)}, ${billName(b)}` : l; });
  return { subject: `Request for hearings on ${bills.map(niceNo).join(', ')}`, body: lines.join('\n').replace(/ before the [^.\n]*? deadline on /, ' before the committee deadline on ') };
}
// What the person has typed so far in this visit (kept only once they have typed), else the app's own words as they stand now.
const draftOf = (s, ctx) => ctx.mail[memoKey(s)] || (() => { const m = mailFor(s); return m ? { subject: m.subject, body: m.body } : { subject: '', body: '' }; })();
export const TOO_LONG = 1800;   // some mail apps cut a longer link
export const linkOf = (m, dr) => `mailto:${m.to.split(',').map(encodeURIComponent).join(',')}?subject=${encodeURIComponent(dr.subject)}&body=${encodeURIComponent(dr.body)}`;

const why = s => { const a = s.ask, day = dayOf(a.st?.deadline?.date);
  if (s.bills?.length > 1) return `These ${s.bills.length} bills need a hearing in ${cmteWords(a.code)}${day ? ` by ${day}` : ''}, or they stop for the year.`;
  return `It needs ${a.decide ? 'a vote' : 'a hearing'} in ${cmteWords(a.code)}${day ? ` by ${day}` : ''}, or it stops for the year.`; };

const foot = (s, ctx, m, long) => !m ? `<div class="sfoot" id="akFoot">${btn('Open in my mail app', { kind: 'filled', id: 'mailBtn', disabled: true })}<span class="fnote">No chair is listed for this committee yet.</span></div>`
  : ctx.stage[memoKey(s)] === 2
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
  if (s.bills?.length > 1) h += `<h2 class="sh">The bills</h2><ul class="askbills">${s.bills.map(x => `<li>${esc(x.name)}<span class="no">${esc(x.no)}</span></li>`).join('')}</ul>`;
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
    ctx.setMail(memoKey(s), cur()); fit();
    if (ctx.stage[memoKey(s)] !== 2 && isLong() !== long) { long = isLong(); slot.innerHTML = foot(s, ctx, m, long); wire(); }
  };
  if (ta) { fit(); ta.addEventListener('input', typed); document.fonts?.ready?.then(fit); }
  if (sj) sj.addEventListener('input', typed);
  const toYes = () => { ctx.setStage(memoKey(s), 2); slot.innerHTML = foot(s, ctx, m, long); wire('#yesBtn'); };
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
    if (no) no.addEventListener('click', () => { ctx.setStage(memoKey(s), 1); slot.innerHTML = foot(s, ctx, m, long); wire('#mailBtn'); });
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
  if (s.members?.length > 1) {   // one email, one ask recorded for every bill in it; if one fails, the ones already recorded are taken back
    const done = { parts: [], made: [], closed: [] };
    try {
      for (const x of s.members) {
        if (!x.ask.decide && chairAskOf(x.bill, x.ask.code)) continue;   // a bill whose chair was already asked is never recorded twice
        const u = await askStep({ bill: x.bill, ask: x.ask }); done.parts.push(u); done.made.push(...u.made); done.closed.push(...u.closed);
      }
    } catch (e) {
      try { await undoAsk(done); } catch (e2) { throw new Error(`${(e && e.message) || 'The ask did not save.'} ${e2.message}`); }
      throw e;
    }
    return done;
  }
  const a = s.ask, b = s.bill, all = chairIdsOf(a.code), legs = (a.partial || a.waitOn) && a.m?.legId ? [a.m.legId] : all;
  if (!legs.length) throw new Error('No chair is listed for this committee, so nothing was saved.');
  const made = [], closed = [], what = a.decide ? `a vote on ${b.bill_number}` : `a hearing on ${b.bill_number}`;
  try {
    for (const id of legs) made.push([await DB.addLegNote(id, b.id, `Asked for ${what} (${a.code}).`, { answer: 'asked', committee: a.code }), id]);   // "Asked for a hearing on" is the words the app's other screens look for
    const t = askTodoOf(b); if (t) { await DB.updateTodo(b.id, t.id, { done: true }); closed.push([b.id, t.id]); }
  } catch (e) { for (const [n, id] of made) await DB.delLegNote(n.id, id).catch(() => {}); throw e; }
  return { made, closed, bill: b };
}
// Takes back every bill it can. A bill that could not be taken back is named, so nobody thinks it is clear.
export async function undoAsk(u) {
  const failed = [];
  for (const p of u.parts || [u]) {
    let bad = false;
    for (const [n, id] of p.made) { try { await DB.delLegNote(n.id, id); } catch { bad = true; } }
    for (const [bid, tid] of p.closed) { try { await DB.updateTodo(bid, tid, { done: false }); } catch { bad = true; } }
    if (bad) failed.push(p.bill ? (p.bill.bill_number || 'a bill') : 'the ask');
  }
  if (failed.length) throw new Error(`Not all of it was taken back. The ask is still recorded for ${failed.join(', ')}.`);
}
