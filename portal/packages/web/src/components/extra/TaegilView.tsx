import { useMemo, useState } from "react";
import { buildTaegil, marriageNote, TAEGIL_PURPOSES, PURPOSE_GUIDE, type TaegilPurpose, type DayCore } from "../../lib/taegilEngine.js";
import { useProfile } from "../../lib/useProfile.js";
import MyInfoBar from "../MyInfoBar.js";

const EMOJI: Record<TaegilPurpose, string> = { 이사: "📦", 결혼: "💍", 개업: "🏪", 계약: "✍️", 여행: "✈️" };
const EL_COLOR: Record<string, string> = { 목: "#16a34a", 화: "#dc2626", 토: "#b88300", 금: "#6b7280", 수: "#2b6cff" };
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

function gradeStyle(s: number) {
  if (s >= 85) return { bg: "bg-accent-500", text: "text-white", label: "대길" };
  if (s >= 70) return { bg: "bg-accent-500/[0.12]", text: "text-accent-600", label: "길일" };
  if (s >= 50) return { bg: "bg-black/[0.05]", text: "text-ink/70", label: "보통" };
  return { bg: "bg-[#f59e0b]/[0.14]", text: "text-[#b45309]", label: "주의" };
}

// 택일 v2 "최강 택일" — 만세 엔진 결합 정통 택일. 달력 탭 → 그 날의 손없는날·황도·건제12신·귀인·용도별 점수.
export default function TaegilView() {
  const profile = useProfile();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [purpose, setPurpose] = useState<TaegilPurpose>("이사");
  const isThisMonth = year === today.getFullYear() && month === today.getMonth() + 1;
  const [selDay, setSelDay] = useState<number>(isThisMonth ? today.getDate() : 1);

  const data = useMemo(() => buildTaegil(year, month, profile), [year, month, profile]);
  const marriage = useMemo(() => marriageNote(profile), [profile]);
  const sel: DayCore | undefined = data.days.find((d) => d.day === selDay) ?? data.days[0];

  function shiftMonth(delta: number) {
    let y = year, m = month + delta;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setYear(y); setMonth(m);
    const isTM = y === today.getFullYear() && m === today.getMonth() + 1;
    setSelDay(isTM ? today.getDate() : 1);
  }

  const bestDays = [...data.days].sort((a, b) => b.scores[purpose] - a.scores[purpose]).filter((d) => d.scores[purpose] >= 70).slice(0, 6).sort((a, b) => a.day - b.day);

  return (
    <main className="px-4 pb-16 pt-3">
      {/* 월 네비 */}
      <div className="mb-3 flex items-center justify-center gap-4">
        <button type="button" onClick={() => shiftMonth(-1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-ink/66 ring-1 ring-black/5 active:scale-95">‹</button>
        <p className="text-[14px] font-bold text-ink">{year}년 {month}월 <span className="text-accent-500">택일</span></p>
        <button type="button" onClick={() => shiftMonth(1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-ink/66 ring-1 ring-black/5 active:scale-95">›</button>
      </div>

      {/* 용도 탭 */}
      <section className="rounded-card bg-white p-3 shadow-card ring-1 ring-black/5">
        <p className="mb-2 text-[12.5px] font-medium text-ink">무엇을 위한 날인가요?</p>
        <div className="grid grid-cols-5 gap-1.5">
          {TAEGIL_PURPOSES.map((pp) => {
            const active = purpose === pp;
            return (
              <button key={pp} type="button" onClick={() => setPurpose(pp)} className={["flex flex-col items-center gap-1 rounded-xl py-2 ring-1 transition active:scale-[0.97]", active ? "bg-accent-50 ring-accent-400" : "bg-canvas ring-black/5"].join(" ")}>
                <span className="text-[18px] leading-none" aria-hidden>{EMOJI[pp]}</span>
                <span className={["text-[11px] font-medium", active ? "text-accent-500" : "text-ink/74"].join(" ")}>{pp}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 px-0.5 text-[11.5px] leading-relaxed text-ink/66">{PURPOSE_GUIDE[purpose]}</p>
      </section>

      {/* 개인화 정보바 */}
      <div className="mt-3">
        <MyInfoBar ctaLabel="생년월일 넣고 내 길일 받기" showSaju />
      </div>

      {/* 올해 방위·삼재 배너 */}
      <div className="mt-3 rounded-card bg-[#fff7e0] p-4 ring-1 ring-[#f59e0b]/15">
        <p className="text-[12px] font-bold text-[#b88300]">🧭 {year}년({data.taboo.yearZodiac}띠해) 방위·삼재</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-white px-2.5 py-1 text-[11.5px] font-medium text-ink/88 ring-1 ring-black/5">이사 피할 방향(삼살) <b className="text-[#b45309]">{data.taboo.samsal}</b></span>
          <span className="rounded-full bg-white px-2.5 py-1 text-[11.5px] font-medium text-ink/88 ring-1 ring-black/5">수리·건축 피할 방향(대장군) <b className="text-[#b45309]">{data.taboo.daejang}</b></span>
        </div>
        <p className="mt-2 text-[11.5px] text-ink/74">올해 삼재 띠: <b className="text-ink/88">{data.taboo.samjae.join("·")}</b></p>
      </div>

      {/* 절기 배너 */}
      {data.terms.length > 0 && (
        <div className="mt-3 rounded-card bg-white p-3 shadow-card ring-1 ring-black/5">
          <p className="text-[12px] font-semibold text-ink">🌿 이달의 절기</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {data.terms.map((t) => (
              <span key={t.day} className="rounded-full bg-canvas px-2.5 py-1 text-[11.5px] font-medium text-ink/78 ring-1 ring-black/5">{month}/{t.day} {t.name}</span>
            ))}
          </div>
        </div>
      )}

      {/* 달력 */}
      <section className="mt-3 rounded-card bg-white p-4 shadow-card ring-1 ring-black/5">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" onClick={() => shiftMonth(-1)} aria-label="이전 달" className="flex h-7 w-7 items-center justify-center rounded-full bg-canvas text-ink/66 ring-1 ring-black/5 active:scale-95">‹</button>
          <p className="text-[12.5px] font-semibold text-ink">📅 {month}월 · {EMOJI[purpose]} {purpose} 좋은 날</p>
          <button type="button" onClick={() => shiftMonth(1)} aria-label="다음 달" className="flex h-7 w-7 items-center justify-center rounded-full bg-canvas text-ink/66 ring-1 ring-black/5 active:scale-95">›</button>
        </div>
        <p className="mb-2 text-center text-[11px] text-ink/58">날짜를 눌러보세요 · ‹ › 로 다른 달 보기</p>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEK.map((w, i) => (
            <div key={w} className={["py-1 text-[11px] font-medium", i === 0 ? "text-[#dc2626]" : i === 6 ? "text-[#2b6cff]" : "text-ink/58"].join(" ")}>{w}</div>
          ))}
          {Array.from({ length: data.firstWeekday }).map((_, i) => <div key={`b${i}`} />)}
          {data.days.map((d) => {
            const sc = d.scores[purpose];
            const gs = gradeStyle(sc);
            const active = d.day === selDay;
            return (
              <button key={d.day} type="button" onClick={() => setSelDay(d.day)}
                className={["relative flex flex-col items-center rounded-lg py-1.5 ring-1 transition active:scale-95", active ? "ring-accent-400 ring-2" : "ring-black/5", sc >= 85 ? "bg-accent-50" : sc >= 70 ? "bg-accent-500/[0.06]" : sc < 50 ? "bg-[#f59e0b]/[0.07]" : "bg-canvas"].join(" ")}>
                <span className="text-[14px] font-bold text-ink">{d.day}</span>
                <span className={["mt-0.5 rounded px-1 text-[8.5px] font-bold leading-tight", gs.bg, gs.text].join(" ")}>{gs.label}</span>
                {d.son.free && <span className="absolute right-0.5 top-0.5 text-[8px]" title="손없는 날">🎉</span>}
              </button>
            );
          })}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-ink/62">
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-accent-50 ring-1 ring-accent-400/40" />대길</span>
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-accent-500/[0.06] ring-1 ring-black/5" />길일</span>
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-[#f59e0b]/[0.07] ring-1 ring-black/5" />주의</span>
          <span>🎉 손없는 날</span>
        </div>
      </section>

      {/* 이달 추천 길일 칩 */}
      {bestDays.length > 0 && (
        <div className="mt-3 rounded-card bg-white p-4 shadow-card ring-1 ring-black/5">
          <p className="mb-2 text-[12px] font-semibold text-ink">⭐ {purpose} 추천 길일 TOP</p>
          <div className="flex flex-wrap gap-1.5">
            {bestDays.map((d) => (
              <button key={d.day} type="button" onClick={() => setSelDay(d.day)} className={["rounded-full px-3 py-1.5 text-[12px] font-semibold ring-1 active:scale-95", d.scores[purpose] >= 85 ? "bg-accent-500 text-white ring-accent-500" : "bg-accent-50 text-accent-600 ring-accent-400/40"].join(" ")}>
                {month}/{d.day}({d.weekday}) {d.son.free ? "🎉" : ""}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 선택일 상세 */}
      {sel && (
        <section className="mt-4 space-y-3">
          {/* 헤더 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[17px] font-bold text-ink">{month}월 {sel.day}일 <span className="text-[13px] font-medium text-ink/62">({sel.weekday})</span></p>
                <p className="mt-0.5 text-[12px] text-ink/70">음력 {sel.lunarLeap ? "윤" : ""}{sel.lunarMonth}.{sel.lunarDay}</p>
              </div>
              <div className="text-right">
                {(() => { const gs = gradeStyle(sel.scores[purpose]); return (
                  <span className={["rounded-full px-3 py-1 text-[13px] font-bold", gs.bg, gs.text].join(" ")}>{EMOJI[purpose]} {purpose} {gs.label}</span>
                ); })()}
                <p className="mt-1 text-[12px] text-ink/62">{sel.scores[purpose]}점</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 border-t border-black/5 pt-3">
              <span className="rounded-lg px-2.5 py-1 text-[15px] font-bold text-white" style={{ backgroundColor: EL_COLOR[sel.element] }}>{sel.ganzhiHj}</span>
              <div>
                <p className="text-[14px] font-bold text-ink">{sel.ganzhiKo}일 · {sel.element}({sel.zodiac}띠)</p>
                <p className="text-[11.5px] text-ink/66">육십갑자 {sel.gzNum}번째 날</p>
              </div>
            </div>
          </div>

          {/* 손없는 날 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="text-[14px] font-bold text-ink">🧭 손 없는 날</p>
            {sel.son.free ? (
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink/88"><b className="text-accent-600">🎉 손 없는 날이에요.</b> 귀신(손)이 하늘로 올라가 어느 방향으로 이사·이동·수리해도 거리낌이 없는 날이에요. 예부터 이사·개업의 1순위로 꼽던 날이에요.</p>
            ) : (
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink/88">오늘은 손(損)이 <b className="text-[#b45309]">{sel.son.dir}</b>에 있어요. {sel.son.dir}으로 이사·이동·큰일은 피하고, 다른 방향은 괜찮아요. 음력 9·10·19·20·29·30일이 손 없는 날이에요.</p>
            )}
          </div>

          {/* 황도길일 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="text-[14px] font-bold text-ink">{sel.hwangdo.emoji} 황도길일 · 오늘의 수호신</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink/88">
              오늘을 지키는 신장은 <b className={sel.hwangdo.gil ? "text-accent-600" : "text-[#b45309]"}>{sel.hwangdo.name}{sel.hwangdo.gil ? "황도" : "흑도"}</b>예요.
              {sel.hwangdo.gil ? " 12신장 중 길한 6황도가 든 날이라 만사가 순조롭게 풀리는 좋은 날이에요. 시작하는 일에 기운이 따라요." : " 12신장 중 흉한 6흑도가 든 날이라, 큰일은 한 박자 미루고 무리하지 않는 게 좋아요."}
            </p>
          </div>

          {/* 건제12신 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="text-[14px] font-bold text-ink">{sel.jianchu.emoji} 건제12신 · {sel.jianchu.hj}({sel.jianchu.ko})일</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink/88">
              오늘은 <b className={sel.jianchu.gil ? "text-accent-600" : "text-ink/88"}>{sel.jianchu.ko}({sel.jianchu.hj})</b>일이에요. {sel.jianchu.desc}. {sel.jianchu.gil ? "12직성 중 길한 날에 속해요." : "큰일은 가려서 하는 게 좋아요."}
            </p>
          </div>

          {/* 귀인 (개인화 / 일반) */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="text-[14px] font-bold text-ink">🍀 귀인·길신</p>
            <div className="mt-1.5 space-y-1.5">
              {data.personalized ? (
                <p className="text-[12.5px] leading-relaxed text-ink/88">{sel.cheoneul ? <><b className="text-accent-600">당신에게 천을귀인이 드는 날이에요.</b> 사주에서 가장 귀하게 치는 길신으로, 귀인의 도움과 뜻밖의 행운이 따르는 날이에요.</> : "오늘은 당신의 천을귀인일은 아니에요. 달력에서 천을귀인 든 날을 함께 노려보세요."}</p>
              ) : (
                <p className="text-[12.5px] leading-relaxed text-ink/66">생년월일을 넣으면 <b>당신에게 천을귀인이 드는 날</b>(가장 귀한 길신)을 콕 집어 알려드려요.</p>
              )}
              {sel.woldeok && <p className="text-[12.5px] leading-relaxed text-ink/88"><b className="text-accent-600">월덕귀인이 든 날</b>이에요. 그달의 흉살을 눌러주는 길신이라, 웬만한 흉도 가벼워지는 날이에요.</p>}
            </div>
          </div>

          {/* 용도별 점수 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-2.5 text-[14px] font-bold text-ink">🎯 이 날, 용도별 점수</p>
            <div className="space-y-2">
              {TAEGIL_PURPOSES.map((pp) => {
                const sc = sel.scores[pp];
                const gs = gradeStyle(sc);
                return (
                  <div key={pp} className="flex items-center gap-2">
                    <span className="w-12 shrink-0 text-[12px] font-medium text-ink/88">{EMOJI[pp]} {pp}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/[0.05]">
                      <div className={["h-full rounded-full", sc >= 85 ? "bg-accent-500" : sc >= 70 ? "bg-accent-400" : sc < 50 ? "bg-[#f59e0b]" : "bg-ink/25"].join(" ")} style={{ width: `${sc}%` }} />
                    </div>
                    <span className={["w-9 shrink-0 text-right text-[11px] font-bold", gs.text].join(" ")}>{sc}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 결혼 특수 */}
          {purpose === "결혼" && marriage && (
            <div className="rounded-card bg-[#fdf2f8] p-5 ring-1 ring-accent-400/20">
              <p className="text-[13px] font-semibold text-accent-600">💍 신부({marriage.brideZodiac}띠) 혼인 택월</p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink/88">가장 좋은 혼인달(대리월): <b className="text-accent-600">음력 {marriage.goodMonths.join("·")}월</b></p>
              {marriage.avoidMonths.length > 0 && (
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink/88">꼭 피할 달(살부대기월): <b className="text-[#b45309]">음력 {marriage.avoidMonths.join("·")}월</b> — 예부터 신부에게 흉하다 하여 혼인을 피했어요.</p>
              )}
            </div>
          )}
          {purpose === "결혼" && !marriage && (
            <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
              <p className="text-[12.5px] leading-relaxed text-ink/66">신부 생년월일을 넣으면 <b>가취월(좋은 혼인달)·살부대기월(피할 달)</b>까지 콕 집어 알려드려요.</p>
            </div>
          )}

          <a href="https://sajuplan.com" className="flex items-center justify-center gap-1.5 rounded-card bg-primary-500/[0.07] py-3.5 text-[14px] font-semibold text-primary-600 ring-1 ring-primary-500/20 active:scale-[0.99]">
            내 사주에 꼭 맞는 진짜 길일을 받고 싶다면 →
          </a>
        </section>
      )}

      <p className="mt-6 text-center text-[11px] leading-relaxed text-ink/58">택일은 재미·참고용이에요. 계산(간지·음력·절기·방위)은 정통 기준으로 정확하지만, 중요한 날은 전문 상담사와 함께 정하세요.</p>
    </main>
  );
}
