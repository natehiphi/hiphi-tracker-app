// Illustrations and the HIPHI mark, as inline SVG strings (decorative: aria-hidden). Flat, at most three brand
// colours plus ink, coloured through the page's CSS tokens so they follow the palette. Original drawings, 9/19.
// The crescent mark is cut from HIPHI's official logo file (its first two groups), not redrawn.
export const MARK = `<svg class="mark" viewBox="-32 49 330 330" aria-hidden="true" focusable="false"><path fill="#D67234" fill-rule="evenodd" d="M135.9,315.2c-36,13.8-76.3-4.2-90.1-40.2c-5.8-15-6-30.8-1.6-45.1c-13.5,24.8-16.5,55.1-5.6,83.5 c5,13,12.3,24.3,21.4,33.7c22.7,13.4,51,16.7,77.6,6.5c46.2-17.7,69.4-69.5,51.7-115.7c-7.8-20.5-22.4-36.4-40.2-46.3 c11.9,7.8,21.6,19.2,27,33.5C189.9,261.1,171.9,301.4,135.9,315.2z"/><path fill="#F18336" fill-rule="evenodd" d="M189.2,237.9c17.7,46.2-5.4,98-51.7,115.7c-26.5,10.1-54.9,6.9-77.6-6.5c27,27.9,69,38.6,107.5,23.8 c51.5-19.7,77.3-77.5,57.6-129c-6.9-17.9-18.3-32.8-32.6-43.6c-22.8-16.1-51.4-23-79.9-18.1c13,0.3,25.7,4.3,36.4,11.3 C166.9,201.5,181.4,217.4,189.2,237.9z"/><path fill="#3F9EB9" fill-rule="evenodd" d="M129.7,113.4c36-13.8,76.3,4.2,90.1,40.2c5.7,15,5.9,30.8,1.6,45.1c13.5-24.8,16.5-55.1,5.6-83.5 c-5-13-12.4-24.3-21.4-33.7c-22.7-13.4-51.1-16.7-77.6-6.5c-46.2,17.7-69.3,69.5-51.7,115.7c7.8,20.5,22.4,36.4,40.2,46.3 c-11.9-7.8-21.6-19.2-27.1-33.5C75.7,167.5,93.7,127.1,129.7,113.4z"/><path fill="#4DBCEA" fill-rule="evenodd" d="M76.3,190.7c-17.7-46.2,5.5-98,51.7-115.7c26.5-10.1,54.9-6.9,77.6,6.5c-27-27.9-69-38.6-107.5-23.8 c-51.5,19.7-77.3,77.5-57.6,129c6.9,17.9,18.4,32.8,32.6,43.6c22.8,16.1,51.4,23,79.9,18.1c-13-0.3-25.7-4.3-36.4-11.3 C98.7,227.1,84.2,211.2,76.3,190.7z"/></svg>`;

// The Hawaiʻi State Capitol: the flat roof on palm-like columns, the two volcano-cone chambers inside, the
// reflecting pool around it, and the sun.
export const CAPITOL = `<svg class="art art-capitol" viewBox="0 0 360 120" aria-hidden="true" focusable="false">
  <circle cx="296" cy="19" r="12" fill="var(--o400)"/>
  <path d="M94 92c10-14 18-28 28-33h16c10 5 18 19 28 33z" fill="var(--p300)"/>
  <path d="M194 92c10-14 18-28 28-33h16c10 5 18 19 28 33z" fill="var(--p300)"/>
  <rect x="36" y="34" width="288" height="5" rx="2" fill="var(--p900)"/>
  <rect x="40" y="39" width="280" height="8" fill="var(--p800)"/>
  <g fill="var(--p700)"><path d="M50.0 92V56L44.0 46h16L54.0 56V92z"/><path d="M73.3 92V56L67.3 46h16L77.3 56V92z"/><path d="M96.6 92V56L90.6 46h16L100.6 56V92z"/><path d="M119.9 92V56L113.9 46h16L123.9 56V92z"/><path d="M143.2 92V56L137.2 46h16L147.2 56V92z"/><path d="M166.5 92V56L160.5 46h16L170.5 56V92z"/><path d="M189.8 92V56L183.8 46h16L193.8 56V92z"/><path d="M213.1 92V56L207.1 46h16L217.1 56V92z"/><path d="M236.4 92V56L230.4 46h16L240.4 56V92z"/><path d="M259.7 92V56L253.7 46h16L263.7 56V92z"/><path d="M283.0 92V56L277.0 46h16L287.0 56V92z"/><path d="M306.3 92V56L300.3 46h16L310.3 56V92z"/></g>
  <rect x="30" y="92" width="300" height="6" rx="2" fill="var(--p800)"/>
  <rect x="8" y="100" width="344" height="14" rx="7" fill="var(--p100)"/>
  <path d="M40 107h60M130 107h40M200 107h70M290 107h30" stroke="var(--p300)" stroke-width="2" stroke-linecap="round"/>
</svg>`;

// The big pictures (R-197, Nate's go 10/10 "As recommended": Canva for the few big pictures, made with HIPHI's Canva
// account). A picture, not an SVG string: Canva's drawing has too much detail to redraw by hand. Practice copy first (Show
// me lane, as R-284): it shows on ?demo=1 until Nate's yes on the screenshots, then this turns true for everyone.
const PICS_LIVE = false;
// Both go in: the picture shows only where it costs the screen nothing (a laptop's side column, start.css); phones and
// tablets keep the line drawing so the topics still start near the top (A-1). Lazy, so a hidden picture is never fetched.
export const capitolPic = (demo = false) => demo || PICS_LIVE
  ? `${CAPITOL}<img class="art art-pic" src="${new URL('art/capitol-720.jpg', import.meta.url)}" srcset="${new URL('art/capitol-720.jpg', import.meta.url)} 720w, ${new URL('art/capitol-1200.jpg', import.meta.url)} 1200w" sizes="420px" width="1200" height="605" alt="" loading="lazy" decoding="async">`
  : CAPITOL;

// Three neighbours speaking up: a letter, a phone, a raised hand.
export const VOICES = `<svg class="art art-voices" viewBox="0 0 240 120" aria-hidden="true" focusable="false">
  <ellipse cx="120" cy="112" rx="104" ry="6" fill="var(--p50)"/>
  <circle cx="62" cy="36" r="13" fill="var(--p700)"/><path d="M38 110c0-30 10-50 24-50s24 20 24 50z" fill="var(--p700)"/>
  <rect x="70" y="66" width="22" height="28" rx="3" fill="var(--n0)" stroke="var(--p900)" stroke-width="2"/><path d="M75 74h12M75 80h12M75 86h8" stroke="var(--p300)" stroke-width="2" stroke-linecap="round"/>
  <circle cx="120" cy="30" r="14" fill="var(--o400)"/><path d="M94 110c0-34 11-56 26-56s26 22 26 56z" fill="var(--o400)"/>
  <path d="M142 70l14-40" stroke="var(--o400)" stroke-width="9" stroke-linecap="round"/><circle cx="157" cy="27" r="6" fill="var(--o400)"/>
  <circle cx="180" cy="40" r="12" fill="var(--p400)"/><path d="M158 110c0-28 9-46 22-46s22 18 22 46z" fill="var(--p400)"/>
  <rect x="156" y="70" width="13" height="22" rx="3" fill="var(--p900)"/><rect x="158" y="73" width="9" height="14" rx="1" fill="var(--p100)"/>
</svg>`;

// The eight main Hawaiian islands, from public-domain US Census outlines (us-atlas 1:10m), projected flat at
// latitude 20.6°N and lightly smoothed so the coast reads well at small sizes. Each island is its own shape, so
// islands('oahu') can pick out the person's island. Replaces the hand-drawn blobs (Nate, 9/19: "not pretty").
const ISLAND_PATHS = [
  ['hawaii', 'M243.3 156.5C243.1 155.2 243.0 155.3 243.7 154.3C244.4 153.2 246.5 151.0 247.6 150.3C248.6 149.6 249.2 150.8 250.0 149.9C250.8 149.1 251.7 146.4 252.6 145.1C253.6 143.9 255.3 143.4 255.9 142.4C256.5 141.5 257.0 140.7 256.5 139.4C256.0 138.1 253.8 135.7 253.1 134.5C252.3 133.3 252.4 133.5 252.2 132.2C252.1 130.9 251.8 128.0 252.0 126.7C252.3 125.5 252.8 125.0 253.7 124.8C254.5 124.6 256.1 124.9 257.3 125.3C258.5 125.6 260.3 126.4 261.0 126.9C261.7 127.5 260.7 127.9 261.6 128.6C262.4 129.3 264.8 130.1 266.1 130.9C267.3 131.7 268.2 133.0 269.1 133.3C270.0 133.7 270.3 132.8 271.5 133.0C272.8 133.2 274.5 133.7 276.6 134.7C278.8 135.6 282.8 137.8 284.5 138.7C286.3 139.5 286.0 139.0 287.2 139.7C288.4 140.4 290.4 141.8 291.7 142.8C292.9 143.9 293.8 144.6 294.9 145.8C296.0 146.9 297.9 148.7 298.4 149.7C298.8 150.8 297.8 151.0 297.7 152.2C297.7 153.4 297.6 156.0 297.9 156.9C298.3 157.7 298.8 157.4 299.6 157.4C300.4 157.4 302.0 156.4 302.8 156.8C303.6 157.1 304.0 158.7 304.2 159.7C304.5 160.7 303.3 161.5 304.0 162.7C304.8 163.9 307.0 165.9 308.5 166.9C310.0 168.0 312.1 168.4 313.0 169.0C313.9 169.5 314.0 169.5 314.0 170.0C314.0 170.6 313.8 171.5 313.2 172.3C312.6 173.2 311.6 174.1 310.5 175.0C309.5 175.8 308.1 176.5 307.1 177.4C306.0 178.3 305.5 179.5 304.2 180.3C303.0 181.1 301.0 181.6 299.6 182.3C298.1 183.0 296.9 184.2 295.5 184.8C294.2 185.3 292.7 185.7 291.4 185.7C290.2 185.7 289.0 185.0 288.2 184.9C287.4 184.9 287.3 184.7 286.4 185.4C285.5 186.0 283.9 188.0 282.7 188.8C281.6 189.6 280.4 189.5 279.5 190.1C278.5 190.7 277.7 192.0 276.8 192.6C275.9 193.1 274.9 192.8 274.0 193.4C273.1 194.1 271.9 195.7 271.5 196.5C271.2 197.3 272.0 197.6 271.7 198.2C271.5 198.8 270.6 199.3 270.1 200.1C269.7 201.0 269.9 202.1 269.1 203.2C268.3 204.2 266.2 206.4 265.0 206.5C263.9 206.5 263.2 204.3 262.0 203.3C260.7 202.3 259.0 201.3 257.5 200.6C256.0 199.9 254.1 200.2 253.1 199.1C252.0 198.0 251.2 196.0 251.0 194.2C250.8 192.4 251.7 190.6 252.0 188.3C252.3 186.0 253.1 182.7 252.8 180.4C252.6 178.2 251.1 176.2 250.8 174.9C250.5 173.6 251.3 173.0 251.0 172.5C250.7 172.0 249.7 173.0 249.2 171.9C248.7 170.8 248.6 167.6 248.2 166.0C247.8 164.4 247.3 163.2 246.8 162.6C246.2 161.9 245.5 163.2 244.9 162.2C244.3 161.1 243.5 157.9 243.3 156.5Z'],
  ['maui', 'M206.9 85.3C206.9 84.2 207.4 82.8 207.9 81.7C208.5 80.7 209.3 79.4 210.2 78.8C211.0 78.3 212.1 78.3 213.0 78.5C213.9 78.8 214.9 79.3 215.7 80.2C216.4 81.2 217.0 83.2 217.7 84.3C218.4 85.4 218.6 86.7 219.7 86.9C220.9 87.1 223.2 85.9 224.6 85.4C226.0 84.8 226.8 83.7 228.3 83.6C229.8 83.4 232.7 84.3 233.5 84.6C234.4 85.0 233.0 84.9 233.5 85.5C234.1 86.1 236.1 87.6 237.0 88.1C237.9 88.7 238.5 88.4 239.0 88.9C239.5 89.4 238.8 90.3 240.0 91.0C241.3 91.7 245.1 92.3 246.3 92.9C247.6 93.5 247.2 93.8 247.4 94.6C247.5 95.3 247.6 96.4 247.4 97.3C247.1 98.1 246.4 98.8 245.7 99.5C245.0 100.2 243.7 101.3 243.1 101.6C242.5 101.9 242.7 101.1 241.9 101.4C241.1 101.7 239.5 103.1 238.4 103.3C237.4 103.5 237.1 102.4 235.6 102.8C234.1 103.1 231.2 105.0 229.5 105.5C227.8 106.1 226.5 106.1 225.2 106.0C223.9 105.9 222.6 106.7 221.8 104.6C220.9 102.6 220.8 95.7 220.3 93.7C219.9 91.7 219.6 92.7 218.9 92.7C218.2 92.7 217.4 94.2 216.1 93.9C214.7 93.7 212.1 92.3 210.8 91.3C209.5 90.4 208.8 89.3 208.2 88.3C207.5 87.3 207.0 86.4 206.9 85.3Z'],
  ['kahoolawe', 'M206.7 108.8C206.6 108.3 207.0 108.0 208.2 107.3C209.3 106.6 212.6 104.6 213.8 104.3C215.1 104.1 215.7 105.3 215.9 105.9C216.1 106.5 215.0 107.7 215.1 108.2C215.1 108.7 216.3 108.8 216.1 109.1C215.8 109.4 214.0 110.0 213.4 110.1C212.8 110.1 213.2 109.2 212.4 109.3C211.6 109.3 209.7 110.5 208.8 110.5C207.8 110.4 206.8 109.3 206.7 108.8Z'],
  ['lanai', 'M186.4 86.3C186.6 85.8 187.2 85.2 187.8 84.9C188.5 84.6 189.2 84.5 190.5 84.6C191.8 84.8 194.3 85.0 195.8 85.6C197.2 86.3 198.4 87.8 199.2 88.8C200.1 89.7 200.9 90.4 200.8 91.4C200.8 92.4 200.0 94.0 199.0 94.8C198.1 95.6 196.4 96.0 195.1 96.3C193.9 96.6 192.5 97.0 191.7 96.5C190.9 96.1 190.6 94.6 190.3 93.4C189.9 92.3 190.2 90.5 189.7 89.6C189.1 88.7 187.4 88.5 186.8 88.0C186.3 87.4 186.2 86.8 186.4 86.3Z'],
  ['molokai', 'M172.4 74.4C172.1 73.8 173.1 72.4 173.6 71.7C174.1 71.0 175.2 70.9 175.4 70.2C175.7 69.4 174.5 67.6 175.0 67.1C175.5 66.7 177.8 67.1 178.5 67.2C179.2 67.4 177.2 67.6 179.1 68.0C181.0 68.3 187.9 69.5 190.1 69.5C192.2 69.4 191.6 67.6 192.1 67.7C192.6 67.8 192.0 69.4 192.9 69.9C193.8 70.4 195.7 70.6 197.4 70.6C199.0 70.5 201.4 69.6 202.9 69.6C204.4 69.7 206.0 70.2 206.3 70.9C206.6 71.6 205.6 72.9 204.7 73.8C203.8 74.7 202.3 75.8 201.0 76.4C199.8 77.1 198.8 77.6 197.0 77.5C195.1 77.4 191.9 76.4 189.9 75.9C187.8 75.3 186.0 74.4 184.6 74.3C183.2 74.1 183.0 74.8 181.5 75.0C180.0 75.2 177.2 75.3 175.6 75.2C174.1 75.1 172.7 75.0 172.4 74.4Z'],
  ['oahu', 'M117.5 45.5C118.6 45.1 124.4 45.6 126.3 45.1C128.2 44.6 128.3 43.2 128.9 42.5C129.5 41.8 129.2 41.4 129.7 40.7C130.3 40.0 131.5 38.8 132.4 38.2C133.3 37.7 134.5 37.3 135.2 37.4C135.9 37.5 136.0 38.0 136.4 38.8C136.8 39.7 136.8 41.1 137.7 42.5C138.5 43.8 140.9 45.7 141.7 46.8C142.5 48.0 142.5 49.0 142.5 49.5C142.5 50.1 141.7 49.8 141.7 50.3C141.7 50.8 141.6 51.9 142.3 52.8C143.0 53.6 145.3 55.6 146.0 55.6C146.7 55.6 146.1 53.1 146.6 52.6C147.1 52.2 148.8 52.2 149.0 52.8C149.3 53.3 148.1 55.3 148.2 56.1C148.4 56.8 149.6 56.9 149.8 57.3C150.1 57.8 149.1 58.0 149.6 58.8C150.2 59.7 152.9 61.5 153.1 62.5C153.3 63.4 151.4 64.2 150.7 64.4C149.9 64.6 149.5 63.4 148.4 63.5C147.3 63.5 145.1 64.9 144.2 65.0C143.2 65.0 143.7 64.1 142.9 63.6C142.2 63.1 140.9 62.4 139.5 62.0C138.1 61.6 136.3 61.3 134.4 61.4C132.5 61.5 129.6 62.3 128.3 62.5C127.1 62.6 127.4 63.0 126.9 62.3C126.4 61.5 126.1 58.9 125.5 57.9C124.9 56.9 123.6 56.7 123.2 56.1C122.8 55.6 123.5 55.4 123.0 54.5C122.5 53.7 120.7 52.1 120.2 51.0C119.7 49.9 120.6 48.8 120.2 47.9C119.7 47.0 116.5 46.0 117.5 45.5Z'],
  ['kauai', 'M32.2 18.2C31.9 17.3 32.0 16.8 32.4 16.1C32.8 15.5 34.1 14.9 34.6 14.2C35.2 13.4 34.2 12.7 35.5 11.6C36.7 10.6 40.8 8.7 42.2 7.9C43.6 7.0 42.7 6.6 43.8 6.5C44.8 6.5 47.6 7.5 48.5 7.5C49.3 7.4 48.4 6.3 49.1 6.2C49.7 6.0 51.5 6.8 52.3 6.7C53.1 6.7 53.2 5.9 53.9 6.0C54.7 6.1 56.1 6.5 57.0 7.0C57.8 7.5 58.5 8.3 59.0 9.0C59.5 9.7 59.9 10.5 60.0 11.3C60.2 12.1 60.4 12.7 60.0 13.7C59.7 14.6 58.1 15.5 57.8 17.0C57.5 18.4 58.1 21.3 58.0 22.5C57.9 23.6 58.3 23.0 57.2 23.9C56.1 24.8 52.7 27.4 51.5 28.0C50.3 28.5 51.4 27.4 49.9 27.2C48.4 27.0 44.4 27.3 42.6 26.6C40.7 25.9 40.3 23.7 38.9 22.9C37.5 22.0 35.2 22.2 34.0 21.4C32.9 20.6 32.5 19.1 32.2 18.2Z'],
  ['niihau', 'M6.2 29.2C6.4 28.4 6.5 27.7 7.0 26.9C7.6 26.2 8.4 25.4 9.5 24.6C10.5 23.9 12.6 23.0 13.3 22.3C14.0 21.6 13.3 20.7 13.7 20.3C14.2 19.9 15.5 19.7 16.0 19.9C16.4 20.1 16.5 20.7 16.4 21.5C16.3 22.2 15.4 23.6 15.3 24.4C15.2 25.2 16.4 25.8 15.8 26.3C15.1 26.9 12.9 26.7 11.7 27.8C10.5 28.8 9.4 32.2 8.4 32.8C7.5 33.4 6.4 31.9 6.0 31.2C5.6 30.6 6.0 29.9 6.2 29.2Z']];
// Drawn like the Capitol: a pale sea, the orange sun, a few curved wave strokes. With one island named, it stands out in deep
// blue and the rest step back; with none, the whole chain is brand blue.
// The sun stays the Capitol's orange: a soft yellow was tried and Nate preferred the orange (9/26, R-005).
// Each wave is a gentle curve, two or four half-waves long, so it reads as water and not as a dash (R-005).
// [x, y, length] in the drawing's own units; the strokes sit where the straight ones did.
const WAVES = [[196, 62, 30], [236, 84, 18], [34, 112, 24], [66, 136, 38], [44, 160, 20], [124, 186, 34], [172, 206, 20]]
  .map(([x, y, w]) => { const n = 2 * Math.max(1, Math.round(w / 18)), h = +(w / n).toFixed(1);
    return `M${x} ${y}q${+(h / 2).toFixed(2)} -5 ${h} 0` + `t${h} 0`.repeat(n - 1); }).join('');
// highlight: one island ('oahu'), several ('kauai,niihau' or an array), or a county ('mauicounty', 'kauaicounty').
const COUNTY = { mauicounty: ['maui', 'molokai', 'lanai', 'kahoolawe'], kauaicounty: ['kauai', 'niihau'] };
const litSet = h => new Set((Array.isArray(h) ? h : String(h || '').split(',')).flatMap(x => COUNTY[x.trim()] || [x.trim()]).filter(Boolean));
export const islands = (highlight = '') => { const lit = litSet(highlight); return `<svg class="art art-islands" viewBox="0 0 336 236" aria-hidden="true" focusable="false">
  <rect width="336" height="236" rx="28" fill="var(--p100)"/>
  <circle cx="290" cy="40" r="14" fill="var(--o400)"/>
  <path d="${WAVES}" stroke="var(--p300)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <g transform="translate(8 12)">${ISLAND_PATHS.map(([n, p]) => `<path d="${p}" fill="var(${!lit.size ? '--p700' : lit.has(n) ? '--p800' : '--p400'})"/>`).join('')}</g></svg>`; };
export const ISLANDS = islands();

// Five-petal hibiscus in HIPHI orange and a warm pink, plumeria-yellow centre (the celebration flower).
export const flower = (n = 24, c = 'var(--o400)') => `<svg class="flower" viewBox="-12 -12 24 24" width="${n}" height="${n}" aria-hidden="true" focusable="false"><g fill="${c}">${[0, 72, 144, 216, 288].map(r => `<ellipse cx="0" cy="-5.6" rx="4.1" ry="5.6" transform="rotate(${r})"/>`).join('')}</g><circle r="2.2" fill="#F9D56E"/></svg>`;

// ---- the issue scenes on the big action card (R-283, Nate 10/14) ----
// One band across the top of the card that leads Home and a bill's page, a drawing per topic, so someone who taps a shared
// link lands on the same kind of picture the link showed. List rows never carry one. Nate's answers on the bus scene: fuller
// characters, simple, like now. Every keiki is one flat figure (overlapping shapes, no outlines, no faces), and no scene shows
// a child near a nicotine product. 360x130 drawn, sliced to the band's width, so the middle is where the people stand.
// The bus scene is the one Nate approved (docs/requests/R-283-bus-scene.svg); the others reuse its two keiki.
// The younger one (bag: false drops the backpack), drawn standing with feet at y 112.5 and centred on x 72; moved with translate. c: colours.
const young = (x, base, c = {}) => { const k = { skin: '#C68A5E', hair: '#3B2A20', dress: '#F18336', shade: '#E06F22', bag: '#3F9EB9', feet: '#7E22CE', ...c };
  return `<g transform="translate(${x - 72} ${base - 112.5})">${k.bag ? `<rect x="56" y="80" width="9" height="16" rx="3.5" fill="${k.bag}"/>` : ''}
  <rect x="66.5" y="96" width="4" height="14" rx="2" fill="${k.skin}"/><rect x="73.5" y="96" width="4" height="14" rx="2" fill="${k.skin}"/>
  <rect x="63.5" y="108.5" width="8" height="4" rx="2" fill="${k.feet}"/><rect x="72.5" y="108.5" width="8" height="4" rx="2" fill="${k.feet}"/>
  <path d="M80 82l3 13" stroke="${k.skin}" stroke-width="4" stroke-linecap="round"/>
  <path d="M65.5 77h13l5.5 22H60z" fill="${k.dress}"/><path d="M65.5 77h13l1.5 6h-16z" fill="${k.shade}"/>
  <rect x="70" y="73" width="4" height="5" fill="${k.skin}"/><circle cx="72" cy="68" r="7.5" fill="${k.skin}"/>
  <path d="M64.5 68a7.5 7.5 0 0 1 15 0c-3-3.5-9-4-12.5-1-1 .8-1.8 1.2-2.5 1z" fill="${k.hair}"/><circle cx="65.5" cy="62.5" r="3.6" fill="${k.hair}"/></g>`; };
// The older one, feet at y 113 and centred on x 117.5. arm: 'up' (raised, the hand at 138.5,56: something held goes there)
// or 'down'. No backpack outside school scenes (bag: false).
const older = (x, base, c = {}, arm = 'down') => { const k = { skin: '#8D5A3B', hair: '#1E1A17', shirt: '#3F9EB9', shorts: '#142B35', bag: '#D9473B', feet: '#39BFEE', ...c };
  return `<g transform="translate(${x - 117.5} ${base - 113})">${k.bag ? `<rect x="98" y="68" width="12" height="22" rx="4" fill="${k.bag}"/>` : ''}
  <rect x="110.5" y="94" width="5" height="16" rx="2.5" fill="${k.skin}"/><rect x="119.5" y="94" width="5" height="16" rx="2.5" fill="${k.skin}"/>
  <rect x="107" y="108.5" width="10" height="4.5" rx="2.2" fill="${k.feet}"/><rect x="118.5" y="108.5" width="10" height="4.5" rx="2.2" fill="${k.feet}"/>
  <path d="M108 87h19v10h-8l-1.5-3.5L116 97h-8z" fill="${k.shorts}"/>
  ${arm === 'up' ? `<path d="M125 72l13-15" stroke="${k.skin}" stroke-width="5.5" stroke-linecap="round"/>` : `<path d="M126 72l3 16" stroke="${k.skin}" stroke-width="5.5" stroke-linecap="round"/>`}
  <rect x="106" y="65" width="22" height="25" rx="7" fill="${k.shirt}"/>
  ${arm === 'up' ? `<path d="M122 67l7 6-3.5 4-6-4z" fill="${k.shirt}"/>` : `<rect x="121" y="66" width="8" height="10" rx="3.5" fill="${k.shirt}"/>`}
  <rect x="115" y="60" width="5" height="6" fill="${k.skin}"/><circle cx="117.5" cy="55" r="9" fill="${k.skin}"/>
  <path d="M108.5 55a9 9 0 0 1 18 -1.5c-4-2.6-10-2.8-14.5.2-1.3.9-2.4 1.4-3.5 1.3z" fill="${k.hair}"/>
  <path d="M108.6 53.6c-.6 2.4-.3 4.8.7 6.6l2-5.3z" fill="${k.hair}"/></g>`; };
// A grown-up, a head taller than the older keiki, in the same flat way; feet at base, centred on x. long: long hair.
// hand: 'left' rests the left hand on the shoulder of a keiki standing just to the left; else the arms hang.
const grown = (x, base, c = {}, { long = false, hand = '' } = {}) => { const k = { skin: '#A8714C', hair: '#2A211C', shirt: '#7E22CE', pants: '#5F6F76', feet: '#142B35', ...c };
  const t = (dx, dy) => `${x + dx} ${base + dy}`;
  return `<g>${long ? `<rect x="${x - 9.5}" y="${base - 86}" width="19" height="22" rx="7" fill="${k.hair}"/>` : ''}
  <rect x="${x - 7}" y="${base - 38}" width="6" height="34" rx="2.5" fill="${k.pants}"/><rect x="${x + 1}" y="${base - 38}" width="6" height="34" rx="2.5" fill="${k.pants}"/>
  <rect x="${x - 10}" y="${base - 5}" width="10" height="5" rx="2.4" fill="${k.feet}"/><rect x="${x + 1}" y="${base - 5}" width="10" height="5" rx="2.4" fill="${k.feet}"/>
  <path d="M${t(-9, -64)}l${hand === 'left' ? '-8 26' : '-3 22'}" stroke="${k.skin}" stroke-width="5.5" stroke-linecap="round"/>
  <path d="M${t(9, -64)}l3 22" stroke="${k.skin}" stroke-width="5.5" stroke-linecap="round"/>
  <rect x="${x - 11}" y="${base - 70}" width="22" height="34" rx="7" fill="${k.shirt}"/>
  <rect x="${x - 2.5}" y="${base - 75}" width="5" height="6" fill="${k.skin}"/><circle cx="${x}" cy="${base - 83}" r="9" fill="${k.skin}"/>
  <path d="M${t(-9, -83)}a9 9 0 0 1 18 0c-4-3.4-12-3.6-18 0z" fill="${k.hair}"/></g>`; };
const sky = c => `<rect width="360" height="130" fill="${c}"/>`, sun = (x = 92) => `<circle cx="${x}" cy="24" r="11" fill="#F4B223"/>`;
// Two layers, so a wide card never crops a head or a wheel (the ui-critic, R-283: a 640px laptop card cut the drawing at
// 120px tall): the sky, hills and ground (before FG) stretch to any width; the people and things keep their shape, whole,
// centred and standing on the ground. At a phone's width the two line up as the one drawing Nate approved.
const FG = '<!--fg-->';
const svgBand = (key, body) => { const [bg, fg] = body.split(FG), a = 'aria-hidden="true" focusable="false"';
  return `<svg class="art art-band art-${key}" viewBox="0 0 360 130" preserveAspectRatio="none" ${a}>${bg}</svg><svg class="art art-band-fg" viewBox="0 0 360 130" preserveAspectRatio="xMidYMax meet" ${a}>${fg}</svg>`; };

const SCENES = {
  // Getting Around: keiki boarding the yellow school bus with a pass (the approved drawing, R-283).
  around: () => `<rect width="360" height="130" fill="#EAF7FD"/>
  <path d="M0 92L38 62l30 14 42-34 48 38 46-30 50 28 40-30 66 34v42H0z" fill="#CDEBF7"/><rect y="112" width="360" height="18" fill="#DCE3E6"/><path d="M0 112h360" stroke="#C2CCD1" stroke-width="2"/>${FG}<circle cx="92" cy="24" r="11" fill="#F4B223"/>
  <rect x="38" y="44" width="3" height="68" fill="#5F6F76"/><rect x="27" y="28" width="25" height="18" rx="4" fill="#3F9EB9"/><rect x="32" y="33" width="15" height="8" rx="2" fill="#FFFFFF"/>
  <rect x="150" y="38" width="186" height="64" rx="12" fill="#F4B223"/><rect x="134" y="60" width="26" height="42" rx="8" fill="#F4B223"/><rect x="134" y="84" width="202" height="5" fill="#142B35" opacity=".85"/>
  <rect x="160" y="46" width="22" height="38" rx="4" fill="#C4E8F6"/><path d="M171 46v38" stroke="#F4B223" stroke-width="2"/>
  <rect x="192" y="48" width="30" height="24" rx="5" fill="#C4E8F6"/><rect x="228" y="48" width="30" height="24" rx="5" fill="#C4E8F6"/><rect x="264" y="48" width="30" height="24" rx="5" fill="#C4E8F6"/><rect x="300" y="48" width="28" height="24" rx="5" fill="#C4E8F6"/>
  <circle cx="140" cy="94" r="3.5" fill="#FFFFFF"/><circle cx="178" cy="104" r="12" fill="#142B35"/><circle cx="178" cy="104" r="5" fill="#C2CCD1"/><circle cx="302" cy="104" r="12" fill="#142B35"/><circle cx="302" cy="104" r="5" fill="#C2CCD1"/>
  ${young(72, 112.5)}${older(117.5, 113, {}, 'up')}
  <rect x="131" y="42" width="21" height="15" rx="2.5" fill="#FFFFFF"/><rect x="131" y="42" width="21" height="5" rx="2" fill="#39BFEE"/><rect x="134" y="50.5" width="9" height="2" rx="1" fill="#C2CCD1"/><circle cx="137" cy="57" r="3" fill="#8D5A3B"/>`,
  // Food: a farmers' market stall of local fruit; the older keiki holds up an apple, a grown-up minds the stall.
  food: () => `${sky('#FFF6E5')}<path d="M0 96L44 70l40 16 50-30 60 36 166-30v68H0z" fill="#E4F1D2"/><rect y="112" width="360" height="18" fill="#E9DDC8"/>${FG}${sun()}
  ${grown(266, 124, { shirt: '#3F8F3A', skin: '#C68A5E', hair: '#3B2A20' }, { long: true })}
  <rect x="196" y="20" width="4" height="92" fill="#8A5A33"/><rect x="330" y="20" width="4" height="92" fill="#8A5A33"/>
  ${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<rect x="${188 + i * 19}" y="12" width="19" height="16" fill="${i % 2 ? '#FFFFFF' : '#D9473B'}"/><circle cx="${197.5 + i * 19}" cy="28" r="9.5" fill="${i % 2 ? '#FFFFFF' : '#D9473B'}"/>`).join('')}
  <rect x="188" y="76" width="154" height="54" rx="4" fill="#F4B223"/><rect x="188" y="76" width="154" height="6" rx="3" fill="#E09E12"/>
  <rect x="200" y="64" width="38" height="14" rx="2" fill="#B07A3E"/><rect x="246" y="64" width="38" height="14" rx="2" fill="#B07A3E"/><rect x="292" y="64" width="38" height="14" rx="2" fill="#B07A3E"/>
  ${[206, 218, 230].map(x => `<circle cx="${x}" cy="62" r="6.5" fill="#D9473B"/>`).join('')}${[252, 264, 276].map(x => `<circle cx="${x}" cy="62" r="6.5" fill="#F18336"/>`).join('')}
  <path d="M296 64c6-10 22-12 30-4-8-2-20 0-30 4z" fill="#F9D56E"/><path d="M298 62c6-8 18-9 26-4" stroke="#E0B53A" stroke-width="2" fill="none"/>
  ${young(72, 112.5, { dress: '#3F9EB9', shade: '#2F86A0', bag: '#F18336' })}${older(117.5, 113, { shirt: '#F18336', bag: false }, 'up')}
  <circle cx="139" cy="52" r="7" fill="#D9473B"/><path d="M139 45c1-4 4-6 7-6-1 3-3 5-7 6z" fill="#3F8F3A"/>`,
  // Tobacco: a smoke-free park, the keiki playing ball under the park's no-smoking, no-e-cigarettes sign. No child holds or
  // stands beside a product: the only one drawn is crossed out on the sign.
  tobacco: () => `${sky('#EAF7FD')}<path d="M0 94L50 72l46 12 58-26 64 30 70-22 72 26v34H0z" fill="#D6EDC4"/><rect y="110" width="360" height="20" fill="#BFE0A6"/>${FG}${sun()}
  <rect x="290" y="52" width="11" height="60" rx="3" fill="#8A5A33"/><circle cx="282" cy="46" r="22" fill="#5E9B2A"/><circle cx="308" cy="40" r="24" fill="#6FAE35"/><circle cx="296" cy="24" r="18" fill="#6FAE35"/>
  <rect x="214" y="52" width="4" height="60" fill="#5F6F76"/><rect x="194" y="22" width="44" height="34" rx="6" fill="#FFFFFF"/>
  <rect x="203" y="36" width="24" height="7" rx="2" fill="#8A98A0"/><rect x="223" y="36" width="5" height="7" rx="1" fill="#F68B2C"/>
  <circle cx="216" cy="39" r="12" fill="none" stroke="#D9473B" stroke-width="3.5"/><path d="M207.5 47.5l17-17" stroke="#D9473B" stroke-width="3.5"/>
  ${young(72, 112.5, { dress: '#7E22CE', shade: '#6A1BAE', bag: false, feet: '#F18336' })}
  ${older(122, 113, { shirt: '#D9473B', bag: false, skin: '#C68A5E', hair: '#5A3A22' }, 'up')}
  <circle cx="162" cy="106" r="7" fill="#F18336"/><path d="M155.5 104.5q6.5 3 13 0" stroke="#FFFFFF" stroke-width="1.8" fill="none"/>`,
  // Health care: a grown-up walks a keiki by the hand to the neighbourhood clinic.
  care: () => `${sky('#EEF4FF')}<path d="M0 96L52 74l48 14 52-28v52H0z" fill="#DCE7FA"/><rect y="112" width="360" height="18" fill="#E6E1D8"/><path d="M0 112h360" stroke="#D3CCBF" stroke-width="2"/>${FG}${sun()}
  <rect x="196" y="34" width="150" height="78" rx="4" fill="#FFFFFF"/><rect x="190" y="26" width="162" height="12" rx="4" fill="#C4D7F5"/>
  <rect x="258" y="70" width="32" height="42" rx="3" fill="#95B8F0"/><path d="M274 70v42" stroke="#FFFFFF" stroke-width="2"/>
  <rect x="300" y="50" width="30" height="22" rx="4" fill="#C4E8F6"/><rect x="210" y="74" width="34" height="22" rx="4" fill="#C4E8F6"/>
  <circle cx="227" cy="54" r="12" fill="#D9473B"/><rect x="224" y="46" width="6" height="16" rx="1.5" fill="#FFFFFF"/><rect x="219" y="51" width="16" height="6" rx="1.5" fill="#FFFFFF"/>
  ${older(66, 113, { shirt: '#F4B223', bag: false, skin: '#C68A5E' })}
  ${grown(150, 112, { shirt: '#3F9EB9' }, { long: true, hand: 'left' })}${young(124, 112.5, { dress: '#D9473B', shade: '#C23A30', bag: false, skin: '#A8714C' })}`,
  // Families: two grown-ups and their keiki in front of home, a plantation-style house with a lanai.
  family: () => `${sky('#F6EFFB')}<path d="M0 98L60 76l54 14 50-24v46H0z" fill="#E8DDF4"/><rect y="110" width="360" height="20" fill="#CFE6B8"/>${FG}${sun(300)}
  <rect x="200" y="56" width="128" height="56" fill="#F6E3B4"/><path d="M190 58l74-30 74 30z" fill="#8A5A33"/>
  <rect x="200" y="84" width="128" height="4" fill="#E2C98E"/>  <rect x="212" y="64" width="26" height="18" rx="3" fill="#C4E8F6"/><rect x="290" y="64" width="26" height="18" rx="3" fill="#C4E8F6"/>
  ${[204, 232, 296, 324].map(x => `<rect x="${x}" y="88" width="3" height="24" fill="#FFFFFF"/>`).join('')}<rect x="200" y="88" width="128" height="3" fill="#FFFFFF"/><rect x="252" y="76" width="24" height="36" rx="2" fill="#7E22CE"/>
  ${grown(160, 110, { shirt: '#F18336', skin: '#C68A5E', hair: '#3B2A20' }, { long: true })}${grown(130, 110, { shirt: '#3F9EB9' })}
  ${young(64, 110, { dress: '#7E22CE', shade: '#6A1BAE', bag: false })}${older(96, 110.5, { shirt: '#3F8F3A', bag: false })}`,
  // Climate: by the shore, keiki plant a young tree; the sea and a coconut palm behind them.
  climate: () => `${sky('#EAF7FD')}<rect y="76" width="360" height="40" fill="#7FCBEA"/><path d="M0 98q90-10 180 0t180 0v32H0z" fill="#F3DFAF"/>${FG}${sun(300)}
  <path d="M24 86q6-4 12 0t12 0M196 90q6-4 12 0t12 0M236 82q6-4 12 0t12 0" stroke="#FFFFFF" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <path d="M300 112c0-30 4-56 14-80" stroke="#8A5A33" stroke-width="8" fill="none" stroke-linecap="round"/>
  <path d="M314 32c-14-6-30-2-38 10 12-6 24-6 38-10zM314 32c10-10 26-12 38-4-14 0-26 2-38 4zM314 32c-6-12-4-24 6-30-2 12-4 20-6 30zM314 32c14 2 26 10 30 24-10-10-20-16-30-24zM314 32c-12 4-20 14-22 26 6-10 14-18 22-26z" fill="#3F8F3A"/>
  <circle cx="310" cy="36" r="4" fill="#8A5A33"/><circle cx="318" cy="38" r="4" fill="#8A5A33"/>
  <ellipse cx="160" cy="112" rx="18" ry="5" fill="#B07A3E"/><path d="M160 112V88" stroke="#3F8F3A" stroke-width="3"/>
  <path d="M160 96c-8-8-18-6-20-2 6 2 14 4 20 2zM160 90c6-10 18-10 20-6-6 4-14 6-20 6z" fill="#5E9B2A"/>
  ${young(76, 112.5, { dress: '#F4B223', shade: '#E09E12', bag: false })}${older(124, 113, { shirt: '#3F9EB9', bag: false, skin: '#C68A5E', hair: '#3B2A20' })}`,
};
// The topic key (pub/topics.js) to its band; '' for a topic with no scene.
export const issueScene = key => SCENES[key] ? svgBand(key, SCENES[key]()) : '';

// One drawing per issue (R-284, Nate's yes 10/15 to all 18): the issue's slug (public_issues.slug) to its sky colour, which
// tints the band while the picture loads. Each picture is a file in pub/issue-art/ holding both band layers (made by the
// backend's docs/requests/R-283-art/ship.js), not a string here: 18 drawings are ~100 KB and a card needs only its own.
const ISSUE_ART = {
  'free-school-meals-for-every-student': '#FFF6E8',
  'paid-family-and-medical-leave': '#FFF6E8',
  'protect-students-from-heat': '#FFF1D6',
  'fee-on-sugary-drinks': '#EAF7FD',
  'make-snap-easier': '#EAF7FD',
  'free-public-transit': '#EAF7FD',
  'cross-during-the-countdown': '#EAF7FD',
  'pesticide-buffer-zones': '#EAF7FD',
  'disposable-e-cigarette-ban': '#EAF7FD',
  'higher-liquor-taxes': '#EAF7FD',
  'let-counties-regulate-tobacco': '#BFE4F2',
  'dui-limit-05': '#2C4A6B',
  'keep-preventive-care-covered': '#FFF6E8',
  'hygienists-temporary-fillings': '#EEF6F8',
  'safety-for-immigrant-families': '#EAF7FD',
  'funding-for-community-nonprofits': '#EAF7FD',
  'child-and-dependent-care-credit': '#EAF7FD',
  'family-caregiver-tax-credit': '#EAF7FD',
};
// Practice copy first (Show me lane, R-284): the issue drawings show on ?demo=1 until Nate's yes on the screenshots, then
// this turns true and the live tracker gets them too.
const ISSUE_ART_LIVE = false;
const ARTV = 1;   // bump when a drawing changes, so phones fetch the new one
// The band for a bill's issue: its own drawing when it has one, else its topic's scene (issueScene); '' for neither.
export const issueBand = (iss, demo = false) => iss?.slug && ISSUE_ART[iss.slug] && (demo || ISSUE_ART_LIVE)
  ? `<img class="art art-band art-issue" src="${new URL(`issue-art/${iss.slug}.svg?v=${ARTV}`, import.meta.url)}" alt="" decoding="async" style="background:${ISSUE_ART[iss.slug]}">`
  : issueScene(iss?.category);
