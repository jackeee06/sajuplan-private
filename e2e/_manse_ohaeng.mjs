import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 600, height: 950 }, deviceScaleFactor: 1 });
await p.goto("https://manse.sajuplan.com", { waitUntil: "domcontentloaded" });
await p.getByRole("button", { name: "만세력 보기" }).click();
await p.getByRole("button", { name: "전문가 보기" }).click().catch(()=>{});
await p.waitForTimeout(1100);
// 오행 분포 섹션
const oh = p.locator("div").filter({ has: p.getByRole("heading",{name:"오행 분포"}) }).last();
await oh.scrollIntoViewIfNeeded().catch(()=>{});
await oh.screenshot({ path: "our_ohaeng.png" }).catch(e=>console.log("oh:",e.message));
// 십성 분포 섹션
const ss = p.locator("div").filter({ has: p.getByRole("heading",{name:"십성 분포"}) }).last();
await ss.scrollIntoViewIfNeeded().catch(()=>{});
await ss.screenshot({ path: "our_sipseong.png" }).catch(e=>console.log("ss:",e.message));
// 십성 항목 텍스트
const ssItems = await ss.locator("div.bg-gray-50").allTextContents().catch(()=>[]);
console.log("우리 십성 항목 =", JSON.stringify(ssItems));
await b.close();
