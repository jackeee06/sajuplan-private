import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 600, height: 800 }, deviceScaleFactor: 2 });
await p.goto("https://manse.sajuplan.com", { waitUntil: "networkidle" });
await p.getByRole("button", { name: "만세력 보기" }).click();
await p.getByRole("button", { name: "전문가 보기" }).click().catch(()=>{});
await p.waitForTimeout(700);
// 신강약/도메인 설명 텍스트가 많은 영역으로 스크롤
const sec = p.locator("text=신강약").first();
await sec.scrollIntoViewIfNeeded().catch(()=>{});
await p.waitForTimeout(400);
await p.screenshot({ path: "crop_analysis.png" });
console.log("OK");
await b.close();
