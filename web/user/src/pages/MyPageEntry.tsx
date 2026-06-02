import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'
import MyPage from './MyPage'
import MemberMyPage from './MemberMyPage'
import CounselorMyPage from './CounselorMyPage'

/**
 * /mypage 진입점 (2026-05-22 ID 통합 후) — 항상 회원 마이페이지로.
 *
 *   비로그인         → MyPage (환영 + 로그인 버튼)
 *   role=counselor   → MemberMyPage (상담사도 회원 화면을 기본으로 봄)
 *                      상담사 마이페이지로 이동은 우상단 [상담사 메뉴] 칩으로
 *   그 외(member 등)→ MemberMyPage (포인트/메뉴)
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

  // 회원/상담사 모두 같은 회원 마이페이지를 본다.
  // 상담사 자격이 있는 사람은 회원 화면 우상단 [상담사 메뉴 >] 칩으로 전환.
  return <MemberMyPage />
}

/** 사용 안 함 — Navigate 기반 분기가 필요할 경우 참고용 */
export function _MyPageRedirect() {
  const { member, loading } = useAuth()
  if (loading) return null
  if (!member) return <Navigate to="/login?redirect=/mypage" replace />
  return <Navigate to="/mypage/member" replace />
}
