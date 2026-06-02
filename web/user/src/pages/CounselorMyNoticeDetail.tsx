import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'
import { ApiError, noticesApi, type PublicNoticeDetail } from '../lib/api'

/**
 * 상담사 공지사항 상세 — 회원 NoticeDetail 와 동일 API 사용.
 */
export default function CounselorMyNoticeDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [notice, setNotice] = useState<PublicNoticeDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setError('공지사항 ID가 없습니다.')
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    setError(null)
    noticesApi
      .detail(id)
      .then((r) => {
        if (alive) setNotice(r)
      })
      .catch((e) => {
        if (!alive) return
        if (e instanceof ApiError && e.status === 404) {
          setError('존재하지 않는 공지사항입니다.')
        } else {
          setError(e instanceof Error ? e.message : '공지사항을 불러오지 못했습니다.')
        }
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [id])

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
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">상담사 공지사항</h1>
      </header>

      <main className="flex-1 px-4">
        {loading ? (
          <div className="pt-2 flex flex-col gap-3">
            <div className="h-6 w-2/3 bg-[#F3F4F6] animate-pulse rounded" />
            <div className="h-4 w-1/3 bg-[#F3F4F6] animate-pulse rounded" />
            <div className="mt-4 h-32 w-full bg-[#F3F4F6] animate-pulse rounded" />
          </div>
        ) : error || !notice ? (
          <div className="flex flex-col items-center gap-4 py-10">
            <p className="text-[14px] text-[#99A1AF]">{error ?? '공지사항을 불러올 수 없습니다.'}</p>
            <button
              type="button"
              onClick={() => navigate('/counselor/mypage/notices')}
              className="h-10 px-6 rounded-full border border-[#8259F5] text-[14px] font-medium text-[#8259F5]"
            >
              목록으로
            </button>
          </div>
        ) : (
          <>
            <div className="pt-2 flex items-center gap-2 flex-wrap">
              {notice.is_pinned && (
                <span className="inline-flex items-center h-[22px] px-2 rounded-full bg-white border border-[#8259F5] text-[12px] leading-none font-medium text-[#8259F5]">
                  공지
                </span>
              )}
              {notice.category && !notice.is_pinned && (
                <span className="inline-flex items-center h-[22px] px-2 rounded-full bg-[#F9FAFB] text-[12px] leading-none font-medium text-[#6A7282]">
                  {notice.category}
                </span>
              )}
            </div>
            <h2 className="mt-2 text-[20px] font-bold leading-[140%] text-[#030712]">
              {notice.title}
            </h2>
            <p className="mt-1 text-[14px] leading-[140%] text-[#99A1AF]">
              {formatDateTime(notice.created_at)}
            </p>

            <div className="mt-4 border-t border-[#F3F4F6] pt-4">
              {/^\s*</.test(notice.content) ? (
                <div
                  className="text-[14px] leading-[160%] text-[#4A5565] notice-html"
                  dangerouslySetInnerHTML={{ __html: notice.content }}
                />
              ) : (
                <p className="text-[14px] leading-[160%] text-[#4A5565] whitespace-pre-line">
                  {notice.content || '본문이 비어있습니다.'}
                </p>
              )}
            </div>

            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => navigate('/counselor/mypage/notices')}
                className="h-10 px-6 rounded-full border border-[#8259F5] text-[14px] font-medium text-[#8259F5]"
              >
                목록으로
              </button>
            </div>
          </>
        )}
      </main>

      <FloatingActions bottomOffset={24} />
      <BottomNav myHref="/counselor/mypage" />
      </div>
  )
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}.${m}.${day} ${hh}:${mm}`
}
