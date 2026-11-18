interface ScoreBarProps {
  label: string;
  score: number;
  text: string;
}

// 분야별 운세 점수 막대 — 점수대별 색(높음=핑크, 중간=보라, 낮음=회색).
export default function ScoreBar({ label, score, text }: ScoreBarProps) {
  const color = score >= 80 ? "#ec4899" : score >= 60 ? "#8259F5" : "#9ca3af";
  return (
    <div className="py-2.5">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[13.5px] font-semibold text-ink">{label}</span>
        <span className="text-[13px] font-bold" style={{ color }}>
          {score}점
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-black/[0.06]">
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <p className="mt-1.5 text-[12.5px] leading-snug text-ink/70">{text}</p>
    </div>
  );
}
