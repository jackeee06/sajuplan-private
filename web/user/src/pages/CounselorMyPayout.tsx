import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'
import { useAuth } from '../lib/auth-context'
import {
  counselorPayoutApi,
  type MyPayoutInfo,
  type PayoutHistoryItem,
  type PayoutStatus,
} from '../lib/api'
import PayoutRequestModal from '../components/PayoutRequestModal'
import PayoutBankModal from '../components/PayoutBankModal'

/**
 * 상담사 마이페이지 — 선지급(early payout)
 * 사장님 정책: 가용 70% / 수수료 5% / 원천징수 3.3% / 일 1회 / 최소 3만원
 *
 * 구조:
 *  - 헤더 (← + 타이틀)
 *  - 가용 한도 카드 (큰 금액 + 신청 버튼)
 *  - 계좌 정보 카드 (등록/변경)
 *  - 신청 이력 리스트 (상태 뱃지)
 */
export default function CounselorMyPayout() {
  const navigate = useNavigate()
  const { member, loading } = useAuth()
  const [info, setInfo] = useState<MyPayoutInfo | null>(null)
  const [history, setHistory] = useState<PayoutHistoryItem[]>([])
  const [busy, setBusy] = useState(false)
  const [requestModalOpen, setRequestModalOpen] = useState(false)
  const [bankModalOpen, setBankModalOpen] = useState(false)

  const refresh = () => {
    counselorPayoutApi.available()
      .then(setInfo)
      .catch(() => {})
    counselorPayoutApi.history(30)
      .then(setHistory)
      .catch(() => {})
  }

  useEffect(() => {
    if (!member || member.role !== 'counselor') return
    refresh()
  }, [member])

  const handleCancel = async (id: number) => {
    if (!window.confirm('이 신청을 취소하시겠습니까?')) return
    setBusy(true)
    try {
      await counselorPayoutApi.cancel(id)
      refresh()
    } catch (e) {
      alert(`취소 실패: ${e instanceof Error ? e.message : ''}`)
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="mobile-frame flex flex-col">
        <div className="h-[60px] px-4 flex items-center bg-white">
          <h1 className="text-[18px] font-semibold text-[#030712]">선지급</h1>
        </div>
        <main className="flex-1 px-4 py-6 flex flex-col gap-3">
          <div className="h-32 rounded-2xl bg-[#F3F4F6] animate-pulse" />
          <div className="h-20 rounded-2xl bg-[#F3F4F6] animate-pulse" />
        </main>
      </div>
    )
  }
  if (!member) return <Navigate to="/login?redirect=/counselor/mypage/payout" replace />
  if (member.role !== 'counselor') return <Navigate to="/mypage" replace />

  const canRequest =
    !!info &&
    !info.is_blocked &&
    !info.has_pending_request &&
    info.has_bank_info &&
    info.available_amount >= info.min_amount

  const buttonHint = (() => {
    if (!info) return ''
    if (info.is_blocked) return info.block_reason ?? ''
    if (!info.has_bank_info) return '먼저 계좌를 등록해주세요'
    if (info.has_pending_request) return '처리 대기 중인 신청이 있습니다'
    if (info.available_amount < info.min_amount)
      return `최소 신청금 ${info.min_amount.toLocaleString()}원 이상부터 신청 가능합니다`
    return ''
  })()

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
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">
          선지급
        </h1>
      </header>

      <main className="flex-1 px-4 pt-2">
        {/* 가용 한도 카드 */}
        <section className="rounded-[16px] bg-[#F9FAFB] px-5 pt-5 pb-4">
          <p className="text-[14px] leading-[140%] text-[#6A7282]">
            지금 신청 가능한 금액
          </p>
          <p className="mt-1 text-[28px] leading-[130%] font-bold text-[#8259F5] tabular-nums">
            {(info?.available_amount ?? 0).toLocaleString()}원
          </p>
          <ul className="mt-3 flex flex-col gap-1 text-[13px] leading-[140%]">
            <li className="flex items-center justify-between">
              <span className="text-[#6A7282]">이번 달 정산 예상</span>
              <span className="text-[#1E2939] tabular-nums">
                {(info?.estimated_settlement ?? 0).toLocaleString()}원
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-[#6A7282]">이번 달 선지급 누적</span>
              <span className="text-[#1E2939] tabular-nums">
                {(info?.already_paid_this_month ?? 0).toLocaleString()}원
              </span>
            </li>
            {info && info.carry_over_negative > 0 && (
              <li className="flex items-center justify-between">
                <span className="text-[#6A7282]">이전 달 이월 차감</span>
                <span className="text-[#FB2C36] tabular-nums">
                  -{info.carry_over_negative.toLocaleString()}원
                </span>
              </li>
            )}
            <li className="flex items-center justify-between pt-1 mt-1 border-t border-[#E5E7EB]">
              <span className="text-[#6A7282]">
                가용 한도 ({Math.round((info?.available_ratio ?? 0.7) * 100)}%)
              </span>
              <span className="text-[#8259F5] font-semibold tabular-nums">
                {(info?.available_amount ?? 0).toLocaleString()}원
              </span>
            </li>
          </ul>

          {buttonHint && (
            <p className="mt-3 px-3 py-2 rounded-[10px] bg-white border border-[#FDE2E4] text-[12px] leading-[140%] text-[#FB2C36]">
              {buttonHint}
            </p>
          )}

          <button
            type="button"
            disabled={!canRequest || busy}
            onClick={() => setRequestModalOpen(true)}
            className="mt-3 w-full h-12 rounded-full bg-[#8259F5] text-[15px] font-semibold text-white disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF]"
          >
            선지급 신청
          </button>

          <p className="mt-2 text-[11px] leading-[140%] text-[#9CA3AF] text-center">
            수수료 {((info?.fee_rate ?? 0.05) * 100).toFixed(0)}% · 원천징수{' '}
            {((info?.withholding_rate ?? 0.033) * 100).toFixed(1)}% 차감 후 입금
          </p>
        </section>

        {/* 계좌 카드 */}
        <section className="mt-3 rounded-[16px] bg-white border border-[#F3F4F6] p-5">
          <div className="flex items-center justify-between">
            <p className="text-[14px] font-semibold text-[#1E2939]">입금 계좌</p>
            <button
              type="button"
              onClick={() => setBankModalOpen(true)}
              className="h-8 px-3 rounded-full border border-[#E5E7EB] text-[12px] font-medium text-[#4A5565]"
            >
              {info?.has_bank_info ? '변경' : '등록'}
            </button>
          </div>
          {info?.has_bank_info ? (
            <div className="mt-2 text-[14px] leading-[150%] text-[#1E2939]">
              <p>
                <span className="text-[#6A7282]">은행: </span>
                {info.bank_name}
              </p>
              <p>
                <span className="text-[#6A7282]">예금주: </span>
                {info.bank_holder}
              </p>
              <p className="tabular-nums">
                <span className="text-[#6A7282]">계좌: </span>
                {info.bank_account_masked}
              </p>
              {info.bank_locked && (
                <p className="mt-2 text-[12px] text-[#FB2C36]">
                  ⚠ 계좌 변경 후 잠금 중 — 잠금 해제 후 신청 가능
                </p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-[13px] text-[#6A7282]">
              선지급 신청 전에 계좌 정보를 먼저 등록해주세요.
            </p>
          )}
        </section>

        {/* 신청 이력 */}
        <section className="mt-6">
          <h3 className="text-[14px] leading-[140%] text-[#99A1AF] mb-2">신청 이력</h3>
          {history.length === 0 ? (
            <div className="rounded-[16px] bg-[#F9FAFB] py-10 text-center text-[13px] text-[#9CA3AF]">
              아직 신청 내역이 없습니다.
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="rounded-[12px] bg-white border border-[#F3F4F6] p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[#6A7282] tabular-nums">
                      {h.requested_at.slice(0, 16).replace('T', ' ')}
                    </span>
                    <StatusBadge status={h.status} />
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-1.5">
                    <span className="text-[18px] font-semibold text-[#1E2939] tabular-nums">
                      {h.requested_amount.toLocaleString()}원
                    </span>
                    <span className="text-[12px] text-[#9CA3AF]">신청</span>
                  </div>
                  <div className="mt-1 text-[12px] text-[#6A7282] leading-[150%]">
                    수수료 {h.fee_amount.toLocaleString()}원 · 원천징수{' '}
                    {h.withholding_amount.toLocaleString()}원
                    <br />
                    <span className="font-medium text-[#1E2939]">
                      실지급 {h.actual_payout.toLocaleString()}원
                    </span>{' '}
                    · {h.bank_name_snapshot} {h.bank_account_masked}
                  </div>
                  {h.reject_reason && (
                    <p className="mt-2 text-[12px] text-[#FB2C36]">
                      반려사유: {h.reject_reason}
                    </p>
                  )}
                  {h.status === 'pending' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleCancel(h.id)}
                      className="mt-2 h-8 px-3 rounded-full border border-[#E5E7EB] text-[12px] font-medium text-[#FB2C36]"
                    >
                      신청 취소
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="mt-6 mb-2 text-[11px] leading-[160%] text-[#9CA3AF]">
          · 일과 종료 시간 후 운영자가 일괄 처리합니다.
          <br />
          · 입금이 완료되면 카카오톡으로 알림을 보내드립니다.
          <br />
          · 환불 발생으로 정산금이 줄어들 경우 다음 달 정산금에서 자동 차감됩니다.
          <br />
          · 문의:{' '}
          <Link to="/counselor/mypage/qnas/new" className="text-[#8259F5] underline">
            운영팀 문의
          </Link>
        </p>
      </main>

      <FloatingActions bottomOffset={100} />
      <BottomNav myHref="/counselor/mypage" />

      <PayoutRequestModal
        open={requestModalOpen}
        info={info}
        onClose={() => setRequestModalOpen(false)}
        onSuccess={() => {
          setRequestModalOpen(false)
          refresh()
        }}
      />
      <PayoutBankModal
        open={bankModalOpen}
        info={info}
        onClose={() => setBankModalOpen(false)}
        onSuccess={() => {
          setBankModalOpen(false)
          refresh()
        }}
      />
    </div>
  )
}

function StatusBadge({ status }: { status: PayoutStatus }) {
  const cfg: Record<PayoutStatus, { label: string; bg: string; text: string }> = {
    pending: { label: '처리 대기', bg: '#FEF9C3', text: '#A16207' },
    paid: { label: '지급 완료', bg: '#DCFCE7', text: '#15803D' },
    rejected: { label: '반려', bg: '#FEE2E2', text: '#B91C1C' },
    cancelled: { label: '취소', bg: '#F3F4F6', text: '#6A7282' },
  }
  const c = cfg[status]
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[11px] font-semibold leading-none"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {c.label}
    </span>
  )
}
