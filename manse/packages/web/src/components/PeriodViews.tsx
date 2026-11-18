// 주간·월간 운세(일일운세 집계) + 평생운세 맛보기.
// 풀이는 "오늘 하루"를 넘어선 흐름이지만, 평생운세는 의도적으로 '맛보기'만 — 전체 풀이는 상담으로 유도.
import { useMemo, type ReactNode } from "react";
import { computeDailyFortune, computeManse, type DailyInput, type ManseInput } from "@manse/engine";
import { STEM_TRAIT, GYEOK_MEANING } from "../lib/interpret.js";
import { elementStyle } from "../lib/element.js";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function todayDate() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}
function shiftDate(d: { year: number; month: number; day: number }, delta: number) {
  const dt = new Date(d.year, d.month - 1, d.day + delta);
  return { year: dt.getFullYear(), month: dt.getMonth() + 1, day: dt.getDate() };
}
function bandWord(s: number): string {
  if (s >= 82) return "활짝 열리는";
  if (s >= 70) return "순조로운";
  if (s >= 56) return "무난한";
  if (s >= 42) return "차분한";
  return "쉬어가는";
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
      <span className="h-3.5 w-1 rounded-full bg-accent-500" />{children}
    </div>
  );
}
function CtaBanner({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl bg-gradient-to-r from-primary-500 to-accent-500 px-4 py-3.5 text-white shadow-sm">
      <span className="text-sm font-medium">{text}</span>
      <a href="https://sajuplan.com" className="whitespace-nowrap rounded-full bg-white px-3.5 py-1.5 text-sm font-bold text-accent-500">전문가 상담</a>
    </div>
  );
}

// ── 주간 ────────────────────────────────────────────────────────
export function WeekView({ input }: { input: DailyInput }) {
  const data = useMemo(() => {
    const t = todayDate();
    const days = Array.from({ length: 7 }, (_, i) => {
      const dt = shiftDate(t, i);
      const r = computeDailyFortune(input, dt);
      const wd = WEEKDAYS[new Date(dt.year, dt.month - 1, dt.day).getDay()]!;
      return { dt, label: i === 0 ? "오늘" : wd, score: r.total.score, fields: r.fields, isToday: i === 0 };
    });
    const avg = Math.round(days.reduce((a, d) => a + d.score, 0) / days.length);
    const best = days.reduce((a, b) => (b.score > a.score ? b : a));
    const worst = days.reduce((a, b) => (b.score < a.score ? b : a));
    const fieldAvg = days[0]!.fields.map((f, j) => ({
      label: f.label,
      score: Math.round(days.reduce((a, d) => a + d.fields[j]!.score, 0) / days.length),
    }));
    const endLabel = `${days[6]!.dt.month}/${days[6]!.dt.day}`;
    return { days, avg, best, worst, fieldAvg, rangeLabel: `오늘부터 ${endLabel}까지`, t };
  }, [input]);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-white p-5 shadow-md ring-2 ring-primary-400">
        <div className="text-xs text-gray-400">{data.rangeLabel}</div>
        <div className="mt-1 text-lg font-bold text-gray-800">이번 주는 {bandWord(data.avg)} 한 주</div>
        <div className="mt-1 text-sm text-gray-500">주간 평균 <b className="text-primary-600">{data.avg}점</b> · 가장 좋은 날 {data.best.label}({data.best.score}) · 조심할 날 {data.worst.label}({data.worst.score})</div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <SectionTitle>요일별 운세 흐름</SectionTitle>
        <div className="flex items-end justify-between gap-1.5" style={{ height: 96 }}>
          {data.days.map((d, i) => (
            <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
              <span className={`text-[10px] font-bold ${d.isToday ? "text-accent-600" : "text-gray-400"}`}>{d.score}</span>
              <div className={`w-full rounded-t-md ${d.isToday ? "bg-accent-500" : "bg-gray-300"}`} style={{ height: `${Math.max(8, Math.round(d.score * 0.6))}px` }} />
              <span className={`text-[10px] ${d.isToday ? "font-bold text-accent-600" : "text-gray-400"}`}>{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <SectionTitle>분야별 주간 운세</SectionTitle>
        <div className="space-y-2">
          {data.fieldAvg.map((f) => (
            <div key={f.label} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-xs font-medium text-gray-600">{f.label}</span>
              <div className="h-2 flex-1 rounded-full bg-gray-100">
                <div className="h-2 rounded-full bg-accent-400" style={{ width: `${f.score}%` }} />
              </div>
              <span className="w-8 text-right text-[11px] font-bold text-gray-400">{f.score}</span>
            </div>
          ))}
        </div>
      </div>

      <CtaBanner text="이번 주 흐름을 내 사주에 맞춰 깊이 보고 싶다면?" />
    </div>
  );
}

// ── 월간 ────────────────────────────────────────────────────────
export function MonthView({ input }: { input: DailyInput }) {
  const data = useMemo(() => {
    const t = todayDate();
    const dim = new Date(t.year, t.month, 0).getDate();
    const days = Array.from({ length: dim }, (_, i) => ({ day: i + 1, score: computeDailyFortune(input, { year: t.year, month: t.month, day: i + 1 }).total.score }));
    const avg = Math.round(days.reduce((a, d) => a + d.score, 0) / days.length);
    const weeks = [1, 2, 3, 4, 5]
      .map((w) => {
        const ds = days.filter((d) => Math.ceil(d.day / 7) === w);
        return ds.length ? { label: `${w}주차`, score: Math.round(ds.reduce((a, d) => a + d.score, 0) / ds.length) } : null;
      })
      .filter((x): x is { label: string; score: number } => x != null);
    const sorted = [...days].sort((a, b) => b.score - a.score);
    const lucky = sorted.slice(0, 3).map((d) => d.day).sort((a, b) => a - b);
    const caution = sorted.slice(-3).map((d) => d.day).sort((a, b) => a - b);
    return { avg, weeks, lucky, caution, monthLabel: `${t.year}년 ${t.month}월` };
  }, [input]);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-white p-5 shadow-md ring-2 ring-primary-400">
        <div className="text-xs text-gray-400">{data.monthLabel}</div>
        <div className="mt-1 text-lg font-bold text-gray-800">이번 달은 {bandWord(data.avg)} 한 달</div>
        <div className="mt-1 text-sm text-gray-500">월간 평균 <b className="text-primary-600">{data.avg}점</b></div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <SectionTitle>주차별 운세 흐름</SectionTitle>
        <div className="flex items-end justify-between gap-2" style={{ height: 96 }}>
          {data.weeks.map((w) => (
            <div key={w.label} className="flex flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[10px] font-bold text-gray-400">{w.score}</span>
              <div className="w-full rounded-t-md bg-accent-400" style={{ height: `${Math.max(8, Math.round(w.score * 0.6))}px` }} />
              <span className="text-[10px] text-gray-400">{w.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <div className="mb-2 text-sm font-semibold text-emerald-600">이달의 길일</div>
          <div className="flex flex-wrap gap-1.5">
            {data.lucky.map((d) => <span key={d} className="rounded-lg bg-gray-50 px-2.5 py-1 text-sm font-bold text-gray-700 ring-1 ring-gray-100">{d}일</span>)}
          </div>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <div className="mb-2 text-sm font-semibold text-rose-500">조심할 날</div>
          <div className="flex flex-wrap gap-1.5">
            {data.caution.map((d) => <span key={d} className="rounded-lg bg-gray-50 px-2.5 py-1 text-sm font-bold text-gray-700 ring-1 ring-gray-100">{d}일</span>)}
          </div>
        </div>
      </div>

      <CtaBanner text="이번 달 중요한 결정, 내 사주로 길일을 정확히 잡고 싶다면?" />
    </div>
  );
}

// ── 평생 맛보기 ───────────────────────────────────────────────
export function LifeTeaser({ input }: { input: ManseInput }) {
  const data = useMemo(() => {
    const chart = computeManse(input);
    const stemKo = chart.pillars.day.stem.ko;
    const trait = STEM_TRAIT[stemKo] ?? "";
    const gyeok = chart.analysis.gyeokguk;
    const gyeokMean = GYEOK_MEANING[gyeok] ?? "";
    const strength = chart.analysis.strength;
    const age = new Date().getFullYear() - chart.birthYear + 1;
    let cur = chart.daewoon.list[0];
    for (const d of chart.daewoon.list) { if (d.age <= age) cur = d; else break; }
    return { chart, stemKo, trait, gyeok, gyeokMean, strength, age, cur };
  }, [input]);
  const { chart, stemKo, trait, gyeok, gyeokMean, strength, cur } = data;
  const dayEl = chart.pillars.day.stem.element;
  const es = elementStyle(dayEl);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-white p-5 shadow-md ring-2 ring-primary-400">
        <div className="text-xs text-gray-400">평생 사주 핵심 요약 · 맛보기</div>
        <div className="mt-1 text-lg font-bold text-gray-800">{chart.input.name ? `${chart.input.name}님은 ` : ""}{stemKo}({dayEl}) 일간</div>
        <div className="mt-1 text-sm text-gray-500">{strength.label} · 용신 <b className="text-primary-600">{strength.yongsin}</b> · {gyeok}</div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <SectionTitle>타고난 기질</SectionTitle>
        <div className="mb-2 flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${es.bg} ${es.text} ring-1 ${es.ring}`}>{stemKo} · {es.label}</span>
        </div>
        <p className="text-sm leading-relaxed text-gray-600">{trait}</p>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <SectionTitle>타고난 그릇 (격국)</SectionTitle>
        <div className="text-sm font-semibold text-primary-600">{gyeok}</div>
        <p className="mt-1 text-sm leading-relaxed text-gray-600">{gyeokMean}</p>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <SectionTitle>지금의 큰 흐름 (대운)</SectionTitle>
        <p className="text-sm leading-relaxed text-gray-600">
          현재 <b className="text-gray-800">{cur?.age}세 대운 {cur?.ganzhiKo}</b> 구간을 지나고 있습니다.
          십 년 단위로 바뀌는 인생의 큰 계절 중, 지금이 어떤 자리인지가 평생 운세의 핵심입니다.
        </p>
      </div>

      {/* 잠금 — 전체 평생풀이는 상담으로 */}
      <div className="rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-gray-100">
        <div className="text-2xl">🔮</div>
        <div className="mt-1 text-sm font-bold text-gray-800">여기까지가 타고난 ‘큰 줄기’예요</div>
        <p className="mt-1 text-xs leading-relaxed text-gray-500">
          평생의 재물·직업·배우자·건강 흐름과 시기별 조언은 사주의 깊은 해석이 필요합니다.<br />
          내 평생 사주를 전문가에게 제대로 풀어보세요.
        </p>
        <a href="https://sajuplan.com" className="mt-3 inline-block rounded-full bg-accent-500 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-accent-600">
          내 평생운세 전문가 상담 →
        </a>
      </div>
    </div>
  );
}
