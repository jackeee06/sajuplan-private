import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  computeDailyFortune,
  type DailyFortune as DailyFortuneData, type DailyInput, type DailySlotGrade, type ManseInput,
} from "@manse/engine";
import InputPanel from "./InputPanel";
import { WeekView, MonthView, LifeTeaser } from "./PeriodViews";
import { elementStyle } from "../lib/element.js";

const ANIMALS: [string, string][] = [
  ["쥐", "🐭"], ["소", "🐮"], ["호랑이", "🐯"], ["토끼", "🐰"], ["용", "🐲"], ["뱀", "🐍"],
  ["말", "🐴"], ["양", "🐑"], ["원숭이", "🐵"], ["닭", "🐔"], ["개", "🐶"], ["돼지", "🐷"],
];

function todayDate() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}
function shiftDate(d: { year: number; month: number; day: number }, delta: number) {
  const dt = new Date(d.year, d.month - 1, d.day + delta);
  return { year: dt.getFullYear(), month: dt.getMonth() + 1, day: dt.getDate() };
}
type DailyExtra = { yesterday: number; trend: { label: string; score: number; isToday: boolean }[] };

function Stars({ n }: { n: number }) {
  return <span>{"★".repeat(n)}<span className="text-gray-200">{"★".repeat(5 - n)}</span></span>;
}

const SLOT_COLOR: Record<DailySlotGrade, string> = {
  best: "text-accent-600", good: "text-emerald-600", normal: "text-gray-400", caution: "text-rose-500",
};

export default function DailyFortune({ sharedInput, onShared, onReset }: {
  sharedInput?: ManseInput | null;
  onShared?: (input: ManseInput) => void;
  onReset?: () => void;
}) {
  const [mode, setMode] = useState<"zodiac" | "natal">(sharedInput ? "natal" : "zodiac");
  const [natalEditing, setNatalEditing] = useState(false);
  const [branch, setBranch] = useState<number | null>(null);
  const [res, setRes] = useState<DailyFortuneData | null>(null);
  const [extra, setExtra] = useState<DailyExtra | null>(null);
  const [period, setPeriod] = useState<"today" | "week" | "month" | "life">("today");
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const lastRef = useRef<DailyInput | null>(null);

  function compute(input: DailyInput) {
    try {
      setErr(null);
      lastRef.current = input;
      setPeriod("today");
      const t = todayDate();
      setRes(computeDailyFortune(input, t));
      const yScore = computeDailyFortune(input, shiftDate(t, -1)).total.score;
      const trend = Array.from({ length: 7 }, (_, i) => {
        const dt = shiftDate(t, i);
        return { label: `${dt.month}/${dt.day}`, score: computeDailyFortune(input, dt).total.score, isToday: i === 0 };
      });
      setExtra({ yesterday: yScore, trend });
    } catch (e) { setRes(null); setExtra(null); setErr((e as Error).message); }
  }
  function runZodiac(b: number) { setBranch(b); compute({ mode: "zodiac", yearBranch: b }); }
  // 정밀 입력은 공용 소스(App lastInput)로 올린다 → 세 탭이 공유. 실제 계산은 sharedInput effect가.
  function runNatal(input: ManseInput) {
    setNatalEditing(false);
    if (onShared) onShared(input);
    else compute({ mode: "natal", birth: input.birth, gender: input.gender, unknownHour: input.unknownHour, longitude: input.longitude });
  }

  // 공용 입력(sharedInput)이 있으면 정밀모드로 자동 계산 — 만세력/궁합에서 넣은 정보를 그대로 잇는다
  useEffect(() => {
    if (mode === "natal" && sharedInput && !natalEditing) {
      compute({ mode: "natal", birth: sharedInput.birth, gender: sharedInput.gender, unknownHour: sharedInput.unknownHour, longitude: sharedInput.longitude });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, natalEditing, sharedInput?.birth, sharedInput?.gender, sharedInput?.unknownHour, sharedInput?.longitude]);

  // 공유 링크로 들어오면 자동 계산
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("m") !== "daily") return;
    const z = q.get("z");
    if (z != null && z !== "") { const b = ((+z % 12) + 12) % 12; setMode("zodiac"); runZodiac(b); return; }
    const db = q.get("db");
    if (db) {
      setMode("natal");
      const input: ManseInput = { birth: db, gender: q.get("g") === "M" ? "M" : "F", unknownHour: q.get("uh") === "1", longitude: q.get("lon") ? +q.get("lon")! : undefined };
      if (onShared) onShared(input);
      else compute({ mode: "natal", birth: input.birth, gender: input.gender, unknownHour: input.unknownHour, longitude: input.longitude });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function flash(msg: string) { setToast(msg); window.setTimeout(() => setToast(null), 1800); }

  async function share() {
    const last = lastRef.current;
    if (!last) return;
    const base = `${window.location.origin}${window.location.pathname}`;
    let url: string;
    if (last.mode === "zodiac") url = `${base}?m=daily&z=${last.yearBranch}`;
    else {
      const q = new URLSearchParams({ m: "daily", db: last.birth, g: last.gender, uh: last.unknownHour ? "1" : "0" });
      if (last.longitude != null) q.set("lon", String(last.longitude));
      url = `${base}?${q.toString()}`;
    }
    if (navigator.share) {
      try { await navigator.share({ title: "오늘의 운세 — 사주플랜", url }); return; } catch { /* 취소 → 복사 */ }
    }
    try { await navigator.clipboard.writeText(url); flash("운세 링크를 복사했어요 — 붙여넣기 하세요"); }
    catch { flash("공유 링크: " + url); }
  }

  // 정밀모드 → 같은 생일로 전체 만세력 보기 링크 (만세력 탭 자동 계산)
  function manseHref(): string {
    const last = lastRef.current;
    if (!last || last.mode !== "natal") return "/";
    const q = new URLSearchParams({ b: last.birth, g: last.gender, uh: last.unknownHour ? "1" : "0" });
    if (last.longitude != null) q.set("lon", String(last.longitude));
    return `${window.location.pathname}?${q.toString()}`;
  }

  return (
    <div className="space-y-4">
      {/* 입력 모드 토글 */}
      <div className="flex gap-2">
        {([["zodiac", "띠로 빠르게"], ["natal", "생년월일시로 정밀"]] as const).map(([m, label]) => (
          <button
            key={m}
            onClick={() => {
              setErr(null); setBranch(null); setNatalEditing(false);
              if (m === "natal") {
                setMode("natal");
                if (!sharedInput) { setRes(null); setExtra(null); setPeriod("today"); lastRef.current = null; }
              } else {
                setMode("zodiac"); setRes(null); setExtra(null); setPeriod("today"); lastRef.current = null;
              }
            }}
            className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold ring-1 transition ${
              mode === m ? "bg-accent-500 text-white ring-accent-500" : "bg-white text-gray-600 ring-gray-200 hover:bg-gray-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "zodiac" ? (
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <p className="mb-3 text-sm font-medium text-gray-600">태어난 해의 띠를 선택하세요</p>
          <div className="grid grid-cols-4 gap-2">
            {ANIMALS.map(([name, emoji], i) => (
              <button
                key={name}
                onClick={() => runZodiac(i)}
                className={`flex flex-col items-center gap-0.5 rounded-xl py-2.5 ring-1 transition ${
                  branch === i ? "bg-accent-50 ring-accent-400" : "bg-gray-50 ring-gray-100 hover:bg-gray-100"
                }`}
              >
                <span className="text-2xl">{emoji}</span>
                <span className={`text-xs font-medium ${branch === i ? "text-accent-600" : "text-gray-600"}`}>{name}띠</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-center text-[11px] text-gray-400">띠는 간단 버전이에요 · 생년월일시를 넣으면 더 정확한 맞춤 운세가 나와요</p>
        </div>
      ) : sharedInput && !natalEditing ? (
        <NatalProfile input={sharedInput} onEdit={() => setNatalEditing(true)} onReset={() => onReset?.()} onShare={share} />
      ) : (
        <InputPanel onCompute={runNatal} onError={setErr} buttonLabel="오늘 운세 보기" />
      )}

      {err && <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600 ring-1 ring-rose-100">{err}</div>}

      {res && (
        <>
          {/* 기간 토글 */}
          <div className="flex gap-1.5">
            {([["today", "오늘"], ["week", "이번주"], ["month", "이번달"], ["life", "평생"]] as const).map(([p, label]) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`flex-1 whitespace-nowrap rounded-lg px-2 py-2 text-sm font-medium ring-1 transition ${
                  period === p ? "bg-accent-500 text-white ring-accent-500" : "bg-white text-gray-600 ring-gray-200 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {period === "today" && <DailyResult res={res} extra={extra} onShare={share} manseHref={res.chart ? manseHref() : null} />}
          {period === "week" && lastRef.current && <WeekView input={lastRef.current} />}
          {period === "month" && lastRef.current && <MonthView input={lastRef.current} />}
          {period === "life" && (
            lastRef.current?.mode === "natal"
              ? <LifeTeaser input={{ birth: lastRef.current.birth, gender: lastRef.current.gender, unknownHour: lastRef.current.unknownHour, longitude: lastRef.current.longitude }} />
              : (
                <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-gray-100">
                  <div className="text-2xl">🔮</div>
                  <p className="mt-2 text-sm text-gray-600">평생운세 맛보기는 <b className="text-primary-600">생년월일시</b>가 필요해요.</p>
                  <p className="mt-1 text-xs text-gray-400">위에서 '생년월일시로 정밀'을 선택해 입력해 주세요.</p>
                </div>
              )
          )}
        </>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-gray-900/90 px-4 py-2 text-sm text-white shadow-lg">{toast}</div>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
      <span className="h-3.5 w-1 rounded-full bg-accent-500" />{children}
    </div>
  );
}

function DailyResult({ res, extra, onShare, manseHref }: { res: DailyFortuneData; extra: DailyExtra | null; onShare: () => void; manseHref: string | null }) {
  const luckEl = elementStyle(res.luck.element);
  const diff = extra ? res.total.score - extra.yesterday : 0;
  return (
    <div className="space-y-3">
      {/* ① 일진 명식 + 한 줄 + 별명 + 해시태그 — 대표 요약(강조 테두리) */}
      <div className="rounded-2xl bg-white p-5 shadow-md ring-2 ring-primary-400">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-400">{res.date} ({res.weekday}) · {res.subjectLabel}</div>
            <div className="mt-1 text-lg font-bold leading-snug text-gray-800">{res.oneLine}</div>
          </div>
          <div className="text-center">
            <div className="font-hanja text-4xl font-extrabold leading-none text-primary-600">{res.dayGanzhi}</div>
            <div className="mt-1 text-[11px] text-gray-400">오늘의 일진</div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 ring-1 ring-gray-100">
          <span className="text-2xl">{res.titleEmoji}</span>
          <div>
            <div className="text-[11px] text-gray-400">오늘의 당신</div>
            <div className="text-sm font-bold text-gray-800">{res.title}</div>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {res.hashtags.map((h) => (
            <span key={h} className="rounded-full bg-accent-50 px-2 py-0.5 text-[11px] font-medium text-accent-600">{h}</span>
          ))}
        </div>
        <div className="mt-2 rounded-xl bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-500">
          {res.todayRelation} · {res.dayElement} 기운{res.personalized ? "" : " · 간단 버전"}
        </div>
      </div>

      {/* ★ 정밀모드 미니 사주 명식 */}
      {res.chart && (
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <SectionTitle>
            내 사주 한눈에
            <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">{res.chart.strengthLabel}</span>
          </SectionTitle>
          <div className="grid grid-cols-4 gap-2">
            {res.chart.pillars.map((p) => {
              const es = elementStyle(p.element);
              return (
                <div key={p.label} className={`rounded-xl ${es.bg} py-2 text-center ring-1 ${es.ring}`}>
                  <div className="text-[11px] text-gray-500">{p.label}</div>
                  <div className={`font-hanja text-xl font-bold ${es.text}`}>{p.ganzhi}</div>
                  <div className="text-[10px] text-gray-400">{p.ganzhiKo}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 space-y-1">
            {res.chart.elements.map((e) => {
              const es = elementStyle(e.element);
              return (
                <div key={e.element} className="flex items-center gap-2">
                  <span className={`w-5 text-xs font-bold ${es.text}`}>{e.element}</span>
                  <div className="h-2 flex-1 rounded-full bg-gray-100">
                    <div className="h-2 rounded-full" style={{ width: `${e.percent}%`, backgroundColor: es.hex }} />
                  </div>
                  <span className="w-10 text-right text-[11px] text-gray-400">{e.percent}%</span>
                </div>
              );
            })}
          </div>
          {manseHref && (
            <a href={manseHref} className="mt-3 block rounded-lg bg-white py-2 text-center text-xs font-semibold text-primary-600 ring-1 ring-primary-400 transition hover:bg-gray-50">
              전체 만세력 자세히 보기 →
            </a>
          )}
        </div>
      )}

      {/* ② 총운 + 상위% + 어제대비 */}
      <div className="rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-gray-100">
        <div className="text-sm font-medium text-gray-500">오늘의 총운</div>
        <div className="mt-1 text-2xl tracking-[0.15em] text-accent-500"><Stars n={res.total.stars} /></div>
        <div className="mt-1 text-3xl font-extrabold text-gray-800">{res.total.score}<span className="text-base font-medium text-gray-400">점</span></div>
        <div className="mt-1 text-base font-bold text-primary-600">{res.total.headline}</div>
        <div className="mt-2 flex items-center justify-center gap-2 text-xs">
          <span className="rounded-full bg-accent-50 px-2.5 py-1 font-bold text-accent-600">상위 {res.percentile}%</span>
          {extra && (
            <span className={`rounded-full px-2.5 py-1 font-bold ${diff >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"}`}>
              어제대비 {diff >= 0 ? "+" : ""}{diff} {diff >= 0 ? "▲" : "▼"}
            </span>
          )}
        </div>
        <div className="mt-3 space-y-1.5 text-left">
          {res.total.lines.map((ln, i) => (
            <p key={i} className="text-sm leading-relaxed text-gray-600">{ln}</p>
          ))}
        </div>
      </div>

      {/* ③ 오늘의 시나리오 */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <SectionTitle>오늘의 운세 시나리오</SectionTitle>
        <p className="text-sm leading-relaxed text-gray-600">{res.scenario}</p>
      </div>

      {/* ④ 분야별 6개 + 게이지바 */}
      <div className="grid grid-cols-2 gap-2">
        {res.fields.map((f) => (
          <div key={f.key} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">{f.label}</span>
              <span className="text-xs font-bold text-gray-400">{f.score}</span>
            </div>
            <div className="mt-0.5 text-sm tracking-[0.1em] text-accent-500"><Stars n={f.stars} /></div>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-gray-100">
              <div className="h-1.5 rounded-full bg-accent-400" style={{ width: `${f.score}%` }} />
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-gray-600">{f.comment}</p>
            <p className="mt-1.5 rounded-lg bg-gray-50 px-2 py-1.5 text-[11px] leading-relaxed text-gray-500">{f.tip}</p>
          </div>
        ))}
      </div>

      {/* ⑤ 시간대별 */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <SectionTitle>시간대별 운세</SectionTitle>
        <div className="grid grid-cols-4 gap-2">
          {res.timeSlots.map((s) => (
            <div key={s.label} className="rounded-xl bg-gray-50 py-2.5 text-center ring-1 ring-gray-100">
              <div className="text-xs font-medium text-gray-600">{s.label}</div>
              <div className="text-[10px] text-gray-400">{s.range}</div>
              <div className={`mt-1 text-xl font-bold ${SLOT_COLOR[s.grade]}`}>{s.mark}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-center text-[11px] text-gray-400">◎ 최고 · ▲ 좋음 · ◇ 무난 · ▽ 주의</p>
      </div>

      {/* ⑥ 이번 주 흐름 그래프 */}
      {extra && (
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <SectionTitle>이번 주 운세 흐름</SectionTitle>
          <div className="flex items-end justify-between gap-1.5" style={{ height: 96 }}>
            {extra.trend.map((d, i) => (
              <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
                <span className={`text-[10px] font-bold ${d.isToday ? "text-accent-600" : "text-gray-400"}`}>{d.score}</span>
                <div className={`w-full rounded-t-md ${d.isToday ? "bg-accent-500" : "bg-gray-300"}`} style={{ height: `${Math.max(8, Math.round(d.score * 0.6))}px` }} />
                <span className={`text-[10px] ${d.isToday ? "font-bold text-accent-600" : "text-gray-400"}`}>{d.isToday ? "오늘" : d.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-center text-[11px] text-gray-400">7일 흐름 미리보기 · 더 깊은 월간·연간 흐름은 전문가 상담에서</p>
        </div>
      )}

      {/* ⑦ 오늘의 주의보 */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <SectionTitle>오늘의 주의보</SectionTitle>
        <p className="text-sm leading-relaxed text-gray-600">{res.caution}</p>
      </div>

      {/* ⑧ 행동 가이드 */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <SectionTitle>오늘의 행동 가이드</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1.5 text-xs font-semibold text-emerald-600">하면 좋은 것</div>
            <ul className="space-y-1">
              {res.guide.dos.map((d, i) => <li key={i} className="text-xs leading-relaxed text-gray-600">· {d}</li>)}
            </ul>
          </div>
          <div>
            <div className="mb-1.5 text-xs font-semibold text-rose-500">피할 것</div>
            <ul className="space-y-1">
              {res.guide.donts.map((d, i) => <li key={i} className="text-xs leading-relaxed text-gray-600">· {d}</li>)}
            </ul>
          </div>
        </div>
      </div>

      {/* ⑨ 행운 요소 */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <SectionTitle>
          오늘의 행운
          <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-medium ${luckEl.bg} ${luckEl.text} ring-1 ${luckEl.ring}`}>{res.luck.element} 기운</span>
        </SectionTitle>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Luck label="행운의 색" value={res.luck.color} />
          <Luck label="행운의 숫자" value={res.luck.numbers.join(", ")} />
          <Luck label="행운의 방향" value={res.luck.direction} />
          <Luck label="행운의 시간" value={res.luck.time} />
          <Luck label="행운의 아이템" value={res.luck.item} />
          <Luck label="행운의 음식" value={res.luck.food} />
        </div>
        <div className="mt-2">
          <Luck label="오늘 잘 맞는 성씨" value={`${res.luckySurname.cons} · ${res.luckySurname.examples}`} />
        </div>
      </div>

      {/* ★ 오늘의 행운 로또번호 */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <SectionTitle>오늘의 행운 로또번호</SectionTitle>
        <div className="flex justify-center gap-1.5">
          {res.lotto.map((n) => (
            <span key={n} className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-500 text-sm font-bold text-white">{n}</span>
          ))}
        </div>
        <p className="mt-2.5 text-center text-[11px] text-gray-400">재미로 보는 행운번호 · 오늘의 기운으로 뽑았어요</p>
      </div>

      {/* ⑩ 띠 궁합 */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <SectionTitle>오늘의 띠 궁합</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-accent-50 p-3 text-center ring-1 ring-accent-300">
            <div className="text-xs font-medium text-accent-600">잘 맞는 띠</div>
            <div className="mt-1 text-2xl">{res.zodiacMatch.best.emoji}</div>
            <div className="text-sm font-bold text-gray-800">{res.zodiacMatch.best.animal}띠</div>
            <div className="mt-0.5 text-[11px] leading-relaxed text-gray-500">{res.zodiacMatch.best.reason}</div>
          </div>
          <div className="rounded-xl bg-gray-50 p-3 text-center ring-1 ring-gray-200">
            <div className="text-xs font-medium text-gray-500">조심할 띠</div>
            <div className="mt-1 text-2xl">{res.zodiacMatch.worst.emoji}</div>
            <div className="text-sm font-bold text-gray-800">{res.zodiacMatch.worst.animal}띠</div>
            <div className="mt-0.5 text-[11px] leading-relaxed text-gray-500">{res.zodiacMatch.worst.reason}</div>
          </div>
        </div>
      </div>

      {/* ⑪ 오늘의 명언 */}
      <div className="rounded-2xl bg-gray-50 p-4 text-center ring-1 ring-gray-100">
        <p className="text-sm italic leading-relaxed text-gray-600">“{res.quote}”</p>
      </div>

      <p className="px-2 text-center text-[11px] leading-relaxed text-gray-400">{res.basis}</p>

      {/* ⑫ 공유 + 상담 유도 (만세력과 동일 톤) */}
      <button onClick={onShare} className="w-full rounded-xl bg-accent-500 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-accent-600">
        📤 오늘 운세 공유
      </button>
      <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-primary-500 to-accent-500 px-4 py-3.5 text-white shadow-sm">
        <span className="text-sm font-medium">오늘 너머, 내 인생의 흐름이 궁금하다면?</span>
        <a href="https://sajuplan.com" className="whitespace-nowrap rounded-full bg-white px-3.5 py-1.5 text-sm font-bold text-accent-500">전문가 상담</a>
      </div>
    </div>
  );
}

function fmtNatal(input: ManseInput): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(input.birth);
  if (!m) return input.birth;
  const [, y, mo, d, h, mi] = m;
  const hh = +h!;
  const ap = hh < 12 ? "오전" : "오후";
  const h12 = hh % 12 || 12;
  const time = input.unknownHour ? "시간 모름" : `${ap} ${h12}:${mi}`;
  return `${y}.${mo}.${d} ${time} · ${input.gender === "F" ? "여성" : "남성"}`;
}

function NatalProfile({ input, onEdit, onReset, onShare }: { input: ManseInput; onEdit: () => void; onReset: () => void; onShare: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-gray-100">
      <div className="min-w-0">
        {input.name && <div className="text-[19px] font-bold leading-tight text-primary-600">{input.name}</div>}
        <div className={`text-sm font-semibold text-gray-800${input.name ? " mt-0.5" : ""}`}>
          {fmtNatal(input)}
        </div>
        <div className="mt-2 flex gap-1.5">
          <button onClick={onEdit} className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-accent-600 ring-1 ring-accent-300 transition hover:bg-accent-50">✏️ 정보 수정하기</button>
          <button onClick={onReset} className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-300 transition hover:bg-gray-50">초기화</button>
        </div>
      </div>
      <button onClick={onShare} className="shrink-0 rounded-lg bg-accent-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-accent-600">결과 공유</button>
    </div>
  );
}

function Luck({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
      <span className="shrink-0 text-gray-500">{label}</span>
      <span className="ml-2 text-right font-semibold text-gray-700">{value}</span>
    </div>
  );
}
