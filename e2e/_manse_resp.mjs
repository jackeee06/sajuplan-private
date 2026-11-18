import { chromium } from "playwright";
const b = await chromium.launch();
// 모바일
const m = await b.newPage({ viewport: { width: 390, height: 1500 }, deviceScaleFactor: 1 });
await m.goto("https://manse.sajuplan.com", { waitUntil: "domcontentloaded" });
await m.waitForTimeout(900);
await m.screenshot({ path: "mobile_form.png" });
// PC
const d = await b.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 });
await d.goto("https://manse.sajuplan.com", { waitUntil: "domcontentloaded" });
await d.waitForTimeout(900);
await d.screenshot({ path: "pc_form.png" });
console.log("캡처 완료");
await b.close();
