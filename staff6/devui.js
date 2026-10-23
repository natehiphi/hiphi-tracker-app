// #/dev/ui (R-336): every Staff v6 building block in every state, the living page builders check before a screen uses
// them (spec 4, 5). On a laptop the same page also shows itself at 390px in a frame beside, so both widths are seen at once
// (#/dev/ui?inner=1 is that inner copy, which draws no frame of its own). steps.js's parts (status, rows, the step card,
// the hearing card) show here once that file exists; until then their section says so.
import { S, esc } from './data.js';
import { icon, btn, iconBtn, chip, pickerChip, posChip, avatar, countdown, urgentMark, row, billRow, groupHead, segmented, whoseSeg, switchRow, field, stepBar, empty, skeleton,
  notice, inlineErr, toast, pickerSheet, menuSheet, confirmSheet, sectionNav, goingBtn, docBtn, filedBtn, showAllBtn } from './ui.js';
import { billRoute } from './model.js';

const TOKENS = [['page', 'The page ground'], ['card', 'Cards, lists, sheets'], ['wash', 'Wells, tiles, the open tab'], ['hair', 'Inset hairlines only'], ['ink', 'Headings, names'], ['body', 'Sentences'],
  ['muted', 'Meta, times, numbers'], ['field', 'Input edges'], ['action', 'Filled button, links, focus'], ['action-press', 'Hover and press'], ['action-wash', 'Tonal, selection'],
  ['leaf', 'Done, filed'], ['leaf-wash', 'Done ground'], ['late', 'Late, still accepted'], ['late-wash', 'Late ground'], ['bad', 'Missed, overdue'], ['bad-wash', 'Overdue ground'], ['coral', 'Celebration only'], ['band', 'Practice band']];
const sec = (id, h, body, note = '') => `<section class="dv-sec" aria-labelledby="dv-${id}"><h2 id="dv-${id}">${h}</h2>${note ? `<p>${note}</p>` : ''}${body}</section>`;

export default {
  tab: 'tools', title: () => 'Parts',
  render(route) {
    const inner = route.q?.inner === '1', wideNow = matchMedia('(min-width: 1100px)').matches;
    const b = S.bills.find(x => x.priority === 1 && x.nickname) || S.bills[0], b2 = S.bills.find(x => !x.nickname) || S.bills[3];
    const soon = new Date(Date.now() + 5 * 36e5).toISOString(), later = new Date(Date.now() + 3 * 864e5).toISOString(), late = new Date(Date.now() - 36e5).toISOString(), until = new Date(Date.now() + 2 * 36e5).toISOString();
    return `<div class="dv">
      <div><h1 class="v6-ptitle">Parts</h1>
      <p class="lede">Every Staff v6 building block, in the warm look (spec 4). One filled button per screen or region; every other action tonal or text; status tags never look like buttons.</p></div>
      ${!inner && wideNow ? sec('narrow', 'At 390px', `<div class="dv-frame"><iframe title="This page at 390 pixels wide" src="${esc(location.pathname + location.search)}#/dev/ui?inner=1"></iframe></div>`, 'The same page in a phone-wide frame, its top bar and tab bar included.') : ''}
      ${sec('col', 'Colour', `<div class="dv-sw">${TOKENS.map(([k, l]) => `<div class="dv-swatch"><i style="background:var(--v6-${k})"></i><b>${k}</b><code>--v6-${k}</code><span>${l}</span></div>`).join('')}</div>`, 'Palette B, Morning Reef (D6). Amber only for late but still accepted, red only for missed or overdue, green only for done, coral only to celebrate (D3).')}
      ${sec('type', 'Type', `<div class="dv-type"><p style="font:700 var(--v6-t28)/var(--v6-lh28) var(--font-h);color:var(--v6-ink)">Page title, 28 Poppins</p><p style="font:600 var(--v6-t22)/var(--v6-lh22) var(--font-h);color:var(--v6-ink)">Section heading, 22 Poppins</p>
        <p style="font:600 var(--v6-t18)/var(--v6-lh18) var(--font-h);color:var(--v6-ink)">Item name, 18 Poppins</p><p>Every sentence, a row’s second line, buttons and fields: 16 Lato.</p><p class="small muted">Labels, counts, times and bill numbers only: 14 Lato.</p></div>`)}
      ${sec('shape', 'Shape and depth', `<div class="dv-shadows"><div style="box-shadow:var(--v6-sh1)">sh1 · resting</div><div style="box-shadow:var(--v6-sh2)">sh2 · hover</div><div style="box-shadow:var(--v6-sh3)">sh3 · sheet</div>
        <div style="border-radius:var(--v6-r12);box-shadow:var(--v6-sh1)">r12 · tiles</div><div style="border-radius:var(--v6-pill);box-shadow:var(--v6-sh1)">pill · buttons</div></div>`, 'Three radii (12, 20, pill), three warm shadows, never a border on the same box.')}
      ${sec('btn', 'Buttons', `<div class="dv-row">${btn('File at the Capitol', { iconEnd: 'external-link' })}${btn('Send back', { kind: 'secondary' })}${btn('Show all', { kind: 'text' })}${btn('Small tonal', { kind: 'secondary', sm: true })}</div>
        <div class="dv-row">${goingBtn(false, {}, { kind: 'secondary' })}${goingBtn(true, {}, { kind: 'secondary' })}${docBtn('https://docs.google.com', { kind: 'secondary' })}${filedBtn()}${showAllBtn(12, {}, { open: false })}</div>
        <div class="dv-row">${btn('Saving', { kind: 'secondary', attrs: { 'aria-busy': 'true' }, icon: 'loader-circle' })}${btn('Not yet', { kind: 'secondary', attrs: { disabled: true } })}${iconBtn('ellipsis', 'More')}${btn('Delete', { kind: 'secondary', attrs: { 'data-dv': 'confirm' } })}</div>`, 'Filled for the step this person takes now, once per screen or region; tonal for the rest; text for minor actions; danger only inside a confirm (press Delete).')}
      ${sec('tabs', 'Page tabs and switches', `${sectionNav('testimony', 'approve', { hide: ['missed'], counts: { approve: 3 } })}<div class="dv-row">${segmented('dvseg', [['list', 'List'], ['table', 'Table']], 'list', 'Show bills as')}${whoseSeg('dvwho', { mine: 'mine', coal: 'coal', team: 'team' }, 'mine')}</div>`, 'A place’s pages are pill tabs on the page (D12); a switch that shows the same list another way has its own track.')}
      ${sec('rows', 'Rows and lists', `<div class="rows">${groupHead('Do today', 2)}${billRow(b, { sub: 'File your testimony · due today 3:00 PM', href: billRoute(b) })}${billRow(b2, { sub: 'Kris approves · due Wed 3/18', href: billRoute(b2) })}
        ${row({ lead: 'users', title: 'Leilani Kahale', sub: 'Oʻahu · Senate district 17 · active 3/16', href: '#/dev/ui' })}${groupHead('Done', 4, { fold: 'dvdone', open: false })}</div>`, 'A list is one card; rows are a name and one line, parted by an inset hairline; 64px on a laptop, 72px on a phone.')}
      ${sec('cards', 'Cards', `<div class="card"><h3>A resting card</h3><p>No border: white on sand, a soft shadow.</p></div><div class="card tint"><p>A tinted card: the action wash, for a gentle highlight.</p></div><div class="card done"><p>A done card: the leaf wash.</p></div>`)}
      ${sec('status', 'Status', `<div class="dv-row">${chip('Scheduled')}${chip('Writing · sent back by Kris', 'info')}${chip('Late, still accepted until 1:10 PM', 'warn', 'clock')}${chip('Overdue', 'danger', 'circle-alert')}${chip('Filed', 'ok', 'check')}${posChip('strongly_support')}</div>
        <div class="dv-row">${countdown(later)}${countdown(soon)}${countdown(late, { until })}${countdown(late)}</div>
        <div class="dv-row">${urgentMark(later, { act: 'to file' })}${urgentMark(soon, { act: 'to file' })}${urgentMark(late, { until, act: 'to file' })}${urgentMark(late)}${urgentMark(null, { done: true })}</div>
        <div class="dv-row">${avatar(S.me)}${avatar(S.advocates[1])}${avatar(S.me, 32)}${avatar(null)}</div>`, 'Neutral by default; amber, red and green only by exception, each with its icon and its word (D3). The tiles are v5’s: v6 rows carry none (V04).')}
      ${sec('steps', 'Steps’ parts', '<div id="dv-stepsbox"><p class="muted">Looking for steps.js…</p></div>', 'From staff6/steps.js (spec 5): status(), the row, the step card and the hearing card.')}
      ${sec('notice', 'Notices', `${notice('info', 'info', 'Email to the public is paused until Nate says so; you can write and approve, nothing sends.')}${notice('ok', 'circle-check', 'Filed. HB 1562 is done for Senate Health.')}
        ${notice('warn', 'clock', 'Late, still accepted until 1:10 PM today.')}${notice('bad', 'circle-alert', 'Overdue: testimony closed at 9:30 AM.', btn('Mark filed (late)', { kind: 'secondary', sm: true }))}${inlineErr('dv-e1', 'Replace the text in brackets first')}`)}
      ${sec('fields', 'Fields', `${field('dv-f1', 'Capitol confirmation link', '<input id="dv-f1" type="url" placeholder="https://">', 'Paste the link from the green box.')}
        <div class="field"><label for="dv-f2">What should change?</label><textarea id="dv-f2" aria-invalid="true" aria-describedby="dv-f2e"></textarea><span class="err" id="dv-f2e">${icon('circle-alert')}Write a note for Kevin first</span></div>
        ${field('dv-f3', 'Position', '<select id="dv-f3"><option>Strong support</option><option>Support</option><option>Monitor</option></select>')}
        <div class="dv-row">${pickerChip('Strong support', { 'data-dv': 'pick' }, 'thumbs-up')}<button type="button" class="chip" aria-pressed="true">This week</button><button type="button" class="chip" aria-pressed="false">House</button></div>
        <div class="card">${switchRow('dv-sw1', 'Slack DM when someone mentions me', true, 'Off means only the Inbox')}${switchRow('dv-sw2', 'Hearing alerts', false)}</div>
        ${stepBar('review')}`)}
      ${sec('sheet', 'Sheets and messages', `<div class="dv-row">${btn('Picker', { kind: 'secondary', attrs: { 'data-dv': 'pick' } })}${btn('Menu', { kind: 'secondary', attrs: { 'data-dv': 'menu' } })}${btn('Message with Undo', { kind: 'secondary', attrs: { 'data-dv': 'toast' } })}${btn('Error message', { kind: 'secondary', attrs: { 'data-dv': 'err' } })}</div>`)}
      ${sec('empty', 'Empty and loading', `${empty({ title: 'All clear for today.', text: 'Your next hearing is Wed 3/18 at 2:00 PM.', action: btn('See this week', { kind: 'secondary', href: '#/hearings' }) })}${skeleton(2)}`)}
    </div>`;
  },
  wire(route, root) {
    const on = (k, f) => root.querySelectorAll(`[data-dv="${k}"]`).forEach(el => { el.onclick = f; });
    on('pick', () => pickerSheet({ title: 'Position', value: 'support', options: [['strongly_support', 'Strong support', 'thumbs-up'], ['support', 'Support', 'thumbs-up'], ['oppose', 'Oppose', 'thumbs-down'], ['monitor', 'Monitor', 'eye']], onPick: v => toast('Saved: ' + v, { ok: true }) }));
    on('menu', () => menuSheet({ items: [{ label: 'Open bill', icon: 'scroll-text', run: () => {} }, { label: 'Mute this bill', icon: 'bell-off', disabled: true, reason: 'This bill has a hearing on 3/18. It can be muted once that hearing is over.' }, { label: 'Stop tracking', icon: 'eye-off', run: () => {} }] }));
    on('confirm', async () => toast((await confirmSheet({ title: 'Delete this group?', text: 'The people stay; only the saved group goes.', ok: 'Delete', danger: true })) ? 'Deleted' : 'Kept'));
    on('toast', () => toast('Filed. HB 1562 is done for Senate Health.', { ok: true, undo: () => toast('Undone') }));
    on('err', () => toast('That did not save. Check your connection and try again.', { err: true }));
    root.querySelectorAll('[data-seg="dvseg"], [data-seg="dvwho"]').forEach(el => { el.onclick = () => el.parentElement.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === el))); });
    root.querySelectorAll('button.chip[aria-pressed]').forEach(el => { el.onclick = () => el.setAttribute('aria-pressed', String(el.getAttribute('aria-pressed') !== 'true')); });
    // steps.js (STEPS builder): shown when it exists; every call is guarded, so a part that changed shape says so instead of breaking the page.
    const box = root.querySelector('#dv-stepsbox');
    import('./steps.js').then(m => {
      if (!box.isConnected) return;
      const b = S.bills.find(x => x.priority === 1 && x.nickname) || S.bills[0], h = (S.hearings || []).find(x => x.status === 'scheduled'), parts = [];
      const tryPart = (name, f) => { try { const out = f(); if (out) parts.push(`<div class="dv-sec"><h3>${name}</h3>${out}</div>`); } catch (e) { parts.push(`<p class="muted">${name}: ${esc(e.message || String(e))}</p>`); } };
      if (m.status) tryPart('status()', () => ['neutral', 'late', 'overdue', 'done'].map(t => JSON.stringify(m.status({ tone: t }))).map(s => `<code>${esc(s)}</code>`).join('<br>'));
      if (m.billRow) tryPart('billRow()', () => `<div class="rows">${m.billRow(b, { line: 'File your testimony · due today 3:00 PM' })}</div>`);
      if (m.stepCard) tryPart('stepCard()', () => m.stepCard(b, { viewer: S.me, where: 'dev' }));
      if (m.hearingCard && h) tryPart('hearingCard()', () => m.hearingCard(h, { viewer: S.me }));
      box.innerHTML = parts.join('') || '<p class="muted">steps.js is here but exports none of status, billRow, stepCard, hearingCard yet.</p>';
    }).catch(() => { if (box.isConnected) box.innerHTML = '<p class="muted">steps.js arrives with the STEPS builder; its parts show here then.</p>'; });
  },
};
