import type { ManseChart } from "@manse/engine";
import { elementStyle } from "../lib/element.js";
import Donut from "./Donut.js";
import Pentagon from "./Pentagon.js";
import DayCalendar from "./DayCalendar.js";
import DomainReadings from "./DomainReadings.js";
import { STEM_TRAIT, GYEOK_MEANING, SINSAL_MEANING, SINSAL_KIND, SIPSEONG_MEANING, SIPSEONG_GROUP_MEANING, elementComment } from "../lib/interpret.js";

// 십성 5그룹 정의
const GROUP_DEF: { name: string; members: string[] }[] = [
  { name: "비겁", members: ["비견", "겁재"] },
  { name: "식상", members: ["식신", "상관"] },
  { name: "재성", members: ["편재", "정재"] },
  { name: "관성", members: ["편관", "정관"] },
  { name: "인성", members: ["편인", "정인"] },
];

const LEVEL_COLOR: Record<string, string> = {
  과다: "text-rose-600",
  발달: "text-amber-600",
  적정: "text-emerald-600",
  부족: "text-gray-400",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
        <span className="h-3.5 w-1 rounded-full bg-accent-500" />{title}
      </h3>
      {children}
    </div>
  );
}

const STRENGTH_SCALE = ["극약", "태약", "신약", "중화신약", "중화신강", "신강", "태강", "극강"];

// 십성 → 도넛 색 (고정 팔레트)
const TENGOD_HEX: Record<string, string> = {
  비견: "#64748b", 겁재: "#475569", 식신: "#10b981", 상관: "#34d399",
  편재: "#f59e0b", 정재: "#fbbf24", 편관: "#f43f5e", 정관: "#fb7185",
  편인: "#8b5cf6", 정인: "#a78bfa",
};

export default function AnalysisView({ chart }: { chart: ManseChart }) {
  const { elements, tenGods, sinsal, strength, gyeokguk, hapchung, sinsal12 } = chart.analysis;
  const ys = elementStyle(strength.yongsin);
  const dominant = [...elements].sort((a, b) => b.percent - a.percent)[0];
  const PILLAR_KO2: Record<string, string> = { year: "년", month: "월", day: "일", hour: "시" };

  const dayKo = chart.pillars.day.stem.ko;
  const comments = elements
    .map((e) => ({ el: e.element, c: elementComment(e.element, e.level) }))
    .filter((x) => x.c);

  // 신강/신약 종형 곡선
  const bell = (x: number) => Math.exp(-((x - 0.5) ** 2) / (2 * 0.16 * 0.16));
  const curvePts = Array.from({ length: 61 }, (_, i) => {
    const x = i / 60;
    return `${(x * 300).toFixed(1)},${(62 - bell(x) * 48).toFixed(1)}`;
  }).join(" ");
  const cr = Math.min(1, Math.max(0, strength.ratio));
  const mx = cr * 300;
  const my = 62 - bell(cr) * 48;

  return (
    <div className="mt-4 space-y-4">
      {/* 해석 총평 */}
      <Section title="사주 풀이">
        <div className="space-y-2.5 text-sm leading-relaxed text-gray-600">
          <p>
            <b className="text-gray-800">일간 {chart.pillars.day.stem.hanja}({dayKo})</b> — {STEM_TRAIT[dayKo]}
          </p>
          <p>
            <b className="text-primary-600">{gyeokguk}</b> · {GYEOK_MEANING[gyeokguk] ?? "월지 기준 격국입니다."}
          </p>
          {comments.length > 0 && (
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="mb-1 text-xs font-medium text-gray-500">오행 균형 코멘트</p>
              {comments.map((x) => {
                const s = elementStyle(x.el);
                return (
                  <p key={x.el} className="text-xs text-gray-600">
                    <b className={s.text}>{x.el}</b> {x.c}
                  </p>
                );
              })}
            </div>
          )}
        </div>
      </Section>

      {/* 분야별 풀이 — 대중 핵심 */}
      <DomainReadings chart={chart} />

      {/* 격국 + 신강/신약 + 용신 */}
      <Section title="격국 · 신강 / 신약 · 용신">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-sm text-gray-500">격국</span>
          <span className="rounded-md bg-accent-50 px-2.5 py-1 text-sm font-bold text-accent-500 ring-1 ring-accent-400/30">{gyeokguk}</span>
        </div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-lg font-bold text-primary-600">{strength.label}</span>
          <span className="text-xs text-gray-400">강약 {Math.round(strength.ratio * 100)}% · 전체의 약 <b className="text-primary-500">{strength.bandPercent}%</b>가 이 구간 <span className="text-gray-300">(추정)</span></span>
        </div>
        {/* 강약 종형 곡선 그래프 */}
        <svg viewBox="0 0 300 72" className="w-full">
          <polyline points={curvePts} fill="none" stroke="#c7d2fe" strokeWidth="2" />
          <line x1={mx} y1={my} x2={mx} y2="64" stroke="#8259F5" strokeWidth="1.5" strokeDasharray="2 2" />
          <circle cx={mx} cy={my} r="5" fill="#8259F5" stroke="#fff" strokeWidth="2" />
          <text x={mx} y={my - 8} textAnchor="middle" fontSize="10" fontWeight="700" fill="#8259F5">나</text>
        </svg>
        <div className="flex justify-between text-[10px] text-gray-400">
          {STRENGTH_SCALE.map((s) => <span key={s}>{s}</span>)}
        </div>
        {/* 득령·득지·득세 */}
        <div className="mt-2 flex gap-2">
          {([["득령", strength.deukRyeong, "월지"], ["득지", strength.deukJi, "일지"], ["득세", strength.deukSe, "세력"]] as const).map(([name, ok, sub]) => (
            <div key={name} className={`flex-1 rounded-lg px-2 py-1.5 text-center text-xs ring-1 ${
              ok ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-gray-50 text-gray-400 ring-gray-200"
            }`}>
              <div className="font-semibold">{name} {ok ? "○" : "✕"}</div>
              <div className="text-[10px] opacity-70">{sub}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-2.5">
          <span className="text-sm text-gray-500">추천 용신(참고)</span>
          <span className={`rounded-md px-2 py-0.5 text-sm font-bold ${ys.bg} ${ys.text} ring-1 ${ys.ring}`}>
            {strength.yongsin}({ys.label})
          </span>
          <span className="text-xs text-gray-400">· {strength.yongsinReason}</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-gray-500">
          일간 <b className="text-gray-700">{chart.pillars.day.stem.hanja}({chart.pillars.day.stem.ko})</b> 는
          <b className="text-primary-600"> {strength.label}</b> 사주입니다 (강약 {Math.round(strength.ratio * 100)}%).
          기운이 균형을 이루려면 <b className={ys.text}>{strength.yongsin}</b> 의 힘이 도움이 됩니다.
        </p>
      </Section>

      {/* 오행 분포 — 도넛 + 막대 + 관계도 */}
      <Section title="오행 분포">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Donut
            size={120}
            centerTop={dominant?.element}
            centerBottom={dominant ? `${dominant.percent}%` : ""}
            segments={elements.map((e) => ({ label: e.element, percent: e.percent, hex: elementStyle(e.element).hex }))}
          />
          <div className="flex-1 space-y-2">
            {elements.map((e) => {
              const s = elementStyle(e.element);
              return (
                <div key={e.element} className="flex items-center gap-2">
                  <span className={`w-12 shrink-0 text-sm font-semibold ${s.text}`}>{e.element}({s.label})</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(3, e.percent)}%`, background: s.hex }} />
                  </div>
                  <span className="w-12 shrink-0 text-right text-xs text-gray-500">{e.percent}%</span>
                  <span className={`w-8 shrink-0 text-right text-xs font-medium ${LEVEL_COLOR[e.level]}`}>{e.level}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-4 border-t border-gray-100 pt-3">
          <p className="mb-1 text-center text-xs text-gray-400">오행 관계도 (상생 · 상극)</p>
          <Pentagon elements={elements} />
        </div>
      </Section>

      {/* 십성 분포 — 도넛 + 막대(10종 전부) + 5그룹 + 뜻풀이 */}
      <Section title="십성 분포">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Donut
            size={120}
            centerTop={[...tenGods].sort((a, b) => b.count - a.count)[0]?.tenGod}
            centerBottom="최다"
            segments={tenGods.filter((t) => t.percent > 0).map((t) => ({ label: t.tenGod, percent: t.percent, hex: TENGOD_HEX[t.tenGod] ?? "#9ca3af" }))}
          />
          <div className="flex-1 space-y-1.5">
            {tenGods.map((t) => {
              const hex = TENGOD_HEX[t.tenGod] ?? "#9ca3af";
              const zero = t.count === 0;
              return (
                <div key={t.tenGod} className={`flex items-center gap-2 ${zero ? "opacity-45" : ""}`}>
                  <span className="w-10 shrink-0 text-sm font-semibold" style={{ color: hex }}>{t.tenGod}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full" style={{ width: `${t.percent}%`, background: hex }} />
                  </div>
                  <span className="w-16 shrink-0 text-right text-xs text-gray-500">{t.count}개 · {t.percent}%</span>
                </div>
              );
            })}
          </div>
        </div>
        {/* 5그룹 요약 */}
        <div className="mt-4 grid grid-cols-5 gap-1.5 border-t border-gray-100 pt-3">
          {GROUP_DEF.map((g) => {
            const pct = Math.round(g.members.reduce((a, m) => a + (tenGods.find((t) => t.tenGod === m)?.percent ?? 0), 0) * 10) / 10;
            return (
              <div key={g.name} className="rounded-lg bg-gray-50 px-1 py-1.5 text-center ring-1 ring-gray-100">
                <div className="text-xs font-bold text-gray-700">{g.name}</div>
                <div className="text-[11px] font-medium text-primary-500">{pct}%</div>
                <div className="mt-0.5 text-[9px] leading-tight text-gray-400">{SIPSEONG_GROUP_MEANING[g.name]}</div>
              </div>
            );
          })}
        </div>
        {/* 십성 뜻풀이 — 보유한 십성 */}
        <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-3">
          {tenGods.filter((t) => t.count > 0).map((t) => (
            <p key={t.tenGod} className="text-xs leading-relaxed text-gray-500">
              <b style={{ color: TENGOD_HEX[t.tenGod] ?? "#374151" }}>{t.tenGod}</b> — {SIPSEONG_MEANING[t.tenGod]}
            </p>
          ))}
        </div>
      </Section>

      {/* 신살 · 길성 — 기둥별 표 */}
      <Section title="신살 · 길성">
        {sinsal.length === 0 ? (
          <p className="text-xs text-gray-400">해당 신살 없음</p>
        ) : (() => {
          const cols = [
            { key: "hour", label: "시", p: chart.pillars.hour },
            { key: "day", label: "일", p: chart.pillars.day },
            { key: "month", label: "월", p: chart.pillars.month },
            { key: "year", label: "년", p: chart.pillars.year },
          ].filter((c) => c.p);
          const uniq = [...new Set(sinsal.map((s) => s.name))];
          const isGil = (name: string) => SINSAL_KIND[name] !== "신살";
          const gilCount = uniq.filter(isGil).length;
          return (
            <>
              {/* 요약 칩 */}
              <div className="mb-3 flex flex-wrap gap-1.5">
                {uniq.map((name) => (
                  <span key={name} className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${isGil(name) ? "bg-violet-50 text-violet-600 ring-violet-300/50" : "bg-amber-50 text-amber-700 ring-amber-300/50"}`}>
                    {name}
                  </span>
                ))}
              </div>
              <p className="mb-2 text-xs text-gray-400">총 {uniq.length}개 · 길성 {gilCount} · 신살 {uniq.length - gilCount}</p>
              {/* 기둥별 표 */}
              <div className="overflow-x-auto rounded-xl ring-1 ring-gray-100">
                <table className="w-full border-collapse text-center">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-500">
                      <th className="w-9 py-2 font-medium"> </th>
                      {cols.map((c) => (
                        <th key={c.key} className={`py-2 font-semibold ${c.key === "day" ? "text-primary-600" : "text-gray-600"}`}>{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(["stem", "branch"] as const).map((row) => (
                      <tr key={row} className="border-t border-gray-100">
                        <td className="py-2 text-xs font-medium text-gray-400">{row === "stem" ? "천간" : "지지"}</td>
                        {cols.map((c) => {
                          const cell = row === "stem" ? c.p!.stem : c.p!.branch;
                          const es = elementStyle(cell.element);
                          return (
                            <td key={c.key} className="py-2">
                              <span className={`font-hanja text-lg font-extrabold ${es.text}`}>{cell.hanja}</span>
                              <span className="ml-0.5 text-xs text-gray-400">{cell.ko}·{cell.element}</span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    <tr className="border-t border-gray-100 align-top">
                      <td className="py-2 text-xs font-medium text-gray-400">신살</td>
                      {cols.map((c) => {
                        const list = sinsal.filter((s) => s.pillar === c.key);
                        return (
                          <td key={c.key} className="px-1 py-2">
                            {list.length === 0 ? (
                              <span className="text-xs text-gray-300">·</span>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                {list.map((s, i) => (
                                  <span key={i} className={`whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${isGil(s.name) ? "bg-violet-50 text-violet-600" : "bg-amber-50 text-amber-700"}`}>
                                    {s.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
              {/* 뜻풀이 */}
              <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-3">
                {uniq.map((name) => (
                  SINSAL_MEANING[name] && (
                    <p key={name} className="text-xs leading-relaxed text-gray-500">
                      <b className={isGil(name) ? "text-violet-600" : "text-amber-700"}>{name}</b>
                      <span className="text-gray-400"> · {SINSAL_KIND[name] ?? "신살"}</span> — {SINSAL_MEANING[name]}
                    </p>
                  )
                ))}
              </div>
            </>
          );
        })()}
      </Section>

      {/* 사주 관계 — 합·충 + 12신살 */}
      <Section title="사주 관계 (합·충 · 12신살)">
        <div className="mb-3">
          <p className="mb-1.5 text-xs font-medium text-gray-500">합 · 충</p>
          {hapchung.length === 0 ? (
            <p className="text-xs text-gray-400">두드러진 합·충 없음</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {hapchung.map((r, i) => {
                const caution = ["충", "형", "파", "해", "원진"].includes(r.type);
                return (
                  <span key={i} className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
                    caution ? "bg-rose-50 text-rose-600 ring-rose-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  }`}>
                    {r.detail}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-gray-500">12신살</p>
          <div className="flex flex-wrap gap-1.5">
            {sinsal12.map((s, i) => (
              <span key={i} className="rounded-lg bg-gray-50 px-2.5 py-1 text-xs text-gray-600 ring-1 ring-gray-100">
                <b className="text-gray-700">{PILLAR_KO2[s.pillar]}</b> {s.name}
              </span>
            ))}
          </div>
        </div>
      </Section>

      {/* 일진 달력 */}
      <DayCalendar />
    </div>
  );
}
