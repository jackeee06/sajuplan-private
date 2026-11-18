import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 600, height: 900 }, deviceScaleFactor: 1 });
const errs=[]; p.on("console", m=>{ if(m.type()==="error") errs.push(m.text()); });
await p.goto("https://manse.sajuplan.com", { waitUntil: "domcontentloaded" });
await p.getByRole("button", { name: "만세력 보기" }).click();
await p.getByRole("button", { name: "전문가 보기" }).click().catch(()=>{});
await p.waitForTimeout(1000);
// 신살 · 길성 섹션 찾기
const sec = p.locator("div").filter({ has: p.getByRole("heading", { name: "신살 · 길성" }) }).last();
await sec.scrollIntoViewIfNeeded().catch(()=>{});
await p.waitForTimeout(300);
// 요약 줄 텍스트
const summary = await p.getByText(/총 \d+개 · 길성/).textContent().catch(()=>"(요약 못찾음)");
console.log("요약 =", JSON.stringify(summary));
// 표 존재 + 헤더
const hasTable = await sec.locator("table").count();
console.log("표 개수 =", hasTable);
const headers = await sec.locator("th").allTextContents();
console.log("표 헤더 =", JSON.stringify(headers));
await sec.screenshot({ path: "sinsal_table.png" }).catch(e=>console.log("스샷 실패:", e.message));
if (errs.length) console.log("콘솔에러:", errs.slice(0,2));
await b.close();
