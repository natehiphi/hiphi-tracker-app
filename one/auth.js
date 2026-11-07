// The person's account for act.html (R-360 part 7, Nate 6 Nov: "people must be able to manage their profile").
//
// Live: the Supabase client, loaded only when it is needed (the You tab, or an account to write to after a follow or a
// sent letter), from the same pinned CDN address, the same publishable key and the same session storage key as the
// tracker (pub/kernel.js SUPABASE_JS, AUTH), so someone signed in on track.html is signed in here too, and the other way
// round. Signed-in calls are the tracker's own (rule 3: anon reads only public_* views and RPCs; these are the person's
// own rows): ensure_public_user, my_profile_v2 / save_my_profile_v2, public_users.prefs, issue_follows, category_follows,
// set_issue_alert_level, my_letters, public_actions, text_signup and delete_my_account.
// Practice copy (?demo=1): no account and no email. "Practice: sign in as a tester" keeps a fake account in this tab's
// sessionStorage (hiphi_act_fake), so the signed-in screen, its saves and the merges can be tried and tested; nothing
// reaches the database.
//
// At sign-in what this device holds joins the account, as pub/kernel.js loadUser does: the name (and the town) fill an
// account that has none, then the account's come to the device (hiphi_me, marked with the account's id; another
// account's leftovers are cleared first); the issues and topics followed here are added to the account's and the union
// is kept on both; each issue's alert level comes from the account; the letters (hiphi_me.letters) and my_letters meet,
// the newer one winning for a bill and kind (pub/letters.js syncLetters); the done marks join public_actions and the
// account's come here (pub/core.js loadActions).
import { URL_, KEY, DEMO, loadList } from './data.js';
import { DONE, DONE_AT } from './done.js';

const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';   // pub/kernel.js: change both together
const STORE = 'hiphi-public-auth';   // pub/kernel.js AUTH.storageKey: one sign-in for the tracker and this page
const FAKE = 'hiphi_act_fake';
export const ISSUES_KEY = DEMO ? 'hiphi_issue_follows_demo' : 'hiphi_issue_follows';
export const CATS_KEY = DEMO ? 'hiphi_cat_follows_demo' : 'hiphi_cat_follows';
export const LEVELS_KEY = DEMO ? 'hiphi_issue_levels_demo' : 'hiphi_issue_levels';   // pub/kernel.js LEVELS_KEY
export const TEXT_KEY = DEMO ? 'hiphi_text_demo' : 'hiphi_text';                     // pub/kernel.js TEXT_KEY (the sandbox's own copy)
const WATCH_KEY = DEMO ? 'hiphi_watch_ids_demo' : 'hiphi_watch_ids';                 // pub/kernel.js LOCAL_KEY: bills followed on their own
export const LEVELS = ['every', 'big', 'app'];
// The profile keys a device keeps for its account (pub/kernel.js PROFILE_KEYS), and the town, which act.html keeps beside them.
const PROFILE_KEYS = ['acct', 'name', 'email', 'closing', 'why', 'whyBill', 'introWhy', 'introIssue', 'titles', 'story', 'stories', 'quote', 'quoteAsked', 'interests', 'helpNote', 'drafts', 'mail', 'letters', 'capitolAcct', 'town', 'actDrafts'];
const KINDS = ['testimony', 'email'];   // the done marks public_actions takes from this page (the chair's ask mark stays on the device)

// ---- the device's copies ----
const readJ = (k, empty, store = localStorage) => { try { const v = JSON.parse(store.getItem(k) || 'null'); return v ?? empty; } catch { return empty; } };
const writeJ = (k, v, store = localStorage) => { try { store.setItem(k, JSON.stringify(v)); } catch { /* private mode: kept for this visit only */ } };
export const loadMe = () => { const m = readJ('hiphi_me', {}); return m && typeof m === 'object' ? m : {}; };
const saveMe = patch => writeJ('hiphi_me', { ...loadMe(), ...patch });
export const readSet = k => { const v = readJ(k, []); return new Set(Array.isArray(v) ? v : []); };
const writeSet = (k, s) => writeJ(k, [...s]);
export const levelsHere = () => { const o = readJ(LEVELS_KEY, {}); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; };
export const levelOf = id => LEVELS.includes(levelsHere()[id]) ? levelsHere()[id] : 'big';
export const textSaved = () => { const t = readJ(TEXT_KEY, null); return t && t.token && /^\d{10}$/.test(t.phone || '') ? t : null; };
const slotOf = (kind, bill) => kind === 'email' ? 'email:' + bill : bill;
const okLetter = L => !!L && L.v === 1 && typeof L.bill === 'string';
export const lettersHere = () => { const L = loadMe().letters; return L && typeof L === 'object' ? L : {}; };
const writeLetters = letters => saveMe({ letters });

// ---- the client (live) ----
let clientP = null;
export const client = () => clientP ??= import(SUPABASE_JS)
  .then(({ createClient }) => createClient(URL_.replace(/\/rest\/v1\/$/, ''), KEY, { auth: { storageKey: STORE } }))
  .catch(e => { clientP = null; throw e; });
// Is someone signed in on this device? Without loading anything: the practice copy's fake account, or the tracker's
// stored session (its truth is checked when the account loads).
export const signedInHint = () => DEMO ? !!readJ(FAKE, null, sessionStorage) : (() => { try { return !!localStorage.getItem(STORE); } catch { return false; } })();
const plain = text => Object.assign(new Error(text), { plain: true });
const must = r => { if (r && r.error) throw r.error; return r; };

// ---- the two backends: the account's rows (live) and the practice copy's fake account ----
const fake = () => readJ(FAKE, null, sessionStorage);
const fakeSet = f => writeJ(FAKE, f, sessionStorage);
const fakeEdit = fn => { const f = fake(); if (!f) throw plain('Signed out'); fn(f); fakeSet(f); };

const LIVE = {
  async start() {
    const sb = await client(), { data } = await sb.auth.getSession(), s = data?.session;
    if (!s) return null;
    const u = await sb.rpc('ensure_public_user');
    if (u.error) {
      if (/staff/.test(u.error.message || '')) { await sb.auth.signOut({ scope: 'local' }); throw plain('Staff accounts use the main app.'); }
      throw u.error;
    }
    let name = '';
    try { const v2 = await sb.rpc('my_profile_v2'); if (!v2.error && v2.data) name = v2.data.name || ''; } catch { /* the name is only shown; the device's stays */ }
    return { id: u.data.id, email: s.user?.email || '', prefs: u.data.prefs || {}, name };
  },
  async follows() {
    const sb = await client();
    let r = await sb.from('issue_follows').select('issue_id,alert_level');
    if (r.error) r = must(await sb.from('issue_follows').select('issue_id'));   // before backend 181 there is no level column
    const c = must(await sb.from('category_follows').select('category'));
    return { issues: (r.data || []).map(x => x.issue_id), levels: Object.fromEntries((r.data || []).filter(x => LEVELS.includes(x.alert_level) && x.alert_level !== 'big').map(x => [x.issue_id, x.alert_level])),
      cats: (c.data || []).map(x => x.category) };
  },
  async follow({ addI = [], delI = [], addC = [], delC = [] }) {
    const sb = await client(), uid = A.id, calls = [];
    if (addI.length) calls.push(sb.from('issue_follows').insert(addI.map(issue_id => ({ user_id: uid, issue_id }))));
    if (delI.length) calls.push(sb.from('issue_follows').delete().eq('user_id', uid).in('issue_id', delI));
    if (addC.length) calls.push(sb.from('category_follows').insert(addC.map(category => ({ user_id: uid, category }))));
    if (delC.length) calls.push(sb.from('category_follows').delete().eq('user_id', uid).in('category', delC));
    for (const r of await Promise.all(calls)) must(r);
  },
  async letters() {
    const r = must(await (await client()).from('my_letters').select('bill_id,kind,letter,sent_at'));
    return Object.fromEntries((r.data || []).filter(x => okLetter(x.letter)).map(x => [slotOf(x.kind, x.bill_id), { ...x.letter, kind: x.kind }]));
  },
  // Update, else insert: an upsert would also rewrite bill_id and kind, which the account may not change (backend 124, 126).
  async putLetter(rec) {
    const sb = await client(), kind = rec.kind === 'email' ? 'email' : 'testimony', row = { letter: rec, sent_at: rec.sent };
    const u = must(await sb.from('my_letters').update(row).eq('bill_id', rec.bill).eq('kind', kind).select('bill_id'));
    if (!(u.data || []).length) must(await sb.from('my_letters').insert({ bill_id: rec.bill, kind, ...row }));
  },
  async delLetter(bill, kind) { must(await (await client()).from('my_letters').delete().eq('bill_id', bill).eq('kind', kind)); },
  async actions() {
    const r = must(await (await client()).from('public_actions').select('bill_id,hearing_id,kind,created_at'));
    return (r.data || []).map(a => ({ key: `${a.bill_id}|${a.hearing_id || ''}|${a.kind}`, at: a.created_at }));
  },
  async addActions(rows) {
    const sb = await client(), up = rows.map(r => ({ user_id: A.id, ...r }));
    const r = await sb.from('public_actions').upsert(up, { onConflict: 'user_id,bill_id,hearing_id,kind', ignoreDuplicates: true });
    if (r.error) for (const row of up) await sb.from('public_actions').upsert(row, { onConflict: 'user_id,bill_id,hearing_id,kind', ignoreDuplicates: true });
  },
  async saveName(name) { must(await (await client()).rpc('save_my_profile_v2', { p: { name } })); },
  async savePrefs(prefs) { must(await (await client()).from('public_users').update({ prefs }).eq('id', A.id)); },
  // It returns the level kept, or null when the account refused it (backend 181).
  async setLevel(issue, level) { const r = await (await client()).rpc('set_issue_alert_level', { p_issue: issue, p_level: level, p_via: 'profile' }); if (r.error) throw r.error; if (r.data !== level) throw plain('We couldn’t save that just now. Try again in a moment.'); },
  async textSignup(p) {
    const { data, error } = await (await client()).rpc('text_signup', { p });
    if (error) throw error;
    if (!data?.ok) throw plain(data?.why === 'phone' ? PHONE_ERR : data?.why === 'busy' ? 'That number can’t be added just now. Try again later, or use email instead.' : 'That didn’t save. Try again.');
  },
  async changeEmail(email) {
    const { error } = await (await client()).auth.updateUser({ email }, { emailRedirectTo: here() });
    if (error) {
      if (error.code === 'email_exists' || /already been registered|already registered/i.test(error.message || '')) throw plain('That email already has a profile. Sign out, then sign in with that email.');
      throw error;
    }
  },
  async deleteAccount() { must(await (await client()).rpc('delete_my_account')); try { await (await client()).auth.signOut(); } catch { /* the account is already deleted */ } },
  async signOut() { const { error } = await (await client()).auth.signOut(); if (error) throw error; },
  // R-360 part 8: the letter sent from inside the app (backend 194 send_my_letter). Until 194 is applied the function is
  // missing (PostgREST answers 404, PGRST202): the letter is then kept on the account as the tracker keeps one (my_letters)
  // and treated as held, so the person hears the held words and nothing is lost.
  async sendLetter(p) {
    const sb = await client(), r = await sb.rpc('send_my_letter', { p });
    if (r.error) {
      if (r.status === 404 || r.error.code === 'PGRST202') {
        console.debug('send_my_letter is not applied yet (404): the letter is kept on the account as held');
        await LIVE.putLetter({ ...p.letter, via: 'app', status: 'held' }).catch(e => console.warn('letter:', e?.message || e));
        return { status: 'held', held: true, to_count: 0, missing: true };
      }
      // The function's refusals arrive as the exception's message (not_signed_in, email_not_confirmed, already_sent, ...).
      throw Object.assign(new Error(r.error.message || 'send failed'), { code: String(r.error.message || '').trim() });
    }
    return r.data;
  },
};
const FAKE_OPS = {
  async start() { const f = fake(); return f ? { id: f.id, email: f.email, prefs: f.prefs || {}, name: f.name || '' } : null; },
  async follows() { const f = fake() || {}; return { issues: f.follows || [], levels: f.levels || {}, cats: f.cats || [] }; },
  async follow({ addI = [], delI = [], addC = [], delC = [] }) { fakeEdit(f => {
    f.follows = [...new Set([...(f.follows || []), ...addI])].filter(x => !delI.includes(x));
    f.cats = [...new Set([...(f.cats || []), ...addC])].filter(x => !delC.includes(x));
    for (const id of delI) delete (f.levels || {})[id]; }); },
  async letters() { return { ...(fake()?.letters || {}) }; },
  async putLetter(rec) { fakeEdit(f => { f.letters = { ...(f.letters || {}), [slotOf(rec.kind, rec.bill)]: rec }; }); },
  async delLetter(bill, kind) { fakeEdit(f => { delete (f.letters || {})[slotOf(kind, bill)]; }); },
  async actions() { return (fake()?.actions || []).slice(); },
  async addActions(rows) { fakeEdit(f => { const have = new Set((f.actions || []).map(a => a.key));
    f.actions = [...(f.actions || []), ...rows.map(r => ({ key: `${r.bill_id}|${r.hearing_id || ''}|${r.kind}`, at: r.created_at || new Date().toISOString() })).filter(a => !have.has(a.key))]; }); },
  async saveName(name) { fakeEdit(f => { f.name = name; }); },
  async savePrefs(prefs) { fakeEdit(f => { f.prefs = prefs; }); },
  async setLevel(issue, level) { fakeEdit(f => { f.follows = [...new Set([...(f.follows || []), issue])]; f.levels = { ...(f.levels || {}), [issue]: level }; if (level === 'big') delete f.levels[issue]; }); },
  async textSignup() { /* the practice copy keeps the number on this device only */ },
  async changeEmail() { /* the practice copy sends nothing; the email stays as it is */ },
  async deleteAccount() { try { sessionStorage.removeItem(FAKE); } catch { /* ignore */ } },
  async signOut() { try { sessionStorage.removeItem(FAKE); } catch { /* ignore */ } },
  // The practice copy sends nothing: after 600 ms it answers as send_my_letter would with the switch on (queued: the letter
  // and the done mark on the fake account), or, with ?held=1 in the address, as it does with the switch off (held: the
  // letter only), so both can be seen and tested.
  async sendLetter(p) {
    await new Promise(r => setTimeout(r, 600));
    const held = new URLSearchParams(location.search).get('held') === '1', status = held ? 'held' : 'queued';
    fakeEdit(f => {
      f.letters = { ...(f.letters || {}), [slotOf(p.kind, p.bill_id)]: { ...p.letter, via: 'app', status } };
      const key = `${p.bill_id}|${p.hearing_id || ''}|${p.kind}`;
      if (!held && !(f.actions || []).some(a => a.key === key)) f.actions = [...(f.actions || []), { key, at: new Date().toISOString() }];
    });
    return { id: 1, status, held, to_count: p.kind === 'email' ? 1 : 5 };
  },
};
const ops = () => DEMO ? FAKE_OPS : LIVE;

// ---- the account, once a page life ----
// A: { id, email, prefs, name } while signed in, else null. loadAccount() signs it in on this page (and runs the merge,
// once per account a page life); its answer is kept, so the rest of the page can ask acct() without waiting.
let A = null, loading = null, merged = '';
export const acct = () => A;
export function loadAccount({ fresh = false } = {}) {
  if (fresh) { loading = null; }
  loading ??= (async () => {
    const a = await ops().start();
    A = a;
    if (a && merged !== a.id) { await mergeIn(); merged = a.id; }
    return A;
  })().catch(e => { loading = null; throw e; });
  return loading;
}
// Signed in on this device: the account (loaded once), else null; never throws (a failure leaves the device's copies).
async function maybe() { if (!signedInHint()) return null; try { return await loadAccount(); } catch { return null; } }

async function mergeIn() {
  const o = ops();
  // The profile. Another account's leftovers go first; then what this device made signed out fills what the account
  // lacks; then the account's come here. The town is kept in public_users.prefs.town for now: the people table
  // (my_profile_v2) has no town column, and a new column waits for a migration (rule 5).
  let me = loadMe();
  if (me.acct && me.acct !== A.id) { for (const k of PROFILE_KEYS) delete me[k]; writeJ('hiphi_me', me); }
  if (!me.acct) {
    const nm = String(me.name || '').trim(), town = String(me.town || '').trim();
    if (!A.name && nm) { try { await o.saveName(nm); A.name = nm; } catch { /* kept here; tried again next time */ } }
    if (!A.prefs.town && town) { const prefs = { ...A.prefs, town }; try { await o.savePrefs(prefs); A.prefs = prefs; } catch { /* as above */ } }
  }
  saveMe({ acct: A.id, name: A.name || '', town: A.prefs.town || '' });
  // Issues and topics followed: the union, on both. Only issues the public list knows join the account (a stale id would
  // fail the whole insert).
  try {
    let known = null; try { known = new Set((await loadList()).issues.map(i => i.id)); } catch { /* every id is tried */ }
    const F = await o.follows(), here = [...readSet(ISSUES_KEY)].filter(id => !known || known.has(id)), cats = [...readSet(CATS_KEY)];
    const addI = here.filter(id => !F.issues.includes(id)), addC = cats.filter(c => !F.cats.includes(c));
    if (addI.length || addC.length) await o.follow({ addI, addC });
    writeSet(ISSUES_KEY, new Set([...F.issues, ...here, ...readSet(ISSUES_KEY)]));
    writeSet(CATS_KEY, new Set([...F.cats, ...cats]));
    writeJ(LEVELS_KEY, F.levels);   // each issue's level rides on its follow (R-299): the account's
  } catch (e) { console.warn('follows:', e?.message || e); }
  // Letters: the newer one wins for a bill and kind; this device's newer ones go up.
  try {
    const there = await o.letters(), here = lettersHere(), all = { ...here };
    for (const [k, L] of Object.entries(there)) if (okLetter(L) && (!all[k] || String(L.sent) > String(all[k].sent))) all[k] = L;
    writeLetters(all);
    for (const [k, L] of Object.entries(here)) if (okLetter(L) && (!there[k] || String(L.sent) > String(there[k].sent))) await o.putLetter(L).catch(() => {});
  } catch (e) { console.warn('letters:', e?.message || e); }
  // The done marks ("I did it"): this device's join public_actions; the account's come here.
  try {
    const there = await o.actions(), have = new Set(there.map(a => a.key)), done = readSet(DONE), at = readJ(DONE_AT, {});
    const up = [...done].filter(k => !have.has(k)).map(k => { const [bill_id, hearing_id, kind] = k.split('|'); return { bill_id, hearing_id: hearing_id || null, kind, ...(at[k] ? { created_at: at[k] } : {}) }; }).filter(r => KINDS.includes(r.kind));
    if (up.length) await o.addActions(up);
    for (const a of there) { done.add(a.key); if (a.at && !at[a.key]) at[a.key] = a.at; }
    writeSet(DONE, done); writeJ(DONE_AT, at);
  } catch (e) { console.warn('actions:', e?.message || e); }
}

// ---- signing in and out ----
// The address the link comes back to: this page, the practice copy's ?demo kept (it sends nothing, but the address stays
// the practice copy's). Live, act.html must be in Supabase's allowed redirect URLs (R-337), or the link opens track.html.
const here = () => location.origin + location.pathname + (DEMO ? '?demo=1' : '');
export const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim());
// Signing in is never consent to email (C-4): no alert choice rides on this link.
// back (R-360 part 8): the route to come back to (the Send screen), kept on this device for two hours; app.js opens it
// after the link instead of You. Kept here, not in the redirect address: Supabase adds its answer to the address's hash.
const BACK = 'hiphi_act_back';
export function sendLink(email, { back = '' } = {}) {
  if (back) writeJ(BACK, { hash: back, at: Date.now() }); else { try { localStorage.removeItem(BACK); } catch { /* ignore */ } }
  return linkTo(email);
}
export const backRoute = () => {
  const b = readJ(BACK, null); try { localStorage.removeItem(BACK); } catch { /* ignore */ }
  return b && typeof b.hash === 'string' && /^#\//.test(b.hash) && Date.now() - (+b.at || 0) < 2 * 3600e3 ? b.hash : '';
};
async function linkTo(email) {
  if (DEMO) return { demo: true };
  const sb = await client();
  const { error } = await sb.auth.signInWithOtp({ email: String(email).trim(), options: { emailRedirectTo: here() } });
  if (error) throw error;
  return { sent: true };
}
export async function practiceSignIn() {
  if (!DEMO) return null;
  fakeSet({ id: 'practice-tester', email: 'tester@example.com', name: '', prefs: {}, follows: [], cats: [], levels: {}, letters: {}, actions: [] });
  merged = ''; return loadAccount({ fresh: true });
}
// Signing out: the profile leaves this device (R-156: the next person on a shared phone starts fresh); the follows stay,
// as the tracker keeps them (its words: "Your bills stay on this device, and your profile in your account").
export async function signOut() {
  await ops().signOut();
  const me = loadMe(); for (const k of PROFILE_KEYS) delete me[k]; writeJ('hiphi_me', me);
  A = null; loading = null; merged = '';
}
// Delete my data: the account goes (delete_my_account), and its copies on this device with it (pub/profile.js
// forgetEverythingHere: follows, levels, done marks, the profile and its letters, a number kept for texts).
export async function deleteAll() {
  await ops().deleteAccount();
  try { [ISSUES_KEY, CATS_KEY, LEVELS_KEY, WATCH_KEY, DONE, DONE_AT, TEXT_KEY, 'hiphi_consent_pending'].forEach(k => localStorage.removeItem(k)); } catch { /* private mode */ }
  const me = loadMe(); for (const k of PROFILE_KEYS) delete me[k]; writeJ('hiphi_me', me);
  A = null; loading = null; merged = '';
}
// The link came back with an error (an old or used link): Supabase puts it in the address, read once as the page opens
// (app.js then replaces the address with #/you) and said once on You.
let linkErr = /(^|[#&])error_description=/.test(location.hash) || /[?&]error_description=/.test(location.search);
export const linkError = () => { const e = linkErr; linkErr = false; return e; };
export const linkErrorPending = () => linkErr;
// The page was opened from a sign-in link: the client reads the session from the address (detectSessionInUrl).
export const fromLink = () => /(^|[#&?])(access_token|error_description|refresh_token)=/.test(location.hash) || /[?&]code=/.test(location.search);
export async function finishLink() { if (DEMO) return; try { const sb = await client(); await sb.auth.getSession(); } catch { /* the You screen says what it can */ } }

// ---- the saves (each throws a sentence-ready error; the device keeps its copy either way) ----
export async function saveAbout({ name, town }) {
  const nm = String(name || '').trim().slice(0, 80), tw = String(town || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (A) {
    if (nm !== (A.name || '')) { await ops().saveName(nm); A.name = nm; }
    if (tw !== (A.prefs.town || '')) { const prefs = { ...A.prefs, town: tw || null }; if (!tw) delete prefs.town; await ops().savePrefs(prefs); A.prefs = prefs; }
  }
  saveMe({ name: nm, town: tw, ...(A ? { acct: A.id } : {}) });
}
export async function changeEmail(email) {
  const e = String(email || '').trim();
  if (!validEmail(e)) throw plain('Enter an email like name@example.com.');
  await ops().changeEmail(e);
  return { demo: DEMO };
}
// The email choices, as Profile saves them (pub/profile.js): the account's prefs, with when, where and under which words
// the choice was made (D1-5).
export async function saveEmails({ hearing_alerts, action_alerts }) {
  if (!A) return;
  const prefs = { ...A.prefs, hearing_alerts: !!hearing_alerts, action_alerts: !!action_alerts, consent_at: new Date().toISOString(), consent_source: 'profile', consent_version: null };
  await ops().savePrefs(prefs); A.prefs = prefs;
}
export async function setLevel(issue, level) {
  if (!LEVELS.includes(level)) return;
  const had = levelsHere();
  writeJ(LEVELS_KEY, { ...had, [issue]: level });
  if (A) { try { await ops().setLevel(issue, level); } catch (e) { writeJ(LEVELS_KEY, had); throw e; } }
}
// A follow changed on Bills or on You: the device's keys are written by the caller; the account follows (fire and forget,
// with the reason in the console: the device keeps it, and it joins the account at the next sign-in).
export function followChanged(diff) {
  maybe().then(a => a && ops().follow(diff)).catch(e => console.warn('follow:', e?.message || e));
}
// A sent letter (before part 8, "Yes, I sent it"): the account learns of it too (public_actions, my_letters), as the tracker does when signed in.
export function sentToAccount(rec, keys, at) {
  maybe().then(async a => {
    if (!a) return;
    const rows = keys.map(k => { const [bill_id, hearing_id, kind] = k.split('|'); return { bill_id, hearing_id: hearing_id || null, kind, created_at: at }; }).filter(r => KINDS.includes(r.kind));
    if (rows.length) await ops().addActions(rows);
    await ops().putLetter(rec);
  }).catch(e => console.warn('sent:', e?.message || e));
}
export async function forgetLetter(bill, kind) {
  const L = { ...lettersHere() }; delete L[slotOf(kind, bill)]; writeLetters(L);
  if (A) await ops().delLetter(bill, kind).catch(() => {});
}
export async function keepLetterAgain(rec) {
  writeLetters({ ...lettersHere(), [slotOf(rec.kind, rec.bill)]: rec });
  if (A) await ops().putLetter(rec).catch(() => {});
}

// R-360 part 8: the letter sent from inside the app (send.js). Throws an Error whose code is send_my_letter's refusal.
export async function sendLetter(p) { return ops().sendLetter(p); }

// ---- a number for texts (optional) ----
export const PHONE_ERR = 'Enter a 10-digit mobile number, like (808) 555-0123.';
export function phoneDigits(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.length === 11 && d[0] === '1') d = d.slice(1);
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(d) ? d : '';
}
export const fmtPhone = d => `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
// The alerts box's text_signup (pub/alerts.js saveText): the row in text_signups under a token this device keeps, with the
// consent words' version shown beside the box ('t5'), and what this device follows. 'more' is the closest source the
// function accepts (backend 156: first_visit, home, action, more): the tracker's profile is reached through More.
export async function saveText(input, consent) {
  const d = phoneDigits(input);
  if (!d) throw plain(PHONE_ERR);
  const t = textSaved(), token = t?.token || crypto.randomUUID();
  await ops().textSignup({ token, phone: d, consent, source: 'more', issue_ids: [...readSet(ISSUES_KEY)], bill_ids: [...readSet(WATCH_KEY)], categories: [...readSet(CATS_KEY)] });
  writeJ(TEXT_KEY, { token, phone: d, at: new Date().toISOString() });
  return d;
}
