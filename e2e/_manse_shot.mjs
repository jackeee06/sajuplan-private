import { chromium } from "playwright";

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 1400 }, deviceScaleFactor: 1 });
await p.goto("https://manse.sajuplan.com", { waitUntil: "networkidle" });
await p.getByRole("button", { name: "만세력 보기" }).click();
await p.getByRole("button", { name: "전문가 보기" }).click();
await p.waitForTimeout(800);
// 자세히 보기 펼치기
try { await p.getByRole("button", { name: /사주 풀이 자세히 보기/ }).click(); } catch {}
await p.waitForTimeout(400);
await p.screenshot({ path: "manse_pro.png", fullPage: true });
console.log("OK manse_pro.png");
await b.close();
