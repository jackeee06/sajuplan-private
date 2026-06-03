import { useEffect, useMemo, useState } from 'react'
import { counselorPayoutApi, type MyPayoutInfo } from '../lib/api'

const KOREAN_BANKS = [
  '국민', '신한', '우리', '하나', '농협', 'IBK기업', 'SC제일', '씨티', 'KDB산업',
  '카카오뱅크', '케이뱅크', '토스뱅크',
  '부산', '대구', '경남', '광주', '전북', '제주',
  '새마을금고', '신협', '우체국', '수협',
]

// 계좌번호 자릿수 정책 (새마을금고·신협 등 일부 지방은행 16자리 지원)
const MIN_ACCOUNT_DIGITS = 10
const MAX_ACCOUNT_DIGITS = 16

// 예금주명 — 한글 자모/완성형 + 공백만 허용 (외국인 영문은 별도 케이스라 운영자 협의 후 등록)
const HOLDER_REGEX = /^[가-힣ㄱ-ㅎㅏ-ㅣ ]*$/
const HOLDER_MIN_LEN = 2
const HOLDER_MAX_LEN = 20

/**
 * 계좌 등록/변경 모달
 *
 * 사장님 정책:
 *  - 변경 시 3일 잠금 (선지급 거부)
 *  - 처리 대기 신청 있으면 거부
 *  - 모든 필드 필수
 *
 * 입력 검증 (2026-05-23 추가, 무료 1차 검증):
 *  - 예금주: 한글만, 2~20자
 *  - 계좌번호: 숫자만, 10~14자
 *  - 자릿수 실시간 카운터 표시
 */
export default function PayoutBankModal({
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
  const [bankName, setBankName] = useState('')
  const [bankHolder, setBankHolder] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (open && info) {
      setBankName(info.bank_name ?? '')
      setBankHolder(info.bank_holder ?? '')
      setBankAccount('')  // 보안 — 다시 입력
      setErr(null)
      setBusy(false)
    }
  }, [open, info])

  // 계좌 숫자만 (하이픈 등 모두 제거하여 자릿수 카운트)
  const accountDigits = useMemo(
    () => bankAccount.replace(/[^0-9]/g, ''),
    [bankAccount],
  )
  const accountLen = accountDigits.length

  // 검증
  const bankSelected = bankName.trim().length > 0
  const holderOk =
    bankHolder.trim().length >= HOLDER_MIN_LEN &&
    bankHolder.trim().length <= HOLDER_MAX_LEN &&
    HOLDER_REGEX.test(bankHolder.trim())
  const accountOk = accountLen >= MIN_ACCOUNT_DIGITS && accountLen <= MAX_ACCOUNT_DIGITS

  const valid = bankSelected && holderOk && accountOk

  // 예금주 입력 시 한글 외 차단
  const onHolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    if (HOLDER_REGEX.test(v)) setBankHolder(v)
    // 정규식 안 맞으면 입력 무시
  }

  // 계좌번호 입력 시 숫자만 (하이픈도 제거 — 운영 일관성)
  const onAccountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/[^0-9]/g, '')
    if (v.length <= MAX_ACCOUNT_DIGITS) setBankAccount(v)
  }

  if (!open) return null

  const accountHint = (() => {
    if (accountLen === 0) return { text: `숫자 ${MIN_ACCOUNT_DIGITS}~${MAX_ACCOUNT_DIGITS}자리`, color: '#9CA3AF' }
    if (accountLen < MIN_ACCOUNT_DIGITS) return { text: `${accountLen}자리 입력 — 최소 ${MIN_ACCOUNT_DIGITS}자리 필요`, color: '#FB2C36' }
    if (accountLen > MAX_ACCOUNT_DIGITS) return { text: `${accountLen}자리 — 너무 깁니다 (최대 ${MAX_ACCOUNT_DIGITS})`, color: '#FB2C36' }
    return { text: `${accountLen}자리 입력됨 ✓`, color: '#10B981' }
  })()

  const holderHint = (() => {
    const t = bankHolder.trim()
    if (t.length === 0) return null
    if (t.length < HOLDER_MIN_LEN) return { text: '2자 이상 입력', color: '#FB2C36' }
    if (!HOLDER_REGEX.test(t)) return { text: '한글만 입력 가능 (본인 명의)', color: '#FB2C36' }
    return null
  })()

  const handleSubmit = async () => {
    if (!window.confirm('계좌 정보를 저장하시겠습니까?\n변경 시 3일간 선지급 신청이 제한됩니다.')) {
      return
    }
    setBusy(true)
    setErr(null)
    try {
      await counselorPayoutApi.updateBank(
        bankName.trim(),
        bankHolder.trim(),
        accountDigits,
      )
      onSuccess()
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장 실패')
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
        <h2 className="text-[18px] font-semibold text-[#030712] mb-1">
          입금 계좌 {info?.has_bank_info ? '변경' : '등록'}
        </h2>
        <p className="text-[13px] text-[#6A7282] mb-4 leading-[150%]">
          정기 정산 + 선지급에 사용될 계좌를 입력해주세요.
          {info?.has_bank_info && ' 변경 시 3일간 선지급이 제한됩니다.'}
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-[13px] font-medium text-[#4A5565] mb-1.5">
              은행
            </label>
            <select
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full h-11 px-3 rounded-[10px] bg-[#F9FAFB] border border-[#F3F4F6] text-[14px] focus:outline-none focus:border-[#9B7AF7]"
            >
              <option value="">은행 선택</option>
              {KOREAN_BANKS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#4A5565] mb-1.5">
              예금주 (본인 명의만 가능)
            </label>
            <input
              type="text"
              value={bankHolder}
              onChange={onHolderChange}
              placeholder="홍길동"
              maxLength={HOLDER_MAX_LEN}
              className="w-full h-11 px-3 rounded-[10px] bg-[#F9FAFB] border border-[#F3F4F6] text-[14px] focus:outline-none focus:border-[#9B7AF7]"
            />
            {holderHint && (
              <p className="mt-1 text-[11.5px] leading-[150%]" style={{ color: holderHint.color }}>
                {holderHint.text}
              </p>
            )}
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#4A5565] mb-1.5">
              계좌번호
            </label>
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="off"
              value={bankAccount}
              onChange={onAccountChange}
              placeholder="숫자만 입력 (하이픈 자동 제거)"
              maxLength={MAX_ACCOUNT_DIGITS}
              className="w-full h-11 px-3 rounded-[10px] bg-[#F9FAFB] border border-[#F3F4F6] text-[14px] tabular-nums tracking-wider focus:outline-none focus:border-[#9B7AF7]"
            />
            <p className="mt-1 text-[11.5px] leading-[150%]" style={{ color: accountHint.color }}>
              {accountHint.text}
            </p>
          </div>
        </div>

        {err && (
          <p className="mt-3 p-3 rounded-[10px] bg-[#FEE2E2] text-[13px] text-[#B91C1C]">
            {err}
          </p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="h-12 rounded-full border border-[#E5E7EB] text-[14px] font-medium text-[#4A5565]"
          >
            취소
          </button>
          <button
            type="button"
            disabled={!valid || busy}
            onClick={() => void handleSubmit()}
            className="h-12 rounded-full bg-[#f472b6] text-[14px] font-semibold text-white disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF]"
          >
            {busy ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
