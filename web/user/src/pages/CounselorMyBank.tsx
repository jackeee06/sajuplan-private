import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'
import { useAuth } from '../lib/auth-context'
import { counselorPayoutApi, type MyPayoutInfo } from '../lib/api'
import PayoutBankModal from '../components/PayoutBankModal'

/**
 * 상담사 마이페이지 — 내 계좌 정보 (정산 + 선지급 공용 계좌 등록/변경)
 *
 * 정책 (사장님 결정 2026-05-23):
 *   - 상담사는 계좌 1개만 등록 (member.bank_name/bank_holder/bank_account)
 *   - 그 계좌가 정기 정산(매월 1일) + 선지급 신청 모두에 사용됨
 *   - 별도 입력 위치를 만들지 않음 — 이 한 곳에서 등록/변경
 *   - 변경 시 일정 기간 출금 잠금(bank_locked_until) — 분쟁 방지
 *
 * 구조:
 *   - 헤더 (← + "내 계좌 정보")
 *   - 안내 박스 — 정산 + 선지급 공용 계좌 명시
 *   - 계좌 카드 — 현재 등록 정보 + 변경/등록 버튼
 *   - BottomNav (myHref=/counselor/mypage)
 */
export default function CounselorMyBank() {
  const navigate = useNavigate()
  const { member, loading } = useAuth()
  const [info, setInfo] = useState<MyPayoutInfo | null>(null)
  const [bankModalOpen, setBankModalOpen] = useState(false)

  const refresh = () => {
    counselorPayoutApi.available()
      .then(setInfo)
      .catch(() => { /* 실패해도 페이지는 동작 */ })
  }

  useEffect(() => {
    if (!member || member.role !== 'counselor') return
    refresh()
  }, [member])

  if (loading) {
    return (
      <div className="mobile-frame flex flex-col">
        <div className="h-[60px] px-4 flex items-center bg-white">
          <h1 className="text-[18px] font-semibold text-[#030712]">내 계좌 정보</h1>
        </div>
        <main className="flex-1 px-4 py-6">
          <div className="h-32 rounded-2xl bg-[#F3F4F6] animate-pulse" />
        </main>
      </div>
    )
  }
  if (!member) return <Navigate to="/login?redirect=/counselor/mypage/bank" replace />
  if (member.role !== 'counselor') return <Navigate to="/mypage" replace />

  return (
    <div className="mobile-frame flex flex-col">
      {/* 헤더 */}
      <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-gradient-to-b from-white to-white/80 backdrop-blur-[7px]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-[30px] h-[30px] flex items-center justify-center"
          aria-label="뒤로가기"
        >
          <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
        </button>
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">
          내 계좌 정보
        </h1>
      </header>

      <main className="flex-1 px-4 py-4">
        {/* 안내 박스 */}
        <section className="rounded-[16px] bg-[#f3f0ff] border border-[#fbcfe8] p-4">
          <p className="text-[13px] leading-[160%] text-[#9d174d]">
            이 계좌로 매월 9일 <strong>정기 정산금</strong>이 입금됩니다.<br />
            선지급 신청 시에도 같은 계좌가 사용됩니다.
          </p>
        </section>

        {/* 계좌 카드 */}
        <section className="mt-3 rounded-[16px] bg-white border border-[#F3F4F6] p-5">
          <div className="flex items-center justify-between">
            <p className="text-[14px] font-semibold text-[#1E2939]">입금 계좌</p>
            <button
              type="button"
              onClick={() => setBankModalOpen(true)}
              className="h-9 px-4 rounded-full bg-[#8259F5] text-[13px] font-semibold text-white"
            >
              {info?.has_bank_info ? '변경' : '등록'}
            </button>
          </div>
          {info?.has_bank_info ? (
            <div className="mt-3 text-[14px] leading-[170%] text-[#1E2939]">
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
                <p className="mt-3 text-[12px] text-[#FB2C36] leading-[150%]">
                  ⚠ 계좌 변경 후 출금 잠금 중<br />
                  잠금 해제 후 선지급 신청 가능
                </p>
              )}
            </div>
          ) : (
            <p className="mt-3 text-[13px] text-[#6A7282] leading-[160%]">
              아직 계좌 정보가 등록되어 있지 않습니다.<br />
              정산을 정상적으로 받으시려면 계좌를 등록해주세요.
            </p>
          )}
        </section>

        {/* 추가 안내 */}
        <section className="mt-4 px-1 text-[11.5px] leading-[160%] text-[#6A7282]">
          <p>· 예금주명이 본인 명의가 아니면 정산이 지연될 수 있습니다.</p>
          <p>· 계좌 변경 시 일정 기간 선지급 신청이 잠시 제한됩니다.</p>
          <p>· 처리 대기 중인 선지급 신청이 있으면 계좌 변경이 불가합니다.</p>
        </section>
      </main>

      <FloatingActions />
      <BottomNav myHref="/counselor/mypage" />

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
