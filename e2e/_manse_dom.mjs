import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 600, height: 1100 }, deviceScaleFactor: 1 });
const errs=[]; p.on("pageerror", e=>errs.push(e.message));
await p.goto("https://manse.sajuplan.com", { waitUntil: "domcontentloaded" });
await p.getByRole("button", { name: "만세력 보기" }).click();
await p.getByRole("button", { name: "전문가 보기" }).click().catch(()=>{});
await p.waitForTimeout(1100);
const sec = p.locator("div").filter({ has: p.getByRole("heading",{name:"분야별 풀이"}) }).last();
await sec.scrollIntoViewIfNeeded().catch(()=>{});
await sec.screenshot({ path: "domains.png" }).catch(e=>console.log("err:",e.message));
// 직업운 텍스트 길이 확인
const jobText = await sec.getByText(/십성으로 보면/).textContent().catch(()=>"");
console.log("직업운 글자수 =", jobText.length);
console.log("조언 라벨 개수 =", await sec.getByText("조언", {exact:true}).count());
console.log("페이지 에러 =", errs.length?errs.slice(0,2):"없음");
await b.close();
