import { useCallback, useState } from 'react'
import AlertModal from '../components/AlertModal'

/**
 * useAlert — Promise 기반 인앱 알림 다이얼로그.
 *
 * 배경: 이 앱 WebView 는 네이티브 다이얼로그를 끈 구조(mobile/App.tsx — "no native dialogs").
 * 따라서 `window.alert()` / `alert()` 는 앱에서 아무것도 안 뜬다 → 사용자 안내가 사라진다.
 * 모든 안내는 인앱 AlertModal 로 처리해야 한다.
 *
 * 사용:
 *   const { showAlert, alertUI } = useAlert()
 *   ...
 *   showAlert('저장 실패: ...')                    // fire-and-forget
 *   await showAlert({ message: '...', title: '안내' })  // 닫힐 때까지 대기 가능
 *   ...
 *   return (<>...{alertUI}</>)   // 다른 오버레이의 onClick 바깥(형제)에 렌더
 */
export interface AlertOptions {
  message: string
  title?: string
  confirmLabel?: string
}

type Pending = AlertOptions & { resolve: () => void }

export function useAlert() {
  const [pending, setPending] = useState<Pending | null>(null)

  const showAlert = useCallback((m: AlertOptions | string): Promise<void> => {
    const o = typeof m === 'string' ? { message: m } : m
    return new Promise<void>((resolve) => {
      setPending({ ...o, resolve })
    })
  }, [])

  const close = useCallback(() => {
    setPending((p) => {
      // resolve 는 멱등 — StrictMode 이중호출에도 안전
      if (p) p.resolve()
      return null
    })
  }, [])

  const alertUI = pending ? (
    <AlertModal
      open
      message={pending.message}
      title={pending.title}
      confirmLabel={pending.confirmLabel}
      onClose={close}
    />
  ) : null

  return { showAlert, alertUI }
}
