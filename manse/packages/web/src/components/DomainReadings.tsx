import type { ManseChart } from "@manse/engine";
import { domainReadings } from "../lib/domains.js";

// **굵게** 간단 렌더
function rich(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <b key={i} className="text-gray-800">{part.slice(2, -2)}</b>
      : <span key={i}>{part}</span>,
  );
}

export default function DomainReadings({ chart }: { chart: ManseChart }) {
  const readings = domainReadings(chart);
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
        <span className="h-3.5 w-1 rounded-full bg-accent-500" />분야별 풀이
      </h3>
      <p className="mb-3 text-[11px] text-gray-400">직업·애정·재물·건강 — 내 사주가 말하는 것 (참고용)</p>
      <div className="space-y-3">
        {readings.map((r) => (
          <div key={r.key} className="rounded-xl bg-gray-50 p-4 ring-1 ring-gray-100">
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className="text-lg">{r.icon}</span>
              <span className="text-sm font-bold text-primary-600">{r.title}</span>
            </div>
            <p className="text-[13px] leading-relaxed text-gray-600">{rich(r.text)}</p>
            <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs text-gray-500 ring-1 ring-gray-100">
              <span className="font-semibold text-accent-500">조언</span>
              <span>{r.tip}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
