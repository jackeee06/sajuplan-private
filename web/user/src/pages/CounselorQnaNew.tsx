import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import { ApiError, counselorQnaApi } from '../lib/api'

/**
 * 상담 문의 작성 — Figma 163:19878
 * 라우트: /counselors/:id/qna/new
 *
 * 정책: 문의는 제3자에게 항상 비밀 → is_secret 항상 true, 토글 UI 제거
 */
export default function CounselorQnaNew() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = title.trim().length > 0 && content.trim().length > 0 && !submitting

  const onSubmit = async () => {
    if (!canSubmit || !id) return
    setSubmitting(true)
    setError(null)
    try {
      await counselorQnaApi.create(id, {
        title: title.trim(),
        content: content.trim(),
        is_secret: true,
      })
      navigate(`/counselors/${id}/qna`)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        // 미로그인 → 로그인으로
        navigate('/login', { replace: true, state: { from: `/counselors/${id}/qna/new` } })
        return
      }
      setError(e instanceof Error ? e.message : '문의 등록에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mobile-frame flex flex-col pb-[100px]">
      {/* 헤더 — hd5 */}
      <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-gradient-to-b from-white to-white/80 backdrop-blur-[7px]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로"
          className="w-[30px] h-[30px] flex items-center justify-center"
        >
          <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
        </button>
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">
          상담 문의 작성
        </h1>
      </header>

      <main className="flex-1 px-4 pt-4 flex flex-col gap-5">
        {/* 제목 */}
        <section className="flex flex-col gap-2">
          <label className="text-[16px] leading-[130%] font-semibold text-[#1E2939]">
            제목<span className="text-[#ec4899] ml-0.5">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 입력해주세요."
            maxLength={255}
            className="w-full h-12 px-4 rounded-full bg-[#F9FAFB] border border-[#F3F4F6] text-[14px] text-[#1E2939] placeholder:text-[#99A1AF] focus:outline-none focus:border-[#f472b6]"
          />
        </section>

        {/* 문의 내용 */}
        <section className="flex flex-col gap-2">
          <label className="text-[16px] leading-[130%] font-semibold text-[#1E2939]">
            문의 내용<span className="text-[#ec4899] ml-0.5">*</span>
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="상담사님께 궁금한 점을 작성해주세요."
            rows={8}
            className="w-full px-4 py-3 rounded-[16px] bg-[#F9FAFB] border border-[#F3F4F6] text-[14px] leading-[140%] text-[#1E2939] placeholder:text-[#99A1AF] focus:outline-none focus:border-[#f472b6] resize-none"
          />
        </section>

        {error && <p className="text-[13px] text-[#FF6467]">{error}</p>}

        {/* 작성완료 */}
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className={`mt-3 h-12 rounded-full text-white text-[16px] font-medium transition ${
            canSubmit ? 'bg-[#f472b6] hover:bg-[#ec4899]' : 'bg-[#f472b6]/60 cursor-not-allowed'
          }`}
        >
          {submitting ? '등록 중…' : '작성완료'}
        </button>
      </main>
      <BottomNav />
      </div>
  )
}
