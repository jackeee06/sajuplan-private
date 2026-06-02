import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'
import { consultApi } from '../lib/api'

/**
 * [2026-05-30] 상담사 incoming 채팅 요청 핑크 배너 — 메인 화면 상단 노출.
 * _PREPAID_CHAT_POLICY.md §15 참조.
 *
 * 동작:
 *  - 상담사 토큰일 때만 활성 (회원 모드일 땐 안 보임)
 *  - 5초 polling — GET /api/user/consult/incoming
 *  - N건 > 0 시 핑크 배너 노출
 *  - 클릭 → /counselor/mypage/incoming 리스트 페이지 진입
 *
 * 모달 (`CounselorIncomingChatWatcher`) 과 별개 — 모달은 즉시 알림 / 배너는 영구 진입점.
 */
export default function CounselorIncomingBanner() {
  const { member } = useAuth()
  const navigate = useNavigate()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!member || member.role !== 'counselor') {
      setCount(0)
      return
    }
    let cancelled = false

    const tick = async () => {
      try {
        const res = await consultApi.incoming()
        if (cancelled) return
        setCount(res.items.length)
      } catch {
        /* 일시 실패는 다음 polling 에서 */
      }
    }

    void tick()
    const pollId = window.setInterval(tick, 5_000)
    return () => {
      cancelled = true
      window.clearInterval(pollId)
    }
  }, [member])

  if (!member || member.role !== 'counselor' || count === 0) return null

  return (
    <button
      type="button"
      onClick={() => navigate('/counselor/mypage/incoming')}
      className="mx-4 mt-2 mb-1 h-12 rounded-2xl bg-gradient-to-r from-[#f472b6] to-[#ec4899] text-white flex items-center justify-between px-4 shadow-[0_4px_12px_rgba(236,72,153,0.25)] active:scale-[0.98] transition-transform"
    >
      <div className="flex items-center gap-2">
        <span className="text-[18px] leading-none">💬</span>
        <span className="text-[14px] font-semibold">
          새 채팅 요청 <span className="font-bold">{count}건</span>
        </span>
      </div>
      <div className="flex items-center gap-1 text-[13px] font-medium">
        <span>바로가기</span>
        <svg viewBox="0 0 16 16" className="w-4 h-4 fill-white">
          <path d="M5.7 3.3a1 1 0 0 0 0 1.4L9 8l-3.3 3.3a1 1 0 0 0 1.4 1.4l4-4a1 1 0 0 0 0-1.4l-4-4a1 1 0 0 0-1.4 0z" />
        </svg>
      </div>
    </button>
  )
}
