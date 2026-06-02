import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * 페이지가 다시 활성화될 때 callback 을 호출.
 *
 *  ① route state.reload 변경 (BottomNav 가 같은 탭 재클릭 시 새 timestamp 발행)
 *  ② document visibilitychange → visible 전환 (앱 백그라운드 복귀 / 다른 탭에서 돌아옴)
 *  ③ window pageshow (특히 iOS Safari/WebView 의 back-forward 캐시 복원)
 *
 * ❗ window 'focus' 이벤트는 의도적으로 사용하지 않는다 (2026-05-29 수정).
 *    Android WebView 에서 키보드 닫힘 / 시스템 알림 닫힘 / 화면 회전 등 사용자 의도와 무관한
 *    경우에도 자주 발화 → 매 발화마다 5개+ API 일제히 재호출 → ThrottlerException 사고가 잦았다.
 *    백그라운드 복귀는 visibilitychange 만으로 충분하다.
 *
 * 호출 간 디바운스 (DEBOUNCE_MS) — visibilitychange / pageshow / route 변경이 연달아 일어나도
 * 마지막 호출로부터 N ms 이내면 무시. 같은 페이지의 5개 API 가 동시에 재호출되어 폭주하는
 * 패턴을 차단.
 *
 * mount 시점에는 호출 안 함 (각 페이지의 초기 useEffect 가 이미 fetch 하므로).
 */
const DEBOUNCE_MS = 3_000

export function useRefreshOnFocus(callback: () => void) {
  const cbRef = useRef(callback)
  cbRef.current = callback
  const location = useLocation()
  const initialReload = useRef((location.state as { reload?: number } | null)?.reload)
  const lastCallAtRef = useRef(0)

  // 디바운스 래퍼 — 짧은 시간 내 연속 호출 1회로 정리
  const fire = () => {
    const now = Date.now()
    if (now - lastCallAtRef.current < DEBOUNCE_MS) return
    lastCallAtRef.current = now
    cbRef.current()
  }

  // route state.reload 변경 감지 — 같은 경로 탭 재클릭으로 발행되는 timestamp
  useEffect(() => {
    const r = (location.state as { reload?: number } | null)?.reload
    if (r !== undefined && r !== initialReload.current) {
      initialReload.current = r
      // route 재클릭은 사용자 명시 액션이므로 디바운스 우회 — 단 lastCallAt 만 갱신해
      // 직후의 자동 발화는 막는다.
      lastCallAtRef.current = Date.now()
      cbRef.current()
    }
  }, [location.state])

  // 백그라운드 복귀 / bfcache 복원 시 refetch
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fire()
    }
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) fire()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pageshow', onPageShow)
    }
    // fire 는 클로저로 참조되지만 의존성 비워두는 게 안전 — 매 마운트마다 동일 동작
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
