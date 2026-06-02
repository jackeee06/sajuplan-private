import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import { reviewsApi } from '../lib/api'

/**
 * 후기 수정 — 작성 후 5분 이내 + 상담사 답변 없을 때만 허용 (백엔드 정책).
 * 제목·내용만 수정 가능.
 */
export default function MyReviewEdit() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const reviewId = Number(id)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!reviewId) { navigate('/mypage/my-reviews', { replace: true }); return }
    let mounted = true
    reviewsApi.detail(reviewId)
      .then((r) => {
        if (!mounted) return
        setTitle(r.title ?? '')
        setContent(r.content ?? '')
      })
      .catch(() => {
        if (mounted) navigate('/mypage/my-reviews', { replace: true })
      })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [reviewId, navigate])

  const submit = async () => {
    const t = title.trim()
    const c = content.trim()
    if (!t) { setError('제목을 입력해주세요.'); return }
    if (!c) { setError('내용을 입력해주세요.'); return }
    setSaving(true)
    setError(null)
    try {
      await reviewsApi.update(reviewId, { title: t, content: c })
      navigate('/mypage/my-reviews', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : '수정 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mobile-frame flex flex-col pb-[100px]">
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
          후기 수정
        </h1>
      </header>

      <main className="flex-1 px-4 pt-4">
        {loading ? (
          <p className="py-20 text-center text-[14px] text-[#6A7282]">불러오는 중...</p>
        ) : (
          <>
            <p className="mb-4 text-[13px] text-[#99A1AF]">작성 후 5분 이내, 상담사 답변 전에만 수정할 수 있습니다.</p>
            <div className="mb-4">
              <label className="block text-[13px] font-medium text-[#4A5565] mb-1.5">제목</label>
              <input
                className="input-field w-full"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={255}
                placeholder="후기 제목"
              />
            </div>
            <div className="mb-4">
              <label className="block text-[13px] font-medium text-[#4A5565] mb-1.5">내용</label>
              <textarea
                className="textarea-field w-full min-h-[160px]"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="후기 내용을 입력해주세요."
              />
            </div>
            {error && (
              <p className="mb-4 text-[13px] text-[#FB2C36]">{error}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="btn btn-outline-gray btn--base flex-1"
              >
                취소
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={saving}
                className="btn btn-primary btn--base flex-1"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
