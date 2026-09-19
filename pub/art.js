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

// The main Hawaiian islands, northwest to southeast.
export const ISLANDS = `<svg class="art art-islands" viewBox="0 0 320 150" aria-hidden="true" focusable="false">
  <g fill="var(--p100)" stroke="var(--p700)" stroke-width="2" stroke-linejoin="round">
    <path d="M18 50c4-6 10-7 13-3s1 11-4 14-12 0-9-11z"/>
    <path d="M44 30c9-8 24-6 29 3s1 21-10 24-24-1-26-10 1-12 7-17z"/>
    <path d="M100 52c8-6 20-4 26 3 6 7 3 16-3 21s-16 5-22-1-9-17-1-23z"/>
    <path d="M146 66c10-3 30-3 42 0 4 2 3 7-2 8-12 3-30 3-40 1-5-1-5-8 0-9z"/>
    <path d="M160 84c5-3 11-2 13 2s-1 9-6 9-10-7-7-11z"/>
    <path d="M190 78c7-5 17-4 20 2 3-6 14-8 22-3s8 16 0 21-18 3-22-3c-4 7-16 8-22 2s-4-15 2-19z"/>
    <path d="M196 104c4-2 9-1 10 2s-2 6-6 6-7-6-4-8z"/>
    <path d="M246 96c12-8 32-8 44 2s14 30 2 40-34 6-44-3-16-26-2-39z"/>
  </g>
</svg>`;

// Five-petal hibiscus in HIPHI orange and a warm pink, plumeria-yellow centre (the celebration flower).
export const flower = (n = 24, c = 'var(--o400)') => `<svg class="flower" viewBox="-12 -12 24 24" width="${n}" height="${n}" aria-hidden="true" focusable="false"><g fill="${c}">${[0, 72, 144, 216, 288].map(r => `<ellipse cx="0" cy="-5.6" rx="4.1" ry="5.6" transform="rotate(${r})"/>`).join('')}</g><circle r="2.2" fill="#F9D56E"/></svg>`;
