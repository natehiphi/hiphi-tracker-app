// Outreach > Lists (plan 3.8): curated sets of public bills that anyone can follow. The index is a short set of rows
// (icon, title, "6 bills · 12 followers", Live or Draft); "New list" opens a three-field sheet instead of a form that
// always sits open. The same calls and rules as the current app's Lists page (app.js renderLists / wireLists):
// DB.createList, a new list starts as a draft, and a list is not tied to a coalition. The list itself is list.js.
// Desktop (900px and wider): the index is a table in the same look as Bills and Supporters (pinned header, columns
// that sort, the whole row opens). The table parts below are shared with the Emails page.
import { S, DB, hooks, esc, fmtDate, asDate, advocate } from './data.js';
import { ICONS } from '../icons.js';
import { billById, blurb, billNum } from './model.js';
import { icon, btn, row, chip, empty, toast, openSheet, closeSheet } from './ui.js';

// Issue and list icons (9/19): the public page shows Lucide icons, so staff pick from this short set. The same 24
// names and words as the current app (app.js ICON_CHOICES); a copy, so Lists does not depend on the setup screen.
export const ICON_CHOICES = [['salad', 'Healthy food'], ['apple', 'Apple'], ['bike', 'Active living'], ['utensils', 'Meals'], ['thermometer-sun', 'Heat and climate'],
  ['waves', 'Ocean'], ['sun', 'Sun'], ['leaf', 'Leaf'], ['shield-check', 'Protection'], ['wine-off', 'No alcohol'], ['cigarette-off', 'No tobacco'], ['pill', 'Medicine'],
  ['smile', 'Smile (oral health)'], ['sprout', 'Sprout (farm to school)'], ['school', 'School'], ['baby', 'Keiki'], ['syringe', 'Vaccines'], ['stethoscope', 'Health care'],
  ['heart-pulse', 'Public health'], ['heart-handshake', 'Community care'], ['handshake', 'Partnership'], ['users', 'People'], ['house', 'Housing'], ['megaphone', 'Advocacy']];
// Lists saved before 9/19 carry an emoji; show its Lucide match until someone re-saves the list.
const EMOJI_ICON = { '🥗': 'salad', '🌊': 'thermometer-sun', '🍺': 'shield-check', '🚭': 'cigarette-off', '🦷': 'smile', '🌱': 'sprout', '💉': 'syringe', '🤝': 'heart-handshake', '🏥': 'heart-pulse', '☀️': 'heart-pulse', '☀': 'heart-pulse', '🧒': 'baby' };
export const listIcon = v => { const x = String(v || '').trim(); return ICONS[x] ? x : EMOJI_ICON[x] || EMOJI_ICON[x.replace(/\uFE0F/g, '')] || 'list-checks'; };

export const plural = (n, one, many = one + 's') => `${Number(n || 0).toLocaleString()} ${n === 1 ? one : many}`;
export const listById = id => (S.lists || []).find(l => String(l.id) === String(id));
// A list's bills in the public order (the same sort as the current app), skipping bills no longer tracked.
export const listRows = l => (S.listBills || []).filter(x => x.list_id === l.id)
  .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.added_at || '').localeCompare(String(b.added_at || '')))
  .map(x => ({ x, b: billById(x.bill_id) })).filter(r => r.b);
// A plain summary cut to length, without the "year.…" a cut after a full stop leaves.
export const clip = (b, n) => blurb(b, n).replace(/[.,;:]…$/, '…');
export const livePill = l => l.is_published ? chip('Live', 'ok', 'globe') : chip('Draft', '', 'eye-off');
// How a bill is named everywhere in Outreach (9/19): its number, then its nickname in bold when it has one, with the
// plain summary as the second line. A bill with no nickname (one we only monitor) keeps its summary beside the number.
export const billName = (b, n = 110) => b.nickname
  ? `<span class="title"><b>${esc(billNum(b))}</b> <b class="le-nick">${esc(b.nickname)}</b></span><span class="sub le-bsum">${esc(clip(b, n))}</span>`
  : `<span class="title"><b>${esc(billNum(b))}</b> <span class="le-t">${esc(clip(b, n))}</span></span>`;

// ---- layout, and the desktop table parts shared by Lists and Emails ----
export const isDesk = () => matchMedia('(min-width: 900px)').matches;
export const isSide = () => matchMedia('(min-width: 1100px)').matches;   // the frame's sidebar already lists Supporters, Lists and Emails
export const DASH = '<span class="le-dash" aria-hidden="true">–</span><span class="sr">none</span>';
// "3/16" this year, "11/2/25" for an older date.
export const shortDate = d => d ? fmtDate(d, asDate(d).getFullYear() === new Date().getFullYear() ? {} : { year: '2-digit' }) : '';
// A header cell. cols: { k, label, sort?: first direction (1 up, -1 down), num?, tip? }; sort: null | [key, dir].
// The arrow shows on the sorted column (and faintly on hover), and aria-sort says the same to a screen reader.
export function thSort(c, sort) {
  if (!c.sort) return `<th scope="col" class="c-${c.k}${c.num ? ' num' : ''}">${c.label}</th>`;
  const on = sort && sort[0] === c.k, up = on ? sort[1] > 0 : c.sort > 0, arrow = icon(up ? 'chevron-up' : 'chevron-down');
  return `<th scope="col" class="c-${c.k}${c.num ? ' num' : ''}" aria-sort="${on ? (sort[1] > 0 ? 'ascending' : 'descending') : 'none'}"><button type="button" class="le-sort${on ? ' on' : ''}" data-sort="${c.k}"${c.tip ? ` title="${esc(c.tip)}"` : ''}>${c.num ? arrow : ''}<span>${c.label}</span>${c.num ? '' : arrow}</button></th>`;
}
// A header click: the column's own first direction, then the other way, then back to the page's own order.
export const nextSort = (cur, c) => !cur || cur[0] !== c.k ? [c.k, c.sort] : cur[1] === c.sort ? [c.k, -c.sort] : null;
const cmp = (a, b) => typeof a === 'string' ? a.localeCompare(b) : a - b;
// Rows with nothing in the sorted column go last whichever way it runs; ties keep the page's own order.
export const sortBy = (rows, sort, get) => !sort ? rows : rows.map((r, i) => [get(r, sort[0]), i, r])
  .sort(([a, i], [b, j]) => (a == null) - (b == null) || (a == null ? 0 : sort[1] * cmp(a, b)) || i - j).map(x => x[2]);
// Wire a table drawn with thSort: headers sort (focus stays on the header), the whole row opens its link, unless the
// click was on a control or ended a text selection; Ctrl/Cmd+click opens a new tab like any link.
export function wireTable(root, cols, state) {
  root.querySelectorAll('.le-table [data-sort]').forEach(el => el.onclick = () => {
    const k = el.dataset.sort; state.sort = nextSort(state.sort, cols.find(c => c.k === k));
    const y = scrollY; hooks.render(); scrollTo(0, y); document.querySelector(`.le-table [data-sort="${CSS.escape(k)}"]`)?.focus({ preventScroll: true });
  });
  root.querySelectorAll('.le-table tr[data-href]').forEach(tr => tr.addEventListener('click', e => {
    if (e.target.closest('a, button, input, label') || getSelection()?.toString()) return;
    if (e.metaKey || e.ctrlKey) window.open(tr.dataset.href, '_blank', 'noopener'); else S.go(tr.dataset.href);
  }));
}
// The top of Lists and Emails. Phones: the switcher, then a line and the main button. 900 to 1099px: the switcher
// leads one tool row. With the sidebar (1100px and wider) the page's title leads it instead.
export const pageHead = (cur, title, lede, action) => {
  const desk = isDesk();
  return `${desk ? '' : outreachNav(cur)}<div class="le-tools"><h1 class="le-h1">${title}</h1>${desk && !isSide() ? outreachNav(cur) : ''}<p class="le-lede">${lede}</p>${action}</div>`;
};

// The Outreach switcher: the same three links, in the same place, on Supporters, Lists and Emails.
export function outreachNav(cur) {
  return `<nav class="sv-seg le-seg" aria-label="Outreach">${[['supporters', '#/outreach', 'Supporters'], ['lists', '#/outreach/lists', 'Lists'], ['emails', '#/outreach/emails', 'Emails']]
    .map(([k, href, l]) => `<a href="${href}"${k === cur ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>`;
}

// ui.js closes a sheet with history.back(), which lands a moment later. Navigating or opening the next sheet before
// it lands lets that Back undo the new step, so anything that follows a closing sheet waits for it (or 500ms).
export const afterClose = () => new Promise(res => {
  let done = false; const f = () => { if (done) return; done = true; removeEventListener('popstate', f); setTimeout(res, 0); };
  addEventListener('popstate', f); setTimeout(f, 500);
});

// ---- the list form: New list, and Edit on a list's page (Title, Description, and the 24 icons as icons) ----
export function openListForm(l = null) {
  const cur = l ? listIcon(l.icon) : 'baby';
  const nameOf = n => (ICON_CHOICES.find(c => c[0] === n) || [n, 'Icon'])[1];
  const body = `<div class="le-sheet">
    <div class="field"><label for="le-ltitle">Title</label><input id="le-ltitle" maxlength="80" autocomplete="off" value="${esc(l?.title || '')}" placeholder="Keiki health 2027" aria-describedby="le-ltitle-err"><div id="le-ltitle-err" role="alert"></div></div>
    <div class="field"><label for="le-ldesc">Description</label><textarea id="le-ldesc" rows="2" maxlength="200" aria-describedby="le-ldesc-h" placeholder="The bills that decide what kids eat, breathe and can get care for this year.">${esc(l?.description || '')}</textarea><span class="help" id="le-ldesc-h">One friendly sentence. The public sees it.</span></div>
    <fieldset class="le-icons"><legend>Icon <span class="le-iconname" id="le-iconname">${esc(nameOf(cur))}</span></legend>
      <div class="le-igrid">${ICON_CHOICES.map(([n, label]) => `<label class="le-ic" title="${esc(label)}"><input type="radio" name="le-icon" value="${esc(n)}" ${n === cur ? 'checked' : ''}><span class="le-icbox">${icon(n)}</span><span class="sr">${esc(label)}</span></label>`).join('')}</div>
    </fieldset>
  </div>`;
  openSheet({ title: l ? 'Edit list' : 'New list', size: 'auto', body,
    foot: btn(l ? 'Save changes' : 'Create list', { icon: l ? 'check' : 'list-plus', attrs: { 'data-lsave': '1' } }),
    wire: d => {
      const t = d.querySelector('#le-ltitle'), go = d.querySelector('[data-lsave]');
      if (!l) t.focus();
      d.querySelectorAll('input[name="le-icon"]').forEach(r => r.onchange = () => { d.querySelector('#le-iconname').textContent = nameOf(r.value); });
      t.oninput = () => { t.removeAttribute('aria-invalid'); d.querySelector('#le-ltitle-err').innerHTML = ''; };
      const save = async () => {
        const title = t.value.trim(), description = d.querySelector('#le-ldesc').value.trim(), ic = d.querySelector('input[name="le-icon"]:checked')?.value || cur;
        if (title.length < 2) { t.setAttribute('aria-invalid', 'true'); d.querySelector('#le-ltitle-err').innerHTML = `<span class="err">${icon('circle-alert')}Give the list a title.</span>`; t.focus(); return; }
        go.setAttribute('aria-busy', 'true'); go.disabled = true;
        try {
          if (l) {
            await DB.updateList(l.id, { title, description: description || null, icon: ic });
            closeSheet({ silent: true }); hooks.render(); toast('Saved.', { ok: true });
          } else {
            const nl = await DB.createList({ title, description, icon: ic });
            closeSheet({ silent: true }); await afterClose();
            S.go('#/list/' + encodeURIComponent(nl.id));
            toast('List created as a draft. Add bills, then publish it.', { ok: true });
          }
        } catch (e) { toast(e, { err: true }); go.removeAttribute('aria-busy'); go.disabled = false; }
      };
      go.onclick = save;
      t.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); save(); } };
    } });
}

// ---- the index ----
function listRow(l) {
  const n = listRows(l).length, f = S.listFollowers?.[l.id] || 0;
  return row({ leadHtml: `<span class="lead">${icon(listIcon(l.icon))}</span>`, title: esc(l.title),
    sub: `<span class="le-cnt">${plural(n, 'bill')} · ${plural(f, 'follower')}</span>${l.description ? `<span class="le-desc">${esc(l.description)}</span>` : ''}`,
    end: livePill(l), href: '#/list/' + encodeURIComponent(l.id), cls: 'le-lrow' });
}

// Desktop: one row per list. The list's name and what it is for take the spare width; numbers sit right-aligned.
const COLS = [
  { k: 'title', label: 'List', sort: 1 }, { k: 'bills', label: 'Bills', sort: -1, num: true }, { k: 'followers', label: 'Followers', sort: -1, num: true },
  { k: 'status', label: 'Status', sort: 1, tip: 'Live lists can be found and followed; drafts are for the team only' }, { k: 'owner', label: 'Curated by', sort: 1 }, { k: 'updated', label: 'Updated', sort: -1 },
];
const ownerName = l => (l.owner_id && advocate(l.owner_id)?.full_name) || 'HIPHI';
const colValue = (l, k) => k === 'title' ? l.title.toLowerCase() : k === 'bills' ? listRows(l).length : k === 'followers' ? S.listFollowers?.[l.id] || 0
  : k === 'status' ? (l.is_published ? 'a' : 'b') : k === 'owner' ? ownerName(l).toLowerCase() : l.updated_at || l.created_at || null;
function listsTable(lists, v) {
  const tr = l => { const n = listRows(l).length, f = S.listFollowers?.[l.id] || 0, href = '#/list/' + encodeURIComponent(l.id);
    return `<tr data-href="${esc(href)}">
      <td class="c-title"><span class="le-tdlead">${icon(listIcon(l.icon))}</span><span class="le-tdbody"><a class="le-tdname" href="${esc(href)}">${esc(l.title)}</a>${l.description ? `<span class="le-tdsub">${esc(l.description)}</span>` : ''}</span></td>
      <td class="c-bills num">${n || DASH}</td><td class="c-followers num">${f || DASH}</td>
      <td class="c-status">${livePill(l)}</td><td class="c-owner">${esc(ownerName(l))}</td><td class="c-updated">${esc(shortDate(l.updated_at || l.created_at)) || DASH}</td></tr>`; };
  return `<div class="le-twrap"><table class="le-table le-tlists"><caption class="sr">Lists, ${plural(lists.length, 'list')}. Column headers sort. Select a name to open that list.</caption>
    <thead><tr>${COLS.map(c => thSort(c, v.sort)).join('')}</tr></thead><tbody>${sortBy(lists, v.sort, colValue).map(tr).join('')}</tbody></table></div>`;
}

export default {
  tab: 'outreach',
  title: () => 'Outreach',
  wide: () => true,
  render() {
    const v = S.leLists ??= { sort: null };
    const lists = (S.lists || []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.created_at || '').localeCompare(String(b.created_at || '')));
    const newBtn = btn('New list', { icon: 'list-plus', attrs: { 'data-le': 'new', 'aria-haspopup': 'dialog' } });
    const live = lists.filter(l => l.is_published).length, desk = isDesk();
    return `<div class="le-page${desk ? ' le-desk' : ''}${isSide() ? ' le-side' : ''}">
      ${pageHead('lists', 'Lists', `Sets of public bills that anyone can follow.${lists.length ? ` <span class="le-sum">${plural(lists.length, 'list')} · ${live} live</span>` : ''}`, lists.length ? newBtn : '')}
      ${!lists.length ? `<div class="le-empty">${empty({ title: 'No lists yet', text: 'A list is a set of public bills that anyone can follow, like Keiki health or Tobacco-free Hawaiʻi.', action: newBtn })}</div>`
        : desk ? `${listsTable(lists, v)}<p class="le-foot meta">${icon('users')}<span>To see who follows a list, open it and choose its followers.</span></p>`
        : `<div class="rows le-lists">${lists.map(listRow).join('')}</div>
        <p class="le-foot meta">${icon('users')}<span>To see who follows a list, open it and tap its followers.</span></p>`}
    </div>`;
  },
  wire(route, root) {
    root.querySelectorAll('[data-le="new"]').forEach(el => el.onclick = () => openListForm());
    wireTable(root, COLS, S.leLists ??= { sort: null });
  },
};
// Updated-on line, shared with the list page.
export const updatedLine = l => `updated ${fmtDate(l.updated_at || l.created_at)}`;
