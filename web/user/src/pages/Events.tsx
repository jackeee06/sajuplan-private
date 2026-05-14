import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'
import UploadedImage from '../components/UploadedImage'
import { eventsApi, type PublicEventListItem } from '../lib/api'

/**
 * 이벤트 리스트 — Figma 06마이페이지(비회원) > 이벤트 (118:7272)
 *
 * 카드는 풀폭 배너 이미지(라운드 16px). 종료 카드는 어두운 오버레이 + "종료된 이벤트입니다" 텍스트 노출.
 *
 * API: GET /api/user/events — active/upcoming 우선, ended 뒤. 백엔드가 정렬까지 책임진다.
 */
export default function Events() {
  const navigate = useNavigate()
  const [items, setItems] = useState<PublicEventListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    eventsApi
      .list({ page: 1, limit: 50 })
      .then((res) => {
        if (!alive) return
        setItems(res.items)
        setError(null)
      })
      .catch((e: unknown) => {
        if (!alive) return
        const msg = e instanceof Error ? e.message : '이벤트를 불러오지 못했습니다.'
        setError(msg)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

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
          이벤트
        </h1>
      </header>

      <main className="flex-1 px-4 pt-2">
        {loading ? (
          <p className="text-center text-[14px] text-[#99A1AF] py-10">불러오는 중…</p>
        ) : error ? (
          <p className="text-center text-[14px] text-[#FF6467] py-10">{error}</p>
        ) : items.length === 0 ? (
          <p className="text-center text-[14px] text-[#99A1AF] py-10">
            등록된 이벤트가 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((ev) => {
              const ended = ev.status === 'ended'
              return (
                <li key={ev.id}>
                  <Link
                    to={`/mypage/events/${ev.id}`}
                    className="block relative w-full aspect-[335/160] rounded-[16px] overflow-hidden bg-[#F3F4F6]"
                  >
                    <UploadedImage
                      src={ev.thumbnail_url}
                      srcWebp={ev.thumbnail_url_webp}
                      alt={ev.title}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    {ended && (
                      <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                        <span className="text-[16px] leading-[140%] font-semibold text-white">
                          종료된 이벤트입니다
                        </span>
                      </div>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </main>

      <FloatingActions bottomOffset={100} />
      <BottomNav />
    </div>
  )
}
