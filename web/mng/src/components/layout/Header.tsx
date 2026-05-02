import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { ChevronDown, LayoutDashboard, LogOut, Moon, Sun } from 'lucide-react'
import { useDarkMode } from '../../hooks/useDarkMode'
import { useAuth } from '../../lib/auth'

export default function Header() {
  const { isDark, toggle } = useDarkMode()
  const { admin, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false)
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
      <div className="flex grow items-center justify-between px-4 py-4">
        <div className="flex items-center gap-4" />

        <div className="flex items-center gap-3 lg:gap-4">
          <button
            onClick={toggle}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            aria-label="dark mode toggle"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <div className="relative" ref={ref}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <span className="text-sm font-medium hidden md:block">
                {admin?.mb_id ?? '사주문 Admin'}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200 hidden md:block ${menuOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-4 w-[240px] rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 shadow-lg z-[9999]">
                <div className="px-1 pb-3 border-b border-gray-100 dark:border-gray-700 mb-3">
                  <span className="block text-sm font-medium text-gray-800 dark:text-white">
                    {admin?.mb_id ?? '사주문 Admin'}
                  </span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    role: {admin?.role ?? '-'} / level: {admin?.level ?? '-'}
                  </span>
                </div>
                <ul className="flex flex-col gap-1 border-b border-gray-100 dark:border-gray-700 pb-3 mb-3">
                  <li>
                    <NavLink
                      to="/dashboard"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                      <LayoutDashboard className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                      대시보드
                    </NavLink>
                  </li>
                </ul>
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
      </div>
    </header>
  )
}
