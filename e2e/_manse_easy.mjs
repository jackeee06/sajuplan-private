import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 2400 }, deviceScaleFactor: 1 });
const errs=[]; p.on("pageerror", e=>errs.push(e.message));
await p.goto("https://manse.sajuplan.com", { waitUntil: "domcontentloaded" });
await p.getByRole("button", { name: "만세력 보기" }).click();
await p.waitForTimeout(1200);
await p.screenshot({ path: "easy_full.png", fullPage: true });
for (const t of ["내 오행 기운","내 기운의 세기 · 지금의 운","분야별 풀이","내 사주의 특별한 별 (신살·길성)"]) {
  console.log(t, "=", await p.getByText(t, {exact:false}).count());
}
console.log("페이지 에러 =", errs.length?errs.slice(0,2):"없음");
await b.close();
