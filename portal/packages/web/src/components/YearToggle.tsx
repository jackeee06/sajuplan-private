// 연도 토글 — 올해/내년 선택(토정비결·신년운세 공용). 연말(11~2월)엔 내년이 기본.
export function defaultYear(): number {
  const now = new Date();
  const m = now.getMonth() + 1;
  return m >= 11 || m <= 2 ? now.getFullYear() + 1 : now.getFullYear();
}

export default function YearToggle({ year, onChange }: { year: number; onChange: (y: number) => void }) {
  const cur = new Date().getFullYear();
  const opts = [cur, cur + 1];
  return (
    <div className="mb-3 flex justify-center gap-1.5">
      {opts.map((y) => {
        const active = y === year;
        const isNext = y === cur + 1;
        return (
          <button
            key={y}
            type="button"
            onClick={() => onChange(y)}
            className={["rounded-full px-4 py-1.5 text-[12.5px] font-semibold ring-1 transition active:scale-95", active ? "bg-accent-500 text-white ring-accent-500" : "bg-white text-ink/70 ring-black/10"].join(" ")}
          >
            {y}년 {isNext ? "🎊 내년" : "올해"}
          </button>
        );
      })}
    </div>
  );
}
