import { chromium } from "playwright";
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;box-sizing:border-box;font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif}
body{width:1200px;height:630px;background:linear-gradient(135deg,#faf5ff 0%,#fdf2f8 100%);display:flex;flex-direction:column;justify-content:center;padding:0 90px}
.brand{display:flex;align-items:center;gap:14px;margin-bottom:30px}
.dot{width:46px;height:46px;border-radius:14px;background:linear-gradient(135deg,#8259F5,#ec4899)}
.bn{font-size:30px;font-weight:800;color:#6b21a8}
h1{font-size:96px;font-weight:900;color:#1f2430;letter-spacing:-2px;line-height:1.05}
h1 .hl{color:#ec4899}
p{font-size:34px;color:#6b7280;margin-top:26px;font-weight:600}
.chips{display:flex;gap:14px;margin-top:40px}
.chip{font-size:26px;font-weight:700;padding:12px 26px;border-radius:999px}
.c1{background:#ede9fe;color:#7c3aed}.c2{background:#fce7f3;color:#db2777}.c3{background:#dcfce7;color:#15803d}
.url{position:absolute;bottom:48px;right:90px;font-size:28px;font-weight:800;color:#a78bfa}
</style></head><body>
<div class="brand"><div class="dot"></div><div class="bn">사주플랜</div></div>
<h1><span class="hl">무료</span> 만세력</h1>
<p>생년월일시로 사주 명식 · 십성 · 대운 · 운의 흐름을 즉시 확인</p>
<div class="chips"><div class="chip c1">정확한 절기·진태양시</div><div class="chip c2">한자+한글 음</div><div class="chip c3">대운→연운→월운</div></div>
<div class="url">manse.sajuplan.com</div>
</body></html>`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await p.setContent(html, { waitUntil: "networkidle" });
await p.waitForTimeout(300);
await p.screenshot({ path: "../manse/packages/web/public/img/og.png" });
console.log("og.png 생성 완료");
await b.close();
