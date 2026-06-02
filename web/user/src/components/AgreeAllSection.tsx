import { ReactNode } from 'react'

/**
 * 약관/마케팅 동의 영역의 "전체 동의" 헤더.
 *
 * 사용처: 회원가입(Signup) · 회원정보 수정(MemberEdit) 등 약관 체크박스 묶음이 있는 폼.
 * "전체 동의" 클릭 = 자식 항목 전부 토글. 자식이 전부 ON 이면 헤더도 자동 ON.
 *
 * 동작 (양방향):
 *   - 헤더 ☑ → onAllToggle(true)  → 부모가 자식 4개 모두 true 로
 *   - 헤더 ☐ → onAllToggle(false) → 부모가 자식 4개 모두 false 로
 *   - 자식 4개 다 ☑ 이면 → 헤더 자동 ☑ (allChecked prop 으로 표현)
 *   - 자식 하나라도 ☐ → 헤더 자동 ☐
 *
 * 부모 사용 예:
 *   const allChecked = a && b && c && d
 *   <AgreeAllSection allChecked={allChecked} onAllToggle={(v) => { setA(v); setB(v); setC(v); setD(v) }}>
 *     {children}
 *   </AgreeAllSection>
 */
interface Props {
  allChecked: boolean
  onAllToggle: (v: boolean) => void
  label?: string
  children: ReactNode
}

export default function AgreeAllSection({
  allChecked,
  onAllToggle,
  label = '전체 동의',
  children,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      {/* 전체 동의 헤더 */}
      <button
        type="button"
        onClick={() => onAllToggle(!allChecked)}
        className="flex items-center gap-3 py-2"
      >
        <span
          className={`w-6 h-6 rounded-md flex items-center justify-center transition ${
            allChecked
              ? 'bg-[#f472b6] border-2 border-[#f472b6]'
              : 'bg-white border-2 border-[#D1D5DB]'
          }`}
          aria-hidden
        >
          {allChecked && (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 7L6 10L11 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <span className={`text-[15px] font-semibold ${allChecked ? 'text-[#1E2939]' : 'text-[#4A5565]'}`}>
          {label}
        </span>
      </button>
      {/* 구분선 */}
      <div className="border-t border-[#F3F4F6]" />
      {/* 자식 (개별 체크박스들) */}
      {children}
    </div>
  )
}
