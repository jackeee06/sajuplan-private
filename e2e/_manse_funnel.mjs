import { chromium } from "playwright";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 420, height: 1900 }, deviceScaleFactor: 1, permissions:["clipboard-read","clipboard-write"] });
const p = await ctx.newPage();
const errs=[]; p.on("pageerror", e=>errs.push(e.message));
// 1) 일반 진입 → 궁합 → 전환카드 확인
await p.goto("https://manse.sajuplan.com", { waitUntil: "domcontentloaded" });
await p.getByRole("button", { name: "궁합", exact: true }).click();
await p.getByRole("button", { name: "궁합 보기" }).click();
await p.waitForTimeout(800);
await p.screenshot({ path: "couple_funnel.png", fullPage: true });
console.log("전환 CTA =", await p.getByText("이 인연, 더 깊이 알고 싶다면?").count());
console.log("맛보기(결혼) =", await p.getByText("결혼해도 좋은 인연",{exact:false}).count());
console.log("상담버튼 =", await p.getByRole("link",{name:"전문가에게 궁합 물어보기"}).count());
console.log("공유버튼 =", await p.getByRole("button",{name:/궁합 결과 공유/}).count());
// 2) 공유 링크 자동로드 확인
const p2 = await ctx.newPage();
await p2.goto("https://manse.sajuplan.com/?m=couple&ab=1988-03-03T14%3A00&ag=F&bb=1985-07-21T09%3A30&bg=M", { waitUntil: "domcontentloaded" });
await p2.waitForTimeout(900);
console.log("자동로드 점수 표시 =", await p2.getByText("궁합 점수 (참고)").count());
const score = await p2.locator("div.text-5xl").first().textContent().catch(()=>"?");
console.log("자동로드 점수 =", score);
console.log("페이지 에러 =", errs.length?errs.slice(0,2):"없음");
await b.close();
