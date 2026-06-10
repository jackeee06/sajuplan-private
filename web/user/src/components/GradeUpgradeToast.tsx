import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'
import { counselorGradeApi } from '../lib/api'

/**
 * 실시간 등급 승급 토스트/모달 (2026-06-07).
 *
 * 이중 체크 방식:
 *   A) 빠른 경로 — Login.tsx/ChatRoom.tsx 가 pendingUpgrade() POST 를 호출하고
 *      sessionStorage 에 저장 → 이 컴포넌트가 읽어서 표시.
 *   B) 안전망 — 상담사 로그인 상태에서 라우트 전환 시 직접 POST pendingUpgrade() 호출.
 *      A 가 어떤 이유로 실패해도 이 경로가 잡아줌.
 *      POST 사용 이유: WebView cross-origin GET 쿠키 불안정. POST 는 checkin 과 동일하게 항상 동작.
 */
export const GRADE_UPGRADE_STORAGE_KEY = 'grade.justUpgraded'

export interface GradeUpgradePayload {
  grade_label: string
  hours: string
}

interface UpgradeData {
  grade_label: string
  hours: string
}

export default function GradeUpgradeToast() {
  const { member } = useAuth()
  const isCounselor = member?.role === 'counselor'
  const [data, setData] = useState<UpgradeData | null>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const lastPathRef = useRef('')

  useEffect(() => {
    // A) sessionStorage 빠른 경로 (Login.tsx / ChatRoom.tsx 가 미리 저장)
    const raw = sessionStorage.getItem(GRADE_UPGRADE_STORAGE_KEY)
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as UpgradeData
        if (parsed?.grade_label) {
          sessionStorage.removeItem(GRADE_UPGRADE_STORAGE_KEY)
          setData(parsed)
          return
        }
      } catch { /* 파싱 실패 — B 경로로 */ }
      sessionStorage.removeItem(GRADE_UPGRADE_STORAGE_KEY)
    }

    // B) 직접 POST 안전망 (상담사 로그인 + 경로 변경 시)
    if (!isCounselor) return
    if (lastPathRef.current === location.pathname) return
    lastPathRef.current = location.pathname

    let alive = true
    counselorGradeApi.pendingUpgrade()
      .then((r) => {
        if (alive && r?.upgrade) {
          setData({ grade_label: r.upgrade.grade_label, hours: r.upgrade.hours })
        }
      })
      .catch(() => { /* 실패 무시 */ })
    return () => { alive = false }
  }, [location.pathname, isCounselor])

  if (!data) return null

  const handleClose = () => setData(null)
  const handleChange = () => {
    setData(null)
    navigate('/counselor/mypage?action=change-unit-cost')
  }

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-live="polite"
      className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center px-6"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-[340px] rounded-[24px] bg-white shadow-2xl p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-[#f3f0ff] flex items-center justify-center text-[36px]">
          🎉
        </div>
        <h3 className="text-[20px] leading-[130%] font-bold text-[#030712]">
          {data.grade_label}로<br />승급되었습니다!
        </h3>
        <p className="mt-2 text-[14px] leading-[150%] text-[#4A5565]">
          당월 <strong className="text-[#8259F5]">{data.hours}시간</strong> 달성으로 즉시 승급됐어요.
          단가를 지금 바로 변경하세요.
        </p>
        <div className="flex items-center gap-2 mt-5 w-full">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 h-12 rounded-full bg-white border border-[#E5E7EB] text-[#1E2939] text-[14px] font-medium"
          >
            나중에
          </button>
          <button
            type="button"
            onClick={handleChange}
            className="flex-1 h-12 rounded-full bg-[#8259F5] text-white text-[15px] font-bold"
          >
            단가 변경하기
          </button>
        </div>
      </div>
    </div>
  )
}
