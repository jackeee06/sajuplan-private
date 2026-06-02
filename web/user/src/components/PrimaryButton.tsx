import { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  children: ReactNode
}

/**
 * 사주플랜 1차 버튼 — Figma: w-full h48 pill #ec4899 / disabled #cabbfd
 * 로딩 중이면 좌측에 스피너 + disabled 처리
 */
export default function PrimaryButton({
  loading,
  disabled,
  children,
  className = '',
  ...rest
}: Props) {
  const isDisabled = disabled || loading
  return (
    <button
      disabled={isDisabled}
      className={`h-12 w-full flex items-center justify-center gap-1 rounded-full bg-[#ec4899] hover:bg-brand-500 active:bg-brand-600 text-white text-[16px] font-medium transition disabled:bg-[#cabbfd] disabled:cursor-not-allowed ${className}`}
      {...rest}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  )
}

/**
 * 보조 버튼 — pill, white bg, brand-400 border + brand-500 text
 * 우측 보조 액션(중복확인, 인증번호 전송, 주소검색 등)
 */
export function OutlineButton({
  className = '',
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      disabled={disabled}
      className={`h-10 px-4 rounded-full border border-[#ec4899] bg-white text-[14px] font-medium text-[#ec4899] hover:bg-[#f8f5ff] active:bg-[#fdf2f8] transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
