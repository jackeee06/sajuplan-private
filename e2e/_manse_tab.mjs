import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 760, height: 900 }, deviceScaleFactor: 2 });
await p.goto("https://manse.sajuplan.com", { waitUntil: "networkidle" });
// 직접입력(이제 빈칸) → 1990/06/15 07:20
await p.getByLabel("생년월일").type("19900615");
await p.getByLabel("태어난 시각").type("0720");
await p.getByRole("button", { name: "만세력 보기" }).click();
await p.getByRole("button", { name: "전문가 보기" }).click();
await p.waitForTimeout(600);
await p.getByRole("button", { name: /사주 풀이 자세히 보기/ }).click();
await p.waitForTimeout(400);
const card = p.locator("h3:has-text('사주 풀이 자세히 보기')").locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
await card.screenshot({ path: "tab_gungseong.png" });
// 형 탭 클릭
await p.getByRole("button", { name: "형", exact: true }).click();
await p.waitForTimeout(300);
await card.screenshot({ path: "tab_hyeong.png" });
console.log("OK");
await b.close();
