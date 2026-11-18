interface Seg {
  label: string;
  percent: number;
  hex: string;
}

/** conic-gradient 도넛 차트 */
export default function Donut({ segments, centerTop, centerBottom, size = 120 }: {
  segments: Seg[];
  centerTop?: string;
  centerBottom?: string;
  size?: number;
}) {
  let acc = 0;
  const stops = segments
    .filter((s) => s.percent > 0)
    .map((s) => {
      const from = acc;
      acc += s.percent;
      return `${s.hex} ${from}% ${acc}%`;
    })
    .join(", ");
  const bg = stops ? `conic-gradient(${stops})` : "#e5e7eb";
  const hole = Math.round(size * 0.58);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className="h-full w-full rounded-full" style={{ background: bg }} />
      <div
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-white"
        style={{ width: hole, height: hole }}
      >
        {centerTop && <span className="text-base font-bold text-gray-800">{centerTop}</span>}
        {centerBottom && <span className="text-[11px] text-gray-400">{centerBottom}</span>}
      </div>
    </div>
  );
}
