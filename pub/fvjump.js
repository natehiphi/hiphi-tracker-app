// The practice copy's direct links into the first visit (R-188; Nate 10/10: "I'm not sure what page I'm supposed to be
// looking at. Share a direct link. The one that's provided pushes me through onboarding"). ?demo=1&fvstep=save opens
// "Save your profile" straight away, with two sample issues followed, so its sentence reads "your 2 issues" and the box is
// there to try. The screen is the first visit's own: start.js and start-rest.js draw the step. This file only sets what
// the screens before it would have left behind, pins the versions that step shows (variant.js pinArms, as a tester's
// link does) and moves the address to the step. It is loaded by app.js only with ?demo=1, and only the steps in JUMPS
// can be opened; a step is added here by name.
import { S, DEMO, wizSet, setFollows, issuesIn, issueBills } from './kernel.js';
import { pinArms } from './variant.js';

const JUMPS = {
  // "Save your profile" (R-184, R-188): the alerts step, which follows the issues. pins: the versions it shows, so the words
  // do not change with the switches (onb today's first visit, save the profile's ask, email the ask right after the issues).
  save: { step: 'alerts', issues: 2, pins: { onb: 'today', save: 'profile', email: 'finale' } },
};

// Opens the step named in the address, for the practice copy only. Returns true when it moved the address.
export async function fvJumpFromAddress() {
  if (!DEMO) return false;
  const q = new URLSearchParams(location.search), name = q.get('fvstep') || '';
  const j = Object.prototype.hasOwnProperty.call(JUMPS, name) ? JUMPS[name] : null;
  if (!j) return false;
  // A sample: the first category (in the page's order) with enough issues shown on the first visit and with bills.
  const shownHere = i => i.first_visit !== false && issueBills(i).length > 0;
  const cats = [...(S.cats || [])].sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99));
  let pick = null;
  for (const c of cats) { const iss = issuesIn(c.key).filter(shownHere); if (iss.length >= j.issues) { pick = { cat: c, issues: iss.slice(0, j.issues) }; break; } }
  if (!pick) return false;
  // A fresh practice visit: what was followed before goes, so the count is the one the step names. Two calls: setFollows
  // applies "on" before "off", so the same call could drop what it just added.
  await setFollows({ issuesOff: [...S.issueFollows], catsOff: [...S.catFollows] });
  await setFollows({ issuesOn: pick.issues.map(i => i.id) });
  pinArms(j.pins);
  // The step's number comes from the first visit's own flow (start.js), so a change to the flow cannot leave it behind.
  const { stepOf, isOff } = await import('./start.js');
  const off = isOff(), n = stepOf(j.step, off), ids = pick.issues.map(i => i.id);
  // The issues screen keeps its ticks as picks for its own signature (start-rest.js: picksFor is "in|<category>", picks what
  // is ticked). Without them it shows HIPHI's defaults, so Back showed other ticks and Next followed a third issue.
  // followedIssues is what that screen last followed (commitIssues), so a later untick removes these two.
  // Back from the step goes to the issues screen, which needs a pick (the category, as the topics screen keeps it). The
  // visit is a first visit again: no earlier finish, skip, link, plan or ready-for-January mark.
  wizSet({ step: n, issues: [pick.cat.key], picksFor: `${off ? 'off' : 'in'}|${pick.cat.key}`, picks: { issues: ids, cats: [] },
    followedIssues: ids, followedCats: [], done: false, skipped: false, via: undefined, viaSkipAsk: undefined, ready: undefined, plan: undefined, finale: undefined });
  q.delete('fvstep');
  const rest = q.toString();
  history.replaceState({ y: 0 }, '', location.pathname + (rest ? '?' + rest : '') + '#/start/' + n);
  return true;
}
