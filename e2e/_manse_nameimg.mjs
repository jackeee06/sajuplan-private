import { chromium } from "playwright";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 720, height: 700 }, deviceScaleFactor: 2, permissions: ["clipboard-read","clipboard-write"] });
const p = await ctx.newPage();
await p.goto("https://manse.sajuplan.com", { waitUntil: "networkidle" });
await p.getByLabel("생년월일").click(); // ensure panel visible
await p.locator('input[placeholder="이름"]').fill("홍길동");
await p.getByRole("button", { name: "만세력 보기" }).click();
await p.waitForTimeout(600);
// 공유 URL 가로채기 (native share 끄고 clipboard write 후킹)
const shared = await p.evaluate(() => new Promise((res) => {
  navigator.share = undefined;
  const orig = navigator.clipboard.writeText.bind(navigator.clipboard);
  navigator.clipboard.writeText = async (t) => { res(t); return orig(t).catch(()=>{}); };
  document.querySelectorAll("button").forEach(x=>{ if(x.textContent.trim()==="공유") x.click(); });
  setTimeout(()=>res("(none)"), 1500);
}));
console.log("공유URL =", shared);
// 그 URL 열어서 이름 뜨는지
if (typeof shared==="string" && shared.startsWith("http")) {
  const p2 = await ctx.newPage();
  await p2.goto(shared, { waitUntil: "networkidle" });
  await p2.waitForTimeout(700);
  const nameShown = await p2.locator("text=홍길동").count();
  console.log("받는쪽 이름표시?", nameShown>0?"YES":"NO");
}
// 이미지 버튼 → 클립보드 복사 토스트
await p.getByRole("button", { name: "이미지", exact: true }).click();
await p.waitForTimeout(700);
const toast = await p.locator("text=/이미지를/").first().textContent().catch(()=>"(no toast)");
console.log("이미지 토스트 =", toast);
await b.close();
