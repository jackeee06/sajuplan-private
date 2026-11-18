import { useState } from "react";
import { ballColor } from "@portal/engine";
import { useProfile } from "../../lib/useProfile.js";
import MyInfoBar from "../MyInfoBar.js";
import { STARS, buildCelebFortune, type Star, type CelebResult } from "../../lib/celebEngine.js";
import { shareResult } from "../../lib/share.js";

const GRADE_BG: Record<string, string> = { S: "bg-accent-500", A: "bg-accent-500", B: "bg-accent-400", C: "bg-primary-400", D: "bg-ink/40" };

// 연예인 궁합 v2 — 가상 스타 12종 + 진짜 사주 궁합엔진 + 덕질 재미 레이어(케미등급·이상형판정·데이트시나리오·커플별명).
export default function CelebCoupleView() {
  const profile = useProfile();
  const [star, setStar] = useState<Star | null>(null);
  const [copied, setCopied] = useState(false);
  const r: CelebResult | null = profile?.birth && star ? buildCelebFortune(profile, star) : null;

  async function share() {
    if (!r) return;
    const txt = `[연예인 궁합] 나 💞 ${r.star.name}\n케미 ${r.base.score}점 · ${r.grade}등급(${r.gradeLabel})\n${r.coupleNickname} · ${r.base.coupleType.name}`;
    const res = await shareResult("연예인 궁합 — 사주플랜", txt);
    if (res === "copied") { setCopied(true); setTimeout(() => setCopied(false), 1800); }
  }

  return (
    <main className="px-4 pb-16 pt-3">
      <MyInfoBar ctaLabel="생년월일 넣고 스타 궁합 보기" />

      {profile?.birth ? (
        <section className="rounded-card bg-white p-4 shadow-card ring-1 ring-black/5">
          <p className="mb-2 text-[13px] font-medium text-ink">궁금한 스타 유형을 골라요 <span className="text-ink/58">(가상 캐릭터)</span></p>
          <div className="grid grid-cols-3 gap-2">
            {STARS.map((s) => {
              const active = star?.id === s.id;
              return (
                <button key={s.id} type="button" onClick={() => setStar(s)}
                  className={["flex flex-col items-center gap-1 rounded-xl py-2.5 ring-1 transition active:scale-[0.97]", active ? "bg-accent-50 ring-accent-400" : "bg-canvas ring-black/5"].join(" ")}>
                  <span className="text-[22px] leading-none">{s.emoji}</span>
                  <span className={["text-[11px] font-semibold leading-tight", active ? "text-accent-500" : "text-ink/88"].join(" ")}>{s.name}</span>
                  <span className="text-[9.5px] text-ink/58">{s.animal}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <p className="mt-2 text-center text-[12.5px] leading-relaxed text-ink/62">생년월일을 한 번만 입력하면 스타와의 케미를 볼 수 있어요.</p>
      )}

      {r && star && (
        <section className="mt-4 space-y-3">
          {/* 헤더 — 점수·등급·유형 */}
          <div className="flex flex-col items-center rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="text-[12.5px] text-ink/66">나 💞 {star.emoji} <b className="text-primary-600">{star.name}</b> <span className="text-ink/35">({star.tag})</span></p>
            <div className="mt-2 flex h-20 w-20 flex-col items-center justify-center rounded-full bg-accent-500 text-white">
              <span className="text-[24px] font-extrabold leading-none">{r.base.score}</span>
              <span className="text-[11px] opacity-90">케미</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span className={["flex h-7 w-7 items-center justify-center rounded-full text-[14px] font-extrabold text-white", GRADE_BG[r.grade]].join(" ")}>{r.grade}</span>
              <span className="text-[13px] font-bold text-accent-600">{r.gradeLabel}</span>
            </div>
            <p className="mt-2 text-[15px] font-bold text-ink">{r.base.coupleType.emoji} {r.base.coupleType.name}</p>
            <p className="mt-1 text-center text-[13px] leading-relaxed text-ink/88">{r.base.coupleType.desc}</p>
            {r.base.hashtags.length > 0 && (
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                {r.base.hashtags.map((h) => (<span key={h} className="rounded-full bg-accent-50 px-2 py-0.5 text-[11px] font-semibold text-accent-500">{h}</span>))}
              </div>
            )}
          </div>

          {/* 이상형 판정 */}
          <div className="rounded-card bg-[#fdf2f8] p-5 ring-1 ring-accent-400/20">
            <p className="text-[14px] font-bold text-accent-600">{r.idealVerdict}</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink/88">{r.idealText}</p>
          </div>

          {/* 십성 양방향 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-2 text-[14px] font-bold text-ink">💞 둘은 서로에게 어떤 사람?</p>
            <p className="text-[13px] leading-relaxed text-ink/88">{r.base.tenGodToMe.text}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink/88">{r.base.tenGodToPartner.text}</p>
          </div>

          {/* 인연 코드 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-2 text-[14px] font-bold text-ink">🔗 둘을 잇는 인연 코드</p>
            <div className="space-y-2">
              {r.base.bondCodes.map((c, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={["mt-px shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold", c.good ? "bg-accent-500/[0.1] text-accent-600" : "bg-[#f59e0b]/[0.14] text-[#b45309]"].join(" ")}>{c.name}</span>
                  <p className="text-[12.5px] leading-snug text-ink/88">{c.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 분야별 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-2.5 text-[14px] font-bold text-ink">🎯 분야별 케미</p>
            <div className="space-y-2">
              {r.base.fields.map((f) => (
                <div key={f.key} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-[12px] font-medium text-ink/88">{f.emoji} {f.label}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/[0.05]">
                    <div className="h-full rounded-full bg-accent-400" style={{ width: `${f.score}%` }} />
                  </div>
                  <span className="w-8 shrink-0 text-right text-[11px] font-bold text-accent-500">{f.score}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 가상 데이트 시나리오 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-2.5 text-[14px] font-bold text-ink">🎬 만약 둘이 사귄다면? (가상 시나리오)</p>
            <div className="space-y-2.5">
              {r.dateScenario.map((d, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="mt-0.5 shrink-0 text-[16px]">{d.emoji}</span>
                  <div><p className="text-[12.5px] font-semibold text-ink/88">{d.label}</p><p className="text-[12.5px] leading-relaxed text-ink/78">{d.text}</p></div>
                </div>
              ))}
            </div>
          </div>

          {/* 전생 인연 */}
          <div className="rounded-card bg-[#fff7e0] p-5 ring-1 ring-[#f59e0b]/15">
            <p className="text-[12px] font-bold text-[#b88300]">🏮 전생의 인연</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink/88">{r.base.pastLife}</p>
          </div>

          {/* 커플 별명 + 덕질 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-2 text-[14px] font-bold text-ink">💝 우리의 덕질 코드</p>
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full bg-canvas px-2.5 py-1 text-[11.5px] font-medium text-ink/88 ring-1 ring-black/5">커플 별명 <b className="text-primary-600">{r.coupleNickname}</b></span>
              <span className="rounded-full bg-canvas px-2.5 py-1 text-[11.5px] font-medium text-ink/88 ring-1 ring-black/5">부르는 호칭 <b className="text-primary-600">{r.callname}</b></span>
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink/78">🌟 응원 코드: {r.fandom}</p>
          </div>

          {/* 잘맞는점/주의점 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="text-[12.5px] font-semibold text-green-600">잘 맞는 점</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink/88">{r.base.good}</p>
            <p className="mt-3 text-[12.5px] font-semibold text-[#b45309]">조심할 점</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink/88">{r.base.caution}</p>
            <p className="mt-3 text-[12.5px] font-semibold text-primary-600">이렇게 풀어요</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink/88">{r.base.conflictTip}</p>
          </div>

          {/* 행운숫자 */}
          <div className="rounded-card bg-white p-4 shadow-card ring-1 ring-black/5">
            <div className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-[12.5px] text-ink/66">행운 숫자</span>
              <div className="flex gap-1.5">
                {r.base.luckyNumbers.map((n) => (<span key={n} className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold text-white" style={{ backgroundColor: ballColor(n) }}>{n}</span>))}
              </div>
            </div>
          </div>

          {/* 공유 자랑 */}
          <button type="button" onClick={share} className="flex w-full items-center justify-center gap-1.5 rounded-card bg-accent-50 py-3.5 text-[14px] font-semibold text-accent-600 ring-1 ring-accent-400/30 active:scale-[0.99]">
            {copied ? "복사됐어요! 친구에게 자랑하기 📋" : "내 스타 궁합 자랑하기 📋"}
          </button>

          <a href="https://sajuplan.com" className="flex items-center justify-center gap-1.5 rounded-card bg-primary-500/[0.07] py-3.5 text-[14px] font-semibold text-primary-600 ring-1 ring-primary-500/20 active:scale-[0.99]">
            내 진짜 인연이 궁금하다면 →
          </a>
        </section>
      )}

      <p className="mt-6 text-center text-[11px] leading-relaxed text-ink/58">스타는 재미용 가상 캐릭터예요(실존 인물 정보 아님). 궁합은 재미·참고용이에요.</p>
    </main>
  );
}
