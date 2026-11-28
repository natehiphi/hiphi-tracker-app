// Look 4 (R-412): the all-bills list (J6; the #/allbills route). A STUB from the foundation build: it re-exports today's module for this screen (under ?v2=1) so nothing breaks.
// The builder who owns it replaces this file with the look-4 screen: a module whose default export is { render, wire, tab, tabs, title, bar?, ownTop }
// as app.js describes. Set `ownTop: true` on it when the screen draws its own ocean hero (the frame then draws no header).
export * from '../allbills.js';
export { default } from '../allbills.js';
