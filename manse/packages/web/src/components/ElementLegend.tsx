import { elementStyle } from "../lib/element.js";

// 오행 색상 범례 — 배경색이 무슨 기운인지 (원국·운의 흐름 공용)
export default function ElementLegend({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl bg-gray-50 px-3 py-2 text-xs ${className}`}>
      <span className="font-semibold text-gray-500">오행</span>
      {(["목", "화", "토", "금", "수"] as const).map((el) => {
        const s = elementStyle(el);
        return (
          <span key={el} className="flex items-center gap-1">
            <span className={`inline-block h-3.5 w-3.5 rounded ${s.bg} ring-1 ${s.ring}`} />
            <span className={`font-medium ${s.text}`}>{el}·{s.label}</span>
          </span>
        );
      })}
    </div>
  );
}
