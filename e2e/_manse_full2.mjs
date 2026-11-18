import { chromium } from "playwright";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 720, height: 800 }, deviceScaleFactor: 1, acceptDownloads: true });
const p = await ctx.newPage();
const errs=[]; p.on("console", m=>{ if(m.type()==="error") errs.push(m.text()); });
await p.goto("https://manse.sajuplan.com", { waitUntil: "networkidle" });
await p.getByRole("button", { name: "만세력 보기" }).click();
await p.getByRole("button", { name: "전문가 보기" }).click().catch(()=>{});
await p.waitForTimeout(700);
const dl = p.waitForEvent("download", { timeout: 25000 });
await p.getByRole("button", { name: "전체", exact: true }).click();
try {
  const d = await dl;
  await d.saveAs("full_capture.png");
  console.log("다운로드 OK:", await d.suggestedFilename());
} catch(e) { console.log("다운로드 실패:", e.message); }
if (errs.length) console.log("콘솔에러:", errs.slice(0,3));
await b.close();
