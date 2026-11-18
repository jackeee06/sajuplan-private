import { sharePage } from "../lib/share.js";

interface HeaderProps {
  title: string;
  /** 홈이면 로고 헤더, 아니면 뒤로가기+타이틀 */
  home?: boolean;
  onBack?: () => void;
}

// 공유 버튼 — 모든 화면 상시. Web Share(카톡·인스타) 우선, 미지원이면 ShareModal(전역).
function ShareButton({ title }: { title: string }) {
  return (
    <button type="button" onClick={() => void sharePage(`${title} — 사주플랜`)} aria-label="공유하기" className="flex items-center gap-1 rounded-full bg-accent-50 px-2.5 py-1 text-[12px] font-bold text-accent-500 transition active:scale-95">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="18" cy="5" r="2.6" stroke="currentColor" strokeWidth="2" />
        <circle cx="6" cy="12" r="2.6" stroke="currentColor" strokeWidth="2" />
        <circle cx="18" cy="19" r="2.6" stroke="currentColor" strokeWidth="2" />
        <path d="M8.3 10.7l7.4-4.4M8.3 13.3l7.4 4.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      공유하기
    </button>
  );
}

// 만세력 톤 헤더 — 사주플랜 로고 상시 노출(브랜드 일관성) + 공유 + 핑크 강조.
export default function Header({ title, home, onBack }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-[56px] items-center gap-2 border-b border-black/[0.04] bg-white/85 px-4 backdrop-blur-[8px]">
      {home ? (
        <div className="flex w-full items-center justify-between">
          <a href="https://sajuplan.com" aria-label="사주플랜 홈" className="transition active:opacity-60">
            <img src="/img/logo.svg" alt="사주플랜" className="h-[26px] w-auto" />
          </a>
          <div className="flex items-center gap-1">
            <span className="rounded-full bg-accent-50 px-3 py-1 text-[12px] font-bold text-accent-500">무료 운세</span>
            <ShareButton title={title} />
          </div>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={onBack}
            aria-label="뒤로"
            className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full text-ink/88 active:bg-black/5"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="flex-1 truncate text-[17px] font-bold leading-[120%] text-ink">{title}</h1>
          <ShareButton title={title} />
          <a href="https://sajuplan.com" aria-label="사주플랜 홈" className="transition active:opacity-60">
            <img src="/img/logo.svg" alt="사주플랜" className="h-[22px] w-auto opacity-90" />
          </a>
        </>
      )}
    </header>
  );
}
