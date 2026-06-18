import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'
import { attendanceApi } from '../lib/api'

/**
 * 출석 자동 처리 + 결과 토스트/모달 (2026-05-16 / 2026-06-12 개편).
 *
 * [2026-06-12] 출석 트리거를 "로그인하는 순간"에서 "앱 진입(로그인 상태)"으로 변경.
 *  - 배경: 출석 checkin 이 Login.tsx 비밀번호 로그인 직후에만 호출됐다. 그러나 앱은
 *          세션이 유지되고 간편로그인(카카오/네이버/애플)은 핸들러에 checkin 이 없어서,
 *          단골(특히 소셜 로그인) 사용자가 매일 앱을 써도 출석이 한 번도 안 잡혔다.
 *  - 변경: 로그인 상태(member!=null)면 하루 1회 자동 checkin. 모든 진입 경로를 커버한다.
 *          백엔드가 UNIQUE(member_id, attended_date) 로 1일 1회 멱등 처리 → 여러 번 호출돼도 안전.
 *  - 중복 호출 방지: localStorage 에 계정별 마지막 시도 날짜(KST) 기록. 같은 날은 호출 생략.
 *
 * App.tsx 에 한 번만 마운트되어 모든 페이지에서 자동 동작.
 */
interface Justified {
  consecutive_days: number
  base_coin: number
  bonus_coin: number
  coupon_amount: number
  total_added: number
}

const STORAGE_KEY = 'attendance.justChecked'
const AUTO_KEY = 'attendance.autoCheckDate'

/** KST(Asia/Seoul) 기준 오늘 날짜 — 'YYYY-MM-DD'. 서버 출석 일자와 동일 기준. */
function kstToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
}

export default function AttendanceToast() {
  const [data, setData] = useState<Justified | null>(null)
  const location = useLocation()
  const { member, loading } = useAuth()

  // (1) 자동 출석 — 로그인 상태면 하루 1회 checkin. 간편로그인/세션유지 진입 모두 커버.
  useEffect(() => {
    if (loading || !member) return
    const today = kstToday()
    const key = `${AUTO_KEY}.${member.id}`
    if (localStorage.getItem(key) === today) return
    // 먼저 가드를 세팅해 연속 라우트 이동 중 중복 호출을 막는다.
    localStorage.setItem(key, today)
    let alive = true
    attendanceApi
      .checkin()
      .then((att) => {
        if (!alive) return
        if (att.attended_now && att.total_added > 0) {
          setData({
            consecutive_days: att.consecutive_days,
            base_coin: att.base_coin,
            bonus_coin: att.bonus_coin,
            coupon_amount: att.coupon_amount,
            total_added: att.total_added,
          })
        }
      })
      .catch(() => {
        // 네트워크 실패 등 — 가드를 풀어 다음 진입에서 재시도 가능하게.
        if (localStorage.getItem(key) === today) localStorage.removeItem(key)
      })
    return () => {
      alive = false
    }
  }, [member, loading])

  // (2) 레거시 호환 — 과거 sessionStorage 경로에 남은 결과가 있으면 1회 표시 후 삭제.
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
            {data.total_added.toLocaleString()} 코인
          </p>
          {data.bonus_coin > 0 && (
            <p className="text-[12px] text-[#92400E] mt-1">
              ⭐ 연속 보너스 +{data.bonus_coin.toLocaleString()} 코인
            </p>
          )}
          {data.coupon_amount > 0 && (
            <p className="text-[12px] text-[#FF6467] mt-1">
              🎁 30일 보상 +{data.coupon_amount.toLocaleString()} 코인
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
