// 카드 뒷면 — 정통 마르세유풍(크림 종이 + 고동색 고전 문양). back.webp 1장으로 구워 78장 공유.
//   레퍼런스(크림+검정 만다라)의 색·문양을 우리 SVG로 직접 재현(상용 덱 스캔 복사 아님 → 합법).
// 사용: node scripts/make-back.mjs
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const W = 480;
const H = 720;
const cx = W / 2;
const cy = H / 2;
const INK = '#2a1c0e'; // 짙은 고동색(거의 검정)
const INK2 = '#6e5328'; // 보조 갈색
const rad = (d) => (d * Math.PI) / 180;
const P = (r, deg) => [cx + r * Math.cos(rad(deg)), cy + r * Math.sin(rad(deg))];
const PO = (ox, oy, r, deg) => [ox + r * Math.cos(rad(deg)), oy + r * Math.sin(rad(deg))];
const circ = (x, y, r, c, w, o = 1) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="none" stroke="${c}" stroke-width="${w}" opacity="${o}"/>`;
const dot = (x, y, r, c) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${c}"/>`;

let el = '';

// ── 코너 식물 문양(4모서리) ──
function corner(x, y, sx, sy) {
  let g = '';
  g += `<path d="M ${x + sx * 10} ${y + sy * 54} q ${sx * 46} 0 ${sx * 52} ${sy * 52} q 0 ${sy * 46} ${-sx * 52} ${sy * 52}" fill="none" stroke="${INK}" stroke-width="2" opacity="0.92"/>`;
  g += `<path d="M ${x + sx * 24} ${y + sy * 30} q ${sx * 40} ${sy * 10} ${sx * 40} ${sy * 50}" fill="none" stroke="${INK2}" stroke-width="1.3" opacity="0.8"/>`;
  // 잎사귀
  for (const a of [20, 45, 70]) {
    const [lx, ly] = PO(x + sx * 30, y + sy * 30, 34, sx > 0 ? (sy > 0 ? a : -a) : sy > 0 ? 180 - a : 180 + a);
    g += `<g transform="rotate(${(sx * sy > 0 ? a : -a) + (sx < 0 ? 180 : 0)} ${lx} ${ly})"><ellipse cx="${lx}" cy="${ly}" rx="4" ry="11" fill="none" stroke="${INK}" stroke-width="1.2" opacity="0.8"/></g>`;
  }
  for (let i = 0; i < 3; i++) g += dot(x + sx * (20 + i * 13), y + sy * (20 + i * 13), 2.4, INK);
  return g;
}
el += corner(24, 24, 1, 1) + corner(W - 24, 24, -1, 1) + corner(24, H - 24, 1, -1) + corner(W - 24, H - 24, -1, -1);

// ── 상/하 중앙 식물 장식 ──
for (const oy of [cy - 232, cy + 232]) {
  const s = oy < cy ? 1 : -1;
  el += `<path d="M ${cx} ${oy} q -26 ${s * 22} 0 ${s * 40} q 26 ${-s * 22} 0 ${-s * 40}" fill="none" stroke="${INK}" stroke-width="1.8" opacity="0.85"/>`;
  el += dot(cx, oy + s * 46, 3, INK);
}

// ── 바깥 큰 원 + 잎 링 ──
el += circ(cx, cy, 198, INK, 2.4) + circ(cx, cy, 190, INK2, 1, 0.6);
el += circ(cx, cy, 158, INK, 2.2) + circ(cx, cy, 150, INK2, 1, 0.6);
for (let i = 0; i < 32; i++) {
  const [x, y] = P(174, i * 11.25);
  el += `<g transform="rotate(${i * 11.25} ${x.toFixed(1)} ${y.toFixed(1)})"><ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="4.5" ry="11" fill="none" stroke="${INK}" stroke-width="1.1" opacity="0.78"/></g>`;
}

// ── 중앙 5개 메달리온(퀸컹스) — 각 메달리온 안에 미니 5원(프랙탈 밀도) ──
function medallion(mx, my, R) {
  let g = circ(mx, my, R, INK, 2) + circ(mx, my, R - 6, INK2, 1, 0.85);
  g += circ(mx, my, 6, INK, 1.4) + dot(mx, my, 2, INK);
  for (const d of [270, 0, 90, 180]) {
    const [x, y] = PO(mx, my, R * 0.52, d);
    g += circ(x, y, 6, INK, 1.2) + dot(x, y, 1.6, INK);
  }
  return g;
}
const R0 = 78; // 중심에서 위성 메달리온까지
el += medallion(cx, cy, 34);
for (const d of [270, 0, 90, 180]) {
  const [x, y] = PO(cx, cy, R0, d);
  el += medallion(x, y, 30);
}
// 대각선 사이 작은 원
for (const d of [315, 45, 135, 225]) {
  const [x, y] = PO(cx, cy, R0 - 6, d);
  el += circ(x, y, 13, INK, 1.4) + dot(x, y, 2, INK);
}
// 메달리온 잇는 가는 링
el += circ(cx, cy, R0, INK2, 0.8, 0.55);

const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="paper" cx="50%" cy="42%" r="80%">
      <stop offset="0%" stop-color="#f5edd7"/>
      <stop offset="60%" stop-color="#e7d6b0"/>
      <stop offset="100%" stop-color="#d6c094"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" rx="20" fill="url(#paper)"/>
  <rect x="9" y="9" width="${W - 18}" height="${H - 18}" rx="14" fill="none" stroke="${INK}" stroke-width="5"/>
  <rect x="19" y="19" width="${W - 38}" height="${H - 38}" rx="9" fill="none" stroke="${INK}" stroke-width="1.4" opacity="0.8"/>
  ${el}
</svg>`;

const out = new URL('../packages/web/public/tarot/back.webp', import.meta.url);
const buf = await sharp(Buffer.from(svg), { density: 230 }).resize(W, H).webp({ quality: 90 }).toBuffer();
await writeFile(out, buf);
console.log(`back.webp 생성: ${(buf.length / 1024).toFixed(0)}KB (${W}x${H}) — 크림+고동색`);
