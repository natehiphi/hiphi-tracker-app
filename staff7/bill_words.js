// The words and small facts the Issues list, Calendar and the bill page all say the same way (R-398). One place, so a testimony's state is never said two ways:
// the state of a bill's testimony for one hearing, said in the middle of a line ("testimony waiting for approval"), who leads a bill, and when testimony is due.
// Imports only the data layer and staff7's leaf files (parts, steps, words), so nothing here can make a module cycle. Nothing here writes.
import { S, advocate, SESSION_YEAR } from '../staff6/data.js';
import { sittingDraft } from '../staff6/model.js';
import { billStep } from '../staff6/steps.js';
import { esc } from './parts.js';
import { ic } from './icons7.js';
import { cmteWords } from './steps.js';
import { dateWords } from './words.js';

const enc = encodeURIComponent;
// an address that came from data is used only when it is http or https
export const http = u => /^https?:\/\//i.test(String(u || '').trim());
export const codesOf = c => String(c || '').split('/').map(x => x.trim()).filter(Boolean);
// "Thu, Mar 13", and with its year ("Thu, Mar 13, 2025") when it is not in the session's year; d is YYYY-MM-DD
export const dateY = d => { const y = String(d).slice(0, 4); return +y === +SESSION_YEAR ? dateWords(d) : `${dateWords(d)}, ${y}`; };

export const cap = t => String(t || '').replace(/^./, c => c.toUpperCase());
// when testimony is due for a hearing: the stated deadline, else a day before it starts
export const testimonyDue = h => h.testimony_deadline ? new Date(h.testimony_deadline).getTime() : new Date(h.scheduled_at).getTime() - 864e5;

// A draft is this hearing's when it names this hearing, or names none and its committee codes are this hearing's (a draft for the same committee's other hearing is not)
export const codesKey = c => codesOf(c).sort().join('/');
export const draftFor = (h, b) => { const d = sittingDraft(h, b.id); return d && (d.hearing_id ? d.hearing_id === h.id : codesKey(d.committee) === codesKey(h.committee)) ? d : null; };
// Where a bill's testimony stands for a hearing, from the data layer's own step state: { key, back (sent back to fix), fresh (not started) }
export const letterState = (h, b) => { try { const s = billStep(b, { viewer: S.me, d: draftFor(h, b) || null, h })?.state; if (s) return { key: s.key, label: s.label, back: !!s.sentBack, fresh: !!s.noDraft }; } catch { /* below */ } return { key: 'write', label: null, back: false, fresh: true }; };
// the state in words, lower case, for the middle of a line (Calendar says it with a capital at the start of a line)
export const testimonyWords = st => st.key === 'filed' ? 'testimony filed' : st.key === 'file' ? 'testimony ready to file' : st.key === 'second' ? 'testimony waiting for a second look' : st.key === 'approve' ? 'testimony waiting for approval'
  : st.key === 'missed' ? 'testimony not filed' : st.back ? 'testimony sent back to fix' : st.fresh ? 'testimony not started' : 'testimony being written';
// the same state after "Testimony due ..." (which already says testimony): "waiting for approval", "filed"
export const testimonyShort = st => testimonyWords(st).replace(/^testimony /, '');

// The people who lead a bill: the ones assigned to it who are still active, else the issue's lead. Ids, in order.
const live = id => !!id && advocate(id)?.is_active !== false;
export function leadIds(b, issue) {
  const ids = [...new Set((S.assignments?.[b.id] || []).filter(live))];
  return ids.length ? ids : live(issue?.owner_id) ? [issue.owner_id] : [];
}

// ---------------------------------------------------------------------------------- committees, never as the Capitol's codes (bill page only)
// A code with no name in the data layer shows as "House committee" or "Senate committee" (the chamber of the leg of the bill's road it was referred in, when that can be told), else "A committee".
const refsOf = b => (Array.isArray(b.referrals) ? b.referrals : []).map(String);
export function chamberOfCode(b, code) {
  const refs = refsOf(b), i = refs.findIndex(r => codesOf(r).includes(code)), o = Math.min(b.origin_stops || 0, refs.length);
  if (i < 0 || !o) return '';
  const own = /^S/i.test(String(b.bill_number || '').trim()) ? 'Senate' : 'House';
  return i < o ? own : own === 'Senate' ? 'House' : 'Senate';
}
// Codes the 2026 committee list no longer has (the Senate's old Water and Land and Higher Education committees; older bills still name them): their names, as plain text (no committee page exists)
export const RETIRED = { WTL: { name: 'Water and Land', chamber: 'Senate' }, HRE: { name: 'Higher Education', chamber: 'Senate' } };
const known = c => !!S.committees?.[c] || !!RETIRED[c] || cmteWords(c) !== c;
export const cmteLabel = (c, b) => RETIRED[c] && !S.committees?.[c] ? `${RETIRED[c].chamber} ${RETIRED[c].name}` : known(c) ? cmteWords(c) : (chamberOfCode(b, c) ? `${chamberOfCode(b, c)} committee` : 'A committee');
export const cmtesText = (codes, b) => codesOf(codes).map(c => cmteLabel(c, b)).join(' with ');
export const cmteLink = (c, b, cls = '') => S.committees?.[c] ? `<a class="lk${cls}" href="#/search/committee/${enc(c)}">${esc(cmteLabel(c, b))}</a>` : esc(cmteLabel(c, b));
// a committee or a joint pair: "House Health with House Human Services", each one a link
export const cmtesLinks = (codes, b) => codesOf(codes).map(c => cmteLink(c, b)).join(' with ');
// the Capitol's codes inside a sentence, in words ("HB", "SB" and the like stay); a code that is nobody's committee here ("CR 229") is left alone
export const cleanCodes = (t, b) => String(t).replace(/\b[A-Z]{2,4}(?:\/[A-Z]{2,4})*\b/g, m => /^(HB|SB|HR|SR|HCR|SCR|PM|AM)$/.test(m) ? m : codesOf(m).every(c => known(c) || refsOf(b).some(r => codesOf(r).includes(c))) ? cmtesText(m, b) : m);

// an external link: new tab, rel=noopener, the external-link icon the bill page uses
export const ext = (url, label) => `<a class="lk" target="_blank" rel="noopener" href="${esc(url)}">${esc(label)}${ic('external-link')}</a>`;
// a moment as Honolulu's day: "2026-03-06", and "Mar 6" (with its year, "Mar 6, 2025", when it is not in the session's year)
const HST = { timeZone: 'Pacific/Honolulu' };
export const ymdH = t => new Date(t).toLocaleDateString('en-CA', HST);
export const monD = t => { const w = new Date(t).toLocaleDateString('en-US', { ...HST, month: 'short', day: 'numeric' }), y = ymdH(t).slice(0, 4); return +y === +SESSION_YEAR ? w : `${w}, ${y}`; };
