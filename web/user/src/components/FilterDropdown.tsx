import { useCallback, useEffect, useRef, useState } from 'react'
import { useDismissOnBack } from '../lib/use-dismiss-on-back'

/**
 * filter_select — Figma `84:3897` (active=off) / 활성 시 디자인 시스템 칩 활성 상태
 *
 * 비활성: bg #F9FAFB, border 1px #F3F4F6, text/chevron #6A7282
 * 활성  : bg #F3EEFE, border 1px #9B7AF7, text/chevron #8259F5  (선택값이 라벨 자리에 표시)
 *
 * 동작:
 *  - 클릭 → 칩 바로 아래 드롭다운 패널 토글
 *  - 옵션 클릭 → 선택 후 자동 닫힘 + 활성 스타일
 *  - "전체" 옵션 → 선택 해제 (비활성 복귀)
 *  - 외부 클릭 / Esc → 닫힘
 */
interface Props {
  /** 비선택 시 라벨 (예: "분야") */
  label: string
  options: string[]
  value: string | null
  onChange: (value: string | null) => void
  /** "전체" 옵션 라벨 (기본: 전체). null로 두면 전체 옵션 미표시 */
  allLabel?: string | null
}

export default function FilterDropdown({
  label,
  options,
  value,
  onChange,
  allLabel = '전체',
}: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setOpen(false), [])
  useDismissOnBack(open, close)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const active = value !== null
  const display = value ?? label

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={
          active
            ? 'h-9 px-3 rounded-full bg-[#F3EEFE] border border-[#9B7AF7] flex items-center gap-1 text-[14px] leading-5 font-medium text-[#8259F5]'
            : 'h-9 px-3 rounded-full bg-[#F9FAFB] border border-[#F3F4F6] flex items-center gap-1 text-[14px] leading-5 font-medium text-[#6A7282]'
        }
      >
        {display}
        <svg
          viewBox="0 0 16 16"
          className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          aria-hidden
        >
          <path
            d="M4 6L8 10L12 6"
            stroke={active ? '#8259F5' : '#6A7282'}
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={label}
          className="absolute top-[calc(100%+4px)] left-0 z-50 min-w-[140px] max-h-[260px] overflow-y-auto bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_8px_20px_rgba(16,24,40,0.08)] py-1"
        >
          {allLabel !== null && (
            <li>
              <button
                type="button"
                role="option"
                aria-selected={value === null}
                onClick={() => {
                  onChange(null)
                  setOpen(false)
                }}
                className={`w-full px-3 py-2 text-left text-[14px] leading-5 transition-colors ${
                  value === null
                    ? 'text-[#8259F5] font-medium bg-[#F3EEFE]'
                    : 'text-[#1E2939] hover:bg-[#F9FAFB]'
                }`}
              >
                {allLabel}
              </button>
            </li>
          )}
          {options.map((opt) => {
            const selected = value === opt
            return (
              <li key={opt}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(opt)
                    setOpen(false)
                  }}
                  className={`w-full px-3 py-2 text-left text-[14px] leading-5 transition-colors ${
                    selected
                      ? 'text-[#8259F5] font-medium bg-[#F3EEFE]'
                      : 'text-[#1E2939] hover:bg-[#F9FAFB]'
                  }`}
                >
                  {opt}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
