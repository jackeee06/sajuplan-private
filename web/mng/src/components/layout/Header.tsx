import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, LogOut, Moon, Sun } from 'lucide-react'
import { useDarkMode } from '../../hooks/useDarkMode'
import { useAuth } from '../../lib/auth'
import {
  clearPhonePeek,
  formatRemaining,
  getPhonePeekMinutes,
  isPhonePeekOn,
  phonePeekRemainingMs,
  PEEK_DURATIONS,
  setPhonePeek,
} from '../../lib/phonePeek'

// [PII 보호] 라디오 옵션 — 0(끄기) + phonePeek 의 시간 옵션.
const PEEK_OPTIONS: Array<{ minutes: number; label: string }> = [
  { minutes: 0, label: '끄기' },
  ...PEEK_DURATIONS.map((d) => ({ minutes: d.minutes, label: d.label })),
]

export default function Header() {
  const { isDark, toggle } = useDarkMode()
  const { admin, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [selectedMinutes, setSelectedMinutes] = useState<number>(getPhonePeekMinutes())
  const [remainingMs, setRemainingMs] = useState<number>(phonePeekRemainingMs())
  const userMenuRef = useRef<HTMLDivElement>(null)

  // [PII 보호] 1초마다 만료 체크 + 카운트다운 갱신.
  //   만료 도달 시 자동 페이지 새로고침 → 평문→마스킹 자연 전환.
  useEffect(() => {
    if (selectedMinutes <= 0) return
    const tick = () => {
      if (!isPhonePeekOn()) {
        setSelectedMinutes(0)
        setRemainingMs(0)
        window.location.reload()
        return
      }
      setRemainingMs(phonePeekRemainingMs())
    }
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [selectedMinutes])

  const handlePeekSelect = (minutes: number) => {
    if (minutes <= 0) {
      clearPhonePeek()
    } else {
      setPhonePeek(minutes)
    }
    window.location.reload()
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const handleLogout = async () => {
    setMenuOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="sticky top-0 z-[10000] flex w-full border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-colors duration-200">
      <div className="flex grow items-center gap-6 px-4 py-4">
        {admin?.is_super && (
          <div
            className="flex items-center gap-3 rounded-md border-l-[4px] border-rose-300 bg-rose-50/40 dark:bg-rose-900/10 px-3 py-1.5"
            title="🔒 슈퍼관리자만 볼 수 있는 영역 — 일반관리자에게는 이 토글이 보이지 않습니다"
          >
            <span className="text-sm font-medium text-rose-800 dark:text-rose-200 inline-flex items-center gap-1">
              🔒 <span>하위 관리자 화면 회원 전화번호 공개:</span>
            </span>
            <div className="flex items-center gap-3">
              {PEEK_OPTIONS.map((opt) => (
                <label
                  key={opt.minutes}
                  className="flex items-center gap-1.5 cursor-pointer text-sm"
                >
                  <input
                    type="radio"
                    name="phone-peek"
                    checked={selectedMinutes === opt.minutes}
                    onChange={() => handlePeekSelect(opt.minutes)}
                    className="w-4 h-4 accent-pink-500 cursor-pointer"
                  />
                  <span
                    className={
                      selectedMinutes === opt.minutes
                        ? 'text-pink-600 font-medium'
                        : 'text-gray-600 dark:text-gray-300'
                    }
                  >
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
            {selectedMinutes > 0 && remainingMs > 0 && (
              <span className="text-xs text-pink-600 tabular-nums">
                {formatRemaining(remainingMs)} 남음
              </span>
            )}
          </div>
        )}

        <button
          onClick={toggle}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          aria-label="dark mode toggle"
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <span className="text-sm font-medium hidden md:block">
              {admin?.mb_id ?? '사주플랜 Admin'}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200 hidden md:block ${menuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {menuOpen && (
            <div className="absolute left-0 mt-4 w-[240px] rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 shadow-lg z-[9999]">
              <div className="px-1 pb-3 border-b border-gray-100 dark:border-gray-700 mb-3">
                <span className="block text-sm font-medium text-gray-800 dark:text-white">
                  {admin?.mb_id ?? '사주플랜 Admin'}
                </span>
                <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  role: {admin?.role ?? '-'} / level: {admin?.level ?? '-'}
                  {admin?.is_super && <span className="ml-1 text-pink-600 font-medium">· super</span>}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <LogOut className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                로그아웃
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
