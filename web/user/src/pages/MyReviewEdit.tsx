import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * 후기 수정 페이지 — 2026-05-15 운영 정책 변경으로 **수정 기능 제거**.
 *
 * 변경 사유: 후기는 한 번 작성 후 수정 불가 (악의적 변조·삭제·재작성 반복 방지).
 *           수정이 필요하면 기존 후기를 삭제하고 새로 작성.
 *
 * 이 페이지로 직접 URL 진입 시(예: 북마크) 즉시 `/mypage/my-reviews` 목록으로 리다이렉트.
 * 기존 수정 로직(prefill / PATCH / 사진 교체 등)은 git 히스토리에서 복원 가능.
 */
export default function MyReviewEdit() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate('/mypage/my-reviews', { replace: true })
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center px-4 text-center">
      <div>
        <p className="text-[14px] text-[#1E2939] font-medium">후기 수정 기능이 종료되었습니다.</p>
        <p className="mt-1 text-[12px] text-[#6A7282]">잠시 후 후기 목록으로 이동합니다…</p>
      </div>
    </div>
  )
}
