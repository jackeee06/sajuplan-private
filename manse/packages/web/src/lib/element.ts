// 오행 → 색상 토큰 (전통 오방색 기반)
export interface ElementStyle {
  text: string;
  bg: string;
  ring: string;
  label: string;
  hex: string; // 차트/SVG 용
}

const MAP: Record<string, ElementStyle> = {
  목: { text: "text-emerald-700", bg: "bg-emerald-50", ring: "ring-emerald-200", label: "나무", hex: "#10b981" },
  화: { text: "text-rose-700", bg: "bg-rose-50", ring: "ring-rose-200", label: "불", hex: "#f43f5e" },
  토: { text: "text-amber-700", bg: "bg-amber-50", ring: "ring-amber-200", label: "흙", hex: "#f59e0b" },
  금: { text: "text-slate-700", bg: "bg-slate-100", ring: "ring-slate-300", label: "쇠", hex: "#94a3b8" },
  수: { text: "text-sky-700", bg: "bg-sky-50", ring: "ring-sky-200", label: "물", hex: "#0ea5e9" },
};

export function elementStyle(el: string): ElementStyle {
  return MAP[el] ?? { text: "text-gray-700", bg: "bg-gray-50", ring: "ring-gray-200", label: el, hex: "#9ca3af" };
}
