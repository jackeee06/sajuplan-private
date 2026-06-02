import { useEffect, useRef, useState } from 'react'

/**
 * 모바일 화면 위에서 아래로 당기면 새로고침 (pull-to-refresh).
 *
 * [2026-05-25] 사장님 요청 — 사용자가 새 빌드 보고 싶을 때 앱 종료/재실행 없이
 * pull-to-refresh 1회로 적용 가능하도록.
 *
 * 동작:
 *  - 스크롤 최상단(window.scrollY === 0) 일 때만 동작
 *  - 손가락 내리면 핑크 원형 스피너가 따라 내려옴 (시각 피드백)
 *  - 60px 이상 당기고 손 떼면 → window.location.reload()
 *  - 60px 미만이면 → 원위치 복귀
 *
 * 성능:
 *  - 모든 리스너 passive: true → 스크롤 부드러움 영향 X
 *  - idle 시점엔 DOM 추가 0 (인디케이터 컴포넌트 자체가 안 렌더됨)
 *
 * 차단:
 *  - 로그인/회원가입/결제 진행중 페이지에선 작동 안 시키는 게 안전할 수도 있음.
 *    일단 전역 적용. 문제 발생 시 path 화이트리스트로 좁힘.
 */

const TRIGGER_DISTANCE = 60   // 이 이상 당기면 새로고침
const MAX_DISTANCE = 100      // 시각적 최대값 (그 이상은 더 안 늘어남)
const DAMPING = 0.5           // 저항감 — 손가락 이동 대비 인디케이터 이동 비율

export default function PullToRefresh() {
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const startYRef = useRef(0)
  const pullingRef = useRef(false)
  const distanceRef = useRef(0)

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (refreshing) return
      // 스크롤이 맨 위가 아닐 때는 일반 스크롤로 동작 (당김 감지 X)
      if (window.scrollY > 0 || document.documentElement.scrollTop > 0) return
      startYRef.current = e.touches[0].clientY
      pullingRef.current = false
    }

    const onTouchMove = (e: TouchEvent) => {
      if (refreshing) return
      if (window.scrollY > 0 || document.documentElement.scrollTop > 0) return
      const currentY = e.touches[0].clientY
      const delta = currentY - startYRef.current
      if (delta > 0) {
        pullingRef.current = true
        const damped = Math.min(delta * DAMPING, MAX_DISTANCE)
        distanceRef.current = damped
        setPullDistance(damped)
      }
    }

    const onTouchEnd = () => {
      if (refreshing) return
      const finalDistance = distanceRef.current
      if (pullingRef.current && finalDistance >= TRIGGER_DISTANCE) {
        // 트리거 발생 — 새로고침
        setRefreshing(true)
        // 약간의 시각 피드백 후 reload (사용자가 회전 스피너 확인)
        setTimeout(() => {
          window.location.reload()
        }, 350)
      } else {
        // 미달 — 원위치
        setPullDistance(0)
        distanceRef.current = 0
      }
      pullingRef.current = false
    }

    // passive: true — 스크롤 차단 X, 성능 최적
    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', onTouchEnd, { passive: true })
    document.addEventListener('touchcancel', onTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [refreshing])

  // 당김 없음 + 새로고침 중 아니면 렌더 X (DOM 영향 0)
  if (pullDistance === 0 && !refreshing) return null

  const ready = pullDistance >= TRIGGER_DISTANCE
  const translateY = refreshing ? 50 : pullDistance - 20
  const opacity = Math.min(pullDistance / TRIGGER_DISTANCE, 1)

  return (
    <div
      className="fixed top-0 left-1/2 z-[60] pointer-events-none"
      style={{
        transform: `translate(-50%, ${translateY}px)`,
        opacity,
        transition: refreshing || pullDistance === 0 ? 'transform 0.3s ease, opacity 0.3s' : 'none',
      }}
    >
      <div className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center">
        {refreshing ? (
          <span className="inline-block w-5 h-5 border-2 border-pink-200 border-t-pink-500 rounded-full animate-spin" />
        ) : (
          <svg
            viewBox="0 0 24 24"
            className="w-5 h-5"
            style={{
              transform: `rotate(${ready ? 180 : 0}deg)`,
              transition: 'transform 0.2s',
              color: ready ? '#ec4899' : '#99A1AF',
            }}
          >
            <path
              d="M12 4L12 18M12 18L7 13M12 18L17 13"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        )}
      </div>
    </div>
  )
}
