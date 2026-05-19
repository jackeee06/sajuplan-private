import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api } from '../lib/api'

interface Message {
  id: number
  chat_room_id: number | null
  sender_id: number | null
  sender_mb_id: string | null
  sender_name: string | null
  message: string | null
  message_type: number
  created_at: string
}

interface Room {
  id: number
  roomid: string | null
  member_id: number | null
  member_mb_id: string | null
  member_name: string | null
  counselor_id: number | null
  counselor_mb_id: string | null
  counselor_name: string | null
  counselor_nickname: string | null
  status: string | null
  started_at: string | null
  ended_at: string | null
}

export default function ChatHistoryDetail() {
  const { id } = useParams<{ id: string }>()
  const [search] = useSearchParams()
  const roomidParam = search.get('roomid') || ''
  const navigate = useNavigate()
  const [room, setRoom] = useState<Room | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const url =
      roomidParam
        ? `/admin/chat-history/rooms/by-roomid/${encodeURIComponent(roomidParam)}`
        : `/admin/chat-history/rooms/${id}`
    setLoading(true); setError(null)
    api<{ room: Room; messages: Message[] }>(url)
      .then((r) => { setRoom(r.room); setMessages(r.messages) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id, roomidParam])

  if (loading) return <div className="p-6 text-sm text-gray-500">로딩...</div>
  if (error) return <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>
  if (!room) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/chat-history')} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-semibold">채팅 상세 #{room.id}</h1>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <Field label="회원">
          {room.member_id ? (
            <Link to={`/members/customers/${room.member_id}`} className="text-brand-600 hover:underline">
              {room.member_name || room.member_mb_id}
            </Link>
          ) : '-'}
        </Field>
        <Field label="상담사">
          {room.counselor_id ? (
            <Link to={`/members/counselors/${room.counselor_id}`} className="text-brand-600 hover:underline">
              {room.counselor_nickname || room.counselor_name || room.counselor_mb_id}
            </Link>
          ) : '-'}
        </Field>
        <Field label="룸 ID"><span className="font-mono text-xs text-gray-500">{room.roomid || '-'}</span></Field>
        <Field label="상태"><span className="text-xs text-gray-500">{room.status || '-'}</span></Field>
        <Field label="시작 시각"><span className="text-xs text-gray-500">{formatDT(room.started_at)}</span></Field>
        <Field label="종료 시각"><span className="text-xs text-gray-500">{formatDT(room.ended_at)}</span></Field>
      </div>

      {/* 채팅 메시지 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 text-sm font-semibold">
          메시지 ({messages.length}건)
        </div>
        <div className="p-5 space-y-3 max-h-[600px] overflow-y-auto">
          {messages.length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-6">메시지가 없습니다.</div>
          ) : messages.map((m) => {
            const isCounselor = m.sender_id === room.counselor_id
            return (
              <div key={m.id} className={`flex ${isCounselor ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] ${isCounselor ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div className="text-[10px] text-gray-400 mb-0.5 px-1">
                    {m.sender_name || m.sender_mb_id || '?'} · {formatDT(m.created_at)}
                  </div>
                  <div className={`px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                    isCounselor
                      ? 'bg-brand-100 text-brand-900 dark:bg-brand-900/30 dark:text-brand-100'
                      : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
                  }`}>
                    {m.message || <span className="text-gray-400 italic">(빈 메시지)</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  )
}

function formatDT(s: string | null): string {
  if (!s) return '-'
  const dt = new Date(s); if (isNaN(dt.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}
