import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * 출석체크 결과 토스트/모달 (2026-05-16).
 *
 * 로그인 직후 attendanceApi.checkin 호출 결과를 sessionStorage 에 임시 저장.
 * 이 컴포넌트가 라우트 전환을 감지해 sessionStorage 를 읽어 1회 노출 후 삭제.
 *
 * App.tsx 에 한 번만 마운트되어 모든 페이지에서 자동 동작.
 * useLocation 의존성으로 매 라우트 진입 시 재검사 — 로그인 → 홈 전환을 캐치.
 */
interface Justified {
  consecutive_days: number
  base_coin: number
  bonus_coin: number
  coupon_amount: number
  total_added: number
}

const STORAGE_KEY = 'attendance.justChecked'

export default function AttendanceToast() {
  const [data, setData] = useState<Justified | null>(null)
  const location = useLocation()

  useEffect(() => {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as Justified
      if (parsed && typeof parsed.total_added === 'number' && parsed.total_added > 0) {
        setData(parsed)
      }
    } catch { /* JSON 파싱 실패 — 무시 */ }
    sessionStorage.removeItem(STORAGE_KEY)
  }, [location.pathname])

  if (!data) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center px-4"
      onClick={() => setData(null)}
    >
      <div
        className="bg-white rounded-2xl max-w-[400px] w-full px-6 py-7 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[40px] mb-2" aria-hidden>🎉</div>
        <h2 className="text-[18px] font-bold text-[#1E2939]">출석 완료!</h2>
        <p className="mt-1 text-[14px] text-[#6A7282]">
          연속 <strong className="text-[#ec4899]">{data.consecutive_days}일</strong> 출석 중
        </p>
        <div className="mt-4 p-4 rounded-xl bg-[#fdf2f8]">
          <p className="text-[13px] text-[#6A7282]">오늘 적립</p>
          <p className="text-[24px] font-bold text-[#ec4899] mt-1">
            {data.total_added.toLocaleString()}원
          </p>
          {data.bonus_coin > 0 && (
            <p className="text-[12px] text-[#92400E] mt-1">
              ⭐ 연속 보너스 +{data.bonus_coin.toLocaleString()}원
            </p>
          )}
          {data.coupon_amount > 0 && (
            <p className="text-[12px] text-[#FF6467] mt-1">
              🎁 30일 보상 +{data.coupon_amount.toLocaleString()}원
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setData(null)}
          className="mt-5 w-full h-12 rounded-full bg-[#f472b6] text-white text-[15px] font-medium"
        >
          확인
        </button>
      </div>
    </div>
  )
}
