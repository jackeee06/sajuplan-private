import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FloatingActions from '../components/FloatingActions'
import ConfirmModal from '../components/ConfirmModal'
import CouponRegisterModal from '../components/CouponRegisterModal'
import { MOCK_COUPONS, type Coupon } from '../data/myWallet'

/**
 * 07마이페이지_일반회원_쿠폰함 (+ 변형)
 *
 * Figma 시안 4종 통합 (탭 + 모달):
 *  - 07마이페이지_일반회원_쿠폰함                              / node-id: 118:7460  (사용내역 탭)
 *  - 07마이페이지_일반회원_쿠폰 - 쿠폰함                       / node-id: 120:6640  (쿠폰함 탭)
 *  - 07마이페이지_일반회원_쿠폰 - 쿠폰함 - 쿠폰 사용 컨펌 모달 / node-id: 128:15813 (ConfirmModal)
 *  - 07마이페이지_일반회원_쿠폰 - 쿠폰함 - 쿠폰 직접 등록 모달 / node-id: 128:15905 (CouponRegisterModal)
 *
 * 두 탭:
 *  - 사용내역: 사용 완료 쿠폰 카드 (회색 사용완료 액션, 점선 perforation)
 *  - 쿠폰함:   사용 가능 쿠폰 카드 (보라 사용하기 액션) + 상단 카운터 + 쿠폰번호 입력 칩
 *
 * 모달:
 *  - 사용하기 클릭 → ConfirmModal (사용하시겠습니까? + 즉시 충전 안내)
 *  - 쿠폰번호 입력 칩 → CouponRegisterModal (4-4-4-4 input + 사용)
 */

type Tab = 'used' | 'available'

export default function Coupons() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('used')
  const [coupons, setCoupons] = useState<Coupon[]>(MOCK_COUPONS)
  const [useTarget, setUseTarget] = useState<Coupon | null>(null)
  const [registerOpen, setRegisterOpen] = useState(false)

  const usedList = useMemo(() => coupons.filter((c) => c.used), [coupons])
  const availableList = useMemo(() => coupons.filter((c) => !c.used), [coupons])

  const confirmUse = () => {
    if (!useTarget) return
    const today = '2026.04.30'
    setCoupons((prev) =>
      prev.map((c) => (c.id === useTarget.id ? { ...c, used: true, usedAt: today } : c)),
    )
    setUseTarget(null)
    setTab('used')
  }

  const handleRegister = (code: string) => {
    const newCoupon: Coupon = {
      id: Date.now(),
      title: code,
      point: 10000,
      expiredAt: '2026.04.30',
      used: false,
    }
    setCoupons((prev) => [newCoupon, ...prev])
    setRegisterOpen(false)
  }

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
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#1E2939]">쿠폰</h1>
      </header>

      <div className="grid grid-cols-2 border-b border-[#F3F4F6]">
        {(['used', 'available'] as Tab[]).map((t) => {
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
              {t === 'used' ? '사용내역' : '쿠폰함'}
              {on && <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-[#8259F5]" />}
            </button>
          )
        })}
      </div>

      {tab === 'available' && (
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-[14px] text-[#4A5565]">
            사용 가능한 쿠폰 <span className="text-[#8259F5] font-bold">{availableList.length}</span>개
          </span>
          <button
            type="button"
            onClick={() => setRegisterOpen(true)}
            className="h-8 px-3 rounded-full border border-[#E5E7EB] text-[13px] font-medium text-[#4A5565]"
          >
            쿠폰번호 입력
          </button>
        </div>
      )}

      <main className="flex-1 px-4 pt-2 flex flex-col gap-3">
        {(tab === 'used' ? usedList : availableList).map((c) => (
          <CouponCard
            key={c.id}
            coupon={c}
            tab={tab}
            onUse={() => setUseTarget(c)}
          />
        ))}
        {(tab === 'used' ? usedList : availableList).length === 0 && (
          <div className="py-20 text-center text-[14px] text-[#99A1AF]">
            {tab === 'used' ? '사용한 쿠폰이 없습니다.' : '사용 가능한 쿠폰이 없습니다.'}
          </div>
        )}
      </main>

      <FloatingActions bottomOffset={24} />

      <ConfirmModal
        open={!!useTarget}
        message="쿠폰을 사용하시겠습니까?"
        subMessage="사용하는 즉시 포인트가 충전됩니다."
        actionLabel="사용"
        onCancel={() => setUseTarget(null)}
        onConfirm={confirmUse}
      />
      <CouponRegisterModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onSubmit={handleRegister}
      />
    </div>
  )
}

function CouponCard({
  coupon,
  tab,
  onUse,
}: {
  coupon: Coupon
  tab: Tab
  onUse: () => void
}) {
  const used = tab === 'used'
  const actionBg = used ? '#D9DCE0' : '#9B7AF7'
  const actionColor = used ? '#6A7282' : '#FFFFFF'
  const actionLabel = used ? '사용완료' : '사용하기'
  const dateLabel = used ? `${coupon.usedAt} 사용` : `${coupon.expiredAt}까지`

  return (
    <article className="flex rounded-[20px] bg-white shadow-[0_2px_8px_rgba(17,24,39,0.04)] overflow-hidden">
      <div className="flex-1 px-5 py-5">
        <p className="text-[15px] text-[#1E2939]">{coupon.title}</p>
        <p className="mt-1 text-[20px] font-bold text-[#8259F5]">
          {coupon.point.toLocaleString()}포인트
        </p>
        <p className="mt-2 text-[13px] text-[#99A1AF]">{dateLabel}</p>
      </div>
      <button
        type="button"
        onClick={used ? undefined : onUse}
        disabled={used}
        className="w-[96px] flex items-center justify-center text-[14px] font-medium relative"
        style={{ background: actionBg, color: actionColor }}
        aria-label={actionLabel}
      >
        <span
          className="absolute left-0 top-0 bottom-0 w-px"
          style={{
            backgroundImage: 'linear-gradient(to bottom, #FFFFFF 50%, transparent 50%)',
            backgroundSize: '1px 8px',
            backgroundRepeat: 'repeat-y',
          }}
        />
        {actionLabel}
      </button>
    </article>
  )
}
