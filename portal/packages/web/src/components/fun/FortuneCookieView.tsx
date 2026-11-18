import { useState } from "react";
import { ballColor } from "@portal/engine";
import { todayKey } from "../../lib/dateKey.js";
import { loadProfile } from "../../lib/profile.js";
import { buildCookie, themeCookie, askCookie, COOKIE_THEMES, type CookieResult, type CookieTheme } from "../../lib/cookieEngine.js";
import { shareResult } from "../../lib/share.js";

const COL_KIND: Record<string, string> = { yes: "text-accent-600", maybe: "text-[#b45309]", no: "text-ink/70" };
const DOC_KEY = "cookie_dex_v1";

function loadDex(): string[] { try { return JSON.parse(localStorage.getItem(DOC_KEY) || "[]"); } catch { return []; } }
function saveDex(msg: string) {
  try {
    const cur = loadDex().filter((m) => m !== msg);
    cur.unshift(msg);
    localStorage.setItem(DOC_KEY, JSON.stringify(cur.slice(0, 30)));
  } catch { /* ignore */ }
}

// 포춘쿠키 v2 "오늘의 포춘쿠키 종합" — 까기 연출 + 종합운(분야별·행운요소·명언) + 테마 쿠키 + 매직8볼 + 도감.
export default function FortuneCookieView() {
  const name = loadProfile()?.name ?? "";
  const day = todayKey();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<CookieResult | null>(null);
  const [themeMsg, setThemeMsg] = useState<{ key: CookieTheme; label: string; emoji: string; msg: string } | null>(null);
  const [q, setQ] = useState("");
  const [ans, setAns] = useState<{ verdict: string; kind: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [dex, setDex] = useState<string[]>(loadDex());

  function crack() {
    const fc = buildCookie(day, name);
    setResult(fc); setOpen(true);
    saveDex(fc.message); setDex(loadDex());
  }
  function pickTheme(t: typeof COOKIE_THEMES[number]) {
    const msg = themeCookie(day, name, t.key);
    setThemeMsg({ key: t.key, label: t.label, emoji: t.emoji, msg });
    saveDex(msg); setDex(loadDex());
  }
  function ask() { if (q.trim()) setAns(askCookie(q)); }
  async function share() {
    if (!result) return;
    const txt = `[오늘의 포춘쿠키]\n"${result.message}"\n행운지수 ${result.score} · 행운숫자 ${result.luckyNumbers.join(",")}`;
    const res = await shareResult("포춘쿠키 — 사주플랜", txt);
    if (res === "copied") { setCopied(true); setTimeout(() => setCopied(false), 1800); }
  }

  return (
    <main className="px-4 pb-16 pt-3">
      <p className="mb-3 text-center text-[12.5px] font-medium text-accent-500">{day.replace(/-/g, ".")} · 오늘의 포춘쿠키</p>

      {!open ? (
        <button type="button" onClick={crack} className="mx-auto flex w-full max-w-[320px] flex-col items-center gap-3 rounded-card bg-white p-8 shadow-card ring-1 ring-black/5 transition active:scale-[0.96]">
          <span className="text-[64px] leading-none">🥠</span>
          <span className="text-[15px] font-bold text-ink">쿠키를 톡! 깨보세요</span>
          <span className="text-[12px] text-ink/66">오늘 당신을 위한 종합운이 들어 있어요</span>
        </button>
      ) : result && (
        <section className="space-y-3">
          {/* 핵심 메시지 */}
          <div className="rounded-card bg-white p-6 text-center shadow-card ring-1 ring-black/5">
            <span className="text-[40px] leading-none">🥠✨</span>
            <p className="mt-1 text-[11px] font-medium text-accent-500">{result.tone}형 포춘</p>
            <p className="mt-2 text-[17px] font-bold leading-relaxed text-ink">“{result.message}”</p>
            <div className="mx-auto mt-3 flex w-fit items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1">
              <span className="text-[12px] font-semibold text-accent-600">오늘의 행운지수</span>
              <span className="text-[14px] font-extrabold text-accent-500">{result.score}</span>
            </div>
            <p className="mt-2 text-[12px] text-ink/62">마음 날씨 · {result.mood}</p>
          </div>

          {/* 분야별 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-2.5 text-[14px] font-bold text-ink">🎯 분야별 오늘운</p>
            <div className="space-y-2">
              {result.fields.map((f) => (
                <div key={f.label} className="flex items-start gap-2">
                  <span className="w-12 shrink-0 text-[12px] font-medium text-ink/88">{f.emoji} {f.label}</span>
                  <div className="min-w-0 flex-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-black/[0.05]"><div className="h-full rounded-full bg-accent-400" style={{ width: `${f.score}%` }} /></div>
                    <p className="mt-0.5 text-[12px] leading-snug text-ink/74">{f.line}</p>
                  </div>
                  <span className="w-7 shrink-0 text-right text-[11px] font-bold text-accent-500">{f.score}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 행운요소 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-2 text-[14px] font-bold text-ink">🍀 오늘의 행운요소</p>
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full bg-canvas px-2.5 py-1 text-[11.5px] font-medium text-ink/88 ring-1 ring-black/5">색 <b className="text-accent-600">{result.lucky.color}</b></span>
              <span className="rounded-full bg-canvas px-2.5 py-1 text-[11.5px] font-medium text-ink/88 ring-1 ring-black/5">방향 <b className="text-accent-600">{result.lucky.dir}</b></span>
              <span className="rounded-full bg-canvas px-2.5 py-1 text-[11.5px] font-medium text-ink/88 ring-1 ring-black/5">시간 <b className="text-accent-600">{result.lucky.time}</b></span>
              <span className="rounded-full bg-canvas px-2.5 py-1 text-[11.5px] font-medium text-ink/88 ring-1 ring-black/5">아이템 <b className="text-accent-600">{result.lucky.item}</b></span>
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <span className="w-12 shrink-0 text-[12px] text-ink/66">행운숫자</span>
              <div className="flex flex-wrap gap-1">
                {result.luckyNumbers.map((n) => (<span key={n} className="flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold text-white" style={{ backgroundColor: ballColor(n) }}>{n}</span>))}
              </div>
            </div>
          </div>

          {/* 행동 가이드 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="text-[12.5px] leading-relaxed text-ink/88"><b className="text-accent-600">💡 오늘의 행운 행동</b> {result.action}</p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink/88"><b className="text-[#b45309]">⚠️ 오늘 피하면 좋은 것</b> {result.avoid}</p>
          </div>

          {/* 오늘의 명언 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-1 text-[12px] font-bold text-primary-600">📜 오늘의 명언</p>
            <p className="text-[13.5px] font-medium italic leading-relaxed text-primary-700">“{result.quote.t}”</p>
            <p className="mt-1 text-right text-[11.5px] text-ink/62">— {result.quote.a}</p>
          </div>

          {/* 유머 한 줄 */}
          <div className="rounded-card bg-[#fdf2f8] p-4 ring-1 ring-accent-400/20">
            <p className="text-[12px] font-bold text-accent-600">😆 오늘의 유머 포춘</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink/88">{result.funny}</p>
          </div>

          {/* 테마 쿠키 더 까기 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-2 text-[14px] font-bold text-ink">🥠 테마 쿠키 더 까기</p>
            <div className="flex flex-wrap gap-1.5">
              {COOKIE_THEMES.filter((t) => t.key !== "today").map((t) => (
                <button key={t.key} type="button" onClick={() => pickTheme(t)} className={["rounded-full px-3 py-1.5 text-[12px] font-semibold ring-1 transition active:scale-95", themeMsg?.key === t.key ? "bg-accent-500 text-white ring-accent-500" : "bg-canvas text-ink/74 ring-black/5"].join(" ")}>{t.emoji} {t.label}</button>
              ))}
            </div>
            {themeMsg && (
              <div className="mt-2.5 rounded-xl bg-accent-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-ink/88">{themeMsg.emoji} {themeMsg.msg}</div>
            )}
          </div>

          {/* 매직 포춘 — 질문하기 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-2 text-[14px] font-bold text-ink">🔮 쿠키에게 물어보기 (예/아니오)</p>
            <div className="flex gap-1.5">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="고민을 한 줄로 물어보세요" className="min-w-0 flex-1 rounded-xl border border-black/10 bg-canvas px-3 py-2 text-[13px] text-ink outline-none focus:border-accent-400" />
              <button type="button" onClick={ask} disabled={!q.trim()} className="shrink-0 rounded-xl bg-accent-500 px-4 text-[13px] font-semibold text-white disabled:opacity-40">물어보기</button>
            </div>
            {ans && <p className={["mt-2.5 text-center text-[15px] font-bold", COL_KIND[ans.kind]].join(" ")}>🥠 {ans.verdict}</p>}
          </div>

          {/* 도감 */}
          {dex.length > 0 && (
            <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
              <p className="mb-2 text-[14px] font-bold text-ink">📒 내가 모은 포춘 ({dex.length})</p>
              <div className="space-y-1">
                {dex.slice(0, 8).map((m, i) => (<p key={i} className="truncate text-[12px] leading-relaxed text-ink/70">🥠 {m}</p>))}
              </div>
            </div>
          )}

          {/* 유래 스토리 */}
          <div className="rounded-card bg-[#fff7e0] p-5 ring-1 ring-[#f59e0b]/15">
            <p className="text-[12px] font-bold text-[#b88300]">🏮 포춘쿠키 이야기</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink/88">{result.origin}</p>
          </div>

          {/* 공유 */}
          <button type="button" onClick={share} className="flex w-full items-center justify-center gap-1.5 rounded-card bg-accent-50 py-3.5 text-[14px] font-semibold text-accent-600 ring-1 ring-accent-400/30 active:scale-[0.99]">
            {copied ? "복사됐어요! 친구에게 자랑하기 📋" : "오늘의 포춘 자랑하기 📋"}
          </button>

          <p className="text-center text-[11px] text-ink/58">오늘의 쿠키는 자정에 새로 구워져요 🌙</p>
        </section>
      )}

      <p className="mt-6 text-center text-[11px] leading-relaxed text-ink/58">하루 한 번, 가볍게 즐기는 재미 운세예요.</p>
    </main>
  );
}
