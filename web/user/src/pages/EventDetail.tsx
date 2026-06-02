import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'
import { ApiError, eventsApi, type PublicEventDetail } from '../lib/api'

/**
 * 이벤트 상세 — Figma 06마이페이지(비회원) > 이벤트 상세 (진행중/종료)
 *
 * 진행중 칩: bg #fdf2f8 / text #ec4899
 * 종료   칩: bg #F3F4F6 / text #6A7282
 *
 * API: GET /api/user/events/:id — 조회수 +1 후 단건 반환.
 */
export default function EventDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [ev, setEv] = useState<PublicEventDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let alive = true
    setLoading(true)
    setNotFound(false)
    setError(null)
    eventsApi
      .detail(id)
      .then((res) => {
        if (!alive) return
        setEv(res)
      })
      .catch((e: unknown) => {
        if (!alive) return
        if (e instanceof ApiError && e.status === 404) {
          setNotFound(true)
          return
        }
        setError(e instanceof Error ? e.message : '이벤트를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [id])

  if (loading) {
    return (
      <div className="mobile-frame flex flex-col pb-[100px]">
        <Header onBack={() => navigate(-1)} />
        <p className="text-center text-[14px] text-[#99A1AF] py-10">불러오는 중…</p>
        <BottomNav />
      </div>
    )
  }

  if (notFound || !ev) {
    return (
      <div className="mobile-frame flex flex-col pb-[100px]">
        <Header onBack={() => navigate(-1)} />
        <p className="text-center text-[14px] text-[#99A1AF] py-10">
          {error ?? '존재하지 않는 이벤트입니다.'}
        </p>
        <BottomNav />
      </div>
    )
  }

  const ended = ev.status === 'ended'
  const period = formatPeriod(ev.starts_at, ev.ends_at)
  const statusLabel = ev.status === 'ended' ? '종료' : ev.status === 'upcoming' ? '예정' : '진행중'

  return (
    <div className="mobile-frame flex flex-col pb-[100px]">
      <Header onBack={() => navigate(-1)} />

      <main className="flex-1 px-4 pt-2">
        <div className="flex items-center gap-2">
          <span
            className={
              ended
                ? 'inline-flex items-center h-[26px] px-2.5 rounded-[6px] text-[13px] leading-none font-medium bg-[#F3F4F6] text-[#6A7282]'
                : 'inline-flex items-center h-[26px] px-2.5 rounded-[6px] text-[13px] leading-none font-medium bg-[#fdf2f8] text-[#ec4899]'
            }
          >
            {statusLabel}
          </span>
        </div>
        <h2 className="mt-2 text-[18px] leading-[140%] font-bold text-[#030712]">
          {ev.title}
        </h2>
        {period && (
          <p className="mt-1 text-[14px] leading-[140%] text-[#99A1AF]">{period}</p>
        )}

        {ev.content && ev.content.trim() !== '' && (
          <div
            className="mt-4 text-[14px] leading-[160%] text-[#252B36] event-content"
            dangerouslySetInnerHTML={{ __html: ev.content }}
          />
        )}

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => navigate('/mypage/events')}
            className="h-[44px] px-7 rounded-full border border-[#f472b6] text-[15px] font-medium text-[#ec4899]"
          >
            목록으로
          </button>
        </div>
      </main>

      <FloatingActions bottomOffset={100} />
      <BottomNav />
    </div>
  )
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-gradient-to-b from-white to-white/80 backdrop-blur-[7px]">
      <button
        type="button"
        onClick={onBack}
        aria-label="뒤로"
        className="w-[30px] h-[30px] flex items-center justify-center"
      >
        <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
      </button>
      <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">
        이벤트
      </h1>
    </header>
  )
}

/** ISO → "YYYY.MM.DD ~ YYYY.MM.DD". 한쪽만 있으면 한쪽만, 둘 다 없으면 빈 문자열. */
function formatPeriod(starts: string | null, ends: string | null): string {
  const s = formatDate(starts)
  const e = formatDate(ends)
  if (s && e) return `${s} ~ ${e}`
  if (s) return `${s} ~`
  if (e) return `~ ${e}`
  return ''
}

function formatDate(v: string | null): string | null {
  if (!v) return null
  const d = new Date(v)
  if (isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}.${m}.${dd}`
}
