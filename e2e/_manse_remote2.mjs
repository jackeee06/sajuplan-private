import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 720, height: 820 }, deviceScaleFactor: 2 });
await p.goto("https://manse.sajuplan.com", { waitUntil: "networkidle" });
await p.getByRole("button", { name: "만세력 보기" }).click();
await p.getByRole("button", { name: "전문가 보기" }).click().catch(()=>{});
await p.waitForTimeout(800);
const card = p.getByRole("button", { name: "천간합", exact: true }).locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
await card.scrollIntoViewIfNeeded();
for (const [name, file] of [["형","remote_hyeong.png"],["파","remote_pa.png"],["지지충","remote_chung2.png"]]) {
  await p.getByRole("button", { name, exact: true }).click();
  await p.waitForTimeout(400);
  await card.screenshot({ path: file });
}
console.log("OK");
await b.close();
