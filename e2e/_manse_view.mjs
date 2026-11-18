import { chromium } from "playwright";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 1000 }, deviceScaleFactor: 1 });
const active = async (p) => {
  const pro = await p.getByRole("button",{name:"전문가 보기"}).getAttribute("class");
  return pro.includes("text-accent-500") ? "전문가" : "쉽게";
};
// ① ?view=pro → 폰이어도 전문가
const p1 = await ctx.newPage();
await p1.goto("https://manse.sajuplan.com/?view=pro", { waitUntil: "domcontentloaded" });
await p1.waitForTimeout(700);
console.log("① ?view=pro (폰) → 활성:", await active(p1));
// ② 신호 없음 → 폰=쉽게
const p2 = await ctx.newPage();
await p2.goto("https://manse.sajuplan.com/", { waitUntil: "domcontentloaded" });
await p2.waitForTimeout(700);
console.log("② 신호없음 (폰) → 활성:", await active(p2));
// ③ 전문가로 직접 바꾼 뒤 새로고침 → 기억되는지
await p2.getByRole("button",{name:"전문가 보기"}).click();
await p2.waitForTimeout(300);
await p2.reload({ waitUntil: "domcontentloaded" });
await p2.waitForTimeout(700);
console.log("③ 전문가 선택후 새로고침 (폰) → 활성:", await active(p2));
await b.close();
