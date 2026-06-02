import { useState } from 'react'
import { ApiError, reviewsApi } from '../lib/api'

/**
 * 후기 신고 모달 (2026-05-15 신설).
 *
 *  - 사유 카테고리 라디오 선택 + 자유 입력(선택)
 *  - 본인 후기는 신고 불가 (백엔드 400) / 같은 사용자 중복 신고 불가 (백엔드 409)
 *  - 비로그인은 모달 진입 전에 처리. 여기는 인증된 호출만 가정.
 */
export type ReportCategory = 'abuse' | 'false' | 'ad' | 'privacy' | 'other'

const CATEGORIES: { value: ReportCategory; label: string; help: string }[] = [
  { value: 'abuse', label: '욕설·비방', help: '욕설/혐오/인신공격 등 부적절한 표현' },
  { value: 'false', label: '허위 사실', help: '사실과 다른 내용 또는 거짓 정보' },
  { value: 'ad', label: '광고·스팸', help: '광고/홍보/반복성 도배 글' },
  { value: 'privacy', label: '개인정보 노출', help: '실명/연락처/주소 등 개인정보 공개' },
  { value: 'other', label: '기타', help: '위에 해당하지 않는 부적절한 내용' },
]

interface Props {
  reviewId: number
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function ReviewReportModal({ reviewId, open, onClose, onSuccess }: Props) {
  const [category, setCategory] = useState<ReportCategory>('abuse')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const submit = async () => {
    setError(null)
    setSubmitting(true)
    try {
      await reviewsApi.report(reviewId, {
        reason_category: category,
        reason: reason.trim() || undefined,
      })
      onSuccess?.()
      onClose()
      // 입력 초기화 (모달이 재오픈될 때 깨끗이)
      setCategory('abuse')
      setReason('')
      alert('신고가 접수되었습니다. 검토 후 처리됩니다.')
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 401) setError('신고하려면 로그인이 필요합니다.')
        else if (e.status === 400) setError(e.message || '본인이 작성한 후기는 신고할 수 없습니다.')
        else if (e.status === 409) setError('이미 신고하신 후기입니다.')
        else setError(e.message || '신고 처리 중 오류가 발생했습니다.')
      } else {
        setError('신고 처리 중 오류가 발생했습니다.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="후기 신고"
    >
      <div
        className="w-full max-w-[600px] bg-white rounded-t-[20px] p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between">
          <h2 className="text-[18px] font-semibold text-[#1E2939]">후기 신고</h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="text-[20px] text-[#99A1AF] leading-none">×</button>
        </header>

        <p className="text-[13px] text-[#6A7282] leading-snug">
          신고 사유를 선택해 주세요. 어드민이 검토 후 처리합니다.
        </p>

        {/* 카테고리 라디오 */}
        <div className="flex flex-col gap-2">
          {CATEGORIES.map((c) => (
            <label
              key={c.value}
              className={`flex items-start gap-2 p-3 rounded-[10px] border cursor-pointer ${
                category === c.value
                  ? 'border-[#f472b6] bg-[#fdf2f8]'
                  : 'border-[#F3F4F6] bg-[#F9FAFB] hover:border-[#E5E7EB]'
              }`}
            >
              <input
                type="radio"
                name="report_category"
                value={c.value}
                checked={category === c.value}
                onChange={() => setCategory(c.value)}
                className="mt-0.5 w-4 h-4 accent-[#f472b6]"
              />
              <div className="flex-1 min-w-0">
                <p className={`text-[14px] font-medium ${category === c.value ? 'text-[#ec4899]' : 'text-[#1E2939]'}`}>
                  {c.label}
                </p>
                <p className="text-[12px] text-[#6A7282] mt-0.5 leading-snug">{c.help}</p>
              </div>
            </label>
          ))}
        </div>

        {/* 자유 입력 */}
        <div>
          <label className="text-[13px] text-[#4A5565] font-medium">상세 사유 (선택)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="신고 사유를 더 자세히 설명해 주세요."
            maxLength={500}
            rows={3}
            className="mt-1 w-full px-3 py-2 rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] text-[14px] text-[#1E2939] placeholder:text-[#99A1AF] focus:outline-none focus:border-[#f472b6] resize-none"
          />
          <p className="text-right text-[11px] text-[#99A1AF] mt-1">{reason.length} / 500</p>
        </div>

        {error && (
          <p className="text-[13px] text-[#FB2C36]">{error}</p>
        )}

        {/* 버튼 row */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 h-12 rounded-full border border-[#E5E7EB] text-[14px] text-[#4A5565] font-medium disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="flex-1 h-12 rounded-full bg-[#f472b6] text-white text-[14px] font-medium disabled:opacity-50"
          >
            {submitting ? '신고 중…' : '신고하기'}
          </button>
        </div>
      </div>
    </div>
  )
}
