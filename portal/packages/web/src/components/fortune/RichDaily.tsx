import { ballColor } from "@portal/engine";
import { navigate } from "../../lib/nav.js";
import type { DailyFortune } from "../../lib/dailyEngine.js";

// 일진론 일일운세 풍성 렌더 — 만세 엔진 computeDailyFortune 결과를 네이트·사주아이급으로.
// 총운 롱폼 + 분야6(별점) + 시간대 길흉 + 할것/피할것 + 행운요소표 + 띠궁합 + 로또 + 시나리오·주의보·명언.

function Stars({ n }: { n: number }) {
  return (
    <span className="text-[12px] tracking-tight text-accent-500" aria-label={`${n}점`}>
      {"★★★★★".slice(0, n)}
      <span className="text-ink/20">{"★★★★★".slice(n)}</span>
    </span>
  );
}

const GRADE_COLOR: Record<string, string> = {
  "◎": "text-accent-500", "▲": "text-green-600", "◇": "text-ink/58", "▽": "text-ink/30",
};

// 오늘운세 총평 — 만세엔진 lines(불변)에 포털 측 종합·통찰 문단을 덧붙여 5→8문단으로.
// ⚠️ 만세엔진(d.total.lines) 0% 수정. 여기서 d의 기존 값만 읽어 서사 보강(단방향 원칙).
function totalLines(d: DailyFortune): string[] {
  const s = d.total.score;
  const extra = [
    s >= 80
      ? `오늘 전체 운세는 ${s}점, ${d.subjectLabel} 기준 상위 ${d.percentile}%로 손꼽히게 좋은 날이에요. 평소 망설이던 일에 한 걸음 내디뎌도 좋아요. 운의 바람이 등 뒤에서 밀어주는 하루거든요.`
      : s >= 60
        ? `오늘 전체 운세는 ${s}점, 큰 굴곡 없이 무난하게 흘러가는 하루예요. 욕심만 한 스푼 덜어내면 막힘없이 풀려가니, 평소 페이스를 지키며 차분히 하루를 채워보세요.`
        : `오늘 전체 운세는 ${s}점, 조금은 조심스러운 하루예요. 무리해서 밀어붙이기보다 컨디션을 살피고 한 박자 쉬어가면, 까다로운 기운도 무탈하게 지나갑니다.`,
    `오늘은 마음의 여유를 잃지 않는 게 무엇보다 중요해요. 작은 일에 일희일비하기보다 하루의 큰 흐름을 보면, 같은 하루도 훨씬 가볍고 단단하게 보낼 수 있어요. 좋은 기운은 곁의 사람과 나눌 때 더 커지니, 먼저 따뜻하게 다가가 보세요. (분야별 자세한 흐름은 아래에서 확인하세요.)`,
    `결국 운세는 오늘의 '날씨 예보'일 뿐이에요. 맑은 기운은 마음껏 누리고 흐린 기운은 우산을 챙기듯 대비하면, 오늘 하루를 온전히 당신 것으로 만들 수 있어요. 좋은 하루 보내세요 😊`,
  ];
  return [...d.total.lines, ...extra];
}

export default function RichDaily({ daily: d }: { daily: DailyFortune }) {
  return (
    <div className="space-y-3">
      {/* 오늘의 일진 헤더 */}
      <div className="rounded-card bg-white p-5 text-center shadow-card ring-1 ring-black/5">
        <p className="text-[12px] font-medium text-ink/62">
          {d.date.replace(/-/g, ".")} ({d.weekday}) · 오늘의 일진
        </p>
        <p className="mt-1 text-[20px] font-extrabold text-ink">
          {d.dayGanzhi} <span className="text-[13px] font-medium text-ink/62">{d.dayGanzhiKo}</span>
        </p>
        <p className="mt-2 text-[17px] font-bold text-accent-500">
          {d.titleEmoji} {d.title}
        </p>
        <p className="mt-1.5 text-[15.5px] font-semibold leading-relaxed text-ink">{d.oneLine}</p>
        <p className="mt-2 inline-block rounded-full bg-accent-50 px-3 py-1 text-[11.5px] font-semibold text-accent-500">
          {d.subjectLabel} · 상위 {d.percentile}%
        </p>
        <div className="mt-2.5 flex flex-wrap justify-center gap-1.5">
          {d.hashtags.map((t) => (
            <span key={t} className="text-[11.5px] font-medium text-primary-600">{t}</span>
          ))}
        </div>
      </div>

      {/* 종합운 (롱폼) */}
      <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
        <div className="flex items-center gap-3">
          <div className="flex h-[68px] w-[68px] shrink-0 flex-col items-center justify-center rounded-full bg-accent-500 text-white">
            <span className="text-[22px] font-extrabold leading-none">{d.total.score}</span>
            <span className="text-[10px] opacity-90">종합운</span>
          </div>
          <div>
            <p className="text-[17px] font-extrabold leading-tight text-ink">{d.total.headline}</p>
            <Stars n={d.total.stars} />
          </div>
        </div>
        <div className="mt-3 space-y-2">
          {totalLines(d).map((line, i) => (
            <p key={i} className={i === 0 ? "text-[14.5px] font-semibold leading-relaxed text-ink" : "text-[13.5px] leading-relaxed text-ink/88"}>{line}</p>
          ))}
        </div>
      </div>

      {/* 분야별 6 */}
      <div className="rounded-card bg-white p-4 shadow-card ring-1 ring-black/5">
        <p className="mb-1 px-1 text-[14px] font-bold text-ink">분야별 운세</p>
        <div className="divide-y divide-black/5">
          {d.fields.map((f) => (
            <div key={f.key} className="py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[13.5px] font-semibold text-ink">
                  {f.emoji} {f.label}
                </span>
                <span className="flex items-center gap-1.5">
                  <Stars n={f.stars} />
                  <span className="text-[12px] font-bold tabular-nums text-accent-500">{f.score}</span>
                </span>
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink/88">{f.comment}</p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-primary-600/80">💡 {f.tip}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 시간대별 길흉 */}
      <div className="rounded-card bg-white p-4 shadow-card ring-1 ring-black/5">
        <p className="mb-2.5 text-[14px] font-bold text-ink">시간대별 흐름</p>
        <div className="grid grid-cols-4 gap-1.5 text-center">
          {d.timeSlots.map((s) => (
            <div key={s.label} className="rounded-xl bg-canvas py-2 ring-1 ring-black/5">
              <p className="text-[11.5px] font-semibold text-ink/88">{s.label}</p>
              <p className="text-[9.5px] text-ink/58">{s.range}</p>
              <p className={`mt-1 text-[16px] font-bold ${GRADE_COLOR[s.mark] ?? "text-ink/58"}`}>{s.mark}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-center text-[10.5px] text-ink/58">◎ 최상 · ▲ 좋음 · ◇ 무난 · ▽ 주의</p>
      </div>

      {/* 오늘의 가이드 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-card bg-white p-4 shadow-card ring-1 ring-black/5">
          <p className="mb-2 text-[12.5px] font-semibold text-green-600">이렇게 하세요</p>
          <ul className="space-y-1.5">
            {d.guide.dos.map((s, i) => (
              <li key={i} className="text-[12px] leading-snug text-ink/88">· {s}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-card bg-white p-4 shadow-card ring-1 ring-black/5">
          <p className="mb-2 text-[12.5px] font-semibold text-accent-500">이건 피하세요</p>
          <ul className="space-y-1.5">
            {d.guide.donts.map((s, i) => (
              <li key={i} className="text-[12px] leading-snug text-ink/88">· {s}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* 행운 요소 표 */}
      <div className="rounded-card bg-white p-4 shadow-card ring-1 ring-black/5">
        <p className="mb-2.5 text-[14px] font-bold text-ink">오늘의 행운 요소</p>
        <div className="mb-3 flex items-center gap-2">
          <span className="w-14 shrink-0 text-[12px] text-ink/62">행운 숫자</span>
          <div className="flex gap-1.5">
            {d.luck.numbers.map((n) => (
              <span
                key={n}
                className="flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold text-white"
                style={{ backgroundColor: ballColor(n) }}
              >
                {n}
              </span>
            ))}
          </div>
        </div>
        <table className="w-full text-left text-[12.5px]">
          <tbody className="[&_td]:py-1 [&_th]:py-1 [&_th]:pr-3 [&_th]:font-medium [&_th]:text-ink/62">
            <tr><th scope="row">행운 색</th><td className="font-medium text-ink">{d.luck.color}</td></tr>
            <tr><th scope="row">행운 방향</th><td className="font-medium text-ink">{d.luck.direction}</td></tr>
            <tr><th scope="row">행운 시간</th><td className="font-medium text-ink">{d.luck.time}</td></tr>
            <tr><th scope="row">행운 아이템</th><td className="font-medium text-ink">{d.luck.item}</td></tr>
            <tr><th scope="row">행운 음식</th><td className="font-medium text-ink">{d.luck.food}</td></tr>
            <tr><th scope="row">맞는 성씨</th><td className="font-medium text-ink">{d.luckySurname.cons} <span className="text-ink/62">({d.luckySurname.examples})</span></td></tr>
          </tbody>
        </table>
      </div>

      {/* 띠 궁합 */}
      <div className="rounded-card bg-white p-4 shadow-card ring-1 ring-black/5">
        <p className="mb-2.5 text-[14px] font-bold text-ink">오늘 잘 맞는 띠 · 조심할 띠</p>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl bg-green-50 p-3 text-center ring-1 ring-green-200">
            <p className="text-[26px] leading-none">{d.zodiacMatch.best.emoji}</p>
            <p className="mt-1 text-[13px] font-bold text-green-700">{d.zodiacMatch.best.animal}띠</p>
            <p className="mt-0.5 text-[10.5px] leading-snug text-ink/70">{d.zodiacMatch.best.reason}</p>
          </div>
          <div className="rounded-xl bg-canvas p-3 text-center ring-1 ring-black/5">
            <p className="text-[26px] leading-none">{d.zodiacMatch.worst.emoji}</p>
            <p className="mt-1 text-[13px] font-bold text-ink/88">{d.zodiacMatch.worst.animal}띠</p>
            <p className="mt-0.5 text-[10.5px] leading-snug text-ink/70">{d.zodiacMatch.worst.reason}</p>
          </div>
        </div>
      </div>

      {/* 오늘의 로또 */}
      <div className="rounded-card bg-white p-4 shadow-card ring-1 ring-black/5">
        <div className="mb-2.5 flex items-center justify-between">
          <p className="text-[14px] font-bold text-ink">오늘의 행운번호</p>
          <a href="/lotto" onClick={(e) => { e.preventDefault(); navigate("/lotto"); }} className="text-[11.5px] font-semibold text-accent-500">운명번호 받기 →</a>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {d.lotto.map((n) => (
            <span
              key={n}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[14px] font-bold text-white"
              style={{ backgroundColor: ballColor(n) }}
            >
              {n}
            </span>
          ))}
        </div>
        <p className="mt-2 text-center text-[10px] leading-relaxed text-ink/35">
          재미·참고용 — 당첨을 보장하지 않습니다. 구매는 동행복권에서.
        </p>
      </div>

      {/* 시나리오 · 주의보 · 명언 */}
      <div className="space-y-2">
        <div className="rounded-card bg-accent-50 p-4 ring-1 ring-accent-400/20">
          <p className="text-[11.5px] font-semibold text-accent-500">오늘의 한 장면</p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink/88">{d.scenario}</p>
        </div>
        <div className="rounded-card bg-white p-4 shadow-card ring-1 ring-black/5">
          <p className="text-[11.5px] font-semibold text-ink/70">⚠️ 오늘의 주의보</p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink/88">{d.caution}</p>
        </div>
        <div className="rounded-card bg-primary-500/[0.05] p-4 ring-1 ring-primary-500/15">
          <p className="text-[13px] italic leading-relaxed text-primary-700">“{d.quote}”</p>
        </div>
      </div>

      <p className="px-1 text-[10.5px] leading-relaxed text-ink/58">{d.basis}</p>
    </div>
  );
}
