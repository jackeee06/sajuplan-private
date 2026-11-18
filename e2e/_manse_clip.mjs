import { chromium } from "playwright";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 720, height: 500 }, deviceScaleFactor: 2, permissions: ["clipboard-read","clipboard-write"] });
const p = await ctx.newPage();
await p.goto("https://manse.sajuplan.com", { waitUntil: "domcontentloaded" });
await p.getByRole("button", { name: "만세력 보기" }).click();
await p.waitForTimeout(1700); // 프리워밍 대기
await p.getByRole("button", { name: "이미지 공유", exact: true }).click();
await p.waitForTimeout(900);
const toast = await p.locator("div.fixed").first().textContent().catch(()=>"(none)");
const clip = await p.evaluate(async () => {
  try {
    const items = await navigator.clipboard.read();
    return items.flatMap(it => it.types);
  } catch (e) { return "read실패:"+e.message; }
});
console.log("토스트 =", JSON.stringify(toast));
console.log("클립보드 타입 =", JSON.stringify(clip));
await b.close();
