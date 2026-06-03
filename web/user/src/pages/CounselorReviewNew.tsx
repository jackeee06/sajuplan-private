import { Navigate, useParams } from 'react-router-dom'

/**
 * /counselors/:id/reviews/new → /mypage/my-reviews/new?counselor_id=:id 로 redirect.
 * 실제 후기 작성 폼은 MyReviewNew.tsx 에서 처리.
 */
export default function CounselorReviewNew() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/mypage/my-reviews/new?counselor_id=${id ?? ''}`} replace />
}
