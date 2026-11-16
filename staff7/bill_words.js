// The words and small facts the Issues list, Calendar and the bill page all say the same way (R-398). One place, so a testimony's state is never said two ways:
// the state of a bill's testimony for one hearing, said in the middle of a line ("testimony waiting for approval"), who leads a bill, and when testimony is due.
// Imports only the data layer, so nothing here can make a module cycle. Nothing here draws or writes.
import { S, advocate } from '../staff6/data.js';
import { sittingDraft } from '../staff6/model.js';
import { billStep } from '../staff6/steps.js';

export const cap = t => String(t || '').replace(/^./, c => c.toUpperCase());
// when testimony is due for a hearing: the stated deadline, else a day before it starts
export const testimonyDue = h => h.testimony_deadline ? new Date(h.testimony_deadline).getTime() : new Date(h.scheduled_at).getTime() - 864e5;

// A draft is this hearing's when it names this hearing, or names none and its committee codes are this hearing's (a draft for the same committee's other hearing is not)
const codesKey = c => String(c || '').split('/').map(x => x.trim()).filter(Boolean).sort().join('/');
export const draftFor = (h, b) => { const d = sittingDraft(h, b.id); return d && (d.hearing_id ? d.hearing_id === h.id : codesKey(d.committee) === codesKey(h.committee)) ? d : null; };
// Where a bill's testimony stands for a hearing, from the data layer's own step state: { key, back (sent back to fix), fresh (not started) }
export const letterState = (h, b) => { try { const s = billStep(b, { viewer: S.me, d: draftFor(h, b) || null, h })?.state; if (s) return { key: s.key, back: !!s.sentBack, fresh: !!s.noDraft }; } catch { /* below */ } return { key: 'write', back: false, fresh: true }; };
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
