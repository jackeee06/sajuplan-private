import { useState } from "react";
import { buildPetalReport, type PetalReport } from "../../lib/petalEngine.js";
import { todayKey } from "../../lib/dateKey.js";
import { shareResult } from "../../lib/share.js";

// 꽃잎점 v2 "짝사랑 종합 리포트" — 이름 기반 결정론. 꽃잎 떼기 인터랙션 + 마음게이지·온도·5항목·썸단계·속마음·성공확률·고백타이밍·행동가이드·꽃말·FLAMES·오늘운세.
export default function PetalView() {
  const [me, setMe] = useState("");
  const [you, setYou] = useState("");
  const [report, setReport] = useState<PetalReport | null>(null);
  const [plucked, setPlucked] = useState(0); // 뗀 꽃잎 수
  const [copied, setCopied] = useState(false);

  function run() {
    if (!you.trim()) return;
    setReport(buildPetalReport(me, you, todayKey()));
    setPlucked(0);
  }
  function pluck() { if (report && plucked < report.petals) setPlucked((n) => n + 1); }

  const done = !!report && plucked >= report.petals;
  // 시작 '좋아한다'(1장째). 1-indexed 홀수=좋아한다. 현재 떼는 중 라벨:
  const curLabel = report && plucked < report.petals ? ((plucked + 1) % 2 === 1 ? "좋아한다 💗" : "안 좋아한다 🥀") : "";

  async function share() {
    if (!report) return;
    const txt = `[꽃잎점] ${me.trim() || "나"} 💞 ${you.trim()}\n마음 게이지 ${report.percent}% · ${report.label}\n마음 온도 ${report.heartTemp}°C`;
    const res = await shareResult("꽃잎점 — 사주플랜", txt);
    if (res === "copied") { setCopied(true); setTimeout(() => setCopied(false), 1800); }
  }

  return (
    <main className="px-4 pb-16 pt-3">
      <section className="rounded-card bg-white p-4 shadow-card ring-1 ring-black/5">
        <p className="text-[13px] font-medium text-ink">궁금한 그 사람의 마음, 꽃잎점으로 확인해요</p>
        <div className="mt-3 space-y-2">
          <input value={me} onChange={(e) => setMe(e.target.value)} placeholder="내 이름 (선택)" className="w-full rounded-xl border border-black/10 bg-canvas px-3 py-2.5 text-[14px] text-ink outline-none focus:border-accent-400" />
          <input value={you} onChange={(e) => setYou(e.target.value)} placeholder="그 사람 이름" className="w-full rounded-xl border border-black/10 bg-canvas px-3 py-2.5 text-[14px] text-ink outline-none focus:border-accent-400" />
        </div>
        <button type="button" onClick={run} disabled={!you.trim()} className="mt-3 w-full rounded-xl bg-accent-500 py-3 text-[15px] font-semibold text-white transition active:scale-[0.99] disabled:opacity-40">🌸 꽃잎점 보기</button>
      </section>

      {report && (
        <section className="mt-4 space-y-3">
          {/* 꽃잎 떼기 인터랙션 */}
          <div className="rounded-card bg-white p-6 text-center shadow-card ring-1 ring-black/5">
            <p className="text-[12.5px] text-ink/70">{report.flower.emoji} {report.flower.name} 꽃잎을 한 장씩 떼어보세요</p>
            <div className="mt-3 flex flex-wrap justify-center gap-1">
              {Array.from({ length: report.petals }).map((_, i) => (
                <span key={i} className={["text-[24px] leading-none transition-opacity", i < plucked ? "opacity-15" : "opacity-100"].join(" ")}>🌸</span>
              ))}
            </div>
            {!done ? (
              <>
                <p className="mt-3 text-[15px] font-bold text-accent-500">{curLabel}</p>
                <button type="button" onClick={pluck} className="mt-2 rounded-full bg-accent-50 px-5 py-2 text-[13px] font-semibold text-accent-600 ring-1 ring-accent-400/30 active:scale-95">꽃잎 떼기 ({report.petals - plucked}장 남음)</button>
              </>
            ) : (
              <>
                <p className="mt-3 text-[34px] leading-none">{report.emoji}</p>
                <p className="mt-1 text-[19px] font-extrabold text-accent-500">{report.finalLoves ? "좋아한다! 💗" : "아직은… 🥀"}</p>
                <p className="mt-1 text-[13px] font-semibold text-ink/88">{report.label}</p>
                <p className="mt-2 text-[12px] text-ink/62">{report.flower.name} 꽃말 · {report.flower.meaning}</p>
              </>
            )}
          </div>

          {done && (
            <>
              {/* 마음 게이지 + 온도 */}
              <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
                <div className="flex items-center justify-between">
                  <p className="text-[14px] font-bold text-ink">💗 마음 게이지</p>
                  <p className="text-[13px] font-bold text-accent-500">{report.percent}%</p>
                </div>
                <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-canvas"><div className="h-full rounded-full bg-accent-400" style={{ width: `${report.percent}%` }} /></div>
                <p className="mt-2 text-[13px] leading-relaxed text-ink/88">{report.line}</p>
                <p className="mt-2 text-[12.5px] font-medium text-[#b45309]">🌡️ 마음 온도 {report.heartTemp}°C</p>
              </div>

              {/* 썸 단계 */}
              <div className="rounded-card bg-[#fdf2f8] p-5 ring-1 ring-accent-400/20">
                <p className="text-[14px] font-bold text-accent-600">📍 우리 단계: {report.stage.name}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink/88">{report.stage.text}</p>
              </div>

              {/* 5항목 분해 */}
              <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
                <p className="mb-2.5 text-[14px] font-bold text-ink">🎯 우리 케미 5항목</p>
                <div className="space-y-2">
                  {report.fiveAxis.map((a) => (
                    <div key={a.label} className="flex items-center gap-2">
                      <span className="w-16 shrink-0 text-[12px] font-medium text-ink/88">{a.label}</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/[0.05]"><div className="h-full rounded-full bg-accent-400" style={{ width: `${a.score}%` }} /></div>
                      <span className="w-8 shrink-0 text-right text-[11px] font-bold text-accent-500">{a.score}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 상대 속마음 */}
              <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
                <p className="mb-1.5 text-[14px] font-bold text-ink">💭 상대의 속마음</p>
                <p className="text-[13px] leading-relaxed text-ink/88">{report.innerVoice}</p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink/70">{report.innerWhy}</p>
              </div>

              {/* 성공확률·고백타이밍·연락확률 */}
              <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
                <p className="mb-2 text-[14px] font-bold text-ink">💘 짝사랑 리포트</p>
                <div className="flex gap-2">
                  <div className="flex-1 rounded-xl bg-canvas p-2.5 text-center ring-1 ring-black/5"><p className="text-[16px] font-extrabold text-accent-500">{report.successRate}%</p><p className="text-[10.5px] text-ink/66">성공 확률</p></div>
                  <div className="flex-1 rounded-xl bg-canvas p-2.5 text-center ring-1 ring-black/5"><p className="text-[16px] font-extrabold text-accent-500">{report.replyRate}%</p><p className="text-[10.5px] text-ink/66">연락 올 확률</p></div>
                </div>
                <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink/88"><b className="text-accent-600">고백 타이밍</b> {report.confessTiming}</p>
              </div>

              {/* 행동 가이드 */}
              <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
                <p className="mb-2 text-[14px] font-bold text-ink">🪜 이렇게 하면 이뤄져요</p>
                <ol className="space-y-1.5">
                  {report.actions.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink/88"><span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent-500 text-[9px] font-bold text-white">{i + 1}</span>{a}</li>
                  ))}
                </ol>
              </div>

              {/* FLAMES 관계 유형 */}
              <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
                <p className="text-[14px] font-bold text-ink">{report.flames.emoji} 두 이름이 말하는 관계: <span className="text-accent-600">{report.flames.type}</span></p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink/88">{report.flames.text}</p>
              </div>

              {/* 오늘의 연애 + 행운 */}
              <div className="rounded-card bg-[#fff7e0] p-5 ring-1 ring-[#f59e0b]/15">
                <p className="text-[12px] font-bold text-[#b88300]">🍀 오늘의 연애운</p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink/88">{report.todayLine}</p>
                <p className="mt-1 text-[12.5px] text-ink/74">마음 날씨 · {report.moodWeather}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11.5px] font-medium text-ink/88 ring-1 ring-black/5">고백 좋은 날 <b className="text-accent-600">{report.lucky.day}</b></span>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11.5px] font-medium text-ink/88 ring-1 ring-black/5">행운의 색 <b className="text-accent-600">{report.lucky.color}</b></span>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11.5px] font-medium text-ink/88 ring-1 ring-black/5">데이트 장소 <b className="text-accent-600">{report.lucky.place}</b></span>
                </div>
              </div>

              {/* 공유 */}
              <button type="button" onClick={share} className="flex w-full items-center justify-center gap-1.5 rounded-card bg-accent-50 py-3.5 text-[14px] font-semibold text-accent-600 ring-1 ring-accent-400/30 active:scale-[0.99]">
                {copied ? "복사됐어요! 친구에게 자랑하기 📋" : "꽃잎점 결과 자랑하기 📋"}
              </button>

              <a href="https://sajuplan.com" className="flex items-center justify-center gap-1.5 rounded-card bg-primary-500/[0.07] py-3.5 text-[14px] font-semibold text-primary-600 ring-1 ring-primary-500/20 active:scale-[0.99]">
                이 인연, 진짜 잘 될지 궁금하다면 →
              </a>
            </>
          )}
        </section>
      )}

      <p className="mt-6 text-center text-[11px] leading-relaxed text-ink/58">가볍게 즐기는 재미 운세예요. 진심은 직접 확인하는 게 가장 정확해요 😊</p>
    </main>
  );
}
