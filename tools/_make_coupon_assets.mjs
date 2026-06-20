// 코드 박힌 쿠폰 이미지를 "서버 폰트 없이" 즉석 합성하기 위한 에셋 생성.
//   1) coupon-base.png  — 디자인+한글(추천코드 라벨)+코드 들어갈 흰 박스 (1080x1080)
//   2) glyph-{0..9,A}.png — 코드 숫자/문자 글리프(핑크, 고정셀 60x120, 투명배경)
//   서버는 base 위에 glyph 들을 합성(sharp composite)만 함 → 폰트 불필요.
// 실행: node tools/_make_coupon_assets.mjs   → api/assets/coupon/ 에 저장
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'
import { createRequire } from 'module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.resolve(__dirname, '../e2e/package.json'))
const { chromium } = require('playwright-core')

const OUTDIR = path.resolve(__dirname, '../api/assets/coupon')
fs.mkdirSync(OUTDIR, { recursive: true })
const LOGO = path.resolve(__dirname, '../web/user/public/img/android-chrome-512x512.png')
const logoB64 = fs.readFileSync(LOGO).toString('base64')

// 글리프 레이아웃(서버 합성과 반드시 일치) — 코드 셀 폭/높이/세로위치
export const GLYPH_W = 60
export const GLYPH_H = 120
const CODE_TOP = 812 // 글리프 top y (흰 박스 내부 중앙)

const baseHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:1080px; height:1080px; }
  body { font-family:'Pretendard','Malgun Gothic','Apple SD Gothic Neo',sans-serif;
    width:1080px; height:1080px;
    background:linear-gradient(150deg,#9b7af7 0%,#b06ef0 48%,#ec4899 100%);
    display:flex; align-items:center; justify-content:center; color:#fff; position:relative; overflow:hidden; }
  .deco1 { position:absolute; width:340px; height:340px; border-radius:50%; background:rgba(255,255,255,.07); top:-110px; left:-90px; }
  .deco2 { position:absolute; width:260px; height:260px; border-radius:50%; background:rgba(255,255,255,.07); bottom:-90px; right:-70px; }
  /* 내용 세로 중앙정렬 → 위아래 여백 균등(하단 빈공간 해소) */
  .card { width:900px; height:900px; border-radius:60px; background:rgba(255,255,255,0.12);
    border:4px dashed rgba(255,255,255,0.65);
    display:flex; flex-direction:column; align-items:center; justify-content:center; padding:50px; text-align:center; }
  .brand { display:flex; align-items:center; gap:18px; }
  .brand img { width:104px; height:104px; border-radius:26px; box-shadow:0 8px 22px rgba(0,0,0,.2); }
  .brand span { font-size:52px; font-weight:800; }
  .badge { font-size:27px; font-weight:600; padding:11px 28px; border-radius:999px; background:rgba(255,255,255,0.22); margin-top:34px; white-space:nowrap; }
  .amount { font-size:80px; font-weight:900; letter-spacing:-2px; line-height:1.02; margin-top:24px; white-space:nowrap; }
  .sub { font-size:32px; font-weight:600; margin-top:22px; color:rgba(255,255,255,0.96); white-space:nowrap; }
  /* 추천코드 라벨(명확) + 코드 글리프가 합성될 흰 박스 */
  .codelabel { font-size:30px; font-weight:800; margin-top:40px; color:#fff; letter-spacing:1px; }
  .codebox { margin-top:14px; width:560px; height:150px; border-radius:24px; background:#fff;
    display:flex; align-items:center; justify-content:center; }
</style></head><body>
  <div class="deco1"></div><div class="deco2"></div>
  <div class="card">
    <div class="brand"><img src="data:image/png;base64,${logoB64}" alt=""/><span>사주플랜</span></div>
    <div class="badge">🎁 신규가입 선물</div>
    <div class="amount">만원 무료코인 쿠폰</div>
    <div class="sub">지금 가입하면 10,000 코인 공짜!</div>
    <div class="codelabel">추천코드</div>
    <div class="codebox"></div>
  </div>
</body></html>`

function glyphHtml(ch) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box;}
    html,body{width:${GLYPH_W}px;height:${GLYPH_H}px;background:transparent;}
    body{font-family:'Pretendard','Malgun Gothic',sans-serif;display:flex;align-items:center;justify-content:center;}
    span{font-size:92px;font-weight:900;color:#ec4899;letter-spacing:-2px;}
  </style></head><body><span>${ch}</span></body></html>`
}

const browser = await chromium.launch()
// base + 코드 박스 좌표 측정(서버 합성 정렬용)
{
  const page = await browser.newPage({ viewport: { width: 1080, height: 1080 } })
  await page.setContent(baseHtml, { waitUntil: 'networkidle' })
  await page.waitForTimeout(200)
  await page.screenshot({ path: path.join(OUTDIR, 'coupon-base.png'), clip: { x: 0, y: 0, width: 1080, height: 1080 } })
  const box = await page.evaluate(() => {
    const r = document.querySelector('.codebox').getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height }
  })
  const layout = {
    centerX: Math.round(box.x + box.w / 2),
    top: Math.round(box.y + (box.h - GLYPH_H) / 2),
    glyphW: GLYPH_W,
    glyphH: GLYPH_H,
  }
  fs.writeFileSync(path.join(OUTDIR, 'coupon-layout.json'), JSON.stringify(layout, null, 2))
  console.log('layout:', layout)
  await page.close()
}
// glyphs 0-9, A (충돌 접두)
for (const ch of '0123456789A') {
  const page = await browser.newPage({ viewport: { width: GLYPH_W, height: GLYPH_H } })
  await page.setContent(glyphHtml(ch), { waitUntil: 'networkidle' })
  await page.waitForTimeout(50)
  await page.screenshot({ path: path.join(OUTDIR, `glyph-${ch}.png`), omitBackground: true, clip: { x: 0, y: 0, width: GLYPH_W, height: GLYPH_H } })
  await page.close()
}
await browser.close()
console.log('에셋 생성 완료:', OUTDIR, '| GLYPH_W', GLYPH_W, 'CODE_TOP', CODE_TOP)
