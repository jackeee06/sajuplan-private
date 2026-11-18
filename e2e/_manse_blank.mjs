import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 1 });
await p.goto("https://manse.sajuplan.com", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(800);
const date = await p.getByLabel("생년월일").inputValue().catch(()=>"(못찾음)");
const time = await p.getByLabel("태어난 시각").inputValue().catch(()=>"(못찾음)");
console.log("생년월일 입력값 =", JSON.stringify(date), "(빈칸이어야)");
console.log("시각 입력값 =", JSON.stringify(time), "(빈칸이어야)");
// 빈칸으로 만세력 보기 누르면 안내 뜨는지
await p.getByRole("button", { name: "만세력 보기" }).click();
await p.waitForTimeout(500);
const err = await p.getByText(/생년월일.*입력/).count();
console.log("빈칸 제출 시 안내문구 =", err > 0 ? "표시됨 ✅" : "없음");
await b.close();
