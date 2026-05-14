import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { chargeApi, type ChargeStatusResult } from '../lib/api'

/**
 * 가상계좌 발급 안내.
 * sample/coin/coin_pay_result.php 동등.
 *
 * URL: /charge/vbank-info?oid=...
 *
 * 표시: 입금은행/계좌번호/입금자명/금액/유효시간(24h).
 * 입금완료 통지(returnurl→vbank-callback)가 도착하면 status='completed'로 전환되어
 * 사용자는 /mypage/points 에서 확인 가능.
 */
export default function ChargeVbankInfo() {
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const oid = search.get('oid') ?? ''
  const [data, setData] = useState<ChargeStatusResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!oid) {
      setError('주문번호가 없습니다.')
      return
    }
    chargeApi
      .status(oid)
      .then(setData)
      .catch((e) => setError((e as Error).message))
  }, [oid])

  if (error) {
    return (
      <div className="mobile-frame px-6 py-10 text-center">
        <p className="text-[14px] text-[#FF6467]">{error}</p>
        <button
          type="button"
          onClick={() => navigate('/mypage/charge', { replace: true })}
          className="mt-4 h-11 px-6 rounded-full bg-[#9B7AF7] text-white text-[14px] font-semibold"
        >
          충전 페이지로
        </button>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="mobile-frame px-6 py-10 text-center">
        <p className="text-[14px] text-[#6A7282]">정보를 불러오는 중...</p>
      </div>
    )
  }

  const v = data.vbank

  return (
    <div className="mobile-frame flex flex-col pb-6">
      <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-gradient-to-b from-white to-white/80 backdrop-blur-[7px]">
        <button
          type="button"
          onClick={() => navigate('/mypage/payments', { replace: true })}
          aria-label="결제내역으로"
          className="w-[30px] h-[30px] flex items-center justify-center"
        >
          <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
        </button>
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">가상계좌 발급 완료</h1>
      </header>

      <section className="px-4 pt-4">
        <div className="text-center mb-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-[#F3EEFE] flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M7 14L12 19L21 9" stroke="#9B7AF7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="mt-3 text-[16px] font-bold text-[#1E2939]">아래 계좌로 입금해주세요</p>
          <p className="mt-1 text-[13px] text-[#6A7282]">입금이 확인되면 자동으로 포인트가 충전됩니다.</p>
        </div>

        <div className="rounded-[16px] bg-[#F9FAFB] px-5 py-5">
          <Row label="입금은행" value={v?.bankName ?? '-'} />
          <Row label="계좌번호" value={v?.account ?? '-'} highlight />
          <Row label="결제 금액" value={`${data.amount.toLocaleString()}원`} />
          <Row label="충전 포인트" value={`${data.coinAmount.toLocaleString()}P`} />
          <p className="mt-4 text-[12px] text-[#6A7282] leading-[150%]">
            · 발급일로부터 <strong className="text-[#1E2939]">24시간 이내</strong>에 입금해주세요.<br />
            · 입금자명은 회원 본인 명의로 부탁드립니다.<br />
            · 가상계좌 번호는 <strong className="text-[#1E2939]">결제내역</strong>에서 다시 확인하실 수 있습니다.
          </p>
        </div>
      </section>

      <div className="px-4 pt-6 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => navigate('/mypage/payments', { replace: true })}
          className="w-full h-[52px] rounded-[16px] bg-[#9B7AF7] text-white text-[16px] font-semibold"
        >
          결제내역으로
        </button>
        <button
          type="button"
          onClick={() => navigate('/', { replace: true })}
          className="w-full h-[52px] rounded-[16px] border border-[#E5E7EB] text-[16px] text-[#4A5565]"
        >
          홈으로
        </button>
      </div>
    </div>
  )
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-[13px] text-[#6A7282]">{label}</span>
      <span
        className={`text-[15px] font-semibold ${highlight ? 'text-[#8259F5]' : 'text-[#1E2939]'}`}
      >
        {value}
      </span>
    </div>
  )
}
