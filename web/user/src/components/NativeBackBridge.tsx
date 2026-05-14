import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ConfirmModal from './ConfirmModal'
import { popTopDismiss } from '../lib/use-dismiss-on-back'

/**
 * Native (RN WebView) → web bridge for the hardware back button.
 *
 * Handshake:
 *  - native posts BACK_PRESSED via the injected SajumoonBridge handler slot
 *  - this component decides per-route what to do
 *  - returns true → web handled (e.g. SPA navigate, open/close modal)
 *  - returns false → native runs default (history.back, then exit dialog)
 *
 * Routes covered here:
 *  - /login, /signup/*, /find/*  → navigate to home (replace, no history)
 *  - /                          → open custom exit-confirm modal
 *  - else                       → delegate to native (history.back)
 */

type BackInfo = { url: string; path: string }
type BackHandler = (info: BackInfo) => boolean

export default function NativeBackBridge() {
  const navigate = useNavigate()
  const [exitOpen, setExitOpen] = useState(false)
  // Mirrored ref so the back handler closure always sees the latest value
  // without us having to re-register on every state change.
  const exitOpenRef = useRef(false)
  exitOpenRef.current = exitOpen

  useEffect(() => {
    const bridge = window.SajumoonBridge
    if (!bridge?.isNative || typeof bridge.onBackPressed !== 'function') return

    const handler: BackHandler = ({ path }) => {
      // 열려있는 모달/드롭다운이 있으면 가장 위 것만 닫고 흡수.
      // useDismissOnBack 으로 등록된 컴포넌트들이 스택에 push 되어 있다.
      if (popTopDismiss()) return true

      // 종료 모달이 열려있으면 → 모달만 닫고 흡수
      if (exitOpenRef.current) {
        setExitOpen(false)
        return true
      }

      // 인증 진입 화면에서 뒤로가기 → 홈 (history 비움)
      if (
        path === '/login' ||
        path.startsWith('/signup') ||
        path.startsWith('/find')
      ) {
        navigate('/', { replace: true })
        return true
      }

      // 홈에서 뒤로가기 → 종료 모달 띄우고 흡수
      if (path === '/') {
        setExitOpen(true)
        return true
      }

      // 충전 페이지에서 뒤로가기 → 홈 (history 비움)
      // PG 결제 페이지가 history 에 남아있어 native back 으로 돌아가면
      // 사용자가 충전 모달이 떠있는 페이지에 갇히는 사고 방지.
      if (path.startsWith('/mypage/charge') || path.startsWith('/charge')) {
        navigate('/', { replace: true })
        return true
      }

      // 그 외 → 네이티브 history.back 위임
      return false
    }

    bridge.onBackPressed(handler)
    return () => {
      bridge.onBackPressed?.(null)
    }
  }, [navigate])

  return (
    <ConfirmModal
      open={exitOpen}
      message="앱을 종료하시겠어요?"
      actionLabel="종료"
      cancelLabel="취소"
      tone="danger"
      onCancel={() => setExitOpen(false)}
      onConfirm={() => {
        setExitOpen(false)
        window.SajumoonBridge?.closeApp?.()
      }}
    />
  )
}
