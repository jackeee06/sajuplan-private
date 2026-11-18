import { useEffect, useState } from "react";
import type { SharePayload } from "../lib/share.js";

// 전역 공유 모달 — 네이티브 공유시트 미지원(카톡 인앱 등)일 때 "portal:share" 이벤트로 열린다.
// 건조한 시스템 토스트 대신 친절한 안내 + 링크 복사.
export default function ShareModal() {
  const [data, setData] = useState<SharePayload | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const on = (e: Event) => { setData((e as CustomEvent<SharePayload>).detail); setCopied(false); };
    window.addEventListener("portal:share", on);
    return () => window.removeEventListener("portal:share", on);
  }, []);

  if (!data) return null;

  function close() { setData(null); }
  async function copy() {
    try { await navigator.clipboard.writeText(data!.url); setCopied(true); } catch { /* ignore */ }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={close}>
      <div className="w-full max-w-[440px] rounded-t-2xl bg-white p-5 pb-7 shadow-card" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/10" />
        <p className="text-center text-[16px] font-bold text-ink">🔗 친구에게 공유하기</p>
        <p className="mt-1.5 text-center text-[12.5px] leading-relaxed text-ink/74">아래 링크를 복사해 카톡 대화창에 붙여넣으면 끝이에요 😊</p>

        <div className="mt-4 flex items-center gap-2 rounded-xl bg-canvas px-3 py-2.5 ring-1 ring-black/5">
          <span className="min-w-0 flex-1 truncate text-[13px] text-ink/88">{data.url}</span>
        </div>

        <button type="button" onClick={copy} className={["mt-3 w-full rounded-xl py-3 text-[15px] font-bold transition active:scale-[0.99]", copied ? "bg-accent-50 text-accent-600 ring-1 ring-accent-400/40" : "bg-accent-500 text-white"].join(" ")}>
          {copied ? "복사됐어요 ✓ 카톡에 붙여넣기" : "링크 복사하기"}
        </button>
        <button type="button" onClick={close} className="mt-2 w-full rounded-xl bg-canvas py-2.5 text-[13px] font-medium text-ink/70 ring-1 ring-black/5">닫기</button>
      </div>
    </div>
  );
}
