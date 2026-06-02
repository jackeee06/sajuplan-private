import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'

/**
 * 듀얼 역할자(회원+상담사) 를 위한 모드 인디케이터.
 *
 * 사장님 요청 (2026-05-25):
 *  - 현재 모드(회원/상담사) 항상 알려주는 상단 배너
 *  - X 닫기 가능
 *  - 모드 전환 발생 시 자동 복원 (안 보이게 했더라도)
 *  - 헤더 좌측 영구 닷 (배너 닫혀도 항상 보임 → 클릭으로 배너 복원)
 *  - 모드 전환 시점에 토스트 알림
 *
 * 동작:
 *  - 일반 회원: 렌더 X (필요 없음)
 *  - 듀얼 역할자(role==='counselor'): 항상 렌더
 *  - 모드 판단: URL 경로 (/counselor/* = 상담사, 그 외 = 회원)
 *  - dismiss 상태는 localStorage 에 저장 (모드 별로 따로)
 *  - 모드 전환 감지 시 dismissed 자동 클리어
 */

type Mode = 'counselor' | 'member'

const STORAGE_KEY = 'sajuplan.modeBanner.dismissed'
const LAST_MODE_KEY = 'sajuplan.modeBanner.lastMode' // [B-004 fix] mount race 회피용

export default function ModeIndicator() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isLoggedIn, isCounselor, member } = useAuth()

  // [2026-05-25] 상담사 영역 = /counselor/* 로 통일. (정산 페이지도 /counselor/mypage/settlement 로 이동됨)
  // [2026-05-28] startsWith('/counselor') 가 /counselors (회원이 상담사 둘러보는 페이지) 까지 매칭하던 버그 fix.
  //   /counselor 또는 /counselor/* 만 상담사 영역. /counselors* 는 회원 영역.
  const inCounselorArea = location.pathname === '/counselor' || location.pathname.startsWith('/counselor/')
  const currentMode: Mode = isCounselor && inCounselorArea ? 'counselor' : 'member'

  // dismiss 상태 — localStorage 와 동기화. '현재 모드' 가 dismissed 면 숨김.
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(STORAGE_KEY) === currentMode
  })

  // 모드 변경 감지용 ref — undefined=초기 미정, null=세션 첫 진입, Mode=이전 모드
  // [B-004 fix] mount 시점이 늦으면 (me() 응답 race) prev=null 첫 마운트 처리로 모드 전환을 놓침.
  //   sessionStorage 에 마지막 모드를 보존 → mount 시점에 정확한 비교 가능.
  const prevModeRef = useRef<Mode | null | undefined>(undefined)

  // 토스트 상태 (기존 짧은 안내 — 모드 명시 변경 시)
  const [toast, setToast] = useState<string | null>(null)

  // [2026-05-25] 큰 배너 안내 — 상담사 → 회원 자동 전환 시 명시적 안내.
  //   사장님 요청: 상담사 모드에서 홈/단골 같은 회원 영역 진입 시 큰 배너로
  //   "이 화면은 회원모드에서 사용가능합니다. 회원모드로 이동하겠습니다" 안내 (잠시 노출 후 자동 사라짐).
  const [autoSwitchAlert, setAutoSwitchAlert] = useState<{
    targetMode: Mode
    pageLabel: string
  } | null>(null)

  // 모드 변경 감지 → dismiss 자동 해제 + 토스트/배너
  useEffect(() => {
    // [엄격검증 안전강화 2026-05-27] 비로그인/일반 회원은 모드 개념 X — useEffect 자체 skip.
    //   me() 응답 race 로 isCounselor 가 false→true 변화하는 케이스에서 잘못된 토스트 발화 방지.
    if (!isLoggedIn || !isCounselor) return

    // 첫 호출 — sessionStorage 의 마지막 모드 복원 (탭 내 페이지 이동/새로고침 후 mount 대비)
    if (prevModeRef.current === undefined) {
      if (typeof window !== 'undefined') {
        const v = sessionStorage.getItem(LAST_MODE_KEY)
        prevModeRef.current = v === 'counselor' || v === 'member' ? v : null
      } else {
        prevModeRef.current = null
      }
    }

    const prev = prevModeRef.current
    if (prev !== null && prev !== currentMode) {
      // 모드 전환됨
      localStorage.removeItem(STORAGE_KEY)
      setDismissed(false)

      // [큰 배너 분기] 상담사 → 회원 자동 전환 + 새 URL 이 홈/단골 → 큰 배너로 명시적 안내
      // (기존 짧은 토스트와 별개 — 큰 배너 떠 있는 동안엔 토스트 미발화)
      const path = location.pathname
      const isHomeOrFavorites = path === '/' || path.startsWith('/favorites')
      const switchedToMember = prev === 'counselor' && currentMode === 'member'

      if (switchedToMember && isHomeOrFavorites) {
        const pageLabel = path === '/' ? '홈' : '단골'
        // [2026-05-27 fix] 타이머는 별도 useEffect 에서 관리 — 라우트 변경 시 cleanup 으로
        //   타이머가 cancel 되어 배너가 영원히 안 사라지던 버그 해결.
        setAutoSwitchAlert({ targetMode: 'member', pageLabel })
        prevModeRef.current = currentMode
        if (typeof window !== 'undefined') sessionStorage.setItem(LAST_MODE_KEY, currentMode)
        return
      }

      // 기본: 기존 짧은 토스트 (타이머는 별도 useEffect 에서 관리 — 큰 배너 fix 와 동일 패턴)
      setToast(currentMode === 'counselor' ? '상담사 모드로 전환됨' : '회원 모드로 전환됨')
      prevModeRef.current = currentMode
      if (typeof window !== 'undefined') sessionStorage.setItem(LAST_MODE_KEY, currentMode)
      return
    }
    prevModeRef.current = currentMode
    if (typeof window !== 'undefined') sessionStorage.setItem(LAST_MODE_KEY, currentMode)
  }, [currentMode, location.pathname, isLoggedIn, isCounselor])

  // 같은 모드 안에서 storage 동기화 (탭 간 또는 페이지 이동 후)
  useEffect(() => {
    setDismissed(localStorage.getItem(STORAGE_KEY) === currentMode)
  }, [currentMode])

  // [2026-05-27 fix] 큰 배너 자동 사라짐 — 별도 useEffect 로 격리.
  //   라우트 변경 cleanup 영향 받지 않게 deps 가 autoSwitchAlert 만.
  //   사용자가 배너 떠있는 동안 다른 버튼 눌러도 2.5초 후 정확히 사라짐.
  useEffect(() => {
    if (!autoSwitchAlert) return
    const id = setTimeout(() => setAutoSwitchAlert(null), 2500)
    return () => clearTimeout(id)
  }, [autoSwitchAlert])

  // [2026-05-27 fix] 토스트도 같은 패턴 — 별도 useEffect 로 격리.
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 2200)
    return () => clearTimeout(id)
  }, [toast])

  // 듀얼 역할자만 표시 (일반 회원은 모드 개념 없음)
  if (!isLoggedIn || !isCounselor) return null

  // [2026-05-30] 채팅방 안에서는 모드 인디케이터 숨김.
  //   ChatRoom 헤더가 fixed top-0 z-30 인데 ModeIndicator 가 sticky top-0 z-40 으로
  //   헤더 위 28px 를 덮어 상담종료 버튼이 가려지던 버그 fix.
  //   채팅 진행 중엔 모드 전환할 일도 없어 안전.
  if (location.pathname.startsWith('/chat/')) return null

  const isCounselorMode = currentMode === 'counselor'

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, currentMode)
    setDismissed(true)
  }

  const handleRestore = () => {
    localStorage.removeItem(STORAGE_KEY)
    setDismissed(false)
  }

  const switchMode = () => {
    if (isCounselorMode) {
      navigate('/mypage')
    } else {
      navigate('/counselor/mypage')
    }
  }

  // 모드별 색상 + 라벨 + 디테일
  const palette = isCounselorMode
    ? { bg: 'bg-[#8259F5]', dotBg: '#8259F5', label: '💼 상담사 모드', switchLabel: '회원 모드로' }
    : { bg: 'bg-[#ec4899]', dotBg: '#ec4899', label: '👤 회원 모드', switchLabel: '상담사 모드로' }

  // 핵심 수치 — 회원: 보유 코인 / 상담사: 수익금은 member 객체에 없으므로 생략
  const point = member?.point ?? 0
  const detailText = isCounselorMode ? null : `코인 ${point.toLocaleString()}`

  return (
    <>
      {/* 1. 상단 배너 — sticky, dismissed 아닐 때만 */}
      {!dismissed && (
        <div className={`${palette.bg} text-white text-[12px] flex items-center px-3 h-7 sticky top-0 z-40 shadow-sm`}>
          <span className="font-semibold whitespace-nowrap">{palette.label}</span>
          {detailText && <span className="ml-2 opacity-85 whitespace-nowrap">· {detailText}</span>}
          <span className="flex-1" />
          <button
            type="button"
            onClick={switchMode}
            className="px-2.5 py-0.5 rounded-full bg-white/25 hover:bg-white/35 text-[11.5px] font-medium whitespace-nowrap mr-1.5"
          >
            {palette.switchLabel} ›
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="모드 표시 닫기"
            className="w-5 h-5 flex items-center justify-center text-white/90 hover:text-white text-[14px]"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. 영구 닷 — dismiss 시에만. 클릭하면 배너 복원. */}
      {dismissed && (
        <button
          type="button"
          onClick={handleRestore}
          title={`현재 ${isCounselorMode ? '상담사' : '회원'} 모드 · 클릭하면 모드 표시줄 다시 보임`}
          aria-label="모드 표시줄 다시 보이기"
          className="fixed top-1.5 left-1.5 w-3 h-3 rounded-full z-40 shadow-md hover:scale-125 transition-transform"
          style={{ background: palette.dotBg }}
        />
      )}

      {/* 3. 모드 전환 토스트 — 2.2초 자동 사라짐 (큰 배너 떠있는 동안엔 미발화) */}
      {toast && !autoSwitchAlert && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-12 left-1/2 -translate-x-1/2 ${palette.bg} text-white text-[13px] font-medium px-4 py-2 rounded-full z-50 shadow-lg pointer-events-none`}
        >
          {toast}
        </div>
      )}

      {/* 4. 큰 배너 — 상담사 → 회원 자동 전환 시 명시적 안내 (1.8초 자동 사라짐, 화면 가운데) */}
      {autoSwitchAlert && (
        <div
          role="alertdialog"
          aria-live="assertive"
          className="fixed inset-0 z-50 flex items-center justify-center px-6 pointer-events-none"
        >
          {/* 배경 디머 */}
          <div className="absolute inset-0 bg-black/30" />
          {/* 안내 카드 */}
          <div
            className={`relative max-w-[320px] w-full rounded-[20px] px-6 py-6 shadow-2xl text-center ${
              autoSwitchAlert.targetMode === 'member' ? 'bg-[#ec4899]' : 'bg-[#8259F5]'
            } text-white`}
          >
            <div className="flex justify-center mb-3">
              <img src="/img/logo_w.svg" alt="사주플랜" className="h-10" />
            </div>
            <p className="text-[16px] font-semibold leading-snug mb-1">
              이 화면은{' '}
              {autoSwitchAlert.targetMode === 'member' ? '회원' : '상담사'} 모드에서
              사용 가능합니다
            </p>
            <p className="text-[14px] text-white/90 leading-snug">
              {autoSwitchAlert.targetMode === 'member' ? '회원' : '상담사'} 모드로 이동합니다
            </p>
          </div>
        </div>
      )}
    </>
  )
}
