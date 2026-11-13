// HIPHI public tracker: "Preview as the public sees it" (R-380, Nate 12 Nov). Staff press Preview in the staff app
// (staff6/preview.js), which leaves a note in localStorage ('hiphi-preview': the words as typed, saved or not, or a waiting
// change's words) and opens this page with ?preview=1. Only when BOTH the address says preview=1 and a note younger than
// 30 minutes exists does anything here switch on; without them this module does nothing at all, so the public page behaves
// exactly as before. No database writes happen to make a preview: the note is laid over the rows the page already loaded.
//
// Where the note is applied (one seam per way data arrives, so no screen needs to know about previews):
//   - live: the Supabase client's reads (previewClient, from kernel.js makeClient) pass public_all_bills, public_issues,
//     public_lists_v and public_list_bills_v through previewRows();
//   - the early catalog track.html asks for before any module arrives (window.__hiphiCatalog);
//   - the practice copy: demo.js's data object (previewDemo, from kernel.js init).
// Nothing is written while previewing: every network write to the database host is answered locally (a preview must never
// sign anyone up, follow, email, send a letter or count a visit), and the page's own storage writes go to memory.
const KEY = 'hiphi-preview', MAX_AGE = 30 * 60 * 1000;
const qs = new URLSearchParams(location.search);
// The real clock: the practice copy moves Date.now() to its pretend day, in the staff app and here alike (and not at the same
// moment), so the note's age is told by the page's own timer, which nothing moves.
const clock = () => Math.round(performance.timeOrigin + performance.now());

// The note is read with the browser's own storage before the memory overlay below is installed.
function readNote() {
  try {
    const n = JSON.parse(localStorage.getItem(KEY) || 'null');
    return n && n.kind && n.at && clock() - n.at < MAX_AGE && clock() >= n.at - 60000 ? n : null;
  } catch { return null; }
}
const NOTE = qs.get('preview') === '1' ? readNote() : null;
export const PREVIEW = !!NOTE;
export const previewNote = () => NOTE;

// ---------------- what a preview may not do ----------------
// Reads that look like writes to the network (POSTs that ask a question). Everything else sent to the database host
// (follows, sign-ups, letters, the first-visit and error logs, sign-in codes) is answered at once with an empty list.
const READS = /\/rest\/v1\/rpc\/(districts_at|public_bill_hearings|public_bill_hearing_history|address_suggest|shared_user_list|text_follows|partner_ask_results|my_[a-z_0-9]+)(\?|$)|\/functions\/v1\/geo-lookup/;
function guardNetwork() {
  const real = window.fetch.bind(window);
  window.fetch = (input, init) => {
    try {
      const req = input instanceof Request ? input : null, url = String(req ? req.url : input), method = String(init?.method || req?.method || 'GET').toUpperCase();
      if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && /\.supabase\.co\//.test(url) && !READS.test(url)) {
        console.info('[preview] not sent:', method, url.replace(/^https:\/\/[^/]+/, ''));
        return Promise.resolve(new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }));
      }
    } catch { /* fall through to the real fetch */ }
    return real(input, init);
  };
}
// Storage writes (follows, a name, the first-visit steps) stay in memory for this page, so nothing a previewer taps is kept in
// the browser the team also uses, and a copy of the catalog from an earlier visit is not read (it would hide the note's words).
function guardStorage() {
  const mem = new Map(), P = Storage.prototype, get = P.getItem, set = P.setItem, del = P.removeItem;
  const k = (s, key) => (s === localStorage ? 'l:' : 's:') + key, keep = key => key === KEY;
  P.getItem = function (key) { if (keep(key)) return get.call(this, key); if (key === 'hiphi_catalog') return null; const m = mem.get(k(this, key)); return m !== undefined ? m : get.call(this, key); };
  P.setItem = function (key, v) { if (keep(key)) return set.call(this, key, v); mem.set(k(this, key), String(v)); };
  P.removeItem = function (key) { if (keep(key)) return del.call(this, key); mem.set(k(this, key), null); };
}

// ---------------- laying the note over rows ----------------
const hstToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });
const pointsOf = v => Array.isArray(v) ? v : String(v || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
// Staff column -> the public view's column. The ask stops showing after its date, as the view does.
function billOver(b, f) {
  const o = { ...b };
  if ('nickname' in f) o.hiphi_nickname = f.nickname || null;
  if ('public_summary' in f) o.hiphi_summary = f.public_summary || null;
  if ('public_action' in f || 'public_action_until' in f) {
    const until = 'public_action_until' in f ? f.public_action_until : '9999-12-31', ask = 'public_action' in f ? f.public_action : o.hiphi_action;
    o.hiphi_action = ask && (!until || until >= hstToday()) ? ask : null;
  }
  if ('talking_points' in f) { const p = pointsOf(f.talking_points); o.hiphi_points = p.length ? p : null; }
  if (f.is_public === false) { o.hiphi_nickname = null; o.hiphi_points = null; }   // a hidden bill shows as the plain row, as the view gives it
  return o;
}
const ISSUE_KEYS = ['name', 'description', 'outlook', 'stance', 'first_visit', 'icon', 'recommended'];
const issueOver = (i, f) => { const o = { ...i }; for (const k of ISSUE_KEYS) if (k in f) o[k] = f[k]; return o; };
const listOver = (l, f) => { const o = { ...l }; for (const k of ['title', 'description', 'icon']) if (k in f) o[k] = f[k]; return o; };

// A list that has no public page yet (a draft) is drawn from the note's own copy: a row for it, and its bills in order.
const draftSlug = () => NOTE.list?.slug || 'preview';
const draftRow = () => ({ id: NOTE.id, slug: draftSlug(), title: NOTE.list?.title || NOTE.fields?.title || 'Untitled list', description: NOTE.list?.description || '', icon: NOTE.list?.icon || null,
  bills: (NOTE.list?.bills || []).length, followers: 0, featured: false, sort_order: 9999, curated_by: 'HIPHI', is_published: true });
const listBillRows = slug => (NOTE.list?.bills || []).map((x, n) => ({ list_id: NOTE.id, slug, bill_id: x.id, note: x.note || null, sort_order: n, added_at: new Date(0).toISOString() }));

function patchList(rows) {
  const f = { ...(NOTE.list ? { title: NOTE.list.title, description: NOTE.list.description, icon: NOTE.list.icon } : {}), ...(NOTE.fields || {}) };
  let hit = false;
  const out = rows.map(l => (l.id === NOTE.id || (NOTE.list?.slug && l.slug === NOTE.list.slug)) ? (hit = true, { ...listOver(l, f), slug: NOTE.list?.slug || l.slug, bills: NOTE.list?.bills ? NOTE.list.bills.length : l.bills }) : l);
  return hit ? out : [...out, draftRow()];
}
// Table by table, for the live client's answers.
export function previewRows(table, rows, ctx = {}) {
  if (!NOTE || !Array.isArray(rows)) return rows;
  const f = NOTE.fields || {};
  if (NOTE.kind === 'bill' && table === 'public_all_bills') return rows.map(b => b.id === NOTE.id ? billOver(b, f) : b);
  if (NOTE.kind === 'issue' && table === 'public_issues') return rows.map(i => i.id === NOTE.id ? issueOver(i, f) : i);
  if (NOTE.kind === 'list' && table === 'public_lists_v') return patchList(rows);
  if (NOTE.kind === 'list' && table === 'public_list_bills_v' && NOTE.list?.bills && (ctx.slug === draftSlug() || rows.some(r => r.list_id === NOTE.id))) return listBillRows(ctx.slug || draftSlug());
  return rows;
}

// The Supabase client, wrapped so reads of the four public views come back with the note laid over. A query builder is
// a thenable; its methods return itself, so the wrapper answers `then` and passes everything else through, keeping the
// `slug` a list's bills were asked for (public_list_bills_v is asked by slug).
export function previewClient(client) {
  if (!NOTE || !client) return client;
  const from = client.from.bind(client), TABLES = new Set(['public_all_bills', 'public_issues', 'public_lists_v', 'public_list_bills_v']);
  client.from = table => {
    const target = from(table);
    if (!TABLES.has(table)) return target;
    const ctx = {};
    // The query builder hands back a new builder at some steps (from() -> select()) and itself at others, so every builder
    // that comes back is wrapped the same way.
    // maybeSingle()/single() answer one row, not a list: it goes through the same patch as a list of one.
    const over = r => !r || !r.data ? r : Array.isArray(r.data) ? { ...r, data: previewRows(table, r.data, ctx) } : { ...r, data: previewRows(table, [r.data], ctx)[0] };
    const wrap = t => {
      const proxy = new Proxy(t, { get(_, prop) {
        if (prop === 'then') return (ok, no) => t.then(r => ok ? ok(over(r)) : r, no);
        if (prop === 'catch') return no => proxy.then(undefined, no);
        if (prop === 'finally') return fn => proxy.then(v => { fn?.(); return v; }, e => { fn?.(); throw e; });
        const v = Reflect.get(t, prop, t);
        if (typeof v !== 'function') return v;
        return (...a) => { if (prop === 'eq' && a[0] === 'slug') ctx.slug = a[1]; const r = v.apply(t, a); return r === t ? proxy : r && typeof r === 'object' ? wrap(r) : r; };
      } });
      return proxy;
    };
    return wrap(target);
  };
  return client;
}
// track.html's early fetches: the catalog, [categories, issues, links], and the page's one question.
function patchEarly() {
  const p = window.__hiphiCatalog; if (!p || !p.then) return;
  window.__hiphiCatalog = p.then(a => Array.isArray(a) ? [a[0], previewRows('public_issues', a[1]), a[2]] : a);
  window.__hiphiCatalog.catch(() => {});
  // And the one question for the page being opened (track.html __hiphiPage: public_bill_page / public_home), whose answer holds
  // the bill, or Home's bills, as public_all_bills rows.
  const q = window.__hiphiPage;
  if (q && q.then) {
    window.__hiphiPage = q.then(a => !a || typeof a !== 'object' || Array.isArray(a) ? a
      : { ...a, ...(a.bill ? { bill: previewRows('public_all_bills', [a.bill])[0] } : {}), ...(Array.isArray(a.bills) ? { bills: previewRows('public_all_bills', a.bills) } : {}) });
    window.__hiphiPage.catch(() => {});
  }
}
// The practice copy keeps its rows in demo.js's data object D.
export function previewDemo(D) {
  if (!NOTE || !D) return;
  D.bills = previewRows('public_all_bills', D.bills); D.issues = previewRows('public_issues', D.issues);
  if (NOTE.kind === 'list') {
    D.lists = patchList(D.lists);
    if (NOTE.list?.bills) { D.listBills = [...D.listBills.filter(r => r.list_id !== NOTE.id), ...listBillRows(draftSlug())]; }
  }
}

// ---------------- the band ----------------
function band() {
  const st = document.createElement('style');
  st.textContent = `.pv-band{position:fixed;top:0;left:0;right:0;z-index:2000;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;padding:8px 16px;background:#1f2a37;color:#fff;font:600 14px/1.3 Lato,system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.25)}
.pv-band span{max-width:60ch}.pv-band button{min-height:44px;padding:0 16px;border:2px solid #fff;border-radius:8px;background:transparent;color:#fff;font:inherit;cursor:pointer}
.pv-band button:hover{background:#fff;color:#1f2a37}.pv-band button:focus-visible{outline:3px solid #ffd54a;outline-offset:2px}
body.pv-on{padding-top:var(--pv-h,64px)}`;
  document.head.appendChild(st);
  const el = document.createElement('div');
  el.className = 'pv-band'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Preview');
  el.innerHTML = '<span>Preview, not live. Only you see this; nothing has changed on the public page.</span><button type="button">Close preview</button>';
  document.body.classList.add('pv-on'); document.body.prepend(el);
  const size = () => document.documentElement.style.setProperty('--pv-h', el.offsetHeight + 'px'); size(); addEventListener('resize', size);
  el.querySelector('button').onclick = () => {
    try { localStorage.removeItem(KEY); } catch { /* storage blocked */ }
    window.close();
    // A tab the browser will not close (opened by hand) goes back to the page as the public sees it.
    setTimeout(() => { const u = new URL(location.href); u.searchParams.delete('preview'); location.replace(u.href); }, 200);
  };
}

if (NOTE) {
  guardNetwork(); guardStorage(); patchEarly();
  const go = () => band();
  document.body ? go() : addEventListener('DOMContentLoaded', go);
}
