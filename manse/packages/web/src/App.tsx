import { useEffect, useMemo, useState } from "react";
import { computeManse, solarToLunar, type ManseChart, type ManseInput } from "@manse/engine";
import InputPanel from "./components/InputPanel.js";
import ChartGrid from "./components/ChartGrid.js";
import LuckFlow from "./components/LuckFlow.js";
import EasyView from "./components/EasyView.js";
import AnalysisView from "./components/AnalysisView.js";
import CoupleView from "./components/CoupleView.js";
import DailyFortune from "./components/DailyFortune.js";

type View = "pro" | "easy";

function fmtProfile(input: ManseChart["input"]): string {
  const m = /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(input.birth);
  if (!m) return input.birth;
  const [, y, mo, d, h, mi] = m;
  const hr = Number(h);
  const ampm = hr < 12 ? "오전" : "오후";
  const h12 = hr % 12 === 0 ? 12 : hr % 12;
  const time = input.unknownHour ? "시간모름" : `${ampm} ${h12}:${mi}`;
  return `${y}.${mo}.${d} ${time} · ${input.gender === "M" ? "남성" : "여성"}`;
}

function fmtLunar(birth: string): string {
  const m = /(\d{4})-(\d{2})-(\d{2})/.exec(birth);
  if (!m) return "";
  const lu = solarToLunar(Number(m[1]), Number(m[2]), Number(m[3]));
  return `음력 ${lu.year}.${lu.month}.${lu.day}${lu.leap ? "(윤)" : ""}`;
}

/** 세는나이(한국식) = 올해 − 태어난 해 + 1. 사주는 만 나이가 아니라 세는나이를 관례로 쓴다. */
function koreanAge(birth: string): number | null {
  const m = /(\d{4})/.exec(birth);
  if (!m) return null;
  const age = new Date().getFullYear() - Number(m[1]) + 1;
  return age > 0 && age < 200 ? age : null;
}

export default function App() {
  // lastInput = 세 탭(만세력·일일운세·궁합)이 공유하는 "현재 보는 사람"(세션 동안만, 영구저장 안 함)
  const [lastInput, setLastInput] = useState<ManseInput | null>(null);
  const chart = useMemo<ManseChart | null>(() => {
    if (!lastInput) return null;
    try { return computeManse(lastInput); } catch { return null; }
  }, [lastInput]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // 기본 뷰 우선순위: ①진입 신호(?view, 앱에서 상담사=pro) ②마지막 선택 기억 ③화면폭(PC=pro/모바일=easy)
  const [view, setView] = useState<View>(() => {
    if (typeof window === "undefined") return "easy";
    const q = new URLSearchParams(window.location.search).get("view");
    if (q === "pro" || q === "easy") return q;
    try {
      const saved = localStorage.getItem("manse_view");
      if (saved === "pro" || saved === "easy") return saved;
    } catch { /* 무시 */ }
    return window.innerWidth >= 768 ? "pro" : "easy";
  });
  // 사용자가 직접 고른 뷰는 기억 (다음 방문 시 그대로)
  function chooseView(v: View) {
    setView(v);
    try { localStorage.setItem("manse_view", v); } catch { /* 무시 */ }
  }
  const [tool, setTool] = useState<"saju" | "daily" | "couple">(() => {
    if (typeof window === "undefined") return "saju";
    const m = new URLSearchParams(window.location.search).get("m");
    return m === "couple" ? "couple" : m === "daily" ? "daily" : "saju";
  });
  const [editing, setEditing] = useState(false); // 입력 수정 모드

  function run(input: ManseInput) {
    try {
      computeManse(input); // 형식/음력 검증 (throw 시 아래 catch)
      setError(null);
      setLastInput(input);
      setEditing(false); // 계산되면 입력 패널 접기
    } catch (e) {
      setError((e as Error).message);
    }
  }
  // 입력 정보 비우기 — 상담사가 다음 사람으로 넘어갈 때
  function reset() {
    setLastInput(null);
    setEditing(false);
    setError(null);
  }

  // 공유 링크로 들어온 경우 자동 계산
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const b = q.get("b");
    if (b) {
      run({
        birth: b,
        name: q.get("nm") ?? undefined,
        gender: q.get("g") === "F" ? "F" : "M",
        longitude: Number(q.get("lon") ?? 127),
        unknownHour: q.get("uh") === "1",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1800);
  }

  async function share() {
    if (!lastInput) return;
    const q = new URLSearchParams({
      b: lastInput.birth,
      g: lastInput.gender,
      lon: String(lastInput.longitude ?? 127),
      uh: lastInput.unknownHour ? "1" : "0",
    });
    if (lastInput.name) q.set("nm", lastInput.name);
    const url = `${window.location.origin}${window.location.pathname}?${q}`;
    // 1) 네이티브 공유 시도 — title+url만 (text를 넣으면 카톡이 링크카드 대신 raw 텍스트로 처리)
    if (navigator.share) {
      try {
        await navigator.share({ title: "무료 만세력 — 사주플랜", url });
        return;
      } catch { /* 사용자 취소/실패 → 복사로 폴백 */ }
    }
    // 2) 폴백: 클립보드 복사 (항상 명확한 안내)
    try {
      await navigator.clipboard.writeText(url);
      flash("공유 링크를 복사했어요 — 붙여넣기 하면 이 사주가 그대로 열립니다");
    } catch {
      flash("공유 링크: " + url);
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 py-6">
      <header className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <a href="https://sajuplan.com" aria-label="사주플랜 홈으로" className="transition hover:opacity-70">
            <img src="/img/logo.svg" alt="사주플랜" className="h-7 w-auto" />
          </a>
          <div className="border-l border-gray-200 pl-2.5">
            <h1 className="whitespace-nowrap text-lg font-bold text-gray-800">무료 만세력·운세</h1>
          </div>
        </div>
        {tool === "saju" && (
          <div className="flex gap-1.5 text-sm font-medium">
            {(["easy", "pro"] as const).map((v) => (
              <button
                key={v} onClick={() => chooseView(v)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 ring-1 transition ${view === v ? "bg-accent-500 text-white ring-accent-500" : "bg-white text-gray-600 ring-gray-200 hover:bg-gray-50"}`}
              >
                {v === "easy" ? "쉽게 보기" : "전문가 보기"}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* 도구 탭: 사주 / 궁합 */}
      <div className="mb-4 flex gap-2">
        {([["saju", "만세력"], ["daily", "일일운세"], ["couple", "궁합"]] as const).map(([t, label]) => (
          <button
            key={t} onClick={() => setTool(t)}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
              tool === t ? "bg-accent-500 text-white shadow-sm" : "bg-white text-gray-500 ring-1 ring-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tool === "daily" && <DailyFortune sharedInput={lastInput} onShared={setLastInput} onReset={reset} />}
      {tool === "couple" && <CoupleView sharedInput={lastInput} />}
      {/* 입력 패널은 언마운트하지 않고 숨기기만 — 수정 시 이전 입력값 보존 */}
      {tool === "saju" && (
        <div className={!chart || editing ? "" : "hidden"}>
          <InputPanel onCompute={run} onError={setError} />
        </div>
      )}


      {error && (
        <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600 ring-1 ring-rose-100">{error}</div>
      )}

      {tool === "saju" && chart && !editing && (
        <div className="mt-4">
          {/* 프로필 헤더 + 저장/공유 */}
          <div className="mb-3 flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-gray-100">
            <div>
              {chart.input.name && <div className="text-[19px] font-bold leading-tight text-primary-600">{chart.input.name}</div>}
              <div className={`text-sm font-semibold text-gray-800${chart.input.name ? " mt-0.5" : ""}`}>
                {fmtProfile(chart.input)}
                <span className="ml-1 font-normal text-gray-400">· {chart.pillars.year.ganzhi}년 {chart.pillars.year.branch.animal}띠{koreanAge(chart.input.birth) != null ? ` · ${koreanAge(chart.input.birth)}세` : ""}</span>
              </div>
              <div className="text-xs text-gray-400">
                {fmtLunar(chart.input.birth)} · 일간 {chart.pillars.day.stem.hanja}({chart.pillars.day.stem.ko}) · {chart.analysis.gyeokguk} · {chart.analysis.strength.label}
              </div>
              <div className="mt-2 flex gap-1.5">
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-accent-600 ring-1 ring-accent-300 transition hover:bg-accent-50"
                >
                  ✏️ 정보 수정하기
                </button>
                <button
                  onClick={reset}
                  className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-300 transition hover:bg-gray-50"
                >
                  초기화
                </button>
              </div>
            </div>
            <div className="flex gap-1.5">
              <button onClick={share} className="rounded-lg bg-accent-500 px-3 py-1.5 text-xs font-medium text-white">결과 공유</button>
            </div>
          </div>

          <div>
            {view === "pro" ? (
              <div className="space-y-4">
                <ChartGrid chart={chart} />
                <LuckFlow chart={chart} />
                <AnalysisView chart={chart} />
              </div>
            ) : (
              <EasyView chart={chart} />
            )}
          </div>

          <div className="mt-5 flex items-center justify-between rounded-2xl bg-gradient-to-r from-primary-500 to-accent-500 px-4 py-3.5 text-white shadow-sm">
            <span className="text-sm font-medium">이 사주, 전문가에게 직접 물어볼까요?</span>
            <a href="https://sajuplan.com" className="rounded-full bg-white px-3.5 py-1.5 text-sm font-bold text-accent-500">사주플랜 상담</a>
          </div>
        </div>
      )}

      <footer className="mt-8 text-center text-xs text-gray-300">powered by 사주플랜</footer>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-gray-900/90 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
