/**
 * 페이지 번호 — Figma 109:9360 (pagination)
 *
 *  layout: row, justify center, gap 12, padding 20px 0
 *  - prev/next: 32×32, radius 50px, opacity 0.4 (disabled)
 *  - 활성 숫자: 32×32 원형, bg #f472b6, white 15/400/150% (LNUM/TNUM)
 *  - 비활성 숫자: 32×32, radius 6px, text #252B36
 */
interface Props {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export default function Pagination({ currentPage, totalPages, onPageChange }: Props) {
  const visibleCount = Math.min(5, Math.max(1, totalPages))
  const pages = Array.from({ length: visibleCount }, (_, i) => i + 1)
  const prevDisabled = currentPage <= 1
  const nextDisabled = currentPage >= totalPages

  return (
    <nav className="flex items-center justify-center gap-3 py-5" aria-label="페이지 네비게이션">
      <button
        type="button"
        disabled={prevDisabled}
        onClick={() => onPageChange(currentPage - 1)}
        aria-label="이전 페이지"
        className="w-8 h-8 rounded-[50px] flex items-center justify-center disabled:opacity-40"
      >
        <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden>
          <path d="M12.5 4.5L7.5 10L12.5 15.5" stroke="#252B36" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className="flex items-center gap-1">
        {pages.map((p) => {
          const active = p === currentPage
          return (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-current={active ? 'page' : undefined}
              aria-label={`${p} 페이지`}
              className={
                active
                  ? 'w-8 h-8 rounded-[50px] bg-[#f472b6] flex items-center justify-center'
                  : 'w-8 h-8 rounded-[6px] flex items-center justify-center'
              }
            >
              <span
                className={`text-[15px] leading-[150%] tabular-nums ${
                  active ? 'text-white' : 'text-[#252B36]'
                }`}
                style={{ fontVariantNumeric: 'lining-nums tabular-nums' }}
              >
                {p}
              </span>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        disabled={nextDisabled}
        onClick={() => onPageChange(currentPage + 1)}
        aria-label="다음 페이지"
        className="w-8 h-8 rounded-[8px] flex items-center justify-center disabled:opacity-40"
      >
        <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden>
          <path d="M7.5 4.5L12.5 10L7.5 15.5" stroke="#252B36" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </nav>
  )
}
