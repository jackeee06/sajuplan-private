import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'
import MyPage from './MyPage'
import MemberMyPage from './MemberMyPage'
import CounselorMyPage from './CounselorMyPage'

/**
 * /mypage 진입점 — 로그인 여부와 role 에 따라 분기.
 *
 *   비로그인         → MyPage (환영 + 로그인 버튼)
 *   role=counselor   → CounselorMyPage (정산/상담 토글/상담사 메뉴)
 *   그 외(member 등)→ MemberMyPage (포인트/메뉴)
 *
 * Navigate 가 아닌 컴포넌트 직접 렌더 — URL 은 항상 `/mypage` 로 유지되고
 * 새로고침 / 뒤로가기 시 동일 동작 보장. 또 `/mypage/member` 같은
 * 하위 라우트는 직접 호출 가능 (별도 라우트 정의됨).
 */
export default function MyPageEntry() {
  const { member, loading } = useAuth()

  if (loading) {
    return (
      <div className="mobile-frame flex flex-col">
        <div className="h-[60px] px-4 flex items-center bg-white">
          <h1 className="text-[18px] font-semibold text-[#030712]">마이페이지</h1>
        </div>
        <main className="flex-1 px-4 py-6 flex flex-col gap-3">
          <div className="h-16 rounded-2xl bg-[#F3F4F6] animate-pulse" />
          <div className="h-32 rounded-2xl bg-[#F3F4F6] animate-pulse" />
          <div className="h-14 rounded bg-[#F3F4F6] animate-pulse" />
          <div className="h-14 rounded bg-[#F3F4F6] animate-pulse" />
        </main>
      </div>
    )
  }

  if (!member) {
    return <MyPage />
  }

  if (member.role === 'counselor') {
    return <CounselorMyPage />
  }

  return <MemberMyPage />
}

/** 사용 안 함 — Navigate 기반 분기가 필요할 경우 참고용 */
export function _MyPageRedirect() {
  const { member, loading } = useAuth()
  if (loading) return null
  if (!member) return <Navigate to="/login?redirect=/mypage" replace />
  return member.role === 'counselor' ? (
    <Navigate to="/counselor/mypage" replace />
  ) : (
    <Navigate to="/mypage/member" replace />
  )
}
