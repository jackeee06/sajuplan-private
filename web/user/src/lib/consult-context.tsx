import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import ConsultModal, { type ConsultCounselor, type ConsultModalVariant } from '../components/ConsultModal'

/**
 * ConsultModal 통합 컨텍스트 — 메인 카드/검색결과/단골/상세 페이지 어디서든
 * 같은 모달을 띄우기 위한 글로벌 상태.
 *
 * 사용:
 *   const { openConsult } = useConsultModal()
 *   <button onClick={() => openConsult(counselor, 'phone')}>전화 상담하기</button>
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

  const openConsult = useCallback(
    (c: ConsultCounselor, v: ConsultModalVariant) => {
      setCounselor(c)
      setVariant(v)
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
