import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 430, height: 1400 }, deviceScaleFactor: 1 });
const errs=[]; p.on("pageerror", e=>errs.push(e.message));
await p.goto("https://manse.sajuplan.com/?view=pro", { waitUntil: "domcontentloaded" });
await p.getByRole("button", { name: "만세력 보기" }).click();
await p.waitForTimeout(1100);
// 원국 카드(첫 rounded-2xl) 캡처
const grid = p.locator("div").filter({ hasText: /네 기둥은 각각/ }).last().locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
await grid.scrollIntoViewIfNeeded().catch(()=>{});
await grid.screenshot({ path: "dense.png" }).catch(e=>console.log("스샷:",e.message));
console.log("납음 행 =", await p.getByText("납음",{exact:true}).count());
console.log("12신살 행 =", await p.getByText("12신살",{exact:true}).count());
console.log("월령 =", await p.getByText("월령",{exact:false}).count());
console.log("페이지 에러 =", errs.length?errs.slice(0,2):"없음");
await b.close();
