import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import { ApiError, notificationsApi, type PublicNotificationItem } from '../lib/api'
import { openExternalUrl } from '../lib/native-bridge'
import { catMeta } from './Notifications'

/**
 * 알림 상세 — /notifications/:id
 *
 *  - 목록(Notifications)에서 클릭하면 알림 객체를 router state 로 넘겨 즉시 표시.
 *  - 상세 진입(딥링크 등 state 없음)이면 목록을 재조회해 id 로 찾는다(단건 조회 API 없음).
 *  - link_url 이 있으면 하단 [바로가기] 버튼으로 이동(내부 SPA / 외부 openExternalUrl).
 *  - 미읽음이면 진입 시 읽음 처리.
 */
export default function NotificationDetail() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams<{ id: string }>()
  const stateItem = (location.state as { notification?: PublicNotificationItem } | null)?.notification

  const [item, setItem] = useState<PublicNotificationItem | null>(stateItem ?? null)
  const [loading, setLoading] = useState(!stateItem)
  const [error, setError] = useState<string | null>(null)

  // state 로 못 받았으면 목록에서 찾아온다.
  useEffect(() => {
    if (stateItem || !id) return
    let alive = true
    setLoading(true)
    notificationsApi
      .list()
      .then((res) => {
        if (!alive) return
        const found = res.items.find((n) => String(n.id) === String(id))
        if (found) setItem(found)
        else setError('알림을 찾을 수 없습니다.')
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof ApiError ? e.message : '알림을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [id, stateItem])

  // 읽음 처리 (미읽음일 때만, 실패 무시)
  useEffect(() => {
    if (item && !item.read && id) {
      notificationsApi.read(Number(id)).catch(() => {})
    }
  }, [item, id])

  const goLink = () => {
    const url = item?.link_url?.trim()
    if (!url) return
    // Notifications 목록과 동일한 내부/외부 분기 규칙.
    const isExternal =
      !url.startsWith('/') &&
      (/^https?:\/\//i.test(url) || /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(url))
    if (isExternal) {
      const href = /^https?:\/\//i.test(url) ? url : `https://${url}`
      openExternalUrl(href)
    } else {
      navigate(url)
    }
  }

  const c = item ? catMeta(item.category) : null
  const hasLink = !!item?.link_url?.trim()

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
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">알림</h1>
      </header>

      <main className="flex-1 px-4 pt-2">
        {loading ? (
          <div className="pt-2 flex flex-col gap-3">
            <div className="h-6 w-2/3 bg-[#F3F4F6] animate-pulse rounded" />
            <div className="h-4 w-1/3 bg-[#F3F4F6] animate-pulse rounded" />
            <div className="mt-4 h-32 w-full bg-[#F3F4F6] animate-pulse rounded" />
          </div>
        ) : error || !item ? (
          <div className="flex flex-col items-center gap-4 py-10">
            <p className="text-[14px] text-[#99A1AF]">{error ?? '알림을 불러올 수 없습니다.'}</p>
            <button
              type="button"
              onClick={() => navigate('/notifications')}
              className="h-[44px] px-7 rounded-full border border-[#f472b6] text-[15px] font-medium text-[#ec4899]"
            >
              목록으로
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              {c && (
                <span
                  className="inline-flex items-center gap-1 h-[22px] px-2 rounded-full text-[12px] leading-none font-medium"
                  style={{ background: c.bg, color: c.color }}
                >
                  <span>{c.icon}</span>
                  {c.label}
                </span>
              )}
            </div>
            <h2 className="mt-2 text-[18px] leading-[140%] font-bold text-[#030712]">{item.title}</h2>
            <p className="mt-1 text-[13px] leading-[140%] text-[#99A1AF]">{formatDateTime(item.created_at)}</p>

            <div className="mt-4 border-t border-[#F3F4F6] pt-4">
              {/^\s*</.test(item.content) ? (
                <div
                  className="text-[15px] leading-[160%] text-[#364153] notice-html"
                  dangerouslySetInnerHTML={{ __html: item.content }}
                />
              ) : (
                <p className="text-[15px] leading-[160%] text-[#364153] whitespace-pre-line">
                  {item.content || '본문이 없습니다.'}
                </p>
              )}
            </div>

            {hasLink && (
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={goLink}
                  className="h-[48px] px-8 rounded-full bg-[#ec4899] text-[15px] font-semibold text-white active:scale-[.99] transition"
                >
                  바로가기
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso || ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}.${m}.${day} ${hh}:${mm}`
}
