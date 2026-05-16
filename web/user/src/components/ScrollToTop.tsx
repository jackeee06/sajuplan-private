import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/**
 * 라우트 이동 시 스크롤을 최상단으로 초기화.
 *
 * React Router v6 는 기본적으로 라우트 변경 시 스크롤 위치를 유지한다.
 * 모바일 사이트에서 (상담사 신청 → 폼 같은) 페이지 이동 시 이전 페이지의
 * 스크롤 위치가 그대로 남아서 사용자가 중간부터 보게 되는 문제가 있어,
 * 모든 PUSH/REPLACE 네비게이션에서 스크롤을 0,0 으로 리셋한다.
 *
 * 단, POP (브라우저 뒤로/앞으로 가기) 시에는 스크롤을 유지해서
 * 사용자가 "원래 보던 위치" 로 돌아가게 한다 — 자연스러운 뒤로가기 경험.
 *
 * 다중 방어: 즉시 scrollTo + rAF 후 한 번 더 + 100ms 후 한 번 더.
 * Toast UI Editor 같은 iframe 컴포넌트가 mount 후 비동기로 focus 를
 * 가져가면서 페이지를 끌어내리는 케이스 방지.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation()
  const navigationType = useNavigationType()

  useEffect(() => {
    if (navigationType === 'POP') return
    const toTop = () => window.scrollTo(0, 0)
    toTop()
    const raf = requestAnimationFrame(toTop)
    const t = window.setTimeout(toTop, 120)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(t)
    }
  }, [pathname, navigationType])

  return null
}
