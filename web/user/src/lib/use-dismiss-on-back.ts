import { useEffect } from 'react'

/**
 * 안드로이드 하드웨어 백키 / Esc 로 "가장 최근 열린 닫을 거리"를 닫는 전역 스택.
 *
 * NativeBackBridge 가 백키를 받았을 때 popTopDismiss() 를 먼저 호출해서
 * 모달이 열려있으면 그 모달만 닫고 라우팅/종료 분기로 가지 않게 한다.
 *
 * 모달/드롭다운/시트 등 "열려있을 때 백키로 닫혀야 하는" 컴포넌트는
 * useDismissOnBack(open, onClose) 한 줄 추가만 하면 자동으로 스택에 합류한다.
 *
 * 스택이므로 모달 위에 모달이 떠 있을 때도 가장 위 것부터 차례로 닫힌다.
 */

type DismissFn = () => void

const stack: DismissFn[] = []

export function popTopDismiss(): boolean {
  const fn = stack.pop()
  if (!fn) return false
  try {
    fn()
  } catch {
    // 닫기 콜백 자체에서 터지면 무시 — 백키 흡수는 했으므로 true 반환.
  }
  return true
}

export function hasDismissable(): boolean {
  return stack.length > 0
}

export function useDismissOnBack(open: boolean, onDismiss: () => void): void {
  useEffect(() => {
    if (!open) return
    const fn = () => onDismiss()
    stack.push(fn)
    return () => {
      const idx = stack.lastIndexOf(fn)
      if (idx >= 0) stack.splice(idx, 1)
    }
  }, [open, onDismiss])
}
