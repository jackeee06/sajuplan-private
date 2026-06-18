import { useRef } from 'react'
import { Calendar } from 'lucide-react'

const WD = ['일', '월', '화', '수', '목', '금', '토']

/** yyyy-mm-dd → "2026-06-13 (금)" (요일은 우리가 계산 — 브라우저 native "()" 빈칸 제거) */
function formatLabel(v: string): string {
  if (!v) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (!m) return v
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (isNaN(d.getTime())) return v
  return `${v} (${WD[d.getDay()]})`
}

/**
 * 공통 날짜 선택 — native <input type="date"> 를 투명 오버레이로 숨기고,
 * 우리가 포맷한 텍스트만 표시한다(브라우저가 그리는 "()" 빈칸 제거).
 * 칸 전체를 클릭하면 달력이 열린다. 모든 관리자 페이지의 date input 대체용.
 *
 * 사용:  <DateField value={frDate} onChange={(v) => setFrDate(v)} placeholder="시작일" />
 */
export function DateField({
  value,
  onChange,
  placeholder = '날짜 선택',
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const open = () => {
    const el = ref.current
    if (!el) return
    // showPicker: Chrome/Edge/Firefox/Safari16.4+ — 칸 전체 클릭으로 달력 열기
    const anyEl = el as HTMLInputElement & { showPicker?: () => void }
    if (typeof anyEl.showPicker === 'function') {
      try { anyEl.showPicker() } catch { el.focus() }
    } else {
      el.focus()
    }
  }
  return (
    <div
      onClick={open}
      className={`relative inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm cursor-pointer hover:border-brand-400 transition select-none ${value ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400'} ${className}`}
    >
      <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
      <span className="tabular-nums whitespace-nowrap">{value ? formatLabel(value) : placeholder}</span>
      <input
        ref={ref}
        type="date"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        aria-hidden
        className="absolute inset-0 h-full w-full opacity-0 pointer-events-none"
      />
    </div>
  )
}
