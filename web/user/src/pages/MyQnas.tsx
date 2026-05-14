import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import FloatingActions from '../components/FloatingActions'
import { useAuth } from '../lib/auth-context'
import { myQnaApi, type MyQnaItem } from '../lib/api'

/**
 * 나의 상담 문의 — Figma 147:13466
 *  카드 리스트:
 *   - 상단: 상담사 이름 + 코드(보라) + 우측 ⋮
 *   - 상태 칩 (답변완료 보라 / 답변대기 회색) + 자물쇠 + 제목
 *   - 본문 미리보기 + 메타(작성자 · 날짜)
 *
 *  데이터: GET /api/user/my-qnas (회원 인증 필수)
 */

function formatDate(iso: string): string {
  // "2026.04.23" 포맷 — sample 카드 메타와 동일
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}.${m}.${dd}`
}

export default function MyQnas() {
  const navigate = useNavigate()
  const { member, loading: authLoading } = useAuth()
  const [items, setItems] = useState<MyQnaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || !member) return
    let mounted = true
    myQnaApi
      .list({ limit: 50, offset: 0 })
      .then((res) => {
        if (!mounted) return
        setItems(res.items)
      })
      .catch((e) => {
        if (!mounted) return
        setError((e as Error).message || '문의 목록을 불러오지 못했습니다.')
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
      <div className="mobile-frame flex flex-col pb-6 items-center justify-center min-h-[60vh]">
        <p className="text-[14px] text-[#6A7282]">불러오는 중...</p>
      </div>
    )
  }

  if (!member) {
    return <Navigate to="/login?redirect=/mypage/my-qnas" replace />
  }

  return (
    <div className="mobile-frame flex flex-col pb-[40px]">
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
          나의 상담문의
        </h1>
      </header>

      <main className="flex-1 px-4">
        {loading ? (
          <p className="py-10 text-center text-[14px] text-[#6A7282]">불러오는 중...</p>
        ) : error ? (
          <p className="py-10 text-center text-[14px] text-[#E84263]">{error}</p>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-[14px] text-[#6A7282]">작성한 상담문의가 없습니다.</p>
        ) : (
          items.map((q) => {
            const showLock = q.is_secret
            return (
              <Link
                key={q.id}
                to={`/mypage/my-qnas/${q.id}`}
                className="block py-4 border-b border-[#F3F4F6]"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[16px] font-bold text-[#030712]">{q.counselor_name}</span>
                  {q.counselor_code && (
                    <span className="text-[15px] font-medium text-[#8259F5]">{q.counselor_code}</span>
                  )}
                  <button
                    type="button"
                    aria-label="더보기"
                    className="ml-auto w-7 h-7 flex items-center justify-center text-[#9CA3AF]"
                    onClick={(e) => e.preventDefault()}
                  >
                    ⋮
                  </button>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={
                      q.status === '답변완료'
                        ? 'h-[24px] px-2 inline-flex items-center rounded text-[12px] font-medium bg-[#F3EEFE] text-[#8259F5]'
                        : 'h-[24px] px-2 inline-flex items-center rounded text-[12px] font-medium bg-[#F3F4F6] text-[#6A7282]'
                    }
                  >
                    {q.status}
                  </span>
                  {showLock && (
                    <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" aria-hidden>
                      <rect x="5" y="11" width="14" height="9" rx="2" stroke="#030712" strokeWidth="1.6" />
                      <path d="M8 11V8a4 4 0 018 0v3" stroke="#030712" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  )}
                  <span className="text-[15px] font-semibold text-[#030712] truncate">{q.title}</span>
                </div>

                {q.content && (
                  <p className="mt-1 text-[14px] text-[#6A7282] line-clamp-2 whitespace-pre-line">
                    {q.content}
                  </p>
                )}
                <p className="mt-2 text-[12px] text-[#99A1AF]">
                  {q.reviewer_name} · {formatDate(q.created_at)}
                </p>
              </Link>
            )
          })
        )}
      </main>

      <FloatingActions bottomOffset={24} />
    </div>
  )
}
