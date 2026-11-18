import { useMemo, useState, type ReactNode } from "react";
import { destinyNumbers, quickPick, type LuckyNumbers } from "@portal/engine";
import { useProfile } from "../../lib/useProfile.js";
import MyInfoBar from "../MyInfoBar.js";
import NumberBalls from "./NumberBalls.js";

type Mode = "destiny" | "draw";

// "오늘의 행운번호" 첫 타일 — 평생 운명번호(사주) + 행운의 뽑기.
// 운명번호 입력은 공통 MyInfoBar(접힘 카드). ⚠️ 판매 아님. 재미·참고용. 당첨 보장/예측 표현 금지.
export default function LottoView() {
  const profile = useProfile();
  const [mode, setMode] = useState<Mode>("destiny");
  const [draw, setDraw] = useState<LuckyNumbers | null>(null);

  const destiny = useMemo<LuckyNumbers | null>(
    () => (profile?.birth ? destinyNumbers(profile.birth, profile.gender) : null),
    [profile],
  );
  const result = mode === "destiny" ? destiny : draw;

  function makeDraw() {
    const seed = (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0;
    setDraw(quickPick(seed));
  }

  return (
    <main className="px-4 pb-16 pt-3">
      {/* 모드 탭 */}
      <div className="mb-4 flex gap-2 rounded-full bg-black/[0.04] p-1">
        <ModeTab active={mode === "destiny"} onClick={() => setMode("destiny")}>🔮 사주 운명번호</ModeTab>
        <ModeTab active={mode === "draw"} onClick={() => setMode("draw")}>🎲 행운의 뽑기</ModeTab>
      </div>

      {mode === "destiny" ? (
        <>
          <MyInfoBar ctaLabel="생년월일 넣고 평생 운명번호 받기" />
          {!profile?.birth && (
            <p className="mt-2 text-center text-[12.5px] leading-relaxed text-ink/62">
              한 번 정해지면 바뀌지 않는 <b className="text-accent-500">나만의 번호</b>예요.
            </p>
          )}
        </>
      ) : (
        <section className="rounded-card bg-white p-4 text-center shadow-card ring-1 ring-black/5">
          <p className="text-[13px] text-ink/74">버튼을 눌러 오늘의 행운을 뽑아보세요</p>
          <button type="button" onClick={makeDraw} className="mt-3 w-full rounded-xl bg-primary-500 py-3 text-[15px] font-semibold text-white shadow-card transition active:scale-[0.99]">
            🎲 행운번호 뽑기
          </button>
        </section>
      )}

      {/* 결과 */}
      {result && (
        <section className="mt-4">
          <div className="rounded-card bg-white p-5 shadow-card ring-1 ring-black/5">
            <p className="mb-3 text-center text-[13px] font-medium text-accent-500">{result.source}</p>
            <NumberBalls numbers={result.numbers} animKey={result.numbers.join("-")} />
            <ul className="mt-4 divide-y divide-black/5">
              {result.details.map((d) => (
                <li key={d.n} className="flex items-center gap-3 py-2">
                  <span className="w-6 text-right text-[14px] font-bold text-ink/88">{d.n}</span>
                  <span className="text-[13.5px] text-ink/88">{d.meaning}</span>
                </li>
              ))}
            </ul>
          </div>

          <a href="https://sajuplan.com" className="mt-3 flex items-center justify-center gap-1.5 rounded-card bg-primary-500/[0.07] py-3.5 text-[14px] font-semibold text-primary-600 ring-1 ring-primary-500/20 active:scale-[0.99]">
            이 번호에 깃든 기운이 궁금하다면 →
          </a>
        </section>
      )}

      {/* 면책 (법적 안전선) */}
      <p className="mt-6 text-center text-[11px] leading-relaxed text-ink/58">
        본 서비스는 행운번호 추천 도구이며 <b>당첨을 보장하지 않습니다</b>. 재미·참고용으로 즐겨주세요.
        <br />
        구매는 동행복권(만 19세 이상)에서. 과도한 구매는 삼가세요.
      </p>
    </main>
  );
}

function ModeTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={["flex-1 rounded-full py-2 text-[13.5px] font-semibold transition", active ? "bg-white text-ink shadow-card" : "text-ink/62"].join(" ")}>
      {children}
    </button>
  );
}
