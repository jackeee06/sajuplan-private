import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 600, height: 950 }, deviceScaleFactor: 1 });
const errs=[]; p.on("pageerror", e=>errs.push(e.message));
await p.goto("https://manse.sajuplan.com", { waitUntil: "domcontentloaded" });
await p.getByRole("button", { name: "만세력 보기" }).click();
await p.getByRole("button", { name: "전문가 보기" }).click().catch(()=>{});
await p.waitForTimeout(1100);
const ss = p.locator("div").filter({ has: p.getByRole("heading",{name:"십성 분포"}) }).last();
await ss.scrollIntoViewIfNeeded().catch(()=>{});
await ss.screenshot({ path: "our_sipseong2.png" }).catch(e=>console.log("ss:",e.message));
// 막대 행 개수(십성 10개여야)
const rows = await ss.locator("div.flex-1 > div.flex.items-center").count();
console.log("십성 막대 행 수 =", rows);
console.log("페이지 에러 =", errs.length?errs.slice(0,2):"없음");
await b.close();
