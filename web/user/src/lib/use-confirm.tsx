import { useCallback, useState } from 'react'
import ConfirmModal from '../components/ConfirmModal'

/**
 * useConfirm — Promise 기반 인앱 확인 다이얼로그.
 *
 * 배경: 이 앱의 WebView 는 네이티브 다이얼로그를 끈 구조(mobile/App.tsx — "no native dialogs").
 * 따라서 `window.confirm()` 은 앱에서 창이 안 뜨고 false 를 반환 → 동작이 조용히 막힌다.
 * 모든 확인 절차는 인앱 ConfirmModal 로 처리해야 한다.
 *
 * 사용:
 *   const { confirm, confirmUI } = useConfirm()
 *   ...
 *   if (!(await confirm({ message: '삭제할까요?', actionLabel: '삭제', tone: 'danger' }))) return
 *   ...
 *   return (<>...{confirmUI}</>)   // confirmUI 는 다른 오버레이의 onClick 바깥(형제)에 렌더
 */
export interface ConfirmOptions {
  message: string
  subMessage?: string
  actionLabel?: string
  cancelLabel?: string
  tone?: 'primary' | 'danger'
}

type Pending = ConfirmOptions & { resolve: (v: boolean) => void }

export function useConfirm() {
  const [pending, setPending] = useState<Pending | null>(null)

  const confirm = useCallback((opts: ConfirmOptions | string): Promise<boolean> => {
    const o = typeof opts === 'string' ? { message: opts } : opts
    return new Promise<boolean>((resolve) => {
      setPending({ ...o, resolve })
    })
  }, [])

  const settle = useCallback((result: boolean) => {
    setPending((p) => {
      // resolve 는 멱등 — StrictMode 이중호출에도 안전
      if (p) p.resolve(result)
      return null
    })
  }, [])

  const confirmUI = pending ? (
    <ConfirmModal
      open
      message={pending.message}
      subMessage={pending.subMessage}
      actionLabel={pending.actionLabel ?? '확인'}
      cancelLabel={pending.cancelLabel}
      tone={pending.tone}
      onCancel={() => settle(false)}
      onConfirm={() => settle(true)}
    />
  ) : null

  return { confirm, confirmUI }
}
