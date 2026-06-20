import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import { ApiError, supportInquiryApi } from '../lib/api'

/**
 * 고객센터 1:1 문의 작성 — 회원이 운영자에게 보내는 문의.
 * 라우트: /mypage/support-inquiries/new
 * 답변은 운영팀이 등록하며, 등록 시 앱 푸시로 안내된다. (비밀글 고정)
 */
const FALLBACK_CATEGORIES = ['이용안내', '결제/충전', '상담', '기타']

export default function SupportInquiryNew() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState<string[]>(FALLBACK_CATEGORIES)
  const [category, setCategory] = useState('이용안내')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    supportInquiryApi
      .categories()
      .then((res) => {
        if (alive && res.items?.length) {
          setCategories(res.items)
          setCategory(res.items[0])
        }
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const canSubmit = title.trim().length > 0 && content.trim().length > 0 && !submitting

  const onSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      await supportInquiryApi.create({
        category,
        title: title.trim(),
        content: content.trim(),
        is_secret: true,
      })
      navigate('/mypage/support-inquiries', { replace: true })
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        navigate('/login', { replace: true, state: { from: '/mypage/support-inquiries/new' } })
        return
      }
      setError(e instanceof Error ? e.message : '문의 등록에 실패했습니다.')
    } finally {
      setSubmitting(false)
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
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">1:1 문의 작성</h1>
      </header>

      <main className="flex-1 px-4 pt-4 flex flex-col gap-5">
        {/* 분류 */}
        <section className="flex flex-col gap-2">
          <label className="text-[16px] leading-[130%] font-semibold text-[#1E2939]">분류</label>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const active = c === category
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`px-3.5 py-2 rounded-full text-[14px] border transition ${
                    active
                      ? 'bg-[#fdf2f8] border-[#f472b6] text-[#ec4899] font-medium'
                      : 'bg-[#F9FAFB] border-[#F3F4F6] text-[#6A7282]'
                  }`}
                >
                  {c}
                </button>
              )
            })}
          </div>
        </section>

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

        {/* 내용 */}
        <section className="flex flex-col gap-2">
          <label className="text-[16px] leading-[130%] font-semibold text-[#1E2939]">
            문의 내용<span className="text-[#ec4899] ml-0.5">*</span>
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="궁금하신 점을 자세히 작성해주세요. 운영팀이 확인 후 답변드립니다."
            rows={8}
            className="w-full px-4 py-3 rounded-[16px] bg-[#F9FAFB] border border-[#F3F4F6] text-[14px] leading-[140%] text-[#1E2939] placeholder:text-[#99A1AF] focus:outline-none focus:border-[#f472b6] resize-none"
          />
          <p className="text-[12px] text-[#99A1AF]">비밀글로 등록됩니다 — 작성자 본인과 운영팀만 볼 수 있어요.</p>
        </section>

        {error && <p className="text-[13px] text-[#FF6467]">{error}</p>}

        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className={`mt-1 h-12 rounded-full text-white text-[16px] font-medium transition ${
            canSubmit ? 'bg-[#f472b6] hover:bg-[#ec4899]' : 'bg-[#f472b6]/60 cursor-not-allowed'
          }`}
        >
          {submitting ? '등록 중…' : '문의 등록'}
        </button>
      </main>
      <BottomNav />
    </div>
  )
}
