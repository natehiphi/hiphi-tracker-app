// Staff v6 · Public changes (#/approvals; R-376, Nate 12 Nov). What the public sees changes only with an admin's yes: when a
// teammate who is not an admin changes a bill's public words, a published issue's words or a list going live, the database
// keeps the earlier version on the public page and files the new words here (backend 197). An admin reads each one beside
// what the public sees now and approves it or sends it back with a note; the writer hears either way (Slack or email) and
// sees the same here under "Your changes". Admins' own changes never wait. Taking something down is never held.
import { S, DB, hooks, esc, advocate, fmtDate, waitingChanges, myPublicChanges } from './data.js';
import { billRoute, whenAt } from './model.js';
import { icon, btn, toast, empty, openSheet, closeSheet } from './ui.js';

// What each held column is called on screen, per kind of thing.
const LABELS = {
  bill: { is_public: 'On the public page', nickname: 'Nickname', public_summary: 'Summary', public_action: 'The ask', public_action_until: 'Ask shows until', talking_points: 'Talking points' },
  issue: { name: 'Name', description: 'Description', category: 'Category', recommended: 'Pre-ticked for new visitors', outlook: 'Outlook', stance: 'Stance', first_visit: 'In the first visit', icon: 'Icon' },
  list: { is_published: 'On the public page', title: 'Title', description: 'Description', icon: 'Icon', slug: 'Web address' },
};
const YESNO = { is_public: ['Shown', 'Hidden'], recommended: ['Yes', 'No'], first_visit: ['Yes', 'No'], is_published: ['Shown', 'Not shown (draft)'] };
export const fieldLabel = (kind, k) => LABELS[kind]?.[k] || k;

// One thing's plain name, and where it lives.
function target(pc) {
  if (pc.kind === 'bill') { const b = S.bills.find(x => x.id === pc.target_id); return b ? { name: `${b.bill_number}${b.nickname ? ' · ' + b.nickname : ''}`, href: billRoute(b, 'public'), what: 'Bill' } : { name: 'A bill', href: '', what: 'Bill' }; }
  if (pc.kind === 'issue') { const i = S.issues.find(x => x.id === pc.target_id); return { name: i?.name || 'An issue', href: i ? '#/issue/' + encodeURIComponent(i.id) : '', what: 'Issue' }; }
  const l = S.lists.find(x => x.id === pc.target_id); return { name: l?.title || 'A list', href: l ? '#/list/' + encodeURIComponent(l.id) : '', what: 'Public list' };
}
export const changeName = pc => target(pc).name;
// A value in words: switches as words, a date as a date, points one under another, nothing as "Nothing".
function val(kind, k, v) {
  if (YESNO[k] && (kind !== 'issue' || k !== 'recommended' || typeof v === 'boolean')) return YESNO[k][v ? 0 : 1];
  if (v == null || v === '' || (Array.isArray(v) && !v.length)) return 'Nothing';
  if (k === 'public_action_until') return fmtDate(v, { month: 'short', day: 'numeric', year: 'numeric' });
  if (Array.isArray(v)) return v.map(x => '• ' + x).join('\n');
  return String(v);
}
const who = id => advocate(id)?.full_name || 'A teammate';
const diff = pc => Object.keys(pc.fields || {}).map(k => `<div class="pc-field"><h4 class="pc-fl">${esc(fieldLabel(pc.kind, k))}</h4>
  <div class="pc-cols"><div class="pc-col"><span class="pc-cap">Now on the public page</span><p class="pc-val">${esc(val(pc.kind, k, pc.before?.[k]))}</p></div>
  <div class="pc-col pc-new"><span class="pc-cap">The change</span><p class="pc-val">${esc(val(pc.kind, k, pc.fields[k]))}</p></div></div></div>`).join('');

function card(pc) {
  const t = target(pc);
  return `<li class="pc-card" data-pc="${esc(pc.id)}"><div class="pc-head"><span class="pc-what">${esc(t.what)}</span>
    <h3 class="pc-name">${t.href ? `<a href="${esc(t.href)}">${esc(t.name)}</a>` : esc(t.name)}</h3>
    <p class="pc-by">${esc(who(pc.proposed_by))} · ${esc(whenAt(pc.proposed_at))}</p></div>
    ${diff(pc)}
    <div class="pc-acts">${btn('Approve', { kind: 'primary', icon: 'check', attrs: { 'data-pcyes': pc.id } })}${btn('Send back', { kind: 'secondary', icon: 'undo-2', attrs: { 'data-pcno': pc.id, 'aria-haspopup': 'dialog' } })}</div></li>`;
}
const STATUS = { waiting: 'Waiting for an admin', approved: 'Approved', withdrawn: 'Taken back' };
const statusLine = pc => pc.status === 'sent_back' ? `Sent back${pc.decided_by ? ' by ' + who(pc.decided_by) : ''}${pc.note ? ': ' + pc.note : ''}` : STATUS[pc.status] || pc.status;
function mine(pc) {
  const t = target(pc), keys = Object.keys(pc.fields || {}).map(k => fieldLabel(pc.kind, k)).join(', ');
  return `<li class="pc-mine pc-${esc(pc.status)}"><div class="pc-minetx"><span class="pc-minename">${t.href ? `<a href="${esc(t.href)}">${esc(t.name)}</a>` : esc(t.name)}</span>
    <span class="pc-minekeys">${esc(keys)} · sent ${esc(whenAt(pc.proposed_at))}</span>
    <span class="pc-status">${esc(statusLine(pc))}</span></div>
    ${pc.status === 'waiting' ? btn('Take back', { kind: 'text', sm: true, attrs: { 'data-pcback': pc.id } }) : ''}</li>`;
}

export default {
  tab: 'more',
  title: () => 'Public changes',
  back: () => ({ href: '#/more', label: 'More' }),
  render() {
    const admin = !!S.me?.is_admin, wait = admin ? waitingChanges() : [], own = myPublicChanges();
    return `<div class="v6-more pc-page">
      <h1 class="v6-ptitle sv-h1">Public changes</h1>
      ${admin ? `<section class="v6-more-sec" aria-labelledby="pc-wait"><h2 class="v6-more-h" id="pc-wait">Waiting for you${wait.length ? ` (${wait.length})` : ''}</h2>
        <p class="pc-intro">Approving puts the change on the public page right away.</p>
        ${wait.length ? `<ul class="pc-list">${wait.map(card).join('')}</ul>` : empty({ title: 'Nothing waits for you.', text: 'A teammate’s change to what the public sees shows up here, with an Approve and a Send back.', h: 'h3' })}</section>`
        : `<p class="pc-intro">Changes to what the public sees wait for an admin. The public keeps the earlier version until then.</p>`}
      ${admin && !own.length ? '' : `<section class="v6-more-sec" aria-labelledby="pc-mine"><h2 class="v6-more-h" id="pc-mine">Your changes</h2>
        ${own.length ? `<ul class="pc-list pc-minelist">${own.map(mine).join('')}</ul>` : `<p class="pc-none">Nothing from you in the last 30 days.</p>`}</section>`}
    </div>`;
  },
  wire(route, root) {
    const redo = () => hooks.render();
    const by = id => (S.publicChanges || []).find(x => x.id === id);
    root.querySelectorAll('[data-pcyes]').forEach(el => el.onclick = async () => {
      el.disabled = true;
      try { await DB.decidePublicChange(el.dataset.pcyes, true); toast('Approved. The public sees it now.', { ok: true }); }
      catch (e) { el.disabled = false; toast(e, { err: true }); }
      redo();
    });
    root.querySelectorAll('[data-pcno]').forEach(el => el.onclick = () => {
      const pc = by(el.dataset.pcno); if (!pc) return;
      openSheet({ title: 'Send back', size: 'auto',
        body: `<p>${esc(who(pc.proposed_by))} hears it with your note. The public keeps the earlier version.</p><div class="field"><label for="pc-note">Note (what to change)</label><textarea id="pc-note" rows="3" maxlength="400"></textarea></div>`,
        foot: `${btn('Cancel', { kind: 'text', attrs: { 'data-pcx': '1' } })}${btn('Send back', { kind: 'primary', attrs: { 'data-pcgo': '1' } })}`,
        wire: d => {
          d.querySelector('[data-pcx]').onclick = () => closeSheet();
          d.querySelector('[data-pcgo]').onclick = async () => {
            const note = d.querySelector('#pc-note').value;
            try { await DB.decidePublicChange(pc.id, false, note); await closeSheet({ silent: true }); toast('Sent back.', { ok: true }); redo(); }
            catch (e) { toast(e, { err: true }); }
          };
        } });
    });
    root.querySelectorAll('[data-pcback]').forEach(el => el.onclick = async () => {
      el.disabled = true;
      try { await DB.withdrawPublicChange(el.dataset.pcback); toast('Taken back. The public never saw it.', { ok: true }); }
      catch (e) { el.disabled = false; toast(e, { err: true }); }
      redo();
    });
  },
};
