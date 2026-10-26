// Icons drawn for HIPHI in Lucide's style (24 grid, 2px stroke, round caps and joins), for topics and issues Lucide has
// no picture for (R-339, Nate's picks on the icon sheets of 25 Oct 2026). icons.js merges them into ICONS after the
// Lucide set, so icon('tray-front') works like any Lucide name. tools/icons.mjs never fetches or drops these: add a
// drawing here, by hand, with a line saying what it shows. Sources: backend docs/requests/R-339/round3_drawings.py.
export const DRAWN = {
  // Food & Nutrition and school meals: a lunch tray seen from the front, an apple and a milk carton on it
  "tray-front": "<path d=\"M2 18h20\"/><path d=\"M3 18v1.5a1.5 1.5 0 0 0 1.5 1.5h15a1.5 1.5 0 0 0 1.5-1.5V18\"/><path d=\"M8.5 12.2c-.9-.7-3.6-.8-3.6 1.9 0 1.8 1.4 3.9 2.3 3.9.6 0 .9-.3 1.3-.3s.7.3 1.3.3c.9 0 2.3-2.1 2.3-3.9 0-2.7-2.7-2.6-3.6-1.9Z\"/><path d=\"M8.5 12.2V11c.2-.6.8-1 1.6-1\"/><path d=\"M14 18v-7l1.5-2.5h3L20 11v7\"/><path d=\"M14 11h6\"/>",
  // SNAP: a food-benefits (EBT-style) card with an apple
  "snap-card": "<rect x=\"2\" y=\"5\" width=\"20\" height=\"14\" rx=\"2\"/><path d=\"M12 10.4c-1-.8-4-.9-4 2.1 0 2 1.6 4.3 2.6 4.3.7 0 1-.4 1.4-.4s.7.4 1.4.4c1 0 2.6-2.3 2.6-4.3 0-3-3-2.9-4-2.1Z\"/><path d=\"M12 10.4V9.2c.2-.7.9-1.2 1.8-1.2\"/>",
  // Make SNAP easier: the card with a plus
  "snap-plus": "<path d=\"M13 18H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6\"/><path d=\"M9.5 8.6c-.8-.6-3.2-.7-3.2 1.7 0 1.6 1.2 3.4 2 3.4.6 0 .8-.3 1.2-.3s.6.3 1.2.3c.8 0 2-1.8 2-3.4 0-2.4-2.4-2.3-3.2-1.7Z\"/><path d=\"M9.5 8.6V7.6c.2-.5.7-.9 1.4-.9\"/><path d=\"M19 15v6\"/><path d=\"M16 18h6\"/>",
  // Alcohol policy: a glass inside a shield
  "glass-shield": "<path d=\"M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z\"/><path d=\"M9 7h6l-.5 3.5a2.5 2.5 0 0 1-5 0Z\"/><path d=\"M12 13v3.5\"/><path d=\"M10 16.5h4\"/>",
  // Medical debt: a medical bill, checked off
  "bill-forgiven": "<path d=\"M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z\"/><path d=\"M12 7v4\"/><path d=\"M10 9h4\"/><path d=\"m9 14 2 2 4-4\"/>",
  // Property sales: a house with a price tag
  "house-tag": "<path d=\"M3 10a2 2 0 0 1 .7-1.5l7-6a2 2 0 0 1 2.6 0l7 6A2 2 0 0 1 21 10\"/><path d=\"M5 10v9a2 2 0 0 0 2 2h4\"/><path d=\"M14 15.6V18l3.4 3.4a1.1 1.1 0 0 0 1.6 0l2.4-2.4a1.1 1.1 0 0 0 0-1.6L18 14h-2.4a1.6 1.6 0 0 0-1.6 1.6Z\"/><circle cx=\"16.3\" cy=\"16.3\" r=\".4\"/>",
};
