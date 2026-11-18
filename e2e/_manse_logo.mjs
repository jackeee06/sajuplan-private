import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 1 });
await p.goto("https://manse.sajuplan.com", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(500);
const href = await p.getByRole("link", { name: "사주플랜 홈으로" }).getAttribute("href").catch(()=>null);
console.log("로고 링크 href =", href);
// 실제 클릭 시 이동 확인
await p.getByRole("link", { name: "사주플랜 홈으로" }).click();
await p.waitForTimeout(1500);
console.log("클릭 후 URL =", p.url());
await b.close();
