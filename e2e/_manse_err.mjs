import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 600, height: 950 }, deviceScaleFactor: 1 });
const all=[]; p.on("console", m=>{ if(m.type()==="error") all.push(m.text()); });
p.on("pageerror", e=>all.push("PAGEERR:"+e.message));
await p.goto("https://manse.sajuplan.com", { waitUntil: "domcontentloaded" });
await p.getByRole("button", { name: "만세력 보기" }).click();
await p.getByRole("button", { name: "전문가 보기" }).click().catch(()=>{});
await p.waitForTimeout(2500); // 프리워밍(900ms) + 여유
const cssErr = all.filter(t=>/cssRules|CSSStyleSheet|fonts.googleapis|inlining remote/.test(t));
console.log("총 콘솔 에러 =", all.length);
console.log("CSS/폰트 관련 에러 =", cssErr.length);
console.log("기타 에러 =", all.filter(t=>!/cssRules|CSSStyleSheet|fonts.googleapis|inlining remote/.test(t)).slice(0,3));
await b.close();
