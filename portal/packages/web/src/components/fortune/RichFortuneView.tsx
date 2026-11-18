import { useMemo, useState } from "react";
import { starOfDate } from "@portal/engine";
import { useProfile } from "../../lib/useProfile.js";
import MyInfoBar from "../MyInfoBar.js";
import { buildNatalDaily, buildZodiacDaily, yearBranchOf, targetDate, type DailyBundle } from "../../lib/dailyEngine.js";
import NatalChart from "./NatalChart.js";
import RichDaily from "./RichDaily.js";

// 오늘의 운세(정밀 명식+일진론) / 별자리(개인화 일진+별자리 배지) / 띠별(일진론) — 만세 엔진 결합 리치.
// 입력은 공통 MyInfoBar(접힘 카드)로 통일. 페이지는 결과만 렌더.
type Mode = "today" | "zodiac" | "star";

const CTA: Record<Mode, string> = {
  today: "생년월일 넣고 오늘의 운세 받기",
  zodiac: "생년월일 넣고 띠별 운세 받기",
  star: "생년월일 넣고 별자리 운세 받기",
};

export default function RichFortuneView({ mode }: { mode: Mode }) {
  const profile = useProfile();
  const isToday = mode === "today";
  const isStar = mode === "star";
  const isZodiac = mode === "zodiac";
  const [period, setPeriod] = useState<0 | 1>(0);

  const bundle: DailyBundle | null = useMemo(() => {
    if (!profile?.birth) return null;
    if (isZodiac) return buildZodiacDaily(yearBranchOf(Number(profile.birth.slice(0, 4))), targetDate(period));
    return buildNatalDaily(profile, targetDate(period), isToday);
  }, [profile, period, isToday, isZodiac]);

  const sign = isStar && profile?.birth ? starOfDate(+profile.birth.slice(5, 7), +profile.birth.slice(8, 10)) : null;

  return (
    <main className="px-4 pb-16 pt-3">
      <MyInfoBar showSaju={isToday} ctaLabel={CTA[mode]} />

      {/* 기간 칩 (오늘/내일) */}
      {bundle && (
        <div className="mb-3 flex gap-2">
          {([[0, "오늘"], [1, "내일"]] as const).map(([off, label]) => (
            <button
              key={off}
              type="button"
              onClick={() => setPeriod(off)}
              className={["rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition", period === off ? "bg-accent-500 text-white" : "bg-canvas text-ink/70 ring-1 ring-black/5"].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {bundle ? (
        <section className="space-y-3">
          {/* 별자리 배지 */}
          {isStar && sign && (
            <div className="flex items-center gap-3 rounded-card bg-primary-500/[0.06] px-4 py-3 ring-1 ring-primary-500/15">
              <span className="text-[30px] leading-none">{sign.emoji}</span>
              <div>
                <p className="text-[15px] font-bold text-primary-700">{sign.name}</p>
                <p className="text-[11.5px] text-ink/66">{sign.range} · 당신의 별자리</p>
              </div>
            </div>
          )}

          {/* 일진론 풀이(공통) */}
          <RichDaily daily={bundle.daily} />

          {/* 정밀 명식(오늘운세만) */}
          {isToday && bundle.chart && <NatalChart chart={bundle.chart} />}

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
