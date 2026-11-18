import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 720, height: 700 }, deviceScaleFactor: 2 });
// 1) 공유 링크 생성: 계산 후 공유 버튼이 clipboard에 넣는 URL을 가로채기
await p.goto("https://manse.sajuplan.com", { waitUntil: "networkidle" });
await p.getByRole("button", { name: "만세력 보기" }).click();
await p.waitForTimeout(600);
// clipboard 권한 우회 위해 navigator.share/clipboard 가로채기
const shared = await p.evaluate(() => {
  return new Promise((res) => {
    navigator.clipboard.writeText = async (t) => { res(t); };
    navigator.share = undefined;
    document.querySelectorAll("button").forEach(btn => { if (btn.textContent.trim()==="공유") btn.click(); });
    setTimeout(()=>res("(no copy)"), 1500);
  });
});
console.log("공유 URL =", shared);
// 2) 그 URL로 새로 진입 → 자동계산 되는지
const url = typeof shared === "string" && shared.startsWith("http") ? shared : null;
if (url) {
  const p2 = await b.newPage({ viewport: { width: 720, height: 700 }, deviceScaleFactor: 2 });
  await p2.goto(url, { waitUntil: "networkidle" });
  await p2.waitForTimeout(800);
  const hasChart = await p2.locator("text=일주 (일원)").count();
  console.log("진입 후 원국 표시?", hasChart>0 ? "YES" : "NO");
  await p2.screenshot({ path: "share_open.png" });
}
await b.close();
