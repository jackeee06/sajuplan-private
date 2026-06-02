import { FormEvent, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, LogOut, ArrowRight } from 'lucide-react'
import { ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'

interface LocationState {
  from?: string
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { admin, status, login, logout } = useAuth()
  const [showPw, setShowPw] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setError(null)

    const id = username.trim()
    if (!id || !password) {
      setError('아이디와 비밀번호를 입력해주세요.')
      return
    }
    if (password.length < 4) {
      setError('비밀번호는 4자 이상이어야 합니다.')
      return
    }

    setSubmitting(true)
    try {
      await login(id, password)
      const redirect = (location.state as LocationState | null)?.from || '/dashboard'
      navigate(redirect, { replace: true })
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message)
      } else if (e instanceof Error) {
        setError(e.message)
      } else {
        setError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
      }
      setPassword('')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogoutAndRetry = async () => {
    await logout().catch(() => {})
    setUsername('')
    setPassword('')
    setError(null)
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-1/2 bg-brand-600 dark:bg-gray-800 items-center justify-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/40 rounded-full -translate-y-1/3 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-brand-700/40 rounded-full translate-y-1/3 -translate-x-1/3" />
        <div className="relative z-10 flex flex-col items-center text-center px-10 max-w-xs">
          <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-lg p-3">
            <img src="/mng/logo_b.svg" alt="사주플랜" className="w-full h-full object-contain" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">사주플랜 Admin</h2>
          <p className="text-brand-200 text-sm leading-relaxed">
            관리자 전용 페이지입니다. 인가된 사용자만 접근할 수 있습니다.
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center px-6 py-12 lg:px-12 xl:px-16">
        <div className="w-full max-w-md mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
              사주플랜 관리자 로그인
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              관리자 아이디와 비밀번호를 입력해주세요.
            </p>
          </div>

          {status === 'authed' && admin && (
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-900/20 px-4 py-3">
              <div className="text-sm text-blue-800 dark:text-blue-200">
                이미 <strong>{admin.mb_id}</strong>로 로그인되어 있습니다.
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white transition"
                >
                  대시보드로 이동 <ArrowRight className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={handleLogoutAndRetry}
                  className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition"
                >
                  <LogOut className="w-3 h-3" /> 로그아웃 후 재로그인
                </button>
              </div>
            </div>
          )}

          <form className="space-y-3" onSubmit={onSubmit}>
            <div>
              <label className="block mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                아이디 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                autoComplete="username"
                disabled={submitting}
                className="w-full h-11 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent dark:bg-gray-900 px-4 py-2.5 text-sm text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 dark:focus:border-brand-400 transition disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                비밀번호 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  autoComplete="current-password"
                  disabled={submitting}
                  className="w-full h-11 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent dark:bg-gray-900 pl-4 pr-11 py-2.5 text-sm text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 dark:focus:border-brand-400 transition disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand-500 hover:bg-brand-600 px-4 py-3 text-sm font-medium text-white transition shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? '로그인 중...' : '로그인'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
