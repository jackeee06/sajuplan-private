import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ConfirmModal from '../components/ConfirmModal'

/**
 * 비로그인 상태에서 인증 필요한 액션(좋아요/상담시작 등)을 시도했을 때 노출하는
 * 통합 로그인 안내 ConfirmModal.
 *
 * 사용:
 *   const { showLoginPrompt } = useLoginPrompt()
 *   showLoginPrompt()  // → "로그인이 필요한 기능입니다. 로그인 페이지로 이동할까요?"
 *
 * 확인 누르면 /login 으로 이동하며 state.from 에 현재 경로 보존.
 */

interface LoginPromptContextValue {
  showLoginPrompt: () => void
}

const LoginPromptContext = createContext<LoginPromptContextValue | null>(null)

export function LoginPromptProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  const showLoginPrompt = useCallback(() => setOpen(true), [])
  const value = useMemo(() => ({ showLoginPrompt }), [showLoginPrompt])

  return (
    <LoginPromptContext.Provider value={value}>
      {children}
      <ConfirmModal
        open={open}
        message="로그인이 필요한 기능입니다."
        subMessage="로그인 페이지로 이동할까요?"
        actionLabel="로그인"
        cancelLabel="취소"
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false)
          navigate('/login', { replace: true, state: { from: location.pathname } })
        }}
      />
    </LoginPromptContext.Provider>
  )
}

export function useLoginPrompt(): LoginPromptContextValue {
  const ctx = useContext(LoginPromptContext)
  if (!ctx) throw new Error('useLoginPrompt must be used inside <LoginPromptProvider>')
  return ctx
}
