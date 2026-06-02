import { rangePresets, activePresetLabel } from '../lib/dateRange'

/**
 * 빠른 기간 필터 칩 5종 (오늘/어제/최근7일/이번달/지난달).
 * 2026-06-02 사장님 합의: 모든 통계/리스트 페이지 일관 적용.
 *
 * 사용:
 *   <DateRangeChips
 *     from={pending.from}
 *     to={pending.to}
 *     onPick={(r) => setPending({ ...pending, from: r.from, to: r.to })}
 *   />
 */
export function DateRangeChips({
  from,
  to,
  onPick,
}: {
  from: string
  to: string
  onPick: (r: { from: string; to: string }) => void
}) {
  const active = activePresetLabel(from, to)
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {rangePresets.map((p) => {
        const isActive = active === p.label
        return (
          <button
            key={p.label}
            type="button"
            onClick={() => onPick(p.calc())}
            className={
              'px-2.5 py-1 text-[12px] rounded-full border transition ' +
              (isActive
                ? 'bg-brand-50 border-brand-300 text-brand-700 font-medium'
                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800')
            }
          >
            {p.label}
          </button>
        )
      })}
    </div>
  )
}
