import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import ConsultModal, { type ConsultCounselor, type ConsultModalVariant } from '../components/ConsultModal'
import AppRequiredSheet from '../components/AppRequiredSheet'
import { shouldGateAppAction } from './app-gate'

/**
 * ConsultModal 통합 컨텍스트 — 메인 카드/검색결과/단골/상세 페이지 어디서든
 * 같은 모달을 띄우기 위한 글로벌 상태.
 *
 * 사용:
 *   const { openConsult } = useConsultModal()
 *   <button onClick={() => openConsult(counselor, 'phone')}>전화 상담하기</button>
 *
 * [2026-06-25] 앱 유입 깔때기 — 웹(앱 밖) 에서 상담을 시도하면 ConsultModal 대신
 *   AppRequiredSheet(앱 유도) 를 띄운다. 콘텐츠는 그대로 보이고 "행동"만 앱으로 유도하므로
 *   검색 페널티(클로킹/전면팝업) 없음. 앱 안/자동화(E2E)/수동허용은 정상 통과. → app-gate.ts
 */

interface ConsultContextValue {
  openConsult: (counselor: ConsultCounselor, variant: ConsultModalVariant) => void
  closeConsult: () => void
}

const ConsultContext = createContext<ConsultContextValue | null>(null)

export function ConsultProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [variant, setVariant] = useState<ConsultModalVariant>('phone')
  const [counselor, setCounselor] = useState<ConsultCounselor | null>(null)
  // 앱 유도 시트 — 웹에서 상담 시도 시
  const [appGateOpen, setAppGateOpen] = useState(false)

  const openConsult = useCallback(
    (c: ConsultCounselor, v: ConsultModalVariant) => {
      setCounselor(c)
      setVariant(v)
      // 웹(앱 밖)이면 상담 모달 대신 앱 유도 시트
      if (shouldGateAppAction()) {
        setAppGateOpen(true)
        return
      }
      setOpen(true)
    },
    [],
  )
  const closeConsult = useCallback(() => setOpen(false), [])

  const value = useMemo(() => ({ openConsult, closeConsult }), [openConsult, closeConsult])

  return (
    <ConsultContext.Provider value={value}>
      {children}
      <ConsultModal
        open={open}
        onClose={closeConsult}
        variant={variant}
        counselor={counselor}
      />
      <AppRequiredSheet
        open={appGateOpen}
        onClose={() => setAppGateOpen(false)}
        variant={variant}
        counselorName={counselor?.name ?? null}
        avatarUrl={counselor?.avatarUrl ?? null}
      />
    </ConsultContext.Provider>
  )
}

export function useConsultModal(): ConsultContextValue {
  const ctx = useContext(ConsultContext)
  if (!ctx) {
    throw new Error('useConsultModal must be used inside <ConsultProvider>')
  }
  return ctx
}
