import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 600, height: 900 }, deviceScaleFactor: 1 });
await p.goto("https://manse.sajuplan.com", { waitUntil: "domcontentloaded" });
await p.getByRole("button", { name: "만세력 보기" }).click();
await p.getByRole("button", { name: "전문가 보기" }).click().catch(()=>{});
await p.waitForTimeout(1000);
const sec = p.locator("div").filter({ has: p.getByRole("heading", { name: "신살 · 길성" }) }).last();
await sec.scrollIntoViewIfNeeded().catch(()=>{});
const summary = await p.getByText(/총 \d+개 · 길성/).textContent().catch(()=>"(못찾음)");
// 요약 칩 텍스트 모으기
const chips = await sec.locator("div.flex-wrap > span").allTextContents();
console.log("요약 =", JSON.stringify(summary));
console.log("신살 목록 =", JSON.stringify(chips));
console.log("역마살 포함?", chips.includes("역마살"));
await b.close();
