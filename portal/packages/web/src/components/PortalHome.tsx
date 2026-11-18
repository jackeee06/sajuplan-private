import { useMemo } from "react";
import { TOPICS, type Topic } from "../data/topics.js";
import TopicTile from "./TopicTile.js";
import MyInfoBar from "./MyInfoBar.js";
import { recordVisit } from "../lib/streak.js";
import { buildCookie } from "../lib/cookieEngine.js";
import { todayKey } from "../lib/dateKey.js";
import { loadProfile } from "../lib/profile.js";

interface PortalHomeProps {
  onOpen: (topic: Topic) => void;
}

// 포털 홈 — "로그인 한 번에 운세의 바다". 모바일 우선 2열 타일 그리드. 만세력 톤(핑크 전면 + 브랜드 서명).
export default function PortalHome({ onOpen }: PortalHomeProps) {
  // 데일리 루프 — 방문 스트릭 + 오늘의 한 줄(날짜 시드 결정론, 하루종일 동일)
  const streak = useMemo(() => recordVisit(), []);
  const todayLine = useMemo(() => buildCookie(todayKey(), loadProfile()?.name ?? "").message, []);

  return (
    <main className="px-4 pb-10 pt-3">
      {/* 인사 영역 — 한 줄, 모바일 공간 절약 */}
      <section className="mb-3 mt-0.5">
        <p className="text-[12.5px] font-bold text-accent-500">사주플랜 무료 운세</p>
        <h2 className="mt-1 text-[18px] font-extrabold leading-snug tracking-[-0.02em] text-ink">
          오늘은 어떤 운이 기다리고 <span className="text-accent-500">있을까요?</span>
        </h2>
      </section>

      {/* 데일리 카드 — 오늘의 한 줄 + 방문 스트릭(매일 다시 오게) */}
      <section className="mb-3 rounded-card bg-accent-500 p-4 text-white shadow-card">
        <div className="flex items-center justify-between">
          <p className="text-[11.5px] font-semibold opacity-90">🔮 오늘의 한 줄</p>
          <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold">🔥 {streak.count}일째 방문</span>
        </div>
        <p className="mt-1.5 text-[14px] font-bold leading-relaxed">{todayLine}</p>
        {streak.best > streak.count && <p className="mt-1 text-[10.5px] opacity-80">최고 기록 {streak.best}일 · 매일 오면 갱신돼요</p>}
      </section>

      {/* 내 정보 — 한 번 입력하면 모든 운세 자동 적용 (공통 부품) */}
      <MyInfoBar showSaju />

      {/* 타일 그리드 */}
      <section className="grid grid-cols-2 gap-2.5">
        {TOPICS.map((t) => (
          <TopicTile key={t.id} topic={t} onOpen={onOpen} />
        ))}
      </section>

      {/* 안내 + 브랜드 서명 */}
      <p className="mt-5 text-center text-[11.5px] leading-relaxed text-ink/58">
        무료 운세는 재미·참고용이에요. 더 깊은 풀이는 전문 상담사와 함께하세요.
      </p>
      <footer className="mt-4 text-center text-[12px] font-medium text-ink/30">powered by 사주플랜</footer>
    </main>
  );
}
