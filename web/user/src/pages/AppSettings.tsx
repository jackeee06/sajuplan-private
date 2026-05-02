import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MOCK_MEMBER } from '../data/memberProfile'

/**
 * 앱 설정 — Figma 07마이페이지(회원) > 앱 설정 (128:18723)
 *
 * Figma 시안에는 푸시알림 설정 토글 1개만 존재.
 * (시안 외 약관/이용약관 등 임의 추가 금지 — CLAUDE.md 디자인 충실도 규칙)
 */

export default function AppSettings() {
  const navigate = useNavigate()
  const [pushEnabled, setPushEnabled] = useState(MOCK_MEMBER.pushEnabled)

  return (
    <div className="mobile-frame flex flex-col">
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
          앱 설정
        </h1>
      </header>

      <main className="flex-1 px-4 pt-4">
        <div className="flex items-center justify-between h-12">
          <span className="text-[16px] leading-[140%] font-medium text-[#030712]">
            푸시알림 설정
          </span>
          <PushToggle on={pushEnabled} onToggle={() => setPushEnabled((v) => !v)} />
        </div>
      </main>
    </div>
  )
}

function PushToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="relative w-[52px] h-[30px] rounded-full transition-colors"
      style={{ background: on ? '#9B7AF7' : '#E5E7EB' }}
    >
      <span
        className="absolute top-[3px] w-6 h-6 rounded-full bg-white flex items-center justify-center transition-all shadow-sm"
        style={{ left: on ? '25px' : '3px' }}
      >
        {on && (
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" aria-hidden>
            <path
              d="M6 12.5L10 16L18 8"
              stroke="#030712"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    </button>
  )
}
