/**
 * 인라인 SVG 아이콘 모음 — Figma 스타일과 매칭 (1.4 stroke #1E2939 기본)
 * 외부 패키지(lucide 등) 의존을 줄이고 디자인 정밀도를 올리기 위해 직접 그림.
 */

interface IconProps {
  className?: string
}

/** Eye open — 비밀번호 보기 상태 */
export function EyeOpenIcon({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M2.66 12C4.5 8.2 8 5.83 12 5.83C16 5.83 19.5 8.2 21.34 12C19.5 15.8 16 18.17 12 18.17C8 18.17 4.5 15.8 2.66 12Z"
        stroke="#1E2939"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="#1E2939" strokeWidth="1.4" />
    </svg>
  )
}

/** Clear (X) — 입력 클리어. 흰색 X (부모 원형 배경 위) */
export function ClearIcon({ className = 'w-2.5 h-2.5' }: IconProps) {
  return (
    <svg viewBox="0 0 10 10" fill="none" className={className} aria-hidden>
      <path d="M2 2L8 8M8 2L2 8" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

/** Modal close X — 검정 X */
export function CloseIcon({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M6 6L18 18M18 6L6 18"
        stroke="#030712"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Chevron right — 약관 등 우측 화살표 */
export function ChevronRightIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path
        d="M7.5 4L13.5 10L7.5 16"
        stroke="#99A1AF"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Calendar — 생년월일 인풋 우측 */
export function CalendarIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <rect x="2.5" y="4" width="15" height="13" rx="2" stroke="#4a5565" strokeWidth="1.4" />
      <path d="M2.5 8H17.5" stroke="#4a5565" strokeWidth="1.4" />
      <path d="M6.5 2.5V5.5" stroke="#4a5565" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M13.5 2.5V5.5" stroke="#4a5565" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

/** Refresh — 캡차 다시 로드 */
export function RefreshIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path
        d="M3.5 10C3.5 6.4 6.4 3.5 10 3.5C12.5 3.5 14.7 4.9 15.7 7M16.5 10C16.5 13.6 13.6 16.5 10 16.5C7.5 16.5 5.3 15.1 4.3 13"
        stroke="#4a5565"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path d="M14 7H16.5V4.5" stroke="#4a5565" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 13H3.5V15.5" stroke="#4a5565" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Info (!) — 안내 노티스 */
export function InfoIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <circle cx="8" cy="8" r="6.5" stroke="#6A7282" strokeWidth="1.2" />
      <path d="M8 4.5V8.5" stroke="#6A7282" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="8" cy="11" r="0.7" fill="#6A7282" />
    </svg>
  )
}

/** 폭죽(파티) — 회원가입 완료 일러스트 (단순화 버전) */
export function PartyIcon({ className = 'w-12 h-12' }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <path
        d="M14 34L18 14L34 30L14 34Z"
        stroke="#8259F5"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="#e3dafe"
      />
      <circle cx="36" cy="14" r="1.5" fill="#8259F5" />
      <circle cx="40" cy="22" r="1.2" fill="#8259F5" />
      <circle cx="32" cy="10" r="1" fill="#8259F5" />
      <path d="M36 18L38 16M28 8L30 6M40 28L42 26" stroke="#8259F5" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/** Check circle — 찾기 완료 일러스트 */
export function CheckCircleIcon({ className = 'w-12 h-12' }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <circle cx="24" cy="24" r="18" stroke="#8259F5" strokeWidth="2.4" />
      <path
        d="M16 24L22 30L33 18"
        stroke="#8259F5"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
