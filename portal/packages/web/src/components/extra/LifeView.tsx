import { useMemo } from "react";
import { buildLifeFortune, type LifeFlowPhase } from "../../lib/lifeEngine.js";
import { useProfile } from "../../lib/useProfile.js";
import MyInfoBar from "../MyInfoBar.js";

// 평생운 v3 — 만세 엔진 대운 결합·최대 풍성. 캐릭터·강약점·천직·타고난복·대운곡선·대운별풀이
//   ·분야별·시기별·오행·귀인·명언. 그라데이션 금지(솔리드). 오행 색은 의미색이라 OK.

function now(): { year: number } {
  return { year: new Date().getFullYear() };
}
const EL_BG: Record<string, string> = { 목: "#16a34a", 화: "#dc2626", 토: "#d97706", 금: "#9ca3af", 수: "#1f2937" };
const EL_BAR: Record<string, string> = { 목: "#22c55e", 화: "#ef4444", 토: "#f59e0b", 금: "#9ca3af", 수: "#3b82f6" };

export default function LifeView() {
  const profile = useProfile();
  const { year } = now();
  const r = useMemo(() => (profile?.birth ? buildLifeFortune(profile, year) : null), [profile, year]);

  return (
    <main className="px-4 pb-16 pt-3">
      <MyInfoBar showSaju ctaLabel="생년월일 넣고 평생운세 받기" />

      {r ? (
        <section className="space-y-3">
          {/* ── ⭐인생 캐릭터 유형 + 해시태그 ────────────────── */}
          <div className="rounded-card bg-primary-500/[0.06] p-5 text-center shadow-card ring-1 ring-primary-500/15">
            <p className="text-[11.5px] font-semibold text-primary-500">내 인생 유형</p>
            <p className="mt-1.5 text-[30px] leading-none" aria-hidden>{r.lifeType.emoji}</p>
            <p className="mt-2 text-[20px] font-extrabold text-ink">{r.lifeType.name}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink/88">{r.lifeType.desc}</p>
            <p className="mt-2 text-[13.5px] font-medium text-accent-600">{r.tldr}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {r.hashtags.map((t) => (
                <span key={t} className="rounded-full bg-white px-2.5 py-1 text-[11.5px] font-semibold text-primary-600 ring-1 ring-primary-500/20">{t}</span>
              ))}
            </div>
          </div>

          {/* ── 타고난 기질 ─────────────────────────────────── */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="text-[11.5px] font-semibold text-primary-500">타고난 기질</p>
            <p className="mt-1 text-[15px] font-extrabold text-ink">일간 {r.dayLabel} · {r.gyeokguk} · {r.strengthLabel}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink/88">{r.character}</p>
          </div>

          {/* ── 인생 총평 ───────────────────────────────────── */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-2.5 text-[14px] font-bold text-ink">📜 인생 총평</p>
            <div className="space-y-2.5">
              {r.summaryParas.map((para, i) => <p key={i} className={i === 0 ? "text-[14.5px] font-semibold leading-relaxed text-ink" : "text-[13.5px] leading-relaxed text-ink/88"}>{para}</p>)}
            </div>
          </div>

          {/* ── ⭐타고난 강점 & 약점 ────────────────────────── */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-2.5 text-[14px] font-bold text-ink">💪 타고난 강점 & 보완점</p>
            <p className="mb-1.5 text-[12px] font-bold text-accent-600">강점</p>
            <ul className="mb-3 space-y-1">
              {r.strengths.map((s, i) => <li key={i} className="flex gap-1.5 text-[12.5px] leading-snug text-ink/88"><span className="text-accent-500">✓</span>{s}</li>)}
            </ul>
            <p className="mb-1.5 text-[12px] font-bold text-primary-600">보완하면 좋은 점</p>
            <ul className="space-y-1">
              {r.weaknesses.map((s, i) => <li key={i} className="flex gap-1.5 text-[12.5px] leading-snug text-ink/78"><span className="text-primary-500">·</span>{s}</li>)}
            </ul>
          </div>

          {/* ── ⭐천직·적성 ─────────────────────────────────── */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-2 text-[14px] font-bold text-ink">🎯 타고난 천직·적성</p>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {r.aptitudeJobs.map((j) => <span key={j} className="rounded-full bg-primary-500/[0.08] px-3 py-1 text-[12px] font-semibold text-primary-600 ring-1 ring-primary-500/20">{j}</span>)}
            </div>
            <p className="text-[13px] leading-relaxed text-ink/88">{r.aptitudeText}</p>
          </div>

          {/* ── ⭐타고난 복 5 ───────────────────────────────── */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-3 text-[14px] font-bold text-ink">🍀 타고난 복</p>
            <div className="space-y-3">
              {r.blessings.map((b) => (
                <div key={b.key}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[14px] font-bold text-ink">{b.emoji} {b.label}</span>
                    <span className="text-[13px] font-extrabold text-primary-600">{b.score}</span>
                  </div>
                  <div className="mb-1 h-2 overflow-hidden rounded-full bg-canvas">
                    <div className="h-full rounded-full bg-accent-400" style={{ width: `${b.score}%` }} />
                  </div>
                  <p className="text-[12px] leading-snug text-ink/74">{b.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── ⭐인생 대운 곡선 ────────────────────────────── */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-1 text-[14px] font-bold text-ink">📈 인생 대운 흐름 (10년 단위)</p>
            <p className="mb-3 text-[11.5px] text-ink/62">황금기 <span className="font-bold text-accent-500">{r.goldenAge}</span> · 쉬어갈 때 <span className="font-bold text-ink/70">{r.hardAge}</span></p>
            <div className="-mx-1 overflow-x-auto px-1 pb-1">
              <div className="flex items-end gap-1.5" style={{ height: 128 }}>
                {r.flow.map((f) => <LifeBar key={f.age} f={f} />)}
              </div>
            </div>
            <p className="mt-2 text-[11px] leading-snug text-ink/62">막대가 높을수록 운이 활짝 열리는 시기. 보라 테두리=지금, ★=황금기.</p>
          </div>

          {/* ── ⭐대운별 상세 풀이 ──────────────────────────── */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-3 text-[14px] font-bold text-ink">📖 대운별 인생 풀이</p>
            <div className="space-y-2.5">
              {r.flow.filter((f) => f.age <= 80).map((f) => (
                <div key={f.age} className={["rounded-xl p-3 ring-1", f.isCurrent ? "bg-primary-500/[0.06] ring-primary-500/25" : "bg-canvas ring-black/5"].join(" ")}>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="rounded-md px-1.5 py-0.5 text-[11px] font-bold text-white" style={{ backgroundColor: EL_BG[f.element] ?? "#9ca3af" }}>{f.age}~{f.age + 9}세</span>
                    <span className="text-[12px] font-bold text-primary-600">{f.theme}</span>
                    {f.isCurrent && <span className="rounded-full bg-primary-500 px-1.5 py-0.5 text-[9.5px] font-bold text-white">지금</span>}
                    {f.isPeak && <span className="text-[11px] text-accent-500">★황금기</span>}
                  </div>
                  <p className="text-[12.5px] leading-snug text-ink/88">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── 분야별 평생운 5 ─────────────────────────────── */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-3 text-[14px] font-bold text-ink">분야별 평생운</p>
            <div className="space-y-3">
              {r.fields.map((f) => (
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

          {/* ── 시기별 ──────────────────────────────────────── */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-3 text-[14px] font-bold text-ink">시기별 인생 흐름</p>
            <div className="space-y-2.5">
              {r.periods.map((p) => (
                <div key={p.label} className="flex items-start gap-2.5">
                  <span className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-canvas py-1.5">
                    <span className="text-[12px] font-bold text-primary-600">{p.label}</span>
                    <span className="text-[12px] font-extrabold text-accent-500">{p.score}</span>
                  </span>
                  <div className="pt-0.5">
                    <p className="text-[10.5px] text-ink/58">{p.ageRange}</p>
                    <p className="text-[12.5px] leading-snug text-ink/88">{p.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── 오행 분포 + 개운 ────────────────────────────── */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-1 text-[14px] font-bold text-ink">⚖️ 타고난 오행 균형</p>
            <p className="mb-3 text-[12px] leading-snug text-primary-600">{r.elementTip}</p>
            <div className="space-y-1.5">
              {r.elements.map((e) => (
                <div key={e.element} className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[12px] font-bold text-white" style={{ backgroundColor: EL_BG[e.element] }}>{e.element}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-canvas">
                    <div className="h-full rounded-full" style={{ width: `${e.percent}%`, backgroundColor: EL_BAR[e.element] }} />
                  </div>
                  <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-ink/62">{e.percent}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── 귀인·복 신살 ────────────────────────────────── */}
          {r.lifeSinsal.length > 0 && (
            <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
              <p className="mb-1 text-[14px] font-bold text-ink">💎 타고난 귀인·복</p>
              <p className="mb-3 text-[11.5px] text-ink/62">사주에 새겨진 평생의 길성이에요</p>
              <div className="space-y-2">
                {r.lifeSinsal.map((s, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="mt-px shrink-0 rounded-full bg-accent-500/[0.08] px-2.5 py-1 text-[11.5px] font-bold text-accent-600 ring-1 ring-accent-500/20">{s.name}</span>
                    <span className="text-[12.5px] leading-snug text-ink/88">{s.meaning}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 인생 조언 + 명언 ────────────────────────────── */}
          <div className="rounded-card bg-accent-500/[0.06] p-5 shadow-card ring-1 ring-accent-500/15">
            <p className="mb-1.5 text-[13px] font-semibold text-accent-600">🧭 인생 조언</p>
            <p className="text-[13px] leading-relaxed text-ink/88">{r.advice}</p>
            <p className="mt-3 border-t border-accent-500/15 pt-3 text-center text-[13px] font-medium italic leading-relaxed text-primary-600">“{r.motto}”</p>
          </div>

          {/* ── 상담 CTA ────────────────────────────────────── */}
          <a href="https://sajuplan.com" className="flex flex-col items-center gap-1 rounded-card bg-primary-500/[0.07] px-4 py-4 text-center ring-1 ring-primary-500/20 active:scale-[0.99]">
            <span className="text-[14px] font-semibold text-primary-600">내 인생의 큰 그림·전환점을 더 깊이 보고 싶다면 →</span>
            <span className="text-[12px] text-primary-600/70">대운의 흐름은 전문 상담사와 더 깊이 보세요</span>
          </a>
        </section>
      ) : (
        <p className="mt-2 text-center text-[12.5px] leading-relaxed text-ink/62">생년월일을 한 번만 입력하면 바로 평생운세가 나와요.</p>
      )}

      <p className="mt-6 text-center text-[11px] leading-relaxed text-ink/58">평생운세는 재미·참고용이에요. 더 깊은 풀이는 전문 상담사와 함께하세요.</p>
    </main>
  );
}

function LifeBar({ f }: { f: LifeFlowPhase }) {
  return (
    <div className="flex w-[40px] shrink-0 flex-col items-center">
      <span className="mb-0.5 h-3 text-[9px] font-bold text-accent-500">{f.isPeak ? "★" : ""}</span>
      <div className="flex h-[78px] w-full items-end">
        <div className={["w-full rounded-t-md", f.isCurrent ? "ring-2 ring-primary-500" : ""].join(" ")} style={{ height: `${f.score}%`, backgroundColor: EL_BAR[f.element] ?? "#9ca3af" }} />
      </div>
      <span className="mt-1 text-[9.5px] font-medium text-ink/70">{f.ageLabel}</span>
      <span className="text-[8.5px] leading-tight text-ink/58">{f.theme}</span>
    </div>
  );
}
