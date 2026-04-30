import { useState } from 'react'
import MobileHeader from '../components/MobileHeader'

interface Notification {
  id: number
  title: string
  body: string
  date: string
  read: boolean
}

const MOCK_NOTIFICATIONS: Notification[] = [
  { id: 1, title: '[공지] 홈페이지가 리뉴얼되었습니다.', body: '서브 안내 텍스트가 필요한 경우 사용', date: '2026.04.20', read: false },
  { id: 2, title: '[공지] 홈페이지가 리뉴얼되었습니다.', body: '서브 안내 텍스트가 필요한 경우 사용', date: '2026.04.20', read: false },
  { id: 3, title: '[공지] 홈페이지가 리뉴얼되었습니다.', body: '서브 안내 텍스트가 필요한 경우 사용', date: '2026.04.20', read: false },
  { id: 4, title: '[공지] 홈페이지가 리뉴얼되었습니다.', body: '서브 안내 텍스트가 필요한 경우 사용', date: '2026.04.20', read: true },
  { id: 5, title: '[공지] 홈페이지가 리뉴얼되었습니다.', body: '서브 안내 텍스트가 필요한 경우 사용', date: '2026.04.20', read: false },
  { id: 6, title: '[공지] 홈페이지가 리뉴얼되었습니다.', body: '서브 안내 텍스트가 필요한 경우 사용', date: '2026.04.20', read: true },
]

/**
 * 알림 내역 — Figma node 163:23156 (있음), 163:27007 (비어있음)
 * URL: /notifications
 * 상단: 헤더 + "최근 6개월 동안의 알림을 확인하실 수 있습니다." + 모두 읽음 버튼
 */
export default function Notifications() {
  const [items, setItems] = useState<Notification[]>(MOCK_NOTIFICATIONS)

  const onReadAll = () =>
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))

  const onItemClick = (id: number) =>
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))

  return (
    <div className="mobile-frame flex flex-col">
      <MobileHeader title="알림 내역" />

      <div className="px-4 py-3 flex items-center justify-between border-b border-[#f3f4f6] bg-[#f9fafb]">
        <p className="text-[12px] text-[#4a5565] leading-relaxed">
          최근 6개월 동안의 알림을 확인하실 수 있습니다.
        </p>
        <button
          type="button"
          onClick={onReadAll}
          className="h-8 px-3 rounded-full border border-[#d1d5db] text-[12px] font-medium text-[#374151] hover:bg-white transition shrink-0 ml-2"
        >
          모두 읽음
        </button>
      </div>

      <main className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <ul>
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => onItemClick(n.id)}
                  className={`w-full px-4 py-4 text-left transition ${
                    n.read ? 'bg-white' : 'bg-[#f1ecfe]'
                  }`}
                >
                  <p className={`text-[15px] font-bold ${n.read ? 'text-[#99A1AF]' : 'text-[#1E2939]'}`}>
                    {n.title}
                  </p>
                  <p className={`text-[13px] mt-1 ${n.read ? 'text-[#99A1AF]' : 'text-[#4a5565]'}`}>
                    {n.body}
                  </p>
                  <p className={`text-[12px] mt-2 ${n.read ? 'text-[#c9cdd3]' : 'text-[#6A7282]'}`}>
                    {n.date}
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

function EmptyState() {
  return (
    <div className="pt-20 flex flex-col items-center text-center px-4">
      <img src="/img/nodata_notification.png" alt="" className="w-20 h-20 mb-4 opacity-90" />
      <p className="text-[15px] text-[#4a5565]">수신된 알림이 없습니다.</p>
    </div>
  )
}
