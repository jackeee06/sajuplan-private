import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'
import { consultApi } from '../lib/api'

/**
 * [2026-05-23] 상담사 글로벌 채팅 요청 감지 + 모달 알림.
 *
 * 동작:
 *   - 상담사 토큰 로그인 시에만 활성화
 *   - 5초 polling — GET /api/user/consult/incoming
 *   - STAY 방 1건 이상 있으면 큰 모달 표시 ("X님이 채팅상담을 신청했습니다")
 *   - "지금 응답" 클릭 → /chat/{chat_room_id} 이동
 *   - "나중에" 클릭 → 모달 닫음 (5초 후 다시 polling, 같은 방이면 또 뜸)
 *   - 이미 /chat/* 경로면 모달 표시 안 함 (이미 응답 중)
 *
 * 한계:
 *   - 사주플랜 앱을 완전 닫으면 작동 안 함 (BizM 알림톡이 백업)
 *   - 모바일 브라우저 백그라운드 polling 은 OS 정책에 따라 제한 가능
 */
export default function CounselorIncomingChatWatcher() {
  const { member } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [pending, setPending] = useState<{
    chat_room_id: number
    member_nickname: string | null
    member_name: string | null
    waited_seconds: number
  } | null>(null)
  const dismissedRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    if (!member || member.role !== 'counselor') return
    let cancelled = false

    const tick = async () => {
      // 이미 채팅방 화면이면 polling 결과 무시 (응답 중)
      if (location.pathname.startsWith('/chat/')) return
      try {
        const res = await consultApi.incoming()
        if (cancelled) return
        // dismiss 된 방은 제외, 가장 오래된 것 우선
        const fresh = res.items.find((it) => !dismissedRef.current.has(it.chat_room_id))
        if (fresh) {
          setPending({
            chat_room_id: fresh.chat_room_id,
            member_nickname: fresh.member_nickname,
            member_name: fresh.member_name,
            waited_seconds: fresh.waited_seconds,
          })
        } else {
          setPending(null)
        }
      } catch { /* 네트워크 실패 시 다음 polling 에서 재시도 */ }
    }

    void tick()  // 초기 1회 즉시
    const pollId = window.setInterval(tick, 5_000)
    return () => { cancelled = true; window.clearInterval(pollId) }
  }, [member, location.pathname])

  if (!pending) return null
  if (!member || member.role !== 'counselor') return null

  const displayName = (pending.member_nickname || pending.member_name || '회원').trim()
  // 남은 시간 (3분 - 대기 시간)
  const remainSec = Math.max(0, 180 - pending.waited_seconds)
  const remainText = remainSec >= 60
    ? `약 ${Math.ceil(remainSec / 60)}분`
    : `${remainSec}초`

  const onAnswer = () => {
    const id = pending.chat_room_id
    setPending(null)
    navigate(`/chat/${id}`)
  }
  const onDismiss = () => {
    dismissedRef.current.add(pending.chat_room_id)
    setPending(null)
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center px-6">
      <div
        className="w-full max-w-[400px] bg-white rounded-[20px] p-6 shadow-xl"
        style={{ animation: 'pulse 1.5s ease-in-out infinite' }}
      >
        <div className="flex items-center justify-center mb-3">
          <div className="w-14 h-14 rounded-full bg-[#fdf2f8] flex items-center justify-center">
            <span className="text-[26px]">💬</span>
          </div>
        </div>
        <h2 className="text-[18px] font-bold text-center text-[#030712] mb-1">
          채팅 상담 요청
        </h2>
        <p className="text-[15px] text-center text-[#1E2939] mb-3">
          <span className="font-semibold text-[#ec4899]">{displayName}</span> 님이 채팅상담을 신청했습니다
        </p>
        <p className="text-[12.5px] text-center text-[#6A7282] leading-[160%] mb-5">
          남은 응답 시간 <span className="font-semibold text-[#FB2C36]">{remainText}</span><br />
          <span className="text-[11.5px] text-[#9CA3AF]">
            3분 미응답 시 자동 취소됩니다
          </span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onDismiss}
            className="h-12 rounded-full border border-[#E5E7EB] text-[14px] font-medium text-[#4A5565]"
          >
            나중에
          </button>
          <button
            type="button"
            onClick={onAnswer}
            className="h-12 rounded-full bg-[#f472b6] text-[14px] font-semibold text-white"
          >
            지금 응답
          </button>
        </div>
      </div>
    </div>
  )
}
