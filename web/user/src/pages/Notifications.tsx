import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MobileHeader from '../components/MobileHeader'
import BottomNav from '../components/BottomNav'
import { ApiError, notificationsApi, type PublicNotificationItem } from '../lib/api'
import { API_BASE } from '../lib/runtime-env'
import { useAlert } from '../lib/use-alert'
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus'

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
  const navigate = useNavigate()
  const { showAlert, alertUI } = useAlert()
  const [items, setItems] = useState<PublicNotificationItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)

  const load = useCallback(() => {
    notificationsApi
      .list()
      .then((res) => {
        setItems(res.items)
        setError(null)
      })
      .catch((e: unknown) => {
        const msg = e instanceof ApiError ? e.message : '알림을 불러오지 못했습니다.'
        setError(msg)
      })
  }, [])

  useEffect(() => {
    load()

    // 로그인 여부 확인 (모두 읽음 버튼 노출용)
    fetch(`${API_BASE}/user/auth/me`, {
      credentials: 'include',
    })
      .then((r) => setLoggedIn(r.ok))
      .catch(() => setLoggedIn(false))
  }, [load])

  // 알림함을 열어둔 채 새 알림이 와도, 화면 복귀 시 자동으로 목록 갱신.
  useRefreshOnFocus(load)

  const onReadAll = async () => {
    if (!items || items.length === 0) return
    try {
      await notificationsApi.readAll()
      setItems((prev) => (prev ? prev.map((n) => ({ ...n, read: true })) : prev))
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : '처리에 실패했습니다.'
      void showAlert(msg)
    }
  }

  const onItemClick = async (n: PublicNotificationItem) => {
    if (!n.read && loggedIn) {
      // 백엔드에 비동기 기록 (실패해도 UX 막지 않음)
      notificationsApi.read(n.id).catch(() => {})
      setItems((prev) => (prev ? prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)) : prev))
    }
    // 링크로 바로 튀지 않고, 우선 알림 상세에서 제목·본문을 보여준다.
    // 상세에서 link_url 이 있으면 [바로가기] 버튼으로 이동. 목록 데이터를 state 로 넘겨
    // 상세에서 재조회 없이 즉시 표시 (단건 조회 API 없음).
    navigate(`/notifications/${n.id}`, { state: { notification: { ...n, read: true } } })
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

      <main className="flex-1 overflow-y-auto bg-[#f6f7f9]">
        {error ? (
          <div className="pt-20 text-center text-[14px] text-[#ef4444]">{error}</div>
        ) : items === null ? (
          <div className="pt-20 text-center text-[14px] text-[#99A1AF]">불러오는 중…</div>
        ) : items.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="px-3 py-3 space-y-2.5">
            {items.map((n) => {
              const c = metaFor(n)
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => onItemClick(n)}
                    className={`w-full flex gap-3 rounded-2xl p-3.5 text-left bg-white shadow-[0_2px_10px_rgba(17,24,39,.05)] transition active:scale-[.99] ${
                      n.read ? 'opacity-60' : ''
                    }`}
                  >
                    <span
                      className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-[18px]"
                      style={{ background: c.bg }}
                    >
                      {c.icon}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-semibold" style={{ color: c.color }}>{c.label}</span>
                        {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />}
                        {n.via_push && <ChannelBadge label="푸시" />}
                        {n.via_alimtalk && <ChannelBadge label="카톡" />}
                      </span>
                      <span className={`block text-[15px] mt-0.5 ${n.read ? 'font-semibold text-[#374151]' : 'font-bold text-[#111827]'}`}>
                        {n.title}
                      </span>
                      {n.content && (
                        <span
                          className={`block text-[13px] mt-0.5 leading-snug ${n.read ? 'text-[#9ca3af]' : 'text-[#6b7280]'}`}
                          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                        >
                          {n.content}
                        </span>
                      )}
                      <span className={`block text-[11.5px] mt-1.5 ${n.read ? 'text-[#c0c4cb]' : 'text-[#9ca3af]'}`}>
                        {fmtDate(n.created_at)}{n.read ? ' · 읽음' : ''}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </main>
      <BottomNav />
      {alertUI}
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

interface NotiMeta { label: string; icon: string; color: string; bg: string }

/** 카테고리별 아이콘·컬러 (브로드캐스트 — 전체공지/상담사/일반회원) */
export function catMeta(category: string | null): NotiMeta {
  switch (category) {
    case '전체공지': return { label: '전체공지', icon: '📢', color: '#8259F5', bg: '#efeafe' }
    case '상담사':   return { label: '상담사', icon: '👤', color: '#00BBA7', bg: '#e3f7f4' }
    case '일반회원': return { label: '회원', icon: '👥', color: '#3B82F6', bg: '#e8f1fe' }
    case '개별':     return { label: '알림', icon: '🔔', color: '#ec4899', bg: '#fdeef6' }
    default:         return { label: category || '알림', icon: '🔔', color: '#8259F5', bg: '#efeafe' }
  }
}

/** 이벤트 코드별 아이콘·컬러 (개별 알림 — 채팅요청/후기/등급 등) */
export function codeMeta(code: string | null): NotiMeta | null {
  switch (code) {
    case 'chat_request':  return { label: '채팅 상담요청', icon: '💬', color: '#ec4899', bg: '#fdeef6' }
    case 'call_request':  return { label: '전화 상담요청', icon: '📞', color: '#ec4899', bg: '#fdeef6' }
    case 'qna_ask':       return { label: '새 문의', icon: '❓', color: '#3B82F6', bg: '#e8f1fe' }
    case 'qna_answer':    return { label: '문의 답변', icon: '💡', color: '#3B82F6', bg: '#e8f1fe' }
    case 'qna_reported':  return { label: '문의 신고', icon: '🚨', color: '#ef4444', bg: '#fdeaea' }
    case 'review':        return { label: '새 후기', icon: '⭐', color: '#f59e0b', bg: '#fef3e2' }
    case 'grade':         return { label: '등급 승급', icon: '🎉', color: '#8259F5', bg: '#efeafe' }
    case 'absent':        return { label: '상담 부재 안내', icon: '🌙', color: '#6b7280', bg: '#f1f3f5' }
    case 'chat_cancelled':return { label: '채팅 자동취소', icon: '⏱️', color: '#6b7280', bg: '#f1f3f5' }
    case 'settlement':    return { label: '정산 완료', icon: '💰', color: '#00BBA7', bg: '#e3f7f4' }
    case 'payout':        return { label: '선지급', icon: '💸', color: '#00BBA7', bg: '#e3f7f4' }
    case 'coupon':        return { label: '쿠폰 발급', icon: '🎁', color: '#ec4899', bg: '#fdeef6' }
    default:              return null
  }
}

/** code 우선, 없으면 category 기준 메타 */
function metaFor(n: PublicNotificationItem): NotiMeta {
  return codeMeta(n.code) ?? catMeta(n.category)
}

/** 채널 뱃지 (📲푸시 / 💬카톡) — 어떤 경로로도 왔는지 한눈에 */
function ChannelBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-1.5 h-[15px] rounded-full bg-[#f3f4f6] text-[10px] font-medium text-[#6b7280] leading-none">
      {label}
    </span>
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
