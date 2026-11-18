import { useState } from "react";
import { ballColor } from "@portal/engine";
import { todayKey } from "../../lib/dateKey.js";
import { shareResult } from "../../lib/share.js";
import { MBTI_LIST, MBTI_DB, MBTI_EXTRA, buildMbtiToday, buildMbtiCompat, buildMbtiRanking, buildMbtiDeep, type MBTI } from "../../lib/mbtiEngine.js";
import { getMbtiArticle, COG_FN } from "../../lib/mbtiArticle.js";

const GROUPS: { name: MbtiProfileGroup; color: string; bg: string }[] = [
  { name: "분석가", color: "#8259F5", bg: "bg-primary-500/[0.08]" },
  { name: "외교관", color: "#16a34a", bg: "bg-[#16a34a]/[0.08]" },
  { name: "관리자", color: "#ec4899", bg: "bg-accent-500/[0.08]" },
  { name: "탐험가", color: "#f59e0b", bg: "bg-[#f59e0b]/[0.10]" },
];
type MbtiProfileGroup = "분석가" | "외교관" | "관리자" | "탐험가";
const GRADE_BG: Record<string, string> = { S: "bg-accent-500", A: "bg-accent-500", B: "bg-accent-400", C: "bg-primary-400", D: "bg-ink/40" };

// MBTI 운세 — 유형 선택(생년월일 불필요) → 프로필 + 오늘의 MBTI 운세 + 잘맞는/상극 + MBTI 궁합. 사주무관·재미용.
export default function MbtiView() {
  const day = todayKey();
  const [me, setMe] = useState<MBTI | null>(null);
  const [you, setYou] = useState<MBTI | null>(null);
  const [copied, setCopied] = useState(false);

  const prof = me ? MBTI_DB[me] : null;
  const extra = me ? MBTI_EXTRA[me] : null;
  const deep = me ? buildMbtiDeep(me) : null;
  const article = me ? getMbtiArticle(me) : null;
  const today = me ? buildMbtiToday(me, day) : null;
  const ranking = me ? buildMbtiRanking(me) : null;
  const compat = me && you ? buildMbtiCompat(me, you) : null;

  async function share() {
    if (!prof || !today) return;
    const txt = `[MBTI 오늘의 운세] ${prof.type} ${prof.nick}\n${today.head}\n행운 색 ${today.luckyColor} · 행운 숫자 ${today.luckyNumber}`;
    const res = await shareResult("MBTI 운세 — 사주플랜", txt);
    if (res === "copied") { setCopied(true); setTimeout(() => setCopied(false), 1800); }
  }

  const Picker = ({ value, onPick, idPrefix }: { value: MBTI | null; onPick: (m: MBTI) => void; idPrefix: string }) => (
    <div className="space-y-2">
      {GROUPS.map((g) => (
        <div key={g.name}>
          <p className="mb-1 text-[11px] font-bold" style={{ color: g.color }}>{g.name}</p>
          <div className="grid grid-cols-4 gap-1.5">
            {MBTI_LIST.filter((t) => MBTI_DB[t].group === g.name).map((t) => {
              const active = value === t;
              return (
                <button key={`${idPrefix}-${t}`} type="button" onClick={() => onPick(t)}
                  className={["rounded-xl py-2 text-[13px] font-bold ring-1 transition active:scale-[0.96]", active ? "text-white ring-transparent" : "bg-canvas text-ink/74 ring-black/5"].join(" ")}
                  style={active ? { backgroundColor: g.color } : undefined}>{t}</button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <main className="px-4 pb-16 pt-3">
      <section className="rounded-card bg-white p-4 shadow-card ring-1 ring-black/5">
        <p className="text-[14px] font-bold text-ink">내 MBTI를 골라주세요</p>
        <p className="mb-3 mt-0.5 text-[12px] text-ink/62">생년월일 없이 바로 봐요</p>
        <Picker value={me} onPick={(m) => { setMe(m); setYou(null); }} idPrefix="me" />
      </section>

      {prof && today && (
        <section className="mt-4 space-y-3">
          {/* 프로필 헤더 */}
          <div className="flex flex-col items-center rounded-card p-6 text-center shadow-card ring-1" style={{ backgroundColor: `${prof.groupColor}14`, borderColor: `${prof.groupColor}26` }}>
            <span className="text-[40px] leading-none">{prof.emoji}</span>
            <p className="mt-1.5 text-[22px] font-extrabold text-ink">{prof.type}</p>
            <p className="text-[15.5px] font-bold" style={{ color: prof.groupColor }}>{prof.nick}</p>
            <p className="mt-1.5 text-[13.5px] font-semibold leading-relaxed text-ink">{prof.tagline}</p>
            <div className="mt-2.5 flex flex-wrap justify-center gap-1.5">
              {prof.keywords.map((k) => (<span key={k} className="rounded-full bg-white px-2.5 py-1 text-[11.5px] font-semibold" style={{ color: prof.groupColor }}>{k}</span>))}
            </div>
          </div>

          {/* 오늘의 MBTI 운세 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="text-[11.5px] font-semibold text-accent-500">{day.replace(/-/g, ".")} · 오늘의 {prof.type} 운세</p>
            <p className="mt-1 text-[17px] font-extrabold leading-tight text-ink">{today.head}</p>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink/88">{today.body}</p>
            <div className="mt-3 space-y-2">
              {today.fields.map((f) => (
                <div key={f.key} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-[12.5px] font-medium text-ink/74">{f.emoji} {f.label}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/[0.05]"><div className="h-full rounded-full bg-accent-400" style={{ width: `${f.score}%` }} /></div>
                  <span className="w-7 shrink-0 text-right text-[11px] font-bold text-accent-500">{f.score}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-canvas px-2.5 py-1 text-[11.5px] font-medium text-ink/82 ring-1 ring-black/5">행운 색 <b className="text-accent-600">{today.luckyColor}</b></span>
              <span className="rounded-full bg-canvas px-2.5 py-1 text-[11.5px] font-medium text-ink/82 ring-1 ring-black/5">행운 아이템 <b className="text-accent-600">{today.luckyItem}</b></span>
              <span className="rounded-full bg-canvas px-2.5 py-1 text-[11.5px] font-medium text-ink/82 ring-1 ring-black/5">행운 시간 <b className="text-accent-600">{today.luckyTime}</b></span>
              <span className="flex items-center gap-1 rounded-full bg-canvas px-2.5 py-1 text-[11.5px] font-medium text-ink/82 ring-1 ring-black/5">행운 숫자 <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: ballColor(today.luckyNumber) }}>{today.luckyNumber}</span></span>
            </div>
          </div>

          {/* 시간대 흐름 + 럭키 행동 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-2.5 text-[14px] font-bold text-ink">⏳ 오늘 시간대별 흐름</p>
            <div className="grid grid-cols-4 gap-1.5 text-center">
              {today.timeFlow.map((t) => (
                <div key={t.label} className="rounded-xl bg-canvas py-2 ring-1 ring-black/5">
                  <p className="text-[16px] leading-none">{t.mark}</p>
                  <p className="mt-1 text-[11.5px] font-semibold text-ink/74">{t.label}</p>
                  <p className="text-[12px] font-bold text-accent-500">{t.score}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              <p className="rounded-xl bg-accent-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-ink/88"><b className="text-accent-600">💫 오늘의 럭키 행동</b> {today.luckyAction}</p>
              <p className="rounded-xl bg-[#fff7e0] px-3 py-2.5 text-[12.5px] leading-relaxed text-ink/88"><b className="text-[#b45309]">⚠️ 오늘 조심할 것</b> {today.avoid}</p>
            </div>
          </div>

          {/* 유형 완전정복 — 롱폼 에세이 */}
          {article && (
            <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
              <p className="mb-2.5 text-[14px] font-bold text-ink">📖 {prof.type} 완전정복</p>
              <div className="space-y-2.5">
                {article.intro.map((para, i) => (
                  <p key={i} className={i === 0 ? "text-[14.5px] font-semibold leading-relaxed text-ink" : "text-[13.5px] leading-relaxed text-ink/88"}>{para}</p>
                ))}
              </div>
            </div>
          )}

          {/* 4지표 심층 해설 */}
          {deep && (
            <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
              <p className="mb-2.5 text-[14px] font-bold text-ink">🔠 네 글자에 담긴 나</p>
              <div className="space-y-2.5">
                {deep.axes.map((a) => (
                  <div key={a.label} className="rounded-xl bg-canvas p-3 ring-1 ring-black/5">
                    <p className="text-[12.5px] font-bold text-primary-600">{a.label}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-ink/88">{a.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 인지기능 스택 — 진짜 심화 */}
          {article && (
            <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
              <p className="mb-1 text-[14px] font-bold text-ink">🧠 {prof.type}의 인지기능</p>
              <p className="mb-2.5 text-[12px] text-ink/62">생각하고 판단하는 '마음의 회로' 순서예요</p>
              <div className="space-y-2">
                {article.functions.map((fn, i) => (
                  <div key={fn} className="flex items-start gap-2.5">
                    <span className={["mt-0.5 flex h-6 shrink-0 items-center justify-center rounded-md px-1.5 text-[10.5px] font-bold", i === 0 ? "bg-accent-500 text-white" : i === 1 ? "bg-accent-500/15 text-accent-600" : "bg-black/[0.06] text-ink/70"].join(" ")}>{["주", "부", "3차", "열등"][i]}</span>
                    <div><p className="text-[12.5px] font-bold text-primary-600">{COG_FN[fn]!.name}</p><p className="text-[12.5px] leading-relaxed text-ink/74">{COG_FN[fn]!.text}</p></div>
                  </div>
                ))}
              </div>
              <p className="mt-2.5 rounded-xl bg-canvas px-3 py-2.5 text-[12.5px] leading-relaxed text-ink/88">{article.functionNote}</p>
            </div>
          )}

          {/* 핵심 강점 */}
          {article && (
            <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
              <p className="mb-2.5 text-[14px] font-bold text-ink">💪 {prof.type}의 핵심 강점</p>
              <div className="space-y-2.5">
                {article.strengths.map((s) => (
                  <div key={s.title} className="rounded-xl bg-[#16a34a]/[0.06] p-3 ring-1 ring-[#16a34a]/15">
                    <p className="text-[12.5px] font-bold text-green-700">{s.title}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-ink/88">{s.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 핵심 약점 */}
          {article && (
            <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
              <p className="mb-2.5 text-[14px] font-bold text-ink">🪞 {prof.type}가 조심할 점</p>
              <div className="space-y-2.5">
                {article.weaknesses.map((w) => (
                  <div key={w.title} className="rounded-xl bg-[#f59e0b]/[0.08] p-3 ring-1 ring-[#f59e0b]/15">
                    <p className="text-[12.5px] font-bold text-[#b45309]">{w.title}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-ink/88">{w.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 연애 심층 */}
          {article && (
            <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
              <p className="mb-2.5 text-[14px] font-bold text-ink">💕 {prof.type}의 연애</p>
              <div className="space-y-2.5 text-[13px] leading-relaxed text-ink/88">
                <p><b className="text-accent-600">호감이 생기면</b> {article.love.attract}</p>
                <p><b className="text-accent-600">연애할 때</b> {article.love.dating}</p>
                <p><b className="text-[#b45309]">갈등할 때</b> {article.love.conflict}</p>
                <p><b className="text-primary-600">이런 사람과 잘 맞아요</b> {article.love.ideal}</p>
              </div>
            </div>
          )}

          {/* 우정 + 금전 */}
          {article && (
            <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
              <p className="mb-2 text-[14px] font-bold text-ink">🤝 우정 · 💰 금전</p>
              <div className="space-y-2.5 text-[13px] leading-relaxed text-ink/88">
                <p><b className="text-green-600">친구로서의 {prof.type}</b> {article.friendship}</p>
                <p><b className="text-accent-600">돈 쓰는 법</b> {article.money}</p>
              </div>
            </div>
          )}

          {/* 직장 */}
          {article && (
            <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
              <p className="mb-2.5 text-[14px] font-bold text-ink">💼 {prof.type}의 일과 직장</p>
              <div className="space-y-2.5 text-[13px] leading-relaxed text-ink/88">
                <p><b className="text-primary-600">일할 때</b> {article.work.general}</p>
                <p><b className="text-primary-600">팀원일 때</b> {article.work.asMember}</p>
                <p><b className="text-primary-600">리더일 때</b> {article.work.asLeader}</p>
              </div>
              <div className="mt-3">
                <p className="mb-1.5 text-[12.5px] font-semibold text-primary-600">잘 맞는 직업</p>
                <div className="flex flex-wrap gap-1.5">
                  {article.work.jobs.map((j) => (<span key={j} className="rounded-full bg-primary-500/[0.08] px-2.5 py-1 text-[12px] font-semibold text-primary-600 ring-1 ring-primary-500/20">{j}</span>))}
                </div>
              </div>
            </div>
          )}

          {/* 스트레스 */}
          {article && (
            <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
              <p className="mb-2.5 text-[14px] font-bold text-ink">😣 {prof.type}의 스트레스와 대처</p>
              <div className="space-y-2.5 text-[13px] leading-relaxed text-ink/88">
                <p><b className="text-[#b45309]">이럴 때 힘들어요</b> {article.stress.trigger}</p>
                <p><b className="text-[#b45309]">스트레스 받으면</b> {article.stress.reaction}</p>
                <p><b className="text-green-600">이렇게 풀어요</b> {article.stress.cope}</p>
              </div>
            </div>
          )}

          {/* 성장 로드맵 */}
          {article && (
            <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
              <p className="mb-2.5 text-[14px] font-bold text-ink">🌱 {prof.type} 성장 로드맵</p>
              <ol className="space-y-2">
                {article.growth.map((g, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed text-ink/88"><span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-500 text-[10px] font-bold text-white">{i + 1}</span>{g}</li>
                ))}
              </ol>
            </div>
          )}

          {/* 이 유형 대하는 법 + 유명인 */}
          {article && (
            <div className="rounded-card bg-primary-500/[0.05] p-5 ring-1 ring-primary-500/15">
              <p className="mb-1 text-[13px] font-bold text-primary-600">🫶 {prof.type}를 대하는 법</p>
              <p className="text-[13px] leading-relaxed text-ink/88">{article.withType}</p>
              <p className="mt-3 border-t border-primary-500/15 pt-3 text-[12.5px] leading-relaxed text-ink/74"><b className="text-primary-600">📌 한 줄 특징</b> {article.famous}</p>
            </div>
          )}

          {/* 유형 심화 — 직업·공략·스트레스·성장 */}
          {extra && (
            <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
              <p className="mb-2.5 text-[14px] font-bold text-ink">🔎 {prof.type} 깊이 알기</p>
              <div className="mb-3">
                <p className="mb-1.5 text-[12.5px] font-semibold text-primary-600">💼 타고난 직업 적성</p>
                <div className="flex flex-wrap gap-1.5">
                  {extra.jobs.map((j) => (<span key={j} className="rounded-full bg-primary-500/[0.08] px-2.5 py-1 text-[12px] font-semibold text-primary-600 ring-1 ring-primary-500/20">{j}</span>))}
                </div>
              </div>
              <div className="space-y-1.5 text-[13px] leading-relaxed text-ink/88">
                <p><b className="text-accent-600">💘 이 유형 공략법</b> {extra.loveTip}</p>
                <p><b className="text-[#b45309]">😣 스트레스 받으면</b> {extra.stress}</p>
                <p><b className="text-green-600">🌱 성장 포인트</b> {extra.growth}</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-canvas px-2.5 py-1 text-[11.5px] font-medium text-ink/82 ring-1 ring-black/5">롤 이미지 <b className="text-accent-600">{extra.famous}</b></span>
                <span className="rounded-full bg-canvas px-2.5 py-1 text-[11.5px] font-medium text-ink/82 ring-1 ring-black/5">{extra.sameRate}</span>
              </div>
            </div>
          )}

          {/* 잘 맞는 / 상극 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-2.5 text-[14px] font-bold text-ink">💞 {prof.type}와 찰떡 · 상극</p>
            <div className="flex flex-wrap gap-1.5">
              {prof.best.map((b) => (
                <button key={b} type="button" onClick={() => setYou(b)} className="rounded-full bg-accent-50 px-3 py-1.5 text-[12.5px] font-bold text-accent-600 ring-1 ring-accent-400/30 active:scale-95">{MBTI_DB[b].emoji} {b} 💞</button>
              ))}
              <span className="rounded-full bg-[#f59e0b]/[0.12] px-3 py-1.5 text-[12.5px] font-bold text-[#b45309]">{MBTI_DB[prof.worst].emoji} {prof.worst} ⚡상극</span>
            </div>
            <p className="mt-2 text-[12px] text-ink/62">상대 유형을 누르면 아래에서 궁합을 자세히 봐요 👇</p>
          </div>

          {/* 16유형 전체 궁합 랭킹 */}
          {ranking && (
            <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
              <p className="mb-2.5 text-[14px] font-bold text-ink">🏆 {prof.type} 궁합 전체 랭킹</p>
              <p className="mb-1.5 text-[12px] font-semibold text-accent-600">💞 베스트 3</p>
              <div className="mb-3 space-y-1.5">
                {ranking.best.map((b, i) => (
                  <button key={b.type} type="button" onClick={() => setYou(b.type)} className="flex w-full items-center gap-2 rounded-xl bg-accent-50 px-3 py-2 text-left ring-1 ring-accent-400/20 active:scale-[0.99]">
                    <span className="text-[13px] font-extrabold text-accent-500">{i + 1}위</span>
                    <span className="text-[13px] font-bold text-ink">{MBTI_DB[b.type].emoji} {b.type}</span>
                    <span className="text-[12px] text-ink/62">{b.label}</span>
                    <span className="ml-auto text-[13px] font-extrabold text-accent-500">{b.score}</span>
                  </button>
                ))}
              </div>
              <p className="mb-1.5 text-[12px] font-semibold text-[#b45309]">⚡ 조심할 3</p>
              <div className="space-y-1.5">
                {ranking.worst.map((b) => (
                  <button key={b.type} type="button" onClick={() => setYou(b.type)} className="flex w-full items-center gap-2 rounded-xl bg-[#f59e0b]/[0.08] px-3 py-2 text-left ring-1 ring-[#f59e0b]/15 active:scale-[0.99]">
                    <span className="text-[13px] font-bold text-ink">{MBTI_DB[b.type].emoji} {b.type}</span>
                    <span className="text-[12px] text-ink/62">{b.label}</span>
                    <span className="ml-auto text-[13px] font-extrabold text-[#b45309]">{b.score}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* MBTI 궁합 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-2.5 text-[14px] font-bold text-ink">🔗 MBTI 궁합 보기</p>
            <p className="mb-2 text-[12px] text-ink/62">상대 MBTI를 골라주세요</p>
            <Picker value={you} onPick={setYou} idPrefix="you" />
            {compat && (
              <div className="mt-4 border-t border-black/5 pt-4">
                <div className="flex flex-col items-center">
                  <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-accent-500 text-white">
                    <span className="text-[24px] font-extrabold leading-none">{compat.score}</span>
                    <span className="text-[11px] opacity-90">궁합</span>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className={["flex h-7 w-7 items-center justify-center rounded-full text-[14px] font-extrabold text-white", GRADE_BG[compat.grade]].join(" ")}>{compat.grade}</span>
                    <span className="text-[13px] font-bold text-accent-600">{compat.gradeLabel}</span>
                  </div>
                </div>
                <p className="mt-3 text-[15.5px] font-bold leading-tight text-ink">{compat.headline}</p>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink/88">{compat.summary}</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[{ label: "💕 연애", v: compat.dims.love }, { label: "🤝 우정", v: compat.dims.friend }, { label: "💼 직장", v: compat.dims.work }].map((d) => (
                    <div key={d.label} className="rounded-xl bg-canvas px-2 py-2.5 text-center ring-1 ring-black/5">
                      <p className="text-[11px] font-medium text-ink/66">{d.label}</p>
                      <p className="mt-0.5 text-[18px] font-extrabold text-primary-600">{d.v}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-ink/88"><b className="text-green-600">잘 맞는 점</b> {compat.good}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink/88"><b className="text-[#b45309]">조심할 점</b> {compat.caution}</p>
                <p className="mt-2.5 rounded-xl bg-accent-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-ink/88"><b className="text-accent-600">💡 {compat.nickname}</b> — {compat.tip}</p>
              </div>
            )}
          </div>

          {/* 공유 */}
          <button type="button" onClick={share} className="flex w-full items-center justify-center gap-1.5 rounded-card bg-accent-50 py-3.5 text-[14px] font-semibold text-accent-600 ring-1 ring-accent-400/30 active:scale-[0.99]">
            {copied ? "복사됐어요! 친구에게 자랑하기 📋" : "내 MBTI 운세 자랑하기 📋"}
          </button>

          <a href="https://sajuplan.com" className="flex items-center justify-center gap-1.5 rounded-card bg-primary-500/[0.07] py-3.5 text-[14px] font-semibold text-primary-600 ring-1 ring-primary-500/20 active:scale-[0.99]">
            MBTI 너머 타고난 내 사주가 궁금하다면 →
          </a>
        </section>
      )}

      <p className="mt-6 text-center text-[11px] leading-relaxed text-ink/58">MBTI 운세는 성격유형 통념을 활용한 재미·참고용이에요. 타고난 운명은 사주로 더 깊이 보세요 😊</p>
    </main>
  );
}
