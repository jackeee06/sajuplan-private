import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import Toast from '../components/Toast'
import { ApiError, counselorsApi } from './api'
import { useLoginPrompt } from './login-prompt-context'

/**
 * 단골(좋아요) 토글 통합 컨텍스트.
 *  - 어디서든 useLikeAction().toggleLike(counselorId, nextLiked) 호출.
 *  - 401(비로그인) 시 자동으로 로그인 안내 ConfirmModal 노출 → "로그인" 클릭 시 /login 으로 이동(state.from 보존).
 *  - 성공: { is_liked, fan_count } 반환. 실패(인증 외): null 반환 + 콘솔 경고.
 *
 * 호출처 (메인/검색결과/단골/상담사목록/상세) 가 이 한 함수로 통일됨.
 */

interface LikeContextValue {
  toggleLike: (
    counselorId: number | string,
    nextLiked: boolean,
  ) => Promise<{ is_liked: boolean; fan_count: number } | null>
}

const LikeContext = createContext<LikeContextValue | null>(null)

export function LikeProvider({ children }: { children: ReactNode }) {
  const { showLoginPrompt } = useLoginPrompt()
  const [toast, setToast] = useState<string | null>(null)

  const toggleLike = useCallback(
    async (counselorId: number | string, nextLiked: boolean) => {
      try {
        const res = nextLiked
          ? await counselorsApi.addLike(counselorId)
          : await counselorsApi.removeLike(counselorId)
        // 성공 토스트 — 자동 사라짐 (Toast 컴포넌트가 setTimeout)
        setToast(res.is_liked ? '단골에 추가되었습니다.' : '단골에서 해제되었습니다.')
        return { is_liked: res.is_liked, fan_count: res.fan_count }
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          showLoginPrompt()
          return null
        }
        if (e instanceof ApiError) {
          setToast(e.message)
          return null
        }
        // 네트워크/CORS 오류 등 — 사용자가 알 수 있도록 표시
        console.error('[likeContext] toggleLike failed', e)
        setToast('네트워크 오류로 단골 처리에 실패했습니다.')
        return null
      }
    },
    [showLoginPrompt],
  )

  const value = useMemo(() => ({ toggleLike }), [toggleLike])

  return (
    <LikeContext.Provider value={value}>
      {children}
      <Toast open={!!toast} message={toast ?? ''} onClose={() => setToast(null)} />
    </LikeContext.Provider>
  )
}

export function useLikeAction(): LikeContextValue {
  const ctx = useContext(LikeContext)
  if (!ctx) throw new Error('useLikeAction must be used inside <LikeProvider>')
  return ctx
}
