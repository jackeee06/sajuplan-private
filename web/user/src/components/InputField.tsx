import { ReactNode } from 'react'
import { ClearIcon } from './icons'

interface Props {
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
  disabled?: boolean
  error?: boolean
  /** 우측 X 클리어 버튼 활성화 (값 있을 때만 자동 표시) */
  onClear?: () => void
  /** 추가 우측 슬롯 (예: 비밀번호 보이기 토글) */
  rightSlot?: ReactNode
  /** 우측 패딩 — 내부 슬롯 갯수에 따라 조정 ('sm'=pr-4, 'md'=pr-12, 'lg'=pr-16) */
  rightPadding?: 'sm' | 'md' | 'lg'
  /** 최대 입력 길이 */
  maxLength?: number
  /** 모바일 키패드 종류 ('numeric' | 'tel' | 'email' 등) */
  inputMode?: 'text' | 'numeric' | 'tel' | 'email' | 'decimal' | 'search' | 'url'
  /** native pattern (HTML form validation) */
  pattern?: string
  /** native required (HTML form validation) */
  required?: boolean
}

/**
 * 사주문 공용 입력 — Figma 스펙
 * - h40, bg #f9fafb, border #f3f4f6, fully pill (rounded-full)
 * - placeholder 15/400 #99a1af, value 15/400 #1e2939
 * - error: border #f87171 (red-400), error msg는 부모가 별도 렌더
 */
export default function InputField({
  type = 'text',
  value,
  onChange,
  placeholder,
  autoComplete,
  disabled,
  error,
  onClear,
  rightSlot,
  rightPadding = 'lg',
  maxLength,
  inputMode,
  pattern,
  required,
}: Props) {
  const showClear = !!value && !!onClear && !disabled
  const padRight = rightPadding === 'sm' ? 'pr-4' : rightPadding === 'md' ? 'pr-12' : 'pr-16'
  const borderColor = error
    ? 'border-[#f87171] focus:border-[#f87171]'
    : 'border-[#f3f4f6] focus:border-brand-400'
  return (
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        maxLength={maxLength}
        inputMode={inputMode}
        pattern={pattern}
        required={required}
        className={`w-full h-10 rounded-full bg-[#f9fafb] border ${borderColor} focus:bg-white pl-4 ${padRight} text-[15px] text-[#1e2939] placeholder-[#99a1af] focus:outline-none transition disabled:opacity-50`}
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
        {showClear && (
          <button
            type="button"
            onClick={onClear}
            className="w-5 h-5 rounded-full bg-[#4a5565] hover:bg-[#1e2939] transition flex items-center justify-center"
            aria-label="입력 지우기"
          >
            <ClearIcon />
          </button>
        )}
        {rightSlot}
      </div>
    </div>
  )
}
