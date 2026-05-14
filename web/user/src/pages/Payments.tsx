import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FloatingActions from '../components/FloatingActions'
import { chargeApi, type PaymentLogDto } from '../lib/api'

/**
 * 07마이페이지_일반회원_결제내역
 * Figma node-id: 120:6697
 *
 * - 백엔드 GET /api/user/charge/payments
 * - 가상계좌 입금대기 건은 가상계좌번호 + 은행 노출, 클릭 시 가상계좌 안내로 이동
 * - 입금완료/카드결제 등은 결제완료로 노출
 */
export default function Payments() {
  const navigate = useNavigate()
  const [items, setItems] = useState<PaymentLogDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    chargeApi
      .payments()
      .then((rows) => setItems(rows))
      .catch((e) => setError((e as Error).message))
  }, [])

  return (
    <div className="mobile-frame flex flex-col pb-[40px]">
      <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-gradient-to-b from-white to-white/80 backdrop-blur-[7px]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로"
          className="w-[30px] h-[30px] flex items-center justify-center"
        >
          <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
        </button>
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">결제내역</h1>
      </header>

      <main className="flex-1 px-4 pt-2 flex flex-col">
        {error ? (
          <div className="py-20 text-center text-[14px] text-[#FF6467]">{error}</div>
        ) : !items ? (
          <div className="py-20 text-center text-[14px] text-[#99A1AF]">불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="py-20 text-center text-[14px] text-[#99A1AF]">결제내역이 없습니다.</div>
        ) : (
          <ul className="flex flex-col gap-7 pt-4">
            {items.map((p) => (
              <PaymentRow
                key={p.id}
                p={p}
                onVbankClick={() =>
                  navigate(`/charge/vbank-info?oid=${encodeURIComponent(p.oid)}`)
                }
              />
            ))}
          </ul>
        )}
      </main>

      <FloatingActions bottomOffset={24} />
    </div>
  )
}

function PaymentRow({
  p,
  onVbankClick,
}: {
  p: PaymentLogDto
  onVbankClick: () => void
}) {
  const isAwaiting = p.status === 'awaiting_deposit'
  const isClickable = isAwaiting && !!p.vbank?.account

  const statusColor =
    p.status === 'completed'
      ? 'text-[#99A1AF]'
      : p.status === 'awaiting_deposit'
      ? 'text-[#F5A623]'
      : p.status === 'cancelled' || p.status === 'failed'
      ? 'text-[#FF6467]'
      : 'text-[#6A7282]'

  return (
    <li>
      <article
        className={`flex items-start justify-between ${
          isClickable ? 'cursor-pointer active:opacity-70' : ''
        }`}
        onClick={isClickable ? onVbankClick : undefined}
        role={isClickable ? 'button' : undefined}
        tabIndex={isClickable ? 0 : undefined}
      >
        <div className="min-w-0">
          <p className="text-[13px] text-[#99A1AF] leading-[140%]">{formatPaidAt(p.paidAt)} 결제</p>
          <p className="mt-1 text-[16px] text-[#1E2939] leading-[140%]">{p.method}</p>
          {isAwaiting && p.vbank?.account && (
            <p className="mt-1 text-[12px] text-[#6A7282] leading-[140%]">
              {p.vbank.bankName ?? ''} {p.vbank.account}
            </p>
          )}
        </div>
        <div className="text-right shrink-0 ml-3">
          <p className={`text-[13px] leading-[140%] ${statusColor}`}>{p.statusLabel}</p>
          <p
            className={`mt-1 text-[16px] font-semibold leading-[140%] ${
              p.status === 'cancelled' || p.status === 'failed'
                ? 'text-[#9CA3AF] line-through'
                : 'text-[#8259F5]'
            }`}
          >
            {p.amount.toLocaleString()}원
          </p>
          {p.status === 'completed' && p.coinAmount > 0 && (
            <p className="mt-0.5 text-[12px] text-[#6A7282] leading-[140%]">
              +{p.coinAmount.toLocaleString()}P
            </p>
          )}
        </div>
      </article>
    </li>
  )
}

/** ISO timestamp → 'YYYY.MM.DD' (KST) */
function formatPaidAt(iso: string): string {
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    const y = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d)
    return y.replaceAll('-', '.')
  } catch {
    return ''
  }
}

