import type { ManseChart, PillarOut } from "@manse/engine";
import { elementStyle } from "../lib/element.js";
import { STEM_TRAIT, SINSAL_MEANING, SINSAL_KIND } from "../lib/interpret.js";
import DomainReadings from "./DomainReadings.js";

function MiniPillar({ label, p }: { label: string; p: PillarOut }) {
  const s = elementStyle(p.stem.element);
  return (
    <div className="flex flex-col items-center">
      <span className="mb-1 text-xs text-gray-400">{label}</span>
      <div className={`flex h-16 w-14 flex-col items-center justify-center rounded-xl ${s.bg} ring-1 ${s.ring}`}>
        <span className="font-hanja text-2xl font-extrabold leading-none text-gray-800">{p.stem.hanja}</span>
        <span className="font-hanja text-2xl font-extrabold leading-none text-gray-800">{p.branch.hanja}</span>
      </div>
      <span className="mt-1 text-xs text-gray-500">{p.ganzhiKo}</span>
    </div>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      {title && (
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
          <span className="h-3.5 w-1 rounded-full bg-accent-500" />{title}
        </h3>
      )}
      {children}
    </div>
  );
}

export default function EasyView({ chart }: { chart: ManseChart }) {
  const day = chart.pillars.day;
  const ds = elementStyle(day.stem.element);
  const dayKo = day.stem.ko;

  const els = chart.analysis.elements;
  const dom = [...els].sort((a, b) => b.percent - a.percent)[0]!;
  const domS = elementStyle(dom.element);
  const lack = els.filter((e) => e.level === "부족").map((e) => e.element);

  const st = chart.analysis.strength;
  const strong = st.ratio >= 0.5;
  const ys = elementStyle(st.yongsin);

  // 지금 지나는 대운 (브라우저 시계 기준)
  const curAge = new Date().getFullYear() - chart.birthYear;
  const curDw = chart.daewoon.list.find((d) => curAge >= d.age && curAge < d.age + 10) ?? chart.daewoon.list[0]!;

  // 주요 길성/신살 — 길성 우선 3개
  const topSin = [...new Set(chart.analysis.sinsal.map((s) => s.name))]
    .filter((n) => SINSAL_MEANING[n])
    .sort((a, b) => (SINSAL_KIND[a] === "길성" ? -1 : 1) - (SINSAL_KIND[b] === "길성" ? -1 : 1))
    .slice(0, 3);
  const gil = (n: string) => SINSAL_KIND[n] !== "신살";

  return (
    <div className="space-y-4">
      {/* 1. 일간 + 성향 + 원국 */}
      <Card>
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-gray-50 p-3">
          <div className={`flex h-14 w-14 items-center justify-center rounded-xl ${ds.bg} ring-1 ${ds.ring}`}>
            <span className={`font-hanja text-3xl font-black ${ds.text}`}>{day.stem.hanja}</span>
          </div>
          <div>
            <div className="text-sm text-gray-500">나를 나타내는 글자 (일간)</div>
            <div className="text-lg font-semibold text-gray-800">
              {day.stem.ko} · {day.stem.element}({ds.label}) {day.stem.polarity}
            </div>
          </div>
        </div>
        <p className="mb-4 text-[13px] leading-relaxed text-gray-600">
          <b className="text-gray-800">{day.stem.hanja}({dayKo})</b> 일간 — {STEM_TRAIT[dayKo]}
        </p>
        <div className="flex items-end justify-around">
          {chart.pillars.hour && <MiniPillar label="시" p={chart.pillars.hour} />}
          <MiniPillar label="일" p={chart.pillars.day} />
          <MiniPillar label="월" p={chart.pillars.month} />
          <MiniPillar label="년" p={chart.pillars.year} />
        </div>
        <p className="mt-3 rounded-lg bg-primary-50 px-3 py-2 text-[12px] leading-relaxed text-gray-600">
          💡 사주의 <b>달(月)</b>은 달력이 아니라 <b>절기</b>로 바뀌어요. 이 사주는{" "}
          <b className="text-gray-800">{chart.corrected.monthTerm.name}</b> 입절 이후라{" "}
          <b className="font-hanja text-gray-800">{chart.pillars.month.branch.hanja}</b>({chart.pillars.month.branch.ko})월이에요.
        </p>
      </Card>

      {/* 2. 오행 기운 */}
      <Card title="내 오행 기운">
        <p className="mb-3 text-[13px] leading-relaxed text-gray-600">
          가장 강한 기운은 <b className={domS.text}>{dom.element}({domS.label}) {dom.percent}%</b>이고,{" "}
          {lack.length > 0
            ? <>부족한 기운은 <b className="text-gray-700">{lack.join("·")}</b>이에요. 부족한 기운의 활동을 의식적으로 채우면 균형이 잡혀요.</>
            : <>오행이 비교적 고르게 퍼져 있어 큰 치우침이 적은 편이에요.</>}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {els.map((e) => {
            const s = elementStyle(e.element);
            return (
              <span key={e.element} className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${s.bg} ${s.text} ${s.ring}`}>
                {e.element} {e.percent}%
              </span>
            );
          })}
        </div>
      </Card>

      {/* 3. 기운의 세기 + 지금 대운 */}
      <Card title="내 기운의 세기 · 지금의 운">
        <p className="text-[13px] leading-relaxed text-gray-600">
          <b className="text-primary-600">{st.label}</b> 사주예요.{" "}
          {strong
            ? "주관과 추진력이 뚜렷해 스스로 일을 끌고 가는 힘이 있어요."
            : "주변과 어울리며 유연하게 풀어가는 편이라, 좋은 인연·환경의 도움을 받을 때 더 멀리 가요."}{" "}
          기운의 균형을 돕는 글자는 <b className={ys.text}>{st.yongsin}({ys.label})</b>이에요.
        </p>
        <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-[13px] text-gray-600">
          🧭 지금은 <b className="text-accent-500">{curDw.age}~{curDw.age + 9}세</b> 대운,{" "}
          <b className="font-hanja">{curDw.ganzhi}</b>({curDw.ganzhiKo}) 시기를 지나고 있어요.
        </p>
      </Card>

      {/* 4. 분야별 풀이 (직업·애정·재물·건강) — 전문가 보기와 공유 */}
      <DomainReadings chart={chart} />

      {/* 5. 주요 길성·신살 */}
      {topSin.length > 0 && (
        <Card title="내 사주의 특별한 별 (신살·길성)">
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {topSin.map((n) => (
              <span key={n} className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                gil(n) ? "bg-violet-50 text-violet-600 ring-violet-300/50" : "bg-amber-50 text-amber-700 ring-amber-300/50"
              }`}>{n}</span>
            ))}
          </div>
          <div className="space-y-1.5">
            {topSin.map((n) => (
              <p key={n} className="text-[13px] leading-relaxed text-gray-600">
                <b className={gil(n) ? "text-violet-600" : "text-amber-700"}>{n}</b> — {SINSAL_MEANING[n]}
              </p>
            ))}
          </div>
        </Card>
      )}

      {/* 6. 전문가 보기 안내 */}
      <p className="text-center text-xs leading-relaxed text-gray-400">
        십성·25종 신살·대운 흐름·일진 달력 등 더 전문적인 분석은 <b className="text-accent-500">‘전문가 보기’</b>에서 확인하세요.
      </p>
    </div>
  );
}
