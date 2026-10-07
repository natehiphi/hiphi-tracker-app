// The languages the public can pick (R-166 step 3, docs/LANGUAGES-PLAN.md in the backend repo). A code goes in here only
// when its word file (pub/words/<code>.js, made and passed by the checker panel) is in, a fluent person has graded 100
// pieces of it (Nate 10/5: once per language) and the first-visit test script has been walked in it on a phone. Until then
// the picker is not drawn and nobody is offered a language that is only part there. A preview is still possible with
// ?lang=<code> (never saved), which is how the words are read before they go in this list.
export const LIVE = [];
