import { Navigate, useParams } from 'react-router-dom'

/**
 * /counselors/:id/reviews/new → 상담사 프로필(후기 탭)로 redirect.
 *
 * [2026-06-14] 상담사 프로필발 후기 작성 경로 폐지.
 *   상담번호 없이 후기 폼을 열던 입구(상담사 상세 "후기 작성하기")를 제거.
 *   후기는 마이페이지 > 상담내역에서만 작성(해당 상담을 직접 선택 → 상담번호 자동 첨부).
 *   딥링크/북마크로 이 URL 이 들어와도 깨진 폼 대신 상담사 프로필로 안전하게 보낸다.
 */
export default function CounselorReviewNew() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={id ? `/counselors/${id}?tab=reviews` : '/counselors'} replace />
}
