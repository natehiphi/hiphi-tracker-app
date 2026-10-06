// Testifying again on a bill (R-148, Nate 10/4: "When someone wants to submit a testimony on a specific issue that
// they've already testified on, their previous testimony should be ready to submit easily. A potential alert should
// occur if the bill draft has significantly changed and submitting the same testimony would be incorrect." His answers:
// the letter is kept with the person's profile; a big change is staff's tick).
//
// Each testimony letter sent is kept, the newest one per bill: in this browser (hiphi_me.letters) and, for someone signed
// in, with their account (my_letters, backend migration 124: private to them, staff never see it), so it is ready on any
// device they sign in on. When the same bill, or its twin in the other chamber, has another hearing, the walkthrough
// offers it again, re-addressed (pub/helper.js), after letterCheck() has compared it with the bill as it is now:
//   - the draft it was written for against the bill's current one, with HIPHI's plain-words note on each draft since
//     (public_bill_drafts, R-060);
//   - staff's tick on any of those drafts ("this changes what people should say", Staff v2) - the only way a new draft
//     turns the warning amber; Claude's suggestion never reaches the public;
//   - HIPHI's position, when the letter used HIPHI's words; a talking point in the letter staff have changed or taken
//     out; the person's own stance, if they changed it on the bill page since.
// R-153 (Nate 10/4: "Can we replicate this for emails to chairs to hear a bill if they've already done that before?"; "all
// of the above"): the emails too, every kind the walkthrough writes, kept beside the letter (one of each per bill), offered
// again at the bill's next step with the same check; and each one can start from the other's answers.
import { S, DEMO, supa, companionsOf, sessionInfo, myStance, nick, testimonyDraft, didKind, esc, icon, spaced } from './core.js';

const ME = 'hiphi_me';
const readMe = () => { try { return JSON.parse(localStorage.getItem(ME) || '{}') || {}; } catch { return {}; } };
const writeLetters = letters => { try { localStorage.setItem(ME, JSON.stringify({ ...readMe(), letters })); } catch { /* private mode: kept for this visit only */ } };
const all = () => readMe().letters || {};
const yearOf = b => b?.session_year || sessionInfo().yr;
const ok = L => !!L && L.v === 1 && typeof L.bill === 'string';

// ---- the drafts and their notes (shared with the bill page's "How it has changed") ----
const DRAFT_WORD = { HD: 'House draft', SD: 'Senate draft', CD: 'Conference committee draft', FD: 'Floor draft' };
export const draftName = v => { const m = /^(HD|SD|CD|FD)(\d+)$/.exec(v || ''); return m ? `${DRAFT_WORD[m[1]]} ${m[2]}` : v; };
// The order drafts come in: the bill's own chamber first, then the other, then a floor draft, then conference.
export const draftRank = (b, v) => { const m = /^(HD|SD|CD|FD)(\d+)$/.exec(v || '') || []; const own = (b.bill_number || '')[0] === 'S' ? ['SD', 'HD'] : ['HD', 'SD'];
  return ({ [own[0]]: 0, [own[1]]: 1, FD: 2, CD: 3 }[m[1]] ?? 4) * 100 + (+m[2] || 0); };
// "As introduced" comes before every draft.
const rankOf = (b, v) => v ? draftRank(b, v) + 100 : 0;
// Asked for once per bill; the practice copy reads demo/drafts.json.
export function draftNotes(b) {
  const cache = (S.draftNotes ??= new Map());
  if (!cache.has(b.id)) cache.set(b.id, (async () => {
    if (DEMO) { S.demoDrafts ??= fetch('demo/drafts.json?v=20261005a', { cache: 'force-cache' }).then(r => r.json()).catch(() => []); return (await S.demoDrafts).filter(d => d.bill_id === b.id); }
    const r = await (await supa()).from('public_bill_drafts').select('version,summary,changes_letters,letter_note').eq('bill_id', b.id);
    if (r.error) throw r.error;
    return r.data || [];
  })().catch(e => { cache.delete(b.id); throw e; }));
  return cache.get(b.id);
}

// ---- the letters ----
// Two kinds, one of each per bill, the newest (R-153, migration 126): 'testimony' (a letter to a committee, kept under the
// bill's id, as since R-148) and 'email' (to a chair or to the person's own legislators, kept under "email:<bill id>").
const kindOf = L => L?.kind === 'email' ? 'email' : 'testimony';
const slot = (kind, billId) => kind === 'email' ? 'email:' + billId : billId;
const thisSession = (L, b) => ok(L) && (!L.yr || L.yr === yearOf(b));
// The letter (or email) kept for this bill, this session.
export const letterOn = (b, kind = 'testimony') => { const L = b && all()[slot(kind, b.id)]; return thisSession(L, b) && kindOf(L) === kind ? L : null; };
// The newest one of a kind kept for the bill's twin (by the companion link, or by the same nickname in the other chamber,
// as Home pairs twins).
function twinOf(b, kind) {
  const nums = new Set(companionsOf(b)), name = nick(b), yr = yearOf(b), ch = (b.bill_number || '')[0];
  return Object.values(all()).filter(L => ok(L) && kindOf(L) === kind && L.bill !== b.id && (!L.yr || L.yr === yr)
    && (nums.has(L.num) || (name && L.nick === name && (L.num || '')[0] !== ch))).sort((x, y) => String(y.sent).localeCompare(String(x.sent)))[0] || null;
}
// What to offer for this hearing's testimony: the bill's own letter from another hearing, else its twin's; failing those,
// an email they sent about it (from: 'email': its answers, never its words, since an email is not testimony). Never a
// letter already sent for this hearing.
export function readyLetter(b, h, done = false) {
  if (!b || !h || done) return null;
  const own = letterOn(b);
  if (own) return own.h === h.id ? null : { rec: own, twin: false };
  const tw = twinOf(b, 'testimony'); if (tw) return { rec: tw, twin: true };
  const mail = letterOn(b, 'email') || twinOf(b, 'email');
  return mail ? { rec: mail, twin: mail.bill !== b.id, from: 'email' } : null;
}
// What to offer for an email at this step (key: the hearing id, the committee code asked, or the legislator moment's key):
// the bill's own email from another step, else its twin's; failing those, their testimony letter's answers
// (from: 'testimony'). The same step again is the reminder's business (pub/bill.js), not this.
export function readyMail(b, key, done = false) {
  if (!b || done) return null;
  const own = letterOn(b, 'email');
  if (own) return own.key === key ? null : { rec: own, twin: false };
  const tw = twinOf(b, 'email'); if (tw) return { rec: tw, twin: true };
  const letter = letterOn(b) || twinOf(b, 'testimony');
  return letter ? { rec: letter, twin: letter.bill !== b.id, from: 'testimony' } : null;
}
// After the green box, or "Yes, I sent it": this replaces the bill's last one of its kind, here and on the account.
export function keepLetter(rec) {
  if (!ok(rec)) return;
  writeLetters({ ...all(), [slot(kindOf(rec), rec.bill)]: rec });
  toAccount(rec).catch(() => { /* kept on this device; it joins the account at the next sign-in */ });
}
export function forgetLetter(billId, kind = 'testimony') {
  const L = { ...all() }; delete L[slot(kind, billId)]; writeLetters(L);
  if (!DEMO && S.session && S.user) supa().then(sb => sb.from('my_letters').delete().eq('bill_id', billId).eq('kind', kind)).catch(() => {});
}
async function toAccount(rec) {
  if (DEMO || !S.session || !S.user) return;
  const sb = await supa(), kind = kindOf(rec), row = { letter: rec, sent_at: rec.sent };
  // Update, else insert: an upsert would also rewrite bill_id and kind, which the account may not change (124, 126).
  const u = await sb.from('my_letters').update(row).eq('bill_id', rec.bill).eq('kind', kind).select('bill_id');
  if (u.error) throw u.error;
  if (!(u.data || []).length) { const i = await sb.from('my_letters').insert({ bill_id: rec.bill, kind, ...row }); if (i.error) throw i.error; }
}
// At sign-in (kernel.js loadUser): the account's letters and emails come to this device and this device's join the
// account; for a bill and kind both have, the newer one wins.
export async function syncLetters() {
  if (DEMO || !S.session || !S.user) return;
  const sb = await supa(), r = await sb.from('my_letters').select('bill_id,kind,letter,sent_at');
  if (r.error) return;
  const here = all(), there = Object.fromEntries((r.data || []).filter(x => ok(x.letter)).map(x => [slot(x.kind, x.bill_id), { ...x.letter, kind: x.kind }]));
  const merged = { ...here };
  for (const [k, L] of Object.entries(there)) if (!merged[k] || String(L.sent) > String(merged[k].sent)) merged[k] = L;
  writeLetters(merged);
  for (const [k, L] of Object.entries(here)) if (ok(L) && (!there[k] || String(L.sent) > String(there[k].sent))) await toAccount(L).catch(() => {});
}

// ---- what changed since the letter was written ----
// { level: 'same' | 'changed' | 'big', since: [notes of each draft after the letter's, up to now], missing: the current
//   draft has no note yet, big: [{ kind: 'tick' | 'position' | 'points' | 'stance', ... }], twin }
// stance: the answer given on "Where do you stand?" in this walkthrough (R-167), else their stance on the bill page.
export function letterCheck(b, rec, notes = [], stance = null) {
  const twin = rec.bill !== b.id, now = b.current_version || '', then = twin ? '' : rec.draft || '';
  const since = twin ? [] : notes.filter(n => rankOf(b, n.version) > rankOf(b, then) && rankOf(b, n.version) <= rankOf(b, now))
    .sort((x, y) => rankOf(b, x.version) - rankOf(b, y.version));
  const big = since.filter(n => n.changes_letters).map(n => ({ kind: 'tick', version: n.version, summary: n.summary, note: n.letter_note || '' }));
  const mine = stance || myStance(b.id);
  if (['support', 'oppose', 'comments'].includes(mine) && rec.stance && mine !== rec.stance) big.push({ kind: 'stance', from: rec.stance, to: mine });
  if (rec.ours && (b.hiphi_position || '') !== (rec.pos || '')) big.push({ kind: 'position', from: rec.pos, to: b.hiphi_position || '' });
  const pts = new Set((b.hiphi_points || []).filter(Boolean));
  if (!twin && (rec.points || []).some(p => !pts.has(p))) big.push({ kind: 'points' });
  const changed = twin || now !== then;
  return { level: big.length ? 'big' : changed ? 'changed' : 'same', since, missing: !twin && !!now && now !== then && !since.some(n => n.version === now), big, twin, now, then };
}

// ---- the buttons ----
// The testimony button's words (R-148): finish a saved draft, send a kept letter again, else write one. A twin's letter
// is offered inside the walkthrough, so its button stays "Write my testimony".
export const testifyLabel = (b, h, late = false) => { if (testimonyDraft(h)) return 'Finish sending your testimony';
  const r = readyLetter(b, h, didKind(b, h, 'testimony'));
  return r && !r.twin && !r.from ? 'Send my letter again' : late ? 'Send late testimony' : 'Write my testimony'; };
// An email button's words (R-153): "Send my email again" when their email on this bill from another step is ready;
// otherwise the button's own words (an email written from their testimony is offered inside, as a twin's is).
export const mailLabel = (b, key, words, again = 'Send my email again') => { const r = readyMail(b, key); return r && !r.twin && !r.from ? again : words; };
// One line under a hearing's details when a letter is ready: when they wrote (the button says it is ready; A-14).
export function againLine(b, h) {
  const r = readyLetter(b, h, didKind(b, h, 'testimony'));
  if (!r || r.from || testimonyDraft(h)) return '';
  return `<p class="again">${icon('notebook-pen')}<span>${r.twin ? `Your letter on its twin, ${esc(spaced(r.rec.num))}, can be used here.`
    : `You wrote testimony on this bill${r.rec.at ? ` on ${esc(new Date(r.rec.at).toLocaleDateString('en-US', { timeZone: 'Pacific/Honolulu', month: 'short', day: 'numeric' }))}` : ''}.`}</span></p>`;
}
