import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 600, height: 950 }, deviceScaleFactor: 1 });
// 1969-10-12 = 귀문관살(巳戌) 검출되는 사주 — URL 파라미터 자동로드
await p.goto("https://manse.sajuplan.com/?b=1969-10-12T10:00&g=M&lon=129", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1200);
// 결과가 자동 안 뜨면 버튼 클릭
const goBtn = p.getByRole("button", { name: "만세력 보기" });
if (await goBtn.count()) { await goBtn.click().catch(()=>{}); await p.waitForTimeout(600); }
await p.getByRole("button", { name: "전문가 보기" }).click().catch(()=>{});
await p.waitForTimeout(900);
const sec = p.locator("div").filter({ has: p.getByRole("heading",{name:"신살 · 길성"}) }).last();
await sec.scrollIntoViewIfNeeded().catch(()=>{});
const summary = await p.getByText(/총 \d+개 · 길성/).textContent().catch(()=>"(못찾음)");
const chips = await sec.locator("div.flex-wrap > span").allTextContents().catch(()=>[]);
console.log("요약 =", JSON.stringify(summary));
console.log("신살칩 =", JSON.stringify(chips));
console.log("귀문관살 포함?", chips.includes("귀문관살"));
await sec.screenshot({ path: "newsinsal.png" }).catch(e=>console.log("스샷:",e.message));
await b.close();
