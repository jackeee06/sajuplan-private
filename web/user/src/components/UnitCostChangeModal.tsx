import { useEffect, useState } from 'react'
import { counselorGradeApi, type MyGradeInfo } from '../lib/api'

/**
 * 단가 변경 모달 — 등급별 옵션 라디오 + 더블 컨펌.
 *
 * 안전장치:
 *  - 현재 등급의 정책 옵션만 선택 가능
 *  - 변경 가능 일자 표시
 *  - 확정 단계에서 "N월부터 30초당 N원으로 적용됩니다. 다음 변경은 N월 1일 가능합니다."
 *  - API 실패 시 에러 메시지
 */
export default function UnitCostChangeModal({
  open,
  info,
  onClose,
  onSuccess,
}: {
  open: boolean
  info: MyGradeInfo | null
  onClose: () => void
  onSuccess: () => void
}) {
  const [selected, setSelected] = useState<number | null>(null)
  const [step, setStep] = useState<'select' | 'confirm'>('select')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && info) {
      setSelected(info.current_unit_cost || info.available_options[0] || null)
      setStep('select')
      setError(null)
    }
  }, [open, info])

  if (!open || !info) return null

  const handleConfirm = async () => {
    if (selected == null) return
    setSubmitting(true)
    setError(null)
    try {
      await counselorGradeApi.changeUnitCost(selected)
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : '단가 변경에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="w-full max-w-[600px] bg-white rounded-t-[20px] px-5 pt-6 pb-8 max-h-[85vh] overflow-y-auto">
        {step === 'select' ? (
          <>
            <h2 className="text-[18px] font-bold text-[#030712] leading-[140%]">
              단가 변경
            </h2>
            <p className="mt-1 text-[13px] text-[#6A7282] leading-[140%]">
              현재 등급: <span className="font-semibold text-[#8259F5]">{info.grade_label}</span> · 30초당 단가를 선택하세요.
            </p>

            <div className="mt-4 flex flex-col gap-2">
              {info.available_options.map((cost) => {
                const isCurrent = cost === info.current_unit_cost
                const isSelected = cost === selected
                return (
                  <button
                    key={cost}
                    type="button"
                    onClick={() => setSelected(cost)}
                    className={`h-14 px-4 rounded-[16px] flex items-center justify-between transition-all ${
                      isSelected
                        ? 'bg-[#F3EEFE] border-[1.5px] border-[#9B7AF7]'
                        : 'bg-[#F9FAFB] border-[1.5px] border-[#F3F4F6]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center ${
                          isSelected ? 'border-[#9B7AF7]' : 'border-[#D1D5DB]'
                        }`}
                      >
                        {isSelected && (
                          <span className="w-2.5 h-2.5 rounded-full bg-[#9B7AF7]" />
                        )}
                      </span>
                      <span
                        className={`text-[16px] font-semibold ${
                          isSelected ? 'text-[#8259F5]' : 'text-[#1E2939]'
                        }`}
                      >
                        {cost.toLocaleString()}원
                      </span>
                      {isCurrent && (
                        <span className="text-[12px] px-2 py-0.5 rounded-full bg-white border border-[#E5E7EB] text-[#6A7282]">
                          현재
                        </span>
                      )}
                    </div>
                    <span className="text-[13px] text-[#6A7282] tabular-nums">
                      시간당 {(cost * 120).toLocaleString()}원
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-12 rounded-[12px] bg-[#F3F4F6] text-[15px] font-semibold text-[#4A5565]"
              >
                취소
              </button>
              <button
                type="button"
                disabled={selected == null || selected === info.current_unit_cost}
                onClick={() => setStep('confirm')}
                className="flex-1 h-12 rounded-[12px] bg-[#9B7AF7] text-[15px] font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                다음
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-[18px] font-bold text-[#030712] leading-[140%]">
              변경 확인
            </h2>
            <div className="mt-4 p-4 rounded-[12px] bg-[#F3EEFE]">
              <p className="text-[14px] text-[#1E2939] leading-[160%]">
                <span className="font-semibold">30초당 {selected?.toLocaleString()}원</span>으로
                변경됩니다.
              </p>
              <p className="mt-1 text-[13px] text-[#6A7282] leading-[160%]">
                · 즉시 적용됩니다.<br />
                · 다음 단가 변경은 <span className="font-semibold text-[#8259F5]">다음 달 1일</span>부터 가능합니다.
              </p>
            </div>

            {error && (
              <div className="mt-3 p-3 rounded-[10px] bg-[#FEF2F2] text-[13px] text-[#DC2626] leading-[140%]">
                {error}
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setStep('select')}
                className="flex-1 h-12 rounded-[12px] bg-[#F3F4F6] text-[15px] font-semibold text-[#4A5565]"
              >
                이전
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleConfirm()}
                className="flex-1 h-12 rounded-[12px] bg-[#9B7AF7] text-[15px] font-semibold text-white disabled:opacity-50"
              >
                {submitting ? '처리 중...' : '확정'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
