// Two steps an ask to a chair makes for the one who holds it (R-398 piece 5, part 2): "Follow up with the chair" (a short second email, then the same Did you send it? as the first ask) and
// "Decide what next" after a no (the vice chair, the companion, the public, or leave it). Both end by themselves when the ask ends (ask_data.js `ended`, S-10). Live these are legislator_notes rows
// and nothing else; on the practice copy no email is opened and nothing is sent to anyone.
import { S, DB, DEMO } from '../staff6/data.js';
import { billRef } from '../staff6/model.js';
import { band, btn, esc, toast } from './parts.js';
import { ic } from './icons7.js';
import { billName, billNo, first, issueOf, dayTime } from './steps.js';
import { askById, dayWords, ymd, followTargets, phoneOf, companionAhead, viceIdsOf, setLeft } from './ask_data.js';
import { emailHTML, stepOf as replyStand } from './do_reply.js';
import { linkOf } from './do_ask.js';

const enc = encodeURIComponent;
const names = l => l.length < 3 ? l.join(' and ') : `${l.slice(0, -1).join(', ')} and ${l.at(-1)}`;
const legOf = id => (S.legislators || []).find(l => String(l.id) === String(id)) || {};
const niceNo = b => String(b.bill_number || '').replace(/^([A-Za-z]+)\s*(\d+)/, '$1 $2');
const longDay = t => new Date(String(t).length === 10 ? t + 'T12:00:00-10:00' : t).toLocaleDateString('en-US', { timeZone: 'Pacific/Honolulu', weekday: 'long', month: 'long', day: 'numeric' });
const dlOf = a => a.deadline && !a.deadline.missed ? a.deadline : null;
const SIGN = () => `\n\nMahalo,\n${S.me?.full_name || ''}${S.me?.full_name ? '\n' : ''}Hawaiʻi Public Health Institute`;

// ---------------------------------------------------------------------------------- the words of the two emails (the app writes them; the person may change them before they open)
// Follow-up: the drawing's second note. When the chair said yes and no hearing is set, it thanks them and asks when.
export function followMail(a) {
  const ts = followTargets(a), b = a.b, dl = dlOf(a), yesOnly = !a.quiet.length;
  const to = ts.map(c => legOf(c.id).email).filter(Boolean).join(',');
  const by = dl ? `, before the committee deadline on ${longDay(dl.date)}` : '';
  const body = yesOnly
    ? `Aloha ${names(ts.map(c => c.who))},\n\nMahalo for letting me know you will schedule a hearing on ${niceNo(b)}, ${billName(b)}. I am checking in because no hearing is set yet${a.noticeDay ? `, and the committee must announce it by ${longDay(a.noticeDay)}` : ''}. Could you let me know when it will be set?${SIGN()}`
    : `Aloha ${names(ts.map(c => c.who))},\n\nI am following up on my note of ${longDay(a.askedAt)} asking you to schedule a hearing on ${niceNo(b)}, ${billName(b)}${by}. Could you let me know if it can be scheduled?${SIGN()}`;
  return { to, subject: `Following up: hearing on ${niceNo(b)}`, body };
}
// To the vice chair, after a no: asks for help, never claims the vice chair can schedule it.
export function viceMail(a, vid) {
  const b = a.b, dl = dlOf(a), who = a.noes.length ? names(a.noes.map(c => c.who)) : 'The chair', v = legOf(vid);
  const vname = `${v.chamber === 'S' ? 'Sen.' : 'Rep.'} ${String(v.sort_name || v.name || '').split(',')[0].trim()}`;
  return { to: v.email || '', who: vname, subject: `Request for help getting a hearing on ${niceNo(b)}`,
    body: `Aloha ${vname},\n\nOn behalf of the Hawaiʻi Public Health Institute, I respectfully ask for your help in getting a hearing on ${niceNo(b)}, ${billName(b)}${dl ? `, before the committee deadline on ${longDay(dl.date)}` : ''}. ${who} has said no to a hearing, and we would be grateful for anything you can do.${SIGN()}` };
}

// ---------------------------------------------------------------------------------- the data change, and taking it back (rows in legislator_notes, as do_reply.js)
export async function recordFollow(a) {
  const made = [];
  try {
    for (const c of followTargets(a)) {
      const row = await DB.addLegNote(c.lid, a.b.id, `Followed up with ${c.who} about a hearing on ${a.b.bill_number} (${a.code}).`, { answer: c.answer === 'will_schedule' ? 'will_schedule' : 'left_message', committee: a.code });   // a yes stays a yes
      made.push([row, c.lid]);
    }
  } catch (e) { for (const [n, id] of made) await DB.delLegNote(n.id, id).catch(() => {}); throw e; }
  return { kind: 'reply', rows: made, key: a.key };
}
export async function recordVice(a, vid) {
  const row = await DB.addLegNote(vid, a.b.id, `Asked for a hearing on ${a.b.bill_number} (${a.code}), to the vice chair.`, { answer: 'asked', committee: a.code });
  return { kind: 'reply', rows: [[row, vid]], key: a.key };
}

// ---------------------------------------------------------------------------------- one email page for both (the footer is the drawing's: a filled Open in my mail app, then Did you send it?)
const stand = (a, kind, id) => ({ ...replyStand(a), id, kind });
const strip = (title, lines) => `<div class="strip calm">${ic('clock')}<strong>${esc(title)}</strong>${lines.filter(Boolean).map(l => `<span class="hl">${esc(l)}</span>`).join('')}</div>`;
function clockStrip(a) {
  const d = dlOf(a);
  return strip('Follow up today', [d ? `Needs a hearing by ${dayWords(String(d.date).slice(0, 10))}, in ${d.days} ${d.days === 1 ? 'day' : 'days'}.${a.noticeDay ? ` The committee must announce the hearing by ${dayWords(a.noticeDay)}.` : ''}` : a.noticeDay ? `The committee must announce the hearing by ${dayWords(a.noticeDay)}.` : '']);
}
const foot = (a, id, stage, canMail, own) => !canMail ? `<div class="sfoot" id="fuFoot">${btn('Open in my mail app', { kind: 'filled', id: 'mailBtn', disabled: true })}<span class="fnote">No email is listed for them yet.</span></div>`
  : stage === 2 ? `<div class="sfoot" id="fuFoot" role="group" aria-labelledby="fq"><p class="fq" id="fq">Did you send it?</p>${btn('Yes, sent', { kind: 'filled', id: 'yesBtn' })}${btn('Not yet', { kind: 'quiet', id: 'notYet' })}</div>`
  : `<div class="sfoot" id="fuFoot">${btn('Open in my mail app', { kind: 'filled', id: 'mailBtn' })}${own ? btn('The chair replied', { kind: 'quiet', id: 'replied', href: '#/ask/' + enc(a.key) }) : btn('Back', { kind: 'quiet', id: 'backTo', href: '#/do/dc-' + enc(a.key) })}`
    + `<span class="fnote">It opens your own mail. You send it from there.${own ? ` ${btn('Give this ask to…', { kind: 'text', id: 'giveLink', href: '#/give/' + enc(a.key) })}` : ''}</span></div>`;

function emailBlock(m, dr, phones, plural) {
  return `<h2 class="sh">${plural}</h2><p class="mline"><span class="ml">To</span><b>${esc(m.to.split(',').join(', '))}</b></p>`
    + (phones ? `<p class="mline phone"><span class="ml"></span><span>${esc(phones)}</span></p>` : '')
    + `<div class="mline"><label class="ml" for="subj">Subject</label><input class="field" id="subj" type="text" value="${esc(dr.subject)}" autocomplete="off" spellcheck="true"></div>`
    + `<label class="ml mlab" for="letter">Message</label><textarea class="field letter" id="letter" spellcheck="true">${esc(dr.body)}</textarea><p class="hint">You can change the words before it opens.</p>`;
}
const phoneWords = ts => { const ps = ts.map(c => [c.who, phoneOf(c)]).filter(x => x[1]); return !ps.length ? '' : ps.length === 1 && ts.length === 1 ? `Or call the office: ${ps[0][1]}` : `Or call the offices: ${ps.map(([w, p]) => `${w} ${p}`).join(', ')}`; };

// ---------------------------------------------------------------------------------- Follow up with the chair
export function followSheet(s, ctx) {
  const a = askById(s.askKey); if (!a || a.ended || !a.due) return `<div class="pn"><div class="hband neutral"><div class="ht"><h1 tabindex="-1">That step is done or no longer yours.</h1></div></div><div class="pbody"><p class="lead"><a class="btn text" href="#/">Back to Home</a></p></div></div>`;
  const m = followMail(a), dr = ctx.mail[s.id] || { subject: m.subject, body: m.body }, ts = followTargets(a), yes = !a.quiet.length;
  const since = Math.max(...ts.map(c => c.at));
  const lead = yes ? `${names(ts.map(c => c.who))} said yes, but no hearing is set yet. A short note often gets the date set.`
    : `${names(ts.map(c => c.who))} ${ts.length > 1 ? 'have' : 'has'} not answered since ${dayWords(since)}. A short second note often gets it scheduled.`;
  let h = '<div class="pn">' + band(s.issue, s.verb, s.name, s.no) + '<div class="pbody">' + clockStrip(a) + '<div class="stgrid"><div class="stmain">';
  if (a.holder !== a.asker) h += `<p class="lead tight">${esc(first((S.advocates || []).find(x => x.id === a.asker)))} asked ${esc(a.cmte)} first. This ask is yours now.</p>`;
  h += `<p class="lead">${esc(lead)}</p>` + emailBlock(m, dr, phoneWords(ts), `Your follow-up to the chair${ts.length > 1 ? 's' : ''}`);
  h += '</div></div>';
  return h + `<div id="fuSlot" class="fslot">${foot(a, s.id, ctx.stage[s.id], !!m.to, true)}</div><p class="errt" id="fuErr" role="alert" hidden></p></div></div>`;
}

// the same wiring for the follow-up and the vice chair's email: typing is kept, Open in my mail app asks Did you send it?, Yes, sent records
function bindMail({ ctx, id, a, mail, own, record, finish }) {
  const slot = document.getElementById('fuSlot'), err = document.getElementById('fuErr'), ta = document.getElementById('letter'), sj = document.getElementById('subj');
  const cur = () => ({ subject: sj ? sj.value : '', body: ta ? ta.value : '' }), m = mail();
  const fit = () => { if (!ta) return; ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight + ta.offsetHeight - ta.clientHeight) + 'px'; };
  const typed = () => { ctx.setMail(id, cur()); fit(); };
  if (ta) { fit(); ta.addEventListener('input', typed); document.fonts?.ready?.then(fit); }
  if (sj) sj.addEventListener('input', typed);
  const draw = focus => { slot.innerHTML = foot(a(), id, ctx.stage[id], !!m.to, own); wire(focus); };
  const wire = focus => {
    err.hidden = true;
    const mb = document.getElementById('mailBtn'), yes = document.getElementById('yesBtn'), no = document.getElementById('notYet');
    if (mb && !mb.disabled) mb.addEventListener('click', () => {
      if (DEMO) { ctx.setStage(id, 2); draw('#yesBtn'); toast('In the practice copy your mail app does not open.'); return; }
      const x = document.createElement('a'); x.href = linkOf(m, cur()); x.target = '_blank'; x.rel = 'noopener'; x.click();   // a new tab or the mail app: this tab is never replaced
      ctx.setStage(id, 2); draw('#yesBtn');
    });
    if (no) no.addEventListener('click', () => { ctx.setStage(id, 1); draw('#mailBtn'); });
    if (yes) yes.addEventListener('click', async () => {
      if (ctx.busy.has(id)) return; ctx.busy.add(id); err.hidden = true; yes.disabled = true; yes.classList.add('is-loading'); yes.setAttribute('aria-busy', 'true'); yes.textContent = 'Saving';
      try {
        const was = a(); if (!was || was.ended) throw new Error('This ask is no longer open, so nothing was saved. Go back to Home.');
        finish(await record(was), was);
      } catch (e) { yes.disabled = false; yes.classList.remove('is-loading'); yes.removeAttribute('aria-busy'); yes.textContent = 'Yes, sent'; err.textContent = (e && e.message) || 'It did not save. Try again.'; err.hidden = false; yes.focus(); }
      finally { ctx.busy.delete(id); }
    });
    if (focus) document.querySelector(focus)?.focus();
  };
  wire();
}

export function bindFollow(s, ctx) {
  const key = s.askKey, get = () => askById(key);
  bindMail({ ctx, id: s.id, a: get, own: true, mail: () => followMail(get()), record: a => recordFollow(a), finish: (u, was) => {
    const now = get(), day = ymd(Date.now());
    const phones = followTargets(was).filter(c => phoneOf(c));
    const last = !!now && now.noMore;   // the announce day is the next thing: no reminder will come before it (build choice a)
    const sub = last ? `The committee must announce the hearing by ${dayWords(now.noticeDay)}${now.noticeDay === day ? ', which is today' : ''}. If there is still no reply, call the office or ask partners and the public.`
      : `We remind you again on ${dayWords(now?.remindOn || was.clockOn)} if there is still no reply. Nothing else needs you on ${billName(was.b)} until then.`;
    const extra = last ? `<p class="dlinks">${phones.length ? `<a class="btn quiet" id="callOffice" href="tel:${esc(phoneOf(phones[0]).replace(/[^\d+]/g, ''))}">${ic('phone')}Call the office: ${esc(phoneOf(phones[0]))}</a>` : ''}<a class="btn quiet" id="askPublic" href="#/public/${enc(String(was.b.bill_number).replace(/\s/g, '').toUpperCase())}">Ask partners and the public</a></p>` : '';
    ctx.finished[s.id] = { step: stand(was, 'chairfu', s.id), at: Date.now(), kind: 'followed', billId: was.b.id, status: 'fu', undo: u, back: '#/do/' + enc(s.id), words: { title: 'Followed up.', sub, extra, reverse: 'I have not sent it yet' } };
    location.hash = '#/done/' + enc(s.id);
  } });
}

// ---------------------------------------------------------------------------------- Ask the vice chair (from Decide what next)
const viceOf = (a, q) => { const ids = viceIdsOf(a.code).filter(id => !a.chairs.some(c => c.id === String(id))), want = q?.get('to'); return ids.find(id => String(id) === want) ?? ids[0] ?? null; };
export function viceSheet(key, ctx, q) {
  const a = askById(key); if (!a || a.ended || !a.saidNo) return '';
  const vid = viceOf(a, q); if (vid == null) return '';
  const m = viceMail(a, vid), id = 'vice:' + key, dr = ctx.mail[id] || { subject: m.subject, body: m.body };
  let h = '<div class="pn">' + band(issueOf(a.b), 'Ask the vice chair', billName(a.b), billNo(a.b)) + '<div class="pbody">' + decideStrip(a) + '<div class="stgrid"><div class="stmain">';
  h += `<p class="lead">${esc(names(a.noes.map(c => c.who)))} said no. ${esc(m.who)}, the vice chair of ${esc(a.cmte)}, may be able to help.</p>`;
  h += emailBlock(m, dr, (() => { const p = String(legOf(vid).phone || '').trim(); return p ? `Or call the office: ${p}` : ''; })(), 'Your email to the vice chair');
  h += '</div></div>';
  return h + `<div id="fuSlot" class="fslot">${foot(a, id, ctx.stage[id], !!m.to, false)}</div><p class="errt" id="fuErr" role="alert" hidden></p></div></div>`;
}
export function bindVice(key, ctx, q) {
  const get = () => askById(key), id = 'vice:' + key, a0 = get(), vid = a0 && viceOf(a0, q); if (!a0 || vid == null) return;
  bindMail({ ctx, id, a: get, own: false, mail: () => viceMail(get(), vid), record: a => recordVice(a, vid), finish: (u, was) => {
    const v = viceMail(was, vid).who;
    ctx.finished[id] = { step: stand(was, 'chairfu', id), at: Date.now(), kind: 'followed', billId: was.b.id, status: 'fu', undo: u, back: '#/do/dc-' + enc(key),
      words: { title: 'Asked the vice chair.', sub: `Nothing else needs you on ${billName(was.b)} until ${v} answers. If there is no reply in 3 working days, we remind you.`, extra: '', reverse: 'I have not sent it yet' } };
    location.hash = '#/done/' + enc(id);
  } });
}

// ---------------------------------------------------------------------------------- Decide what next
const decideStrip = a => { const d = dlOf(a); return d ? `<div class="strip calm">${ic('clock')}<strong>Needs a hearing by ${esc(dayWords(String(d.date).slice(0, 10)))}</strong><span>in ${d.days} ${d.days === 1 ? 'day' : 'days'}</span></div>` : ''; };
const choice = (act, title, sub, data = '') => `<button class="cch" type="button" data-act="${act}"${data}><span class="cct"><b>${esc(title)}</b><span>${esc(sub)}</span></span>${ic('chevron-right')}</button>`;
export function decideSheet(s) {
  const a = askById(s.askKey); if (!a || a.ended || !a.decide) return `<div class="pn"><div class="hband neutral"><div class="ht"><h1 tabindex="-1">That step is done or no longer yours.</h1></div></div><div class="pbody"><p class="lead"><a class="btn text" href="#/">Back to Home</a></p></div></div>`;
  const vices = viceIdsOf(a.code).filter(id => !a.chairs.some(c => c.id === String(id))).slice(0, 2), comp = companionAhead(a.b);
  let h = '<div class="pn">' + band(s.issue, 'The chair said no', s.name, s.no) + '<div class="pbody">' + decideStrip(a) + '<div class="stgrid"><div class="stmain">';
  h += `<h2 class="sh">What next?</h2><div id="opts">`;
  for (const v of vices) { const l = legOf(v); h += choice('vice', `Ask the vice chair, ${l.chamber === 'S' ? 'Sen.' : 'Rep.'} ${String(l.sort_name || l.name || '').split(',')[0].trim()}`, 'Opens a written email for you to send', ` data-to="${esc(v)}"`); }
  if (comp) h += choice('companion', `Work on the companion, ${niceNo(comp.b)}`, `Has a hearing ${dayTime(comp.h.scheduled_at)}`);
  h += choice('public', 'Ask partners and the public', 'Opens public mode for this bill');
  h += choice('leave', 'Leave it for now', 'The bill stays on your list. You still hear if it is at risk or does not advance.');
  h += '</div></div></div>';
  return h + `<div class="cfoot">${btn('See the email you sent', { kind: 'text', id: 'seeMail', attrs: 'aria-expanded="false" aria-controls="mailSee"' })}</div><div class="cmail" id="mailSee" hidden>${emailHTML(a)}</div></div></div>`;
}
export function bindDecide(s, ctx) {
  const key = s.askKey, sm = document.getElementById('seeMail'), box = document.getElementById('mailSee');
  sm?.addEventListener('click', () => { const on = box.hidden; box.hidden = !on; sm.setAttribute('aria-expanded', String(on)); });
  document.querySelectorAll('#opts [data-act]').forEach(bt => bt.addEventListener('click', () => {
    const a = askById(key); if (!a || a.ended) return;
    const act = bt.dataset.act, mark = via => setLeft(key, { at: a.noAt, via });
    if (act === 'vice') { location.hash = `#/vice/${enc(key)}?to=${enc(bt.dataset.to)}`; return; }
    if (act === 'companion') { const c = companionAhead(a.b); if (!c) return; mark('companion'); location.hash = '#/bill/' + billRef(c.b); return; }
    if (act === 'public') { mark('public'); location.hash = '#/public/' + enc(String(a.b.bill_number).replace(/\s/g, '').toUpperCase()); return; }
    mark('leave'); location.hash = '#/';
    const undo = () => { setLeft(key, null); ctx.rerender(); toast('Put back.', { ms: 4000 }); };
    addEventListener('hashchange', () => toast(`Left for now. You still hear if ${billName(a.b)} is at risk or does not advance.`, { undo, ms: 10000 }), { once: true });
  }));
}
