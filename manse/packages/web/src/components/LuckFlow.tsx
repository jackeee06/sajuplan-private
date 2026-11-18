import { useMemo, useState } from "react";
import { yearLuck, monthLuck, type ManseChart } from "@manse/engine";
import { elementStyle } from "../lib/element.js";
import ElementLegend from "./ElementLegend.js";

// 운의 흐름 — 대운(10년) → 연운(그 10년의 해) → 월운(그 해 12개월) 드릴다운
// 시간 흐름: 왼쪽(이른 나이/연도) → 오른쪽(늦은). 줄바꿈으로 전부 표시(스와이프 불필요).

// 한자 + 한글 음 (포스텔러식 루비) — 한자 모르는 사람도 읽게
function CharR({ hanja, ko, color }: { hanja: string; ko: string; color: string }) {
  return (
    <span className="flex items-baseline gap-0.5 leading-none">
      <span className={`font-hanja text-base font-extrabold ${color}`}>{hanja}</span>
      <span className={`text-[14px] font-semibold ${color}`}>{ko}</span>
    </span>
  );
}

type CardProps = {
  top: string; ganzhi: string; ganzhiKo: string; stemTG: string; branchTG: string;
  element: string; selected?: boolean; onClick?: () => void; w?: string;
};
function LuckCard({ top, ganzhi, ganzhiKo, stemTG, branchTG, element, selected, onClick, w = "min-w-[56px]" }: CardProps) {
  const s = elementStyle(element);
  return (
    <button
      onClick={onClick}
      className={`flex ${w} shrink-0 flex-col items-center gap-0.5 rounded-lg ${s.bg} px-1.5 py-1.5 transition ${
        selected ? "ring-[3px] ring-accent-500 shadow-md" : `ring-1 ${s.ring}`
      } ${onClick ? "cursor-pointer hover:ring-accent-300" : ""}`}
    >
      <span className={`text-[11px] ${selected ? "font-bold text-accent-500" : "text-gray-400"}`}>{top}</span>
      <span className="text-[10px] text-rose-400">{stemTG}</span>
      <CharR hanja={ganzhi[0]!} ko={ganzhiKo[0]!} color={s.text} />
      <CharR hanja={ganzhi[1]!} ko={ganzhiKo[1]!} color={s.text} />
      <span className="text-[10px] text-gray-500">{branchTG}</span>
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-gray-600">
        <span className="h-3.5 w-1 rounded-full bg-accent-500" />{label}
      </div>
      {/* 줄바꿈(flex-wrap) — 전부 한눈에. py-1 로 ring 여백 */}
      <div className="flex flex-wrap gap-1.5 py-1">{children}</div>
    </div>
  );
}

export default function LuckFlow({ chart }: { chart: ManseChart }) {
  const { daewoon, dayStemIndex, birthYear } = chart;
  // 현재 나이(브라우저 시계) — 기본 선택 대운/연도 결정
  const curYear = new Date().getFullYear();
  const curAge = curYear - birthYear;

  // 각 대운의 시작연도 = 출생연도 + 시작나이
  const blocks = daewoon.list.map((d) => ({ ...d, startYear: birthYear + d.age }));
  const defaultAge = blocks.find((b) => curAge >= b.age && curAge < b.age + 10)?.age ?? blocks[0]!.age;

  const [selAge, setSelAge] = useState(defaultAge);
  const sel = blocks.find((b) => b.age === selAge)!;

  const years = useMemo(() => yearLuck(dayStemIndex, sel.startYear, 10), [dayStemIndex, sel.startYear]);
  const defaultYear = years.find((y) => y.year === curYear)?.year ?? years[0]!.year;
  const [selYear, setSelYear] = useState(defaultYear);
  // 대운 바뀌면 연도 기본값 재설정
  const selYearSafe = years.some((y) => y.year === selYear) ? selYear : defaultYear;
  const months = useMemo(() => monthLuck(dayStemIndex, selYearSafe), [dayStemIndex, selYearSafe]);

  return (
    <div className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      {/* 경로 표시 */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
        <span className="rounded-full bg-accent-50 px-2.5 py-1 font-medium text-accent-500">
          대운 {sel.ganzhi} <span className="text-accent-400">({sel.age}~{sel.age + 9}세)</span>
        </span>
        <span className="text-gray-300">›</span>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-600">{selYearSafe}년</span>
        <span className="ml-1 text-gray-400">대운을 누르면 연운이, 연운을 누르면 월운이 바뀝니다</span>
      </div>

      {/* 대운 */}
      <Row label={`대운 (${daewoon.directionKo} · 시작 ${daewoon.startAge}세)`}>
        {blocks.map((d) => (
          <LuckCard
            key={d.age} top={`${d.age}세`} ganzhi={d.ganzhi} ganzhiKo={d.ganzhiKo} stemTG={d.stemTenGod} branchTG={d.branchTenGod}
            element={d.element} selected={d.age === selAge} onClick={() => setSelAge(d.age)}
          />
        ))}
      </Row>

      {/* 연운 — 선택 대운의 10년 */}
      <Row label="연운 (선택 대운의 10년)">
        {years.map((y) => (
          <LuckCard
            key={y.year} top={`${y.year}`} ganzhi={y.ganzhi} ganzhiKo={y.ganzhiKo} stemTG={y.stemTenGod} branchTG={y.branchTenGod}
            element={y.element} selected={y.year === selYearSafe} onClick={() => setSelYear(y.year)}
          />
        ))}
      </Row>

      {/* 월운 — 선택 연도의 12개월 */}
      <Row label={`월운 (${selYearSafe}년 12개월)`}>
        {months.map((m) => (
          <LuckCard
            key={m.monthLabel} top={m.monthLabel} ganzhi={m.ganzhi} ganzhiKo={m.ganzhiKo} stemTG={m.stemTenGod} branchTG={m.branchTenGod}
            element={m.element}
          />
        ))}
      </Row>

      {/* 오행 범례 — 색 의미를 이 자리에서도 바로 확인 */}
      <ElementLegend />
    </div>
  );
}
