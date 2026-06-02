import { useEffect, useState } from 'react'
import { counselorPayoutApi, type MyPayoutInfo } from '../lib/api'

/**
 * 선지급 신청 모달 — 2단계 (입력 → 확정)
 *
 * 사장님 정책 표시:
 *  - 신청금 입력 → 실시간 수수료/원천징수/실지급 자동 계산
 *  - 가용 한도 cap (입력값이 한도 초과 시 빨강 + 버튼 disable)
 *  - 더블 컨펌: "신청하시겠습니까? — 신청 N원, 실지급 N원"
 */
export default function PayoutRequestModal({
  open,
  info,
  onClose,
  onSuccess,
}: {
  open: boolean
  info: MyPayoutInfo | null
  onClose: () => void
  onSuccess: () => void
}) {
  const [amountStr, setAmountStr] = useState('')
  const [memo, setMemo] = useState('')
  const [step, setStep] = useState<'input' | 'confirm'>('input')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setAmountStr('')
      setMemo('')
      setStep('input')
      setBusy(false)
      setErr(null)
    }
  }, [open])

  if (!open || !info) return null

  const amount = Number(amountStr.replace(/[^0-9]/g, ''))
  const fee = Math.floor(amount * (info.fee_rate ?? 0.05))
  const wh = Math.floor(amount * (info.withholding_rate ?? 0.033))
  const actual = Math.max(0, amount - fee - wh)

  const overLimit = amount > info.available_amount
  const underMin = amount > 0 && amount < info.min_amount
  const valid = amount > 0 && !overLimit && !underMin

  const handleSubmit = async () => {
    setBusy(true)
    setErr(null)
    try {
      await counselorPayoutApi.request(amount, memo.trim() || undefined)
      onSuccess()
    } catch (e) {
      setErr(e instanceof Error ? e.message : '신청 실패')
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[600px] bg-white rounded-t-[20px] p-5 pb-7"
        onClick={(e) => e.stopPropagation()}
      >
        {step === 'input' && (
          <>
            <h2 className="text-[18px] font-semibold text-[#030712] mb-1">
              선지급 신청
            </h2>
            <p className="text-[13px] text-[#6A7282] mb-4">
              가용 한도 내에서 신청해주세요.
            </p>

            <div className="mb-3">
              <label className="block text-[13px] font-medium text-[#4A5565] mb-1.5">
                신청 금액 (원)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={amountStr ? Number(amountStr.replace(/[^0-9]/g, '')).toLocaleString() : ''}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder={`최소 ${info.min_amount.toLocaleString()}원`}
                className="w-full h-12 px-4 rounded-[10px] bg-[#F9FAFB] border border-[#F3F4F6] text-[16px] font-semibold tabular-nums focus:outline-none focus:border-[#9B7AF7]"
              />
              <div className="mt-1.5 flex justify-between text-[12px]">
                <span className="text-[#6A7282]">
                  가용 한도{' '}
                  <span className="font-medium text-[#ec4899] tabular-nums">
                    {info.available_amount.toLocaleString()}원
                  </span>
                </span>
                {overLimit && <span className="text-[#FB2C36]">한도 초과</span>}
                {underMin && (
                  <span className="text-[#FB2C36]">
                    최소 {info.min_amount.toLocaleString()}원
                  </span>
                )}
              </div>
            </div>

            <div className="mb-3">
              <label className="block text-[13px] font-medium text-[#4A5565] mb-1.5">
                메모 (선택)
              </label>
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="예: 긴급 자금 필요"
                maxLength={200}
                className="w-full h-11 px-4 rounded-[10px] bg-[#F9FAFB] border border-[#F3F4F6] text-[14px] focus:outline-none focus:border-[#9B7AF7]"
              />
            </div>

            {amount > 0 && (
              <div className="mb-4 p-3 rounded-[10px] bg-[#F9FAFB] text-[13px] leading-[180%]">
                <div className="flex justify-between">
                  <span className="text-[#6A7282]">신청금</span>
                  <span className="tabular-nums">{amount.toLocaleString()}원</span>
                </div>
                <div className="flex justify-between text-[#FB2C36]">
                  <span>수수료 ({(info.fee_rate * 100).toFixed(0)}%)</span>
                  <span className="tabular-nums">-{fee.toLocaleString()}원</span>
                </div>
                <div className="flex justify-between text-[#FB2C36]">
                  <span>원천징수 ({(info.withholding_rate * 100).toFixed(1)}%)</span>
                  <span className="tabular-nums">-{wh.toLocaleString()}원</span>
                </div>
                <div className="mt-1 pt-1 border-t border-[#E5E7EB] flex justify-between font-semibold text-[#1E2939]">
                  <span>실지급</span>
                  <span className="tabular-nums text-[#ec4899]">
                    {actual.toLocaleString()}원
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-12 rounded-full border border-[#E5E7EB] text-[14px] font-medium text-[#4A5565]"
              >
                취소
              </button>
              <button
                type="button"
                disabled={!valid}
                onClick={() => setStep('confirm')}
                className="h-12 rounded-full bg-[#f472b6] text-[14px] font-semibold text-white disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF]"
              >
                다음
              </button>
            </div>
          </>
        )}

        {step === 'confirm' && (
          <>
            <h2 className="text-[18px] font-semibold text-[#030712] mb-3">
              아래 내용으로 신청합니다
            </h2>
            <div className="mb-4 p-4 rounded-[12px] bg-[#FDF2F8] text-[14px] leading-[180%]">
              <div className="flex justify-between">
                <span>신청금</span>
                <span className="font-semibold tabular-nums">
                  {amount.toLocaleString()}원
                </span>
              </div>
              <div className="flex justify-between text-[#6A7282] text-[13px]">
                <span>수수료/원천징수</span>
                <span className="tabular-nums">-{(fee + wh).toLocaleString()}원</span>
              </div>
              <div className="mt-2 pt-2 border-t border-[#FDD8E1] flex justify-between text-[16px] font-bold text-[#ec4899]">
                <span>실지급</span>
                <span className="tabular-nums">{actual.toLocaleString()}원</span>
              </div>
              <p className="mt-3 text-[12px] text-[#6A7282] leading-[160%]">
                · 입금 계좌: {info.bank_name} {info.bank_account_masked}
                <br />
                · 오늘 일과 종료 후 운영자가 처리합니다.
              </p>
            </div>

            {err && (
              <p className="mb-3 p-3 rounded-[10px] bg-[#FEE2E2] text-[13px] text-[#B91C1C]">
                {err}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStep('input')}
                disabled={busy}
                className="h-12 rounded-full border border-[#E5E7EB] text-[14px] font-medium text-[#4A5565]"
              >
                이전
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSubmit()}
                className="h-12 rounded-full bg-[#f472b6] text-[14px] font-semibold text-white disabled:bg-[#E5E7EB]"
              >
                {busy ? '처리 중…' : '신청하기'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
