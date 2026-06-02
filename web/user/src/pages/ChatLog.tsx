import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError, chatApi, type ChatMessage, type ChatRoomDetail } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import UploadedImage from '../components/UploadedImage'

/**
 * 채팅 내역 다시보기 — 읽기 전용.
 * 라우트: /chat-log/:id  (id = consultation.id 또는 chat_room.id 중 어느 쪽이든)
 *
 * ChatRoom.tsx 와 의도적으로 분리: 활성 채팅 흐름(rejoin/tick/wss/leave) 부담을 피하고
 * 메시지 표시만 책임진다. 종료된 상담을 다시 보고 싶을 때만 사용.
 */

type DisplayMessage =
  | { id: string; type: 'mine' | 'other'; text: string; isImage: boolean; isHtml: boolean; time: string; ts: number; senderId: number | null }
  | { id: string; type: 'system'; text: string; ts: number }

function parseMessageContent(raw: string, htmlFlag?: boolean): { text: string; isImage: boolean; isHtml: boolean } {
  if (typeof raw === 'string' && raw.startsWith('[img]')) {
    const path = raw.substring(5).trim()
    const url = /^https?:\/\//.test(path) ? path : `/data/chat/${path}`
    return { text: url, isImage: true, isHtml: false }
  }
  if (htmlFlag) return { text: raw, isImage: false, isHtml: true }
  return { text: raw, isImage: false, isHtml: false }
}

function toDisplay(m: ChatMessage): DisplayMessage {
  const ts = new Date(m.created_at).getTime() || Date.now()
  if (m.message_type === 3) {
    const stripped = (m.message ?? '')
      .replace(/^\[(leave|rejoin|peerin|peerout|peer)-[a-zA-Z]+(?:-\d+)?-\d+\]\s*/, '')
      .replace(/^\[csr-entered-\d+\]\s*/, '')
    return { id: `db-${m.id}`, type: 'system', text: stripped, ts }
  }
  const raw = m.message ?? ''
  const parsed = parseMessageContent(raw, m.message_type === 2)
  return {
    id: `db-${m.id}`,
    type: m.is_mine ? 'mine' : 'other',
    text: parsed.text,
    isImage: parsed.isImage,
    isHtml: parsed.isHtml,
    time: formatTime(m.created_at),
    ts,
    senderId: m.sender_id ?? null,
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return ''
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export default function ChatLog() {
  const { id: idParam = '0' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { member, loading: authLoading } = useAuth()
  const targetId = Number(idParam)

  const [room, setRoom] = useState<ChatRoomDetail | null>(null)
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!member) {
      navigate(`/login?redirect=/chat-log/${targetId}`, { replace: true })
      return
    }
    if (!Number.isFinite(targetId) || targetId <= 0) {
      setError('잘못된 접근입니다.')
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    chatApi
      .getChatLog(targetId)
      .then((res) => {
        if (cancelled) return
        setRoom(res.room)
        setMessages(res.messages.map(toDisplay))
      })
      .catch((e) => {
        if (cancelled) return
        if (e instanceof ApiError) setError(e.message)
        else setError('채팅 내역을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [authLoading, member, targetId, navigate])

  if (authLoading || (!member && !error)) {
    return (
      <div className="mobile-frame flex items-center justify-center h-screen bg-white">
        <p className="text-[14px] text-[#99A1AF]">불러오는 중…</p>
      </div>
    )
  }

  const isMeCounselor = room != null && member?.id != null && room.counselor_id === member.id
  const headerName = isMeCounselor
    ? room?.member_nickname ?? room?.member_name ?? '회원'
    : room?.counselor_nickname ?? room?.counselor_name ?? '상담사'

  return (
    <div className="mobile-frame flex flex-col h-screen bg-[#fdf2f8]">
      <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-white">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로"
          className="w-[30px] h-[30px] flex items-center justify-center"
        >
          <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
        </button>
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712] flex items-center gap-1.5">
          <span>{headerName}</span>
          <span className="text-[14px] font-medium text-[#ec4899]">채팅 내역</span>
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        {loading && (
          <div className="flex justify-center pt-10">
            <span className="text-[13px] text-[#99A1AF]">불러오는 중…</span>
          </div>
        )}
        {error && (
          <div className="flex justify-center pt-10">
            <span className="text-[13px] text-[#FB2C36]">{error}</span>
          </div>
        )}
        {!loading && !error && messages.length === 0 && (
          <div className="flex justify-center pt-10">
            <span className="text-[13px] text-[#99A1AF]">메시지가 없습니다.</span>
          </div>
        )}
        {!loading && messages.map((m) => {
          let withSender: DisplayMessage & { sender?: { name: string; avatar: string } } = m
          if (m.type === 'other') {
            let fromCounselor: boolean
            if (m.senderId != null && room) fromCounselor = m.senderId === room.counselor_id
            else fromCounselor = !isMeCounselor
            const senderName = fromCounselor
              ? (room?.counselor_nickname ?? room?.counselor_name ?? '상담사')
              : (room?.member_nickname ?? room?.member_name ?? '회원')
            const profileImg = fromCounselor
              ? room?.counselor_profile_image
              : room?.member_profile_image
            const avatar = profileImg && profileImg.length > 0 ? profileImg : '/img/avatar_default.svg'
            withSender = { ...m, sender: { name: senderName, avatar } }
          }
          return <MessageItem key={m.id} message={withSender} />
        })}
      </div>
    </div>
  )
}

function MessageItem({ message: m }: { message: DisplayMessage & { sender?: { name: string; avatar: string } } }) {
  if (m.type === 'system') {
    return (
      <div className="flex justify-center">
        <div
          className="px-4 py-1.5 rounded-full text-[14px] leading-[130%] text-[#6A7282]"
          style={{ background: 'rgba(255, 255, 255, 0.6)' }}
        >
          {m.text}
        </div>
      </div>
    )
  }
  if (m.type === 'other') {
    return (
      <div className="flex flex-col gap-1.5">
        {m.sender && (
          <div className="flex items-center gap-2 ml-[4px]">
            <div className="w-10 h-10 rounded-full bg-[#E5E7EB] overflow-hidden shrink-0">
              <ChatAvatar src={m.sender.avatar} alt={m.sender.name} />
            </div>
            <span className="text-[14px] leading-[130%] font-medium text-[#1E2939]">
              {m.sender.name}
            </span>
          </div>
        )}
        <div className="flex items-end gap-2 pl-[52px]">
          <div className="bg-white rounded-[16px] px-4 py-3 max-w-[70%]">
            <MessageBody m={m} mine={false} />
          </div>
          {m.time && (
            <span className="text-[14px] leading-[110%] text-[#99A1AF] mb-1">{m.time}</span>
          )}
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-end justify-end gap-2">
      {m.time && (
        <span className="text-[14px] leading-[110%] text-[#99A1AF] mb-1">{m.time}</span>
      )}
      <div className="bg-[#f472b6] rounded-[16px] px-4 py-3 max-w-[70%]">
        <MessageBody m={m} mine={true} />
      </div>
    </div>
  )
}

function MessageBody({
  m,
  mine,
}: {
  m: { text: string; isImage: boolean; isHtml: boolean }
  mine: boolean
}) {
  const textColor = mine ? 'text-white' : 'text-[#1E2939]'
  if (m.isImage) {
    return (
      <img
        src={m.text}
        alt="이미지"
        className="rounded-[8px] max-w-full max-h-[300px] object-contain"
      />
    )
  }
  if (m.isHtml) {
    return (
      <div
        className={`text-[14px] leading-[140%] ${textColor} whitespace-pre-line break-words`}
        dangerouslySetInnerHTML={{ __html: m.text }}
      />
    )
  }
  return (
    <p className={`text-[14px] leading-[140%] ${textColor} whitespace-pre-line break-words`}>
      {m.text}
    </p>
  )
}

function ChatAvatar({ src, alt }: { src: string | null | undefined; alt: string }) {
  const isDefault = !src || src.startsWith('/img/')
  const [failed, setFailed] = React.useState(false)
  if (isDefault || failed) {
    return <img src="/img/avatar_default.svg" alt={alt} className="w-full h-full object-cover" />
  }
  return (
    <UploadedImage src={src} alt={alt} className="w-full h-full object-cover" onError={() => setFailed(true)} />
  )
}
