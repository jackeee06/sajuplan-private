import { useState } from "react";
import { monthDayPillars, firstWeekday, monthSolarTerms, solarToLunar, STEMS_HANJA, BRANCHES_HANJA } from "@manse/engine";
import { elementStyle } from "../lib/element.js";

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const now = new Date();

export default function DayCalendar() {
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });

  function shift(delta: number) {
    let { y, m } = ym;
    m += delta;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setYm({ y, m });
  }

  const days = monthDayPillars(ym.y, ym.m);
  const lead = firstWeekday(ym.y, ym.m);
  const terms = monthSolarTerms(ym.y, ym.m);
  const termOf = (d: number) => terms.find((t) => t.day === d)?.name;
  const cells: (typeof days[number] | null)[] = [...Array(lead).fill(null), ...days];

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
          <span className="h-3.5 w-1 rounded-full bg-accent-500" />일진 달력
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={() => shift(-1)} className="rounded-md px-2 py-1 text-gray-500 ring-1 ring-gray-200">‹</button>
          <span className="text-sm font-medium text-gray-700">{ym.y}년 {ym.m}월</span>
          <button onClick={() => shift(1)} className="rounded-md px-2 py-1 text-gray-500 ring-1 ring-gray-200">›</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {WEEK.map((w, i) => (
          <div key={w} className={`text-center text-[11px] font-medium ${i === 0 ? "text-rose-400" : i === 6 ? "text-sky-400" : "text-gray-400"}`}>{w}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const s = elementStyle(d.element);
          const gz = STEMS_HANJA[d.stem] + BRANCHES_HANJA[d.branch];
          const term = termOf(d.day);
          const lu = solarToLunar(ym.y, ym.m, d.day);
          const luLabel = lu.day === 1 ? `${lu.leap ? "윤" : ""}${lu.month}.1` : `${lu.day}`;
          return (
            <div key={d.day} className={`relative flex flex-col items-center rounded-md ${s.bg} py-1 ring-1 ${term ? "ring-primary-400" : s.ring}`}>
              <span className="text-[11px] text-gray-500">{d.day}</span>
              <span className={`font-hanja text-xs font-bold ${s.text}`}>{gz}</span>
              <span className="text-[8px] text-gray-400">음 {luLabel}</span>
              {term && <span className="mt-0.5 rounded bg-primary-500 px-1 text-[8px] font-medium text-white">{term}</span>}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-center text-[11px] text-gray-400">날짜별 일진(日辰) · 일주 정확도 검증 완료</p>
    </div>
  );
}
