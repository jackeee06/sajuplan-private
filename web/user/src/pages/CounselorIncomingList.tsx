import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import { useAuth } from '../lib/auth-context'
import { consultApi } from '../lib/api'

type IncomingItem = {
  chat_room_id: number
  member_id: number
  member_nickname: string | null
  member_name: string | null
  started_at: string
  waited_seconds: number
}

/**
 * [2026-05-30] 상담사 incoming 채팅 요청 리스트.
 * _PREPAID_CHAT_POLICY.md §15 참조.
 *
 * URL: /counselor/mypage/incoming
 *
 * 동작:
 *  - 5초 polling — GET /api/user/consult/incoming
 *  - 대기 오래된 순 정렬 (먼저 신청한 회원 보호)
 *  - 각 row 클릭 → /chat/:chat_room_id 진입
 *  - 만료 임박 (30초 미만) 시 빨강 표시
 *  - 상담사 토큰만 진입 허용 — 그 외 404 또는 회원 모드 안내
 */
export default function CounselorIncomingList() {
  const { member } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<IncomingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 5초 polling
  useEffect(() => {
    if (!member || member.role !== 'counselor') return
    let cancelled = false

    const tick = async () => {
      try {
        const res = await consultApi.incoming()
        if (cancelled) return
        // 대기 오래된 순 (먼저 신청 = 우선)
        const sorted = [...res.items].sort((a, b) => b.waited_seconds - a.waited_seconds)
        setItems(sorted)
        setError(null)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : '채팅 요청을 불러오지 못했습니다.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void tick()
    const pollId = window.setInterval(tick, 5_000)
    return () => {
      cancelled = true
      window.clearInterval(pollId)
    }
  }, [member])

  const onRowClick = (id: number) => {
    navigate(`/chat/${id}`)
  }

  return (
    <div className="mobile-frame flex flex-col pb-[100px] bg-white min-h-screen">
      {/* 헤더 */}
      <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-white border-b border-[#F3F4F6]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로"
          className="w-[30px] h-[30px] flex items-center justify-center"
        >
          <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
        </button>
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">
          새 채팅 요청
        </h1>
        {items.length > 0 && (
          <span className="text-[14px] font-semibold text-[#ec4899]">{items.length}건</span>
        )}
      </header>

      <main className="flex-1">
        {/* 회원 모드면 안내 */}
        {member && member.role !== 'counselor' && (
          <div className="px-4 py-12 text-center text-[14px] text-[#6A7282]">
            상담사 모드에서만 사용 가능합니다.
          </div>
        )}

        {/* 로딩 */}
        {member?.role === 'counselor' && loading && (
          <div className="px-4 py-12 text-center text-[14px] text-[#99A1AF]">
            불러오는 중…
          </div>
        )}

        {/* 에러 */}
        {member?.role === 'counselor' && !loading && error && (
          <div className="px-4 py-12 text-center text-[14px] text-[#FB2C36]">{error}</div>
        )}

        {/* 빈 상태 */}
        {member?.role === 'counselor' && !loading && !error && items.length === 0 && (
          <div className="px-4 py-16 text-center flex flex-col items-center gap-3">
            <div className="text-[40px]">💬</div>
            <p className="text-[14px] text-[#6A7282]">
              현재 대기 중인 채팅 요청이 없습니다.
            </p>
            <p className="text-[12.5px] text-[#99A1AF]">
              새 요청이 오면 자동으로 표시됩니다.
            </p>
          </div>
        )}

        {/* 리스트 */}
        {member?.role === 'counselor' && !loading && !error && items.length > 0 && (
          <ul className="flex flex-col">
            {items.map((it) => {
              const displayName = (it.member_nickname || it.member_name || '회원').trim()
              const remainSec = Math.max(0, 180 - it.waited_seconds)
              const urgent = remainSec <= 30
              const remainText =
                remainSec === 0
                  ? '만료됨'
                  : remainSec >= 60
                    ? `약 ${Math.ceil(remainSec / 60)}분 남음`
                    : `${remainSec}초 남음`
              const waitedText =
                it.waited_seconds < 60
                  ? `${it.waited_seconds}초 전 신청`
                  : `${Math.floor(it.waited_seconds / 60)}분 ${it.waited_seconds % 60}초 전 신청`

              return (
                <li
                  key={it.chat_room_id}
                  className="border-b border-[#F3F4F6] last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() => onRowClick(it.chat_room_id)}
                    className="w-full px-4 py-4 flex items-center gap-3 text-left active:bg-[#FDF2F8] transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#fdf2f8] flex items-center justify-center text-[20px] shrink-0">
                      💬
                    </div>
                    <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-semibold text-[#1E2939] truncate">
                          {displayName}
                        </span>
                        {urgent && (
                          <span className="text-[11px] font-bold text-[#FB2C36] bg-[#FEF2F2] px-1.5 py-[1px] rounded-full leading-none">
                            ⚠️ 곧 만료
                          </span>
                        )}
                      </div>
                      <span className="text-[12.5px] text-[#6A7282]">
                        {waitedText}
                      </span>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span
                        className={`text-[13px] font-medium ${urgent ? 'text-[#FB2C36]' : 'text-[#ec4899]'}`}
                      >
                        {remainText}
                      </span>
                      <svg viewBox="0 0 16 16" className="w-4 h-4 fill-[#99A1AF] mt-1">
                        <path d="M5.7 3.3a1 1 0 0 0 0 1.4L9 8l-3.3 3.3a1 1 0 0 0 1.4 1.4l4-4a1 1 0 0 0 0-1.4l-4-4a1 1 0 0 0-1.4 0z" />
                      </svg>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
