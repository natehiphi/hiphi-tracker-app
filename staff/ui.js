// HIPHI Staff v2: shared building blocks. Every screen builds from these so a row, a chip, a sheet or a countdown
// looks and behaves the same everywhere (plan section 4). Styles in staff/staff.css, on top of pub/base.css.
import { S, esc, advocate } from './data.js';
import { icon } from '../icons.js';
export { icon };

const attrs = a => Object.entries(a || {}).filter(([, v]) => v !== undefined && v !== null && v !== false)
  .map(([k, v]) => v === true ? ` ${k}` : ` ${k}="${esc(v)}"`).join('');

// ---- buttons and chips ----
export function btn(label, { kind = 'primary', icon: ic, iconEnd, full, sm, href, attrs: a, cls = '', target } = {}) {
  const c = `btn ${kind}${full ? ' full' : ''}${sm ? ' sm' : ''}${cls ? ' ' + cls : ''}`;
  const inner = `${ic ? icon(ic) : ''}<span>${label}</span>${iconEnd ? icon(iconEnd) : ''}`;
  const { type = 'button', ...rest } = a || {};
  return href ? `<a class="${c}" href="${esc(href)}"${target ? ` target="${target}" rel="noopener"` : ''}${attrs(rest)}>${inner}</a>`
    : `<button type="${esc(type)}" class="${c}"${attrs(rest)}>${inner}</button>`;
}
export const iconBtn = (ic, label, a = {}, cls = '') => `<button type="button" class="iconbtn${cls ? ' ' + cls : ''}" aria-label="${esc(label)}" title="${esc(label)}"${attrs(a)}>${icon(ic)}</button>`;
// Status chip: not a button, never drawn with a border. tone: '' | info | warn | danger | ok | yay
export const chip = (text, tone = '', ic) => `<span class="chip sv-chip${tone ? ' ' + tone : ''}">${ic ? icon(ic) : ''}${esc(text)}</span>`;
// Picker chip: a button that opens a picker sheet ("Strong support ▾").
export const pickerChip = (label, a = {}, ic) => `<button type="button" class="sv-pick"${attrs(a)}>${ic ? icon(ic) : ''}<span>${esc(label)}</span>${icon('chevron-down', { cls: 'chev' })}</button>`;
// Position: an icon and a word, never colour alone.
export const POS_ICON = { strongly_support: 'thumbs-up', support: 'thumbs-up', support_amend: 'thumbs-up', strongly_oppose: 'thumbs-down', oppose: 'thumbs-down', neutral: 'message-square', monitor: 'eye', '': 'circle-dashed' };
export const POS_WORD = { strongly_support: 'Strong support', support: 'Support', support_amend: 'Support with changes', strongly_oppose: 'Strongly oppose', oppose: 'Oppose', neutral: 'Comments', monitor: 'Monitor', '': 'No position' };
export const posChip = p => chip(POS_WORD[p || ''] || p, '', POS_ICON[p || ''] || 'circle-dashed');

// ---- people ----
export function avatar(adv, size = 24) {
  if (!adv) return `<span class="sv-av none" style="--av:${size}px" role="img" aria-label="No owner" title="No owner"></span>`;
  const me = S.me && adv.id === S.me.id;
  return `<span class="sv-av${me ? ' me' : ''}" style="--av:${size}px" title="${esc(me ? 'You' : adv.full_name)}" role="img" aria-label="${esc(me ? 'You' : adv.full_name)}">${esc(adv.initials || adv.full_name?.[0] || '?')}</span>`;
}
export const ownerOf = b => advocate((S.assignments[b.id] || [])[0]);

// ---- countdown: always an icon and words (plan 4) ----
export function countdown(iso, { prefix = '' } = {}) {
  if (!iso) return '';
  const ms = new Date(iso) - Date.now(), h = ms / 36e5;
  const text = ms <= 0 ? `${prefix}overdue` : h < 1 ? `${prefix}under an hour` : h < 48 ? `${prefix}${Math.round(h)}h left` : `${prefix}${Math.ceil(h / 24)} days left`;
  const tone = ms <= 0 ? 'late' : h <= 24 ? 'soon' : '';
  return `<span class="sv-count ${tone}">${icon(ms <= 0 ? 'circle-alert' : 'clock')}${esc(text)}</span>`;
}

// ---- rows and groups ----
// A two-line row: row({ lead, title, sub, end, href | attrs, chevron })
export function row({ lead, leadHtml, title, sub, end = '', chevron = true, href, attrs: a, cls = '' }) {
  const inner = `${leadHtml || (lead ? `<span class="lead">${icon(lead)}</span>` : '')}<span class="body"><span class="title">${title}</span>${sub ? `<span class="sub">${sub}</span>` : ''}</span><span class="end">${end}${chevron ? icon('chevron-right', { cls: 'chev' }) : ''}</span>`;
  return href ? `<a class="row${cls ? ' ' + cls : ''}" href="${esc(href)}"${attrs(a)}>${inner}</a>` : `<button type="button" class="row${cls ? ' ' + cls : ''}"${attrs(a)}>${inner}</button>`;
}
// A bill row (64px on phones): number + plain title, a status sentence, and position / P1 / owner at the right.
export function billRow(b, { sub = '', href, attrs: a, selectable = false, selected = false, cls = '' } = {}) {
  const num = (b.bill_number || '').replace(/^([A-Z]+)(\d)/, '$1$2') + (b.current_version ? ' ' + b.current_version : '');
  const title = b.nickname || b.public_summary || b.description || b.title || '';   // the nickname names the bill when it has one
  const pos = b.position || '';
  const end = `<span class="sv-posic" title="${esc(POS_WORD[pos] || pos)}" aria-label="${esc(POS_WORD[pos] || pos)}">${icon(POS_ICON[pos] || 'circle-dashed')}</span>${b.priority === 1 ? '<span class="sv-p1">P1</span>' : ''}${avatar(ownerOf(b))}`;
  const box = selectable ? `<span class="sv-check" aria-hidden="true">${icon(selected ? 'square-check-big' : 'square')}</span>` : '';
  const inner = `${box}<span class="body"><span class="title"><b>${esc(num)}</b> <span class="sv-t">${esc(title)}</span></span>${sub ? `<span class="sub">${sub}</span>` : ''}</span><span class="end">${end}</span>`;
  const extra = { 'data-bill': b.id, ...(selectable ? { 'aria-pressed': selected ? 'true' : 'false' } : {}), ...(a || {}) };
  return href && !selectable ? `<a class="row sv-billrow${cls ? ' ' + cls : ''}" href="${esc(href)}"${attrs(extra)}>${inner}</a>`
    : `<button type="button" class="row sv-billrow${selected ? ' sel' : ''}${cls ? ' ' + cls : ''}"${attrs(extra)}>${inner}</button>`;
}
// A group header (44px): title and a right-aligned count; foldable when given a key.
export const groupHead = (title, count, { fold, open = true, id } = {}) => fold
  ? `<button type="button" class="sv-group" data-fold="${esc(fold)}" aria-expanded="${open}"${id ? ` id="${esc(id)}"` : ''}><span>${title}</span><span class="n">${count ?? ''}</span>${icon(open ? 'chevron-up' : 'chevron-down', { cls: 'chev' })}</button>`
  : `<div class="sv-group"${id ? ` id="${esc(id)}"` : ''}><span>${title}</span><span class="n">${count ?? ''}</span></div>`;

// ---- controls ----
// segmented('scope', [['mine','Mine'],['team','Team']], 'mine')  -> buttons with data-seg="scope" data-val
export const segmented = (name, opts, value, label = '') => `<div class="sv-seg" role="group"${label ? ` aria-label="${esc(label)}"` : ''}>${opts.map(([v, l]) => `<button type="button" data-seg="${esc(name)}" data-val="${esc(v)}" aria-pressed="${v === value}">${esc(l)}</button>`).join('')}</div>`;
export const switchRow = (id, label, on, help = '', a = {}) => `<label class="sv-switchrow" for="${esc(id)}"><span class="body"><span class="title">${label}</span>${help ? `<span class="sub">${help}</span>` : ''}</span><input type="checkbox" role="switch" id="${esc(id)}" ${on ? 'checked' : ''}${attrs(a)}><span class="sv-switch" aria-hidden="true"></span></label>`;
export const field = (id, label, input, help = '') => `<div class="field"><label for="${esc(id)}">${label}</label>${input}${help ? `<span class="help" id="${esc(id)}-help">${help}</span>` : ''}</div>`;
// The testimony steps with the true state: Write · Review · (2nd approval) · File
export function stepBar(status, { second = false } = {}) {
  const steps = [['draft', 'Write'], ['review', 'Review'], ...(second || status === 'second_review' ? [['second_review', '2nd approval']] : []), ['approved', 'File']];
  const order = steps.map(s => s[0]), cur = status === 'filed' ? steps.length : Math.max(0, order.indexOf(status));
  return `<ol class="sv-steps" aria-label="Testimony steps">${steps.map(([k, l], i) => `<li class="${i < cur ? 'done' : i === cur ? 'cur' : ''}"${i === cur ? ' aria-current="step"' : ''}>${i < cur ? icon('check') : ''}<span>${l}</span></li>`).join('')}</ol>`;
}
export const empty = ({ title, text = '', action = '', h = 'h2', art = '' }) => `<div class="empty">${art}${title ? `<${h}>${title}</${h}>` : ''}${text ? `<p>${text}</p>` : ''}${action}</div>`;
export const skeleton = (n = 5) => `<div class="skelpage" aria-busy="true" aria-label="Loading"><div class="skel" style="height:56px"></div>${Array.from({ length: n }, () => '<div class="skel" style="height:72px"></div>').join('')}</div>`;
export const notice = (tone, ic, html, action = '') => `<div class="notice ${tone} sv-notice">${icon(ic)}<div>${html}</div>${action}</div>`;
export const inlineErr = (id, text) => `<div class="inlinemsg" id="${esc(id)}" role="alert">${icon('circle-alert')}<span>${esc(text)}</span></div>`;

// ---- toast: one at a time, in #toast; Undo keeps it 10 seconds ----
export function toast(msg, opt = {}) {
  if (opt === true) opt = { err: true };
  const box = document.getElementById('toast'); if (!box) return;
  box.innerHTML = '';
  const el = document.createElement('div'); el.className = 'toastmsg' + (opt.err ? ' err' : opt.ok ? ' yay' : '');
  el.innerHTML = (opt.ok ? `<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9.5" fill="var(--ok-text)"/><path class="ck" d="M5.5 10.4l3 3 6-6.6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>` : '')
    + `<span>${esc(opt.err ? friendly(msg) : msg)}</span>` + (opt.undo ? '<button type="button" class="toastundo">Undo</button>' : '') + (opt.action ? `<button type="button" class="toastundo toastact">${esc(opt.action.label)}</button>` : '');
  if (opt.undo) el.querySelector('.toastundo').onclick = async () => { box.innerHTML = ''; try { await opt.undo(); } catch (e) { toast(e, true); } };
  if (opt.action) el.querySelector('.toastact').onclick = () => { box.innerHTML = ''; opt.action.run(); };
  box.appendChild(el); clearTimeout(toast.t); toast.t = setTimeout(() => el.isConnected && el.remove(), opt.undo || opt.action ? 10000 : 4000);
}
export function friendly(e) {
  const m = String(e?.message || e || '');
  if (/rate limit|too many/i.test(m)) return 'Too many tries in a row. Wait a minute and try again.';
  if (/refus|hearing ahead|has a .* hearing/i.test(m)) return m;          // the server's own sentence (e.g. mute refused)
  if (/^[A-Z][^{}<>]{3,160}[.!]$/.test(m) && !/(error|exception|fetch|null|undefined|column|relation|violates|jwt|token|permission)/i.test(m)) return m;
  return 'That did not save. Check your connection and try again.';
}

// ---- sheets: one at a time (never stacked), bottom sheet on phones, 560px dialog on desktop. Back closes it (it
// pushes a history entry), Esc closes it, focus moves into it and returns to where it was. ----
let cur = null;
export const sheetOpen = () => !!cur;
export function openSheet({ title, body, foot = '', size = 'half', onClose, wire } = {}) {
  // A sheet opened from another sheet takes over its Back entry instead of undoing it and pushing a new one
  // (a Back that lands late would otherwise undo the new sheet's entry).
  let reuse = false, back = document.activeElement;
  if (cur) { reuse = cur.pushed; back = cur.back; cur.d.close(); cur.d.remove(); cur = null; }
  const d = document.createElement('dialog'); d.className = `sv-sheet ${size}`; d.setAttribute('aria-labelledby', 'sv-sh-t');
  d.innerHTML = `<div class="sv-sh-grab" aria-hidden="true"></div><div class="sv-sh-head"><h2 id="sv-sh-t" tabindex="-1">${title}</h2>${iconBtn('x', 'Close', { 'data-shclose': '1' })}</div><div class="sv-sh-body">${body}</div>${foot ? `<div class="sv-sh-foot">${foot}</div>` : ''}`;
  document.body.appendChild(d);
  cur = { d, back, onClose, pushed: true };
  if (!reuse) history.pushState({ ...(history.state || {}), sheet: true }, '');
  d.addEventListener('cancel', e => { e.preventDefault(); closeSheet(); });
  d.addEventListener('click', e => { if (e.target === d) closeSheet(); });
  d.querySelector('[data-shclose]').onclick = () => closeSheet();
  d.showModal();
  (d.querySelector('[autofocus]') || d.querySelector('#sv-sh-t'))?.focus?.();
  if (wire) wire(d);
  return d;
}
// closeSheet(): from a button (steps history back once) or from Back (fromPop: the entry is already gone). It returns
// a promise that settles once that Back has landed, so whatever comes next (a page, another sheet) is not undone by it.
let ignorePop = false, waiting = [];
export function closeSheet({ fromPop = false, silent = false } = {}) {
  if (!cur) return Promise.resolve(false);
  const { d, back, onClose, pushed } = cur; cur = null;
  d.close(); d.remove();
  const done = new Promise(res => {
    if (pushed && !fromPop) { ignorePop = true; waiting.push(res); setTimeout(() => res(true), 450); history.back(); } else res(true);
  });
  if (!silent && onClose) onClose();
  if (back && back.isConnected) back.focus?.({ preventScroll: true });
  return done;
}
// app.js calls this first on popstate; true means "that Back only closed a sheet".
export function popSheet() {
  if (ignorePop) { ignorePop = false; const w = waiting; waiting = []; w.forEach(f => setTimeout(() => f(true), 0)); return true; }
  if (!cur) return false;
  closeSheet({ fromPop: true }); return true;
}
// For app.js: a page change while a sheet is open reuses the sheet's history entry (replace instead of push).
export function takeSheetEntry() { if (!cur) return false; closeSheet({ fromPop: true, silent: true }); return true; }
// A picker: one choice from a list, saves on tap. options: [[value, label, icon?, sub?]]
export function pickerSheet({ title, options, value, onPick, help = '' }) {
  return openSheet({ title, body: `${help ? `<p class="small muted sv-sh-help">${help}</p>` : ''}<div class="sv-pickl" role="radiogroup" aria-label="${esc(title)}">${options.map(([v, l, ic, sub]) => `<button type="button" role="radio" aria-checked="${String(v) === String(value)}" data-pv="${esc(v)}">${ic ? icon(ic) : ''}<span class="body"><span class="title">${esc(l)}</span>${sub ? `<span class="sub">${esc(sub)}</span>` : ''}</span>${String(v) === String(value) ? icon('check', { cls: 'on' }) : ''}</button>`).join('')}</div>`,
    wire: d => d.querySelectorAll('[data-pv]').forEach(el => el.onclick = async () => { await closeSheet({ silent: true }); await onPick(el.dataset.pv); }) });
}
// A menu of actions (the ⋯ menus). items: [{ label, icon, danger, disabled, reason, run }]
export function menuSheet({ title = 'More', items }) {
  return openSheet({ title, body: `<div class="sv-menu">${items.filter(Boolean).map((it, i) => `<button type="button" data-mi="${i}" class="${it.danger ? 'danger' : ''}" ${it.disabled ? 'aria-disabled="true"' : ''}>${icon(it.icon || 'chevron-right')}<span class="body"><span class="title">${esc(it.label)}</span>${it.disabled && it.reason ? `<span class="sub">${esc(it.reason)}</span>` : it.sub ? `<span class="sub">${esc(it.sub)}</span>` : ''}</span></button>`).join('')}</div>`,
    wire: d => { const list = items.filter(Boolean); d.querySelectorAll('[data-mi]').forEach(el => el.onclick = async () => { const it = list[+el.dataset.mi]; if (it.disabled) { if (it.reason) toast(it.reason); return; } await closeSheet({ silent: true }); await it.run(); }); } });
}
// Confirm in the app (never window.confirm): confirmSheet({ title, text, ok: 'Delete', danger: true }) -> Promise<boolean>
export function confirmSheet({ title, text = '', ok = 'OK', danger = false }) {
  return new Promise(res => {
    let done = false;
    openSheet({ title, size: 'auto', body: text ? `<p>${text}</p>` : '', foot: `${btn('Cancel', { kind: 'text', attrs: { 'data-no': '1' } })}${btn(ok, { kind: danger ? 'danger' : 'primary', attrs: { 'data-yes': '1' } })}`,
      onClose: () => { if (!done) res(false); },
      wire: d => { d.querySelector('[data-yes]').onclick = async () => { done = true; await closeSheet({ silent: true }); res(true); }; d.querySelector('[data-no]').onclick = async () => { done = true; await closeSheet({ silent: true }); res(false); }; } });
  });
}
