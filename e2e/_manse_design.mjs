import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 760, height: 720 }, deviceScaleFactor: 2 });
await p.goto("https://manse.sajuplan.com", { waitUntil: "networkidle" });
await p.waitForTimeout(800); // 폰트 로드 대기
await p.screenshot({ path: "design.png" }); // 상단(헤더+탭+입력) 뷰포트
console.log("OK");
await b.close();
