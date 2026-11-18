import { useEffect, useMemo, useState } from "react";
import { ballColor } from "@portal/engine";
import { useProfile } from "../../lib/useProfile.js";
import { buildCoupleFortune, type ManseChart } from "../../lib/coupleEngine.js";
import MyInfoBar from "../MyInfoBar.js";
import DateField from "../DateField.js";
import { shareResult } from "../../lib/share.js";

// 궁합 v3 — 읽을거리·재미 가득. 만세 엔진 결합.
//   캐릭터+해시태그 → 롱폼 서사 → 일간 십성 관계(상대는 나에게) → 인연 코드(천간합·일지 합충)
//   → 두 명식 → 연애 스타일 → 상대 대하는 법 → 속궁합 → 오행 상보 → 신살 케미 → 분야별
//   → 관계 타임라인 → 위기와 극복 → 전생 인연 → 좋은점/조심 → 행운숫자/공유 → 상담 CTA.
//   ⚠️ 이름 핑크 금지(보라/진회색). 오행 의미색 빨강 예외 OK. 그라데이션 금지(솔리드).

const EL_BG: Record<string, string> = { 목: "#16a34a", 화: "#dc2626", 토: "#d97706", 금: "#9ca3af", 수: "#1f2937" };
const EL_BAR: Record<string, string> = { 목: "#22c55e", 화: "#ef4444", 토: "#f59e0b", 금: "#9ca3af", 수: "#3b82f6" };

function partnerFromHash(): string {
  // 새 경로(/couple?p=) search + 옛 해시(#/couple?p=) 둘 다 지원
  const m = /[?&]p=(\d{4}-\d{2}-\d{2})/.exec(window.location.search + window.location.hash);
  return m ? m[1]! : "";
}

export default function CoupleView() {
  const profile = useProfile();
  const [you, setYou] = useState<string>(partnerFromHash);
  const [submitted, setSubmitted] = useState<string>(partnerFromHash() ? partnerFromHash() : "");
  const [copied, setCopied] = useState(false);

  const r = useMemo(
    () => (profile?.birth && submitted ? buildCoupleFortune(profile, submitted) : null),
    [profile, submitted],
  );

  useEffect(() => {
    const p = partnerFromHash();
    if (p && !submitted) {
      setYou(p);
      setSubmitted(p);
    }
  }, [submitted]);

  function run() {
    if (!profile?.birth || !you) return;
    setSubmitted(you);
  }
  async function share() {
    if (!submitted) return;
    const base = `${window.location.origin}/couple?p=${submitted}`; // 상대 생일 포함 딥링크
    const res = await shareResult("궁합 — 사주플랜", "우리 궁합 결과를 확인해보세요 💞", base);
    if (res === "copied") { setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
  }

  return (
    <main className="px-4 pb-16 pt-3">
      <MyInfoBar ctaLabel="내 생년월일 넣고 궁합 보기" showSaju />

      {profile?.birth ? (
        <section className="rounded-card bg-white p-4 shadow-card ring-1 ring-black/5">
          <p className="text-[13px] font-medium text-ink">상대의 생년월일을 입력하세요</p>
          <div className="mt-3 flex items-center gap-2">
            <span className="w-10 shrink-0 text-[13px] font-semibold text-primary-500">상대</span>
            <DateField value={you} onChange={setYou} aria-label="상대 생년월일" className="w-[150px] rounded-xl border border-black/10 bg-canvas px-3 py-2.5 text-center text-[15px] tracking-wide text-ink outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/30" />
            <button type="button" onClick={run} disabled={!you} className="shrink-0 rounded-xl bg-accent-500 px-5 py-2.5 text-[14px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-40">궁합 보기</button>
          </div>
        </section>
      ) : (
        <p className="mt-2 text-center text-[12.5px] leading-relaxed text-ink/62">내 생년월일을 한 번만 입력하면, 상대만 넣어 바로 궁합을 볼 수 있어요.</p>
      )}

      {r && (
        <section className="mt-4 space-y-3">
          {/* ── 종합 점수 + 겉/속궁합 ───────────────────────── */}
          <div className="flex flex-col items-center rounded-card bg-white p-6 shadow-card ring-1 ring-black/5">
            <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-accent-500 text-white">
              <span data-testid="couple-score" className="text-[34px] font-extrabold leading-none">{r.score}</span>
              <span className="text-[12px] opacity-90">점</span>
            </div>
            <p className="mt-3 text-[19px] font-bold text-ink">{r.level}</p>
            <p className="mt-1.5 text-center text-[14px] font-medium leading-relaxed text-accent-600">{r.tldr}</p>
            <div className="mt-4 grid w-full grid-cols-2 gap-2">
              {[{ label: "겉궁합 (띠)", v: r.outerScore, hint: "첫인상·분위기" }, { label: "속궁합 (일주)", v: r.innerScore, hint: "깊은 속마음" }].map((x) => (
                <div key={x.label} className="rounded-xl bg-canvas px-3 py-2.5 text-center">
                  <p className="text-[11.5px] font-medium text-ink/66">{x.label}</p>
                  <p className="mt-0.5 text-[20px] font-extrabold text-primary-600">{x.v}</p>
                  <p className="text-[10px] text-ink/58">{x.hint}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── ⭐궁합 유형 캐릭터 + 해시태그 ────────────────── */}
          <div className="rounded-card bg-primary-500/[0.06] p-5 text-center shadow-card ring-1 ring-primary-500/15">
            <p className="text-[11.5px] font-semibold text-primary-500">우리 궁합 유형</p>
            <p className="mt-1.5 text-[30px] leading-none" aria-hidden>{r.coupleType.emoji}</p>
            <p className="mt-2 text-[20px] font-extrabold text-ink">{r.coupleType.name}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink/88">{r.coupleType.desc}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {r.hashtags.map((t) => (
                <span key={t} className="rounded-full bg-white px-2.5 py-1 text-[11.5px] font-semibold text-primary-600 ring-1 ring-primary-500/20">{t}</span>
              ))}
            </div>
          </div>

          {/* ── ⭐롱폼 종합 서사 ────────────────────────────── */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-2.5 text-[14px] font-bold text-ink">📖 두 사람 이야기</p>
            <div className="space-y-2.5">
              {r.narrative.map((para, i) => (
                <p key={i} className={i === 0 ? "text-[14.5px] font-semibold leading-relaxed text-ink" : "text-[13.5px] leading-relaxed text-ink/88"}>{para}</p>
              ))}
            </div>
          </div>

          {/* ── ⭐일간 십성 관계(상대는 나에게) ──────────────── */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-1 text-[14px] font-bold text-ink">💑 서로에게 어떤 사람일까</p>
            <p className="mb-3 text-[11.5px] text-ink/62">일간 관계로 본 두 사람의 역할 (관계의 핵심)</p>
            <div className="space-y-2.5">
              <div className="rounded-xl bg-accent-500/[0.06] p-3 ring-1 ring-accent-500/15">
                <p className="text-[11.5px] font-bold text-accent-600">상대 → 나 <span className="ml-1 font-semibold opacity-70">({r.tenGodToMe.tenGod})</span></p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink/88">{r.tenGodToMe.text}</p>
              </div>
              <div className="rounded-xl bg-primary-500/[0.06] p-3 ring-1 ring-primary-500/15">
                <p className="text-[11.5px] font-bold text-primary-600">나 → 상대 <span className="ml-1 font-semibold opacity-70">({r.tenGodToPartner.tenGod})</span></p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink/88">{r.tenGodToPartner.text}</p>
              </div>
            </div>
          </div>

          {/* ── ⭐인연 코드(천간합·일지 합충) ────────────────── */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-1 text-[14px] font-bold text-ink">🔗 두 사람을 잇는 인연 코드</p>
            <p className="mb-3 text-[11.5px] text-ink/62">사주에 새겨진 합·충 — 끌림과 부딪힘의 비밀</p>
            <div className="space-y-2">
              {r.bondCodes.map((c, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={["mt-px shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-bold ring-1", c.strong ? (c.good ? "bg-accent-500 text-white ring-accent-500" : "bg-[#dc2626] text-white ring-[#dc2626]") : c.good ? "bg-accent-500/[0.08] text-accent-600 ring-accent-500/20" : "bg-[#dc2626]/[0.07] text-[#b91c1c] ring-[#dc2626]/20"].join(" ")}>{c.name}</span>
                  <span className="text-[12.5px] leading-snug text-ink/88">{c.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── 두 사람 명식 미니 ───────────────────────────── */}
          <div className="grid grid-cols-2 gap-2">
            <MiniChart who={profile?.name || "나"} chart={r.a} accent />
            <MiniChart who="상대" chart={r.b} />
          </div>

          {/* ── 연애 스타일 ─────────────────────────────────── */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-3 text-[14px] font-bold text-ink">💕 두 사람의 연애 스타일</p>
            <div className="space-y-2.5">
              {r.loveStyles.map((s, i) => (
                <div key={i} className="rounded-xl bg-canvas p-3">
                  <p className="text-[12px] font-bold text-primary-600">{s.title}</p>
                  <p className="mt-1 text-[12.5px] leading-snug text-ink/88">{s.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── 상대를 대하는 법 ────────────────────────────── */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-3 text-[14px] font-bold text-ink">🗝️ 마음을 여는 법</p>
            <div className="space-y-2.5">
              {r.treatTips.map((s, i) => (
                <div key={i}>
                  <p className="text-[12.5px] font-bold text-accent-600">{s.title}</p>
                  <p className="mt-0.5 text-[12.5px] leading-snug text-ink/88">{s.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── 속궁합 케미 ─────────────────────────────────── */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[14px] font-bold text-ink">💞 속궁합 케미</p>
              <span className="text-[13px] font-extrabold text-primary-600">{r.intimacyScore}점</span>
            </div>
            <div className="mb-2 h-2 overflow-hidden rounded-full bg-canvas">
              <div className="h-full rounded-full bg-accent-400" style={{ width: `${r.intimacyScore}%` }} />
            </div>
            <p className="text-[12.5px] leading-relaxed text-ink/88">{r.intimacyText}</p>
          </div>

          {/* ── 오행 상보 그래프 ────────────────────────────── */}
          <div className="rounded-card bg-white p-4 shadow-card ring-1 ring-black/5">
            <p className="mb-1 text-[14px] font-bold text-ink">오행 상보 — 부족함을 채워줘요</p>
            <p className="mb-3 text-[12px] leading-snug text-primary-600">{r.complementText}</p>
            <div className="space-y-1.5">
              {r.elementSums.map((e) => (
                <div key={e.element} className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[12px] font-bold text-white" style={{ backgroundColor: EL_BG[e.element] }}>{e.element}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-canvas">
                    <div className="h-full rounded-full" style={{ width: `${e.percent}%`, backgroundColor: EL_BAR[e.element] }} />
                  </div>
                  <span className="w-16 shrink-0 text-right text-[10.5px] tabular-nums text-ink/62">나 {e.a} · 상대 {e.b}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── 신살 케미 ───────────────────────────────────── */}
          {r.sinsalChemi.length > 0 && (
            <div className="rounded-card bg-white p-4 shadow-card ring-1 ring-black/5">
              <p className="mb-2.5 text-[14px] font-bold text-ink">신살 케미</p>
              <div className="space-y-1.5">
                {r.sinsalChemi.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className={["shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1", s.good ? "bg-accent-500/[0.08] text-accent-600 ring-accent-500/20" : "bg-[#dc2626]/[0.07] text-[#b91c1c] ring-[#dc2626]/20"].join(" ")}>{s.name}<span className="ml-1 text-[10px] opacity-60">{s.who}</span></span>
                    <span className="text-[12px] leading-snug text-ink/78">{s.meaning}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 분야별 4 ────────────────────────────────────── */}
          <div className="rounded-card bg-white p-4 shadow-card ring-1 ring-black/5">
            <p className="mb-3 text-[14px] font-bold text-ink">분야별 궁합</p>
            <div className="space-y-3.5">
              {r.fields.map((f) => (
                <div key={f.key}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[14px] font-bold text-ink">{f.emoji} {f.label}</span>
                    <span className="text-[13px] font-extrabold text-primary-600">{f.score}점</span>
                  </div>
                  <div className="mb-1.5 h-2 overflow-hidden rounded-full bg-canvas">
                    <div className="h-full rounded-full bg-accent-400" style={{ width: `${f.score}%` }} />
                  </div>
                  <p className="text-[12.5px] leading-snug text-ink/78">{f.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── 관계 타임라인 ───────────────────────────────── */}
          <div className="rounded-card bg-white p-4 shadow-card ring-1 ring-black/5">
            <p className="mb-3 text-[14px] font-bold text-ink">두 사람의 관계 흐름</p>
            <div className="space-y-0">
              {r.timeline.map((t, i) => (
                <div key={t.label} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < r.timeline.length - 1 && <span className="absolute left-[15px] top-8 h-full w-px bg-black/10" aria-hidden />}
                  <span className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-50 text-[15px] ring-1 ring-accent-400/30">{t.emoji}</span>
                  <div className="pt-0.5">
                    <p className="text-[12.5px] font-bold text-primary-600">{t.label}</p>
                    <p className="mt-0.5 text-[12.5px] leading-snug text-ink/88">{t.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── ⭐위기와 극복 ───────────────────────────────── */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-2 text-[14px] font-bold text-ink">⚡ 위기와 극복법</p>
            <div className="rounded-xl bg-[#dc2626]/[0.05] p-3 ring-1 ring-[#dc2626]/15">
              <p className="text-[11.5px] font-bold text-[#b91c1c]">이런 게 위기예요</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink/88">{r.crisisSituation}</p>
            </div>
            <div className="mt-2 rounded-xl bg-accent-500/[0.06] p-3 ring-1 ring-accent-500/15">
              <p className="text-[11.5px] font-bold text-accent-600">이렇게 극복해요</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink/88">{r.crisisOvercome}</p>
            </div>
          </div>

          {/* ── ⭐전생 인연 ─────────────────────────────────── */}
          <div className="rounded-card bg-primary-500/[0.05] p-5 text-center shadow-card ring-1 ring-primary-500/15">
            <p className="text-[12px] font-semibold text-primary-500">🌙 전생의 인연</p>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink/88">{r.pastLife}</p>
          </div>

          {/* ── 좋은점 / 조심할점 / 갈등팁 ───────────────────── */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <div className="mb-3">
              <p className="text-[12.5px] font-semibold text-accent-500">💕 이런 점이 잘 맞아요</p>
              <p className="mt-1 text-[13.5px] leading-snug text-ink/88">{r.good}</p>
            </div>
            <div className="mb-3 border-t border-black/5 pt-3">
              <p className="text-[12.5px] font-semibold text-primary-500">🌱 이런 점은 조심해요</p>
              <p className="mt-1 text-[13.5px] leading-snug text-ink/88">{r.caution}</p>
            </div>
            <div className="border-t border-black/5 pt-3">
              <p className="text-[12.5px] font-semibold text-primary-500">🤝 갈등이 생기면</p>
              <p className="mt-1 text-[13.5px] leading-snug text-ink/88">{r.conflictTip}</p>
            </div>
          </div>

          {/* ── 행운 숫자 + 공유 ────────────────────────────── */}
          <div className="flex items-center gap-3 rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <span className="shrink-0 text-[12.5px] text-ink/66">두 사람의 행운 숫자</span>
            <div className="flex gap-1.5">
              {r.luckyNumbers.map((n) => (
                <span key={n} className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold text-white" style={{ backgroundColor: ballColor(n) }}>{n}</span>
              ))}
            </div>
          </div>

          <button type="button" onClick={share} className="flex w-full items-center justify-center gap-1.5 rounded-card bg-accent-500/[0.08] py-3.5 text-[14px] font-semibold text-accent-600 ring-1 ring-accent-500/20 active:scale-[0.99]">
            {copied ? "링크가 복사됐어요 ✓" : "결과 공유하기 (링크 복사) 🔗"}
          </button>

          {/* ── 상담 CTA ────────────────────────────────────── */}
          <a href="https://sajuplan.com" className="flex flex-col items-center gap-1 rounded-card bg-primary-500/[0.07] px-4 py-4 text-center ring-1 ring-primary-500/20 active:scale-[0.99]">
            <span className="text-[14px] font-semibold text-primary-600">결혼 적기·속궁합 깊은 풀이가 궁금하다면 →</span>
            <span className="text-[12px] text-primary-600/70">두 사람의 인연을 전문 상담사와 더 깊이 보세요</span>
          </a>
        </section>
      )}

      <p className="mt-6 text-center text-[11px] leading-relaxed text-ink/58">궁합은 재미·참고용이에요. 더 깊은 인연 풀이는 전문 상담사와 함께하세요.</p>
    </main>
  );
}

function MiniChart({ who, chart, accent }: { who: string; chart: ManseChart; accent?: boolean }) {
  const day = chart.pillars.day;
  const animal = chart.pillars.year.branch.animal;
  const st = chart.analysis.strength;
  const topEl = [...chart.analysis.elements].sort((a, b) => b.count - a.count)[0];
  return (
    <div className="flex flex-col items-center rounded-card bg-white p-3.5 shadow-card ring-1 ring-black/5">
      <p className={["mb-2 text-[12.5px] font-bold", accent ? "text-primary-600" : "text-ink/88"].join(" ")}>{who}</p>
      <div className="flex h-14 w-14 flex-col items-center justify-center rounded-xl text-white" style={{ backgroundColor: EL_BG[day.stem.element] ?? "#6b7280" }}>
        <span className="text-[26px] font-bold leading-none">{day.stem.hanja}</span>
        <span className="mt-0.5 text-[9px] opacity-90">{day.stem.ko}</span>
      </div>
      <p className="mt-2 text-[11.5px] font-medium text-ink/78">일간 {day.stem.ko}({day.stem.element})</p>
      <p className="text-[11px] text-ink/62">{animal}띠 · {st.label}</p>
      {topEl && <p className="text-[10.5px] text-ink/58">기운: {topEl.element} 강함</p>}
    </div>
  );
}
