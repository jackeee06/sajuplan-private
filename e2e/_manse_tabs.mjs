import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 1200 }, deviceScaleFactor: 1 });
await p.goto("https://manse.sajuplan.com", { waitUntil: "domcontentloaded" });
await p.getByRole("button", { name: "만세력 보기" }).click();
await p.getByRole("button", { name: "전문가 보기" }).click().catch(()=>{});
await p.waitForTimeout(1000);
const grid = p.locator("div").filter({ hasText: "네 기둥은 각각" }).last().locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
await grid.scrollIntoViewIfNeeded().catch(()=>{});
// 탭 버튼 개수 + 첫 탭과 마지막 탭의 y좌표(줄바꿈 확인)
const firstBox = await p.getByRole("button",{name:"궁성",exact:true}).boundingBox();
const lastBox = await p.getByRole("button",{name:"원진",exact:true}).boundingBox();
console.log("궁성 y =", firstBox?.y?.toFixed(0), "/ 원진 y =", lastBox?.y?.toFixed(0), "→ 줄바꿈됨?", (lastBox?.y - firstBox?.y) > 10);
await grid.screenshot({ path: "tabs_wrap.png" }).catch(e=>console.log("err:",e.message));
await b.close();
