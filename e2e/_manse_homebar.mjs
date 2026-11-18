import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 1400 }, deviceScaleFactor: 1 });
const errs=[]; p.on("pageerror", e=>errs.push(e.message));
await p.goto("https://sajuplan.com/?__env=prod", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(2500);
const bar = p.getByRole("button", { name: "무료 만세력 열기" });
console.log("슬림 바 존재 =", await bar.count());
// 위치: 통계카드(접속중상담사)와 탭(전체) 사이인지 y좌표로 확인
const yStat = await p.getByText("접속중상담사").boundingBox().catch(()=>null);
const yBar = await bar.boundingBox().catch(()=>null);
const yTab = await p.getByText("전체", {exact:true}).first().boundingBox().catch(()=>null);
console.log("y: 통계카드", yStat?.y?.toFixed(0), "< 슬림바", yBar?.y?.toFixed(0), "< 탭", yTab?.y?.toFixed(0));
console.log("순서 맞음?", yStat && yBar && yTab && yStat.y < yBar.y && yBar.y < yTab.y);
await bar.scrollIntoViewIfNeeded().catch(()=>{});
await p.screenshot({ path: "home_bar.png" });
console.log("페이지 에러 =", errs.length?errs.slice(0,2):"없음");
await b.close();
