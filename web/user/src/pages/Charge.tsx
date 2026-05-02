import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MOCK_CHARGE_PACKAGES,
  MOCK_REGISTERED_CARDS,
  MOCK_CHARGE_BALANCE,
  MOCK_AUTO_THRESHOLD,
  CHARGE_NOTICES,
  GENERAL_PAY_OPTIONS,
  type ChargePackage,
  type RegisteredCard,
  type GeneralPayOption,
} from '../data/myWallet'

/**
 * 07마이페이지_일반회원_포인트 충전
 *
 * Figma 시안 5종 통합 (한 페이지에서 모든 변형 처리):
 *  - 07마이페이지_일반회원_포인트 충전 - 사주문페이(등록된 카드 없는 경우)  / node-id: 128:19235
 *  - 07마이페이지_일반회원_포인트 충전 - 사주문페이(등록된 카드 있는 경우)  / node-id: 137:10991
 *  - 07마이페이지_일반회원_포인트 충전 - 사주문페이(등록된 카드 있는 경우2) / node-id: 147:9265
 *  - 07마이페이지_일반회원_포인트 충전 - 일반결제                          / node-id: 137:10718
 *  - 07마이페이지_일반회원_포인트 충전 - 자동충전                          / node-id: 147:9474
 *
 * 변형 분기:
 *  - 탭: 충전 / 자동충전
 *  - 결제방법: 사주문페이 / 일반결제
 *  - 사주문페이 + 카드 0장 → 사주문페이 추가 안내
 *  - 사주문페이 + 카드 1장 → 등록된 카드 (브랜드 컬러 배경)
 *  - 일반결제 → 결제수단 칩 5종 (신용카드 / 가상계좌 / 페이코 / 카카오페이 / 네이버페이)
 *  - 자동충전 탭 → 토글 + 안내 + 기준 잔액
 */

type ChargeTab = 'charge' | 'auto'
type PaymentMethod = 'sajumun_pay' | 'general'

export default function Charge() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<ChargeTab>('charge')
  const [packageId, setPackageId] = useState<number>(1)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('sajumun_pay')
  const [generalOption, setGeneralOption] = useState<GeneralPayOption>('신용카드')
  const [cards, setCards] = useState<RegisteredCard[]>(MOCK_REGISTERED_CARDS)
  const [firstChargeNoticeOpen, setFirstChargeNoticeOpen] = useState(true)
  const [autoEnabled, setAutoEnabled] = useState(true)

  const handleRemoveCard = (id: number) => {
    setCards((prev) => prev.filter((c) => c.id !== id))
    setFirstChargeNoticeOpen(true)
  }

  return (
    <div className="mobile-frame flex flex-col pb-6">
      <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-gradient-to-b from-white to-white/80 backdrop-blur-[7px]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로"
          className="w-[30px] h-[30px] flex items-center justify-center"
        >
          <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
        </button>
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">포인트 충전</h1>
      </header>

      {/* 탭 */}
      <div className="grid grid-cols-2 border-b border-[#F3F4F6]">
        {(['charge', 'auto'] as ChargeTab[]).map((t) => {
          const on = tab === t
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`relative h-[44px] flex items-center justify-center text-[15px] ${
                on ? 'text-[#8259F5] font-bold' : 'text-[#99A1AF] font-medium'
              }`}
            >
              {t === 'charge' ? '충전' : '자동충전'}
              {on && <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-[#8259F5]" />}
            </button>
          )
        })}
      </div>

      {tab === 'charge' ? (
        <BalanceCard balance={MOCK_CHARGE_BALANCE} />
      ) : (
        <AutoChargeHeader
          enabled={autoEnabled}
          onToggle={() => setAutoEnabled((v) => !v)}
          threshold={MOCK_AUTO_THRESHOLD}
        />
      )}

      {/* 결제요금 선택 */}
      <section className="px-4 pt-5">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-1">
            <h2 className="text-[16px] font-semibold text-[#1E2939]">결제요금 선택</h2>
            <span className="text-[13px] text-[#99A1AF]">(VAT 별도)</span>
          </div>
          <button
            type="button"
            className="h-8 px-3 rounded-full border border-[#E5E7EB] flex items-center gap-1 text-[13px] text-[#4A5565]"
          >
            <img src="/img/ic_clock_g.svg" alt="" className="w-4 h-4" />
            상담시간 계산
          </button>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {MOCK_CHARGE_PACKAGES.map((p) => (
            <PackageRow
              key={p.id}
              pkg={p}
              selected={packageId === p.id}
              onSelect={() => setPackageId(p.id)}
            />
          ))}
        </div>
      </section>

      {/* 결제방법 */}
      <section className="px-4 pt-6">
        <h2 className="text-[16px] font-semibold text-[#1E2939]">결제방법</h2>

        {/* 사주문페이 라디오 */}
        <button
          type="button"
          onClick={() => setPaymentMethod('sajumun_pay')}
          className="mt-3 flex items-center gap-2 w-full"
        >
          <Radio checked={paymentMethod === 'sajumun_pay'} />
          <img src="/img/sajumoon_pay_logo.svg" alt="" className="h-5" />
          <span className="text-[15px] text-[#1E2939] font-semibold">사주문페이</span>
          <HelpIcon />
        </button>

        {paymentMethod === 'sajumun_pay' && (
          <div className="mt-3">
            {firstChargeNoticeOpen && cards.length === 0 && (
              <div className="mb-3 ml-7 relative inline-block max-w-full px-3 py-2.5 bg-[#F3EEFE] rounded-[12px]">
                <p className="text-[13px] text-[#1E2939] leading-[140%] pr-5">
                  첫 결제 시 포인트 50% 추가 적립!
                  <br />
                  (최초 1회 결제에 한해 제공되는 혜택입니다)
                </p>
                <button
                  type="button"
                  onClick={() => setFirstChargeNoticeOpen(false)}
                  aria-label="안내 닫기"
                  className="absolute top-2 right-2 w-4 h-4 flex items-center justify-center text-[#6A7282]"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            )}

            {cards.length === 0 ? (
              <EmptyCardBox />
            ) : (
              <div className="flex flex-col gap-2">
                {cards.map((c) => (
                  <CardItem key={c.id} card={c} onRemove={() => handleRemoveCard(c.id)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 일반결제 라디오 */}
        <button
          type="button"
          onClick={() => setPaymentMethod('general')}
          className="mt-4 flex items-center gap-2 w-full"
        >
          <Radio checked={paymentMethod === 'general'} />
          <span className="text-[15px] text-[#1E2939] font-semibold">일반결제</span>
        </button>

        {paymentMethod === 'general' && (
          <div className="mt-3 flex flex-wrap gap-2">
            {GENERAL_PAY_OPTIONS.map((opt) => {
              const on = generalOption === opt
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setGeneralOption(opt)}
                  className={`flex-1 min-w-[140px] h-11 rounded-full text-[14px] ${
                    on
                      ? 'bg-[#9B7AF7] text-white font-semibold'
                      : 'border border-[#E5E7EB] text-[#4A5565]'
                  }`}
                >
                  {opt}
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* 주의사항 */}
      <section className="px-4 pt-7 pb-6">
        <h2 className="text-[16px] font-semibold text-[#1E2939]">주의사항</h2>
        <ul className="mt-3 flex flex-col gap-1.5">
          {CHARGE_NOTICES.map((n) => (
            <li key={n} className="text-[13px] text-[#4A5565] leading-[150%] flex">
              <span className="mr-1">·</span>
              <span className="flex-1">{n}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 결제하기 — 콘텐츠 흐름 안 배치 (시안 기준) */}
      <div className="px-4 pt-2 pb-2">
        <button
          type="button"
          className={`w-full h-[52px] rounded-[16px] text-[16px] font-semibold ${
            tab === 'auto' && !autoEnabled
              ? 'bg-[#D1D5DB] text-white'
              : 'bg-[#9B7AF7] text-white'
          }`}
        >
          결제하기
        </button>
      </div>
    </div>
  )
}

/* ─────────── 서브 컴포넌트 ─────────── */

function BalanceCard({ balance }: { balance: number }) {
  return (
    <section className="px-4 pt-4">
      <div className="rounded-[16px] bg-[#F9FAFB] px-5 py-4">
        <p className="text-[14px] text-[#99A1AF] leading-[140%]">보유 포인트</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-[24px] font-bold text-[#8259F5] leading-[120%]">
            {balance.toLocaleString()}
          </span>
          <img src="/img/ic_point.svg" alt="" className="w-6 h-6" />
        </div>
      </div>
    </section>
  )
}

function AutoChargeHeader({
  enabled,
  onToggle,
  threshold,
}: {
  enabled: boolean
  onToggle: () => void
  threshold: number
}) {
  return (
    <>
      <section className="px-4 pt-4 pb-3 flex items-center justify-between">
        <span className="text-[15px] font-semibold text-[#1E2939]">자동충전 사용</span>
        <button
          type="button"
          onClick={onToggle}
          aria-label="자동충전 사용 토글"
          className={`relative w-12 h-7 rounded-full transition-colors ${
            enabled ? 'bg-[#9B7AF7]' : 'bg-[#D1D5DB]'
          }`}
        >
          <span
            className={`absolute top-0.5 w-6 h-6 rounded-full bg-white flex items-center justify-center transition-all ${
              enabled ? 'left-[22px]' : 'left-0.5'
            }`}
          >
            {enabled && (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M3 7L6 10L11 4"
                  stroke="#9B7AF7"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </span>
        </button>
      </section>

      <section className="px-4">
        <div className="rounded-[12px] bg-[#F9FAFB] px-3 py-3 flex gap-2">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0 mt-0.5">
            <circle cx="9" cy="9" r="8" stroke="#6A7282" strokeWidth="1.3" />
            <path
              d="M6.7 6.5C6.7 5.4 7.6 4.5 8.7 4.5H9.3C10.4 4.5 11.3 5.4 11.3 6.5V6.6C11.3 7.4 10.8 8 10.1 8.4L9.5 8.7V10"
              stroke="#6A7282"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="9" cy="13" r="0.7" fill="#6A7282" />
          </svg>
          <div>
            <p className="text-[14px] font-semibold text-[#1E2939]">자동충전이란?</p>
            <p className="mt-1 text-[13px] text-[#4A5565] leading-[150%]">
              보유 코인이 기준 잔액보다 낮아 지면 상담 중에 자동으로 충전되어, 대화가 끊길 걱정 없이 상담에만 집중할 수
              있는 서비스입니다.
            </p>
          </div>
        </div>
      </section>

      <section className="px-4 pt-5">
        <h2 className="text-[16px] font-semibold text-[#1E2939]">충전 기준 잔액</h2>
        <div className="mt-3 h-[52px] px-4 flex items-center rounded-[12px] border border-[#9B7AF7] text-[15px] text-[#1E2939]">
          {threshold.toLocaleString()}P보다 낮아지면 자동충전
        </div>
      </section>
    </>
  )
}

function PackageRow({
  pkg,
  selected,
  onSelect,
}: {
  pkg: ChargePackage
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full h-[52px] px-4 flex items-center justify-between rounded-[12px] border transition-colors ${
        selected ? 'border-[#9B7AF7] bg-[#F3EEFE]' : 'border-[#F3F4F6] bg-white'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-[16px] font-semibold text-[#1E2939]">
          {pkg.point.toLocaleString()}P
        </span>
        <span className="h-5 px-2 rounded-full bg-[#EDE5FE] text-[12px] font-medium text-[#8259F5] flex items-center">
          +{pkg.bonusRate}%
        </span>
      </div>
      <span className="text-[16px] font-semibold text-[#1E2939]">
        {pkg.price.toLocaleString()}원
      </span>
    </button>
  )
}

function Radio({ checked }: { checked: boolean }) {
  return (
    <span
      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
        checked ? 'border-[#9B7AF7]' : 'border-[#D1D5DB]'
      }`}
    >
      {checked && <span className="w-2.5 h-2.5 rounded-full bg-[#9B7AF7]" />}
    </span>
  )
}

function HelpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="6" stroke="#99A1AF" strokeWidth="1.2" />
      <path
        d="M5.4 5.5C5.4 4.7 6 4 7 4S8.6 4.7 8.6 5.5C8.6 6.2 8.2 6.6 7.6 6.9L7 7.2V8"
        stroke="#99A1AF"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="10" r="0.6" fill="#99A1AF" />
    </svg>
  )
}

function EmptyCardBox() {
  return (
    <div className="ml-7 rounded-[16px] bg-[#F9FAFB] py-10 flex flex-col items-center gap-2">
      <img src="/img/sajumoon_pay_logo.svg" alt="사주문페이" className="h-10" />
      <p className="text-[13px] text-[#4A5565]">사주문페이를 추가하고 빠르게 결제하세요!</p>
    </div>
  )
}

function CardItem({ card, onRemove }: { card: RegisteredCard; onRemove: () => void }) {
  return (
    <div
      className="ml-7 rounded-[16px] px-5 py-5 h-[170px] relative"
      style={{ background: card.bgColor, color: card.textColor }}
    >
      <p className="text-[16px] font-bold">{card.brand}</p>
      <p className="mt-2 text-[14px] tracking-wider">{card.numberMasked}</p>
      <button
        type="button"
        onClick={onRemove}
        aria-label="카드 삭제"
        className="absolute bottom-4 right-4 w-7 h-7 flex items-center justify-center"
      >
        <img src={card.trashIcon} alt="" className="w-5 h-5" />
      </button>
    </div>
  )
}
