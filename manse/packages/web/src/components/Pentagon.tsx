import { elementStyle } from "../lib/element.js";

// 오행 관계도 — 상생(둘레, 초록 화살표) + 상극(별, 빨강 화살표). 둘 다 방향성 있음.
// 노드 순서 = 목·화·토·금·수 (상생 순서). 상생 i→i+1, 상극 i→i+2.
const ORDER = ["목", "화", "토", "금", "수"];

export default function Pentagon({ elements }: { elements: { element: string; percent: number; role?: string }[] }) {
  const S = 250;
  const c = S / 2;
  const R = 86;
  const find = (el: string) => elements.find((e) => e.element === el);
  const pct = (el: string) => find(el)?.percent ?? 0;
  const role = (el: string) => find(el)?.role ?? "";

  const pts = ORDER.map((_, i) => {
    const a = (-90 + i * 72) * (Math.PI / 180);
    return { x: c + R * Math.cos(a), y: c + R * Math.sin(a) };
  });

  // 노드 가장자리에서 끊고 화살촉이 보이게 양끝을 줄임
  const arrow = (i: number, j: number, color: string, w: number, marker: string) => {
    const a = pts[i]!, b = pts[j]!;
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
    const ux = dx / L, uy = dy / L, pad = 31;
    return (
      <line key={`${marker}-${i}-${j}`}
        x1={a.x + ux * pad} y1={a.y + uy * pad}
        x2={b.x - ux * pad} y2={b.y - uy * pad}
        stroke={color} strokeWidth={w} opacity={0.65} markerEnd={`url(#${marker})`} />
    );
  };

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${S} ${S}`} className="h-[21rem] w-[21rem] max-w-full">
        <defs>
          <marker id="arr-saeng" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="#10b981" />
          </marker>
          <marker id="arr-geuk" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="#f43f5e" />
          </marker>
        </defs>
        {/* 상극(별, 빨강 화살표) */}
        {ORDER.map((_, i) => arrow(i, (i + 2) % 5, "#f43f5e", 1.5, "arr-geuk"))}
        {/* 상생(둘레, 초록 화살표) */}
        {ORDER.map((_, i) => arrow(i, (i + 1) % 5, "#10b981", 2.5, "arr-saeng"))}
        {/* 노드 */}
        {ORDER.map((el, i) => {
          const s = elementStyle(el);
          return (
            <g key={el}>
              <circle cx={pts[i]!.x} cy={pts[i]!.y} r={28} fill={`${s.hex}1f`} stroke={s.hex} strokeWidth={2.5} />
              <text x={pts[i]!.x} y={pts[i]!.y - 6} textAnchor="middle" fontSize="13" fontWeight="700" fill={s.hex}>{el}</text>
              <text x={pts[i]!.x} y={pts[i]!.y + 6} textAnchor="middle" fontSize="9" fill="#9ca3af">{role(el)}</text>
              <text x={pts[i]!.x} y={pts[i]!.y + 17} textAnchor="middle" fontSize="10" fontWeight="600" fill="#6b7280">{pct(el)}%</text>
            </g>
          );
        })}
      </svg>
      <div className="flex gap-3 text-[11px] text-gray-500">
        <span className="flex items-center gap-1"><span className="inline-block h-1 w-4 rounded bg-emerald-500" />상생(낳음 →)</span>
        <span className="flex items-center gap-1"><span className="inline-block h-1 w-4 rounded bg-rose-500" />상극(이김 →)</span>
      </div>
    </div>
  );
}
