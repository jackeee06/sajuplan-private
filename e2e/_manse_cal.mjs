import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 760, height: 1300 }, deviceScaleFactor: 2 });
await p.goto("https://manse.sajuplan.com", { waitUntil: "networkidle" });
await p.getByRole("button", { name: "만세력 보기" }).click();
await p.getByRole("button", { name: "전문가 보기" }).click();
await p.waitForTimeout(700);
// 프로필 헤더(음력 생일)
const prof = p.locator("text=일간").first().locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
await prof.screenshot({ path: "cal_profile.png" }).catch(() => {});
// 일진 달력 카드
const cal = p.locator("h3:has-text('일진 달력')").locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
await cal.scrollIntoViewIfNeeded();
await cal.screenshot({ path: "cal_calendar.png" });
console.log("OK");
await b.close();
