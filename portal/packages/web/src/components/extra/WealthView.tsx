import { useMemo } from "react";
import { ballColor } from "@portal/engine";
import { buildWealthFortune, type WealthTiming, type LifetimeFlow } from "../../lib/wealthEngine.js";
import { useProfile } from "../../lib/useProfile.js";
import MyInfoBar from "../MyInfoBar.js";

// 재물운 v3 — 경쟁사 상위호환·최대 풍성. 만세 엔진 결합.
//   총평(롱폼) → 재물 그릇 → 재물 4능력 → 성향 → 돈 버는 방법 → ⭐평생 대운 곡선
//   → 재물 5분야 → 돈 들어오는 시기 → 지출 주의 → 개운 → 행운숫자 → 상담 CTA.
//   ⚠️ 그라데이션 금지(솔리드). 오행 색은 의미색이라 OK.

function now(): { year: number } {
  return { year: new Date().getFullYear() };
}

const EL_BAR: Record<string, string> = { 목: "#22c55e", 화: "#ef4444", 토: "#f59e0b", 금: "#9ca3af", 수: "#3b82f6" };
const KIND_STYLE: Record<WealthTiming["kind"], { bg: string; ring: string; text: string }> = {
  정재: { bg: "bg-accent-500/[0.08]", ring: "ring-accent-500/20", text: "text-accent-600" },
  편재: { bg: "bg-primary-500/[0.08]", ring: "ring-primary-500/20", text: "text-primary-600" },
  식상: { bg: "bg-[#16a34a]/[0.08]", ring: "ring-[#16a34a]/20", text: "text-[#15803d]" },
  협력: { bg: "bg-black/[0.04]", ring: "ring-black/10", text: "text-ink/74" },
  주의: { bg: "bg-[#dc2626]/[0.07]", ring: "ring-[#dc2626]/20", text: "text-[#b91c1c]" },
};

export default function WealthView() {
  const profile = useProfile();
  const { year } = now();
  const r = useMemo(() => (profile?.birth ? buildWealthFortune(profile, year) : null), [profile, year]);

  return (
    <main className="px-4 pb-16 pt-3">
      <MyInfoBar ctaLabel="생년월일 넣고 재물운 받기" showSaju />

      {r ? (
        <section className="space-y-3">
          {/* ── 종합 재물 점수 ──────────────────────────────── */}
          <div className="flex flex-col items-center rounded-card bg-white p-6 shadow-card ring-1 ring-black/5">
            <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-accent-500 text-white">
              <span data-testid="wealth-score" className="text-[30px] font-extrabold leading-none">{r.score}</span>
              <span className="text-[11px] opacity-90">재물운</span>
            </div>
            <p className="mt-3 text-[18px] font-bold text-ink">{r.level}</p>
            <p className="mt-1.5 text-center text-[14px] font-medium leading-relaxed text-accent-600">{r.tldr}</p>
          </div>

          {/* ── ⭐부자 유형 캐릭터 ──────────────────────────── */}
          <div className="rounded-card bg-primary-500/[0.06] p-5 text-center shadow-card ring-1 ring-primary-500/15">
            <p className="text-[11.5px] font-semibold text-primary-500">나의 부자 유형</p>
            <p className="mt-1.5 text-[28px] leading-none" aria-hidden>{r.richType.emoji}</p>
            <p className="mt-2 text-[19px] font-extrabold text-ink">{r.richType.name}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink/88">{r.richType.desc}</p>
          </div>

          {/* ── 롱폼 총평 ───────────────────────────────────── */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-2.5 text-[14px] font-bold text-ink">📜 재물운 총평</p>
            <div className="space-y-2.5">
              {r.summaryParas.map((para, i) => (
                <p key={i} className={i === 0 ? "text-[14.5px] font-semibold leading-relaxed text-ink" : "text-[13.5px] leading-relaxed text-ink/88"}>{para}</p>
              ))}
            </div>
          </div>

          {/* ── 재물 그릇 진단 ──────────────────────────────── */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="text-[11.5px] font-semibold text-primary-500">내 재물 그릇</p>
            <p className="mt-1 text-[17px] font-extrabold text-ink">{r.gradeTitle}</p>
            <p className="mt-0.5 text-[11.5px] font-medium text-ink/62">{r.grade} · 일간 강약 {r.strengthLabel}</p>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink/88">{r.gradeDesc}</p>
          </div>

          {/* ── ⭐재물 4능력 ────────────────────────────────── */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-1 text-[14px] font-bold text-ink">재물 4능력</p>
            <p className="mb-3 text-[11.5px] text-ink/62">돈을 버는·불리는·모으는·지키는 힘을 따로 봤어요</p>
            <div className="space-y-3">
              {r.fourPowers.map((pw) => (
                <div key={pw.key}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[14px] font-bold text-ink">{pw.emoji} {pw.label}</span>
                    <span className="text-[13px] font-extrabold text-primary-600">{pw.score}</span>
                  </div>
                  <div className="mb-1 h-2 overflow-hidden rounded-full bg-canvas">
                    <div className="h-full rounded-full bg-accent-400" style={{ width: `${pw.score}%` }} />
                  </div>
                  <p className="text-[12px] leading-snug text-ink/74">{pw.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── 재물 성향(정재/편재) ────────────────────────── */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[14px] font-bold text-ink">재물 성향</p>
              <span className="text-[12px] font-bold text-primary-600">{r.tendency}</span>
            </div>
            <p className="mb-3 text-[12.5px] leading-relaxed text-ink/88">{r.tendencyText}</p>
            <div className="space-y-2">
              {[
                { label: "정재 (안정 수입)", v: r.jeongjaePct, c: "#ec4899" },
                { label: "편재 (사업·투자)", v: r.pyeonjaePct, c: "#8259F5" },
              ].map((x) => (
                <div key={x.label} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-[11.5px] font-medium text-ink/70">{x.label}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-canvas">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, x.v * 2.2)}%`, backgroundColor: x.c }} />
                  </div>
                  <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-ink/62">{x.v}%</span>
                </div>
              ))}
            </div>
            {r.siksangText && (
              <p className="mt-3 rounded-xl bg-[#16a34a]/[0.06] px-3 py-2 text-[12px] leading-snug text-[#15803d] ring-1 ring-[#16a34a]/15">💡 {r.siksangText}</p>
            )}
          </div>

          {/* ── 소비·투자 성향 ──────────────────────────────── */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-3 text-[14px] font-bold text-ink">소비 · 투자 성향</p>
            <div className="space-y-4">
              {[r.spending, r.investing].map((g, i) => (
                <div key={i}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[12.5px] font-semibold text-primary-600">{g.label}</span>
                  </div>
                  <div className="relative h-2.5 overflow-hidden rounded-full bg-canvas">
                    <div className="h-full rounded-full bg-accent-400" style={{ width: `${g.value}%` }} />
                  </div>
                  <div className="mt-0.5 flex justify-between text-[10px] text-ink/58">
                    <span>{g.leftLabel}</span>
                    <span>{g.rightLabel}</span>
                  </div>
                  <p className="mt-1.5 text-[12px] leading-snug text-ink/78">{g.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── 돈 버는 방법(분야·수단) ─────────────────────── */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-2 text-[14px] font-bold text-ink">💼 나에게 맞는 돈 버는 방법</p>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {r.earningMethods.map((m) => (
                <span key={m} className="rounded-full bg-primary-500/[0.08] px-3 py-1 text-[12px] font-semibold text-primary-600 ring-1 ring-primary-500/20">{m}</span>
              ))}
            </div>
            <p className="text-[13px] leading-relaxed text-ink/88">{r.earningText}</p>
          </div>

          {/* ── ⭐재물 신살·귀인 ────────────────────────────── */}
          {r.wealthSinsal.length > 0 && (
            <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
              <p className="mb-1 text-[14px] font-bold text-ink">💎 재물 신살·귀인</p>
              <p className="mb-3 text-[11.5px] text-ink/62">사주에 새겨진 재물 관련 특별한 기운이에요</p>
              <div className="space-y-2">
                {r.wealthSinsal.map((s, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span
                      className={[
                        "mt-px shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-bold ring-1",
                        s.name === "재고귀인"
                          ? "bg-accent-500 text-white ring-accent-500"
                          : s.good
                            ? "bg-accent-500/[0.08] text-accent-600 ring-accent-500/20"
                            : "bg-[#dc2626]/[0.07] text-[#b91c1c] ring-[#dc2626]/20",
                      ].join(" ")}
                    >
                      {s.name}
                    </span>
                    <span className="text-[12.5px] leading-snug text-ink/88">{s.meaning}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ⭐기둥별 재물 위치(시기) ─────────────────────── */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-1 text-[14px] font-bold text-ink">🕰️ 재물이 강한 시기 (사주 기둥)</p>
            <p className="mb-3 text-[12.5px] leading-snug text-primary-600">{r.pillarWealthText}</p>
            <div className="grid grid-cols-4 gap-1.5 text-center">
              {r.pillarWealth.map((p) => (
                <div
                  key={p.period}
                  className={[
                    "rounded-xl px-1 py-2 ring-1",
                    p.has ? "bg-accent-500/[0.08] ring-accent-500/25" : "bg-canvas ring-black/5",
                  ].join(" ")}
                >
                  <p className={["text-[11px] font-bold", p.has ? "text-accent-600" : "text-ink/58"].join(" ")}>{p.period.split(" ")[0]}</p>
                  <p className="mt-0.5 text-[9.5px] leading-tight text-ink/62">{p.period.match(/\((.+)\)/)?.[1]}</p>
                  <p className={["mt-1 text-[10px] font-semibold", p.has ? "text-accent-500" : "text-ink/30"].join(" ")}>{p.has ? p.tenGod : "—"}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── ⭐평생 재물 흐름(대운 곡선) ──────────────────── */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-1 text-[14px] font-bold text-ink">📈 평생 재물 흐름 (10년 대운)</p>
            <p className="mb-3 text-[11.5px] text-ink/62">
              인생 재물 황금기는 <span className="font-bold text-accent-500">{r.goldenAge}</span>예요
            </p>
            <div className="-mx-1 overflow-x-auto px-1 pb-1">
              <div className="flex items-end gap-1.5" style={{ height: 118 }}>
                {r.lifetimeFlow.map((f) => (
                  <LifeBar key={f.age} f={f} />
                ))}
              </div>
            </div>
            <p className="mt-2 text-[11px] leading-snug text-ink/62">막대가 높을수록 재물 기운이 강한 시기예요. 보라 테두리=지금, ★=황금기.</p>
          </div>

          {/* ── 재물 5분야 ──────────────────────────────────── */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-3 text-[14px] font-bold text-ink">분야별 재물운</p>
            <div className="space-y-3">
              {r.wealthFields.map((f) => (
                <div key={f.key}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[14px] font-bold text-ink">{f.emoji} {f.label}</span>
                    <span className="text-[13px] font-extrabold text-primary-600">{f.score}점</span>
                  </div>
                  <div className="mb-1 h-2 overflow-hidden rounded-full bg-canvas">
                    <div className="h-full rounded-full bg-accent-400" style={{ width: `${f.score}%` }} />
                  </div>
                  <p className="text-[12px] leading-snug text-ink/74">{f.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── 돈 들어오는 시기 ────────────────────────────── */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-1 text-[14px] font-bold text-ink">💸 돈이 들어오는 시기</p>
            <p className="mb-3 text-[11.5px] text-ink/62">세운(해)·월운(달)에 재물·재능의 기운이 드는 때</p>
            {r.incomeYears.length > 0 ? (
              <div className="space-y-1.5">
                {r.incomeYears.map((t, i) => <TimingRow key={`y${i}`} t={t} />)}
              </div>
            ) : (
              <p className="text-[12.5px] text-ink/70">향후 9년간 큰 재성운보다는 꾸준히 다지는 흐름이에요. 저축형이 유리해요.</p>
            )}
            {r.incomeMonths.length > 0 && (
              <div className="mt-3 border-t border-black/5 pt-3">
                <p className="mb-2 text-[12px] font-semibold text-accent-500">{r.thisYear}년 좋은 달</p>
                <div className="flex flex-wrap gap-1.5">
                  {r.incomeMonths.map((m, i) => {
                    const s = KIND_STYLE[m.kind];
                    return <span key={`m${i}`} className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1 ${s.bg} ${s.ring} ${s.text}`}>{m.when} <span className="opacity-70">{m.tenGod}</span></span>;
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── 군겁쟁재 손재 경고 ──────────────────────────── */}
          {r.gunGyeop && r.gunGyeopText && (
            <div className="rounded-card bg-[#dc2626]/[0.05] p-5 shadow-card ring-1 ring-[#dc2626]/20">
              <p className="mb-1.5 text-[13px] font-semibold text-[#b91c1c]">🚨 손재 주의 (군겁쟁재)</p>
              <p className="text-[12.5px] leading-relaxed text-ink/88">{r.gunGyeopText}</p>
            </div>
          )}

          {/* ── 지출·주의 시기 ──────────────────────────────── */}
          {r.cautionYears.length > 0 && (
            <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
              <p className="mb-2.5 text-[14px] font-bold text-ink">⚠️ 지출·관리 주의 시기</p>
              <div className="space-y-1.5">
                {r.cautionYears.map((t, i) => <TimingRow key={`c${i}`} t={t} />)}
              </div>
            </div>
          )}

          {/* ── 재물 개운법 ─────────────────────────────────── */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-2.5 text-[14px] font-bold text-ink">🍀 재물 개운법</p>
            <div className="mb-3 grid grid-cols-3 gap-2 text-center">
              {[
                { k: "행운 색", v: r.lucky.color },
                { k: "행운 방향", v: r.lucky.direction },
                { k: "행운 숫자", v: r.lucky.numbers.join("·") },
              ].map((x) => (
                <div key={x.k} className="rounded-xl bg-canvas px-2 py-2.5">
                  <p className="text-[10.5px] text-ink/62">{x.k}</p>
                  <p className="mt-0.5 text-[12.5px] font-bold text-primary-600">{x.v}</p>
                </div>
              ))}
            </div>
            <p className="text-[12.5px] leading-relaxed text-ink/88">{r.gaewoonTip}</p>
          </div>

          {/* ── 재물 행운 숫자 ──────────────────────────────── */}
          <div className="flex items-center gap-3 rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <span className="shrink-0 text-[12.5px] text-ink/66">재물 행운 숫자</span>
            <div className="flex gap-1.5">
              {r.luckyNumbers.map((n) => (
                <span key={n} className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold text-white" style={{ backgroundColor: ballColor(n) }}>{n}</span>
              ))}
            </div>
          </div>

          {/* ── 상담 CTA ────────────────────────────────────── */}
          <a href="https://sajuplan.com" className="flex flex-col items-center gap-1 rounded-card bg-primary-500/[0.07] px-4 py-4 text-center ring-1 ring-primary-500/20 active:scale-[0.99]">
            <span className="text-[14px] font-semibold text-primary-600">내 재물 그릇 키우는 법·투자 적기가 궁금하다면 →</span>
            <span className="text-[12px] text-primary-600/70">큰돈의 흐름은 전문 상담사와 더 깊이 보세요</span>
          </a>
        </section>
      ) : (
        <p className="mt-2 text-center text-[12.5px] leading-relaxed text-ink/62">생년월일을 한 번만 입력하면 바로 재물운이 나와요.</p>
      )}

      <p className="mt-6 text-center text-[11px] leading-relaxed text-ink/58">재물운은 재미·참고용이에요. 더 깊은 풀이는 전문 상담사와 함께하세요.</p>
    </main>
  );
}

function LifeBar({ f }: { f: LifetimeFlow }) {
  return (
    <div className="flex w-[42px] shrink-0 flex-col items-center">
      <span className="mb-0.5 h-3 text-[9px] font-bold text-accent-500">{f.isPeak ? "★" : ""}</span>
      <div className="flex h-[72px] w-full items-end">
        <div
          className={["w-full rounded-t-md", f.isCurrent ? "ring-2 ring-primary-500" : ""].join(" ")}
          style={{ height: `${f.score}%`, backgroundColor: EL_BAR[f.element] ?? "#9ca3af" }}
        />
      </div>
      <span className="mt-1 text-[9.5px] font-medium text-ink/70">{f.ageLabel}</span>
      <span className="text-[8.5px] leading-tight text-ink/58">{f.tenGod}</span>
    </div>
  );
}

function TimingRow({ t }: { t: WealthTiming }) {
  const s = KIND_STYLE[t.kind];
  return (
    <div className="flex items-center gap-2.5">
      <span className={`w-14 shrink-0 rounded-lg px-2 py-1 text-center text-[12px] font-bold ring-1 ${s.bg} ${s.ring} ${s.text}`}>{t.when}</span>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${s.text}`}>{t.tenGod}</span>
      <span className="text-[12.5px] leading-snug text-ink/88">{t.text}</span>
    </div>
  );
}
