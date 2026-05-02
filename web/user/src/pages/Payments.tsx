import { useNavigate } from 'react-router-dom'
import FloatingActions from '../components/FloatingActions'
import { MOCK_PAYMENTS } from '../data/myWallet'

/**
 * 07마이페이지_일반회원_결제내역
 * Figma node-id: 120:6697
 *
 * 단순 리스트: 좌측 (날짜 + 결제수단) / 우측 (상태 + 금액).
 * 항목 사이는 구분선 없이 큰 여백.
 */
export default function Payments() {
  const navigate = useNavigate()

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

      <main className="flex-1 px-4 pt-2 flex flex-col gap-7">
        {MOCK_PAYMENTS.map((p) => {
          const cancelled = p.status === '취소완료'
          return (
            <article key={p.id} className="flex items-start justify-between">
              <div>
                <p className="text-[13px] text-[#99A1AF] leading-[140%]">{p.paidAt}</p>
                <p className="mt-1 text-[16px] text-[#1E2939] leading-[140%]">{p.method}</p>
              </div>
              <div className="text-right">
                <p
                  className={`text-[13px] leading-[140%] ${
                    cancelled ? 'text-[#FF6467]' : 'text-[#99A1AF]'
                  }`}
                >
                  {p.status}
                </p>
                <p className="mt-1 text-[16px] font-semibold text-[#8259F5] leading-[140%]">
                  {p.amount.toLocaleString()}원
                </p>
              </div>
            </article>
          )
        })}
        {MOCK_PAYMENTS.length === 0 && (
          <div className="py-20 text-center text-[14px] text-[#99A1AF]">결제내역이 없습니다.</div>
        )}
      </main>

      <FloatingActions bottomOffset={24} />
    </div>
  )
}
