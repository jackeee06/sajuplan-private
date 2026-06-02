import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'
import ConfirmModal from '../components/ConfirmModal'
import CouponRegisterModal from '../components/CouponRegisterModal'
import { ApiError, couponsApi, type PublicCoupon } from '../lib/api'
import { useAuth } from '../lib/auth-context'

/**
 * 마이페이지 쿠폰 — /mypage/coupons (Figma 118:7460 / 120:6640 / 128:15813 / 128:15905)
 *
 * 백엔드 연동:
 *   GET    /user/coupons?status=available|used
 *   POST   /user/coupons/:id/use            — 보유 쿠폰 사용 (used_at + 포인트 적립)
 *   POST   /user/coupons/redeem  {code}     — 쿠폰코드 입력 → 즉시 발급+사용+포인트 적립
 *   DELETE /user/coupons/:id                — 사용내역에서 숨김 (hidden_at 마킹)
 */

type Tab = 'used' | 'available'

export default function Coupons() {
  const navigate = useNavigate()
  const { refresh: refreshAuth } = useAuth()
  const [tab, setTab] = useState<Tab>('used')
  const [list, setList] = useState<PublicCoupon[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [useTarget, setUseTarget] = useState<PublicCoupon | null>(null)
  const [hideTarget, setHideTarget] = useState<PublicCoupon | null>(null)
  const [registerOpen, setRegisterOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // 토스트 자동 종료
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  const fetchList = async (t: Tab) => {
    setLoading(true)
    setError(null)
    try {
      const r = await couponsApi.list(t)
      setList(r.items)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        navigate('/login', { replace: true, state: { from: '/mypage/coupons' } })
        return
      }
      setError(e instanceof Error ? e.message : '쿠폰을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchList(tab)
  }, [tab])

  const confirmUse = async () => {
    if (!useTarget) return
    setBusy(true)
    try {
      const r = await couponsApi.use(useTarget.id)
      setToast(`${r.point.toLocaleString()} 코인이 적립되었습니다.`)
      setUseTarget(null)
      await refreshAuth()
      // 사용 후 사용내역으로 이동
      setTab('used')
    } catch (e) {
      setToast(e instanceof Error ? e.message : '쿠폰 사용에 실패했습니다.')
      setUseTarget(null)
    } finally {
      setBusy(false)
    }
  }

  const confirmHide = async () => {
    if (!hideTarget) return
    setBusy(true)
    try {
      await couponsApi.hide(hideTarget.id)
      setList((prev) => prev.filter((c) => c.id !== hideTarget.id))
      setHideTarget(null)
      setToast('내역이 삭제되었습니다.')
    } catch (e) {
      setToast(e instanceof Error ? e.message : '삭제에 실패했습니다.')
      setHideTarget(null)
    } finally {
      setBusy(false)
    }
  }

  const handleRegister = async (code: string) => {
    setRegisterError(null)
    setBusy(true)
    try {
      const r = await couponsApi.redeem(code)
      setRegisterOpen(false)
      setToast(`${r.point.toLocaleString()} 코인이 적립되었습니다.`)
      await refreshAuth()
      // 코드 입력은 즉시 사용 처리 → 사용내역으로 이동
      setTab('used')
    } catch (e) {
      setRegisterError(e instanceof Error ? e.message : '쿠폰 등록에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mobile-frame flex flex-col pb-[100px]">
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
                on ? 'text-[#ec4899] font-bold' : 'text-[#99A1AF] font-medium'
              }`}
            >
              {t === 'used' ? '사용내역' : '쿠폰함'}
              {on && <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-[#ec4899]" />}
            </button>
          )
        })}
      </div>

      {tab === 'available' && (
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-[14px] text-[#4A5565]">
            사용 가능한 쿠폰 <span className="text-[#ec4899] font-bold">{list.length}</span>개
          </span>
          <button
            type="button"
            onClick={() => {
              setRegisterError(null)
              setRegisterOpen(true)
            }}
            className="h-8 px-3 rounded-full border border-[#E5E7EB] text-[13px] font-medium text-[#4A5565]"
          >
            쿠폰번호 입력
          </button>
        </div>
      )}

      <main className="flex-1 px-4 pt-2 flex flex-col gap-3">
        {loading && (
          <div className="py-20 text-center text-[14px] text-[#99A1AF]">불러오는 중…</div>
        )}
        {!loading && error && (
          <div className="py-20 text-center text-[14px] text-[#FB2C36]">{error}</div>
        )}
        {!loading && !error &&
          list.map((c) => (
            <CouponCard
              key={c.id}
              coupon={c}
              tab={tab}
              onUse={() => setUseTarget(c)}
              onHide={() => setHideTarget(c)}
            />
          ))}
        {!loading && !error && list.length === 0 && (
          <div className="py-20 text-center text-[14px] text-[#99A1AF]">
            {tab === 'used' ? '사용한 쿠폰이 없습니다.' : '사용 가능한 쿠폰이 없습니다.'}
          </div>
        )}
      </main>

      <FloatingActions bottomOffset={24} />

      {toast && (
        <div className="fixed top-[80px] left-1/2 -translate-x-1/2 z-40 px-5 py-3 rounded-[12px] bg-[#1F2937] text-white text-[14px] leading-[140%] shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
          {toast}
        </div>
      )}

      <ConfirmModal
        open={!!useTarget && !busy}
        message="쿠폰을 사용하시겠습니까?"
        subMessage="사용하는 즉시 코인이 충전됩니다."
        actionLabel="사용"
        onCancel={() => setUseTarget(null)}
        onConfirm={confirmUse}
      />
      <ConfirmModal
        open={!!hideTarget && !busy}
        message="사용 내역에서 삭제하시겠습니까?"
        subMessage="이미 적립된 코인은 회수되지 않습니다."
        actionLabel="삭제"
        tone="danger"
        onCancel={() => setHideTarget(null)}
        onConfirm={confirmHide}
      />
      <CouponRegisterModal
        open={registerOpen}
        onClose={() => {
          setRegisterOpen(false)
          setRegisterError(null)
        }}
        onSubmit={handleRegister}
        error={registerError}
        submitting={busy}
      />
      <BottomNav />
      </div>
  )
}

function CouponCard({
  coupon,
  tab,
  onUse,
  onHide,
}: {
  coupon: PublicCoupon
  tab: Tab
  onUse: () => void
  onHide: () => void
}) {
  const used = tab === 'used'
  const actionBg = used ? '#D9DCE0' : '#f472b6'
  const actionColor = used ? '#6A7282' : '#FFFFFF'
  const actionLabel = used ? '사용완료' : '사용하기'
  const dateLabel = used ? `${coupon.used_at} 사용` : `${coupon.expired_at}까지`

  return (
    <article className="relative flex rounded-[20px] bg-white shadow-[0_2px_8px_rgba(17,24,39,0.04)] overflow-hidden">
      {used && (
        <button
          type="button"
          onClick={onHide}
          aria-label="사용 내역 삭제"
          className="absolute top-2 right-[104px] w-7 h-7 rounded-full flex items-center justify-center text-[#99A1AF] hover:bg-[#F3F4F6] transition"
          title="사용 내역에서 삭제"
        >
          <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      )}
      <div className="flex-1 px-5 py-5">
        <p className="text-[15px] text-[#1E2939]">{coupon.title}</p>
        <p className="mt-1 text-[20px] font-bold text-[#ec4899]">
          {coupon.point.toLocaleString()} 코인
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
