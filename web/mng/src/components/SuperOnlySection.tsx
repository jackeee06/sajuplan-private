import { ReactNode } from 'react'
import { useAuth } from '../lib/auth'

/**
 * 슈퍼관리자 전용 영역 — 일반관리자에겐 자식 통째로 안 보임.
 * 슈퍼에겐 안내 박스 + 자식 노출 (자기 권한 인지 + 안심).
 *
 * 원칙: "권한 안내는 그 권한을 가진 사람에게만 보인다"
 *   → 일반관리자는 이 영역이 존재한다는 사실 자체를 모름.
 */
export function SuperOnlySection({
  children,
  title = '🔒 슈퍼관리자만 볼 수 있는 영역',
  subtitle = '일반관리자에게는 이 영역이 보이지 않습니다. 이 자물쇠 마크(🔒)는 슈퍼 전용 영역을 의미합니다.',
}: {
  children: ReactNode
  title?: string
  subtitle?: string
}) {
  const { admin } = useAuth()
  if (!admin?.is_super) return null
  return (
    <div className="rounded-lg border-2 border-rose-300 dark:border-rose-700 border-l-[6px] bg-rose-50/40 dark:bg-rose-900/10 p-3 space-y-2">
      <div>
        <div className="text-xs font-bold text-rose-800 dark:text-rose-200">{title}</div>
        <div className="text-[11px] text-rose-700 dark:text-rose-300 mt-0.5 leading-relaxed">{subtitle}</div>
      </div>
      {children}
    </div>
  )
}

/**
 * 슈퍼는 수정 가능 / 일반은 보기만 가능한 영역.
 * 일반관리자: 자식 그대로 노출되지만 fieldset disabled (수정 X). 안내 없음 (자연스럽게).
 * 슈퍼관리자: 안내 박스 + 자식 (수정 가능).
 *
 * 사용 예:
 *   <ReadOnlyForSuper>
 *     <input ... />
 *     <select ... />
 *   </ReadOnlyForSuper>
 */
export function ReadOnlyForSuper({
  children,
  title = '👁️ 슈퍼관리자만 수정할 수 있는 영역',
  subtitle = '일반관리자에게도 보이지만 수정은 불가합니다 (read-only). 상담사도 아는 정책이라 투명 공개.',
}: {
  children: ReactNode
  title?: string
  subtitle?: string
}) {
  const { admin } = useAuth()
  const isSuper = !!admin?.is_super
  // 슈퍼관리자: 노란 외곽 박스로 통째 감싸 "어디까지가 read-only 영역인지" 명확.
  // 일반관리자: 안내 없이 자식만 (fieldset disabled).
  if (!isSuper) {
    return (
      <fieldset disabled className="opacity-95">
        {children}
      </fieldset>
    )
  }
  return (
    <div className="rounded-lg border-2 border-amber-300 dark:border-amber-700 border-l-[6px] bg-amber-50/30 dark:bg-amber-900/5 p-3 space-y-3">
      <div>
        <div className="text-xs font-bold text-amber-900 dark:text-amber-200">{title}</div>
        <div className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5 leading-relaxed">{subtitle}</div>
      </div>
      {children}
    </div>
  )
}
