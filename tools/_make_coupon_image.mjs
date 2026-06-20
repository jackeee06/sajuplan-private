// 신규가입 만원 쿠폰 카드 이미지 (카카오 공유/OG 용) — 정사각형 1080x1080.
//   카카오톡 카드가 이미지를 정사각형으로 보여주므로 1:1 로 제작(크롭/여백 없이 딱 맞게).
//   상단에 사주플랜 앱 아이콘(고양이 로고) 박아 브랜드 + 정사각형 균형.
//   사주플랜 브랜드 토큰(primary #9b7af7 → pink #ec4899) + Pretendard 폴백.
// 실행: node tools/_make_coupon_image.mjs
//   결과: web/user/public/img/coupon-invite-v3.png (1080x1080)
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'
import { createRequire } from 'module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.resolve(__dirname, '../e2e/package.json'))
const { chromium } = require('playwright-core')

const OUT = path.resolve(__dirname, '../web/user/public/img/coupon-invite-v3.png')
const LOGO = path.resolve(__dirname, '../web/user/public/img/android-chrome-512x512.png')
const logoB64 = fs.readFileSync(LOGO).toString('base64')

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:1080px; height:1080px; }
  body {
    font-family:'Pretendard','Malgun Gothic','Apple SD Gothic Neo',sans-serif;
    width:1080px; height:1080px;
    background:linear-gradient(150deg,#9b7af7 0%,#b06ef0 48%,#ec4899 100%);
    display:flex; align-items:center; justify-content:center; color:#fff;
    position:relative; overflow:hidden;
  }
  .deco1 { position:absolute; width:340px; height:340px; border-radius:50%; background:rgba(255,255,255,.07); top:-110px; left:-90px; }
  .deco2 { position:absolute; width:260px; height:260px; border-radius:50%; background:rgba(255,255,255,.07); bottom:-90px; right:-70px; }
  .card {
    width:900px; height:900px; border-radius:60px;
    background:rgba(255,255,255,0.12);
    border:4px dashed rgba(255,255,255,0.65);
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    text-align:center; padding:60px;
  }
  .brand { display:flex; align-items:center; gap:18px; margin-bottom:8px; }
  .brand img { width:96px; height:96px; border-radius:24px; box-shadow:0 8px 22px rgba(0,0,0,.18); }
  .brand span { font-size:46px; font-weight:800; }
  .badge {
    font-size:30px; font-weight:600; padding:12px 30px; border-radius:999px;
    background:rgba(255,255,255,0.22); margin-top:48px; white-space:nowrap;
  }
  .amount { font-size:118px; font-weight:900; letter-spacing:-2px; line-height:1.04; margin-top:30px; white-space:nowrap; }
  .sub { font-size:38px; font-weight:600; margin-top:34px; color:rgba(255,255,255,0.96); white-space:nowrap; }
</style></head><body>
  <div class="deco1"></div><div class="deco2"></div>
  <div class="card">
    <div class="brand">
      <img src="data:image/png;base64,${logoB64}" alt="" />
      <span>사주플랜</span>
    </div>
    <div class="badge">🎁 신규가입 선물</div>
    <div class="amount">만원 무료코인</div>
    <div class="sub">지금 가입하면 10,000 코인 공짜!</div>
  </div>
</body></html>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 })
await page.setContent(html, { waitUntil: 'networkidle' })
await page.waitForTimeout(300)
await page.screenshot({ path: OUT, clip: { x: 0, y: 0, width: 1080, height: 1080 } })
await browser.close()
console.log('생성 완료:', OUT)
