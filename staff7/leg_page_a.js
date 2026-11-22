// Legislator page, style A (R-398 drawing opt_a*.png): one scrolling column. The Yours | Whole team switch sits over Now and Our bills; the sections come from legislator.js.
export const renderA = s => `<div class="lpcol">${s.sw()}${s.now()}${s.latest()}${s.bills()}${s.asks()}${s.testimony()}${s.about()}</div>`;
