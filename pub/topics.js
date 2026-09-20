// The six topics a first visit picks from, and the narrower ones inside each (Nate, 9/20).
//
// WHY THIS EXISTS. Onboarding used to offer the nine HIPHI coalitions, and one of them - General
// Public Health - held 470 of the 734 public bills and 64 of the 218 HIPHI supports. It was not a
// topic, it was a drawer: pesticides, tax policy, reproductive rights, immigration and health
// coverage filed together. A stranger picking it got no sense of what they had chosen.
//
// These six were derived by reading all 218 supported bills and grouping what is actually there.
// Every one holds 24-64 bills, every sub-topic is something a person would recognise, and there is
// no catch-all. General Public Health dissolves into five of the six.
//
// HOW IT IS MEANT TO GROW UP. Nate's instruction was "onboarding for now, but prepare this to be
// adopted for the public issue filters". So this file is shaped like the data it should become: a
// list of rows with a key, a name, a description and a matcher. When the taxonomy has proved
// itself, each SUB becomes a `campaigns` row and its matcher is run once to write `bill_campaigns`
// - at which point bills carry the tag and this file's regexes retire. Nothing else in the app
// needs to change, because topics are handed out in the same shape as coalitions.
//
// MATCHING. First match wins, top to bottom, which is how the counts were produced. Order inside a
// topic therefore matters: the narrower rule goes above the broader one.

const TOPICS = [
  { key: 'food', name: 'Food & Nutrition', icon: 'apple',
    desc: 'School meals, SNAP, local food and sugary drinks.', subs: [
      { key: 'school-meals', name: 'School meals', re: /school meal|school lunch|charter school meal|meal price|unpaid bill|denied over|quarter cost/i },
      { key: 'snap',         name: 'SNAP & food assistance', re: /snap|wic|food aid|food stamp|shutdown food|nutrition education|surge pricing/i },
      { key: 'local-food',   name: 'Local food & farms', re: /farm to|local food|climate-smart farm|school food program|local produce/i },
      { key: 'sugary',       name: 'Sugary drinks', re: /sugary drink|soda/i },
      { key: 'grocery',      name: 'Grocery costs', re: /grocer|excise tax on|period products/i },
    ] },
  { key: 'tobacco', name: 'Tobacco, Vaping & Alcohol', icon: 'cigarette',
    desc: 'Keeping tobacco and vaping from kids, and alcohol policy that puts health first.', subs: [
      { key: 'tobacco-vaping', name: 'Tobacco & vaping', re: /tobacco|vape|nicotine|cigarette|smoking/i },
      { key: 'alcohol',        name: 'Alcohol & impaired driving', re: /dui|liquor|alcohol|blood alcohol|substance misuse/i },
    ] },
  { key: 'care', name: 'Health Care & Rights', icon: 'heart-pulse',
    desc: 'Getting care, paying for it, and the rights that come with it.', subs: [
      { key: 'workforce',    name: 'Health workforce', re: /health students|community health worker|hygienist|workers.{0,3} comp|new grads/i },
      { key: 'repro',        name: 'Reproductive & gender-affirming care', re: /reproductive|abortion|gender-affirming|sex marker/i },
      { key: 'civil',        name: 'Safety & civil rights', re: /ice interview|immigration|police must|personal data/i },
      { key: 'coverage',     name: 'Coverage & cost', re: /single-payer|medical debt|preventive care|insurance|coverage/i },
      { key: 'vaccines',     name: 'Vaccines', re: /vaccine|immuniz/i },
      { key: 'mental',       name: 'Mental health', re: /mental health/i },
    ] },
  { key: 'family', name: 'Family & Economic Security', icon: 'hand-coins',
    desc: 'Wages, leave, rent and the tax credits families live on.', subs: [
      { key: 'tax-fairness', name: 'Tax fairness', re: /capital gains|income tax|income surtax|property sales|real estate|top bracket|tax liquor|tax credit caps/i },
      { key: 'credits',      name: 'Tax credits for families', re: /tax credit|child and dependent|cash support|family caregiver|renters/i },
      { key: 'wages',        name: 'Paid leave & wages', re: /paid family|medical leave|minimum wage|tipped worker/i },
      { key: 'services',     name: 'Community services', re: /nonprofit|social services|child neglect|prison release/i },
      { key: 'housing',      name: 'Housing & rent', re: /rent|homes for local|housing/i },
    ] },
  { key: 'around', name: 'Getting Around Safely', icon: 'footprints',
    desc: 'Crossing the street, catching the bus, getting to school.', subs: [
      { key: 'walking',   name: 'Walking & crossings', re: /cross|crosswalk|pedestrian|jaywalk|walker|mid-block|walking route|summer streets/i },
      { key: 'transit',   name: 'Buses & transit', re: /bus pass|transit|bus rides|ride free|rideshare|youth ride/i },
      { key: 'saferoutes',name: 'Safe Routes & speed', re: /safe routes|speed camera|red-light|car fee|delivery fee/i },
    ] },
  { key: 'climate', name: 'Climate & Environment', icon: 'leaf',
    desc: 'Pesticides, heat, wildfire and clean water.', subs: [
      { key: 'pesticides', name: 'Pesticides', re: /pesticide|neonicotinoid|telone|buffer/i },
      { key: 'heat',       name: 'Heat, wildfire & climate', re: /heat|wildfire|climate|invasive species|clean environment/i },
      { key: 'water',      name: 'Water & waste', re: /cesspool|wastewater|water shortage|recycling|packaging/i },
    ] },
];

// What a bill is about, in the words a person would search for. The nickname is the team's own
// plain name and is the best signal; the summary and title back it up for bills without one.
const nameOf = b => (b && (b.hiphi_nickname || b.nickname)) || '';
const textOf = b => `${nameOf(b)} ${b.public_summary || b.hiphi_summary || ''} ${b.title || ''}`;

// The sub-topic a bill belongs to, or null. First match wins - see the note above.
export function subOf(b) {
  const t = textOf(b);
  for (const topic of TOPICS) for (const sub of topic.subs) if (sub.re.test(t)) return { topic, sub };
  return null;
}
export const topicOf = b => subOf(b)?.topic || null;
export const inTopic = (b, key) => topicOf(b)?.key === key;
export const inSub = (b, topicKey, subKey) => { const m = subOf(b); return !!m && m.topic.key === topicKey && m.sub.key === subKey; };

// Handed out in the same shape `issues()` uses, so every screen that already consumes an issue
// works unchanged: key, names (for the wizard's stored picks), icon, description, and a `match`
// the bill-picking step uses instead of coalition membership.
export function topics(bills = []) {
  return TOPICS.map(t => {
    const mine = bills.filter(b => inTopic(b, t.key));
    return { key: t.name, topicKey: t.key, names: [t.key], icon: t.icon, description: t.desc,
      bills: mine.length, live: mine.length > 0, general: 0,
      match: b => inTopic(b, t.key),
      subs: t.subs.map(s => ({ key: s.key, name: s.name, bills: bills.filter(b => inSub(b, t.key, s.key)).length })) };
  });
}
export const TOPIC_KEYS = TOPICS.map(t => t.key);

// ---- policies ----------------------------------------------------------------------------
// The 248 bills HIPHI has a position on are only 153 distinct policies: "Let counties regulate
// tobacco sales" is ELEVEN separate bills, free school meals is five, the DUI limit is seven. A
// first visit that lists bills therefore asks somebody to choose between near-identical rows, and
// following one quietly misses the others - which is exactly how an important bill gets left behind.
//
// The team's own nicknames are the grouping key, because they were written to be identical for
// identical policies. That is not guaranteed - "Lower the DUI limit to .05" and "Lower the DUI
// blood alcohol limit" are one policy under two names - so when this graduates to the database the
// key becomes a column staff can correct. Until then a bill with no nickname is its own policy,
// which is right: monitor bills and one-offs should not be lumped together.
export function policies(bills = []) {
  const map = new Map();
  for (const b of bills) {
    const nn = nameOf(b).trim();
    const key = nn ? 'n:' + nn.toLowerCase() : 'b:' + b.id;
    if (!map.has(key)) map.set(key, { key, name: nn || null, bills: [] });
    map.get(key).bills.push(b);
  }
  return [...map.values()];
}
