import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'
import { useAuth } from '../lib/auth-context'
import { supportInquiryApi, type SupportInquiryItem } from '../lib/api'

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}.${m}.${dd}`
}

/** 고객센터 1:1 문의 — 내 문의내역. 라우트: /mypage/support-inquiries */
export default function SupportInquiries() {
  const navigate = useNavigate()
  const { member, loading: authLoading } = useAuth()
  const [items, setItems] = useState<SupportInquiryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || !member) return
    let mounted = true
    setLoading(true)
    supportInquiryApi
      .list({ limit: 50, offset: 0 })
      .then((res) => {
        if (mounted) setItems(res.items)
      })
      .catch((e) => {
        if (mounted) setError((e as Error).message || '문의 목록을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [authLoading, member])

  if (authLoading) {
    return (
      <div className="mobile-frame flex flex-col pb-[100px] items-center justify-center min-h-[60vh]">
        <p className="text-[14px] text-[#6A7282]">불러오는 중...</p>
      </div>
    )
  }
  if (!member) return <Navigate to="/login?redirect=/mypage/support-inquiries" replace />

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
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">1:1 문의내역</h1>
        <button
          type="button"
          onClick={() => navigate('/mypage/support-inquiries/new')}
          className="h-9 px-3.5 rounded-full bg-[#f472b6] text-white text-[13px] font-medium whitespace-nowrap"
        >
          + 문의하기
        </button>
      </header>

      <main className="flex-1 px-4">
        {loading ? (
          <p className="py-10 text-center text-[14px] text-[#6A7282]">불러오는 중...</p>
        ) : error ? (
          <p className="py-10 text-center text-[14px] text-[#E84263]">{error}</p>
        ) : items.length === 0 ? (
          <div className="pt-[64px] flex flex-col items-center">
            <div className="w-[80px] h-[80px] rounded-full bg-[#fdf2f8] flex items-center justify-center">
              <img src="/img/ic_message_p.svg?v=v2" alt="" className="w-9 h-9" />
            </div>
            <p className="mt-4 text-[18px] leading-[140%] font-bold text-[#030712]">문의 내역이 없습니다.</p>
            <p className="mt-2 text-[15px] leading-[150%] text-[#6A7282] text-center">
              궁금하신 점이 있다면<br />아래 버튼으로 1:1 문의를 남겨주세요.
            </p>
            <button
              type="button"
              onClick={() => navigate('/mypage/support-inquiries/new')}
              className="mt-5 h-11 px-6 rounded-full bg-[#f472b6] text-white text-[15px] font-medium"
            >
              1:1 문의하기
            </button>
          </div>
        ) : (
          items.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => navigate(`/mypage/support-inquiries/${q.id}`)}
              className="w-full text-left py-4 border-b border-[#F3F4F6]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {q.category && (
                    <span className="px-2 py-0.5 rounded-full bg-[#F3F4F6] text-[11px] text-[#6A7282]">
                      {q.category}
                    </span>
                  )}
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      q.has_reply ? 'bg-[#fdf2f8] text-[#ec4899]' : 'bg-[#F3F4F6] text-[#99A1AF]'
                    }`}
                  >
                    {q.status}
                  </span>
                </div>
                <span className="text-[12px] text-[#99A1AF]">{formatDate(q.created_at)}</span>
              </div>
              <p className="mt-1.5 text-[15px] font-semibold text-[#030712] line-clamp-1">{q.title}</p>
              <p className="mt-0.5 text-[14px] text-[#6A7282] line-clamp-2 whitespace-pre-line">{q.content}</p>
            </button>
          ))
        )}
      </main>

      <FloatingActions bottomOffset={24} />
      <BottomNav />
    </div>
  )
}
