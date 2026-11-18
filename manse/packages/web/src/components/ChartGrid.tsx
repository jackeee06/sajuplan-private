import { useState, type ReactNode } from "react";
import type { ManseChart, PillarOut } from "@manse/engine";
import { elementStyle } from "../lib/element.js";
import ElementLegend from "./ElementLegend.js";

type CellState = "normal" | "emph" | "dim";

// "2026-07-07T10:49" → "7/7 10:49" (입절 시각 짧게)
function fmtTermAt(iso: string): string {
  const m = /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return "";
  return `${+m[2]!}/${+m[3]!} ${m[4]}:${m[5]}`;
}

function Char({ hanja, ko, element, big, voidMark, state = "normal" }: {
  hanja: string; ko: string; element: string; big?: boolean; voidMark?: boolean; state?: CellState;
}) {
  const s = elementStyle(element);
  const ring = state === "emph"
    ? "ring-[3px] ring-accent-500 shadow-md"
    : voidMark ? "ring-2 ring-accent-400" : `ring-1 ${s.ring}`;
  return (
    <div className={`relative flex flex-col items-center justify-center rounded-xl ${s.bg} ${big ? "h-20 w-full" : "h-16 w-full"} ${ring} ${state === "dim" ? "opacity-30" : ""} transition`}>
      {voidMark && (
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent-500 text-[10px] font-bold text-white shadow-sm">공</span>
      )}
      <span className={`font-hanja ${big ? "text-4xl" : "text-3xl"} font-black leading-none ${s.text}`}>{hanja}</span>
      <span className={`mt-1 text-xs ${s.text}`}>{ko}·{element}</span>
    </div>
  );
}

// 궁성(시기) + 인연 — 각 기둥이 가리키는 인생 시기·관계 (원국에 직접 표기)
const PALACE: Record<string, { age: string; who: string }> = {
  시주: { age: "말년운", who: "자녀·결실" },
  일주: { age: "중년운", who: "자아·배우자" },
  월주: { age: "청년운", who: "부모·사회" },
  년주: { age: "초년운", who: "조상·뿌리" },
};

function PillarColumn({ label, p, isDay, gongmang, stemState, branchState }: {
  label: string; p: PillarOut; isDay?: boolean; gongmang: string[];
  stemState: CellState; branchState: CellState;
}) {
  const branchVoid = gongmang.includes(p.branch.hanja);
  const palace = PALACE[label];
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <div className={`flex h-6 items-center justify-center text-sm font-semibold ${isDay ? "text-primary-600" : "text-gray-500"}`}>
        {label}{isDay && " (일원)"}
      </div>
      <div className="flex h-5 items-center justify-center text-xs font-medium text-accent-500">{palace?.age ?? "-"}</div>
      <div className="flex h-5 items-center justify-center text-xs text-gray-600">{palace?.who ?? "-"}</div>
      <Char hanja={p.stem.hanja} ko={p.stem.ko} element={p.stem.element} big state={stemState} />
      <div className="h-5 text-center text-sm font-medium text-rose-500">{p.stemTenGod}</div>
      <Char hanja={p.branch.hanja} ko={p.branch.ko} element={p.branch.element} big voidMark={branchVoid} state={branchState} />
      <div className="h-5 text-center text-sm font-medium text-rose-500">{p.branchTenGod}</div>
      <div className="font-hanja text-center text-xs font-semibold leading-tight text-gray-700">
        {p.hiddenStems.map((h) => h.hanja).join(" ")}
      </div>
      <div className="text-center text-xs font-medium text-gray-700">{p.twelveStage}<span className="text-gray-500">({p.selfStage})</span></div>
    </div>
  );
}

// 왼쪽 행 라벨 — 궁성·의미 포함 (아래 별도 표를 흡수)
function LabelColumn() {
  const c = "flex items-center justify-center rounded-md bg-gray-100 text-xs font-semibold text-gray-600";
  return (
    <div className="flex w-11 shrink-0 flex-col gap-1.5">
      <div className="h-6" />
      <div className={`${c} h-5 !text-xs`}>궁성</div>
      <div className={`${c} h-5 !text-xs`}>의미</div>
      <div className={`${c} h-20`}>천간</div>
      <div className={`${c} h-5 !text-xs`}>십성</div>
      <div className={`${c} h-20`}>지지</div>
      <div className={`${c} h-5 !text-xs`}>십성</div>
      <div className={`${c} py-0.5 !text-xs`}>지장간</div>
      <div className={`${c} py-0.5 !text-xs`}>운성</div>
    </div>
  );
}

// 원국 위 "표시 모드" 탭 — 누르면 해당 관계를 원국에서 강조
type TabDef = { tab: string; type: string | null; desc: string };
const TABS: TabDef[] = [
  { tab: "궁성", type: null, desc: "네 기둥은 각각 인생의 시기와 인연을 나타냅니다." },
  { tab: "천간합", type: "천간합", desc: "천간이 짝을 이뤄 합하는 관계 — 인연·결합·조화를 뜻합니다." },
  { tab: "지지육합", type: "육합", desc: "지지가 1:1로 합하는 관계 — 친밀·결속을 뜻합니다." },
  { tab: "지지삼합", type: "삼합", desc: "세 지지가 모여 큰 기운(국)을 이루는 강한 합입니다." },
  { tab: "지지방합", type: "방합", desc: "같은 방위 세 지지가 모인 합 — 계절·방향의 기운이 강해집니다." },
  { tab: "천간충", type: "천간충", desc: "천간이 서로 부딪치는 관계 — 변동·갈등·자극을 뜻합니다." },
  { tab: "지지충", type: "충", desc: "지지가 정면으로 충돌 — 이동·변화·역마의 기운입니다." },
  { tab: "공망", type: "공망", desc: "비어 있는 자리 — 해당 기운이 약하거나 허전함을 뜻합니다." },
  { tab: "형", type: "형", desc: "형벌의 기운 — 마찰·송사·수술 등을 조심합니다." },
  { tab: "파", type: "파", desc: "깨뜨리는 관계 — 분리·재정비의 기운입니다." },
  { tab: "해", type: "해", desc: "방해하는 관계 — 시기·구설·건강을 주의합니다." },
  { tab: "원진", type: "원진", desc: "서로 미워하는 기운 — 애증·갈등을 뜻합니다." },
];
const CAUTION = new Set(["천간충", "충", "형", "파", "해", "원진"]);

export default function ChartGrid({ chart }: { chart: ManseChart }) {
  const { pillars, gongmang, corrected, analysis } = chart;
  const [active, setActive] = useState("궁성");
  const cur = TABS.find((t) => t.tab === active)!;

  const cols: { key: string; label: string; p: PillarOut | null }[] = [
    { key: "hour", label: "시주", p: pillars.hour },
    { key: "day", label: "일주", p: pillars.day },
    { key: "month", label: "월주", p: pillars.month },
    { key: "year", label: "년주", p: pillars.year },
  ];

  const isGung = cur.type === null;
  const isGongmang = cur.type === "공망";
  const rels = !isGung && !isGongmang ? analysis.hapchung.filter((r) => r.type === cur.type) : [];

  // 강조 셀 집합: "pillarKey:stem|branch"
  const hi = new Set<string>();
  if (isGongmang) {
    for (const c of cols) if (c.p && gongmang.includes(c.p.branch.hanja)) hi.add(`${c.key}:branch`);
  } else if (!isGung) {
    for (const r of rels) for (const pk of r.pillars) hi.add(`${pk}:${r.row}`);
  }
  // 강조 대상이 있을 때만 나머지를 흐리게 (매칭 없으면 원국 그대로 유지)
  const dimMode = hi.size > 0;
  const cellState = (key: string, row: "stem" | "branch"): CellState =>
    !dimMode ? "normal" : hi.has(`${key}:${row}`) ? "emph" : "dim";

  // 원국 상세 — 접지 않고 전부 표기 (납음·관계·신살·12신살)
  const sinByPillar = (k: string) => analysis.sinsal.filter((s) => s.pillar === k).map((s) => s.name);
  const sin12Year = (k: string) => analysis.sinsal12.find((s) => s.pillar === k)?.name;
  const sin12Day = (k: string) => analysis.sinsal12Day.find((s) => s.pillar === k)?.name;
  // 관계 — 글자 포함(子午충 등), 라벨 접두(년-월) 제거. 같은 기둥의 모든 관계 나열
  const relByPillar = (k: string) => analysis.hapchung.filter((r) => r.pillars.includes(k)).map((r) => r.detail.replace(/^[년월일시]-[년월일시]\s*/, ""));
  const monthJeonggi = pillars.month.hiddenStems[pillars.month.hiddenStems.length - 1];
  const DETAIL: { key: string; label: string; cell: (k: string, p: PillarOut) => ReactNode }[] = [
    { key: "nayin", label: "납음", cell: (_k, p) => p.nayin },
    { key: "rel", label: "관계", cell: (k) => { const a = relByPillar(k); return a.length ? a.map((n, i) => <div key={i}>{n}</div>) : "-"; } },
    { key: "sinsal", label: "신살", cell: (k) => { const a = sinByPillar(k); return a.length ? a.map((n, i) => <div key={i}>{n}</div>) : "-"; } },
    { key: "sin12", label: "12신살(년·일)", cell: (k) => (<><div>{sin12Year(k) ?? "-"}</div><div className="text-gray-500">{sin12Day(k) ?? "-"}</div></>) },
  ];

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      {/* 표시 모드 탭 (원국 리모컨) */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.tab} onClick={() => setActive(t.tab)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              active === t.tab ? "bg-accent-500 text-white" : "bg-gray-100 text-gray-500"
            }`}
          >
            {t.tab}
          </button>
        ))}
      </div>
      <p className="mb-3 text-xs leading-relaxed text-gray-500">{cur.desc}</p>

      {/* 사주 원국 — 시·일·월·년 + 궁성/의미 흡수 */}
      <div className="flex gap-2">
        <LabelColumn />
        {cols.map((c) =>
          c.p ? (
            <PillarColumn
              key={c.key} label={c.label} p={c.p} isDay={c.key === "day"} gongmang={gongmang}
              stemState={cellState(c.key, "stem")} branchState={cellState(c.key, "branch")}
            />
          ) : (
            <div key={c.key} className="flex min-w-0 flex-1 flex-col items-center justify-center text-xs text-gray-400">
              시간<br />모름
            </div>
          ),
        )}
      </div>

      {/* 원국 상세 — 납음·관계·신살·12신살 (탭 없이 항상 표기) */}
      <div className="mt-2 overflow-hidden rounded-xl ring-1 ring-gray-100">
        <table className="w-full table-fixed border-collapse text-center">
          <colgroup><col className="w-11" /><col /><col /><col /><col /></colgroup>
          <tbody>
            {DETAIL.map((d) => (
              <tr key={d.key} className="border-t border-gray-100 first:border-t-0">
                <td className="bg-gray-100 px-1 py-1.5 text-[12px] font-bold text-gray-700">{d.label}</td>
                {cols.map((c) => (
                  <td key={c.key} className={`px-0.5 py-1.5 align-top text-[12.5px] font-medium leading-snug text-gray-800 ${c.key === "day" ? "bg-primary-50/50" : ""}`}>
                    {c.p ? d.cell(c.key, c.p) : "-"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* 요약 — 오행 개수 · 공망 · 월령 */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-gray-50 px-3 py-2 text-[12px] font-medium text-gray-700">
        <span>오행 <b className="text-gray-800">{analysis.elements.map((e) => `${e.element}${e.count}`).join(" ")}</b></span>
        <span>공망 <b className="font-hanja text-accent-500">{gongmang.join("")}</b></span>
        {analysis.cheoneul.length > 0 && <span>천을귀인 <b className="font-hanja text-violet-600">{analysis.cheoneul.join("")}</b></span>}
        <span>월령 <b className="font-hanja text-gray-800">{monthJeonggi?.hanja ?? "-"}</b></span>
      </div>

      {/* 월주 근거 — "달력 월이 아니라 절기로 월이 바뀐다" 오해 방지 */}
      <div className="mt-2 rounded-lg bg-primary-50 px-3 py-2 text-[12px] leading-relaxed text-gray-600">
        <b className="text-primary-600">월주 기준</b> · 사주의 달(月)은 달력이 아니라 <b>절기</b>로 바뀝니다.
        이 사주는 <b className="text-gray-800">{corrected.monthTerm.name}</b>
        {corrected.monthTerm.at && <>(<span className="tabular-nums">{fmtTermAt(corrected.monthTerm.at)}</span>)</>} 입절 이후라
        <b className="font-hanja text-gray-800"> {pillars.month.branch.hanja}</b>({pillars.month.branch.ko})월 입니다.
      </div>

      {/* 활성 탭 결과 캡션 */}
      {!isGung && (
        <div className="mt-3">
          {isGongmang ? (
            <p className="text-sm leading-relaxed text-gray-600">
              공망 지지는 <b className="font-hanja font-extrabold text-accent-500">{gongmang.join("·")}</b> 이고,
              {hi.size ? (
                <> 그 중 <b className="text-gray-800">{cols.filter((c) => c.p && gongmang.includes(c.p.branch.hanja)).map((c) => `${c.label}(${c.p!.branch.hanja})`).join(", ")}</b>가 원국에 닿아 공망입니다.</>
              ) : (
                <> 원국 네 기둥에는 닿는 자리가 없습니다.</>
              )}
            </p>
          ) : rels.length ? (
            <div className="flex flex-wrap gap-1.5">
              {rels.map((r, i) => (
                <span key={i} className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ${
                  CAUTION.has(r.type) ? "bg-rose-50 text-rose-600 ring-rose-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                }`}>
                  {r.detail}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">이 사주엔 <b className="text-gray-600">{cur.tab}</b> 관계가 없습니다.</p>
          )}
        </div>
      )}

      {/* 오행 범례 — 배경색이 무슨 기운인지 (지도의 범례) */}
      <ElementLegend className="mt-3" />

      {/* 진태양시 안내 — 일반 만세력과 시(時)가 다를 수 있는 이유 */}
      {corrected.trueSolarApplied && (
        <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-800 ring-1 ring-amber-100">
          <b>진태양시 보정 적용</b> — 출생지 경도·균시차를 반영해 실제 태양시로 계산합니다.
          보정을 안 하는 일반 만세력과 <b>시주(時)</b>가 다르게 보일 수 있으며, 이쪽이 더 정밀합니다.
          <span className="text-amber-600"> (입력창의 ‘진태양시 보정’ 체크로 끌 수 있어요.)</span>
        </div>
      )}

      {/* 보정 정보 */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        <span>공망 <b className="text-gray-700">{gongmang.join("")}</b></span>
        <span>사주년 <b className="text-gray-700">{corrected.sajuYear}</b></span>
        <span>보정시각 <b className="text-gray-700">{corrected.trueSolarLocal.replace("T", " ")}</b></span>
        <span className="text-gray-400">(경도 {corrected.longitudeMinutes}분 · 균시차 {corrected.equationOfTimeMinutes}분)</span>
      </div>
    </div>
  );
}
