import { useEffect, useMemo, useRef, useState } from "react";
import { searchDreams, dreamsByCategory, interpretDream, DREAM_CATEGORIES, type DreamCategory, type DreamLuck, type DreamResult } from "@portal/engine";
import NumberBalls from "../lotto/NumberBalls.js";

const CAT_STYLE: Record<DreamCategory, { bg: string; text: string }> = {
  재물: { bg: "bg-[#fff7e0]", text: "text-[#b88300]" },
  길몽: { bg: "bg-accent-50", text: "text-accent-500" },
  애정: { bg: "bg-accent-50", text: "text-accent-500" },
  변화: { bg: "bg-[#e8f1ff]", text: "text-[#2b6cff]" },
  주의: { bg: "bg-black/[0.05]", text: "text-ink/66" },
};
const LUCK_STYLE: Record<DreamLuck, { bg: string; ring: string; text: string }> = {
  대길: { bg: "bg-accent-500", ring: "ring-accent-500", text: "text-white" },
  길몽: { bg: "bg-accent-500/[0.1]", ring: "ring-accent-500/25", text: "text-accent-600" },
  중립: { bg: "bg-black/[0.05]", ring: "ring-black/10", text: "text-ink/70" },
  주의: { bg: "bg-[#f59e0b]/[0.12]", ring: "ring-[#f59e0b]/30", text: "text-[#b45309]" },
  흉몽: { bg: "bg-[#dc2626]/[0.08]", ring: "ring-[#dc2626]/25", text: "text-[#b91c1c]" },
};

type Cat = DreamCategory | "전체";
const TABS: Cat[] = ["전체", ...DREAM_CATEGORIES];

// 꿈해몽 v3 — 꿈 하나 = 긴 기사. 상세·상황별 다수·분야별·심리·조언 + 행운번호.
export default function DreamView() {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<Cat>("전체");
  const [selected, setSelected] = useState<DreamResult | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const resultRef = useRef<HTMLElement | null>(null);

  const searching = query.trim().length > 0;
  const list = useMemo(() => (searching ? searchDreams(query) : dreamsByCategory(cat)), [query, cat, searching]);

  // 꿈 선택/변경 시 결과 위치로 부드럽게 스크롤(맨 위가 아니라 해석이 보이게)
  useEffect(() => {
    if (selected) {
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }, [selected]);

  function choose(id: string) {
    const r = interpretDream(id);
    if (r) {
      setSelected(r);
      setAnimKey((k) => k + 1);
    }
  }

  return (
    <main className="px-4 pb-16 pt-3">
      {/* 검색(최상단·강조) */}
      <div className="rounded-card bg-white p-3 shadow-card ring-1 ring-black/5">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔎 꿈 검색 (예: 돼지, 검은 돼지, 돼지 도망)"
          className="w-full rounded-xl border border-black/10 bg-canvas px-4 py-2.5 text-[15px] text-ink outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-400/30"
        />
        <p className="mt-1.5 px-1 text-[12px] font-medium text-ink/88">
          {searching ? `검색 결과 ${list.length}개 — 두 단어 이상(예: '돼지 도망')도 검색돼요` : "단어 두 개 이상·유사어도 검색돼요. 못 찾으면 비슷한 말로 검색해보세요."}
        </p>
      </div>

      {/* 카테고리 브라우즈(검색 중엔 숨김) */}
      {!searching && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button key={t} type="button" onClick={() => setCat(t)} className={["rounded-full px-3 py-1.5 text-[12.5px] font-semibold ring-1 transition", cat === t ? "bg-accent-500 text-white ring-accent-500" : "bg-white text-ink/70 ring-black/10"].join(" ")}>{t}</button>
          ))}
        </div>
      )}

      {/* 꿈 칩 그리드 — 2열 가로 배치(낮은 칸 높이 + 또렷한 키워드) */}
      <section className="mt-3 grid grid-cols-2 gap-2">
        {list.map((d) => {
          const c = CAT_STYLE[d.category];
          const active = selected?.dream.id === d.id;
          return (
            <button key={d.id} type="button" onClick={() => choose(d.id)} className={["flex items-center gap-2 rounded-xl px-3 py-2.5 ring-1 transition active:scale-[0.97]", active ? "bg-accent-50 ring-accent-400" : "bg-white ring-black/5"].join(" ")}>
              <span className="shrink-0 text-[24px] leading-none" aria-hidden>{d.emoji}</span>
              <span className="min-w-0 flex-1 truncate text-left text-[15px] font-bold leading-tight text-ink">{d.keyword}</span>
              <span className={["shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold", c.bg, c.text].join(" ")}>{d.category}</span>
            </button>
          );
        })}
        {list.length === 0 && (
          <p className="col-span-2 py-8 text-center text-[13px] text-ink/58">해당 꿈을 못 찾았어요. 비슷한 단어로 검색해보세요.</p>
        )}
      </section>

      {/* 결과 — 긴 기사 */}
      {selected && (
        <section ref={resultRef} className="mt-5 scroll-mt-[68px] space-y-3">
          {/* 헤더 + 핵심 + 상세 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <div className="flex items-center gap-2.5">
              <span className="text-[30px]" aria-hidden>{selected.dream.emoji}</span>
              <div className="flex-1">
                <p className="text-[17px] font-bold text-ink">{selected.dream.keyword} 해몽</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className={["rounded-full px-2 py-0.5 text-[11px] font-semibold", CAT_STYLE[selected.dream.category].bg, CAT_STYLE[selected.dream.category].text].join(" ")}>{selected.dream.category}</span>
                  <span className={["rounded-full px-2 py-0.5 text-[11px] font-bold ring-1", LUCK_STYLE[selected.dream.luck].bg, LUCK_STYLE[selected.dream.luck].ring, LUCK_STYLE[selected.dream.luck].text].join(" ")}>{selected.dream.luck}</span>
                  {selected.caseCount > 0 && <span className="text-[11px] text-ink/58">상황별 {selected.caseCount}가지</span>}
                </div>
              </div>
            </div>
            <p className="mt-3 text-[14px] font-semibold leading-relaxed text-accent-600">{selected.dream.meaning}</p>
            {selected.dream.overview.map((para, i) => (
              <p key={i} className="mt-2 text-[13.5px] leading-relaxed text-ink/88">{para}</p>
            ))}
          </div>

          {/* ⭐상황별 풀이 */}
          {selected.dream.situations.map((g) => (
            <div key={g.group} className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
              <p className="mb-2.5 text-[14px] font-bold text-ink">📌 {g.group}</p>
              <div className="space-y-2">
                {g.cases.map((c, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className={["mt-px shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ring-1", LUCK_STYLE[c.luck].bg, LUCK_STYLE[c.luck].ring, LUCK_STYLE[c.luck].text].join(" ")}>{c.luck}</span>
                    <div>
                      <p className="text-[12.5px] font-semibold text-ink/88">{c.label}</p>
                      <p className="text-[12.5px] leading-snug text-ink/74">{c.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* 분야별 영향 */}
          {selected.dream.fields.length > 0 && (
            <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
              <p className="mb-2.5 text-[14px] font-bold text-ink">🎯 분야별 영향</p>
              <div className="space-y-2">
                {selected.dream.fields.map((f, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="shrink-0 rounded-full bg-primary-500/[0.08] px-2.5 py-0.5 text-[11.5px] font-semibold text-primary-600">{f.label}</span>
                    <span className="text-[12.5px] leading-snug text-ink/88">{f.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 심리 해석 + 조언 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="text-[12px] font-bold text-primary-600">🧠 심리 해석</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink/88">{selected.dream.psych}</p>
            <p className="mt-3 border-t border-black/5 pt-3 text-[12px] font-bold text-accent-600">💡 조언</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink/88">{selected.dream.advice}</p>
          </div>

          {/* 전통 속설·유래 */}
          {selected.dream.folk && (
            <div className="rounded-card bg-[#fff7e0] p-5 ring-1 ring-[#f59e0b]/15">
              <p className="text-[12px] font-bold text-[#b88300]">🏮 전통 속설</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink/88">{selected.dream.folk}</p>
            </div>
          )}

          {/* 행운번호 */}
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-3 text-center text-[13px] font-medium text-accent-500">{selected.lucky.source}</p>
            <NumberBalls numbers={selected.lucky.numbers} animKey={animKey} />
          </div>

          {/* 관련 꿈 */}
          {selected.related.length > 0 && (
            <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
              <p className="mb-2.5 text-[14px] font-bold text-ink">🔗 함께 보면 좋은 꿈</p>
              <div className="flex flex-wrap gap-2">
                {selected.related.map((d) => (
                  <button key={d.id} type="button" onClick={() => choose(d.id)} className="flex items-center gap-1 rounded-full bg-canvas px-3 py-1.5 text-[12.5px] font-medium text-ink/88 ring-1 ring-black/5 active:scale-[0.97]">
                    <span aria-hidden>{d.emoji}</span>{d.keyword}
                  </button>
                ))}
              </div>
            </div>
          )}

          <a href="https://sajuplan.com" className="flex items-center justify-center gap-1.5 rounded-card bg-primary-500/[0.07] py-3.5 text-[14px] font-semibold text-primary-600 ring-1 ring-primary-500/20 active:scale-[0.99]">
            이 꿈이 말하는 운의 흐름이 궁금하다면 →
          </a>
        </section>
      )}

      <p className="mt-6 text-center text-[11px] leading-relaxed text-ink/58">꿈해몽은 재미·참고용이에요. 행운번호는 당첨을 보장하지 않습니다(만 19세 이상).</p>
    </main>
  );
}
