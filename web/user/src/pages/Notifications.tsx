import { useEffect, useState } from 'react'
import MobileHeader from '../components/MobileHeader'
import { ApiError, notificationsApi, type PublicNotificationItem } from '../lib/api'
import { API_BASE } from '../lib/runtime-env'

/**
 * 알림 내역 — Figma node 163:23156 (있음), 163:27007 (비어있음)
 * URL: /notifications
 *
 * 노출 규칙 (백엔드 위임):
 *  - 로그인 일반회원   : 본인 개별 + 전체공지/일반회원 브로드캐스트
 *  - 로그인 상담사     : 본인 개별 + 전체공지/상담사 브로드캐스트
 *  - 비로그인          : 전체공지 브로드캐스트만
 *  - 최근 6개월 한정, 최신순
 */
export default function Notifications() {
  const [items, setItems] = useState<PublicNotificationItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)

  useEffect(() => {
    notificationsApi
      .list()
      .then((res) => {
        setItems(res.items)
        // 로그인 여부는 markRead/All 가능 여부에서 추론 — 빈 응답일 땐 추론 불가하니 별도 me() 호출
        // 단순화를 위해, 알림이 read 상태로 1건이라도 있으면 로그인된 상태로 간주.
        // 정확도 위해 me 도 시도해보지만 401 은 무시.
      })
      .catch((e: unknown) => {
        const msg = e instanceof ApiError ? e.message : '알림을 불러오지 못했습니다.'
        setError(msg)
      })

    // 로그인 여부 확인 (모두 읽음 버튼 노출용)
    fetch(`${API_BASE}/user/auth/me`, {
      credentials: 'include',
    })
      .then((r) => setLoggedIn(r.ok))
      .catch(() => setLoggedIn(false))
  }, [])

  const onReadAll = async () => {
    if (!items || items.length === 0) return
    try {
      await notificationsApi.readAll()
      setItems((prev) => (prev ? prev.map((n) => ({ ...n, read: true })) : prev))
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : '처리에 실패했습니다.'
      alert(msg)
    }
  }

  const onItemClick = async (n: PublicNotificationItem) => {
    if (!n.read && loggedIn) {
      // 백엔드에 비동기 기록 (실패해도 UX 막지 않음)
      notificationsApi.read(n.id).catch(() => {})
      setItems((prev) => (prev ? prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)) : prev))
    }
    if (n.link_url) {
      // 외부 링크면 새 창, 내부면 현재 창
      if (/^https?:\/\//i.test(n.link_url)) window.open(n.link_url, '_blank')
      else window.location.href = n.link_url
    }
  }

  return (
    <div className="mobile-frame flex flex-col">
      <MobileHeader title="알림 내역" />

      <div className="px-4 py-3 flex items-center justify-between border-b border-[#f3f4f6] bg-[#f9fafb]">
        <p className="text-[12px] text-[#4a5565] leading-relaxed">
          최근 6개월 동안의 알림을 확인하실 수 있습니다.
        </p>
        {loggedIn && items && items.length > 0 && (
          <button
            type="button"
            onClick={onReadAll}
            className="h-8 px-3 rounded-full border border-[#d1d5db] text-[12px] font-medium text-[#374151] hover:bg-white transition shrink-0 ml-2"
          >
            모두 읽음
          </button>
        )}
      </div>

      <main className="flex-1 overflow-y-auto">
        {error ? (
          <div className="pt-20 text-center text-[14px] text-[#ef4444]">{error}</div>
        ) : items === null ? (
          <div className="pt-20 text-center text-[14px] text-[#99A1AF]">불러오는 중…</div>
        ) : items.length === 0 ? (
          <EmptyState />
        ) : (
          <ul>
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => onItemClick(n)}
                  className={`w-full px-4 py-4 text-left transition ${
                    n.read ? 'bg-white' : 'bg-[#f1ecfe]'
                  }`}
                >
                  <p className={`text-[15px] font-bold ${n.read ? 'text-[#99A1AF]' : 'text-[#1E2939]'}`}>
                    {n.title}
                  </p>
                  {n.content && (
                    <p className={`text-[13px] mt-1 ${n.read ? 'text-[#99A1AF]' : 'text-[#4a5565]'}`}>
                      {n.content}
                    </p>
                  )}
                  <p className={`text-[12px] mt-2 ${n.read ? 'text-[#c9cdd3]' : 'text-[#6A7282]'}`}>
                    {fmtDate(n.created_at)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}

function fmtDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}.${m}.${day}`
}

function EmptyState() {
  return (
    <div className="pt-20 flex flex-col items-center text-center px-4">
      <img src="/img/nodata_notification.png" alt="" className="w-20 h-20 mb-4 opacity-90" />
      <p className="text-[15px] text-[#4a5565]">수신된 알림이 없습니다.</p>
    </div>
  )
}
