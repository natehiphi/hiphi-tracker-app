// The email composer (#/email/new?bill=&list=&segment=, #/email/:id; plan 3.9): an action alert to the people who
// follow a bill or a list, or to a saved segment of supporters, in four steps with a step bar and Back / Next at the
// bottom: Who, Write, Preview, Submit. Once an email is sent for approval the page shows where it stands instead,
// with the one action the viewer can take (Approve / Send back for another admin, Send for the author).
// The rules and calls are the current app's (app.js composerHTML / wireEmails, migrations 045-049):
//   - DB.saveAlert, then DB.alertStep(id, 'submit' | 'approve' | 'return' | 'send' | 'test');
//   - only the author edits a draft or a sent-back email, and who it goes to is fixed once it is saved;
//   - an admin other than the author approves it (the server refuses the author, and so does this page);
//   - the author, or an admin, sends it once approved; a test copy goes only to the person asking;
//   - the message is HTML cleaned to a small set of tags (cleanHTML), with body as its plain-text twin.
// v2 adds: a search box instead of a 76-bill dropdown, a separate "The ask" (saved as the email's first line, an h3,
// so it needs no new column), [bracket] placeholders highlighted and blocked, and a preview of the real email.
// 9/19: (1) unsaved words are never dropped silently: "Not saved yet" sits beside Back / Next, and leaving with
// unsaved edits asks "Save changes?" first (links, the back link, the browser's Back, a reload); (2) on a wide screen
// (1100px and wider) the page is two panes, the steps on the left and the real email on the right, redrawn as you
// type; (3) approving here asks first and has Undo, like review mode. Nothing here sends on its own: the only send is
// the Send button on an approved email, behind a confirm, and the server holds everything while email is paused.
import { S, DB, hooks, esc, fmtDT, advocate, segmentPeople } from './data.js';
import { alertTarget, cleanHTML, htmlToText, textToHtml, escT, billNum, blurb, roomShort, codesOf, diedish, hearingAhead, billById, PUBLIC_APP, plain } from './model.js';
import { ICONS } from '../icons.js';
import { icon, btn, iconBtn, chip, empty, notice, toast, openSheet, closeSheet, confirmSheet, menuSheet, sheetOpen, keysOn } from './ui.js';
import { listById, listIcon, listRows, plural, afterClose, clip, isSide } from './lists.js';

// ---- small helpers shared with the Emails page ----
const first = id => (advocate(id)?.full_name || 'Someone').split(' ')[0];
const orJoin = xs => xs.length <= 1 ? (xs[0] || '') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`;
export const alertById = id => (S.alerts || []).find(a => String(a.id) === String(id));
const segById = id => (S.segments || []).find(x => String(x.id) === String(id));
export const paused = () => S.emailCfg?.enabled === false;
export const pausedNotice = () => paused() ? notice('info', 'mail', 'Email is paused. You can write and approve; nothing sends.', S.me?.is_admin ? btn('Turn it on', { kind: 'text', sm: true, href: '#/setup/email' }) : '') : '';
export const ago = iso => { if (!iso) return ''; const m = (Date.now() - new Date(iso)) / 6e4; return m < 1 ? 'just now' : m < 60 ? `${Math.round(m)} min ago` : m < 24 * 60 ? `${Math.round(m / 60)}h ago` : fmtDT(iso); };
// Who may do what (the same rules as the database's policies and action_alert_step).
export const canEdit = a => !a.id || (['draft', 'returned'].includes(a.status) && a.author_id === S.me?.id);
export const canApprove = a => a.status === 'submitted' && !!S.me?.is_admin && a.author_id !== S.me?.id;   // never your own
export const canSend = a => a.status === 'approved' && (a.author_id === S.me?.id || !!S.me?.is_admin);
const canTest = a => !!a.id && a.status !== 'sent' && (a.author_id === S.me?.id || !!S.me?.is_admin);
const canDelete = a => !!a.id && ['draft', 'returned'].includes(a.status) && (a.author_id === S.me?.id || !!S.me?.is_admin);
const approvers = authorId => S.advocates.filter(x => x.is_admin && x.is_active !== false && x.id !== authorId);
export const approverNames = authorId => orJoin(approvers(authorId).map(x => first(x.id)));
export const STATUS = { draft: ['Draft', 'square-pen'], returned: ['Sent back', 'undo-2'], submitted: ['Waiting for approval', 'hourglass'], approved: ['Approved', 'check'], sent: ['Sent', 'send'] };
export const statusChip = a => { const [w, ic] = STATUS[a.status] || [a.status || 'Draft', 'mail']; return chip(w, '', ic); };

// ---- who it goes to ----
export function audienceOf(a) {
  const b = a.bill_id ? billById(a.bill_id) : null, l = a.list_id ? listById(a.list_id) : null, sg = a.segment_id ? segById(a.segment_id) : null;
  const kind = a.bill_id ? 'bill' : a.list_id ? 'list' : a.segment_id ? 'segment' : '';
  return { b, l, sg, kind, name: kind ? (b ? b.bill_number : l ? l.title : sg ? sg.name : alertTarget(a)) : '', icon: kind === 'bill' ? 'scroll-text' : kind === 'list' ? listIcon(l?.icon) : 'users' };
}
const audKey = a => `${a.bill_id || ''}|${a.list_id || ''}|${a.segment_id || ''}`;
// The live count (DB.alertAudience), fetched once per audience. It paints itself into [data-aud] spans instead of
// re-rendering the page, so a count arriving while someone types never takes the cursor away.
function audN(a) {
  const k = audKey(a); if (k === '||') return undefined;
  S.leAud ??= {};
  if (!(k in S.leAud)) {
    S.leAud[k] = null;
    Promise.resolve().then(() => DB.alertAudience(a.bill_id || null, a.list_id || null, a.segment_id || null))
      .then(n => { S.leAud[k] = Number(n) || 0; paintAud(k); }).catch(() => { S.leAud[k] = -1; paintAud(k); });
  }
  return S.leAud[k];
}
export const audCount = a => { const n = audN(a); return n == null || n < 0 ? null : n; };
const people = n => plural(n, 'person', 'people');
const AUD = {
  goes: (n, u) => n == null ? 'Counting who it goes to…' : n < 0 ? 'Could not count who it goes to right now.'
    : n === 0 ? (u.kind === 'segment' ? 'Goes to no one yet: nobody in this segment has said yes to action alerts.' : 'Goes to no one yet: nobody who follows it has asked for action alerts.')
    : u.kind === 'segment' ? `Goes to ${people(n)} in this segment who said yes to action alerts.` : `Goes to ${people(n)} who asked for action alerts.`,
  to: (n, u) => n == null || n < 0 ? (u.kind === 'segment' ? `People in ${u.name} who said yes to action alerts` : `People who follow ${u.name} and asked for action alerts`)
    : u.kind === 'segment' ? `${people(n)} in ${u.name}` : `${people(n)} who follow ${u.name}`,
  send: n => n == null || n < 0 ? 'Send to the followers' : `Send to ${people(n)}`,
};
export const audHTML = (a, fmt) => `<span data-aud="${esc(audKey(a))}" data-fmt="${fmt}">${esc(AUD[fmt](audN(a), audienceOf(a)))}</span>`;
function paintAud(k) {
  const [bill_id, list_id, segment_id] = k.split('|'), a = { bill_id: bill_id || null, list_id: list_id || null, segment_id: segment_id || null };
  document.querySelectorAll('[data-aud]').forEach(el => { if (el.dataset.aud === k) el.textContent = AUD[el.dataset.fmt](S.leAud[k], audienceOf(a)); });
}

// ---- the email as followers get it (the same parts and words as action_alert_step builds on the server) ----
// Exported for review mode. alert: { subject, body_html | body, bill_id | list_id | segment_id, author_id }.
export function emailPreview(a) {
  const au = advocate(a.author_id) || S.me || {}, u = audienceOf(a);
  let html = cleanHTML(a.body_html || textToHtml(a.body || ''));
  if (a.ask && !/^<h3>/.test(html)) html = `<h3>${escT(a.ask)}</h3>${html}`;       // the sandbox's seeded alert keeps its ask apart
  html = html.replace(/<a href=/g, '<a target="_blank" rel="noopener" href=');     // a link in the preview must not leave the tracker
  const target = u.name || 'the tracker';
  const app = PUBLIC_APP() + (u.b ? '#bill=' + u.b.bill_number : u.l ? '#list=' + u.l.slug : '');
  const why = u.kind === 'segment' ? 'You get this because you asked HIPHI for action alerts' : `You get this because you follow ${target} on the HIPHI Bill Tracker and asked for action alerts`;
  const postal = String(S.emailCfg?.postal || '').trim() || '707 Richards Street, Suite 300, Honolulu, HI 96813';
  return `<article class="le-mail" aria-label="The email as supporters get it">
    <dl class="le-mhead">
      <div><dt>From</dt><dd>${esc(au.full_name || '')} <span class="le-mute">&lt;${esc(au.email || '')}&gt;</span></dd></div>
      <div><dt>To</dt><dd>${!u.kind ? 'Nobody yet' : a.status === 'sent' && a.recipients != null ? esc(AUD.to(a.recipients, u)) : audHTML(a, 'to')}</dd></div>
      <div><dt>Subject</dt><dd class="le-msubj">${esc(a.subject || '(no subject)')}</dd></div>
    </dl>
    <div class="le-mbody">
      <p class="le-meb">HIPHI · action alert · ${esc(target)}</p>
      <div class="le-mtext">${html || '<p class="le-mute">The message is empty.</p>'}</div>
      <p class="le-mcta"><a class="le-mbtn" href="${esc(app)}" target="_blank" rel="noopener">Open ${u.kind === 'segment' ? 'the HIPHI Bill Tracker' : esc(target) + ' on the tracker'}</a></p>
      <p>— ${esc(au.full_name || '')}, Hawaiʻi Public Health Institute</p>
      <p class="le-mfoot">${esc(why)}. <span class="le-mlink">Stop action alerts</span> · <span class="le-mlink">Stop all email</span><br>Hawaiʻi Public Health Institute · ${esc(postal)}</p>
    </div>
  </article>`;
}

// ---- a first draft, written from the bill's hearing, deadline and public ask (as the current app's alertTemplate) ----
const ASK_PH = '[What should they do, and by when?]';
const spaced = num => String(num).replace(/^([A-Z]+)(\d)/, '$1 $2');
const cmtePublic = code => { const cs = codesOf(code).map(c => { const k = S.committees?.[c]; return k ? `${k.chamber === 'S' ? 'Senate' : 'House'} ${k.name}` : c; }); return `the ${orJoin(cs).replace(/ or ([^,]*)$/, ' and $1')} committee${cs.length > 1 ? 's' : ''}`; };
function draftText(u) {
  const who = (S.me?.full_name || 'HIPHI').split(' ')[0];
  const para = xs => textToHtml(xs.join('\n\n'));
  if (u.b) {
    const b = u.b, num = spaced(billNum(b)), s = blurb(b, 160), sum = /[.!?…]$/.test(s) ? s : s + '.';
    const h = S.hearings.filter(x => x.bill_id === b.id && x.status !== 'cancelled' && new Date(x.scheduled_at) > Date.now()).sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at))[0];
    const pub = (b.public_action || '').trim();
    const ask = pub || (h?.testimony_deadline && new Date(h.testimony_deadline) > Date.now() ? `Send written testimony by ${fmtDT(h.testimony_deadline)}.` : h ? `Send written testimony before the hearing on ${fmtDT(h.scheduled_at)}.` : ASK_PH);
    return { subject: h ? `${num}: hearing ${fmtDT(h.scheduled_at)}. Please testify.` : `${num}: can you help?`, ask,
      msg: para(['Aloha,', `You follow ${num}: ${sum}`,
        h ? `It will be heard by ${cmtePublic(h.committee)} on ${fmtDT(h.scheduled_at)}${h.room ? ' in ' + roomShort(h.room) : ''}.${h.testimony_deadline ? ` Written testimony is due ${fmtDT(h.testimony_deadline)}.` : ''}` : '[What is happening, in a sentence or two.]',
        h ? 'Two sentences in your own words are enough. The button below opens the bill with a five-minute way to testify.' : 'The button below opens the bill on the tracker.',
        `Mahalo,\n${who}`]) };
  }
  if (u.l) return { subject: `${u.l.title}: can you help?`, ask: ASK_PH,
    msg: para(['Aloha,', `You follow HIPHI’s ${u.l.title} list.`, '[What is happening, in a sentence or two.]', 'The button below opens the list on the tracker.', `Mahalo,\n${who}`]) };
  return { subject: 'A quick favor from HIPHI', ask: ASK_PH,
    msg: para(['Aloha,', '[What is happening and why it matters, in a few sentences. Say which bill and the deadline.]', `Mahalo,\n${who}`]) };
}
// The ask is the email's first line, stored as an h3 at the top of body_html (no new column): split it back out.
function splitAsk(a) {
  const html = cleanHTML(a.body_html || textToHtml(a.body || '')), m = /^<h3>([\s\S]*?)<\/h3>/.exec(html);
  return m ? { ask: htmlToText(m[1]), msg: html.slice(m[0].length) } : { ask: a.ask || '', msg: html };
}
const joinAsk = (ask, msg) => cleanHTML((String(ask || '').trim() ? `<h3>${escT(ask.trim())}</h3>` : '') + (msg || ''));

// ---- the composer's working copy (kept in S so a re-render, or leaving and coming back, keeps the words) ----
function stateFor(route) {
  const q = route.q || {}, key = route.id ? 'id:' + route.id : `new:${q.bill || ''}|${q.list || ''}|${q.segment || ''}`;
  if (S.leCmp?.key === key) return S.leCmp;
  if (route.id) {
    const src = alertById(route.id); if (!src) return null;
    const { ask, msg } = splitAsk(src);
    return S.leCmp = { key, a: { ...src }, subject: src.subject || '', ask, msg, step: 1, edited: true, dirty: false, savedAt: src.updated_at || src.created_at, q: '' };
  }
  const a = { id: null, bill_id: null, list_id: null, segment_id: null, status: 'draft', author_id: S.me?.id };
  if (q.bill) { const b = billById(q.bill) || S.bills.find(x => x.bill_number === String(q.bill).toUpperCase().replace(/\s/g, '')); if (b) a.bill_id = b.id; }
  else if (q.list) { const l = listById(q.list); if (l) a.list_id = l.id; }
  else if (q.segment) { const sg = segById(q.segment); if (sg) a.segment_id = sg.id; }
  const c = S.leCmp = { key, a, subject: '', ask: '', msg: '', step: 0, edited: false, dirty: false, savedAt: null, q: '', check: audKey(a) !== '||' };
  if (c.check) { fill(c); c.step = 1; }
  return c;
}
function fill(c) { if (c.edited) return; const t = draftText(audienceOf(c.a)); Object.assign(c, { subject: t.subject, ask: t.ask, msg: t.msg }); }
const previewOf = c => ({ ...c.a, subject: c.subject, body_html: joinAsk(c.ask, c.msg), ask: '' });

// Placeholders: [anything in brackets] left from the draft.
const PH = /\[[^[\]\n]{1,300}\]/g;
const phIn = s => (String(s || '').match(PH) || []).length;
const phCount = c => phIn(c.subject) + phIn(c.ask) + phIn(htmlToText(c.msg));
// The first thing to fix before moving on, in the order the plan asks: brackets first, then the current app's rules.
// A saved draft may keep its placeholders ({ brackets: false }); moving on to Preview may not.
function problem(c, { brackets = true } = {}) {
  if (brackets) {
    const at = phIn(c.subject) ? 'subj' : phIn(c.ask) ? 'ask' : phIn(htmlToText(c.msg)) ? 'msg' : '';
    if (at) return [at, 'Replace the text in brackets first.'];
  }
  if (c.subject.trim().length < 3) return ['subj', 'Write a subject.'];
  const html = joinAsk(c.ask, c.msg);
  if (htmlToText(html).length < 20) return ['msg', 'Write at least a couple of sentences.'];
  if (html.length > 40000) return ['msg', 'That is too long for an email. Trim it.'];
  return null;
}
async function save(c) {
  const body_html = joinAsk(c.ask, c.msg);
  const row = { bill_id: c.a.bill_id, list_id: c.a.list_id, segment_id: c.a.segment_id, subject: c.subject.trim(), body: htmlToText(body_html), body_html };
  if (c.a.id) row.id = c.a.id;
  const saved = await DB.saveAlert(row);
  c.a = { ...c.a, ...saved }; c.dirty = false; c.savedAt = new Date().toISOString();
  if (c.key.startsWith('new:')) c.key = 'id:' + saved.id;
  return saved;
}

// ---- the steps ----
const STEPS = ['Who', 'Write', 'Preview', 'Submit'];
const stepBar = step => `<ol class="sv-steps le-steps" aria-label="Steps">${STEPS.map((l, i) => `<li class="${i < step ? 'done' : i === step ? 'cur' : ''}"${i === step ? ' aria-current="step"' : ''}>${i < step ? icon('check') : ''}<span>${l}</span></li>`).join('')}</ol>`;

// A segment's size, when Supporters has loaded (the exact audience is counted once it is picked).
const segSub = s => { if (!S.peopleLoaded) return 'A saved segment of supporters'; try { return `${people(segmentPeople(s.id).length)} in this segment`; } catch { return 'A saved segment of supporters'; } };
function billOk(b) { return b.is_public && b.position !== 'monitor' && !diedish(b) && (S.me?.is_admin || (S.assignments[b.id] || []).includes(S.me?.id)); }
function listOk(l) { return l.is_published && (S.me?.is_admin || l.owner_id === S.me?.id); }
function whoResults(q) {
  const t = plain(q.trim()), tn = t.replace(/\s+/g, ''), has = s => plain(s).includes(t);   // ignores ʻokina and macrons
  let bills = S.bills.filter(billOk);
  if (t) bills = bills.filter(b => b.bill_number.toLowerCase().includes(tn) || has(b.title) || has(b.public_summary) || has(b.description))
    .sort((x, y) => (x.bill_number.toLowerCase().startsWith(tn) ? 0 : 1) - (y.bill_number.toLowerCase().startsWith(tn) ? 0 : 1) || (x.priority || 9) - (y.priority || 9) || x.bill_number.localeCompare(y.bill_number, 'en', { numeric: true }));
  else bills = bills.map(b => ({ b, h: hearingAhead(b) })).filter(x => x.h).sort((x, y) => x.h.scheduled_at.localeCompare(y.h.scheduled_at)).map(x => x.b);
  const lists = (S.lists || []).filter(l => listOk(l) && (!t || has(l.title) || has(l.description)));
  const segs = (S.segments || []).filter(s => !t || has(s.name));
  const opt = (v, lead, title, sub) => `<button type="button" class="row le-opt" data-pick="${esc(v)}"><span class="lead">${icon(lead)}</span><span class="body"><span class="title">${title}</span>${sub ? `<span class="sub">${sub}</span>` : ''}</span>${icon('chevron-right', { cls: 'chev' })}</button>`;
  const grp = (title, rows) => rows.length ? `<div class="le-rgroup"><h3 class="le-rh">${title}</h3><div class="rows">${rows.join('')}</div></div>` : '';
  // A bill leads with its number and nickname (bold); the line under it says when it is heard, which is why it is here.
  const bRows = bills.slice(0, t ? 8 : 6).map(b => { const h = hearingAhead(b); return opt('b:' + b.id, 'scroll-text', b.nickname ? `<b>${esc(billNum(b))}</b> <b>${esc(b.nickname)}</b>` : `<b>${esc(billNum(b))}</b> <span class="le-t">${esc(clip(b, 70))}</span>`, h ? `Hearing ${esc(fmtDT(h.scheduled_at))} · ${esc(h.committee)}` : 'No hearing yet'); });
  const out = grp(t ? 'Bills' : 'Bills with a hearing coming up', bRows)
    + grp('Lists', lists.map(l => opt('l:' + l.id, listIcon(l.icon), esc(l.title), `${plural(listRows(l).length, 'bill')} · ${plural(S.listFollowers?.[l.id] || 0, 'follower')}`)))
    + grp('Saved segments', segs.map(s => opt('s:' + s.id, 'users', esc(s.name), segSub(s))));
  if (out) return out;
  return `<p class="le-none">${t ? `Nothing matches “${esc(q.trim())}”.` : 'Nothing to pick yet.'} ${S.me?.is_admin ? 'Bills need to be public, alive and have a position; lists need to be live.' : 'You can write to the followers of bills you own and lists you curate, and to any saved segment.'}</p>`;
}
function whoStep(c) {
  const u = audienceOf(c.a);
  if (u.kind) {
    const locked = !!c.a.id;
    const title = u.b ? (u.b.nickname ? `<b>${esc(billNum(u.b))}</b> <b>${esc(u.b.nickname)}</b><span class="le-whosum">${esc(clip(u.b, 120))}</span>` : `<b>${esc(billNum(u.b))}</b> <span class="le-t">${esc(clip(u.b, 90))}</span>`) : esc(u.name);
    const warn = u.l && !u.l.is_published ? notice('info', 'eye-off', 'This list is a draft. Publish it first; only a live list has followers.') : u.b && !u.b.is_public ? notice('info', 'eye-off', 'This bill is not public, so nobody can follow it yet.') : '';
    return `<h2 class="le-sh">Who gets it?</h2>
      <div class="card le-who">
        <span class="lead">${icon(u.icon)}</span>
        <div class="le-whob"><p class="le-whot">${title}</p><p class="le-aud">${icon('users')}${audHTML(c.a, 'goes')}</p></div>
        ${locked ? '' : btn('Change', { kind: 'text', attrs: { 'data-le': 'whoclear', 'aria-label': 'Change who it goes to' } })}
      </div>${warn}
      ${locked ? '<p class="meta le-lockn">Who it goes to is set once the draft is saved. To write to someone else, start a new email.</p>' : ''}`;
  }
  return `<h2 class="le-sh">Who gets it?</h2>
    <p class="le-lede">Pick a bill, a list or a saved segment. Only people who asked for action alerts get it.</p>
    <div class="le-search le-whosearch">${icon('search')}<label class="sr" for="le-whoq">Find a bill, list or segment</label><input id="le-whoq" type="search" placeholder="Find a bill, list or segment" value="${esc(c.q)}" autocomplete="off" enterkeyhint="search" aria-controls="le-whores" aria-describedby="le-who-err"></div>
    <div id="le-who-err" role="alert"></div>
    <div id="le-whores">${whoResults(c.q)}</div>`;
}

// The rich-text box: the current app's editor (app.js rteHTML / wireRTE) with icons, 44px buttons and a sheet for
// links instead of window.prompt. Toolbar icons fall back to letters until icons.js has bold/italic/etc.
const tb = (cmd, label, face) => `<button type="button" data-rte="${cmd}" aria-label="${label}" title="${label}">${face}</button>`;
const face = (name, txt) => ICONS[name] ? icon(name) : txt;
function writeStep(c) {
  const u = audienceOf(c.a), me = S.me || {};
  const where = u.kind === 'bill' ? u.name : u.kind === 'list' ? 'the list' : 'the tracker';
  const n = phCount(c);
  return `<h2 class="le-sh">Write it</h2>
    <p class="le-tofrom"><span>${icon(u.icon)}<span>To ${audHTML(c.a, 'to')}</span></span><span>${icon('user-round')}<span>From ${esc(me.full_name || '')}. Replies come to you.</span></span></p>
    <div class="field"><label for="le-subj">Subject</label><textarea id="le-subj" class="le-grow" rows="1" maxlength="150" aria-describedby="le-subj-err">${esc(c.subject)}</textarea><div id="le-subj-err" role="alert"></div></div>
    <div class="field"><label for="le-ask">The ask</label><textarea id="le-ask" class="le-grow" rows="1" maxlength="200" aria-describedby="le-ask-h le-ask-err">${esc(c.ask)}</textarea><span class="help" id="le-ask-h">One sentence: what to do, and by when. It is the first line of the email.</span><div id="le-ask-err" role="alert"></div></div>
    <div class="field le-msgf"><span class="label" id="le-msg-l">Message</span>
      <div class="le-rte">
        <div class="le-rtebar" role="toolbar" aria-label="Formatting" aria-controls="le-msg">
          ${tb('bold', 'Bold', face('bold', '<b>B</b>'))}${tb('italic', 'Italic', face('italic', '<i>I</i>'))}${tb('underline', 'Underline', face('underline', '<u>U</u>'))}<span class="le-sep" aria-hidden="true"></span>
          ${tb('link', 'Link', icon('link'))}${tb('insertUnorderedList', 'Bulleted list', icon('list'))}${tb('insertOrderedList', 'Numbered list', face('list-ordered', '<span class="le-tbt">1.</span>'))}${tb('heading', 'Small heading', face('heading', '<b>H</b>'))}<span class="le-sep" aria-hidden="true"></span>
          ${tb('removeFormat', 'Clear formatting', face('remove-formatting', '<span class="le-tbt">Clear</span>'))}
        </div>
        <div class="le-ed" id="le-msg" contenteditable="true" role="textbox" aria-multiline="true" aria-labelledby="le-msg-l" aria-describedby="le-msg-h le-msg-err" spellcheck="true">${cleanHTML(c.msg)}</div>
      </div>
      <span class="help" id="le-msg-h">The email adds a button to ${esc(where)}, your name and the unsubscribe footer. Select words and tap Link to link them.</span>
      <div id="le-msg-err" role="alert"></div>
    </div>
    <p class="le-ph" id="le-ph" aria-live="polite">${phLine(n)}</p>
    ${isSide() ? '' : `<div class="le-savebar"><span class="le-savest" data-savestate aria-live="polite">${saveState(c)}</span>${btn('Save draft', { kind: 'text', icon: 'check', attrs: { 'data-le': 'save' } })}</div>`}`;
}
const phLine = n => n ? `${icon('square-pen')}<span>${n === 1 ? 'One bit' : `${n} bits`} of text in brackets to replace.</span>` : '';
// Where the words stand, shown beside the save / next control on every step (and redrawn as you type): "Not saved
// yet" while there is anything the server does not have, else when the draft was last saved.
const hasUnsaved = c => !!c && (c.dirty || (!c.a.id && audKey(c.a) !== '||'));
const saveState = c => hasUnsaved(c) ? `<span class="le-unsaved">${icon('circle-dot')}Not saved yet</span>` : c.a.id ? `<span class="le-savedok">${icon('check')}Draft saved ${esc(ago(c.savedAt))}</span>` : '';
const paintSaveState = c => document.querySelectorAll('[data-savestate]').forEach(el => { el.innerHTML = saveState(c); });

// The hearing this email is about has a written-testimony deadline that is already behind us: the first draft (and
// anything written earlier) may ask for something nobody can do any more. Said on Write and on Check it.
function lateNotice(c) {
  const b = c.a.bill_id ? billById(c.a.bill_id) : null; if (!b) return '';
  const h = S.hearings.filter(x => x.bill_id === b.id && x.status !== 'cancelled' && new Date(x.scheduled_at) > Date.now()).sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at))[0];
  if (!h?.testimony_deadline || new Date(h.testimony_deadline) > Date.now()) return '';
  return notice('info', 'triangle-alert', `The deadline for written testimony on this hearing has passed (${esc(fmtDT(h.testimony_deadline))}). Check what the email asks people to do.`);
}
function previewStep(c, two) {
  const a = previewOf(c), test = canTest(c.a) ? btn('Send me a test', { kind: 'secondary', sm: true, icon: 'mail-check', attrs: { 'data-le': 'test' } }) : '';
  // Two panes: the email is already on the right, so this step is the short list of things to look at.
  if (two) return `<h2 class="le-sh">Check it</h2>
    <p class="le-lede">Read the email on the right the way a supporter will. Links open in a new tab.</p>
    ${lateNotice(c)}
    <ul class="le-checks">
      <li>${icon('users')}<span>${audHTML(c.a, 'goes')}</span></li>
      <li>${icon('user-round')}<span>It comes from ${esc(S.me?.full_name || 'you')}, and replies come to you.</span></li>
      <li>${icon('check')}<span>No text in brackets is left.</span></li>
    </ul>
    ${test ? `<div class="le-testrow">${test}<span class="meta">${paused() ? 'Email is paused, so a test will not go out.' : `It goes only to ${esc(S.me?.email || 'you')}.`}</span></div>` : ''}`;
  return `<h2 class="le-sh">Check it</h2>
    ${lateNotice(c)}
    <div class="le-prevtop"><p class="le-aud">${icon('users')}${audHTML(c.a, 'goes')}</p>${test}</div>
    ${emailPreview(a)}`;
}
// The last step says plainly what the button does and does not do: it sends nothing to supporters.
function submitStep(c) {
  const me = S.me || {}, others = approvers(me.id), names = orJoin(others.map(x => first(x.id)));
  return `<h2 class="le-sh">Send it for approval</h2>
    <p class="le-nosend">${icon('shield-check')}<span><b>Nothing goes to supporters when you press the button.</b> ${others.length ? `${esc(names)} (an admin other than you) has to approve it first.` : 'An admin other than you has to approve it first.'}</span></p>
    <div class="card le-sum"><dl class="le-dl">
      <div><dt>To</dt><dd>${audHTML(c.a, 'to')}</dd></div>
      <div><dt>From</dt><dd>${esc(me.full_name || '')} <span class="le-mute">&lt;${esc(me.email || '')}&gt;</span></dd></div>
      <div><dt>Subject</dt><dd class="strong">${esc(c.subject)}</dd></div>
    </dl></div>
    <h3 class="le-flowh">What happens next</h3>
    <ol class="le-flow">
      <li><span class="le-fn">1</span><span>You send it for approval.${others.length ? ` ${esc(names)} ${others.length === 1 ? 'gets' : 'get'} a Slack message right away.` : ''}</span></li>
      <li><span class="le-fn">2</span><span>${others.length ? esc(names) : 'Another admin'} reads it, then approves it or sends it back to you with a note.</span></li>
      <li><span class="le-fn">3</span><span>Once it is approved, you come back here and press Send. Only then does it go out.</span></li>
    </ol>
    ${paused() ? notice('info', 'mail', '<b>Email is paused.</b> You can send this for approval and it can be approved, but nothing goes out until an admin turns email back on.') : ''}
    ${others.length ? '' : notice('info', 'info', 'You are the only admin, so nobody can approve it yet. Every email needs an admin other than its writer.')}`;
}

// ---- where an email stands, once it is out of the writer's hands (or someone else's draft) ----
function statusView(a) {
  const me = S.me || {}, own = a.author_id === me.id, who = first(a.author_id), appr = approverNames(a.author_id) || 'another admin';
  let line = '';
  if (a.status === 'submitted') line = canApprove(a) ? `${esc(who)} sent it ${esc(ago(a.submitted_at || a.updated_at || a.created_at))}.`
    : own ? `Waiting for ${esc(appr)} to approve it.${me.is_admin ? ' You cannot approve your own email.' : ''}` : `Waiting for ${esc(appr)} to approve ${esc(who)}’s email.`;
  else if (a.status === 'approved') line = `${a.approved_by ? `${a.approved_by === me.id ? 'You' : esc(first(a.approved_by))} approved it. ` : ''}${own ? 'Send it when you are ready.' : me.is_admin ? `It is ${esc(who)}’s to send; an admin can send it too.` : `Waiting for ${esc(who)} to send it.`}`;
  else if (a.status === 'sent') line = `Sent ${esc(fmtDT(a.sent_at))} to ${people(a.recipients || 0)}.`;
  else if (a.status === 'returned') line = `Sent back to ${esc(who)}. Only ${esc(who)} can change it.`;
  else line = `${esc(who)} is still writing it. Only ${esc(who)} can change it.`;
  const stats = a.status === 'sent' ? `<p class="le-stats">${[`${a.opens || 0} opened`, `${a.clicks || 0} clicked`, `${a.bounces || 0} bounced`].map(s => `<span>${s}</span>`).join('')}</p>` : '';
  const more = canDelete(a) ? iconBtn('ellipsis', 'More for this email', { 'data-le': 'more', 'aria-haspopup': 'dialog' }, 'le-hmore') : '';
  const two = isSide(), acts = two ? statusActions(a) : '';
  const head = `<a class="le-deskback" href="#/outreach/emails" data-back>${icon('chevron-left')}<span>Emails</span></a>
    <div class="le-chead"><div><p class="le-eyebrow">${icon('mail')}Email to supporters</p><h1>${esc(a.subject || '(no subject)')}</h1></div>${more}</div>
    ${pausedNotice()}`;
  const state = `<section class="card le-state" aria-label="Where it stands">
      <p class="le-stline">${icon((STATUS[a.status] || STATUS.draft)[1])}<span><b>${esc((STATUS[a.status] || STATUS.draft)[0])}.</b> ${line}</span></p>
      ${a.review_note && a.status === 'returned' ? `<blockquote class="le-quote">${esc(a.review_note)}</blockquote>` : ''}
      ${stats}
      ${canTest(a) ? btn('Send me a test', { kind: 'text', icon: 'mail-check', attrs: { 'data-le': 'test' } }) : ''}
    </section>`;
  // Wide screens: where it stands and what you can do about it on the left, the email itself on the right.
  if (two) return `<div class="le-cmp le-status le-two">${head}
    <div class="sv-cols le-panes">
      <div class="le-form">${state}
        ${canApprove(a) ? `<p class="le-rule">${icon('user-check')}<span>Approving sends nothing. ${esc(who)} presses Send afterwards${paused() ? ', and email is paused, so nothing goes out until an admin turns it back on' : ''}.</span></p>` : ''}
        ${acts ? `<div class="le-formbar">${acts}</div>` : ''}
      </div>
      <aside class="sv-aside le-prevpane" aria-label="The email">${emailPreview(a)}</aside>
    </div></div>`;
  return `<div class="le-cmp le-status">${head}${state}
    ${emailPreview(a)}
  </div>`;
}
// What the viewer can do with an email that is out of its writer's hands: approve or send back (another admin), or
// send (the writer or an admin, once approved). In the frame's bar on phones, under the status card on wide screens.
function statusActions(a) {
  if (canApprove(a)) return `${btn('Send back', { kind: 'secondary', icon: 'undo-2', attrs: { 'data-le': 'return' } })}${btn('Approve', { icon: 'check', attrs: { 'data-le': 'approve' } })}`;
  // Send is the writer's step. An admin looking at someone else's approved email can send it too, but for them it is
  // not the page's main button (it appears where Approve was a moment ago), and it always asks first.
  if (canSend(a)) return btn(audHTML(a, 'send'), { kind: a.author_id === S.me?.id ? 'primary' : 'secondary', icon: 'send', attrs: { 'data-le': 'send' } });
  return '';
}

// ---- render ----
function render(route) {
  if (!S.me) return empty({ title: 'No staff record yet', text: 'Ask your admin to add you.' });
  const fresh = document.body.dataset.screen !== 'composer';   // the frame sets data-screen after render
  if (route.id) {
    const src = alertById(route.id);
    if (!src) return `<div class="le-cmp">${empty({ h: 'h1', title: 'This email is not here', text: 'It may have been deleted, or the link is old.', action: btn('See all emails', { href: '#/outreach/emails' }) })}</div>`;
    if (!canEdit(src)) return statusView(src);
    if (S.leCmp?.key === 'id:' + route.id && S.leCmp.a.status !== src.status) S.leCmp = null;   // it moved on elsewhere
  }
  const c = stateFor(route);
  const back = S.leCmp?.key?.startsWith('new:') && fresh && c.edited;
  const title = c.a.status === 'returned' ? 'Fix the email' : 'New email';
  const menu = c.a.id || c.edited ? iconBtn('ellipsis', 'More for this email', { 'data-le': 'more', 'aria-haspopup': 'dialog' }, 'le-hmore') : '';
  const two = isSide();
  const body = [whoStep, writeStep, previewStep, submitStep][c.step](c, two);
  const top = `<a class="le-deskback" href="#/outreach/emails" data-back>${icon('chevron-left')}<span>Emails</span></a>
    <div class="le-chead"><h1>${title}</h1>${menu}</div>
    ${pausedNotice()}
    ${back ? notice('info', 'history', 'You are back where you left off.', btn('Start over', { kind: 'text', sm: true, attrs: { 'data-le': 'restart' } })) : ''}
    ${c.a.status === 'returned' && c.a.review_note ? `<div class="le-back">${icon('undo-2')}<div><p class="strong">Sent back with a note</p><blockquote class="le-quote">${esc(c.a.review_note)}</blockquote></div></div>` : ''}`;
  // Wide screens: two panes. The steps on the left, with Back / Next right under the form (sized to their labels, and
  // pinned to the bottom of the window while the form is taller than it). On the right the email as supporters will
  // get it, redrawn as you type, which stays in view (.sv-cols + .sv-aside in staff.css).
  if (two) return `<div class="le-cmp le-two">${top}
    <div class="sv-cols le-panes">
      <div class="le-form">${stepBar(c.step)}
        <section class="le-step">${c.step === 1 ? lateNotice(c) : ''}${body}</section>
        <div class="le-formbar">${stepButtons(c)}<span class="le-savest" data-savestate aria-live="polite">${saveState(c)}</span>${c.step === 1 ? btn('Save draft', { kind: 'text', sm: true, icon: 'check', attrs: { 'data-le': 'save', title: 'Save draft (Ctrl+S or Cmd+S)' } }) : ''}</div>
      </div>
      <aside class="sv-aside le-prevpane" aria-label="Preview of the email">
        <div class="le-prevhead"><h2>Preview</h2><span class="meta">The email as supporters get it</span></div>
        <div id="le-live">${livePreview(c)}</div>
      </aside>
    </div></div>`;
  return `<div class="le-cmp">${top}
    ${stepBar(c.step)}
    <section class="le-step">${c.step === 1 ? lateNotice(c) : ''}${body}</section>
  </div>`;
}
const livePreview = c => audKey(c.a) === '||' ? `<div class="le-noprev">${icon('mail')}<p>Pick who it goes to, and the email shows here as you write it.</p></div>` : emailPreview(previewOf(c));
function stepButtons(c) {
  const backB = c.step > 0 ? btn('Back', { kind: 'secondary', icon: 'chevron-left', attrs: { 'data-le': 'back' } }) : '';
  const nextB = c.step < 3 ? btn('Next', { iconEnd: 'chevron-right', attrs: { 'data-le': 'next' } }) : btn('Send for approval', { icon: 'send', attrs: { 'data-le': 'submit' } });
  return backB + nextB;
}
// The frame's action bar: phones and narrow windows. (In two panes the same buttons sit under the form instead.)
function bar(route) {
  if (!S.me || isSide()) return '';
  if (route.id) {
    const a = alertById(route.id); if (!a) return '';
    if (!canEdit(a)) { const acts = statusActions(a); return acts ? `<div class="le-bar">${acts}</div>` : ''; }
  }
  const c = S.leCmp; if (!c) return '';
  return `<div class="le-bar"><span class="le-savest le-barstate" data-savestate aria-live="polite">${saveState(c)}</span>${stepButtons(c)}</div>`;
}

// ---- actions ----
const redraw = () => { hooks.render(); window.scrollTo(0, 0); };
function busy(el, on) { if (!el) return; if (on) { el.setAttribute('aria-busy', 'true'); el.disabled = true; } else if (el.isConnected) { el.removeAttribute('aria-busy'); el.disabled = false; } }
function showProblem(root, [field, msg]) {
  const box = root.querySelector(`#le-${field}-err`); if (!box) { toast(msg, { err: true }); return; }
  box.innerHTML = `<span class="err">${icon('circle-alert')}${esc(msg)}</span>`;
  const el = root.querySelector(`#le-${field}`); el?.setAttribute('aria-invalid', 'true');
  // Put the cursor on the first placeholder so typing replaces it.
  if (/brackets/.test(msg)) {
    if (field === 'msg') { selectFirstPH(el); return; }
    const m = new RegExp(PH.source).exec(el.value); el.focus(); if (m) el.setSelectionRange(m.index, m.index + m[0].length);
  } else el?.focus();
  el?.scrollIntoView({ block: 'center' });
}
function selectFirstPH(ed) {
  const w = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) {
    const m = new RegExp(PH.source).exec(n.nodeValue);
    if (m) { ed.focus(); const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length); const s = getSelection(); s.removeAllRanges(); s.addRange(r); n.parentElement.scrollIntoView({ block: 'center' }); return; }
  }
  ed.focus(); ed.scrollIntoView({ block: 'center' });
}
// Leftover [brackets] are tinted in the editor and, on wide screens, in the live preview beside it.
function paintPH(ed) {
  if (!(window.CSS && CSS.highlights && typeof Highlight === 'function')) return;
  const ranges = [];
  for (const box of [ed, document.querySelector('#le-live .le-msubj'), document.querySelector('#le-live .le-mtext')]) {
    if (!box) continue;
    const w = document.createTreeWalker(box, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) { const re = new RegExp(PH.source, 'g'); let m; while ((m = re.exec(n.nodeValue))) { const r = new Range(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length); ranges.push(r); } }
  }
  CSS.highlights.set('le-ph', new Highlight(...ranges));
}
// The live preview (wide screens): redrawn a moment after typing stops, never touching the field being typed in.
let liveT = 0;
function paintLive(c, now = false) {
  const box = document.getElementById('le-live'); if (!box) return;
  clearTimeout(liveT);
  const draw = () => { const el = document.getElementById('le-live'); if (!el || S.leCmp !== c) return; const y = el.closest('.sv-aside')?.scrollTop; el.innerHTML = livePreview(c); if (y != null) el.closest('.sv-aside').scrollTop = y; paintPH(document.getElementById('le-msg')); };
  if (now) draw(); else liveT = setTimeout(draw, 150);
}

// Links: a sheet asks for the address; the selection is kept and put back before the link is made.
function linkSheet(ed) {
  const sel = getSelection(), range = sel.rangeCount && ed.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
  const node = range?.startContainer, a = node && (node.nodeType === 1 ? node : node.parentElement)?.closest('a');
  const inEd = a && ed.contains(a) ? a : null;
  openSheet({ title: inEd ? 'Change the link' : 'Add a link', size: 'auto',
    body: `<div class="le-sheet"><div class="field"><label for="le-url">Web address</label><input id="le-url" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(inEd ? inEd.getAttribute('href') : '')}" placeholder="https://" aria-describedby="le-url-h"><span class="help" id="le-url-h">${inEd ? 'Leave it empty to take the link off.' : range && !range.collapsed ? 'The words you selected become the link.' : 'The address goes where the cursor was.'}</span></div></div>`,
    foot: `${inEd ? btn('Remove link', { kind: 'text', attrs: { 'data-lrm': '1' } }) : ''}${btn(inEd ? 'Save link' : 'Add link', { icon: 'link', attrs: { 'data-lok': '1' } })}`,
    wire: d => {
      const inp = d.querySelector('#le-url'); inp.focus();
      const restore = () => { ed.focus(); if (range) { const s = getSelection(); s.removeAllRanges(); s.addRange(range); } };
      const apply = raw => {
        let u = String(raw || '').trim();
        if (u && !/^(https?:\/\/|mailto:)/i.test(u)) u = (u.includes('@') && !u.includes('/') ? 'mailto:' : 'https://') + u;
        closeSheet({ silent: true }); restore();
        if (inEd) { if (!u || u === 'https://') inEd.replaceWith(document.createTextNode(inEd.textContent)); else inEd.setAttribute('href', u); }
        else if (u && u !== 'https://') { if (!range || range.collapsed) document.execCommand('insertHTML', false, `<a href="${escT(u).replace(/"/g, '&quot;')}">${escT(u)}</a>&nbsp;`); else document.execCommand('createLink', false, u); }
        ed.dispatchEvent(new Event('input', { bubbles: true }));
      };
      d.querySelector('[data-lok]').onclick = () => apply(inp.value);
      d.querySelector('[data-lrm]')?.addEventListener('click', () => apply(''));
      inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); apply(inp.value); } };
    } });
}
function wireRTE(root, c) {
  const ed = root.querySelector('#le-msg'); if (!ed) return;
  try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch { /* older browsers */ }
  const run = cmd => {
    ed.focus();
    if (cmd === 'link') return linkSheet(ed);
    if (cmd === 'heading') { const blk = getSelection()?.anchorNode; const el = blk && (blk.nodeType === 1 ? blk : blk.parentElement)?.closest('h3'); document.execCommand('formatBlock', false, el ? 'p' : 'h3'); }
    else document.execCommand(cmd, false, null);
    ed.dispatchEvent(new Event('input', { bubbles: true }));
  };
  root.querySelectorAll('[data-rte]').forEach(b => {
    b.onmousedown = e => e.preventDefault();                         // keep the selection in the editor
    b.onclick = () => run(b.dataset.rte);
    b.addEventListener('touchend', e => { e.preventDefault(); run(b.dataset.rte); });
  });
  ed.addEventListener('keydown', e => { if (keysOn() && (e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); run('link'); } });   // Ctrl/Cmd+K: link, as in any editor
  ed.addEventListener('paste', e => {
    e.preventDefault();
    const h = e.clipboardData.getData('text/html'), t = e.clipboardData.getData('text/plain').trim();
    if (h) document.execCommand('insertHTML', false, cleanHTML(h));
    else if (/^https?:\/\/\S+$/.test(t)) document.execCommand('insertHTML', false, `<a href="${escT(t).replace(/"/g, '&quot;')}">${escT(t)}</a>`);
    else document.execCommand('insertText', false, t);
  });
  ed.addEventListener('click', e => { const a = e.target.closest('a'); if (a && (e.metaKey || e.ctrlKey)) { e.preventDefault(); window.open(a.href, '_blank', 'noopener'); } });
  const changed = () => {
    c.msg = ed.innerHTML; c.dirty = true; c.edited = true; paintPH(ed);
    root.querySelector('#le-ph').innerHTML = phLine(phCount(c)); paintSaveState(c); paintLive(c);
    const err = root.querySelector('#le-msg-err'); if (err.innerHTML) { err.innerHTML = ''; ed.removeAttribute('aria-invalid'); }
  };
  ed.addEventListener('input', changed);
  paintPH(ed);
}

async function pick(root, c, v) {
  const [k, id] = [v.slice(0, 1), v.slice(2)];
  const next = { bill_id: k === 'b' ? id : null, list_id: k === 'l' ? id : null, segment_id: k === 's' ? id : null };
  let ok = true; try { ok = await DB.canAlert(next.bill_id, next.list_id, next.segment_id); } catch { ok = true; }   // the server checks again on save
  if (!ok) { root.querySelector('#le-who-err').innerHTML = `<p class="inlinemsg">${icon('circle-alert')}<span>Only an admin or its owner can email these followers.</span></p>`; return; }
  Object.assign(c.a, next); fill(c); redraw();
}
async function step(root, c, to) {
  if (to > c.step) {
    if (c.step === 0 && audKey(c.a) === '||') { root.querySelector('#le-who-err').innerHTML = `<p class="inlinemsg">${icon('circle-alert')}<span>Pick who it goes to first.</span></p>`; root.querySelector('#le-whoq')?.focus(); return; }
    if (c.step === 1) {
      const p = problem(c); if (p) { showProblem(root, p); return; }
      if (c.dirty || !c.a.id) {
        const el = root.querySelector('[data-le="next"]'); busy(el, true);
        try { await save(c); } catch (e) { busy(el, false); toast(e, { err: true }); return; }
      }
    }
  }
  c.step = to;
  // A new draft that was just saved gets its own address, so a reload or a link comes back to it.
  if (c.a.id && S.route?.id !== String(c.a.id)) S.go('#/email/' + c.a.id, { replace: true }); else redraw();
}
async function submit(root, c) {
  const p = problem(c); if (p) { c.step = 1; redraw(); showProblem(document.getElementById('app'), p); return; }
  const el = root.querySelector('[data-le="submit"]'); busy(el, true);
  try {
    if (c.dirty || !c.a.id) await save(c);
    await DB.alertStep(c.a.id, 'submit');
    const id = c.a.id, to = approverNames(S.me?.id);
    S.leCmp = null; S.go('#/email/' + id, { replace: true });
    toast(to ? `Sent to ${to} for approval.` : 'Sent for approval.', { ok: true });
  } catch (e) { busy(el, false); toast(e, { err: true }); }
}
function returnSheet(a) {
  const to = first(a.author_id);
  openSheet({ title: 'What should change?', size: 'auto',
    body: `<div class="le-sheet"><div class="field"><textarea id="le-rnote" rows="4" aria-labelledby="sv-sh-t" aria-describedby="le-rnote-h" required></textarea><span class="help" id="le-rnote-h">${esc(to)} sees this note with the email.</span><div id="le-rnote-e" role="alert"></div></div></div>`,
    foot: btn(`Send back to ${esc(to)}`, { icon: 'undo-2', attrs: { 'data-rgo': '1' } }),
    wire: d => {
      const ta = d.querySelector('#le-rnote'), go = d.querySelector('[data-rgo]'); ta.focus();
      ta.oninput = () => { ta.removeAttribute('aria-invalid'); d.querySelector('#le-rnote-e').innerHTML = ''; };
      go.onclick = async () => {
        const note = ta.value.trim();
        if (!note) { ta.setAttribute('aria-invalid', 'true'); d.querySelector('#le-rnote-e').innerHTML = `<span class="err">${icon('circle-alert')}Write what should change first.</span>`; ta.focus(); return; }
        busy(go, true);
        try { await DB.alertStep(a.id, 'return', note); closeSheet({ silent: true }); hooks.render(); toast(`Sent back to ${to} with your note.`); }
        catch (e) { busy(go, false); toast(e, { err: true }); }
      };
    } });
}
async function sendNow(el, a) {
  const n = audCount(a), au = advocate(a.author_id);
  const ok = await confirmSheet({ title: n != null ? `Send to ${people(n)}?` : 'Send to the followers?', ok: 'Send',
    text: `${esc(a.subject)}<br><span class="small muted">It goes out from ${esc(au?.email || 'the writer’s address')} and cannot be taken back.${paused() ? ' Email is paused, so nothing leaves until an admin turns it back on.' : ''}</span>` });
  if (!ok) return;
  await afterClose();
  busy(el, true);
  try { const r = await DB.alertStep(a.id, 'send'); hooks.render(); toast(`Sent to ${people(r?.recipients ?? n ?? 0)}.`, { ok: true }); }
  catch (e) { busy(el, false); toast(e, { err: true }); }
}
async function test(el, a) {
  busy(el, true);
  try { await DB.alertStep(a.id, 'test'); toast(paused() ? 'Email is paused, so the test will not go out.' : `Test on its way to ${S.me?.email || 'you'}.`, { ok: !paused() }); }
  catch (e) { toast(e, { err: true }); }
  busy(el, false);
}
function moreMenu(c, a) {
  const items = [];
  if (c && c.edited && !c.a.id) items.push({ label: 'Start over', icon: 'rotate-ccw', sub: 'Clears this unsaved email', run: () => { S.leCmp = null; redraw(); } });
  if (a && canDelete(a)) items.push({ label: 'Delete this draft', icon: 'trash-2', danger: true, run: async () => {
    await afterClose();
    const ok = await confirmSheet({ title: 'Delete this draft?', text: 'It is gone for good. Nothing was sent.', ok: 'Delete draft', danger: true });
    if (!ok) return; await afterClose();
    try { await DB.deleteAlert(a.id); S.leCmp = null; S.go('#/outreach/emails', { replace: true }); toast('Draft deleted.'); } catch (e) { toast(e, { err: true }); }
  } });
  if (items.length) menuSheet({ title: 'This email', items });
}
async function saveNow(root, c) {
  const el = root.querySelector('[data-le="save"]');
  const p = problem(c, { brackets: false }); if (p) { showProblem(root, p); return; }
  busy(el, true);
  try { const wasNew = !c.a.id; await save(c); toast('Draft saved.', { ok: true }); if (wasNew) S.go('#/email/' + c.a.id, { replace: true, keepScroll: true }); else { busy(el, false); paintSaveState(c); } }
  catch (e) { busy(el, false); toast(e, { err: true }); }
}

function wire(route, root) {
  const on = (sel, fn) => root.querySelectorAll(sel).forEach(el => el.addEventListener('click', e => fn(e.currentTarget)));
  if (window.CSS?.highlights) CSS.highlights.delete('le-ph');
  const src = route.id ? alertById(route.id) : null;
  if (src && !canEdit(src)) {
    // Approve is guarded the way review mode guards it: it asks first, with the number of people, and the toast has
    // Undo for ten seconds (the server steps it back to "waiting for approval"). Approving sends nothing.
    on('[data-le="approve"]', async el => {
      if (!canApprove(src)) return;
      const n = audCount(src), who = first(src.author_id);
      const yes = await confirmSheet({ title: n != null ? `Approve this email to ${people(n)}?` : 'Approve this email to supporters?', ok: 'Approve',
        text: `“${esc(src.subject || '(no subject)')}”. Approving sends nothing: ${esc(who)} can send it once you approve.${paused() ? ' Email is paused, so nothing goes out until an admin turns it back on.' : ''}` });
      if (!yes) return;
      el = document.querySelector('[data-le="approve"]') || el; busy(el, true);
      try {
        await DB.alertStep(src.id, 'approve'); hooks.render();
        toast(`Approved. ${who} can send it now.`, { ok: true, undo: async () => { await DB.alertStep(src.id, 'unapprove'); hooks.render(); toast('Approval undone. It is waiting for approval again.'); } });
      } catch (e) { busy(el, false); toast(e, { err: true }); }
    });
    on('[data-le="return"]', () => canApprove(src) && returnSheet(src));
    on('[data-le="send"]', el => canSend(src) && sendNow(el, src));
    on('[data-le="test"]', el => test(el, src));
    on('[data-le="more"]', () => moreMenu(null, src));
    return;
  }
  const c = S.leCmp; if (!c) return;
  c.hash = location.hash; c.depth = history.state?.d || 0;   // where this composer sits in history (the leave guard below)
  on('[data-le="more"]', () => moreMenu(c, c.a.id ? c.a : null));
  on('[data-le="restart"]', () => { S.leCmp = null; redraw(); });
  on('[data-le="back"]', () => { c.step = Math.max(0, c.step - 1); redraw(); });
  on('[data-le="next"]', () => step(root, c, c.step + 1));
  on('[data-le="submit"]', () => submit(root, c));
  on('[data-le="test"]', el => test(el, c.a));
  on('[data-le="save"]', () => saveNow(root, c));

  // A bill, list or segment handed over in the link: check once that this person may write to it.
  if (c.check) {
    c.check = false;
    DB.canAlert(c.a.bill_id, c.a.list_id, c.a.segment_id).then(ok => { if (ok) return; Object.assign(c.a, { bill_id: null, list_id: null, segment_id: null }); c.step = 0; redraw(); toast('Only an admin or its owner can email those followers. Pick who it goes to.', { err: true }); }).catch(() => {});
  }
  if (c.step === 0) {
    on('[data-le="whoclear"]', () => { Object.assign(c.a, { bill_id: null, list_id: null, segment_id: null }); redraw(); setTimeout(() => document.getElementById('le-whoq')?.focus(), 0); });
    const q = root.querySelector('#le-whoq'), out = root.querySelector('#le-whores');
    const wirePicks = () => out?.querySelectorAll('[data-pick]').forEach(el => el.onclick = () => pick(root, c, el.dataset.pick));
    if (q) {
      let t; q.oninput = () => { c.q = q.value; root.querySelector('#le-who-err').innerHTML = ''; clearTimeout(t); t = setTimeout(() => { out.innerHTML = whoResults(c.q); wirePicks(); }, 120); };
      q.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); out.querySelector('[data-pick]')?.click(); } };
    }
    wirePicks();
  }
  if (c.step === 1) {
    for (const [id, key] of [['le-subj', 'subject'], ['le-ask', 'ask']]) {
      const inp = root.querySelector('#' + id);
      // One line of text in a box that grows, so a long subject is readable on a phone; Enter never adds a line.
      const fit = () => { inp.style.height = 'auto'; inp.style.height = inp.scrollHeight + 2 + 'px'; };
      inp.onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) e.preventDefault(); };
      let w = 0; fit(); new ResizeObserver(([e]) => { if (e.contentRect.width !== w) { w = e.contentRect.width; fit(); } }).observe(inp);   // refit when the width changes, not the height
      inp.oninput = () => {
        if (/\n/.test(inp.value)) inp.value = inp.value.replace(/\s*\n\s*/g, ' ');
        fit();
        c[key] = inp.value; c.dirty = true; c.edited = true;
        root.querySelector('#le-ph').innerHTML = phLine(phCount(c)); paintSaveState(c); paintLive(c);
        const err = root.querySelector(`#${id}-err`); if (err.innerHTML) { err.innerHTML = ''; inp.removeAttribute('aria-invalid'); }
      };
    }
    wireRTE(root, c);
  }
}

// ---- leaving with unsaved words (assessment 9/19: they were dropped without a word) ----
// The writer is asked "Save changes?" before the composer is left with edits the server does not have: any link in
// the app (the back link, the sidebar, the header), the browser's Back or Forward, and a reload or a closed tab (the
// browser's own question; nothing else is possible there). Cancel keeps the page exactly as it was. The frame's own
// jumps (your menu, the header search, g-then-a-letter) ask too, through S.leaveGuard below.
let leaving = false, bounce = null, bounceT = 0;
const unsavedEdits = () => { const c = S.leCmp; return !!(c && c.dirty && S.route?.name === 'composer' && canEdit(c.a) && document.querySelector('.le-cmp')); };
// Save draft / Don't save / Cancel. A draft too short to save (no subject, or under a couple of sentences) can only
// be left or kept. Esc, Back and a click outside all mean Cancel.
function leaveSheet(c) {
  const prob = problem(c, { brackets: false });
  return new Promise(res => {
    let done = false;
    const fin = async v => { if (done) return; done = true; await closeSheet({ silent: true }); res(v); };
    openSheet({ title: prob ? 'Leave without saving?' : 'Save changes?', size: 'auto',
      body: `<div class="le-sheet"><p>${prob ? 'This email is too short to save as a draft: it needs a subject and a couple of sentences. If you leave now, what you typed is lost.' : 'You changed this email and have not saved it. Save it as a draft, and you can come back to it from Emails.'}</p></div>`,
      foot: prob ? `${btn('Cancel', { kind: 'text', attrs: { 'data-lv': 'stay' } })}${btn('Leave without saving', { kind: 'danger', attrs: { 'data-lv': 'drop' } })}`
        : `${btn('Cancel', { kind: 'text', attrs: { 'data-lv': 'stay' } })}${btn('Don’t save', { kind: 'text', cls: 'le-dont', attrs: { 'data-lv': 'drop' } })}${btn('Save draft', { icon: 'check', attrs: { 'data-lv': 'save' } })}`,
      onClose: () => { if (!done) { done = true; res('stay'); } },
      wire: d => { d.querySelector('.sv-sh-foot')?.classList.add('le-foot3'); d.querySelectorAll('[data-lv]').forEach(b => b.onclick = () => fin(b.dataset.lv)); } });
  });
}
async function askLeave(go) {
  const c = S.leCmp; if (!c) { go(); return; }
  const v = await leaveSheet(c);
  if (v === 'stay') return;
  if (v === 'save') { try { await save(c); toast('Draft saved. It is under Drafts in Emails.', { ok: true }); } catch (e) { toast(e, { err: true }); paintSaveState(c); return; } }
  else S.leCmp = null;
  leaving = true; setTimeout(() => { leaving = false; }, 1500);
  go();
}
// The frame's own jumps (your menu, the header search, a g shortcut) go through go(), which asks this first.
(S.leaveGuards ??= []).push(proceed => { if (leaving || !unsavedEdits()) return false; askLeave(proceed); return true; });
// Links: caught before the frame's own handler (capture), so nothing moves until the writer has answered.
document.addEventListener('click', e => {
  if (leaving || e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || !unsavedEdits()) return;
  const a = e.target.closest?.('a[href^="#/"]'); if (!a || a.target === '_blank' || a.closest('dialog')) return;
  e.preventDefault(); e.stopPropagation();
  askLeave(() => { if (a.isConnected) a.click(); else S.go(a.getAttribute('href')); });
}, true);
// Back and Forward: the address has already changed when the browser tells us, so step straight back onto the
// composer (the frame never hears of either move, so the page is not redrawn and the cursor stays), then ask. This
// file loads before the frame, so this listener runs first.
window.addEventListener('popstate', e => {
  if (bounce) { const go = bounce; bounce = null; clearTimeout(bounceT); e.stopImmediatePropagation(); askLeave(go); return; }
  if (leaving || sheetOpen() || !unsavedEdits()) return;
  const c = S.leCmp; if (location.hash === c.hash) return;          // Back only closed a sheet on this page
  e.stopImmediatePropagation();
  const dir = (e.state?.d || 0) > (c.depth || 0) ? 1 : -1;           // which way the person was heading
  bounce = () => history.go(dir); history.go(-dir);
  bounceT = setTimeout(() => { if (bounce) { bounce = null; hooks.render(); } }, 1200);   // the step back never landed (an address typed by hand): draw what the address says
});
window.addEventListener('beforeunload', e => { if (unsavedEdits()) { e.preventDefault(); e.returnValue = ''; } });
// Ctrl+S / Cmd+S saves the draft on the Write step (it can be switched off with the other shortcuts in My settings).
document.addEventListener('keydown', e => {
  if (!keysOn() || !(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 's' || S.route?.name !== 'composer' || document.querySelector('dialog[open]')) return;
  const b = document.querySelector('.le-cmp [data-le="save"]'); if (!b) return;
  e.preventDefault(); b.click();
});

export default {
  tab: 'outreach', tabs: false,
  title: route => { const a = route.id && alertById(route.id); return a && !canEdit(a) ? (a.subject || 'Email') : a?.status === 'returned' ? 'Fix the email' : 'New email'; },
  back: () => ({ href: '#/outreach/emails', label: 'Emails' }),
  render, wire, bar,
};
