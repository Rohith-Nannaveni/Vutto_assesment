// Generates the stylised motorcycle illustrations in public/images/bikes.
// These are local placeholders (no external dependency). Listings accept any http(s) image URL.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'images', 'bikes');
mkdirSync(outDir, { recursive: true });

const bikes = [
  ['royal-enfield-classic-350', 'cruiser', '#5b6b4e', '#e9ebe6'],
  ['ktm-duke-390', 'naked', '#d9692b', '#eceae6'],
  ['yamaha-r15-v3', 'sport', '#2c4a8a', '#e6e9ee'],
  ['triumph-speed-400', 'naked', '#8b2f2f', '#ecebe8'],
  ['bajaj-pulsar-ns200', 'naked', '#23272d', '#e8e9ea'],
  ['royal-enfield-himalayan', 'adventure', '#a68a4b', '#ebe9e3'],
  ['kawasaki-ninja-650', 'sport', '#3f8a4a', '#e6ece7'],
  ['honda-cb350', 'cruiser', '#7a2d2d', '#ece9e6'],
  ['harley-davidson-street-750', 'cruiser', '#2a2d33', '#e7e8ea'],
  ['tvs-apache-rtr-200', 'naked', '#b3272d', '#ecebea'],
  ['suzuki-gixxer-sf', 'sport', '#3563a8', '#e6e9ee'],
  ['ducati-monster-821', 'naked', '#b22a2a', '#eae9e8'],
];

const INK = '#1f2328';
const METAL = '#5b636d';

function bikeSvg({ style, accent, bg, detail }) {
  const r = style === 'adventure' ? 82 : style === 'cruiser' ? 70 : 72;
  const rearX = style === 'cruiser' ? 190 : 215;
  const frontX = style === 'cruiser' ? 625 : style === 'adventure' ? 600 : 585;
  const gy = 330;
  const steer = { x: frontX - 55, y: style === 'sport' ? 215 : style === 'adventure' ? 170 : 190 };
  const bar = style === 'sport' ? `M${steer.x} ${steer.y} l-18 -6` : style === 'cruiser' ? `M${steer.x} ${steer.y} l-25 -28` : `M${steer.x} ${steer.y} l-26 -16`;
  const tank = style === 'cruiser'
    ? `M345 225 Q410 188 485 215 L470 262 L350 266 Z`
    : style === 'adventure'
      ? `M340 210 Q420 168 500 200 L480 255 L345 262 Z`
      : `M350 222 Q420 190 490 212 L475 258 L355 262 Z`;
  const seat = style === 'cruiser' ? `M235 245 Q300 262 352 238 L350 262 L240 272 Z` : `M240 232 L352 226 L350 252 L232 260 Z`;
  const tail = style === 'cruiser' ? '' : `<path d="M180 246 L244 232 L234 258 L172 264 Z" fill="${accent}"/>`;
  const fairing = style === 'sport'
    ? `<path d="M${frontX - 70} ${gy - 120} Q${frontX - 20} ${gy - 125} ${frontX - 10} ${gy - 70} L${frontX - 90} ${gy - 85} Z" fill="${accent}"/>` : '';
  const beak = style === 'adventure'
    ? `<path d="M${frontX - 50} ${gy - 145} l60 28 l-8 16 l-62 -14 Z" fill="${accent}"/>` : '';
  const wheel = (x) => `
    <circle cx="${x}" cy="${gy}" r="${r}" fill="none" stroke="${INK}" stroke-width="14"/>
    <circle cx="${x}" cy="${gy}" r="${r - 18}" fill="none" stroke="${METAL}" stroke-width="2"/>
    <g stroke="${METAL}" stroke-width="2">${[0, 45, 90, 135].map((a) => `<line x1="${x - (r - 18) * Math.cos((a * Math.PI) / 180)}" y1="${gy - (r - 18) * Math.sin((a * Math.PI) / 180)}" x2="${x + (r - 18) * Math.cos((a * Math.PI) / 180)}" y2="${gy + (r - 18) * Math.sin((a * Math.PI) / 180)}"/>`).join('')}</g>
    <circle cx="${x}" cy="${gy}" r="9" fill="${INK}"/>
    <circle cx="${x}" cy="${gy}" r="${r - 10}" fill="none" stroke="#c6cbd1" stroke-width="3" stroke-dasharray="2 5"/>`;
  const vb = detail ? '190 120 440 320' : '0 0 800 500';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="${style} motorcycle illustration">
  <rect x="-10" y="-10" width="820" height="520" fill="${detail ? '#d9dcdf' : bg}"/>
  <rect x="-10" y="${gy + r + 4}" width="820" height="200" fill="${detail ? '#c9cdd1' : '#d8dbdd'}"/>
  <ellipse cx="${(rearX + frontX) / 2}" cy="${gy + r + 6}" rx="${(frontX - rearX) / 2 + 60}" ry="10" fill="#000" opacity=".12"/>
  ${wheel(rearX)}${wheel(frontX)}
  <path d="M${rearX} ${gy} L350 ${gy - 12}" stroke="${INK}" stroke-width="12" stroke-linecap="round"/>
  <path d="M${frontX} ${gy} L${steer.x} ${steer.y}" stroke="${METAL}" stroke-width="12" stroke-linecap="round"/>
  <path d="M${steer.x} ${steer.y} L360 ${gy - 70}" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
  <rect x="318" y="268" width="128" height="82" rx="14" fill="#3a4047"/>
  <rect x="338" y="284" width="60" height="30" rx="6" fill="#4b525a"/>
  <path d="M340 350 Q260 366 ${rearX - 20} 360" stroke="#8a9199" stroke-width="16" stroke-linecap="round" fill="none"/>
  <path d="${seat}" fill="${INK}"/>
  ${tail}
  <path d="${tank}" fill="${accent}"/>
  <path d="${bar}" stroke="${INK}" stroke-width="8" stroke-linecap="round" fill="none"/>
  ${fairing}${beak}
  <circle cx="${steer.x + 18}" cy="${steer.y + 28}" r="17" fill="#f3f4f5" stroke="${INK}" stroke-width="6"/>
</svg>
`;
}

for (const [slug, style, accent, bg] of bikes) {
  writeFileSync(join(outDir, `${slug}-1.svg`), bikeSvg({ style, accent, bg, detail: false }));
  writeFileSync(join(outDir, `${slug}-2.svg`), bikeSvg({ style, accent, bg, detail: true }));
}
writeFileSync(join(outDir, 'placeholder.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><rect width="800" height="500" fill="#e5e7ea"/><g fill="none" stroke="#9aa1a9" stroke-width="10"><circle cx="270" cy="320" r="62"/><circle cx="530" cy="320" r="62"/><path d="M270 320 L350 230 L460 230 L530 320 M350 230 L330 190 L390 190"/></g><text x="400" y="440" text-anchor="middle" font-family="sans-serif" font-size="26" fill="#6b7280">Photo unavailable</text></svg>`);
console.log(`Wrote ${bikes.length * 2 + 1} images to ${outDir}`);
