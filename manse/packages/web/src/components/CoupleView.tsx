import { useEffect, useState } from "react";
import { computeCompatibility, lunarToSolar, type CompatibilityResult, type ManseInput } from "@manse/engine";
import { STEM_TRAIT } from "../lib/interpret.js";

const SUMMARY: Record<string, string> = {
  "천생연분": "서로를 깊이 끌어당기는, 천생연분에 가까운 궁합이에요.",
  "좋은 궁합": "결이 잘 맞아 함께 있을수록 편안해지는 좋은 궁합이에요.",
  "무난한 궁합": "노력하면 충분히 좋아지는 무난한 궁합이에요. 서로의 차이를 인정하는 게 열쇠예요.",
  "노력이 필요한 궁합": "다른 점이 많아 이해와 배려가 더 필요한 관계예요. 그 차이가 오히려 서로를 키워줄 수 있어요.",
};

function CoupleReading({ res }: { res: CompatibilityResult }) {
  const a = res.a, b = res.b;
  const aKo = a.pillars.day.stem.ko, bKo = b.pillars.day.stem.ko;
  const strongOf = (c: typeof a) => c.analysis.elements.filter((e) => e.level === "발달" || e.level === "과다").map((e) => e.element);
  const lackOf = (c: typeof a) => c.analysis.elements.filter((e) => e.level === "부족").map((e) => e.element);
  const aStrong = strongOf(a), bStrong = strongOf(b);
  const bFillsA = lackOf(a).filter((el) => bStrong.includes(el));
  const aFillsB = lackOf(b).filter((el) => aStrong.includes(el));
  const shared = aStrong.filter((el) => bStrong.includes(el));

  let oh: string;
  if (bFillsA.length || aFillsB.length) {
    const parts: string[] = [];
    if (bFillsA.length) parts.push(`상대가 내게 부족한 ${bFillsA.join("·")} 기운을 채워주고`);
    if (aFillsB.length) parts.push(`나는 상대의 부족한 ${aFillsB.join("·")} 기운을 채워줘요`);
    oh = parts.join(", ") + ". 서로 모자란 곳을 메워주는 보완형이에요.";
  } else if (shared.length) {
    oh = `둘 다 ${shared.join("·")} 기운이 강해 통하는 부분이 많아요. 비슷한 만큼 같은 지점에서 부딪히지 않도록 양보가 필요해요.`;
  } else {
    oh = "오행 기운의 결이 서로 달라, 차이를 이해하면 새로운 자극과 배움이 되는 관계예요.";
  }
  const tip = res.compat.score >= 65
    ? "지금의 좋은 흐름을 믿고 솔직하게 마음을 표현해 보세요."
    : "다름을 탓하기보다 ‘왜 그럴까’ 한 번 더 헤아리면 관계가 한결 부드러워져요.";

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
        <span className="h-3.5 w-1 rounded-full bg-accent-500" />궁합 풀이
      </h3>
      <p className="mb-3 text-[13px] leading-relaxed text-gray-600">{SUMMARY[res.compat.level] ?? "두 사람의 사주를 비교한 결과예요."}</p>
      <div className="mb-3 space-y-1.5 rounded-xl bg-gray-50 p-3">
        <p className="text-[13px] leading-relaxed text-gray-600"><b className="text-gray-800">나 · {a.pillars.day.stem.hanja}({aKo})</b> — {STEM_TRAIT[aKo]}</p>
        <p className="text-[13px] leading-relaxed text-gray-600"><b className="text-gray-800">상대 · {b.pillars.day.stem.hanja}({bKo})</b> — {STEM_TRAIT[bKo]}</p>
      </div>
      <p className="mb-3 text-[13px] leading-relaxed text-gray-600"><b className="text-primary-600">오행 궁합</b> — {oh}</p>
      <p className="flex items-start gap-1.5 rounded-lg bg-accent-50 px-3 py-2 text-[13px] text-gray-600">
        <span className="shrink-0 font-semibold text-accent-500">조언</span><span>{tip}</span>
      </p>
    </div>
  );
}

type Cal = "solar" | "lunar" | "lunarLeap";

interface Person {
  y: string; m: string; d: string;
  cal: Cal;
  ampm: "AM" | "PM"; h: string; mi: string;
  unknownHour: boolean; gender: "M" | "F";
}

const blank = (g: "M" | "F"): Person => ({ y: "1990", m: "06", d: "15", cal: "solar", ampm: "AM", h: "7", mi: "20", unknownHour: false, gender: g });
const pad = (s: string) => s.padStart(2, "0");
const onlyD = (s: string) => s.replace(/\D/g, "");

function toInput(p: Person) {
  let H = 12, M = "00";
  if (!p.unknownHour) {
    let h = parseInt(p.h || "0", 10) % 12;
    if (p.ampm === "PM") h += 12;
    H = h; M = p.mi || "0";
  }
  // 음력 입력은 양력으로 변환 후 계산 (만세력 탭과 동일)
  let y = parseInt(p.y || "0", 10), mo = parseInt(p.m || "1", 10) || 1, da = parseInt(p.d || "1", 10) || 1;
  if (p.cal !== "solar") {
    try {
      const s = lunarToSolar(y, mo, da, p.cal === "lunarLeap");
      y = s.year; mo = s.month; da = s.day;
    } catch {
      throw new Error("음력 날짜를 양력으로 바꾸지 못했습니다. 날짜를 확인해 주세요.");
    }
  }
  return { birth: `${pad(String(y))}-${pad(String(mo))}-${pad(String(da))}T${pad(String(H))}:${pad(M)}`, gender: p.gender, longitude: 127, unknownHour: p.unknownHour };
}

// 공유 링크/공용 입력의 birth 는 항상 양력 → cal="solar"
function fromIso(birth: string, gender: "M" | "F"): Person {
  const m = /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(birth);
  if (!m) return blank(gender);
  const H = Number(m[4]);
  const h12 = H % 12 === 0 ? 12 : H % 12;
  return { y: m[1]!, m: m[2]!, d: m[3]!, cal: "solar", ampm: H < 12 ? "AM" : "PM", h: String(h12), mi: m[5]!, unknownHour: false, gender };
}

function PersonFields({ title, p, set }: { title: string; p: Person; set: (p: Person) => void }) {
  const num = "w-14 rounded-lg border border-gray-200 px-2 py-1.5 text-center text-sm tabular-nums outline-none focus:border-primary-400";
  return (
    <div className="rounded-xl bg-gray-50 p-3">
      <div className="mb-2 text-sm font-semibold text-gray-700">{title}</div>
      <div className="mb-2 flex gap-1 rounded-lg bg-white p-0.5 ring-1 ring-gray-200">
        {([["solar", "양력"], ["lunar", "음력"], ["lunarLeap", "음력 윤달"]] as const).map(([v, label]) => (
          <button
            key={v} type="button" onClick={() => set({ ...p, cal: v })}
            className={`flex-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium transition ${
              p.cal === v ? "bg-accent-500 text-white" : "text-gray-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mb-2 flex items-center gap-1">
        <input inputMode="numeric" value={p.y} onChange={(e) => set({ ...p, y: onlyD(e.target.value).slice(0, 4) })} className={`${num} w-16`} placeholder="YYYY" />
        <span className="text-xs text-gray-400">.</span>
        <input inputMode="numeric" value={p.m} onChange={(e) => set({ ...p, m: onlyD(e.target.value).slice(0, 2) })} className={num} placeholder="MM" />
        <span className="text-xs text-gray-400">.</span>
        <input inputMode="numeric" value={p.d} onChange={(e) => set({ ...p, d: onlyD(e.target.value).slice(0, 2) })} className={num} placeholder="DD" />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <div className={`flex rounded-lg bg-white p-0.5 ring-1 ring-gray-200 ${p.unknownHour ? "opacity-40" : ""}`}>
          {(["AM", "PM"] as const).map((a) => (
            <button key={a} disabled={p.unknownHour} onClick={() => set({ ...p, ampm: a })}
              className={`rounded-md px-2 py-1 text-xs font-medium ${p.ampm === a ? "bg-accent-500 text-white" : "text-gray-500"}`}>
              {a === "AM" ? "오전" : "오후"}
            </button>
          ))}
        </div>
        <input inputMode="numeric" value={p.h} disabled={p.unknownHour} onChange={(e) => set({ ...p, h: onlyD(e.target.value).slice(0, 2) })} className={`${num} disabled:bg-gray-100`} placeholder="시" />
        <input inputMode="numeric" value={p.mi} disabled={p.unknownHour} onChange={(e) => set({ ...p, mi: onlyD(e.target.value).slice(0, 2) })} className={`${num} disabled:bg-gray-100`} placeholder="분" />
        <label className="flex items-center gap-1 text-xs text-gray-500"><input type="checkbox" className="accent-accent-500" checked={p.unknownHour} onChange={(e) => set({ ...p, unknownHour: e.target.checked })} />모름</label>
        <div className="ml-auto flex gap-1">
          {(["M", "F"] as const).map((g) => (
            <button key={g} onClick={() => set({ ...p, gender: g })}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ring-1 ${p.gender === g ? "bg-accent-500 text-white ring-accent-500" : "bg-white text-gray-500 ring-gray-200"}`}>
              {g === "M" ? "남" : "여"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CoupleView({ sharedInput }: { sharedInput?: ManseInput | null }) {
  const [a, setA] = useState<Person>(() => (sharedInput ? fromIso(sharedInput.birth, sharedInput.gender) : blank("F")));
  const [b, setB] = useState<Person>(blank("M"));
  const [res, setRes] = useState<CompatibilityResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [shareToast, setShareToast] = useState(false);

  // 공용 입력(다른 탭에서 넣은 정보)이 있으면 '나'를 자동으로 채운다
  useEffect(() => {
    if (sharedInput) setA(fromIso(sharedInput.birth, sharedInput.gender));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedInput?.birth, sharedInput?.gender]);

  function run() {
    try { setErr(null); setRes(computeCompatibility(toInput(a), toInput(b))); }
    catch (e) { setRes(null); setErr((e as Error).message); }
  }

  // 공유 링크로 들어오면 두 사람 자동 입력 + 계산
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const ab = q.get("ab"), bb = q.get("bb");
    if (ab && bb) {
      const pa = fromIso(ab, q.get("ag") === "M" ? "M" : "F");
      const pb = fromIso(bb, q.get("bg") === "M" ? "M" : "F");
      setA(pa); setB(pb);
      try { setRes(computeCompatibility(toInput(pa), toInput(pb))); } catch { /* 무시 */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 결과 공유 — 두 사람 정보가 담긴 링크(받은 사람이 열면 같은 궁합 표시). 카톡 카드 위해 title+url만.
  async function share() {
    const params = new URLSearchParams({ m: "couple", ab: toInput(a).birth, ag: a.gender, bb: toInput(b).birth, bg: b.gender });
    const url = `${window.location.origin}/?${params.toString()}`;
    try { if (navigator.share) { await navigator.share({ title: "무료 궁합 — 사주플랜", url }); return; } } catch { return; }
    try { await navigator.clipboard.writeText(url); setShareToast(true); window.setTimeout(() => setShareToast(false), 1800); } catch { /* 무시 */ }
  }

  const scoreColor = (s: number) => (s >= 80 ? "#10b981" : s >= 65 ? "#8259F5" : s >= 50 ? "#f59e0b" : "#f43f5e");

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <div className="grid gap-3 sm:grid-cols-2">
          <PersonFields title="나" p={a} set={setA} />
          <PersonFields title="상대" p={b} set={setB} />
        </div>
        <button onClick={run} className="mt-4 w-full rounded-full bg-accent-500 py-2.5 font-semibold text-white shadow-sm transition hover:bg-accent-600">궁합 보기</button>
      </div>

      {err && <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600 ring-1 ring-rose-100">{err}</div>}

      {res && (
        <>
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-gray-100">
            <div className="text-sm text-gray-400">궁합 점수 (참고)</div>
            <div className="my-1 text-5xl font-extrabold" style={{ color: scoreColor(res.compat.score) }}>{res.compat.score}</div>
            <div className="text-lg font-bold" style={{ color: scoreColor(res.compat.score) }}>{res.compat.level}</div>
            <div className="mt-3 flex items-center justify-center gap-6">
              {[res.a, res.b].map((c, i) => (
                <div key={i} className="text-center">
                  <div className="text-xs text-gray-400">{i === 0 ? "나" : "상대"}</div>
                  <div className="font-hanja text-2xl font-extrabold text-gray-800">{c.pillars.day.ganzhi}</div>
                  <div className="text-xs text-gray-500">{c.analysis.gyeokguk}</div>
                </div>
              ))}
            </div>
            <button onClick={share} className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-accent-500 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-accent-600">
              📤 궁합 결과 공유
            </button>
          </div>

          <CoupleReading res={res} />

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
              <span className="h-3.5 w-1 rounded-full bg-accent-500" />궁합 요인
            </h3>
            <div className="space-y-1.5">
              {res.compat.factors.map((f, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{f.label}</span>
                  <span className={`font-semibold ${f.delta >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                    {f.delta >= 0 ? "+" : ""}{f.delta}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-gray-400">* 궁합은 참고용입니다. 자세한 풀이는 전문가 상담을 권장합니다.</p>
          </div>

          {/* 상담 전환 — 감정 고조 시점에 깊은 질문은 상담으로 (맛보기 설계) */}
          <div className="rounded-2xl bg-gradient-to-br from-accent-500 to-primary-500 p-5 text-white shadow-sm">
            <div className="text-base font-bold">이 인연, 더 깊이 알고 싶다면?</div>
            <p className="mt-1 text-[13px] leading-relaxed text-white/90">점수만으로는 알 수 없는 두 분의 진짜 이야기는 전문가 상담에서 확인하세요.</p>
            <ul className="mt-3 space-y-1.5 text-[13px] text-white/95">
              <li>💍 결혼해도 좋은 인연인지 · 좋은 시기</li>
              <li>⚡ 갈등·이별수와 슬기롭게 넘기는 법</li>
              <li>🔮 두 사람의 자녀운·재물운 궁합</li>
            </ul>
            <a href="https://sajuplan.com" className="mt-4 block rounded-full bg-white py-2.5 text-center font-bold text-accent-500 transition hover:bg-gray-50">전문가에게 궁합 물어보기</a>
          </div>
        </>
      )}
      {shareToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-gray-900/90 px-4 py-2 text-sm text-white shadow-lg">링크를 복사했어요 — 붙여넣기 하세요</div>
      )}
    </div>
  );
}
