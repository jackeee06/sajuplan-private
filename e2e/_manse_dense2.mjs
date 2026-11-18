import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 430, height: 1500 }, deviceScaleFactor: 1 });
await p.goto("https://manse.sajuplan.com/?view=pro", { waitUntil: "domcontentloaded" });
await p.getByRole("button", { name: "만세력 보기" }).click();
await p.waitForTimeout(1100);
const napeum = p.getByText("납음", { exact: true });
await napeum.scrollIntoViewIfNeeded().catch(()=>{});
await p.waitForTimeout(300);
const box = await napeum.boundingBox();
// 납음 행 위로 원국 그리드 포함해서 크롭
await p.screenshot({ path: "dense.png", clip: { x: 8, y: Math.max(0, box.y - 360), width: 414, height: 560 } });
console.log("ok");
await b.close();
