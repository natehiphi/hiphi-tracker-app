// The share icon people already know on their own device (R-205, Nate 10/10: "a logo that most people recognize as
// 'share'"). Apple devices (iPhone, iPad, Mac) get Apple's square open at the top with an arrow going up out of it;
// every other device gets the three-dot share mark, drawn as an outline to match its neighbours. icons.js draws every
// share icon through shareMarkup(), so the choice is made in one place. It lives in its own file because
// tools/icons.mjs regenerates icons.js from Lucide and would drop anything added to it by hand.
// Stroke only, in the 24-unit grid icon() uses: stroke and colour come from icon(), so the size and weight match the rest.

const APPLE = '<path d="M8 9H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-2"/> <path d="M12 15V3"/> <path d="m8 7 4-4 4 4"/>';
// Three dots: one left (6,12), two right (18,6) and (18,18), each radius 3, joined by two lines that stop at the dots' edges.
const DOTS = '<circle cx="18" cy="6" r="3"/> <circle cx="6" cy="12" r="3"/> <circle cx="18" cy="18" r="3"/> <path d="M8.68 10.66 15.32 7.34"/> <path d="M8.68 13.34 15.32 16.66"/>';

// Apple: iPhone, iPod and iPad. A Mac is matched too, and a Mac that answers touch is an iPad in desktop mode, so
// it is Apple either way (the test is the same for both).
export function isAppleDevice() {
  const ua = typeof navigator !== 'undefined' && navigator.userAgent ? navigator.userAgent : '';
  return /iPhone|iPad|iPod|Macintosh/.test(ua);
}

// The inner markup of the share icon for this device (icon() wraps it in the <svg>).
export function shareMarkup() {
  return isAppleDevice() ? APPLE : DOTS;
}
