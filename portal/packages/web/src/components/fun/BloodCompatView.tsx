import { useState } from "react";
import { ballColor } from "@portal/engine";
import { BLOODS, buildBloodCompat, type Blood, type Gender, type BloodResult, type BloodProfile } from "../../lib/bloodEngine.js";
import { shareResult } from "../../lib/share.js";

const GRADE_BG: Record<string, string> = { S: "bg-accent-500", A: "bg-accent-500", B: "bg-accent-400", C: "bg-primary-400", D: "bg-ink/40" };

function ProfileCard({ who, blood, p, mbti }: { who: string; blood: Blood; p: BloodProfile; mbti: string }) {
  return (
    <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
      <p className="text-[14px] font-bold text-ink">{p.emoji} {who} · {blood}형 <span className="text-[12px] font-normal text-ink/62">({p.animal}상 · {p.oneliner})</span></p>
      <div className="mt-2 space-y-1.5 text-[12.5px] leading-relaxed text-ink/88">
        <p><b className="text-ink/74">성격</b> {p.personality}</p>
        <p><b className="text-ink/74">연애 스타일</b> {p.love}</p>
        <p><b className="text-green-600">장점</b> {p.strength}</p>
        <p><b className="text-[#b45309]">단점</b> {p.weakness}</p>
        <p><b className="text-primary-600">스트레스 받으면</b> {p.stress}</p>
        <p><b className="text-accent-600">MBTI로 치면</b> {mbti}</p>
      </div>
    </div>
  );
}

// 혈액형 궁합 v2 — 16조합 풍성 풀이 + 성격카드 + 분야별 + 실전팁 + 성별뉘앙스 + 전생 + MBTI교차 + 랭킹 + 재미. (사주무관·순수 lookup)
export default function BloodCompatView() {
  const [me, setMe] = useState<Blood | null>(null);
  const [you, setYou] = useState<Blood | null>(null);
  const [meG, setMeG] = useState<Gender | null>(null);
  const [youG, setYouG] = useState<Gender | null>(null);
  const [copied, setCopied] = useState(false);
  const r: BloodResult | null = me && you ? buildBloodCompat(me, you, meG, youG) : null;

  async function share() {
    if (!r) return;
    const txt = `[혈액형 궁합] ${r.me}형 💞 ${r.you}형\n${r.score}점 · ${r.grade}등급 · ${r.typeEmoji} ${r.type}`;
    const res = await shareResult("혈액형 궁합 — 사주플랜", txt);
    if (res === "copied") { setCopied(true); setTimeout(() => setCopied(false), 1800); }
  }

  const genderPick = (val: Gender | null, set: (g: Gender) => void) => (
    <div className="flex gap-1">
      {(["M", "F"] as Gender[]).map((g) => (
        <button key={g} type="button" onClick={() => set(g)} className={["rounded-lg px-2.5 py-1 text-[11.5px] font-medium ring-1 transition", val === g ? "bg-primary-500/10 text-primary-600 ring-primary-400/40" : "bg-canvas text-ink/62 ring-black/5"].join(" ")}>{g === "M" ? "남" : "여"}</button>
      ))}
    </div>
  );
  const bloodPick = (val: Blood | null, set: (b: Blood) => void) => (
    <div className="grid grid-cols-4 gap-1.5">
      {BLOODS.map((b) => (
        <button key={b} type="button" onClick={() => set(b)} className={["rounded-xl py-2.5 text-[15px] font-bold ring-1 transition active:scale-[0.97]", val === b ? "bg-accent-500 text-white ring-accent-500" : "bg-canvas text-ink/74 ring-black/5"].join(" ")}>{b}형</button>
      ))}
    </div>
  );

  return (
    <main className="px-4 pb-16 pt-3">
      <section className="space-y-3 rounded-card bg-white p-4 shadow-card ring-1 ring-black/5">
        <p className="text-[13px] font-medium text-ink">두 사람의 혈액형을 골라주세요 <span className="text-ink/58">(성별은 선택)</span></p>
        <div>
          <div className="mb-1.5 flex items-center justify-between"><p className="text-[12.5px] font-medium text-ink/70">나의 혈액형</p>{genderPick(meG, setMeG)}</div>
          {bloodPick(me, setMe)}
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between"><p className="text-[12.5px] font-medium text-ink/70">상대의 혈액형</p>{genderPick(youG, setYouG)}</div>
          {bloodPick(you, setYou)}
        </div>
      </section>

      {r && (
        <section className="mt-4 space-y-3">
          {/* 헤더 */}
          <div className="flex flex-col items-center rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="text-[12.5px] text-ink/66">{r.meProfile.emoji} {r.me}형 💞 {r.you}형 {r.youProfile.emoji}</p>
            <div className="mt-2 flex h-20 w-20 flex-col items-center justify-center rounded-full bg-accent-500 text-white">
              <span className="text-[24px] font-extrabold leading-none">{r.score}</span>
              <span className="text-[11px] opacity-90">궁합</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span className={["flex h-7 w-7 items-center justify-center rounded-full text-[14px] font-extrabold text-white", GRADE_BG[r.grade]].join(" ")}>{r.grade}</span>
              <span className="text-[13px] font-bold text-accent-600">{r.gradeLabel}</span>
            </div>
            <p className="mt-2 text-[15px] font-bold text-ink">{r.typeEmoji} {r.type}</p>
            <p className="mt-1.5 text-center text-[13px] leading-relaxed text-ink/88">{r.summary}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              {r.tags.map((t) => (<span key={t} className="rounded-full bg-accent-50 px-2 py-0.5 text-[11px] font-semibold text-accent-500">{t}</span>))}
            </div>
          </div>

          {/* 성별 뉘앙스 */}
          {r.genderNote && (
            <div className="rounded-card bg-[#fdf2f8] p-4 ring-1 ring-accent-400/20">
              <p className="text-[12px] font-bold text-accent-600">👫 성별 케미</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink/88">{r.genderNote}</p>
            </div>
          )}

          {/* 잘맞을때 / 부딪힐때 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="text-[12.5px] font-semibold text-green-600">💚 이럴 때 잘 맞아요</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink/88">{r.goodWhen}</p>
            <p className="mt-3 text-[12.5px] font-semibold text-[#b45309]">⚡ 이럴 때 부딪혀요</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink/88">{r.clashWhen}</p>
          </div>

          {/* 혈액형 성격 카드 2개 */}
          <ProfileCard who="나" blood={r.me} p={r.meProfile} mbti={r.mbtiMe} />
          <ProfileCard who="상대" blood={r.you} p={r.youProfile} mbti={r.mbtiYou} />

          {/* 분야별 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-2.5 text-[14px] font-bold text-ink">🎯 분야별 케미</p>
            <div className="space-y-2">
              {r.fields.map((f) => (
                <div key={f.label} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-[12px] font-medium text-ink/88">{f.emoji} {f.label}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/[0.05]">
                    <div className="h-full rounded-full bg-accent-400" style={{ width: `${f.score}%` }} />
                  </div>
                  <span className="w-8 shrink-0 text-right text-[11px] font-bold text-accent-500">{f.score}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 실전 팁 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-2 text-[14px] font-bold text-ink">💡 {r.you}형 상대 공략 실전 팁</p>
            <div className="space-y-1.5 text-[12.5px] leading-relaxed text-ink/88">
              <p><b className="text-accent-600">데이트</b> {r.tips.date}</p>
              <p><b className="text-accent-600">대화법</b> {r.tips.talk}</p>
              <p><b className="text-accent-600">선물</b> {r.tips.gift}</p>
              <p><b className="text-accent-600">갈등 해결</b> {r.tips.conflict}</p>
            </div>
          </div>

          {/* 전생 인연 */}
          <div className="rounded-card bg-[#fff7e0] p-5 ring-1 ring-[#f59e0b]/15">
            <p className="text-[12px] font-bold text-[#b88300]">🏮 전생의 인연</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink/88">{r.pastLife}</p>
          </div>

          {/* 운명/조심 상대 랭킹 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-2 text-[14px] font-bold text-ink">🏆 {r.me}형의 궁합 랭킹</p>
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full bg-accent-50 px-2.5 py-1 text-[11.5px] font-medium text-ink/88 ring-1 ring-accent-400/30">운명의 상대 <b className="text-accent-600">{r.bestMatch}형 💞</b></span>
              <span className="rounded-full bg-[#f59e0b]/[0.1] px-2.5 py-1 text-[11.5px] font-medium text-ink/88 ring-1 ring-[#f59e0b]/20">조심할 상대 <b className="text-[#b45309]">{r.worstMatch}형 ⚡</b></span>
            </div>
          </div>

          {/* 커플 별명 + 행운숫자 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-canvas px-2.5 py-1 text-[11.5px] font-medium text-ink/88 ring-1 ring-black/5">우리 별명 <b className="text-primary-600">{r.coupleNickname}</b></span>
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <span className="w-14 shrink-0 text-[12.5px] text-ink/66">행운 숫자</span>
              <div className="flex gap-1.5">
                {r.luckyNumbers.map((n) => (<span key={n} className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold text-white" style={{ backgroundColor: ballColor(n) }}>{n}</span>))}
              </div>
            </div>
          </div>

          {/* 공유 */}
          <button type="button" onClick={share} className="flex w-full items-center justify-center gap-1.5 rounded-card bg-accent-50 py-3.5 text-[14px] font-semibold text-accent-600 ring-1 ring-accent-400/30 active:scale-[0.99]">
            {copied ? "복사됐어요! 친구에게 자랑하기 📋" : "혈액형 궁합 자랑하기 📋"}
          </button>

          <a href="https://sajuplan.com" className="flex items-center justify-center gap-1.5 rounded-card bg-primary-500/[0.07] py-3.5 text-[14px] font-semibold text-primary-600 ring-1 ring-primary-500/20 active:scale-[0.99]">
            사주로 보는 진짜 궁합이 궁금하다면 →
          </a>
        </section>
      )}

      <p className="mt-6 text-center text-[11px] leading-relaxed text-ink/58">혈액형 성격·궁합은 과학적 근거가 없는 통념이에요. 사람을 혈액형으로 판단하지 마세요. 100% 재미·참고용이에요. 😊</p>
    </main>
  );
}
