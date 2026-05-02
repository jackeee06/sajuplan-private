import { useNavigate } from 'react-router-dom'
import FloatingActions from '../components/FloatingActions'
import { MOCK_POINT_LOGS, MOCK_POINT_BALANCE } from '../data/myWallet'

/**
 * 07마이페이지_일반회원_포인트 내역
 * Figma node-id: 147:10616
 *
 * 상단: 보유 포인트 카드 + 포인트충전 버튼
 * 리스트: 화살표 아이콘 박스 / 제목·일시 / ±금액·잔액
 */
export default function Points() {
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
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">포인트 내역</h1>
      </header>

      <section className="px-4 pt-1">
        <div className="rounded-[16px] bg-[#F9FAFB] px-5 pt-5 pb-1">
          <p className="text-[14px] text-[#99A1AF] leading-[140%]">보유 포인트</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[28px] font-bold text-[#8259F5] leading-[120%]">
              {MOCK_POINT_BALANCE.toLocaleString()}
            </span>
            <img src="/img/ic_point.svg" alt="" className="w-6 h-6" />
          </div>
          <button
            type="button"
            onClick={() => navigate('/mypage/charge')}
            className="mt-4 w-full h-[44px] flex items-center justify-center gap-2 border-t border-[#E5E7EB] text-[15px] font-medium text-[#1E2939]"
          >
            <img src="/img/ic_my_card.svg" alt="" className="w-5 h-5" />
            포인트충전
          </button>
        </div>
      </section>

      <main className="flex-1 px-4 pt-6 flex flex-col gap-5">
        {MOCK_POINT_LOGS.map((log) => {
          const isIn = log.direction === 'in'
          return (
            <article key={log.id} className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-[12px] border border-[#F3F4F6] bg-white flex items-center justify-center shrink-0">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                >
                  {isIn ? (
                    <path
                      d="M4 10H16M16 10L11 5M16 10L11 15"
                      stroke="#8259F5"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ) : (
                    <path
                      d="M16 10H4M4 10L9 5M4 10L9 15"
                      stroke="#99A1AF"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[16px] text-[#1E2939] leading-[140%] break-keep">{log.title}</p>
                <p className="mt-1 text-[13px] text-[#99A1AF] leading-[140%]">{log.occurredAt}</p>
              </div>
              <div className="text-right shrink-0">
                <p
                  className={`text-[16px] font-bold leading-[140%] ${
                    isIn ? 'text-[#8259F5]' : 'text-[#1E2939]'
                  }`}
                >
                  {isIn ? '+' : '-'}
                  {log.amount.toLocaleString()}P
                </p>
                <p className="mt-1 text-[13px] text-[#99A1AF] leading-[140%]">
                  {log.balance.toLocaleString()}P
                </p>
              </div>
            </article>
          )
        })}
        {MOCK_POINT_LOGS.length === 0 && (
          <div className="py-20 text-center text-[14px] text-[#99A1AF]">포인트 내역이 없습니다.</div>
        )}
      </main>

      <FloatingActions bottomOffset={24} />
    </div>
  )
}
