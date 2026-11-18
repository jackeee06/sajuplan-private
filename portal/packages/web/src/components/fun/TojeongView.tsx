import { useMemo, useState } from "react";
import { useProfile } from "../../lib/useProfile.js";
import MyInfoBar from "../MyInfoBar.js";
import YearToggle, { defaultYear } from "../YearToggle.js";
import { buildTojeong, type Tojeong } from "../../lib/tojeong.js";

const EL_COLOR: Record<string, string> = { 목: "#16a34a", 화: "#dc2626", 토: "#b88300", 금: "#6b7280", 수: "#2b6cff" };
const GRADE_STYLE: Record<string, { bg: string; text: string }> = {
  대길: { bg: "bg-accent-500", text: "text-white" },
  길: { bg: "bg-accent-500/[0.12]", text: "text-accent-600" },
  평: { bg: "bg-black/[0.05]", text: "text-ink/70" },
  주의: { bg: "bg-[#f59e0b]/[0.14]", text: "text-[#b45309]" },
};

// 토정비결 v2 "정통 144괘" — 진짜 작괘로 산출한 괘 + 괘상 한시 + 총운 + 상중하 3괘 + 분야별 + 12개월 + 행운 + 삼재 + 유래.
export default function TojeongView() {
  const profile = useProfile();
  const [year, setYear] = useState(defaultYear());
  const r: Tojeong | null = useMemo(
    () => (profile?.birth ? buildTojeong(profile, year) : null),
    [profile, year],
  );

  return (
    <main className="px-4 pb-16 pt-3">
      <MyInfoBar showSaju ctaLabel={`생년월일 넣고 ${year}년 토정비결 보기`} />
      <YearToggle year={year} onChange={setYear} />

      {r ? (
        <section className="mt-3 space-y-3">
          {/* 괘상 헤더 */}
          <div className="rounded-card bg-white p-5 text-center shadow-card ring-1 ring-black/5">
            <p className="text-[12px] font-medium text-ink/62">{r.year}년({r.yearGanzhi}·{r.yearZodiac}띠) 토정비결</p>
            <div className="mt-2 flex items-center justify-center gap-2">
              <span className="text-[34px] leading-none" aria-hidden>{r.gua8.sym}</span>
              <div className="text-left">
                <p className="text-[18px] font-bold text-ink">{r.gua8.name}괘 <span className="text-[13px] font-medium text-ink/62">({r.gua8.hj}·{r.gua8.nature})</span></p>
                <p className="text-[11.5px] font-medium text-accent-500">제 {r.guaNumber} 괘 · 올해는 '{r.theme}'의 해</p>
              </div>
            </div>
            <p className="mt-3 text-[15px] font-bold italic leading-relaxed text-primary-700">“{r.topVerse}”</p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <span className={["flex h-12 w-12 flex-col items-center justify-center rounded-full", GRADE_STYLE[r.grade]!.bg, GRADE_STYLE[r.grade]!.text].join(" ")}>
                <span className="text-[15px] font-extrabold leading-none">{r.overall}</span>
              </span>
              <span className={["rounded-full px-3 py-1 text-[12px] font-bold", GRADE_STYLE[r.grade]!.bg, GRADE_STYLE[r.grade]!.text].join(" ")}>올해의 신수 · {r.grade}</span>
            </div>
          </div>

          {/* 총운 롱폼 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-2 text-[14px] font-bold text-ink">📜 올해의 총운</p>
            <div className="space-y-2">
              {r.summary.map((line, i) => (<p key={i} className={i === 0 ? "text-[14.5px] font-semibold leading-relaxed text-ink" : "text-[13.5px] leading-relaxed text-ink/88"}>{line}</p>))}
            </div>
          </div>

          {/* 상·중·하 3괘 풀이 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-2.5 text-[14px] font-bold text-ink">🔯 내 괘 풀이 (상·중·하)</p>
            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-500 text-[13px] font-bold text-white">{r.sang}</span>
                <div><p className="text-[12.5px] font-semibold text-ink/88">상괘 · {r.gua8.name}({r.gua8.hj}) — 하늘이 정한 큰 기운</p><p className="text-[12.5px] leading-relaxed text-ink/74">{r.gua8.trait}</p></div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-500/15 text-[13px] font-bold text-accent-600">{r.jung}</span>
                <div><p className="text-[12.5px] font-semibold text-ink/88">중괘 · {r.jungInfo.label} — 한 해의 전개</p><p className="text-[12.5px] leading-relaxed text-ink/74">{r.jungInfo.text}</p></div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-black/[0.06] text-[13px] font-bold text-ink/74">{r.ha}</span>
                <div><p className="text-[12.5px] font-semibold text-ink/88">하괘 · {r.haInfo.label} — 마무리</p><p className="text-[12.5px] leading-relaxed text-ink/74">{r.haInfo.text}</p></div>
              </div>
            </div>
          </div>

          {/* 분야별 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-2.5 text-[14px] font-bold text-ink">🎯 분야별 운세</p>
            <div className="space-y-2">
              {r.fields.map((f, i) => (
                <div key={i} className="flex gap-2">
                  <span className="shrink-0 rounded-full bg-primary-500/[0.08] px-2.5 py-0.5 text-[11.5px] font-semibold text-primary-600">{f.emoji} {f.label}</span>
                  <span className="text-[12.5px] leading-snug text-ink/88">{f.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 삼재 */}
          {r.samjae && (
            <div className="rounded-card bg-[#fff7e0] p-4 ring-1 ring-[#f59e0b]/15">
              <p className="text-[12px] font-bold text-[#b88300]">⚠️ 올해 삼재(三災) 띠</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink/88">올해는 당신의 띠가 삼재에 듭니다. 큰 변화·이동·투자는 한 박자 신중히 하고, 마음을 다스리면 무탈하게 지나가요. 삼재라도 좋은 괘면 크게 걱정하지 않아도 돼요.</p>
            </div>
          )}

          {/* 12개월 */}
          <div className="rounded-card bg-white p-4 shadow-card ring-1 ring-black/5">
            <p className="mb-2 px-1 text-[14px] font-bold text-ink">🗓️ 달별 운세 (정월~섣달)</p>
            <div className="divide-y divide-black/5">
              {r.months.map((m) => (
                <div key={m.month} className="flex items-start gap-3 py-2.5">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg bg-canvas text-center ring-1 ring-black/5">
                    <span className="text-[12px] font-bold text-ink/88">{m.month}월</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-ink/58">{m.ganzhi} · {m.tenGod}</span>
                      <span className="text-[12px] font-bold tabular-nums text-accent-500">{m.score}</span>
                    </div>
                    <p className="mt-0.5 text-[13px] font-medium italic leading-relaxed text-primary-700">“{m.verse}”</p>
                    <p className="text-[12px] leading-relaxed text-ink/70">{m.gloss}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 행운요소 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-2 text-[14px] font-bold text-ink">🍀 올해의 행운요소</p>
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full bg-canvas px-2.5 py-1 text-[11.5px] font-medium text-ink/88 ring-1 ring-black/5">행운의 색 <b className="text-accent-600">{r.lucky.colors.join("·")}</b></span>
              <span className="rounded-full bg-canvas px-2.5 py-1 text-[11.5px] font-medium text-ink/88 ring-1 ring-black/5">행운의 방향 <b className="text-accent-600">{r.lucky.dir}</b></span>
              <span className="rounded-full bg-canvas px-2.5 py-1 text-[11.5px] font-medium text-ink/88 ring-1 ring-black/5">행운의 숫자 <b className="text-accent-600">{r.lucky.numbers.join("·")}</b></span>
            </div>
          </div>

          {/* 유래 스토리 */}
          <div className="rounded-card bg-[#fff7e0] p-5 ring-1 ring-[#f59e0b]/15">
            <p className="text-[12px] font-bold text-[#b88300]">🏮 토정비결 이야기</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink/88">토정비결은 조선의 기인 <b>토정 이지함(1517~1578)</b>의 이름을 빌린 책이에요. 정작 그가 직접 썼다는 기록은 없고, 그가 세상을 떠난 한참 뒤인 19세기에 등장해 "토정 선생의 비결"이라는 권위를 빌려 널리 퍼졌어요(가탁설).</p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink/88">가장 큰 특징은 <b>태어난 시(時)를 안 본다</b>는 점이에요. 사주는 연·월·일·시 네 기둥이 모두 필요하지만, 토정비결은 <b>생년·월·일 세 가지</b>만으로 144개의 괘 중 하나를 뽑아 한 해 신수를 봐요. 그래서 출생시간을 몰라도 누구나 볼 수 있어 정초의 대표 세시풍속이 됐죠. 괘의 약 70%가 좋은 쪽이라, 새해 덕담처럼 기분 좋게 보는 재미가 있어요.</p>
          </div>

          <p className="px-1 text-[10.5px] leading-relaxed text-ink/58">{r.basis}</p>

          <a href="https://sajuplan.com" className="flex items-center justify-center gap-1.5 rounded-card bg-primary-500/[0.07] py-3.5 text-[14px] font-semibold text-primary-600 ring-1 ring-primary-500/20 active:scale-[0.99]">
            내 한 해, 더 깊은 풀이가 궁금하다면 →
          </a>
        </section>
      ) : (
        <p className="mt-2 text-center text-[12.5px] leading-relaxed text-ink/62">생년월일을 한 번만 입력하면 바로 토정비결이 나와요.</p>
      )}

      <p className="mt-6 text-center text-[11px] leading-relaxed text-ink/58">괘 번호는 정통 작괘법으로 산출하되, 풀이는 재미·참고용이에요. 깊은 풀이는 전문 상담사와 함께하세요.</p>
    </main>
  );
}
