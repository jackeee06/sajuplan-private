import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  CHARGE_NOTICES,
  GENERAL_PAY_OPTIONS,
  type GeneralPayOption,
} from '../data/myWallet'
import {
  chargeApi,
  pointsApi,
  type ChargePackageDto,
  type GeneralPayMethod,
  type RegisteredCardDto,
} from '../lib/api'
import { useAuth } from '../lib/auth-context'

/**
 * 07마이페이지_일반회원_포인트 충전 (Figma 5종 변형 + 백엔드 연동)
 *
 *  sample 정책 1:1 마이그레이션 (sample/coin/coin_fill.php · coin_fill_auto.php).
 *  - 일반결제: chargeApi.prepare → form auto submit → PG → returnurl 콜백 → /charge/complete
 *  - 사주문페이(BillKey 보유): chargeApi.autopayCharge → /charge/complete?oid=...
 *  - 사주문페이(카드 미등록): /mypage/charge/card-register 로 이동
 *  - 자동충전 토글: chargeApi.setAutoConfig
 */

type ChargeTab = 'charge' | 'auto'
type PaymentMethod = 'sajumun_pay' | 'general'

const PAY_OPTION_TO_METHOD: Record<GeneralPayOption, GeneralPayMethod> = {
  신용카드: 'CARD',
  가상계좌: 'VBANK',
  페이코: 'PAYCO',
  카카오페이: 'KAKAO',
  네이버페이: 'NAVER',
}

// 카드사별 시안 색상 (sample 디자인 시스템 — 카드 명도에 따라)
const CARD_BRAND_COLORS: Record<string, { bg: string; fg: string; trash: string }> = {
  국민카드: { bg: '#FFB901', fg: '#1E2939', trash: '/img/ic_trash_b.svg' },
  KB국민: { bg: '#FFB901', fg: '#1E2939', trash: '/img/ic_trash_b.svg' },
  BC카드: { bg: '#E84263', fg: '#FFFFFF', trash: '/img/ic_trash_w.svg' },
}

function brandColors(brand: string): { bg: string; fg: string; trash: string } {
  for (const [key, c] of Object.entries(CARD_BRAND_COLORS)) {
    if (brand.includes(key)) return c
  }
  // 디폴트 — 보라
  return { bg: '#9B7AF7', fg: '#FFFFFF', trash: '/img/ic_trash_w.svg' }
}

export default function Charge() {
  const navigate = useNavigate()
  const { member, loading: authLoading } = useAuth()
  const [tab, setTab] = useState<ChargeTab>('charge')
  const [packageId, setPackageId] = useState<number | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('sajumun_pay')
  const [generalOption, setGeneralOption] = useState<GeneralPayOption>('신용카드')
  const [firstChargeNoticeOpen, setFirstChargeNoticeOpen] = useState(true)
  const [autoEnabled, setAutoEnabled] = useState(false)
  // 자동충전 기준 잔액 — sample 라이브 정책상 엠투넷이 관리. 사용자 조절 불가, 10,000원 고정.
  const AUTO_THRESHOLD = 10000

  const [packages, setPackages] = useState<ChargePackageDto[]>([])
  const [cards, setCards] = useState<RegisteredCardDto[]>([])
  const [balance, setBalance] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  // webview 환경에서 alert가 무시될 수 있어 inline 에러 메시지 사용
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // 상담시간 계산 가이드 모달 — sample/include/guide_coin_fill.php 동등
  const [timeGuideOpen, setTimeGuideOpen] = useState(false)

  const formRef = useRef<HTMLFormElement>(null)

  // 안드로이드/iOS webview의 bfcache·history 잔존 대응.
  // form.submit() 후 PG로 이동 → 백키/뒤로가기/iOS swipe로 돌아오면
  // React 상태가 복원되어 submitting=true가 stuck되는 문제 방지.
  useEffect(() => {
    const resetUiState = () => {
      setSubmitting(false)
      setErrorMsg(null)
    }
    // pagehide: 페이지 떠나기 직전(form.submit 직후) 미리 false로 마킹 → bfcache 복원 시 false로 출발
    const onPageHide = () => setSubmitting(false)
    resetUiState()
    window.addEventListener('pageshow', resetUiState)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('focus', resetUiState)
    window.addEventListener('popstate', resetUiState)
    document.addEventListener('visibilitychange', resetUiState)
    return () => {
      window.removeEventListener('pageshow', resetUiState)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('focus', resetUiState)
      window.removeEventListener('popstate', resetUiState)
      document.removeEventListener('visibilitychange', resetUiState)
    }
  }, [])

  useEffect(() => {
    // 인증 확인 전 / 비로그인 시: API 호출 금지 (가드에서 /login 리다이렉트 처리)
    if (authLoading || !member) return
    let mounted = true
    Promise.all([chargeApi.packages(), chargeApi.methods(), pointsApi.balance()])
      .then(([pkgs, methods, bal]) => {
        if (!mounted) return
        // 10P 이하 테스트용 패키지는 화면에서 숨김. account_setting row 자체는 보존.
        const visiblePkgs = pkgs.filter((p) => Number(p.totalPoint) > 10)
        setPackages(visiblePkgs)
        setCards(methods.cards)
        setAutoEnabled(methods.auto.enabled)
        setBalance(bal.total)
        // 기본 패키지: sample/coin_fill.php JS — 3번째 항목 prechecked
        if (visiblePkgs.length > 0) setPackageId(visiblePkgs[Math.min(2, visiblePkgs.length - 1)]?.id ?? visiblePkgs[0].id)
      })
      .catch((e) => {
        console.error('충전 페이지 데이터 로드 실패', e)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [authLoading, member])

  const selectedPkg = useMemo(
    () => packages.find((p) => p.id === packageId) ?? null,
    [packages, packageId],
  )

  const handleRemoveCard = async () => {
    if (!confirm('등록된 결제수단을 삭제하시겠습니까?\n\n삭제 후 새 카드를 등록해야 사주문페이/자동결제 사용이 가능합니다.')) {
      return
    }
    setErrorMsg(null)
    try {
      await chargeApi.autopayCardDelete()
      const methods = await chargeApi.methods()
      setCards(methods.cards)
      setAutoEnabled(false)
      setFirstChargeNoticeOpen(true)
    } catch (e) {
      setErrorMsg(`카드 삭제 실패: ${(e as Error).message}`)
    }
  }

  const handlePayClick = async () => {
    setErrorMsg(null)
    if (!selectedPkg) {
      setErrorMsg('결제 요금을 선택해주세요.')
      return
    }
    // [임시 완화] 가상계좌 10원 테스트 진행 중. 운영 진입 시 30000 으로 복구.
    if (selectedPkg.payAmount < 10) {
      setErrorMsg('최소 결제 금액은 10원입니다.')
      return
    }
    setSubmitting(true)

    if (paymentMethod === 'sajumun_pay') {
      if (cards.length === 0) {
        try {
          sessionStorage.setItem('chargeCardRegisterPackageId', String(selectedPkg.id))
        } catch {}
        window.location.href = '/mypage/charge/card-register'
        return
      }
      try {
        const res = await chargeApi.autopayCharge({ packageId: selectedPkg.id })
        window.location.href = `/charge/complete?oid=${encodeURIComponent(res.oid)}`
      } catch (e) {
        setErrorMsg(`결제 실패: ${(e as Error).message}`)
        setSubmitting(false)
      }
      return
    }

    // 일반결제 — prepare → form auto submit (동일창 PG 이동)
    try {
      const payMethod = PAY_OPTION_TO_METHOD[generalOption]
      const prep = await chargeApi.prepare({ packageId: selectedPkg.id, payMethod })
      const form = formRef.current
      if (!form) {
        setErrorMsg('결제 form을 초기화할 수 없습니다. 새로고침 후 다시 시도해주세요.')
        setSubmitting(false)
        return
      }
      form.action = prep.url
      form.method = 'POST'
      form.target = '_self'
      form.innerHTML = ''
      Object.entries(prep.params).forEach(([k, v]) => {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = k
        input.value = v ?? ''
        form.appendChild(input)
      })
      form.submit()
      // form.submit() 후 PG로 이동되지 않으면 (웹뷰가 외부 인텐트 막은 경우) 3초 후 자동 reset
      window.setTimeout(() => setSubmitting(false), 3000)
    } catch (e) {
      setErrorMsg(`결제 준비 실패: ${(e as Error).message}`)
      setSubmitting(false)
    }
  }

  const handleAutoToggle = async () => {
    if (cards.length === 0) {
      alert('자동충전을 사용하려면 사주문페이 카드를 먼저 등록해주세요.')
      return
    }
    if (!selectedPkg) {
      alert('자동충전 시 결제할 패키지를 선택해주세요.')
      return
    }
    const next = !autoEnabled
    try {
      await chargeApi.setAutoConfig({
        enabled: next,
        threshold: AUTO_THRESHOLD,
        packageId: selectedPkg.id,
      })
      setAutoEnabled(next)
    } catch (e) {
      alert(`자동충전 설정 실패: ${(e as Error).message}`)
    }
  }

  // 인증 가드를 먼저 평가 — authLoading 끝나고 비로그인이면 로그인 페이지로 즉시 이동.
  // (data loading state는 useEffect에서 비로그인 시 일찍 return하기 때문에 false로 전이되지 않음)
  if (authLoading) {
    return (
      <div className="mobile-frame flex flex-col pb-6 items-center justify-center min-h-[60vh]">
        <p className="text-[14px] text-[#6A7282]">불러오는 중...</p>
      </div>
    )
  }

  if (!member) {
    return <Navigate to="/login?redirect=/mypage/charge" replace />
  }

  if (loading) {
    return (
      <div className="mobile-frame flex flex-col pb-6 items-center justify-center min-h-[60vh]">
        <p className="text-[14px] text-[#6A7282]">불러오는 중...</p>
      </div>
    )
  }

  return (
    <div className="mobile-frame flex flex-col pb-6">
      <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-gradient-to-b from-white to-white/80 backdrop-blur-[7px]">
        <button
          type="button"
          onClick={() => navigate('/', { replace: true })}
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
        <BalanceCard balance={balance} />
      ) : (
        <AutoChargeHeader
          enabled={autoEnabled}
          onToggle={handleAutoToggle}
          threshold={AUTO_THRESHOLD}
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
            onClick={() => setTimeGuideOpen(true)}
            className="h-8 px-3 rounded-full border border-[#E5E7EB] flex items-center gap-1 text-[13px] text-[#4A5565]"
          >
            <img src="/img/ic_clock_g.svg" alt="" className="w-4 h-4" />
            상담시간 계산
          </button>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {packages.map((p) => (
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
              <EmptyCardBox
                onAdd={() => {
                  try {
                    if (packageId) sessionStorage.setItem('chargeCardRegisterPackageId', String(packageId))
                  } catch {}
                  // webview 호환 hard navigation
                  window.location.href = '/mypage/charge/card-register'
                }}
              />
            ) : (
              <div className="flex flex-col gap-2">
                {cards.map((c) => (
                  <CardItem key={c.id} card={c} onRemove={handleRemoveCard} />
                ))}
              </div>
            )}
          </div>
        )}

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

      {/* 결제하기 — disabled에서 submitting 의도적으로 제외.
          webview bfcache로 submitting=true가 stuck돼도 재클릭으로 새 시도 가능하게 (UX 우선). */}
      <div className="px-4 pt-2 pb-2">
        {errorMsg && (
          <div className="mb-3 px-3 py-2.5 rounded-[12px] bg-[#FEEBEE] border border-[#FFC9CB]">
            <p className="text-[13px] text-[#FF6467] leading-[140%] break-keep">{errorMsg}</p>
          </div>
        )}
        <button
          type="button"
          disabled={tab === 'auto' && !autoEnabled}
          onClick={handlePayClick}
          className={`w-full h-[52px] rounded-[16px] text-[16px] font-semibold transition-colors ${
            tab === 'auto' && !autoEnabled
              ? 'bg-[#D1D5DB] text-white'
              : submitting
              ? 'bg-[#8259F5] text-white'
              : 'bg-[#9B7AF7] text-white active:bg-[#8259F5]'
          }`}
        >
          {submitting ? '결제 진행 중... (다시 누르면 재시도)' : '결제하기'}
        </button>
      </div>

      {/* 일반결제 form submit용 hidden form (동일창 PG 이동). */}
      <form ref={formRef} target="_self" acceptCharset="UTF-8" style={{ display: 'none' }} />

      {/* 상담시간 계산 가이드 모달 — sample/include/guide_coin_fill.php 그대로 매핑 */}
      <ConsultTimeGuideModal open={timeGuideOpen} onClose={() => setTimeGuideOpen(false)} />
    </div>
  )
}

/** 상담 예상 시간 — 100,000P 기준 30초당 단가별 사용가능 시간.
 *  sample/include/guide_coin_fill.php 의 표/문구를 그대로 옮김. */
const TIME_GUIDE_ROWS: Array<{ rate: number; duration: string }> = [
  { rate: 800, duration: '약 63분 30초' },
  { rate: 1000, duration: '약 50분 0초' },
  { rate: 1200, duration: '약 42분 40초' },
  { rate: 1300, duration: '약 38분 28초' },
  { rate: 1500, duration: '약 33분 20초' },
  { rate: 1600, duration: '약 31분 15초' },
]

function ConsultTimeGuideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-label="상담 예상 시간 안내"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-[400px] rounded-[16px] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-12 px-4 flex items-center justify-between border-b border-[#F3F4F6]">
          <span className="text-[15px] font-semibold text-[#1E2939]">상담 예상 시간</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="w-8 h-8 flex items-center justify-center text-[#6A7282]"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="flex items-center gap-1.5">
            <img src="/img/ic_point.svg" alt="" className="w-5 h-5" />
            <span className="text-[15px] text-[#1E2939]">
              <span className="text-[#8259F5] font-bold">100,000</span>
              <span className="ml-1 text-[#4A5565]">ⓟ 기준</span>
            </span>
          </div>

          <table className="mt-3 w-full text-[14px] border-t border-b border-[#F3F4F6]">
            <thead>
              <tr className="bg-[#F9FAFB]">
                <th className="px-3 py-2 text-left text-[13px] font-medium text-[#6A7282]">상담비용 (30초당)</th>
                <th className="px-3 py-2 text-right text-[13px] font-medium text-[#6A7282]">상담가능 시간</th>
              </tr>
            </thead>
            <tbody>
              {TIME_GUIDE_ROWS.map((r) => (
                <tr key={r.rate} className="border-t border-[#F3F4F6]">
                  <td className="px-3 py-2 text-[#1E2939]">{r.rate.toLocaleString()}원</td>
                  <td className="px-3 py-2 text-right text-[#1E2939]">{r.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="mt-3 space-y-1.5">
            <li className="text-[12px] leading-[160%] text-[#6A7282] flex">
              <span className="mr-1">·</span>
              <span className="flex-1">상담사와 연결 시, 30초당 800~1,600포인트가 차감됩니다.</span>
            </li>
            <li className="text-[12px] leading-[160%] text-[#6A7282] flex">
              <span className="mr-1">·</span>
              <span className="flex-1">30초당 상담요금은 상담사 별로 상이합니다.</span>
            </li>
          </ul>
        </div>

        <div className="px-5 py-3 border-t border-[#F3F4F6]">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-[44px] rounded-full bg-[#9B7AF7] text-white text-[14px] font-semibold"
          >
            확인
          </button>
        </div>
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
              보유 코인이 기준 잔액보다 낮아지면 상담 중에 자동으로 충전되어, 대화가 끊길 걱정 없이 상담에만 집중할 수
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
  pkg: ChargePackageDto
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
          {pkg.totalPoint.toLocaleString()}P
        </span>
        {pkg.bonusPercent > 0 && (
          <span className="h-5 px-2 rounded-full bg-[#EDE5FE] text-[12px] font-medium text-[#8259F5] flex items-center">
            +{pkg.bonusPercent}%
          </span>
        )}
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

function EmptyCardBox({ onAdd }: { onAdd: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="ml-7 w-[calc(100%-1.75rem)] rounded-[16px] bg-[#F9FAFB] py-10 flex flex-col items-center gap-2"
    >
      <img src="/img/sajumoon_pay_logo.svg" alt="사주문페이" className="h-10" />
      <p className="text-[13px] text-[#4A5565]">사주문페이를 추가하고 빠르게 결제하세요!</p>
    </button>
  )
}

function CardItem({
  card,
  onRemove,
}: {
  card: RegisteredCardDto
  onRemove: () => void
}) {
  const colors = brandColors(card.brand)
  return (
    <div
      className="ml-7 rounded-[16px] px-5 py-5 h-[170px] relative"
      style={{ background: colors.bg, color: colors.fg }}
    >
      <p className="text-[16px] font-bold">{card.brand}</p>
      <p className="mt-2 text-[14px] tracking-wider">{card.numberMasked}</p>
      <button
        type="button"
        onClick={onRemove}
        aria-label="카드 삭제"
        className="absolute bottom-4 right-4 w-7 h-7 flex items-center justify-center"
      >
        <img src={colors.trash} alt="" className="w-5 h-5" />
      </button>
    </div>
  )
}
