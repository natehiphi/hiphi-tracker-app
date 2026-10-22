// Put bills on your website (#/embed; R-212 #38, the Partner Staffer of the 8 Oct walks). embed.html, the table a partner
// pastes on their own site, has been there since the staff app, but its code was a door only staff held (Settings > Website
// embed, a coalition's Share card): a partner had to ask HIPHI for it. Here anyone makes it: which bills (all of HIPHI's,
// a coalition's, a topic's or one issue's), how many, and whether HIPHI's position shows (off for a group whose own position
// differs), then one button copies the code (A-20: the one filled button). The code is pub/embedsnippet.js's, the same
// as staff's. Nothing is saved and nothing is personal; the preview is the real table.
import { S, app, esc, DEMO, loadReference } from './core.js';
import { btn } from './ui.js';
import { recHead, recBack, recSec, wireKit } from './rec/kit.js';
import { embedSnippet } from './embedsnippet.js';

const E = S.em ??= { which: '', limit: '25', pos: true, coals: null };
const LIMITS = [['10', '10 bills'], ['25', '25 bills'], ['50', '50 bills'], ['500', 'All of them']];

function coalitions() {
  if (E.coals) return E.coals;
  if (S.coalitions?.length) return S.coalitions.filter(c => c.slug);   // the practice copy has them from the start; live, after the reference load
  if (!S.supa) return [];   // the first draw can come before boot() has the data connection; the next draw asks
  E.coals = [];
  loadReference().then(r => { E.coals = (r[3]?.data || []).filter(c => c.slug && (c.bills == null || c.bills > 0)); app.render(); }).catch(e => { console.error(e); E.coals = null; });
  return E.coals;
}
// The table's address: live data in the code (it goes on a real site); the practice copy's preview reads the practice data.
function src({ preview = false } = {}) {
  const u = new URL('embed.html', location.href); u.search = ''; u.hash = '';
  const [k, v] = E.which.split(':');
  if (k && v) u.searchParams.set(k, v);
  if (E.limit !== '50') u.searchParams.set('limit', E.limit);
  if (!E.pos) u.searchParams.set('position', 'hide');
  if (preview && DEMO) u.searchParams.set('demo', '1');
  return u.href;
}
const label = () => { const sel = document.querySelector('#em-which'); const t = sel?.selectedOptions[0]?.textContent; return E.which && t ? `${t}: bills from the HIPHI tracker` : 'Health bills from the HIPHI tracker'; };

// Back says where it goes: the page it was opened from (Every bill, This week's asks), else Find (week.js's rule).
function backRow() {
  const prev = history.state?.prev, name = prev && !/^#\/embed/.test(prev) ? app.placeName?.(prev) : '';
  return recBack(name ? prev : '#/find', name || 'Find');
}
function render() {
  const cs = coalitions(), withBills = i => (i.bill_ids || []).length;
  const issues = (S.issues || []).filter(withBills).sort((a, b) => a.name.localeCompare(b.name));
  const cats = (S.cats || []).filter(c => issues.some(i => (i.categories || [i.category]).includes(c.key)));
  const opt = (v, t) => `<option value="${esc(v)}"${E.which === v ? ' selected' : ''}>${esc(t)}</option>`;
  const which = `<div class="field"><label for="em-which">Which bills</label><select id="em-which">${opt('', 'Every bill HIPHI takes a stand on')}
      ${cs.length ? `<optgroup label="A HIPHI coalition">${cs.map(c => opt(`coalition:${c.slug}`, c.public_name || c.name)).join('')}</optgroup>` : ''}
      ${cats.length ? `<optgroup label="A topic">${cats.map(c => opt(`category:${c.key}`, c.name)).join('')}</optgroup>` : ''}
      ${issues.length ? `<optgroup label="One issue">${issues.map(i => opt(`issue:${i.slug}`, i.name)).join('')}</optgroup>` : ''}</select></div>`;
  const many = `<div class="field"><label for="em-limit">How many at most</label><select id="em-limit">${LIMITS.map(([v, t]) => `<option value="${v}"${E.limit === v ? ' selected' : ''}>${t}</option>`).join('')}</select>
      <span class="help">If there are more, visitors can search or tap “See every bill”.</span></div>`;
  const pos = `<label class="em-check"><input type="checkbox" id="em-pos"${E.pos ? ' checked' : ''}><span><b>Show HIPHI’s position on each bill</b>
      <span class="help">Uncheck it if your group’s position differs: the table then shows only where each bill stands.</span></span></label>`;
  return `<div class="rc em">${backRow()}${recHead({ title: 'Put bills on your website', lede: 'A table of bills and where each one stands, for your group’s website. It keeps itself up to date through the session.' })}
    ${recSec('em-what-h', 'What it shows', `${which}${many}${pos}`)}
    ${recSec('em-code-h', 'The code', `<div class="em-acts">${btn('Copy the code', { kind: 'primary', icon: 'copy', attrs: { 'data-em-copy': '' } })}${btn('Copy just the link', { kind: 'text', icon: 'link', attrs: { 'data-em-link': '' } })}</div>
      <p class="em-said" role="status" aria-live="polite"></p>
      <p class="rc-note em-how">Paste it where your site takes HTML: a Custom HTML block in WordPress, a Code block in Squarespace, Embed code in Wix. Sites that only take a link (Google Sites) take the link.</p>
      <label class="sr" for="em-code">The code</label><textarea id="em-code" class="input em-code" rows="5" readonly spellcheck="false"></textarea>`)}
    ${recSec('em-look-h', 'How it will look', `<div class="em-frame"><iframe id="em-prev" title="Preview of the table" loading="lazy"></iframe></div>`)}
  </div>`;
}

async function copy(text, box) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* no permission: select it to copy by hand */ }
  if (box) { box.focus(); box.select(); }
  return false;
}
let sized = false;
function wire() {
  const root = document.querySelector('.em'); if (!root) return;
  wireKit(root);
  const code = root.querySelector('#em-code'), prev = root.querySelector('#em-prev'), said = root.querySelector('.em-said');
  const update = () => { code.value = embedSnippet(src(), label()); const p = src({ preview: true }); if (prev.dataset.src !== p) { prev.dataset.src = p; prev.src = p; } said.textContent = ''; };
  update();
  root.querySelector('#em-which').onchange = e => { E.which = e.target.value; update(); };
  root.querySelector('#em-limit').onchange = e => { E.limit = e.target.value; update(); };
  root.querySelector('#em-pos').onchange = e => { E.pos = e.target.checked; update(); };
  root.querySelector('[data-em-copy]').onclick = async () => { said.textContent = await copy(code.value, code) ? 'Copied. Paste it into your website.' : 'Select the code and copy it.'; };
  root.querySelector('[data-em-link]').onclick = async () => { const u = src(); said.textContent = await copy(u) ? 'Link copied.' : `Copy this link: ${u}`; };
  // The preview sizes itself as the pasted code does (embed.html posts its height).
  if (!sized) { sized = true; addEventListener('message', e => { const f = document.querySelector('#em-prev'); if (f && e.source === f.contentWindow && e.data?.hiphiTrackerHeight) f.style.height = e.data.hiphiTrackerHeight + 'px'; }); }
}

// It belongs to Find, where it is reached from (R-303's calm pages: the page below a tab lights that tab).
export default { tab: 'find', title: () => 'Put bills on your website', render, wire };
