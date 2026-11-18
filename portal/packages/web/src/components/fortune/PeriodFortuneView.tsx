import { useMemo, useState } from "react";
import { ballColor } from "@portal/engine";
import { useProfile } from "../../lib/useProfile.js";
import MyInfoBar from "../MyInfoBar.js";
import YearToggle, { defaultYear } from "../YearToggle.js";
import { buildPeriodFortune, type PeriodFortune } from "../../lib/periodEngine.js";

// 신년운세 / 월간운세 — 만세 엔진 세운(년)·월운(월) 기반. 입력은 공통 MyInfoBar.
type Mode = "newyear" | "monthly";

const EL_BAR: Record<string, string> = { 목: "#22c55e", 화: "#ef4444", 토: "#f59e0b", 금: "#9ca3af", 수: "#3b82f6" };

function Stars({ score }: { score: number }) {
  const n = Math.max(1, Math.min(5, Math.round(score / 20)));
  return (
    <span className="text-[12px] text-accent-500">
      {"★★★★★".slice(0, n)}<span className="text-ink/20">{"★★★★★".slice(n)}</span>
    </span>
  );
}

export default function PeriodFortuneView({ mode }: { mode: Mode }) {
  const profile = useProfile();
  const kind = mode === "newyear" ? "year" : "month";
  const now = new Date();
  const thisMonth = now.getMonth() + 1;
  const [year, setYear] = useState(mode === "newyear" ? defaultYear() : now.getFullYear());

  const result: PeriodFortune | null = useMemo(
    () => (profile?.birth ? buildPeriodFortune(profile, kind, year, thisMonth) : null),
    [profile, kind, year, thisMonth],
  );

  return (
    <main className="px-4 pb-16 pt-3">
      <MyInfoBar showSaju ctaLabel={mode === "newyear" ? `생년월일 넣고 ${year}년 신년운세 받기` : "생년월일 넣고 이번 달 운세 받기"} />
      {mode === "newyear" && <YearToggle year={year} onChange={setYear} />}

      {result ? (
        <section className="space-y-3">
          {/* 헤더 */}
          <div className="rounded-card bg-white p-5 text-center shadow-card ring-1 ring-black/5">
            <p className="text-[12px] font-medium text-ink/62">{result.label} · {kind === "year" ? "세운" : "월운"}</p>
            <p className="mt-1 text-[20px] font-extrabold text-ink">
              {result.ganzhi} <span className="text-[13px] font-medium text-ink/62">{result.ganzhiKo}</span>
            </p>
            <p className="mt-2 text-[17px] font-bold text-accent-500">{result.headline}</p>
            <p className="mt-1 inline-block rounded-full bg-accent-50 px-3 py-1 text-[11.5px] font-semibold text-accent-500">{result.subjectLabel} · {result.theme}</p>
          </div>

          {/* 종합 + 롱폼 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <div className="flex items-center gap-3">
              <div className="flex h-[68px] w-[68px] shrink-0 flex-col items-center justify-center rounded-full bg-accent-500 text-white">
                <span className="text-[22px] font-extrabold leading-none">{result.overall}</span>
                <span className="text-[10px] opacity-90">{kind === "year" ? "올해운" : "이달운"}</span>
              </div>
              <Stars score={result.overall} />
            </div>
            <div className="mt-3 space-y-2">
              {result.summaryParas.map((line, i) => (<p key={i} className="text-[13.5px] leading-relaxed text-ink/88">{line}</p>))}
            </div>
          </div>

          {/* 분야별 5 */}
          <div className="rounded-card bg-white p-4 shadow-card ring-1 ring-black/5">
            <p className="mb-1 px-1 text-[14px] font-bold text-ink">분야별 운세</p>
            <div className="divide-y divide-black/5">
              {result.fields.map((f) => (
                <div key={f.key} className="py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[13.5px] font-semibold text-ink">{f.emoji} {f.label}</span>
                    <span className="flex items-center gap-1.5"><Stars score={f.score} /><span className="text-[12px] font-bold tabular-nums text-accent-500">{f.score}</span></span>
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-ink/88">{f.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 흐름 */}
          <div className="rounded-card bg-white p-4 shadow-card ring-1 ring-black/5">
            <p className="mb-2.5 text-[14px] font-bold text-ink">{kind === "year" ? "월별 흐름" : "기간별 흐름"}</p>
            {kind === "year" ? (
              <div className="grid grid-cols-6 gap-1.5">
                {result.flow.map((m) => (
                  <div key={m.label} className="flex flex-col items-center">
                    <span className="text-[10px] text-ink/62">{m.label}</span>
                    <div className="mt-1 flex h-14 w-full items-end overflow-hidden rounded-md bg-canvas">
                      <div className="w-full rounded-md" style={{ height: `${m.score}%`, backgroundColor: EL_BAR[m.element] }} />
                    </div>
                    <span className="mt-0.5 text-[10px] font-semibold tabular-nums text-ink/70">{m.score}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {result.flow.map((m) => (
                  <div key={m.label} className="flex items-center gap-2">
                    <span className="w-24 shrink-0 text-[12px] text-ink/70">{m.label}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-canvas">
                      <div className="h-full rounded-full" style={{ width: `${m.score}%`, backgroundColor: EL_BAR[m.element] }} />
                    </div>
                    <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-ink/70">{m.score}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 행운 요소 + 조언 */}
          <div className="rounded-card bg-white p-4 shadow-card ring-1 ring-black/5">
            <p className="mb-2.5 text-[14px] font-bold text-ink">{kind === "year" ? "올해의" : "이달의"} 행운 요소</p>
            <div className="mb-3 flex items-center gap-2">
              <span className="w-14 shrink-0 text-[12px] text-ink/62">행운 숫자</span>
              <div className="flex gap-1.5">
                {result.lucky.numbers.map((n) => (<span key={n} className="flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold text-white" style={{ backgroundColor: ballColor(n) }}>{n}</span>))}
              </div>
            </div>
            <table className="w-full text-left text-[12.5px]">
              <tbody className="[&_td]:py-1 [&_th]:py-1 [&_th]:pr-3 [&_th]:font-medium [&_th]:text-ink/62">
                <tr><th scope="row">행운 색</th><td className="font-medium text-ink">{result.lucky.color}</td></tr>
                <tr><th scope="row">행운 방향</th><td className="font-medium text-ink">{result.lucky.direction}</td></tr>
                <tr><th scope="row">행운 아이템</th><td className="font-medium text-ink">{result.lucky.item}</td></tr>
              </tbody>
            </table>
            <p className="mt-3 rounded-xl bg-accent-50 px-3 py-2 text-[12.5px] leading-relaxed text-ink/88">💡 {result.advice}</p>
          </div>

          <p className="px-1 text-[10.5px] leading-relaxed text-ink/58">{result.basis}</p>

          <a href="https://sajuplan.com" className="flex items-center justify-center gap-1.5 rounded-card bg-primary-500/[0.07] py-3.5 text-[14px] font-semibold text-primary-600 ring-1 ring-primary-500/20 active:scale-[0.99]">
            내 사주, 더 깊은 풀이가 궁금하다면 →
          </a>
        </section>
      ) : (
        <p className="mt-2 text-center text-[12.5px] leading-relaxed text-ink/62">생년월일을 한 번만 입력하면 바로 운세가 나와요.</p>
      )}

      <p className="mt-6 text-center text-[11px] leading-relaxed text-ink/58">무료 운세는 재미·참고용이에요. 깊은 풀이는 전문 상담사와 함께하세요.</p>
    </main>
  );
}
