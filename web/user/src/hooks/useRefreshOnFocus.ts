import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * 페이지가 다시 활성화될 때 callback 을 호출.
 *
 *  ① route state.reload 변경 (BottomNav 가 같은 탭 재클릭 시 새 timestamp 발행)
 *  ② document visibilitychange → visible 전환 (앱 백그라운드 복귀 / 다른 탭에서 돌아옴)
 *  ③ window pageshow (특히 iOS Safari/WebView 의 back-forward 캐시 복원)
 *  ④ window focus (Web 일반)
 *
 * mount 시점에는 호출 안 함 (각 페이지의 초기 useEffect 가 이미 fetch 하므로).
 */
export function useRefreshOnFocus(callback: () => void) {
  const cbRef = useRef(callback)
  cbRef.current = callback
  const location = useLocation()
  const initialReload = useRef((location.state as { reload?: number } | null)?.reload)

  // route state.reload 변경 감지 — 같은 경로 탭 재클릭으로 발행되는 timestamp
  useEffect(() => {
    const r = (location.state as { reload?: number } | null)?.reload
    if (r !== undefined && r !== initialReload.current) {
      initialReload.current = r
      cbRef.current()
    }
  }, [location.state])

  // 백그라운드 복귀 / bfcache 복원 / focus 시 refetch
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') cbRef.current()
    }
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) cbRef.current()
    }
    const onFocus = () => cbRef.current()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('focus', onFocus)
    }
  }, [])
}
