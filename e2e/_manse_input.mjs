import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 720, height: 900 }, deviceScaleFactor: 2 });
await p.goto("https://manse.sajuplan.com", { waitUntil: "networkidle" });
await p.waitForTimeout(400);
// 12간지 시간표 열기
await p.getByRole("button", { name: /12간지 시간표/ }).click();
await p.waitForTimeout(300);
const panel = p.locator("text=생년월일시").locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
await panel.screenshot({ path: "input.png" });
// 음력 변환 동작 확인: 음력 선택 후 계산 → 프로필 음력 표시
await p.selectOption("select", "lunar").catch(() => {});
console.log("OK");
await b.close();
