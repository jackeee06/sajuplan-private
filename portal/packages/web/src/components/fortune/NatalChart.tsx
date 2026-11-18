import type { ManseChart } from "../../lib/dailyEngine.js";

// 정밀 사주 명식 — 만세 엔진 결과(ManseChart)를 네이트·사주아이급으로 렌더.
// 8글자 명식(오행 색) + 십성 + 지장간 + 12운성 + 오행분포 + 일주강약 + 대운 + 신살.
// 오행 색은 "의미색"이라 빨강 사용 OK(이름 아님). 그라데이션 금지 = 솔리드 단색.

type El = string; // "목"|"화"|"토"|"금"|"수"

const EL_BG: Record<string, string> = {
  목: "#16a34a", 화: "#dc2626", 토: "#d97706", 금: "#9ca3af", 수: "#1f2937",
};
const EL_FG: Record<string, string> = {
  목: "#fff", 화: "#fff", 토: "#fff", 금: "#fff", 수: "#fff",
};
const EL_BAR: Record<string, string> = {
  목: "#22c55e", 화: "#ef4444", 토: "#f59e0b", 금: "#9ca3af", 수: "#3b82f6",
};
const EL_ORDER = ["목", "화", "토", "금", "수"];

function cell(hanja: string, ko: string, el: El, sub?: string) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg py-2"
      style={{ backgroundColor: EL_BG[el] ?? "#6b7280", color: EL_FG[el] ?? "#fff" }}
    >
      <span className="text-[24px] font-bold leading-none">{hanja}</span>
      <span className="mt-0.5 text-[10px] opacity-90">
        {ko}
        {sub ? ` ${sub}` : ""}
      </span>
    </div>
  );
}

export default function NatalChart({ chart }: { chart: ManseChart }) {
  const p = chart.pillars;
  // 표시 순서: 시 · 일 · 월 · 년 (전통 우→좌를 좌→우 컬럼으로)
  const cols = [
    { label: "시주", pil: p.hour },
    { label: "일주", pil: p.day },
    { label: "월주", pil: p.month },
    { label: "년주", pil: p.year },
  ];
  const els = EL_ORDER.map((el) => chart.analysis.elements.find((e) => e.element === el) ?? { element: el, count: 0, percent: 0, level: "", role: "" });
  const st = chart.analysis.strength;
  const dw = chart.daewoon;

  return (
    <div className="space-y-3">
      {/* 8글자 명식 */}
      <div className="rounded-card bg-white p-4 shadow-card ring-1 ring-black/5">
        <p className="mb-2.5 text-[14px] font-bold text-ink">나의 사주 명식</p>
        <div className="grid grid-cols-4 gap-1.5 text-center">
          {cols.map((c) => (
            <p key={c.label} className="text-[11px] font-medium text-ink/62">{c.label}</p>
          ))}
          {cols.map((c) => (
            <p key={c.label + "tg"} className="text-[10.5px] font-semibold text-accent-500">
              {c.pil ? c.pil.stemTenGod : "—"}
            </p>
          ))}
          {cols.map((c) =>
            c.pil ? (
              <div key={c.label + "s"}>{cell(c.pil.stem.hanja, c.pil.stem.ko, c.pil.stem.element)}</div>
            ) : (
              <div key={c.label + "s"} className="flex items-center justify-center rounded-lg bg-canvas py-2 text-[10px] text-ink/35 ring-1 ring-black/5">시간<br />모름</div>
            ),
          )}
          {cols.map((c) =>
            c.pil ? (
              <div key={c.label + "b"}>{cell(c.pil.branch.hanja, c.pil.branch.ko, c.pil.branch.element)}</div>
            ) : (
              <div key={c.label + "b"} />
            ),
          )}
          {cols.map((c) => (
            <p key={c.label + "btg"} className="text-[10.5px] font-medium text-ink/74">
              {c.pil ? c.pil.branchTenGod : ""}
            </p>
          ))}
          {cols.map((c) => (
            <p key={c.label + "hd"} className="text-[9.5px] leading-tight text-ink/58">
              {c.pil ? c.pil.hiddenStems.map((h) => h.ko).join("") : ""}
            </p>
          ))}
          {cols.map((c) => (
            <p key={c.label + "st"} className="text-[9.5px] text-ink/58">
              {c.pil ? c.pil.twelveStage : ""}
            </p>
          ))}
        </div>
        <p className="mt-2 text-center text-[10.5px] text-ink/58">
          격국 {chart.analysis.gyeokguk} · 공망 {chart.gongmang.join("·") || "없음"}
        </p>
      </div>

      {/* 오행 분포 + 일주 강약 */}
      <div className="rounded-card bg-white p-4 shadow-card ring-1 ring-black/5">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[14px] font-bold text-ink">오행 분포</p>
          <p className="text-[11.5px] font-medium text-ink/70">
            일간 강약 <span className="font-bold text-accent-500">{st.label}</span> ({st.bandPercent}%)
          </p>
        </div>
        <div className="space-y-1.5">
          {els.map((e) => (
            <div key={e.element} className="flex items-center gap-2">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[12px] font-bold"
                style={{ backgroundColor: EL_BG[e.element], color: "#fff" }}
              >
                {e.element}
              </span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-canvas">
                <div className="h-full rounded-full" style={{ width: `${e.percent}%`, backgroundColor: EL_BAR[e.element] }} />
              </div>
              <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-ink/70">{e.percent}%</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10.5px] text-ink/58">필요한 기운(용신) <span className="font-semibold text-ink/74">{st.yongsin}</span> — {st.yongsinReason}</p>
      </div>

      {/* 대운 (10년 단위) */}
      <div className="rounded-card bg-white p-4 shadow-card ring-1 ring-black/5">
        <p className="mb-2 text-[14px] font-bold text-ink">
          대운 <span className="text-[11px] font-normal text-ink/62">({dw.directionKo} · {dw.startAge}세 시작)</span>
        </p>
        <div className="-mx-1 overflow-x-auto px-1">
          <div className="flex gap-1.5">
            {dw.list.slice(0, 9).map((d) => (
              <div key={d.age} className="flex w-[52px] shrink-0 flex-col items-center">
                <span className="text-[10.5px] font-medium text-ink/62">{d.age}세</span>
                <div className="my-1 w-full">{cellMini(d.ganzhiKo, d.element)}</div>
                <span className="text-[9px] leading-tight text-ink/58">{d.stemTenGod}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 신살 */}
      {chart.analysis.sinsal.length > 0 && (
        <div className="rounded-card bg-white p-4 shadow-card ring-1 ring-black/5">
          <p className="mb-2 text-[14px] font-bold text-ink">신살</p>
          <div className="flex flex-wrap gap-1.5">
            {chart.analysis.sinsal.map((s, i) => (
              <span key={i} className="rounded-full bg-primary-500/[0.08] px-2.5 py-1 text-[11.5px] font-medium text-primary-600 ring-1 ring-primary-500/15">
                {s.name}
                <span className="ml-1 text-[10px] text-primary-600/55">{s.pillar}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function cellMini(ko: string, el: El) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-md py-1.5 text-center"
      style={{ backgroundColor: EL_BG[el] ?? "#6b7280", color: "#fff" }}
    >
      {ko.split("").map((ch, i) => (
        <span key={i} className="text-[13px] font-bold leading-tight">{ch}</span>
      ))}
    </div>
  );
}
