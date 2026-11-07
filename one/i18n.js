// Every word act.html shows goes through t() (R-360): English only for now, so the tracker's eight languages can follow
// without touching the screens. A key is the English line itself, short and stable; {name} is filled from vars.
// Translations will add a table per language here (or read public_translations); until then t() returns the English.
const EN = {
  'aloha': 'Aloha! Here is the bill you came for.',
  'pos.supports': 'HIPHI supports',
  'pos.opposes': 'HIPHI opposes',
  'pos.comments': 'HIPHI has comments',
  'pos.watching': 'HIPHI is watching',
  'btn.testimony': 'Send testimony',
  'btn.email': 'Email the chair',
  'btn.time': 'About 10 minutes. We help you write it.',
  'btn.time.email': 'About 2 minutes. We help you write it.',
  'capitol': 'Read the whole bill at the Capitol',
  'loading': 'Loading the bill',
  'missing.h': 'We can’t find that bill',
  'missing.p': 'Check the bill number in your link, or look through every bill HIPHI follows.',
  'missing.go': 'See HIPHI’s bills',
  'fail.h': 'We couldn’t load this bill',
  'fail.offline': 'You’re offline. When your connection is back, press Try again.',
  'fail.other': 'The tracker can’t reach its data right now. It’s not you. Try again in a minute.',
  'fail.again': 'Try again',
  'write.h': 'Next: your letter',
  'write.p': 'Coming in part 2.',
  'write.back': 'Back to the bill',
  'mark': 'HIPHI',
  'practice': 'Practice copy',
};
export const t = (key, vars = {}) => String(EN[key] ?? key).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
