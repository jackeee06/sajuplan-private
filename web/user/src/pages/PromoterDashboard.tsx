import { FormEvent, useEffect, useState } from 'react'
import MobileHeader from '../components/MobileHeader'
import InputField from '../components/InputField'
import PrimaryButton, { OutlineButton } from '../components/PrimaryButton'
import AlertModal from '../components/AlertModal'
import ShareBottomSheet from '../components/ShareBottomSheet'
import SupporterAppChrome from '../components/SupporterAppChrome'
import { ApiError, promoterApi, PromoterDashboard as DashboardData } from '../lib/api'

/**
 * 모집인(서포터즈) 대시보드 — 라우트 `/promoter`
 *
 * 모집인은 앱 회원이 아니므로 휴대폰 OTP 로 별도 로그인한다.
 *  - 미로그인: 휴대폰번호 → 인증번호 받기 → 인증번호 입력 → 로그인
 *  - 로그인: 기대수익 + 시간순 적립 타임라인
 *
 * 용어: "기대수익" 만 사용한다. (수익금/포인트 금지). 금액은 원 단위.
 * 이 경로는 WebAppGate 를 적용하지 않는다(앱이 없는 모집인이 보는 화면).
 */
/** verifyOtp 가 'active' 외 상태일 때 로그인 폼 아래에 노출할 분기 결과 */
type LoginResult =
  | { kind: 'pending' }
  | { kind: 'rejected' }
  | { kind: 'inactive' }
  | { kind: 'new'; memberName: string | null }
  | { kind: 'applied' }

export default function PromoterDashboard() {
  const [phase, setPhase] = useState<'login' | 'dashboard'>('login')

  // 로그인 폼
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [busy, setBusy] = useState(false)

  // verify 결과 분기 — 'active' 외(pending/rejected/inactive/new/applied)
  const [loginResult, setLoginResult] = useState<LoginResult | null>(null)

  // 신청 폼 입력 (status='new')
  const [applyName, setApplyName] = useState('')
  const [bankName, setBankName] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [accountHolder, setAccountHolder] = useState('')

  // 대시보드
  const [data, setData] = useState<DashboardData | null>(null)
  const [loadingDash, setLoadingDash] = useState(true)

  const [alertMsg, setAlertMsg] = useState<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)

  // 주인 초대 토큰(/promoter?inv=...) — pi.html 경유로 들어오면 신청 시 자동승인되어 즉시 활동.
  const [inv] = useState<string>(() =>
    typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('inv') ?? '',
  )

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://sajuplan.com'
  // 공유 링크는 깨끗한 OG 경로(/r/{코드}) — 붙여넣기로 전달돼도 카드 제목이 "사주플랜 서포터즈"로 뜬다.
  // nginx 가 /r/ 를 OG 페이지(sp.html)로 물려주고, 실제 방문자는 즉시 /s/{코드} 랜딩으로 자동 이동.
  const myLink = data ? `${origin}/r/${data.code}` : ''

  // 진입 시 기존 세션이 있으면 대시보드로 직행
  useEffect(() => {
    let alive = true
    promoterApi.dashboard().then(
      (d) => {
        if (!alive) return
        setData(d)
        setPhase('dashboard')
        setLoadingDash(false)
      },
      () => {
        if (!alive) return
        setLoadingDash(false)
      },
    )
    return () => {
      alive = false
    }
  }, [])

  const onRequestOtp = async () => {
    if (!/^01[0-9]{8,9}$/.test(phone)) {
      setAlertMsg('휴대폰번호를 올바르게 입력해 주세요.')
      return
    }
    if (busy) return
    setBusy(true)
    try {
      await promoterApi.requestOtp(phone)
      setOtpSent(true)
      setAlertMsg('인증번호가 발송되었습니다.')
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : '인증번호 발송에 실패했습니다.'
      setAlertMsg(msg)
    } finally {
      setBusy(false)
    }
  }

  const onVerify = async (e: FormEvent) => {
    e.preventDefault()
    if (!code.trim()) {
      setAlertMsg('인증번호를 입력해주세요.')
      return
    }
    if (busy) return
    setBusy(true)
    setLoginResult(null)
    try {
      const res = await promoterApi.verifyOtp(phone, code.trim())
      if (res.status === 'active') {
        const d = await promoterApi.dashboard()
        setData(d)
        setPhase('dashboard')
      } else if (res.status === 'new') {
        setApplyName(res.memberName ?? '')
        setLoginResult({ kind: 'new', memberName: res.memberName ?? null })
      } else {
        setLoginResult({ kind: res.status })
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '로그인에 실패했습니다.'
      setAlertMsg(msg)
    } finally {
      setBusy(false)
    }
  }

  const onApply = async (e: FormEvent) => {
    e.preventDefault()
    if (!applyName.trim()) {
      setAlertMsg('이름을 입력해 주세요.')
      return
    }
    if (busy) return
    setBusy(true)
    try {
      const res = await promoterApi.apply({
        phone,
        name: applyName.trim(),
        bank_name: bankName.trim() || undefined,
        bank_account: bankAccount.trim() || undefined,
        account_holder: accountHolder.trim() || undefined,
        inv: inv || undefined,
      })
      if (res.autoApproved) {
        // 주인 초대 → 즉시 승인 + 세션 쿠키 발급됨. 바로 대시보드로.
        const d = await promoterApi.dashboard()
        setData(d)
        setPhase('dashboard')
      } else {
        setLoginResult({ kind: 'applied' })
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '신청에 실패했습니다.'
      setAlertMsg(msg)
    } finally {
      setBusy(false)
    }
  }

  const onLogout = async () => {
    try {
      await promoterApi.logout()
    } catch {
      /* ignore */
    }
    setData(null)
    setPhone('')
    setCode('')
    setOtpSent(false)
    setLoginResult(null)
    setApplyName('')
    setBankName('')
    setBankAccount('')
    setAccountHolder('')
    setPhase('login')
  }

  return (
    <div className="mobile-frame flex flex-col min-h-screen">
      <MobileHeader title="서포터즈" hideBack />

      <main className="flex-1 flex flex-col px-4 pb-10">
        {phase === 'login' && (
          <>
            {loadingDash ? (
              <div className="py-12 text-center text-[14px] text-[#6A7282]">불러오는 중...</div>
            ) : (
              <div className="flex flex-col">
                <form className="flex flex-col gap-4 mt-3" onSubmit={onVerify}>
                  <p className="text-[14px] leading-[160%] text-[#6A7282]">
                    이미 등록된 서포터즈라면
                    <br />
                    휴대폰 인증으로 나의 기대수익을 확인하세요.
                  </p>

                  <div>
                    <label className="text-[14px] font-semibold text-[#1E2939] block mb-1.5">
                      휴대폰번호
                    </label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <InputField
                          type="tel"
                          value={phone}
                          onChange={(v) => setPhone(v.replace(/[^0-9]/g, '').slice(0, 11))}
                          placeholder="'-' 없이 숫자만 입력"
                          autoComplete="tel"
                          rightPadding="sm"
                          disabled={otpSent}
                          maxLength={11}
                          inputMode="numeric"
                          pattern="\d*"
                          borderStrong
                        />
                      </div>
                      <OutlineButton type="button" onClick={onRequestOtp} disabled={busy || otpSent}>
                        {otpSent ? '발송됨' : '인증번호 받기'}
                      </OutlineButton>
                    </div>
                  </div>

                  {otpSent && (
                    <div>
                      <label className="text-[14px] font-semibold text-[#1E2939] block mb-1.5">
                        인증번호
                      </label>
                      <InputField
                        value={code}
                        onChange={(v) => setCode(v.replace(/[^0-9]/g, '').slice(0, 6))}
                        placeholder="인증번호를 입력하세요."
                        rightPadding="sm"
                        maxLength={6}
                        inputMode="numeric"
                        pattern="\d*"
                        borderStrong
                      />
                    </div>
                  )}

                  {otpSent && !loginResult && (
                    <PrimaryButton type="submit" loading={busy} className="mt-2">
                      로그인
                    </PrimaryButton>
                  )}
                </form>

                {/* verifyOtp 결과 분기 — pending/rejected/inactive 안내, new=신청 폼, applied=접수 완료 */}
                {loginResult && loginResult.kind !== 'new' && (
                  <div className="mt-4 rounded-[16px] bg-[#fdf2f8] border border-[#fbcfe8] px-4 py-4 text-[14px] leading-[170%] text-[#1E2939]">
                    {loginResult.kind === 'pending' &&
                      '승인 대기 중이에요. 관리자 승인 후 이용하실 수 있어요.'}
                    {loginResult.kind === 'rejected' &&
                      '신청이 반려되었습니다. 관리자에게 문의해주세요.'}
                    {loginResult.kind === 'inactive' &&
                      '현재 비활성 상태예요. 관리자에게 문의해주세요.'}
                    {loginResult.kind === 'applied' &&
                      '신청이 접수됐어요! 관리자 승인 후 활동을 시작하실 수 있어요.'}
                  </div>
                )}

                {/* 신청 폼 — status='new' */}
                {loginResult?.kind === 'new' && (
                  <form className="mt-4 flex flex-col gap-4" onSubmit={onApply}>
                    {inv ? (
                      <div className="rounded-[16px] bg-[#FEFCE8] border border-[#FDE68A] px-4 py-4">
                        <p className="text-[14px] leading-[170%] text-[#854D0E]">
                          🎁 <b>초대받아 가입</b>하시는군요!
                          <br />
                          지금 신청하면 <b>바로 승인</b>되어 즉시 모집인 활동을 시작할 수 있어요.
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-[16px] bg-[#fdf2f8] border border-[#fbcfe8] px-4 py-4">
                        <p className="text-[14px] leading-[170%] text-[#1E2939]">
                          아직 등록되지 않은 번호예요.
                          <br />
                          서포터즈로 신청하시겠어요?
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="text-[14px] font-semibold text-[#1E2939] block mb-1.5">
                        휴대폰번호
                      </label>
                      <InputField
                        type="tel"
                        value={phone}
                        onChange={() => {}}
                        disabled
                        rightPadding="sm"
                        borderStrong
                      />
                    </div>

                    <div>
                      <label className="text-[14px] font-semibold text-[#1E2939] block mb-1.5">
                        이름
                      </label>
                      <InputField
                        value={applyName}
                        onChange={(v) => setApplyName(v.slice(0, 30))}
                        placeholder="이름을 입력하세요."
                        rightPadding="sm"
                        maxLength={30}
                        borderStrong
                      />
                    </div>

                    <div>
                      <label className="text-[14px] font-semibold text-[#1E2939] block mb-1.5">
                        은행명
                      </label>
                      <InputField
                        value={bankName}
                        onChange={(v) => setBankName(v.slice(0, 30))}
                        placeholder="예: 국민은행"
                        rightPadding="sm"
                        maxLength={30}
                        borderStrong
                      />
                    </div>

                    <div>
                      <label className="text-[14px] font-semibold text-[#1E2939] block mb-1.5">
                        계좌번호
                      </label>
                      <InputField
                        value={bankAccount}
                        onChange={(v) => setBankAccount(v.replace(/[^0-9-]/g, '').slice(0, 30))}
                        placeholder="'-' 포함 가능"
                        rightPadding="sm"
                        maxLength={30}
                        inputMode="numeric"
                        borderStrong
                      />
                    </div>

                    <div>
                      <label className="text-[14px] font-semibold text-[#1E2939] block mb-1.5">
                        예금주
                      </label>
                      <InputField
                        value={accountHolder}
                        onChange={(v) => setAccountHolder(v.slice(0, 30))}
                        placeholder="예금주명"
                        rightPadding="sm"
                        maxLength={30}
                        borderStrong
                      />
                    </div>

                    <PrimaryButton type="submit" loading={busy} className="mt-2">
                      서포터즈 신청하기
                    </PrimaryButton>
                  </form>
                )}

                {/* 사주플랜 서포터즈 소개 — 로고+텍스트 가로 배치(세로 공간 절약) */}
                <div className="mt-7">
                  <div className="flex items-center gap-3.5">
                    <img
                      src="/android-chrome-192x192.png"
                      alt="사주플랜"
                      className="w-[60px] h-[60px] rounded-[15px] shadow-[0_4px_12px_rgba(0,0,0,0.12)] shrink-0"
                    />
                    <div className="text-left">
                      <h2 className="text-[17px] font-bold text-[#1E2939]">사주플랜 서포터즈</h2>
                      <p className="mt-1 text-[13px] leading-[160%] text-[#6A7282]">
                        내가 초대한 회원이 사주·타로·신점 상담을 이용할 때마다 적립금이 쌓여요.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 w-full">
                    <h3 className="text-[14px] font-semibold text-[#1E2939] mb-4">이렇게 적립돼요</h3>
                    <ol className="flex flex-col">
                      <Step
                        n={1}
                        title="내 추천 링크 공유하기"
                        desc="카카오톡·문자·SNS 어디든 내 링크를 보내거나, 만나는 사람에게 직접 알려주세요."
                      />
                      <Step
                        n={2}
                        title="친구가 그 링크로 가입"
                        desc="친구가 가입할 때 내 추천 코드를 입력하면, ‘내가 모집한 회원’으로 연결돼요."
                      />
                      <Step
                        n={3}
                        title="상담 이용할 때마다 적립"
                        desc="그 회원이 사주·타로·신점 상담을 이용하면, 이용 금액의 일부가 내 기대수익으로 차곡차곡 쌓여요."
                        last
                      />
                    </ol>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {phase === 'dashboard' && data && (
          <div className="flex flex-col gap-4 mt-1">
            {/* 격려 한마디 */}
            <p className="text-center text-[14px] leading-[150%] text-[#6A7282]">
              함께해 주셔서 고마워요 💕 모집할수록{' '}
              <span className="font-semibold text-[#ec4899]">기대수익</span>이 쌓여요!
            </p>

            {/* 기대수익 강조 (조밀) */}
            <div className="rounded-[18px] bg-gradient-to-b from-[#fdf2f8] to-white border border-[#fbcfe8] px-5 py-5 text-center">
              <span className="text-[13px] font-medium text-[#6A7282]">기대수익</span>
              <div className="mt-1 text-[30px] font-bold leading-none text-[#ec4899]">
                {data.expected.toLocaleString()}
                <span className="text-[17px] font-semibold ml-0.5">원</span>
              </div>
              <p className="mt-2.5 text-[12px] leading-[150%] text-[#6A7282]">
                모집 인원 <span className="font-semibold text-[#1E2939]">{data.recruitCount}명</span>
                {' · '}내 코드 <span className="font-semibold text-[#1E2939]">{data.code}</span>
                {' · '}정산 완료 <span className="font-semibold text-[#1E2939]">{data.paidTotal.toLocaleString()}원</span>
              </p>
            </div>

            {/* 내 추천 링크 공유 — 카카오 공유 카드 제목이 "사주플랜 서포터즈" 로 노출됨 */}
            <div>
              <PrimaryButton type="button" className="w-full h-12 text-[15px]" onClick={() => setShareOpen(true)}>
                카카오톡으로 내 링크 공유하기
              </PrimaryButton>
              <p className="mt-2 text-center text-[12px] leading-[160%] text-[#99A1AF]">
                이 버튼으로 공유하면 <span className="font-medium text-[#ec4899]">사주플랜 서포터즈</span> 카드로 전달돼요.
              </p>
              <div className="mt-2.5 rounded-[14px] bg-[#fff7ed] border border-[#fed7aa] px-4 py-3">
                <p className="text-[13px] leading-[165%] text-[#9a3412] text-center">
                  ⚠️ 가입하는 분에게 <span className="font-bold">내 코드 {data.code} 를 꼭 입력</span>해달라고 전해주세요!
                  <br />
                  <span className="text-[12px] text-[#c2410c]">코드를 안 넣으면 추천이 잡히지 않아요.</span>
                </p>
              </div>
            </div>

            {/* 적립 타임라인 */}
            <div>
              <h2 className="text-[15px] font-semibold text-[#1E2939] mb-2">적립 내역</h2>
              {data.timeline.length === 0 ? (
                <div className="rounded-[14px] bg-[#F9FAFB] border border-[#F3F4F6] px-4 py-7 text-center text-[14px] text-[#99A1AF]">
                  아직 적립 내역이 없어요.
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {data.timeline.map((it, i) => {
                    const voided = it.status === 'voided'
                    return (
                      <div
                        key={i}
                        className={`rounded-[12px] border px-3.5 py-2.5 flex items-center gap-2 ${
                          voided ? 'bg-[#F9FAFB] border-[#F3F4F6]' : 'bg-white border-[#F3F4F6]'
                        }`}
                      >
                        <span className="text-[11px] text-[#99A1AF] shrink-0 tabular-nums">
                          {fmtShort(it.createdAt)}
                        </span>
                        <span
                          className={`text-[13px] leading-none truncate ${
                            voided ? 'text-[#99A1AF] line-through' : 'text-[#1E2939]'
                          }`}
                        >
                          {it.maskedName}님 {it.usedAmount.toLocaleString()}원
                        </span>
                        <span
                          className={`text-[13px] font-semibold ml-auto shrink-0 ${
                            voided ? 'text-[#99A1AF] line-through' : 'text-[#ec4899]'
                          }`}
                        >
                          +{it.rewardAmount.toLocaleString()}원
                        </span>
                        {voided && <span className="text-[10px] font-medium text-[#FF6467] shrink-0">취소</span>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <OutlineButton type="button" className="w-full h-12 text-[15px] mt-2" onClick={onLogout}>
              로그아웃
            </OutlineButton>
          </div>
        )}

        {/* 맨 아래 — 바탕화면 바로가기(원하는 사람만) + 앱 다운로드 */}
        <div className="mt-auto pt-10 flex flex-col gap-3">
          <SupporterAppChrome />
        </div>
      </main>

      <ShareBottomSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        shareUrl={myLink}
        title="🎁 사주플랜 만원 무료코인 쿠폰"
        description={data ? `가입할 때 추천코드 ${data.code} 입력! 지금 가입하면 만원 공짜` : '지금 가입하면 만원이 공짜!'}
        imageUrl="/img/coupon-invite-v3.png"
      />

      <AlertModal open={!!alertMsg} message={alertMsg ?? ''} onClose={() => setAlertMsg(null)} />
    </div>
  )
}

/** 역할·혜택 설명 단계 (번호 타임라인 — 버튼 아님, 설명용) */
function Step({ n, title, desc, last }: { n: number; title: string; desc: string; last?: boolean }) {
  return (
    <li className="flex gap-3 text-left">
      <div className="flex flex-col items-center">
        <span className="shrink-0 w-7 h-7 rounded-full bg-[#ec4899] text-white text-[13px] font-bold flex items-center justify-center">
          {n}
        </span>
        {!last && <span className="flex-1 w-px bg-[#fbcfe8] my-1" />}
      </div>
      <div className={last ? '' : 'pb-5'}>
        <div className="text-[15px] font-semibold text-[#1E2939] leading-[150%]">{title}</div>
        <div className="mt-1 text-[13px] leading-[165%] text-[#6A7282]">{desc}</div>
      </div>
    </li>
  )
}

/** ISO/날짜 문자열 → 'MM.DD' (적립 타임라인 한 줄 표시용) */
function fmtShort(raw: string): string {
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${m}.${day}`
}
