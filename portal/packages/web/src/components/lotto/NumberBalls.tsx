import { ballColor } from "@portal/engine";

interface NumberBallsProps {
  numbers: number[];
  /** 등장 애니메이션 키 — 새로 생성할 때마다 바뀌면 다시 팝 */
  animKey?: string | number;
  /** 강조(당첨 등 일치) 번호 */
  highlight?: number[];
}

// 로또공 — 동행복권 관습 색 + 등장 애니메이션. 글자 가독 위해 진한 공은 흰 글씨.
export default function NumberBalls({ numbers, animKey, highlight }: NumberBallsProps) {
  const hi = new Set(highlight ?? []);
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {numbers.map((n, i) => {
        const dim = highlight ? !hi.has(n) : false;
        return (
          <span
            key={`${animKey}-${i}-${n}`}
            className="ball-pop flex h-12 w-12 items-center justify-center rounded-full text-[18px] font-bold text-white shadow-card"
            style={{
              backgroundColor: ballColor(n),
              animationDelay: `${i * 70}ms`,
              opacity: dim ? 0.32 : 1,
              outline: highlight && hi.has(n) ? "3px solid rgba(236,72,153,0.55)" : "none",
              outlineOffset: "2px",
            }}
          >
            {n}
          </span>
        );
      })}
    </div>
  );
}
