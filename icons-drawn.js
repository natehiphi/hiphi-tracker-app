// Icons drawn for HIPHI in Lucide's style (24 grid, 2px stroke, round caps and joins), for topics and issues Lucide has
// no picture for (R-339, Nate's picks on the icon sheets of 25 Oct 2026, rounds 3 and 4). icons.js merges them into ICONS
// after the Lucide set, so icon('tray-front') works like any Lucide name. tools/icons.mjs never fetches or drops these: add a
// drawing here, by hand, with a line saying what it shows. Sources: backend docs/requests/R-339/round3_drawings.py and round4_drawings.py.
export const DRAWN = {
  // Food & Nutrition and school meals: a lunch tray seen from the front, an apple and a milk carton on it
  "tray-front": "<path d=\"M2 18h20\"/><path d=\"M3 18v1.5a1.5 1.5 0 0 0 1.5 1.5h15a1.5 1.5 0 0 0 1.5-1.5V18\"/><path d=\"M8.5 12.2c-.9-.7-3.6-.8-3.6 1.9 0 1.8 1.4 3.9 2.3 3.9.6 0 .9-.3 1.3-.3s.7.3 1.3.3c.9 0 2.3-2.1 2.3-3.9 0-2.7-2.7-2.6-3.6-1.9Z\"/><path d=\"M8.5 12.2V11c.2-.6.8-1 1.6-1\"/><path d=\"M14 18v-7l1.5-2.5h3L20 11v7\"/><path d=\"M14 11h6\"/>",
  // SNAP: a shopping cart with a heart in it (food help)
  "cart-heart": "<circle cx=\"8\" cy=\"21\" r=\"1\"/><circle cx=\"19\" cy=\"21\" r=\"1\"/><path d=\"M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12\"/><path d=\"M13.5 13.2 11 10.8a1.6 1.6 0 0 1 2.5-1.9 1.6 1.6 0 0 1 2.5 1.9Z\"/>",
  // Vaccines and prevention: a bandaid, its ends about the size of its pad
  "bandaid-tilt": "<g transform=\"rotate(-45 12 12)\"><rect x=\"1.5\" y=\"7\" width=\"21\" height=\"10\" rx=\"5\"/><path d=\"M8.5 7v10\"/><path d=\"M15.5 7v10\"/><path d=\"M10.8 10.5h.01\"/><path d=\"M13.2 10.5h.01\"/><path d=\"M10.8 13.5h.01\"/><path d=\"M13.2 13.5h.01\"/></g>",
  // Disposable e-cigarette ban: a disposable e-cigarette, crossed out
  "ecig-slash": "<path d=\"M10 8V4.5A1.5 1.5 0 0 1 11.5 3h1A1.5 1.5 0 0 1 14 4.5V8\"/><rect x=\"8\" y=\"8\" width=\"8\" height=\"13\" rx=\"2\"/><path d=\"M12 17.5h.01\"/><path d=\"m3 3 18 18\"/>",
  // Farm to Families: a paper grocery bag, a carrot, tomato and greens at the top
  "bag-veggies": "<path d=\"M6 11h12v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2Z\"/><path d=\"M6 13.5h12\"/><g transform=\"translate(-0.4 -1)\"><path d=\"M7 12 9.3 5.5a1.1 1.1 0 0 1 2.1.6L10.4 12\"/><path d=\"m10.4 4.6.5-2\"/><path d=\"M11 5.3l1.8-1\"/><path d=\"M12.3 12a2.2 2.2 0 1 1 3.4-1.6\"/><path d=\"M17 12c0-3 .6-5.5 2.5-7\"/><path d=\"M17.3 8.5c-1 0-2-.8-2.3-2\"/></g>",
  // Higher taxes on top earners: a money bag with a percent sign
  "bag-percent": "<path d=\"M9.5 3h5L13 6.5h-2Z\"/><path d=\"M11 6.5C6.5 8.5 4 12.5 4 16a5 5 0 0 0 5 5h6a5 5 0 0 0 5-5c0-3.5-2.5-7.5-7-9.5\"/><path d=\"m14.5 11.5-5 6\"/><circle cx=\"9.8\" cy=\"12\" r=\"1\"/><circle cx=\"14.2\" cy=\"17\" r=\"1\"/>",
  // Alcohol policy (HIAPA and its issues): a glass inside a shield
  "glass-shield": "<path d=\"M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z\"/><path d=\"M9 7h6l-.5 3.5a2.5 2.5 0 0 1-5 0Z\"/><path d=\"M12 13v3.5\"/><path d=\"M10 16.5h4\"/>",
  // Medical debt: a medical bill, checked off
  "bill-forgiven": "<path d=\"M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z\"/><path d=\"M12 7v4\"/><path d=\"M10 9h4\"/><path d=\"m9 14 2 2 4-4\"/>",
  // Property sales: a house with a price tag
  "house-tag": "<path d=\"M3 10a2 2 0 0 1 .7-1.5l7-6a2 2 0 0 1 2.6 0l7 6A2 2 0 0 1 21 10\"/><path d=\"M5 10v9a2 2 0 0 0 2 2h4\"/><path d=\"M14 15.6V18l3.4 3.4a1.1 1.1 0 0 0 1.6 0l2.4-2.4a1.1 1.1 0 0 0 0-1.6L18 14h-2.4a1.6 1.6 0 0 0-1.6 1.6Z\"/><circle cx=\"16.3\" cy=\"16.3\" r=\".4\"/>",
};
