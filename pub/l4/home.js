// Look 4 (R-412): Home (Mix-Home, K1 to K4). A STUB from the foundation build: it re-exports today's module for this screen (under ?v2=1) so nothing breaks.
// The builder who owns it replaces this file with the look-4 screen: a module whose default export is { render, wire, tab, tabs, title, bar?, ownTop }
// as app.js describes. Set `ownTop: true` on it when the screen draws its own ocean hero (the frame then draws no header).
export * from '../calm/home.js';
export { default } from '../calm/home.js';
