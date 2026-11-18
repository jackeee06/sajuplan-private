import { useMemo, useState } from "react";
import { useProfile } from "../../lib/useProfile.js";
import MyInfoBar from "../MyInfoBar.js";
import { shareResult } from "../../lib/share.js";
import { buildPastLife } from "../../lib/pastlifeEngine.js";

// 전생 이야기 — 생년월일 → 전생 신분·성격·못다한 한·현생 재능/과제·전생의 인연·메시지. 사주무관·재미용.
export default function PastLifeView() {
  const profile = useProfile();
  const [copied, setCopied] = useState(false);
  const r = useMemo(() => (profile?.birth ? buildPastLife(profile.birth) : null), [profile]);

  async function share() {
    if (!r) return;
    const txt = `[나의 전생] ${r.statusEmoji} ${r.era}의 '${r.status}'\n전생 동물상 ${r.animalEmoji} ${r.animal} · 키워드 #${r.keyword}\n${r.message}`;
    const res = await shareResult("나의 전생 — 사주플랜", txt);
    if (res === "copied") { setCopied(true); setTimeout(() => setCopied(false), 1800); }
  }

  return (
    <main className="px-4 pb-16 pt-3">
      <MyInfoBar ctaLabel="생년월일 넣고 내 전생 보기" />

      {r ? (
        <section className="mt-4 space-y-3">
          {/* 전생 신분 헤더 */}
          <div className="flex flex-col items-center rounded-card bg-primary-500/[0.06] p-6 text-center shadow-card ring-1 ring-primary-500/15">
            <span className="text-[44px] leading-none">{r.statusEmoji}</span>
            <p className="mt-1.5 text-[11.5px] font-semibold text-primary-500">{r.era}</p>
            <p className="text-[23px] font-extrabold text-ink">{r.status}</p>
            <p className="mt-2 text-[14.5px] font-semibold leading-relaxed text-ink">{r.intro}</p>
            <p className="mt-2 text-[13px] font-semibold text-primary-600">전생의 이름 · {r.pastName}</p>
            <div className="mt-2.5 flex flex-wrap justify-center gap-1.5">
              <span className="rounded-full bg-white px-2.5 py-1 text-[11.5px] font-semibold text-primary-600">#{r.keyword}</span>
              <span className="rounded-full bg-white px-2.5 py-1 text-[11.5px] font-semibold text-primary-600">{r.animalEmoji} {r.animal}상</span>
              <span className="rounded-full bg-white px-2.5 py-1 text-[11.5px] font-semibold text-primary-600">전생 공덕 {r.pastScore}점</span>
            </div>
          </div>

          {/* 전생 이야기 — 롱폼 서사 */}
          {r.story.length > 0 && (
            <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
              <p className="mb-2.5 text-[14px] font-bold text-ink">📖 당신의 전생 이야기</p>
              <div className="space-y-2.5">
                {r.story.map((para, i) => (
                  <p key={i} className={i === 0 ? "text-[14.5px] font-semibold leading-relaxed text-ink" : "text-[13.5px] leading-relaxed text-ink/88"}>{para}</p>
                ))}
              </div>
            </div>
          )}

          {/* 전생의 나 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-2 text-[14px] font-bold text-ink">🕰️ 전생의 당신은</p>
            <p className="text-[13.5px] leading-relaxed text-ink/88">{r.personality}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink/74">주로 <b className="text-primary-600">{r.place}</b>에서 지냈어요.</p>
          </div>

          {/* 전생 일대기 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-2.5 text-[14px] font-bold text-ink">📜 전생 일대기</p>
            <div className="space-y-2.5">
              {r.chronicle.map((c) => (
                <div key={c.phase} className="flex items-start gap-2.5">
                  <span className="mt-0.5 shrink-0 text-[18px]">{c.emoji}</span>
                  <div><p className="text-[12.5px] font-semibold text-ink/88">{c.phase}</p><p className="text-[12.5px] leading-relaxed text-ink/74">{c.text}</p></div>
                </div>
              ))}
              <div className="flex items-start gap-2.5 border-t border-black/5 pt-2.5">
                <span className="mt-0.5 shrink-0 text-[18px]">🕯️</span>
                <div><p className="text-[12.5px] font-semibold text-ink/88">마지막 순간</p><p className="text-[12.5px] leading-relaxed text-ink/74">{r.death}</p></div>
              </div>
            </div>
          </div>

          {/* 못다한 한 */}
          <div className="rounded-card bg-[#fff7e0] p-5 ring-1 ring-[#f59e0b]/15">
            <p className="mb-1.5 text-[13px] font-bold text-[#b88300]">🍂 전생에 못다 한 이야기</p>
            <p className="text-[13px] leading-relaxed text-ink/88">{r.unfinished}</p>
          </div>

          {/* 현생에 가져온 것 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-2.5 text-[14px] font-bold text-ink">🎁 이번 생에 가져온 것</p>
            <div className="space-y-2.5">
              <div className="rounded-xl bg-accent-500/[0.06] p-3 ring-1 ring-accent-500/15">
                <p className="text-[11.5px] font-bold text-accent-600">전생이 준 재능</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink/88">{r.gift}</p>
              </div>
              <div className="rounded-xl bg-primary-500/[0.06] p-3 ring-1 ring-primary-500/15">
                <p className="text-[11.5px] font-bold text-primary-600">이번 생의 숙제</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink/88">{r.lesson}</p>
              </div>
            </div>
          </div>

          {/* 전생의 카르마 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-2.5 text-[14px] font-bold text-ink">☯️ 전생이 남긴 카르마(業)</p>
            <div className="space-y-2.5">
              <div className="rounded-xl bg-[#fff7e0] p-3 ring-1 ring-[#f59e0b]/15">
                <p className="text-[11.5px] font-bold text-[#b88300]">이번 생에 갚을 빚</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink/88">{r.karma.debt}</p>
              </div>
              <div className="rounded-xl bg-accent-500/[0.06] p-3 ring-1 ring-accent-500/15">
                <p className="text-[11.5px] font-bold text-accent-600">이번 생에 받을 복</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink/88">{r.karma.blessing}</p>
              </div>
              <div className="rounded-xl bg-primary-500/[0.06] p-3 ring-1 ring-primary-500/15">
                <p className="text-[11.5px] font-bold text-primary-600">반복되는 패턴</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink/88">{r.karma.pattern}</p>
              </div>
            </div>
          </div>

          {/* 전생의 인연 + 재회 */}
          <div className="rounded-card bg-[#fdf2f8] p-5 ring-1 ring-accent-400/20">
            <p className="mb-1.5 text-[13px] font-bold text-accent-600">💞 전생의 인연</p>
            <p className="text-[13px] leading-relaxed text-ink/88">{r.bond}</p>
            <p className="mt-2.5 border-t border-accent-400/15 pt-2.5 text-[13px] leading-relaxed text-ink/88"><b className="text-accent-600">🔮 다시 만날 인연</b> {r.reunion}</p>
          </div>

          {/* 수호신 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-1.5 text-[14px] font-bold text-ink">🛡️ 나를 지키는 전생의 수호신</p>
            <p className="text-[13px] leading-relaxed text-ink/88">{r.guardian}</p>
          </div>

          {/* 미션 + 메시지 */}
          <div className="rounded-card bg-primary-500/[0.05] p-5 ring-1 ring-primary-500/15">
            <p className="text-[13px] font-bold text-primary-600">🎯 이번 생의 미션</p>
            <p className="mt-1 text-[13.5px] leading-relaxed text-ink/88">{r.mission}</p>
            <p className="mt-3 border-t border-primary-500/15 pt-3 text-[14.5px] font-semibold italic leading-relaxed text-primary-700">“{r.message}”</p>
          </div>

          {/* 공유 */}
          <button type="button" onClick={share} className="flex w-full items-center justify-center gap-1.5 rounded-card bg-accent-50 py-3.5 text-[14px] font-semibold text-accent-600 ring-1 ring-accent-400/30 active:scale-[0.99]">
            {copied ? "복사됐어요! 친구에게 자랑하기 📋" : "내 전생 이야기 자랑하기 📋"}
          </button>

          <a href="https://sajuplan.com" className="flex items-center justify-center gap-1.5 rounded-card bg-primary-500/[0.07] py-3.5 text-[14px] font-semibold text-primary-600 ring-1 ring-primary-500/20 active:scale-[0.99]">
            이번 생의 타고난 운명이 궁금하다면 →
          </a>
        </section>
      ) : (
        <p className="mt-2 text-center text-[12.5px] leading-relaxed text-ink/62">생년월일을 한 번만 입력하면 바로 전생 이야기가 나와요.</p>
      )}

      <p className="mt-6 text-center text-[11px] leading-relaxed text-ink/58">전생 이야기는 상상력을 더한 재미·참고용 콘텐츠예요. 가볍게 즐겨주세요 😊</p>
    </main>
  );
}
