// The Capitol's words in plain language, for staff7's "Capitol words" page (R-398 piece 11).
// COPIED from staff6/terms.js (WORDS and WORDS_NEW, with the practice flag on) so staff7 imports nothing from a staff6 view: terms.js
// pulls in the sheet and popover code and registers a click listener on the page, which this page must not do.
// One change from the copy: "second review" is "second look" (the new app's word for it, R-398). If Help's glossary changes, change both.
export const CAPITOL_WORDS = [
  ['Legislative day', 'A day the chambers meet. Weekends, recess days and holidays do not count, so "Legislative day 42 of 60" is not a calendar count.'],
  ['Referral', 'The committees a bill must pass in each chamber, in order. Three or more in one chamber is a triple referral.'],
  ['Hearing', 'A committee meeting where the bill is heard and anyone can testify. Written testimony is usually due 24 hours before; a few committees ask for 48 (CPN). The tracker shows each hearing’s own deadline.'],
  ['48-hour notice', 'A committee must post a hearing at least 48 hours ahead. A bill’s first Senate committee must post 72 hours ahead. If its last regular meeting before a deadline is closer than that, only the chair can help.'],
  ['Decision making', 'A later meeting where a committee votes on bills it already heard. Testimony is still taken, and the tracker treats it like a hearing, with its own deadline: HIPHI filed at eight of them in 2026.'],
  ['Deferred', 'The committee held the bill. For the year, that almost always ends it.'],
  ['Three-committee deadline', 'The last day a triple-referred bill can clear its first committee.'],
  ['Lateral', 'The last day a bill can reach its last committee in the chamber it is in. Its last committee is usually the money committee (FIN in the House, WAM in the Senate).'],
  ['Decking', 'The last day a bill can clear its last committee and be filed for its floor vote in that chamber.'],
  ['Crossover', 'The last day a bill can pass its first chamber and move to the other. The second chamber repeats the same deadlines.'],
  ['Cross back', 'A bill the second chamber changed goes back to where it started, to agree or disagree.'],
  ['Conference', 'House and Senate negotiators settle one version. Final decking is the last day they can agree.'],
  ['Sine die', 'The last day of the session.'],
  ['HD1, SD1, CD1', 'Versions. HD1 is the first House draft, SD1 the first Senate draft, CD1 the conference draft. Testimony written for an older version needs a second look.'],
  ['Companion', 'The same bill introduced in the other chamber, an HB and an SB with the same text. If one stalls, the other may still move.'],
  ['GM', 'A message from the Governor, such as a nomination or a report. Not a bill.'],
  ['Joint referral', 'Two committees named together, such as HHS/CPN. They hear the bill together, at one hearing, and vote on it together, so the pair counts as one stop.'],
  ['Fiscal', 'A bill that spends money. Fiscal bills also go to the money committee (FIN in the House, WAM in the Senate). Fiscal is also the name of their last deadline: the day conference drafts of bills that spend money must be settled, a little after Final decking.'],
];
