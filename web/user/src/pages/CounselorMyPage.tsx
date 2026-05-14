import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'
import ConfirmModal from '../components/ConfirmModal'
import UploadedImage from '../components/UploadedImage'
import {
  MOCK_COUNSELOR_MY_PROFILE,
  COUNSELOR_MAIN_MENU,
} from '../data/counselorMyPage'
import { useAuth } from '../lib/auth-context'
import { counselorMypageApi, settlementApi, type SettlementSummary } from '../lib/api'
import { FILE_BASE } from '../lib/runtime-env'

function resolveImageUrl(u: string | null): string | null {
  if (!u) return null
  if (/^https?:\/\//.test(u)) return u
  if (u.startsWith('/')) return `${FILE_BASE}${u}`
  return u
}

/**
 * 08마이페이지_상담사_마이페이지 메인(상담사)
 * Figma node-id: 109:10423
 *
 * 구조:
 *  - 헤더: ← + "마이페이지" + 검색/알림
 *  - 프로필: 아바타(편집 펜) + 닉네임 + userid + 앱 설정 칩
 *  - 보유 금액 카드: 큰 보라 금액 / 전월·당월 / 정산하기·정산내역 2분할
 *  - 내 상담 상태 설정: 토글 3종 (상담 가능 여부 / 전화 상담 / 채팅 상담)
 *  - 상담사 전용 메뉴 8개
 *  - 로그아웃 (빨강)
 *  - BottomNav (myHref=/counselor/mypage)
 */
export default function CounselorMyPage() {
  const navigate = useNavigate()
  const { member, loading, logout } = useAuth()
  const [available, setAvailable] = useState(MOCK_COUNSELOR_MY_PROFILE.available)
  const [callOn, setCallOn] = useState(MOCK_COUNSELOR_MY_PROFILE.callEnabled)
  const [chatOn, setChatOn] = useState(MOCK_COUNSELOR_MY_PROFILE.chatEnabled)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [toggleBusy, setToggleBusy] = useState(false)
  const [settlement, setSettlement] = useState<SettlementSummary | null>(null)

  // 진입 시 실제 토글 값 + 정산 요약을 동시에 로드.
  //  - 토글: member.use_phone/use_chat
  //  - 정산 요약: 상담 금액 / 전월·당월 누적 / 정산 예정 금액
  //
  // 실시간 반영:
  //  - 30초 폴링 — 마이페이지를 열어둔 채 채팅이 종료돼도 자동 갱신.
  //  - visibilitychange('visible') / focus — 다른 탭/앱에서 돌아오는 즉시 갱신.
  useEffect(() => {
    if (!member || member.role !== 'counselor') return
    let cancelled = false

    counselorMypageApi.getAvailability()
      .then((r) => {
        if (cancelled) return
        setAvailable(r.available)
        setCallOn(r.use_phone)
        setChatOn(r.use_chat)
      })
      .catch(() => {
        /* 로드 실패 — mock 값 유지 */
      })

    const refreshSettlement = () => {
      settlementApi.summary()
        .then((s) => { if (!cancelled) setSettlement(s) })
        .catch(() => { /* 정산 요약 실패해도 페이지는 동작 */ })
    }
    refreshSettlement()
    const pollId = window.setInterval(refreshSettlement, 30_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshSettlement()
    }
    const onFocus = () => refreshSettlement()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      window.clearInterval(pollId)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
    }
  }, [member])

  /**
   * 토글 변경 → 즉시 API 반영. 낙관적 UI 후 실패 시 롤백.
   *  - available=false 면 use_phone/use_chat 값과 무관하게 휴식(ABSE) 처리
   *  - 한 번에 하나만 변경됨 (다른 두 값은 현재 state 그대로 유지)
   */
  const updateAvailability = async (next: { available?: boolean; use_phone?: boolean; use_chat?: boolean }) => {
    const prev = { available, callOn, chatOn }
    // 낙관적 UI
    if (next.available !== undefined) setAvailable(next.available)
    if (next.use_phone !== undefined) setCallOn(next.use_phone)
    if (next.use_chat !== undefined) setChatOn(next.use_chat)
    setToggleBusy(true)
    try {
      const r = await counselorMypageApi.setAvailability(next)
      setAvailable(r.available)
      setCallOn(r.use_phone)
      setChatOn(r.use_chat)
    } catch (e) {
      // 롤백
      setAvailable(prev.available)
      setCallOn(prev.callOn)
      setChatOn(prev.chatOn)
      alert(`상태 변경 실패: ${e instanceof Error ? e.message : ''}`)
    } finally {
      setToggleBusy(false)
    }
  }

  const handleLogout = async () => {
    setLogoutOpen(false)
    await logout()
    navigate('/mypage', { replace: true })
  }

  if (loading) {
    return (
      <div className="mobile-frame flex flex-col">
        <div className="h-[60px] px-4 flex items-center bg-white">
          <h1 className="text-[18px] font-semibold text-[#030712]">마이페이지</h1>
        </div>
        <main className="flex-1 px-4 py-6 flex flex-col gap-3">
          <div className="h-16 rounded-2xl bg-[#F3F4F6] animate-pulse" />
          <div className="h-32 rounded-2xl bg-[#F3F4F6] animate-pulse" />
        </main>
      </div>
    )
  }

  if (!member) {
    return <Navigate to="/login?redirect=/mypage" replace />
  }

  // 프로필 이미지 — me() 응답의 profile_image 사용. 없으면 placeholder.
  const profileImage = resolveImageUrl(member.profile_image)
  const profileImageWebp = resolveImageUrl(member.profile_image_webp)
  const displayName = member.nickname || member.name || member.mb_id

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
          마이페이지
        </h1>
        <div className="flex items-center gap-3">
          <Link to="/search" aria-label="검색" className="w-[30px] h-[30px] flex items-center justify-center">
            <img src="/img/ic_hd_search.svg" alt="" className="w-7 h-7" />
          </Link>
          <Link to="/notifications" aria-label="알림" className="w-[30px] h-[30px] flex items-center justify-center">
            <img src="/img/ic_hd_push.svg" alt="" className="w-7 h-7" />
          </Link>
        </div>
      </header>

      <main className="flex-1 px-4">
        {/* 프로필 — 클릭 시 회원 정보 수정 페이지(이미지/닉네임/연락처 등) 진입.
            상담사도 member 레코드를 공유하므로 같은 페이지를 사용. */}
        <section className="pt-2 pb-5 flex items-center gap-3">
          <Link
            to="/mypage/member/edit"
            aria-label="프로필 수정"
            className="relative w-[60px] h-[60px] shrink-0 rounded-full bg-[#F3F4F6] flex items-center justify-center overflow-hidden"
          >
            {profileImage ? (
              <UploadedImage
                src={profileImage}
                srcWebp={profileImageWebp}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <svg viewBox="0 0 24 24" className="w-9 h-9" fill="none" aria-hidden>
                <circle cx="12" cy="9" r="3.5" stroke="#99A1AF" strokeWidth="1.5" />
                <path d="M5 19.5C5 16.4624 8.13401 14 12 14C15.866 14 19 16.4624 19 19.5" stroke="#99A1AF" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-white border border-[#F3F4F6] flex items-center justify-center">
              <img src="/img/ic_edit.svg" alt="" className="w-3 h-3" />
            </span>
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-[18px] leading-[140%] font-bold text-[#030712] truncate">
              {displayName}
            </p>
            <p className="mt-0.5 text-[14px] leading-[140%] text-[#99A1AF] truncate">
              {member.mb_id}
            </p>
          </div>
          <Link
            to="/mypage/app-settings"
            className="h-8 px-4 rounded-full border border-[#E5E7EB] flex items-center justify-center text-[13px] font-medium text-[#4A5565]"
          >
            앱 설정
          </Link>
        </section>

        {/* 상담 금액 — settlementApi.summary() 결과 표시. 로드 전엔 0원으로 표시. */}
        <section className="rounded-[16px] bg-[#F9FAFB] px-5 pt-5 pb-2">
          <p className="text-[14px] leading-[140%] text-[#6A7282]">상담 금액</p>
          <p className="mt-1 text-[26px] leading-[130%] font-bold text-[#9B7AF7]">
            {(settlement?.balance ?? 0).toLocaleString()}원
          </p>
          <ul className="mt-3 flex flex-col gap-1 text-[14px] leading-[140%]">
            <li className="flex items-center justify-between">
              <span className="text-[#6A7282]">전월</span>
              <span className="text-[#1E2939]">
                {(settlement?.prev_month ?? 0).toLocaleString()}원
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-[#6A7282]">당월</span>
              <span className="text-[#1E2939]">
                {(settlement?.this_month ?? 0).toLocaleString()}원
              </span>
            </li>
          </ul>
          {/*
            하단 액션 영역:
             - 좌측: "정산 예정 금액" 정보 표시 (운영 정책상 수동 정산하기 버튼은 제거 — 시스템 cron 자동 진행).
             - 우측: 정산내역 페이지 진입 (코인 수익 + 월별 마감).
          */}
          <div className="mt-3 -mx-1 grid grid-cols-2 border-t border-[#E5E7EB]">
            <div className="h-12 px-3 flex items-center justify-between gap-2 border-r border-[#E5E7EB]">
              <span className="text-[13px] text-[#6A7282] truncate">정산 예정</span>
              <span className="text-[14px] font-semibold text-[#8259F5] tabular-nums truncate">
                {(settlement?.estimated_payout ?? 0).toLocaleString()}원
              </span>
            </div>
            <Link
              to="/mypage/settlement/history"
              className="h-12 flex items-center justify-center gap-2 text-[14px] font-medium text-[#4A5565]"
            >
              <img src="/img/ic_my_receipt.svg" alt="" className="w-5 h-5" />
              정산내역
            </Link>
          </div>
        </section>

        {/* 상담 상태 */}
        <section className="pt-6">
          <h3 className="text-[14px] leading-[140%] text-[#99A1AF] mb-1">내 상담 상태 설정</h3>
          <ul className="flex flex-col">
            <ToggleRow
              label="상담 가능 여부"
              on={available}
              disabled={toggleBusy}
              onChange={(v) => void updateAvailability({ available: v })}
            />
            <ToggleRow
              label="전화 상담"
              on={callOn}
              disabled={toggleBusy || !available}
              onChange={(v) => void updateAvailability({ use_phone: v })}
            />
            <ToggleRow
              label="채팅 상담"
              on={chatOn}
              disabled={toggleBusy || !available}
              onChange={(v) => void updateAvailability({ use_chat: v })}
            />
          </ul>
        </section>

        {/* 상담사 전용 메뉴 */}
        <section className="pt-6">
          <h3 className="text-[14px] leading-[140%] text-[#99A1AF] mb-1">상담사 전용</h3>
          <ul className="flex flex-col">
            {COUNSELOR_MAIN_MENU.map((it) => (
              <li key={it.key}>
                <Link to={it.to} className="h-14 flex items-center gap-3">
                  <img src={it.icon} alt="" className="w-7 h-7" />
                  <span className="text-[17px] leading-[140%] font-semibold text-[#030712]">
                    {it.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <button
          type="button"
          onClick={() => setLogoutOpen(true)}
          className="mt-2 h-14 flex items-center gap-3 text-[#FB2C36]"
        >
          <img src="/img/ic_my_logout.svg" alt="" className="w-7 h-7" />
          <span className="text-[17px] leading-[140%] font-semibold">로그아웃</span>
        </button>
      </main>

      <FloatingActions bottomOffset={100} />
      <BottomNav myHref="/counselor/mypage" />

      <ConfirmModal
        open={logoutOpen}
        message="로그아웃 하시겠습니까?"
        actionLabel="로그아웃"
        onCancel={() => setLogoutOpen(false)}
        onConfirm={handleLogout}
      />
    </div>
  )
}

function ToggleRow({
  label,
  on,
  onChange,
  disabled,
}: {
  label: string
  on: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <li className="h-14 flex items-center justify-between">
      <span className={`text-[17px] leading-[140%] font-semibold ${disabled ? 'text-[#9CA3AF]' : 'text-[#030712]'}`}>{label}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!on)}
        aria-label={`${label} 토글`}
        className={`relative w-12 h-7 rounded-full transition-colors ${
          disabled ? 'opacity-50 cursor-not-allowed ' : ''
        }${on ? 'bg-[#9B7AF7]' : 'bg-[#D1D5DB]'}`}
      >
        <span
          className={`absolute top-0.5 w-6 h-6 rounded-full bg-white flex items-center justify-center transition-all ${
            on ? 'left-[22px]' : 'left-0.5'
          }`}
        >
          {on && (
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
    </li>
  )
}
