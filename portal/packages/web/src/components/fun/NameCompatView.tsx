import { useState } from "react";
import { ballColor } from "@portal/engine";
import { shareResult } from "../../lib/share.js";
import { buildNameCompat, type NameCompat } from "../../lib/nameCompatEngine.js";

const GRADE_BG: Record<string, string> = { S: "bg-accent-500", A: "bg-accent-500", B: "bg-accent-400", C: "bg-primary-400", D: "bg-ink/40" };

// 이름 궁합 — 두 이름 입력 → 케미 점수 + 오행 + 5항목 + 풀이 + 별명 + 행운. 사주무관·재미용.
export default function NameCompatView() {
  const [me, setMe] = useState("");
  const [you, setYou] = useState("");
  const [r, setR] = useState<NameCompat | null>(null);
  const [copied, setCopied] = useState(false);

  function run() {
    if (!me.trim() || !you.trim()) return;
    setR(buildNameCompat(me, you));
  }
  async function share() {
    if (!r) return;
    const txt = `[이름 궁합] ${r.me} 💞 ${r.you}\n${r.score}점 · ${r.grade}등급 ${r.gradeLabel}\n${r.nickname}`;
    const res = await shareResult("이름 궁합 — 사주플랜", txt);
    if (res === "copied") { setCopied(true); setTimeout(() => setCopied(false), 1800); }
  }

  return (
    <main className="px-4 pb-16 pt-3">
      <section className="rounded-card bg-white p-4 shadow-card ring-1 ring-black/5">
        <p className="text-[14px] font-bold text-ink">두 사람의 이름을 넣어주세요</p>
        <p className="mb-3 mt-0.5 text-[12px] text-ink/62">연인·친구·동료 누구와도 OK</p>
        <div className="space-y-2">
          <input value={me} onChange={(e) => setMe(e.target.value)} placeholder="내 이름" className="w-full rounded-xl border border-black/10 bg-canvas px-3 py-2.5 text-[14px] text-ink outline-none focus:border-accent-400" />
          <input value={you} onChange={(e) => setYou(e.target.value)} placeholder="상대 이름" className="w-full rounded-xl border border-black/10 bg-canvas px-3 py-2.5 text-[14px] text-ink outline-none focus:border-accent-400" />
        </div>
        <button type="button" onClick={run} disabled={!me.trim() || !you.trim()} className="mt-3 w-full rounded-xl bg-accent-500 py-3 text-[15px] font-semibold text-white transition active:scale-[0.99] disabled:opacity-40">💞 이름 궁합 보기</button>
      </section>

      {r && (
        <section className="mt-4 space-y-3">
          {/* 점수 헤더 */}
          <div className="flex flex-col items-center rounded-card bg-white p-6 shadow-card ring-1 ring-black/5">
            <p className="text-[13px] text-ink/66">{r.me} 💞 {r.you}</p>
            <div className="mt-2 flex h-24 w-24 flex-col items-center justify-center rounded-full bg-accent-500 text-white">
              <span className="text-[30px] font-extrabold leading-none">{r.score}</span>
              <span className="text-[11px] opacity-90">궁합</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span className={["flex h-7 w-7 items-center justify-center rounded-full text-[14px] font-extrabold text-white", GRADE_BG[r.grade]].join(" ")}>{r.grade}</span>
              <span className="text-[13px] font-bold text-accent-600">{r.gradeLabel}</span>
            </div>
            <p className="mt-2.5 text-center text-[15.5px] font-bold leading-tight text-ink">{r.headline}</p>
          </div>

          {/* 풀이 — 롱폼 서사 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-2.5 text-[14px] font-bold text-ink">📖 두 사람 이야기</p>
            <div className="space-y-2.5">
              {r.longStory.map((para, i) => (
                <p key={i} className={i === 0 ? "text-[14.5px] font-semibold leading-relaxed text-ink" : "text-[13.5px] leading-relaxed text-ink/88"}>{para}</p>
              ))}
            </div>
          </div>

          {/* 이름 오행 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-2.5 text-[14px] font-bold text-ink">🌳 이름에 담긴 오행 기운</p>
            <div className="flex items-center justify-center gap-3">
              {r.elements.map((e) => (
                <div key={e.name} className="flex flex-col items-center">
                  <span className="text-[30px] leading-none">{e.elEmoji}</span>
                  <p className="mt-1 text-[13px] font-bold text-ink">{e.name}</p>
                  <p className="text-[12px] font-semibold text-primary-600">{e.el} 기운</p>
                </div>
              ))}
            </div>
            <p className="mt-3 rounded-xl bg-canvas px-3 py-2.5 text-[12.5px] leading-relaxed text-ink/88">{r.elementRelation}</p>
          </div>

          {/* 연애·우정·사업 궁합 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-2.5 text-[14px] font-bold text-ink">💞 관계별 궁합</p>
            <div className="grid grid-cols-3 gap-2">
              {[{ label: "💕 연애", v: r.dims.love }, { label: "🤝 우정", v: r.dims.friend }, { label: "💼 사업·동료", v: r.dims.work }].map((d) => (
                <div key={d.label} className="rounded-xl bg-canvas px-2 py-2.5 text-center ring-1 ring-black/5">
                  <p className="text-[11px] font-medium text-ink/66">{d.label}</p>
                  <p className="mt-0.5 text-[18px] font-extrabold text-primary-600">{d.v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 5항목 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-2.5 text-[14px] font-bold text-ink">🎯 우리 케미 5항목</p>
            <div className="space-y-2">
              {r.axes.map((a) => (
                <div key={a.label} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-[12.5px] font-medium text-ink/74">{a.label}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/[0.05]"><div className="h-full rounded-full bg-accent-400" style={{ width: `${a.score}%` }} /></div>
                  <span className="w-8 shrink-0 text-right text-[11px] font-bold text-accent-500">{a.score}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 이름 수리·음양 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-2.5 text-[14px] font-bold text-ink">🔢 이름 수리(數理) 풀이</p>
            <div className="flex items-center justify-center gap-3">
              {r.strokes.map((s) => (
                <div key={s.name} className="flex flex-col items-center rounded-xl bg-canvas px-4 py-2.5 ring-1 ring-black/5">
                  <p className="text-[13px] font-bold text-ink">{s.name}</p>
                  <p className="text-[18px] font-extrabold text-primary-600">{s.num}</p>
                  <p className="text-[11px] font-semibold text-accent-600">{s.yinyang}</p>
                </div>
              ))}
              <span className="text-[20px] text-ink/40">=</span>
              <div className="flex flex-col items-center rounded-xl bg-accent-50 px-4 py-2.5 ring-1 ring-accent-400/30">
                <p className="text-[12px] font-bold text-accent-600">합산수</p>
                <p className="text-[18px] font-extrabold text-accent-500">{r.totalNumber}</p>
              </div>
            </div>
            <p className="mt-3 rounded-xl bg-canvas px-3 py-2.5 text-[12.5px] leading-relaxed text-ink/88">{r.numberMeaning}</p>
          </div>

          {/* 관계 타임라인 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-2.5 text-[14px] font-bold text-ink">🎬 우리 관계 흐름</p>
            <div className="space-y-2.5">
              {r.timeline.map((t) => (
                <div key={t.phase} className="flex items-start gap-2.5">
                  <span className="mt-0.5 shrink-0 text-[18px]">{t.emoji}</span>
                  <div><p className="text-[12.5px] font-semibold text-ink/88">{t.phase}</p><p className="text-[12.5px] leading-relaxed text-ink/74">{t.text}</p></div>
                </div>
              ))}
            </div>
          </div>

          {/* 호칭·데이트·한시 */}
          <div className="rounded-card bg-[#fff7e0] p-5 ring-1 ring-[#f59e0b]/15">
            <p className="mb-2 text-[13px] font-bold text-[#b88300]">💝 두 사람을 위한 처방</p>
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full bg-white px-2.5 py-1 text-[11.5px] font-medium text-ink/82 ring-1 ring-black/5">추천 호칭 <b className="text-accent-600">{r.callname}</b></span>
              <span className="rounded-full bg-white px-2.5 py-1 text-[11.5px] font-medium text-ink/82 ring-1 ring-black/5">이상적 데이트 <b className="text-accent-600">{r.idealDate}</b></span>
            </div>
            <p className="mt-3 text-[13px] font-semibold italic leading-relaxed text-primary-700">“{r.poem}”</p>
          </div>

          {/* 잘맞음/조심 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="text-[12.5px] font-semibold text-green-600">💚 잘 맞는 점</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink/88">{r.good}</p>
            <p className="mt-3 text-[12.5px] font-semibold text-[#b45309]">⚡ 조심할 점</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink/88">{r.caution}</p>
          </div>

          {/* 별명 + 행운 */}
          <div className="rounded-card bg-[#fdf2f8] p-5 ring-1 ring-accent-400/20">
            <p className="text-[14px] font-bold text-accent-600">💝 우리 커플 별명: {r.nickname}</p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-white px-2.5 py-1 text-[11.5px] font-medium text-ink/82 ring-1 ring-black/5">좋은 날 <b className="text-accent-600">{r.lucky.day}</b></span>
              <span className="rounded-full bg-white px-2.5 py-1 text-[11.5px] font-medium text-ink/82 ring-1 ring-black/5">행운의 색 <b className="text-accent-600">{r.lucky.color}</b></span>
              <span className="rounded-full bg-white px-2.5 py-1 text-[11.5px] font-medium text-ink/82 ring-1 ring-black/5">함께하면 좋은 것 <b className="text-accent-600">{r.lucky.item}</b></span>
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <span className="text-[12px] text-ink/66">행운 숫자</span>
              <div className="flex gap-1.5">
                {r.luckyNumbers.map((n) => (<span key={n} className="flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold text-white" style={{ backgroundColor: ballColor(n) }}>{n}</span>))}
              </div>
            </div>
          </div>

          {/* 공유 */}
          <button type="button" onClick={share} className="flex w-full items-center justify-center gap-1.5 rounded-card bg-accent-50 py-3.5 text-[14px] font-semibold text-accent-600 ring-1 ring-accent-400/30 active:scale-[0.99]">
            {copied ? "복사됐어요! 친구에게 자랑하기 📋" : "이름 궁합 자랑하기 📋"}
          </button>

          <a href="https://sajuplan.com" className="flex items-center justify-center gap-1.5 rounded-card bg-primary-500/[0.07] py-3.5 text-[14px] font-semibold text-primary-600 ring-1 ring-primary-500/20 active:scale-[0.99]">
            이름 너머 사주로 보는 진짜 궁합이 궁금하다면 →
          </a>
        </section>
      )}

      <p className="mt-6 text-center text-[11px] leading-relaxed text-ink/58">이름 궁합은 전통 성명학을 활용한 재미·참고용이에요. 깊은 인연은 사주 궁합으로 확인하세요 😊</p>
    </main>
  );
}
